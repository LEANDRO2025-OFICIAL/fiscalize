import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Carrega o .env da raiz do monorepo para process.env (o Vitest não faz isso por padrão).
// Sem isso, os testes de integração caem no fallback localhost e falham longe do banco real.
const raiz = dirname(fileURLToPath(import.meta.url)); // este arquivo vive na raiz do monorepo
let bruto: string;
try {
  bruto = readFileSync(join(raiz, ".env"), "utf8");
} catch (e) {
  if (process.env.VITEST_DEBUG_ENV) console.log("[setup] .env não lido:", (e as Error).message);
  bruto = "";
}
for (const linha of bruto.split(/\r?\n/)) {
  const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  const valor = m[2].trim().replace(/^["']|["']$/g, "");
  // Sobrescreve também valor vazio: variável "definida mas vazia" conta como ausente.
  if (!process.env[m[1]] && valor !== "") process.env[m[1]] = valor;
}
if (process.env.VITEST_DEBUG_ENV) {
  const host = (u?: string) => u?.replace(/\/\/[^@]+@/, "//***@");
  console.log("[setup] DATABASE_URL:", host(process.env.DATABASE_URL));
  console.log("[setup] DIRECT_DATABASE_URL:", host(process.env.DIRECT_DATABASE_URL));
}
