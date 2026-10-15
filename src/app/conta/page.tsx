import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ChangePassword } from '@/components/change-password';
export const dynamic = 'force-dynamic';
export default async function Account() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user?.email) redirect('/login');
  return <ChangePassword email={user.email} />;
}
