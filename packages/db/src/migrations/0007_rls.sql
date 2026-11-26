-- Isolamento por órgão no banco (RLS). O app conecta como fiscalize_app (sem BYPASSRLS) e cada transação
-- declara o órgão em app.organizacao_id. Novas tabelas de tenant devem entrar na lista abaixo.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiscalize_app') THEN
    CREATE ROLE fiscalize_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO fiscalize_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fiscalize_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fiscalize_app;
-- Trilha de auditoria append-only também para o app.
REVOKE UPDATE, DELETE, TRUNCATE ON evento_auditoria FROM fiscalize_app;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['unidade','usuario','contrato','designacao','item_contratado','obrigacao','evidencia','medicao','recebimento','evento_auditoria','ocorrencia','checklist_execucao','aditivo','penalidade'] LOOP
    CONTINUE WHEN to_regclass(format('public.%I', t)) IS NULL; -- aditivo/penalidade só existem a partir da 0008 (RLS reaplicada na 0010)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant ON %I', t);
    EXECUTE format($f$CREATE POLICY tenant ON %I USING (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid) WITH CHECK (organizacao_id = nullif(current_setting('app.organizacao_id', true), '')::uuid)$f$, t);
  END LOOP;
END $$;

ALTER TABLE organizacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant ON organizacao;
CREATE POLICY tenant ON organizacao USING (id = nullif(current_setting('app.organizacao_id', true), '')::uuid);

ALTER TABLE vinculo_fornecedor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant ON vinculo_fornecedor;
CREATE POLICY tenant ON vinculo_fornecedor USING (
  contratante_org_id = nullif(current_setting('app.organizacao_id', true), '')::uuid
  OR fornecedor_org_id = nullif(current_setting('app.organizacao_id', true), '')::uuid);

-- O login precisa achar o usuário antes de saber o órgão: função restrita, só devolve o necessário.
CREATE OR REPLACE FUNCTION buscar_login(p_email text)
RETURNS TABLE (id uuid, organizacao_id uuid, senha_hash text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$ SELECT u.id, u.organizacao_id, u.senha_hash FROM usuario u WHERE u.email = p_email LIMIT 1 $$;
REVOKE ALL ON FUNCTION buscar_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buscar_login(text) TO fiscalize_app;
