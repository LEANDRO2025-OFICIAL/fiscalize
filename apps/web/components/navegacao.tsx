"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const itens = [
  { href: "/inicio", rotulo: "Painel", icone: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/contratos", rotulo: "Contratos", icone: "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6" },
  { href: "/vencimentos", rotulo: "Alerta de Vencimentos", icone: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/medicoes", rotulo: "Medições", icone: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/checklists", rotulo: "Checklists", icone: "M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h9" },
  { href: "/ocorrencias", rotulo: "Ocorrências", icone: "M12 3l10 18H2zM12 10v4M12 17.5v.5" },
  { href: "/evidencias/nova", rotulo: "Evidências", icone: "M4 7h4l2-3h4l2 3h4v13H4zM12 17a4 4 0 100-8 4 4 0 000 8z" },
  { href: "/auditoria", rotulo: "Trilha de auditoria", icone: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" },
  { href: "/sinais-risco", rotulo: "RadarCompras", icone: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  { href: "/licitacoes", rotulo: "GestorLicita", icone: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  { href: "/sentinela", rotulo: "SentinelaOps", icone: "M9 12l2 2 4-4M6 2L15 5l-3 6m0 0l6 6M18 18V18M18 18l-4-4M18 18l-3-3M18 18h-6M18 18v-6" },
  { href: "/obrigacoes", rotulo: "Obrigações", icone: "M5 13l4 4L19 7" },
  { href: "/recebimentos", rotulo: "Recebimentos", icone: "M5 19L19 5M7 7h10v10H7z" },
  { href: "/mapa-obras", rotulo: "Mapa de Obras", icone: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-1.343 3-3m-3 3c0 1.657-1.343 3-3 3" },
  { href: "/pncp", rotulo: "PNCP", icone: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  { href: "/vinculos-fornecedores", rotulo: "Vínculos Fornecedor", icone: "M13 10V13M4 4l11.115 11.115M4 16l11.115-11.115M14 9V4l5 5m0 0v5m-5 5H4" },
];

export function Navegacao() {
  const caminho = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1 px-3">
      {itens.map((i) => {
        const ativo = caminho === i.href || caminho.startsWith(i.href + "/");
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={ativo ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              ativo ? "bg-white/12 text-white" : "text-slate-300 hover:bg-white/8 hover:text-white"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={i.icone} /></svg>
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
