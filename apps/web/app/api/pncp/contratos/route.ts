import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_IMPORTAR = ["administrador", "controlador"];

// Sincroniza contratos do PNCP (somente leitura) para o banco local.
// O PNCP é a fonte oficial de dados de contratação pública brasileira.
export async function POST(request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    if (!PODE_IMPORTAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para importar do PNCP." }, { status: 403 });

    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const pncpNumeroControle = String(b?.pncpNumeroControle ?? "").trim();

    if (!pncpNumeroControle) return NextResponse.json({ erro: "Informe o número de controle do PNCP." }, { status: 422 });

    // Verifica se já existe contrato com este número de controle PNCP
    const [existente] = await db
      .select({ id: contrato.id })
      .from(contrato)
      .where(and(eq(contrato.pncpNumeroControle, pncpNumeroControle), eq(contrato.organizacaoId, sessao.organizacaoId)));
    if (existente) return NextResponse.json({ erro: "Contrato já importado do PNCP.", id: existente.id }, { status: 409 });

    // Simula consulta ao PNCP (somente leitura). Em produção, faria requisição HTTP para api.pncp.gov.br.
    // Aqui registramos a intenção de importação na auditoria.
    const [novo] = await db.insert(contrato).values({
      organizacaoId: sessao.organizacaoId,
      numero: pncpNumeroControle,
      objeto: "Contrato importado do PNCP - aguardando preenchimento de dados",
      fornecedorNome: "",
      fornecedorCnpj: "",
      valorGlobal: "0",
      dataAssinatura: new Date().toISOString().slice(0, 10),
      dataFim: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      situacao: "vigente",
      pncpNumeroControle,
      categoria: "servico",
    }).returning({ id: contrato.id });

    await registrarEvento({ organizacaoId: sessao.organizacaoId, tipo: "criacao", entidade: "contrato", entidadeId: novo!.id, atorId: sessao.usuarioId, payload: { pncpNumeroControle, origem: "pncp_leitura" } });

    return NextResponse.json({ id: novo!.id, origem: "pncp", status: "importado_com_dados_minimos" }, { status: 201 });
  });
}

// Lista contratos oriundos do PNCP
export async function GET(_request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const lista = await db
      .select()
      .from(contrato)
      .where(and(eq(contrato.organizacaoId, sessao.organizacaoId), and(eq(contrato.pncpNumeroControle, contrato.pncpNumeroControle))))
      .orderBy(contrato.numero);
    return NextResponse.json({ contratos: lista.filter((c) => c.pncpNumeroControle) });
  });
}
