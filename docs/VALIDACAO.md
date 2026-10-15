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

O login real do primeiro administrador foi validado na URL pública em 15/10/2026, incluindo dashboard, página administrativa, lista de usuários e validação da API. Nenhuma conta temporária de teste foi criada.

É necessário validar um arquivo real da farmácia, não fornecido nesta tarefa. PDFs digitalizados ou com estrutura ambígua são recusados por projeto. Sistema publicado em https://farmaciauparm.vercel.app na Vercel.

## Administração em /adminuparm

- 76 testes unitários e 6 testes de navegador aprovados após a inclusão da administração.
- Build de produção aprovado.
- RPC de provisionamento: autorização ADMIN, rejeição de unidade inválida, perfil, vínculo e auditoria verificados em transação com rollback.
- Edge Function publicada; requisição sem autenticação retorna HTTP 401. Security Advisors sem apontamentos.
- Publicação na Vercel e primeiro acesso do administrador concluídos e verificados. A criação completa de outra conta por formulário ainda não foi exercitada.
- Bootstrap inicial encerrado: função temporária substituída por resposta HTTP 410; nenhuma senha ou chave privada foi adicionada ao Git.
