import type { Alias, ImportRow, Match, Medication } from './types';
export function normalizeMedicationName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d)\s+(?=[A-Z%])/g, '$1')
    .replace(/\s*\/\s*/g, '/')
    .replace(/[;:()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const fullName = (m: Medication) => normalizeMedicationName(`${m.nome} ${m.apresentacao}`);
export function clinicalSignature(name: string): string[] {
  const n = normalizeMedicationName(name);
  return (
    n.match(
      /\d+(?:\.\d+)?\s*(?:MCG|MG|G|UI|MEQ|MMOL|ML|L|%)(?:\/(?:\d+(?:\.\d+)?)?(?:ML|L|DOSE|G))?|\b(?:AMPOLA|FRASCO|COMPRIMIDO|CAPSULA|INJETAVEL|SOLUCAO|SUSPENSAO|GOTAS|CREME|POMADA|SPRAY)\b/g,
    ) ?? []
  );
}
function divergence(source: string, target: string): string | null {
  const a = clinicalSignature(source),
    b = clinicalSignature(target);
  if (JSON.stringify(a) === JSON.stringify(b) && a.length > 0) return null;
  if (a.some((x) => /MCG/.test(x)) !== b.some((x) => /MCG/.test(x))) return 'UNIDADE_DIVERGENTE';
  const volume = (xs: string[]) => xs.filter((x) => /^\d+(?:\.\d+)?(?:ML|L)$/.test(x));
  if (JSON.stringify(volume(a)) !== JSON.stringify(volume(b))) return 'VOLUME_DIVERGENTE';
  if (a.filter((x) => /\d/.test(x)).join() !== b.filter((x) => /\d/.test(x)).join())
    return 'CONCENTRACAO_DIVERGENTE';
  return 'APRESENTACAO_DIVERGENTE';
}
export class MedicationMatchingService {
  constructor(
    private medications: Medication[],
    private aliases: Alias[],
  ) {}
  match(row: ImportRow, pdf = false): Match {
    const pending = (reason: string, suggestion?: string): Match => ({
      medicamento_id: null,
      tipo_correspondencia: 'NAO_IDENTIFICADO',
      status: 'PENDENTE',
      motivo_pendencia: reason,
      confianca: 0,
      sugestao_id: suggestion,
    });
    if (row.error) return { ...pending(row.error), status: 'ERRO' };
    if (row.quantity == null || !Number.isFinite(row.quantity) || row.quantity < 0)
      return { ...pending('QUANTIDADE_INVALIDA'), status: 'ERRO' };
    const source = normalizeMedicationName(`${row.name} ${row.presentation}`);
    const active = this.medications.filter((m) => m.ativo);
    const byCode = row.code ? active.filter((m) => m.codigo === row.code) : [];
    if (byCode.length > 1) return pending('DUPLICIDADE');
    const alias = this.aliases.filter((a) => a.ativo && a.alias_normalizado === source);
    const aliasTargets = [...new Set(alias.map((a) => a.medicamento_id))];
    if (!byCode.length && aliasTargets.length > 1) return pending('DUPLICIDADE');
    const aliased = active.find((m) => m.id === aliasTargets[0]);
    const names = active.filter((m) => fullName(m) === source);
    if (!byCode.length && !aliased && names.length > 1) return pending('DUPLICIDADE');
    const target = byCode[0] ?? aliased ?? names[0];
    if (target) {
      const reason = divergence(source, fullName(target));
      if (reason) return pending(reason, target.id);
      // Code matches still require a known name; a code cannot override a different ingredient.
      if (
        byCode.length &&
        source !== fullName(target) &&
        !alias.some((a) => a.medicamento_id === target.id)
      )
        return pending('APRESENTACAO_DIVERGENTE', target.id);
      if (pdf) return pending('VALIDACAO_PDF', target.id);
      return {
        medicamento_id: target.id,
        tipo_correspondencia: byCode.length ? 'CODIGO' : aliased ? 'ALIAS' : 'NOME_NORMALIZADO',
        status: 'OK',
        motivo_pendencia: null,
        confianca: 1,
      };
    }
    const suggestion = active.find(
      (m) => normalizeMedicationName(m.nome).split(' ')[0] === source.split(' ')[0],
    );
    return pending(
      suggestion
        ? (divergence(source, fullName(suggestion)) ?? 'NAO_LOCALIZADO')
        : row.code
          ? 'CODIGO_DESCONHECIDO'
          : 'PRODUTO_NOVO',
      suggestion?.id,
    );
  }
  matchAll(rows: ImportRow[], pdf = false): Match[] {
    const codes = new Map<string, number>();
    for (const r of rows) if (r.code) codes.set(r.code, (codes.get(r.code) ?? 0) + 1);
    const results = rows.map((r) => this.match(r, pdf));
    const ids = results.map((r) => r.medicamento_id).filter(Boolean);
    return results.map((m, i) =>
      (rows[i].code && (codes.get(rows[i].code) ?? 0) > 1) ||
      (m.medicamento_id && ids.filter((id) => id === m.medicamento_id).length > 1)
        ? { ...m, medicamento_id: null, status: 'PENDENTE', motivo_pendencia: 'DUPLICIDADE' }
        : m,
    );
  }
}
