import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { saldoItens } from "@/lib/medicao";
import { Cabecalho, Cartao, Vazio } from "@/components/ui";
import { FormMedicao } from "@/components/medicao";

export default async function PaginaNovaMedicao({ searchParams }: { searchParams: Promise<{ contrato?: string }> }) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  const { contrato: cid } = await searchParams;
  if (!["administrador", "controlador", "fiscal"].includes(sessao.papel)) return <Cartao><Vazio titulo="Sem permissão" texto="Seu perfil não registra medições." /></Cartao>;

  const vigentes = await db.select({ id: contrato.id, numero: contrato.numero, objeto: contrato.objeto }).from(contrato).where(and(eq(contrato.organizacaoId, sessao.organizacaoId), eq(contrato.situacao, "vigente"))).orderBy(contrato.numero);
  const escolhido = vigentes.find((c) => c.id === cid);

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/medicoes" className="text-texto-suave hover:text-primario">← Medições</Link></p>
      <Cabecalho titulo="Nova medição" descricao={escolhido ? `Contrato ${escolhido.numero} · ${escolhido.objeto}` : "Escolha o contrato a medir."} />
      <Cartao>
        {escolhido ? (
          <FormMedicao contratoId={escolhido.id} itens={await saldoItens(escolhido.id, sessao.organizacaoId)} />
        ) : vigentes.length === 0 ? (
          <Vazio titulo="Nenhum contrato vigente" texto="Cadastre ou importe um contrato para medir." />
        ) : (
          <ul className="divide-y divide-borda">
            {vigentes.map((c) => (
              <li key={c.id}><Link href={`/medicoes/nova?contrato=${c.id}`} className="block px-5 py-3 hover:bg-slate-50"><span className="font-semibold text-primario">{c.numero}</span><span className="ml-2 text-sm text-texto-suave">{c.objeto}</span></Link></li>
            ))}
          </ul>
        )}
      </Cartao>
    </>
  );
  });
}
