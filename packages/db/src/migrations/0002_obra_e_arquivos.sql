ALTER TABLE contrato ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'servico';
ALTER TABLE contrato ADD COLUMN IF NOT EXISTS endereco_obra text;
ALTER TABLE contrato ADD COLUMN IF NOT EXISTS latitude numeric(9,6);
ALTER TABLE contrato ADD COLUMN IF NOT EXISTS longitude numeric(9,6);
ALTER TABLE evidencia ADD COLUMN IF NOT EXISTS mime text;
