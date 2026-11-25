import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato, evidencia } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarDataHora } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";
import { EnviarEvidencia } from "@/components/enviar-evidencia";

const rotuloMime = (m: string | null) =>
  m?.startsWith("image/") ? "Imagem" : m === "application/pdf" ? "PDF" : m?.includes("word") ? "Word" : m?.startsWith("text/") ? "Texto" : "Arquivo";

export default async function PaginaEvidencias() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  const org = sessao.organizacaoId;
  const contratos = await db.select({ id: contrato.id, numero: contrato.numero }).from(contrato).where(eq(contrato.organizacaoId, org)).orderBy(contrato.numero);
  const lista = await db
    .select({ e: evidencia, numero: contrato.numero, contratoId: contrato.id })
    .from(evidencia)
    .innerJoin(contrato, eq(contrato.id, evidencia.contratoId))
    .where(eq(evidencia.organizacaoId, org))
    .orderBy(desc(evidencia.criadoEm))
    .limit(50);
  const podeEnviar = ["administrador", "controlador", "fiscal"].includes(sessao.papel);

  return (
    <>
      <Cabecalho titulo="Evidências" descricao="Anexe documentos e fotos à fiscalização. Cada arquivo recebe um hash SHA-256 e entra na trilha de auditoria." />
      <div className="grid gap-6 lg:grid-cols-5">
        {podeEnviar && (
          <Cartao titulo="Enviar arquivos" className="lg:col-span-2 self-start">
            <EnviarEvidencia contratos={contratos} />
          </Cartao>
        )}
        <Cartao titulo="Últimas evidências" className={podeEnviar ? "lg:col-span-3" : "lg:col-span-5"}>
          {lista.length === 0 ? (
            <Vazio titulo="Nenhuma evidência" texto="Os arquivos enviados aparecerão aqui." />
          ) : (
            <Tabela colunas={[{ rotulo: "Arquivo" }, { rotulo: "Contrato" }, { rotulo: "Tipo" }, { rotulo: "Enviado em" }]}>
              {lista.map(({ e, numero, contratoId }) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <a href={`/api/evidencias/${e.id}/arquivo`} target="_blank" rel="noopener" className="font-medium text-primario hover:underline">{e.nomeArquivo}</a>
                    <p className="font-mono text-xs text-texto-suave">{e.sha256.slice(0, 12)}…</p>
                  </td>
                  <td className="px-5 py-3"><Link href={`/contratos/${contratoId}`} className="hover:underline">{numero}</Link></td>
                  <td className="px-5 py-3"><Selo tom={e.tipo === "foto" ? "primario" : "neutro"}>{rotuloMime(e.mime)}</Selo></td>
                  <td className="tabular px-5 py-3 text-texto-suave">{formatarDataHora(e.criadoEm)}</td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>
      </div>
    </>
  );
  });
}
