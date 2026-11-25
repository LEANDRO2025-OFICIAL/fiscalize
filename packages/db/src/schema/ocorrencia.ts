import { pgTable, text, timestamp, uuid, numeric, date, index } from "drizzle-orm/pg-core";
import { organizacao } from "./organizacao";
import { contrato } from "./contrato";
import { usuario } from "./usuario";

export const ocorrencia = pgTable("ocorrencia", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: uuid("organizacao_id").notNull().references(() => organizacao.id),
  contratoId: uuid("contrato_id").notNull().references(() => contrato.id),
  tipo: text("tipo").notNull(),
  gravidade: text("gravidade").notNull(),
  descricao: text("descricao").notNull(),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  prazo: date("prazo"),
  status: text("status").notNull().default("aberta"),
  criadoPorId: uuid("criado_por_id").references(() => usuario.id),
  resolucao: text("resolucao"),
  resolvidaEm: timestamp("resolvida_em", { withTimezone: true }),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ocorrencia_contrato_idx").on(t.contratoId)]);
