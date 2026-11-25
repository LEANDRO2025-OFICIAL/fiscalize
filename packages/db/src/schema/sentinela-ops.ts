import { pgTable, text, timestamp, uuid, index, boolean } from "drizzle-orm/pg-core";
import { organizacao } from "./organizacao";
import { usuario } from "./usuario";

// SentinelaOps: monitoramento de segurança operacional.
// Registra sessões ativas, eventos de segurança e acessos críticos.
// Isolamento por organização via RLS.
export const sessaoAtiva = pgTable("sessao_ativa", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: uuid("organizacao_id").notNull().references(() => organizacao.id),
  usuarioId: uuid("usuario_id").notNull().references(() => usuario.id),
  tokenHash: text("token_hash").notNull(), // hash do token de sessão
  ip: text("ip"), // endereço IP de origem
  userAgent: text("user_agent"), // identificador do navegador/cliente
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  ultimoAcesso: timestamp("ultimo_acesso", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("sessao_ativa_org_idx").on(t.organizacaoId),
  index("sessao_ativa_usuario_idx").on(t.usuarioId),
  index("sessao_ativa_ativo_idx").on(t.ativo),
]);

// Evento de segurança: tentativas de login falhas, acessos negados, alterações de papel, etc.
export const eventoSeguranca = pgTable("evento_seguranca", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: uuid("organizacao_id").notNull().references(() => organizacao.id),
  usuarioId: uuid("usuario_id").references(() => usuario.id),
  tipo: text("tipo").notNull(), // 'login_falha', 'acesso_negado', 'papel_alterado', 'sessao_expirada', 'token_invalido'
  descricao: text("descricao").notNull(),
  ip: text("ip"),
  severidade: text("severidade").notNull().default("baixa"), // 'baixa' | 'media' | 'alta' | 'critica'
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("evento_seguranca_org_idx").on(t.organizacaoId),
  index("evento_seguranca_tipo_idx").on(t.tipo),
  index("evento_seguranca_severidade_idx").on(t.severidade),
]);
