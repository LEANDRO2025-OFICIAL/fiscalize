import { createHash } from "node:crypto"; import { sql } from "drizzle-orm"; import type { NodePgDatabase } from "drizzle-orm/node-postgres"; export interface ResultadoVerificacao { ok: boolean; totalEventos: number; primeiroQuebra: number | null; } export async function verificarCadeia(db: NodePgDatabase): Promise<ResultadoVerificacao> {
  const res = await db.execute(sql`SELECT sequencia, hash_anterior, hash, payload FROM evento_auditoria ORDER BY sequencia ASC`);
  const eventos = res.rows as Array<{ sequencia: number; hash_anterior: string | null; hash: string; payload: string }>;
  let anterior: string | null = null;
  for (const e of eventos) {
    const esperado: string = createHash("sha256").update(anterior ?? "").update(e.payload).update(String(e.sequencia)).digest("hex");
    if (e.hash !== esperado || e.hash_anterior !== anterior) return { ok: false, totalEventos: eventos.length, primeiroQuebra: e.sequencia };
    anterior = e.hash;
  }
  return { ok: true, totalEventos: eventos.length, primeiroQuebra: null };
}