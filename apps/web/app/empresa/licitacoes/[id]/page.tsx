import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { licitacao, organizacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData, formatarMoeda, formatarCnpj } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Vazio } from "@/components/ui";

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

export default async function PaginaEmpresaLicitacaoDetalhe({
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

    const [orgData] = await db
      .select({ cnpj: organizacao.cnpj, nome: organizacao.nome })
      .from(organizacao)
      .where(eq(organizacao.id, org))
      .limit(1);
    const cnpj = orgData?.cnpj ?? "";

    return (
      <>
        <p className="mb-2 text-sm"><Link href="/empresa/licitacoes" className="text-texto-suave hover:text-primario">← Licitações</Link></p>
        <Cabecalho
          titulo={`Licitação ${l.numero}`}
          descricao={l.objeto}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Cartao titulo="Órgão" className="lg:col-span-1">
            <dl className="space-y-3 px-5 py-4 text-sm">
              <div><dt className="text-xs text-texto-suave">Nome</dt><dd className="font-medium">{orgData?.nome ?? "—"}</dd></div>
              <div><dt className="text-xs text-texto-suave">CNPJ</dt><dd className="tabular">{formatarCnpj(cnpj)}</dd></div>
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

        <div className="mt-8">
          <Cartao titulo="Aviso">
            <p className="px-5 py-3 text-sm text-texto-suave">
              O fornecedor acompanha a licitação em modo somente leitura. Para apresentar um lance, entre em contato com o órgão responsável pelo edital.
            </p>
          </Cartao>
        </div>
      </>
    );
  });
}
