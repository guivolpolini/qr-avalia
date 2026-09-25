

-- ==========================================
-- MIGRATION: 20260917151402_create_qr_reviews_system.sql
-- ==========================================

/*
# Dynamic QR Code Review System — initial schema

Creates the core tables for a system that manages dynamic QR Codes
pointing to Google review links for establishments.

## Tables

1. `estabelecimentos` — establishments (clients) with their Google review links.
   - id (uuid, PK)
   - nome (text, not null) — establishment name
   - link_google (text, not null) — Google review URL
   - telefone (text) — phone number
   - endereco (text) — address
   - ativo (boolean, default true) — active/inactive status
   - created_at, updated_at (timestamps)

2. `qr_codes` — dynamic QR codes that redirect through the system.
   - id (uuid, PK)
   - codigo (text, unique, not null) — short human-readable identifier e.g. QR001
   - estabelecimento_id (uuid, FK nullable) — currently associated establishment
   - ativo (boolean, default true)
   - created_at, updated_at (timestamps)

3. `scans` — record of each QR code scan.
   - id (uuid, PK)
   - qr_code_id (uuid, FK)
   - estabelecimento_id (uuid, FK nullable) — establishment at time of scan
   - user_agent (text)
   - ip (text)
   - created_at (timestamp)

## Security

- RLS enabled on all tables.
- estabelecimentos / qr_codes / scans: admin-only CRUD for authenticated users.
  The redirect flow uses an RPC function (SECURITY DEFINER) so anon users can
  resolve a QR code and log a scan without direct table access.
- `resolve_qr_code` RPC: looks up a QR code by its short code, verifies it is
  active, records a scan, and returns the Google review link. callable by anon.

## Important notes

1. The frontend dashboard talks to Supabase as an authenticated admin.
2. The public /q/:codigo route calls the `resolve_qr_code` RPC (anon) so no
   direct table policy is needed for anon reads of qr_codes/estabelecimentos.
3. Scans are inserted server-side by the RPC, not by the browser.
*/

-- ── estabelecimentos ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estabelecimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  link_google text NOT NULL,
  telefone text DEFAULT '',
  endereco text DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE estabelecimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_estabelecimentos" ON estabelecimentos;
CREATE POLICY "admin_select_estabelecimentos" ON estabelecimentos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_estabelecimentos" ON estabelecimentos;
CREATE POLICY "admin_insert_estabelecimentos" ON estabelecimentos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_estabelecimentos" ON estabelecimentos;
CREATE POLICY "admin_update_estabelecimentos" ON estabelecimentos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_estabelecimentos" ON estabelecimentos;
CREATE POLICY "admin_delete_estabelecimentos" ON estabelecimentos
  FOR DELETE TO authenticated USING (true);

