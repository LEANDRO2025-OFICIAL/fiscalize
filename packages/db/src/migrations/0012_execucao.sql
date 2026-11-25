-- ExecucaoClara (MVP 13): funil de execucao orçamentária (empenho -> liquidação -> pagamento).
-- Cada etapa é um lançamento determinístico e auditável, nunca um número inventado.
-- A liquidação e o pagamento exigem medição aprovada (ligação com a tabela medicao).

CREATE TABLE IF NOT EXISTS execucao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  medicao_id uuid REFERENCES medicao(id),
  tipo text NOT NULL, -- 'empenho' | 'liquidacao' | 'pagamento'
  valor numeric(18,2) NOT NULL DEFAULT 0,
  numero_documento text,
  data date NOT NULL,
  situacao text NOT NULL DEFAULT 'pendente', -- 'pendente' | 'confirmado' | 'cancelado'
  observacao text,
  criado_por_id uuid REFERENCES usuario(id),
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS execucao_contrato_idx ON execucao(contrato_id);
CREATE INDEX IF NOT EXISTS execucao_org_idx ON execucao(organizacao_id);
CREATE INDEX IF NOT EXISTS execucao_tipo_idx ON execucao(tipo);
CREATE INDEX IF NOT EXISTS execucao_situacao_idx ON execucao(situacao);

-- Isolamento por órgão (mesmo padrão da 0007) e acesso do papel da aplicação
ALTER TABLE execucao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant ON execucao;
CREATE POLICY tenant ON execucao
  USING (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid)
  WITH CHECK (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON execucao TO fiscalize_app;
