import Link from "next/link";
import { and, eq, desc } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { obrigacao, contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";

const rotuloTipo: Record<string, string> = {
  entrega: "Entrega",
  servico: "Serviço",
  relatorio: "Relatório",
  pagamento: "Pagamento",
};

const tomTipo: Record<string, "neutro" | "primario" | "sucesso" | "alerta" | "erro"> = {
  entrega: "primario",
  servico: "sucesso",
  relatorio: "alerta",
  pagamento: "erro",
};

export default async function PaginaObrigacoes() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;

    const lista = await db
      .select({ o: obrigacao, numero: contrato.numero })
      .from(obrigacao)
      .innerJoin(contrato, eq(contrato.id, obrigacao.contratoId))
      .where(eq(obrigacao.organizacaoId, org))
      .orderBy(desc(obrigacao.criadoEm));

    return (
      <>
        <Cabecalho
          titulo="Obrigações Contratuais"
          descricao={`${lista.length} obrigação(ões) cadastrada(s) · acompanhe prazos e tipos de obrigação.`}
        />
        <Cartao titulo="Nova obrigação">
          <p className="px-5 py-3 text-sm text-texto-suave">
            Use a API <code>/api/obrigacoes</code> para cadastrar novas obrigações. A lista abaixo exibe as já criadas.
          </p>
        </Cartao>
        <Cartao titulo="Histórico de Obrigações">
          {lista.length === 0 ? (
            <Vazio
              titulo="Nenhuma obrigação"
              texto="As obrigações contratuais cadastradas aparecem aqui."
            />
          ) : (
            <Tabela
              colunas={[
                { rotulo: "Contrato" },
                { rotulo: "Tipo" },
                { rotulo: "Descrição" },
                { rotulo: "Prazo (dias)" },
                { rotulo: "Data limite" },
                { rotulo: "" },
              ]}
            >
              {lista.map(({ o, numero }) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium"><Link href={`/contratos/${o.contratoId}`} className="text-primario hover:underline">{numero}</Link></td>
                  <td className="px-5 py-3"><Selo tom={tomTipo[o.tipo] ?? "neutro"}>{rotuloTipo[o.tipo] ?? o.tipo}</Selo></td>
                  <td className="px-5 py-3 max-w-md truncate text-texto-suave">{o.descricao}</td>
                  <td className="tabular px-5 py-3 text-right">{o.prazoDias ?? "—"}</td>
                  <td className="tabular px-5 py-3">{o.dataLimite ? formatarData(o.dataLimite) : "—"}</td>
                  <td className="px-5 py-3"><Link href={`/obrigacoes/${o.id}`} className="text-xs font-medium text-primario hover:underline">Ver →</Link></td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>
      </>
    );
  });
}
