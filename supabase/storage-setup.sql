-- ─── Bucket photos ────────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true);

-- Authenticated users can upload photos
create policy "Users can upload photos" on storage.objects
  for insert with check (
    bucket_id = 'photos'
    and auth.role() = 'authenticated'
  );

-- Photos are publicly readable
create policy "Photos are public" on storage.objects
  for select using (bucket_id = 'photos');

-- Users can update their own photos
create policy "Users can update photos" on storage.objects
  for update using (
    bucket_id = 'photos'
    and auth.role() = 'authenticated'
  );

-- Users can delete their own photos
create policy "Users can delete photos" on storage.objects
  for delete using (
    bucket_id = 'photos'
    and auth.role() = 'authenticated'
  );
