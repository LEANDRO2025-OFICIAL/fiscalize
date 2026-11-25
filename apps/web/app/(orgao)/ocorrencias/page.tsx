import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato, ocorrencia } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData, formatarDataHora } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";
import { FormOcorrencia, ResolverOcorrencia } from "@/components/ocorrencia";

const gravidade = { baixa: ["neutro", "Baixa"], media: ["alerta", "Média"], alta: ["erro", "Alta"] } as const;
const tipos: Record<string, string> = { nao_conformidade: "Não conformidade", atraso: "Atraso", seguranca: "Segurança", qualidade: "Qualidade", outro: "Outro" };

export default async function PaginaOcorrencias() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  const org = sessao.organizacaoId;
  const podeRegistrar = ["administrador", "controlador", "fiscal"].includes(sessao.papel);
  const contratos = await db.select({ id: contrato.id, numero: contrato.numero }).from(contrato).where(eq(contrato.organizacaoId, org)).orderBy(contrato.numero);
  const lista = await db.select({ o: ocorrencia, numero: contrato.numero, contratoId: contrato.id }).from(ocorrencia).innerJoin(contrato, eq(contrato.id, ocorrencia.contratoId)).where(eq(ocorrencia.organizacaoId, org)).orderBy(desc(ocorrencia.criadoEm)).limit(100);
  const abertas = lista.filter((x) => x.o.status === "aberta").length;

  return (
    <>
      <Cabecalho titulo="Ocorrências" descricao={`${abertas} aberta(s) · registre não conformidades com foto e localização.`} />
      {podeRegistrar && <Cartao titulo="Registrar ocorrência" className="mb-6"><FormOcorrencia contratos={contratos} /></Cartao>}
      <Cartao titulo="Histórico">
        {lista.length === 0 ? <Vazio titulo="Nenhuma ocorrência" texto="As não conformidades registradas pelos fiscais aparecem aqui." /> : (
          <Tabela colunas={[{ rotulo: "Contrato" }, { rotulo: "Ocorrência" }, { rotulo: "Gravidade" }, { rotulo: "Situação" }, { rotulo: "" }]}>
            {lista.map(({ o, numero, contratoId }) => {
              const [tom, rot] = gravidade[o.gravidade as keyof typeof gravidade] ?? ["neutro", o.gravidade];
              return (
                <tr key={o.id} className="align-top hover:bg-slate-50">
                  <td className="px-5 py-3"><Link href={`/contratos/${contratoId}`} className="font-medium text-primario hover:underline">{numero}</Link></td>
                  <td className="px-5 py-3"><p className="font-medium">{tipos[o.tipo] ?? o.tipo}</p><p className="max-w-md text-texto-suave">{o.descricao}</p><p className="tabular text-xs text-texto-suave">{formatarDataHora(o.criadoEm)}{o.prazo && ` · prazo ${formatarData(o.prazo)}`}{o.latitude && ` · 📍 ${o.latitude}, ${o.longitude}`}</p>{o.resolucao && <p className="mt-1 text-xs text-sucesso">Resolução: {o.resolucao}</p>}</td>
                  <td className="px-5 py-3"><Selo tom={tom}>{rot}</Selo></td>
                  <td className="px-5 py-3"><Selo tom={o.status === "aberta" ? "alerta" : "sucesso"}>{o.status === "aberta" ? "Aberta" : "Resolvida"}</Selo></td>
                  <td className="px-5 py-3">{o.status === "aberta" && podeRegistrar && <ResolverOcorrencia id={o.id} />}</td>
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
