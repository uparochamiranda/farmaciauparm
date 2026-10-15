
create or replace function private.mutate(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid; actor uuid; rid uuid; med uuid; rec public.importacoes; item public.importacao_itens;
 j jsonb; result jsonb; source text; st text; mt text; qty numeric; cons numeric; old_qty numeric;
 critical numeric; attention numeric; member uuid; role_name text;
begin
 actor=private.current_profile();
 if auth.uid() is null or actor is null then raise exception 'Acesso não autorizado.'; end if;
 u=nullif(payload->>'unidade_id','')::uuid;
 if action in ('create_import','medication','alias','rules','manual_stock','unit','membership','profile') then
  if not private.can_access(u,true) then raise exception 'Sem permissão para alterar esta unidade.'; end if;
 end if;
 if action='create_import' then
  if payload->>'storage_path' not like u::text||'/'||auth.uid()::text||'/%' then raise exception 'Caminho de arquivo inválido.'; end if;
  if (payload->>'data_referencia')::date>current_date then raise exception 'Data de referência futura.'; end if;
  insert into public.importacoes(unidade_id,usuario_id,nome_arquivo,storage_path,tipo_arquivo,tamanho,file_hash,dias_consumo,data_referencia)
  select u,actor,payload->>'nome_arquivo',payload->>'storage_path',payload->>'tipo_arquivo',
  (payload->>'tamanho')::bigint,payload->>'file_hash',un.dias_consumo,coalesce((payload->>'data_referencia')::date,current_date)
  from public.unidades un where un.id=u returning id into rid;
  return jsonb_build_object('id',rid);
 elsif action in ('stage_import','fail_import','cancel_import','resolve_item') then
  rid=(payload->>'importacao_id')::uuid;
  select * into rec from public.importacoes where id=rid for update;
  if not found or not private.can_access(rec.unidade_id,true) then raise exception 'Importação não encontrada ou sem permissão.'; end if;
  if rec.status in ('COMPLETED','CONFIRMED','CANCELLED') then raise exception 'Esta importação já foi confirmada ou encerrada.'; end if;
  if action='stage_import' then
   if rec.status<>'UPLOADED' then raise exception 'Arquivo já processado.'; end if;
   if jsonb_array_length(payload->'itens') not between 1 and 10000 then raise exception 'Quantidade de linhas inválida.'; end if;
   if not exists(select 1 from storage.objects where bucket_id='importacoes' and name=rec.storage_path) then raise exception 'Arquivo original não encontrado.'; end if;
   update public.importacoes set status='PROCESSING' where id=rid;
   for j in select value from jsonb_array_elements(payload->'itens') loop
    med=nullif(j->>'medicamento_id','')::uuid; st=j->>'status'; mt=j->>'tipo_correspondencia';
    source=(j->>'nome_importado')||' '||coalesce(j->>'apresentacao_importada','');
    if st='OK' and (rec.tipo_arquivo='application/pdf' or not private.safe_match(source,med,rec.unidade_id)
       or (coalesce(j->>'codigo_importado','')<>'' and exists(select 1 from public.medicamentos m where m.codigo=j->>'codigo_importado' and m.id<>med)))
    then st='PENDENTE'; med=null; mt='NAO_IDENTIFICADO'; end if;
    insert into public.importacao_itens(importacao_id,numero_linha,linha_original,codigo_importado,nome_importado,apresentacao_importada,
     quantidade_importada,consumo_importado,medicamento_id,sugestao_id,tipo_correspondencia,confianca,status,motivo_pendencia)
    values(rid,(j->>'numero_linha')::integer,j->'linha_original',coalesce(j->>'codigo_importado',''),j->>'nome_importado',
     coalesce(j->>'apresentacao_importada',''),(j->>'quantidade_importada')::numeric,(j->>'consumo_importado')::numeric,med,
     nullif(j->>'sugestao_id','')::uuid,mt,coalesce((j->>'confianca')::numeric,0),st,
     case when st='PENDENTE' then coalesce(j->>'motivo_pendencia','VALIDACAO_OBRIGATORIA') else j->>'motivo_pendencia' end);
   end loop;
   update public.importacao_itens i set status='PENDENTE', motivo_pendencia='DUPLICIDADE',medicamento_id=null
    where i.importacao_id=rid and (
     (i.codigo_importado<>'' and (select count(*) from public.importacao_itens x where x.importacao_id=rid and x.codigo_importado=i.codigo_importado)>1)
     or (i.medicamento_id is not null and (select count(*) from public.importacao_itens x where x.importacao_id=rid and x.medicamento_id=i.medicamento_id)>1));
   update public.importacoes set status='WAITING_REVIEW',total_linhas=jsonb_array_length(payload->'itens'),
    identificados_codigo=(select count(*) from public.importacao_itens where importacao_id=rid and status='OK' and tipo_correspondencia='CODIGO'),
    identificados_alias=(select count(*) from public.importacao_itens where importacao_id=rid and status='OK' and tipo_correspondencia='ALIAS'),
    identificados_nome=(select count(*) from public.importacao_itens where importacao_id=rid and status='OK' and tipo_correspondencia='NOME_NORMALIZADO')
    where id=rid;
  elsif action='fail_import' then
   if rec.status not in ('UPLOADED','PROCESSING') then raise exception 'Estado inválido.'; end if;
   update public.importacoes set status='FAILED',erro=left(payload->>'erro',500) where id=rid;
  elsif action='cancel_import' then
   update public.importacoes set status='CANCELLED' where id=rid;
  elsif action='resolve_item' then
   if rec.status<>'WAITING_REVIEW' then raise exception 'Importação indisponível para revisão.'; end if;
   select * into item from public.importacao_itens where id=(payload->>'item_id')::uuid and importacao_id=rid for update;
   if not found then raise exception 'Linha não encontrada.'; end if;
   if length(trim(coalesce(payload->>'justificativa','')))<5 then raise exception 'Informe a justificativa da revisão.'; end if;
   if payload->>'ignorar'='true' then
    update public.importacao_itens set status='IGNORADO',justificativa=payload->>'justificativa',revisado_por=actor where id=item.id;
   else
    med=(payload->>'medicamento_id')::uuid; qty=(payload->>'quantidade')::numeric;
    if item.motivo_pendencia='CONSUMO_INVALIDO' and nullif(payload->>'consumo','') is null then raise exception 'Corrija o consumo antes de validar a linha.'; end if;
    if qty is null or qty<0 then raise exception 'Quantidade inválida.'; end if;
    if not exists(select 1 from public.medicamentos where id=med and ativo) then raise exception 'Medicamento inativo ou inexistente.'; end if;
    update public.importacao_itens set medicamento_id=med,quantidade_importada=qty,consumo_importado=case when payload ? 'consumo' then (payload->>'consumo')::numeric else consumo_importado end,status='OK',tipo_correspondencia='MANUAL',
      justificativa=payload->>'justificativa',revisado_por=actor,confianca=1 where id=item.id;
    if payload->>'criar_alias'='true' then
     source=item.nome_importado||' '||item.apresentacao_importada;
     if private.signature(source)='' or private.signature(source)<>(select private.signature(nome||' '||apresentacao) from public.medicamentos where id=med)
      then raise exception 'Diferenças clínicas não podem ser gravadas como DE-PARA. Corrija a origem.'; end if;
     insert into public.medicamento_aliases(unidade_id,alias,alias_normalizado,medicamento_id,criado_por)
     values(rec.unidade_id,source,private.normalize(source),med,actor);
    end if;
   end if;
  end if;
  update public.importacoes set
   pendentes=(select count(*) from public.importacao_itens where importacao_id=rid and status='PENDENTE'),
   erros=(select count(*) from public.importacao_itens where importacao_id=rid and status='ERRO') where id=rid;
  return jsonb_build_object('id',rid);
 elsif action='medication' then
  med=nullif(payload->>'id','')::uuid;
  if med is not null and not private.is_admin() then raise exception 'Somente administrador pode alterar o cadastro global.'; end if;
  if med is null then
   insert into public.medicamentos(codigo,nome,principio_ativo,concentracao,unidade_concentracao,forma_farmaceutica,apresentacao,volume,unidade_volume,grupo)
   values(nullif(trim(payload->>'codigo'),''),trim(payload->>'nome'),coalesce(payload->>'principio_ativo',''),coalesce(payload->>'concentracao',''),
   coalesce(payload->>'unidade_concentracao',''),coalesce(payload->>'forma_farmaceutica',''),payload->>'apresentacao',
   coalesce(payload->>'volume',''),coalesce(payload->>'unidade_volume',''),coalesce(payload->>'grupo','Outros')) returning id into med;
  else
   update public.medicamentos set codigo=nullif(trim(payload->>'codigo'),''),nome=trim(payload->>'nome'),
    principio_ativo=coalesce(payload->>'principio_ativo',''),concentracao=coalesce(payload->>'concentracao',''),
    unidade_concentracao=coalesce(payload->>'unidade_concentracao',''),forma_farmaceutica=coalesce(payload->>'forma_farmaceutica',''),
    apresentacao=payload->>'apresentacao',volume=coalesce(payload->>'volume',''),unidade_volume=coalesce(payload->>'unidade_volume',''),
    grupo=coalesce(payload->>'grupo','Outros'),ativo=coalesce((payload->>'ativo')::boolean,true),updated_at=now() where id=med;
  end if;
  return jsonb_build_object('id',med);
 elsif action='alias' then
  rid=nullif(payload->>'id','')::uuid; med=(payload->>'medicamento_id')::uuid; source=payload->>'alias';
  if rid is not null and payload->>'ativo'='false' then
   update public.medicamento_aliases set ativo=false,updated_at=now() where id=rid and unidade_id=u;
  else
   if private.signature(source)='' or private.signature(source)<>(select private.signature(nome||' '||apresentacao) from public.medicamentos where id=med and ativo)
    then raise exception 'Apresentação divergente. O DE-PARA não pode ignorar diferenças clínicas.'; end if;
   insert into public.medicamento_aliases(unidade_id,alias,alias_normalizado,medicamento_id,criado_por)
   values(u,source,private.normalize(source),med,actor)
   on conflict(unidade_id,alias_normalizado) do update set medicamento_id=excluded.medicamento_id,ativo=true,updated_at=now() returning id into rid;
  end if;
  return jsonb_build_object('id',rid);
 elsif action='rules' then
  if not private.is_admin() then raise exception 'Somente administrador pode alterar regras.'; end if;
  med=nullif(payload->>'medicamento_id','')::uuid;
  critical=(payload->>'critico')::numeric; attention=(payload->>'atencao')::numeric;
  if critical is null or attention is null or critical<=0 or attention<=critical then raise exception 'Limites de cobertura inválidos.'; end if;
  insert into public.regras_criticos(unidade_id,medicamento_id,nome,tipo_regra,dias_minimos,dias_maximos,cor,prioridade) values
   (u,med,'Crítico','CRITICO',0,critical,'#ef3340',30),(u,med,'Atenção','ATENCAO',critical,attention,'#f59e0b',20),(u,med,'Normal','NORMAL',attention,null,'#16a35b',10)
  on conflict(unidade_id,medicamento_id,tipo_regra) do update set dias_minimos=excluded.dias_minimos,dias_maximos=excluded.dias_maximos,ativo=true,updated_at=now();
  update public.estoque_atual set situacao=private.classify(quantidade,cmd,unidade_id,medicamento_id) where unidade_id=u and (med is null or medicamento_id=med);
  return '{"ok":true}'::jsonb;
 elsif action='manual_stock' then
  if not private.is_admin() then raise exception 'Somente administrador pode ajustar estoque.'; end if;
  if length(trim(coalesce(payload->>'justificativa','')))<5 then raise exception 'Informe a justificativa.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  med=(payload->>'medicamento_id')::uuid; qty=(payload->>'quantidade')::numeric;
  if qty is null or qty<0 then raise exception 'Quantidade inválida.'; end if;
  select quantidade into old_qty from public.estoque_atual where unidade_id=u and medicamento_id=med for update;
  if not found then raise exception 'Estoque não encontrado.'; end if;
  update public.estoque_atual set quantidade=qty,situacao=private.classify(qty,cmd,u,med),updated_at=now() where unidade_id=u and medicamento_id=med;
  insert into public.estoque_historico(unidade_id,medicamento_id,quantidade,cmd,dias_cobertura,situacao)
   select unidade_id,medicamento_id,quantidade,cmd,dias_cobertura,situacao from public.estoque_atual where unidade_id=u and medicamento_id=med;
  insert into public.audit_logs(user_id,unidade_id,acao,entidade,registro_id,dados_anteriores,dados_novos)
   values(actor,u,'AJUSTE_MANUAL','estoque_atual',med,jsonb_build_object('quantidade',old_qty),payload);
  return '{"ok":true}'::jsonb;
 elsif action='unit' then
  if not private.is_admin() then raise exception 'Somente administrador.'; end if;
  update public.unidades set nome=payload->>'nome',sigla=payload->>'sigla',endereco=coalesce(payload->>'endereco',''),
   dias_consumo=(payload->>'dias_consumo')::integer,updated_at=now() where id=u;
  return '{"ok":true}'::jsonb;
 elsif action='profile' then
  if not private.is_admin() then raise exception 'Somente administrador.'; end if;
  role_name=payload->>'perfil'; member=nullif(payload->>'id','')::uuid;
  if member=actor and (role_name<>'ADMIN' or payload->>'ativo'='false') then raise exception 'Não é possível remover seu próprio acesso administrativo.'; end if;
  if member is null then
   insert into public.profiles(auth_user_id,nome,email,perfil)
    select id,payload->>'nome',email,role_name from auth.users where id=(payload->>'auth_user_id')::uuid returning id into member;
   if member is null then raise exception 'Crie o usuário primeiro no Supabase Auth.'; end if;
  else update public.profiles set nome=payload->>'nome',perfil=role_name,ativo=coalesce((payload->>'ativo')::boolean,true),updated_at=now() where id=member;
  end if;
  return jsonb_build_object('id',member);
 elsif action='membership' then
  if not private.is_admin() then raise exception 'Somente administrador.'; end if;
  member=(payload->>'usuario_id')::uuid;
  if payload->>'remover'='true' then delete from public.usuario_unidades where usuario_id=member and unidade_id=u;
  else insert into public.usuario_unidades(usuario_id,unidade_id) values(member,u) on conflict do nothing; end if;
  return '{"ok":true}'::jsonb;
 end if;
 raise exception 'Operação desconhecida.';
end; $$;

