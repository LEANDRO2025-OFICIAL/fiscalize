import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { licitacao, lance, organizacao, usuario } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData, formatarMoeda, formatarCnpj } from "@/lib/formatar";
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

const tomLanceSituacao = (s: string) =>
  s === "vencedor" ? "sucesso" : s === "desclassificado" ? "erro" : "primario";

export default async function PaginaLicitacaoDetalhe({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;

    const [l] = await db
      .select()
      .from(licitacao)
      .where(and(eq(licitacao.id, id), eq(licitacao.organizacaoId, org)));
    if (!l) notFound();

    const [autor] = await db.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, l.criadoPorId ?? ""));

    const lances = await db
      .select()
      .from(lance)
      .where(eq(lance.licitacaoId, id))
      .orderBy(desc(lance.valor));

    const [orgData] = await db
      .select({ cnpj: organizacao.cnpj, nome: organizacao.nome })
      .from(organizacao)
      .where(eq(organizacao.id, org))
      .limit(1);
    const cnpj = orgData?.cnpj ?? "";

    const melhorLance = lances.length > 0 ? lances[0] : null;

    return (
      <>
        <p className="mb-2 text-sm"><Link href="/licitacoes" className="text-texto-suave hover:text-primario">← Licitações</Link></p>
        <Cabecalho
          titulo={`Licitação ${l.numero}`}
          descricao={l.objeto}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Cartao titulo="Órgão" className="lg:col-span-1">
            <dl className="space-y-3 px-5 py-4 text-sm">
              <div><dt className="text-xs text-texto-suave">Nome</dt><dd className="font-medium">{orgData?.nome ?? "—"}</dd></div>
              <div><dt className="text-xs text-texto-suave">CNPJ</dt><dd className="tabular">{formatarCnpj(cnpj)}</dd></div>
              <div><dt className="text-xs text-texto-suave">Responsável</dt><dd className="font-medium">{autor?.nome ?? "—"}</dd></div>
            </dl>
          </Cartao>
          <Cartao titulo="Dados da licitação" className="lg:col-span-2">
            <dl className="space-y-3 px-5 py-4 text-sm">
              <div><dt className="text-xs text-texto-suave">Modalidade</dt><dd className="font-medium">{rotuloModalidade[l.modalidade] ?? l.modalidade}</dd></div>
              <div><dt className="text-xs text-texto-suave">Critério</dt><dd className="font-medium">{l.criterio}</dd></div>
              <div><dt className="text-xs text-texto-suave">Valor estimado</dt><dd className="tabular font-medium">{l.valorEstimado ? formatarMoeda(l.valorEstimado) : "—"}</dd></div>
              <div><dt className="text-xs text-texto-suave">Abertura</dt><dd className="tabular">{formatarData(l.dataAbertura)}</dd></div>
              <div><dt className="text-xs text-texto-suave">Encerramento</dt><dd className="tabular">{formatarData(l.dataEncerramento)}</dd></div>
              <div><dt className="text-xs text-texto-suave">Situação</dt><dd className="font-medium"><Selo tom={tomSituacao(l.situacao)}>{rotuloSituacao[l.situacao] ?? l.situacao}</Selo></dd></div>
              {l.edital && <div><dt className="text-xs text-texto-suave">Edital</dt><dd className="text-sm text-texto-suave max-w-md truncate">{l.edital}</dd></div>}
            </dl>
          </Cartao>
        </div>

        <Cartao titulo="Lances recebidos" className="mt-6">
          {lances.length === 0 ? (
            <Vazio
              titulo="Nenhum lance"
              texto="As propostas dos fornecedores aparecem aqui."
            />
          ) : (
            <Tabela
              colunas={[
                { rotulo: "Fornecedor" },
                { rotulo: "CNPJ", alinhar: "direita" },
                { rotulo: "Valor", alinhar: "direita" },
                { rotulo: "Situação" },
                { rotulo: "Proposta em" },
              ]}
            >
              {lances.map((la) => (
                <tr key={la.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">{la.fornecedorNome}</td>
                  <td className="tabular px-5 py-3 text-right font-mono text-xs">{formatarCnpj(la.fornecedorCnpj)}</td>
                  <td className="tabular px-5 py-3 text-right font-medium">{formatarMoeda(la.valor)}</td>
                  <td className="px-5 py-3"><Selo tom={tomLanceSituacao(la.situacao)}>{la.situacao}</Selo></td>
                  <td className="tabular px-5 py-3 text-xs">{formatarData(la.criadoEm)}</td>
                </tr>
              ))}
            </Tabela>
          )}
          {melhorLance && (
            <div className="px-5 py-3 border-t border-borda bg-slate-50/50 text-sm">
              <p className="font-medium">Melhor lance: {formatarMoeda(melhorLance.valor)} · {melhorLance.fornecedorNome}</p>
            </div>
          )}
        </Cartao>
      </>
    );
  });
}
