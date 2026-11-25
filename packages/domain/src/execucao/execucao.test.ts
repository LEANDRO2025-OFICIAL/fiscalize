import { describe, it, expect } from "vitest";
import { validarExecucao, TipoExecucao } from "./execucao";

const contexto = {
  valorGlobalContratoCentavos: 48000000, // R$ 480.000,00
  empenhoConfirmadoCentavos: 0,
};

describe("validarExecucao", () => {
  it("empenho dentro do disponível é aceito", () => {
    const r = validarExecucao(
      {
        tipo: "empenho" as TipoExecucao,
        valor: 10000000, // R$ 100.000,00
        data: "2026-01-15",
      },
      contexto
    );
    expect(r.tipo).toBe("empenho");
    expect(r.valor).toBe(10000000);
    expect(r.situacao).toBe("pendente");
    expect(r.observacoes[0]).toContain("10000000 centavos");
  });

  it("empenho que excede o disponível lança erro", () => {
    expect(() =>
      validarExecucao(
        {
          tipo: "empenho" as TipoExecucao,
          valor: 50000000, // R$ 500.000,00 > R$ 480.000,00
          data: "2026-01-15",
        },
        contexto
      )
    ).toThrow("excede o disponível");
  });

  it("empenho com valor zero lança erro", () => {
    expect(() =>
      validarExecucao(
        {
          tipo: "empenho" as TipoExecucao,
          valor: 0,
          data: "2026-01-15",
        },
        contexto
      )
    ).toThrow("maior que zero");
  });

  it("liquidação requer medição vinculada", () => {
    expect(() =>
      validarExecucao(
        {
          tipo: "liquidacao" as TipoExecucao,
          valor: 5000000,
          data: "2026-02-01",
        },
        contexto
      )
    ).toThrow("requer uma medição vinculada");
  });

  it("liquidação acima do valor líquido da medição lança erro", () => {
    expect(() =>
      validarExecucao(
        {
          tipo: "liquidacao" as TipoExecucao,
          valor: 9000000,
          data: "2026-02-01",
          medicaoId: "med-1",
          valorLiquidoMedicao: 5000000,
        },
        contexto
      )
    ).toThrow("excede o valor líquido da medição");
  });

  it("liquidação dentro do valor líquido da medição é aceita", () => {
    const r = validarExecucao(
      {
        tipo: "liquidacao" as TipoExecucao,
        valor: 4000000,
        data: "2026-02-01",
        medicaoId: "med-1",
        valorLiquidoMedicao: 5000000,
      },
      contexto
    );
    expect(r.tipo).toBe("liquidacao");
    expect(r.valor).toBe(4000000);
    expect(r.observacoes[0]).toContain("med-1");
  });

  it("pagamento requer liquidação confirmada", () => {
    expect(() =>
      validarExecucao(
        {
          tipo: "pagamento" as TipoExecucao,
          valor: 4000000,
          data: "2026-03-01",
        },
        contexto
      )
    ).toThrow("requer liquidação prévia confirmada");
  });

  it("pagamento com liquidação confirmada é aceito", () => {
    const r = validarExecucao(
      {
        tipo: "pagamento" as TipoExecucao,
        valor: 4000000,
        data: "2026-03-01",
        liquidacaoConfirmada: true,
      },
      contexto
    );
    expect(r.tipo).toBe("pagamento");
    expect(r.valor).toBe(4000000);
    expect(r.situacao).toBe("pendente");
  });
});
