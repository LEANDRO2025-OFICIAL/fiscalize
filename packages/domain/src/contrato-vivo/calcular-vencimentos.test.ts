import { describe, it, expect } from "vitest";
import { calcularVencimentos } from "./calcular-vencimentos";

describe("calcularVencimentos", () => {
  const base = {
    hoje: "2026-11-04",
    diasJanela: 90,
    obrigacoes: [
      { id: "o1", contratoId: "c1", contratoNumero: "CT-1", tipo: "entrega", obrigacaoTipo: "entrega", prazoDias: null, dataLimite: "2026-10-20", criadoEm: "2026-09-01T00:00:00.000Z" },
      { id: "o2", contratoId: "c1", contratoNumero: "CT-1", tipo: "relatorio", obrigacaoTipo: "relatorio", prazoDias: 30, dataLimite: null, criadoEm: "2026-10-10T00:00:00.000Z" },
      { id: "o3", contratoId: "c2", contratoNumero: "CT-2", tipo: "pagamento", obrigacaoTipo: "pagamento", prazoDias: null, dataLimite: null, criadoEm: "2026-10-01T00:00:00.000Z" },
      { id: "o4", contratoId: "c2", contratoNumero: "CT-2", tipo: "servico", obrigacaoTipo: "servico", prazoDias: 120, dataLimite: null, criadoEm: "2026-08-01T00:00:00.000Z" },
    ],
    contratos: [
      { id: "c1", numero: "CT-1", objeto: "Obra A", situacao: "vigente", dataAssinatura: "2026-01-01", fiscalId: "f1", designadoEm: "2026-01-02" },
      { id: "c2", numero: "CT-2", objeto: "Obra B", situacao: "vigente", dataAssinatura: "2026-03-01", fiscalId: null, designadoEm: null },
      { id: "c3", numero: "CT-3", objeto: "Obra C", situacao: "encerrado", dataAssinatura: "2024-01-01", fiscalId: null, designadoEm: null },
    ],
  };

  it("classifica vencidos por dataLimite", () => {
    const r = calcularVencimentos(base);
    expect(r.vencidos.map((v) => v.obrigacaoId)).toEqual(["o1"]);
    expect(r.vencidos[0]?.diasRestantes).toBeLessThan(0);
  });

  it("classifica a vencer por prazoDias", () => {
    const r = calcularVencimentos(base);
    // o2: criado 2026-10-10 + 30 dias = 2026-11-09 (5 dias à frente);
    // o4: criado 2026-08-01 + 120 dias = 2026-11-29 (25 dias à frente).
    // Antes da correção do cálculo, o4 caía fora por data inválida (NaN).
    expect(r.aVencer.map((v) => v.obrigacaoId)).toEqual(["o2", "o4"]);
    expect(r.aVencer.find((v) => v.obrigacaoId === "o2")?.diasRestantes).toBe(5);
    expect(r.aVencer.find((v) => v.obrigacaoId === "o4")?.diasRestantes).toBe(25);
  });

  it("deriva a data limite de prazoDias quando não há data explícita", () => {
    const r = calcularVencimentos(base);
    expect(r.aVencer.find((v) => v.obrigacaoId === "o2")?.dataLimite).toBe("2026-11-09");
    expect(r.aVencer.find((v) => v.obrigacaoId === "o4")?.dataLimite).toBe("2026-11-29");
    expect(r.vencidos.find((v) => v.obrigacaoId === "o1")?.dataLimite).toBe("2026-10-20");
  });

  it("ignora obrigacoes sem prazo", () => {
    const r = calcularVencimentos(base);
    expect(r.vencidos.some((v) => v.obrigacaoId === "o3")).toBe(false);
    expect(r.aVencer.some((v) => v.obrigacaoId === "o3")).toBe(false);
  });

  it("lista contratos sem fiscal designado (apenas vigentes)", () => {
    const r = calcularVencimentos(base);
    expect(r.semFiscal.map((c) => c.contratoId)).toEqual(["c2"]);
    expect(r.semFiscal[0]?.diasSemDesignacao).toBe(248);
  });

  it("ignora contratos nao vigentes", () => {
    const r = calcularVencimentos(base);
    expect(r.semFiscal.some((c) => c.contratoId === "c3")).toBe(false);
  });
});