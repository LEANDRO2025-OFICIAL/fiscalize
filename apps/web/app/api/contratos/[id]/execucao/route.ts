import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import {
  contrato,
  execucao,
  execucaoSituacaoEnum,
  execucaoTipoEnum,
  medicao,
  usuario,
} from "@contratacao/db/schema";
import { registrarEvento } from "@contratacao/db/auditoria";
import { getSessao } from "@/lib/sessao";
import { validarExecucao } from "@contratacao/domain";

const PODE_GERIR = ["administrador", "controlador", "fiscal"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: contratoId } = await params;
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;
    const [c] = await db
      .select({ id: contrato.id, valorGlobal: contrato.valorGlobal })
      .from(contrato)
      .where(and(eq(contrato.id, contratoId), eq(contrato.organizacaoId, org)));
    if (!c) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

    const lancamentos = await db
      .select({
        id: execucao.id,
        tipo: execucao.tipo,
        valor: execucao.valor,
        numeroDocumento: execucao.numeroDocumento,
        data: execucao.data,
        situacao: execucao.situacao,
        observacao: execucao.observacao,
        medicaoId: execucao.medicaoId,
        criadoPorId: execucao.criadoPorId,
        criadoEm: execucao.criadoEm,
        nomeMedicao: medicao.numero,
      })
      .from(execucao)
      .leftJoin(medicao, eq(medicao.id, execucao.medicaoId))
      .where(
        and(eq(execucao.contratoId, contratoId), eq(execucao.organizacaoId, org))
      )
      .orderBy(execucao.data);

    const empenhoConfirmado = lancamentos
      .filter((l) => l.tipo === "empenho" && l.situacao === "confirmado")
      .reduce((s, l) => s + Number(l.valor), 0);

    return NextResponse.json({
      contrato: { id: c.id, valorGlobal: Number(c.valorGlobal) },
      empenhoConfirmadoCentavos: Math.round(empenhoConfirmado * 100),
      lancamentos,
    });
  });
}

export async function POST(request: Request, { params }: Params) {
  const { id: contratoId } = await params;
  const sessao = await getSessao();
  if (!PODE_GERIR.includes(sessao.papel)) {
    return NextResponse.json({ erro: "Sem permissão para lançar execução." }, { status: 403 });
  }

  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const txt = (k: string, max: number) => String(b?.[k] ?? "").trim().slice(0, max);
  const tipoBruto = txt("tipo", 20);
  let tipo: "empenho" | "liquidacao" | "pagamento";
  if (!(execucaoTipoEnum.enumValues as readonly string[]).includes(tipoBruto)) {
    return NextResponse.json({ erro: "Tipo de execução inválido." }, { status: 422 });
  }
  tipo = tipoBruto as "empenho" | "liquidacao" | "pagamento";
  const valor = Number(b?.valor ?? 0);
  const data = txt("data", 10);
  const numeroDocumento = txt("numeroDocumento", 60) || null;
  const observacao = txt("observacao", 1000) || null;
  const medicaoId = b?.medicaoId ? String(b.medicaoId) : null;

  if (!(execucaoTipoEnum.enumValues as readonly string[]).includes(tipo)) {
    return NextResponse.json({ erro: "Tipo de execução inválido." }, { status: 422 });
  }
  if (!Number.isInteger(Math.round(valor * 100)) || valor <= 0) {
    return NextResponse.json({ erro: "Informe um valor válido (maior que zero)." }, { status: 422 });
  }
  if (!DATA.test(data)) {
    return NextResponse.json({ erro: "Data inválida (use AAAA-MM-DD)." }, { status: 422 });
  }

  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;
    const [c] = await db
      .select()
      .from(contrato)
      .where(and(eq(contrato.id, contratoId), eq(contrato.organizacaoId, org)));
    if (!c) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

    const valorCentavos = Math.round(valor * 100);
    const valorGlobalCentavos = Math.round(Number(c.valorGlobal) * 100);

    const lancamentos = await db
      .select({ tipo: execucao.tipo, valor: execucao.valor, situacao: execucao.situacao })
      .from(execucao)
      .where(
        and(
          eq(execucao.contratoId, contratoId),
          eq(execucao.organizacaoId, org)
        )
      );
    const empenhoConfirmado = lancamentos
      .filter((l) => l.tipo === "empenho" && l.situacao === "confirmado")
      .reduce((s, l) => s + Number(l.valor), 0);

    let valorLiquidoMedicao: number | undefined;
    let liquidaçãoConfirmada = false;
    if (medicaoId) {
      const [m] = await db
        .select({ valorLiquido: medicao.valorLiquido, situacao: medicao.situacao })
        .from(medicao)
        .where(
          and(
            eq(medicao.id, medicaoId),
            eq(medicao.contratoId, contratoId),
            eq(medicao.organizacaoId, org)
          )
        );
      if (!m) return NextResponse.json({ erro: "Medição não encontrada." }, { status: 404 });
      if (m.situacao !== "aprovada") {
        return NextResponse.json(
          { erro: "A medição precisa estar aprovada para liquidar ou pagar." },
          { status: 422 }
        );
      }
      valorLiquidoMedicao = Math.round(Number(m.valorLiquido) * 100);
    }

    // Regra de pagamento: exige liquidação prévia confirmada deste contrato
    let liquidacaoConfirmada = false;
    if (tipo === "pagamento") {
      const temLiquidacao = lancamentos.some(
        (l) => l.tipo === "liquidacao" && l.situacao === "confirmado"
      );
      if (!temLiquidacao) {
        return NextResponse.json(
          { erro: "O pagamento requer uma liquidação prévia confirmada." },
          { status: 422 }
        );
      }
      liquidacaoConfirmada = true;
    }

    const resultado = validarExecucao(
      {
        tipo: tipo as "empenho" | "liquidacao" | "pagamento",
        valor: valorCentavos,
        data,
        numeroDocumento: numeroDocumento ?? undefined,
        observacao: observacao ?? undefined,
        medicaoId: medicaoId ?? undefined,
        valorLiquidoMedicao,
        liquidacaoConfirmada,
      },
      {
        valorGlobalContratoCentavos: valorGlobalCentavos,
        empenhoConfirmadoCentavos: empenhoConfirmado,
      }
    );

    const valoresInsert: Record<string, unknown> = {
      organizacaoId: org,
      contratoId,
      tipo,
      valor: valor.toFixed(2),
      data,
      situacao: "pendente",
      criadoPorId: sessao.usuarioId,
    };
    if (numeroDocumento) valoresInsert.numero_documento = numeroDocumento;
    if (observacao) valoresInsert.observacao = observacao;
    if (medicaoId) valoresInsert.medicao_id = medicaoId;

    const [novo] = await db.insert(execucao).values(valoresInsert as never).returning({ id: execucao.id });

    await registrarEvento({
      organizacaoId: org,
      tipo: "criacao",
      entidade: "execucao",
      entidadeId: novo!.id,
      atorId: sessao.usuarioId,
      payload: { contratoId, tipo, valor, data, situacao: "pendente" },
    });

    return NextResponse.json(
      { id: novo!.id, situacao: "pendente", observacoes: resultado.observacoes },
      { status: 201 }
    );
  });
}
