# Validação da entrega — 15/10/2026

- Next.js 16.4.0: build de produção concluído, incluindo TypeScript.
- Vitest: **68 testes aprovados**.
- Playwright: proteção de rotas/API, filtros, revisão, navegação e responsividade em 1024, 768 e 390 px.
- PostgreSQL no projeto oficial: testes transacionais aprovados, sem fixtures persistentes. Cobertura: isolamento por unidade, autorização FARMACIA/GESTAO, matching, pendências, confirmação, CMD, divisão por zero, histórico, auditoria, dupla confirmação, DE-PARA inseguro e rollback após falha tardia.
- Auditoria npm de produção: **0 vulnerabilidades**.
- Supabase Security Advisors: nenhum apontamento após restringir a função padrão `rls_auto_enable`.
- Migrations locais alinhadas às versões aplicadas no projeto `wkzpglwfrfdynzjabbos`.
- Dados demonstrativos existem somente na rota `/demo`; o banco oficial não recebeu estoque fictício.
- Chaves públicas somente em ambiente local ignorado pelo Git; nenhuma service role utilizada.

## Validação ainda necessária

O teste de login com uma conta real não foi executado. A tentativa de criar uma conta temporária somente de leitura foi bloqueada pela revisão automática de aprovação, por ser uma alteração de acesso externo sem autorização específica. Nenhuma conta de teste foi criada. O proprietário pode autorizar o teste temporário ou provisionar o primeiro administrador conforme `supabase/bootstrap-admin.sql`.

É necessário validar um arquivo real da farmácia, não fornecido nesta tarefa. PDFs digitalizados ou com estrutura ambígua são recusados por projeto. Deploy em hospedagem externa não foi realizado; as instruções estão no README.

## Administração em /adminuparm

- 76 testes unitários e 6 testes de navegador aprovados após a inclusão da administração.
- Build de produção aprovado.
- RPC de provisionamento: autorização ADMIN, rejeição de unidade inválida, perfil, vínculo e auditoria verificados em transação com rollback.
- Edge Function publicada; requisição sem autenticação retorna HTTP 401. Security Advisors sem apontamentos.
- Publicação na Vercel e primeiro acesso do administrador dependem da conexão da hospedagem. A criação completa por formulário com conta real ainda não foi exercitada.
