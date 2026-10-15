import { readFile } from 'node:fs/promises';
import pg from 'pg';
try {
  process.loadEnvFile('.env.local');
} catch {
  /* Environment may be supplied by CI. */
}
if (!process.env.DATABASE_URL) {
  console.error('Defina DATABASE_URL no ambiente seguro para executar os testes transacionais.');
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query(
    await readFile(new URL('../supabase/tests/integrity.sql', import.meta.url), 'utf8'),
  );
  await client.query(
    await readFile(new URL('../supabase/tests/admin-users.sql', import.meta.url), 'utf8'),
  );
  console.log('PASS: testes SQL de integridade, RLS e rollback. Fixtures revertidas.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
