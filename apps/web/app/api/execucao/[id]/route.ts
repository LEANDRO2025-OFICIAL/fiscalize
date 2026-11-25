import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { execucao } from "@contratacao/db/schema";
import { registrarEvento } from "@contratacao/db/auditoria";
import { getSessao } from "@/lib/sessao";

const PODE_ALTERAR = ["administrador", "controlador", "fiscal"];

const TRANSICOES: Record<string, string[]> = {
  pendente: ["confirmado", "cancelado"],
  confirmado: ["cancelado"],
  cancelado: [],
};

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  if (!PODE_ALTERAR.includes(sessao.papel)) {
    return NextResponse.json({ erro: "Sem permissão para alterar execução." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    acao?: string;
  } | null;
  if (!body?.acao) {
    return NextResponse.json({ erro: "Ação é obrigatória." }, { status: 400 });
  }

  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;
    const [e] = await db
      .select()
      .from(execucao)
      .where(and(eq(execucao.id, id), eq(execucao.organizacaoId, org)));
    if (!e) return NextResponse.json({ erro: "Execução não encontrada." }, { status: 404 });

    const destino =
      body.acao === "confirmar" ? "confirmado" : body.acao === "cancelar" ? "cancelado" : null;
    if (!destino) {
      return NextResponse.json({ erro: "Ação inválida (use 'confirmar' ou 'cancelar')." }, { status: 422 });
    }
    if (!TRANSICOES[e.situacao]?.includes(destino)) {
      return NextResponse.json(
        { erro: `Transição inválida de ${e.situacao} para ${destino}.` },
        { status: 409 }
      );
    }

    const [ok] = await db
      .update(execucao)
      .set({ situacao: destino })
      .where(
        and(
          eq(execucao.id, id),
          eq(execucao.organizacaoId, org),
          eq(execucao.situacao, e.situacao)
        )
      )
      .returning({ id: execucao.id, situacao: execucao.situacao });
    if (!ok) {
      return NextResponse.json({ erro: "A execução mudou de situação. Atualize a página." }, { status: 409 });
    }

    await registrarEvento({
      organizacaoId: org,
      tipo: "alteracao",
      entidade: "execucao",
      entidadeId: id,
      atorId: sessao.usuarioId,
      payload: { situacao: destino, acao: body.acao },
    });

    return NextResponse.json({ ok: true, situacao: destino });
  });
}
