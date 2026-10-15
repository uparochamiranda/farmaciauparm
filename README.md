# Farmácia UPA RM

Sistema de controle de estoque e abastecimento da UPA Rocha Miranda. Interface em português, baseada no protótipo fornecido: cabeçalho azul, sidebar escura, indicadores, importação, criticidade, gráficos e estoque.

**Repositório oficial:** https://github.com/uparochamiranda/farmaciauparm  
**Backend exclusivo:** https://wkzpglwfrfdynzjabbos.supabase.co  
**Project ref:** `wkzpglwfrfdynzjabbos`

## Arquitetura

Next.js 16 (App Router), React, TypeScript e Tailwind CSS. Componentes shadcn/ui sobre Radix, Lucide e Recharts. Supabase Auth com cookies SSR, PostgreSQL, RLS e bucket privado. SheetJS lê XLSX/XLS e escreve XLSX; PapaParse lê CSV; PDF.js extrai PDF; jsPDF gera relatórios.

O navegador acessa as rotas autenticadas do Next.js. Cada requisição usa a sessão do usuário e a chave pública do Supabase. Não há service role no caminho normal da aplicação. O PostgreSQL controla autorização, estado da importação, transações e auditoria. Operações privilegiadas ficam em funções no schema não exposto `private`, com verificação de usuário, perfil e unidade. RPCs públicas são SECURITY INVOKER.

```text
src/app/                 páginas, proteção de sessão e rotas HTTP
src/app/api/data/        consultas paginadas, indicadores e download assinado
src/app/api/import/      upload, hash, parser, matching e prévia
src/app/api/mutate/      revisão, confirmação e administração
src/app/api/export/      relatórios Excel e PDF
src/components/         dashboard e telas de operação
src/components/ui/      componentes Radix/shadcn
src/lib/domain/         normalização, matching, CMD e criticidade
src/lib/import/         parsers independentes da interface
src/lib/supabase/       clientes SSR e browser
src/lib/demo.ts         dados fictícios, exclusivamente para /demo
supabase/migrations/    schema, RLS, RPCs e correções versionadas
supabase/tests/         testes SQL transacionais, sempre com rollback
tests/unit/             testes Vitest
tests/e2e/              testes Playwright
scripts/                execução dos testes do banco
```

## Instalação

Requer Node.js 22.13+ (recomendado Node 24), npm e acesso ao Supabase.

```bash
git clone https://github.com/uparochamiranda/farmaciauparm.git
cd farmaciauparm
npm install
cp .env.example .env.local
npm run dev
```

No PowerShell, use `Copy-Item .env.example .env.local`.

Abra http://localhost:3000 para o sistema ou http://localhost:3000/demo para visualizar dados fictícios. A demonstração é pública e não grava dados. Ela não serve como autenticação alternativa. A aplicação oficial inicia sem medicamentos ou saldos inventados.

