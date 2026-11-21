# Frontend Web Client (React + TanStack Router + Tailwind CSS) — Global Index

This document serves as the **Local Context Entry Point** for coding agents and developers working on `apps/web/`.

---

## 🎯 Role and Responsibilities

The **Frontend Web Client** is the teacher-facing interactive application for the lesson-planning MVP (**no authentication in this phase**). It delivers an intuitive, responsive, and accessible interface for teachers to upload curriculum materials, configure pedagogical parameters, inspect streaming AI-generated lesson plans in real-time, and cancel generations mid-flight.

Core capabilities:

- **Dual Communication Architecture (Decisão Arquitetural):**
  - **Retornos de LLM:** Sempre streaming em tempo real via Server-Sent Events (SSE) ou chunked fetch, com cancelamento mid-flight.
  - **Consultas & CRUD de Banco de Dados:** REST comum com `async/await` (ex.: requisições `GET` para buscar sessões salvas, metadados ou listagens persistidas no banco).
- **Interactive Lesson Planning:** Configuring subjects, grade levels, pedagogical goals, and custom constraints.
- **Real-Time Streaming Consumer:** Ingesting chunked AI token streams via Server-Sent Events (SSE) or streaming fetch, rendering live markdown, and providing cooperative mid-flight cancellation.
- **Reference Material Upload:** Drag-and-drop file ingestion interface supporting images (PNG, JPEG, WebP), PDF, and Word documents (DOCX) with client-side validation and visual previews.
- **Design System & Component Architecture:** Fully typed, accessible component library based on **shadcn/ui**, **Radix UI**, and **Tailwind CSS v4**.

---

## 🛡️ Always

All developers and agents must adhere strictly to the global invariants defined in root [AGENTS.md](../../AGENTS.md) and [docs/GITHUB.md](../../docs/GITHUB.md). In addition, `apps/web/` enforces:

- **Estratégia de Comunicação Segregada:** Retornos de LLM utilizam **sempre** streaming em tempo real com `AbortController`. Chamadas de leitura direta ao banco de dados (ex: `GET` de entidades, sessões ou históricos) utilizam **sempre** o padrão REST tradicional com `async/await`.
- **Biome Compliance:** All code must pass Biome formatting and linting (`npm run check` or `npx @biomejs/biome check`). Follow established conventions: tab indentation and double quotes for JavaScript/TypeScript.
- **Component Discipline with shadcn/ui:** Never create ad-hoc primitive UI components (buttons, dialogs, dropdowns, inputs, tabs, sheets, toasts) from scratch. Always utilize **shadcn/ui** components or Radix UI primitives.
- **Type Safety & Strict Boundaries:** Maintain strict TypeScript compliance (`noImplicitAny`, strict null checks). Use path aliases (`#/*` or `@/*` mapping to `./src/*`) and never use `any`.
- **Cooperative Streaming & Cancellation:** Every AI streaming interaction must bind an `AbortController` and provide an accessible, immediate "Cancel" trigger for the teacher.
- **Type-Safe Routing:** All routes must follow TanStack Router file-based conventions (`createFileRoute`). Never manipulate route files manually without running route generation (`npm run generate-routes`).
- **Review Gate Before Commit & Push:** Follow the strict GitHub guidelines in [docs/GITHUB.md](../../docs/GITHUB.md): never commit or push autonomously. Stop and present code diffs for user review and explicit sign-off.

---

## 🔄 Estratégia de Comunicação: Streaming vs. Async/Await (REST)

O front-end combina duas abordagens de comunicação complementares baseadas no caso de uso:

| Caso de Uso | Estratégia | Protocolo / Padrão | Onde Aplicar |
| :--- | :--- | :--- | :--- |
| **Geração de Conteúdo com IA (LLM)** | **Streaming em Tempo Real** | SSE (`@Sse()`) ou chunked stream + `AbortController` | Geração do plano de aula, refinamento pedagógico de texto e qualquer resposta de modelo de linguagem. Detalhes em [`STREAMING.md`](STREAMING.md). |
| **Consultas ao Banco de Dados & CRUD** | **REST Tradicional (`async/await`)** | HTTP padrão (`fetch`/Axios) via Promises assíncronas | Requisições `GET` diretas ao banco (ex: listar planos salvos, recuperar sessão via query param em loaders do TanStack Router, buscar dados estáticos). Detalhes em [`ROUTER.md`](ROUTER.md). |

---

## 📖 Local Guidelines

Each guideline owns a single domain. Do not duplicate rules across files:

- [ROUTER.md](ROUTER.md): Convenções de rotas com TanStack Router, validação de search params/query params, prefetching de contexto via loader, navegação tipada e auxílio via TanStack MCP.
- [SHADCN.md](SHADCN.md): Arquitetura de componentes shadcn/ui, estilização com Tailwind CSS v4, primitivos Radix UI e auxílio via shadcn MCP para criação do UI/UX.
- [STREAMING.md](STREAMING.md): Inbound AI token stream consumption (SSE/fetch), AbortController cancellation lifecycle, live markdown rendering, and multipart file upload UX.

---

## 🤖 Diretrizes de Uso de MCP pelo Agente (Quando Usar Qual)

Ao desenvolver em `apps/web/`, o agente tem à disposição Model Context Protocols (MCP) especializados para acelerar e garantir a qualidade do código. O agente deve direcionar o uso conforme o contexto da tarefa:

### 1. UI/UX & Componentes de Tela → Usar **shadcn MCP**
- **Quando usar:** Sempre que estiver lidando com criação, refatoração, estilização ou inspeção de componentes visuais e interface do professor (botões, cards, dialogs, inputs, progress bars, drawers, toasts, etc.).
- **Como auxilia:** Permite consultar registries oficiais e customizados, verificar esquemas de componentes, inspecionar propriedades/variantes e compor o design system sem criar elementos primitivos ad-hoc.
- **Referência:** Veja os detalhes e diretrizes em [`SHADCN.md`](SHADCN.md).

### 2. Navegação, Rotas & Parâmetros de URL → Usar **TanStack MCP**
- **Quando usar:** Sempre que estiver estruturando rotas, criando novas páginas, configurando layouts aninhados (`_layout.tsx`), validando search/query params (`validateSearch`), orquestrando busca de dados em loaders (`loaderDeps` / `loader`) ou implementando navegação tipada (`<Link>` / `useNavigate`).
- **Como auxilia:** Oferece suporte às convenções do TanStack Router para manter tipagem estrita na árvore de rotas e consistência nos fluxos de navegação.
- **Referência:** Veja os padrões de implementação em [`ROUTER.md`](ROUTER.md).
