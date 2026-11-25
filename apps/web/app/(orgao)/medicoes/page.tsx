import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { medicao, contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarMoeda, formatarData } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";

const sel = { rascunho: ["neutro", "Rascunho"], submetida: ["alerta", "Submetida"], aprovada: ["sucesso", "Aprovada"], rejeitada: ["erro", "Rejeitada"] } as const;

export default async function PaginaMedicoes() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  const lista = await db
    .select({ m: medicao, numeroContrato: contrato.numero, contratoId: contrato.id })
    .from(medicao)
    .innerJoin(contrato, eq(contrato.id, medicao.contratoId))
    .where(eq(medicao.organizacaoId, sessao.organizacaoId))
    .orderBy(desc(medicao.competencia));

  return (
    <>
      <Cabecalho titulo="Medições" descricao="Medições mensais com valor bruto, glosas e valor líquido." acao={["administrador", "controlador", "fiscal"].includes(sessao.papel) ? <Link href="/medicoes/nova" className="rounded-lg bg-primario px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primario-escuro">+ Nova medição</Link> : undefined} />
      <Cartao>
        {lista.length === 0 ? (
          <Vazio titulo="Nenhuma medição" texto="Quando o fiscal registrar a primeira medição, ela aparecerá aqui com a memória de cálculo." />
        ) : (
          <Tabela colunas={[{ rotulo: "Contrato" }, { rotulo: "Nº" }, { rotulo: "Competência" }, { rotulo: "Bruto", alinhar: "direita" }, { rotulo: "Glosa", alinhar: "direita" }, { rotulo: "Líquido", alinhar: "direita" }, { rotulo: "Situação" }]}>
            {lista.map(({ m, numeroContrato, contratoId }) => {
              const [tom, rot] = sel[m.situacao];
              return (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3"><Link href={`/contratos/${contratoId}`} className="font-medium text-primario hover:underline">{numeroContrato}</Link></td>
                  <td className="px-5 py-3"><Link href={`/medicoes/${m.id}`} className="font-semibold text-primario hover:underline">{m.numero}</Link></td>
                  <td className="tabular px-5 py-3">{formatarData(m.competencia)}</td>
                  <td className="tabular px-5 py-3 text-right">{formatarMoeda(m.valorBruto)}</td>
                  <td className="tabular px-5 py-3 text-right text-erro">{formatarMoeda(m.valorGlosa)}</td>
                  <td className="tabular px-5 py-3 text-right font-semibold">{formatarMoeda(m.valorLiquido)}</td>
                  <td className="px-5 py-3"><Selo tom={tom}>{rot}</Selo></td>
                </tr>
              );
            })}
          </Tabela>
        )}
      </Cartao>
    </>
  );
  });
}
