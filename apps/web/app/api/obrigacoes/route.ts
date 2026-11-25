import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { obrigacao, contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_CRIAR = ["administrador", "controlador", "fiscal"];
const TIPOS = ["entrega", "servico", "relatorio", "pagamento"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const lista = await db
      .select()
      .from(obrigacao)
      .where(eq(obrigacao.organizacaoId, sessao.organizacaoId))
      .orderBy(obrigacao.dataLimite);
    return NextResponse.json({ obrigacoes: lista });
  });
}

export async function POST(request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    if (!PODE_CRIAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para criar obrigações." }, { status: 403 });

    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
    const contratoId = txt("contratoId", 40);
    const tipo = txt("tipo", 20);
    const descricao = txt("descricao", 600);
    const prazoDias = b?.prazoDias ? Number(b.prazoDias) : null;
    const dataLimite = txt("dataLimite", 10) || null;

    if (!contratoId || !TIPOS.includes(tipo) || !descricao) return NextResponse.json({ erro: "Informe contrato, tipo e descrição." }, { status: 422 });
    if (prazoDias !== null && (!Number.isInteger(prazoDias) || prazoDias < 0)) return NextResponse.json({ erro: "Prazo inválido." }, { status: 422 });
    if (dataLimite && !DATA.test(dataLimite)) return NextResponse.json({ erro: "Data limite inválida." }, { status: 422 });

    const [c] = await db.select({ id: contrato.id }).from(contrato).where(and(eq(contrato.id, contratoId), eq(contrato.organizacaoId, sessao.organizacaoId)));
    if (!c) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

    const [novo] = await db.insert(obrigacao).values({
      organizacaoId: sessao.organizacaoId,
      contratoId,
      tipo,
      descricao,
      prazoDias,
      dataLimite,
    } as any).returning({ id: obrigacao.id });

    await registrarEvento({ organizacaoId: sessao.organizacaoId, tipo: "criacao", entidade: "obrigacao", entidadeId: novo!.id, atorId: sessao.usuarioId, payload: { contratoId, tipo, descricao, prazoDias, dataLimite } });

    return NextResponse.json({ id: novo!.id }, { status: 201 });
  });
}
