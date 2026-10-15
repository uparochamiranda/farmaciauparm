
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.unidades (
 id uuid primary key default gen_random_uuid(), nome text not null, sigla text not null, codigo text unique,
 endereco text not null default '', ativo boolean not null default true, dias_consumo integer not null default 112 check(dias_consumo between 1 and 366),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key default gen_random_uuid(), auth_user_id uuid not null unique references auth.users(id),
 nome text not null, email text not null, perfil text not null check(perfil in ('ADMIN','FARMACIA','GESTAO')),
 ativo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.usuario_unidades (
 id uuid primary key default gen_random_uuid(), usuario_id uuid not null references profiles(id), unidade_id uuid not null references unidades(id),
 created_at timestamptz not null default now(), unique(usuario_id,unidade_id)
);
create table public.medicamentos (
 id uuid primary key default gen_random_uuid(), codigo text unique, nome text not null check(length(trim(nome))>0),
 principio_ativo text not null default '', concentracao text not null default '', unidade_concentracao text not null default '',
 forma_farmaceutica text not null default '', apresentacao text not null check(length(trim(apresentacao))>0),
 volume text not null default '', unidade_volume text not null default '', grupo text not null default 'Outros',
 ativo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.medicamento_aliases (
 id uuid primary key default gen_random_uuid(), unidade_id uuid not null references unidades(id),
 alias text not null, alias_normalizado text not null, medicamento_id uuid not null references medicamentos(id),
 tipo text not null default 'MANUAL', ativo boolean not null default true, criado_por uuid not null references profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(unidade_id,alias_normalizado)
);
create table public.importacoes (
 id uuid primary key default gen_random_uuid(), unidade_id uuid not null references unidades(id), usuario_id uuid not null references profiles(id),
 nome_arquivo text not null, storage_path text not null unique, tipo_arquivo text not null, tamanho bigint not null check(tamanho between 1 and 10485760),
 file_hash text not null check(file_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'UPLOADED' check(status in ('UPLOADED','PROCESSING','WAITING_REVIEW','CONFIRMED','COMPLETED','FAILED','CANCELLED')),
 data_referencia date not null default current_date, dias_consumo integer not null check(dias_consumo between 1 and 366),
 total_linhas integer not null default 0, identificados_codigo integer not null default 0, identificados_alias integer not null default 0,
 identificados_nome integer not null default 0, pendentes integer not null default 0, erros integer not null default 0,
 erro text, created_at timestamptz not null default now(), confirmed_at timestamptz, completed_at timestamptz,
 unique(unidade_id,file_hash)
);
create table public.importacao_itens (
 id uuid primary key default gen_random_uuid(), importacao_id uuid not null references importacoes(id),
 numero_linha integer not null, linha_original jsonb not null,
 codigo_importado text not null default '', nome_importado text not null, apresentacao_importada text not null default '',
 quantidade_importada numeric check(quantidade_importada >= 0 and quantidade_importada < 1e12),
 consumo_importado numeric check(consumo_importado >= 0 and consumo_importado < 1e12),
 medicamento_id uuid references medicamentos(id), sugestao_id uuid references medicamentos(id),
 tipo_correspondencia text not null check(tipo_correspondencia in ('CODIGO','ALIAS','NOME_NORMALIZADO','MANUAL','NAO_IDENTIFICADO')),
 confianca numeric not null default 0 check(confianca between 0 and 1),
 status text not null check(status in ('OK','PENDENTE','ERRO','IGNORADO')), motivo_pendencia text,
 revisado_por uuid references profiles(id), justificativa text, created_at timestamptz not null default now(),
 unique(importacao_id,numero_linha),
 check(status <> 'OK' or (medicamento_id is not null and quantidade_importada is not null))
);
create table public.consumo_historico (
 id uuid primary key default gen_random_uuid(), unidade_id uuid not null references unidades(id), medicamento_id uuid not null references medicamentos(id),
 periodo_inicio date not null, periodo_fim date not null, dias_periodo integer not null check(dias_periodo>0),
 quantidade_consumida numeric not null check(quantidade_consumida>=0 and quantidade_consumida<1e12),
 cmd numeric generated always as (quantidade_consumida / dias_periodo) stored,
 importacao_id uuid references importacoes(id), created_at timestamptz not null default now(),
 check(periodo_fim-periodo_inicio+1=dias_periodo), unique(unidade_id,medicamento_id,periodo_fim,dias_periodo)
);
create table public.regras_criticos (
 id uuid primary key default gen_random_uuid(), unidade_id uuid references unidades(id), medicamento_id uuid references medicamentos(id),
 nome text not null, tipo_regra text not null check(tipo_regra in ('CRITICO','ATENCAO','NORMAL')),
 dias_minimos numeric not null check(dias_minimos>=0), dias_maximos numeric, cor text not null, prioridade integer not null,
 ativo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(dias_maximos is null or dias_maximos>dias_minimos),
 unique nulls not distinct(unidade_id,medicamento_id,tipo_regra)
);
create table public.estoque_atual (
 id uuid primary key default gen_random_uuid(), unidade_id uuid not null references unidades(id), medicamento_id uuid not null references medicamentos(id),
 quantidade numeric not null check(quantidade>=0 and quantidade<1e12), cmd numeric not null default 0 check(cmd>=0),
 dias_cobertura numeric generated always as (quantidade/nullif(cmd,0)) stored,
 situacao text not null check(situacao in ('CRITICO','ATENCAO','NORMAL','ZERADO','SEM_CONSUMO')),
 ultima_importacao_id uuid references importacoes(id), data_referencia date not null default current_date,
 updated_at timestamptz not null default now(), unique(unidade_id,medicamento_id)
);
create table public.estoque_historico (
 id uuid primary key default gen_random_uuid(), unidade_id uuid not null references unidades(id), medicamento_id uuid not null references medicamentos(id),
 quantidade numeric not null, cmd numeric not null, dias_cobertura numeric, situacao text not null,
 importacao_id uuid references importacoes(id), created_at timestamptz not null default now()
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id), unidade_id uuid references unidades(id),
 acao text not null, entidade text not null, registro_id uuid, dados_anteriores jsonb, dados_novos jsonb,
 ip text, user_agent text, created_at timestamptz not null default now()
);
create table public.estoque_totais_historico (
 id uuid primary key default gen_random_uuid(), unidade_id uuid not null references unidades(id),
 importacao_id uuid not null references importacoes(id), quantidade numeric not null, created_at timestamptz not null default now()
);

create function private.current_profile() returns uuid language sql stable security definer set search_path='' as $$
 select id from public.profiles where auth_user_id=(select auth.uid()) and ativo;
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where auth_user_id=(select auth.uid()) and ativo and perfil='ADMIN');
$$;
create function private.can_access(u uuid, writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.auth_user_id=(select auth.uid()) and p.ativo
 and (p.perfil='ADMIN' or ((not writing or p.perfil='FARMACIA') and exists(
 select 1 from public.usuario_unidades m join public.unidades un on un.id=m.unidade_id and un.ativo where m.usuario_id=p.id and m.unidade_id=u))));
$$;
create function private.normalize(s text) returns text language sql immutable set search_path='' as $$
 select trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
 translate(upper(s),'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC'),
 '(\d),(\d)','\1.\2','g'),'(\d)\s+([A-Z%])','\1\2','g'),'\s*/\s*','/','g'),'\s+',' ','g'));
