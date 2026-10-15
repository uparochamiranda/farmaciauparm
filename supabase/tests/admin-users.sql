begin;
insert into auth.users(id,email) values ('a1000000-0000-4000-8000-000000000001','admin-test@example.invalid'),('a1000000-0000-4000-8000-000000000002','new-test@example.invalid');
insert into public.profiles(auth_user_id,nome,email,perfil) values('a1000000-0000-4000-8000-000000000001','Admin teste','admin-test@example.invalid','ADMIN');
insert into public.unidades(id,nome,sigla) values('b1000000-0000-4000-8000-000000000001','Teste administração','TEST');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 begin
 perform public.provision_user('{"auth_user_id":"a1000000-0000-4000-8000-000000000002","nome":"Novo usuário","perfil":"ADMIN","unidade_id":"b1000000-0000-4000-8000-000000000001"}');
 raise exception 'FAIL: non-admin escalation';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ declare p uuid; begin
 begin
 perform public.provision_user('{"auth_user_id":"a1000000-0000-4000-8000-000000000002","nome":"Novo usuário","perfil":"GESTAO","unidade_id":"b1000000-0000-4000-8000-000000000002"}');
 raise exception 'FAIL: invalid unit accepted';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
 if exists(select 1 from public.profiles where auth_user_id='a1000000-0000-4000-8000-000000000002') then raise exception 'FAIL: partial profile'; end if;
 p=(public.provision_user('{"auth_user_id":"a1000000-0000-4000-8000-000000000002","nome":"Novo usuário","perfil":"GESTAO","unidade_id":"b1000000-0000-4000-8000-000000000001"}')->>'id')::uuid;
 if not exists(select 1 from public.usuario_unidades where usuario_id=p and unidade_id='b1000000-0000-4000-8000-000000000001') then raise exception 'FAIL: membership missing'; end if;
 if not exists(select 1 from public.audit_logs where registro_id=p) then raise exception 'FAIL: audit missing'; end if;
end $$;
reset role;
rollback;
select 'PASS: admin authorization, invalid unit rollback, profile, membership and audit' as result;
