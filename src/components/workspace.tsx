'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Cross,
  LayoutDashboard,
  FileUp,
  Package,
  TriangleAlert,
  FileBarChart2,
  SlidersHorizontal,
  History,
  ClipboardList,
  Settings,
  Bell,
  CircleUserRound,
  ChevronRight,
  ArrowRight,
  Box,
  CircleAlert,
  Ban,
  CircleCheck,
  CircleHelp,
  ShieldCheck,
  MapPin,
  Menu,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import {
  AppContext,
  useMutations,
  useData,
  Empty,
  ErrorNotice,
  type Unit,
  type Profile,
} from './app-context';
import { StockTable, StockDetail, Badge } from './stock-table';
import { UploadCard, ImportPreview, PendingList, ImportHistory, ConfirmImport } from './imports';
import { TrendChart, StatusChart } from './charts';
import { Aliases, Medications, Reports, Settings as SettingsPage } from './management';
import { number, date } from '@/lib/utils';
import type { Stock, ImportRecord, ImportItem, Rule } from '@/lib/domain/types';
const nav = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['import', 'Importar Arquivo', FileUp],
  ['stock', 'Estoque', Package],
  ['critical', 'Críticos', TriangleAlert],
  ['reports', 'Relatórios', FileBarChart2],
  ['aliases', 'DE-PARA', SlidersHorizontal],
  ['history', 'Histórico', History],
  ['medications', 'Cadastros', ClipboardList],
  ['settings', 'Configurações', Settings],
] as const;
type DashboardData = {
  stats: Record<string, number>;
  critical: Stock[];
  last: ImportRecord | null;
  preview: ImportRecord | null;
  pending: ImportItem[];
  rules: Rule[];
  trend: Record<string, unknown>[];
};
export function Workspace({
  demo = false,
  profile,
  units,
}: {
  demo?: boolean;
  profile: Profile;
  units: Unit[];
}) {
  const router = useRouter();
  const [unitId, setUnitId] = useState(units[0].id),
    [revision, setRevision] = useState(0),
    [tab, setTab] = useState('dashboard'),
    [status, setStatus] = useState(''),
    [openId, setOpenId] = useState<string>(),
    [mobile, setMobile] = useState(false);
  const unit = units.find((u) => u.id === unitId) ?? units[0];
  const refresh = useCallback(() => {
    setRevision((r) => r + 1);
    router.refresh();
  }, [router]);
  const mutate = useMutations(demo, unit, refresh);
  function navigate(next: string, filter = '') {
    setTab(next);
    setStatus(filter);
    setMobile(false);
  }
  return (
    <AppContext.Provider value={{ demo, unit, profile, revision, refresh, mutate }}>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <button
              className="mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
            <span className="brand-icon">
              <Cross fill="currentColor" strokeWidth={1} />
            </span>
            <div>
              <h1>Farmácia UPA RM</h1>
              <p>Controle de Estoque e Abastecimento</p>
            </div>
          </div>
          <div className="topbar-actions">
            <select
              className="header-unit"
              aria-label="Unidade de atendimento"
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                setOpenId(undefined);
              }}
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.sigla}
                </option>
              ))}
            </select>
            {demo && (
              <Link className="demo-pill" href="/login">
                Demonstração · Entrar
              </Link>
            )}
            <button
              className="notification-button"
              aria-label="Ver pendências de validação"
              onClick={() => navigate('pending')}
            >
              <Bell size={23} />
              <span />
            </button>
            <div className="topbar-divider" />
            <CircleUserRound size={35} className="user-avatar" />
            <div className="user-info">
              <strong>{profile.nome}</strong>
              <span>
                {profile.perfil === 'ADMIN'
                  ? 'Administrador'
                  : profile.perfil === 'FARMACIA'
                    ? 'Farmácia'
                    : 'Gestão'}
              </span>
            </div>
            <form action="/auth/signout" method="post">
              <button className="logout-button" title="Sair do sistema" aria-label="Sair">
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </header>
        <aside className={'sidebar ' + (mobile ? 'sidebar-open' : '')}>
          <div className="sidebar-caption">PRINCIPAL</div>
          <nav>
            {nav.map(([id, label, Icon]) => (
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => navigate(id)}>
                <Icon size={19} />
                <span>{label}</span>
                {tab === id && <ChevronRight size={14} className="nav-chevron" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="unit-emblem">
              <Cross size={18} />
            </div>
            <strong>UPA Rocha Miranda</strong>
            <span>Gestão da farmácia</span>
            <div className="sidebar-secure">
              <ShieldCheck size={13} />
              Ambiente seguro
            </div>
          </div>
        </aside>
        <main className="main-content">
          <div className={'page-context ' + (tab === 'dashboard' ? 'dashboard-context' : '')}>
            <div>
              <span>Farmácia</span>
              <ChevronRight size={13} />
              <strong>
                {tab === 'pending' ? 'Pendências de validação' : nav.find((n) => n[0] === tab)?.[1]}
              </strong>
              {demo && (
                <span className="demo-note">Dados fictícios · alterações desabilitadas</span>
              )}
            </div>
            <div className="context-controls">
              <MapPin size={14} />
              <select
                aria-label="Unidade atual"
                value={unitId}
                onChange={(e) => {
                  setUnitId(e.target.value);
                  setOpenId(undefined);
                }}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
              <button
                className="icon-button"
                title="Atualizar dados"
                aria-label="Atualizar dados"
                onClick={refresh}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
          <WorkspaceBody
            key={unit.id}
            tab={tab}
            status={status}
            navigate={navigate}
            openId={openId}
            setOpenId={setOpenId}
            onUploaded={(id) => {
              setOpenId(id);
              setTab('history');
            }}
          />
          <footer className="page-footer">
            <span>
              Farmácia UPA RM <i /> Controle de estoque e abastecimento
            </span>
            <span>
              <ShieldCheck size={12} /> Rastreabilidade em cada operação
            </span>
          </footer>
        </main>
      </div>
    </AppContext.Provider>
  );
}
function WorkspaceBody({
  tab,
  status,
  navigate,
  openId,
  setOpenId,
  onUploaded,
}: {
  tab: string;
  status: string;
  navigate: (tab: string, status?: string) => void;
  openId?: string;
  setOpenId: (id: string | undefined) => void;
  onUploaded: (id: string) => void;
}) {
  if (tab === 'dashboard')
    return (
      <Dashboard
        navigate={navigate}
        onUploaded={onUploaded}
        onReview={(id) => {
          setOpenId(id);
          navigate('history');
        }}
      />
    );
  if (tab === 'stock' || tab === 'critical')
    return <StockTable key={tab + status} critical={tab === 'critical'} initialStatus={status} />;
  if (tab === 'pending') return <PendingList />;
  if (tab === 'history') return <ImportHistory openId={openId} onOpenId={setOpenId} />;
  if (tab === 'import')
    return (
      <ImportPage
        onUploaded={onUploaded}
        onReview={(id) => {
          setOpenId(id);
          navigate('history');
        }}
      />
    );
  if (tab === 'aliases') return <Aliases />;
  if (tab === 'medications') return <Medications />;
  if (tab === 'reports') return <Reports />;
  return <SettingsPage />;
}
function ImportPage({
  onUploaded,
  onReview,
}: {
  onUploaded: (id: string) => void;
  onReview: (id: string) => void;
}) {
  const { data } = useData<DashboardData>('dashboard');
  const [confirm, setConfirm] = useState<ImportRecord | null>(null);
  return (
    <>
      <div className="import-page-grid">
        <UploadCard onUploaded={onUploaded} />
        <ImportPreview record={data?.preview ?? null} onReview={onReview} onConfirm={setConfirm} />
      </div>
      <div className="import-guidance">
        <ShieldCheck />
        <div>
          <h3>Revise antes de confirmar</h3>
          <p>
            O arquivo deve conter Produto e Quantidade. Código, Apresentação e Consumo são
            reconhecidos quando presentes. PDF exige validação de todas as linhas. Use uma única
            planilha por arquivo.
          </p>
          <p>
            Fluxo: upload → processamento → prévia → revisão → confirmação → atualização atômica.
          </p>
        </div>
      </div>
      {confirm && <ConfirmImport record={confirm} onClose={() => setConfirm(null)} />}
    </>
  );
}
function Dashboard({
  navigate,
  onUploaded,
  onReview,
}: {
  navigate: (tab: string, status?: string) => void;
  onUploaded: (id: string) => void;
  onReview: (id: string) => void;
}) {
  const [days, setDays] = useState(45),
    [confirm, setConfirm] = useState<ImportRecord | null>(null),
    [selected, setSelected] = useState<Stock | null>(null);
  const { data, loading, error } = useData<DashboardData>('dashboard', { days });
  const stats = data?.stats ?? {};
  const cards = [
    ['total', 'Produtos monitorados', Box, 'blue', 'stock'],
    ['CRITICO', 'Críticos', TriangleAlert, 'red', 'stock'],
    ['ATENCAO', 'Em atenção', CircleAlert, 'orange', 'stock'],
    ['ZERADO', 'Zerados', Ban, 'gray', 'stock'],
    ['NORMAL', 'Normais', CircleCheck, 'green', 'stock'],
    ['PENDENTE', 'Aguardando validação', CircleHelp, 'purple', 'pending'],
  ] as const;
  return (
    <>
      {error && <ErrorNotice message={error} />}
      <div className="stats-grid">
        {cards.map(([key, label, Icon, color, target]) => (
          <button
            className={'stat-card stat-' + color}
            key={key}
            onClick={() => navigate(target, key === 'total' || key === 'PENDENTE' ? '' : key)}
            title={
              key === 'PENDENTE'
                ? 'Linhas pendentes de importação, separadas do estoque atual'
                : label
            }
          >
            <span className="stat-icon">
              <Icon size={32} strokeWidth={2.2} />
            </span>
            <span>
              <strong>{loading ? '—' : number(stats[key] ?? 0)}</strong>
              <span>{label}</span>
              {key !== 'total' && (
                <small>
                  {key === 'PENDENTE'
                    ? 'Revisar importações'
                    : number(((stats[key] ?? 0) / Math.max(1, stats.total ?? 0)) * 100, 1) + '%'}
                </small>
              )}
              {key === 'total' && <small>na unidade selecionada</small>}
            </span>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="import-cards">
          <UploadCard onUploaded={onUploaded} />
          <ImportPreview
            record={data?.preview ?? null}
            onReview={onReview}
            onConfirm={setConfirm}
          />
        </div>
        <div className="dashboard-right-top">
          <section className="panel last-import">
            <div className="panel-heading">
              <h2>
                <ShieldCheck size={17} />
                Última importação
              </h2>
              <button className="text-link" onClick={() => navigate('history')}>
                Ver histórico <ArrowRight size={13} />
              </button>
            </div>
            {data?.last ? (
              <div className="last-import-body">
                <CircleCheck size={27} fill="#0c9c53" color="white" />
                <div>
                  <strong>{data.last.nome_arquivo}</strong>
                  <small>{date(data.last.completed_at ?? data.last.created_at)}</small>
                </div>
              </div>
            ) : (
              <p className="small-empty">Nenhuma importação confirmada.</p>
            )}
          </section>
          <section className="panel trend-panel">
            <div className="panel-heading">
              <h2>Evolução do estoque total</h2>
              <select
                aria-label="Período do gráfico"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                {[7, 30, 45, 90, 180, 365].map((n) => (
                  <option key={n} value={n}>
                    {n === 365 ? 'Último ano' : 'Últimos ' + n + ' dias'}
                  </option>
                ))}
              </select>
            </div>
            <TrendChart rows={data?.trend ?? []} />
          </section>
        </div>
        <section className="panel critical-panel">
          <div className="panel-heading">
            <h2>
              <TriangleAlert size={21} className="red" fill="#fff1f2" />
              Produtos críticos
            </h2>
            <button className="text-link" onClick={() => navigate('critical')}>
              Ver todos <ArrowRight size={14} />
            </button>
          </div>
          {!data?.critical.length ? (
            <Empty text="Nenhum produto crítico na unidade." />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Medicamento</th>
                    <th>Apresentação</th>
                    <th className="numeric">Estoque</th>
                    <th className="numeric">CMD</th>
                    <th className="numeric">Cobertura (dias)</th>
                    <th>Situação</th>
                    <th>Ação sugerida</th>
                  </tr>
                </thead>
                <tbody>
                  {data.critical.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <button className="table-name" onClick={() => setSelected(s)}>
                          {s.medicamentos.nome}
                        </button>
                      </td>
                      <td>{s.medicamentos.apresentacao}</td>
                      <td className={'numeric ' + s.situacao.toLowerCase()}>
                        {number(s.quantidade)}
                      </td>
                      <td className="numeric">{number(s.cmd, 2)}</td>
                      <td className={'numeric bold ' + s.situacao.toLowerCase()}>
                        {number(s.dias_cobertura, 1)}
                      </td>
                      <td>
                        <Badge status={s.situacao} />
                      </td>
                      <td className={s.situacao === 'ATENCAO' ? 'orange' : 'red'}>
                        {s.situacao === 'ATENCAO' ? 'Programar reposição' : 'Reposição urgente'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel distribution-panel">
          <div className="panel-heading">
            <h2>
              <CircleAlert size={18} />
              Status dos produtos
            </h2>
          </div>
          <StatusChart stats={stats} />
        </section>
        <div className="dashboard-stock">
          <StockTable compact />
        </div>
        <div className="dashboard-side">
          <section className="panel">
            <PendingList compact onViewAll={() => navigate('pending')} />
          </section>
          <section className="panel rules-mini">
            <div className="panel-heading">
              <h2>
                <Settings size={16} />
                Regras dos críticos
              </h2>
              <button className="text-link" onClick={() => navigate('settings')}>
                Editar regras
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Situação</th>
                  <th>Regra (dias de cobertura)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rules ?? [])
                  .filter((r) => !r.unidade_id && !r.medicamento_id)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Badge status={r.tipo_regra} />
                      </td>
                      <td>
                        {r.dias_maximos == null
                          ? 'A partir de ' + r.dias_minimos
                          : r.dias_minimos === 0
                            ? 'Menor que ' + r.dias_maximos
                            : r.dias_minimos + ' a menos de ' + r.dias_maximos}{' '}
                        dias
                      </td>
                    </tr>
                  ))}
                <tr>
                  <td>
                    <Badge status="ZERADO" />
                  </td>
                  <td>Estoque = 0</td>
                </tr>
                <tr>
                  <td>
                    <Badge status="SEM_CONSUMO" />
                  </td>
                  <td>CMD = 0, com estoque</td>
                </tr>
              </tbody>
            </table>
            <p>Regras específicas têm prioridade sobre a regra global.</p>
          </section>
          <div className="data-note">
            <ShieldCheck size={15} />
            <span>Pendências não alteram o estoque até a validação e confirmação.</span>
          </div>
        </div>
      </div>
      {confirm && <ConfirmImport record={confirm} onClose={() => setConfirm(null)} />}{' '}
      {selected && <StockDetail stock={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
