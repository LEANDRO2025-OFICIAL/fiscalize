import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { recebimento } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_ALTERAR = ["administrador", "controlador", "fiscal"];
const SITUACOES = ["pendente", "conforme", "divergente"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const [r] = await db
      .select()
      .from(recebimento)
      .where(and(eq(recebimento.id, id), eq(recebimento.organizacaoId, sessao.organizacaoId)));
    if (!r) return NextResponse.json({ erro: "Recebimento não encontrado." }, { status: 404 });
    return NextResponse.json({ recebimento: r });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    if (!PODE_ALTERAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para alterar recebimentos." }, { status: 403 });

    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
    const situacao = txt("situacao", 20);
    const parecer = txt("parecer", 1000) || null;
    const data = txt("data", 10);

    if (situacao !== undefined && !SITUACOES.includes(situacao)) return NextResponse.json({ erro: "Situação inválida." }, { status: 422 });
    if (data && !DATA.test(data)) return NextResponse.json({ erro: "Data inválida." }, { status: 422 });

    const updates: Record<string, unknown> = {};
    if (situacao !== undefined) updates.situacao = situacao;
    if (parecer !== undefined) updates.parecer = parecer;
    if (data !== undefined) updates.data = data;

    const [atualizado] = await db.update(recebimento)
      .set(updates as any)
      .where(and(eq(recebimento.id, id), eq(recebimento.organizacaoId, sessao.organizacaoId)))
      .returning({ id: recebimento.id });
    if (!atualizado) return NextResponse.json({ erro: "Recebimento não encontrado." }, { status: 404 });

    await registrarEvento({ organizacaoId: sessao.organizacaoId, tipo: "alteracao", entidade: "recebimento", entidadeId: id, atorId: sessao.usuarioId, payload: updates });

    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    if (!PODE_ALTERAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para excluir recebimentos." }, { status: 403 });

    const [removido] = await db.delete(recebimento)
      .where(and(eq(recebimento.id, id), eq(recebimento.organizacaoId, sessao.organizacaoId)))
      .returning({ id: recebimento.id });
    if (!removido) return NextResponse.json({ erro: "Recebimento não encontrado." }, { status: 404 });

    await registrarEvento({ organizacaoId: sessao.organizacaoId, tipo: "exclusao", entidade: "recebimento", entidadeId: id, atorId: sessao.usuarioId, payload: {} });

    return NextResponse.json({ ok: true });
  });
}
