import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

const rl = readline.createInterface({ input, output });

async function ask(question, defaultValue) {
  const answer = await rl.question(`${question} [${defaultValue}]: `);
  return answer.trim() || defaultValue;
}

async function main() {
  console.log('\n🔧 Configuração Interativa do .env\n');

  const user = await ask('👤 Usuário do PostgreSQL (POSTGRES_USER)', 'postgres');
  const password = await ask('🔑 Senha do PostgreSQL (POSTGRES_PASSWORD)', 'postgres');
  const db = await ask('📦 Nome do Banco (POSTGRES_DB)', 'teachy_db');
  const port = await ask('🔌 Porta do PostgreSQL (POSTGRES_PORT)', '5432');
  const appPort = await ask('🚀 Porta da Aplicação NestJS (PORT)', '3000');

  const envContent = `# -----------------------------------------------------------------------------
# Database Configuration (PostgreSQL)
# -----------------------------------------------------------------------------
POSTGRES_USER=${user}
POSTGRES_PASSWORD=${password}
POSTGRES_DB=${db}
POSTGRES_PORT=${port}

# -----------------------------------------------------------------------------
# Application Connection String
# -----------------------------------------------------------------------------
DATABASE_URL="postgresql://${user}:${password}@localhost:${port}/${db}?schema=public"

# -----------------------------------------------------------------------------
# Server Configuration (NestJS)
# -----------------------------------------------------------------------------
PORT=${appPort}
`;

  const envPath = path.resolve(import.meta.dirname, '../.env');
  fs.writeFileSync(envPath, envContent, 'utf-8');
  console.log(`\n✅ Arquivo .env gerado com sucesso em: ${envPath}\n`);
  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
