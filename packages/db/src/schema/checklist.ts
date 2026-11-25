import { pgTable, text, timestamp, uuid, integer, index } from "drizzle-orm/pg-core";
import { organizacao } from "./organizacao";
import { contrato } from "./contrato";
import { usuario } from "./usuario";

export const checklistExecucao = pgTable("checklist_execucao", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: uuid("organizacao_id").notNull().references(() => organizacao.id),
  contratoId: uuid("contrato_id").notNull().references(() => contrato.id),
  modelo: text("modelo").notNull(),
  itens: text("itens").notNull(),
  conformes: integer("conformes").notNull().default(0),
  naoConformes: integer("nao_conformes").notNull().default(0),
  criadoPorId: uuid("criado_por_id").references(() => usuario.id),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("checklist_contrato_idx").on(t.contratoId)]);
