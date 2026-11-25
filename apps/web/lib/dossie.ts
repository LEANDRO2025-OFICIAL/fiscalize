import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { comOrganizacao } from "@contratacao/db/client";
import { contrato, designacao, evidencia, eventoAuditoria, itemContratado, medicao, obrigacao, ocorrencia, organizacao, recebimento, usuario } from "@contratacao/db/schema";
import { lerArquivo } from "@/lib/armazenamento";
import { formatarCnpj, formatarData, formatarDataHora, formatarMoeda } from "@/lib/formatar";

const MARINHO = "#0b1f3a";
const CINZA = "#5b6b82";
const LINHA = "#e3e8ef";
const SUAVE = "#e8efff";

type Doc = InstanceType<typeof PDFDocument>;
type Col = { t: string; w: number; a?: "right" };

const situacaoContrato = { vigente: "Vigente", suspenso: "Suspenso", encerrado: "Encerrado" } as const;
const situacaoMedicao = { rascunho: "Rascunho", submetida: "Submetida", aprovada: "Aprovada", rejeitada: "Rejeitada" } as const;
const situacaoReceb = { pendente: "Pendente", conforme: "Conforme", divergente: "Divergente" } as const;
const tipoObrigacao = { entrega: "Entrega", servico: "Serviço", relatorio: "Relatório", pagamento: "Pagamento" } as const;
const categoria = { engenharia: "Engenharia (obra)", servico: "Serviço", bens: "Fornecimento de bens" } as Record<string, string>;

