-- GestorLicita: gestão de licitações e pregões.
-- Cada órgão publica editais; fornecedores apresentam lances.
-- Isolamento por órgão via RLS (mesmo padrão da 0007/0011).

CREATE TABLE IF NOT EXISTS licitacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  numero text NOT NULL,
  objeto text NOT NULL,
  modalidade text NOT NULL, -- 'pregao' | 'concorrencia' | 'dispensa' | 'inexigibilidade' | 'leilao'
  situacao text NOT NULL DEFAULT 'aberta', -- 'aberta' | 'em_andamento' | 'homologada' | 'deserta' | 'cancelada' | 'arquivada'
  criterio text NOT NULL DEFAULT 'menor_preco', -- 'menor_preco' | 'melhor_tecnica' | 'maior_lance_oferta'
  valor_estimado numeric(18,2),
  data_abertura date NOT NULL,
  data_encerramento date NOT NULL,
  edital text,
  criado_por_id uuid REFERENCES usuario(id),
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  licitacao_id uuid NOT NULL REFERENCES licitacao(id),
  fornecedor_cnpj text NOT NULL,
  fornecedor_nome text NOT NULL,
  valor numeric(18,2) NOT NULL,
  situacao text NOT NULL DEFAULT 'ativo', -- 'ativo' | 'desclassificado' | 'vencedor'
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS licitacao_org_idx ON licitacao(organizacao_id);
CREATE INDEX IF NOT EXISTS licitacao_situacao_idx ON licitacao(situacao);
CREATE INDEX IF NOT EXISTS licitacao_numero_idx ON licitacao(numero);
CREATE INDEX IF NOT EXISTS lance_licitacao_idx ON lance(licitacao_id);
CREATE INDEX IF NOT EXISTS lance_org_idx ON lance(organizacao_id);
CREATE INDEX IF NOT EXISTS lance_cnpj_idx ON lance(fornecedor_cnpj);

-- RLS por órgão
ALTER TABLE licitacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant ON licitacao;
CREATE POLICY tenant ON licitacao
  USING (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid)
  WITH CHECK (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid);

ALTER TABLE lance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant ON lance;
CREATE POLICY tenant ON lance
  USING (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid)
  WITH CHECK (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON licitacao TO fiscalize_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON lance TO fiscalize_app;
