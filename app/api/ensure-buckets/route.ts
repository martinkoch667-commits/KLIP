import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BUCKETS: { id: string; public: boolean; allowedMimeTypes: string[] }[] = [
  {
    id: 'brand-assets',
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/gif'],
  },
  {
    id: 'brand-fonts',
    public: true,
    allowedMimeTypes: [
      'font/ttf', 'font/otf', 'font/woff', 'font/woff2',
      'application/octet-stream', 'application/font-woff',
      'application/font-woff2', 'application/x-font-ttf',
      'application/x-font-otf',
    ],
  },
];

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 },
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results: Record<string, string> = {};

  for (const bucket of BUCKETS) {
    const { error } = await admin.storage.createBucket(bucket.id, {
      public: bucket.public,
      allowedMimeTypes: bucket.allowedMimeTypes,
    });

    if (error) {
      // "already exists" is not a real error
      if (error.message.toLowerCase().includes('already exists')) {
        results[bucket.id] = 'already_exists';
      } else {
        results[bucket.id] = `error: ${error.message}`;
        console.error(`[ensure-buckets] ${bucket.id}:`, error.message);
      }
    } else {
      results[bucket.id] = 'created';
    }
  }

  return NextResponse.json({ ok: true, results });
}
