import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { licitacao, organizacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData, formatarMoeda } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";

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

export default async function PaginaLicitacoes() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;
    const lista = await db
      .select()
      .from(licitacao)
      .where(eq(licitacao.organizacaoId, org))
      .orderBy(desc(licitacao.criadoEm));

    const abertas = lista.filter((l) => l.situacao === "aberta").length;

    return (
      <>
        <Cabecalho
          titulo="Licitações"
          descricao={`${abertas} aberta(s) · publique editais e acompanhe o andamento.`}
        />
        <Cartao titulo="Nova licitação">
          <p className="px-5 py-3 text-sm text-texto-suave">
            Use a API <code>/api/licitacoes</code> para cadastrar novas licitações. A lista abaixo exibe as já criadas.
          </p>
        </Cartao>
        <Cartao titulo="Histórico">
          {lista.length === 0 ? (
            <Vazio
              titulo="Nenhuma licitação"
              texto="As licitações publicadas pelo órgão aparecem aqui."
            />
          ) : (
            <Tabela
              colunas={[
                { rotulo: "Número" },
                { rotulo: "Modalidade" },
                { rotulo: "Objeto" },
                { rotulo: "Valor estimado", alinhar: "direita" },
                { rotulo: "Situação" },
                { rotulo: "Encerramento" },
                { rotulo: "" },
              ]}
            >
              {lista.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">{l.numero}</td>
                  <td className="px-5 py-3">{rotuloModalidade[l.modalidade] ?? l.modalidade}</td>
                  <td className="px-5 py-3 max-w-md truncate">{l.objeto}</td>
                  <td className="tabular px-5 py-3 text-right">{l.valorEstimado ? formatarMoeda(l.valorEstimado) : "—"}</td>
                  <td className="px-5 py-3"><Selo tom={tomSituacao(l.situacao)}>{rotuloSituacao[l.situacao] ?? l.situacao}</Selo></td>
                  <td className="tabular px-5 py-3">{formatarData(l.dataEncerramento)}</td>
                  <td className="px-5 py-3"><Link href={`/licitacoes/${l.id}`} className="text-xs font-medium text-primario hover:underline">Ver →</Link></td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>
      </>
    );
  });
}
