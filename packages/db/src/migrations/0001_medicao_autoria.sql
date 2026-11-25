ALTER TABLE medicao ADD COLUMN IF NOT EXISTS criado_por_id uuid REFERENCES usuario(id);
ALTER TABLE medicao ADD COLUMN IF NOT EXISTS aprovado_por_id uuid REFERENCES usuario(id);
