// Regras puras de negócio do funil de execução orçamentária (Empenho -> Liquidação -> Pagamento).
// Sem dependência de framework: apenas TypeScript puro e Node.js.

export const TIPOS_EXECUCAO = ["empenho", "liquidacao", "pagamento"] as const;
export type TipoExecucao = (typeof TIPOS_EXECUCAO)[number];

export const SITUACOES_EXECUCAO = [
  "pendente",
  "confirmado",
  "cancelado",
] as const;
export type SituacaoExecucao = (typeof SITUACOES_EXECUCAO)[number];

export interface EntradaExecucao {
  tipo: TipoExecucao;
  valor: number; // centavos
  data: string; // YYYY-MM-DD
  numeroDocumento?: string | undefined;
  observacao?: string | undefined;
  // Para liquidacao e pagamento: medição aprovada que fundamenta o lançamento
  medicaoId?: string | undefined;
  valorLiquidoMedicao?: number | undefined; // centavos da medição aprovada
  // Para pagamento: confirma que existe liquidação prévia confirmada
  liquidacaoConfirmada?: boolean | undefined;
}

export interface SaidaExecucao {
  tipo: TipoExecucao;
  valor: number; // centavos
  situacao: SituacaoExecucao;
  observacoes: string[];
}

function ehTipoExecucao(t: unknown): t is TipoExecucao {
  return typeof t === "string" && TIPOS_EXECUCAO.includes(t as TipoExecucao);
}

/**
 * Valida uma entrada de execução e retorna o resultado com observações.
 * Regras determinísticas:
 *  - Empenho: valor > 0 e <= valor global do contrato menos empenhos confirmados.
 *  - Liquidação: exige medicao aprovada; valor <= valor liquido da medição.
 *  - Pagamento: exige liquidação prévia confirmada; valor > 0.
 */
export function validarExecucao(
  entrada: EntradaExecucao,
  contexto: {
    valorGlobalContratoCentavos: number;
    empenhoConfirmadoCentavos: number;
  }
): SaidaExecucao {
  const observacoes: string[] = [];
  let situacao: SituacaoExecucao = "pendente";

  const { tipo, valor } = entrada;

  if (!ehTipoExecucao(tipo)) {
    throw new Error("tipo de execução inválido");
  }
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error("valor deve ser inteiro não negativo (centavos)");
  }

  switch (tipo) {
    case "empenho": {
      if (valor === 0) {
        throw new Error("empenho deve ter valor maior que zero");
      }
      const disponivel =
        contexto.valorGlobalContratoCentavos - contexto.empenhoConfirmadoCentavos;
      if (valor > disponivel) {
        throw new Error(
          `empenho de ${valor} excede o disponível de ${disponivel} no contrato`
        );
      }
      observacoes.push(`Empenho de ${valor} centavos reservado no contrato.`);
      break;
    }
    case "liquidacao": {
      if (!entrada.medicaoId) {
        throw new Error("liquidação requer uma medição vinculada");
      }
      if (!entrada.valorLiquidoMedicao) {
        throw new Error("liquidação requer o valor líquido da medição aprovada");
      }
      if (valor === 0) {
        throw new Error("liquidação deve ter valor maior que zero");
      }
      if (valor > entrada.valorLiquidoMedicao) {
        throw new Error(
          `liquidação de ${valor} excede o valor líquido da medição de ${entrada.valorLiquidoMedicao}`
        );
      }
      observacoes.push(
        `Liquidação de ${valor} centavos apurada sobre medição ${entrada.medicaoId}.`
      );
      break;
    }
    case "pagamento": {
      if (!entrada.liquidacaoConfirmada) {
        throw new Error("pagamento requer liquidação prévia confirmada");
      }
      if (valor === 0) {
        throw new Error("pagamento deve ter valor maior que zero");
      }
      observacoes.push(`Pagamento de ${valor} centavos efetivado.`);
      break;
    }
  }

  return { tipo, valor, situacao, observacoes };
}
