"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Map as MapaGL, Marker as MarcadorGL } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Props = {
  contratoId: string;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  podeEditar: boolean;
};

const CENTRO_BR: [number, number] = [-55.95, -22.19];
const ESTILO = "https://tiles.openfreemap.org/styles/liberty";
const RELEVO = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export function MapaObra({ contratoId, endereco, latitude, longitude, podeEditar }: Props) {
  const router = useRouter();
  const alvo = useRef<HTMLDivElement>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const mapa = useRef<MapaGL | null>(null);
  const marcador = useRef<MarcadorGL | null>(null);
  const [texto, setTexto] = useState(endereco ?? "");
  const [ponto, setPonto] = useState<[number, number] | null>(latitude != null && longitude != null ? [longitude, latitude] : null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [em3d, setEm3d] = useState(true);

  function posicionar(lonlat: [number, number], voar: boolean) {
    const m = mapa.current;
    if (!m) return;
    if (!marcador.current) {
      marcador.current = new lib.current!.Marker({ color: "#1d4ed8", draggable: podeEditar }).setLngLat(lonlat).addTo(m);
      marcador.current.on("dragend", () => {
        const p = marcador.current!.getLngLat();
        setPonto([p.lng, p.lat]);
      });
    } else {
      marcador.current.setLngLat(lonlat);
    }
    if (voar) m.flyTo({ center: lonlat, zoom: 17.5, pitch: 65, bearing: -20, speed: 0.9 });
  }

  useEffect(() => {
    let cancelado = false;
    void import("maplibre-gl").then((gl) => {
      if (cancelado || !alvo.current || mapa.current) return;
      lib.current = gl;
      gl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const m = new gl.Map({
        container: alvo.current,
        style: ESTILO,
        center: ponto ?? CENTRO_BR,
        zoom: ponto ? 17 : 12,
        pitch: 62,
        bearing: -20,
        maxPitch: 80,
      });
      mapa.current = m;
      m.addControl(new gl.NavigationControl({ visualizePitch: true }), "top-right");
      m.addControl(new gl.ScaleControl({ unit: "metric" }), "bottom-left");
      m.on("load", () => {
        m.addSource("relevo", { type: "raster-dem", tiles: [RELEVO], encoding: "terrarium", tileSize: 256, maxzoom: 14 });
        m.setTerrain({ source: "relevo", exaggeration: 1.3 });
        if (ponto) posicionar(ponto, false);
      });
      if (podeEditar) {
        m.on("click", (e) => {
          posicionar([e.lngLat.lng, e.lngLat.lat], false);
          setPonto([e.lngLat.lng, e.lngLat.lat]);
          setAviso({ ok: true, texto: "Ponto ajustado no mapa. Clique em Salvar local." });
        });
      }
    });
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
      marcador.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function localizar() {
    setAviso(null);
    if (texto.trim().length < 4) return setAviso({ ok: false, texto: "Digite o endereço completo da obra." });
    setOcupado(true);
    try {
      const r = await fetch(`/api/geocodificar?q=${encodeURIComponent(texto.trim())}`);
      const j = await r.json();
      if (!r.ok) return setAviso({ ok: false, texto: j.erro ?? "Não foi possível localizar." });
      const p: [number, number] = [j.longitude, j.latitude];
      setPonto(p);
      posicionar(p, true);
      setAviso({ ok: true, texto: "Endereço localizado. Confira o ponto e clique em Salvar local." });
    } finally {
      setOcupado(false);
    }
  }

  async function salvar() {
    if (!ponto) return;
    setOcupado(true);
    try {
      const r = await fetch(`/api/contratos/${contratoId}/local`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endereco: texto.trim(), latitude: ponto[1], longitude: ponto[0] }),
      });
      const j = await r.json().catch(() => ({}));
      setAviso(r.ok ? { ok: true, texto: "Local da obra salvo e registrado na trilha de auditoria." } : { ok: false, texto: j.erro ?? "Falha ao salvar." });
      if (r.ok) router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  function alternar3d() {
    const proximo = !em3d;
    setEm3d(proximo);
    mapa.current?.easeTo({ pitch: proximo ? 62 : 0, bearing: proximo ? -20 : 0, duration: 700 });
  }

  return (
    <div>
      {podeEditar && (
        <form
          onSubmit={(e) => { e.preventDefault(); void localizar(); }}
          className="flex flex-wrap items-end gap-3 border-b border-borda px-5 py-4"
        >
          <div className="min-w-64 flex-1">
            <label htmlFor="endereco-obra" className="block text-sm font-medium">Endereço da obra</label>
            <input
              id="endereco-obra"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Rua, número, bairro, cidade - UF"
              className="mt-1.5 w-full rounded-lg border border-borda-forte bg-white px-3 py-2.5 text-sm focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25"
            />
          </div>
          <button type="submit" disabled={ocupado} className="rounded-lg border border-borda-forte bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
            Localizar
          </button>
          <button type="button" onClick={salvar} disabled={ocupado || !ponto} className="rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-white hover:bg-primario-escuro disabled:opacity-50">
            Salvar local
          </button>
        </form>
      )}

      {aviso && (
        <p role="status" className={`mx-5 mt-4 rounded-lg px-3 py-2 text-sm ${aviso.ok ? "bg-sucesso-suave text-sucesso" : "bg-erro-suave text-erro"}`}>{aviso.texto}</p>
      )}

      <div className="relative m-5 overflow-hidden rounded-card border border-borda">
        <div ref={alvo} className="h-[460px] w-full" role="region" aria-label="Mapa 3D do local da obra" />
        <button
          type="button"
          onClick={alternar3d}
          className="absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold shadow ring-1 ring-black/10 hover:bg-white"
        >
          {em3d ? "Vista 2D" : "Vista 3D"}
        </button>
      </div>
      <p className="px-5 pb-4 text-xs text-texto-suave">
        {podeEditar ? "Arraste o pino ou clique no mapa para ajustar o ponto exato. Use Ctrl + arrastar para girar e inclinar." : "Use Ctrl + arrastar para girar e inclinar a vista."} Mapa © OpenStreetMap · OpenFreeMap.
      </p>
    </div>
  );
}
