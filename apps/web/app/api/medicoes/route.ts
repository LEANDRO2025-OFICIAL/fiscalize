import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { contrato, medicao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { r2, saldoItens, type MemoriaMedicao } from "@/lib/medicao";

export async function POST(request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  if (!["administrador", "controlador", "fiscal"].includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para registrar medições." }, { status: 403 });
  const org = sessao.organizacaoId;

  const b = (await request.json().catch(() => null)) as { contratoId?: string; competencia?: string; itens?: Array<{ id: string; quantidade: number }>; glosas?: Array<{ valor: number; motivo: string }> } | null;
  if (!b?.contratoId || !/^\d{4}-\d{2}$/.test(b.competencia ?? "")) return NextResponse.json({ erro: "Informe o contrato e a competência (mês)." }, { status: 422 });
  const competencia = `${b.competencia}-01`;

  const [c] = await db.select({ id: contrato.id, numero: contrato.numero, situacao: contrato.situacao }).from(contrato).where(and(eq(contrato.id, b.contratoId), eq(contrato.organizacaoId, org)));
  if (!c) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
  if (c.situacao !== "vigente") return NextResponse.json({ erro: "Só é possível medir contratos vigentes." }, { status: 409 });

  const [dup] = await db.select({ id: medicao.id }).from(medicao).where(and(eq(medicao.contratoId, c.id), eq(medicao.competencia, competencia), ne(medicao.situacao, "rejeitada")));
  if (dup) return NextResponse.json({ erro: "Já existe medição para esta competência.", id: dup.id }, { status: 409 });

  const ids = (b.itens ?? []).filter((i) => Number(i.quantidade) > 0).map((i) => i.id);
  if (new Set(ids).size !== ids.length) return NextResponse.json({ erro: "Item repetido: informe cada item uma única vez." }, { status: 422 });

  return db.transaction(async (tx) => {
  // Serializa medições do mesmo contrato: evita estourar o saldo com requisições simultâneas.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${c.id}))`);
  const saldo = await saldoItens(c.id, org);
  const linhas: MemoriaMedicao["linhas"] = [];
  for (const it of b.itens ?? []) {
    const q = Number(it.quantidade);
    if (!(q > 0)) continue;
    const s = saldo.find((x) => x.id === it.id);
    if (!s) return NextResponse.json({ erro: "Item inválido." }, { status: 422 });
    if (q > s.saldo + 1e-9) return NextResponse.json({ erro: `"${s.descricao}": quantidade acima do saldo (${s.saldo} ${s.unidade}).` }, { status: 422 });
    linhas.push({ descricao: s.descricao, unidade: s.unidade, quantidade: q, unitario: s.unitario, subtotal: r2(q * s.unitario) });
  }
  if (!linhas.length) return NextResponse.json({ erro: "Informe a quantidade medida em ao menos um item." }, { status: 422 });

  const glosas = (b.glosas ?? []).map((g) => ({ valor: r2(Number(g.valor)), motivo: String(g.motivo ?? "").trim().slice(0, 300) })).filter((g) => g.valor > 0);
  if (glosas.some((g) => !g.motivo)) return NextResponse.json({ erro: "Toda glosa precisa de motivo." }, { status: 422 });
  const bruto = r2(linhas.reduce((s, l) => s + l.subtotal, 0));
  const totalGlosa = r2(glosas.reduce((s, g) => s + g.valor, 0));
  if (totalGlosa > bruto) return NextResponse.json({ erro: "As glosas superam o valor bruto." }, { status: 422 });

  const memoria: MemoriaMedicao = { linhas, glosas, bruto, liquido: r2(bruto - totalGlosa) };
  const [{ prox }] = (await tx.select({ prox: sql<number>`coalesce(max(${medicao.numero}), 0) + 1` }).from(medicao).where(eq(medicao.contratoId, c.id))) as [{ prox: number }];
  const [m] = await tx.insert(medicao).values({
    organizacaoId: org, contratoId: c.id, numero: prox, competencia, situacao: "rascunho",
    valorBruto: bruto.toFixed(2), valorGlosa: totalGlosa.toFixed(2), valorLiquido: memoria.liquido.toFixed(2),
    memoriaCalculo: JSON.stringify(memoria), criadoPorId: sessao.usuarioId,
  }).returning({ id: medicao.id });
  await registrarEvento({ organizacaoId: org, tipo: "medicao", entidade: "medicao", entidadeId: m!.id, atorId: sessao.usuarioId, payload: { contrato: c.numero, numero: prox, situacao: "rascunho", liquido: memoria.liquido } });
  return NextResponse.json({ id: m!.id }, { status: 201 });
  });
  });
}
