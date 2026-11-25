import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { sessaoAtiva } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_VER = ["administrador", "controlador"];

type Params = { params: Promise<{ id: string }> };

// DELETE - invalida uma sessão ativa (logout forçado)
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const sessao = await getSessao();
  if (!PODE_VER.includes(sessao.papel)) {
    return NextResponse.json({ erro: "Sem permissão para invalidar sessões." }, { status: 403 });
  }
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const [atualizado] = await db.update(sessaoAtiva)
      .set({ ativo: false })
      .where(and(eq(sessaoAtiva.id, id), eq(sessaoAtiva.organizacaoId, sessao.organizacaoId)))
      .returning({ id: sessaoAtiva.id });
    if (!atualizado) return NextResponse.json({ erro: "Sessão não encontrada." }, { status: 404 });

    return NextResponse.json({ ok: true });
  });
}
