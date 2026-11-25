import { desc, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { eventoAuditoria } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarDataHora } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";

export default async function PaginaAuditoria() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  const eventos = await db
    .select()
    .from(eventoAuditoria)
    .where(eq(eventoAuditoria.organizacaoId, sessao.organizacaoId))
    .orderBy(desc(eventoAuditoria.sequencia))
    .limit(100);

  return (
    <>
      <Cabecalho titulo="Trilha de auditoria" descricao="Registro append-only. Cada evento carrega o hash do anterior, o que torna qualquer alteração detectável." />
      <Cartao>
        {eventos.length === 0 ? (
          <Vazio titulo="Nenhum evento registrado" texto="Ações como login, medição e envio de evidência passam a constar aqui." />
        ) : (
          <Tabela colunas={[{ rotulo: "Seq." }, { rotulo: "Quando" }, { rotulo: "Evento" }, { rotulo: "Entidade" }, { rotulo: "Hash" }]}>
            {eventos.map((e) => (
              <tr key={e.id}>
                <td className="tabular px-5 py-3 font-medium">{e.sequencia}</td>
                <td className="tabular px-5 py-3 text-texto-suave">{formatarDataHora(e.criadoEm)}</td>
                <td className="px-5 py-3"><Selo tom="primario">{e.tipo}</Selo></td>
                <td className="px-5 py-3">{e.entidade}</td>
                <td className="px-5 py-3"><code className="font-mono text-xs text-slate-600">{e.hash.slice(0, 16)}…</code></td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
    </>
  );
  });
}
