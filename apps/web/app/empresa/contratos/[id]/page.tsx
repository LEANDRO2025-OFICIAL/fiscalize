import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import {
  contrato,
  itemContratado,
  medicao,
  evidencia,
  designacao,
  usuario,
  aditivo,
  penalidade,
  ocorrencia,
  execucao,
  organizacao,
} from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarMoeda, formatarData, formatarDataHora, formatarCnpj } from "@/lib/formatar";
import { Cabecalho, Cartao, Indicador, Selo, Tabela, Vazio } from "@/components/ui";

export default async function PaginaEmpresaContrato({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;

    const [orgData] = await db
      .select({ cnpj: organizacao.cnpj })
      .from(organizacao)
      .where(eq(organizacao.id, org))
      .limit(1);
    const cnpj = orgData?.cnpj ?? "";

    const [c] = await db
      .select()
      .from(contrato)
      .where(and(eq(contrato.id, id), eq(contrato.organizacaoId, org), eq(contrato.fornecedorCnpj, cnpj)));
    if (!c) notFound();

    const itens = await db
      .select()
      .from(itemContratado)
      .where(and(eq(itemContratado.contratoId, id), eq(itemContratado.organizacaoId, org)))
      .orderBy(itemContratado.ordem);
    const medicoes = await db
      .select()
      .from(medicao)
      .where(and(eq(medicao.contratoId, id), eq(medicao.organizacaoId, org)))
      .orderBy(medicao.numero);
    const evidencias = await db
      .select()
      .from(evidencia)
      .where(and(eq(evidencia.contratoId, id), eq(evidencia.organizacaoId, org)));

    const fiscais = await db
      .select({ id: usuario.id, nome: usuario.nome })
      .from(usuario)
      .where(and(eq(usuario.organizacaoId, org), eq(usuario.papel, "fiscal")));
    const [desig] = await db
      .select()
      .from(designacao)
      .where(and(eq(designacao.contratoId, id), eq(designacao.ativo, "sim")))
      .limit(1);
    const fiscalAtual = fiscais.find((f) => f.id === c.fiscalId);

    const aditivos = await db
      .select({ id: aditivo.id })
      .from(aditivo)
      .where(and(eq(aditivo.contratoId, id), eq(aditivo.organizacaoId, org)));
    const penalidades = await db
      .select({ id: penalidade.id })
      .from(penalidade)
      .where(and(eq(penalidade.contratoId, id), eq(penalidade.organizacaoId, org)));
    const ocorrencias = await db
      .select({ id: ocorrencia.id, status: ocorrencia.status })
      .from(ocorrencia)
      .where(and(eq(ocorrencia.contratoId, id), eq(ocorrencia.organizacaoId, org)));
    const lancamentos = await db
      .select({ id: execucao.id, tipo: execucao.tipo, situacao: execucao.situacao, valor: execucao.valor })
      .from(execucao)
      .where(and(eq(execucao.contratoId, id), eq(execucao.organizacaoId, org)));

    const medido = medicoes.filter((m) => m.situacao === "aprovada").reduce((s, m) => s + Number(m.valorLiquido), 0);
    const pct = Number(c.valorGlobal) > 0 ? Math.min(100, (medido / Number(c.valorGlobal)) * 100) : 0;

    return (
      <>
        <p className="mb-2 text-sm"><Link href="/empresa/contratos" className="text-texto-suave hover:text-primario">← Meus Contratos</Link></p>
        <Cabecalho
          titulo={`Contrato ${c.numero}`}
          descricao={c.objeto}
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
          </Cartao>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Cartao titulo="Medições">
            {medicoes.length === 0 ? <Vazio titulo="Nenhuma medição" texto="As medições mensais do contrato serão listadas aqui." /> : (
              <Tabela colunas={[{ rotulo: "Nº" }, { rotulo: "Competência" }, { rotulo: "Líquido", alinhar: "direita" }, { rotulo: "Situação" }]}>
                {medicoes.map((m) => {
                  const tom = m.situacao === "aprovada" ? "sucesso" : m.situacao === "submetida" ? "alerta" : m.situacao === "rejeitada" ? "erro" : "neutro";
                  const rot = m.situacao === "aprovada" ? "Aprovada" : m.situacao === "submetida" ? "Submetida" : m.situacao === "rejeitada" ? "Rejeitada" : "Rascunho";
                  return (
                    <tr key={m.id}><td className="px-5 py-3 font-medium">{m.numero}</td><td className="tabular px-5 py-3">{formatarData(m.competencia)}</td><td className="tabular px-5 py-3 text-right">{formatarMoeda(m.valorLiquido)}</td><td className="px-5 py-3"><Selo tom={tom}>{rot}</Selo></td></tr>
                  );
                })}
              </Tabela>
            )}
          </Cartao>
          <Cartao titulo="Evidências">
            {evidencias.length === 0 ? <Vazio titulo="Nenhuma evidência" texto="Fotos, documentos e planilhas anexados serão listados com hash SHA-256." /> : (
              <ul className="divide-y divide-borda">
                {evidencias.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <a href={`/api/evidencias/${e.id}/arquivo`} target="_blank" rel="noopener" className="text-sm font-medium text-primario hover:underline">{e.nomeArquivo}</a>
                    <p className="text-xs text-texto-suave">{formatarDataHora(e.criadoEm)} · <code className="font-mono">{e.sha256.slice(0, 12)}</code></p>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>

        <Cartao titulo="Aditivos, penalidades, ocorrências e execução" className="mt-6">
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-borda px-4 py-3 text-sm">
              <span className="block text-xs text-texto-suave uppercase">Aditivos contratuais</span>
              <span className="tabular font-semibold text-primario">{aditivos.length}</span>
              <p className="mt-1 text-xs text-texto-suave">
                <Link href={`/empresa/contratos/${id}/aditivos`} className="text-primario hover:underline">Ver aditivos →</Link>
              </p>
            </div>
            <div className="rounded-lg border border-borda px-4 py-3 text-sm">
              <span className="block text-xs text-texto-suave uppercase">Penalidades</span>
              <span className="tabular font-semibold text-primario">{penalidades.length}</span>
              <p className="mt-1 text-xs text-texto-suave">
                <Link href={`/empresa/contratos/${id}/penalidades`} className="text-primario hover:underline">Ver penalidades →</Link>
              </p>
            </div>
            <div className="rounded-lg border border-borda px-4 py-3 text-sm">
              <span className="block text-xs text-texto-suave uppercase">Ocorrências</span>
              <span className="tabular font-semibold text-primario">{ocorrencias.length}</span>
              <p className="mt-1 text-xs text-texto-suave">
                <Link href={`/empresa/contratos/${id}/ocorrencias`} className="text-primario hover:underline">Ver ocorrências →</Link>
              </p>
            </div>
            <div className="rounded-lg border border-borda px-4 py-3 text-sm">
              <span className="block text-xs text-texto-suave uppercase">Execução orçamentária</span>
              <span className="tabular font-semibold text-primario">{lancamentos.length}</span>
              <p className="mt-1 text-xs text-texto-suave">
                <Link href={`/empresa/contratos/${id}/execucao`} className="text-primario hover:underline">Ver execução →</Link>
              </p>
            </div>
          </div>
        </Cartao>
      </>
    );
  });
}
