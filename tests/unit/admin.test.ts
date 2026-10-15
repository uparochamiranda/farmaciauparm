import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), invoke: vi.fn() }));
vi.mock('@/lib/server/api', () => ({
  session: mocks.session,
  assertOrigin: (r: Request) => {
    if (r.headers.get('origin') && r.headers.get('origin') !== new URL(r.url).origin)
      throw new Error('Origem inválida');
  },
  failure: (e: Error, status = 400) => Response.json({ error: e.message }, { status }),
}));
import { POST } from '@/app/api/admin/users/route';
const valid = {
  nome: 'Usuário Teste',
  email: 'teste@example.com',
  password: 'Senha-segura-123',
  perfil: 'GESTAO',
  unidade_id: 'b0000000-0000-4000-8000-000000000001',
};
const request = (body: unknown, origin = 'http://localhost') =>
  new Request('http://localhost/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({
    profile: { perfil: 'ADMIN' },
    db: { functions: { invoke: mocks.invoke } },
  });
  mocks.invoke.mockResolvedValue({ data: { id: 'new-id' }, error: null });
});
describe('criação administrativa de usuários', () => {
  it('nega perfil de farmácia antes de executar função privilegiada', async () => {
    mocks.session.mockResolvedValue({ profile: { perfil: 'FARMACIA' } });
    expect((await POST(request(valid))).status).toBe(403);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('nega requisição de outro site', async () => {
    expect((await POST(request(valid, 'https://outro.example'))).status).toBe(400);
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it.each([
    { ...valid, password: 'curta' },
    { ...valid, perfil: 'OWNER' },
    { ...valid, unidade_id: 'invalida' },
    { ...valid, email: 'sem-email' },
  ])('rejeita campos inválidos', async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('encaminha campos validados e não retorna senha', async () => {
    const r = await POST(request({ ...valid, service_role: 'injected' }));
    expect(r.status).toBe(201);
    expect(mocks.invoke).toHaveBeenCalledWith('admin-create-user', { body: valid });
    expect(await r.json()).toEqual({ id: 'new-id' });
  });
  it('não apresenta sucesso se a função falhar', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { context: Response.json({ error: 'E-mail já cadastrado.' }, { status: 400 }) },
    });
    const r = await POST(request(valid));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'E-mail já cadastrado.' });
  });
});
