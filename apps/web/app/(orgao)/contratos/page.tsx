import Link from "next/link";
import { eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarMoeda, formatarData, formatarCnpj } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";

const situacao = { vigente: ["sucesso", "Vigente"], suspenso: ["alerta", "Suspenso"], encerrado: ["neutro", "Encerrado"] } as const;

export default async function PaginaContratos() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  const lista = await db.select().from(contrato).where(eq(contrato.organizacaoId, sessao.organizacaoId)).orderBy(contrato.numero);

  return (
    <>
      <Cabecalho titulo="Contratos" descricao={`${lista.length} contrato(s) sob a responsabilidade do órgão.`} acao={["administrador", "controlador", "fiscal"].includes(sessao.papel) ? <Link href="/contratos/novo" className="rounded-lg bg-primario px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primario-escuro">+ Novo contrato</Link> : undefined} />
      <Cartao>
        {lista.length === 0 ? (
          <Vazio titulo="Nenhum contrato" texto="Cadastre o primeiro contrato para iniciar a fiscalização." />
        ) : (
          <Tabela colunas={[{ rotulo: "Número" }, { rotulo: "Objeto" }, { rotulo: "Fornecedor" }, { rotulo: "Vigência" }, { rotulo: "Valor global", alinhar: "direita" }, { rotulo: "Situação" }]}>
            {lista.map((c) => {
              const [tom, rotulo] = situacao[c.situacao];
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5"><Link href={`/contratos/${c.id}`} className="font-semibold text-primario hover:underline">{c.numero}</Link>{c.pncpNumeroControle && <span className="ml-2 align-middle"><Selo tom="primario">PNCP</Selo></span>}</td>
                  <td className="px-5 py-3.5">{c.objeto}</td>
                  <td className="px-5 py-3.5"><p>{c.fornecedorNome}</p><p className="tabular text-xs text-texto-suave">{formatarCnpj(c.fornecedorCnpj)}</p></td>
                  <td className="tabular px-5 py-3.5 text-texto-suave">{formatarData(c.dataAssinatura)} – {formatarData(c.dataFim)}</td>
                  <td className="tabular px-5 py-3.5 text-right font-medium">{formatarMoeda(c.valorGlobal)}</td>
                  <td className="px-5 py-3.5"><Selo tom={tom}>{rotulo}</Selo></td>
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
