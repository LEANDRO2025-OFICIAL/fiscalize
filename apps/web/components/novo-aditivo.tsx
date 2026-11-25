"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const campo = "mt-1.5 w-full rounded-lg border border-borda-forte bg-white px-3 py-2.5 text-sm focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25";
const TIPOS = [
  ["prorrogacao", "Prorrogação de vigência"],
  ["acrescimo", "Acréscimo de objeto/quantitativo"],
  ["reducao", "Redução de objeto/quantitativo"],
  ["reforma", "Reforma do contrato"],
  ["acerto", "Acerto de dados cadastrais"],
  ["outro", "Outro"],
] as const;

export function NovoAditivo({ contratoId, proximoNumero }: { contratoId: string; proximoNumero: number }) {
  const router = useRouter();
  const [f, setF] = useState({ numero: String(proximoNumero), tipo: "prorrogacao", objeto: "", valor: "0", dataAssinatura: "", dataPublicacao: "", vigenciaInicio: "", vigenciaFim: "" });
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setOcupado(true);
    try {
      const r = await fetch(`/api/contratos/${contratoId}/aditivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, numero: Number(f.numero), valor: Number(f.valor.replace(/\./g, "").replace(",", ".")) || 0 }),
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (r.ok) {
        setMsg({ tom: "ok", texto: `Aditivo nº ${f.numero} registrado na trilha de auditoria.` });
        setF((v) => ({ ...v, numero: String(Number(v.numero) + 1), objeto: "", valor: "0", dataAssinatura: "", dataPublicacao: "", vigenciaInicio: "", vigenciaFim: "" }));
        router.refresh();
      } else {
        setMsg({ tom: "erro", texto: j.erro ?? "Falha ao registrar aditivo." });
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={salvar} className="grid gap-4 px-5 py-4 sm:grid-cols-2">
      {msg && <p role="status" className={`sm:col-span-2 rounded-lg px-3 py-2 text-sm ${msg.tom === "ok" ? "bg-sucesso-suave text-sucesso" : "bg-erro-suave text-erro"}`}>{msg.texto}</p>}
      <div>
        <label htmlFor="ad-num" className="block text-sm font-medium">Número do aditivo</label>
        <input id="ad-num" type="number" min={1} max={9999} required value={f.numero} onChange={set("numero")} className={campo} />
      </div>
      <div>
        <label htmlFor="ad-tipo" className="block text-sm font-medium">Tipo</label>
        <select id="ad-tipo" value={f.tipo} onChange={set("tipo")} className={campo}>
          {TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="ad-obj" className="block text-sm font-medium">Objeto da alteração</label>
        <textarea id="ad-obj" required rows={2} value={f.objeto} onChange={set("objeto")} placeholder="Descreva o que o aditivo altera no contrato." className={campo} />
      </div>
      <div>
        <label htmlFor="ad-val" className="block text-sm font-medium">Valor (R$) <span className="font-normal text-texto-suave">— 0,00 em prorrogação sem reajuste</span></label>
        <input id="ad-val" inputMode="decimal" value={f.valor} onChange={set("valor")} placeholder="0,00" className={campo} />
      </div>
      <div>
        <label htmlFor="ad-ass" className="block text-sm font-medium">Data de assinatura</label>
        <input id="ad-ass" type="date" required value={f.dataAssinatura} onChange={set("dataAssinatura")} className={campo} />
      </div>
      <div>
        <label htmlFor="ad-pub" className="block text-sm font-medium">Publicação <span className="font-normal text-texto-suave">(opcional)</span></label>
        <input id="ad-pub" type="date" value={f.dataPublicacao} onChange={set("dataPublicacao")} className={campo} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ad-ini" className="block text-sm font-medium">Nova vigência — início</label>
          <input id="ad-ini" type="date" value={f.vigenciaInicio} onChange={set("vigenciaInicio")} className={campo} />
        </div>
        <div>
          <label htmlFor="ad-fim" className="block text-sm font-medium">— fim</label>
          <input id="ad-fim" type="date" value={f.vigenciaFim} onChange={set("vigenciaFim")} className={campo} />
        </div>
      </div>
      <div className="sm:col-span-2">
        <button disabled={ocupado} className="rounded-lg bg-primario px-5 py-2.5 text-sm font-semibold text-white hover:bg-primario-escuro disabled:opacity-60">{ocupado ? "Registrando…" : "Registrar aditivo"}</button>
      </div>
    </form>
  );
}
