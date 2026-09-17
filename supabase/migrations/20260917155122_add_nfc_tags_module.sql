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
