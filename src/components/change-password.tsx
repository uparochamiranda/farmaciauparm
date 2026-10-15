'use client';
import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from './ui/button';
export function ChangePassword({ email }: { email: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError('');
    setMessage('');
    const password = String(data.get('password'));
    if (password !== String(data.get('confirmation'))) {
      setError('A confirmação precisa ser igual à nova senha.');
      return;
    }
    setBusy(true);
    try {
      const db = createClient();
      const { error: authError } = await db.auth.signInWithPassword({
        email,
        password: String(data.get('current')),
      });
      if (authError) throw new Error('A senha atual está incorreta.');
      const { error: updateError } = await db.auth.updateUser({ password });
      if (updateError)
        throw new Error(
          'Não foi possível alterar a senha. Use uma senha forte e diferente da atual.',
        );
      form.reset();
      setMessage('Senha alterada com sucesso. Use a nova senha no próximo acesso.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível alterar a senha.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <h1>Alterar minha senha</h1>
          <p>{email}</p>
        </div>
        <Link href="/">Voltar ao painel</Link>
      </header>
      <section className="panel">
        <form className="form-grid admin-form" onSubmit={save}>
          <label className="full">
            Senha atual
            <input
              type="password"
              name="current"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            Nova senha
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
            <small>Mínimo de 12 caracteres.</small>
          </label>
          <label>
            Confirmar nova senha
            <input
              type="password"
              name="confirmation"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          {error && (
            <p className="error-message full" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="admin-success full" role="status">
              {message}
            </p>
          )}
          <div className="full">
            <Button type="submit" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar nova senha'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