## Variáveis e chaves

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://wkzpglwfrfdynzjabbos.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=wkzpglwfrfdynzjabbos
```

Copie a chave **publishable** do painel Supabase para `NEXT_PUBLIC_SUPABASE_ANON_KEY`. O nome foi mantido conforme a especificação; chaves publishable e a chave anon legada são aceitas pelo SDK. URL e chave pública ficam no bundle do navegador, como previsto pelo Supabase; RLS faz a autorização.

`SUPABASE_SERVICE_ROLE_KEY` é opcional e **não é usada pela aplicação**. Nunca a configure como NEXT_PUBLIC, nunca a envie ao cliente e nunca a registre em logs. `.env`, `.env.local`, `.env.*.local`, resultados de teste e ferramentas temporárias estão no gitignore.

Para repetir testes SQL com conexão administrativa, forneça `DATABASE_URL` apenas no ambiente seguro ou em `.env.local`.

## Banco e migrations

Tabelas:

- `unidades`, `profiles`, `usuario_unidades`: unidades, perfis e vínculos;
- `medicamentos`, `medicamento_aliases`: cadastro global e DE-PARA por unidade;
- `importacoes`, `importacao_itens`: original, hash, estado, linhas e revisões;
- `estoque_atual`, `estoque_historico`, `estoque_totais_historico`: saldos e evolução;
- `consumo_historico`, `regras_criticos`: consumo e limites;
- `audit_logs`: trilha de alterações.

As migrations criam a unidade **UPA Rocha Miranda / UPA RM**, regras globais iniciais e o bucket privado **importacoes**. O seed não insere medicamentos fictícios.

As migrations desta entrega já foram aplicadas no projeto indicado. Em outros ambientes de desenvolvimento, a CLI reproduz o schema. Antes de usar uma versão diferente da CLI, confira `npx supabase --help`.

```bash
npx supabase login
npx supabase link --project-ref wkzpglwfrfdynzjabbos
npx supabase migration list
npx supabase db push
```

Revise o destino antes do push. Não execute `db reset` no projeto oficial. Para testes locais isolados com Docker, `npx supabase start` e `npx supabase db reset` recriam o ambiente local; esse banco é somente de desenvolvimento, nunca a fonte oficial de estoque.

## Primeiro administrador

1. Abra Authentication → Users no projeto Supabase e crie o usuário real com e-mail e senha definidos pelo responsável.
2. Abra `supabase/bootstrap-admin.sql`, substitua `SEU_EMAIL_AQUI` e execute no SQL Editor.
3. Entre na aplicação com esse usuário.
4. Em Configurações → Usuários e permissões, cadastre os demais perfis usando o ID de contas já criadas no Supabase Auth e vincule suas unidades.

Não há usuário, senha ou administrador padrão no código. O bootstrap é uma operação explícita do proprietário do projeto.

## Permissões e RLS

Todas as 13 tabelas do domínio têm RLS. Nenhuma tabela concede mutação direta ao cliente autenticado.

| Perfil   | Permissão                                                                     |
| -------- | ----------------------------------------------------------------------------- |
| ADMIN    | Todas as unidades, configurações, usuários, regras e ajustes manuais          |
| FARMACIA | Consultas, importação, revisão, novos medicamentos e DE-PARA em suas unidades |
| GESTAO   | Consultas, dashboard e relatórios das unidades autorizadas                    |

A alteração de medicamentos globais existentes é restrita ao ADMIN para não modificar o cadastro de outras unidades. FARMACIA pode criar novos medicamentos. Autorizações vêm das tabelas protegidas, nunca de user_metadata editável.

Arquivos ficam em `unidade_id/auth_user_id/uuid.ext`. Upload exige permissão de escrita na unidade; leitura exige acesso à unidade. Downloads usam URLs assinadas por 60 segundos. Não há política de substituição ou exclusão dos originais.

A auditoria registra criação e alteração de medicamentos, aliases, regras, usuários, vínculos, importações, revisões, consumo e estoque, incluindo antes/depois e user agent. IP é campo reservado e não é inferido de cabeçalhos não confiáveis. Histórico e auditoria não são excluídos automaticamente.

## Importação

1. Escolha a unidade e a **data de referência**.
2. Envie XLSX, XLS, CSV ou PDF de até 10 MB e 10.000 linhas.
3. O servidor calcula SHA-256 e registra o arquivo original no Storage.
4. O parser detecta os cabeçalhos, valida e prepara as linhas.
5. O matching sugere correspondências e o banco revalida as associações automáticas.
6. Revise pendências; associe com justificativa, corrija quantidade/consumo, cadastre novos medicamentos ou ignore explicitamente.
7. Confirme a importação. Somente a RPC pode atualizar estoque.

**Selecionar ou enviar um arquivo nunca modifica estoque.** Pendências e erros bloqueiam a confirmação. Uma importação sem linhas válidas também é bloqueada.

Estados: UPLOADED → PROCESSING → WAITING_REVIEW → CONFIRMED → COMPLETED; FAILED e CANCELLED preservam rastreabilidade. CONFIRMED e atualização de estoque ocorrem na mesma transação.

### Formato de planilha/CSV

Exemplo em `public/modelo-importacao.csv` (valores fictícios; somente modelo).

| Coluna       | Obrigatória | Observação                                          |
| ------------ | ----------- | --------------------------------------------------- |
| Produto      | Sim         | Também reconhece Medicamento, Nome e Descrição      |
| Quantidade   | Sim         | Também Qtd, Qtde, Estoque, Saldo e Saldo Atual      |
| Código       | Não         | Preserve como texto para manter zeros à esquerda    |
| Apresentação | Recomendada | Pode estar no campo Produto; precisa ser inequívoca |
| Consumo      | Não         | Total consumido no período configurado da unidade   |

Aceita quantidades textuais no padrão brasileiro, como `1.234,5`; células numéricas de Excel mantêm precisão decimal. Quantidade ausente, negativa ou ambígua gera erro. Colunas duplicadas/ambíguas são bloqueadas. Havendo a coluna Consumo, valores inválidos exigem correção humana. Sem informação de consumo, não se inventa uma taxa.

Use **uma única planilha**. Planilhas com fórmulas são rejeitadas: exporte os valores. Linhas excedentes nunca são truncadas silenciosamente.

PDF suporta documentos textuais com cabeçalhos e separadores de tabela reconhecíveis. PDFs digitalizados, desalinhados ou ambíguos são bloqueados. **Todas as linhas de PDF exigem revisão humana**, inclusive correspondências exatas. OCR não está incluído.

### Correspondência e DE-PARA

Ordem: código exato → alias confirmado → nome normalizado seguro → sugestão manual → não identificado.

A normalização remove acentos, padroniza caixa, espaços e separadores sem converter unidades clínicas. Código e alias não autorizam ignorar diferenças de ingrediente, concentração, dose, volume ou forma. Exemplos bloqueados:

- ONDANSETRONA 2 mg/mL **2 mL** versus **4 mL**;
- SALBUTAMOL **100 mcg/dose** versus **100 mg**;
- ampola versus frasco.

O matching é deliberadamente conservador: texto incompleto ou ordem não reconhecida pode exigir validação. Não há matching por similaridade com autoridade para atualizar estoque. Confiança é 100% para correspondência exata segura e 0% quando a revisão é necessária, sem percentuais de similaridade artificiais.

O DE-PARA é por unidade e só salva equivalências com assinatura clínica compatível. Uma associação manual com justificativa não cria automaticamente um alias. Alterações no cadastro são reavaliadas em importações futuras.

### Confirmação, concorrência e rollback

`confirm_import(import_id)` verifica usuário/unidade e bloqueia a importação com FOR UPDATE. Um lock por unidade serializa confirmações e ajustes. A função exige WAITING_REVIEW, ausência de pendências/erros, medicamentos ativos, ausência de repetição do mesmo medicamento e data não anterior ao saldo existente. Depois registra CONFIRMED, atualiza saldos, consumo, histórico individual, total da unidade e auditoria, e conclui COMPLETED.

Qualquer falha reverte toda a transação, inclusive o estado da importação. Dupla confirmação é recusada. Hash é único por unidade, incluindo arquivos cancelados/falhos; corrija o arquivo de origem para reenviar. Produtos ausentes no arquivo mantêm o saldo, nunca são zerados implicitamente.

## CMD e criticidade

CMD = consumo informado para o período / dias do período. Inicial: **112 dias**, configurável por unidade. O arquivo representa o consumo da janela que termina na data de referência. O saldo não é usado para inventar consumo.

O registro é mantido por medicamento, unidade, fim do período e número de dias. Uma importação sem consumo usa apenas o consumo registrado para a mesma janela; não reutiliza uma taxa antiga de outra data. CMD zero produz cobertura NULL.

Cobertura = quantidade / CMD quando CMD > 0. Os cálculos não arredondam antes da classificação.

- ZERADO: quantidade = 0, inclusive quando CMD também é zero;
- SEM CONSUMO: quantidade > 0 e CMD = 0;
- CRÍTICO: cobertura < 5 dias, inicialmente;
- ATENÇÃO: 5 ≤ cobertura < 10 dias;
- NORMAL: cobertura ≥ 10 dias.

Configurações permite alterar os limites por unidade ou medicamento. Um conjunto específico substitui o conjunto global. Os saldos são reclassificados após mudança das regras. A alteração do período de consumo vale para próximas importações; o histórico mantém sua janela original.

Pendências são **linhas de importação**, apresentadas separadamente dos produtos do estoque: não devem ser somadas ao estoque já validado.

## Telas e relatórios

Dashboard, importação, estoque com paginação no servidor, críticos, relatórios, DE-PARA, histórico, cadastros e configurações. A busca cobre nome, código, princípio ativo e apresentação. Gráficos de estoque total, distribuição e histórico individual; este também mostra cobertura e consumo por período.

Relatórios XLSX/PDF: estoque, críticos, pendências, consumo, histórico, cobertura e consolidado das unidades autorizadas. Exportações percorrem páginas no servidor e limitam a 20.000 registros; a tabela não precisa carregar todos os dados no navegador. O consolidado respeita RLS.

Multiunidade está presente em saldos, consumo, aliases, regras, imports, arquivos e relatórios. O modelo permite futuras sugestões de remanejamento; não há transferência automática.

## Testes e qualidade

```bash
npm run test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
npm run db:test
```

`db:test` requer DATABASE_URL administrativa e roda transações com rollback, sem deixar fixtures. O teste verifica RLS entre unidades, perfis, matching clínico, pendências, confirmação, CMD, zero, histórico, auditoria, dupla confirmação, alias inseguro e rollback tardio.

Os testes Playwright cobrem proteção de rotas/API, filtros, revisão, navegação e responsividade. A autenticação real depende de uma conta autorizada já provisionada; nenhum teste cria silenciosamente uma conta na produção.

O workflow GitHub Actions executa testes, lint, build e Playwright. O teste de banco remoto é deliberadamente separado para não expor credenciais administrativas ao CI.

## Administração de usuários

Acesse `/adminuparm` após entrar com um perfil ADMIN ativo. A página cria a conta Auth, o perfil e o vínculo com a unidade. Senhas iniciais têm no mínimo 12 caracteres; repasse-as por um canal seguro. Perfis e vínculos continuam editáveis em Configurações.

O endpoint Next.js `/api/admin/users` valida sessão, papel e origem, e chama a Edge Function `admin-create-user` com o token do administrador. A função verifica novamente o usuário e seu perfil no banco antes de usar a chave administrativa disponível apenas no ambiente Supabase. Não configure uma service role no frontend ou na Vercel.

A migration `provision_admin_users` salva perfil e unidade na mesma transação, com auditoria. A conta permanece bloqueada até as permissões serem salvas; falha de provisionamento cancela a criação da conta, e falha de ativação mantém o login bloqueado. Não há cadastro público ou promoção automática do primeiro visitante.

Para outro ambiente, aplique as migrations e publique `supabase/functions/admin-create-user/index.ts` mantendo verificação JWT. O primeiro administrador ainda deve ser provisionado pelo proprietário conforme o script de bootstrap.

## Deploy

Use uma hospedagem compatível com **Next.js Node.js**, como Vercel ou um servidor Node. Não faça exportação estática: login, importação e RPCs usam rotas dinâmicas.

1. Importe este repositório, branch main.
2. Configure a URL obrigatória do Supabase e a chave pública nas variáveis do ambiente.
3. Build: `npm run build`; start em Node: `npm start`.
4. Configure o domínio final e Site URL do Supabase Auth. Cadastre URLs de redirecionamento somente se adicionar recuperação ou convite.
5. Garanta HTTPS, disponibilidade de saída para Supabase e limite de upload de pelo menos 10 MB no proxy.
6. Execute o fluxo com uma conta autorizada e um arquivo real revisado antes da entrada em operação.

Algumas hospedagens serverless limitam o corpo da requisição abaixo de 10 MB. Nesse caso, use um servidor Node com limite adequado ou reduza o limite da aplicação. PDF.js usa runtime Node, não Edge.

## Limites explícitos

- A estrutura dos arquivos reais da farmácia não foi fornecida. O parser aceita os formatos documentados e bloqueia estruturas ambíguas; valide um arquivo real antes do uso operacional.
- Não há OCR nem inferência clínica por IA.
- O primeiro administrador e as contas reais precisam ser criados pelo responsável.
- Não há estoque fictício no banco oficial nem saldo inicial presumido.
- Não há envio de e-mail, movimentação automática entre unidades ou publicação em hospedagem externa nesta entrega.
