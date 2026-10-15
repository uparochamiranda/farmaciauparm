'use client';
import { useState } from 'react';
import { Plus, Link2, Pencil, Settings2, FileBarChart, Search, ClipboardList } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { useApp, useData, Empty, Loading, ErrorNotice, Pager } from './app-context';
import { ExportButtons } from './stock-table';
import { MedicationPicker } from './imports';
import type { Alias, Medication, Rule } from '@/lib/domain/types';
import { date } from '@/lib/utils';
export function MedicationForm({ med, onClose }: { med?: Medication; onClose: () => void }) {
  const { mutate } = useApp();
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (await mutate('medication', { ...data, id: med?.id, ativo: data.ativo === 'on' })) onClose();
    setBusy(false);
  }
  const fields = [
    ['codigo', 'Código'],
    ['nome', 'Nome do medicamento'],
    ['principio_ativo', 'Princípio ativo'],
    ['apresentacao', 'Apresentação completa'],
    ['concentracao', 'Concentração'],
    ['unidade_concentracao', 'Unidade de concentração'],
    ['forma_farmaceutica', 'Forma farmacêutica'],
    ['volume', 'Volume'],
    ['unidade_volume', 'Unidade de volume'],
    ['grupo', 'Grupo'],
  ] as const;
  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={med ? 'Editar medicamento' : 'Cadastrar medicamento'}
      description="Informe a apresentação completa, incluindo concentração, volume e forma, quando aplicáveis."
    >
      <form onSubmit={save} className="form-grid">
        {fields.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              name={key}
              required={['nome', 'apresentacao', 'grupo'].includes(key)}
              defaultValue={med?.[key] ?? ''}
            />
          </label>
        ))}
        <label className="checkbox-label full">
          <input type="checkbox" name="ativo" defaultChecked={med?.ativo ?? true} />
          Medicamento ativo
        </label>
        {med && (
          <p className="form-note full">
            A desativação bloqueia futuras importações. O histórico permanece disponível. Confira
            antes de confirmar.
          </p>
        )}
        <div className="dialog-actions full">
          <Button type="button" variant="outline" onClick={onClose}>
            Voltar
          </Button>
          <Button disabled={busy} type="submit">
            Confirmar cadastro
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function Medications() {
  const { profile } = useApp();
  const [page, setPage] = useState(0),
    [search, setSearch] = useState(''),
    [edit, setEdit] = useState<Medication | true | null>(null);
  const { data, loading, error } = useData<{ rows: Medication[]; count: number }>('medications', {
    page,
    search,
  });
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>
          <ClipboardList size={19} />
          Cadastro de medicamentos
        </h2>
        {profile.perfil !== 'GESTAO' && (
          <Button size="sm" onClick={() => setEdit(true)}>
            <Plus size={16} />
            Novo medicamento
          </Button>
        )}
      </div>
      <div className="filters">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar cadastro"
            placeholder="Buscar medicamento, código ou apresentação"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>
      {error ? (
        <ErrorNotice message={error} />
      ) : loading ? (
        <Loading />
      ) : !data?.rows.length ? (
        <Empty />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Medicamento</th>
                <th>Apresentação</th>
                <th>Princípio ativo</th>
                <th>Grupo</th>
                <th>Ativo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((m) => (
                <tr key={m.id}>
                  <td>{m.codigo ?? '—'}</td>
                  <td>
                    <strong>{m.nome}</strong>
                  </td>
                  <td>{m.apresentacao}</td>
                  <td>{m.principio_ativo}</td>
                  <td>{m.grupo}</td>
                  <td>{m.ativo ? 'Sim' : 'Não'}</td>
                  <td>
                    {profile.perfil === 'ADMIN' && (
                      <Button variant="outline" size="sm" onClick={() => setEdit(m)}>
                        <Pencil size={13} />
                        Editar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} count={data?.count ?? 0} onChange={setPage} />
      {edit && (
        <MedicationForm med={edit === true ? undefined : edit} onClose={() => setEdit(null)} />
      )}
    </section>
  );
}
export function Aliases() {
  const { mutate, profile } = useApp();
  const [page, setPage] = useState(0),
    [open, setOpen] = useState(false),
    [med, setMed] = useState(''),
    [remove, setRemove] = useState<Alias | null>(null),
    [busy, setBusy] = useState(false);
  const { data, loading, error } = useData<{
    rows: (Alias & { medicamentos?: { nome: string; apresentacao: string } })[];
    count: number;
  }>('aliases', { page });
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    if (await mutate('alias', { alias: f.get('alias'), medicamento_id: med })) setOpen(false);
    setBusy(false);
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>
          <Link2 size={19} />
          DE-PARA de medicamentos
        </h2>
        {profile.perfil !== 'GESTAO' && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={16} />
            Nova correspondência
          </Button>
        )}
      </div>
      <p className="panel-description">
        Equivalências confirmadas para esta unidade. Diferenças de dose, concentração, volume e
        forma não são aceitas como equivalência automática.
      </p>
      {error ? (
        <ErrorNotice message={error} />
      ) : loading ? (
        <Loading />
      ) : !data?.rows.length ? (
        <Empty text="Nenhuma correspondência cadastrada." />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Descrição na origem</th>
                <th>Medicamento de destino</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.alias}</strong>
                  </td>
                  <td>
                    {a.medicamentos
                      ? a.medicamentos.nome + ' · ' + a.medicamentos.apresentacao
                      : a.medicamento_id}
                  </td>
                  <td>{a.ativo ? 'Ativo' : 'Desativado'}</td>
                  <td>
                    {a.ativo && profile.perfil !== 'GESTAO' && (
                      <Button size="sm" variant="outline" onClick={() => setRemove(a)}>
                        Desativar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} count={data?.count ?? 0} onChange={setPage} />
      <Dialog open={open} onOpenChange={setOpen} title="Nova correspondência DE-PARA">
        <form onSubmit={save} className="form-grid">
          <label className="full">
            Descrição exata no arquivo de origem
            <input name="alias" required placeholder="Ex.: EPINEFRINA 1 mg/mL 1 mL" />
          </label>
          <MedicationPicker value={med} onChange={setMed} />
          <p className="form-note full">
            Confirme a equivalência clínica antes de salvar. A correspondência valerá para futuras
            importações desta unidade.
          </p>
          <Button disabled={busy} type="submit">
            Confirmar equivalência
          </Button>
        </form>
      </Dialog>
      <Dialog open={!!remove} onOpenChange={() => setRemove(null)} title="Desativar DE-PARA">
        <p>
          Desativar a correspondência de {remove?.alias}? Próximas importações deixarão de usar esta
          equivalência.
        </p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setRemove(null)}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              if (await mutate('alias', { id: remove?.id, ativo: false })) setRemove(null);
            }}
          >
            Confirmar desativação
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
export function RulesForm({ onClose }: { onClose: () => void }) {
  const { mutate } = useApp();
  const [med, setMed] = useState(''),
    [specific, setSpecific] = useState(false),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    if (
      await mutate('rules', {
        critico: Number(f.get('critical')),
        atencao: Number(f.get('attention')),
        medicamento_id: specific ? med : null,
      })
    )
      onClose();
    setBusy(false);
  }
  return (
    <Dialog
      open
      onOpenChange={onClose}
      title="Regras de criticidade"
      description="Limites em dias de cobertura para a unidade atual."
    >
      <form className="form-grid" onSubmit={save}>
        <label>
          Crítico abaixo de
          <input type="number" name="critical" step="0.1" min="0.1" required defaultValue="5" />
        </label>
        <label>
          Atenção abaixo de
          <input type="number" name="attention" step="0.1" min="0.2" required defaultValue="10" />
        </label>
        <label className="checkbox-label full">
          <input
            type="checkbox"
            checked={specific}
            onChange={(e) => setSpecific(e.target.checked)}
          />
          Aplicar somente a um medicamento
        </label>
        {specific && <MedicationPicker value={med} onChange={setMed} />}
        <p className="form-note full">
          O limite inferior pertence à faixa; o superior pertence à seguinte. Estoque zero tem
          prioridade. CMD zero gera “Sem consumo”.
        </p>
        <Button disabled={busy} type="submit">
          Confirmar regras
        </Button>
      </form>
    </Dialog>
  );
}
export function Reports() {
  const reports = [
    ['stock', 'Estoque geral', 'Saldos atuais de todos os medicamentos.'],
    ['critical', 'Produtos críticos', 'Itens críticos, em atenção e zerados.'],
    ['pending', 'Pendências', 'Linhas que precisam de validação humana.'],
    ['consumption', 'Consumo', 'Períodos informados e consumo médio diário.'],
    ['history', 'Histórico', 'Evolução dos saldos e rastreabilidade.'],
    ['coverage', 'Cobertura', 'Dias de estoque disponível por medicamento.'],
    ['consolidated', 'Consolidado', 'Todas as unidades às quais você tem acesso.'],
  ];
  return (
    <div className="reports-grid">
      {reports.map(([kind, title, description]) => (
        <section className="panel report-card" key={kind}>
          <span className="report-icon">
            <FileBarChart />
          </span>
          <h2>{title}</h2>
          <p>{description}</p>
          <ExportButtons kind={kind} />
        </section>
      ))}
    </div>
  );
}
export function Audit() {
  const [page, setPage] = useState(0),
    [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const { data, loading, error } = useData<{ rows: Record<string, unknown>[]; count: number }>(
    'audit',
    { page },
  );
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Auditoria da unidade</h2>
      </div>
      {error ? (
        <ErrorNotice message={error} />
      ) : loading ? (
        <Loading />
      ) : !data?.rows.length ? (
        <Empty text="Nenhuma alteração registrada nesta unidade." />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ação</th>
                <th>Entidade</th>
                <th>Usuário</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={String(r.id)}>
                  <td>{date(String(r.created_at))}</td>
                  <td>{String(r.acao)}</td>
                  <td>{String(r.entidade)}</td>
                  <td className="code-cell">
                    {String(
                      (r.profiles as { nome?: string } | null)?.nome ??
                        'Sistema / usuário autorizado',
                    )}
                  </td>
                  <td>
                    <Button variant="outline" size="sm" onClick={() => setSelected(r)}>
                      Antes / depois
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} count={data?.count ?? 0} onChange={setPage} />
      <Dialog
        open={!!selected}
        onOpenChange={() => setSelected(null)}
        title="Registro de auditoria"
        wide
      >
        <pre className="audit-json">{JSON.stringify(selected, null, 2)}</pre>
      </Dialog>
    </section>
  );
}
export function Settings() {
  const { unit, profile, mutate } = useApp();
  const [rulesOpen, setRulesOpen] = useState(false),
    [tab, setTab] = useState('unit'),
    [busy, setBusy] = useState(false);
  const { data } = useData<{ rows: Rule[]; count: number }>('rules');
  const admin = profile.perfil === 'ADMIN';
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    await mutate('unit', f);
    setBusy(false);
  }
  return (
    <>
      <div className="tabs">
        {[
          ['unit', 'Unidade e regras'],
          ['users', 'Usuários e permissões'],
          ['audit', 'Auditoria'],
        ].map(([k, n]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {n}
          </button>
        ))}
      </div>
      {tab === 'audit' ? (
        <Audit />
      ) : tab === 'users' ? (
        <Users />
      ) : (
        <div className="management-grid">
          <section className="panel">
            <div className="panel-heading">
              <h2>
                <Settings2 size={18} />
                Unidade de atendimento
              </h2>
            </div>
            <form className="form-grid padded" onSubmit={save}>
              <label className="full">
                Nome
                <input name="nome" defaultValue={unit.nome} required disabled={!admin} />
              </label>
              <label>
                Sigla
                <input name="sigla" defaultValue={unit.sigla} required disabled={!admin} />
              </label>
              <label>
                Período de consumo (dias)
                <input
                  name="dias_consumo"
                  type="number"
                  min="1"
                  max="366"
                  defaultValue={unit.dias_consumo}
                  required
                  disabled={!admin}
                />
              </label>
              <label className="full">
                Endereço
                <input name="endereco" defaultValue={unit.endereco} disabled={!admin} />
              </label>
              <p className="form-note full">
                A mudança de período se aplica às próximas importações. Os períodos anteriores
                permanecem registrados.
              </p>
              {admin && (
                <Button disabled={busy} type="submit">
                  Salvar unidade
                </Button>
              )}
            </form>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Regras dos críticos</h2>
              {admin && (
                <Button size="sm" variant="outline" onClick={() => setRulesOpen(true)}>
                  Editar regras
                </Button>
              )}
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Situação</th>
                    <th>De</th>
                    <th>Até (exclusivo)</th>
                    <th>Escopo</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.nome}</td>
                      <td>{r.dias_minimos} dias</td>
                      <td>{r.dias_maximos ?? '∞'}</td>
                      <td>
                        {r.medicamento_id ? 'Medicamento' : r.unidade_id ? 'Unidade' : 'Global'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      {rulesOpen && <RulesForm onClose={() => setRulesOpen(false)} />}
    </>
  );
}
type UserRow = {
  id: string;
  auth_user_id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
};
function Users() {
  const { profile, mutate } = useApp();
  const [page, setPage] = useState(0),
    [edit, setEdit] = useState<UserRow | true | null>(null),
    [permission, setPermission] = useState<UserRow | null>(null);
  const { data, loading } = useData<{ rows: UserRow[]; count: number }>('profiles', { page });
  const { data: members } = useData<{ rows: { usuario_id: string }[]; count: number }>(
    'memberships',
  );
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (
      await mutate('profile', {
        ...f,
        id: edit && edit !== true ? edit.id : undefined,
        ativo: f.ativo === 'on',
      })
    )
      setEdit(null);
  }
  if (profile.perfil !== 'ADMIN')
    return <Empty text="Somente administradores gerenciam usuários e permissões." />;
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Usuários e permissões</h2>
        <Button size="sm" onClick={() => setEdit(true)}>
          <Plus size={15} />
          Cadastrar perfil
        </Button>
      </div>
      <p className="panel-description">
        Crie a conta em Supabase Auth e cadastre seu perfil aqui. O acesso FARMACIA ou GESTAO exige
        vínculo com uma unidade.
      </p>
      {loading ? (
        <Loading />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Ativo</th>
                <th>Unidade atual</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{u.perfil}</td>
                  <td>{u.ativo ? 'Sim' : 'Não'}</td>
                  <td>
                    {u.perfil === 'ADMIN'
                      ? 'Todas'
                      : members?.rows.some((m) => m.usuario_id === u.id)
                        ? 'Vinculado'
                        : 'Sem vínculo'}
                  </td>
                  <td>
                    <div className="button-row">
                      <Button size="sm" variant="outline" onClick={() => setEdit(u)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPermission(u)}>
                        Permissões
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} count={data?.count ?? 0} onChange={setPage} />
      <Dialog open={!!edit} onOpenChange={() => setEdit(null)} title="Perfil de acesso">
        <form onSubmit={save} className="form-grid">
          {edit === true && (
            <label className="full">
              ID do usuário no Supabase Auth
              <input name="auth_user_id" required />
            </label>
          )}
          <label className="full">
            Nome
            <input name="nome" required defaultValue={edit && edit !== true ? edit.nome : ''} />
          </label>
          <label>
            Perfil
            <select name="perfil" defaultValue={edit && edit !== true ? edit.perfil : 'GESTAO'}>
              <option>GESTAO</option>
              <option>FARMACIA</option>
              <option>ADMIN</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={edit && edit !== true ? edit.ativo : true}
            />
            Ativo
          </label>
          <p className="form-note full">
            Confirme o perfil e o estado de acesso. Todas as mudanças serão auditadas.
          </p>
          <Button type="submit">Confirmar perfil</Button>
        </form>
      </Dialog>
      <Dialog
        open={!!permission}
        onOpenChange={() => setPermission(null)}
        title="Permissão na unidade atual"
      >
        <p>
          Altere o vínculo de <strong>{permission?.nome}</strong> com esta unidade.
        </p>
        <div className="dialog-actions">
          <Button
            variant="destructive"
            onClick={async () => {
              if (await mutate('membership', { usuario_id: permission?.id, remover: true }))
                setPermission(null);
            }}
          >
            Confirmar remoção de acesso
          </Button>
          <Button
            onClick={async () => {
              if (await mutate('membership', { usuario_id: permission?.id })) setPermission(null);
            }}
          >
            Conceder acesso
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
