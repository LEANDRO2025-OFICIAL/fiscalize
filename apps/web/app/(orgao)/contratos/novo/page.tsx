import Link from "next/link";
import { eq, isNotNull, and } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato, organizacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { Cabecalho, Cartao, Vazio } from "@/components/ui";
import { NovoContrato } from "@/components/novo-contrato";

export default async function PaginaNovoContrato() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  if (!["administrador", "controlador", "fiscal"].includes(sessao.papel)) {
    return <Cartao><Vazio titulo="Sem permissão" texto="Seu perfil não pode cadastrar contratos." /></Cartao>;
  }
  const [org] = await db.select({ cnpj: organizacao.cnpj }).from(organizacao).where(eq(organizacao.id, sessao.organizacaoId));
  const cnpj = org?.cnpj.replace(/\D/g, "") ?? "";
  const importados = await db.select({ p: contrato.pncpNumeroControle }).from(contrato).where(and(eq(contrato.organizacaoId, sessao.organizacaoId), isNotNull(contrato.pncpNumeroControle)));

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/contratos" className="text-texto-suave hover:text-primario">← Contratos</Link></p>
      <Cabecalho titulo="Novo contrato" descricao="Importe do PNCP ou cadastre manualmente." />
      <Cartao>
        <NovoContrato cnpjOrgao={/^0+$/.test(cnpj) ? "" : cnpj} jaImportados={importados.map((i) => i.p!)} />
      </Cartao>
    </>
  );
  });
}
