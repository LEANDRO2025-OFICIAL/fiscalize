import { and, desc, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { sinalRisco, contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { Cabecalho, Cartao, Selo, Vazio } from "@/components/ui";
import Link from "next/link";
import { formatarMoeda, formatarData, formatarDataHora } from "@/lib/formatar";
import { SinaisRiscoLista } from "@/components/sinais-risco-lista";

const PODE_GERIR = ["administrador", "controlador", "fiscal"];

export default async function PaginaSinaisRisco() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;
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
      .where(eq(sinalRisco.organizacaoId, org))
      .orderBy(desc(sinalRisco.criadoEm));

    const contratos = await db
      .select({ id: contrato.id, numero: contrato.numero })
      .from(contrato)
      .where(eq(contrato.organizacaoId, org))
      .orderBy(contrato.numero);

    const podeGerir = PODE_GERIR.includes(sessao.papel);

    return (
      <>
        <Cabecalho
          titulo="RadarCompras — sinais de risco"
          descricao="Sinais estruturados de risco (divergência de preço e vínculo cadastral), calculados de forma determinística. Todo sinal exige revisão humana registrada antes de entrar em dossiê."
        />
        <SinaisRiscoLista
          sinais={sinais}
          contratos={contratos}
          podeGerir={podeGerir}
          podeRevisar={PODE_GERIR.includes(sessao.papel)}
        />
      </>
    );
  });
}
