# Backend Core (NestJS + Prisma + PostgreSQL) — Global Index

This document serves as the **Local Context Entry Point** for coding agents and developers working on `apps/api/`.

---

## 🎯 Role and Responsibilities

The **Backend Core** is the authoritative boundary for business logic, persistence, and orchestration of asynchronous workflows for this teacher lesson-planning MVP (**no authentication in this phase**). It mediates all interactions between the teacher-facing web application and the AI reasoning engine.

Core capabilities:

- **Standard CRUD:** Managing lesson plans and domain entities via Prisma/PostgreSQL.
- **Chunked Streaming & Cancellation:** Delivering incremental AI responses and handling mid-flight user cancellations.
- **File Ingestion:** Receiving and validating teacher-uploaded materials (images, PDF, DOCX).

---

## 🛡️ Always

All developers and agents must adhere strictly to the global invariants defined in root [AGENTS.md](../../AGENTS.md). In addition, `apps/api/` enforces:

- **Schema-First Discussion:** Never create or modify Prisma models or migrations without first discussing and validating the database structure with the user.
- **Architectural Sign-Off:** Consult and get approval from the user before making architectural decisions (module boundaries, adapters, storage strategy, or new patterns).
- **Strict Boundary:** All business logic, persistence, file validation, and AI orchestration must live inside `apps/api/`.

---

## 📖 Local Guidelines

Each guideline owns a single domain. Do not duplicate rules across files:

- [NESTJS.md](docs/NESTJS.md): Core NestJS conventions, module structure and testing.
- [STREAMS.md](docs/STREAMS.md): Outbound streaming responses (LLM token chunks), `StreamableFile`, stream cancellation, and state persistence hooks.
- [UPLOAD.md](docs/UPLOAD.md): Multipart file uploads, streaming ingestion, and validation for images (screenshots/photos), PDF, and DOCX.

---

## 🤖 Agent Skills

Instructions and skills for the Prisma ecosystem are centralized in `apps/api/docs/skills/`:

- [prisma-composer-core-concepts](docs/skills/prisma-composer-core-concepts/SKILL.md): Declarations, compute services (`compute()`), resources, and Prisma Composer architecture.
- [prisma-platform-core-concepts](docs/skills/prisma-platform-core-concepts/SKILL.md): Prisma Platform infrastructure, branch management, preview environments, and the Prisma CLI.
