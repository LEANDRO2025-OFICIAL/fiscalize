import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { ocorrencia } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

// Resolve uma ocorrência aberta, registrando o que foi feito.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  if (!["administrador", "controlador", "fiscal"].includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  const b = (await request.json().catch(() => null)) as { resolucao?: string } | null;
  const resolucao = String(b?.resolucao ?? "").trim().slice(0, 1000);
  if (resolucao.length < 5) return NextResponse.json({ erro: "Descreva como a ocorrência foi resolvida." }, { status: 422 });

  const [o] = await db.update(ocorrencia).set({ status: "resolvida", resolucao, resolvidaEm: new Date() })
    .where(and(eq(ocorrencia.id, id), eq(ocorrencia.organizacaoId, sessao.organizacaoId), eq(ocorrencia.status, "aberta"))).returning({ id: ocorrencia.id });
  if (!o) return NextResponse.json({ erro: "Ocorrência não encontrada ou já resolvida." }, { status: 404 });
  await registrarEvento({ organizacaoId: sessao.organizacaoId, tipo: "alteracao", entidade: "ocorrencia", entidadeId: id, atorId: sessao.usuarioId, payload: { status: "resolvida", resolucao } });
  return NextResponse.json({ ok: true });
  });
}
