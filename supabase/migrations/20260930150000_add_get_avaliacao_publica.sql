-- 1. Colunas do filtro e canal de queixas (garantia caso ainda não rodou)
ALTER TABLE estabelecimentos ADD COLUMN IF NOT EXISTS filtro_estrelas_ativo boolean NOT NULL DEFAULT false;
ALTER TABLE estabelecimentos ADD COLUMN IF NOT EXISTS canal_queixas text DEFAULT 'ambos';
ALTER TABLE estabelecimentos ADD COLUMN IF NOT EXISTS email_notificacao text DEFAULT '';

-- 2. Limpeza de funções sobrecarregadas antigas (3 parâmetros) para evitar erro PGRST203
DROP FUNCTION IF EXISTS public.resolve_nfc_tag(text, text, text);
DROP FUNCTION IF EXISTS public.resolve_qr_code(text, text, text);

-- 3. Permissão de SELECT para clientes anônimos lerem estabelecimentos ativos
DROP POLICY IF EXISTS "public_select_active_estabelecimentos" ON estabelecimentos;
CREATE POLICY "public_select_active_estabelecimentos" ON estabelecimentos
  FOR SELECT TO anon
  USING (ativo = true);

-- 3. Função RPC de segurança para carregar a tela de avaliação pública sem bloqueio de RLS
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
