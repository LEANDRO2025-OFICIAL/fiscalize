CREATE UNIQUE INDEX IF NOT EXISTS recebimento_medicao_uq ON recebimento (medicao_id) WHERE medicao_id IS NOT NULL;
