import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

const rl = readline.createInterface({ input, output });

function parseExistingEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

async function ask(question, defaultValue = '') {
  const displayDefault = defaultValue ? ` [${defaultValue}]` : '';
  const answer = await rl.question(`${question}${displayDefault}: `);
  return answer.trim() || defaultValue;
}

async function main() {
  console.log('\n🔧 Configuração Interativa do .env\n');

  const envPath = path.resolve(import.meta.dirname, '../.env');
  const existing = parseExistingEnv(envPath);

  // PostgreSQL
  const user = await ask('👤 Usuário do PostgreSQL (POSTGRES_USER)', existing.POSTGRES_USER || 'postgres');
  const password = await ask('🔑 Senha do PostgreSQL (POSTGRES_PASSWORD)', existing.POSTGRES_PASSWORD || 'postgres');
  const db = await ask('📦 Nome do Banco (POSTGRES_DB)', existing.POSTGRES_DB || 'teachy_db');
  const port = await ask('🔌 Porta do PostgreSQL (POSTGRES_PORT)', existing.POSTGRES_PORT || '5432');

  // NestJS
  const appPort = await ask('🚀 Porta da Aplicação NestJS (PORT)', existing.PORT || '3000');

  // Google Gemini AI
  console.log('\n🤖 Configuração da Inteligência Artificial (Google Gemini)');
  const geminiApiKey = await ask('🔑 Chave da API do Gemini (GEMINI_API_KEY)', existing.GEMINI_API_KEY || '');
  const geminiModel = await ask('🧠 Modelo do Gemini (GEMINI_MODEL)', existing.GEMINI_MODEL || 'gemini-3.8-flash');

  // Rendering Engine
  console.log('\n📄 Configuração do Microsserviço de Conversão (Engine PDF/DOCX)');
  const enginePort = await ask('⚙️  Porta da Engine (ENGINE_PORT)', existing.ENGINE_PORT || '8080');
  const defaultEngineUrl = `http://localhost:${enginePort}/2015-03-31/functions/function/invocations`;
  const engineUrl = await ask('🌐 URL de Invocação da Engine (ENGINE_URL)', existing.ENGINE_URL || defaultEngineUrl);

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

# -----------------------------------------------------------------------------
# Google Gemini Configuration
# -----------------------------------------------------------------------------
GEMINI_API_KEY="${geminiApiKey}"
GEMINI_MODEL="${geminiModel}"

# -----------------------------------------------------------------------------
# Rendering Engine Microservice (AWS Lambda RIE)
# -----------------------------------------------------------------------------
ENGINE_PORT=${enginePort}
ENGINE_URL="${engineUrl}"
`;

  fs.writeFileSync(envPath, envContent, 'utf-8');
  console.log(`\n✅ Arquivo .env gerado com sucesso em: ${envPath}\n`);
  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
