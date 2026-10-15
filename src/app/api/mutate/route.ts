import { NextResponse } from 'next/server';
import { session, failure, assertOrigin, dbError } from '@/lib/server/api';
export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const { db } = await session();
    const { action, payload } = await req.json();
    const allowed = [
      'resolve_item',
      'cancel_import',
      'medication',
      'alias',
      'rules',
      'manual_stock',
      'unit',
      'profile',
      'membership',
      'confirm_import',
    ];
    if (!allowed.includes(action)) throw new Error('Operação inválida.');
    const { data, error } =
      action === 'confirm_import'
        ? await db.rpc('confirm_import', { import_id: payload.importacao_id })
        : await db.rpc('mutate', { action, payload });
    dbError(error);
    return NextResponse.json(data);
  } catch (e) {
    return failure(e);
  }
}
