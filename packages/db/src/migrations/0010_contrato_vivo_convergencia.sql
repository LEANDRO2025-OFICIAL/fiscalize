-- ContratoVivo: convergência do banco para o schema atual, de forma idempotente.
-- Cobre bancos onde 0008/0009 ainda não rodaram (ex.: produção) e corrige o formato antigo
-- da tabela aditivo (coluna "vigencia" da versão inicial da 0008).

-- 1. Valores do enum de auditoria (idempotente em qualquer estado do banco)
ALTER TYPE evento_audit_tipo ADD VALUE IF NOT EXISTS 'aditivo';
ALTER TYPE evento_audit_tipo ADD VALUE IF NOT EXISTS 'penalidade';
ALTER TYPE evento_audit_tipo ADD VALUE IF NOT EXISTS 'apuracao';

-- 2. Enums de domínio (se ainda não existirem)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'aditivo_tipo') THEN
    CREATE TYPE aditivo_tipo AS ENUM ('prorrogacao','acrescimo','reducao','reforma','acerto','outro');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'penalidade_situacao') THEN
    CREATE TYPE penalidade_situacao AS ENUM ('sugerida','aprovada','cumprida','cancelada');
  END IF;
END $$;

-- 3. Tabelas (se ainda não existirem)
CREATE TABLE IF NOT EXISTS aditivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  numero integer NOT NULL,
  tipo aditivo_tipo NOT NULL,
  objeto text NOT NULL,
  valor numeric(18,2) NOT NULL DEFAULT 0,
  data_assinatura date NOT NULL,
  data_publicacao date,
  vigencia_inicio date,
  vigencia_fim date,
  arquivo_chave text,
  arquivo_sha256 text,
  criado_por_id uuid REFERENCES usuario(id),
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aditivo_contrato_idx ON aditivo(contrato_id);
CREATE INDEX IF NOT EXISTS aditivo_org_idx ON aditivo(organizacao_id);

CREATE TABLE IF NOT EXISTS penalidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  tipo text NOT NULL,
  valor numeric(18,2) NOT NULL DEFAULT 0,
  justificativa text NOT NULL,
  base_legal text,
  contraditorio text,
  prazo_resposta date,
  situacao penalidade_situacao NOT NULL DEFAULT 'sugerida',
  criado_por_id uuid REFERENCES usuario(id),
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS penalidade_contrato_idx ON penalidade(contrato_id);
CREATE INDEX IF NOT EXISTS penalidade_org_idx ON penalidade(organizacao_id);

-- 4. Convergência do formato antigo da tabela aditivo
ALTER TABLE aditivo ADD COLUMN IF NOT EXISTS vigencia_inicio date;
ALTER TABLE aditivo DROP COLUMN IF EXISTS vigencia;

-- 5. Isolamento por órgão (mesmo padrão da 0007) e acesso do papel da aplicação
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['aditivo','penalidade'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant ON %I', t);
    EXECUTE format($f$CREATE POLICY tenant ON %I USING (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid) WITH CHECK (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid)$f$, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON aditivo TO fiscalize_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON penalidade TO fiscalize_app;
