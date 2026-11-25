import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const LIMITE_BYTES = 15 * 1024 * 1024;
export const ACEITA = ".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg";

type Tipo = "documento" | "foto";
const formatos: Record<string, { mime: string; tipo: Tipo; assinatura: (b: Buffer) => boolean }> = {
  pdf: { mime: "application/pdf", tipo: "documento", assinatura: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  png: { mime: "image/png", tipo: "foto", assinatura: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  jpg: { mime: "image/jpeg", tipo: "foto", assinatura: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  jpeg: { mime: "image/jpeg", tipo: "foto", assinatura: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  doc: { mime: "application/msword", tipo: "documento", assinatura: (b) => b.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])) },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    tipo: "documento",
    assinatura: (b) => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  },
  txt: { mime: "text/plain; charset=utf-8", tipo: "documento", assinatura: (b) => !b.includes(0) },
};

export type Validacao = { ok: true; mime: string; tipo: Tipo } | { ok: false; erro: string };

export function validarArquivo(nome: string, bytes: Buffer): Validacao {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  const f = formatos[ext];
  if (!f) return { ok: false, erro: "Formato não permitido. Use PDF, TXT, DOC, DOCX, PNG ou JPG." };
  if (bytes.byteLength === 0) return { ok: false, erro: "Arquivo vazio." };
  if (bytes.byteLength > LIMITE_BYTES) return { ok: false, erro: "Arquivo acima do limite de 15 MB." };
  if (!f.assinatura(bytes)) return { ok: false, erro: "O conteúdo do arquivo não corresponde ao formato informado." };
  return { ok: true, mime: f.mime, tipo: f.tipo };
}

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  region: process.env.S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET ?? "fiscalize";
const chaveValida = /^[0-9a-f-]{36}\/[0-9a-f]{64}$/;

export async function gravarArquivo(organizacaoId: string, bytes: Buffer) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const chave = `${organizacaoId}/${sha256}`;
  if (!chaveValida.test(chave)) throw new Error("chave inválida");
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: chave, Body: bytes }));
  return { chave, sha256 };
}

export async function lerArquivo(chave: string) {
  if (!chaveValida.test(chave)) throw new Error("chave inválida");
  const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: chave }));
  if (!resp.Body) throw new Error("arquivo não encontrado");
  const chunks: Uint8Array[] = [];
  for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function urlTemporaria(chave: string, expiracao = 3600) {
  if (!chaveValida.test(chave)) throw new Error("chave inválida");
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: chave }), { expiresIn: expiracao });
}