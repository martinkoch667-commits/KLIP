-- Run this in Supabase SQL Editor to add all missing columns
-- Safe to run multiple times (IF NOT EXISTS)

-- Instagram / Meta connection
alter table workspaces add column if not exists instagram_account_id text;
alter table workspaces add column if not exists instagram_access_token text;
alter table workspaces add column if not exists instagram_username text;
alter table workspaces add column if not exists facebook_page_id text;
alter table workspaces add column if not exists instagram_connected_at timestamptz;

-- Brand voice / AI
alter table workspaces add column if not exists brand_voice_prompt text;
alter table workspaces add column if not exists company_description text;
alter table workspaces add column if not exists description_style text;
alter table workspaces add column if not exists caption_examples text;
alter table workspaces add column if not exists tone text;
alter table workspaces add column if not exists address_style text;

-- Custom fonts
alter table workspaces add column if not exists custom_fonts text;

-- Posts: extra columns
alter table posts add column if not exists texte_visuel text;
alter table posts add column if not exists exported_image_url text;
alter table posts add column if not exists editor_json text;
alter table posts add column if not exists instagram_post_id text;
alter table posts add column if not exists scheduled_at timestamptz;
