-- 014_audio_storage_policies.sql
-- RLS pour le bucket "audio" (module Montage vidéo — musique / voix off).
-- Chemin d'upload: {workspaceId}/{uuid}.{ext} → même pattern que "videos"/"exports".
-- Run in Supabase SQL Editor.

DROP POLICY IF EXISTS "audio: upload to own workspace folder" ON storage.objects;
CREATE POLICY "audio: upload to own workspace folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'audio'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM workspaces WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "audio: public read" ON storage.objects;
CREATE POLICY "audio: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'audio');

DROP POLICY IF EXISTS "audio: owner update" ON storage.objects;
CREATE POLICY "audio: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'audio'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM workspaces WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "audio: owner delete" ON storage.objects;
CREATE POLICY "audio: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'audio'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM workspaces WHERE user_id = auth.uid()
  )
);
