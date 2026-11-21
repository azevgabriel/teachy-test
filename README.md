# Teachy Test

Repositório monorepo do teste técnico Teachy.

---

## 🚀 Como Rodar o Backend (`apps/service`)

Guia simples para configurar o ambiente, inicializar o banco de dados PostgreSQL e rodar o servidor NestJS via Docker.

### 1. Configurar o `.env`

Acesse a pasta do serviço:
```bash
cd apps/service
```

Você tem duas formas simples de gerar o `.env`:

#### Opção A (Interativa via CLI):
Execute o script interativo que solicita suas credenciais (ou aceita os valores padrão com `Enter`) e gera o `.env` com a `DATABASE_URL` autocompletada:
```bash
npm run env:setup
```

#### Opção B (Cópia direta com defaults do Docker):
Copie o modelo de fallback padrão do Docker Compose:
```bash
cp .env.example .env
```

---

### 2. Rodar o Docker (PostgreSQL + Servidor NestJS)

Dentro de `apps/service`:
```bash
# Subir os containers em segundo plano
docker compose up -d

# Verificar se os containers estão saudáveis
docker compose ps

# Acompanhar os logs
docker compose logs -f
```

- **PostgreSQL:** Disponível em `localhost:5432`.
- **API NestJS:** Disponível em `http://localhost:3000` (verifique com `curl http://localhost:3000`).

---

### 3. ⚠️ Alterou as credenciais no `.env` e deu erro no banco?

No Docker, a imagem oficial do PostgreSQL só cria o banco e os usuários na **primeiríssima inicialização** do volume. Se você mudar `POSTGRES_DB`, `POSTGRES_USER` ou `POSTGRES_PASSWORD` no `.env` depois que o volume já foi criado, o Postgres ignora as novas variáveis e acusa que a base não existe.

Para corrigir e recriar o banco do zero com as novas credenciais, basta **limpar o volume**:
```bash
# Remove os containers e o volume antigo
docker compose down -v

# Sobe novamente recriando o banco com as novas configurações
docker compose up -d
```

---

### 4. Scripts Úteis do Prisma (Execução Local)

```bash
# Validar os schemas modulares em prisma/models/
npx prisma validate

# Gerar o cliente tipado
npm run prisma:generate

# Criar e aplicar migrações
npm run prisma:migrate

# Executar o seed de dados
npm run prisma:seed
```
