import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { vinculoFornecedor } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_ALTERAR = ["administrador", "controlador"];

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const [v] = await db
      .select()
      .from(vinculoFornecedor)
      .where(and(eq(vinculoFornecedor.id, id), eq(vinculoFornecedor.contratanteOrgId, sessao.organizacaoId)));
    if (!v) return NextResponse.json({ erro: "Vínculo não encontrado." }, { status: 404 });
    return NextResponse.json({ vinculo: v });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    if (!PODE_ALTERAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para alterar vínculos." }, { status: 403 });

    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
    const status = txt("status", 20);

    if (status !== undefined && !["ativo", "inativo"].includes(status)) return NextResponse.json({ erro: "Status inválido." }, { status: 422 });

    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;

    const [atualizado] = await db.update(vinculoFornecedor)
      .set(updates as any)
      .where(and(eq(vinculoFornecedor.id, id), eq(vinculoFornecedor.contratanteOrgId, sessao.organizacaoId)))
      .returning({ id: vinculoFornecedor.id });
    if (!atualizado) return NextResponse.json({ erro: "Vínculo não encontrado." }, { status: 404 });

    await registrarEvento({ organizacaoId: sessao.organizacaoId, tipo: "alteracao", entidade: "vinculo_fornecedor", entidadeId: id, atorId: sessao.usuarioId, payload: updates });

    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    if (!PODE_ALTERAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para excluir vínculos." }, { status: 403 });

    const [removido] = await db.delete(vinculoFornecedor)
      .where(and(eq(vinculoFornecedor.id, id), eq(vinculoFornecedor.contratanteOrgId, sessao.organizacaoId)))
      .returning({ id: vinculoFornecedor.id });
    if (!removido) return NextResponse.json({ erro: "Vínculo não encontrado." }, { status: 404 });

    await registrarEvento({ organizacaoId: sessao.organizacaoId, tipo: "exclusao", entidade: "vinculo_fornecedor", entidadeId: id, atorId: sessao.usuarioId, payload: {} });

    return NextResponse.json({ ok: true });
  });
}
