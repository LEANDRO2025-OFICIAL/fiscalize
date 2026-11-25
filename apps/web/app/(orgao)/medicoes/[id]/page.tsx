import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato, medicao, recebimento, usuario } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { lerMemoria } from "@/lib/medicao";
import { formatarData, formatarMoeda } from "@/lib/formatar";
import { Cabecalho, Cartao, Indicador, Selo, Tabela } from "@/components/ui";
import { AcoesMedicao } from "@/components/medicao";

const sel = { rascunho: ["neutro", "Rascunho"], submetida: ["alerta", "Submetida"], aprovada: ["sucesso", "Aprovada"], rejeitada: ["erro", "Rejeitada"] } as const;
const selRec = { pendente: ["alerta", "Recebimento pendente"], conforme: ["sucesso", "Recebida conforme"], divergente: ["erro", "Recebida com divergência"] } as const;

export default async function PaginaMedicao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  const org = sessao.organizacaoId;
  const [m] = await db.select().from(medicao).where(and(eq(medicao.id, id), eq(medicao.organizacaoId, org)));
  if (!m) notFound();
  const [c] = await db.select({ id: contrato.id, numero: contrato.numero, objeto: contrato.objeto }).from(contrato).where(eq(contrato.id, m.contratoId));
  const [rec] = await db.select().from(recebimento).where(and(eq(recebimento.medicaoId, id), eq(recebimento.organizacaoId, org)));
  const nomes = new Map((await db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(eq(usuario.organizacaoId, org))).map((u) => [u.id, u.nome]));
  const mem = lerMemoria(m.memoriaCalculo);
  const [tom, rot] = sel[m.situacao];

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/medicoes" className="text-texto-suave hover:text-primario">← Medições</Link></p>
      <Cabecalho titulo={`Medição ${m.numero} · ${c?.numero ?? ""}`} descricao={`${c?.objeto ?? ""} · competência ${formatarData(m.competencia)}`} acao={<div className="flex gap-2"><Selo tom={tom}>{rot}</Selo>{rec && <Selo tom={selRec[rec.situacao][0]}>{selRec[rec.situacao][1]}</Selo>}</div>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador rotulo="Valor bruto" valor={formatarMoeda(m.valorBruto)} />
        <Indicador rotulo="Glosas" valor={formatarMoeda(m.valorGlosa)} tom={Number(m.valorGlosa) > 0 ? "alerta" : "neutro"} />
        <Indicador rotulo="Valor líquido" valor={formatarMoeda(m.valorLiquido)} tom="primario" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Cartao titulo="Memória de cálculo" className="lg:col-span-3">
          {mem && (
            <Tabela colunas={[{ rotulo: "Item" }, { rotulo: "Quantidade", alinhar: "direita" }, { rotulo: "Unitário", alinhar: "direita" }, { rotulo: "Subtotal", alinhar: "direita" }]}>
              {mem.linhas.map((l) => (
                <tr key={l.descricao}><td className="px-5 py-3">{l.descricao}</td><td className="tabular px-5 py-3 text-right">{l.quantidade.toLocaleString("pt-BR")} {l.unidade}</td><td className="tabular px-5 py-3 text-right">{formatarMoeda(l.unitario)}</td><td className="tabular px-5 py-3 text-right font-medium">{formatarMoeda(l.subtotal)}</td></tr>
              ))}
              {mem.glosas.map((g, i) => (
                <tr key={i} className="bg-erro-suave/40"><td className="px-5 py-3" colSpan={3}>Glosa: {g.motivo}</td><td className="tabular px-5 py-3 text-right text-erro">- {formatarMoeda(g.valor)}</td></tr>
              ))}
            </Tabela>
          )}
          {mem?.rejeicao && <p className="border-t border-borda px-5 py-3 text-sm text-erro">Rejeitada por {nomes.get(mem.rejeicao.por) ?? "—"}: {mem.rejeicao.motivo}</p>}
        </Cartao>

        <div className="space-y-6 lg:col-span-2">
          <Cartao titulo="Fluxo">
            <dl className="space-y-2 px-5 py-4 text-sm">
              <div><dt className="text-xs text-texto-suave">Registrada por</dt><dd>{m.criadoPorId ? nomes.get(m.criadoPorId) ?? "—" : "—"}</dd></div>
              <div><dt className="text-xs text-texto-suave">Aprovada por</dt><dd>{m.aprovadoPorId ? nomes.get(m.aprovadoPorId) ?? "—" : "—"}</dd></div>
              {rec && rec.situacao !== "pendente" && <div><dt className="text-xs text-texto-suave">Parecer do recebimento</dt><dd>{rec.parecer}</dd></div>}
            </dl>
            <div className="border-t border-borda"><AcoesMedicao id={m.id} situacao={m.situacao} papel={sessao.papel} ehAutor={m.criadoPorId === sessao.usuarioId} recebimento={rec ? { situacao: rec.situacao } : null} /></div>
          </Cartao>
        </div>
      </div>
    </>
  );
  });
}
