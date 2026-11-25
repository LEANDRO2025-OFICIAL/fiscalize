import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { sinalRisco } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { registrarEvento } from "@contratacao/db/auditoria";

const PODE_REVISAR = ["administrador", "controlador", "fiscal"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  if (!PODE_REVISAR.includes(sessao.papel)) {
    return NextResponse.json({ erro: "Sem permissão para registrar parecer." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    acao?: string;
    texto?: string;
    observacao?: string;
  } | null;
  if (!body?.acao) {
    return NextResponse.json({ erro: "Ação é obrigatória." }, { status: 400 });
  }

  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;
    const [s] = await db
      .select()
      .from(sinalRisco)
      .where(and(eq(sinalRisco.id, id), eq(sinalRisco.organizacaoId, org)));
    if (!s) return NextResponse.json({ erro: "Sinal não encontrado." }, { status: 404 });

    if (body.acao === "parecer") {
      const texto = String(body.texto ?? "").trim().slice(0, 2000);
      if (!texto) {
        return NextResponse.json({ erro: "O parecer não pode ser vazio." }, { status: 422 });
      }
      const observacao = String(body.observacao ?? "").trim().slice(0, 1000) || null;
      const [ok] = await db
        .update(sinalRisco)
        .set({
          statusRevisao: "revisado",
          parecerHumano: texto,
          observacao,
          parecerPorId: sessao.usuarioId,
          parecerEm: new Date(),
        })
        .where(
          and(
            eq(sinalRisco.id, id),
            eq(sinalRisco.organizacaoId, org),
            eq(sinalRisco.statusRevisao, "aguarda_revisao")
          )
        )
        .returning({ id: sinalRisco.id });
      if (!ok) {
        return NextResponse.json(
          { erro: "O sinal já foi revisado. Atualize a página." },
          { status: 409 }
        );
      }
      await registrarEvento({
        organizacaoId: org,
        tipo: "alteracao",
        entidade: "sinal_risco",
        entidadeId: id,
        atorId: sessao.usuarioId,
        payload: { acao: "parecer", observacao },
      });
      return NextResponse.json({ ok: true, statusRevisao: "revisado" });
    }

    if (body.acao === "observacao") {
      const observacao = String(body.observacao ?? "").trim().slice(0, 1000);
      const [ok] = await db
        .update(sinalRisco)
        .set({ observacao })
        .where(and(eq(sinalRisco.id, id), eq(sinalRisco.organizacaoId, org)))
        .returning({ id: sinalRisco.id });
      if (!ok) {
        return NextResponse.json({ erro: "Não foi possível salvar a observação." }, { status: 409 });
      }
      await registrarEvento({
        organizacaoId: org,
        tipo: "alteracao",
        entidade: "sinal_risco",
        entidadeId: id,
        atorId: sessao.usuarioId,
        payload: { acao: "observacao" },
      });
      return NextResponse.json({ ok: true, observacao });
    }

    return NextResponse.json({ erro: "Ação inválida." }, { status: 422 });
  });
}
