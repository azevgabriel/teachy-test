# 🎓 Teachy Test — Copiloto de Planejamento Pedagógico com IA

Repositório monorepo do teste técnico Teachy: um copiloto pedagógico inteligente projetado para co-criar planejamentos escolares da Educação Básica brasileira em diálogo interativo com professores, persistindo dados estruturados de forma incremental e exibindo uma pré-visualização paginada em tempo real (_Living Draft_).

---

## 🏛️ Arquitetura da Solução

O projeto adota uma arquitetura desacoplada e orientada a serviços conteinerizados via Docker Compose, separando com rigor as responsabilidades entre interface web, backend de orquestração pedagógica, microsserviço de renderização de alta fidelidade e persistência de dados.

### Diagrama de Arquitetura

<p align="center">
  <img src="assets/diagram.png" alt="Arquitetura do Sistema Teachy Test" width="750" />
</p>

<details>
<summary><b>Visualizar diagrama interativo em formato Mermaid</b></summary>

```mermaid
flowchart TD
    subgraph Host["Host Machine"]
        subgraph Client["Client Application (Vite.js + TailwindCSS)"]
            Browser["Navegador Web"]
        end
    end

    subgraph Docker["Docker Engine (Docker Compose Environment)"]
        subgraph Network["Docker Network (Bridge)"]
            subgraph Backend["Container: NestJS Backend"]
                NodeRuntime["Node.js Runtime (versão LTS)"]
                NestApp["NestJS Application"]
                PrismaClient["Prisma ORM Client"]
                AWSClient["AWS SDK Client (Lambda Invoker)"]
                GoogleGenAIClient["Google GenAI SDK Client"]

                NodeRuntime --> NestApp
                NestApp --> PrismaClient
                NestApp --> AWSClient
                NestApp --> GoogleGenAIClient
            end

            subgraph Database["Container: Database"]
                Postgres["Imagem Oficial PostgreSQL"]
                PgData[("Docker Volume: pgdata")]
                Postgres --> PgData
            end

            subgraph Microservice["Container: Microservico de Conversao"]
                LambdaRIE["Imagem Base AWS Lambda (RIE - Runtime Interface Emulator)"]
                Handler["Handler Entrypoint"]
                Playwright["Playwright (Chromium Headless) - PDF"]
                DocxWorker["python-docx Worker - DOCX"]

                LambdaRIE --> Handler
                Handler --> Playwright
                Handler --> DocxWorker
            end
        end
    end

    subgraph Cloud["Google Cloud AI"]
        Gemini["Gemini 3.8 Flash (LLM API)"]
    end

    Browser <-->|"HTTP REST / SSE Stream"| NestApp
    PrismaClient -->|"TCP: 5432 - SQL Queries"| Postgres
    AWSClient -->|"HTTP POST: 8080/2015-03-31/functions/function/invocations"| LambdaRIE
    GoogleGenAIClient <-->|"HTTPS - Stream de Tokens"| Gemini
```
</details>

### Detalhamento dos Componentes

1. **Host Machine & Client Application (`apps/web`):**
   - **Tecnologias:** React 19, Vite.js, Tailwind CSS v4, TanStack Router e design system com Radix UI / shadcn/ui.
   - **Navegador Web:** Executado diretamente na máquina host (`http://localhost:5173`), entregando ao professor uma experiência fluida de co-criação.
   - **Comunicação Híbrida Segregada:**
     - **Streaming em Tempo Real (SSE):** Consumo contínuo de tokens pedagógicos da IA via Server-Sent Events, com suporte a cancelamento cooperativo instantâneo (*cancel mid-flight*) através de `AbortController`.
     - **REST Tradicional (`async/await`):** Operações determinísticas de CRUD, paginação, download de arquivos e recuperação de dados de sessões.
   - **Living Draft:** Visualizador em tempo real paginado em padrão folha A4 com renderização precisa do planejamento em co-criação.

2. **Docker Engine (`apps/service/docker-compose.yml`):**
   - Orquestra os contêineres locais interconectados através de uma rede bridge isolada (`Docker Network Bridge`), garantindo reprodutibilidade idêntica do ambiente.

3. **Container: Backend Core (`apps/service` — `teachy_service`):**
   - **Runtime:** Node.js (versão LTS).
   - **Framework:** NestJS com modularização estrita e Casos de Uso atômicos (`PlanningModule`, `AiModule`, `CatalogModule`).
   - **Clientes & Integrações Centrais:**
     - **Prisma ORM Client:** Mapeamento objeto-relacional com schemas modulares em `prisma/models/`, gerenciando transações ACID, integridade referencial e o catálogo oficial da BNCC.
     - **AWS SDK Client (Lambda Invoker):** Despacha requisições de conversão ao microsserviço de renderização via protocolo padrão AWS Lambda RIE, isolando I/O gráfico pesado do backend principal.
     - **Google GenAI SDK Client:** Interface com o modelo **Gemini 3.8 Flash**, injetando o estado atual do banco como *Snapshot Único da Verdade*, aplicando guardrails pedagógicos e processando o transformador de saída dupla (`DualOutputStreamTransformer`) para separar o diálogo humano do payload estruturado oculto (`<!--PLANNING_PATCH: ... -->`).

