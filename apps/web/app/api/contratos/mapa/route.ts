import { NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";

export async function GET(_request: Request) {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const lista = await db
      .select({
        id: contrato.id,
        numero: contrato.numero,
        objeto: contrato.objeto,
        enderecoObra: contrato.enderecoObra,
        latitude: contrato.latitude,
        longitude: contrato.longitude,
        valorGlobal: contrato.valorGlobal,
        situacao: contrato.situacao,
      })
      .from(contrato)
      .where(
        and(
          eq(contrato.organizacaoId, sessao.organizacaoId),
          isNotNull(contrato.latitude),
          isNotNull(contrato.longitude)
        )
      );
    return NextResponse.json({ obras: lista });
  });
}
