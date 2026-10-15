import { NextResponse } from 'next/server';
import { session, failure, assertOrigin, dbError } from '@/lib/server/api';
import { parseFile, hashFile, MAX_FILE_SIZE } from '@/lib/import/parser';
import { MedicationMatchingService } from '@/lib/domain/matching';
import type { Medication, Alias } from '@/lib/domain/types';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(req: Request) {
  let importId: string | undefined;
  let client: Awaited<ReturnType<typeof session>>['db'] | undefined;
  try {
    assertOrigin(req);
    const { db, user, profile } = await session();
    client = db;
    if (profile.perfil === 'GESTAO')
      throw new Error('Perfil de gestão possui acesso somente para consulta.');
    const length = Number(req.headers.get('content-length'));
    if (length > MAX_FILE_SIZE + 65536) throw new Error('O arquivo excede o limite de 10 MB.');
    const form = await req.formData(),
      file = form.get('file'),
      unit = String(form.get('unit') ?? '');
    if (!(file instanceof File) || !file.size || file.size > MAX_FILE_SIZE)
      throw new Error('Selecione um arquivo válido de até 10 MB.');
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mime = (
      {
        csv: 'text/csv',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls: 'application/vnd.ms-excel',
        pdf: 'application/pdf',
      } as Record<string, string>
    )[extension ?? ''];
    if (!mime) throw new Error('Arquivo incompatível.');
    const buffer = Buffer.from(await file.arrayBuffer()),
      hash = hashFile(buffer);
    const { data: duplicate, error: de } = await db
      .from('importacoes')
      .select('created_at')
      .eq('unidade_id', unit)
      .eq('file_hash', hash)
      .maybeSingle();
    dbError(de);
    if (duplicate)
      throw new Error(
        'Este arquivo já foi importado em ' +
          new Date(duplicate.created_at).toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
          }) +
          '.',
      );
    const storagePath = unit + '/' + user.id + '/' + crypto.randomUUID() + '.' + extension;
    const { data: created, error: ce } = await db.rpc('mutate', {
      action: 'create_import',
      payload: {
        unidade_id: unit,
        nome_arquivo: file.name,
        storage_path: storagePath,
        tipo_arquivo: mime,
        tamanho: file.size,
        file_hash: hash,
        data_referencia: form.get('reference'),
      },
    });
    dbError(ce);
    importId = created.id;
    const { error: ue } = await db.storage
      .from('importacoes')
      .upload(storagePath, buffer, { contentType: mime, upsert: false });
    dbError(ue);
    const { data: registered, error: re } = await db
      .from('importacoes')
      .select('dias_consumo')
      .eq('id', importId)
      .single();
    dbError(re);
    const parsed = await parseFile(buffer, file.name, registered!.dias_consumo);
    // Read catalog in bounded pages; the browser never receives the complete catalog.
    const medications: Medication[] = [];
    const aliases: Alias[] = [];
    for (let offset = 0; ; offset += 500) {
      const r = await db
        .from('medicamentos')
        .select('*')
        .eq('ativo', true)
        .order('id')
        .range(offset, offset + 499);
      dbError(r.error);
      medications.push(...(r.data as Medication[]));
      if (r.data!.length < 500) break;
    }
    for (let offset = 0; ; offset += 500) {
      const r = await db
        .from('medicamento_aliases')
        .select('*')
        .eq('unidade_id', unit)
        .eq('ativo', true)
        .order('id')
        .range(offset, offset + 499);
      dbError(r.error);
      aliases.push(...(r.data as Alias[]));
      if (r.data!.length < 500) break;
    }
    const matches = new MedicationMatchingService(medications, aliases).matchAll(
      parsed.rows,
      parsed.pdf,
    );
    const itens = parsed.rows.map((row, i) => ({
      ...matches[i],
      numero_linha: row.line,
      linha_original: row.raw,
      codigo_importado: row.code,
      nome_importado: row.name,
      apresentacao_importada: row.presentation,
      quantidade_importada: row.quantity,
      consumo_importado: row.consumption,
    }));
    const { error: se } = await db.rpc('mutate', {
      action: 'stage_import',
      payload: { importacao_id: importId, itens },
    });
    dbError(se);
    return NextResponse.json({ id: importId, rows: itens.length });
  } catch (e) {
    if (importId && client)
      await client.rpc('mutate', {
        action: 'fail_import',
        payload: {
          importacao_id: importId,
          erro: e instanceof Error ? e.message : 'Falha de processamento',
        },
      });
    return failure(e);
  }
}
