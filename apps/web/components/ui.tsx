import type { ReactNode } from "react";

type Tom = "neutro" | "primario" | "sucesso" | "alerta" | "erro";

const tons: Record<Tom, string> = {
  neutro: "bg-slate-100 text-slate-700 ring-slate-200",
  primario: "bg-primario-suave text-primario-escuro ring-blue-200",
  sucesso: "bg-sucesso-suave text-sucesso ring-green-200",
  alerta: "bg-alerta-suave text-alerta ring-amber-200",
  erro: "bg-erro-suave text-erro ring-red-200",
};

export function Selo({ tom = "neutro", children }: { tom?: Tom; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tons[tom]}`}>
      {children}
    </span>
  );
}

export function Cartao({ titulo, acao, children, className = "" }: { titulo?: string; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-borda bg-superficie shadow-card ${className}`}>
      {titulo && (
        <header className="flex items-center justify-between border-b border-borda px-5 py-3.5">
          <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
          {acao}
        </header>
      )}
      {children}
    </section>
  );
}

export function Indicador({ rotulo, valor, detalhe, tom = "neutro" }: { rotulo: string; valor: string; detalhe?: string; tom?: Tom }) {
  const barra: Record<Tom, string> = { neutro: "bg-slate-300", primario: "bg-primario", sucesso: "bg-sucesso", alerta: "bg-alerta", erro: "bg-erro" };
  return (
    <div className="relative overflow-hidden rounded-card border border-borda bg-superficie p-5 shadow-card">
      <span className={`absolute inset-y-0 left-0 w-1 ${barra[tom]}`} aria-hidden />
      <p className="text-xs font-medium uppercase tracking-wide text-texto-suave">{rotulo}</p>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight text-texto">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-texto-suave">{detalhe}</p>}
    </div>
  );
}

export function Cabecalho({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-texto">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-texto-suave">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-primario-suave text-primario" aria-hidden>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4zM4 9h16M9 9v11" /></svg>
      </div>
      <p className="text-sm font-semibold text-texto">{titulo}</p>
      <p className="mt-1 max-w-sm text-sm text-texto-suave">{texto}</p>
    </div>
  );
}

export function Tabela({ colunas, children }: { colunas: { rotulo: string; alinhar?: "direita" }[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-borda bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-texto-suave">
            {colunas.map((c) => (
              <th key={c.rotulo} scope="col" className={`px-5 py-3 ${c.alinhar === "direita" ? "text-right" : ""}`}>{c.rotulo}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">{children}</tbody>
      </table>
    </div>
  );
}
