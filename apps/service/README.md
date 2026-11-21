# Teachy Test — Backend Core (`apps/service`)

Backend NestJS integrado com Prisma ORM e PostgreSQL, orquestrado via Docker Compose.

---

## 🚀 Como Rodar

### 1. Configurar o `.env`

#### Opção A (Interativa via CLI):
```bash
npm run env:setup
```
*Solicita as credenciais no terminal e gera o `.env` com a `DATABASE_URL` autocompletada.*

#### Opção B (Cópia direta):
```bash
cp .env.example .env
```

---

### 2. Rodar via Docker Compose

```bash
# Subir os containers (PostgreSQL + NestJS)
docker compose up -d

# Status dos containers
docker compose ps

# Logs
docker compose logs -f
```

- Endpoint HTTP: `http://localhost:3000`
- Porta do Banco: `localhost:5432`

---

### 3. ⚠️ Alterou credenciais e o banco não foi criado?

Se alterar `POSTGRES_DB` ou `POSTGRES_USER` após o volume já ter sido inicializado, limpe o volume antigo para que o PostgreSQL rode a inicialização com as novas credenciais:
```bash
docker compose down -v
docker compose up -d
```

---

### 4. Scripts do Prisma

```bash
npm run prisma:generate  # Gera o Prisma Client
npm run prisma:migrate   # Cria e aplica migrações
npm run prisma:seed      # Popula o banco com seeds
```
