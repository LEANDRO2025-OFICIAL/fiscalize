import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { contrato, itemContratado } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_CRIAR = ["administrador", "controlador", "fiscal"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  if (!PODE_CRIAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para cadastrar contratos." }, { status: 403 });

  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
  const numero = txt("numero", 40), objeto = txt("objeto", 600), fornecedorNome = txt("fornecedorNome", 200);
  const cnpj = txt("fornecedorCnpj", 30).replace(/\D/g, "");
  const categoria = txt("categoria", 20), assinatura = txt("dataAssinatura", 10), fim = txt("dataFim", 10);
  const valor = Number(b?.valorGlobal);
  const pncp = txt("pncp", 60) || null;
  const endereco = txt("enderecoObra", 300) || null;

  if (!numero || !objeto || !fornecedorNome) return NextResponse.json({ erro: "Preencha número, objeto e fornecedor." }, { status: 422 });
  if (cnpj.length !== 14 && cnpj.length !== 11) return NextResponse.json({ erro: "CNPJ/CPF do fornecedor inválido." }, { status: 422 });
  if (!["engenharia", "servico", "bens"].includes(categoria)) return NextResponse.json({ erro: "Natureza inválida." }, { status: 422 });
  if (!(valor > 0) || valor > 1e12) return NextResponse.json({ erro: "Valor global inválido." }, { status: 422 });
  if (!DATA.test(assinatura) || !DATA.test(fim) || fim < assinatura) return NextResponse.json({ erro: "Datas inválidas: o fim da vigência não pode ser anterior à assinatura." }, { status: 422 });

  const org = sessao.organizacaoId;
  const [dup] = await db.select({ id: contrato.id }).from(contrato).where(and(eq(contrato.organizacaoId, org), eq(contrato.numero, numero)));
  if (dup) return NextResponse.json({ erro: `Já existe o contrato ${numero}.`, id: dup.id }, { status: 409 });
  if (pncp) {
    const [j] = await db.select({ id: contrato.id }).from(contrato).where(and(eq(contrato.organizacaoId, org), eq(contrato.pncpNumeroControle, pncp)));
    if (j) return NextResponse.json({ erro: "Este contrato do PNCP já foi importado.", id: j.id }, { status: 409 });
  }

  const [c] = await db.insert(contrato).values({
    organizacaoId: org, numero, objeto, categoria, fornecedorNome, fornecedorCnpj: cnpj, valorGlobal: valor.toFixed(2),
    dataAssinatura: assinatura, dataFim: fim, pncpNumeroControle: pncp, enderecoObra: categoria === "engenharia" ? endereco : null,
    fiscalId: sessao.papel === "fiscal" ? sessao.usuarioId : null,
  }).returning({ id: contrato.id });

  // Item único inicial; os itens detalhados da planilha são cadastrados depois.
  await db.insert(itemContratado).values({ organizacaoId: org, contratoId: c!.id, descricao: objeto.slice(0, 200), unidadeMedida: "vb", quantidadeTotal: "1", valorUnitario: valor.toFixed(2), ordem: 1 });
  await registrarEvento({ organizacaoId: org, tipo: "criacao", entidade: "contrato", entidadeId: c!.id, atorId: sessao.usuarioId, payload: { numero, valor, origem: pncp ? "pncp" : "manual", pncp } });
  return NextResponse.json({ id: c!.id }, { status: 201 });
  });
}
