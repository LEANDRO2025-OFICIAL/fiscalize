import { pgTable, text, timestamp, uuid, numeric, date, integer, index } from "drizzle-orm/pg-core";
import { organizacao } from "./organizacao";
import { contrato } from "./contrato";
import { usuario } from "./usuario";

export const aditivo = pgTable("aditivo", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: uuid("organizacao_id").notNull().references(() => organizacao.id),
  contratoId: uuid("contrato_id").notNull().references(() => contrato.id),
  numero: integer("numero").notNull(),
  tipo: text("tipo").notNull(),
  objeto: text("objeto").notNull(),
  valor: numeric("valor", { precision: 18, scale: 2 }).notNull().default("0"),
  dataAssinatura: date("data_assinatura").notNull(),
  dataPublicacao: date("data_publicacao"),
  vigenciaInicio: date("vigencia_inicio"),
  vigenciaFim: date("vigencia_fim"),
  arquivoChave: text("arquivo_chave"),
  arquivoSha256: text("arquivo_sha256"),
  criadoPorId: uuid("criado_por_id").references(() => usuario.id),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("aditivo_contrato_idx").on(t.contratoId),
  index("aditivo_org_idx").on(t.organizacaoId)
]);