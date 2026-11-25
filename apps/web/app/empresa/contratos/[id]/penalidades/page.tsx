import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { penalidade, contrato, organizacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData, formatarMoeda } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";

const situacaoRotulo: Record<string, string> = {
  sugerida: "Sugerida",
  aprovada: "Aprovada",
  cumprida: "Cumprida",
  cancelada: "Cancelada"
};

const situacaoTom: Record<string, "alerta" | "sucesso" | "erro" | "primario"> = {
  sugerida: "alerta",
  aprovada: "primario",
  cumprida: "sucesso",
  cancelada: "erro"
};

export default async function PaginaEmpresaPenalidades({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id: contratoId } = await params;
  const sessao = await getSessao();

  const { penalidades, contratoBasico } = await comOrganizacao(sessao.organizacaoId, async (db) => {
    const [contratoData] = await db.select({
      numero: contrato.numero,
      objeto: contrato.objeto,
      fornecedorCnpj: contrato.fornecedorCnpj,
    }).from(contrato).where(and(
      eq(contrato.id, contratoId),
      eq(contrato.organizacaoId, sessao.organizacaoId)
    ));

    const penalidades = await db.select()
      .from(penalidade)
      .where(and(
        eq(penalidade.contratoId, contratoId),
        eq(penalidade.organizacaoId, sessao.organizacaoId)
      ))
      .orderBy(desc(penalidade.criadoEm));

    return { penalidades, contratoBasico: contratoData };
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
        titulo={`Penalidades do Contrato ${contratoBasico.numero}`}
        descricao={`Penalidades registradas para o contrato: ${contratoBasico.objeto}`}
      />

      <section className="mt-8">
        <Cartao titulo="Lista de Penalidades">
          {penalidades.length === 0 ? (
            <Vazio titulo="Nenhuma penalidade registrada" texto="Este contrato ainda não possui penalidades registradas." />
          ) : (
            <Tabela colunas={[
              { rotulo: "Tipo" },
              { rotulo: "Valor" },
              { rotulo: "Justificativa" },
              { rotulo: "Base Legal" },
              { rotulo: "Situação" },
              { rotulo: "Criado em" }
            ]}>
              {penalidades.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium">{p.tipo}</td>
                  <td className="px-5 py-3.5 tabular-nums">{formatarMoeda(p.valor)}</td>
                  <td className="px-5 py-3.5 max-w-md truncate">{p.justificativa}</td>
                  <td className="px-5 py-3.5 text-texto-suave">{p.baseLegal || "-"}</td>
                  <td className="px-5 py-3.5">
                    <Selo tom={situacaoTom[p.situacao] ?? "primario"}>
                      {situacaoRotulo[p.situacao] ?? p.situacao}
                    </Selo>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums">{formatarData(p.criadoEm)}</td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>
      </section>
    </>
  );
}
