import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { createHash } from 'node:crypto';
import { normalizeMedicationName } from '../domain/matching';
import type { ImportRow } from '../domain/types';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_ROWS = 10000;
export const hashFile = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');
const header = (v: unknown) => normalizeMedicationName(String(v ?? '')).replace(/[^A-Z0-9]/g, '');
const columns = {
  code: ['CODIGO', 'COD', 'CODIGOPRODUTO', 'CODIGOMEDICAMENTO'],
  name: ['PRODUTO', 'MEDICAMENTO', 'DESCRICAO', 'NOME', 'NOMEPRODUTO'],
  quantity: ['QUANTIDADE', 'QTD', 'QTDE', 'ESTOQUE', 'SALDO', 'SALDOATUAL'],
  presentation: ['APRESENTACAO'],
  consumption: ['CONSUMO', 'CONSUMOPERIODO', 'CONSUMO112DIAS', 'QUANTIDADECONSUMIDA'],
};
export function parseQuantity(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const s = String(value ?? '').trim();
  if (!s || !/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(s)) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function parseMatrix(matrix: unknown[][], expectedDays = 112): ImportRow[] {
  const headerIndex = matrix
    .slice(0, 30)
    .findIndex((row) => row.some((v) => columns.name.includes(header(v))));
  if (headerIndex < 0) throw new Error('O arquivo não contém uma coluna Produto reconhecida.');
  const headers = matrix[headerIndex].map(header);
  const find = (key: keyof typeof columns) => {
    const matches = headers.flatMap((h, i) =>
      columns[key].includes(h) || (key === 'consumption' && /^CONSUMO\d+DIAS$/.test(h)) ? [i] : [],
    );
    if (matches.length > 1) throw new Error('Cabeçalhos ambíguos: mais de uma coluna ' + key + '.');
    return matches[0] ?? -1;
  };
  const c = {
    code: find('code'),
    name: find('name'),
    quantity: find('quantity'),
    presentation: find('presentation'),
    consumption: find('consumption'),
  };
  const declaredDays =
    c.consumption >= 0 ? headers[c.consumption].match(/^CONSUMO(\d+)DIAS$/)?.[1] : undefined;
  if (declaredDays && Number(declaredDays) !== expectedDays)
    throw new Error(
      'O período de consumo do arquivo difere dos ' +
        expectedDays +
        ' dias configurados nesta importação.',
    );
  if (c.quantity < 0) throw new Error('O arquivo não contém uma coluna Quantidade reconhecida.');
  const rows = matrix
    .slice(headerIndex + 1)
    .map((r, i) => ({ r, line: headerIndex + i + 2 }))
    .filter(({ r }) => r.some((v) => String(v ?? '').trim() !== ''));
  if (!rows.length) throw new Error('O arquivo não contém produtos.');
  if (rows.length > MAX_ROWS) throw new Error('Limite de 10.000 linhas por arquivo.');
  return rows.map(({ r, line }) => ({
    line,
    code: String(r[c.code] ?? '').trim(),
    name: String(r[c.name] ?? '').trim(),
    presentation: String(r[c.presentation] ?? '').trim(),
    quantity: String(r[c.name] ?? '').trim() ? parseQuantity(r[c.quantity]) : null,
    consumption: c.consumption < 0 ? null : parseQuantity(r[c.consumption]),
    error:
      c.consumption >= 0 && parseQuantity(r[c.consumption]) == null
        ? 'CONSUMO_INVALIDO'
        : undefined,
    raw: Object.fromEntries(matrix[headerIndex].map((h, j) => [String(h), r[j] ?? null])),
  }));
}
export async function parseFile(
  buffer: Buffer,
  filename: string,
  expectedDays = 112,
): Promise<{ rows: ImportRow[]; pdf: boolean }> {
  if (buffer.length > MAX_FILE_SIZE) throw new Error('O arquivo excede o limite de 10 MB.');
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    let text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buffer);
    const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
      skipEmptyLines: false,
      dynamicTyping: false,
    });
    if (result.errors.length) throw new Error('CSV inválido. Confira separadores e aspas.');
    return { rows: parseMatrix(result.data, expectedDays), pdf: false };
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, sheetRows: MAX_ROWS + 32 });
    const nonEmpty = wb.SheetNames.filter((name) => wb.Sheets[name]['!ref']);
    if (nonEmpty.length !== 1)
      throw new Error(
        'Selecione um arquivo com uma única planilha de dados para evitar leitura ambígua.',
      );
    const sheet = wb.Sheets[nonEmpty[0]];
    if (sheet['!fullref'] && XLSX.utils.decode_range(sheet['!fullref']).e.r > MAX_ROWS + 30)
      throw new Error('Limite de 10.000 linhas por arquivo.');
    if (Object.entries(sheet).some(([key, cell]) => !key.startsWith('!') && cell.f))
      throw new Error('A planilha contém fórmulas. Exporte somente valores antes de importar.');
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
    return { rows: parseMatrix(matrix, expectedDays), pdf: false };
  }
  if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
    try {
      const doc = await task.promise;
      if (doc.numPages > 100) throw new Error('PDF excede o limite de 100 páginas.');
      const lines: string[] = [];
      for (let page = 1; page <= doc.numPages; page++) {
        const content = await (await doc.getPage(page)).getTextContent();
        const byY = new Map<number, { x: number; text: string }[]>();
        for (const item of content.items)
          if ('str' in item) {
            const y = Math.round(item.transform[5]);
            byY.set(y, [...(byY.get(y) ?? []), { x: item.transform[4], text: item.str }]);
          }
        for (const [, cells] of [...byY].sort((a, b) => b[0] - a[0]))
          lines.push(
            cells
              .sort((a, b) => a.x - b.x)
              .map((c) => c.text)
              .join('  '),
          );
      }
      // Only explicit separators are accepted. PDFs without an unambiguous table are rejected.
      const matrix = lines
        .filter((l) => l.trim())
        .map((l) => (l.includes(';') ? l.split(';') : l.trim().split(/\s{2,}/)));
      const rows = parseMatrix(matrix);
      if (rows.some((r) => r.quantity == null))
        throw new Error('PDF com estrutura ambígua. Exporte Excel/CSV ou corrija o arquivo.');
      return { rows, pdf: true };
    } finally {
      await task.destroy();
    }
  }
  throw new Error('Arquivo incompatível. Utilize Excel (.xlsx, .xls), CSV ou PDF.');
}
