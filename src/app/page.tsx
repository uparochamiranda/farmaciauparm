import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Workspace } from '@/components/workspace';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: profile }, { data: units }] = await Promise.all([
    db.from('profiles').select('*').eq('auth_user_id', user.id).eq('ativo', true).single(),
    db.from('unidades').select('*').eq('ativo', true).order('nome'),
  ]);
  if (!profile || !units?.length)
    return (
      <main className="access-state">
        <h1>Acesso aguardando liberação</h1>
        <p>
          Seu login foi reconhecido. O administrador precisa cadastrar seu perfil e vincular uma
          unidade.
        </p>
        <a href="/auth/signout">Voltar ao login</a>
      </main>
    );
  return <Workspace profile={profile} units={units} />;
}
