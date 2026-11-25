import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { recebimento, contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Vazio } from "@/components/ui";

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

export default async function PaginaRecebimentoDetalhe({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const [r] = await db
      .select({
        id: recebimento.id,
        contratoId: recebimento.contratoId,
        situacao: recebimento.situacao,
        data: recebimento.data,
        parecer: recebimento.parecer,
        criadoEm: recebimento.criadoEm,
        numero: contrato.numero,
        objeto: contrato.objeto,
      })
      .from(recebimento)
      .innerJoin(contrato, eq(contrato.id, recebimento.contratoId))
      .where(and(eq(recebimento.id, id), eq(recebimento.organizacaoId, sessao.organizacaoId)));
    if (!r) notFound();

    return (
      <>
        <p className="mb-2 text-sm"><Link href="/recebimentos" className="text-texto-suave hover:text-primario">← Recebimentos</Link></p>
        <Cabecalho
          titulo={`Recebimento — Contrato ${r.numero}`}
          descricao={r.objeto}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Cartao titulo="Detalhes">
            <dl className="space-y-3 px-5 py-4 text-sm">
              <div><dt className="text-xs text-texto-suave">Contrato</dt><dd className="font-medium">{r.numero}</dd></div>
              <div><dt className="text-xs text-texto-suave">Situação</dt><dd className="font-medium"><Selo tom={tomSituacao[r.situacao] ?? "neutro"}>{rotuloSituacao[r.situacao] ?? r.situacao}</Selo></dd></div>
              <div><dt className="text-xs text-texto-suave">Data</dt><dd className="tabular">{formatarData(r.data)}</dd></div>
              {r.parecer && <div><dt className="text-xs text-texto-suave">Parecer</dt><dd className="text-texto-suave">{r.parecer}</dd></div>}
              <div><dt className="text-xs text-texto-suave">Criado em</dt><dd className="tabular">{formatarData(r.criadoEm)}</dd></div>
            </dl>
          </Cartao>
        </div>
      </>
    );
  });
}
