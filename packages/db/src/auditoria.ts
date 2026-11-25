import { createHash } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { eventoAuditoria } from "./schema";

export interface NovoEvento {
  organizacaoId: string;
  tipo: "criacao" | "alteracao" | "exclusao" | "login" | "designacao" | "medicao" | "evidencia" | "aditivo" | "penalidade";
  entidade: string;
  entidadeId?: string | null;
  atorId?: string | null;
  payload: Record<string, unknown>;
}

function canonico(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonico);
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.keys(o).sort().reduce<Record<string, unknown>>((a, k) => ((a[k] = canonico(o[k])), a), {});
  }
  return v;
}

// Trilha append-only: cada evento carrega o hash do anterior, por órgão.
export async function registrarEvento(e: NovoEvento): Promise<{ sequencia: number; hash: string }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.organizacao_id', ${e.organizacaoId}, true)`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${e.organizacaoId}))`);
    const [ultimo] = await tx
      .select({ sequencia: eventoAuditoria.sequencia, hash: eventoAuditoria.hash })
      .from(eventoAuditoria)
      .where(eq(eventoAuditoria.organizacaoId, e.organizacaoId))
      .orderBy(desc(eventoAuditoria.sequencia))
      .limit(1);
    const hashAnterior = ultimo?.hash ?? null;
    const sequencia = Number(ultimo?.sequencia ?? 0) + 1;
    const payload = JSON.stringify(canonico(e.payload));
    const hash = createHash("sha256").update(hashAnterior ?? "").update(payload).update(String(sequencia)).digest("hex");
    await tx.insert(eventoAuditoria).values({
      sequencia,
      organizacaoId: e.organizacaoId,
      tipo: e.tipo,
      entidade: e.entidade,
      entidadeId: e.entidadeId ?? null,
      atorId: e.atorId ?? null,
      payload,
      hashAnterior,
      hash,
    });
    return { sequencia, hash };
  });
}
