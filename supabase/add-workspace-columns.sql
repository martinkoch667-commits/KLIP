-- ─── Add missing columns to workspaces table ─────────────────────────────────
-- Run in Supabase SQL Editor — safe to re-run (IF NOT EXISTS)

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS sector              TEXT,
  ADD COLUMN IF NOT EXISTS instagram_username  TEXT,
  ADD COLUMN IF NOT EXISTS company_description TEXT,
  ADD COLUMN IF NOT EXISTS tone                TEXT,
  ADD COLUMN IF NOT EXISTS words_to_use        TEXT,
  ADD COLUMN IF NOT EXISTS words_to_avoid      TEXT,
  ADD COLUMN IF NOT EXISTS caption_examples    TEXT,
  ADD COLUMN IF NOT EXISTS brand_voice_prompt  TEXT,
  ADD COLUMN IF NOT EXISTS description_style   TEXT,
  ADD COLUMN IF NOT EXISTS primary_color       TEXT    DEFAULT '#0038FF',
  ADD COLUMN IF NOT EXISTS secondary_color     TEXT    DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS accent_color        TEXT    DEFAULT '#C8F135',
  ADD COLUMN IF NOT EXISTS logo_url            TEXT,
  ADD COLUMN IF NOT EXISTS logo_dark_url       TEXT,
  ADD COLUMN IF NOT EXISTS brand_assets        TEXT[],
  ADD COLUMN IF NOT EXISTS font_family         TEXT    DEFAULT 'Oswald',
  ADD COLUMN IF NOT EXISTS font_primary_url    TEXT,
  ADD COLUMN IF NOT EXISTS font_secondary      TEXT,
  ADD COLUMN IF NOT EXISTS font_secondary_url  TEXT,
  ADD COLUMN IF NOT EXISTS instagram_account_id TEXT,
  ADD COLUMN IF NOT EXISTS instagram_access_token TEXT;
