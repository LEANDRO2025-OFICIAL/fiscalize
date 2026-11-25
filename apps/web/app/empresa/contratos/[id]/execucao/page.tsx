import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import {
  contrato,
  execucao,
  execucaoSituacaoEnum,
  execucaoTipoEnum,
  organizacao,
} from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData, formatarMoeda } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";

const rotuloTipo: Record<string, string> = {
  empenho: "Empenho",
  liquidacao: "Liquidação",
  pagamento: "Pagamento",
};

const tomSituacao = (s: string) =>
  s === "confirmado" ? "sucesso" : s === "cancelado" ? "erro" : "alerta";

const rotuloSituacao = (s: string) =>
  s === "confirmado" ? "Confirmado" : s === "cancelado" ? "Cancelado" : "Pendente";

export default async function PaginaEmpresaExecucao({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id: contratoId } = await params;
  const sessao = await getSessao();

  const { contrato: c, lancamentos } = await comOrganizacao(
    sessao.organizacaoId,
    async (db) => {
      const [contratoData] = await db
        .select({
          id: contrato.id,
          numero: contrato.numero,
          objeto: contrato.objeto,
          fornecedorCnpj: contrato.fornecedorCnpj,
          valorGlobal: contrato.valorGlobal,
        })
        .from(contrato)
        .where(
          and(
            eq(contrato.id, contratoId),
            eq(contrato.organizacaoId, sessao.organizacaoId)
          )
        );

      const lista = await db
        .select()
        .from(execucao)
        .where(
          and(
            eq(execucao.contratoId, contratoId),
            eq(execucao.organizacaoId, sessao.organizacaoId)
          )
        )
        .orderBy(execucao.data);

      return { contrato: contratoData, lancamentos: lista };
    }
  );

  if (!c) notFound();

  const orgData = await comOrganizacao(sessao.organizacaoId, async (db) => {
    return db
      .select({ cnpj: organizacao.cnpj })
      .from(organizacao)
      .where(eq(organizacao.id, sessao.organizacaoId))
      .limit(1);
  });
  const cnpj = orgData[0]?.cnpj ?? "";
  if (c.fornecedorCnpj !== cnpj) notFound();

  const empenho = lancamentos
    .filter((l) => l.tipo === "empenho" && l.situacao === "confirmado")
    .reduce((s, l) => s + Number(l.valor), 0);
  const liquido = lancamentos
    .filter((l) => l.tipo === "liquidacao" && l.situacao === "confirmado")
    .reduce((s, l) => s + Number(l.valor), 0);
  const pago = lancamentos
    .filter((l) => l.tipo === "pagamento" && l.situacao === "confirmado")
    .reduce((s, l) => s + Number(l.valor), 0);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link
          href={`/empresa/contratos/${contratoId}`}
          className="text-texto-suave hover:text-primario"
        >
          ← Contrato {c.numero}
        </Link>
      </p>
      <Cabecalho
        titulo={`Execução do Contrato ${c.numero}`}
        descricao={`Funil orçamentário (empenho → liquidação → pagamento): ${c.objeto}`}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Cartao titulo="Empenho confirmado">
          <p className="tabular text-2xl font-semibold text-primario">
            {formatarMoeda(empenho)}
          </p>
        </Cartao>
        <Cartao titulo="Liquidação confirmada">
          <p className="tabular text-2xl font-semibold text-sucesso">
            {formatarMoeda(liquido)}
          </p>
        </Cartao>
        <Cartao titulo="Pagamento confirmado">
          <p className="tabular text-2xl font-semibold text-sucesso">
            {formatarMoeda(pago)}
          </p>
        </Cartao>
      </div>

      <section className="mt-8">
        <Cartao titulo="Lançamentos do contrato">
          {lancamentos.length === 0 ? (
            <Vazio
              titulo="Sem lançamentos"
              texto="O funil de execução aparecerá aqui quando o órgão lançar empenhos, liquidações e pagamentos."
            />
          ) : (
            <Tabela
              colunas={[
                { rotulo: "Tipo" },
                { rotulo: "Valor", alinhar: "direita" },
                { rotulo: "Documento" },
                { rotulo: "Data" },
                { rotulo: "Situação" },
              ]}
            >
              {lancamentos.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">
                    {rotuloTipo[l.tipo] ?? l.tipo}
                  </td>
                  <td className="tabular px-5 py-3 text-right font-medium">
                    {formatarMoeda(l.valor)}
                  </td>
                  <td className="px-5 py-3 text-texto-suave">
                    {l.numeroDocumento || "—"}
                  </td>
                  <td className="tabular px-5 py-3">
                    {formatarData(l.data)}
                  </td>
                  <td className="px-5 py-3">
                    <Selo tom={tomSituacao(l.situacao)}>
                      {rotuloSituacao(l.situacao)}
                    </Selo>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>
      </section>
    </>
  );
}
