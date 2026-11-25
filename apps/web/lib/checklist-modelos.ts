// Modelos de checklist de fiscalização por natureza do contrato.
export const MODELOS: Record<string, { nome: string; itens: string[] }> = {
  engenharia: {
    nome: "Fiscalização de obra de engenharia",
    itens: [
      "Diário de obra preenchido e assinado pelo responsável técnico",
      "ART/RRT de execução vigente e visível no canteiro",
      "Equipe e equipamentos compatíveis com o contratado",
      "Uso de EPIs e sinalização de segurança no canteiro",
      "Materiais conforme especificação, com notas fiscais e laudos",
      "Serviços executados conforme projeto e planilha",
      "Ensaios de controle tecnológico realizados",
      "Cronograma físico-financeiro respeitado",
      "Limpeza, drenagem e proteção da obra adequadas",
      "Registro fotográfico do período anexado",
    ],
  },
  servico: {
    nome: "Fiscalização de prestação de serviço",
    itens: [
      "Equipe alocada conforme o contrato (quantidade e qualificação)",
      "Regularidade trabalhista e previdenciária da contratada",
      "Serviço executado nos horários e locais previstos",
      "Uniformes, EPIs e equipamentos fornecidos",
      "Níveis de serviço e metas atendidos",
      "Relatórios e comprovantes do período entregues",
      "Reclamações dos usuários registradas e tratadas",
      "Faturamento compatível com o serviço efetivamente prestado",
    ],
  },
  bens: {
    nome: "Recebimento de bens",
    itens: [
      "Quantidade entregue confere com a nota fiscal e o empenho",
      "Especificação técnica atendida",
      "Prazo de entrega respeitado",
      "Embalagem, lote e validade em conformidade",
      "Amostra ou inspeção de qualidade realizada",
      "Armazenamento adequado no recebimento",
      "Documentação fiscal completa e correta",
    ],
  },
};
