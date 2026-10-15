import { NextRequest, NextResponse } from 'next/server';
import { session, failure, dbError } from '@/lib/server/api';
export async function GET(req: NextRequest) {
  try {
    const { db, profile } = await session(),
      p = req.nextUrl.searchParams;
    const resource = p.get('resource') ?? 'dashboard',
      unit = p.get('unit') ?? '';
    const page = Math.max(0, Math.min(100000, Number(p.get('page')) || 0)),
      size = 15,
      start = page * size;
    const search = (p.get('search') ?? '').replace(/[^\p{L}\p{N}\s+./-]/gu, '').slice(0, 100);
    if (resource === 'dashboard') {
      const days = Math.min(365, Math.max(7, Number(p.get('days')) || 45));
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const results = await Promise.all([
        db.rpc('dashboard_stats', { unit_id: unit }),
        db
          .from('estoque_atual')
          .select('*,medicamentos(*)')
          .eq('unidade_id', unit)
          .in('situacao', ['CRITICO', 'ATENCAO', 'ZERADO'])
          .order('dias_cobertura', { ascending: true, nullsFirst: false })
          .limit(5),
        db
          .from('importacoes')
          .select('*')
          .eq('unidade_id', unit)
          .eq('status', 'COMPLETED')
          .order('completed_at', { ascending: false })
          .limit(1),
        db
          .from('estoque_totais_historico')
          .select('quantidade,created_at')
          .eq('unidade_id', unit)
          .gte('created_at', since)
          .order('created_at')
          .limit(500),
        db
          .from('importacao_itens')
          .select('*,importacoes!inner(unidade_id,status)')
          .eq('importacoes.unidade_id', unit)
          .eq('importacoes.status', 'WAITING_REVIEW')
          .in('status', ['PENDENTE', 'ERRO'])
          .order('created_at', { ascending: false })
          .limit(5),
        db
          .from('regras_criticos')
          .select('*')
          .or('unidade_id.is.null,unidade_id.eq.' + unit)
          .eq('ativo', true),
        db
          .from('importacoes')
          .select('*')
          .eq('unidade_id', unit)
          .eq('status', 'WAITING_REVIEW')
          .order('created_at', { ascending: false })
          .limit(1),
      ]);
      results.forEach((r) => dbError(r.error));
      return NextResponse.json({
        stats: results[0].data,
        critical: results[1].data,
        last: results[2].data?.[0] ?? null,
        trend: results[3].data,
        pending: results[4].data,
        rules: results[5].data,
        preview: results[6].data?.[0] ?? null,
      });
    }
    if (resource === 'stock') {
      let q = db
        .from('estoque_atual')
        .select('*,medicamentos!inner(*)', { count: 'exact' })
        .eq('unidade_id', unit);
      if (search)
        q = q.or(
          'nome.ilike.%' +
            search +
            '%,codigo.ilike.%' +
            search +
            '%,principio_ativo.ilike.%' +
            search +
            '%,apresentacao.ilike.%' +
            search +
            '%',
          { referencedTable: 'medicamentos' },
        );
      if (p.get('status')) q = q.eq('situacao', p.get('status'));
      if (p.get('group')) q = q.eq('medicamentos.grupo', p.get('group'));
      if (p.get('critical') === 'true') q = q.in('situacao', ['CRITICO', 'ZERADO', 'ATENCAO']);
      const r = await q
        .order('nome', { referencedTable: 'medicamentos' })
        .order('id')
        .range(start, start + size - 1);
      dbError(r.error);
      return NextResponse.json({ rows: r.data, count: r.count });
    }
    if (resource === 'detail') {
      const id = p.get('id') ?? '';
      const results = await Promise.all([
        db
          .from('estoque_historico')
          .select('*')
          .eq('unidade_id', unit)
          .eq('medicamento_id', id)
          .order('created_at', { ascending: false })
          .limit(60),
        db
          .from('consumo_historico')
          .select('*')
          .eq('unidade_id', unit)
          .eq('medicamento_id', id)
          .order('periodo_fim', { ascending: false })
          .limit(24),
      ]);
      results.forEach((r) => dbError(r.error));
      return NextResponse.json({ history: results[0].data, consumption: results[1].data });
    }
    if (resource === 'download') {
      const { data, error } = await db
        .from('importacoes')
        .select('storage_path')
        .eq('id', p.get('id'))
        .single();
      dbError(error);
      const result = await db.storage.from('importacoes').createSignedUrl(data!.storage_path, 60);
      dbError(result.error);
      return NextResponse.json({ url: result.data?.signedUrl });
    }
    if (resource === 'items') {
      const r = await db
        .from('importacao_itens')
        .select('*', { count: 'exact' })
        .eq('importacao_id', p.get('id'))
        .order('numero_linha')
        .range(start, start + size - 1);
      dbError(r.error);
      return NextResponse.json({ rows: r.data, count: r.count });
    }
    if (resource === 'pending') {
      const r = await db
        .from('importacao_itens')
        .select('*,importacoes!inner(unidade_id,status)', { count: 'exact' })
        .eq('importacoes.unidade_id', unit)
        .eq('importacoes.status', 'WAITING_REVIEW')
        .in('status', ['PENDENTE', 'ERRO'])
        .order('created_at', { ascending: false })
        .range(start, start + size - 1);
      dbError(r.error);
      return NextResponse.json({ rows: r.data, count: r.count });
    }
    if (resource === 'medications') {
      let q = db.from('medicamentos').select('*', { count: 'exact' });
      if (search)
        q = q.or(
          'nome.ilike.%' +
            search +
            '%,codigo.ilike.%' +
            search +
            '%,apresentacao.ilike.%' +
            search +
            '%',
        );
      const r = await q.order('nome').range(start, start + size - 1);
      dbError(r.error);
      return NextResponse.json({ rows: r.data, count: r.count });
    }
    const table = (
      {
        imports: 'importacoes',
        aliases: 'medicamento_aliases',
        rules: 'regras_criticos',
        audit: 'audit_logs',
        profiles: 'profiles',
        memberships: 'usuario_unidades',
        consumption: 'consumo_historico',
        history: 'estoque_historico',
      } as Record<string, string>
    )[resource];
    if (!table) return failure(new Error('Consulta inválida.'));
    let q = db
      .from(table)
      .select(
        resource === 'aliases'
          ? '*,medicamentos(nome,apresentacao)'
          : resource === 'audit'
            ? '*,profiles:user_id(nome)'
            : '*',
        { count: 'exact' },
      );
    if (!['profiles', 'rules', 'audit'].includes(resource)) q = q.eq('unidade_id', unit);
    if (resource === 'audit')
      q =
        profile.perfil === 'ADMIN'
          ? q.or('unidade_id.is.null,unidade_id.eq.' + unit)
          : q.eq('unidade_id', unit);
    if (resource === 'rules') q = q.or('unidade_id.is.null,unidade_id.eq.' + unit);
    const r = await q.order('created_at', { ascending: false }).range(start, start + size - 1);
    dbError(r.error);
    return NextResponse.json({ rows: r.data, count: r.count });
  } catch (e) {
    return failure(e);
  }
}
