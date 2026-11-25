import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { contrato, designacao, usuario } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  if (!["administrador", "controlador"].includes(sessao.papel)) return NextResponse.json({ erro: "Só administrador ou controlador designa o fiscal." }, { status: 403 });
  const org = sessao.organizacaoId;

  const b = (await request.json().catch(() => null)) as { fiscalId?: string; portaria?: string; dataInicio?: string } | null;
  const portaria = String(b?.portaria ?? "").trim().slice(0, 120);
  const dataInicio = String(b?.dataInicio ?? "");
  if (!b?.fiscalId || !portaria || !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) return NextResponse.json({ erro: "Informe o fiscal, a portaria e a data de início." }, { status: 422 });

  const [c] = await db.select({ id: contrato.id }).from(contrato).where(and(eq(contrato.id, id), eq(contrato.organizacaoId, org)));
  if (!c) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
  const [f] = await db.select({ id: usuario.id }).from(usuario).where(and(eq(usuario.id, b.fiscalId), eq(usuario.organizacaoId, org), eq(usuario.papel, "fiscal")));
  if (!f) return NextResponse.json({ erro: "Fiscal inválido." }, { status: 422 });

  const nova = await db.transaction(async (tx) => {
    await tx.update(designacao).set({ ativo: "nao", dataFim: dataInicio }).where(and(eq(designacao.contratoId, id), eq(designacao.ativo, "sim")));
    const [d] = await tx.insert(designacao).values({ organizacaoId: org, contratoId: id, fiscalId: f.id, portaria, dataInicio }).returning({ id: designacao.id });
    await tx.update(contrato).set({ fiscalId: f.id }).where(eq(contrato.id, id));
    return d!;
  });
  await registrarEvento({ organizacaoId: org, tipo: "designacao", entidade: "designacao", entidadeId: nova.id, atorId: sessao.usuarioId, payload: { contratoId: id, fiscalId: f.id, portaria, dataInicio } });
  return NextResponse.json({ ok: true });
  });
}