4. **Container: Database (`teachy_postgres`):**
   - **Imagem Oficial:** `postgres:16-alpine`.
   - **Persistência:** Volume gerenciado `postgres_data` (`/var/lib/postgresql/data`), assegurando persistência durável dos dados entre reinicializações.
   - **Massa de Dados:** Armazena as 1.705 habilidades canônicas da BNCC, componentes curriculares, histórico cronológico de conversas e os planejamentos hierárquicos e dinâmicos (padrão EAV com `Specification`).
   - **Conexão:** `TCP: 5432` com pool de conexões otimizado pelo Prisma.

5. **Container: Microserviço de Conversão (`apps/engine` — `teachy_engine`):**
   - **Imagem Base:** `public.ecr.aws/lambda/python:3.12` com Amazon Linux 2023 e AWS Lambda RIE (*Runtime Interface Emulator*) embutido.
   - **Paridade Cloud:** Permite invocações idênticas às de uma função AWS Lambda Serverless através de `HTTP POST: 8080/2015-03-31/functions/function/invocations`.
   - **Motores de Renderização Especializados:**
     - **Playwright (Chromium Headless) - PDF:** Executa o Chromium headless para compilar o HTML/CSS do planejamento diretamente para PDF A4 (retrato ou paisagem), garantindo exata paridade visual com a interface.
     - **python-docx Worker - DOCX:** Constrói documentos nativos do Microsoft Word / Google Docs (`.docx`) com tabelas formatadas, células editáveis, cabeçalhos sombreados e metadados dinâmicos.

6. **Google Cloud AI (Serviço Externo):**
   - **Modelo:** `Gemini 3.8 Flash` (Google Cloud Generative AI).
   - **Comunicação:** Conexão criptografada `HTTPS` com streaming de tokens em tempo real.
   - **Papel Pedagógico:** Atua como copiloto investigativo e socrático para estruturar planos de aula, sugerir metodologias ativas e alinhar códigos e habilidades curriculares à realidade escolar brasileira.

### Resumo das Comunicações & Protocolos

| Origem | Destino | Protocolo / Porta | Finalidade |
| :--- | :--- | :--- | :--- |
| **Navegador Web (`apps/web`)** | **NestJS Backend (`apps/service`)** | `HTTP REST` / `SSE Stream` (`:3000`) | Envio de comandos, upload de materiais, streaming de respostas da IA e consultas |
| **NestJS Backend (`apps/service`)** | **PostgreSQL (`teachy_postgres`)** | `TCP: 5432` (SQL Queries via Prisma) | Persistência transacional, catálogo da BNCC e consultas relacionais |
| **NestJS Backend (`apps/service`)** | **Engine Lambda (`teachy_engine`)** | `HTTP POST: 8080/2015-03-31/...` (RIE) | Invocação assíncrona para renderização de alta fidelidade em PDF e DOCX |
| **NestJS Backend (`apps/service`)** | **Google Cloud AI** | `HTTPS` (Stream de Tokens) | Geração de linguagem natural e emissão de patches estruturados da IA |

---

## 🧠 Tomada de Decisão: Linha Cronológica de Raciocínio

Abaixo está o registro cronológico das decisões de arquitetura, modelagem e produto ao longo do desenvolvimento, detalhando o que foi pensado e a linha de raciocínio adotada em cada etapa. A lista está ordenada rigorosamente pela data de fechamento das issues (do mais antigo para o mais novo), com horários convertidos para o Horário de Brasília (BRT / UTC-3) e agrupando as sub-issues executadas sob seus respectivos Épicos:

