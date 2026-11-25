import { NextResponse } from "next/server";
import { getSessao } from "@/lib/sessao";

// Busca de endereço via OpenStreetMap Nominatim (sem chave). Uso interno, sem abuso: 1 consulta por clique do fiscal.
export async function GET(request: Request) {
  await getSessao();
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 4 || q.length > 200) return NextResponse.json({ erro: "Informe o endereço completo." }, { status: 400 });

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Fiscalize/1.0" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return NextResponse.json({ erro: "Serviço de mapas indisponível." }, { status: 502 });
    const [achado] = (await r.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!achado) return NextResponse.json({ erro: "Endereço não encontrado. Inclua rua, número, cidade e UF." }, { status: 404 });
    return NextResponse.json({ latitude: Number(achado.lat), longitude: Number(achado.lon), nome: achado.display_name });
  } catch {
    return NextResponse.json({ erro: "Não foi possível consultar o mapa agora." }, { status: 502 });
  }
}
