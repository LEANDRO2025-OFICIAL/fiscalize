import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

const PODE_EDITAR = ["administrador", "controlador", "fiscal"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  if (!PODE_EDITAR.includes(sessao.papel)) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });

  const corpo = (await request.json().catch(() => null)) as { endereco?: string; latitude?: number; longitude?: number } | null;
  const endereco = String(corpo?.endereco ?? "").trim().slice(0, 300);
  const lat = Number(corpo?.latitude);
  const lon = Number(corpo?.longitude);
  // Limites aproximados do território brasileiro.
  if (!endereco || !(lat >= -34 && lat <= 6) || !(lon >= -74 && lon <= -32)) {
    return NextResponse.json({ erro: "Endereço ou coordenadas inválidos." }, { status: 422 });
  }

  const [atualizado] = await db
    .update(contrato)
    .set({ enderecoObra: endereco, latitude: lat.toFixed(6), longitude: lon.toFixed(6) })
    .where(and(eq(contrato.id, id), eq(contrato.organizacaoId, sessao.organizacaoId)))
    .returning({ id: contrato.id });
  if (!atualizado) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

  await registrarEvento({
    organizacaoId: sessao.organizacaoId,
    tipo: "alteracao",
    entidade: "contrato",
    entidadeId: id,
    atorId: sessao.usuarioId,
    payload: { campo: "local_da_obra", endereco, latitude: lat, longitude: lon },
  });
  return NextResponse.json({ ok: true });
  });
}
