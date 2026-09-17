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
