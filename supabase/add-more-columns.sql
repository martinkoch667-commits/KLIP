-- Run in Supabase SQL Editor
alter table posts add column if not exists instagram_post_id text;
alter table workspaces add column if not exists instagram_connected_at timestamptz;
