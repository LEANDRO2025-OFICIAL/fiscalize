import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { evidencia } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { lerArquivo } from "@/lib/armazenamento";

const EXIBIVEL = ["application/pdf", "image/png", "image/jpeg"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  const [e] = await db
    .select()
    .from(evidencia)
    .where(and(eq(evidencia.id, id), eq(evidencia.organizacaoId, sessao.organizacaoId)));
  if (!e) return new Response("Não encontrado", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await lerArquivo(e.chaveS3);
  } catch {
    return new Response("Arquivo indisponível", { status: 404 });
  }

  const mime = e.mime ?? "application/octet-stream";
  const disposicao = EXIBIVEL.includes(mime) ? "inline" : "attachment";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${disposicao}; filename*=UTF-8''${encodeURIComponent(e.nomeArquivo)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
  });
}
