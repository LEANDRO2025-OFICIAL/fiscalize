-- RadarCompras (MVP 02): melhorias no módulo de sinais de risco.
-- Adiciona campo de observacao/evidencia ao sinal.

ALTER TABLE sinal_risco ADD COLUMN IF NOT EXISTS observacao text;

-- Índice para busca por observacao (busca textual simples)
CREATE INDEX IF NOT EXISTS sinal_risco_observacao_idx ON sinal_risco USING gin(to_tsvector('portuguese', coalesce(observacao, '')));
