import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { verificarSenha } from "@contratacao/db/senha";
import { criarSessao } from "@/lib/sessao";

// Contagem de tentativas por e-mail (em memória: suficiente para uma instância; use Redis ao escalar).
const tentativas = new Map<string, { falhas: number; proximo: number; ate: number }>();
const JANELA_MS = 15 * 60 * 1000;

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;

  async function autenticar(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const senha = String(formData.get("senha") ?? "");
    // Reserva atômica por e-mail (check + set sem await entre eles): tentativas que chegam antes de `proximo`
    // são recusadas sem checar a senha, então requisições paralelas não multiplicam os palpites. A janela cresce
    // até 30 s e não é estendida por quem bate nela; o dono da conta nunca fica travado por mais que isso.
    const chave = email;
    const agora = Date.now();
    if (tentativas.size > 5000) for (const [k, v] of tentativas) if (v.ate < agora) tentativas.delete(k);
    const t = tentativas.get(chave);
    const falhas = t && t.ate > agora ? t.falhas : 0;
    if (t && agora < t.proximo) redirect("/login?erro=aguarde");
    tentativas.set(chave, { falhas, proximo: agora + 1000, ate: agora + JANELA_MS });

    // Antes do login não há órgão: a busca passa pela função buscar_login (SECURITY DEFINER), que só devolve o necessário.
    const [u] = email ? ((await db.execute(sql`SELECT id, organizacao_id, senha_hash FROM buscar_login(${email})`)) as unknown as Array<{ id: string; organizacao_id: string; senha_hash: string }>) : [];
    const ok = verificarSenha(senha, u?.senha_hash) && !!u;
    if (!ok) {
      // Relê a entrada atual: tentativas sobrepostas não perdem incrementos.
      const f = Math.max(falhas, tentativas.get(chave)?.falhas ?? 0) + 1;
      tentativas.set(chave, { falhas: f, proximo: Date.now() + (f > 3 ? Math.min(2000 * 2 ** (f - 4), 30000) : 1000), ate: Date.now() + JANELA_MS });
      redirect("/login?erro=1");
    }
    tentativas.delete(chave);
    await criarSessao(u!.id, u!.organizacao_id);
    await registrarEvento({ organizacaoId: u!.organizacao_id, tipo: "login", entidade: "usuario", entidadeId: u!.id, atorId: u!.id, payload: { email } });
    redirect("/inicio");
  }

  const mensagem = erro === "aguarde" ? "Muitas tentativas seguidas. Aguarde alguns segundos e tente de novo." : erro ? "E-mail ou senha incorretos." : null;
  const campo = "mt-1.5 w-full rounded-lg border border-borda-forte bg-white px-3.5 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/25";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-marinho p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primario font-bold">F</div>
          <span className="text-lg font-semibold">Fiscalize</span>
        </div>
        <div>
          <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">Fiscalização de contratos com prova que se sustenta no Tribunal de Contas.</h1>
          <ul className="mt-8 space-y-3 text-slate-300">
            <li className="flex gap-3"><span className="text-primario" aria-hidden>●</span>Evidências com hash SHA-256 e geolocalização</li>
            <li className="flex gap-3"><span className="text-primario" aria-hidden>●</span>Memória de cálculo auditável em cada medição</li>
            <li className="flex gap-3"><span className="text-primario" aria-hidden>●</span>Trilha encadeada: toda alteração é detectável</li>
          </ul>
        </div>
        <p className="text-xs text-slate-400">Lei 14.133/2021 · LGPD · ambiente com isolamento por órgão</p>
      </section>

      <section className="flex items-center justify-center bg-fundo p-8">
        <form action={autenticar} className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
          <p className="mt-1 text-sm text-texto-suave">Acesse com o e-mail institucional e a senha.</p>
          {mensagem && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-erro-suave px-3 py-2 text-sm text-erro">{mensagem}</p>}
          <label htmlFor="email" className="mt-6 block text-sm font-medium">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="username" placeholder="fiscal@exemplo.gov.br" className={campo} />
          <label htmlFor="senha" className="mt-4 block text-sm font-medium">Senha</label>
          <input id="senha" name="senha" type="password" required autoComplete="current-password" className={campo} />
          <button type="submit" className="mt-5 w-full rounded-lg bg-primario px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primario-escuro">Entrar</button>
          {process.env.NODE_ENV !== "production" && <p className="mt-6 text-center text-xs text-texto-suave">Demonstração: fiscal@exemplo.gov.br · Demo@2026</p>}
        </form>
      </section>
    </main>
  );
}
