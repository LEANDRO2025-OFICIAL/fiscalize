"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const campo = "mt-1.5 w-full rounded-lg border border-borda-forte bg-white px-3 py-2.5 text-sm focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25";

interface Props {
  id: string;
  situacao: string;
  contraditorio: string | null;
  prazoResposta: string | null;
}

// Ações de decisão sobre a penalidade: toda mudança de estado grava evento na trilha de auditoria.
export function GerirPenalidade({ id, situacao, contraditorio, prazoResposta }: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(contraditorio ?? "");
  const [prazo, setPrazo] = useState(prazoResposta ?? "");

  async function acao(nome: string, corpo?: Record<string, unknown>) {
    setMsg(null);
    setOcupado(true);
    try {
      const r = await fetch(`/api/penalidades/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: nome, ...corpo }),
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (r.ok) {
        if (nome === "contraditorio") setAberto(false);
        router.refresh();
      } else {
        setMsg(j.erro ?? "Falha na ação.");
      }
    } finally {
      setOcupado(false);
    }
  }

  const decisoes: Array<[string, string]> = [];
  if (situacao === "sugerida") decisoes.push(["aprovar", "Aprovar"], ["cancelar", "Cancelar"]);
  if (situacao === "aprovada") decisoes.push(["cumprir", "Marcar cumprida"], ["cancelar", "Cancelar"]);

  return (
    <div className="flex flex-col gap-2">
      {msg && <p role="status" className="rounded bg-erro-suave px-2 py-1 text-xs text-erro">{msg}</p>}
      <div className="flex flex-wrap gap-1.5">
        {decisoes.map(([acao2, rotulo]) => (
          <button key={acao2} disabled={ocupado} onClick={() => void acao(acao2)} className="rounded-lg border border-borda-forte px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">{rotulo}</button>
        ))}
        {!contraditorio && decisoes.length > 0 && (
          <button disabled={ocupado} onClick={() => setAberto((v) => !v)} className="rounded-lg border border-borda-forte px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">{aberto ? "Fechar contraditório" : "Contraditório"}</button>
        )}
      </div>
      {aberto && (
        <div className="rounded-lg border border-borda bg-superficie p-3">
          <label htmlFor={`cd-${id}`} className="block text-xs font-semibold">Manifestação da fornecedora (contraditório)</label>
          <textarea id={`cd-${id}`} rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Registre a defesa apresentada pela fornecedora." className={campo} />
          <label htmlFor={`cp-${id}`} className="mt-2 block text-xs font-semibold">Prazo de resposta</label>
          <input id={`cp-${id}`} type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={campo} />
          <button disabled={ocupado || !texto.trim()} onClick={() => void acao("contraditorio", { contraditorio: texto, prazoResposta: prazo })} className="mt-2 rounded-lg bg-primario px-3 py-1.5 text-xs font-semibold text-white hover:bg-primario-escuro disabled:opacity-50">Salvar contraditório</button>
        </div>
      )}
      {contraditorio && <p className="text-xs text-texto-suave">Contraditório registrado{prazoResposta ? ` · prazo ${prazoResposta.split("-").reverse().join("/")}` : ""}.</p>}
    </div>
  );
}
