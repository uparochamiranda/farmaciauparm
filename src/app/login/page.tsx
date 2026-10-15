'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Cross, ShieldCheck, ArrowRight, LoaderCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
export default function Login() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const f = new FormData(e.currentTarget);
      const { error } = await createClient().auth.signInWithPassword({
        email: String(f.get('email')),
        password: String(f.get('password')),
      });
      if (error) throw new Error('E-mail ou senha inválidos. Confira seus dados.');
      router.replace('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível entrar.');
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-icon">
            <Cross fill="currentColor" />
          </span>
          <div>
            <h1>Farmácia UPA RM</h1>
            <p>Controle de Estoque e Abastecimento</p>
          </div>
        </div>
        <div>
          <span className="eyebrow">UPA ROCHA MIRANDA</span>
          <h2>
            Informação confiável.
            <br />
            Cuidado que continua.
          </h2>
          <p>
            Estoque, consumo e abastecimento em um só lugar. Mais clareza para cada decisão da
            farmácia.
          </p>
          <div className="login-assurance">
            <ShieldCheck /> Acesso seguro e alterações rastreáveis
          </div>
        </div>
        <small>Sistema de gestão da farmácia · UPA RM</small>
      </section>
      <section className="login-form">
        <div>
          <span className="eyebrow">BEM-VINDO DE VOLTA</span>
          <h2>Acesse sua unidade</h2>
          <p>Entre com as credenciais fornecidas pelo administrador.</p>
          <form onSubmit={login}>
            <label>
              E-mail
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="seu.email@exemplo.com"
              />
            </label>
            <label>
              Senha
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Digite sua senha"
              />
            </label>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button disabled={busy} type="submit">
              {busy ? (
                <LoaderCircle className="spin" />
              ) : (
                <>
                  Entrar no sistema
                  <ArrowRight size={17} />
                </>
              )}
            </Button>
          </form>
          <p className="login-help">
            Precisa de acesso? Entre em contato com o administrador da unidade.
          </p>
          <Link href="/demo" className="demo-link">
            Conhecer o painel de demonstração <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </main>
  );
}
