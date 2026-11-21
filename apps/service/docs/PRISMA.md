# Prisma ORM Operational Guidelines (`PRISMA.md`)

This document guides developers and coding agents on the standard workflow for creating and managing **Models**, **Migrations**, and **Seeds** in `apps/service/`.

---

## 📁 Prisma Directory Structure

```text
apps/service/
├── prisma.config.ts           # Centralized CLI configuration (datasource, migrations, seed)
└── prisma/
    ├── schema.prisma          # Base schema: datasource and generator client definitions
    ├── models/                # Modular entity schemas (*.prisma)
    │   └── .gitkeep
    ├── migrations/            # Tracked SQL migration history
    │   └── .gitkeep
    ├── seed/                  # Modular seed routines and fixtures
    │   └── seed.ts
    └── seed.ts                # Main seed entrypoint (invoked via tsx)
```

---

## 1. 🧩 Working with Models (`prisma/models/`)

Prisma natively discovers and compiles all `.prisma` files inside the `prisma/models/` directory without requiring manual imports or preview feature flags.

### Rules & Conventions:
- **Entity Modularity:** Maintain one file per entity or bounded context (e.g., `author.prisma`, `post.prisma`, `item.prisma`).
- **Table Name Mapping:** Always use `@@map("table_names")` to enforce snake_case plural naming in the database.
- **Cross-File Relations:** Models defined across separate `.prisma` files can reference each other directly:

```prisma
// prisma/models/author.prisma
model Author {
  id        String   @id @default(uuid())
  name      String
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("authors")
}
```

```prisma
// prisma/models/post.prisma
model Post {
  id        String   @id @default(uuid())
  title     String
  authorId  String
  author    Author   @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("posts")
}
```

- **Schema Validation:** Always validate schema consistency before creating migrations:
  ```bash
  npx prisma validate
  ```

---

## 2. 🚀 Working with Migrations (`prisma/migrations/`)

Any structural change to models requires an automated and versioned migration.

### Creating and Applying a Migration:
After adding or modifying files in `prisma/models/`, run:

```bash
npm run prisma:migrate -- --name <migration_name>
```

This command automatically:
1. Compares your current schema against the target database.
2. Generates the SQL migration script in `prisma/migrations/<timestamp>_<name>/migration.sql`.
3. Applies the SQL script to the local database.
4. Regenerates the typed `@prisma/client`.

### Resetting the Local Database:
To discard local test data and reapply all migrations from scratch:

```bash
npx prisma migrate reset
```
*(Note: This resets the schema, applies migrations sequentially, and runs the seed script automatically).*

_(Nota: Este comando limpa o banco, reaplica as migrações em ordem e executa o seed automaticamente)._

---

## 3. 🌱 Working with Seeds (`prisma/seed/` and `prisma/seed.ts`)

The seeding pipeline is separated into two layers for clean scalability:

1. **`prisma/seed/` (Modular Fixtures & Handlers):**
   - Houses domain-specific seeding functions and fixture data.
   - **Best Practice:** Ensure idempotency (using `upsert` or checking entity counts before inserting).

   ```ts
   // prisma/seed/seed.ts
   import type { PrismaClient } from '@prisma/client';

   export async function runSeed(prisma: PrismaClient) {
     // Idempotent seeding logic:
     // await prisma.author.upsert({ ... });
   }
   ```

2. **`prisma/seed.ts` (Execution Entrypoint):**
   - Initializes the database connection using the `@prisma/adapter-pg` driver adapter and invokes routines from `prisma/seed/`.
   - Executed automatically during `prisma migrate reset` or on manual invocation.

### Running Seeds Manually:

```bash
npm run prisma:seed
```

---

## 📋 Command Reference

| Command | Description |
| :--- | :--- |
| `npx prisma validate` | Validates all schema definitions inside `prisma/models/`. |
| `npm run prisma:generate` | Regenerates `@prisma/client` in `node_modules/@prisma/client`. |
| `npm run prisma:migrate` | Creates a new SQL migration and applies it to the database. |
| `npm run prisma:seed` | Runs the seed script via `tsx`. |
| `npx prisma migrate reset` | Resets the database and reapplies all migrations and seeds. |
