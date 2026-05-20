-- Run in Supabase SQL Editor
alter table posts add column if not exists exported_image_url text;
