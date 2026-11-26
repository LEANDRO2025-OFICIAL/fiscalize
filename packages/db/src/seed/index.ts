import "../usar-owner";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "../client";
import { registrarEvento } from "../auditoria";
import { hashSenha } from "../senha";
import { organizacao, unidade, usuario, contrato, itemContratado, designacao, obrigacao, medicao, recebimento, evidencia } from "../schema";

// Dados de demonstração (fictícios). Coordenadas são pontos aproximados em Antônio João/MS:
// o fiscal ajusta o ponto exato no mapa 3D do contrato.

// ---------- geradores de arquivos de exemplo ----------
function crc32(buf: Buffer) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(tipo: string, dados: Buffer) {
  const t = Buffer.from(tipo, "latin1");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([len, t, dados, crc]);
}
function png(cor: [number, number, number]): Buffer {
  const w = 480, h = 300;
  const linhas: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    const l = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const solo = y > h * 0.62;
      const g = 1 - y / h / 1.6;
      const [r, gg, b] = solo ? [110, 98, 84] : [Math.round(cor[0] * g), Math.round(cor[1] * g), Math.round(cor[2] * g)];
      l[1 + x * 3] = r; l[2 + x * 3] = gg; l[3 + x * 3] = b;
    }
    linhas.push(l);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(linhas))), chunk("IEND", Buffer.alloc(0))]);
}
function pdf(titulo: string, linhas: string[]): Buffer {
  const esc = (t: string) => t.replace(/[\\()]/g, "\\$&");
  const fluxo = `BT /F1 15 Tf 50 790 Td (${esc(titulo)}) Tj /F1 10.5 Tf 0 -26 Td 15 TL ${linhas.map((l) => `(${esc(l)}) Tj T*`).join(" ")} ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(fluxo, "latin1")} >>\nstream\n${fluxo}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let saida = "%PDF-1.4\n";
  const pos: number[] = [];
  objs.forEach((o, i) => { pos.push(Buffer.byteLength(saida, "latin1")); saida += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(saida, "latin1");
  saida += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${pos.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(saida, "latin1");
}
let s3Cache: Promise<import("@aws-sdk/client-s3").S3Client | null> | undefined;
function obterS3() {
  s3Cache ??= (async () => {
  if (!process.env.S3_ENDPOINT) return null;
  try {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
      },
      forcePathStyle: true,
    });
  } catch { return null; }
  })();
  return s3Cache;
}
const BUCKET = process.env.S3_BUCKET ?? "fiscalize";
const chaveValida = /^[0-9a-f-]{36}\/[0-9a-f]{64}$/;
async function gravarArquivo(organizacaoId: string, bytes: Buffer) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const chave = `${organizacaoId}/${sha256}`;
  if (!chaveValida.test(chave)) throw new Error("chave inválida");
  const s3 = await obterS3();
  if (s3) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: chave, Body: bytes }));
  } else {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "..", "web", "storage", organizacaoId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, sha256), bytes);
  }
  return { chave, sha256 };
}
async function guardar(org: string, bytes: Buffer) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const chave = `${org}/${sha256}`;
  const res = await gravarArquivo(org, bytes);
  return { chave, sha256 };
}

// ---------- catálogo ----------
type Item = [descricao: string, un: string, qtd: number, unitario: number];
interface Def {
  numero: string; objeto: string; categoria: "engenharia" | "servico" | "bens";
  fornecedor: string; cnpj: string; valor: number; assinatura: string; fim: string; situacao: "vigente" | "suspenso" | "encerrado";
  endereco?: string; lat?: number; lon?: number;
  itens: Item[];
  obrigacoes: Array<["entrega" | "servico" | "relatorio" | "pagamento", string, number]>;
  medicoes: Array<{ competencia: string; situacao: "rascunho" | "submetida" | "aprovada" | "rejeitada"; fracao: number; glosa?: [number, string] }>;
  portaria: string;
}

const CATALOGO: Def[] = [
  {
    numero: "CT-2025-001", objeto: "Pavimentação asfáltica da Av. Marechal Rondon", categoria: "engenharia",
    fornecedor: "Construtora Pantanal Obras Ltda", cnpj: "12.345.678/0001-95", valor: 500000, assinatura: "2025-01-15", fim: "2027-03-31", situacao: "vigente",
    endereco: "Av. Marechal Rondon, Centro, Antônio João - MS", lat: -22.1915, lon: -55.9521,
    itens: [["Fresagem e regularização da base", "m²", 4000, 12.5], ["CBUQ - capa asfáltica e=5cm", "m²", 10000, 31], ["Sinalização horizontal", "m", 3200, 4.7], ["Drenagem superficial (meio-fio e sarjeta)", "m", 1800, 36]],
    obrigacoes: [["relatorio", "Relatório fotográfico mensal de execução", 30], ["entrega", "Laudo de controle tecnológico do CBUQ", 45], ["servico", "Garantia da obra por 5 anos (art. 618 CC)", 1825]],
    medicoes: [{ competencia: "2026-07-01", situacao: "aprovada", fracao: 0.22 }, { competencia: "2026-08-01", situacao: "aprovada", fracao: 0.26, glosa: [3180.4, "Espessura da capa abaixo de 5 cm no trecho 3"] }, { competencia: "2026-09-01", situacao: "submetida", fracao: 0.24 }],
    portaria: "Portaria nº 101/2025",
  },
  {
    numero: "CT-2025-002", objeto: "Reforma e ampliação da Escola Municipal Nossa Senhora Aparecida", categoria: "engenharia",
    fornecedor: "Alvorada Engenharia e Construções S/A", cnpj: "23.456.789/0001-06", valor: 1250000, assinatura: "2025-03-10", fim: "2026-12-20", situacao: "vigente",
    endereco: "Rua Antônio João, 450, Centro, Antônio João - MS", lat: -22.1948, lon: -55.9468,
    itens: [["Demolição e remoção de entulho", "m³", 180, 95], ["Alvenaria e estrutura da ampliação (4 salas)", "m²", 260, 1650], ["Cobertura em telha termoacústica", "m²", 420, 230], ["Instalações elétricas e lógica", "vb", 1, 148000], ["Acessibilidade (rampas e sanitários PCD)", "vb", 1, 92000]],
    obrigacoes: [["relatorio", "Diário de obra assinado pelo responsável técnico", 7], ["entrega", "ART/RRT de execução", 15], ["entrega", "As built e habite-se ao final", 30]],
    medicoes: [{ competencia: "2026-06-01", situacao: "aprovada", fracao: 0.2 }, { competencia: "2026-07-01", situacao: "aprovada", fracao: 0.25 }, { competencia: "2026-08-01", situacao: "aprovada", fracao: 0.22, glosa: [11250, "Serviço de cobertura sem ART complementar"] }, { competencia: "2026-09-01", situacao: "rascunho", fracao: 0.18 }],
    portaria: "Portaria nº 118/2025",
  },
  {
    numero: "CT-2026-003", objeto: "Construção da Unidade Básica de Saúde do Bairro Vila Nova", categoria: "engenharia",
    fornecedor: "Horizonte Construtora Ltda", cnpj: "34.567.890/0001-17", valor: 2480000, assinatura: "2026-02-02", fim: "2027-08-02", situacao: "vigente",
    endereco: "Rua das Palmeiras, 120, Vila Nova, Antônio João - MS", lat: -22.1887, lon: -55.9433,
    itens: [["Terraplenagem e fundações", "m²", 540, 410], ["Estrutura e vedação", "m²", 540, 2150], ["Instalações hidrossanitárias e gases medicinais", "vb", 1, 310000], ["Acabamentos e pintura", "m²", 540, 780], ["Paisagismo e calçadas", "vb", 1, 96000]],
    obrigacoes: [["relatorio", "Relatório mensal de avanço físico-financeiro", 30], ["entrega", "Projeto executivo aprovado pela Vigilância Sanitária", 60]],
    medicoes: [{ competencia: "2026-08-01", situacao: "aprovada", fracao: 0.12 }, { competencia: "2026-09-01", situacao: "submetida", fracao: 0.14 }],
    portaria: "Portaria nº 007/2026",
  },
  {
    numero: "CT-2026-004", objeto: "Locação de veículos para o transporte sanitário da Secretaria de Saúde", categoria: "servico",
    fornecedor: "Rota Segura Locadora de Veículos ME", cnpj: "45.678.901/0001-28", valor: 384000, assinatura: "2026-01-12", fim: "2026-12-31", situacao: "vigente",
    itens: [["Van adaptada com motorista (mensal)", "mês", 12, 21000], ["Franquia adicional de 3.000 km/mês", "km", 36000, 0.35]],
    obrigacoes: [["relatorio", "Planilha de quilometragem por viagem", 30], ["servico", "Veículo substituto em até 24h em caso de pane", 1], ["pagamento", "Pagamento após atesto da medição", 30]],
    medicoes: [{ competencia: "2026-06-01", situacao: "aprovada", fracao: 0.083 }, { competencia: "2026-07-01", situacao: "aprovada", fracao: 0.083 }, { competencia: "2026-08-01", situacao: "rejeitada", fracao: 0.083, glosa: [4200, "Quilometragem declarada sem registro de viagem"] }, { competencia: "2026-09-01", situacao: "submetida", fracao: 0.083 }],
    portaria: "Portaria nº 012/2026",
  },
  {
    numero: "CT-2024-017", objeto: "Fornecimento de gêneros alimentícios para a merenda escolar", categoria: "bens",
    fornecedor: "Campo Verde Distribuidora de Alimentos Ltda", cnpj: "56.789.012/0001-39", valor: 612000, assinatura: "2024-11-04", fim: "2026-10-31", situacao: "encerrado",
    itens: [["Hortifrúti (entrega semanal)", "kg", 48000, 4.2], ["Proteínas congeladas", "kg", 22000, 18.5], ["Mercearia e grãos", "kg", 30000, 6.1]],
    obrigacoes: [["entrega", "Entregas conforme cronograma da nutricionista", 7], ["relatorio", "Nota fiscal com lote e validade", 7]],
    medicoes: [{ competencia: "2026-03-01", situacao: "aprovada", fracao: 0.1 }, { competencia: "2026-04-01", situacao: "aprovada", fracao: 0.1 }, { competencia: "2026-05-01", situacao: "aprovada", fracao: 0.1, glosa: [2130, "Lote de hortifrúti fora do padrão de qualidade"] }],
    portaria: "Portaria nº 088/2024",
  },
  {
    numero: "CT-2025-009", objeto: "Serviços de limpeza urbana e coleta de resíduos", categoria: "servico",
    fornecedor: "EcoLimp Serviços Ambientais Ltda", cnpj: "67.890.123/0001-40", valor: 920000, assinatura: "2025-05-05", fim: "2027-05-04", situacao: "suspenso",
    itens: [["Varrição manual de vias (mensal)", "km", 9600, 62], ["Coleta e transporte de resíduos", "t", 4800, 118]],
    obrigacoes: [["relatorio", "Relatório de pesagem no aterro", 30], ["servico", "Fornecimento de EPIs aos garis", 1]],
    medicoes: [{ competencia: "2026-05-01", situacao: "aprovada", fracao: 0.05 }, { competencia: "2026-06-01", situacao: "aprovada", fracao: 0.05 }, { competencia: "2026-07-01", situacao: "rejeitada", fracao: 0.05, glosa: [9800, "Serviço não executado em 6 dias (greve)"] }],
    portaria: "Portaria nº 063/2025",
  },
];

const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  // ---------- órgão, empresa, unidade, usuários ----------
  let [orgao] = await db.select().from(organizacao).where(eq(organizacao.tipo, "orgao")).limit(1);
  if (!orgao) [orgao] = await db.insert(organizacao).values({ nome: "Secretaria Municipal de Obras", tipo: "orgao", cnpj: "00.000.000/0001-01" }).returning();
  let [empresa] = await db.select().from(organizacao).where(eq(organizacao.tipo, "empresa")).limit(1);
  if (!empresa) [empresa] = await db.insert(organizacao).values({ nome: "Construtora Exemplo Ltda", tipo: "empresa", cnpj: "00.000.000/0002-02" }).returning();
  const org = orgao!.id;

  let [uni] = await db.select().from(unidade).where(eq(unidade.organizacaoId, org)).limit(1);
  if (!uni) [uni] = await db.insert(unidade).values({ organizacaoId: org, nome: "Departamento de Engenharia", sigla: "DEN" }).returning();

  const pessoas = [
    { email: "admin@exemplo.gov.br", nome: "Helena Ribeiro", papel: "administrador" as const, org },
    { email: "fiscal@exemplo.gov.br", nome: "Carlos Eduardo Lima", papel: "fiscal" as const, org },
    { email: "controle@exemplo.gov.br", nome: "Marina Souza", papel: "controlador" as const, org },
    { email: "leitor@exemplo.gov.br", nome: "Paulo Mendes", papel: "leitor" as const, org },
    { email: "gestor@fornecedor.com.br", nome: "Gestor Fornecedor", papel: "fornecedor" as const, org: empresa!.id },
  ];
  const ids: Record<string, string> = {};
  const senhaDemo = process.env.SENHA_DEMO ?? "Demo@2026";
  for (const p of pessoas) {
    const [ex] = await db.select().from(usuario).where(eq(usuario.email, p.email)).limit(1);
    if (ex) {
      await db.update(usuario).set({ nome: p.nome, senhaHash: hashSenha(senhaDemo) }).where(eq(usuario.id, ex.id));
      ids[p.email] = ex.id;
    } else {
      const [novo] = await db.insert(usuario).values({ organizacaoId: p.org, nome: p.nome, email: p.email, papel: p.papel, emailVerificado: true, senhaHash: hashSenha(senhaDemo) }).returning();
      ids[p.email] = novo!.id;
    }
  }
  const fiscal = ids["fiscal@exemplo.gov.br"]!;

  // ---------- contratos ----------
  for (const d of CATALOGO) {
    const campos = {
      objeto: d.objeto, categoria: d.categoria, fornecedorNome: d.fornecedor, fornecedorCnpj: d.cnpj, valorGlobal: d.valor.toFixed(2),
      dataAssinatura: d.assinatura, dataFim: d.fim, situacao: d.situacao, fiscalId: fiscal, unidadeId: uni!.id,
      enderecoObra: d.endereco ?? null, latitude: d.lat?.toFixed(6) ?? null, longitude: d.lon?.toFixed(6) ?? null,
    };
    let [c] = await db.select().from(contrato).where(and(eq(contrato.organizacaoId, org), eq(contrato.numero, d.numero))).limit(1);
    if (c) {
      await db.update(contrato).set(campos).where(eq(contrato.id, c.id));
    } else {
      [c] = await db.insert(contrato).values({ organizacaoId: org, numero: d.numero, ...campos }).returning();
      await registrarEvento({ organizacaoId: org, tipo: "criacao", entidade: "contrato", entidadeId: c!.id, atorId: ids["admin@exemplo.gov.br"] ?? null, payload: { numero: d.numero, valor: d.valor } });
    }
    const cid = c!.id;

    const [cont] = await db.select({ n: sql<number>`count(*)::int` }).from(itemContratado).where(eq(itemContratado.contratoId, cid));
    if ((cont?.n ?? 0) > 0) { console.log("já completo:", d.numero); continue; }

    await db.insert(itemContratado).values(d.itens.map(([descricao, un, qtd, unit], i) => ({
      organizacaoId: org, contratoId: cid, descricao, unidadeMedida: un, quantidadeTotal: String(qtd), valorUnitario: unit.toFixed(2),
      situacao: d.situacao === "encerrado" ? ("concluido" as const) : ("em_execucao" as const), ordem: i + 1,
    })));
    await db.insert(obrigacao).values(d.obrigacoes.map(([tipo, descricao, prazo]) => ({ organizacaoId: org, contratoId: cid, tipo, descricao, prazoDias: prazo })));

    const [des] = await db.select({ id: designacao.id }).from(designacao).where(eq(designacao.contratoId, cid)).limit(1);
    if (!des) {
      const [nova] = await db.insert(designacao).values({ organizacaoId: org, contratoId: cid, fiscalId: fiscal, portaria: d.portaria, dataInicio: d.assinatura }).returning();
      await registrarEvento({ organizacaoId: org, tipo: "designacao", entidade: "designacao", entidadeId: nova!.id, atorId: ids["admin@exemplo.gov.br"] ?? null, payload: { contrato: d.numero, portaria: d.portaria } });
    }

    // medições com memória de cálculo
    const totalItens = d.itens.reduce((s, [, , q, u]) => s + q * u, 0);
    let num = 0;
    for (const m of d.medicoes) {
      num++;
      const linhas = d.itens.map(([descricao, un, q, u]) => ({ descricao, unidade: un, quantidade: r2(q * m.fracao), unitario: u, subtotal: r2(q * m.fracao * u) }));
      const bruto = r2(linhas.reduce((s, l) => s + l.subtotal, 0));
      const glosa = m.glosa?.[0] ?? 0;
      const memoria = JSON.stringify({ metodo: "quantidade medida x valor unitario", percentualNoPeriodo: m.fracao, linhas, glosas: m.glosa ? [{ valor: glosa, motivo: m.glosa[1] }] : [], bruto, liquido: r2(bruto - glosa), baseContrato: totalItens });
      const [med] = await db.insert(medicao).values({
        organizacaoId: org, contratoId: cid, numero: num, competencia: m.competencia, situacao: m.situacao,
        valorBruto: bruto.toFixed(2), valorGlosa: glosa.toFixed(2), valorLiquido: r2(bruto - glosa).toFixed(2), memoriaCalculo: memoria,
        criadoPorId: fiscal, aprovadoPorId: m.situacao === "aprovada" ? (ids["controle@exemplo.gov.br"] ?? null) : null,
      }).returning();
      await registrarEvento({ organizacaoId: org, tipo: "medicao", entidade: "medicao", entidadeId: med!.id, atorId: fiscal, payload: { contrato: d.numero, numero: num, situacao: m.situacao, liquido: r2(bruto - glosa) } });
      if (m.situacao === "aprovada") {
        await db.insert(recebimento).values({
          organizacaoId: org, contratoId: cid, medicaoId: med!.id, data: m.competencia, situacao: m.glosa ? "divergente" : "conforme",
          parecer: m.glosa ? `Recebido com ressalva: ${m.glosa[1]}.` : "Objeto recebido conforme especificações do contrato.",
        });
      }
    }

    // evidências com arquivos reais
    const arquivos: Array<{ nome: string; mime: string; tipo: "foto" | "documento"; obs: string; bytes: Buffer }> = [
      {
        nome: `Relatorio-de-vistoria-${d.numero}.pdf`, mime: "application/pdf", tipo: "documento", obs: "Relatório de vistoria do mês de agosto",
        bytes: pdf(`Relatório de vistoria - ${d.numero}`, [d.objeto, `Fornecedor: ${d.fornecedor}`, "Fiscal: Carlos Eduardo Lima", "", "1. Execução conforme cronograma físico-financeiro.", "2. Equipe e equipamentos compatíveis com o contrato.", "3. Pendências registradas na ata de vistoria.", "", "Documento de demonstração gerado pelo seed."]),
      },
      {
        nome: `Ata-de-vistoria-${d.numero}.txt`, mime: "text/plain; charset=utf-8", tipo: "documento", obs: "Ata resumida da visita ao local",
        bytes: Buffer.from(`ATA DE VISTORIA\nContrato: ${d.numero}\nObjeto: ${d.objeto}\nFornecedor: ${d.fornecedor}\n\nConstatações:\n- Serviços em andamento conforme o plano.\n- Sem não conformidades graves.\n\n(Documento de demonstração)\n`, "utf8"),
      },
    ];
    if (d.categoria === "engenharia") {
      arquivos.push({ nome: `Foto-frente-de-servico-${d.numero}.png`, mime: "image/png", tipo: "foto", obs: "Registro fotográfico da frente de serviço", bytes: png([70, 130, 190]) });
    }
    for (const a of arquivos) {
      const { chave, sha256 } = await guardar(org, a.bytes);
      const [ev] = await db.insert(evidencia).values({
        organizacaoId: org, contratoId: cid, enviadoPorId: fiscal, tipo: a.tipo, nomeArquivo: a.nome, mime: a.mime, chaveS3: chave, sha256, tamanhoBytes: a.bytes.byteLength, observacao: a.obs,
      }).returning();
      await registrarEvento({ organizacaoId: org, tipo: "evidencia", entidade: "evidencia", entidadeId: ev!.id, atorId: fiscal, payload: { contrato: d.numero, nome: a.nome, sha256 } });
    }
    console.log("populado:", d.numero);
  }

  console.log("seed concluido");
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
