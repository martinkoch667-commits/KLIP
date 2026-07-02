-- 013_videos_storage_policies.sql
-- RLS pour le bucket "videos" (module Montage vidéo).
-- Chemin d'upload: {workspaceId}/{uuid}.{ext} → même pattern que le bucket "exports".
-- Run in Supabase SQL Editor.

DROP POLICY IF EXISTS "videos: upload to own workspace folder" ON storage.objects;
CREATE POLICY "videos: upload to own workspace folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'videos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM workspaces WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "videos: public read" ON storage.objects;
CREATE POLICY "videos: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos: owner update" ON storage.objects;
CREATE POLICY "videos: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'videos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM workspaces WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "videos: owner delete" ON storage.objects;
CREATE POLICY "videos: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'videos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM workspaces WHERE user_id = auth.uid()
  )
);
