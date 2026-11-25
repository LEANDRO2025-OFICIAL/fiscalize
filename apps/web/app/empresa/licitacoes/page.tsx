import Link from "next/link";
import { eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { licitacao, organizacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData, formatarMoeda, formatarCnpj } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Vazio, Indicador } from "@/components/ui";

const rotuloModalidade: Record<string, string> = {
  pregao: "Pregão",
  concorrencia: "Concorrência",
  dispensa: "Dispensa",
  inexigibilidade: "Inexigibilidade",
  leilao: "Leilão",
};

const tomSituacao = (s: string) =>
  s === "aberta" ? "sucesso" : s === "em_andamento" ? "alerta" : s === "homologada" ? "primario" : s === "cancelada" ? "erro" : "neutro";

const rotuloSituacao: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  homologada: "Homologada",
  deserta: "Deserta",
  cancelada: "Cancelada",
  arquivada: "Arquivada",
};

export default async function PaginaEmpresaLicitacoes() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;

    const [orgData] = await db
      .select({ cnpj: organizacao.cnpj, nome: organizacao.nome })
      .from(organizacao)
      .where(eq(organizacao.id, org))
      .limit(1);
    const cnpj = orgData?.cnpj ?? "";

    // Fornecedor vê todas as licitações abertas do órgão (somente leitura)
    const lista = await db
      .select()
      .from(licitacao)
      .where(eq(licitacao.organizacaoId, org))
      .orderBy(licitacao.numero);

    const abertas = lista.filter((l) => l.situacao === "aberta").length;

    return (
      <>
        <Cabecalho
          titulo="Licitações disponíveis"
          descricao={`Editais publicados pelo órgão ${orgData?.nome ?? "—"} (CNPJ: ${formatarCnpj(cnpj ?? "")}). Somente leitura.`}
        />

        <div className="mb-6">
          <Indicador rotulo="Total de licitações" valor={String(lista.length)} tom="primario" />
          <Indicador rotulo="Abertas" valor={String(abertas)} tom="sucesso" />
        </div>

        {lista.length === 0 ? (
          <Vazio
            titulo="Nenhuma licitação"
            texto="Os editais publicados pelo órgão aparecerão aqui."
          />
        ) : (
          <Cartao titulo="Editais">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borda bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-texto-suave">
                    <th className="px-5 py-3">Número</th>
                    <th className="px-5 py-3">Modalidade</th>
                    <th className="px-5 py-3">Objeto</th>
                    <th className="tabular px-5 py-3 text-right">Valor estimado</th>
                    <th className="px-5 py-3">Situação</th>
                    <th className="px-5 py-3">Encerramento</th>
                    <th className="px-5 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borda">
                  {lista.map((l) => {
                    const tom = tomSituacao(l.situacao);
                    return (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium">{l.numero}</td>
                        <td className="px-5 py-3">{rotuloModalidade[l.modalidade] ?? l.modalidade}</td>
                        <td className="px-5 py-3 max-w-md truncate">{l.objeto}</td>
                        <td className="tabular px-5 py-3 text-right">{l.valorEstimado ? formatarMoeda(l.valorEstimado) : "—"}</td>
                        <td className="px-5 py-3"><Selo tom={tom}>{rotuloSituacao[l.situacao] ?? l.situacao}</Selo></td>
                        <td className="tabular px-5 py-3">{formatarData(l.dataEncerramento)}</td>
                        <td className="px-5 py-3"><Link href={`/empresa/licitacoes/${l.id}`} className="text-xs font-medium text-primario hover:underline">Ver →</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Cartao>
        )}
      </>
    );
  });
}
