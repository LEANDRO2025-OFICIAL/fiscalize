import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { registrarEvento } from "@contratacao/db/auditoria";
import { medicao, recebimento } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { lerMemoria } from "@/lib/medicao";

const GESTAO = ["administrador", "controlador"];
const OPERA = ["administrador", "controlador", "fiscal"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
  const org = sessao.organizacaoId;
  const b = (await request.json().catch(() => null)) as { acao?: string; motivo?: string; situacao?: string; parecer?: string } | null;
  const [m] = await db.select().from(medicao).where(and(eq(medicao.id, id), eq(medicao.organizacaoId, org)));
  if (!m) return NextResponse.json({ erro: "Medição não encontrada." }, { status: 404 });

  const evento = (payload: Record<string, unknown>) => registrarEvento({ organizacaoId: org, tipo: "medicao", entidade: "medicao", entidadeId: id, atorId: sessao.usuarioId, payload: { numero: m.numero, ...payload } });
  const erro = (t: string, s = 409) => NextResponse.json({ erro: t }, { status: s });

  switch (b?.acao) {
    case "submeter": {
      if (!OPERA.includes(sessao.papel)) return erro("Sem permissão.", 403);
      if (m.situacao !== "rascunho") return erro("Só rascunhos podem ser submetidos.");
      const [ok] = await db.update(medicao).set({ situacao: "submetida" }).where(and(eq(medicao.id, id), eq(medicao.situacao, "rascunho"))).returning({ id: medicao.id });
      if (!ok) return erro("A medição mudou de situação. Atualize a página.");
      await evento({ situacao: "submetida" });
      return NextResponse.json({ ok: true });
    }
    case "aprovar":
    case "rejeitar": {
      if (!GESTAO.includes(sessao.papel)) return erro("Só administrador ou controlador decide a medição.", 403);
      if (m.situacao !== "submetida") return erro("A medição precisa estar submetida.");
      if (m.criadoPorId === sessao.usuarioId) return erro("Segregação de funções: quem registrou a medição não pode decidi-la.");
      if (b.acao === "aprovar") {
        const aprovou = await db.transaction(async (tx) => {
          const [ok] = await tx.update(medicao).set({ situacao: "aprovada", aprovadoPorId: sessao.usuarioId }).where(and(eq(medicao.id, id), eq(medicao.situacao, "submetida"))).returning({ id: medicao.id });
          if (!ok) return false;
          await tx.insert(recebimento).values({ organizacaoId: org, contratoId: m.contratoId, medicaoId: id, data: new Date().toISOString().slice(0, 10), situacao: "pendente" });
          return true;
        });
        if (!aprovou) return erro("A medição mudou de situação. Atualize a página.");
        await evento({ situacao: "aprovada", liquido: Number(m.valorLiquido) });
      } else {
        const motivo = String(b.motivo ?? "").trim().slice(0, 500);
        if (!motivo) return erro("Informe o motivo da rejeição.", 422);
        const mem = lerMemoria(m.memoriaCalculo);
        const [ok] = await db.update(medicao).set({ situacao: "rejeitada", memoriaCalculo: JSON.stringify({ ...mem, rejeicao: { motivo, por: sessao.usuarioId } }) }).where(and(eq(medicao.id, id), eq(medicao.situacao, "submetida"))).returning({ id: medicao.id });
        if (!ok) return erro("A medição mudou de situação. Atualize a página.");
        await evento({ situacao: "rejeitada", motivo });
      }
      return NextResponse.json({ ok: true });
    }
    case "receber": {
      if (!OPERA.includes(sessao.papel)) return erro("Sem permissão.", 403);
      if (m.situacao !== "aprovada") return erro("Só medições aprovadas são recebidas.");
      const parecer = String(b.parecer ?? "").trim().slice(0, 1000);
      if (!["conforme", "divergente"].includes(b.situacao ?? "")) return erro("Situação inválida.", 422);
      if (b.situacao === "divergente" && !parecer) return erro("Registre o parecer da divergência.", 422);
      const [r] = await db.select({ id: recebimento.id, situacao: recebimento.situacao }).from(recebimento).where(and(eq(recebimento.medicaoId, id), eq(recebimento.organizacaoId, org)));
      if (!r) return erro("Recebimento não encontrado.", 404);
      if (r.situacao !== "pendente") return erro("O recebimento já foi registrado.");
      await db.update(recebimento).set({ situacao: b.situacao as "conforme" | "divergente", parecer: parecer || "Objeto recebido conforme especificações do contrato.", data: new Date().toISOString().slice(0, 10) }).where(and(eq(recebimento.id, r.id), eq(recebimento.situacao, "pendente"))).returning({ id: recebimento.id }).then((x) => { if (!x.length) throw new Error("conflito"); });
      await evento({ recebimento: b.situacao });
      return NextResponse.json({ ok: true });
    }
    default:
      return erro("Ação inválida.", 422);
  }
  });
}
