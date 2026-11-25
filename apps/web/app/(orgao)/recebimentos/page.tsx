import Link from "next/link";
import { and, eq, desc } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { recebimento, contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";

const rotuloSituacao: Record<string, string> = {
  pendente: "Pendente",
  conforme: "Conforme",
  divergente: "Divergente",
};

const tomSituacao: Record<string, "neutro" | "primario" | "sucesso" | "alerta" | "erro"> = {
  pendente: "alerta",
  conforme: "sucesso",
  divergente: "erro",
};

export default async function PaginaRecebimentos() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;

    const lista = await db
      .select({
        id: recebimento.id,
        contratoId: recebimento.contratoId,
        situacao: recebimento.situacao,
        data: recebimento.data,
        parecer: recebimento.parecer,
        numero: contrato.numero,
      })
      .from(recebimento)
      .innerJoin(contrato, eq(contrato.id, recebimento.contratoId))
      .where(eq(recebimento.organizacaoId, org))
      .orderBy(desc(recebimento.data));

    const pendentes = lista.filter((x) => x.situacao === "pendente").length;

    return (
      <>
        <Cabecalho
          titulo="Recebimentos Contratuais"
          descricao={`${lista.length} recebimento(s) · ${pendentes} pendente(s) de análise.`}
        />
        <Cartao titulo="Novo recebimento">
          <p className="px-5 py-3 text-sm text-texto-suave">
            Use a API <code>/api/recebimentos</code> para registrar novos recebimentos. A lista abaixo exibe os já criados.
          </p>
        </Cartao>
        <Cartao titulo="Histórico de Recebimentos">
          {lista.length === 0 ? (
            <Vazio
              titulo="Nenhum recebimento"
              texto="Os recebimentos contratuais cadastrados aparecem aqui."
            />
          ) : (
            <Tabela
              colunas={[
                { rotulo: "Contrato" },
                { rotulo: "Situação" },
                { rotulo: "Data" },
                { rotulo: "Parecer" },
                { rotulo: "" },
              ]}
            >
              {lista.map((x) => (
                <tr key={x.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium"><Link href={`/contratos/${x.contratoId}`} className="text-primario hover:underline">{x.numero}</Link></td>
                  <td className="px-5 py-3"><Selo tom={tomSituacao[x.situacao] ?? "neutro"}>{rotuloSituacao[x.situacao] ?? x.situacao}</Selo></td>
                  <td className="tabular px-5 py-3">{formatarData(x.data)}</td>
                  <td className="px-5 py-3 max-w-md truncate text-texto-suave">{x.parecer ?? "—"}</td>
                  <td className="px-5 py-3"><Link href={`/recebimentos/${x.id}`} className="text-xs font-medium text-primario hover:underline">Ver →</Link></td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>
      </>
    );
  });
}
