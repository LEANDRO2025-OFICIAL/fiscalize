-- SentinelaOps: monitoramento de segurança operacional.
-- Tabelas para sessões ativas e eventos de segurança.
-- Isolamento por órgão via RLS (mesmo padrão da 0007/0011/0014).

CREATE TABLE IF NOT EXISTS sessao_ativa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  usuario_id uuid NOT NULL REFERENCES usuario(id),
  token_hash text NOT NULL,
  ip text,
  user_agent text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  ultimo_acesso timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evento_seguranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  usuario_id uuid REFERENCES usuario(id),
  tipo text NOT NULL, -- 'login_falha' | 'acesso_negado' | 'papel_alterado' | 'sessao_expirada' | 'token_invalido'
  descricao text NOT NULL,
  ip text,
  severidade text NOT NULL DEFAULT 'baixa', -- 'baixa' | 'media' | 'alta' | 'critica'
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessao_ativa_org_idx ON sessao_ativa(organizacao_id);
CREATE INDEX IF NOT EXISTS sessao_ativa_usuario_idx ON sessao_ativa(usuario_id);
CREATE INDEX IF NOT EXISTS sessao_ativa_ativo_idx ON sessao_ativa(ativo);
CREATE INDEX IF NOT EXISTS evento_seguranca_org_idx ON evento_seguranca(organizacao_id);
CREATE INDEX IF NOT EXISTS evento_seguranca_tipo_idx ON evento_seguranca(tipo);
CREATE INDEX IF NOT EXISTS evento_seguranca_severidade_idx ON evento_seguranca(severidade);

-- RLS por órgão
ALTER TABLE sessao_ativa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant ON sessao_ativa;
CREATE POLICY tenant ON sessao_ativa
  USING (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid)
  WITH CHECK (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid);

ALTER TABLE evento_seguranca ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant ON evento_seguranca;
CREATE POLICY tenant ON evento_seguranca
  USING (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid)
  WITH CHECK (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON sessao_ativa TO fiscalize_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON evento_seguranca TO fiscalize_app;
