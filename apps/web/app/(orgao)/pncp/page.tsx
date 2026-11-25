import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarMoeda, formatarData } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";

const rotuloSituacao: Record<string, string> = {
  vigente: "Vigente",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

const tomSituacao: Record<string, "neutro" | "primario" | "sucesso" | "alerta" | "erro"> = {
  vigente: "sucesso",
  suspenso: "alerta",
  encerrado: "erro",
};

export default async function PaginaPncp() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;

    const lista = await db
      .select()
      .from(contrato)
      .where(and(eq(contrato.organizacaoId, org), eq(contrato.pncpNumeroControle, contrato.pncpNumeroControle)))
      .orderBy(contrato.numero);

    const pncpContratos = lista.filter((c) => c.pncpNumeroControle);

    return (
      <>
        <Cabecalho
          titulo="Integração PNCP"
          descricao={`Portal Nacional de Compras Públicas — ${pncpContratos.length} contrato(s) oriundo(s) do PNCP.`}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Cartao titulo="Importar do PNCP">
            <p className="px-5 py-3 text-sm text-texto-suave">
              Consulta somente leitura ao Portal Nacional de Compras Públicas (PNCP). Informe o número de controle do contrato para importar os dados públicos.
            </p>
            <form action="/api/pncp/contratos" method="POST" className="px-5 py-4 grid gap-3 sm:grid-cols-2 items-end">
              <div className="flex-1">
                <label htmlFor="pncp-numero" className="block text-sm font-medium">Número de controle PNCP</label>
                <input
                  id="pncp-numero"
                  name="pncpNumeroControle"
                  placeholder="Ex: 12345678901234"
                  className="mt-1.5 w-full rounded-lg border border-borda-forte bg-white px-3 py-2.5 text-sm focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25"
                  required
                />
              </div>
              <button type="submit" className="rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-white hover:bg-primario-escuro">
                Importar
              </button>
            </form>
          </Cartao>

          <Cartao titulo="Contratos do PNCP">
            {pncpContratos.length === 0 ? (
              <Vazio
                titulo="Nenhum contrato do PNCP"
                texto="Contratos importados do PNCP aparecerão aqui."
              />
            ) : (
              <Tabela
                colunas={[
                  { rotulo: "Número" },
                  { rotulo: "Objeto" },
                  { rotulo: "Valor", alinhar: "direita" },
                  { rotulo: "Situação" },
                  { rotulo: "Assinatura" },
                ]}
              >
                {pncpContratos.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">{c.pncpNumeroControle}</td>
                    <td className="px-5 py-3 max-w-md truncate text-texto-suave">{c.objeto}</td>
                    <td className="tabular px-5 py-3 text-right">{formatarMoeda(c.valorGlobal)}</td>
                    <td className="px-5 py-3"><Selo tom={tomSituacao[c.situacao] ?? "neutro"}>{rotuloSituacao[c.situacao] ?? c.situacao}</Selo></td>
                    <td className="tabular px-5 py-3">{formatarData(c.dataAssinatura)}</td>
                  </tr>
                ))}
              </Tabela>
            )}
          </Cartao>
        </div>

        <div className="mt-6">
          <Cartao titulo="Sobre o PNCP">
            <p className="px-5 py-3 text-sm text-texto-suave">
              O PNCP (Portal Nacional de Compras Públicas) é a fonte oficial de dados de contratação pública no Brasil. A importação é feita em modo somente leitura: os dados são copiados para o banco local, mas nenhuma alteração é enviada de volta ao PNCP. Todos os contratos importados ficam vinculados ao seu órgão e seguem as regras de isolamento por RLS.
            </p>
          </Cartao>
        </div>
      </>
    );
  });
}