const num = (v: number, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const tamanho = (b: number) => (b >= 1048576 ? `${num(b / 1048576, 1)} MB` : b >= 1024 ? `${num(b / 1024, 1)} KB` : `${b} B`);

interface LinhaMemoria { descricao: string; unidade: string; quantidade: number; unitario: number; subtotal: number }
interface Memoria { linhas: LinhaMemoria[]; glosas: Array<{ valor: number; motivo: string }>; bruto: number; liquido: number }
function lerMemoria(texto: string | null): Memoria | null {
  if (!texto) return null;
  try { return JSON.parse(texto) as Memoria; } catch { return null; }
}

// ---------- utilitários de layout ----------
const rodape = (d: Doc) => d.page.height - d.page.margins.bottom;
const largura = (d: Doc) => d.page.width - d.page.margins.left - d.page.margins.right;

function secao(d: Doc, n: number, titulo: string) {
  if (d.y > rodape(d) - 110) d.addPage();
  d.moveDown(0.8);
  d.font("Helvetica-Bold").fontSize(12).fillColor(MARINHO).text(`${n}. ${titulo}`, d.page.margins.left, d.y);
  const y = d.y + 2;
  d.moveTo(d.page.margins.left, y).lineTo(d.page.margins.left + largura(d), y).lineWidth(1).strokeColor(MARINHO).stroke();
  d.y = y + 8;
}

function paragrafo(d: Doc, texto: string, opc: { cor?: string; tam?: number } = {}) {
  d.font("Helvetica").fontSize(opc.tam ?? 9.5).fillColor(opc.cor ?? "#0f1b2d").text(texto, d.page.margins.left, d.y, { width: largura(d), lineGap: 2 });
  d.moveDown(0.4);
}

function tabela(d: Doc, cols: Col[], linhas: string[][], opc: { fonte?: number; semCabecalho?: boolean; negritoPrimeira?: boolean } = {}) {
  const fs = opc.fonte ?? 8.5;
  const x0 = d.page.margins.left;
  const total = cols.reduce((s, c) => s + c.w, 0);

  const cabecalho = () => {
    const y = d.y;
    d.rect(x0, y, total, 18).fill(SUAVE);
    d.font("Helvetica-Bold").fontSize(fs).fillColor(MARINHO);
    let x = x0;
    for (const c of cols) {
      d.text(c.t, x + 4, y + 5, { width: c.w - 8, align: c.a ?? "left", lineBreak: false });
      x += c.w;
    }
    d.y = y + 18;
  };

  if (!opc.semCabecalho) cabecalho();
  for (const l of linhas) {
    d.font("Helvetica").fontSize(fs);
    const h = Math.max(...l.map((c, i) => d.heightOfString(c, { width: cols[i]!.w - 8 }))) + 8;
    if (d.y + h > rodape(d)) {
      d.addPage();
      if (!opc.semCabecalho) cabecalho();
    }
    const y = d.y;
    let x = x0;
    l.forEach((c, i) => {
      const forte = opc.negritoPrimeira && i === 0;
      d.font(forte ? "Helvetica-Bold" : "Helvetica").fontSize(fs).fillColor(forte ? CINZA : "#0f1b2d");
      d.text(c, x + 4, y + 4, { width: cols[i]!.w - 8, align: cols[i]!.a ?? "left" });
      x += cols[i]!.w;
    });
    d.moveTo(x0, y + h).lineTo(x0 + total, y + h).lineWidth(0.5).strokeColor(LINHA).stroke();
    d.y = y + h;
  }
  d.x = x0;
  d.moveDown(0.5);
}

// ---------- geração ----------
export async function gerarDossie(contratoId: string, organizacaoId: string, emitidoPor: string) {
  return comOrganizacao(organizacaoId, async (db) => {
  const [c] = await db.select().from(contrato).where(and(eq(contrato.id, contratoId), eq(contrato.organizacaoId, organizacaoId)));
  if (!c) return null;

  const [org] = await db.select({ nome: organizacao.nome, cnpj: organizacao.cnpj }).from(organizacao).where(eq(organizacao.id, organizacaoId));
  const [fiscal] = c.fiscalId ? await db.select({ nome: usuario.nome, email: usuario.email }).from(usuario).where(eq(usuario.id, c.fiscalId)) : [];
  const [emissor] = await db.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, emitidoPor));
  const [desig] = await db.select().from(designacao).where(eq(designacao.contratoId, c.id)).orderBy(asc(designacao.criadoEm)).limit(1);
  const itens = await db.select().from(itemContratado).where(eq(itemContratado.contratoId, c.id)).orderBy(asc(itemContratado.ordem));
  const obrigacoes = await db.select().from(obrigacao).where(eq(obrigacao.contratoId, c.id));
  const medicoes = await db.select().from(medicao).where(eq(medicao.contratoId, c.id)).orderBy(asc(medicao.numero));
  const recebimentos = await db.select().from(recebimento).where(eq(recebimento.contratoId, c.id)).orderBy(asc(recebimento.data));
  const ocorrencias = await db.select().from(ocorrencia).where(eq(ocorrencia.contratoId, c.id)).orderBy(asc(ocorrencia.criadoEm));
  const evidencias = await db
    .select({ e: evidencia, enviadoPor: usuario.nome })
    .from(evidencia)
    .leftJoin(usuario, eq(usuario.id, evidencia.enviadoPorId))
    .where(eq(evidencia.contratoId, c.id))
    .orderBy(asc(evidencia.criadoEm));
  const eventos = await db.select().from(eventoAuditoria).where(eq(eventoAuditoria.organizacaoId, organizacaoId)).orderBy(asc(eventoAuditoria.sequencia));

  // Verificação da cadeia de hash do órgão.
  let anterior = null as string | null;
  let cadeiaOk = true;
  let falhaEm: number | null = null;
  for (const e of eventos) {
    const esperado: string = createHash("sha256").update(anterior ?? "").update(e.payload).update(String(Number(e.sequencia))).digest("hex");
    if (e.hash !== esperado || (e.hashAnterior ?? null) !== anterior) { cadeiaOk = false; falhaEm = Number(e.sequencia); break; }
    anterior = e.hash;
  }
  const idsRelacionados = new Set<string>([c.id, ...(desig ? [desig.id] : []), ...medicoes.map((m) => m.id), ...ocorrencias.map((o) => o.id), ...evidencias.map((x) => x.e.id)]);
  const eventosDoContrato = eventos.filter((e) => e.entidadeId && idsRelacionados.has(e.entidadeId));
  const ultimoHash = eventos.length ? eventos[eventos.length - 1]!.hash : "—";

  // Acumulado executado por item (medições aprovadas).
  const acumulado = new Map<string, number>();
  for (const m of medicoes.filter((x) => x.situacao === "aprovada")) {
    for (const l of lerMemoria(m.memoriaCalculo)?.linhas ?? []) acumulado.set(l.descricao, (acumulado.get(l.descricao) ?? 0) + l.quantidade);
  }
  const aprovadas = medicoes.filter((m) => m.situacao === "aprovada");
  const totalLiquido = aprovadas.reduce((s, m) => s + Number(m.valorLiquido), 0);
  const totalGlosa = aprovadas.reduce((s, m) => s + Number(m.valorGlosa), 0);
  const emitidoEm = new Date();

  const d = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 50, right: 50 },
    bufferPages: true,
    info: { Title: `Dossiê de fiscalização - ${c.numero}`, Author: org?.nome ?? "Órgão", Subject: `Contrato ${c.numero}`, Creator: "Fiscalize" },
  });
  const partes: Buffer[] = [];
  d.on("data", (p: Buffer) => partes.push(p));
  const pronto = new Promise<Buffer>((ok) => d.on("end", () => ok(Buffer.concat(partes))));
  const L = d.page.margins.left;

  // Capa / cabeçalho
  d.rect(0, 0, d.page.width, 128).fill(MARINHO);
  d.fillColor("#9db4ff").font("Helvetica-Bold").fontSize(9).text("FISCALIZE · DOSSIÊ PARA CONTROLE EXTERNO", L, 34);
  d.fillColor("#ffffff").font("Helvetica-Bold").fontSize(21).text("Dossiê de Fiscalização Contratual", L, 52);
  d.font("Helvetica").fontSize(11).fillColor("#dbe5ff").text(`Contrato ${c.numero} · ${org?.nome ?? ""}`, L, 84, { width: largura(d) });
  d.fillColor("#9db4ff").fontSize(9).text(`Emitido em ${formatarDataHora(emitidoEm)}${emissor ? ` por ${emissor.nome}` : ""}`, L, 104);
  d.y = 150;

  paragrafo(d, "Este dossiê reúne, em ordem lógica, os elementos que comprovam a fiscalização da execução do contrato: dados contratuais, execução por item, medições com memória de cálculo, recebimentos, evidências com impressão digital (SHA-256) e a trilha de auditoria encadeada. Fundamento: arts. 117 e 140 da Lei nº 14.133/2021.", { cor: CINZA, tam: 9 });

  // 1
  secao(d, 1, "Identificação do contrato");
  tabela(d, [{ t: "", w: 140 }, { t: "", w: 355 }], [
    ["Órgão contratante", `${org?.nome ?? "—"}${org?.cnpj ? ` · CNPJ ${formatarCnpj(org.cnpj)}` : ""}`],
    ["Número", c.numero],
    ["Objeto", c.objeto],
    ["Natureza", categoria[c.categoria] ?? c.categoria],
    ["Contratada", `${c.fornecedorNome} · CNPJ ${formatarCnpj(c.fornecedorCnpj)}`],
    ["Valor global", formatarMoeda(c.valorGlobal)],
    ["Vigência", `${formatarData(c.dataAssinatura)} a ${formatarData(c.dataFim)}`],
    ["Situação", situacaoContrato[c.situacao]],
    ["Fiscal designado", fiscal ? `${fiscal.nome} (${fiscal.email})` : "Não designado"],
    ["Ato de designação", desig ? `${desig.portaria}, vigente desde ${formatarData(desig.dataInicio)}` : "Não informado"],
    ...(c.enderecoObra ? [["Local da obra", `${c.enderecoObra}${c.latitude && c.longitude ? ` (${c.latitude}, ${c.longitude})` : ""}`]] : []),
  ], { semCabecalho: true, negritoPrimeira: true });

  // 2
  secao(d, 2, "Execução física e financeira");
  tabela(d, [{ t: "Indicador", w: 250 }, { t: "Valor", w: 245, a: "right" }], [
    ["Valor global do contrato", formatarMoeda(c.valorGlobal)],
    ["Medido e aprovado (líquido)", formatarMoeda(totalLiquido)],
    ["Glosas aplicadas nas medições aprovadas", formatarMoeda(totalGlosa)],
    ["Execução financeira", `${num(Number(c.valorGlobal) > 0 ? (totalLiquido / Number(c.valorGlobal)) * 100 : 0, 1)}%`],
  ]);
  tabela(
    d,
    [{ t: "Item", w: 195 }, { t: "Contratado", w: 90, a: "right" }, { t: "Executado", w: 90, a: "right" }, { t: "%", w: 40, a: "right" }, { t: "Valor unit.", w: 80, a: "right" }],
    itens.map((i) => {
      const q = Number(i.quantidadeTotal);
      const ex = acumulado.get(i.descricao) ?? 0;
      return [i.descricao, `${num(q, 0)} ${i.unidadeMedida}`, `${num(ex, 0)} ${i.unidadeMedida}`, num(q > 0 ? (ex / q) * 100 : 0, 1), formatarMoeda(i.valorUnitario)];
    }),
  );

  // 3
  secao(d, 3, "Obrigações contratuais acompanhadas");
  if (obrigacoes.length) tabela(d, [{ t: "Tipo", w: 80 }, { t: "Obrigação", w: 335 }, { t: "Prazo", w: 80, a: "right" }], obrigacoes.map((o) => [tipoObrigacao[o.tipo], o.descricao, o.prazoDias ? `${o.prazoDias} dias` : "—"]));
  else paragrafo(d, "Nenhuma obrigação cadastrada.", { cor: CINZA });

  // 4
  secao(d, 4, "Medições e memória de cálculo");
  if (medicoes.length) {
    tabela(
      d,
      [{ t: "Nº", w: 30 }, { t: "Competência", w: 75 }, { t: "Bruto", w: 95, a: "right" }, { t: "Glosa", w: 85, a: "right" }, { t: "Líquido", w: 100, a: "right" }, { t: "Situação", w: 110 }],
      medicoes.map((m) => [String(m.numero), formatarData(m.competencia), formatarMoeda(m.valorBruto), formatarMoeda(m.valorGlosa), formatarMoeda(m.valorLiquido), situacaoMedicao[m.situacao]]),
    );
    for (const m of medicoes) {
      const mem = lerMemoria(m.memoriaCalculo);
      if (!mem) continue;
      if (d.y > rodape(d) - 90) d.addPage();
      d.font("Helvetica-Bold").fontSize(9).fillColor(MARINHO).text(`Memória de cálculo — medição ${m.numero} (${formatarData(m.competencia)})`, L, d.y);
      d.moveDown(0.3);
      tabela(
        d,
        [{ t: "Item", w: 200 }, { t: "Quantidade", w: 85, a: "right" }, { t: "Unitário", w: 90, a: "right" }, { t: "Subtotal", w: 120, a: "right" }],
        [
          ...mem.linhas.map((l) => [l.descricao, `${num(l.quantidade)} ${l.unidade}`, formatarMoeda(l.unitario), formatarMoeda(l.subtotal)]),
          ...mem.glosas.map((g) => [`Glosa: ${g.motivo}`, "", "", `- ${formatarMoeda(g.valor)}`]),
          ["Valor líquido", "", "", formatarMoeda(mem.liquido)],
        ],
        { fonte: 8 },
      );
    }
  } else paragrafo(d, "Nenhuma medição registrada.", { cor: CINZA });

  // 5
  secao(d, 5, "Recebimentos");
  if (recebimentos.length) {
    const porId = new Map(medicoes.map((m) => [m.id, m.numero]));
    tabela(d, [{ t: "Data", w: 70 }, { t: "Medição", w: 60 }, { t: "Situação", w: 80 }, { t: "Parecer", w: 285 }], recebimentos.map((r) => [formatarData(r.data), r.medicaoId ? `Nº ${porId.get(r.medicaoId) ?? "—"}` : "—", situacaoReceb[r.situacao], r.parecer ?? "—"]));
  } else paragrafo(d, "Nenhum recebimento registrado.", { cor: CINZA });

  // 5b
  if (ocorrencias.length) {
    secao(d, 6, "Ocorrências de fiscalização");
    tabela(d, [{ t: "Data", w: 70 }, { t: "Tipo / gravidade", w: 100 }, { t: "Constatação", w: 225 }, { t: "Situação", w: 100 }], ocorrencias.map((o) => [formatarData(o.criadoEm), `${o.tipo.replace("_", " ")}
${o.gravidade}`, `${o.descricao}${o.latitude ? `
(${o.latitude}, ${o.longitude})` : ""}`, o.status === "aberta" ? `Aberta${o.prazo ? `
prazo ${formatarData(o.prazo)}` : ""}` : `Resolvida
${o.resolucao ?? ""}`]), { fonte: 8 });
  }

  // 6
  secao(d, 7, "Evidências anexadas");
  if (evidencias.length) {
    tabela(
      d,
      [{ t: "Arquivo", w: 170 }, { t: "Enviado em / por", w: 105 }, { t: "Tam.", w: 50, a: "right" }, { t: "SHA-256", w: 170 }],
      evidencias.map(({ e, enviadoPor }) => [`${e.nomeArquivo}${e.observacao ? `\n${e.observacao}` : ""}`, `${formatarDataHora(e.criadoEm)}\n${enviadoPor ?? "—"}`, tamanho(e.tamanhoBytes), e.sha256.replace(/(.{32})/g, "$1\n")]),
      { fonte: 7.5 },
    );

    const fotos = evidencias.filter(({ e }) => e.mime === "image/png" || e.mime === "image/jpeg");
    if (fotos.length) {
      if (d.y > rodape(d) - 190) d.addPage();
      d.font("Helvetica-Bold").fontSize(9).fillColor(MARINHO).text("Registro fotográfico", L, d.y);
      d.moveDown(0.4);
      let col = 0;
      let topo = d.y;
      for (const { e } of fotos) {
        try {
          const bytes = await lerArquivo(e.chaveS3);
          if (col === 0 && topo + 180 > rodape(d)) { d.addPage(); topo = d.y; }
          const x = L + col * 250;
          d.image(bytes, x, topo, { fit: [240, 150], align: "center" });
          d.font("Helvetica").fontSize(7.5).fillColor(CINZA).text(`${e.nomeArquivo} · ${formatarDataHora(e.criadoEm)}`, x, topo + 154, { width: 240 });
          col++;
          if (col === 2) { col = 0; topo += 180; }
        } catch {
          // arquivo indisponível no armazenamento: a evidência segue listada com o hash.
        }
      }
      d.y = col === 0 ? topo : topo + 180;
      d.x = L;
    }
  } else paragrafo(d, "Nenhuma evidência anexada.", { cor: CINZA });

  // 7
  secao(d, 8, "Trilha de auditoria");
  d.font("Helvetica-Bold").fontSize(9.5).fillColor(cadeiaOk ? "#047857" : "#b91c1c").text(
    cadeiaOk ? `Cadeia de hash íntegra: ${eventos.length} evento(s) do órgão verificados, sem alteração detectada.` : `ATENÇÃO: cadeia de hash inconsistente a partir do evento nº ${falhaEm}.`,
    L, d.y, { width: largura(d) },
  );
  d.moveDown(0.3);
  paragrafo(d, `Hash do último evento do órgão: ${ultimoHash}`, { cor: CINZA, tam: 7.5 });
  if (eventosDoContrato.length) {
    tabela(
      d,
      [{ t: "Seq.", w: 35 }, { t: "Data/hora", w: 95 }, { t: "Evento", w: 75 }, { t: "Entidade", w: 75 }, { t: "Hash (SHA-256)", w: 215 }],
      eventosDoContrato.map((e) => [String(Number(e.sequencia)), formatarDataHora(e.criadoEm), e.tipo, e.entidade, e.hash.replace(/(.{32})/g, "$1\n")]),
      { fonte: 7.5 },
    );
  }

  // Termo de encerramento
  if (d.y > rodape(d) - 150) d.addPage();
  secao(d, 9, "Declaração do fiscal");
  paragrafo(d, `Declaro que as informações deste dossiê correspondem aos registros da fiscalização do contrato ${c.numero}, e que as evidências listadas foram anexadas na data e com a impressão digital indicadas.`);
  d.moveDown(2.2);
  const yAss = d.y;
  d.moveTo(L, yAss).lineTo(L + 230, yAss).lineWidth(0.7).strokeColor("#0f1b2d").stroke();
  d.moveTo(L + 265, yAss).lineTo(L + 495, yAss).stroke();
  d.font("Helvetica").fontSize(8.5).fillColor("#0f1b2d")
    .text(fiscal?.nome ?? "Fiscal do contrato", L, yAss + 4, { width: 230 })
    .text("Fiscal do contrato", L, yAss + 15, { width: 230 });
  d.text("Gestor / autoridade competente", L + 265, yAss + 4, { width: 230 });

  // Rodapé em todas as páginas
  const faixa = d.bufferedPageRange();
  for (let i = 0; i < faixa.count; i++) {
    d.switchToPage(faixa.start + i);
    const margem = d.page.margins.bottom;
    d.page.margins.bottom = 0;
    d.moveTo(L, d.page.height - 44).lineTo(L + largura(d), d.page.height - 44).lineWidth(0.5).strokeColor(LINHA).stroke();
    d.font("Helvetica").fontSize(7.5).fillColor(CINZA)
      .text(`Dossiê ${c.numero} · ${org?.nome ?? ""} · emitido em ${formatarDataHora(emitidoEm)}`, L, d.page.height - 36, { width: 400, lineBreak: false })
      .text(`Página ${i + 1} de ${faixa.count}`, L + largura(d) - 90, d.page.height - 36, { width: 90, align: "right", lineBreak: false });
    d.page.margins.bottom = margem;
  }

  d.end();
  const pdf = await pronto;
  return { pdf, nome: `Dossie-${c.numero}.pdf`, eventosVerificados: eventos.length, cadeiaOk };
  });
}
