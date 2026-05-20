-- Run in Supabase SQL Editor to add Instagram/Facebook connection support
alter table workspaces add column if not exists instagram_account_id text;
alter table workspaces add column if not exists instagram_access_token text;
alter table workspaces add column if not exists instagram_username text;
alter table workspaces add column if not exists facebook_page_id text;