-- ── qr_codes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  estabelecimento_id uuid REFERENCES estabelecimentos(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_qr_codes" ON qr_codes;
CREATE POLICY "admin_select_qr_codes" ON qr_codes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_qr_codes" ON qr_codes;
CREATE POLICY "admin_insert_qr_codes" ON qr_codes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_qr_codes" ON qr_codes;
CREATE POLICY "admin_update_qr_codes" ON qr_codes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_qr_codes" ON qr_codes;
CREATE POLICY "admin_delete_qr_codes" ON qr_codes
  FOR DELETE TO authenticated USING (true);

-- ── scans ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id uuid NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  estabelecimento_id uuid REFERENCES estabelecimentos(id) ON DELETE SET NULL,
  user_agent text DEFAULT '',
  ip text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_scans" ON scans;
CREATE POLICY "admin_select_scans" ON scans
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_scans" ON scans;
CREATE POLICY "admin_insert_scans" ON scans
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_scans" ON scans;
CREATE POLICY "admin_update_scans" ON scans
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_scans" ON scans;
CREATE POLICY "admin_delete_scans" ON scans
  FOR DELETE TO authenticated USING (true);

-- ── indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_qr_codes_codigo ON qr_codes(codigo);
CREATE INDEX IF NOT EXISTS idx_scans_qr_code_id ON scans(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);

-- ── resolve_qr_code RPC (SECURITY DEFINER, anon-callable) ─────────
-- Looks up a QR code by its short code. If found and active and associated
-- with an establishment, inserts a scan row and returns the Google review
-- link. Otherwise returns null.
CREATE OR REPLACE FUNCTION resolve_qr_code(p_codigo text, p_user_agent text DEFAULT '', p_ip text DEFAULT '')
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

  INSERT INTO scans (qr_code_id, estabelecimento_id, user_agent, ip)
  VALUES (v_qr.id, v_qr.estabelecimento_id, p_user_agent, p_ip);

  RETURN v_link;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_qr_code(text, text, text) TO anon, authenticated;

-- ── updated_at trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_estabelecimentos_updated_at ON estabelecimentos;
CREATE TRIGGER trg_estabelecimentos_updated_at
  BEFORE UPDATE ON estabelecimentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_qr_codes_updated_at ON qr_codes;
CREATE TRIGGER trg_qr_codes_updated_at
  BEFORE UPDATE ON qr_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ==========================================
-- MIGRATION: 20260917155122_add_nfc_tags_module.sql
-- ==========================================

/*
# NFC Tags module — adds dynamic NFC tag management

## New Tables
- `nfc_tags`
  - id (uuid, PK)
  - codigo (text, unique, not null) — short identifier e.g. NFC001
  - estabelecimento_id (uuid, FK nullable) — associated establishment
  - url_dinamica (text, not null) — full dynamic URL e.g. https://domain.com/n/NFC001
  - ativo (boolean, default true)
  - created_at, updated_at (timestamps)

## Modified Tables
- `scans` — added two nullable columns to support NFC scans:
  - tipo (text, default 'qr') — 'qr' or 'nfc'
  - nfc_tag_id (uuid, FK to nfc_tags, nullable)

## New Functions
- `resolve_nfc_tag(p_codigo text, p_user_agent text, p_ip text)` — SECURITY DEFINER,
  anon-callable. Looks up an NFC tag by code, validates it is active and has an
  associated establishment, inserts a scan with tipo='nfc', and returns the
  Google review link. Returns NULL if not found, inactive, or unassociated.

## Security
- RLS enabled on nfc_tags, same admin-only CRUD pattern as qr_codes.
- resolve_nfc_tag is SECURITY DEFINER and granted to anon + authenticated.
- UNIQUE constraint on nfc_tags.codigo prevents duplicate codes.

## Important notes
1. The scans table now has a `tipo` column to distinguish QR vs NFC scans.
   Existing QR scans default to 'qr' (set via column default).
2. nfc_tag_id is nullable so existing QR scans are unaffected.
3. The url_dinamica column stores the full URL for convenience/reference; the
   redirect logic uses the codigo to resolve, same as QR codes.
*/

-- ── nfc_tags ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nfc_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  estabelecimento_id uuid REFERENCES estabelecimentos(id) ON DELETE SET NULL,
  url_dinamica text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nfc_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_nfc_tags" ON nfc_tags;
CREATE POLICY "admin_select_nfc_tags" ON nfc_tags
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_nfc_tags" ON nfc_tags;
CREATE POLICY "admin_insert_nfc_tags" ON nfc_tags
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_nfc_tags" ON nfc_tags;
CREATE POLICY "admin_update_nfc_tags" ON nfc_tags
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_nfc_tags" ON nfc_tags;
CREATE POLICY "admin_delete_nfc_tags" ON nfc_tags
  FOR DELETE TO authenticated USING (true);

-- ── Add NFC columns to scans ─────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scans' AND column_name = 'tipo') THEN
    ALTER TABLE scans ADD COLUMN tipo text NOT NULL DEFAULT 'qr';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scans' AND column_name = 'nfc_tag_id') THEN
    ALTER TABLE scans ADD COLUMN nfc_tag_id uuid REFERENCES nfc_tags(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill existing scans as 'qr' type
UPDATE scans SET tipo = 'qr' WHERE tipo IS NULL OR tipo = '';

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_nfc_tags_codigo ON nfc_tags(codigo);
CREATE INDEX IF NOT EXISTS idx_scans_nfc_tag_id ON scans(nfc_tag_id);
CREATE INDEX IF NOT EXISTS idx_scans_tipo ON scans(tipo);

-- ── updated_at trigger for nfc_tags ───────────────────────────────
DROP TRIGGER IF EXISTS trg_nfc_tags_updated_at ON nfc_tags;
CREATE TRIGGER trg_nfc_tags_updated_at
  BEFORE UPDATE ON nfc_tags
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── resolve_nfc_tag RPC (SECURITY DEFINER, anon-callable) ─────────
CREATE OR REPLACE FUNCTION resolve_nfc_tag(p_codigo text, p_user_agent text DEFAULT '', p_ip text DEFAULT '')
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

  INSERT INTO scans (qr_code_id, nfc_tag_id, estabelecimento_id, user_agent, ip, tipo)
  VALUES (NULL, v_tag.id, v_tag.estabelecimento_id, p_user_agent, p_ip, 'nfc');

  RETURN v_link;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_nfc_tag(text, text, text) TO anon, authenticated;


-- ==========================================
-- MIGRATION: 20260917160000_fix_scans_nfc_qr_code_id.sql
-- ==========================================

/*
# Fix: scans.qr_code_id blocking NFC scans

`scans.qr_code_id` was created as NOT NULL, but `resolve_nfc_tag` inserts
scans with `qr_code_id = NULL` (since an NFC scan has no associated QR
code). Every NFC scan insert was failing the NOT NULL constraint, so
`resolve_nfc_tag` always returned an error and every NFC redirect showed
"Tag NFC não disponível" even for valid, active tags.

This makes qr_code_id nullable, matching nfc_tag_id, since a scan row now
represents either a QR scan or an NFC scan.
*/

ALTER TABLE scans ALTER COLUMN qr_code_id DROP NOT NULL;


-- ==========================================
-- MIGRATION: 20260920180000_add_site_prompt_fields.sql
-- ==========================================

/*
# Campos para gerar prompt de site (Lovable / Base44)

Adiciona campos opcionais ao estabelecimento, usados só para montar
automaticamente um prompt de geração de site. Nenhum é obrigatório -
o cadastro básico (nome, link do Google) continua funcionando igual.
*/

ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS tipo_negocio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS descricao text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cardapio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cor_marca text DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram text DEFAULT '';


-- ==========================================
-- MIGRATION: 20260920190000_add_site_com_admin_field.sql
-- ==========================================

/*
# Campo: site com painel admin

Marca se o site gerado a partir do prompt deve incluir um painel
administrativo. Opcional, default false (a maioria dos sites simples
não precisa).
*/

ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS site_com_admin boolean DEFAULT false;


-- ==========================================
-- MIGRATION: 20260921000000_add_google_seo_status.sql
-- ==========================================

/*
# Google / SEO Local — status por estabelecimento

Cria a tabela que acompanha o trabalho de otimização do Google Business
de cada estabelecimento: links relevantes, checklist de otimização e
observações. Serve de base para um dashboard que mostra quais clientes
ainda precisam de atenção.

## Tabela

`google_seo_status`
- id (uuid, PK)
- estabelecimento_id (uuid, FK, unique) — um registro por estabelecimento
- url_google_business (text)
- url_google_maps (text)
- url_avaliacoes (text)
- checklist (jsonb) — objeto { chave: boolean } com os itens do checklist
- observacoes (text)
- created_at, updated_at (timestamps)

## Segurança

- RLS habilitado, mesmo padrão admin-only das demais tabelas do sistema
  (CRUD liberado para authenticated, nada para anon).
*/

CREATE TABLE IF NOT EXISTS google_seo_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id uuid NOT NULL UNIQUE REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  url_google_business text DEFAULT '',
  url_google_maps text DEFAULT '',
  url_avaliacoes text DEFAULT '',
  checklist jsonb NOT NULL DEFAULT '{}',
  observacoes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_seo_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_google_seo_status" ON google_seo_status;
CREATE POLICY "admin_select_google_seo_status" ON google_seo_status
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_google_seo_status" ON google_seo_status;
CREATE POLICY "admin_insert_google_seo_status" ON google_seo_status
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_google_seo_status" ON google_seo_status;
CREATE POLICY "admin_update_google_seo_status" ON google_seo_status
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_google_seo_status" ON google_seo_status;
CREATE POLICY "admin_delete_google_seo_status" ON google_seo_status
  FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_google_seo_status_estabelecimento_id ON google_seo_status(estabelecimento_id);

DROP TRIGGER IF EXISTS trg_google_seo_status_updated_at ON google_seo_status;
CREATE TRIGGER trg_google_seo_status_updated_at
  BEFORE UPDATE ON google_seo_status
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ==========================================
-- MIGRATION: 20260921024723_20260921000000_add_google_seo_status.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS google_seo_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id uuid NOT NULL UNIQUE REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  url_google_business text DEFAULT '',
  url_google_maps text DEFAULT '',
  url_avaliacoes text DEFAULT '',
  checklist jsonb NOT NULL DEFAULT '{}',
  observacoes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_seo_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_google_seo_status" ON google_seo_status;
CREATE POLICY "admin_select_google_seo_status" ON google_seo_status
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_google_seo_status" ON google_seo_status;
CREATE POLICY "admin_insert_google_seo_status" ON google_seo_status
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_google_seo_status" ON google_seo_status;
CREATE POLICY "admin_update_google_seo_status" ON google_seo_status
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_google_seo_status" ON google_seo_status;
CREATE POLICY "admin_delete_google_seo_status" ON google_seo_status
  FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_google_seo_status_estabelecimento_id ON google_seo_status(estabelecimento_id);

DROP TRIGGER IF EXISTS trg_google_seo_status_updated_at ON google_seo_status;
CREATE TRIGGER trg_google_seo_status_updated_at
  BEFORE UPDATE ON google_seo_status
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ==========================================
-- MIGRATION: 20260923191500_safe_code_generation_and_bot_filter.sql
-- ==========================================

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


-- ==========================================
-- MIGRATION: 20260925000000_add_prospects_module.sql
-- ==========================================

/*
# Módulo de Prospecção — tabela prospects

Cria a tabela `prospects` completamente isolada do sistema de QR Codes.
Não altera nenhuma tabela existente (estabelecimentos, qr_codes, nfc_tags, scans).

## Tabela: prospects

Armazena leads encontrados via Google Maps Scraper para prospecção comercial.

Campos:
- id (uuid, PK)
- business_name (text) — nome do estabelecimento
- category (text) — categoria do negócio
- address (text) — endereço completo
- phone (text) — telefone encontrado
- website (text) — site (vazio = sem site)
- google_maps_url (text) — URL do Google Maps
- rating (numeric 2,1) — avaliação média
- review_count (int) — quantidade de avaliações
- instagram (text) — perfil Instagram se encontrado
- source (text) — origem dos dados (default: 'google_maps')
- status (text) — Novo | contatado | interessado | cliente | nao_interessado
- notes (text) — observações manuais
- ultima_mensagem (text) — última mensagem WA gerada
- ultima_mensagem_em (timestamptz) — data da última mensagem
- phone_normalized (text, generated) — telefone apenas dígitos (deduplicação)
- created_at, updated_at (timestamps)

## Deduplicação
Índice único em (phone_normalized, lower(business_name)) quando phone != ''.
Permite ON CONFLICT DO NOTHING na importação.

## Segurança
RLS habilitado, mesmo padrão admin-only dos outros módulos.
*/

-- ── prospects ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  category text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  google_maps_url text NOT NULL DEFAULT '',
  rating numeric(3,1),
  review_count int NOT NULL DEFAULT 0,
  instagram text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'google_maps',
  status text NOT NULL DEFAULT 'novo'
    CHECK (status IN ('novo', 'contatado', 'interessado', 'cliente', 'nao_interessado')),
  notes text NOT NULL DEFAULT '',
  ultima_mensagem text NOT NULL DEFAULT '',
  ultima_mensagem_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_prospects" ON prospects;
CREATE POLICY "admin_select_prospects" ON prospects
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_prospects" ON prospects;
CREATE POLICY "admin_insert_prospects" ON prospects
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_prospects" ON prospects;
CREATE POLICY "admin_update_prospects" ON prospects
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_prospects" ON prospects;
CREATE POLICY "admin_delete_prospects" ON prospects
  FOR DELETE TO authenticated USING (true);

-- ── Índices ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_created_at ON prospects(created_at DESC);
-- Partial index para filtro "sem site"
CREATE INDEX IF NOT EXISTS idx_prospects_no_website ON prospects(created_at DESC)
  WHERE website = '';

-- ── Deduplicação via índice único ─────────────────────────────────
-- Cria coluna computada para normalizar o telefone (só dígitos)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prospects' AND column_name = 'phone_normalized'
  ) THEN
    ALTER TABLE prospects ADD COLUMN phone_normalized text
      GENERATED ALWAYS AS (regexp_replace(phone, '\D', '', 'g')) STORED;
  END IF;
END $$;

-- Índice único para deduplicação por telefone + nome (quando telefone disponível)
DROP INDEX IF EXISTS idx_prospects_dedup_phone;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_dedup_phone
  ON prospects (phone_normalized, lower(business_name))
  WHERE phone_normalized != '';

-- Índice único para deduplicação por google_maps_url (quando disponível)
DROP INDEX IF EXISTS idx_prospects_dedup_gmaps;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_dedup_gmaps
  ON prospects (google_maps_url)
  WHERE google_maps_url != '';

-- ── updated_at trigger ────────────────────────────────────────────
-- Reutiliza a função set_updated_at() já existente (criada na migration inicial)
DROP TRIGGER IF EXISTS trg_prospects_updated_at ON prospects;
CREATE TRIGGER trg_prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
