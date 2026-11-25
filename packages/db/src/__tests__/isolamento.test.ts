import { describe, it, expect, afterAll } from "vitest";
import postgres from "postgres";
import { db, pool, comOrganizacao } from "../client";
import { contrato, usuario } from "../schema";

// O app conecta como fiscalize_app (sujeito ao RLS); o dono (DIRECT_DATABASE_URL) só lista os órgãos.
const sqlAdmin = postgres(process.env.DIRECT_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/contratacao_v2", { max: 1 });

afterAll(async () => {
  await pool.end();
  await sqlAdmin.end();
});

describe("isolamento multi-tenant (RLS no banco)", () => {
  it("cada órgão só enxerga as próprias linhas", { timeout: 30_000 }, async () => {
    // Consulta por órgão via WAN (Neon): o cold-start do compute pode somar vários segundos.
    const orgs = await sqlAdmin`select id from organizacao`;
    expect(orgs.length).toBeGreaterThanOrEqual(2);
    let total = 0;
    for (const o of orgs) {
      const linhas = await comOrganizacao(o.id, (tx) => tx.select().from(contrato));
      total += linhas.length;
      for (const c of linhas) expect(c.organizacaoId).toBe(o.id);
    }
    expect(total).toBeGreaterThan(0);
  });

  it("sem órgão ativo, o RLS esconde todas as linhas de tenant", async () => {
    expect((await db.select().from(usuario)).length).toBe(0);
    expect((await db.select().from(contrato)).length).toBe(0);
  });

  it("um órgão não consegue gravar no nome de outro", async () => {
    const [a, b] = await sqlAdmin`select id from organizacao order by id limit 2`;
    await expect(
      comOrganizacao(a!.id, (tx) =>
        tx.insert(contrato).values({ organizacaoId: b!.id, numero: "RLS-TESTE", objeto: "x", fornecedorNome: "x", fornecedorCnpj: "00000000000000", valorGlobal: "1", dataAssinatura: "2026-01-01", dataFim: "2026-12-31" }),
      ),
    ).rejects.toThrow();
  });
});
