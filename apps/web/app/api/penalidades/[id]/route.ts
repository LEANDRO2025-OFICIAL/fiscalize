import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { penalidade } from "@contratacao/db/schema";
import { registrarEvento } from "@contratacao/db/auditoria";
import { getSessao } from "@/lib/sessao";

const TRANSICOES: Record<string, string[]> = {
  sugerida: ["aprovada", "cancelada"],
  aprovada: ["cumprida", "cancelada"],
  cumprida: [],
  cancelada: [],
};

const DECISAO = ["administrador", "controlador", "fiscal"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  if (!DECISAO.includes(sessao.papel)) {
    return NextResponse.json({ erro: "Sem permissão para alterar penalidades." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { acao?: string; contraditorio?: string; prazoResposta?: string } | null;

  if (!body?.acao) {
    return NextResponse.json({ erro: "Ação é obrigatória." }, { status: 400 });
  }

  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;
    const [p] = await db.select().from(penalidade).where(and(eq(penalidade.id, id), eq(penalidade.organizacaoId, org)));
    if (!p) return NextResponse.json({ erro: "Penalidade não encontrada." }, { status: 404 });

    const erro = (t: string, s = 409) => NextResponse.json({ erro: t }, { status: s });

    switch (body.acao) {
      case "aprovar":
      case "cancelar":
      case "cumprir": {
        const destino = body.acao === "aprovar" ? "aprovada" : body.acao === "cancelar" ? "cancelada" : "cumprida";
        if (!TRANSICOES[p.situacao]?.includes(destino)) {
          return erro(`Transição inválida de ${p.situacao} para ${destino}.`);
        }
        const [ok] = await db.update(penalidade).set({ situacao: destino }).where(and(eq(penalidade.id, id), eq(penalidade.organizacaoId, org), eq(penalidade.situacao, p.situacao))).returning({ id: penalidade.id });
        if (!ok) return erro("A penalidade mudou de situação. Atualize a página.");
        await registrarEvento({
          organizacaoId: org,
          tipo: "penalidade",
          entidade: "penalidade",
          entidadeId: id,
          atorId: sessao.usuarioId,
          payload: { situacao: destino, acao: body.acao },
        });
        return NextResponse.json({ ok: true, situacao: destino });
      }
      case "contraditorio": {
        const contraditorio = String(body.contraditorio ?? "").trim().slice(0, 2000);
        if (!contraditorio) return erro("Contraditório não pode ser vazio.", 422);
        const prazoResposta = body.prazoResposta ? String(body.prazoResposta).slice(0, 10) : null;
        if (prazoResposta && !DATA.test(prazoResposta)) {
          return erro("Prazo de resposta inválido (use AAAA-MM-DD).", 422);
        }
        const [ok] = await db.update(penalidade).set({ contraditorio, prazoResposta }).where(and(eq(penalidade.id, id), eq(penalidade.organizacaoId, org))).returning({ id: penalidade.id });
        if (!ok) return erro("Não foi possível registrar o contraditório.");
        await registrarEvento({
          organizacaoId: org,
          tipo: "penalidade",
          entidade: "penalidade",
          entidadeId: id,
          atorId: sessao.usuarioId,
          payload: { contraditorio, prazoResposta },
        });
        return NextResponse.json({ ok: true });
      }
      default:
        return erro("Ação inválida.", 422);
    }
  });
}
