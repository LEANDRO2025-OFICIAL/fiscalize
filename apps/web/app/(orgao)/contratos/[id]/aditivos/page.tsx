import Link from "next/link";
import { comOrganizacao } from "@contratacao/db/client";
import { aditivo, contrato } from "@contratacao/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getSessao } from "@/lib/sessao";
import { formatarData, formatarMoeda } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";
import { NovoAditivo } from "@/components/novo-aditivo";

const tipoRotulo: Record<string, string> = {
  prorrogacao: "Prorrogação",
  acrescimo: "Acréscimo",
  reducao: "Redução",
  reforma: "Reforma",
  acerto: "Acerto",
  outro: "Outro"
};

const PODE_GERIR = ["administrador", "controlador", "fiscal"];

export default async function PaginaAditivos({ params }: { params: Promise<{ id: string }> }) {
  const { id: contratoId } = await params;
  const sessao = await getSessao();
  const podeGerir = PODE_GERIR.includes(sessao.papel);

  const { aditivos, contratoBasico } = await comOrganizacao(sessao.organizacaoId, async (db) => {
    const [contratoData] = await db.select({
      numero: contrato.numero,
      objeto: contrato.objeto,
    }).from(contrato).where(and(
      eq(contrato.id, contratoId),
      eq(contrato.organizacaoId, sessao.organizacaoId)
    ));

    const aditivos = await db.select()
      .from(aditivo)
      .where(and(
        eq(aditivo.contratoId, contratoId),
        eq(aditivo.organizacaoId, sessao.organizacaoId)
      ))
      .orderBy(aditivo.numero);

    return { aditivos, contratoBasico: contratoData };
  });

  if (!contratoBasico) notFound();
  const proximoNumero = aditivos.reduce((m, a) => Math.max(m, a.numero), 0) + 1;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={`/contratos/${contratoId}`} className="text-texto-suave hover:text-primario">← Contrato {contratoBasico.numero}</Link>
      </p>
      <Cabecalho
        titulo={`Aditivos do Contrato ${contratoBasico.numero}`}
        descricao={`Gerenciamento de aditivos para o contrato: ${contratoBasico.objeto}`}
      />

      <section className="mt-8">
        <Cartao titulo="Lista de Aditivos">
          {aditivos.length === 0 ? (
            <Vazio titulo="Nenhum aditivo cadastrado" texto="Este contrato ainda não possui aditivos registrados." />
          ) : (
            <Tabela colunas={[
              { rotulo: "Número" },
              { rotulo: "Tipo" },
              { rotulo: "Objeto" },
              { rotulo: "Valor" },
              { rotulo: "Assinatura" },
              { rotulo: "Vigência" },
              { rotulo: "Status" }
            ]}>
              {aditivos.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium">{a.numero}</td>
                  <td className="px-5 py-3.5">{tipoRotulo[a.tipo] ?? a.tipo}</td>
                  <td className="px-5 py-3.5 max-w-md truncate">{a.objeto}</td>
                  <td className="px-5 py-3.5 tabular-nums">{formatarMoeda(a.valor)}</td>
                  <td className="px-5 py-3.5 tabular-nums">{formatarData(a.dataAssinatura)}</td>
                  <td className="px-5 py-3.5">
                    {a.vigenciaInicio && a.vigenciaFim ? (
                      <>{formatarData(a.vigenciaInicio)} a {formatarData(a.vigenciaFim)}</>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <Selo tom={a.dataPublicacao ? "sucesso" : "alerta"}>
                      {a.dataPublicacao ? "Publicado" : "Em rascunho"}
                    </Selo>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>
      </section>

      {podeGerir && (
        <section className="mt-6">
          <Cartao titulo="Registrar novo aditivo">
            <NovoAditivo contratoId={contratoId} proximoNumero={proximoNumero} />
          </Cartao>
        </section>
      )}
    </>
  );
}
