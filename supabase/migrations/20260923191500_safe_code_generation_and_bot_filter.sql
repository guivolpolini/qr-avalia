/*
# Fase 1: Geração segura de códigos em lote e filtro anti-bot

1. Atualização de resolve_qr_code e resolve_nfc_tag:
   - Adiciona parâmetro opcional p_skip_scan (boolean DEFAULT false).
   - Quando p_skip_scan for true, o link é resolvido normalmente, mas o scan NÃO é gravado.
   - Isso evita contagens fantasmas de bots de pré-visualização (WhatsApp, Telegram, etc).

2. Criação da RPC gerar_placas_lote:
   - Resolve o bug da ordenação lexicográfica ('QR99' > 'QR100') calculando o número máximo
     diretamente no PostgreSQL através de conversão numérica:
     MAX(NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')::integer)
   - Executa a inserção em uma única transação atômica, evitando race conditions.
*/

-- ── 1. resolve_qr_code com suporte a skip_scan ────────────────────
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
  v_link text;
BEGIN
  SELECT * INTO v_qr FROM qr_codes WHERE qr_codes.codigo = p_codigo LIMIT 1;

  IF NOT FOUND OR v_qr.ativo = false OR v_qr.estabelecimento_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT link_google INTO v_link
  FROM estabelecimentos
  WHERE id = v_qr.estabelecimento_id AND ativo = true
  LIMIT 1;

  IF v_link IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT p_skip_scan THEN
    INSERT INTO scans (qr_code_id, estabelecimento_id, user_agent, ip, tipo)
    VALUES (v_qr.id, v_qr.estabelecimento_id, p_user_agent, p_ip, 'qr');
  END IF;

  RETURN v_link;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_qr_code(text, text, text, boolean) TO anon, authenticated;

-- ── 2. resolve_nfc_tag com suporte a skip_scan ────────────────────
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
  v_link text;
BEGIN
  SELECT * INTO v_tag FROM nfc_tags WHERE nfc_tags.codigo = p_codigo LIMIT 1;

  IF NOT FOUND OR v_tag.ativo = false OR v_tag.estabelecimento_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT link_google INTO v_link
  FROM estabelecimentos
  WHERE id = v_tag.estabelecimento_id AND ativo = true
  LIMIT 1;

  IF v_link IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT p_skip_scan THEN
    INSERT INTO scans (qr_code_id, nfc_tag_id, estabelecimento_id, user_agent, ip, tipo)
    VALUES (NULL, v_tag.id, v_tag.estabelecimento_id, p_user_agent, p_ip, 'nfc');
  END IF;

  RETURN v_link;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_nfc_tag(text, text, text, boolean) TO anon, authenticated;

-- ── 3. RPC para geração segura e atômica de placas em lote ─────────
CREATE OR REPLACE FUNCTION gerar_placas_lote(
  p_tipo text, -- 'qr', 'nfc', ou 'ambos'
  p_quantidade int,
  p_estabelecimento_id uuid DEFAULT NULL,
  p_base_url text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_qr int := 0;
  v_max_nfc int := 0;
  v_start int := 0;
  v_i int;
  v_sufixo text;
  v_codigo text;
  v_url text;
  v_base text;
  v_criados int := 0;
BEGIN
  IF p_quantidade < 1 OR p_quantidade > 200 THEN
    RAISE EXCEPTION 'A quantidade deve ser entre 1 e 200.';
  END IF;

  v_base := rtrim(p_base_url, '/');
  IF v_base = '' THEN
    v_base := 'https://qr-avalia.vercel.app';
  END IF;

  -- Obter maior número sequencial real (numérico)
  SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')::integer), 0)
  INTO v_max_qr
  FROM qr_codes;

  SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')::integer), 0)
  INTO v_max_nfc
  FROM nfc_tags;

  IF p_tipo = 'ambos' THEN
    v_start := GREATEST(v_max_qr, v_max_nfc);

    FOR v_i IN 1..p_quantidade LOOP
      v_sufixo := lpad((v_start + v_i)::text, 3, '0');
      v_url := v_base || '/n/NFC' || v_sufixo;

      INSERT INTO qr_codes (codigo, ativo, estabelecimento_id)
      VALUES ('QR' || v_sufixo, true, p_estabelecimento_id);

      INSERT INTO nfc_tags (codigo, url_dinamica, ativo, estabelecimento_id)
      VALUES ('NFC' || v_sufixo, v_url, true, p_estabelecimento_id);

      v_criados := v_criados + 1;
    END LOOP;

  ELSIF p_tipo = 'qr' THEN
    v_start := v_max_qr;

    FOR v_i IN 1..p_quantidade LOOP
      v_sufixo := lpad((v_start + v_i)::text, 3, '0');
      INSERT INTO qr_codes (codigo, ativo, estabelecimento_id)
      VALUES ('QR' || v_sufixo, true, p_estabelecimento_id);

      v_criados := v_criados + 1;
    END LOOP;

  ELSIF p_tipo = 'nfc' THEN
    v_start := v_max_nfc;

    FOR v_i IN 1..p_quantidade LOOP
      v_sufixo := lpad((v_start + v_i)::text, 3, '0');
      v_url := v_base || '/n/NFC' || v_sufixo;

      INSERT INTO nfc_tags (codigo, url_dinamica, ativo, estabelecimento_id)
      VALUES ('NFC' || v_sufixo, v_url, true, p_estabelecimento_id);

      v_criados := v_criados + 1;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'Tipo inválido. Use "qr", "nfc" ou "ambos".';
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'tipo', p_tipo,
    'quantidade', v_criados,
    'inicio', v_start + 1,
    'fim', v_start + v_criados
  );
END;
$$;

GRANT EXECUTE ON FUNCTION gerar_placas_lote(text, int, uuid, text) TO authenticated;
