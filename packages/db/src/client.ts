import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

export const pool = postgres(process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/contratacao", { max: 10, prepare: false });
export const db = drizzle(pool, { schema });
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Toda consulta de tenant roda aqui: a transação declara o órgão e as policies de RLS filtram no banco.
export async function comOrganizacao<T>(organizacaoId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.organizacao_id', ${organizacaoId}, true)`);
    return fn(tx);
  });
}
