import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { eventoSeguranca, usuario } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_VER = ["administrador", "controlador"];
const TIPOS = ["login_falha", "acesso_negado", "papel_alterado", "sessao_expirada", "token_invalido"];
const SEVERIDADES = ["baixa", "media", "alta", "critica"];

export async function GET(_request: Request) {
  const sessao = await getSessao();
  if (!PODE_VER.includes(sessao.papel)) {
    return NextResponse.json({ erro: "Sem permissão para visualizar eventos de segurança." }, { status: 403 });
  }
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const eventos = await db
      .select({
        id: eventoSeguranca.id,
        tipo: eventoSeguranca.tipo,
        descricao: eventoSeguranca.descricao,
        ip: eventoSeguranca.ip,
        severidade: eventoSeguranca.severidade,
        usuarioId: eventoSeguranca.usuarioId,
        nomeUsuario: usuario.nome,
        criadoEm: eventoSeguranca.criadoEm,
      })
      .from(eventoSeguranca)
      .leftJoin(usuario, eq(usuario.id, eventoSeguranca.usuarioId))
      .where(eq(eventoSeguranca.organizacaoId, sessao.organizacaoId))
      .orderBy(desc(eventoSeguranca.criadoEm))
      .limit(200);
    return NextResponse.json({ eventos });
  });
}

// POST - registra um novo evento de segurança
export async function POST(request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
    const tipo = txt("tipo", 50);
    const descricao = txt("descricao", 1000);
    const ip = txt("ip", 100) || null;
    const severidade = txt("severidade", 20);

    if (!TIPOS.includes(tipo)) return NextResponse.json({ erro: "Tipo de evento inválido." }, { status: 422 });
    if (!descricao) return NextResponse.json({ erro: "Descrição é obrigatória." }, { status: 422 });
    if (!SEVERIDADES.includes(severidade)) return NextResponse.json({ erro: "Severidade inválida." }, { status: 422 });

    const [novo] = await db.insert(eventoSeguranca).values({
      organizacaoId: sessao.organizacaoId,
      usuarioId: sessao.usuarioId,
      tipo,
      descricao,
      ip,
      severidade,
    }).returning({ id: eventoSeguranca.id });

    return NextResponse.json({ id: novo!.id }, { status: 201 });
  });
}
