import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { contrato, itemContratado, medicao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_EDITAR = ["administrador", "controlador", "fiscal"];

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  if (!PODE_EDITAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  const org = sessao.organizacaoId;

  const [c] = await db.select({ id: contrato.id }).from(contrato).where(and(eq(contrato.id, id), eq(contrato.organizacaoId, org)));
  if (!c) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
  const [m] = await db.select({ n: sql<number>`count(*)::int` }).from(medicao).where(eq(medicao.contratoId, id));
  if ((m?.n ?? 0) > 0) return NextResponse.json({ erro: "O contrato já tem medições; os itens não podem mais ser alterados." }, { status: 409 });

  const corpo = (await request.json().catch(() => null)) as { itens?: Array<Record<string, unknown>> } | null;
  const lista = corpo?.itens ?? [];
  if (lista.length < 1 || lista.length > 100) return NextResponse.json({ erro: "Informe de 1 a 100 itens." }, { status: 422 });
  const itens = lista.map((i, n) => ({
    organizacaoId: org, contratoId: id, ordem: n + 1,
    descricao: String(i.descricao ?? "").trim().slice(0, 200), unidadeMedida: String(i.unidade ?? "").trim().slice(0, 10),
    q: Number(i.quantidade), v: Number(i.valorUnitario),
  }));
  if (itens.some((i) => !i.descricao || !i.unidadeMedida || !(i.q > 0) || !(i.v >= 0) || i.q > 1e9 || i.v > 1e12)) {
    return NextResponse.json({ erro: "Cada item precisa de descrição, unidade, quantidade maior que zero e valor unitário válido." }, { status: 422 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(itemContratado).where(and(eq(itemContratado.contratoId, id), eq(itemContratado.organizacaoId, org)));
    await tx.insert(itemContratado).values(itens.map(({ q, v, ...i }) => ({ ...i, quantidadeTotal: String(q), valorUnitario: v.toFixed(2) })));
  });
  const total = itens.reduce((s, i) => s + i.q * i.v, 0);
  await registrarEvento({ organizacaoId: org, tipo: "alteracao", entidade: "contrato", entidadeId: id, atorId: sessao.usuarioId, payload: { campo: "itens", quantidade: itens.length, total } });
  return NextResponse.json({ ok: true, total });
  });
}
