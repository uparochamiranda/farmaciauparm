import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function POST(req: Request) {
  const db = await createClient();
  await db.auth.signOut();
  return NextResponse.redirect(new URL('/login', req.url), 303);
}
export async function GET(req: Request) {
  return NextResponse.redirect(new URL('/login', req.url));
}
