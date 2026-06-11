-- ─── Storage RLS policies for KLIP ───────────────────────────────────────────
-- Run in Supabase SQL Editor
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT guards where possible

-- ── brand-assets ─────────────────────────────────────────────────────────────
-- Upload path: {userId}/{uuid}.{ext}  →  first folder = auth.uid()

CREATE POLICY IF NOT EXISTS "brand-assets: authenticated upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'brand-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "brand-assets: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'brand-assets');

CREATE POLICY IF NOT EXISTS "brand-assets: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'brand-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "brand-assets: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'brand-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ── brand-fonts ───────────────────────────────────────────────────────────────
-- Upload path: {userId}/{uuid}.{ext}  →  first folder = auth.uid()

CREATE POLICY IF NOT EXISTS "brand-fonts: authenticated upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'brand-fonts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "brand-fonts: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'brand-fonts');

CREATE POLICY IF NOT EXISTS "brand-fonts: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'brand-fonts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ── exports ───────────────────────────────────────────────────────────────────
-- Upload path: {workspaceId}/{postId}-{timestamp}.png
-- Le premier dossier est workspaceId (pas userId) → on vérifie la propriété
-- du workspace via subquery

CREATE POLICY IF NOT EXISTS "exports: upload to own workspace folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'exports'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM workspaces WHERE user_id = auth.uid()
  )
);

CREATE POLICY IF NOT EXISTS "exports: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'exports');

CREATE POLICY IF NOT EXISTS "exports: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'exports'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM workspaces WHERE user_id = auth.uid()
  )
);

-- ── photos ────────────────────────────────────────────────────────────────────
-- Upload path assumed: {userId}/{uuid}.{ext}

CREATE POLICY IF NOT EXISTS "photos: authenticated upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "photos: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'photos');

CREATE POLICY IF NOT EXISTS "photos: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
