# 🎓 Teachy Test — Copiloto de Planejamento Pedagógico com IA

Repositório monorepo do teste técnico Teachy: um copiloto pedagógico inteligente projetado para co-criar planejamentos escolares da Educação Básica brasileira em diálogo interativo com professores, persistindo dados estruturados de forma incremental e exibindo uma pré-visualização paginada em tempo real (_Living Draft_).

---

## 🧠 Tomada de Decisão: Linha Cronológica de Raciocínio

Abaixo está o registro cronológico das decisões de arquitetura, modelagem e produto ao longo do desenvolvimento, detalhando o que foi pensado e a linha de raciocínio adotada em cada etapa:

1. **[#1 - feat(service): configurar Prisma ORM, PostgreSQL e Docker Compose](https://github.com/azevgabriel/teachy-test/issues/1)**

   > **Linha de raciocínio:** Antes de qualquer regra de negócio, era indispensável ter uma base de persistência local reprodutível, isolada e simples de rodar. Optei pelo PostgreSQL conteinerizado via Docker Compose e estruturei o Prisma ORM v7 com suporte nativo a schemas modulares em `prisma/models/`, permitindo que cada domínio de dados cresça em seu próprio arquivo sem criar um monólito de schema, além de disponibilizar scripts automáticos para geração do `.env`.

2. **[#3 - feat(service): modelar habilidades da BNCC, componentes curriculares, anos de aplicacao e pipeline de seed](https://github.com/azevgabriel/teachy-test/issues/3)**

   > **Linha de raciocínio:** Um copiloto pedagógico para o contexto brasileiro não pode depender de alucinações da LLM para códigos ou descrições curriculares. Decidi modelar relacionalmente as 1.705 habilidades oficiais da BNCC estruturadas por ano e componente (incluindo disciplinas tradicionais, campos de experiência e computação) e desenvolver uma pipeline de seed idempotente a partir de dados reais para alimentar o banco com dados canônicos.

3. **[#5 - feat: interacao humana com a llm (chat, streaming, persistencia e linha do tempo de sessoes)](https://github.com/azevgabriel/teachy-test/issues/5)**

   > **Linha de raciocínio:** Precisávamos validar a experiência conversacional o quanto antes. O foco foi viabilizar streaming Server-Sent Events (SSE) com o Google Gemini, isolamento de sessões com histórico ordenado cronologicamente, controle de interrupção instantânea (botão Stop cooperativo sem quebrar estado) e persistência auditável de cada mensagem trocada.

4. **[#7 - feat(database): modelagem relacional do Planejamento Escolar e Avaliações flexíveis](https://github.com/azevgabriel/teachy-test/issues/7)**

   > **Linha de raciocínio:** O planejamento não podia ser um texto livre ou JSON opaco; precisava ser uma estrutura relacional viva para permitir edições pontuais, validação curricular e exportação fiel. Modelei um núcleo enxuto (`Planning` para o cabeçalho macro e `PlanningBlock` com auto-relacionamento recursivo `parentId` para o cronograma temporal), complementado pelo padrão EAV (`Specification` e `PlanningMetadataValue`) para absorver qualquer coluna ou metadado customizado solicitado pelo professor, além de modelagem flexível de instrumentos e critérios avaliativos.

5. **[#10 - feat(docs): especificação de orquestração pedagógica, guardrails e especificações padrão](https://github.com/azevgabriel/teachy-test/issues/10)**

   > **Linha de raciocínio:** Antes de instruir a LLM a interagir com o banco de dados, era vital formalizar as regras pedagógicas do sistema. Documentei as diretrizes em `apps/service/docs/planning/`: a regra anti-dump (proibição de despejar tabelas inteiras no chat de texto), a régua de granularidades decrescente, o tom co-criativo e investigativo da IA e a flexibilidade da BNCC para acomodar recomposição de aprendizagem (defasagens) e turmas adiantadas.

6. **[#11 - feat(ai): modularização de system prompts, fases do agente e higiene de contexto](https://github.com/azevgabriel/teachy-test/issues/11)**

   > **Linha de raciocínio:** Prompts estáticos e gigantescos degradam o raciocínio da IA e aumentam a chance de alucinação. Modularizei as instruções em arquivos temáticos especializados (`base`, `pedagogical-rules`, `evaluation-rules`, `intent-matrix`, `phases/`) e criei o `SystemInstructionBuilder`, injetando o estado atual do banco como "Snapshot Único da Verdade" e higienizando rigorosamente mensagens interrompidas ou canceladas da janela de contexto enviada ao modelo.

7. **[#12 - feat(ai): protocolo de saída dupla (streaming visual + payload estruturado oculto)](https://github.com/azevgabriel/teachy-test/issues/12)**

   > **Linha de raciocínio:** O professor deve receber apenas texto pedagógico acolhedor em Markdown limpo, sem nunca ver payloads técnicos de banco. Criei um transformador de stream com buffer de lookahead (`DualOutputStreamTransformer`) que transmite a resposta humana pelo SSE em tempo real e suprime do canal visual o envelope estruturado posicionado ao final (`<!--PLANNING_PATCH: ... -->`), validado estritamente com schemas Zod.

8. **[#13 - feat(backend): casos de uso para persistência incremental do planejamento (PlanningModule)](https://github.com/azevgabriel/teachy-test/issues/13)**

   > **Linha de raciocínio:** Com os comandos estruturados gerados pela IA, estruturei o `PlanningModule` com Casos de Uso atômicos e transacionais (`UpsertPlanning`, `SwapBlockByDate`, `AddSpecificationWithSlots`, `BatchUpdateColumn`, `ReorganizeHierarchy`, etc.). Garanti que mutações só sejam despachadas após o término seguro do stream (zero mutações em mensagens canceladas) e que os comandos fiquem armazenados na coluna auditável `Conversation.commands`.

9. **[#15 - fix(database): adicionar coluna is_required no modelo de Specification](https://github.com/azevgabriel/teachy-test/issues/15)**

   > **Linha de raciocínio:** Durante o refinamento do fluxo, identifiquei a necessidade de distinguir colunas opcionais de colunas de preenchimento mandatório pelo professor (ex: "é obrigatório preencher os recursos didáticos"). Adicionei a coluna `is_required` no modelo `Specification` com `@default(false)` para manter retrocompatibilidade e permitir tanto a validação na interface quanto o mecanismo de _slot-filling_ da IA antes da conclusão do plano.

10. **[#22 - feat(specifications): visual visibility control, label omission, universal reordering and native field reuse](https://github.com/azevgabriel/teachy-test/issues/22)**

    > **Linha de raciocínio:** Ao testar comandos reais dos professores, observei três problemas de usabilidade: trocar o nome de campos nativos (ex: de \"Componente\" para \"Disciplina\") gerava cartões duplicados em vez de atualizar o `customLabel`; não era possível omitir o rótulo superior para exibir apenas o valor direto; e não havia como ocultar seções sem deletar dados do banco. Adicionei os campos `order`, `isVisible` e `showLabel` ao modelo `Specification`, unificando o controle de colunas nativas e dinâmicas com integridade.

11. **[#23 - fix(planning): resolução precisa de applicationYear, curricularComponents e higiene de contexto pós-reset](https://github.com/azevgabriel/teachy-test/issues/23)**

    > **Linha de raciocínio:** Detectei falhas críticas de ambiguidade semântica: \"3º Ano do EM\" era incorretamente associado ao \"3º ano do EF I\" por busca parcial genérica, e \"Língua Portuguesa\" caía em campos de experiência da Educação Infantil. Além disso, ao disparar `RESET_PLANNING`, o histórico mantinha resíduos da conversa anterior. Criei resolvedores determinísticos desambiguados por etapa de ensino e implementei uma demarcação de corte (_watermark_) que purga o histórico conversacional anterior ao recomeço.

12. **[#26 - feat(ai/planning): motor de agrupamento e subdivisão temporal de blocos via chat (REORGANIZE_TREE)](https://github.com/azevgabriel/teachy-test/issues/26)**

    > **Linha de raciocínio:** Identifiquei um falso positivo conversacional grave: quando o professor pedia \"subdivida os meses em semanas\", a IA respondia elogiando a estrutura pedagógica, mas não criava nenhum bloco no banco de dados. Bloqueei essa resposta puramente retórica nos prompts com um guardrail mandatório, reformulei o Snapshot para exibir a árvore de blocos com indentação visual clara e aprimorei o `ReorganizeHierarchyUseCase` para calcular semanas úteis do calendário real e amarrar `parentId`, permitindo a transição fluida Trimestre $\rightarrow$ Mês $\rightarrow$ Semana $\rightarrow$ Dia.

13. **[#27 - fix(web): respeitar isVisible: false das especificações na renderização da tabela e cabeçalho do planejamento](https://github.com/azevgabriel/teachy-test/issues/27)**

    > **Linha de raciocínio:** Quando o professor solicitava ocultar um campo (ex: \"não é necessária sequência didática nos meses\"), o backend salvava `isVisible: false` perfeitamente, mas a interface web continuava exibindo a coluna porque validava apenas `hasMethodology || Boolean(methodologySpec)`. Corrigi o `PlanningTable`, o `PlanningHeader` e o estimador de altura de páginas A4 (`paginatePlanning`) para respeitar estritamente a diretiva de visibilidade, mantendo sincronia entre o banco e o layout em tela.

14. **[#28 - feat(planning): validação de datas, controle de recessos na sessão, descida de granularidade e realocação de aulas](https://github.com/azevgabriel/teachy-test/issues/28)**
    > **Linha de raciocínio:** Ao montar cronogramas com datas reais, a LLM frequentemente alucinava ao calcular feriados e empurrar aulas, além de correr o risco de criar granularidades incoerentes (ex: gerar blocos semanais dentro de um plano semanal). Blindamos a integridade temporal no backend: integrei a biblioteca `date-holidays` com suporte a recessos locais da sessão, travei a hierarquia estrita de granularidade descendente (`WEEKLY` $\rightarrow$ `DAILY`) e implementei um algoritmo determinístico de realocação de aulas em cascata que pula fins de semana e feriados, estendendo o período no cabeçalho macro automaticamente.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos

- **Node.js:** Versão 20+
- **Docker & Docker Compose:** Instalados e em execução

---

### 1. Backend (`apps/service`)

Acesse o diretório do backend:

```bash
cd apps/service
```

#### Passo 1.1: Configurar Variáveis de Ambiente (`.env`)

Você pode utilizar o script interativo que solicita suas chaves (incluindo a `GEMINI_API_KEY`) ou copiar o exemplo padrão:

```bash
# Opção A: Script interativo guiado (Recomendado)
npm run env:setup

# Opção B: Cópia direta do modelo de fallback
cp .env.example .env
```

> [!IMPORTANT]
> Certifique-se de preencher `GEMINI_API_KEY` no seu `.env` para que o serviço de IA funcione corretamente.

#### Passo 1.2: Inicializar Containers Docker (PostgreSQL + NestJS)

```bash
# Subir containers em segundo plano
docker compose up -d

# Verificar a integridade dos serviços
docker compose ps

# Visualizar logs em tempo real
docker compose logs -f
```

- **API NestJS:** Disponível em `http://localhost:3000` (verifique com `curl http://localhost:3000`).
- **PostgreSQL:** Disponível em `localhost:5432`.

#### Passo 1.3: Migrações e Seed do Catálogo da BNCC

Em um terminal separado (ou executando localmente fora do container):

```bash
# Executar as migrações do banco
npm run prisma:migrate

# Popular as 1.705 habilidades da BNCC e componentes curriculares
npm run prisma:seed
```

#### ⚠️ Problemas com credenciais no Docker?

Se você alterar `POSTGRES_DB`, `POSTGRES_USER` ou `POSTGRES_PASSWORD` no `.env` após o volume já ter sido inicializado, o PostgreSQL ignora as novas variáveis. Para recriar o banco com as novas configurações:

```bash
docker compose down -v
docker compose up -d
```

---

### 2. Frontend Web (`apps/web`)

Abra um novo terminal e acesse a pasta da aplicação web:

```bash
cd apps/web
```

#### Passo 2.1: Instalar dependências

```bash
npm install
```

#### Passo 2.2: Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse a aplicação no navegador em: **`http://localhost:5173`**.

---

## 📚 Documentação Complementar

- 📖 [`docs/WORKFLOW.md`](docs/WORKFLOW.md): Diretrizes de portões de aprovação e fluxo de implementação da IA.
- 📖 [`docs/GITHUB.md`](docs/GITHUB.md): Regras de branches, convenções de commits, issues e PRs.
- 📖 [`apps/service/docs/planning/`](apps/service/docs/planning/README.md): Especificação arquitetural do planejamento pedagógico (modelagem de dados, regras de negócio, avaliações e catálogo de intenções).
- 📖 [`apps/web/docs/GLOBAL.md`](apps/web/docs/GLOBAL.md): Arquitetura do frontend, TanStack Router e diretrizes de interface.
