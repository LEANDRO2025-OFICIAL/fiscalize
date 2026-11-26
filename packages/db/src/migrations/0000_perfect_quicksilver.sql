DO $$ BEGIN
CREATE TYPE "public"."contrato_situacao" AS ENUM('vigente', 'suspenso', 'encerrado');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
CREATE TYPE "public"."evento_audit_tipo" AS ENUM('criacao', 'alteracao', 'exclusao', 'login', 'designacao', 'medicao', 'evidencia');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
CREATE TYPE "public"."evidencia_tipo" AS ENUM('documento', 'foto', 'planilha', 'outro');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
CREATE TYPE "public"."item_situacao" AS ENUM('previsto', 'em_execucao', 'concluido', 'cancelado');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
CREATE TYPE "public"."medicao_situacao" AS ENUM('rascunho', 'submetida', 'aprovada', 'rejeitada');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
CREATE TYPE "public"."nivel_govbr" AS ENUM('bronze', 'prata', 'ouro');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
CREATE TYPE "public"."obrigacao_tipo" AS ENUM('entrega', 'servico', 'relatorio', 'pagamento');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
CREATE TYPE "public"."papel" AS ENUM('administrador', 'controlador', 'fiscal', 'fornecedor', 'leitor');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
CREATE TYPE "public"."recebimento_situacao" AS ENUM('pendente', 'conforme', 'divergente');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"tipo" text NOT NULL,
	"cnpj" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unidade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"sigla" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text,
	"govbr_sub" text,
	"nivel_govbr" "nivel_govbr",
	"papel" "papel" NOT NULL,
	"email_verificado" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contrato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"unidade_id" uuid,
	"numero" text NOT NULL,
	"objeto" text NOT NULL,
	"fornecedor_nome" text NOT NULL,
	"fornecedor_cnpj" text NOT NULL,
	"valor_global" numeric(18, 2) NOT NULL,
	"data_assinatura" date NOT NULL,
	"data_fim" date NOT NULL,
	"situacao" "contrato_situacao" DEFAULT 'vigente' NOT NULL,
	"fiscal_id" uuid,
	"pncp_numero_controle" text,
	"categoria" text DEFAULT 'servico' NOT NULL,
	"endereco_obra" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "designacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"contrato_id" uuid NOT NULL,
	"fiscal_id" uuid NOT NULL,
	"portaria" text NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date,
	"ativo" text DEFAULT 'sim' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_contratado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"contrato_id" uuid NOT NULL,
	"descricao" text NOT NULL,
	"unidade_medida" text NOT NULL,
	"quantidade_total" numeric(18, 4) NOT NULL,
	"valor_unitario" numeric(18, 2) NOT NULL,
	"situacao" "item_situacao" DEFAULT 'previsto' NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "obrigacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"contrato_id" uuid NOT NULL,
	"tipo" "obrigacao_tipo" NOT NULL,
	"descricao" text NOT NULL,
	"prazo_dias" integer,
	"data_limite" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evidencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"contrato_id" uuid NOT NULL,
	"enviado_por_id" uuid NOT NULL,
	"tipo" "evidencia_tipo" NOT NULL,
	"nome_arquivo" text NOT NULL,
	"mime" text,
	"ocorrencia_id" uuid,
	"chave_s3" text NOT NULL,
	"sha256" text NOT NULL,
	"tamanho_bytes" bigint NOT NULL,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "medicao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"contrato_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"competencia" date NOT NULL,
	"situacao" "medicao_situacao" DEFAULT 'rascunho' NOT NULL,
	"valor_bruto" numeric(18, 2) DEFAULT '0' NOT NULL,
	"valor_glosa" numeric(18, 2) DEFAULT '0' NOT NULL,
	"valor_liquido" numeric(18, 2) DEFAULT '0' NOT NULL,
	"memoria_calculo" text,
	"criado_por_id" uuid,
	"aprovado_por_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recebimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"contrato_id" uuid NOT NULL,
	"medicao_id" uuid,
	"data" date NOT NULL,
	"situacao" "recebimento_situacao" DEFAULT 'pendente' NOT NULL,
	"parecer" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evento_auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequencia" bigint NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"tipo" "evento_audit_tipo" NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" uuid,
	"ator_id" uuid,
	"payload" text NOT NULL,
	"hash_anterior" text,
	"hash" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vinculo_fornecedor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contratante_org_id" uuid NOT NULL,
	"fornecedor_org_id" uuid NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ocorrencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"contrato_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"gravidade" text NOT NULL,
	"descricao" text NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"prazo" date,
	"status" text DEFAULT 'aberta' NOT NULL,
	"criado_por_id" uuid,
	"resolucao" text,
	"resolvida_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklist_execucao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"contrato_id" uuid NOT NULL,
	"modelo" text NOT NULL,
	"itens" text NOT NULL,
	"conformes" integer DEFAULT 0 NOT NULL,
	"nao_conformes" integer DEFAULT 0 NOT NULL,
	"criado_por_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unidade" ADD CONSTRAINT "unidade_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usuario" ADD CONSTRAINT "usuario_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contrato" ADD CONSTRAINT "contrato_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contrato" ADD CONSTRAINT "contrato_unidade_id_unidade_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidade"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contrato" ADD CONSTRAINT "contrato_fiscal_id_usuario_id_fk" FOREIGN KEY ("fiscal_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "designacao" ADD CONSTRAINT "designacao_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "designacao" ADD CONSTRAINT "designacao_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "designacao" ADD CONSTRAINT "designacao_fiscal_id_usuario_id_fk" FOREIGN KEY ("fiscal_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_contratado" ADD CONSTRAINT "item_contratado_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_contratado" ADD CONSTRAINT "item_contratado_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "obrigacao" ADD CONSTRAINT "obrigacao_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "obrigacao" ADD CONSTRAINT "obrigacao_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_enviado_por_id_usuario_id_fk" FOREIGN KEY ("enviado_por_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medicao" ADD CONSTRAINT "medicao_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medicao" ADD CONSTRAINT "medicao_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medicao" ADD CONSTRAINT "medicao_criado_por_id_usuario_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medicao" ADD CONSTRAINT "medicao_aprovado_por_id_usuario_id_fk" FOREIGN KEY ("aprovado_por_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recebimento" ADD CONSTRAINT "recebimento_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recebimento" ADD CONSTRAINT "recebimento_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recebimento" ADD CONSTRAINT "recebimento_medicao_id_medicao_id_fk" FOREIGN KEY ("medicao_id") REFERENCES "public"."medicao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evento_auditoria" ADD CONSTRAINT "evento_auditoria_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evento_auditoria" ADD CONSTRAINT "evento_auditoria_ator_id_usuario_id_fk" FOREIGN KEY ("ator_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vinculo_fornecedor" ADD CONSTRAINT "vinculo_fornecedor_contratante_org_id_organizacao_id_fk" FOREIGN KEY ("contratante_org_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vinculo_fornecedor" ADD CONSTRAINT "vinculo_fornecedor_fornecedor_org_id_organizacao_id_fk" FOREIGN KEY ("fornecedor_org_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ocorrencia" ADD CONSTRAINT "ocorrencia_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ocorrencia" ADD CONSTRAINT "ocorrencia_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ocorrencia" ADD CONSTRAINT "ocorrencia_criado_por_id_usuario_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_execucao" ADD CONSTRAINT "checklist_execucao_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_execucao" ADD CONSTRAINT "checklist_execucao_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_execucao" ADD CONSTRAINT "checklist_execucao_criado_por_id_usuario_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizacao_cnpj_uq" ON "organizacao" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizacao_tipo_idx" ON "organizacao" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unidade_org_idx" ON "unidade" USING btree ("organizacao_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usuario_email_uq" ON "usuario" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usuario_govbr_sub_uq" ON "usuario" USING btree ("govbr_sub");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usuario_org_idx" ON "usuario" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contrato_org_idx" ON "contrato" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contrato_situacao_idx" ON "contrato" USING btree ("situacao");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "designacao_contrato_idx" ON "designacao" USING btree ("contrato_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_contratado_contrato_idx" ON "item_contratado" USING btree ("contrato_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obrigacao_contrato_idx" ON "obrigacao" USING btree ("contrato_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidencia_contrato_idx" ON "evidencia" USING btree ("contrato_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidencia_sha_idx" ON "evidencia" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "medicao_contrato_idx" ON "medicao" USING btree ("contrato_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recebimento_contrato_idx" ON "recebimento" USING btree ("contrato_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "evento_auditoria_seq_uq" ON "evento_auditoria" USING btree ("organizacao_id","sequencia");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evento_auditoria_entidade_idx" ON "evento_auditoria" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vinculo_fornecedor_uq" ON "vinculo_fornecedor" USING btree ("contratante_org_id","fornecedor_org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vinculo_fornecedor_forn_idx" ON "vinculo_fornecedor" USING btree ("fornecedor_org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ocorrencia_contrato_idx" ON "ocorrencia" USING btree ("contrato_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_contrato_idx" ON "checklist_execucao" USING btree ("contrato_id");