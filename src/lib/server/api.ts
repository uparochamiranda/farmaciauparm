import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
export async function session() {
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error('Sessão expirada. Entre novamente.');
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('ativo', true)
    .single();
  if (!profile) throw new Error('Usuário sem acesso. Solicite cadastro ao administrador.');
  return { db, user, profile };
}
export function failure(e: unknown, status = 400) {
  const message = e instanceof Error ? e.message : 'Não foi possível concluir a operação.';
  return NextResponse.json({ error: message }, { status });
}
export function assertOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin)
    throw new Error('Origem da requisição inválida.');
}
export function dbError(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === '23505')
    throw new Error('Registro duplicado. Confira código, DE-PARA ou arquivo já importado.');
  if (error.code === '42501') throw new Error('Você não tem permissão para esta operação.');
  if (error.code === 'P0001') throw new Error(error.message);
  throw new Error(
    'Não foi possível concluir a operação no banco. Nenhuma alteração desta transação foi salva.',
  );
}
