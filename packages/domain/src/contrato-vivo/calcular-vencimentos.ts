export interface ObrigacaoVencimento {
  obrigacaoId: string;
  contratoId: string;
  contratoNumero: string;
  tipo: string;
  obrigacaoTipo: string;
  prazoDias: number | null;
  dataLimite: string | null;
  diasRestantes: number;
  status: "vencido" | "em_dias" | "a_vencer" | "sem_prazo";
}

export interface ContratoSemFiscal {
  contratoId: string;
  numero: string;
  objeto: string;
  situacao: string;
  diasSemDesignacao: number;
}

export interface EntradaVencimentos {
  hoje: string;
  diasJanela: number;
  obrigacoes: Array<{
    id: string;
    contratoId: string;
    contratoNumero: string;
    tipo: string;
    obrigacaoTipo: string;
    prazoDias: number | null;
    dataLimite: string | null;
    criadoEm: string;
  }>;
  contratos: Array<{
    id: string;
    numero: string;
    objeto: string;
    situacao: string;
    dataAssinatura: string;
    fiscalId: string | null;
    designadoEm: string | null;
  }>;
}

function dataUTC(s: string): number {
  // aceita "AAAA-MM-DD" (coluna date) e ISO completo com hora (toISOString do banco)
  const soData = s.slice(0, 10);
  return new Date(`${soData}T00:00:00Z`).getTime();
}

function diasEntre(a: string, b: string): number {
  return Math.round((dataUTC(b) - dataUTC(a)) / 86400000);
}

export function calcularVencimentos(entrada: EntradaVencimentos): {
  vencidos: ObrigacaoVencimento[];
  aVencer: ObrigacaoVencimento[];
  semFiscal: ContratoSemFiscal[];
} {
  const vencidos: ObrigacaoVencimento[] = [];
  const aVencer: ObrigacaoVencimento[] = [];

  for (const o of entrada.obrigacoes) {
    let diasRestantes: number;
    let status: ObrigacaoVencimento["status"];
    let dataLimite = o.dataLimite ? o.dataLimite.slice(0, 10) : null;
    if (o.dataLimite) {
      diasRestantes = diasEntre( entrada.hoje, o.dataLimite);
      if (diasRestantes < 0) status = "vencido";
      else if (diasRestantes <= entrada.diasJanela) status = "a_vencer";
      else status = "em_dias";
    } else if (o.prazoDias != null) {
      const fim = dataUTC(o.criadoEm) + o.prazoDias * 86400000;
      const agora = dataUTC(entrada.hoje);
      diasRestantes = Math.round((fim - agora) / 86400000);
      dataLimite = new Date(fim).toISOString().slice(0, 10);
      if (diasRestantes < 0) status = "vencido";
      else if (diasRestantes <= entrada.diasJanela) status = "a_vencer";
      else status = "em_dias";
    } else {
      diasRestantes = 0;
      status = "sem_prazo";
    }
    const item: ObrigacaoVencimento = {
      obrigacaoId: o.id, contratoId: o.contratoId, contratoNumero: o.contratoNumero,
      tipo: o.tipo, obrigacaoTipo: o.obrigacaoTipo, prazoDias: o.prazoDias,
      dataLimite, diasRestantes, status
    };
    if (status === "vencido") vencidos.push(item);
    else if (status === "a_vencer") aVencer.push(item);
  }

  const semFiscal: ContratoSemFiscal[] = [];
  for (const c of entrada.contratos) {
    if (c.situacao !== "vigente") continue;
    if (!c.fiscalId) {
      const dias = diasEntre(c.dataAssinatura, entrada.hoje);
      semFiscal.push({
        contratoId: c.id, numero: c.numero, objeto: c.objeto,
        situacao: c.situacao, diasSemDesignacao: dias
      });
    }
  }

  return { vencidos, aVencer, semFiscal };
}