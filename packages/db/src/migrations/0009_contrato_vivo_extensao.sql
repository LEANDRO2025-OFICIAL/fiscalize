-- ContratoVivo: Extensão de tipos e tabelas para aditivos e penalidades

-- Adicionar valores ao tipo evento_audit_tipo
ALTER TYPE evento_audit_tipo ADD VALUE IF NOT EXISTS 'aditivo';
ALTER TYPE evento_audit_tipo ADD VALUE IF NOT EXISTS 'apuracao';

-- Criar tipos ENUM para aditivo e penalidade
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'aditivo_tipo') THEN
    CREATE TYPE aditivo_tipo AS ENUM ('prorrogacao', 'acrescimo', 'reducao', 'reforma', 'acerto', 'outro');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'penalidade_situacao') THEN
    CREATE TYPE penalidade_situacao AS ENUM ('sugerida', 'aprovada', 'cumprida', 'cancelada');
  END IF;
END $$;

-- Criar tabela aditivo
CREATE TABLE IF NOT EXISTS aditivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  numero integer NOT NULL,
  tipo aditivo_tipo NOT NULL,
  objeto text NOT NULL,
  valor numeric(18, 2) NOT NULL DEFAULT 0,
  data_assinatura date NOT NULL,
  data_publicacao date,
  vigencia_inicio date,
  vigencia_fim date,
  arquivo_chave text,
  arquivo_sha256 text,
  criado_por_id uuid REFERENCES usuario(id),
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar índice para aditivo
CREATE INDEX IF NOT EXISTS aditivo_contrato_idx ON aditivo(contrato_id);
CREATE INDEX IF NOT EXISTS aditivo_org_idx ON aditivo(organizacao_id);

-- Criar tabela penalidade
CREATE TABLE IF NOT EXISTS penalidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  tipo text NOT NULL,
  valor numeric(18, 2) NOT NULL DEFAULT 0,
  justificativa text NOT NULL,
  base_legal text,
  contraditorio text,
  prazo_resposta date,
  situacao penalidade_situacao NOT NULL DEFAULT 'sugerida',
  criado_por_id uuid REFERENCES usuario(id),
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar índice para penalidade
CREATE INDEX IF NOT EXISTS penalidade_contrato_idx ON penalidade(contrato_id);
CREATE INDEX IF NOT EXISTS penalidade_org_idx ON penalidade(organizacao_id);