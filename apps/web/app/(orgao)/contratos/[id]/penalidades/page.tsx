import Link from "next/link";
import { comOrganizacao } from "@contratacao/db/client";
import { penalidade, contrato } from "@contratacao/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getSessao } from "@/lib/sessao";
import { formatarData, formatarMoeda } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";
import { NovaPenalidade } from "@/components/nova-penalidade";
import { GerirPenalidade } from "@/components/gerir-penalidade";

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

const PODE_GERIR = ["administrador", "controlador", "fiscal"];

export default async function PaginaPenalidades({ params }: { params: Promise<{ id: string }> }) {
  const { id: contratoId } = await params;
  const sessao = await getSessao();
  const podeGerir = PODE_GERIR.includes(sessao.papel);

  const { penalidades, contratoBasico } = await comOrganizacao(sessao.organizacaoId, async (db) => {
    const [contratoData] = await db.select({
      numero: contrato.numero,
      objeto: contrato.objeto,
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

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={`/contratos/${contratoId}`} className="text-texto-suave hover:text-primario">← Contrato {contratoBasico.numero}</Link>
      </p>
      <Cabecalho
        titulo={`Penalidades do Contrato ${contratoBasico.numero}`}
        descricao={`Gerenciamento de penalidades para o contrato: ${contratoBasico.objeto}`}
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
              { rotulo: "Prazo Resposta" },
              { rotulo: "Situação" },
              ...(podeGerir ? [{ rotulo: "Decisão" }] : []),
              { rotulo: "Criado em" }
            ]}>
              {penalidades.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium">{p.tipo}</td>
                  <td className="px-5 py-3.5 tabular-nums">{formatarMoeda(p.valor)}</td>
                  <td className="px-5 py-3.5 max-w-md truncate">{p.justificativa}</td>
                  <td className="px-5 py-3.5 text-texto-suave">{p.baseLegal || "-"}</td>
                  <td className="px-5 py-3.5 text-texto-suave">{p.prazoResposta ? formatarData(p.prazoResposta) : "-"}</td>
                  <td className="px-5 py-3.5">
                    <Selo tom={situacaoTom[p.situacao] ?? "primario"}>
                      {situacaoRotulo[p.situacao] ?? p.situacao}
                    </Selo>
                  </td>
                  {podeGerir && (
                    <td className="px-5 py-3.5">
                      {p.situacao === "sugerida" || p.situacao === "aprovada" ? (
                        <GerirPenalidade id={p.id} situacao={p.situacao} contraditorio={p.contraditorio} prazoResposta={p.prazoResposta} />
                      ) : (
                        <span className="text-xs text-texto-suave">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3.5 tabular-nums">{formatarData(p.criadoEm)}</td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>
      </section>

      {podeGerir && (
        <section className="mt-6">
          <Cartao titulo="Registrar nova penalidade">
            <NovaPenalidade contratoId={contratoId} />
          </Cartao>
        </section>
      )}
    </>
  );
}
