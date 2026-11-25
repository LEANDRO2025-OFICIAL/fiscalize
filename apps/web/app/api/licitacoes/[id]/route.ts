import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { licitacao, lance } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_ALTERAR = ["administrador", "controlador"];
const SITUACOES = ["aberta", "em_andamento", "homologada", "deserta", "cancelada", "arquivada"];

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    if (!PODE_ALTERAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para alterar licitações." }, { status: 403 });

    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
    const situacao = txt("situacao", 20);
    if (!SITUACOES.includes(situacao)) return NextResponse.json({ erro: "Situação inválida." }, { status: 422 });

    const [atualizado] = await db.update(licitacao)
      .set({ situacao: situacao as any })
      .where(and(eq(licitacao.id, id), eq(licitacao.organizacaoId, sessao.organizacaoId)))
      .returning({ id: licitacao.id, situacao: licitacao.situacao });
    if (!atualizado) return NextResponse.json({ erro: "Licitação não encontrada." }, { status: 404 });

    await registrarEvento({ organizacaoId: sessao.organizacaoId, tipo: "alteracao", entidade: "licitacao", entidadeId: id, atorId: sessao.usuarioId, payload: { situacao } });

    return NextResponse.json({ ok: true, situacao: atualizado.situacao });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    if (!PODE_ALTERAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para excluir licitações." }, { status: 403 });

    const [removido] = await db.delete(licitacao)
      .where(and(eq(licitacao.id, id), eq(licitacao.organizacaoId, sessao.organizacaoId)))
      .returning({ id: licitacao.id });
    if (!removido) return NextResponse.json({ erro: "Licitação não encontrada." }, { status: 404 });

    await registrarEvento({ organizacaoId: sessao.organizacaoId, tipo: "exclusao", entidade: "licitacao", entidadeId: id, atorId: sessao.usuarioId, payload: {} });

    return NextResponse.json({ ok: true });
  });
}
