import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
