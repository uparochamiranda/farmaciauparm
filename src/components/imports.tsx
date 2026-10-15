'use client';
import { useRef, useState } from 'react';
import {
  CloudUpload,
  FileSpreadsheet,
  CheckCircle2,
  Link2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  History,
  Download,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { useApp, useData, request, Empty, Loading, ErrorNotice, Pager } from './app-context';
import { Badge } from './stock-table';
import type { ImportRecord, ImportItem, Medication } from '@/lib/domain/types';
import { number, date } from '@/lib/utils';
const reasonLabels: Record<string, string> = {
  CONSUMO_INVALIDO: 'Consumo inválido; confira ou ignore a linha',
  UNIDADE_DIVERGENTE: 'Unidade de concentração divergente',
  VOLUME_DIVERGENTE: 'Volume divergente',
  APRESENTACAO_DIVERGENTE: 'Apresentação divergente',
  CONCENTRACAO_DIVERGENTE: 'Concentração divergente',
  PRODUTO_NOVO: 'Produto novo',
  CODIGO_DESCONHECIDO: 'Código desconhecido',
  NAO_LOCALIZADO: 'Medicamento não localizado',
  DUPLICIDADE: 'Produto ou código duplicado',
  QUANTIDADE_INVALIDA: 'Quantidade inválida',
  VALIDACAO_PDF: 'PDF: validação obrigatória',
  VALIDACAO_OBRIGATORIA: 'Validação obrigatória',
};
export const reasonLabel = (s: string | null) => reasonLabels[s ?? ''] ?? s ?? 'Revisão necessária';
export function UploadCard({ onUploaded }: { onUploaded: (id: string) => void }) {
  const { demo, unit, refresh, profile } = useApp(),
    input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false),
    [reference, setReference] = useState(() =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
    );
  async function upload(file?: File) {
    if (!file) return;
    if (demo) {
      toast.info('Demonstração: entre com sua conta para importar arquivos.');
      return;
    }
    setBusy(true);
    const f = new FormData();
    f.set('file', file);
    f.set('unit', unit.id);
    f.set('reference', reference);
    try {
      const r = await request<{ id: string }>('/api/import', { method: 'POST', body: f });
      toast.success('Arquivo processado. Revise a prévia antes de confirmar.');
      refresh();
      onUploaded(r.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha na importação.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <section className="panel upload-panel">
      <div className="panel-heading">
        <h2>Importar arquivo do sistema</h2>
      </div>
      <div
        className={'dropzone ' + (drag ? 'drag-active' : '')}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!busy && profile.perfil !== 'GESTAO') void upload(e.dataTransfer.files[0]);
        }}
      >
        <CloudUpload size={43} strokeWidth={1.6} />
        <p>
          {busy
            ? 'Processando e validando o arquivo…'
            : 'Arraste o arquivo aqui ou clique para selecionar'}
        </p>
        <span>Formatos aceitos: Excel (.xlsx, .xls), CSV ou PDF · até 10 MB</span>
        <input
          ref={input}
          aria-label="Arquivo de estoque"
          className="sr-only"
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        <Button
          disabled={busy || profile.perfil === 'GESTAO'}
          onClick={() => input.current?.click()}
        >
          {busy ? 'Aguarde…' : 'Selecionar arquivo'}
        </Button>
        <label className="reference-date">
          Data de referência{' '}
          <input
            aria-label="Data de referência"
            type="date"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="upload-foot">
        <span className="tiny-dot" />O estoque só é alterado após sua confirmação.
      </div>
    </section>
  );
}
export function ImportPreview({
  record,
  onReview,
  onConfirm,
}: {
  record: ImportRecord | null;
  onReview: (id: string) => void;
  onConfirm: (record: ImportRecord) => void;
}) {
  const { profile } = useApp();
  const rows = record
    ? ([
        [CheckCircle2, record.identificados_codigo, 'identificadas por código', 'green'],
        [Link2, record.identificados_alias, 'identificadas pelo DE-PARA', 'slate'],
        [CheckCircle2, record.identificados_nome, 'por nome normalizado', 'green'],
        [AlertTriangle, record.pendentes, 'aguardando validação', 'orange'],
        [XCircle, record.erros, 'linhas inválidas', 'red'],
      ] as const)
    : [];
  return (
    <section className="panel import-preview">
      <div className="panel-heading">
        <h2>
          <FileSpreadsheet size={18} />
          Prévia da importação
        </h2>
        {record && <span className="mini-label">EM REVISÃO</span>}
      </div>
      {!record ? (
        <Empty text="Selecione um arquivo para visualizar a importação." />
      ) : (
        <>
          <div className="file-info">
            <FileSpreadsheet size={29} />
            <div>
              <strong title={record.nome_arquivo}>{record.nome_arquivo}</strong>
              <span>{date(record.created_at)}</span>
            </div>
            <small>{number(record.total_linhas)} linhas lidas</small>
          </div>
          <div className="preview-rows">
            {rows.map(([Icon, n, label, color]) => (
              <div key={label}>
                <Icon size={18} className={color} />
                <b>{number(n)}</b>
                <span>{label}</span>
                <small>{number((n / Math.max(1, record.total_linhas)) * 100, 1)}%</small>
              </div>
            ))}
          </div>
          <div className="preview-actions">
            <Button variant="outline" onClick={() => onReview(record.id)}>
              Revisar pendências
            </Button>
            <Button
              variant="success"
              disabled={profile.perfil === 'GESTAO' || record.pendentes + record.erros > 0}
              title={
                record.pendentes + record.erros > 0
                  ? 'Resolva todas as pendências antes de confirmar'
                  : undefined
              }
              onClick={() => onConfirm(record)}
            >
              Confirmar importação
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
export function ConfirmImport({ record, onClose }: { record: ImportRecord; onClose: () => void }) {
  const { mutate } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={onClose}
      title="Confirmar importação"
      description="Confira o arquivo e a unidade antes de atualizar o estoque."
    >
      <p>
        <strong>{record.nome_arquivo}</strong>
      </p>
      <p>
        Os saldos das linhas validadas serão substituídos. Produtos ausentes no arquivo manterão o
        saldo atual. Todas as alterações terão histórico e auditoria.
      </p>
      <div className="dialog-actions">
        <Button variant="outline" onClick={onClose}>
          Voltar
        </Button>
        <Button
          variant="success"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (await mutate('confirm_import', { importacao_id: record.id })) onClose();
            setBusy(false);
          }}
        >
          {busy ? 'Confirmando…' : 'Confirmar e atualizar estoque'}
        </Button>
      </div>
    </Dialog>
  );
}
export function MedicationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const { data, loading } = useData<{ rows: Medication[]; count: number }>('medications', {
    search,
  });
  return (
    <label className="full">
      Medicamento de destino
      <div className="search-field">
        <Search size={16} />
        <input
          value={search}
          placeholder="Buscar nome, código ou apresentação"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <select required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">
          {loading ? 'Buscando…' : 'Selecione o medicamento e confira a apresentação'}
        </option>
        {data?.rows.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nome} · {m.apresentacao} · {m.codigo ?? 'sem código'}
          </option>
        ))}
      </select>
      {value && (
        <small>Destino selecionado: {data?.rows.find((m) => m.id === value)?.nome ?? value}</small>
      )}
    </label>
  );
}
export function ReviewItem({ item, onClose }: { item: ImportItem; onClose: () => void }) {
  const { mutate } = useApp();
  const [med, setMed] = useState(item.medicamento_id ?? ''),
    [busy, setBusy] = useState(false),
    [ignore, setIgnore] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    if (
      await mutate('resolve_item', {
        importacao_id: item.importacao_id,
        item_id: item.id,
        medicamento_id: med,
        quantidade: Number(f.get('quantity')),
        consumo: f.get('consumption') === '' ? null : Number(f.get('consumption')),
        justificativa: f.get('reason'),
        criar_alias: f.get('alias') === 'on',
        ignorar: ignore,
      })
    )
      onClose();
    setBusy(false);
  }
  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={'Revisar linha ' + item.numero_linha}
      description="A associação manual exige conferência da dose, concentração, volume e forma farmacêutica."
    >
      <div className="review-original">
        <small>MEDICAMENTO IMPORTADO</small>
        <strong>{item.nome_importado}</strong>
        <span>{item.apresentacao_importada}</span>
        <p className="orange">{reasonLabel(item.motivo_pendencia)}</p>
        <small>
          Confiança automática: {number(item.confianca * 100)}% · Código:{' '}
          {item.codigo_importado || 'não informado'}
        </small>
      </div>
      <details>
        <summary>Ver linha original</summary>
        <pre>{JSON.stringify(item.linha_original, null, 2)}</pre>
      </details>
      <form className="form-grid" onSubmit={submit}>
        <label className="checkbox-label full">
          <input type="checkbox" checked={ignore} onChange={(e) => setIgnore(e.target.checked)} />
          Ignorar esta linha, sem alterar estoque
        </label>
        {!ignore && (
          <>
            <MedicationPicker value={med} onChange={setMed} />
            <label>
              Quantidade corrigida
              <input
                type="number"
                name="quantity"
                min="0"
                step="any"
                defaultValue={item.quantidade_importada ?? ''}
                required
              />
            </label>
            <label>
              Consumo do período
              <input
                type="number"
                name="consumption"
                min="0"
                step="any"
                defaultValue={item.consumo_importado ?? ''}
                required={item.motivo_pendencia === 'CONSUMO_INVALIDO'}
              />
            </label>
            <label className="checkbox-label full">
              <input type="checkbox" name="alias" />
              Salvar DE-PARA para próximas importações
            </label>
            <p className="form-note full">
              O DE-PARA será recusado se houver diferenças clínicas. Para produto novo, cadastre o
              medicamento na aba Cadastros e volte à revisão.
            </p>
          </>
        )}
        <label className="full">
          Justificativa da decisão
          <textarea
            name="reason"
            minLength={5}
            required
            placeholder="Descreva o que foi conferido ou corrigido."
          />
        </label>
        <div className="dialog-actions full">
          <Button type="button" variant="outline" onClick={onClose}>
            Voltar
          </Button>
          <Button type="submit" disabled={busy}>
            {ignore ? 'Confirmar e ignorar linha' : 'Confirmar associação manual'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function PendingList({
  importId,
  compact = false,
  onViewAll,
}: {
  importId?: string;
  compact?: boolean;
  onViewAll?: () => void;
}) {
  const { profile } = useApp();
  const [page, setPage] = useState(0),
    [selected, setSelected] = useState<ImportItem | null>(null);
  const { data, loading, error } = useData<{ rows: ImportItem[]; count: number }>(
    importId ? 'items' : 'pending',
    { id: importId, page },
  );
  return (
    <section className={compact ? '' : 'panel'}>
      <div className="panel-heading">
        <h2 className="red">
          <XCircle size={17} />
          Pendências de validação {data && <span>({data.count})</span>}
        </h2>
        {compact && (
          <button className="text-link" onClick={onViewAll}>
            Ver todas <ArrowRight size={13} />
          </button>
        )}
      </div>
      {error ? (
        <ErrorNotice message={error} />
      ) : loading ? (
        <Loading />
      ) : !data?.rows.length ? (
        <Empty text="Nenhuma pendência de validação." />
      ) : (
        <div className="table-scroll">
          <table className={compact ? 'pending-mini' : ''}>
            <thead>
              <tr>
                <th>Medicamento importado</th>
                <th>{compact ? 'Motivo' : 'Apresentação / motivo'}</th>
                {!compact && (
                  <>
                    <th>Quantidade</th>
                    <th>Situação</th>
                    <th>Ação</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, compact ? 5 : 15).map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.nome_importado}</strong>
                    {compact && <small>{i.apresentacao_importada}</small>}
                  </td>
                  <td>
                    <span className="reason">
                      {!compact && i.apresentacao_importada + ' · '}
                      {reasonLabel(i.motivo_pendencia)}
                    </span>
                  </td>
                  {!compact && (
                    <>
                      <td>{number(i.quantidade_importada)}</td>
                      <td>
                        <Badge status={i.status} />
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={profile.perfil === 'GESTAO'}
                          onClick={() => setSelected(i)}
                        >
                          Revisar
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {compact ? (
        <Button size="sm" variant="outline" className="review-all" onClick={onViewAll}>
          Revisar todas as pendências
        </Button>
      ) : (
        <Pager page={page} count={data?.count ?? 0} onChange={setPage} />
      )}{' '}
      {selected && <ReviewItem item={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
export function ImportHistory({
  openId,
  onOpenId,
}: {
  openId?: string;
  onOpenId: (id: string | undefined) => void;
}) {
  const { mutate, profile, demo } = useApp();
  const [page, setPage] = useState(0),
    [cancel, setCancel] = useState<ImportRecord | null>(null),
    [confirm, setConfirm] = useState<ImportRecord | null>(null);
  const { data, loading, error } = useData<{ rows: ImportRecord[]; count: number }>('imports', {
    page,
  });
  const selected = data?.rows.find((r) => r.id === openId);
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            <History size={19} />
            Histórico de importações
          </h2>
          <span className="muted">Originais preservados e alterações rastreáveis</span>
        </div>
        {error ? (
          <ErrorNotice message={error} />
        ) : loading ? (
          <Loading />
        ) : !data?.rows.length ? (
          <Empty text="Nenhum arquivo importado nesta unidade." />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Arquivo</th>
                  <th>Linhas</th>
                  <th>Pendências</th>
                  <th>Erros</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{date(r.created_at)}</td>
                    <td>
                      <button
                        className="table-name"
                        onClick={() => onOpenId(openId === r.id ? undefined : r.id)}
                      >
                        {r.nome_arquivo}
                      </button>
                    </td>
                    <td>{r.total_linhas}</td>
                    <td>{r.pendentes}</td>
                    <td>{r.erros}</td>
                    <td>
                      <Badge status={r.status} />
                    </td>
                    <td>
                      <div className="button-row">
                        <Button size="sm" variant="outline" onClick={() => onOpenId(r.id)}>
                          Detalhes
                        </Button>
                        <button
                          aria-label="Baixar original"
                          className="icon-button"
                          onClick={async () => {
                            if (demo) {
                              toast.info('Arquivo demonstrativo.');
                              return;
                            }
                            try {
                              const d = await request<{ url: string }>(
                                '/api/data?resource=download&id=' + r.id,
                              );
                              window.open(d.url, '_blank', 'noopener,noreferrer');
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Falha no download.');
                            }
                          }}
                        >
                          <Download size={17} />
                        </button>
                        {r.status === 'WAITING_REVIEW' && profile.perfil !== 'GESTAO' && (
                          <>
                            <Button
                              size="sm"
                              disabled={r.pendentes + r.erros > 0}
                              variant="success"
                              onClick={() => setConfirm(r)}
                            >
                              Confirmar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setCancel(r)}>
                              Cancelar
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} count={data?.count ?? 0} onChange={setPage} />
      </section>
      {openId && (
        <div className="section-gap">
          <div className="section-title">
            <h2>{selected?.nome_arquivo ?? 'Detalhes da importação'}</h2>
            <button className="text-link" onClick={() => onOpenId(undefined)}>
              Fechar detalhes
            </button>
          </div>
          <PendingList key={openId} importId={openId} />
        </div>
      )}
      {confirm && <ConfirmImport record={confirm} onClose={() => setConfirm(null)} />}
      <Dialog
        open={!!cancel}
        onOpenChange={() => setCancel(null)}
        title="Cancelar importação"
        description="O arquivo original e a auditoria serão preservados."
      >
        <p>Cancelar {cancel?.nome_arquivo}? Nenhum saldo será atualizado.</p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setCancel(null)}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              if (await mutate('cancel_import', { importacao_id: cancel?.id })) setCancel(null);
            }}
          >
            Confirmar cancelamento
          </Button>
        </div>
      </Dialog>
    </>
  );
}
