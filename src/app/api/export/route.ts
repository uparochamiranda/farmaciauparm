import { NextRequest } from 'next/server';
import { session, failure, dbError } from '@/lib/server/api';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
export async function GET(req: NextRequest) {
  try {
    const { db } = await session(),
      p = req.nextUrl.searchParams,
      unit = p.get('unit'),
      kind = p.get('kind') ?? 'stock';
    const names: Record<string, string> = {
      stock: 'Estoque geral',
      critical: 'Produtos críticos',
      pending: 'Pendências',
      consumption: 'Consumo',
      history: 'Histórico',
      coverage: 'Cobertura',
      consolidated: 'Consolidado',
    };
    if (!names[kind]) throw new Error('Relatório inválido.');
    const rows: Record<string, unknown>[] = [];
    for (let start = 0; ; start += 500) {
      const table =
        kind === 'pending'
          ? 'importacao_itens'
          : kind === 'consumption'
            ? 'consumo_historico'
            : kind === 'history'
              ? 'estoque_historico'
              : 'estoque_atual';
      const fields =
        kind === 'pending'
          ? '*,importacoes!inner(unidade_id,status)'
          : '*,medicamentos(nome,apresentacao,codigo),unidades(nome)';
      let q = db
        .from(table)
        .select(fields)
        .order('id')
        .range(start, start + 499);
      if (kind !== 'consolidated')
        q = q.eq(kind === 'pending' ? 'importacoes.unidade_id' : 'unidade_id', unit);
      if (kind === 'critical') q = q.in('situacao', ['CRITICO', 'ATENCAO', 'ZERADO']);
      if (kind === 'pending')
        q = q.in('status', ['PENDENTE', 'ERRO']).eq('importacoes.status', 'WAITING_REVIEW');
      const r = await q;
      dbError(r.error);
      for (const raw of r.data ?? []) {
        const row = raw as unknown as Record<string, unknown>,
          m = row.medicamentos as Record<string, unknown> | undefined,
          u = row.unidades as Record<string, unknown> | undefined;
        rows.push(
          kind === 'pending'
            ? {
                Produto: row.nome_importado,
                Apresentação: row.apresentacao_importada,
                Quantidade: row.quantidade_importada,
                Motivo: row.motivo_pendencia,
              }
            : {
                Unidade: u?.nome,
                Código: m?.codigo,
                Medicamento: m?.nome,
                Apresentação: m?.apresentacao,
                ...(kind === 'consumption'
                  ? {
                      Início: row.periodo_inicio,
                      Fim: row.periodo_fim,
                      Consumo: row.quantidade_consumida,
                      CMD: row.cmd,
                    }
                  : {
                      Estoque: row.quantidade,
                      CMD: row.cmd,
                      'Cobertura (dias)': row.dias_cobertura,
                      Situação: row.situacao,
                      Data: row.updated_at ?? row.created_at,
                    }),
              },
        );
      }
      if ((r.data?.length ?? 0) < 500) break;
      if (rows.length >= 20000) throw new Error('Relatório muito grande. Restrinja a unidade.');
    }
    if (!rows.length) throw new Error('Nenhum registro para exportar.');
    const pdf = p.get('format') === 'pdf';
    let bytes: Uint8Array;
    if (pdf) {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(16);
      doc.text('Farmácia UPA RM · ' + names[kind], 14, 16);
      doc.setFontSize(9);
      doc.text(
        'Gerado em ' + new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        14,
        23,
      );
      autoTable(doc, {
        startY: 29,
        head: [Object.keys(rows[0])],
        body: rows.map((r) => Object.values(r).map((v) => String(v ?? '—'))),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [24, 63, 105] },
      });
      bytes = new Uint8Array(doc.output('arraybuffer'));
    } else {
      const wb = XLSX.utils.book_new(),
        ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 24 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
      bytes = new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    }
    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': pdf
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="farmacia-' + kind + '.' + (pdf ? 'pdf' : 'xlsx') + '"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
