import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { usuario } from "@contratacao/db/schema";

export interface Sessao {
  usuarioId: string;
  organizacaoId: string;
  papel: "administrador" | "controlador" | "fiscal" | "fornecedor" | "leitor";
}

const COOKIE = "sessao";
const DURACAO_S = 8 * 60 * 60;

function segredo() {
  const s = process.env.AUTH_SECRET ?? "";
  if (s.length >= 32 && !s.startsWith("troque")) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET ausente ou fraco (mínimo 32 caracteres).");
  return "segredo-de-desenvolvimento-inseguro-nao-usar-em-producao";
}

const assinar = (corpo: string) => createHmac("sha256", segredo()).update(corpo).digest("base64url");

// Cookie assinado (HMAC-SHA256): não pode ser forjado nem ter o órgão trocado pelo cliente.
export async function criarSessao(usuarioId: string, organizacaoId: string) {
  const corpo = Buffer.from(JSON.stringify({ u: usuarioId, o: organizacaoId, e: Math.floor(Date.now() / 1000) + DURACAO_S })).toString("base64url");
  (await cookies()).set(COOKIE, `${corpo}.${assinar(corpo)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DURACAO_S,
  });
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

async function ler(): Promise<{ u: string; o: string } | null> {
  const bruto = (await cookies()).get(COOKIE)?.value;
  const [corpo, assinatura] = (bruto ?? "").split(".");
  if (!corpo || !assinatura) return null;
  const esperado = Buffer.from(assinar(corpo));
  const recebido = Buffer.from(assinatura);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  try {
    const { u, o, e } = JSON.parse(Buffer.from(corpo, "base64url").toString()) as { u: string; o: string; e: number };
    return o && e > Date.now() / 1000 ? { u, o } : null;
  } catch {
    return null;
  }
}

// O órgão vem do cookie assinado; o RLS só devolve o usuário se ele realmente pertence a esse órgão.
// O papel é relido do banco a cada chamada: mudanças de perfil valem na hora.
export async function getSessao(): Promise<Sessao> {
  const sessao = await ler();
  if (!sessao) redirect("/login");
  const [u] = await comOrganizacao(sessao.o, (tx) => tx.select({ id: usuario.id, organizacaoId: usuario.organizacaoId, papel: usuario.papel }).from(usuario).where(eq(usuario.id, sessao.u)));
  if (!u) redirect("/login");
  return { usuarioId: u.id, organizacaoId: u.organizacaoId, papel: u.papel };
}

export function exigirPapel(sessao: Sessao, permitidos: readonly string[]): Sessao {
  if (!permitidos.includes(sessao.papel)) throw new Error("acesso negado");
  return sessao;
}
