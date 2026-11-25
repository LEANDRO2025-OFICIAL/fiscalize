import { eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { organizacao, usuario } from "@contratacao/db/schema";
import { redirect } from "next/navigation";
import { encerrarSessao, getSessao } from "@/lib/sessao";
import { Navegacao } from "@/components/navegacao";

const papeis: Record<string, string> = {
  administrador: "Administrador",
  controlador: "Controlador interno",
  fiscal: "Fiscal de contrato",
  fornecedor: "Fornecedor",
  leitor: "Leitor",
};

export default async function LayoutOrgao({ children }: { children: React.ReactNode }) {
  const sessao = await getSessao();
  const [org, usr] = await comOrganizacao(sessao.organizacaoId, async (db) => [
    (await db.select({ nome: organizacao.nome }).from(organizacao).where(eq(organizacao.id, sessao.organizacaoId)).limit(1))[0],
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
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primario text-sm font-bold">F</div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Fiscalize</p>
            <p className="text-xs text-slate-400">Gestão e fiscalização</p>
          </div>
        </div>
        <Navegacao />
        <div className="mt-auto border-t border-white/10 px-6 pt-4 text-xs text-slate-400">
          <p className="font-medium text-slate-200">{org?.nome ?? "Órgão"}</p>
          <p>Ambiente protegido · trilha SHA-256</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-borda bg-superficie/90 px-6 backdrop-blur">
          <p className="text-sm text-texto-suave">{org?.nome ?? "Órgão"}</p>
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
