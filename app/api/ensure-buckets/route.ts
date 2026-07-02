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
  {
    id: 'photos',
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  },
  {
    id: 'exports',
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg'],
  },
  {
    id: 'videos',
    public: true,
    allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
  },
  {
    id: 'audio',
    public: true,
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-m4a', 'audio/mp4', 'audio/webm', 'audio/ogg'],
  },
];

export async function POST() {
  try {
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
      try {
        const { error } = await admin.storage.createBucket(bucket.id, {
          public: bucket.public,
          allowedMimeTypes: bucket.allowedMimeTypes,
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('already exists') || msg.includes('duplicate')) {
            results[bucket.id] = 'already_exists';
          } else {
            results[bucket.id] = `error: ${error.message}`;
            console.error(`[ensure-buckets] ${bucket.id}:`, error.message);
          }
        } else {
          results[bucket.id] = 'created';
        }
      } catch (bucketErr) {
        const msg = bucketErr instanceof Error ? bucketErr.message : String(bucketErr);
        results[bucket.id] = `exception: ${msg}`;
        console.error(`[ensure-buckets] ${bucket.id} threw:`, msg);
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ensure-buckets] fatal:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
