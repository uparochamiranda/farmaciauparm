
begin;
-- Transaction-only fixtures. Every row is rolled back after the assertions.
insert into auth.users(id,email) values
 ('a0000000-0000-4000-8000-000000000001','pharmacy-test@example.invalid'),
 ('a0000000-0000-4000-8000-000000000002','management-test@example.invalid');
insert into public.unidades(id,nome,sigla) values
 ('b0000000-0000-4000-8000-000000000001','Teste A','TA'),
 ('b0000000-0000-4000-8000-000000000002','Teste B','TB');
insert into public.profiles(id,auth_user_id,nome,email,perfil) values
 ('c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Teste Farmácia','pharmacy-test@example.invalid','FARMACIA'),
 ('c0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','Teste Gestão','management-test@example.invalid','GESTAO');
insert into public.usuario_unidades(usuario_id,unidade_id) values
 ('c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001'),
 ('c0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001');
insert into public.medicamentos(id,codigo,nome,apresentacao) values
 ('d0000000-0000-4000-8000-000000000001','TEST-SAFE-A','ONDANSETRONA','2 mg/mL 2 mL'),
 ('d0000000-0000-4000-8000-000000000002','TEST-SAFE-B','AZITROMICINA','500 mg');
insert into public.importacoes(id,unidade_id,usuario_id,nome_arquivo,storage_path,tipo_arquivo,tamanho,file_hash,status,dias_consumo)
 values('e0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','test.csv','test-only.csv','text/csv',100,repeat('a',64),'WAITING_REVIEW',112);
insert into public.importacao_itens(id,importacao_id,numero_linha,linha_original,nome_importado,apresentacao_importada,quantidade_importada,consumo_importado,medicamento_id,tipo_correspondencia,status,motivo_pendencia) values
 ('f0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001',2,'{}','ONDANSETRONA','2 mg/mL 2 mL',8,448,'d0000000-0000-4000-8000-000000000001','CODIGO','OK',null),
 ('f0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000001',3,'{}','AZITROMICINA','500 mg',20,null,null,'NAO_IDENTIFICADO','PENDENTE','PRODUTO_NOVO');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.unidades where id='b0000000-0000-4000-8000-000000000002')<>0 then raise exception 'FAIL: cross-unit RLS'; end if;
 if not private.can_access('b0000000-0000-4000-8000-000000000001',true) then raise exception 'FAIL: pharmacy write permission'; end if;
 if private.safe_match('ONDANSETRONA 2 mg/mL 4 mL','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001') then raise exception 'FAIL: volume matching'; end if;
 if private.safe_match('ONDANSETRONA 2 mcg/mL 2 mL','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001') then raise exception 'FAIL: unit matching'; end if;
 if not private.safe_match('ONDANSETRONA 2MG/ML 2ML','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001') then raise exception 'FAIL: exact matching'; end if;
 begin
  perform public.confirm_import('e0000000-0000-4000-8000-000000000001');
  raise exception 'FAIL: pending confirmation accepted';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
 if exists(select 1 from public.estoque_atual where unidade_id='b0000000-0000-4000-8000-000000000001') then raise exception 'FAIL: rollback after pending'; end if;
 begin
  update public.importacoes set status='COMPLETED' where id='e0000000-0000-4000-8000-000000000001';
  raise exception 'FAIL: direct table mutation';
 exception when insufficient_privilege then null; end;
 perform public.mutate('resolve_item','{"importacao_id":"e0000000-0000-4000-8000-000000000001","item_id":"f0000000-0000-4000-8000-000000000002","medicamento_id":"d0000000-0000-4000-8000-000000000002","quantidade":20,"justificativa":"Apresentação conferida manualmente"}');
 perform public.confirm_import('e0000000-0000-4000-8000-000000000001');
 if (select count(*) from public.estoque_atual where unidade_id='b0000000-0000-4000-8000-000000000001')<>2 then raise exception 'FAIL: stock update'; end if;
 if not exists(select 1 from public.estoque_atual where medicamento_id='d0000000-0000-4000-8000-000000000001' and quantidade=8 and cmd=4 and dias_cobertura=2 and situacao='CRITICO') then raise exception 'FAIL: CMD coverage classification'; end if;
 if not exists(select 1 from public.estoque_atual where medicamento_id='d0000000-0000-4000-8000-000000000002' and cmd=0 and dias_cobertura is null and situacao='SEM_CONSUMO') then raise exception 'FAIL: division by zero'; end if;
 if (select count(*) from public.estoque_historico where importacao_id='e0000000-0000-4000-8000-000000000001')<>2 then raise exception 'FAIL: history'; end if;
 if not exists(select 1 from public.audit_logs where registro_id='e0000000-0000-4000-8000-000000000001' and acao='IMPORTACAO_CONFIRMADA') then raise exception 'FAIL: audit'; end if;
 begin
  perform public.confirm_import('e0000000-0000-4000-8000-000000000001');
  raise exception 'FAIL: double confirmation accepted';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
 begin
  perform public.mutate('alias','{"unidade_id":"b0000000-0000-4000-8000-000000000001","medicamento_id":"d0000000-0000-4000-8000-000000000001","alias":"ONDANSETRONA 2MG/ML 4ML"}');
  raise exception 'FAIL: unsafe alias accepted';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 if private.can_access('b0000000-0000-4000-8000-000000000001',true) then raise exception 'FAIL: management write'; end if;
 if (select count(*) from public.estoque_atual where unidade_id='b0000000-0000-4000-8000-000000000001')<>2 then raise exception 'FAIL: management read'; end if;
 begin
  perform public.mutate('medication','{"unidade_id":"b0000000-0000-4000-8000-000000000001","nome":"FORBIDDEN","apresentacao":"500mg"}');
  raise exception 'FAIL: management mutation allowed';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
end $$;
reset role;
-- Force a late failure after the first stock row is updated: all writes must roll back.
insert into public.importacoes(id,unidade_id,usuario_id,nome_arquivo,storage_path,tipo_arquivo,tamanho,file_hash,status,dias_consumo)
 values('e0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','rollback.csv','rollback-only.csv','text/csv',100,repeat('b',64),'WAITING_REVIEW',112);
insert into public.importacao_itens(importacao_id,numero_linha,linha_original,nome_importado,quantidade_importada,medicamento_id,tipo_correspondencia,status)
 values('e0000000-0000-4000-8000-000000000002',2,'{}','ONDANSETRONA',999,'d0000000-0000-4000-8000-000000000001','MANUAL','OK'),
 ('e0000000-0000-4000-8000-000000000002',3,'{}','AZITROMICINA',999,'d0000000-0000-4000-8000-000000000002','MANUAL','OK');
update public.medicamentos set ativo=false where id='d0000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
 begin perform public.confirm_import('e0000000-0000-4000-8000-000000000002');
  raise exception 'FAIL: late failure accepted';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
 if (select quantidade from public.estoque_atual where unidade_id='b0000000-0000-4000-8000-000000000001' and medicamento_id='d0000000-0000-4000-8000-000000000001')<>8 then raise exception 'FAIL: partial stock write survived'; end if;
 if (select status from public.importacoes where id='e0000000-0000-4000-8000-000000000002')<>'WAITING_REVIEW' then raise exception 'FAIL: partial status survived'; end if;
 if exists(select 1 from public.estoque_historico where importacao_id='e0000000-0000-4000-8000-000000000002') then raise exception 'FAIL: partial history survived'; end if;
end $$;
reset role;
rollback;
select 'PASS: isolation, role authorization, matching, pending block, confirmation, CMD, coverage, zero consumption, history, audit, idempotency, unsafe alias, late rollback' as result;
