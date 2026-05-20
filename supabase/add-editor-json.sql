-- Run in Supabase SQL Editor
alter table posts add column if not exists editor_json jsonb;
