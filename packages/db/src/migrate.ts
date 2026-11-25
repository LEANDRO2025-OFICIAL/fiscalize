import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Usa DATABASE_URL (app role) por padrão; DIRECT_DATABASE_URL apenas se explicitamente definido.
// Nunca embaralha senha no código-fonte.
const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("ERRO: Defina DATABASE_URL ou DIRECT_DATABASE_URL no ambiente.");
  process.exit(1);
}
const sql = postgres(url, { max: 1 });

async function run() {
  try {
    // 1. DIAGNÓSTICO DE CONEXÃO
    const [dbInfo] = await sql`SELECT current_database() as name, current_user as user`;
    console.log("--- DIAGNÓSTICO DE CONEXÃO ---");
    if (!dbInfo) {
      console.error("ERRO CRÍTICO: Não foi possível consultar o banco de dados.");
      process.exit(1);
    }
    console.log("Conectado ao banco:", dbInfo.name, "como", dbInfo.user);

    if (dbInfo.name !== "contratacao_v2") {
      console.error("ERRO CRÍTICO: Você está conectado ao banco errado (" + dbInfo.name + ")!");
      console.error("O migrate deve rodar apenas no banco contratacao_v2.");
      process.exit(1);
    }

    // 2. MIGRAÇÕES — 100% aditivas, idempotentes. Nunca faz DROP TABLE.
    const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

    console.log(`Aplicando ${files.length} migration(s) aditiva(s)...`);
    for (const name of files) {
      console.log("aplicando", name);
      await sql.unsafe(readFileSync(join(dir, name), "utf8"));
    }
    console.log("✅ MIGRATIONS APLICADAS COM SUCESSO!");
  } catch (e) {
    console.error("❌ ERRO NA MIGRAÇÃO:", e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
