-- 1. Colunas do filtro e canal de queixas
ALTER TABLE estabelecimentos ADD COLUMN IF NOT EXISTS filtro_estrelas_ativo boolean NOT NULL DEFAULT false;
ALTER TABLE estabelecimentos ADD COLUMN IF NOT EXISTS canal_queixas text DEFAULT 'ambos';
ALTER TABLE estabelecimentos ADD COLUMN IF NOT EXISTS email_notificacao text DEFAULT '';

-- 2. Limpeza de funções antigas sobrecarregadas (3 parâmetros)
DROP FUNCTION IF EXISTS public.resolve_nfc_tag(text, text, text);
DROP FUNCTION IF EXISTS public.resolve_qr_code(text, text, text);

-- 3. Permissão de SELECT para clientes anônimos lerem estabelecimentos ativos
DROP POLICY IF EXISTS "public_select_active_estabelecimentos" ON estabelecimentos;
CREATE POLICY "public_select_active_estabelecimentos" ON estabelecimentos
  FOR SELECT TO anon
  USING (ativo = true);

-- 4. Função resolve_qr_code case-insensitive com suporte ao filtro
CREATE OR REPLACE FUNCTION resolve_qr_code(
  p_codigo text,
  p_user_agent text DEFAULT '',
  p_ip text DEFAULT '',
  p_skip_scan boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr qr_codes%ROWTYPE;
  v_est estabelecimentos%ROWTYPE;
  v_code text;
BEGIN
  v_code := UPPER(TRIM(p_codigo));
  SELECT * INTO v_qr FROM qr_codes WHERE UPPER(TRIM(qr_codes.codigo)) = v_code LIMIT 1;

  IF NOT FOUND OR v_qr.ativo = false OR v_qr.estabelecimento_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_est
  FROM estabelecimentos
  WHERE id = v_qr.estabelecimento_id AND ativo = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT p_skip_scan THEN
    INSERT INTO scans (qr_code_id, estabelecimento_id, user_agent, ip, tipo)
    VALUES (v_qr.id, v_qr.estabelecimento_id, p_user_agent, p_ip, 'qr');
  END IF;

  IF v_est.filtro_estrelas_ativo = true THEN
    RETURN '/avaliar/' || v_est.id;
  END IF;

  RETURN v_est.link_google;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_qr_code(text, text, text, boolean) TO anon, authenticated;

-- 5. Função resolve_nfc_tag case-insensitive com suporte ao filtro
CREATE OR REPLACE FUNCTION resolve_nfc_tag(
  p_codigo text,
  p_user_agent text DEFAULT '',
  p_ip text DEFAULT '',
  p_skip_scan boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag nfc_tags%ROWTYPE;
  v_est estabelecimentos%ROWTYPE;
  v_code text;
BEGIN
  v_code := UPPER(TRIM(p_codigo));
  SELECT * INTO v_tag FROM nfc_tags WHERE UPPER(TRIM(nfc_tags.codigo)) = v_code LIMIT 1;

  IF NOT FOUND OR v_tag.ativo = false OR v_tag.estabelecimento_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_est
  FROM estabelecimentos
  WHERE id = v_tag.estabelecimento_id AND ativo = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT p_skip_scan THEN
    INSERT INTO scans (qr_code_id, nfc_tag_id, estabelecimento_id, user_agent, ip, tipo)
    VALUES (NULL, v_tag.id, v_tag.estabelecimento_id, p_user_agent, p_ip, 'nfc');
  END IF;

  IF v_est.filtro_estrelas_ativo = true THEN
    RETURN '/avaliar/' || v_est.id;
  END IF;

  RETURN v_est.link_google;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_nfc_tag(text, text, text, boolean) TO anon, authenticated;

-- 6. Função RPC get_avaliacao_publica para a tela de avaliação pública
CREATE OR REPLACE FUNCTION get_avaliacao_publica(p_estabelecimento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_est estabelecimentos%ROWTYPE;
BEGIN
  SELECT * INTO v_est
  FROM estabelecimentos
  WHERE id = p_estabelecimento_id AND ativo = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_est.id,
    'nome', v_est.nome,
    'link_google', v_est.link_google,
    'whatsapp', v_est.whatsapp,
    'telefone', v_est.telefone,
    'canal_queixas', COALESCE(v_est.canal_queixas, 'ambos'),
    'email_notificacao', COALESCE(v_est.email_notificacao, ''),
    'filtro_estrelas_ativo', COALESCE(v_est.filtro_estrelas_ativo, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_avaliacao_publica(uuid) TO anon, authenticated;
