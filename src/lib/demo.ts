import type { Stock, Medication, ImportItem, Rule, ImportRecord } from './domain/types';
import { calculateCoverage, situationLabels } from './domain/stock';
const sample: [string, string, string, string, number, number][] = [
  ['65051201982', 'AMOXICILINA + CLAVULANATO', '500 mg + 125 mg', 'Antibiótico', 156, 3.21],
  ['65050701466', 'AZITROMICINA', '500 mg', 'Antibiótico', 27, 3.15],
  ['65050100321', 'BICARBONATO DE SÓDIO', '8,4% 10 mL', 'Solução', 244, 8.7],
  ['65050300455', 'CLORETO DE SÓDIO', '0,9% 500 mL', 'Solução', 732, 15.32],
  ['65050400877', 'FUROSEMIDA', '10 mg/mL 2 mL', 'Cardiológico', 12, 3.85],
  ['65050600990', 'VASOPRESSINA', '20 UI/mL 1 mL', 'Hormônio', 3, 1.52],
  ['65050101001', 'ADRENALINA', '1 mg/mL 1 mL', 'Emergência', 3, 5.19],
  ['65050101002', 'ONDANSETRONA', '2 mg/mL 2 mL', 'Antiemético', 8, 4.3],
  ['65050101003', 'LOSARTANA', '50 mg', 'Cardiológico', 45, 6.12],
  ['65050101004', 'OMEPRAZOL', '40 mg injetável', 'Gastrointestinal', 52, 7.8],
  ['65050101005', 'DIPIRONA', '500 mg/mL 2 mL', 'Analgésico', 890, 23.5],
  ['65050101006', 'PARACETAMOL', '500 mg', 'Analgésico', 450, 12.2],
  ['65050101007', 'CEFTRIAXONA', '1 g injetável', 'Antibiótico', 120, 5.4],
  ['65050101008', 'SALBUTAMOL', '100 mcg/dose', 'Respiratório', 0, 2.1],
  ['65050101009', 'ÁGUA DESTILADA', '5 mL', 'Solução', 500, 0],
  ['65050101010', 'CLORETO DE POTÁSSIO', '10% 10 mL', 'Solução', 240, 4.2],
];
export const demoStock: Stock[] = sample.map(
  ([code, name, presentation, group, quantity, cmd], i) => ({
    id: 'stock-' + i,
    unidade_id: 'demo',
    medicamento_id: 'med-' + i,
    quantidade: quantity,
    cmd,
    dias_cobertura: calculateCoverage(quantity, cmd),
    situacao:
      quantity === 0
        ? 'ZERADO'
        : cmd === 0
          ? 'SEM_CONSUMO'
          : quantity / cmd < 5
            ? 'CRITICO'
            : quantity / cmd < 10
              ? 'ATENCAO'
              : 'NORMAL',
    updated_at: '2026-10-13T17:32:00Z',
    medicamentos: {
      id: 'med-' + i,
      codigo: code,
      nome: name,
      apresentacao: presentation,
      grupo: group,
      ativo: true,
      principio_ativo: name,
      concentracao: '',
      unidade_concentracao: '',
      forma_farmaceutica: '',
      volume: '',
      unidade_volume: '',
    } satisfies Medication,
  }),
);
export const demoPending: ImportItem[] = [
  ['SALBUTAMOL', '100 mg', 'UNIDADE_DIVERGENTE'],
  ['ONDANSETRONA', '2 mg/mL 4 mL', 'VOLUME_DIVERGENTE'],
  ['ÁGUA DESTILADA', '250 mL', 'APRESENTACAO_DIVERGENTE'],
].map(([name, presentation, reason], i) => ({
  id: 'pending-' + i,
  importacao_id: 'demo-import',
  numero_linha: i + 18,
  linha_original: { Produto: name, Apresentacao: presentation, Quantidade: 20 },
  codigo_importado: '',
  nome_importado: name,
  apresentacao_importada: presentation,
  quantidade_importada: 20,
  consumo_importado: null,
  medicamento_id: null,
  tipo_correspondencia: 'NAO_IDENTIFICADO',
  status: 'PENDENTE',
  motivo_pendencia: reason,
  confianca: 0,
}));
export const demoRules: Rule[] = [
  {
    id: 'r1',
    unidade_id: null,
    medicamento_id: null,
    nome: 'Crítico',
    tipo_regra: 'CRITICO',
    dias_minimos: 0,
    dias_maximos: 5,
    cor: '#ed3347',
    prioridade: 30,
    ativo: true,
  },
  {
    id: 'r2',
    unidade_id: null,
    medicamento_id: null,
    nome: 'Atenção',
    tipo_regra: 'ATENCAO',
    dias_minimos: 5,
    dias_maximos: 10,
    cor: '#f59e0b',
    prioridade: 20,
    ativo: true,
  },
  {
    id: 'r3',
    unidade_id: null,
    medicamento_id: null,
    nome: 'Normal',
    tipo_regra: 'NORMAL',
    dias_minimos: 10,
    dias_maximos: null,
    cor: '#1ba55d',
    prioridade: 10,
    ativo: true,
  },
];
export const demoImport: ImportRecord = {
  id: 'demo-import',
  nome_arquivo: 'Sistema_estoque_2026-10-13.xlsx',
  status: 'WAITING_REVIEW',
  total_linhas: 19,
  created_at: '2026-10-13T17:32:00Z',
  completed_at: null,
  usuario_id: 'demo',
  unidade_id: 'demo',
  identificados_codigo: 12,
  identificados_alias: 3,
  identificados_nome: 1,
  pendentes: 3,
  erros: 0,
  storage_path: '',
  tipo_arquivo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
export function demoData(resource: string, p: URLSearchParams): unknown {
  const page = Number(p.get('page')) || 0,
    search = (p.get('search') ?? '').toLowerCase();
  const paginate = (rows: unknown[]) => ({
    rows: rows.slice(page * 15, page * 15 + 15),
    count: rows.length,
  });
  if (resource === 'dashboard')
    return {
      stats: {
        total: demoStock.length,
        ...Object.fromEntries(
          Object.keys(situationLabels).map((s) => [
            s,
            demoStock.filter((r) => r.situacao === s).length,
          ]),
        ),
        PENDENTE: demoPending.length,
      },
      critical: demoStock
        .filter((s) => ['CRITICO', 'ATENCAO'].includes(s.situacao))
        .sort((a, b) => a.dias_cobertura! - b.dias_cobertura!)
        .slice(0, 5),
      last: { ...demoImport, status: 'COMPLETED', completed_at: demoImport.created_at },
      preview: demoImport,
      pending: demoPending,
      rules: demoRules,
      trend: [1500, 1730, 2400, 2650, 3100, 3240, 2980, 3210, 3612].map((q, i) => ({
        quantidade: q,
        created_at: new Date(Date.UTC(2026, 8, 1 + i * 5)).toISOString(),
      })),
    };
  if (resource === 'stock')
    return paginate(
      demoStock.filter(
        (s) =>
          (!search || Object.values(s.medicamentos).join(' ').toLowerCase().includes(search)) &&
          (!p.get('group') || s.medicamentos.grupo === p.get('group')) &&
          (!p.get('status') || s.situacao === p.get('status')) &&
          (p.get('critical') !== 'true' || ['CRITICO', 'ATENCAO', 'ZERADO'].includes(s.situacao)),
      ),
    );
  if (resource === 'medications')
    return paginate(
      demoStock
        .map((s) => s.medicamentos)
        .filter((m) => Object.values(m).join(' ').toLowerCase().includes(search)),
    );
  if (resource === 'pending' || resource === 'items') return paginate(demoPending);
  if (resource === 'imports')
    return paginate([
      demoImport,
      {
        ...demoImport,
        id: 'previous',
        status: 'COMPLETED',
        completed_at: '2026-10-12T17:32:00Z',
        created_at: '2026-10-12T17:32:00Z',
        pendentes: 0,
      },
    ]);
  if (resource === 'rules') return paginate(demoRules);
  if (resource === 'aliases')
    return paginate([
      {
        id: 'a1',
        medicamentos: { nome: 'ADRENALINA', apresentacao: '1 mg/mL 1 mL' },
        alias: 'EPINEFRINA 1 mg/mL 1 mL',
        alias_normalizado: 'EPINEFRINA 1MG/ML 1ML',
        medicamento_id: 'med-6',
        ativo: true,
        created_at: '2026-10-12T17:00:00Z',
      },
    ]);
  if (resource === 'detail')
    return {
      history: [40, 30, 24, 20, 12].map((q, i) => ({
        quantidade: q,
        cmd: 3.85,
        dias_cobertura: q / 3.85,
        created_at: new Date(Date.UTC(2026, 9, 1 + i * 3)).toISOString(),
      })),
      consumption: [
        { periodo_fim: '2026-10-13', quantidade_consumida: 431.2, cmd: 3.85, dias_periodo: 112 },
      ],
    };
  if (resource === 'profiles')
    return paginate([
      {
        id: 'demo',
        nome: 'Usuário demonstração',
        email: 'demonstracao@exemplo.com',
        perfil: 'ADMIN',
        ativo: true,
      },
    ]);
  return paginate([]);
}
