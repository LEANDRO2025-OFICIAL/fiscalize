import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { recebimento, contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_CRIAR = ["administrador", "controlador", "fiscal"];
const SITUACOES = ["pendente", "conforme", "divergente"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(_request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const lista = await db
      .select({ r: recebimento, numero: contrato.numero })
      .from(recebimento)
      .innerJoin(contrato, eq(contrato.id, recebimento.contratoId))
      .where(eq(recebimento.organizacaoId, sessao.organizacaoId))
      .orderBy(recebimento.data);
    return NextResponse.json({ recebimentos: lista });
  });
}

export async function POST(request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    if (!PODE_CRIAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para criar recebimentos." }, { status: 403 });

    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
    const contratoId = txt("contratoId", 40);
    const medicaoId = txt("medicaoId", 40) || null;
    const situacao = txt("situacao", 20);
    const parecer = txt("parecer", 1000) || null;
    const data = txt("data", 10);

    if (!contratoId || !SITUACOES.includes(situacao) || !data) return NextResponse.json({ erro: "Informe contrato, situação e data." }, { status: 422 });
    if (!DATA.test(data)) return NextResponse.json({ erro: "Data inválida." }, { status: 422 });

    const [c] = await db.select({ id: contrato.id }).from(contrato).where(and(eq(contrato.id, contratoId), eq(contrato.organizacaoId, sessao.organizacaoId)));
    if (!c) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

    const [novo] = await db.insert(recebimento).values({
      organizacaoId: sessao.organizacaoId,
      contratoId,
      medicaoId,
      situacao,
      data,
      parecer,
    } as any).returning({ id: recebimento.id });

    await registrarEvento({ organizacaoId: sessao.organizacaoId, tipo: "criacao", entidade: "recebimento", entidadeId: novo!.id, atorId: sessao.usuarioId, payload: { contratoId, medicaoId, situacao, data, parecer } });

    return NextResponse.json({ id: novo!.id }, { status: 201 });
  });
}
