import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { z } from 'npm:zod@4.6.7';
const schema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  password: z.string().min(12).max(128),
  perfil: z.enum(['ADMIN', 'FARMACIA', 'GESTAO']),
  unidade_id: z.uuid(),
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Autenticação necessária.' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await caller.auth.getUser();
  if (authError || !user) return json({ error: 'Sessão inválida.' }, 401);
  const { data: actor } = await caller
    .from('profiles')
    .select('id,perfil,ativo')
    .eq('auth_user_id', user.id)
    .single();
  if (!actor?.ativo || actor.perfil !== 'ADMIN')
    return json({ error: 'Somente administradores podem criar usuários.' }, 403);
  let body;
  try {
    body = schema.parse(await req.json());
  } catch {
    return json(
      { error: 'Confira nome, e-mail, senha (mínimo 12 caracteres), perfil e unidade.' },
      400,
    );
  }
  const { data: unit } = await caller
    .from('unidades')
    .select('id')
    .eq('id', body.unidade_id)
    .eq('ativo', true)
    .single();
  if (!unit) return json({ error: 'Unidade inválida.' }, 400);
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // A banned account cannot log in before its application permissions are committed.
  const { data: created, error } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    ban_duration: '876000h',
  });
  if (error || !created.user)
    return json(
      {
        error:
          'Não foi possível criar a conta. Confira se o e-mail já está cadastrado e se a senha atende à política de segurança.',
      },
      400,
    );
  const { data: profile, error: provisionError } = await caller.rpc('provision_user', {
    payload: {
      auth_user_id: created.user.id,
      nome: body.nome,
      perfil: body.perfil,
      unidade_id: body.unidade_id,
    },
  });
  if (provisionError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
    return json(
      {
        error: cleanupError
          ? 'Cadastro incompleto. A conta ficou bloqueada; solicite suporte para removê-la.'
          : 'Cadastro cancelado: não foi possível salvar as permissões.',
      },
      500,
    );
  }
  const { error: activationError } = await admin.auth.admin.updateUserById(created.user.id, {
    ban_duration: 'none',
  });
  if (activationError)
    return json(
      { error: 'Perfil salvo, mas a conta ficou bloqueada. Solicite suporte para ativar o login.' },
      500,
    );
  return json({ id: profile.id, message: 'Usuário criado com acesso à unidade selecionada.' }, 201);
});
