import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { vinculoFornecedor, organizacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData, formatarCnpj } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";

const tomStatus: Record<string, "neutro" | "primario" | "sucesso" | "alerta" | "erro"> = {
  ativo: "sucesso",
  inativo: "erro",
};

export default async function PaginaVinculosFornecedores() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;

    const [orgData] = await db
      .select({ nome: organizacao.nome, cnpj: organizacao.cnpj })
      .from(organizacao)
      .where(eq(organizacao.id, org))
      .limit(1);

    const vinculos = await db
      .select({
        id: vinculoFornecedor.id,
        fornecedorOrgId: vinculoFornecedor.fornecedorOrgId,
        status: vinculoFornecedor.status,
        criadoEm: vinculoFornecedor.criadoEm,
      })
      .from(vinculoFornecedor)
      .where(eq(vinculoFornecedor.contratanteOrgId, org))
      .orderBy(vinculoFornecedor.criadoEm);

    // Busca nomes dos fornecedores vinculados
    const fornecedorIds = vinculos.map((v) => v.fornecedorOrgId);
    const fornecedores = fornecedorIds.length > 0
      ? await db
          .select({ id: organizacao.id, nome: organizacao.nome, cnpj: organizacao.cnpj })
          .from(organizacao)
          .where(inArray(organizacao.id, fornecedorIds))
      : [];
    const fornecedorMap = new Map(fornecedores.map((f) => [f.id, f]));

    const ativos = vinculos.filter((x) => x.status === "ativo").length;

    return (
      <>
        <Cabecalho
          titulo="Vínculos Contratante-Fornecedor"
          descricao={`Órgão: ${orgData?.nome} (${orgData?.cnpj}) · ${ativos} fornecedor(es) vinculado(s).`}
        />

        <Cartao titulo="Novo vínculo">
          <p className="px-5 py-3 text-sm text-texto-suave">
            Use a API <code>/api/vinculos-fornecedores</code> para cadastrar novos vínculos. O fornecedor deve já estar cadastrado como organização no sistema.
          </p>
        </Cartao>

        <Cartao titulo="Fornecedores vinculados">
          {vinculos.length === 0 ? (
            <Vazio
              titulo="Nenhum vínculo"
              texto="Os fornecedores vinculados ao seu órgão aparecerão aqui."
            />
          ) : (
            <Tabela
              colunas={[
                { rotulo: "Fornecedor" },
                { rotulo: "CNPJ" },
                { rotulo: "Status" },
                { rotulo: "Vinculado em" },
                { rotulo: "" },
              ]}
            >
              {vinculos.map((v) => {
                const f = fornecedorMap.get(v.fornecedorOrgId);
                return (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">{f?.nome ?? "Desconhecido"}</td>
                    <td className="tabular px-5 py-3 text-right font-mono text-xs">{formatarCnpj(f?.cnpj ?? "")}</td>
                    <td className="px-5 py-3"><Selo tom={tomStatus[v.status] ?? "neutro"}>{v.status}</Selo></td>
                    <td className="tabular px-5 py-3">{formatarData(v.criadoEm)}</td>
                    <td className="px-5 py-3"><Link href={`/vinculos-fornecedores/${v.id}`} className="text-xs font-medium text-primario hover:underline">Ver →</Link></td>
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
