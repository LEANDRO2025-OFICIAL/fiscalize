import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { obrigacao, contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Vazio } from "@/components/ui";

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

export default async function PaginaObrigacaoDetalhe({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const [o] = await db
      .select({ o: obrigacao, numero: contrato.numero, objeto: contrato.objeto })
      .from(obrigacao)
      .innerJoin(contrato, eq(contrato.id, obrigacao.contratoId))
      .where(and(eq(obrigacao.id, id), eq(obrigacao.organizacaoId, sessao.organizacaoId)));
    if (!o) notFound();

    return (
      <>
        <p className="mb-2 text-sm"><Link href="/obrigacoes" className="text-texto-suave hover:text-primario">← Obrigações</Link></p>
        <Cabecalho
          titulo={`Obrigação — Contrato ${o.numero}`}
          descricao={o.objeto}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Cartao titulo="Detalhes">
            <dl className="space-y-3 px-5 py-4 text-sm">
              <div><dt className="text-xs text-texto-suave">Contrato</dt><dd className="font-medium">{o.numero}</dd></div>
              <div><dt className="text-xs text-texto-suave">Tipo</dt><dd className="font-medium"><Selo tom={tomTipo[o.o.tipo] ?? "neutro"}>{rotuloTipo[o.o.tipo] ?? o.o.tipo}</Selo></dd></div>
              <div><dt className="text-xs text-texto-suave">Descrição</dt><dd className="text-texto-suave">{o.o.descricao}</dd></div>
              <div><dt className="text-xs text-texto-suave">Prazo</dt><dd className="tabular">{o.o.prazoDias ?? "—"} dia(s)</dd></div>
              <div><dt className="text-xs text-texto-suave">Data limite</dt><dd className="tabular">{o.o.dataLimite ? formatarData(o.o.dataLimite) : "—"}</dd></div>
              <div><dt className="text-xs text-texto-suave">Criada em</dt><dd className="tabular">{formatarData(o.o.criadoEm)}</dd></div>
            </dl>
          </Cartao>
        </div>
      </>
    );
  });
}
