import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato, organizacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { Cabecalho, Cartao, Vazio, Selo } from "@/components/ui";
import { formatarMoeda, formatarData } from "@/lib/formatar";

export default async function PaginaEmpresaContratos() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;

    const [orgData] = await db
      .select({ cnpj: organizacao.cnpj })
      .from(organizacao)
      .where(eq(organizacao.id, org))
      .limit(1);
    const cnpj = orgData?.cnpj ?? "";

    const contratos = await db
      .select({
        id: contrato.id,
        numero: contrato.numero,
        objeto: contrato.objeto,
        valorGlobal: contrato.valorGlobal,
        situacao: contrato.situacao,
        dataFim: contrato.dataFim,
      })
      .from(contrato)
      .where(and(eq(contrato.fornecedorCnpj, cnpj), eq(contrato.organizacaoId, org)))
      .orderBy(contrato.numero);

    return (
      <>
        <Cabecalho
          titulo="Meus Contratos"
          descricao="Contratos em que sua empresa é fornecedora."
        />
        {contratos.length === 0 ? (
          <Vazio
            titulo="Nenhum contrato encontrado"
            texto="Seus contratos aparecerão aqui quando o órgão público cadastrar sua empresa como fornecedora."
          />
        ) : (
          <Cartao titulo="Contratos">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borda bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-texto-suave">
                    <th className="px-5 py-3">Contrato</th>
                    <th className="px-5 py-3">Objeto</th>
                    <th className="tabular px-5 py-3 text-right">Valor</th>
                    <th className="px-5 py-3">Situação</th>
                    <th className="px-5 py-3">Vigência</th>
                    <th className="px-5 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borda">
                  {contratos.map((c) => {
                    const tom = c.situacao === "vigente" ? "sucesso" : c.situacao === "suspenso" ? "alerta" : "neutro";
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium"><Link href={`/empresa/contratos/${c.id}`} className="text-primario hover:underline">{c.numero}</Link></td>
                        <td className="px-5 py-3">{c.objeto}</td>
                        <td className="tabular px-5 py-3 text-right">{formatarMoeda(c.valorGlobal)}</td>
                        <td className="px-5 py-3"><Selo tom={tom}>{c.situacao}</Selo></td>
                        <td className="tabular px-5 py-3">{formatarData(c.dataFim)}</td>
                        <td className="px-5 py-3"><Link href={`/empresa/contratos/${c.id}`} className="text-xs font-medium text-primario hover:underline">Ver →</Link></td>
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
