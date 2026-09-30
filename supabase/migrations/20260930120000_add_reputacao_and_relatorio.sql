/*
# Migração: Escudo de Reputação (Filtro 5 Estrelas) e Relatórios de Desempenho

1. Adiciona coluna `filtro_estrelas_ativo` na tabela `estabelecimentos` (default false).
2. Atualiza `resolve_qr_code` e `resolve_nfc_tag` para retornar a rota interna `/avaliar/{id}`
   quando o estabelecimento tiver o filtro de 5 estrelas ativo.
3. Cria a função `get_relatorio_publico` (SECURITY DEFINER) para permitir que a rota pública `/r/{id}`
   consulte estatísticas agregadas de scans de forma segura, sem expor IPs ou User-Agents.
*/

-- 1. Coluna de filtro de estrelas
ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS filtro_estrelas_ativo boolean NOT NULL DEFAULT false;

-- 2. Atualizar resolve_qr_code com verificação do filtro
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
  v_link text;
BEGIN
  SELECT * INTO v_qr FROM qr_codes WHERE qr_codes.codigo = p_codigo LIMIT 1;

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

  -- Se o filtro 5 estrelas estiver ativado, direciona para a tela de avaliação interna
  IF v_est.filtro_estrelas_ativo = true THEN
    RETURN '/avaliar/' || v_est.id;
  END IF;

  RETURN v_est.link_google;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_qr_code(text, text, text, boolean) TO anon, authenticated;

-- 3. Atualizar resolve_nfc_tag com verificação do filtro
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
  v_link text;
BEGIN
  SELECT * INTO v_tag FROM nfc_tags WHERE nfc_tags.codigo = p_codigo LIMIT 1;

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

  -- Se o filtro 5 estrelas estiver ativado, direciona para a tela de avaliação interna
  IF v_est.filtro_estrelas_ativo = true THEN
    RETURN '/avaliar/' || v_est.id;
  END IF;

  RETURN v_est.link_google;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_nfc_tag(text, text, text, boolean) TO anon, authenticated;

-- 4. Função pública de estatísticas agregadas de estabelecimento para o Relatório Web
CREATE OR REPLACE FUNCTION get_relatorio_publico(p_estabelecimento_id uuid, p_dias integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_est estabelecimentos%ROWTYPE;
  v_total_scans integer;
  v_total_qr integer;
  v_total_nfc integer;
  v_inicio timestamptz;
  v_resumo jsonb;
BEGIN
  SELECT * INTO v_est FROM estabelecimentos WHERE id = p_estabelecimento_id AND ativo = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_inicio := CASE
    WHEN p_dias > 0 THEN now() - (p_dias || ' days')::interval
    ELSE '2020-01-01'::timestamptz
  END;

  SELECT COUNT(*) INTO v_total_scans
  FROM scans
  WHERE estabelecimento_id = p_estabelecimento_id AND created_at >= v_inicio;

  SELECT COUNT(*) INTO v_total_qr
  FROM scans
  WHERE estabelecimento_id = p_estabelecimento_id AND tipo = 'qr' AND created_at >= v_inicio;

  SELECT COUNT(*) INTO v_total_nfc
  FROM scans
  WHERE estabelecimento_id = p_estabelecimento_id AND tipo = 'nfc' AND created_at >= v_inicio;

  v_resumo := jsonb_build_object(
    'estabelecimento', jsonb_build_object(
      'id', v_est.id,
      'nome', v_est.nome,
      'link_google', v_est.link_google,
      'whatsapp', v_est.whatsapp,
      'cor_marca', v_est.cor_marca
    ),
    'periodo_dias', p_dias,
    'total_scans', v_total_scans,
    'total_qr', v_total_qr,
    'total_nfc', v_total_nfc
  );

  RETURN v_resumo;
END;
$$;

GRANT EXECUTE ON FUNCTION get_relatorio_publico(uuid, integer) TO anon, authenticated;
