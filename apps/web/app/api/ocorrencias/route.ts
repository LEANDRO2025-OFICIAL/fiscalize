import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { contrato, evidencia, ocorrencia } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { gravarArquivo, validarArquivo } from "@/lib/armazenamento";

const TIPOS = ["nao_conformidade", "atraso", "seguranca", "qualidade", "outro"];
const GRAVIDADES = ["baixa", "media", "alta"];

export async function POST(request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  if (!["administrador", "controlador", "fiscal"].includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para registrar ocorrências." }, { status: 403 });
  const org = sessao.organizacaoId;

  const f = await request.formData();
  const txt = (k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
  const contratoId = txt("contratoId", 40), tipo = txt("tipo", 30), gravidade = txt("gravidade", 10), descricao = txt("descricao", 2000), prazo = txt("prazo", 10);
  const lat = f.get("latitude") ? Number(f.get("latitude")) : null;
  const lon = f.get("longitude") ? Number(f.get("longitude")) : null;
  if (!contratoId || !TIPOS.includes(tipo) || !GRAVIDADES.includes(gravidade) || descricao.length < 5) return NextResponse.json({ erro: "Informe contrato, tipo, gravidade e a descrição (mín. 5 caracteres)." }, { status: 422 });
  if (prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) return NextResponse.json({ erro: "Prazo inválido." }, { status: 422 });
  if ((lat !== null && !(lat >= -34 && lat <= 6)) || (lon !== null && !(lon >= -74 && lon <= -32))) return NextResponse.json({ erro: "Coordenadas fora do Brasil." }, { status: 422 });

  const [c] = await db.select({ id: contrato.id, numero: contrato.numero }).from(contrato).where(and(eq(contrato.id, contratoId), eq(contrato.organizacaoId, org)));
  if (!c) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

  // Valida a foto antes de gravar qualquer coisa.
  const arquivo = f.get("arquivo");
  let anexo: { bytes: Buffer; nome: string; mime: string; tipo: "foto" | "documento" } | null = null;
  if (arquivo instanceof File && arquivo.size > 0) {
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const v = validarArquivo(arquivo.name, bytes);
    if (!v.ok) return NextResponse.json({ erro: v.erro }, { status: 422 });
    anexo = { bytes, nome: arquivo.name.slice(0, 200), mime: v.mime, tipo: v.tipo };
  }

  const [o] = await db.insert(ocorrencia).values({
    organizacaoId: org, contratoId, tipo, gravidade, descricao, prazo: prazo || null,
    latitude: lat === null ? null : lat.toFixed(6), longitude: lon === null ? null : lon.toFixed(6), criadoPorId: sessao.usuarioId,
  }).returning({ id: ocorrencia.id });
  await registrarEvento({ organizacaoId: org, tipo: "criacao", entidade: "ocorrencia", entidadeId: o!.id, atorId: sessao.usuarioId, payload: { contrato: c.numero, tipo, gravidade, geolocalizada: lat !== null } });

  if (anexo) {
    const { chave, sha256 } = await gravarArquivo(org, anexo.bytes);
    const [ev] = await db.insert(evidencia).values({ organizacaoId: org, contratoId, enviadoPorId: sessao.usuarioId, tipo: anexo.tipo, nomeArquivo: anexo.nome, mime: anexo.mime, chaveS3: chave, sha256, tamanhoBytes: anexo.bytes.byteLength, observacao: `Ocorrência ${o!.id.slice(0, 8)}`, ocorrenciaId: o!.id }).returning({ id: evidencia.id });
    await registrarEvento({ organizacaoId: org, tipo: "evidencia", entidade: "evidencia", entidadeId: ev!.id, atorId: sessao.usuarioId, payload: { ocorrencia: o!.id, nome: anexo.nome, sha256 } });
  }
  return NextResponse.json({ id: o!.id }, { status: 201 });
  });
}
