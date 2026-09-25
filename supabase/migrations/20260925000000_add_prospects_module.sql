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
