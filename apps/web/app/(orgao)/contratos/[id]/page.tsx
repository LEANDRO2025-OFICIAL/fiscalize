import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, count } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato, itemContratado, medicao, evidencia, designacao, usuario, aditivo, penalidade } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarMoeda, formatarData, formatarCnpj, formatarDataHora } from "@/lib/formatar";
import { Cabecalho, Cartao, Indicador, Selo, Tabela, Vazio } from "@/components/ui";
import { MapaObra } from "@/components/mapa-obra";
import { EnviarEvidencia } from "@/components/enviar-evidencia";
import { EditorItens, DesignarFiscal } from "@/components/gestao-contrato";

const medSel = { rascunho: ["neutro", "Rascunho"], submetida: ["alerta", "Submetida"], aprovada: ["sucesso", "Aprovada"], rejeitada: ["erro", "Rejeitada"] } as const;

export default async function PaginaContrato({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  const org = sessao.organizacaoId;
  const [c] = await db.select().from(contrato).where(and(eq(contrato.id, id), eq(contrato.organizacaoId, org)));
  if (!c) notFound();

  const itens = await db.select().from(itemContratado).where(and(eq(itemContratado.contratoId, id), eq(itemContratado.organizacaoId, org))).orderBy(itemContratado.ordem);
  const medicoes = await db.select().from(medicao).where(and(eq(medicao.contratoId, id), eq(medicao.organizacaoId, org))).orderBy(medicao.numero);
  const evidencias = await db.select().from(evidencia).where(and(eq(evidencia.contratoId, id), eq(evidencia.organizacaoId, org)));

  const fiscais = await db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(and(eq(usuario.organizacaoId, org), eq(usuario.papel, "fiscal")));
  const [desig] = await db.select().from(designacao).where(and(eq(designacao.contratoId, id), eq(designacao.ativo, "sim"))).limit(1);
  const [[qtdAditivos], [qtdPenalidades]] = await Promise.all([
    db.select({ n: count() }).from(aditivo).where(and(eq(aditivo.contratoId, id), eq(aditivo.organizacaoId, org))),
    db.select({ n: count() }).from(penalidade).where(and(eq(penalidade.contratoId, id), eq(penalidade.organizacaoId, org))),
  ]);
  const fiscalAtual = fiscais.find((f) => f.id === c.fiscalId);
  const podeDesignar = ["administrador", "controlador"].includes(sessao.papel);
  const podeEditar = ["administrador", "controlador", "fiscal"].includes(sessao.papel);
  const ehObra = c.categoria === "engenharia";
  const medido = medicoes.filter((m) => m.situacao === "aprovada").reduce((s, m) => s + Number(m.valorLiquido), 0);
  const pct = Number(c.valorGlobal) > 0 ? Math.min(100, (medido / Number(c.valorGlobal)) * 100) : 0;

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/contratos" className="text-texto-suave hover:text-primario">← Contratos</Link></p>
      <Cabecalho
        titulo={`Contrato ${c.numero}`}
        descricao={c.objeto}
        acao={
          <div className="flex items-center gap-3">
            <Selo tom={c.situacao === "vigente" ? "sucesso" : c.situacao === "suspenso" ? "alerta" : "neutro"}>{c.situacao}</Selo>
            {sessao.papel !== "fornecedor" && (
              <a href={`/api/contratos/${c.id}/dossie`} className="inline-flex items-center gap-2 rounded-lg bg-marinho px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-marinho-2">
                Gerar dossiê (PDF)
              </a>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador rotulo="Valor global" valor={formatarMoeda(c.valorGlobal)} tom="primario" />
        <Indicador rotulo="Medido e aprovado" valor={formatarMoeda(medido)} detalhe={`${pct.toFixed(1)}% do contrato`} tom="sucesso" />
        <Indicador rotulo="Vigência" valor={formatarData(c.dataFim)} detalhe={`Assinado em ${formatarData(c.dataAssinatura)}`} />
      </div>

      <div className="mt-4" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Execução financeira">
        <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-primario" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Cartao titulo="Fornecedor" className="lg:col-span-1">
          <dl className="space-y-3 px-5 py-4 text-sm">
            <div><dt className="text-xs text-texto-suave">Razão social</dt><dd className="font-medium">{c.fornecedorNome}</dd></div>
            <div><dt className="text-xs text-texto-suave">CNPJ</dt><dd className="tabular">{formatarCnpj(c.fornecedorCnpj)}</dd></div>
            <div><dt className="text-xs text-texto-suave">Fiscal</dt><dd className="font-medium">{fiscalAtual?.nome ?? "Não designado"}</dd>{desig && <dd className="text-xs text-texto-suave">{desig.portaria}</dd>}</div>
          </dl>
          {podeDesignar && fiscais.length > 0 && <DesignarFiscal contratoId={c.id} fiscais={fiscais} atualId={c.fiscalId} />}
        </Cartao>

        <Cartao titulo="Itens contratados" className="lg:col-span-2">
          {itens.length === 0 ? <Vazio titulo="Sem itens" texto="Os itens e quantitativos do contrato aparecerão aqui." /> : (
            <Tabela colunas={[{ rotulo: "Item" }, { rotulo: "Qtd.", alinhar: "direita" }, { rotulo: "Unitário", alinhar: "direita" }, { rotulo: "Total", alinhar: "direita" }]}>
              {itens.map((i) => (
                <tr key={i.id}>
                  <td className="px-5 py-3">{i.descricao}</td>
                  <td className="tabular px-5 py-3 text-right">{Number(i.quantidadeTotal).toLocaleString("pt-BR")} {i.unidadeMedida}</td>
                  <td className="tabular px-5 py-3 text-right">{formatarMoeda(i.valorUnitario)}</td>
                  <td className="tabular px-5 py-3 text-right font-medium">{formatarMoeda(Number(i.quantidadeTotal) * Number(i.valorUnitario))}</td>
                </tr>
              ))}
            </Tabela>
          )}
          {podeEditar && medicoes.length === 0 && <EditorItens contratoId={c.id} valorGlobal={Number(c.valorGlobal)} itens={itens.map((i) => ({ descricao: i.descricao, unidade: i.unidadeMedida, quantidade: String(Number(i.quantidadeTotal)), valorUnitario: String(Number(i.valorUnitario)) }))} />}
        </Cartao>
      </div>

      <Cartao titulo="Local da obra" className="mt-6" acao={ehObra ? <Selo tom="primario">Engenharia · mapa 3D</Selo> : undefined}>
        {ehObra ? (
          <MapaObra
            contratoId={c.id}
            endereco={c.enderecoObra}
            latitude={c.latitude != null ? Number(c.latitude) : null}
            longitude={c.longitude != null ? Number(c.longitude) : null}
            podeEditar={podeEditar}
          />
        ) : (
          <Vazio titulo="Contrato sem obra física" texto="O mapa 3D do local fica disponível para contratos de engenharia." />
        )}
      </Cartao>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Medições" acao={podeEditar && c.situacao === "vigente" ? <Link href={`/medicoes/nova?contrato=${c.id}`} className="text-xs font-semibold text-primario hover:underline">+ Nova medição</Link> : undefined}>
          {medicoes.length === 0 ? <Vazio titulo="Nenhuma medição" texto="As medições mensais do contrato serão listadas aqui." /> : (
            <Tabela colunas={[{ rotulo: "Nº" }, { rotulo: "Competência" }, { rotulo: "Líquido", alinhar: "direita" }, { rotulo: "Situação" }]}>
              {medicoes.map((m) => { const [tom, rot] = medSel[m.situacao]; return (
                <tr key={m.id}><td className="px-5 py-3 font-medium"><Link href={`/medicoes/${m.id}`} className="text-primario hover:underline">{m.numero}</Link></td><td className="tabular px-5 py-3">{formatarData(m.competencia)}</td><td className="tabular px-5 py-3 text-right">{formatarMoeda(m.valorLiquido)}</td><td className="px-5 py-3"><Selo tom={tom}>{rot}</Selo></td></tr>
              ); })}
            </Tabela>
          )}
        </Cartao>
        <Cartao titulo="Evidências">
          {podeEditar && <div className="border-b border-borda"><EnviarEvidencia contratoId={c.id} /></div>}
          {evidencias.length === 0 ? <Vazio titulo="Nenhuma evidência" texto="Fotos, documentos e planilhas anexados serão listados com hash SHA-256." /> : (
            <ul className="divide-y divide-borda">
              {evidencias.map((e) => (
                <li key={e.id} className="px-5 py-3">
                  <a href={`/api/evidencias/${e.id}/arquivo`} target="_blank" rel="noopener" className="text-sm font-medium text-primario hover:underline">{e.nomeArquivo}</a>
                  {e.observacao && <p className="text-xs text-texto-suave">{e.observacao}</p>}
                  <p className="text-xs text-texto-suave">{formatarDataHora(e.criadoEm)} · <code className="font-mono">{e.sha256.slice(0, 12)}</code></p>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <Cartao titulo="Aditivos e penalidades" className="mt-6" acao={<Selo tom="primario">ContratoVivo</Selo>}>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Link href={`/contratos/${c.id}/aditivos`} className="flex items-center justify-between rounded-lg border border-borda px-4 py-3 text-sm font-medium hover:bg-slate-50">
            <span>Aditivos contratuais</span>
            <span className="tabular font-semibold text-primario">{qtdAditivos?.n ?? 0}</span>
          </Link>
          <Link href={`/contratos/${c.id}/penalidades`} className="flex items-center justify-between rounded-lg border border-borda px-4 py-3 text-sm font-medium hover:bg-slate-50">
            <span>Penalidades e contraditório</span>
            <span className="tabular font-semibold text-primario">{qtdPenalidades?.n ?? 0}</span>
          </Link>
        </div>
      </Cartao>

      <Cartao titulo="Execução orçamentária" className="mt-6" acao={<Link href={`/contratos/${c.id}/execucao`} className="text-xs font-semibold text-primario hover:underline">Ver funil →</Link>}>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          <Link
            href={`/contratos/${c.id}/execucao`}
            className="flex items-center justify-between rounded-lg border border-borda px-4 py-3 text-sm font-medium hover:bg-slate-50"
          >
            <span>Empenho → Liquidação → Pagamento</span>
            <span className="tabular font-semibold text-primario">Funil</span>
          </Link>
        </div>
      </Cartao>
    </>
  );
  });
}
