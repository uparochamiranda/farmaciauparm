import { describe, it, expect } from 'vitest';
import { hashFile, parseFile, parseMatrix, parseQuantity } from '@/lib/import/parser';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
describe('parser e integridade do arquivo', () => {
  it('usa SHA-256 conhecido', () =>
    expect(hashFile(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    ));
  it('hash detecta igualdade e diferença', () => {
    expect(hashFile(Buffer.from('a'))).toBe(hashFile(Buffer.from('a')));
    expect(hashFile(Buffer.from('a'))).not.toBe(hashFile(Buffer.from('b')));
  });
  it.each([
    ['1.234,5', 1234.5],
    ['0', 0],
    ['-1', null],
    ['', null],
    ['texto', null],
    ['NaN', null],
    ['1.2', null],
    [1.25, 1.25],
  ])('converte quantidade %s sem adivinhar', (v, result) => expect(parseQuantity(v)).toBe(result));
  it('detecta colunas em ordem variável', () =>
    expect(
      parseMatrix([
        ['Quantidade', 'Produto', 'Código'],
        ['12', 'FUROSEMIDA', '001'],
      ])[0],
    ).toMatchObject({ quantity: 12, name: 'FUROSEMIDA', code: '001' }));
  it('bloqueia ausência de Quantidade', () =>
    expect(() =>
      parseMatrix([
        ['Produto', 'Código'],
        ['A', '001'],
      ]),
    ).toThrow('Quantidade'));
  it('bloqueia duas colunas equivalentes de quantidade', () =>
    expect(() =>
      parseMatrix([
        ['Produto', 'Qtd', 'Estoque'],
        ['A', 1, 2],
      ]),
    ).toThrow('ambíguos'));
  it('lê CSV com acentos e zeros à esquerda', async () =>
    expect(
      (
        await parseFile(
          Buffer.from('Código;Produto;Quantidade\n001;ÁGUA DESTILADA 5ML;10'),
          'estoque.csv',
        )
      ).rows[0].code,
    ).toBe('001'));
  it.each(['xlsx', 'xls'])('lê planilha %s real', async (ext) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Produto', 'Quantidade'],
        ['A', 12],
      ]),
      'Estoque',
    );
    const b = XLSX.write(wb, { type: 'buffer', bookType: ext === 'xls' ? 'biff8' : 'xlsx' });
    expect((await parseFile(b, 'test.' + ext)).rows[0].quantity).toBe(12);
  });
  it('bloqueia planilhas múltiplas', async () => {
    const wb = XLSX.utils.book_new();
    for (const n of ['A', 'B'])
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['Produto', 'Quantidade'],
          ['A', 12],
        ]),
        n,
      );
    await expect(
      parseFile(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), 'test.xlsx'),
    ).rejects.toThrow('única planilha');
  });
  it('rejeita extensão incompatível', async () =>
    await expect(parseFile(Buffer.from('abc'), 'test.exe')).rejects.toThrow('incompatível'));
  it('rejeita arquivo acima do limite', async () =>
    await expect(parseFile(Buffer.alloc(10 * 1024 * 1024 + 1), 'test.csv')).rejects.toThrow(
      '10 MB',
    ));
  it('PDF tabular exige revisão', async () => {
    const pdf = new jsPDF();
    pdf.text('Produto;Quantidade', 10, 20);
    pdf.text('AZITROMICINA 500MG;12', 10, 30);
    const parsed = await parseFile(Buffer.from(pdf.output('arraybuffer')), 'test.pdf');
    expect(parsed.pdf).toBe(true);
    expect(parsed.rows[0].quantity).toBe(12);
  }, 15000);
  it('PDF sem cabeçalho seguro é bloqueado', async () => {
    const pdf = new jsPDF();
    pdf.text('Relatorio sem tabela', 10, 20);
    await expect(parseFile(Buffer.from(pdf.output('arraybuffer')), 'test.pdf')).rejects.toThrow(
      'Produto',
    );
  });
});

describe('regressões de integridade da importação', () => {
  it('preserva números das linhas após linhas vazias', () => {
    const rows = parseMatrix([['Produto', 'Quantidade'], ['A', 1], [], ['B', 2]]);
    expect(rows.map((r) => r.line)).toEqual([2, 4]);
  });
  it('bloqueia período explícito diferente da configuração', () => {
    expect(() =>
      parseMatrix(
        [
          ['Produto', 'Quantidade', 'Consumo 112 dias'],
          ['A', 10, 224],
        ],
        30,
      ),
    ).toThrow('período');
  });
  it('aceita período explícito correspondente', () => {
    expect(
      parseMatrix(
        [
          ['Produto', 'Quantidade', 'Consumo 30 dias'],
          ['A', 10, 60],
        ],
        30,
      )[0].consumption,
    ).toBe(60);
  });
  it('marca consumo não numérico como erro revisável', () => {
    expect(
      parseMatrix([
        ['Produto', 'Quantidade', 'Consumo'],
        ['A', 10, 'inválido'],
      ])[0].error,
    ).toBe('CONSUMO_INVALIDO');
  });
  it('não substitui consumo zero por ausência de dado', () => {
    expect(
      parseMatrix([
        ['Produto', 'Quantidade', 'Consumo'],
        ['A', 10, 0],
      ])[0],
    ).toMatchObject({ consumption: 0, error: undefined });
  });
  it('recusa fórmulas mesmo com resultado numérico em cache', async () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Produto', 'Quantidade'],
      ['A', 10],
    ]);
    sheet.B2 = { t: 'n', v: 10, f: '5+5' };
    XLSX.utils.book_append_sheet(wb, sheet, 'Estoque');
    await expect(
      parseFile(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), 'test.xlsx'),
    ).rejects.toThrow('fórmulas');
  });
  it('não trunca planilhas com dados além do limite', async () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Produto', 'Quantidade'],
      ['A', 10],
    ]);
    XLSX.utils.sheet_add_aoa(sheet, [['B', 20]], { origin: 'A15000' });
    XLSX.utils.book_append_sheet(wb, sheet, 'Estoque');
    await expect(
      parseFile(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), 'test.xlsx'),
    ).rejects.toThrow('10.000');
  });
});
