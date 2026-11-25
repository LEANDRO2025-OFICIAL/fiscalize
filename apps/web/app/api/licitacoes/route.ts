import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { licitacao, usuario } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_CRIAR = ["administrador", "controlador"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MODALIDADES = ["pregao", "concorrencia", "dispensa", "inexigibilidade", "leilao"];
const SITUACOES = ["aberta", "em_andamento", "homologada", "deserta", "cancelada", "arquivada"];
const CRITERIOS = ["menor_preco", "melhor_tecnica", "maior_lance_oferta"];

export async function GET(_request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const lista = await db
      .select()
      .from(licitacao)
      .where(eq(licitacao.organizacaoId, sessao.organizacaoId))
      .orderBy(licitacao.numero);
    return NextResponse.json({ licitacoes: lista });
  });
}

export async function POST(request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    if (!PODE_CRIAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para criar licitações." }, { status: 403 });

    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
    const numero = txt("numero", 40);
    const objeto = txt("objeto", 600);
    const modalidade = txt("modalidade", 30);
    const situacao = txt("situacao", 20);
    const criterio = txt("criterio", 30);
    const valor = Number(b?.valorEstimado ?? 0);
    const valorEstimado = valor > 0 ? valor.toFixed(2) : null;
    const abertura = txt("dataAbertura", 10);
    const encerramento = txt("dataEncerramento", 10);
    const edital = txt("edital", 1000) || null;

    if (!numero || !objeto) return NextResponse.json({ erro: "Informe número e objeto da licitação." }, { status: 422 });
    if (!MODALIDADES.includes(modalidade)) return NextResponse.json({ erro: "Modalidade inválida." }, { status: 422 });
    if (!SITUACOES.includes(situacao)) return NextResponse.json({ erro: "Situação inválida." }, { status: 422 });
    if (!CRITERIOS.includes(criterio)) return NextResponse.json({ erro: "Critério inválido." }, { status: 422 });
    if (valor < 0 || valor > 1e12) return NextResponse.json({ erro: "Valor estimado inválido." }, { status: 422 });
    if (!DATA.test(abertura) || !DATA.test(encerramento) || encerramento < abertura) return NextResponse.json({ erro: "Datas inválidas." }, { status: 422 });

    const org = sessao.organizacaoId;
    const [dup] = await db.select({ id: licitacao.id }).from(licitacao).where(and(eq(licitacao.organizacaoId, org), eq(licitacao.numero, numero)));
    if (dup) return NextResponse.json({ erro: `Já existe a licitação ${numero}.`, id: dup.id }, { status: 409 });

    const [novo] = await db.insert(licitacao).values({
      organizacaoId: org, numero, objeto, modalidade, situacao, criterio,
      valorEstimado: valor > 0 ? valor.toFixed(2) : null,
      dataAbertura: abertura, dataEncerramento: encerramento, edital,
      criadoPorId: sessao.usuarioId,
    } as any).returning({ id: licitacao.id });

    await registrarEvento({ organizacaoId: org, tipo: "criacao", entidade: "licitacao", entidadeId: novo!.id, atorId: sessao.usuarioId, payload: { numero, objeto, modalidade, situacao, criterio } });

    return NextResponse.json({ id: novo!.id }, { status: 201 });
  });
}
