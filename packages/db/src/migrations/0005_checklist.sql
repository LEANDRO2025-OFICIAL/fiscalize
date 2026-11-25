CREATE TABLE IF NOT EXISTS checklist_execucao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  modelo text NOT NULL,
  itens text NOT NULL,
  conformes integer NOT NULL DEFAULT 0,
  nao_conformes integer NOT NULL DEFAULT 0,
  criado_por_id uuid REFERENCES usuario(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checklist_contrato_idx ON checklist_execucao (contrato_id);
