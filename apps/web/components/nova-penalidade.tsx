"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const campo = "mt-1.5 w-full rounded-lg border border-borda-forte bg-white px-3 py-2.5 text-sm focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25";
const SUGESTOES_TIPO = ["Advertência", "Multa", "Impedimento de licitar e contratar", "Declaração de inidoneidade", "Retenção de pagamento", "Outra medida"];

export function NovaPenalidade({ contratoId }: { contratoId: string }) {
  const router = useRouter();
  const [f, setF] = useState({ tipo: "", valor: "0", justificativa: "", baseLegal: "", prazoResposta: "" });
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setOcupado(true);
    try {
      const r = await fetch(`/api/contratos/${contratoId}/penalidades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, valor: Number(f.valor.replace(/\./g, "").replace(",", ".")) || 0 }),
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (r.ok) {
        setMsg({ tom: "ok", texto: "Penalidade registrada como sugerida. A aprovação é decisão da gestão, gravada na auditoria." });
        setF({ tipo: "", valor: "0", justificativa: "", baseLegal: "", prazoResposta: "" });
        router.refresh();
      } else {
        setMsg({ tom: "erro", texto: j.erro ?? "Falha ao registrar penalidade." });
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={salvar} className="grid gap-4 px-5 py-4 sm:grid-cols-2">
      {msg && <p role="status" className={`sm:col-span-2 rounded-lg px-3 py-2 text-sm ${msg.tom === "ok" ? "bg-sucesso-suave text-sucesso" : "bg-erro-suave text-erro"}`}>{msg.texto}</p>}
      <div>
        <label htmlFor="pe-tipo" className="block text-sm font-medium">Tipo de penalidade</label>
        <input id="pe-tipo" required list="pe-tipos" value={f.tipo} onChange={set("tipo")} className={campo} />
        <datalist id="pe-tipos">{SUGESTOES_TIPO.map((t) => <option key={t} value={t} />)}</datalist>
      </div>
      <div>
        <label htmlFor="pe-val" className="block text-sm font-medium">Valor (R$)</label>
        <input id="pe-val" inputMode="decimal" value={f.valor} onChange={set("valor")} placeholder="0,00" className={campo} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="pe-just" className="block text-sm font-medium">Justificativa — fundamento do fato</label>
        <textarea id="pe-just" required rows={3} value={f.justificativa} onChange={set("justificativa")} placeholder="Descreva o fato constatado e a base da apuração." className={campo} />
      </div>
      <div>
        <label htmlFor="pe-base" className="block text-sm font-medium">Base legal <span className="font-normal text-texto-suave">(opcional)</span></label>
        <input id="pe-base" value={f.baseLegal} onChange={set("baseLegal")} placeholder="Ex.: Lei 14.133/2021, art. 156, II" className={campo} />
      </div>
      <div>
        <label htmlFor="pe-prazo" className="block text-sm font-medium">Prazo de contraditório <span className="font-normal text-texto-suave">(opcional)</span></label>
        <input id="pe-prazo" type="date" value={f.prazoResposta} onChange={set("prazoResposta")} className={campo} />
      </div>
      <div className="sm:col-span-2">
        <button disabled={ocupado} className="rounded-lg bg-primario px-5 py-2.5 text-sm font-semibold text-white hover:bg-primario-escuro disabled:opacity-60">{ocupado ? "Registrando…" : "Registrar penalidade sugerida"}</button>
      </div>
    </form>
  );
}
