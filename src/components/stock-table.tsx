'use client';
import { useState, useEffect } from 'react';
import {
  Search,
  FileSpreadsheet,
  FileText,
  MoreVertical,
  PackageSearch,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { useApp, useData, Empty, Loading, ErrorNotice, Pager } from './app-context';
import { DetailChart } from './charts';
import type { Stock, Situation } from '@/lib/domain/types';
import { situationLabels } from '@/lib/domain/stock';
import { number, date } from '@/lib/utils';
export function Badge({ status }: { status: string }) {
  return (
    <span className={'badge badge-' + status.toLowerCase()}>
      {situationLabels[status as Situation] ??
        (
          {
            PENDENTE: 'Pendente',
            OK: 'Validado',
            ERRO: 'Erro',
            IGNORADO: 'Ignorado',
            WAITING_REVIEW: 'Em revisão',
            COMPLETED: 'Concluída',
            FAILED: 'Falhou',
            CANCELLED: 'Cancelada',
            UPLOADED: 'Enviada',
            PROCESSING: 'Processando',
          } as Record<string, string>
        )[status] ??
        status}
    </span>
  );
}
export async function exportFile(unit: string, kind: string, format: string, demo: boolean) {
  if (demo) {
    toast.info('Os relatórios reais ficam disponíveis após o login.');
    return;
  }
  const id = toast.loading('Preparando relatório…');
  try {
    const r = await fetch('/api/export?' + new URLSearchParams({ unit, kind, format }));
    if (!r.ok) throw new Error((await r.json()).error);
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'farmacia-' + kind + '.' + format;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Relatório gerado.', { id });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Falha na exportação.', { id });
  }
}
export function ExportButtons({ kind = 'stock' }: { kind?: string }) {
  const { unit, demo } = useApp();
  return (
    <div className="button-row">
      <Button size="sm" variant="success" onClick={() => exportFile(unit.id, kind, 'xlsx', demo)}>
        <FileSpreadsheet size={14} />
        Exportar Excel
      </Button>
      <Button size="sm" onClick={() => exportFile(unit.id, kind, 'pdf', demo)}>
        <FileText size={14} />
        Gerar PDF
      </Button>
    </div>
  );
}
export function StockDetail({ stock, onClose }: { stock: Stock; onClose: () => void }) {
  const { profile, mutate } = useApp();
  const { data, loading, error } = useData<{
    history: Record<string, unknown>[];
    consumption: Record<string, unknown>[];
  }>('detail', { id: stock.medicamento_id });
  const [adjust, setAdjust] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    if (
      await mutate('manual_stock', {
        medicamento_id: stock.medicamento_id,
        quantidade: Number(f.get('quantity')),
        justificativa: f.get('reason'),
      })
    ) {
      setAdjust(false);
      onClose();
    }
    setBusy(false);
  }
  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={stock.medicamentos.nome}
      description={stock.medicamentos.apresentacao + ' · Código ' + stock.medicamentos.codigo}
      wide
    >
      <div className="detail-metrics">
        <div>
          <small>Estoque atual</small>
          <strong>{number(stock.quantidade)}</strong>
        </div>
        <div>
          <small>Consumo médio diário</small>
          <strong>{number(stock.cmd, 2)}</strong>
        </div>
        <div>
          <small>Cobertura</small>
          <strong>
            {number(stock.dias_cobertura, 1)} <small>dias</small>
          </strong>
        </div>
        <Badge status={stock.situacao} />
      </div>
      <h3>Evolução do medicamento</h3>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorNotice message={error} />
      ) : data?.history.length ? (
        <DetailChart rows={data.history} />
      ) : (
        <Empty text="Sem histórico para este medicamento." />
      )}
      <h3>Consumo registrado</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Fim do período</th>
              <th>Dias</th>
              <th>Quantidade consumida</th>
              <th>CMD</th>
            </tr>
          </thead>
          <tbody>
            {data?.consumption.map((r, i) => (
              <tr key={i}>
                <td>{String(r.periodo_fim)}</td>
                <td>{String(r.dias_periodo)}</td>
                <td>{number(Number(r.quantidade_consumida), 2)}</td>
                <td>{number(Number(r.cmd), 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {profile.perfil === 'ADMIN' && (
        <div className="modal-section">
          <Button variant="outline" onClick={() => setAdjust(!adjust)}>
            <SlidersHorizontal size={15} />
            Ajustar estoque manualmente
          </Button>
          {adjust && (
            <form onSubmit={submit} className="form-grid">
              <label>
                Nova quantidade
                <input
                  name="quantity"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={stock.quantidade}
                  required
                />
              </label>
              <label>
                Justificativa
                <input name="reason" minLength={5} required />
              </label>
              <p className="form-note full">
                Ao confirmar, o saldo será substituído e o ajuste ficará registrado no histórico e
                na auditoria.
              </p>
              <Button disabled={busy} variant="destructive" type="submit">
                Confirmar ajuste
              </Button>
            </form>
          )}
        </div>
      )}
    </Dialog>
  );
}
export function StockTable({
  critical = false,
  initialStatus = '',
  compact = false,
}: {
  critical?: boolean;
  initialStatus?: string;
  compact?: boolean;
}) {
  const { unit } = useApp();
  const [search, setSearch] = useState(''),
    [debounced, setDebounced] = useState(''),
    [group, setGroup] = useState(''),
    [status, setStatus] = useState(initialStatus),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Stock | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(0);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);
  const { data, loading, error } = useData<{ rows: Stock[]; count: number }>('stock', {
    search: debounced,
    group,
    status,
    page,
    critical: String(critical),
  });
  return (
    <section className="panel stock-panel">
      <div className="panel-heading">
        <h2>
          <PackageSearch size={19} />
          {critical ? 'Produtos críticos' : 'Estoque geral'}
        </h2>
        <ExportButtons kind={critical ? 'critical' : 'stock'} />
      </div>
      <div className="filters">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Pesquisar estoque"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por medicamento, código ou apresentação…"
          />
        </label>
        <select
          aria-label="Filtrar grupo"
          value={group}
          onChange={(e) => {
            setGroup(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Todos os grupos</option>
          {[
            'Analgésico',
            'Antibiótico',
            'Antiemético',
            'Cardiológico',
            'Emergência',
            'Gastrointestinal',
            'Hormônio',
            'Respiratório',
            'Solução',
            'Outros',
          ].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar situação"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Todas as situações</option>
          {Object.entries(situationLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSearch('');
            setGroup('');
            setStatus('');
            setPage(0);
          }}
        >
          Limpar filtros
        </Button>
      </div>
      {error ? (
        <ErrorNotice message={error} />
      ) : loading ? (
        <Loading />
      ) : !data?.rows.length ? (
        <Empty text="Nenhum produto encontrado. Importe um arquivo para iniciar o estoque." />
      ) : (
        <div className="table-scroll">
          <table className={compact ? 'compact-table' : ''}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Medicamento</th>
                <th>Apresentação</th>
                <th>Grupo</th>
                <th className="numeric">Estoque</th>
                <th className="numeric">CMD ({unit.dias_consumo} dias)</th>
                <th className="numeric">Cobertura (dias)</th>
                <th>Situação</th>
                <th>Última atualização</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((s) => (
                <tr key={s.id}>
                  <td className="code-cell">{s.medicamentos.codigo ?? '—'}</td>
                  <td>
                    <button className="table-name" onClick={() => setSelected(s)}>
                      {s.medicamentos.nome}
                    </button>
                  </td>
                  <td>{s.medicamentos.apresentacao}</td>
                  <td>{s.medicamentos.grupo}</td>
                  <td className={'numeric stock-value ' + s.situacao.toLowerCase()}>
                    {number(s.quantidade)}
                  </td>
                  <td className="numeric">{number(s.cmd, 2)}</td>
                  <td className={'numeric ' + s.situacao.toLowerCase()}>
                    {number(s.dias_cobertura, 1)}
                  </td>
                  <td>
                    <Badge status={s.situacao} />
                  </td>
                  <td>{date(s.updated_at).split(',')[0]}</td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={'Detalhes de ' + s.medicamentos.nome}
                      onClick={() => setSelected(s)}
                    >
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} count={data?.count ?? 0} onChange={setPage} />
      {selected && <StockDetail stock={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
