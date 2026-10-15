import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminUsers } from '@/components/admin-users';
export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/login?next=/adminuparm');
  const { data: profile } = await db
    .from('profiles')
    .select('perfil,ativo')
    .eq('auth_user_id', user.id)
    .single();
  if (!profile?.ativo || profile.perfil !== 'ADMIN')
    return (
      <main className="access-state">
        <h1>Acesso restrito</h1>
        <p>Somente administradores podem gerenciar usuários.</p>
        <Link href="/">Voltar ao painel</Link>
      </main>
    );
  const { data: units, error } = await db
    .from('unidades')
    .select('id,nome')
    .eq('ativo', true)
    .order('nome');
  if (error) throw new Error('Não foi possível carregar as unidades.');
  return <AdminUsers units={units ?? []} />;
}
