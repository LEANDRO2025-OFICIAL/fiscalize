import { pgTable, text, timestamp, uuid, numeric, date, index } from "drizzle-orm/pg-core";
import { organizacao } from "./organizacao";
import { contrato } from "./contrato";
import { usuario } from "./usuario";
import { penalidadeSituacaoEnum } from "./enums";

export const penalidade = pgTable("penalidade", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: uuid("organizacao_id").notNull().references(() => organizacao.id),
  contratoId: uuid("contrato_id").notNull().references(() => contrato.id),
  tipo: text("tipo").notNull(),
  valor: numeric("valor", { precision: 18, scale: 2 }).notNull().default("0"),
  justificativa: text("justificativa").notNull(),
  baseLegal: text("base_legal"),
  contraditorio: text("contraditorio"),
  prazoResposta: date("prazo_resposta"),
  situacao: penalidadeSituacaoEnum("situacao").notNull().default("sugerida"),
  criadoPorId: uuid("criado_por_id").references(() => usuario.id),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("penalidade_contrato_idx").on(t.contratoId),
  index("penalidade_org_idx").on(t.organizacaoId)
]);