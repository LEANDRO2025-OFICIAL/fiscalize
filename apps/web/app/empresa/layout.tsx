import { eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { organizacao, usuario } from "@contratacao/db/schema";
import { redirect } from "next/navigation";
import { encerrarSessao, getSessao } from "@/lib/sessao";
import Link from "next/link";

const papeis: Record<string, string> = {
  fornecedor: "Fornecedor",
};

export default async function LayoutEmpresa({ children }: { children: React.ReactNode }) {
  const sessao = await getSessao();

  // Somente fornecedores acessam o modo empresa
  if (sessao.papel !== "fornecedor") redirect("/inicio");

  const [org, usr] = await comOrganizacao(sessao.organizacaoId, async (db) => [
    (await db.select({ nome: organizacao.nome, cnpj: organizacao.cnpj }).from(organizacao).where(eq(organizacao.id, sessao.organizacaoId)).limit(1))[0],
    (await db.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, sessao.usuarioId)).limit(1))[0],
  ] as const);
  const nome = usr?.nome ?? "Usuário";

  async function sair() {
    "use server";
    await encerrarSessao();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-marinho py-5 text-white md:flex">
        <div className="mb-8 flex items-center gap-3 px-6">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primario text-sm font-bold">E</div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Fiscalize</p>
            <p className="text-xs text-slate-400">Modo Empresa</p>
          </div>
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-1 px-3">
          {[
            { href: "/empresa/inicio", rotulo: "Painel", icone: "M3 12l9-9 9 9M5 10v10h14V10" },
            { href: "/empresa/contratos", rotulo: "Meus Contratos", icone: "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6" },
            { href: "/empresa/licitacoes", rotulo: "Licitações", icone: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
          ].map((i) => {
            const ativo = typeof window !== "undefined" ? window.location.pathname === i.href || window.location.pathname.startsWith(i.href + "/") : false;
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
        <div className="mt-auto border-t border-white/10 px-6 pt-4 text-xs text-slate-400">
          <p className="font-medium text-slate-200">{org?.nome ?? "Empresa"}</p>
          <p className="text-xs">{org?.cnpj ?? ""}</p>
          <p className="text-xs text-slate-500">Somente leitura · seus contratos</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-borda bg-superficie/90 px-6 backdrop-blur">
          <p className="text-sm text-texto-suave">{org?.nome ?? "Empresa"}</p>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium">{nome}</p>
              <p className="text-xs text-texto-suave">{papeis[sessao.papel] ?? sessao.papel}</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primario-suave text-sm font-semibold text-primario-escuro" aria-hidden>
              {nome.charAt(0).toUpperCase()}
            </div>
            <form action={sair}><button className="rounded-lg border border-borda-forte px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">Sair</button></form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
