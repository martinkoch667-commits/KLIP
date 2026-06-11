-- ─── Brand charter columns — run in Supabase SQL Editor ─────────────────────
-- Safe to run multiple times (IF NOT EXISTS)

-- Étape 1 — Infos de base
alter table workspaces add column if not exists sector text;
-- Values: 'Restaurant' | 'Café' | 'Retail' | 'Mode' | 'Beauté' | 'Sport' | 'Tech' | 'Autre'

-- Étape 2 — Voix de marque (stored separately for precise AI injection)
alter table workspaces add column if not exists words_to_use   text;
alter table workspaces add column if not exists words_to_avoid text;
-- Note: tone, caption_examples already exist

-- Étape 3 — Identité visuelle
alter table workspaces add column if not exists accent_color   text default '#C8F135';
alter table workspaces add column if not exists logo_dark_url  text;
alter table workspaces add column if not exists brand_assets   jsonb default '[]'::jsonb;
-- brand_assets: JSON array of public URLs, max 5

-- Étape 4 — Typographie
alter table workspaces add column if not exists font_secondary     text;
alter table workspaces add column if not exists font_primary_url   text; -- Supabase Storage: brand-fonts bucket
alter table workspaces add column if not exists font_secondary_url text;
-- Note: font_family (primary) already exists

-- ─── Storage buckets — run separately ───────────────────────────────────────

-- Bucket for logos, brand assets, visual assets
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;

create policy "Users can upload brand assets" on storage.objects
  for insert with check (bucket_id = 'brand-assets' and auth.role() = 'authenticated');

create policy "Brand assets are public" on storage.objects
  for select using (bucket_id = 'brand-assets');

create policy "Users can update brand assets" on storage.objects
  for update using (bucket_id = 'brand-assets' and auth.role() = 'authenticated');

create policy "Users can delete brand assets" on storage.objects
  for delete using (bucket_id = 'brand-assets' and auth.role() = 'authenticated');

-- Bucket for custom font files
insert into storage.buckets (id, name, public)
values ('brand-fonts', 'brand-fonts', true)
on conflict (id) do nothing;

create policy "Users can upload brand fonts" on storage.objects
  for insert with check (bucket_id = 'brand-fonts' and auth.role() = 'authenticated');

create policy "Brand fonts are public" on storage.objects
  for select using (bucket_id = 'brand-fonts');

create policy "Users can update brand fonts" on storage.objects
  for update using (bucket_id = 'brand-fonts' and auth.role() = 'authenticated');

create policy "Users can delete brand fonts" on storage.objects
  for delete using (bucket_id = 'brand-fonts' and auth.role() = 'authenticated');
