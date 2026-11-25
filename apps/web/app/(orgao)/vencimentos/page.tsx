import Link from "next/link";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato, obrigacao, designacao } from "@contratacao/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessao } from "@/lib/sessao";
import { calcularVencimentos } from "@contratacao/domain";
import { formatarData } from "@/lib/formatar";
import { Cabecalho, Cartao, Indicador, Selo, Tabela, Vazio } from "@/components/ui";

const tipoRotulo: Record<string, string> = {
  entrega: "Entrega de bem",
  servico: "Execução de serviço",
  relatorio: "Relatório parcial",
  pagamento: "Medição/Pagamento",
};

export default async function PaginaVencimentos() {
  const sessao = await getSessao();
  const hoje = new Date().toISOString().slice(0, 10);
  const diasJanela = 90;

  const resultado = await comOrganizacao(sessao.organizacaoId, async (db) => {
    const [contratos, obrigacoes, designacoes] = await Promise.all([
      db.select({
        id: contrato.id, numero: contrato.numero, objeto: contrato.objeto,
        situacao: contrato.situacao, dataAssinatura: contrato.dataAssinatura, fiscalId: contrato.fiscalId,
      }).from(contrato).where(eq(contrato.organizacaoId, sessao.organizacaoId)),
      db.select({
        id: obrigacao.id, contratoId: obrigacao.contratoId,
        obrigacaoTipo: obrigacao.tipo, prazoDias: obrigacao.prazoDias,
        dataLimite: obrigacao.dataLimite, criadoEm: obrigacao.criadoEm,
      }).from(obrigacao).where(eq(obrigacao.organizacaoId, sessao.organizacaoId)),
      db.select({ contratoId: designacao.contratoId }).from(designacao).where(and(eq(designacao.organizacaoId, sessao.organizacaoId), eq(designacao.ativo, "sim"))),
    ]);

    const designados = new Set(designacoes.map((d) => d.contratoId));
    const numeroContrato = new Map(contratos.map((c) => [c.id, c.numero]));

    return calcularVencimentos({
      hoje, diasJanela,
      obrigacoes: obrigacoes.map((o) => ({
        id: o.id, contratoId: o.contratoId, contratoNumero: numeroContrato.get(o.contratoId) ?? "",
        tipo: o.obrigacaoTipo, obrigacaoTipo: o.obrigacaoTipo,
        prazoDias: o.prazoDias, dataLimite: o.dataLimite, criadoEm: o.criadoEm.toISOString(),
      })),
      contratos: contratos.map((c) => ({
        id: c.id, numero: c.numero, objeto: c.objeto, situacao: c.situacao,
        dataAssinatura: c.dataAssinatura, fiscalId: c.fiscalId, designadoEm: designados.has(c.id) ? c.dataAssinatura : null,
      })),
    });
  });

  return (
    <>
      <Cabecalho
        titulo="Alerta de Vencimentos (90 dias)"
        descricao="Acompanhamento preventivo de prazos contratuais e contratos sem fiscal designado — ContratoVivo."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador rotulo="Vencidos" valor={String(resultado.vencidos.length)} detalhe="Exigem atenção imediata" tom="erro" />
        <Indicador rotulo="A vencer (90d)" valor={String(resultado.aVencer.length)} detalhe="Dentro da janela crítica" tom="alerta" />
        <Indicador rotulo="Sem fiscal designado" valor={String(resultado.semFiscal.length)} detalhe="Contratos vigentes desamparados" tom="primario" />
      </div>

      {resultado.vencidos.length > 0 && (
        <section className="mt-8">
          <Cartao titulo="⚠️ Obrigações Vencidas">
            <Tabela colunas={[{ rotulo: "Contrato" }, { rotulo: "Tipo" }, { rotulo: "Data limite" }, { rotulo: "Atraso" }]}>
              {resultado.vencidos.map((v) => (
                <tr key={v.obrigacaoId} className="hover:bg-red-50/50">
                  <td className="px-5 py-3.5 font-medium">
                    <Link href={`/contratos/${v.contratoId}`} className="text-primario hover:underline">{v.contratoNumero}</Link>
                  </td>
                  <td className="px-5 py-3.5">{tipoRotulo[v.tipo] ?? v.tipo}</td>
                  <td className="tabular px-5 py-3.5 text-texto-suave">{formatarData(v.dataLimite)}</td>
                  <td className="px-5 py-3.5">
                    <Selo tom="erro">{Math.abs(v.diasRestantes)} dias de atraso</Selo>
                  </td>
                </tr>
              ))}
            </Tabela>
          </Cartao>
        </section>
      )}

      <section className="mt-8">
        <Cartao titulo="📅 Próximos Vencimentos (90 dias)">
          {resultado.aVencer.length === 0 ? (
            <Vazio titulo="Nenhum vencimento próximo" texto="Todas as obrigações cadastradas estão com prazo em dia." />
          ) : (
            <Tabela colunas={[{ rotulo: "Contrato" }, { rotulo: "Tipo" }, { rotulo: "Data limite" }, { rotulo: "Prazo restante" }]}>
              {resultado.aVencer.map((v) => (
                <tr key={v.obrigacaoId} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium">
                    <Link href={`/contratos/${v.contratoId}`} className="text-primario hover:underline">{v.contratoNumero}</Link>
                  </td>
                  <td className="px-5 py-3.5">{tipoRotulo[v.tipo] ?? v.tipo}</td>
                  <td className="tabular px-5 py-3.5 text-texto-suave">{formatarData(v.dataLimite)}</td>
                  <td className="px-5 py-3.5">
                    <Selo tom={v.diasRestantes <= 15 ? "erro" : v.diasRestantes <= 45 ? "alerta" : "primario"}>
                      Em {v.diasRestantes} dias
                    </Selo>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>
      </section>

      <section className="mt-8">
        <Cartao titulo="🚨 Contratos Vigentes Sem Fiscal Designado">
          {resultado.semFiscal.length === 0 ? (
            <Vazio titulo="Todos os contratos possuem fiscal" texto="Nenhum contrato vigente está sem fiscal designado por portaria." />
          ) : (
            <Tabela colunas={[{ rotulo: "Contrato" }, { rotulo: "Objeto" }, { rotulo: "Situação" }, { rotulo: "Sem fiscal há" }]}>
              {resultado.semFiscal.map((c) => (
                <tr key={c.contratoId} className="hover:bg-amber-50/50">
                  <td className="px-5 py-3.5 font-medium">
                    <Link href={`/contratos/${c.contratoId}`} className="text-primario hover:underline">{c.numero}</Link>
                  </td>
                  <td className="px-5 py-3.5 max-w-md truncate">{c.objeto}</td>
                  <td className="px-5 py-3.5"><Selo tom="sucesso">{c.situacao}</Selo></td>
                  <td className="px-5 py-3.5">
                    <Selo tom="alerta">{c.diasSemDesignacao} dias sem portaria</Selo>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>
      </section>
    </>
  );
}