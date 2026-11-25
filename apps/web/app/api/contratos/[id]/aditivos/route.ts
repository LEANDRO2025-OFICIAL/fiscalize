import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { aditivo, aditivoTipoEnum, contrato } from "@contratacao/db/schema";
import { registrarEvento } from "@contratacao/db/auditoria";
import { getSessao } from "@/lib/sessao";

const PODE_GERIR = ["administrador", "controlador", "fiscal"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: contratoId } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const aditivos = await db
      .select()
      .from(aditivo)
      .where(and(eq(aditivo.contratoId, contratoId), eq(aditivo.organizacaoId, sessao.organizacaoId)))
      .orderBy(aditivo.numero);
    return NextResponse.json({ aditivos });
  });
}

export async function POST(request: Request, { params }: Params) {
  const { id: contratoId } = await params;
  const sessao = await getSessao();
  if (!PODE_GERIR.includes(sessao.papel)) {
    return NextResponse.json({ erro: "Sem permissão para registrar aditivos." }, { status: 403 });
  }

  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
  const numero = Number(b?.numero);
  const tipo = txt("tipo", 20);
  const objeto = txt("objeto", 600);
  const dataAssinatura = txt("dataAssinatura", 10);
  const dataPublicacao = txt("dataPublicacao", 10) || null;
  const vigenciaInicio = txt("vigenciaInicio", 10) || null;
  const vigenciaFim = txt("vigenciaFim", 10) || null;
  const valor = Number(b?.valor ?? 0);

  if (!Number.isInteger(numero) || numero < 1 || numero > 9999) {
    return NextResponse.json({ erro: "Número do aditivo inválido." }, { status: 422 });
  }
  if (!(aditivoTipoEnum.enumValues as readonly string[]).includes(tipo)) {
    return NextResponse.json({ erro: "Tipo de aditivo inválido." }, { status: 422 });
  }
  if (!objeto) return NextResponse.json({ erro: "Informe o objeto do aditivo." }, { status: 422 });
  if (!(valor >= 0) || valor > 1e12) return NextResponse.json({ erro: "Valor inválido." }, { status: 422 });
  if (!DATA.test(dataAssinatura)) return NextResponse.json({ erro: "Data de assinatura inválida." }, { status: 422 });
  for (const [rotulo, d] of [["publicação", dataPublicacao], ["início da vigência", vigenciaInicio], ["fim da vigência", vigenciaFim]] as const) {
    if (d && !DATA.test(d)) return NextResponse.json({ erro: `Data de ${rotulo} inválida.` }, { status: 422 });
  }
  if (vigenciaInicio && vigenciaFim && vigenciaFim < vigenciaInicio) {
    return NextResponse.json({ erro: "O fim da vigência não pode ser anterior ao início." }, { status: 422 });
  }

  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;
    const [existeContrato] = await db.select({ id: contrato.id }).from(contrato).where(and(eq(contrato.id, contratoId), eq(contrato.organizacaoId, org)));
    if (!existeContrato) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

    const [dup] = await db.select({ id: aditivo.id }).from(aditivo).where(and(eq(aditivo.contratoId, contratoId), eq(aditivo.organizacaoId, org), eq(aditivo.numero, numero)));
    if (dup) return NextResponse.json({ erro: `Já existe o aditivo nº ${numero} neste contrato.` }, { status: 409 });

    const [novo] = await db.insert(aditivo).values({
      organizacaoId: org,
      contratoId,
      numero,
      tipo,
      objeto,
      valor: valor.toFixed(2),
      dataAssinatura,
      dataPublicacao,
      vigenciaInicio,
      vigenciaFim,
      criadoPorId: sessao.usuarioId,
    }).returning({ id: aditivo.id });

    await registrarEvento({
      organizacaoId: org,
      tipo: "aditivo",
      entidade: "aditivo",
      entidadeId: novo!.id,
      atorId: sessao.usuarioId,
      payload: { contratoId, numero, tipo, valor, dataAssinatura },
    });

    return NextResponse.json({ id: novo!.id }, { status: 201 });
  });
}
