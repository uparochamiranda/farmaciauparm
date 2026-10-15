import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function createClient() {
  const jar = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configure as variáveis públicas do Supabase no ambiente.');
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (entries) => {
        try {
          entries.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          /* Server components: proxy refreshes the session. */
        }
      },
    },
  });
}
