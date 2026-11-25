import { pgTable, text, timestamp, uuid, numeric, date, index } from "drizzle-orm/pg-core";
import { organizacao } from "./organizacao";
import { usuario } from "./usuario";
import { licitacaoModalidadeEnum, licitacaoSituacaoEnum, licitacaoCriterioEnum, lanceSituacaoEnum } from "./enums";

// Licitação / pregão: cada órgão publica editais, define critério e acompanha o andamento.
// Vínculo com contratos: quando homologada, a licitação gera o(s) contrato(s).
export const licitacao = pgTable("licitacao", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: uuid("organizacao_id").notNull().references(() => organizacao.id),
  numero: text("numero").notNull(), // ex: PREGAO 001/2026
  objeto: text("objeto").notNull(),
  modalidade: licitacaoModalidadeEnum("modalidade").notNull(),
  situacao: licitacaoSituacaoEnum("situacao").notNull().default("aberta"),
  criterio: licitacaoCriterioEnum("criterio").notNull().default("menor_preco"),
  valorEstimado: numeric("valor_estimado", { precision: 18, scale: 2 }),
  dataAbertura: date("data_abertura").notNull(),
  dataEncerramento: date("data_encerramento").notNull(),
  edital: text("edital"), // link ou resumo do edital
  criadoPorId: uuid("criado_por_id").references(() => usuario.id),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("licitacao_org_idx").on(t.organizacaoId),
  index("licitacao_situacao_idx").on(t.situacao),
  index("licitacao_numero_idx").on(t.numero),
]);

// Lance / proposta: fornecedor apresenta proposta para uma licitação aberta.
// Isolado por CNPJ do fornecedor no modo empresa.
export const lance = pgTable("lance", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: uuid("organizacao_id").notNull().references(() => organizacao.id),
  licitacaoId: uuid("licitacao_id").notNull().references(() => licitacao.id),
  fornecedorCnpj: text("fornecedor_cnpj").notNull(),
  fornecedorNome: text("fornecedor_nome").notNull(),
  valor: numeric("valor", { precision: 18, scale: 2 }).notNull(),
  situacao: lanceSituacaoEnum("situacao").notNull().default("ativo"), // reuso simplificado; melhor seria lanceSituacaoEnum
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("lance_licitacao_idx").on(t.licitacaoId),
  index("lance_org_idx").on(t.organizacaoId),
  index("lance_cnpj_idx").on(t.fornecedorCnpj),
]);
