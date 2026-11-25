-- RadarCompras (MVP 02): sinais de risco determinísticos e auditáveis.
-- Cada sinal exige revisão humana registrada antes de poder ser incluído
-- em dossiê exportado. O texto da tela é montado por template, nunca por IA.

CREATE TABLE IF NOT EXISTS sinal_risco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  tipo text NOT NULL, -- 'divergencia_preco' | 'vinculo_cadastral'
  regra_aplicada text NOT NULL, -- vocabulário fechado: 'divergência de preço' | 'vínculo cadastral identificado'
  valor_observado numeric(18,2),
  valor_referencia numeric(18,2),
  desvio_percentual numeric(9,2),
  confianca numeric(3,2), -- 0 a 1
  status_revisao text NOT NULL DEFAULT 'aguarda_revisao', -- 'aguarda_revisao' | 'revisado'
  parecer_humano text,
  parecer_por_id uuid REFERENCES usuario(id),
  parecer_em timestamp with time zone,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sinal_risco_contrato_idx ON sinal_risco(contrato_id);
CREATE INDEX IF NOT EXISTS sinal_risco_org_idx ON sinal_risco(organizacao_id);
CREATE INDEX IF NOT EXISTS sinal_risco_status_idx ON sinal_risco(status_revisao);

-- Isolamento por órgão (mesmo padrão da 0007) e acesso do papel da aplicação
ALTER TABLE sinal_risco ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant ON sinal_risco;
CREATE POLICY tenant ON sinal_risco
  USING (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid)
  WITH CHECK (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON sinal_risco TO fiscalize_app;
