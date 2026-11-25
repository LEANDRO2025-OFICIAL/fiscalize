"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const campo = "mt-1.5 w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25";
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const aviso = (m: string | null) => m && <p role="status" className="mt-3 rounded-lg bg-erro-suave px-3 py-2 text-sm text-erro">{m}</p>;

interface Linha { descricao: string; unidade: string; quantidade: string; valorUnitario: string }

export function EditorItens({ contratoId, valorGlobal, itens }: { contratoId: string; valorGlobal: number; itens: Linha[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>(itens);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  const total = linhas.reduce((s, l) => s + num(l.quantidade) * num(l.valorUnitario), 0);
  const edita = (i: number, k: keyof Linha, v: string) => setLinhas((ls) => ls.map((l, n) => (n === i ? { ...l, [k]: v } : l)));

  async function salvar() {
    setErro(null); setOcupado(true);
    const r = await fetch(`/api/contratos/${contratoId}/itens`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itens: linhas.map((l) => ({ ...l, quantidade: num(l.quantidade), valorUnitario: num(l.valorUnitario) })) }) });
    const j = await r.json().catch(() => ({}));
    setOcupado(false);
    if (!r.ok) return setErro(j.erro ?? "Falha ao salvar.");
    setAberto(false); router.refresh();
  }

  if (!aberto) return <div className="border-t border-borda px-5 py-3"><button onClick={() => setAberto(true)} className="text-sm font-semibold text-primario hover:underline">Editar itens</button></div>;
  return (
    <div className="space-y-3 border-t border-borda p-5">
      {linhas.map((l, i) => (
        <div key={i} className="grid grid-cols-12 gap-2">
          <input aria-label="Descrição" value={l.descricao} onChange={(e) => edita(i, "descricao", e.target.value)} placeholder="Descrição" className={`${campo} col-span-12 mt-0 sm:col-span-5`} />
          <input aria-label="Unidade" value={l.unidade} onChange={(e) => edita(i, "unidade", e.target.value)} placeholder="un" className={`${campo} col-span-3 mt-0 sm:col-span-1`} />
          <input aria-label="Quantidade" inputMode="decimal" value={l.quantidade} onChange={(e) => edita(i, "quantidade", e.target.value)} placeholder="Qtd." className={`${campo} col-span-4 mt-0 sm:col-span-2`} />
          <input aria-label="Valor unitário" inputMode="decimal" value={l.valorUnitario} onChange={(e) => edita(i, "valorUnitario", e.target.value)} placeholder="Unitário" className={`${campo} col-span-4 mt-0 sm:col-span-3`} />
          <button type="button" aria-label="Remover item" onClick={() => setLinhas((ls) => ls.filter((_, n) => n !== i))} disabled={linhas.length === 1} className="col-span-1 rounded-lg text-texto-suave hover:text-erro disabled:opacity-30">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => setLinhas((ls) => [...ls, { descricao: "", unidade: "un", quantidade: "1", valorUnitario: "0" }])} className="text-sm font-semibold text-primario hover:underline">+ Adicionar item</button>
      <p className={`tabular text-sm ${Math.abs(total - valorGlobal) < 0.01 ? "text-sucesso" : "text-alerta"}`}>
        Total dos itens: {moeda(total)} · valor global: {moeda(valorGlobal)}{Math.abs(total - valorGlobal) >= 0.01 && ` · diferença de ${moeda(total - valorGlobal)}`}
      </p>
      {aviso(erro)}
      <div className="flex gap-3">
        <button disabled={ocupado} onClick={salvar} className="rounded-lg bg-primario px-4 py-2 text-sm font-semibold text-white hover:bg-primario-escuro disabled:opacity-60">{ocupado ? "Salvando…" : "Salvar itens"}</button>
        <button onClick={() => { setAberto(false); setLinhas(itens); setErro(null); }} className="rounded-lg border border-borda-forte px-4 py-2 text-sm font-semibold hover:bg-slate-50">Cancelar</button>
      </div>
    </div>
  );
}

export function DesignarFiscal({ contratoId, fiscais, atualId }: { contratoId: string; fiscais: { id: string; nome: string }[]; atualId: string | null }) {
  const router = useRouter();
  const [fiscalId, setFiscalId] = useState(atualId ?? fiscais[0]?.id ?? "");
  const [portaria, setPortaria] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro(null); setOcupado(true);
    const r = await fetch(`/api/contratos/${contratoId}/fiscal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fiscalId, portaria, dataInicio }) });
    const j = await r.json().catch(() => ({}));
    setOcupado(false);
    if (!r.ok) return setErro(j.erro ?? "Falha ao designar.");
    setPortaria(""); router.refresh();
  }

  return (
    <form onSubmit={enviar} className="space-y-3 border-t border-borda px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Designar fiscal</p>
      <select aria-label="Fiscal" value={fiscalId} onChange={(e) => setFiscalId(e.target.value)} className={campo}>
        {fiscais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
      </select>
      <input aria-label="Portaria" required value={portaria} onChange={(e) => setPortaria(e.target.value)} placeholder="Portaria nº 000/2026" className={campo} />
      <input aria-label="Início" type="date" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={campo} />
      {aviso(erro)}
      <button disabled={ocupado || !fiscalId} className="rounded-lg bg-primario px-4 py-2 text-sm font-semibold text-white hover:bg-primario-escuro disabled:opacity-60">{ocupado ? "Salvando…" : "Designar"}</button>
    </form>
  );
}
