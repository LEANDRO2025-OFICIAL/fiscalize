import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import {
  contrato,
  execucao,
  medicao,
} from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { Cabecalho, Cartao, Vazio, Indicador } from "@/components/ui";
import Link from "next/link";
import { formatarMoeda, formatarData } from "@/lib/formatar";
import { ExecucaoFunil } from "@/components/execucao-funil";

export default async function PaginaExecucaoContrato({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;
    const [c] = await db
      .select()
      .from(contrato)
      .where(and(eq(contrato.id, id), eq(contrato.organizacaoId, org)));
    if (!c) return <div>Contrato não encontrado.</div>;

    const lancamentos = await db
      .select({
        id: execucao.id,
        tipo: execucao.tipo,
        valor: execucao.valor,
        numeroDocumento: execucao.numeroDocumento,
        data: execucao.data,
        situacao: execucao.situacao,
        observacao: execucao.observacao,
        medicaoId: execucao.medicaoId,
        criadoEm: execucao.criadoEm,
        numeroMedicao: medicao.numero,
      })
      .from(execucao)
      .leftJoin(medicao, eq(medicao.id, execucao.medicaoId))
      .where(
        and(eq(execucao.contratoId, id), eq(execucao.organizacaoId, org))
      )
      .orderBy(execucao.data);

    const medicoesAprovadas = await db
      .select({ id: medicao.id, numero: medicao.numero, valorLiquido: medicao.valorLiquido })
      .from(medicao)
      .where(
        and(
          eq(medicao.contratoId, id),
          eq(medicao.organizacaoId, org),
          eq(medicao.situacao, "aprovada")
        )
      )
      .orderBy(medicao.numero);

    const podeGerir = ["administrador", "controlador", "fiscal"].includes(sessao.papel);

    const empenhoConfirmado = lancamentos
      .filter((l) => l.tipo === "empenho" && l.situacao === "confirmado")
      .reduce((s, l) => s + Number(l.valor), 0);
    const liquidoConfirmado = lancamentos
      .filter((l) => l.tipo === "liquidacao" && l.situacao === "confirmado")
      .reduce((s, l) => s + Number(l.valor), 0);
    const pagoConfirmado = lancamentos
      .filter((l) => l.tipo === "pagamento" && l.situacao === "confirmado")
      .reduce((s, l) => s + Number(l.valor), 0);

    return (
      <>
        <Cabecalho
          titulo="Execução orçamentária"
          descricao={`Funil Empenho → Liquidação → Pagamento do contrato ${c.numero}.`}
          acao={
            podeGerir ? (
              <Link
                href={`/contratos/${c.id}`}
                className="text-xs font-semibold text-primario hover:underline"
              >
                ← Voltar ao contrato
              </Link>
            ) : undefined
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Indicador rotulo="Empenho confirmado" valor={formatarMoeda(empenhoConfirmado)} detalhe={`de ${formatarMoeda(c.valorGlobal)}`} tom="primario" />
          <Indicador rotulo="Liquidação confirmada" valor={formatarMoeda(liquidoConfirmado)} detalhe={`de ${formatarMoeda(c.valorGlobal)}`} tom="sucesso" />
          <Indicador rotulo="Pagamento confirmado" valor={formatarMoeda(pagoConfirmado)} detalhe={`de ${formatarMoeda(c.valorGlobal)}`} tom="alerta" />
        </div>

        <ExecucaoFunil
          contratoId={c.id}
          contratoNumero={c.numero}
          lancamentos={lancamentos as Array<{
            id: string;
            tipo: string;
            valor: string | number;
            numeroDocumento: string | null;
            data: Date | string;
            situacao: string;
            observacao: string | null;
            medicaoId: string | null;
            criadoEm: Date | string;
            numeroMedicao: string | null;
          }>}
          medicoesAprovadas={medicoesAprovadas as Array<{
            id: string;
            numero: number | string;
            valorLiquido: string | number;
          }>}
          podeGerir={podeGerir}
        />
      </>
    );
  });
}
