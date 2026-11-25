import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato, penalidade } from "@contratacao/db/schema";
import { registrarEvento } from "@contratacao/db/auditoria";
import { getSessao } from "@/lib/sessao";

const PODE_GERIR = ["administrador", "controlador", "fiscal"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: contratoId } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const penalidades = await db
      .select()
      .from(penalidade)
      .where(and(eq(penalidade.contratoId, contratoId), eq(penalidade.organizacaoId, sessao.organizacaoId)))
      .orderBy(desc(penalidade.criadoEm));
    return NextResponse.json({ penalidades });
  });
}

// Toda penalidade nasce como "sugerida": a aprovação é uma decisão posterior, registrada em /penalidades/[id].
export async function POST(request: Request, { params }: Params) {
  const { id: contratoId } = await params;
  const sessao = await getSessao();
  if (!PODE_GERIR.includes(sessao.papel)) {
    return NextResponse.json({ erro: "Sem permissão para registrar penalidades." }, { status: 403 });
  }

  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
  const tipo = txt("tipo", 120);
  const justificativa = txt("justificativa", 2000);
  const baseLegal = txt("baseLegal", 300) || null;
  const valor = Number(b?.valor ?? 0);
  const prazoResposta = txt("prazoResposta", 10) || null;

  if (!tipo) return NextResponse.json({ erro: "Informe o tipo da penalidade." }, { status: 422 });
  if (!justificativa) return NextResponse.json({ erro: "Informe a justificativa (fundamento do fato)." }, { status: 422 });
  if (!(valor >= 0) || valor > 1e12) return NextResponse.json({ erro: "Valor inválido." }, { status: 422 });
  if (prazoResposta && !DATA.test(prazoResposta)) return NextResponse.json({ erro: "Prazo de resposta inválido." }, { status: 422 });

  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;
    const [existeContrato] = await db.select({ id: contrato.id }).from(contrato).where(and(eq(contrato.id, contratoId), eq(contrato.organizacaoId, org)));
    if (!existeContrato) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

    const [novo] = await db.insert(penalidade).values({
      organizacaoId: org,
      contratoId,
      tipo,
      valor: valor.toFixed(2),
      justificativa,
      baseLegal,
      prazoResposta,
      situacao: "sugerida",
      criadoPorId: sessao.usuarioId,
    }).returning({ id: penalidade.id });

    await registrarEvento({
      organizacaoId: org,
      tipo: "penalidade",
      entidade: "penalidade",
      entidadeId: novo!.id,
      atorId: sessao.usuarioId,
      payload: { contratoId, tipo, valor, baseLegal, prazoResposta },
    });

    return NextResponse.json({ id: novo!.id }, { status: 201 });
  });
}
