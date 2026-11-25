import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { sessaoAtiva, usuario } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_VER = ["administrador", "controlador"];

// GET - lista sessões ativas da organização
export async function GET(_request: Request) {
  const sessao = await getSessao();
  if (!PODE_VER.includes(sessao.papel)) {
    return NextResponse.json({ erro: "Sem permissão para visualizar sessões." }, { status: 403 });
  }
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const sessoes = await db
      .select({
        id: sessaoAtiva.id,
        usuarioId: sessaoAtiva.usuarioId,
        nomeUsuario: usuario.nome,
        ip: sessaoAtiva.ip,
        userAgent: sessaoAtiva.userAgent,
        ativo: sessaoAtiva.ativo,
        criadoEm: sessaoAtiva.criadoEm,
        ultimoAcesso: sessaoAtiva.ultimoAcesso,
      })
      .from(sessaoAtiva)
      .leftJoin(usuario, eq(usuario.id, sessaoAtiva.usuarioId))
      .where(and(eq(sessaoAtiva.organizacaoId, sessao.organizacaoId), eq(sessaoAtiva.ativo, true)))
      .orderBy(desc(sessaoAtiva.ultimoAcesso));
    return NextResponse.json({ sessoes });
  });
}

// POST - registra uma nova sessão ativa (chamada após login bem-sucedido)
export async function POST(request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
    const tokenHash = txt("tokenHash", 200);
    const ip = txt("ip", 100) || null;
    const userAgent = txt("userAgent", 500) || null;

    if (!tokenHash) return NextResponse.json({ erro: "tokenHash é obrigatório." }, { status: 422 });

    // Marca sessões anteriores do mesmo usuário como inativas
    await db.update(sessaoAtiva)
      .set({ ativo: false })
      .where(and(eq(sessaoAtiva.usuarioId, sessao.usuarioId), eq(sessaoAtiva.ativo, true)));

    const [nova] = await db.insert(sessaoAtiva).values({
      organizacaoId: sessao.organizacaoId,
      usuarioId: sessao.usuarioId,
      tokenHash,
      ip,
      userAgent,
    }).returning({ id: sessaoAtiva.id });

    return NextResponse.json({ id: nova!.id }, { status: 201 });
  });
}
