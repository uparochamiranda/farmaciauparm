import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  const path = request.nextUrl.pathname;
  if (path === '/demo' || path === '/login' || path.startsWith('/auth/')) return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (path.startsWith('/api/'))
      return NextResponse.json({ error: 'Autenticação indisponível.' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (entries) =>
        entries.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }),
    },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    if (path.startsWith('/api/'))
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)'] };