$$;
create function private.signature(s text) returns text language sql immutable set search_path='' as $$
 select coalesce(string_agg(m[1],'|' order by ord),'') from regexp_matches(private.normalize(s),
 '(\d+(?:\.\d+)?(?:MCG|MG|G|UI|MEQ|MMOL|ML|L|%)(?:/(?:\d+(?:\.\d+)?)?(?:ML|L|DOSE|G))?|\y(?:AMPOLA|FRASCO|COMPRIMIDO|CAPSULA|INJETAVEL|SOLUCAO|SUSPENSAO|GOTAS|CREME|POMADA|SPRAY)\y)','g') with ordinality as t(m,ord);
$$;
create function private.safe_match(src text, med uuid, u uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.medicamentos m where m.id=med and m.ativo
 and private.signature(src)<>'' and private.signature(src)=private.signature(m.nome||' '||m.apresentacao)
 and (private.normalize(src)=private.normalize(m.nome||' '||m.apresentacao)
 or exists(select 1 from public.medicamento_aliases a where a.unidade_id=u and a.medicamento_id=m.id and a.ativo and a.alias_normalizado=private.normalize(src))));
$$;
create function private.classify(q numeric,c numeric,u uuid,m uuid) returns text language sql stable set search_path='' as $$
 select case when q=0 then 'ZERADO' when c=0 then 'SEM_CONSUMO' else coalesce((
 select r.tipo_regra from public.regras_criticos r
 where r.ativo and (r.unidade_id is null or r.unidade_id=u) and (r.medicamento_id is null or r.medicamento_id=m)
 and (case when r.medicamento_id is not null then 2 else 0 end + case when r.unidade_id is not null then 1 else 0 end)=(
 select coalesce(max(case when s.medicamento_id is not null then 2 else 0 end + case when s.unidade_id is not null then 1 else 0 end),0)
 from public.regras_criticos s where s.ativo and (s.unidade_id is null or s.unidade_id=u) and (s.medicamento_id is null or s.medicamento_id=m))
 and q/nullif(c,0)>=r.dias_minimos and (r.dias_maximos is null or q/nullif(c,0)<r.dias_maximos)
 order by r.prioridade desc limit 1),'NORMAL') end;
$$;
create function private.audit() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb; b jsonb; uid uuid;
begin
 if TG_OP<>'INSERT' then a=to_jsonb(old); end if;
 if TG_OP<>'DELETE' then b=to_jsonb(new); end if;
 uid=nullif(coalesce(b->>'unidade_id',a->>'unidade_id'),'')::uuid;
 insert into public.audit_logs(user_id,unidade_id,acao,entidade,registro_id,dados_anteriores,dados_novos,user_agent)
 values(private.current_profile(),uid,TG_OP,TG_TABLE_NAME,coalesce(b->>'id',a->>'id')::uuid,a,b,
 left(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'user-agent',''),512));
 return coalesce(new,old);
