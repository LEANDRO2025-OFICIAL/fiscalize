"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACEITA = ".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg";
const LIMITE_MB = 15;

type Resultado = { nome: string; ok: boolean; texto: string };

export function EnviarEvidencia({ contratoId, contratos }: { contratoId?: string; contratos?: { id: string; numero: string }[] }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [contrato, setContrato] = useState(contratoId ?? contratos?.[0]?.id ?? "");
  const [observacao, setObservacao] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);

  async function enviar(arquivos: FileList | File[]) {
    const lista = Array.from(arquivos);
    if (!lista.length || !contrato) return;
    setEnviando(true);
    setResultados([]);
    const saida: Resultado[] = [];
    for (const arquivo of lista) {
      if (arquivo.size > LIMITE_MB * 1024 * 1024) {
        saida.push({ nome: arquivo.name, ok: false, texto: `Acima de ${LIMITE_MB} MB.` });
        continue;
      }
      const corpo = new FormData();
      corpo.set("contratoId", contrato);
      corpo.set("arquivo", arquivo);
      if (observacao.trim()) corpo.set("observacao", observacao.trim());
      try {
        const r = await fetch("/api/evidencias", { method: "POST", body: corpo });
        const j = await r.json().catch(() => ({}));
        saida.push({ nome: arquivo.name, ok: r.ok, texto: r.ok ? `Registrada · SHA-256 ${String(j.sha256).slice(0, 10)}…` : j.erro ?? "Falha no envio." });
      } catch {
        saida.push({ nome: arquivo.name, ok: false, texto: "Sem conexão com o servidor." });
      }
    }
    setResultados(saida);
    setEnviando(false);
    if (entrada.current) entrada.current.value = "";
    if (saida.some((s) => s.ok)) {
      setObservacao("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4 p-5">
      {!contratoId && (
        <div>
          <label htmlFor="contrato-ev" className="block text-sm font-medium">Contrato</label>
          <select
            id="contrato-ev"
            value={contrato}
            onChange={(e) => setContrato(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-borda-forte bg-white px-3 py-2.5 text-sm focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25"
          >
            {contratos?.map((c) => (
              <option key={c.id} value={c.id}>{c.numero}</option>
            ))}
          </select>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); void enviar(e.dataTransfer.files); }}
        className={`rounded-card border-2 border-dashed px-6 py-8 text-center transition-colors ${arrastando ? "border-primario bg-primario-suave" : "border-borda-forte bg-slate-50/60"}`}
      >
        <p className="text-sm font-medium">Arraste arquivos aqui ou</p>
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={enviando || !contrato}
          className="mt-2 rounded-lg bg-primario px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primario-escuro disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Escolher arquivos"}
        </button>
        <input ref={entrada} type="file" multiple accept={ACEITA} className="sr-only" aria-label="Escolher arquivos" onChange={(e) => e.target.files && void enviar(e.target.files)} />
        <p className="mt-3 text-xs text-texto-suave">PDF, TXT, Word (DOC/DOCX), PNG e JPG · até {LIMITE_MB} MB cada</p>
      </div>

      <div>
        <label htmlFor="obs-ev" className="block text-sm font-medium">Observação <span className="font-normal text-texto-suave">(opcional, vale para os arquivos deste envio)</span></label>
        <input
          id="obs-ev"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          maxLength={500}
          placeholder="Ex.: vistoria do trecho entre as ruas A e B"
          className="mt-1.5 w-full rounded-lg border border-borda-forte bg-white px-3 py-2.5 text-sm focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25"
        />
      </div>

      <ul role="status" aria-live="polite" className="space-y-1.5">
        {resultados.map((r, i) => (
          <li key={i} className={`rounded-lg px-3 py-2 text-sm ${r.ok ? "bg-sucesso-suave text-sucesso" : "bg-erro-suave text-erro"}`}>
            <span className="font-medium">{r.nome}</span> — {r.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}
