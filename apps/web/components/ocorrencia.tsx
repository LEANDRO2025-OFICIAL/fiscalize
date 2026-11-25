"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const campo = "mt-1.5 w-full rounded-lg border border-borda-forte bg-white px-3 py-2.5 text-sm focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25";
const TIPOS = [["nao_conformidade", "Não conformidade"], ["atraso", "Atraso"], ["seguranca", "Segurança do trabalho"], ["qualidade", "Qualidade do material/serviço"], ["outro", "Outro"]];

export function FormOcorrencia({ contratos }: { contratos: { id: string; numero: string }[] }) {
  const router = useRouter();
  const foto = useRef<HTMLInputElement>(null);
  const [geo, setGeo] = useState<{ lat: number; lon: number } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function localizar() {
    if (!navigator.geolocation) return setMsg({ ok: false, t: "Este navegador não oferece geolocalização." });
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo({ lat: p.coords.latitude, lon: p.coords.longitude }); setMsg({ ok: true, t: "Localização capturada." }); },
      () => setMsg({ ok: false, t: "Não foi possível obter a localização. Verifique a permissão do navegador." }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(null); setOcupado(true);
    const form = e.currentTarget;
    const corpo = new FormData(form);
    if (geo) { corpo.set("latitude", String(geo.lat)); corpo.set("longitude", String(geo.lon)); }
    const r = await fetch("/api/ocorrencias", { method: "POST", body: corpo });
    const j = await r.json().catch(() => ({}));
    setOcupado(false);
    if (!r.ok) return setMsg({ ok: false, t: j.erro ?? "Falha ao registrar." });
    form.reset(); setGeo(null); setMsg({ ok: true, t: "Ocorrência registrada na trilha de auditoria." }); router.refresh();
  }

  return (
    <form onSubmit={enviar} className="grid gap-4 p-5 sm:grid-cols-2">
      <div><label htmlFor="o-c" className="block text-sm font-medium">Contrato</label><select id="o-c" name="contratoId" required className={campo}>{contratos.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}</select></div>
      <div><label htmlFor="o-t" className="block text-sm font-medium">Tipo</label><select id="o-t" name="tipo" className={campo}>{TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
      <div><label htmlFor="o-g" className="block text-sm font-medium">Gravidade</label><select id="o-g" name="gravidade" defaultValue="media" className={campo}><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></select></div>
      <div><label htmlFor="o-p" className="block text-sm font-medium">Prazo para regularizar <span className="font-normal text-texto-suave">(opcional)</span></label><input id="o-p" name="prazo" type="date" className={campo} /></div>
      <div className="sm:col-span-2"><label htmlFor="o-d" className="block text-sm font-medium">O que foi constatado</label><textarea id="o-d" name="descricao" required minLength={5} rows={3} className={campo} /></div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="button" onClick={localizar} className="rounded-lg border border-borda-forte px-3 py-2 text-sm font-semibold hover:bg-slate-50">{geo ? `📍 ${geo.lat.toFixed(5)}, ${geo.lon.toFixed(5)}` : "Capturar localização"}</button>
        <input ref={foto} name="arquivo" type="file" accept="image/png,image/jpeg,.pdf" capture="environment" aria-label="Foto da ocorrência" className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primario-suave file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primario-escuro" />
      </div>
      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm sm:col-span-2 ${msg.ok ? "bg-sucesso-suave text-sucesso" : "bg-erro-suave text-erro"}`}>{msg.t}</p>}
      <div className="sm:col-span-2"><button disabled={ocupado} className="rounded-lg bg-primario px-5 py-2.5 text-sm font-semibold text-white hover:bg-primario-escuro disabled:opacity-60">{ocupado ? "Registrando…" : "Registrar ocorrência"}</button></div>
    </form>
  );
}

export function ResolverOcorrencia({ id }: { id: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  async function salvar() {
    setErro(null);
    const r = await fetch(`/api/ocorrencias/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolucao: texto }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErro(j.erro ?? "Falha.");
    router.refresh();
  }
  if (!aberto) return <button onClick={() => setAberto(true)} className="text-sm font-semibold text-primario hover:underline">Resolver</button>;
  return (
    <div className="space-y-2">
      <textarea aria-label="Como foi resolvida" rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Como foi resolvida" className={campo} />
      {erro && <p role="alert" className="text-xs text-erro">{erro}</p>}
      <button onClick={salvar} className="rounded-lg bg-sucesso px-3 py-1.5 text-xs font-semibold text-white">Confirmar</button>
    </div>
  );
}
