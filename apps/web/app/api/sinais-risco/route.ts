import { NextResponse } from "next/server";
import { and, eq, desc, sql } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import {
  sinalRisco,
  contrato,
  itemContratado,
  vinculoFornecedor,
  organizacao,
} from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_GERIR = ["administrador", "controlador", "fiscal"];
const DESVIO_LIMITE = 20; // % acima da referência gera sinal de divergência de preço
const CONFIANCA_DIVERGENCIA = "0.80";
const CONFIANCA_VINCULO = "1.00";

type Params = { params: Promise<{}> };

export async function GET(_request: Request, { params }: Params) {
  const sessao = await getSessao();
  const { searchParams } = new URL(_request.url);
  const contratoId = searchParams.get("contrato") || undefined;
  const tipo = searchParams.get("tipo") || undefined;
  const statusRevisao = searchParams.get("statusRevisao") || undefined;
  const estatisticas = searchParams.get("estatisticas") === "1";

  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;

    // Estatísticas agregadas
    if (estatisticas) {
      const [total] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(sinalRisco)
        .where(eq(sinalRisco.organizacaoId, org));
      const [porTipo] = await db
        .select({
          tipo: sinalRisco.tipo,
          n: sql<number>`count(*)::int`,
        })
        .from(sinalRisco)
        .where(eq(sinalRisco.organizacaoId, org))
        .groupBy(sinalRisco.tipo);
      const [porStatus] = await db
        .select({
          status: sinalRisco.statusRevisao,
          n: sql<number>`count(*)::int`,
        })
        .from(sinalRisco)
        .where(eq(sinalRisco.organizacaoId, org))
        .groupBy(sinalRisco.statusRevisao);
      const [mediaDesvio] = await db
        .select({
          media: sql<number>`avg(${sinalRisco.desvioPercentual})::numeric(10,2)`,
        })
        .from(sinalRisco)
        .where(
          and(
            eq(sinalRisco.organizacaoId, org),
            eq(sinalRisco.tipo, "divergencia_preco")
          )
        );
      const tipoLista = (porTipo ?? []) as Array<{ tipo: string; n: number }>;
      const statusLista = (porStatus ?? []) as Array<{
        status: string;
        n: number;
      }>;
      return NextResponse.json({
        total: Number(total?.n ?? 0),
        porTipo: tipoLista.reduce(
          (acc, t) => ({ ...acc, [t.tipo]: Number(t.n) }),
          {} as Record<string, number>
        ),
        porStatus: statusLista.reduce(
          (acc, s) => ({ ...acc, [s.status]: Number(s.n) }),
          {} as Record<string, number>
        ),
        mediaDesvio: mediaDesvio?.media != null ? Number(mediaDesvio.media) : null,
      });
    }

    const sinais = await db
      .select({
        id: sinalRisco.id,
        tipo: sinalRisco.tipo,
        regraAplicada: sinalRisco.regraAplicada,
        valorObservado: sinalRisco.valorObservado,
        valorReferencia: sinalRisco.valorReferencia,
        desvioPercentual: sinalRisco.desvioPercentual,
        confianca: sinalRisco.confianca,
        statusRevisao: sinalRisco.statusRevisao,
        parecerHumano: sinalRisco.parecerHumano,
        observacao: sinalRisco.observacao,
        parecerPorId: sinalRisco.parecerPorId,
        parecerEm: sinalRisco.parecerEm,
        criadoEm: sinalRisco.criadoEm,
        contratoNumero: contrato.numero,
        contratoObjeto: contrato.objeto,
        contratoFornecedorCnpj: contrato.fornecedorCnpj,
        contratoId: contrato.id,
      })
      .from(sinalRisco)
      .innerJoin(contrato, eq(contrato.id, sinalRisco.contratoId))
      .where(
        and(
          eq(sinalRisco.organizacaoId, org),
          contratoId ? eq(sinalRisco.contratoId, contratoId) : undefined,
          tipo ? eq(sinalRisco.tipo, tipo) : undefined,
          statusRevisao ? eq(sinalRisco.statusRevisao, statusRevisao) : undefined
        )
      )
      .orderBy(desc(sinalRisco.criadoEm));
    return NextResponse.json({ sinais });
  });
}

export async function POST(request: Request, { params }: Params) {
  const sessao = await getSessao();
  if (!PODE_GERIR.includes(sessao.papel)) {
    return NextResponse.json({ erro: "Sem permissão para gerar sinais de risco." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { acao?: string } | null;
  if (body?.acao !== "gerar") {
    return NextResponse.json({ erro: "Informe a ação 'gerar'." }, { status: 400 });
  }

  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;

    // Recalcula do zero: remove sinais anteriores e regenera determinísticamente.
    await db.delete(sinalRisco).where(eq(sinalRisco.organizacaoId, org));

    let gerados = 0;

    // --- Regra 1: divergência de preço ---
    const itens = await db
      .select()
      .from(itemContratado)
      .where(eq(itemContratado.organizacaoId, org));

    const porGrupo = new Map<string, (typeof itens)[number][]>();
    for (const i of itens) {
      const chave = `${i.descricao.trim().toLowerCase()}|${i.unidadeMedida.trim().toLowerCase()}`;
      const grupo = porGrupo.get(chave) ?? [];
      grupo.push(i);
      porGrupo.set(chave, grupo);
    }

    for (const i of itens) {
      const chave = `${i.descricao.trim().toLowerCase()}|${i.unidadeMedida.trim().toLowerCase()}`;
      const grupo = porGrupo.get(chave)!;
      const outros = grupo.filter((x) => x.id !== i.id);
      if (outros.length === 0) continue;

      const media =
        outros.reduce((soma, x) => soma + Number(x.valorUnitario), 0) / outros.length;
      const observado = Number(i.valorUnitario);
      const desvio = ((observado - media) / media) * 100;
      if (desvio <= DESVIO_LIMITE) continue;

      const [c] = await db
        .select()
        .from(contrato)
        .where(and(eq(contrato.id, i.contratoId), eq(contrato.organizacaoId, org)));
      if (!c) continue;

      await db.insert(sinalRisco).values({
        organizacaoId: org,
        contratoId: i.contratoId,
        tipo: "divergencia_preco",
        regraAplicada: "divergência de preço",
        valorObservado: observado.toFixed(2),
        valorReferencia: media.toFixed(2),
        desvioPercentual: desvio.toFixed(2),
        confianca: CONFIANCA_DIVERGENCIA,
      });
      gerados++;
    }

    // --- Regra 2: vínculo cadastral identificado ---
    const contratos = await db.select().from(contrato).where(eq(contrato.organizacaoId, org));
    for (const c of contratos) {
      const [fornOrg] = await db
        .select()
        .from(organizacao)
        .where(eq(organizacao.cnpj, c.fornecedorCnpj));
      if (!fornOrg) continue;

      const [vinculo] = await db
        .select()
        .from(vinculoFornecedor)
        .where(
          and(
            eq(vinculoFornecedor.contratanteOrgId, org),
            eq(vinculoFornecedor.fornecedorOrgId, fornOrg.id)
          )
        );
      if (!vinculo) continue;

      await db.insert(sinalRisco).values({
        organizacaoId: org,
        contratoId: c.id,
        tipo: "vinculo_cadastral",
        regraAplicada: "vínculo cadastral identificado",
        confianca: CONFIANCA_VINCULO,
      });
      gerados++;
    }

    return NextResponse.json({ gerados });
  });
}
