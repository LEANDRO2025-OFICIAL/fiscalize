import { pgTable, text, timestamp, uuid, numeric, date, index } from "drizzle-orm/pg-core";
import { organizacao } from "./organizacao";
import { contrato } from "./contrato";
import { medicao } from "./medicao";
import { usuario } from "./usuario";
import { execucaoTipoEnum, execucaoSituacaoEnum } from "./enums";

// Funil de execução orçamentária: empenho -> liquidação -> pagamento.
// Cada etapa é um lançamento determinístico e auditável, nunca um número inventado.
// A liquidação e o pagamento exigem medição aprovada (ligação descrita na especificação).
export const execucao = pgTable("execucao", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: uuid("organizacao_id").notNull().references(() => organizacao.id),
  contratoId: uuid("contrato_id").notNull().references(() => contrato.id),
  medicaoId: uuid("medicao_id").references(() => medicao.id),
  tipo: execucaoTipoEnum("tipo").notNull(), // 'empenho' | 'liquidacao' | 'pagamento'
  valor: numeric("valor", { precision: 18, scale: 2 }).notNull().default("0"),
  numeroDocumento: text("numero_documento"), // numero do empenho/liquidacao/pagamento no sistema interno
  data: date("data").notNull(),
  situacao: execucaoSituacaoEnum("situacao").notNull().default("pendente"),
  observacao: text("observacao"),
  criadoPorId: uuid("criado_por_id").references(() => usuario.id),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("execucao_contrato_idx").on(t.contratoId),
  index("execucao_org_idx").on(t.organizacaoId),
  index("execucao_tipo_idx").on(t.tipo),
  index("execucao_situacao_idx").on(t.situacao)
]);
