-- Create Storage buckets for KLIP brand assets and fonts
-- Run this in the Supabase SQL Editor if buckets are missing

INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  ARRAY['image/png','image/jpeg','image/svg+xml','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true;

INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES (
  'brand-fonts',
  'brand-fonts',
  true,
  ARRAY['font/ttf','font/otf','font/woff','font/woff2','application/octet-stream']
)
ON CONFLICT (id) DO UPDATE
  SET public = true;

-- Storage RLS policies — allow authenticated users to upload to their own folder
-- brand-assets
CREATE POLICY "Users can upload brand assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Brand assets are publicly readable" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'brand-assets');

-- brand-fonts
CREATE POLICY "Users can upload brand fonts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-fonts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Brand fonts are publicly readable" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'brand-fonts');
