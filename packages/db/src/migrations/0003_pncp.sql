ALTER TABLE contrato ADD COLUMN IF NOT EXISTS pncp_numero_controle text;
CREATE UNIQUE INDEX IF NOT EXISTS contrato_pncp_uq ON contrato (organizacao_id, pncp_numero_controle) WHERE pncp_numero_controle IS NOT NULL;
