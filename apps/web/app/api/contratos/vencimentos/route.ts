import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { calcularVencimentos } from "@contratacao/domain";
import { contrato, obrigacao, designacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const diasJanela = Math.min(365, Math.max(1, Number(searchParams.get("dias") ?? 90) || 90));
  const sessao = await getSessao();
  const hoje = new Date().toISOString().slice(0, 10);

  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const [contratos, obrigacoes, designacoes] = await Promise.all([
      db.select({
        id: contrato.id, numero: contrato.numero, objeto: contrato.objeto,
        situacao: contrato.situacao, dataAssinatura: contrato.dataAssinatura, fiscalId: contrato.fiscalId,
      }).from(contrato).where(eq(contrato.organizacaoId, sessao.organizacaoId)),
      db.select({
        id: obrigacao.id, contratoId: obrigacao.contratoId,
        obrigacaoTipo: obrigacao.tipo, prazoDias: obrigacao.prazoDias,
        dataLimite: obrigacao.dataLimite, criadoEm: obrigacao.criadoEm,
      }).from(obrigacao).where(eq(obrigacao.organizacaoId, sessao.organizacaoId)),
      db.select({ contratoId: designacao.contratoId }).from(designacao).where(and(eq(designacao.organizacaoId, sessao.organizacaoId), eq(designacao.ativo, "sim"))),
    ]);

    const designados = new Set(designacoes.map((d) => d.contratoId));
    const numeroContrato = new Map(contratos.map((c) => [c.id, c.numero]));
    const resultado = calcularVencimentos({
      hoje, diasJanela,
      obrigacoes: obrigacoes.map((o) => ({
        id: o.id, contratoId: o.contratoId, contratoNumero: numeroContrato.get(o.contratoId) ?? "",
        tipo: o.obrigacaoTipo, obrigacaoTipo: o.obrigacaoTipo,
        prazoDias: o.prazoDias, dataLimite: o.dataLimite, criadoEm: o.criadoEm.toISOString(),
      })),
      contratos: contratos.map((c) => ({
        id: c.id, numero: c.numero, objeto: c.objeto, situacao: c.situacao,
        dataAssinatura: c.dataAssinatura, fiscalId: c.fiscalId, designadoEm: designados.has(c.id) ? c.dataAssinatura : null,
      })),
    });

    return NextResponse.json({ diasJanela, hoje, ...resultado });
  });
}