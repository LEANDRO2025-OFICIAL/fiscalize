import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato, ocorrencia, organizacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData, formatarDataHora } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";

const gravidade = {
  baixa: ["neutro", "Baixa"],
  media: ["alerta", "Média"],
  alta: ["erro", "Alta"],
} as const;

const tipos: Record<string, string> = {
  nao_conformidade: "Não conformidade",
  atraso: "Atraso",
  seguranca: "Segurança",
  qualidade: "Qualidade",
  outro: "Outro",
};

export default async function PaginaEmpresaOcorrencias({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id: contratoId } = await params;
  const sessao = await getSessao();

  const { contrato: c, ocorrencias } = await comOrganizacao(
    sessao.organizacaoId,
    async (db) => {
      const [contratoData] = await db
        .select({
          id: contrato.id,
          numero: contrato.numero,
          objeto: contrato.objeto,
          fornecedorCnpj: contrato.fornecedorCnpj,
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
        .from(ocorrencia)
        .where(
          and(
            eq(ocorrencia.contratoId, contratoId),
            eq(ocorrencia.organizacaoId, sessao.organizacaoId)
          )
        )
        .orderBy(desc(ocorrencia.criadoEm));

      return { contrato: contratoData, ocorrencias: lista };
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

  const abertas = ocorrencias.filter((o) => o.status === "aberta").length;

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
        titulo={`Ocorrências do Contrato ${c.numero}`}
        descricao={`Não conformidades registradas na fiscalização: ${c.objeto} · ${abertas} aberta(s)`}
      />

      <section className="mt-8">
        <Cartao titulo="Histórico de Ocorrências">
          {ocorrencias.length === 0 ? (
            <Vazio
              titulo="Nenhuma ocorrência"
              texto="Não há ocorrências registradas para este contrato."
            />
          ) : (
            <Tabela
              colunas={[
                { rotulo: "Tipo" },
                { rotulo: "Gravidade" },
                { rotulo: "Situação" },
                { rotulo: "Descrição" },
                { rotulo: "Registrado em" },
              ]}
            >
              {ocorrencias.map((o) => {
                const [tom, rot] =
                  gravidade[o.gravidade as keyof typeof gravidade] ??
                  ["neutro", o.gravidade];
                return (
                  <tr key={o.id} className="align-top hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">
                      {tipos[o.tipo] ?? o.tipo}
                    </td>
                    <td className="px-5 py-3"><Selo tom={tom}>{rot}</Selo></td>
                    <td className="px-5 py-3">
                      <Selo
                        tom={
                          o.status === "aberta" ? "alerta" : "sucesso"
                        }
                      >
                        {o.status === "aberta" ? "Aberta" : "Resolvida"}
                      </Selo>
                    </td>
                    <td className="px-5 py-3 max-w-md truncate">
                      {o.descricao}
                    </td>
                    <td className="tabular px-5 py-3 text-xs">
                      {formatarDataHora(o.criadoEm)}
                      {o.prazo && ` · prazo ${formatarData(o.prazo)}`}
                    </td>
                  </tr>
                );
              })}
            </Tabela>
          )}
        </Cartao>
      </section>
    </>
  );
}
