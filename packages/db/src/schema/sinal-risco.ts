import { pgTable, text, timestamp, uuid, numeric, index } from "drizzle-orm/pg-core";
import { organizacao } from "./organizacao";
import { contrato } from "./contrato";
import { usuario } from "./usuario";

// Sinais de risco do RadarCompras: cálculos determinísticos e auditáveis,
// nunca juízo de valor gerado por IA. Cada sinal exige revisão humana
// registrada antes de poder ser incluído em dossiê exportado.
export const sinalRisco = pgTable("sinal_risco", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: uuid("organizacao_id").notNull().references(() => organizacao.id),
  contratoId: uuid("contrato_id").notNull().references(() => contrato.id),
  tipo: text("tipo").notNull(), // 'divergencia_preco' | 'vinculo_cadastral'
  regraAplicada: text("regra_aplicada").notNull(), // vocabulário fechado
  valorObservado: numeric("valor_observado", { precision: 18, scale: 2 }),
  valorReferencia: numeric("valor_referencia", { precision: 18, scale: 2 }),
  desvioPercentual: numeric("desvio_percentual", { precision: 9, scale: 2 }),
  confianca: numeric("confianca", { precision: 3, scale: 2 }), // 0 a 1
  statusRevisao: text("status_revisao").notNull().default("aguarda_revisao"), // 'aguarda_revisao' | 'revisado'
  parecerHumano: text("parecer_humano"),
  parecerPorId: uuid("parecer_por_id").references(() => usuario.id),
  parecerEm: timestamp("parecer_em", { withTimezone: true }),
  observacao: text("observacao"), // observação/evidência anexada ao sinal
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("sinal_risco_contrato_idx").on(t.contratoId),
  index("sinal_risco_org_idx").on(t.organizacaoId),
  index("sinal_risco_status_idx").on(t.statusRevisao)
]);
