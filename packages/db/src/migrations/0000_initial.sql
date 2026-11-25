BEGIN;
DO $$ BEGIN
  CREATE TYPE papel AS ENUM ('administrador','controlador','fiscal','fornecedor','leitor');
  CREATE TYPE nivel_govbr AS ENUM ('bronze','prata','ouro');
  CREATE TYPE contrato_situacao AS ENUM ('vigente','suspenso','encerrado');
  CREATE TYPE item_situacao AS ENUM ('previsto','em_execucao','concluido','cancelado');
  CREATE TYPE obrigacao_tipo AS ENUM ('entrega','servico','relatorio','pagamento');
  CREATE TYPE evidencia_tipo AS ENUM ('documento','foto','planilha','outro');
  CREATE TYPE medicao_situacao AS ENUM ('rascunho','submetida','aprovada','rejeitada');
  CREATE TYPE recebimento_situacao AS ENUM ('pendente','conforme','divergente');
  CREATE TYPE evento_audit_tipo AS ENUM ('criacao','alteracao','exclusao','login','designacao','medicao','evidencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS organizacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL,
  cnpj text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS organizacao_cnpj_uq ON organizacao (cnpj);

CREATE TABLE IF NOT EXISTS unidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  nome text NOT NULL,
  sigla text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  nome text NOT NULL,
  email text NOT NULL,
  senha_hash text,
  govbr_sub text,
  nivel_govbr nivel_govbr,
  papel papel NOT NULL,
  email_verificado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS usuario_email_uq ON usuario (email);

CREATE TABLE IF NOT EXISTS contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  unidade_id uuid REFERENCES unidade(id),
  numero text NOT NULL,
  objeto text NOT NULL,
  fornecedor_nome text NOT NULL,
  fornecedor_cnpj text NOT NULL,
  valor_global numeric(18,2) NOT NULL,
  data_assinatura date NOT NULL,
  data_fim date NOT NULL,
  situacao contrato_situacao NOT NULL DEFAULT 'vigente',
  fiscal_id uuid REFERENCES usuario(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS designacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  fiscal_id uuid NOT NULL REFERENCES usuario(id),
  portaria text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date,
  ativo text NOT NULL DEFAULT 'sim',
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS item_contratado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  descricao text NOT NULL,
  unidade_medida text NOT NULL,
  quantidade_total numeric(18,4) NOT NULL,
  valor_unitario numeric(18,2) NOT NULL,
  situacao item_situacao NOT NULL DEFAULT 'previsto',
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS obrigacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  tipo obrigacao_tipo NOT NULL,
  descricao text NOT NULL,
  prazo_dias integer,
  data_limite date,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  enviado_por_id uuid NOT NULL REFERENCES usuario(id),
  tipo evidencia_tipo NOT NULL,
  nome_arquivo text NOT NULL,
  chave_s3 text NOT NULL,
  sha256 text NOT NULL,
  tamanho_bytes bigint NOT NULL,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  numero integer NOT NULL,
  competencia date NOT NULL,
  situacao medicao_situacao NOT NULL DEFAULT 'rascunho',
  valor_bruto numeric(18,2) NOT NULL DEFAULT 0,
  valor_glosa numeric(18,2) NOT NULL DEFAULT 0,
  valor_liquido numeric(18,2) NOT NULL DEFAULT 0,
  memoria_calculo text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recebimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  contrato_id uuid NOT NULL REFERENCES contrato(id),
  medicao_id uuid REFERENCES medicao(id),
  data date NOT NULL,
  situacao recebimento_situacao NOT NULL DEFAULT 'pendente',
  parecer text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evento_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequencia bigint NOT NULL,
  organizacao_id uuid NOT NULL REFERENCES organizacao(id),
  tipo evento_audit_tipo NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  ator_id uuid REFERENCES usuario(id),
  payload text NOT NULL,
  hash_anterior text,
  hash text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS evento_auditoria_seq_uq ON evento_auditoria (organizacao_id, sequencia);

CREATE TABLE IF NOT EXISTS vinculo_fornecedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contratante_org_id uuid NOT NULL REFERENCES organizacao(id),
  fornecedor_org_id uuid NOT NULL REFERENCES organizacao(id),
  status text NOT NULL DEFAULT 'ativo',
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vinculo_fornecedor_uq ON vinculo_fornecedor (contratante_org_id, fornecedor_org_id);

COMMIT;
