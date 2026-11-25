import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Formato: scrypt$<salt base64url>$<hash base64url>
export function hashSenha(senha: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${scryptSync(senha, salt, 64).toString("base64url")}`;
}

export function verificarSenha(senha: string, guardado: string | null | undefined): boolean {
  const [tipo, salt, hash] = (guardado ?? "").split("$");
  // Sem hash válido, ainda gasta o mesmo tempo para não revelar se o e-mail existe.
  const esperado = Buffer.from(hash ?? "", "base64url");
  const calculado = scryptSync(senha, salt ? Buffer.from(salt, "base64url") : Buffer.alloc(16), 64);
  return tipo === "scrypt" && esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}
