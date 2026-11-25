import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { contrato, evidencia } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { gravarArquivo, validarArquivo } from "@/lib/armazenamento";

const PODE_ENVIAR = ["administrador", "controlador", "fiscal"];

export async function POST(request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  if (!PODE_ENVIAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para enviar evidências." }, { status: 403 });

  const form = await request.formData();
  const contratoId = String(form.get("contratoId") ?? "");
  const observacao = String(form.get("observacao") ?? "").trim().slice(0, 500) || null;
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || !contratoId) return NextResponse.json({ erro: "Selecione o contrato e o arquivo." }, { status: 400 });

  const [c] = await db
    .select({ id: contrato.id })
    .from(contrato)
    .where(and(eq(contrato.id, contratoId), eq(contrato.organizacaoId, sessao.organizacaoId)));
  if (!c) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const v = validarArquivo(arquivo.name, bytes);
  if (!v.ok) return NextResponse.json({ erro: v.erro }, { status: 422 });

  const { chave, sha256 } = await gravarArquivo(sessao.organizacaoId, bytes);
  const [criada] = await db
    .insert(evidencia)
    .values({
      organizacaoId: sessao.organizacaoId,
      contratoId,
      enviadoPorId: sessao.usuarioId,
      tipo: v.tipo,
      nomeArquivo: arquivo.name.slice(0, 200),
      mime: v.mime,
      chaveS3: chave,
      sha256,
      tamanhoBytes: bytes.byteLength,
      observacao,
    })
    .returning();

  await registrarEvento({
    organizacaoId: sessao.organizacaoId,
    tipo: "evidencia",
    entidade: "evidencia",
    entidadeId: criada!.id,
    atorId: sessao.usuarioId,
    payload: { contratoId, nome: arquivo.name, sha256, bytes: bytes.byteLength },
  });

  return NextResponse.json({ id: criada!.id, sha256 }, { status: 201 });
  });
}
