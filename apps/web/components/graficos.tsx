// Gráficos em SVG puro (renderizam no servidor, sem biblioteca).
const compacto = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : v >= 1e3 ? `${Math.round(v / 1e3)} mil` : String(Math.round(v)));

export function Barras({ dados, rotuloEixo }: { dados: { rotulo: string; valor: number }[]; rotuloEixo: string }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  const L = 600, A = 210, base = 170, larg = L / Math.max(dados.length, 1);
  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={rotuloEixo} className="h-auto w-full">
      {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2={L} y1={base - f * 140} y2={base - f * 140} stroke="#e3e8ef" strokeDasharray="3 4" />)}
      {dados.map((d, i) => {
        const h = (d.valor / max) * 140;
        const x = i * larg + larg * 0.2;
        return (
          <g key={d.rotulo}>
            <rect x={x} y={base - h} width={larg * 0.6} height={Math.max(h, 2)} rx="5" fill="#1d4ed8" opacity={0.92}><title>{`${d.rotulo}: ${d.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}</title></rect>
            <text x={x + larg * 0.3} y={base - h - 6} textAnchor="middle" fontSize="11" fill="#0f1b2d" fontWeight="600">{d.valor > 0 ? compacto(d.valor) : ""}</text>
            <text x={x + larg * 0.3} y={base + 20} textAnchor="middle" fontSize="11" fill="#5b6b82">{d.rotulo}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Rosca({ fatias, centro }: { fatias: { rotulo: string; valor: number; cor: string }[]; centro: string }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" role="img" aria-label={`Distribuição: ${centro}`} className="h-36 w-36 shrink-0">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#eef2f7" strokeWidth="18" />
        {total > 0 && fatias.filter((f) => f.valor > 0).map((f) => {
          const len = (f.valor / total) * C;
          const el = <circle key={f.rotulo} cx="70" cy="70" r={R} fill="none" stroke={f.cor} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)"><title>{`${f.rotulo}: ${f.valor}`}</title></circle>;
          acc += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f1b2d">{total}</text>
        <text x="70" y="85" textAnchor="middle" fontSize="10" fill="#5b6b82">{centro}</text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {fatias.map((f) => (
          <li key={f.rotulo} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: f.cor }} aria-hidden /><span className="text-texto-suave">{f.rotulo}</span><span className="tabular font-semibold">{f.valor}</span></li>
        ))}
      </ul>
    </div>
  );
}

export function BarraProgresso({ rotulo, valor, total, detalhe }: { rotulo: string; valor: number; total: number; detalhe: string }) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm"><span className="font-medium">{rotulo}</span><span className="tabular text-xs text-texto-suave">{detalhe} · {pct.toFixed(0)}%</span></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Execução de ${rotulo}`}><div className="h-full rounded-full bg-primario" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
