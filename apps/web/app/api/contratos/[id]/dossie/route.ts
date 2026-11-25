import { NextResponse } from "next/server";
import { registrarEvento } from "@contratacao/db/auditoria";
import { getSessao } from "@/lib/sessao";
import { gerarDossie } from "@/lib/dossie";

const PODE_EMITIR = ["administrador", "controlador", "fiscal", "leitor"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  if (!PODE_EMITIR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão para emitir o dossiê." }, { status: 403 });

  const r = await gerarDossie(id, sessao.organizacaoId, sessao.usuarioId);
  if (!r) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

  await registrarEvento({
    organizacaoId: sessao.organizacaoId,
    tipo: "criacao",
    entidade: "dossie",
    entidadeId: id,
    atorId: sessao.usuarioId,
    payload: { contratoId: id, eventosVerificados: r.eventosVerificados, cadeiaOk: r.cadeiaOk },
  });

  return new Response(new Uint8Array(r.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${r.nome.replace(/[^A-Za-z0-9._-]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(r.nome)}`,
      "Content-Length": String(r.pdf.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
