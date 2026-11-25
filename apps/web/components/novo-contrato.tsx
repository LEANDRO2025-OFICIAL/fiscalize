"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Achado { pncp: string; numero: string; objeto: string; orgao: string; fornecedorNome: string; fornecedorCnpj: string; valor: number; assinatura: string; fim: string; categoria: string }
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (d: string) => (d ? d.split("-").reverse().join("/") : "—");
const campo = "mt-1.5 w-full rounded-lg border border-borda-forte bg-white px-3 py-2.5 text-sm focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25";
const NATUREZAS = [["engenharia", "Engenharia (obra)"], ["servico", "Serviço"], ["bens", "Bens"]] as const;

async function salvar(corpo: Record<string, unknown>) {
  const r = await fetch("/api/contratos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  return { ok: r.ok, ...(await r.json().catch(() => ({}))) } as { ok: boolean; id?: string; erro?: string };
}

export function NovoContrato({ cnpjOrgao, jaImportados }: { cnpjOrgao: string; jaImportados: string[] }) {
  const router = useRouter();
  const ano = new Date().getFullYear();
  const [aba, setAba] = useState<"pncp" | "manual">("pncp");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // PNCP
  const [cnpj, setCnpj] = useState(cnpjOrgao);
  const [anoBusca, setAnoBusca] = useState(ano);
  const [lista, setLista] = useState<Achado[]>([]);
  const [pagina, setPagina] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [total, setTotal] = useState(0);
  const [naturezas, setNaturezas] = useState<Record<string, string>>({});
  const [importados, setImportados] = useState(new Set(jaImportados));

  async function buscar(prox: number) {
    setMsg(null); setOcupado(true);
    try {
      const r = await fetch(`/api/pncp/contratos?cnpj=${encodeURIComponent(cnpj)}&ano=${anoBusca}&pagina=${prox}`);
      const j = await r.json();
      if (!r.ok) return setMsg(j.erro ?? "Falha na consulta.");
      setLista((l) => (prox === 1 ? j.itens : [...l, ...j.itens]));
      setPagina(prox); setTotalPaginas(j.totalPaginas); setTotal(j.total);
      if (!j.itens.length) setMsg("Nenhum contrato encontrado para este CNPJ e ano.");
    } finally { setOcupado(false); }
  }

  async function importar(a: Achado) {
    setMsg(null); setOcupado(true);
    const r = await salvar({ ...a, categoria: naturezas[a.pncp] ?? a.categoria, valorGlobal: a.valor, dataAssinatura: a.assinatura, dataFim: a.fim });
    setOcupado(false);
    if (r.ok && r.id) return router.push(`/contratos/${r.id}`);
    if (r.id) setImportados((s) => new Set(s).add(a.pncp));
    setMsg(r.erro ?? "Falha ao importar.");
  }

  // Manual
  const [f, setF] = useState({ numero: "", objeto: "", categoria: "servico", fornecedorNome: "", fornecedorCnpj: "", valorGlobal: "", dataAssinatura: "", dataFim: "", enderecoObra: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setOcupado(true);
    const r = await salvar({ ...f, valorGlobal: Number(f.valorGlobal.replace(/\./g, "").replace(",", ".")) });
    setOcupado(false);
    if (r.ok && r.id) return router.push(`/contratos/${r.id}`);
    setMsg(r.erro ?? "Falha ao cadastrar.");
  }

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-borda px-5 pt-3">
        {([["pncp", "Importar do PNCP"], ["manual", "Cadastro manual"]] as const).map(([k, t]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => { setAba(k); setMsg(null); }} className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold ${aba === k ? "border-b-2 border-primario text-primario" : "text-texto-suave hover:text-texto"}`}>{t}</button>
        ))}
      </div>

      {msg && <p role="status" className="mx-5 mt-4 rounded-lg bg-erro-suave px-3 py-2 text-sm text-erro">{msg}</p>}

      {aba === "pncp" ? (
        <div className="p-5">
          <form onSubmit={(e) => { e.preventDefault(); void buscar(1); }} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1"><label htmlFor="pn-cnpj" className="block text-sm font-medium">CNPJ do órgão</label><input id="pn-cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" className={campo} /></div>
            <div><label htmlFor="pn-ano" className="block text-sm font-medium">Ano</label><select id="pn-ano" value={anoBusca} onChange={(e) => setAnoBusca(Number(e.target.value))} className={campo}>{[0, 1, 2, 3, 4].map((i) => <option key={i}>{ano - i}</option>)}</select></div>
            <button disabled={ocupado} className="rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-white hover:bg-primario-escuro disabled:opacity-60">{ocupado && !lista.length ? "Buscando…" : "Buscar no PNCP"}</button>
          </form>
          <p className="mt-2 text-xs text-texto-suave">Consulta pública ao Portal Nacional de Contratações Públicas. O contrato importado traz os dados do PNCP; itens, fiscal e medições são completados aqui.</p>

          {lista.length > 0 && (
            <>
              <p className="mt-5 text-sm text-texto-suave">{total.toLocaleString("pt-BR")} contrato(s) no PNCP · exibindo {lista.length}</p>
              <ul className="mt-2 divide-y divide-borda rounded-card border border-borda">
                {lista.map((a) => (
                  <li key={a.pncp} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-72 flex-1">
                      <p className="text-sm font-semibold">{a.numero} <span className="font-normal text-texto-suave">· {a.fornecedorNome || "Fornecedor não informado"}</span></p>
                      <p className="line-clamp-2 text-sm text-texto">{a.objeto}</p>
                      <p className="tabular text-xs text-texto-suave">{moeda(a.valor)} · {data(a.assinatura)} a {data(a.fim)}</p>
                    </div>
                    <select aria-label="Natureza" value={naturezas[a.pncp] ?? a.categoria} onChange={(e) => setNaturezas((n) => ({ ...n, [a.pncp]: e.target.value }))} className="rounded-lg border border-borda-forte bg-white px-2 py-2 text-sm">
                      {NATUREZAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                    <button disabled={ocupado || importados.has(a.pncp) || !a.assinatura || !a.fim} onClick={() => void importar(a)} className="rounded-lg border border-borda-forte px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{importados.has(a.pncp) ? "Já importado" : "Importar"}</button>
                  </li>
                ))}
              </ul>
              {pagina < totalPaginas && <button disabled={ocupado} onClick={() => void buscar(pagina + 1)} className="mt-3 rounded-lg border border-borda-forte px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">{ocupado ? "Carregando…" : "Carregar mais"}</button>}
            </>
          )}
        </div>
      ) : (
        <form onSubmit={cadastrar} className="grid gap-4 p-5 sm:grid-cols-2">
          <div><label htmlFor="m-num" className="block text-sm font-medium">Número do contrato</label><input id="m-num" required value={f.numero} onChange={set("numero")} placeholder="CT-2026-010" className={campo} /></div>
          <div><label htmlFor="m-cat" className="block text-sm font-medium">Natureza</label><select id="m-cat" value={f.categoria} onChange={set("categoria")} className={campo}>{NATUREZAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
          <div className="sm:col-span-2"><label htmlFor="m-obj" className="block text-sm font-medium">Objeto</label><textarea id="m-obj" required rows={2} value={f.objeto} onChange={set("objeto")} className={campo} /></div>
          <div><label htmlFor="m-for" className="block text-sm font-medium">Fornecedor</label><input id="m-for" required value={f.fornecedorNome} onChange={set("fornecedorNome")} className={campo} /></div>
          <div><label htmlFor="m-cnpj" className="block text-sm font-medium">CNPJ do fornecedor</label><input id="m-cnpj" required value={f.fornecedorCnpj} onChange={set("fornecedorCnpj")} placeholder="00.000.000/0000-00" className={campo} /></div>
          <div><label htmlFor="m-val" className="block text-sm font-medium">Valor global (R$)</label><input id="m-val" required inputMode="decimal" value={f.valorGlobal} onChange={set("valorGlobal")} placeholder="500000,00" className={campo} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="m-ini" className="block text-sm font-medium">Assinatura</label><input id="m-ini" type="date" required value={f.dataAssinatura} onChange={set("dataAssinatura")} className={campo} /></div>
            <div><label htmlFor="m-fim" className="block text-sm font-medium">Fim da vigência</label><input id="m-fim" type="date" required value={f.dataFim} onChange={set("dataFim")} className={campo} /></div>
          </div>
          {f.categoria === "engenharia" && <div className="sm:col-span-2"><label htmlFor="m-end" className="block text-sm font-medium">Endereço da obra <span className="font-normal text-texto-suave">(o ponto exato é marcado no mapa 3D depois)</span></label><input id="m-end" value={f.enderecoObra} onChange={set("enderecoObra")} className={campo} /></div>}
          <div className="sm:col-span-2"><button disabled={ocupado} className="rounded-lg bg-primario px-5 py-2.5 text-sm font-semibold text-white hover:bg-primario-escuro disabled:opacity-60">{ocupado ? "Salvando…" : "Cadastrar contrato"}</button></div>
        </form>
      )}
    </div>
  );
}
