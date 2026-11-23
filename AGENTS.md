# TeachyTest — Instructions for Coding Agents

This document defines the core invariants, operating workflows, and context boundaries for coding agents working in the `teachy-test` monorepo.

---

## 🛡️ Always

1. **Strict Context Grounding:** Before creating code or proposing architecture, agents must anchor themselves in the target domain's documentation (`apps/web/docs/` or `apps/service/docs/`). Never mix patterns between applications.
2. **GitHub & Git Execution Boundaries:** Follow [docs/GITHUB.md](docs/GITHUB.md) strictly. Autonomous actions without confirmation (unauthorized issue creation, direct commits to `main`, unapproved pushes, unrequested PRs) are strictly prohibited. However, **upon receiving explicit user confirmation** (e.g., `"pode criar a issue"`, `"agora podemos subir o PR"`), Antigravity is fully authorized, capable, and responsible for creating the issue and the Pull Request itself directly (via MCP or GitHub API) without requiring manual creation by the user. **Zero Interactive Card Delegation:** Agents must NEVER instruct the user to "locate an interactive card/form and click Submit/Confirm" — if an MCP tool triggers an interactive form or pauses, the agent must execute the creation directly via the GitHub REST API using the configured token.
3. **Decoupled Workflows & Human Gates:** Follow [docs/WORKFLOW.md](docs/WORKFLOW.md) strictly. The Decision-Making Workflow (interactive issue framing) and the Implementation Workflow (coding against an authorized issue) are strictly separated. One never automatically triggers the other.
4. **Zero Credential Exposure:** Never expose or hardcode credentials (passwords, connection strings, API keys, tokens) in source code, test files, Docker configurations, or documentation (`.md`). Credentials must always reside in `.env` files (with sanitized templates in `.env.example`) and be injected dynamically into tests, the application runtime, or Docker containers via environment variables.

---

## 📚 Global Documentation

| Document                                | Purpose                                                                                           |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------ |
| 📖 [docs/WORKFLOW.md](docs/WORKFLOW.md) | Fluxo de trabalho da IA: tomada de decisão, portões de aprovação humana e ciclo de implementação. |
| 📖 [docs/GITHUB.md](docs/GITHUB.md)     | GitHub & MCP guidelines: agent permissions, issue tracking, branch conventions, and PR workflow.  |

---

## 🗺️ Monorepo Domains & Context Entry Points

The monorepo is divided into strict domains. Before modifying any application, the agent **MUST** read the entry point document indicated in the table below.

| Path            | Tech Stack & Role                                                                                                              | Local Context Entry Point                                                                                                                                                     |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/service/` | **Backend Core (NestJS + Prisma + PostgreSQL):** Business logic, persistence, lesson planning orchestration, and AI streaming. | 📖 Read [`apps/service/docs/GLOBAL.md`](apps/service/docs/GLOBAL.md) (and [`apps/service/docs/planning/`](apps/service/docs/planning/README.md) for lesson planning features) |
| `apps/web/`     | **Frontend (React + TanStack Router + Tailwind CSS):** Teacher-facing interactive UI.                                          | 📖 Read [`apps/web/docs/GLOBAL.md`](apps/web/docs/GLOBAL.md)                                                                                                                  |

---
