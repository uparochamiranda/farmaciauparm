import type { Rule, Situation } from './types';
export function calculateCMD(consumption: number, days = 112) {
  if (!Number.isFinite(consumption) || consumption < 0 || !Number.isInteger(days) || days <= 0)
    throw new Error('Consumo ou período inválido.');
  return consumption / days;
}
export function calculateCoverage(stock: number, cmd: number) {
  if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(cmd) || cmd < 0)
    throw new Error('Estoque ou CMD inválido.');
  return cmd === 0 ? null : stock / cmd;
}
export function classifyStock(
  quantity: number,
  cmd: number,
  rules: Rule[],
  unit?: string,
  medication?: string,
): Situation {
  const coverage = calculateCoverage(quantity, cmd);
  if (quantity === 0) return 'ZERADO';
  if (coverage === null) return 'SEM_CONSUMO';
  const applicable = rules.filter(
    (r) =>
      r.ativo &&
      (!r.unidade_id || r.unidade_id === unit) &&
      (!r.medicamento_id || r.medicamento_id === medication),
  );
  // A specific scope replaces the whole global threshold set, avoiding overlapping ranges.
  const rank = (r: Rule) => (r.medicamento_id ? 2 : 0) + (r.unidade_id ? 1 : 0);
  const highest = Math.max(0, ...applicable.map(rank));
  return (
    applicable
      .filter((r) => rank(r) === highest)
      .sort((a, b) => b.prioridade - a.prioridade)
      .find(
        (r) => coverage >= r.dias_minimos && (r.dias_maximos == null || coverage < r.dias_maximos),
      )?.tipo_regra ?? 'NORMAL'
  );
}
export const situationLabels: Record<Situation, string> = {
  CRITICO: 'Crítico',
  ATENCAO: 'Atenção',
  NORMAL: 'Normal',
  ZERADO: 'Zerado',
  SEM_CONSUMO: 'Sem consumo',
};