1. **[#1 - feat(service): configurar Prisma ORM, PostgreSQL e Docker Compose](https://github.com/azevgabriel/teachy-test/issues/1)**
   - 📅 **Fechada em:** 21/11/2026 às 11:26 (Horário de Brasília)
   > **Linha de raciocínio:** Antes de qualquer regra de negócio, era indispensável ter uma base de persistência local reprodutível, isolada e simples de rodar. Optei pelo PostgreSQL conteinerizado via Docker Compose e estruturei o Prisma ORM v7 com suporte nativo a schemas modulares em `prisma/models/`, permitindo que cada domínio de dados cresça em seu próprio arquivo sem criar um monólito de schema, além de disponibilizar scripts automáticos para geração do `.env`.

2. **[#3 - feat(service): modelar habilidades da BNCC, componentes curriculares, anos de aplicacao e pipeline de seed](https://github.com/azevgabriel/teachy-test/issues/3)**
   - 📅 **Fechada em:** 21/11/2026 às 12:11 (Horário de Brasília)
   > **Linha de raciocínio:** Um copiloto pedagógico para o contexto brasileiro não pode depender de alucinações da LLM para códigos ou descrições curriculares. Decidi modelar relacionalmente as 1.705 habilidades oficiais da BNCC estruturadas por ano e componente (incluindo disciplinas tradicionais, campos de experiência e computação) e desenvolver uma pipeline de seed idempotente a partir de dados reais para alimentar o banco com dados canônicos.

3. **[#5 - feat: interacao humana com a llm (chat, streaming, persistencia e linha do tempo de sessoes)](https://github.com/azevgabriel/teachy-test/issues/5)**
   - 📅 **Fechada em:** 21/11/2026 às 15:19 (Horário de Brasília)
   > **Linha de raciocínio:** Precisávamos validar a experiência conversacional o quanto antes. O foco foi viabilizar streaming Server-Sent Events (SSE) com o Google Gemini, isolamento de sessões com histórico ordenado cronologicamente, controle de interrupção instantânea (botão Stop cooperativo sem quebrar estado) e persistência auditável de cada mensagem trocada.

4. **[#7 - feat(database): modelagem relacional do Planejamento Escolar e Avaliações flexíveis](https://github.com/azevgabriel/teachy-test/issues/7)**
   - 📅 **Fechada em:** 21/11/2026 às 18:58 (Horário de Brasília)
   > **Linha de raciocínio:** O planejamento não podia ser um texto livre ou JSON opaco; precisava ser uma estrutura relacional viva para permitir edições pontuais, validação curricular e exportação fiel. Modelei um núcleo enxuto (`Planning` para o cabeçalho macro e `PlanningBlock` com auto-relacionamento recursivo `parentId` para o cronograma temporal), complementado pelo padrão EAV (`Specification` e `PlanningMetadataValue`) para absorver qualquer coluna ou metadado customizado solicitado pelo professor, além de modelagem flexível de instrumentos e critérios avaliativos.

5. **[#15 - fix(database): adicionar coluna is_required no modelo de Specification](https://github.com/azevgabriel/teachy-test/issues/15)**
   - 📅 **Fechada em:** 21/11/2026 às 20:46 (Horário de Brasília)
   > **Linha de raciocínio:** Durante o refinamento do fluxo, identifiquei a necessidade de distinguir colunas opcionais de colunas de preenchimento mandatório pelo professor (ex: "é obrigatório preencher os recursos didáticos"). Adicionei a coluna `is_required` no modelo `Specification` com `@default(false)` para manter retrocompatibilidade e permitir tanto a validação na interface quanto o mecanismo de _slot-filling_ da IA antes da conclusão do plano.

6. **[#9 - feat(epic): orquestração do chat pedagógico e construção incremental do planejamento escolar](https://github.com/azevgabriel/teachy-test/issues/9)**
   - 📅 **Fechamento do Epic:** 22/11/2026 às 20:41 (Horário de Brasília) *(Sub-issues executadas entre 21/11 às 21:12 e 22/11 às 20:37)*
   > **Linha de raciocínio macro:** Esta Mega Issue (Epic) estabeleceu o elo inteligente entre a experiência conversacional do professor no chat e a persistência relacional do Planejamento Escolar modelado na issue #7. A missão da IA foi definida como um intermediador pedagógico ativo, conduzindo sutilmente o professor na estruturação completa ou parcial do planejamento sem despejo de texto livre no chat, higienizando o histórico conversacional, operando via protocolo de saída dupla e persistindo dados no PostgreSQL através de Casos de Uso atômicos do `PlanningModule`.
   >
   > #### 🗂️ Sub-issues Atômicas Agrupadas:
   >
   > - **[#10 - feat(docs): especificação de orquestração pedagógica, guardrails e especificações padrão](https://github.com/azevgabriel/teachy-test/issues/10)**
   >   - 📅 **Fechada em:** 21/11/2026 às 21:12 (Horário de Brasília)
   >   - **Linha de raciocínio:** Antes de instruir a LLM a interagir com o banco de dados, era vital formalizar as regras pedagógicas do sistema. Documentei as diretrizes em `apps/service/docs/planning/`: a regra anti-dump (proibição de despejar tabelas inteiras no chat de texto), a régua de granularidades decrescente, o tom co-criativo e investigativo da IA e a flexibilidade da BNCC para acomodar recomposição de aprendizagem (defasagens) e turmas adiantadas.
   >
   > - **[#11 - feat(ai): modularização de system prompts, fases do agente e higiene de contexto](https://github.com/azevgabriel/teachy-test/issues/11)**
   >   - 📅 **Fechada em:** 21/11/2026 às 21:47 (Horário de Brasília)
   >   - **Linha de raciocínio:** Prompts estáticos e gigantescos degradam o raciocínio da IA e aumentam a chance de alucinação. Modularizei as instruções em arquivos temáticos especializados (`base`, `pedagogical-rules`, `evaluation-rules`, `intent-matrix`, `phases/`) e criei o `SystemInstructionBuilder`, injetando o estado atual do banco como "Snapshot Único da Verdade" e higienizando rigorosamente mensagens interrompidas ou canceladas da janela de contexto enviada ao modelo.
   >
   > - **[#12 - feat(ai): protocolo de saída dupla (streaming visual + payload estruturado oculto)](https://github.com/azevgabriel/teachy-test/issues/12)**
   >   - 📅 **Fechada em:** 22/11/2026 às 01:40 (Horário de Brasília)
   >   - **Linha de raciocínio:** O professor deve receber apenas texto pedagógico acolhedor em Markdown limpo, sem nunca ver payloads técnicos de banco. Criei um transformador de stream com buffer de lookahead (`DualOutputStreamTransformer`) que transmite a resposta humana pelo SSE em tempo real e suprime do canal visual o envelope estruturado posicionado ao final (`<!--PLANNING_PATCH: ... -->`), validado estritamente com schemas Zod.
   >
   > - **[#13 - feat(backend): casos de uso para persistência incremental do planejamento (PlanningModule)](https://github.com/azevgabriel/teachy-test/issues/13)**
   >   - 📅 **Fechada em:** 22/11/2026 às 01:40 (Horário de Brasília)
   >   - **Linha de raciocínio:** Com os comandos estruturados gerados pela IA, estruturei o `PlanningModule` com Casos de Uso atômicos e transacionais (`UpsertPlanning`, `SwapBlockByDate`, `AddSpecificationWithSlots`, `BatchUpdateColumn`, `ReorganizeHierarchy`, etc.). Garanti que mutações só sejam despachadas após o término seguro do stream (zero mutações em mensagens canceladas) e que os comandos fiquem armazenados na coluna auditável `Conversation.commands`.
   >
   > - **[#14 - feat(web): interface visual de acompanhamento do planejamento e sincronização em tempo real](https://github.com/azevgabriel/teachy-test/issues/14)**
   >   - 📅 **Fechada em:** 22/11/2026 às 20:37 (Horário de Brasília)
   >   - **Linha de raciocínio:** O professor precisa acompanhar o planejamento tomando forma no *Living Draft* em paralelo à conversa no chat (layout em split-view). Estruturei o `PlanningViewer` consumindo o dado relacional via `usePlanningSync`, com renderização hierárquica baseada na menor granularidade (linhas de aula) e blocos pais como divisores de tabela, refletindo imediatamente colunas nativas e especificações dinâmicas (EAV).

7. **[#23 - fix(planning): resolução precisa de applicationYear, curricularComponents e higiene de contexto pós-reset](https://github.com/azevgabriel/teachy-test/issues/23)**
   - 📅 **Fechada em:** 22/11/2026 às 14:44 (Horário de Brasília)
   > **Linha de raciocínio:** Detectei falhas críticas de ambiguidade semântica: "3º Ano do EM" era incorretamente associado ao "3º ano do EF I" por busca parcial genérica, e "Língua Portuguesa" caía em campos de experiência da Educação Infantil. Além disso, ao disparar `RESET_PLANNING`, o histórico mantinha resíduos da conversa anterior. Criei resolvedores determinísticos desambiguados por etapa de ensino e implementei uma demarcação de corte (*watermark*) que purga o histórico conversacional anterior ao recomeço.

8. **[#22 - feat(specifications): visual visibility control, label omission, universal reordering and native field reuse](https://github.com/azevgabriel/teachy-test/issues/22)**
   - 📅 **Fechada em:** 22/11/2026 às 15:28 (Horário de Brasília)
   > **Linha de raciocínio:** Ao testar comandos reais dos professores, observei três problemas de usabilidade: trocar o nome de campos nativos (ex: de "Componente" para "Disciplina") gerava cartões duplicados em vez de atualizar o `customLabel`; não era possível omitir o rótulo superior para exibir apenas o valor direto; e não havia como ocultar seções sem deletar dados do banco. Adicionei os campos `order`, `isVisible` e `showLabel` ao modelo `Specification`, unificando o controle de colunas nativas e dinâmicas com integridade.

9. **[#28 - feat(planning): validação de datas, controle de recessos na sessão, descida de granularidade e realocação de aulas](https://github.com/azevgabriel/teachy-test/issues/28)**
   - 📅 **Fechada em:** 22/11/2026 às 18:36 (Horário de Brasília)
   > **Linha de raciocínio:** Ao montar cronogramas com datas reais, a LLM frequentemente alucinava ao calcular feriados e empurrar aulas, além de correr o risco de criar granularidades incoerentes (ex: gerar blocos semanais dentro de um plano semanal). Blindamos a integridade temporal no backend: integrei a biblioteca `date-holidays` com suporte a recessos locais da sessão, travei a hierarquia estrita de granularidade descendente (`WEEKLY` $\rightarrow$ `DAILY`) e implementei um algoritmo determinístico de realocação de aulas em cascata que pula fins de semana e feriados, estendendo o período no cabeçalho macro automaticamente.

10. **[#26 - feat(ai/planning): motor de agrupamento e subdivisão temporal de blocos via chat (REORGANIZE_TREE)](https://github.com/azevgabriel/teachy-test/issues/26)**
    - 📅 **Fechada em:** 22/11/2026 às 19:16 (Horário de Brasília)
    > **Linha de raciocínio:** Identifiquei um falso positivo conversacional grave: quando o professor pedia "subdivida os meses em semanas", a IA respondia elogiando a estrutura pedagógica, mas não criava nenhum bloco no banco de dados. Bloqueei essa resposta puramente retórica nos prompts com um guardrail mandatório, reformulei o Snapshot para exibir a árvore de blocos com indentação visual clara e aprimorei o `ReorganizeHierarchyUseCase` para calcular semanas úteis do calendário real e amarrar `parentId`, permitindo a transição fluida Trimestre $\rightarrow$ Mês $\rightarrow$ Semana $\rightarrow$ Dia.

11. **[#27 - fix(web): respeitar isVisible: false das especificações na renderização da tabela e cabeçalho do planejamento](https://github.com/azevgabriel/teachy-test/issues/27)**
    - 📅 **Fechada em:** 22/11/2026 às 19:42 (Horário de Brasília)
    > **Linha de raciocínio:** Quando o professor solicitava ocultar um campo (ex: "não é necessária sequência didática nos meses"), o backend salvava `isVisible: false` perfeitamente, mas a interface web continuava exibindo a coluna porque validava apenas `hasMethodology || Boolean(methodologySpec)`. Corrigi o `PlanningTable`, o `PlanningHeader` e o estimador de altura de páginas A4 (`paginatePlanning`) para respeitar estritamente a diretiva de visibilidade, mantendo sincronia entre o banco e o layout em tela.

12. **[#29 - feat(engine): microsserviço de exportação de planejamento em alta fidelidade para PDF (Playwright) e DOCX (python-docx) via AWS Lambda](https://github.com/azevgabriel/teachy-test/issues/29)**
    - 📅 **Fechada em:** 22/11/2026 às 20:37 (Horário de Brasília)
    > **Linha de raciocínio:** A geração de documentos de alta fidelidade para impressão física (PDF) e edição contínua (DOCX) exige renderização pesada que degradaria a performance da API principal se executada no mesmo processo. Decidi isolar essa responsabilidade em um microsserviço dedicado conteinerizado com AWS Lambda RIE (`apps/engine`). O Playwright em modo headless compila o HTML/CSS para PDF com paridade visual A4 exata, enquanto um worker nativo em `python-docx` gera documentos Word com tabelas e metadados dinâmicos.

13. **[#19 - fix(web): retornar foco para o input do usuário após término da resposta da IA](https://github.com/azevgabriel/teachy-test/issues/19)**
    - 📅 **Fechada em:** 22/11/2026 às 20:57 (Horário de Brasília)
    > **Linha de raciocínio:** Durante o streaming da IA, o campo de texto (`ChatInput`) era desabilitado e o botão de envio alternava para cancelamento (Stop). Ao término da resposta, o input voltava a ficar habilitado mas sem foco, forçando o professor a clicar manualmente na caixa a cada interação. Implementei a recondução automática de foco para o input logo após a finalização do stream ou cancelamento, garantindo uma cadência conversacional sem interrupções.

14. **[#35 - fix(web): desacoplar mensagens de loading do chat em compreensão e aplicação estrutural](https://github.com/azevgabriel/teachy-test/issues/35)**
    - 📅 **Fechada em:** 22/11/2026 às 21:21 (Horário de Brasília)
    > **Linha de raciocínio:** A presença de um indicador de carregamento genérico causava estranheza ao usuário entre a digitação e a resposta. Desacoplei a percepção de espera em dois momentos transparentes na UI: primeiro loading de "Compreensão / Pesquisa" (enquanto o backend carrega o histórico, consulta habilidades da BNCC e a LLM processa o comando) e segundo loading de "Aplicação Estrutural" (quando o streaming de tokens é concluído e os Casos de Uso atômicos aplicam as mutações relacionais no PostgreSQL).

15. **[#20 - feat(web/backend): enriquecer identificação da sessão com metadados do planejamento, tags pedagógicas e período de datas](https://github.com/azevgabriel/teachy-test/issues/20)**
    - 📅 **Fechada em:** 22/11/2026 às 22:23 (Horário de Brasília)
    > **Linha de raciocínio:** Identificar conversas antigas apenas como "Nova Conversa" ou pelo título inicial dificultava a navegação do professor. Enriqueci os modelos e os endpoints da barra lateral para expor badges dinâmicos de contexto (Componente Curricular, Ano Escolar, granularidade macro e intervalo de datas letivas), permitindo rápida identificação visual e recuperação eficiente de planejamentos históricos.

16. **[#38 - fix(backend/ai): corrigir resolução de blocos folha e persistência de metadados em planejamentos hierárquicos](https://github.com/azevgabriel/teachy-test/issues/38)**
    - 📅 **Fechada em:** 22/11/2026 às 23:31 (Horário de Brasília)
    > **Linha de raciocínio:** Ao solicitar o preenchimento de uma semana ou aula específica em árvores hierárquicas profundas (ex: Trimestre -> Mês -> Semana), a IA acabava associando o conteúdo ao bloco ancestral (`parentId: null`), deixando os blocos folha vazios. Corrigi a resolução relacional no schema de patch e nos Casos de Uso para identificar cirurgicamente o bloco folha alvo por data e ordem hierárquica, garantindo integridade no preenchimento de metodologias e metadados.

17. **[#40 - feat(chat/export): comando conversacional de exportação em PDF e DOCX consumindo endpoint de geração](https://github.com/azevgabriel/teachy-test/issues/40)**
    - 📅 **Fechada em:** 22/11/2026 às 23:49 (Horário de Brasília)
    > **Linha de raciocínio:** O professor não deveria depender exclusivamente de botões visuais na barra superior para exportar seu trabalho. Habilitei comandos conversacionais em linguagem natural no chat (ex: "exportar em PDF", "baixar em DOCX"), permitindo que a IA reconheça a intenção, acione o microsserviço de renderização e devolva uma resposta interativa com link de download direto e seguro.

18. **[#42 - feat(epic): importação de referências escolares via chat com extração em duas camadas e especificações EAV](https://github.com/azevgabriel/teachy-test/issues/42)**
    - 📅 **Fechamento do Epic:** 23/11/2026 às 01:55 (Horário de Brasília) *(Sub-issues executadas sequencialmente entre 23/11 às 00:29 e 01:52)*
    > **Linha de raciocínio macro:** Esta Mega Issue (Epic) implementou o fluxo completo de ingestão e assimilação de diretrizes pedagógicas, matrizes de competência e modelos escolares reais enviados pelos professores em PDF, DOCX ou capturas de tela/fotos. A IA atua com discernimento conversacional proativo (perguntando se o professor quer importar apenas o molde estrutural ou os dados integrais) e armazena os arquivos em um repositório reaproveitável entre sessões.
    >
    > #### 🗂️ Sub-issues Atômicas Agrupadas:
    >
    > - **[#43 - feat(web/upload): envio de referências escolares via dropzone e botão de anexo no chat](https://github.com/azevgabriel/teachy-test/issues/43)**
    >   - 📅 **Fechada em:** 23/11/2026 às 00:29 (Horário de Brasília)
    >   - **Linha de raciocínio:** O envio de materiais institucionais pelo professor precisava ser tão fluido quanto o envio de arquivos em mensageiros modernos. Desenvolvi suporte completo a drag-and-drop (dropzone) sobre o container do chat e botão dedicado de anexo no `ChatInput`, com validação de tipo MIME (PDF, DOCX, Imagens) e feedback visual de progresso.
    >
    > - **[#48 - feat(documents): repositório global de documentos de referência com storage local no servidor (/tmp) e vinculação multi-sessão](https://github.com/azevgabriel/teachy-test/issues/48)**
    >   - 📅 **Fechada em:** 23/11/2026 às 00:50 (Horário de Brasília)
    >   - **Linha de raciocínio:** Professores usam as mesmas diretrizes da coordenação para planejar múltiplas turmas ao longo do ano. Modelei a entidade `ReferenceDocument` com persistência em disco local (`/tmp/teachy-uploads`) e relacionamento N:N com sessões, permitindo ao docente reutilizar matrizes já enviadas em qualquer conversa sem necessidade de novos uploads ou processamentos redundantes.
    >
    > - **[#44 - feat(service/extraction): pipeline de extração de conteúdo em duas camadas para PDF, DOCX e Imagens](https://github.com/azevgabriel/teachy-test/issues/44)**
    >   - 📅 **Fechada em:** 23/11/2026 às 01:11 (Horário de Brasília)
    >   - **Linha de raciocínio:** Para transformar arquivos não estruturados em dados relacionais, implementei uma pipeline de extração multimodal segregada: `pdf-parse` para texto e tabelas de PDFs, `mammoth` para documentos Word e `Gemini Vision` para imagens/screenshots. A extração separa o molde (layout, cabeçalhos, colunas) dos dados instanciados (datas e conteúdos), gravando o resultado em cache estruturado.
    >
    > - **[#45 - feat(ai/specifications): discernimento conversacional de importação e calibração de especificações EAV da escola](https://github.com/azevgabriel/teachy-test/issues/45)**
    >   - 📅 **Fechada em:** 23/11/2026 às 01:30 (Horário de Brasília)
    >   - **Linha de raciocínio:** Ao receber um documento de referência, a IA não deve agir de forma precipitada. Implementei o discernimento conversacional: a IA analisa o material, apresenta a estrutura detectada e pergunta se o professor prefere iniciar um plano novo usando apenas aquele molde institucional ou se deseja transcrever as aulas contidas no arquivo, calibrando o motor EAV (`Specification`) com o layout exato da escola.
    >
    > - **[#46 - feat(planning/ai): aplicação estrita de tom de escrita e limite médio de caracteres (avgCharLimit) na geração](https://github.com/azevgabriel/teachy-test/issues/46)**
    >   - 📅 **Fechada em:** 23/11/2026 às 01:52 (Horário de Brasília)
    >   - **Linha de raciocínio:** Com as especificações da escola registradas contendo o tom de redação (`description`) e a densidade de caracteres (`avgCharLimit`), calibrei os system prompts do `SystemInstructionBuilder` para que a geração de aulas da IA adote estritamente o vocabulário, brevidade e padrão de redação exigidos pela coordenação da escola do professor.

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

#### Passo 1.2: Inicializar Containers Docker (PostgreSQL + Engine + NestJS)

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
- **Microsserviço de Conversão (Engine):** Disponível em `http://localhost:8080/2015-03-31/functions/function/invocations`.

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

## 🔮 Roadmap & Próximos Passos (Melhorias Futuras)

Abaixo estão registradas as melhorias arquiteturais, fluxos de automação e medidas de segurança planejadas para elevar a maturidade, robustez e flexibilidade do sistema:

### 1. 🛡️ Sanitização de Texto & Segurança contra Script Injection (XSS)

> [!CAUTION]
> **Vulnerabilidade Crítica Mapeada:** No fluxo de exportação para PDF, a aplicação web (`apps/web`) clona e serializa o nó do DOM React do _Living Draft_ contendo os dados inseridos pelo usuário e gerados pela IA, despachando o HTML bruto para compilação headless no microsserviço (`apps/engine` via Playwright Chromium). A ausência de um sanitizador robusto expõe o ambiente headless a injeções de scripts (`<script>`, handlers de eventos, template injection), configurando uma das falhas mais severas do sistema.

- **Mitigações planejadas:**
  - **Sanitização Bidirecional:** Incorporação de sanitizador de HTML rigoroso (ex.: `DOMPurify` / `sanitize-html`) antes do despacho do clone React e validação defensiva de entrada no microsserviço.
  - **Content Security Policy (CSP):** Imposição de diretivas restritivas no navegador headless do Playwright, desabilitando execução de scripts e requisições de rede externas durante a renderização.
  - **Filtros de Entrada:** Sanitização de inputs de texto livre no backend para prevenir persistência de payloads maliciosos no banco de dados.

---

### 2. ⚡ Automação por CI/CD & 4 Portões de Validação por PR

Implementação de pipelines automatizadas via **GitHub Actions** cobrindo os **três serviços do monorepo** (`client` em `apps/web`, `server` em `apps/service` e `microservice` em `apps/engine`):

| Portão de Validação | Client (`apps/web`) | Server (`apps/service`) | Microservice (`apps/engine`) |
| :--- | :--- | :--- | :--- |
| **1. Linters & Estilo** | Biome / ESLint | ESLint + Prettier | Ruff / Flake8 / Black |
| **2. Testes Unitários & Coverage** | Vitest + React Testing Library | Jest / Vitest (NestJS) | Pytest + pytest-cov |
| **3. Security Audit** | `npm audit --audit-level=high` | `npm audit --audit-level=high` | `pip-audit` / `safety` |
| **4. Validação de Build** | `tsc --noEmit && vite build` | `tsc --noEmit && nest build` | `docker build` / empacotamento Lambda |

- **Fluxos de Referência (AdaptEdu):**
  - [Pipeline de Validação e Checks Contínuos por PR](https://github.com/azevgabriel/AdaptEdu/actions/runs/44422188712)
  - [Automação de Deleção de Branch pós-Merge](https://github.com/azevgabriel/AdaptEdu/actions/runs/44422189404)

---

### 3. 🧪 Ampliação da Cobertura de Testes

- **Back-end Core (`apps/service`):** Cobertura abrangente dos Casos de Uso atômicos do `PlanningModule`, cenários de bifurcação e recursão na árvore hierárquica de blocos, integridade de transações ACID e resiliência a cancelamentos no transformador de streaming SSE (`DualOutputStreamTransformer`).
- **Pipeline de Ingestão & Extração de PDFs:** Baterias de testes de estresse com matrizes reais de diferentes redes escolares para validar a fidelidade e acurácia na decomposição de árvores temporais profundas.
- **Front-end (`apps/web`):** Testes unitários e de integração para os componentes do chat, do `Living Draft` e do algoritmo de paginação visual A4 (`paginatePlanning`).
- **Engine Lambda (`apps/engine`):** Testes automatizados para validação de layout no Playwright e formatação estruturada de tabelas e metadados no worker DOCX.

---

### 4. 🤖 Engenharia de Contexto & Padronização de Agentes de IA

Refinamento das instruções operacionais e do contexto dos coding agents (`AGENTS.md` e regras de domínio) com diretrizes especializadas:
- **Design System (DS):** Diretrizes estritas para uso exclusivo dos primitivos do Radix UI, shadcn/ui e Tailwind CSS, coibindo estilos customizados fora do padrão visual.
- **Arquitetura de Arquivos:** Definição explícita da organização de pastas e limites de domínio no monorepo (Clean Architecture no backend, Feature/Component slicing no frontend).
- **Módulo de Segurança:** Guardrails claros contra vazamento de credenciais, sanitização mandatória de entradas e prevenção contra injeções.
- **Padronização de Código & Princípio DRY:** Diretrizes de nomenclatura, convenções de tipagem estrita (TypeScript/Python), tratamento idiomático de erros e aplicação do princípio DRY.
- **Padronização Linguística dos Contextos (`.md`):** Unificação em uma linguagem única de toda a documentação técnica e arquivos de contexto dos agentes (`AGENTS.md`, `docs/`, etc.), corrigindo a inconsistência atual que mesclou Português (PT-BR) e Inglês (EN) para assegurar clareza e uniformidade semântica nas instruções fornecidas à IA e aos desenvolvedores.

---

### 5. 📄 Flexibilidade Estrutural vs. Cópia Íntegra do Design da Escola (Limites da Solução)

> [!NOTE]
> **Transparência sobre os Limites Atuais:** É fundamental ser honesto sobre onde a solução atual se destaca e onde reside sua principal fronteira técnica.

- **O que foi alcançado (Flexibilidade Estrutural):**
  A arquitetura relacional e a orquestração da IA tornaram a **estrutura de dados plenamente flexível**. O sistema acomoda qualquer hierarquia temporal (Trimestre $\rightarrow$ Mês $\rightarrow$ Semana $\rightarrow$ Aula), adiciona ou remove colunas customizadas via padrão EAV (`Specification`), reordena campos nativos e dinâmicos, omite rótulos e calibra métricas pedagógicas com facilidade.

- **O Limite Atual (A Cópia Íntegra do Design Visual da Escola):**
  O verdadeiro desafio não superado na versão atual é a **reprodução fiel do design visual e da identidade gráfica original da escola**. Embora os dados e colunas sejam dinâmicos, o PDF final é compilado sobre um template HTML/CSS uniforme (padrão editorial A4). O motor atual não é capaz de replicar:
  - **Estilização Visual & Cores:** Cores de fundo institucionais (*backgrounds* específicos), marcas d'água e esquemas cromáticos personalizados de cabeçalhos e células.
  - **Tipografia Institucional:** Fontes específicas da instituição de ensino, famílias tipográficas proprietárias e escalas customizadas de `font-size` da folha de referência.
  - **Orientação & Geometria de Tabelas:** Rotação de tabelas, cabeçalhos com texto vertical, alternância de orientação no mesmo documento (páginas em retrato mescladas com tabelas em paisagem) e ajustes milimétricos de espaçamento.
  - **Grids Dinâmicos & Layouts Irregulares:** Grades assimétricas com mesclagens complexas de células (*rowspan* / *colspan* arbitrários) e blocos em cartões flutuantes característicos de modelos impressos não lineares.

- **Evolução Planejada:**
  Construção de uma camada de estilização paramétrica no microsserviço (`apps/engine`), combinando extração de tokens visuais (via Gemini Vision ou CSS parsing) com um gerador de folhas de estilo dinâmicas para aproximar a estética final da identidade gráfica real de cada escola parceira.

> 📌 **Issue de Referência:** *[A ser referenciada: feat(engine): estilização paramétrica e alta fidelidade visual de design por escola]* <!-- Espaço reservado para o link da issue -->

---

### 6. ⚛️ Estado Global & Camada de Integração HTTP no Frontend (Zustand & Axios)

- **Gerenciamento de Estado Global com Zustand:** Adoção de uma biblioteca dedicada de gerenciamento de estado global (**Zustand**) para criação de stores e hooks globais centralizados. Permite sincronizar estados reativos compartilhados entre múltiplos componentes (sessão ativa, histórico conversacional, progresso de streaming, estado do _Living Draft_ e modais de configuração), evitando *prop drilling* e reduzindo a dependência de estados locais fragmentados.
- **Camada de Integração Cliente $\rightarrow$ Servidor com Axios:** Implementação de uma camada de comunicação HTTP estruturada com **Axios** para a integração entre `apps/web` e a API NestJS (`apps/service`). Substitui chamadas `fetch` manuais e dispersas por instâncias pré-configuradas com `baseURL`, interceptors globais para telemetria/headers e tratamento unificado de erros, além de suporte nativo a cancelamento granular de requisições via `AbortController`.

---

### 7. 🌍 Internacionalização (i18n) & Localização Curricular Multi-País

- **Internacionalização Fullstack (i18n):** Implementação de arquitetura de i18n tanto no front-end quanto no back-end (mensagens de validação, payloads de resposta e interface do usuário), permitindo suporte fluido a múltiplos idiomas (como Português, Inglês e Espanhol).
- **Adaptação a Contextos e Matrizes Curriculares Internacionais:** Expansão da modelagem pedagógica para além do catálogo da BNCC brasileira. O objetivo é permitir que professores de qualquer país utilizem o copiloto para criar planejamentos ancorados nas diretrizes curriculares, etapas de ensino, terminologias e realidades culturais de seus próprios sistemas educacionais (ex.: *Common Core* e referenciais internacionais).

---

### 8. ♻️ Redução de Código Duplicado (DRY) & Centralização de Utilitários e Constantes

- **Pastas Estruturadas de `helpers/`, `utils/` e `constants/`:** Refatoração transversal no backend (`apps/service`) e no frontend (`apps/web`) para aplicação rigorosa do princípio DRY (*Don't Repeat Yourself*). Criação de diretórios dedicados para centralizar funções utilitárias puras (cálculos de datas, manipuladores de strings, ordenação), constantes de domínio, valores literais repetidos e helpers compartilhados que hoje se encontram dispersos ou duplicados em diferentes componentes e casos de uso.

---

### 9. 📥 Resiliência na Ingestão de PDFs de Referência & Bateria de Testes de Estresse

> [!NOTE]
> **Fidelidade Estrutural na Extração:** A ingestão de referências escolares via PDF lida com documentos visualmente heterogêneos e tabelas com geometrias não padronizadas, exigindo rigor contínuo na decomposição temporal.

- **Limitação Identificada em Testes Práticos (Falso Positivo de Segmentação):**
  Durante testes reais com documentos pedagógicos do Ensino Médio organizados em regime trimestral, observou-se que a esteira de extração/IA não realizou com precisão a divisão hierárquica descendente completa (`Trimestral` $\rightarrow$ `Mensal` $\rightarrow$ `Semanal`/`Weekly`). Em matrizes com layouts complexos, células mescladas ou quebras de página no meio de tabelas, o modelo tendeu a agrupar blocos incorretamente ou achatar a profundidade da árvore.

- **Bateria de Testes de Estresse (Benchmarking de Fidelidade):**
  Implementação de uma suíte automatizada de testes de estresse com um *corpus* diversificado de PDFs escolares reais (diferentes redes de ensino, anos escolares e regimes temporais: anual, semestral, trimestral e bimestral), medindo matematicamente a taxa de paridade entre a estrutura do documento de entrada e a árvore gerada no PostgreSQL.

- **Aprimoramento da Heurística de Decomposição Temporal:**
  Evolução dos prompts e parsers da esteira em duas camadas (`pdf-parse` + Gemini Vision) para identificar deterministamente marcos de calendário, quebras de mês letivo e numerações de semana antes da emissão do comando `REORGANIZE_TREE`, garantindo que planejamentos trimestrais sejam sempre desdobrados com fidelidade milimétrica até a granularidade diária ou semanal.

---

## 📚 Documentação Complementar

- 📖 [`docs/WORKFLOW.md`](docs/WORKFLOW.md): Diretrizes de portões de aprovação e fluxo de implementação da IA.
- 📖 [`docs/GITHUB.md`](docs/GITHUB.md): Regras de branches, convenções de commits, issues e PRs.
- 📖 [`apps/service/docs/planning/`](apps/service/docs/planning/README.md): Especificação arquitetural do planejamento pedagógico (modelagem de dados, regras de negócio, avaliações e catálogo de intenções).
- 📖 [`apps/web/docs/GLOBAL.md`](apps/web/docs/GLOBAL.md): Arquitetura do frontend, TanStack Router e diretrizes de interface.
