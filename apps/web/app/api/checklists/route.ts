import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { checklistExecucao, contrato, ocorrencia } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { MODELOS } from "@/lib/checklist-modelos";

const RESULTADOS = ["conforme", "nao_conforme", "na"];

export async function POST(request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  if (!["administrador", "controlador", "fiscal"].includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  const org = sessao.organizacaoId;

  const b = (await request.json().catch(() => null)) as { contratoId?: string; respostas?: Array<{ resultado: string; obs?: string }>; gerarOcorrencias?: boolean } | null;
  const [c] = await db.select({ id: contrato.id, numero: contrato.numero, categoria: contrato.categoria }).from(contrato).where(and(eq(contrato.id, String(b?.contratoId ?? "")), eq(contrato.organizacaoId, org)));
  if (!c) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
  const modelo = MODELOS[c.categoria] ?? MODELOS.servico!;
  const resp = b?.respostas ?? [];
  if (resp.length !== modelo.itens.length || resp.some((r) => !RESULTADOS.includes(r.resultado))) return NextResponse.json({ erro: "Responda todos os itens do checklist." }, { status: 422 });
  // O texto dos itens vem do modelo no servidor, nunca do cliente.
  const itens = modelo.itens.map((texto, i) => ({ texto, resultado: resp[i]!.resultado, obs: String(resp[i]!.obs ?? "").trim().slice(0, 500) }));
  const nc = itens.filter((i) => i.resultado === "nao_conforme");
  if (nc.some((i) => !i.obs)) return NextResponse.json({ erro: "Descreva a observação de cada item não conforme." }, { status: 422 });

  const [x] = await db.insert(checklistExecucao).values({
    organizacaoId: org, contratoId: c.id, modelo: modelo.nome, itens: JSON.stringify(itens),
    conformes: itens.filter((i) => i.resultado === "conforme").length, naoConformes: nc.length, criadoPorId: sessao.usuarioId,
  }).returning({ id: checklistExecucao.id });
  await registrarEvento({ organizacaoId: org, tipo: "criacao", entidade: "checklist", entidadeId: x!.id, atorId: sessao.usuarioId, payload: { contrato: c.numero, naoConformes: nc.length } });

  if (b?.gerarOcorrencias && nc.length) {
    for (const i of nc) {
      const [o] = await db.insert(ocorrencia).values({ organizacaoId: org, contratoId: c.id, tipo: "nao_conformidade", gravidade: "media", descricao: `Checklist: ${i.texto} — ${i.obs}`, criadoPorId: sessao.usuarioId }).returning({ id: ocorrencia.id });
      await registrarEvento({ organizacaoId: org, tipo: "criacao", entidade: "ocorrencia", entidadeId: o!.id, atorId: sessao.usuarioId, payload: { origem: "checklist", checklist: x!.id } });
    }
  }
  return NextResponse.json({ id: x!.id, naoConformes: nc.length }, { status: 201 });
  });
}
