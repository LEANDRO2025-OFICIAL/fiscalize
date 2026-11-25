import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { obrigacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_ALTERAR = ["administrador", "controlador", "fiscal"];
const TIPOS = ["entrega", "servico", "relatorio", "pagamento"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const [o] = await db
      .select()
      .from(obrigacao)
      .where(and(eq(obrigacao.id, id), eq(obrigacao.organizacaoId, sessao.organizacaoId)));
    if (!o) return NextResponse.json({ erro: "Obrigação não encontrada." }, { status: 404 });
    return NextResponse.json({ obrigacao: o });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    if (!PODE_ALTERAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para alterar obrigações." }, { status: 403 });

    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
    const tipo = txt("tipo", 20);
    const descricao = txt("descricao", 600);
    const prazoDias = b?.prazoDias !== undefined ? Number(b.prazoDias) : null;
    const dataLimite = txt("dataLimite", 10) || null;

    if (tipo !== undefined && !TIPOS.includes(tipo)) return NextResponse.json({ erro: "Tipo inválido." }, { status: 422 });
    if (dataLimite && !DATA.test(dataLimite)) return NextResponse.json({ erro: "Data limite inválida." }, { status: 422 });

    const updates: Record<string, unknown> = {};
    if (tipo !== undefined) updates.tipo = tipo;
    if (descricao !== undefined) updates.descricao = descricao;
    if (prazoDias !== null) updates.prazoDias = prazoDias;
    if (dataLimite !== undefined) updates.dataLimite = dataLimite;

    const [atualizado] = await db.update(obrigacao)
      .set(updates as any)
      .where(and(eq(obrigacao.id, id), eq(obrigacao.organizacaoId, sessao.organizacaoId)))
      .returning({ id: obrigacao.id });
    if (!atualizado) return NextResponse.json({ erro: "Obrigação não encontrada." }, { status: 404 });

    await registrarEvento({ organizacaoId: sessao.organizacaoId, tipo: "alteracao", entidade: "obrigacao", entidadeId: id, atorId: sessao.usuarioId, payload: updates });

    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    if (!PODE_ALTERAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para excluir obrigações." }, { status: 403 });

    const [removido] = await db.delete(obrigacao)
      .where(and(eq(obrigacao.id, id), eq(obrigacao.organizacaoId, sessao.organizacaoId)))
      .returning({ id: obrigacao.id });
    if (!removido) return NextResponse.json({ erro: "Obrigação não encontrada." }, { status: 404 });

    await registrarEvento({ organizacaoId: sessao.organizacaoId, tipo: "exclusao", entidade: "obrigacao", entidadeId: id, atorId: sessao.usuarioId, payload: {} });

    return NextResponse.json({ ok: true });
  });
}
