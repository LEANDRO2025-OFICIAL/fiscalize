import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato, medicao, evidencia, eventoAuditoria, ocorrencia } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarMoeda, formatarData, formatarDataHora, diasAte } from "@/lib/formatar";
import { Cabecalho, Cartao, Indicador, Selo, Tabela, Vazio } from "@/components/ui";
import { Barras, BarraProgresso, Rosca } from "@/components/graficos";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default async function PaginaInicio() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  const org = sessao.organizacaoId;
  const hoje = new Date().toISOString().slice(0, 10);

  const [resumo] = await db.select({
    vigentes: sql<number>`count(*) filter (where ${contrato.situacao} = 'vigente')::int`,
    valor: sql<string>`coalesce(sum(${contrato.valorGlobal}) filter (where ${contrato.situacao} = 'vigente'), 0)`,
    suspensos: sql<number>`count(*) filter (where ${contrato.situacao} = 'suspenso')::int`,
    encerrados: sql<number>`count(*) filter (where ${contrato.situacao} = 'encerrado')::int`,
    eng: sql<number>`count(*) filter (where ${contrato.categoria} = 'engenharia')::int`,
    serv: sql<number>`count(*) filter (where ${contrato.categoria} = 'servico')::int`,
    bens: sql<number>`count(*) filter (where ${contrato.categoria} = 'bens')::int`,
  }).from(contrato).where(eq(contrato.organizacaoId, org));

  const [med] = await db.select({
    submetidas: sql<number>`count(*) filter (where ${medicao.situacao} = 'submetida')::int`,
    rascunhos: sql<number>`count(*) filter (where ${medicao.situacao} = 'rascunho')::int`,
    liquido: sql<string>`coalesce(sum(${medicao.valorLiquido}) filter (where ${medicao.situacao} = 'aprovada'), 0)`,
    glosa: sql<string>`coalesce(sum(${medicao.valorGlosa}) filter (where ${medicao.situacao} = 'aprovada'), 0)`,
  }).from(medicao).where(eq(medicao.organizacaoId, org));

  const [ev] = await db.select({ total: sql<number>`count(*)::int` }).from(evidencia).where(eq(evidencia.organizacaoId, org));
  const [oc] = await db.select({
    abertas: sql<number>`count(*) filter (where ${ocorrencia.status} = 'aberta')::int`,
    altas: sql<number>`count(*) filter (where ${ocorrencia.status} = 'aberta' and ${ocorrencia.gravidade} = 'alta')::int`,
    medias: sql<number>`count(*) filter (where ${ocorrencia.status} = 'aberta' and ${ocorrencia.gravidade} = 'media')::int`,
    baixas: sql<number>`count(*) filter (where ${ocorrencia.status} = 'aberta' and ${ocorrencia.gravidade} = 'baixa')::int`,
    vencidas: sql<number>`count(*) filter (where ${ocorrencia.status} = 'aberta' and ${ocorrencia.prazo} < ${hoje})::int`,
  }).from(ocorrencia).where(eq(ocorrencia.organizacaoId, org));

  const mensal = await db.select({
    mes: sql<string>`to_char(${medicao.competencia}, 'YYYY-MM')`,
    valor: sql<string>`sum(${medicao.valorLiquido})`,
  }).from(medicao).where(and(eq(medicao.organizacaoId, org), eq(medicao.situacao, "aprovada"))).groupBy(sql`1`).orderBy(desc(sql`1`)).limit(6);
  const serie = mensal.reverse().map((m) => ({ rotulo: `${MESES[Number(m.mes.slice(5, 7)) - 1]}/${m.mes.slice(2, 4)}`, valor: Number(m.valor) }));

  const execucao = await db.select({
    id: contrato.id, numero: contrato.numero, total: contrato.valorGlobal,
    medido: sql<string>`coalesce(sum(${medicao.valorLiquido}) filter (where ${medicao.situacao} = 'aprovada'), 0)`,
  }).from(contrato).leftJoin(medicao, eq(medicao.contratoId, contrato.id)).where(and(eq(contrato.organizacaoId, org), eq(contrato.situacao, "vigente"))).groupBy(contrato.id).orderBy(contrato.numero).limit(6);

  const vencer = await db.select().from(contrato).where(and(eq(contrato.organizacaoId, org), eq(contrato.situacao, "vigente"))).orderBy(contrato.dataFim).limit(5);
  const eventos = await db.select().from(eventoAuditoria).where(eq(eventoAuditoria.organizacaoId, org)).orderBy(desc(eventoAuditoria.sequencia)).limit(5);

  const alertas = [
    ...(med?.submetidas ? [{ tom: "alerta" as const, texto: `${med.submetidas} medição(ões) aguardando decisão`, href: "/medicoes" }] : []),
    ...(oc?.vencidas ? [{ tom: "erro" as const, texto: `${oc.vencidas} ocorrência(s) com prazo vencido`, href: "/ocorrencias" }] : []),
    ...(oc?.altas ? [{ tom: "erro" as const, texto: `${oc.altas} ocorrência(s) de gravidade alta em aberto`, href: "/ocorrencias" }] : []),
    ...vencer.filter((c) => diasAte(c.dataFim) <= 90).map((c) => ({ tom: "alerta" as const, texto: `Contrato ${c.numero} vence em ${Math.max(diasAte(c.dataFim), 0)} dia(s)`, href: `/contratos/${c.id}` })),
  ];
  const pctExec = Number(resumo?.valor) > 0 ? (Number(med?.liquido) / Number(resumo?.valor)) * 100 : 0;

  return (
    <>
      <Cabecalho titulo="Início" descricao="Visão geral da fiscalização dos contratos do órgão." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Contratos vigentes" valor={String(resumo?.vigentes ?? 0)} tom="primario" detalhe={`${resumo?.suspensos ?? 0} suspenso(s) · ${resumo?.encerrados ?? 0} encerrado(s)`} />
        <Indicador rotulo="Valor sob fiscalização" valor={formatarMoeda(resumo?.valor)} detalhe={`${pctExec.toFixed(1)}% medido e aprovado`} />
        <Indicador rotulo="Medido e aprovado" valor={formatarMoeda(med?.liquido)} tom="sucesso" detalhe={`Glosas: ${formatarMoeda(med?.glosa)}`} />
        <Indicador rotulo="Ocorrências abertas" valor={String(oc?.abertas ?? 0)} tom={(oc?.altas ?? 0) > 0 ? "erro" : (oc?.abertas ?? 0) > 0 ? "alerta" : "sucesso"} detalhe={`${ev?.total ?? 0} evidência(s) registradas`} />
      </div>

      {alertas.length > 0 && (
        <Cartao titulo="Atenção" className="mt-6">
          <ul className="divide-y divide-borda">
            {alertas.map((a, i) => (
              <li key={i}><Link href={a.href} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50"><span className="flex items-center gap-3"><Selo tom={a.tom}>{a.tom === "erro" ? "Urgente" : "Atenção"}</Selo>{a.texto}</span><span className="text-primario">Ver →</span></Link></li>
            ))}
          </ul>
        </Cartao>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Cartao titulo="Valor medido por mês (aprovado, líquido)" className="lg:col-span-3">
          <div className="p-5">{serie.length ? <Barras dados={serie} rotuloEixo="Valor líquido aprovado por mês" /> : <Vazio titulo="Sem medições aprovadas" texto="O gráfico aparece quando houver medições aprovadas." />}</div>
        </Cartao>
        <Cartao titulo="Contratos por natureza" className="lg:col-span-2">
          <div className="p-5">
            <Rosca centro="contratos" fatias={[{ rotulo: "Engenharia", valor: resumo?.eng ?? 0, cor: "#1d4ed8" }, { rotulo: "Serviço", valor: resumo?.serv ?? 0, cor: "#0ea5a4" }, { rotulo: "Bens", valor: resumo?.bens ?? 0, cor: "#f59e0b" }]} />
          </div>
        </Cartao>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Cartao titulo="Execução financeira por contrato" className="lg:col-span-3">
          <div className="space-y-4 p-5">
            {execucao.length === 0 ? <Vazio titulo="Nenhum contrato vigente" texto="Cadastre ou importe um contrato para acompanhar a execução." /> : execucao.map((e) => (
              <BarraProgresso key={e.id} rotulo={e.numero} valor={Number(e.medido)} total={Number(e.total)} detalhe={`${formatarMoeda(e.medido)} de ${formatarMoeda(e.total)}`} />
            ))}
          </div>
        </Cartao>
        <div className="space-y-6 lg:col-span-2">
          <Cartao titulo="Ocorrências em aberto">
            <div className="p-5"><Rosca centro="abertas" fatias={[{ rotulo: "Alta", valor: oc?.altas ?? 0, cor: "#b91c1c" }, { rotulo: "Média", valor: oc?.medias ?? 0, cor: "#f59e0b" }, { rotulo: "Baixa", valor: oc?.baixas ?? 0, cor: "#94a3b8" }]} /></div>
          </Cartao>
          <Cartao titulo="Fila de medições">
            <dl className="tabular grid grid-cols-2 gap-3 p-5 text-sm">
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-texto-suave">Rascunho</dt><dd className="text-xl font-semibold">{med?.rascunhos ?? 0}</dd></div>
              <div className="rounded-lg bg-alerta-suave p-3"><dt className="text-xs text-alerta">Aguardando decisão</dt><dd className="text-xl font-semibold text-alerta">{med?.submetidas ?? 0}</dd></div>
            </dl>
          </Cartao>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Cartao className="lg:col-span-3" titulo="Próximos vencimentos" acao={<Link href="/contratos" className="text-xs font-semibold text-primario hover:underline">Ver todos</Link>}>
          {vencer.length === 0 ? <Vazio titulo="Nenhum contrato vigente" texto="Os prazos de vigência aparecem aqui." /> : (
            <Tabela colunas={[{ rotulo: "Contrato" }, { rotulo: "Fim da vigência" }, { rotulo: "Prazo" }]}>
              {vencer.map((c) => {
                const dias = diasAte(c.dataFim);
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3"><Link href={`/contratos/${c.id}`} className="font-medium text-primario hover:underline">{c.numero}</Link><p className="text-xs text-texto-suave">{c.objeto}</p></td>
                    <td className="tabular px-5 py-3">{formatarData(c.dataFim)}</td>
                    <td className="px-5 py-3">{dias < 0 ? <Selo tom="erro">Vencido</Selo> : dias <= 90 ? <Selo tom="alerta">{dias} dias</Selo> : <Selo tom="sucesso">{dias} dias</Selo>}</td>
                  </tr>
                );
              })}
            </Tabela>
          )}
        </Cartao>
        <Cartao className="lg:col-span-2" titulo="Atividade recente" acao={<Link href="/auditoria" className="text-xs font-semibold text-primario hover:underline">Trilha</Link>}>
          {eventos.length === 0 ? <Vazio titulo="Sem atividade" texto="Cada ação relevante é registrada com hash encadeado." /> : (
            <ul className="divide-y divide-borda">
              {eventos.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-5 py-3"><div><p className="text-sm font-medium capitalize">{e.tipo} · {e.entidade}</p><p className="text-xs text-texto-suave">{formatarDataHora(e.criadoEm)}</p></div><code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{e.hash.slice(0, 8)}</code></li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
  });
}
