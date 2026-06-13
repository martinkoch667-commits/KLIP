-- ─── KLIP — Run-all migration ────────────────────────────────────────────────
-- Safe to run multiple times. Run in Supabase SQL Editor.
-- Fixes Bug 1: workspace creation fails due to missing columns or RLS.

-- ── workspaces ───────────────────────────────────────────────────────────────
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS sector               TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS instagram_username   TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS company_description  TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS tone                 TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS words_to_use         TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS words_to_avoid       TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS caption_examples     TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS brand_voice_prompt   TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS description_style    TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS address_style        TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS primary_color        TEXT DEFAULT '#0038FF';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS secondary_color      TEXT DEFAULT '#FFFFFF';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS accent_color         TEXT DEFAULT '#C8F135';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS logo_dark_url        TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS brand_assets         TEXT[];
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS font_primary_url     TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS font_secondary       TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS font_secondary_url   TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS instagram_account_id TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS instagram_access_token TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS facebook_page_id     TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS instagram_connected_at TIMESTAMPTZ;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS custom_fonts         TEXT;

-- ── posts ─────────────────────────────────────────────────────────────────────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS texte_visuel          TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS exported_image_url    TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS editor_json           TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS instagram_post_id     TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_at          TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS caption_final         TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS caption_was_edited    BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT now();

-- ── activity_log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces ON DELETE CASCADE,
  action_type  TEXT NOT NULL,
  post_title   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own activity" ON activity_log;
CREATE POLICY "Users can view own activity" ON activity_log FOR SELECT
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own activity" ON activity_log;
CREATE POLICY "Users can insert own activity" ON activity_log FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

-- ── RLS: ensure workspaces INSERT is allowed ──────────────────────────────────
-- The base schema uses FOR ALL with USING only.
-- Re-create the policy to explicitly allow INSERT via WITH CHECK too.
DROP POLICY IF EXISTS "Users see own workspaces" ON workspaces;
CREATE POLICY "Users see own workspaces" ON workspaces
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── post_templates ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name             TEXT NOT NULL DEFAULT 'Template sans nom',
  format_id        TEXT NOT NULL DEFAULT 'ig-portrait',
  background_style JSONB NOT NULL DEFAULT '{"type":"gradient","angle":135,"colorFrom":"#0038FF","colorTo":"#FFFFFF"}'::jsonb,
  text_zones       JSONB NOT NULL DEFAULT '[]'::jsonb,
  logo_placement   JSONB DEFAULT NULL,
  thumbnail_url    TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_templates_workspace_idx ON post_templates(workspace_id);

CREATE OR REPLACE FUNCTION update_post_templates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS post_templates_updated_at ON post_templates;
CREATE TRIGGER post_templates_updated_at
  BEFORE UPDATE ON post_templates
  FOR EACH ROW EXECUTE FUNCTION update_post_templates_updated_at();

ALTER TABLE post_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own templates" ON post_templates;
CREATE POLICY "Users manage own templates" ON post_templates FOR ALL
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

-- ── posts: add template reference ─────────────────────────────────────────────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES post_templates(id) ON DELETE SET NULL;
