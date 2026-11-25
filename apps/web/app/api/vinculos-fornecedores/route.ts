import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { vinculoFornecedor, organizacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_CRIAR = ["administrador", "controlador"];

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const lista = await db
      .select({
        id: vinculoFornecedor.id,
        contratanteOrgId: vinculoFornecedor.contratanteOrgId,
        fornecedorOrgId: vinculoFornecedor.fornecedorOrgId,
        contratanteNome: organizacao.nome,
        fornecedorNome: organizacao.nome,
        status: vinculoFornecedor.status,
        criadoEm: vinculoFornecedor.criadoEm,
      })
      .from(vinculoFornecedor)
      .innerJoin(organizacao, eq(organizacao.id, vinculoFornecedor.contratanteOrgId))
      .leftJoin(organizacao, eq(organizacao.id, vinculoFornecedor.fornecedorOrgId))
      .where(eq(vinculoFornecedor.contratanteOrgId, sessao.organizacaoId))
      .orderBy(vinculoFornecedor.criadoEm);
    return NextResponse.json({ vinculos: lista });
  });
}

export async function POST(request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    if (!PODE_CRIAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para criar vínculos." }, { status: 403 });

    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
    const fornecedorCnpj = txt("fornecedorCnpj", 30).replace(/\D/g, "");
    const status = txt("status", 20) || "ativo";

    if (!fornecedorCnpj) return NextResponse.json({ erro: "Informe o CNPJ do fornecedor." }, { status: 422 });
    if (fornecedorCnpj.length !== 14) return NextResponse.json({ erro: "CNPJ inválido." }, { status: 422 });

    const [fornecedorOrg] = await db
      .select({ id: organizacao.id })
      .from(organizacao)
      .where(eq(organizacao.cnpj, fornecedorCnpj));
    if (!fornecedorOrg) return NextResponse.json({ erro: "Fornecedor não encontrado no sistema." }, { status: 404 });

    const [dup] = await db
      .select({ id: vinculoFornecedor.id })
      .from(vinculoFornecedor)
      .where(and(eq(vinculoFornecedor.contratanteOrgId, sessao.organizacaoId), eq(vinculoFornecedor.fornecedorOrgId, fornecedorOrg.id)));
    if (dup) return NextResponse.json({ erro: "Vínculo já existe.", id: dup.id }, { status: 409 });

    const [novo] = await db.insert(vinculoFornecedor).values({
      contratanteOrgId: sessao.organizacaoId,
      fornecedorOrgId: fornecedorOrg.id,
      status,
    }).returning({ id: vinculoFornecedor.id });

    await registrarEvento({ organizacaoId: sessao.organizacaoId, tipo: "criacao", entidade: "vinculo_fornecedor", entidadeId: novo!.id, atorId: sessao.usuarioId, payload: { fornecedorCnpj, status } });

    return NextResponse.json({ id: novo!.id }, { status: 201 });
  });
}
