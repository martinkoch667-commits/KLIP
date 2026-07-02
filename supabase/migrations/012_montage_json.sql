-- 012_montage_json.sql
-- Colonne de state pour le module "Montage vidéo" (mirrors editor_json des posts image).
alter table public.posts
  add column if not exists montage_json jsonb;
