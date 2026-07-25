-- ─── Template de sous-titres par client — run in Supabase SQL Editor ────────
-- Safe to run multiple times (IF NOT EXISTS).
-- Stocke le style de sous-titres choisi à la création du client (ou dans les réglages).
-- Le montage lit cette valeur pour pré-appliquer le bon template (cf. charterSubDefault).
-- Valeurs = ids de SUB_STYLES : 'simple' | 'karaoke' | 'editorial' | 'clean' | 'mint'
--   | 'bold-white' | 'bold-yellow' | 'bold-mint' | 'bold-pink' | 'bold-blue'
--   | 'pill-black' | 'pill-acid' | 'pill-coral' | 'pill-violet'
alter table workspaces add column if not exists subtitle_style_id text;
