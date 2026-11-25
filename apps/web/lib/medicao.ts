import { and, asc, eq, ne } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { itemContratado, medicao } from "@contratacao/db/schema";

export interface LinhaMemoria { descricao: string; unidade: string; quantidade: number; unitario: number; subtotal: number }
export interface MemoriaMedicao {
  linhas: LinhaMemoria[];
  glosas: Array<{ valor: number; motivo: string }>;
  bruto: number;
  liquido: number;
  rejeicao?: { motivo: string; por: string };
}

export const lerMemoria = (t: string | null): MemoriaMedicao | null => {
  if (!t) return null;
  try { return JSON.parse(t) as MemoriaMedicao; } catch { return null; }
};

export const r2 = (n: number) => Math.round(n * 100) / 100;

// Saldo por item: contratado menos o já medido em medições não rejeitadas.
export async function saldoItens(contratoId: string, organizacaoId: string) {
  return comOrganizacao(organizacaoId, async (db) => {
  const itens = await db.select().from(itemContratado).where(and(eq(itemContratado.contratoId, contratoId), eq(itemContratado.organizacaoId, organizacaoId))).orderBy(asc(itemContratado.ordem));
  const meds = await db.select({ m: medicao.memoriaCalculo }).from(medicao).where(and(eq(medicao.contratoId, contratoId), eq(medicao.organizacaoId, organizacaoId), ne(medicao.situacao, "rejeitada")));
  const usado = new Map<string, number>();
  for (const { m } of meds) for (const l of lerMemoria(m)?.linhas ?? []) usado.set(l.descricao, (usado.get(l.descricao) ?? 0) + l.quantidade);
  return itens.map((i) => {
    const total = Number(i.quantidadeTotal);
    const u = usado.get(i.descricao) ?? 0;
    return { id: i.id, descricao: i.descricao, unidade: i.unidadeMedida, total, unitario: Number(i.valorUnitario), usado: u, saldo: Math.max(0, r2(total - u)) };
  });
  });
}
