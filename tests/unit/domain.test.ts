import { describe, it, expect } from 'vitest';
import { calculateCMD, calculateCoverage, classifyStock } from '@/lib/domain/stock';
import { normalizeMedicationName, MedicationMatchingService } from '@/lib/domain/matching';
import { demoRules } from '@/lib/demo';
import type { Medication, ImportRow, Alias } from '@/lib/domain/types';
const med: Medication = {
  id: 'a',
  codigo: '001',
  nome: 'ONDANSETRONA',
  apresentacao: '2 mg/mL 2 mL',
  principio_ativo: 'ONDANSETRONA',
  concentracao: '2',
  unidade_concentracao: 'mg/mL',
  volume: '2',
  unidade_volume: 'mL',
  forma_farmaceutica: '',
  grupo: 'Antiemético',
  ativo: true,
};
const row = (overrides: Partial<ImportRow> = {}): ImportRow => ({
  line: 2,
  code: '001',
  name: 'ONDANSETRONA',
  presentation: '2 mg/mL 2 mL',
  quantity: 8,
  consumption: null,
  raw: {},
  ...overrides,
});
describe('normalização conservadora', () => {
  it('remove acentos e espaços sem alterar unidades', () =>
    expect(normalizeMedicationName('  Ázitromicina  500 MG ')).toBe('AZITROMICINA 500MG'));
  it('preserva decimais', () => expect(normalizeMedicationName('0,9 %')).toBe('0.9%'));
  it.each([
    ['100MG', '100MCG'],
    ['2ML', '4ML'],
    ['1L', '1ML'],
    ['AMPOLA', 'FRASCO'],
  ])('não equipara %s a %s', (a, b) =>
    expect(normalizeMedicationName(a)).not.toBe(normalizeMedicationName(b)),
  );
});
describe('correspondência de medicamentos', () => {
  const service = new MedicationMatchingService([med], []);
  it('usa código exato quando a apresentação é segura', () =>
    expect(service.match(row())).toMatchObject({
      status: 'OK',
      tipo_correspondencia: 'CODIGO',
      medicamento_id: 'a',
    }));
  it('não deixa código ocultar volume divergente', () =>
    expect(service.match(row({ presentation: '2 mg/mL 4 mL' }))).toMatchObject({
      status: 'PENDENTE',
      medicamento_id: null,
      motivo_pendencia: 'VOLUME_DIVERGENTE',
    }));
  it('bloqueia concentração divergente', () =>
    expect(service.match(row({ presentation: '4 mg/mL 2 mL' })).status).toBe('PENDENTE'));
  it('bloqueia MG versus MCG', () =>
    expect(service.match(row({ presentation: '2 mcg/mL 2 mL' })).motivo_pendencia).toBe(
      'UNIDADE_DIVERGENTE',
    ));
  it('bloqueia forma divergente', () =>
    expect(service.match(row({ presentation: '2 mg/mL 2 mL frasco' })).motivo_pendencia).toBe(
      'APRESENTACAO_DIVERGENTE',
    ));
  it('não associa ingrediente diferente pelo código', () =>
    expect(service.match(row({ name: 'DIPIRONA' })).status).toBe('PENDENTE'));
  it('usa nome normalizado se não há código', () =>
    expect(service.match(row({ code: '', presentation: '2MG/ML 2ML' })).tipo_correspondencia).toBe(
      'NOME_NORMALIZADO',
    ));
  it('não identifica por nome sem apresentação', () =>
    expect(service.match(row({ code: '', presentation: '' })).status).toBe('PENDENTE'));
  it('exige revisão mesmo para PDF idêntico', () =>
    expect(service.match(row(), true)).toMatchObject({
      status: 'PENDENTE',
      motivo_pendencia: 'VALIDACAO_PDF',
    }));
  it('bloqueia quantidade inválida', () =>
    expect(service.match(row({ quantity: null })).status).toBe('ERRO'));
  it('permite zero explícito', () => expect(service.match(row({ quantity: 0 })).status).toBe('OK'));
  it('detecta códigos duplicados no arquivo', () =>
    expect(
      service
        .matchAll([row(), row({ line: 3 })])
        .every((m) => m.status === 'PENDENTE' && m.motivo_pendencia === 'DUPLICIDADE'),
    ).toBe(true));
  it('não resolve correspondências múltiplas por nome', () =>
    expect(
      new MedicationMatchingService([med, { ...med, id: 'b', codigo: '002' }], []).match(
        row({ code: '' }),
      ).motivo_pendencia,
    ).toBe('DUPLICIDADE'));
  it('utiliza alias validado sem diferenças clínicas', () => {
    const alias: Alias = {
      id: 'x',
      alias: 'VONAU 2MG/ML 2ML',
      alias_normalizado: 'VONAU 2MG/ML 2ML',
      medicamento_id: 'a',
      ativo: true,
    };
    expect(
      new MedicationMatchingService([med], [alias]).match(row({ code: '', name: 'VONAU' })),
    ).toMatchObject({ status: 'OK', tipo_correspondencia: 'ALIAS' });
  });
  it('alias não contorna volume divergente', () => {
    const alias: Alias = {
      id: 'x',
      alias: 'VONAU 2MG/ML 4ML',
      alias_normalizado: 'VONAU 2MG/ML 4ML',
      medicamento_id: 'a',
      ativo: true,
    };
    expect(
      new MedicationMatchingService([med], [alias]).match(
        row({ code: '', name: 'VONAU', presentation: '2mg/ml 4ml' }),
      ).status,
    ).toBe('PENDENTE');
  });
});
describe('CMD, cobertura e criticidade', () => {
  it('divide consumo por 112 dias', () => expect(calculateCMD(581.28)).toBeCloseTo(5.19));
  it('aceita período configurado', () => expect(calculateCMD(60, 30)).toBe(2));
  it('calcula cobertura sem arredondar classificação', () =>
    expect(calculateCoverage(590, 5.19)).toBeCloseTo(113.68015));
  it('consumo zero gera cobertura null', () =>
    expect(calculateCoverage(100, calculateCMD(0))).toBeNull());
  it.each([0, -1, 1.5, NaN])('rejeita período inválido %s', (days) =>
    expect(() => calculateCMD(50, days)).toThrow(),
  );
  it.each([-1, NaN, Infinity])('rejeita consumo inválido %s', (cons) =>
    expect(() => calculateCMD(cons)).toThrow(),
  );
  it.each([
    [0, 0, 'ZERADO'],
    [1, 0, 'SEM_CONSUMO'],
    [4.99, 1, 'CRITICO'],
    [5, 1, 'ATENCAO'],
    [9.99, 1, 'ATENCAO'],
    [10, 1, 'NORMAL'],
  ])('classifica saldo %s / CMD %s como %s', (q, c, s) =>
    expect(classifyStock(Number(q), Number(c), demoRules)).toBe(s),
  );
  it('aplica regras específicas como conjunto', () => {
    const specific = demoRules.map((r) => ({
      ...r,
      id: r.id + 'u',
      unidade_id: 'u',
      dias_minimos: r.tipo_regra === 'CRITICO' ? 0 : r.tipo_regra === 'ATENCAO' ? 3 : 7,
      dias_maximos: r.tipo_regra === 'CRITICO' ? 3 : r.tipo_regra === 'ATENCAO' ? 7 : null,
    }));
    expect(classifyStock(4, 1, [...demoRules, ...specific], 'u')).toBe('ATENCAO');
  });
});

it('consumo inválido impede correspondência automática mesmo com código exato', () => {
  const result = new MedicationMatchingService([med], []).match(row({ error: 'CONSUMO_INVALIDO' }));
  expect(result).toMatchObject({ status: 'ERRO', motivo_pendencia: 'CONSUMO_INVALIDO' });
});
