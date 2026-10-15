import { NextResponse } from 'next/server';
import { session, failure, assertOrigin } from '@/lib/server/api';
import { z } from 'zod';
const schema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  password: z.string().min(12).max(128),
  perfil: z.enum(['ADMIN', 'FARMACIA', 'GESTAO']),
  unidade_id: z.uuid(),
});
export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const { db, profile } = await session();
    if (profile.perfil !== 'ADMIN')
      return failure(new Error('Somente administradores podem criar usuários.'), 403);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success)
      return failure(new Error('Confira os campos. A senha deve ter entre 12 e 128 caracteres.'));
    const { data, error } = await db.functions.invoke('admin-create-user', { body: parsed.data });
    if (error) {
      let message = 'Não foi possível criar o usuário. Tente novamente.';
      if (error.context instanceof Response) {
        const detail = await error.context.json().catch(() => null);
        if (typeof detail?.error === 'string') message = detail.error;
      }
      return failure(new Error(message), 400);
    }
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
