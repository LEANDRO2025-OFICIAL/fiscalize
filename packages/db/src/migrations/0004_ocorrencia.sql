CREATE TABLE IF NOT EXISTS ocorrencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  tipo text NOT NULL,
  gravidade text NOT NULL,
  descricao text NOT NULL,
  latitude numeric(9,6),
  longitude numeric(9,6),
  prazo date,
  status text NOT NULL DEFAULT 'aberta',
  criado_por_id uuid REFERENCES usuario(id),
  resolucao text,
  resolvida_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ocorrencia_contrato_idx ON ocorrencia (contrato_id);
ALTER TABLE evidencia ADD COLUMN IF NOT EXISTS ocorrencia_id uuid REFERENCES ocorrencia(id);
