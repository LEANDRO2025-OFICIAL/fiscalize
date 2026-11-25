import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// O Next só lê .env de apps/web; as variáveis do monorepo ficam na raiz.
const envRaiz = resolve(process.cwd(), "../../.env");
if (existsSync(envRaiz)) process.loadEnvFile(envRaiz);

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  transpilePackages: ["@contratacao/db", "@contratacao/domain", "@contratacao/audit"],
};

export default nextConfig;
