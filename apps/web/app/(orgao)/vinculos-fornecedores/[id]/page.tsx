import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { vinculoFornecedor, organizacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarData, formatarCnpj } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Vazio } from "@/components/ui";

const tomStatus: Record<string, "neutro" | "primario" | "sucesso" | "alerta" | "erro"> = {
  ativo: "sucesso",
  inativo: "erro",
};

export default async function PaginaVinculoFornecedorDetalhe({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const [v] = await db
      .select({
        id: vinculoFornecedor.id,
        contratanteOrgId: vinculoFornecedor.contratanteOrgId,
        fornecedorOrgId: vinculoFornecedor.fornecedorOrgId,
        status: vinculoFornecedor.status,
        criadoEm: vinculoFornecedor.criadoEm,
      })
      .from(vinculoFornecedor)
      .where(and(eq(vinculoFornecedor.id, id), eq(vinculoFornecedor.contratanteOrgId, sessao.organizacaoId)));
    if (!v) notFound();

    const [contratante, fornecedor] = await Promise.all([
      db.select({ nome: organizacao.nome, cnpj: organizacao.cnpj }).from(organizacao).where(eq(organizacao.id, v.contratanteOrgId)).limit(1),
      db.select({ nome: organizacao.nome, cnpj: organizacao.cnpj }).from(organizacao).where(eq(organizacao.id, v.fornecedorOrgId)).limit(1),
    ]);

    return (
      <>
        <p className="mb-2 text-sm"><Link href="/vinculos-fornecedores" className="text-texto-suave hover:text-primario">← Vínculos</Link></p>
        <Cabecalho
          titulo={`Vínculo — ${fornecedor[0]?.nome ?? "Fornecedor"}`}
          descricao={`Fornecedor vinculado ao órgão ${contratante[0]?.nome ?? "Órgão"}`}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Cartao titulo="Órgão contratante">
            <dl className="space-y-3 px-5 py-4 text-sm">
              <div><dt className="text-xs text-texto-suave">Nome</dt><dd className="font-medium">{contratante[0]?.nome ?? "—"}</dd></div>
              <div><dt className="text-xs text-texto-suave">CNPJ</dt><dd className="tabular font-mono text-xs">{formatarCnpj(contratante[0]?.cnpj ?? "")}</dd></div>
            </dl>
          </Cartao>
          <Cartao titulo="Fornecedor vinculado">
            <dl className="space-y-3 px-5 py-4 text-sm">
              <div><dt className="text-xs text-texto-suave">Nome</dt><dd className="font-medium">{fornecedor[0]?.nome ?? "—"}</dd></div>
              <div><dt className="text-xs text-texto-suave">CNPJ</dt><dd className="tabular font-mono text-xs">{formatarCnpj(fornecedor[0]?.cnpj ?? "")}</dd></div>
              <div><dt className="text-xs text-texto-suave">Status</dt><dd className="font-medium"><Selo tom={tomStatus[v.status] ?? "neutro"}>{v.status}</Selo></dd></div>
              <div><dt className="text-xs text-texto-suave">Vinculado em</dt><dd className="tabular">{formatarData(v.criadoEm)}</dd></div>
            </dl>
          </Cartao>
        </div>
      </>
    );
  });
}