end; $$;
do $$ declare t text; begin
 foreach t in array array['unidades','profiles','usuario_unidades','medicamentos','medicamento_aliases','importacoes','importacao_itens','consumo_historico','regras_criticos','estoque_atual'] loop
 execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function private.audit()',t);
 end loop;
 foreach t in array array['unidades','profiles','usuario_unidades','medicamentos','medicamento_aliases','importacoes','importacao_itens','consumo_historico','regras_criticos','estoque_atual','estoque_historico','audit_logs','estoque_totais_historico'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy units_read on public.unidades for select to authenticated using(private.can_access(id));
create policy profile_read on public.profiles for select to authenticated using(auth_user_id=(select auth.uid()) or private.is_admin());
create policy memberships_read on public.usuario_unidades for select to authenticated using(usuario_id=private.current_profile() or private.is_admin());
create policy medication_read on public.medicamentos for select to authenticated using(private.current_profile() is not null);
create policy alias_read on public.medicamento_aliases for select to authenticated using(private.can_access(unidade_id));
create policy imports_read on public.importacoes for select to authenticated using(private.can_access(unidade_id));
create policy items_read on public.importacao_itens for select to authenticated using(exists(select 1 from public.importacoes i where i.id=importacao_id and private.can_access(i.unidade_id)));
create policy consumption_read on public.consumo_historico for select to authenticated using(private.can_access(unidade_id));
create policy rules_read on public.regras_criticos for select to authenticated using((unidade_id is null and private.current_profile() is not null) or private.can_access(unidade_id));
create policy stock_read on public.estoque_atual for select to authenticated using(private.can_access(unidade_id));
create policy history_read on public.estoque_historico for select to authenticated using(private.can_access(unidade_id));
create policy totals_read on public.estoque_totais_historico for select to authenticated using(private.can_access(unidade_id));
create policy audit_read on public.audit_logs for select to authenticated using(private.is_admin() or (unidade_id is not null and private.can_access(unidade_id)));

create index usuario_unidades_unit_idx on public.usuario_unidades(unidade_id);
create index medicamentos_nome_idx on public.medicamentos(nome);
create index aliases_med_idx on public.medicamento_aliases(medicamento_id);
create index aliases_author_idx on public.medicamento_aliases(criado_por);
create index imports_unit_date_idx on public.importacoes(unidade_id,created_at desc);
create index imports_author_idx on public.importacoes(usuario_id);
create index items_med_idx on public.importacao_itens(medicamento_id);
create index items_suggestion_idx on public.importacao_itens(sugestao_id);
create index items_reviewer_idx on public.importacao_itens(revisado_por);
create index items_import_status_idx on public.importacao_itens(importacao_id,status);
create index consumption_med_idx on public.consumo_historico(medicamento_id);
create index consumption_import_idx on public.consumo_historico(importacao_id);
create index rules_med_idx on public.regras_criticos(medicamento_id);
create index stock_med_idx on public.estoque_atual(medicamento_id);
create index stock_import_idx on public.estoque_atual(ultima_importacao_id);
create index stock_unit_status_idx on public.estoque_atual(unidade_id,situacao);
create index history_unit_date_idx on public.estoque_historico(unidade_id,created_at desc);
create index history_med_idx on public.estoque_historico(medicamento_id,created_at desc);
create index history_import_idx on public.estoque_historico(importacao_id);
create index audit_unit_date_idx on public.audit_logs(unidade_id,created_at desc);
create index audit_user_idx on public.audit_logs(user_id);
create index totals_unit_date_idx on public.estoque_totais_historico(unidade_id,created_at);
create index totals_import_idx on public.estoque_totais_historico(importacao_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('importacoes','importacoes',false,10485760,array['text/csv','application/pdf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream'])
 on conflict(id) do nothing;
create policy import_files_read on storage.objects for select to authenticated using(
 bucket_id='importacoes' and private.can_access(((storage.foldername(name))[1])::uuid));
create policy import_files_upload on storage.objects for insert to authenticated with check(
 bucket_id='importacoes' and private.can_access(((storage.foldername(name))[1])::uuid,true)
 and (storage.foldername(name))[2]=(select auth.uid())::text);
-- Originals are immutable: no UPDATE or DELETE policies for authenticated users.

insert into public.unidades(nome,sigla,codigo) values('UPA Rocha Miranda','UPA RM','UPARM');
insert into public.regras_criticos(nome,tipo_regra,dias_minimos,dias_maximos,cor,prioridade) values
 ('Crítico','CRITICO',0,5,'#ef3340',30),('Atenção','ATENCAO',5,10,'#f59e0b',20),('Normal','NORMAL',10,null,'#16a35b',10);

revoke execute on all functions in schema private from public,anon;
grant execute on all functions in schema private to authenticated;
