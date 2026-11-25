import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato, evidencia, organizacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarDataHora, formatarMoeda } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Vazio } from "@/components/ui";

const rotuloMime = (m: string | null) =>
  m?.startsWith("image/") ? "Imagem" : m === "application/pdf" ? "PDF" : m?.includes("word") ? "Word" : m?.startsWith("text/") ? "Texto" : "Arquivo";

export default async function PaginaEmpresaEvidencias({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id: contratoId } = await params;
  const sessao = await getSessao();

  const { contrato: c, evidencias } = await comOrganizacao(sessao.organizacaoId, async (db) => {
    const [contratoData] = await db.select({
      id: contrato.id,
      numero: contrato.numero,
      objeto: contrato.objeto,
      fornecedorCnpj: contrato.fornecedorCnpj,
      valorGlobal: contrato.valorGlobal,
    }).from(contrato).where(and(
      eq(contrato.id, contratoId),
      eq(contrato.organizacaoId, sessao.organizacaoId)
    ));

    const lista = await db
      .select()
      .from(evidencia)
      .where(and(
        eq(evidencia.contratoId, contratoId),
        eq(evidencia.organizacaoId, sessao.organizacaoId)
      ))
      .orderBy(desc(evidencia.criadoEm));

    return { contrato: contratoData, evidencias: lista };
  });

  if (!c) notFound();

  // Fornecedor só pode ver evidências de contratos onde seu CNPJ é o fornecedor
  const orgData = await comOrganizacao(sessao.organizacaoId, async (db) => {
    return db.select({ cnpj: organizacao.cnpj }).from(organizacao).where(eq(organizacao.id, sessao.organizacaoId)).limit(1);
  });
  const cnpj = orgData[0]?.cnpj ?? "";
  if (c.fornecedorCnpj !== cnpj) notFound();

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={`/empresa/contratos/${contratoId}`} className="text-texto-suave hover:text-primario">← Contrato {c.numero}</Link>
      </p>
      <Cabecalho
        titulo={`Evidências do Contrato ${c.numero}`}
        descricao={`Documentos e fotos anexados à fiscalização: ${c.objeto}`}
      />

      <div className="mt-6">
        <Cartao titulo="Resumo">
          <dl className="grid gap-4 sm:grid-cols-3 px-5 py-4 text-sm">
            <div>
              <dt className="text-xs text-texto-suave uppercase">Valor global</dt>
              <dd className="tabular font-medium">{formatarMoeda(c.valorGlobal)}</dd>
            </div>
            <div>
              <dt className="text-xs text-texto-suave uppercase">Evidências</dt>
              <dd className="tabular font-medium">{evidencias.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-texto-suave uppercase">Última atualização</dt>
              <dd className="text-texto-suave">
                {evidencias.length > 0 ? formatarDataHora(evidencias[0]!.criadoEm) : "—"}
              </dd>
            </div>
          </dl>
        </Cartao>
      </div>

      <section className="mt-8">
        <Cartao titulo="Lista de Evidências">
          {evidencias.length === 0 ? (
            <Vazio titulo="Nenhuma evidência" texto="Os arquivos anexados à fiscalização deste contrato aparecerão aqui." />
          ) : (
            <ul className="divide-y divide-borda">
              {evidencias.map((e) => (
                <li key={e.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <a
                        href={`/api/evidencias/${e.id}/arquivo`}
                        target="_blank"
                        rel="noopener"
                        className="block font-medium text-primario hover:underline"
                      >
                        {e.nomeArquivo}
                      </a>
                      <p className="font-mono text-xs text-texto-suave">
                        SHA-256: {e.sha256.slice(0, 16)}…
                      </p>
                      <p className="text-xs text-texto-suave mt-1">
                        {rotuloMime(e.mime)} · {Number(e.tamanhoBytes).toLocaleString("pt-BR")} bytes
                        {e.observacao ? ` · ${e.observacao}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <Selo
                        tom={e.tipo === "foto" ? "primario" : e.tipo === "documento" ? "sucesso" : "neutro"}
                      >
                        {e.tipo}
                      </Selo>
                      <p className="text-xs text-texto-suave mt-1">
                        {formatarDataHora(e.criadoEm)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </section>
    </>
  );
}
