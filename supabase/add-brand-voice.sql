-- Run in Supabase SQL Editor
alter table workspaces add column if not exists brand_voice_prompt text;
alter table workspaces add column if not exists tone text;
alter table workspaces add column if not exists address_style text;
