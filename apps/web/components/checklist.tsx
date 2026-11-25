"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPCOES = [["conforme", "Conforme", "bg-sucesso text-white"], ["nao_conforme", "Não conforme", "bg-erro text-white"], ["na", "N/A", "bg-slate-600 text-white"]] as const;

export function FormChecklist({ contratoId, modelo, itens }: { contratoId: string; modelo: string; itens: string[] }) {
  const router = useRouter();
  const [res, setRes] = useState<Array<{ resultado: string; obs: string }>>(itens.map(() => ({ resultado: "", obs: "" })));
  const [gerar, setGerar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const set = (i: number, p: Partial<{ resultado: string; obs: string }>) => setRes((r) => r.map((x, n) => (n === i ? { ...x, ...p } : x)));
  const feitos = res.filter((r) => r.resultado).length;
  const nc = res.filter((r) => r.resultado === "nao_conforme").length;

  async function salvar() {
    setErro(null); setOcupado(true);
    const r = await fetch("/api/checklists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contratoId, respostas: res, gerarOcorrencias: gerar }) });
    const j = await r.json().catch(() => ({}));
    setOcupado(false);
    if (!r.ok) return setErro(j.erro ?? "Falha ao salvar.");
    router.push("/checklists");
    router.refresh();
  }

  return (
    <div className="space-y-4 p-5">
      <p className="text-sm text-texto-suave">{modelo} · {feitos} de {itens.length} respondidos</p>
      <ol className="space-y-4">
        {itens.map((t, i) => (
          <li key={i} className="rounded-card border border-borda p-4">
            <p className="text-sm font-medium">{i + 1}. {t}</p>
            <div role="radiogroup" aria-label={t} className="mt-3 flex flex-wrap gap-2">
              {OPCOES.map(([v, rot, cor]) => (
                <button key={v} type="button" role="radio" aria-checked={res[i]!.resultado === v} onClick={() => set(i, { resultado: v })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-borda-forte ${res[i]!.resultado === v ? cor : "bg-white text-texto hover:bg-slate-50"}`}>{rot}</button>
              ))}
            </div>
            {res[i]!.resultado === "nao_conforme" && <input aria-label="Observação" value={res[i]!.obs} onChange={(e) => set(i, { obs: e.target.value })} placeholder="Descreva a não conformidade (obrigatório)" className="mt-3 w-full rounded-lg border border-borda-forte px-3 py-2 text-sm focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25" />}
          </li>
        ))}
      </ol>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={gerar} onChange={(e) => setGerar(e.target.checked)} /> Gerar uma ocorrência para cada item não conforme ({nc})</label>
      {erro && <p role="alert" className="rounded-lg bg-erro-suave px-3 py-2 text-sm text-erro">{erro}</p>}
      <button disabled={ocupado || feitos < itens.length} onClick={salvar} className="rounded-lg bg-primario px-5 py-2.5 text-sm font-semibold text-white hover:bg-primario-escuro disabled:opacity-60">{ocupado ? "Salvando…" : "Concluir checklist"}</button>
    </div>
  );
}
