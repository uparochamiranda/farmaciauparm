-- Runs with the authenticated administrator's identity; all changes are audited.
create or replace function public.provision_user(payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; unit_id uuid;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Somente administrador.'; end if;
 unit_id=(payload->>'unidade_id')::uuid;
 if not exists(select 1 from public.unidades where id=unit_id and ativo) then raise exception 'Unidade inválida.'; end if;
 if length(trim(coalesce(payload->>'nome','')))<2 then raise exception 'Informe o nome.'; end if;
 result=private.mutate('profile',jsonb_build_object('auth_user_id',payload->>'auth_user_id','nome',trim(payload->>'nome'),'perfil',payload->>'perfil'));
 perform private.mutate('membership',jsonb_build_object('usuario_id',result->>'id','unidade_id',unit_id));
 return result;
end; $$;
revoke all on function public.provision_user(jsonb) from public,anon;
grant execute on function public.provision_user(jsonb) to authenticated;
