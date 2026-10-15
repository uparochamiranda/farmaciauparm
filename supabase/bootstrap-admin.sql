-- Execute no SQL Editor com a conta de proprietário do projeto.
-- Primeiro crie o usuário em Authentication > Users > Add user.
-- Substitua o e-mail abaixo pelo usuário real, já criado no Auth.
do $$
declare account auth.users; profile_id uuid;
begin
 select * into account from auth.users where lower(email)=lower('SEU_EMAIL_AQUI');
 if not found then raise exception 'Crie primeiro o usuário no Supabase Auth e informe seu e-mail neste script.'; end if;
 insert into public.profiles(auth_user_id,nome,email,perfil,ativo)
 values(account.id,'Administrador',account.email,'ADMIN',true)
 on conflict(auth_user_id) do update set perfil='ADMIN',ativo=true,updated_at=now()
 returning id into profile_id;
 insert into public.usuario_unidades(usuario_id,unidade_id)
 select profile_id,id from public.unidades where codigo='UPARM'
 on conflict do nothing;
end $$;
