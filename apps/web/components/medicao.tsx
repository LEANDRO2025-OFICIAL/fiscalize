"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const campo = "mt-1 w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25";
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;
const Erro = ({ m }: { m: string | null }) => (m ? <p role="alert" className="rounded-lg bg-erro-suave px-3 py-2 text-sm text-erro">{m}</p> : null);

async function chamar(url: string, corpo: unknown, metodo = "POST") {
  const r = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  return { ok: r.ok, ...(await r.json().catch(() => ({}))) } as { ok: boolean; id?: string; erro?: string };
}

export interface ItemSaldo { id: string; descricao: string; unidade: string; total: number; unitario: number; usado: number; saldo: number }

export function FormMedicao({ contratoId, itens }: { contratoId: string; itens: ItemSaldo[] }) {
  const router = useRouter();
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7));
  const [qtd, setQtd] = useState<Record<string, string>>({});
  const [glosas, setGlosas] = useState<Array<{ valor: string; motivo: string }>>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const bruto = itens.reduce((s, i) => s + num(qtd[i.id] ?? "") * i.unitario, 0);
  const totalGlosa = glosas.reduce((s, g) => s + num(g.valor), 0);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null); setOcupado(true);
    const r = await chamar("/api/medicoes", {
      contratoId, competencia,
      itens: itens.map((i) => ({ id: i.id, quantidade: num(qtd[i.id] ?? "") })),
      glosas: glosas.map((g) => ({ valor: num(g.valor), motivo: g.motivo })),
    });
    setOcupado(false);
    if (r.ok && r.id) return router.push(`/medicoes/${r.id}`);
    setErro(r.erro ?? "Falha ao salvar.");
  }

  return (
    <form onSubmit={salvar} className="space-y-5 p-5">
      <div className="max-w-xs"><label htmlFor="comp" className="block text-sm font-medium">Competência</label><input id="comp" type="month" required value={competencia} onChange={(e) => setCompetencia(e.target.value)} className={campo} /></div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-borda text-left text-xs font-semibold uppercase tracking-wide text-texto-suave"><th className="py-2 pr-3">Item</th><th className="px-3 text-right">Saldo</th><th className="px-3 text-right">Unitário</th><th className="px-3">Medido no mês</th><th className="pl-3 text-right">Subtotal</th></tr></thead>
          <tbody className="divide-y divide-borda">
            {itens.map((i) => (
              <tr key={i.id}>
                <td className="py-2 pr-3">{i.descricao}</td>
                <td className="tabular px-3 text-right text-texto-suave">{i.saldo.toLocaleString("pt-BR")} {i.unidade}</td>
                <td className="tabular px-3 text-right">{moeda(i.unitario)}</td>
                <td className="px-3"><input aria-label={`Quantidade de ${i.descricao}`} inputMode="decimal" value={qtd[i.id] ?? ""} onChange={(e) => setQtd((q) => ({ ...q, [i.id]: e.target.value }))} placeholder="0" className={`${campo} mt-0 w-28`} /></td>
                <td className="tabular pl-3 text-right font-medium">{moeda(num(qtd[i.id] ?? "") * i.unitario)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Glosas <span className="font-normal text-texto-suave">(desconto por serviço não executado ou fora da especificação)</span></p>
        {glosas.map((g, i) => (
          <div key={i} className="flex gap-2">
            <input aria-label="Valor da glosa" inputMode="decimal" value={g.valor} onChange={(e) => setGlosas((l) => l.map((x, n) => (n === i ? { ...x, valor: e.target.value } : x)))} placeholder="Valor (R$)" className={`${campo} mt-0 w-36`} />
            <input aria-label="Motivo da glosa" value={g.motivo} onChange={(e) => setGlosas((l) => l.map((x, n) => (n === i ? { ...x, motivo: e.target.value } : x)))} placeholder="Motivo" className={`${campo} mt-0 flex-1`} />
            <button type="button" aria-label="Remover glosa" onClick={() => setGlosas((l) => l.filter((_, n) => n !== i))} className="px-2 text-texto-suave hover:text-erro">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setGlosas((l) => [...l, { valor: "", motivo: "" }])} className="text-sm font-semibold text-primario hover:underline">+ Adicionar glosa</button>
      </div>

      <dl className="tabular grid max-w-sm grid-cols-2 gap-1 rounded-lg bg-slate-50 p-4 text-sm">
        <dt className="text-texto-suave">Bruto</dt><dd className="text-right">{moeda(bruto)}</dd>
        <dt className="text-texto-suave">Glosas</dt><dd className="text-right text-erro">- {moeda(totalGlosa)}</dd>
        <dt className="font-semibold">Líquido</dt><dd className="text-right font-semibold">{moeda(bruto - totalGlosa)}</dd>
      </dl>

      <Erro m={erro} />
      <button disabled={ocupado || bruto <= 0} className="rounded-lg bg-primario px-5 py-2.5 text-sm font-semibold text-white hover:bg-primario-escuro disabled:opacity-60">{ocupado ? "Salvando…" : "Salvar como rascunho"}</button>
    </form>
  );
}

export function AcoesMedicao({ id, situacao, papel, ehAutor, recebimento }: { id: string; situacao: string; papel: string; ehAutor: boolean; recebimento: { situacao: string } | null }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [rejeitando, setRejeitando] = useState(false);
  const [receb, setReceb] = useState<"conforme" | "divergente">("conforme");
  const [parecer, setParecer] = useState("");
  const gestor = ["administrador", "controlador"].includes(papel);
  const opera = gestor || papel === "fiscal";

  async function agir(corpo: Record<string, unknown>) {
    setErro(null); setOcupado(true);
    const r = await chamar(`/api/medicoes/${id}/acao`, corpo);
    setOcupado(false);
    if (!r.ok) return setErro(r.erro ?? "Falha.");
    setRejeitando(false); router.refresh();
  }
  const btn = "rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60";

  return (
    <div className="space-y-3 p-5">
      <Erro m={erro} />
      {situacao === "rascunho" && opera && <button disabled={ocupado} onClick={() => agir({ acao: "submeter" })} className={`${btn} bg-primario text-white hover:bg-primario-escuro`}>Submeter para aprovação</button>}
      {situacao === "submetida" && gestor && (ehAutor ? <p className="text-sm text-texto-suave">Você registrou esta medição; outra pessoa precisa aprová-la (segregação de funções).</p> : (
        <div className="space-y-3">
          <div className="flex gap-3">
            <button disabled={ocupado} onClick={() => agir({ acao: "aprovar" })} className={`${btn} bg-sucesso text-white hover:opacity-90`}>Aprovar</button>
            <button disabled={ocupado} onClick={() => setRejeitando((v) => !v)} className={`${btn} border border-borda-forte hover:bg-slate-50`}>Rejeitar</button>
          </div>
          {rejeitando && (
            <div className="space-y-2"><label htmlFor="mot" className="block text-sm font-medium">Motivo da rejeição</label><textarea id="mot" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={campo} /><button disabled={ocupado || !motivo.trim()} onClick={() => agir({ acao: "rejeitar", motivo })} className={`${btn} bg-erro text-white`}>Confirmar rejeição</button></div>
          )}
        </div>
      ))}
      {situacao === "submetida" && !gestor && <p className="text-sm text-texto-suave">Aguardando decisão do controlador ou administrador.</p>}
      {situacao === "aprovada" && recebimento?.situacao === "pendente" && opera && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Registrar recebimento</p>
          <select aria-label="Situação do recebimento" value={receb} onChange={(e) => setReceb(e.target.value as "conforme" | "divergente")} className={campo}><option value="conforme">Conforme</option><option value="divergente">Divergente</option></select>
          <textarea aria-label="Parecer" rows={2} value={parecer} onChange={(e) => setParecer(e.target.value)} placeholder={receb === "divergente" ? "Descreva a divergência (obrigatório)" : "Parecer (opcional)"} className={campo} />
          <button disabled={ocupado} onClick={() => agir({ acao: "receber", situacao: receb, parecer })} className={`${btn} bg-primario text-white hover:bg-primario-escuro`}>Registrar recebimento</button>
        </div>
      )}
    </div>
  );
}
