"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cabecalho, Cartao, Selo, Vazio } from "@/components/ui";
import { formatarMoeda, formatarData } from "@/lib/formatar";

const tomSituacao = (s: string) =>
  s === "vigente" ? "sucesso" : s === "suspenso" ? "alerta" : s === "encerrado" ? "erro" : "neutro";

const rotuloSituacao: Record<string, string> = {
  vigente: "Vigente",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

export default function PaginaMapaObras() {
  const [obras, setObras] = useState<Array<{
    id: string;
    numero: string;
    objeto: string;
    enderecoObra: string | null;
    latitude: number | null;
    longitude: number | null;
    valorGlobal: string;
    situacao: string;
  }>>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      setCarregando(true);
      try {
        const r = await fetch("/api/contratos/mapa", { headers: { Accept: "application/json" } });
        if (!r.ok) throw new Error("Não foi carregar obras.");
        const j = await r.json();
        if (!cancelado) setObras(j.obras ?? []);
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Erro ao carregar mapa.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    carregar();
    return () => { cancelado = true; };
  }, []);

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primario mb-4" />
        <p className="text-texto-suave">Carregando mapa de obras…</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="rounded-full bg-erro-suave p-4 mb-4" aria-hidden>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        </div>
        <p className="text-erro">{erro}</p>
      </div>
    );
  }

  if (obras.length === 0) {
    return (
      <>
        <Cabecalho titulo="Mapa de Obras Públicas" descricao="Obras com localização geográfica cadastrada." />
        <Vazio titulo="Nenhuma obra com localização" texto="Cadastre endereço e coordenadas nos contratos para vê-los no mapa." />
      </>
    );
  }

  const centro = obras.find((o) => o.latitude && o.longitude);
  const centroLat = centro?.latitude ?? -22.19;
  const centroLng = centro?.longitude ?? -55.95;

  return (
    <>
      <Cabecalho
        titulo="Mapa de Obras Públicas"
        descricao={`${obras.length} obra(s) com localização geográfica cadastrada.`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Cartao titulo="Resumo">
          <dl className="space-y-3 px-5 py-4 text-sm">
            <div>
              <dt className="text-xs text-texto-suave uppercase">Obras mapeadas</dt>
              <dd className="tabular font-semibold text-primario">{obras.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-texto-suave uppercase">Valor total</dt>
              <dd className="tabular font-semibold">{formatarMoeda(obras.reduce((s, o) => s + Number(o.valorGlobal), 0))}</dd>
            </div>
            <div>
              <dt className="text-xs text-texto-suave uppercase">Vigentes</dt>
              <dd className="tabular font-semibold text-sucesso">{obras.filter((o) => o.situacao === "vigente").length}</dd>
            </div>
          </dl>
        </Cartao>

        <div className="lg:col-span-2 flex-1">
          <Cartao titulo="Mapa">
            <div className="relative h-[600px] w-full rounded-card border border-borda overflow-hidden">
              <div id="mapa" className="h-full w-full" />
              <div className="absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold shadow ring-1 ring-black/10">
                {obras.length} ponto(s)
              </div>
              <div className="absolute right-3 bottom-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold shadow ring-1 ring-black/10">
                © OpenStreetMap · OpenFreeMap
              </div>
            </div>
            <p className="mt-2 px-5 text-xs text-texto-suave">
              Clique em um ponto do mapa para ver os detalhes da obra. Use Ctrl + arrastar para girar e inclinar.
            </p>
          </Cartao>
        </div>
      </div>

      <Cartao titulo="Lista de Obras Mapeadas" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borda bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-texto-suave">
                <th className="px-5 py-3">Contrato</th>
                <th className="px-5 py-3">Objeto</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Situação</th>
                <th className="px-5 py-3">Endereço</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {obras.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 cursor-pointer group" onClick={() => {}}>
                  <td className="px-5 py-3 font-medium">{o.numero}</td>
                  <td className="px-5 py-3 max-w-md truncate">{o.objeto}</td>
                  <td className="tabular px-5 py-3 text-right">{formatarMoeda(o.valorGlobal)}</td>
                  <td className="px-5 py-3"><Selo tom={tomSituacao(o.situacao)}>{rotuloSituacao[o.situacao] ?? o.situacao}</Selo></td>
                  <td className="px-5 py-3 text-texto-suave text-xs max-w-xs truncate">{o.enderecoObra ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    </>
  );
}
