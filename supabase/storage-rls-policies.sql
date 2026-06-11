-- ─── Storage RLS policies for KLIP ───────────────────────────────────────────
-- Run in Supabase SQL Editor
-- Safe to re-run: DROP IF EXISTS before each CREATE

-- ── brand-assets ─────────────────────────────────────────────────────────────
-- Upload path: {userId}/{uuid}.{ext}  →  first folder = auth.uid()

DROP POLICY IF EXISTS "brand-assets: authenticated upload own folder" ON storage.objects;
CREATE POLICY "brand-assets: authenticated upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'brand-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "brand-assets: public read" ON storage.objects;
CREATE POLICY "brand-assets: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'brand-assets');

DROP POLICY IF EXISTS "brand-assets: owner update" ON storage.objects;
CREATE POLICY "brand-assets: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'brand-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "brand-assets: owner delete" ON storage.objects;
CREATE POLICY "brand-assets: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'brand-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ── brand-fonts ───────────────────────────────────────────────────────────────
-- Upload path: {userId}/{uuid}.{ext}  →  first folder = auth.uid()

DROP POLICY IF EXISTS "brand-fonts: authenticated upload own folder" ON storage.objects;
CREATE POLICY "brand-fonts: authenticated upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'brand-fonts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "brand-fonts: public read" ON storage.objects;
CREATE POLICY "brand-fonts: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'brand-fonts');

DROP POLICY IF EXISTS "brand-fonts: owner update" ON storage.objects;
CREATE POLICY "brand-fonts: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'brand-fonts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ── exports ───────────────────────────────────────────────────────────────────
-- Upload path: {workspaceId}/{postId}-{timestamp}.png
-- Le premier dossier est workspaceId (pas userId) → on vérifie la propriété
-- du workspace via subquery

DROP POLICY IF EXISTS "exports: upload to own workspace folder" ON storage.objects;
CREATE POLICY "exports: upload to own workspace folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'exports'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM workspaces WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "exports: public read" ON storage.objects;
CREATE POLICY "exports: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'exports');

DROP POLICY IF EXISTS "exports: owner delete" ON storage.objects;
CREATE POLICY "exports: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'exports'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM workspaces WHERE user_id = auth.uid()
  )
);

-- ── photos ────────────────────────────────────────────────────────────────────
-- Upload path assumed: {userId}/{uuid}.{ext}

DROP POLICY IF EXISTS "photos: authenticated upload own folder" ON storage.objects;
CREATE POLICY "photos: authenticated upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "photos: public read" ON storage.objects;
CREATE POLICY "photos: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'photos');

DROP POLICY IF EXISTS "photos: owner delete" ON storage.objects;
CREATE POLICY "photos: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
