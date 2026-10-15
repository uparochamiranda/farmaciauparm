'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ShieldCheck, ArrowLeft, UserPlus } from 'lucide-react';
import { Button } from './ui/button';
type UserRow = { id: string; nome: string; email: string; perfil: string; ativo: boolean };
export function AdminUsers({ units }: { units: { id: string; nome: string }[] }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [users, setUsers] = useState<UserRow[]>([]),
    [page, setPage] = useState(0),
    [count, setCount] = useState(0),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/data?resource=profiles&page=' + page, { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then((d) => {
        if (!controller.signal.aborted) {
          setUsers(d.rows);
          setCount(d.count);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [page, revision]);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const form = e.currentTarget;
    try {
      const body = Object.fromEntries(new FormData(form));
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      form.reset();
      setMessage(d.message);
      setLoading(true);
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar o usuário.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <ShieldCheck size={30} />
          <h1>Administração de usuários</h1>
          <p>Farmácia UPA RM · Acessos e permissões</p>
        </div>
        <Link href="/">
          <ArrowLeft size={16} /> Voltar ao painel
        </Link>
      </header>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="admin-success">
          {message}
        </p>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>
            <UserPlus size={20} /> Criar usuário
          </h2>
        </div>
        <form className="form-grid admin-form" onSubmit={save}>
          <label>
            Nome completo
            <input name="nome" required minLength={2} maxLength={120} autoComplete="name" />
          </label>
          <label>
            E-mail
            <input name="email" type="email" required maxLength={254} autoComplete="email" />
          </label>
          <label>
            Senha inicial
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
            <small>Mínimo de 12 caracteres. Entregue a senha ao usuário por um canal seguro.</small>
          </label>
          <label>
            Perfil
            <select name="perfil" defaultValue="GESTAO">
              <option value="GESTAO">Gestão — somente consulta</option>
              <option value="FARMACIA">Farmácia — operação do estoque</option>
              <option value="ADMIN">Administrador — acesso completo</option>
            </select>
          </label>
          <label>
            Unidade
            <select name="unidade_id" required defaultValue={units[0]?.id ?? ''}>
              <option value="" disabled>
                Selecione uma unidade
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="full">
            <Button type="submit" disabled={busy || !units.length}>
              {busy ? 'Criando usuário…' : 'Criar usuário'}
            </Button>
          </div>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Usuários cadastrados</h2>
          <span>{count} usuários</span>
        </div>
        <p className="panel-description">
          Para editar perfis, desativar acessos ou alterar vínculos, use Configurações no painel.
        </p>
        {loading ? (
          <p className="panel-description">Carregando usuários…</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Acesso</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td>{u.email}</td>
                    <td>{u.perfil}</td>
                    <td>{u.ativo ? 'Ativo' : 'Desativado'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="admin-pagination">
          <Button
            variant="outline"
            disabled={page === 0 || loading}
            onClick={() => {
              setLoading(true);
              setPage(page - 1);
            }}
          >
            Anterior
          </Button>
          <span>Página {page + 1}</span>
          <Button
            variant="outline"
            disabled={(page + 1) * 15 >= count || loading}
            onClick={() => {
              setLoading(true);
              setPage(page + 1);
            }}
          >
            Próxima
          </Button>
        </div>
      </section>
    </main>
  );
}
