import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { checklistExecucao, contrato, usuario } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { MODELOS } from "@/lib/checklist-modelos";
import { formatarDataHora } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";
import { FormChecklist } from "@/components/checklist";

export default async function PaginaChecklists({ searchParams }: { searchParams: Promise<{ contrato?: string }> }) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  const org = sessao.organizacaoId;
  const { contrato: cid } = await searchParams;
  const pode = ["administrador", "controlador", "fiscal"].includes(sessao.papel);
  const contratos = await db.select({ id: contrato.id, numero: contrato.numero, objeto: contrato.objeto, categoria: contrato.categoria }).from(contrato).where(eq(contrato.organizacaoId, org)).orderBy(contrato.numero);
  const escolhido = pode ? contratos.find((c) => c.id === cid) : undefined;
  const modelo = escolhido ? (MODELOS[escolhido.categoria] ?? MODELOS.servico!) : null;

  const lista = await db.select({ x: checklistExecucao, numero: contrato.numero, autor: usuario.nome }).from(checklistExecucao)
    .innerJoin(contrato, eq(contrato.id, checklistExecucao.contratoId)).leftJoin(usuario, eq(usuario.id, checklistExecucao.criadoPorId))
    .where(eq(checklistExecucao.organizacaoId, org)).orderBy(desc(checklistExecucao.criadoEm)).limit(50);

  return (
    <>
      <Cabecalho titulo="Checklists" descricao="Roteiros de fiscalização por natureza do contrato. Itens não conformes viram ocorrências." />
      {pode && (
        <Cartao titulo={escolhido ? `Checklist · contrato ${escolhido.numero}` : "Iniciar checklist"} className="mb-6">
          {escolhido && modelo ? <FormChecklist contratoId={escolhido.id} modelo={modelo.nome} itens={modelo.itens} /> : contratos.length === 0 ? <Vazio titulo="Nenhum contrato" texto="Cadastre um contrato para fiscalizar." /> : (
            <ul className="divide-y divide-borda">
              {contratos.map((c) => <li key={c.id}><Link href={`/checklists?contrato=${c.id}`} className="block px-5 py-3 hover:bg-slate-50"><span className="font-semibold text-primario">{c.numero}</span><span className="ml-2 text-sm text-texto-suave">{(MODELOS[c.categoria] ?? MODELOS.servico!).nome}</span></Link></li>)}
            </ul>
          )}
        </Cartao>
      )}
      <Cartao titulo="Histórico">
        {lista.length === 0 ? <Vazio titulo="Nenhum checklist" texto="Os checklists concluídos aparecem aqui." /> : (
          <Tabela colunas={[{ rotulo: "Contrato" }, { rotulo: "Modelo" }, { rotulo: "Resultado" }, { rotulo: "Por / quando" }]}>
            {lista.map(({ x, numero, autor }) => (
              <tr key={x.id}>
                <td className="px-5 py-3 font-medium">{numero}</td>
                <td className="px-5 py-3">{x.modelo}</td>
                <td className="px-5 py-3"><Selo tom="sucesso">{x.conformes} conforme(s)</Selo> {x.naoConformes > 0 && <Selo tom="erro">{x.naoConformes} não conforme(s)</Selo>}</td>
                <td className="px-5 py-3 text-texto-suave">{autor ?? "—"}<p className="tabular text-xs">{formatarDataHora(x.criadoEm)}</p></td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
    </>
  );
  });
}
