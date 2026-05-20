-- Run in Supabase SQL Editor to add scheduling support
alter table posts add column if not exists scheduled_at timestamptz;
