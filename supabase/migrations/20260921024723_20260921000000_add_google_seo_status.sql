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
