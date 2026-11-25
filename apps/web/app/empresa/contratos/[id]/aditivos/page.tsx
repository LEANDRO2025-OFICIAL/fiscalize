import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { aditivo, contrato, organizacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData, formatarMoeda } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";

const tipoRotulo: Record<string, string> = {
  prorrogacao: "Prorrogação",
  acrescimo: "Acréscimo",
  reducao: "Redução",
  reforma: "Reforma",
  acerto: "Acerto",
  outro: "Outro"
};

export default async function PaginaEmpresaAditivos({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id: contratoId } = await params;
  const sessao = await getSessao();

  const { aditivos, contratoBasico } = await comOrganizacao(sessao.organizacaoId, async (db) => {
    const [contratoData] = await db.select({
      numero: contrato.numero,
      objeto: contrato.objeto,
      fornecedorCnpj: contrato.fornecedorCnpj,
    }).from(contrato).where(and(
      eq(contrato.id, contratoId),
      eq(contrato.organizacaoId, sessao.organizacaoId)
    ));

    const aditivos = await db.select()
      .from(aditivo)
      .where(and(
        eq(aditivo.contratoId, contratoId),
        eq(aditivo.organizacaoId, sessao.organizacaoId)
      ))
      .orderBy(aditivo.numero);

    return { aditivos, contratoBasico: contratoData };
  });

  if (!contratoBasico) notFound();

  const orgData = await comOrganizacao(sessao.organizacaoId, async (db) => {
    return db.select({ cnpj: organizacao.cnpj }).from(organizacao).where(eq(organizacao.id, sessao.organizacaoId)).limit(1);
  });
  const cnpj = orgData[0]?.cnpj ?? "";
  if (contratoBasico.fornecedorCnpj !== cnpj) notFound();

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={`/empresa/contratos/${contratoId}`} className="text-texto-suave hover:text-primario">← Contrato {contratoBasico.numero}</Link>
      </p>
      <Cabecalho
        titulo={`Aditivos do Contrato ${contratoBasico.numero}`}
        descricao={`Aditivos registrados para o contrato: ${contratoBasico.objeto}`}
      />

      <section className="mt-8">
        <Cartao titulo="Lista de Aditivos">
          {aditivos.length === 0 ? (
            <Vazio titulo="Nenhum aditivo cadastrado" texto="Este contrato ainda não possui aditivos registrados." />
          ) : (
            <Tabela colunas={[
              { rotulo: "Número" },
              { rotulo: "Tipo" },
              { rotulo: "Objeto" },
              { rotulo: "Valor" },
              { rotulo: "Assinatura" },
              { rotulo: "Vigência" },
              { rotulo: "Status" }
            ]}>
              {aditivos.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium">{a.numero}</td>
                  <td className="px-5 py-3.5">{tipoRotulo[a.tipo] ?? a.tipo}</td>
                  <td className="px-5 py-3.5 max-w-md truncate">{a.objeto}</td>
                  <td className="px-5 py-3.5 tabular-nums">{formatarMoeda(a.valor)}</td>
                  <td className="px-5 py-3.5 tabular-nums">{formatarData(a.dataAssinatura)}</td>
                  <td className="px-5 py-3.5">
                    {a.vigenciaInicio && a.vigenciaFim ? (
                      <>{formatarData(a.vigenciaInicio)} a {formatarData(a.vigenciaFim)}</>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <Selo tom={a.dataPublicacao ? "sucesso" : "alerta"}>
                      {a.dataPublicacao ? "Publicado" : "Em rascunho"}
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
