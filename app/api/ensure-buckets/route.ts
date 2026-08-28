import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/* Une vidéo de téléphone pèse lourd : trente secondes filmées en 4K par un
   iPhone dépassent facilement les 200 Mo. La limite par défaut de Supabase est
   de 50 Mo, et un fichier au-dessus est refusé — c'est ce qui faisait échouer
   l'import d'un simple .MOV. */
const TAILLE_MAX = '1024MB';

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
    /* Les MINIATURES vivent dans ce bucket, à côté de la vidéo qu'elles
       représentent. En n'y autorisant que des types vidéo, on faisait refuser
       leur envoi par le stockage — un 400 à chaque export. Le défaut ne s'était
       jamais vu tant que la liste n'était appliquée qu'à la création du bucket ;
       depuis qu'on met aussi à jour les buckets existants, elle mord. */
    allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'],
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
          fileSizeLimit: TAILLE_MAX,
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('already exists') || msg.includes('duplicate')) {
            /* Un bucket qui existe déjà gardait SA configuration d'origine, pour
               toujours. Ajouter un type accepté ou relever la taille limite ici
               n'avait donc aucun effet sur une installation existante : le code
               disait une chose, la production en appliquait une autre. On met à
               jour au lieu de constater. */
            const { error: errMaj } = await admin.storage.updateBucket(bucket.id, {
              public: bucket.public,
              allowedMimeTypes: bucket.allowedMimeTypes,
              fileSizeLimit: TAILLE_MAX,
            });
            results[bucket.id] = errMaj ? `already_exists (mise à jour refusée : ${errMaj.message})` : 'already_exists (mis à jour)';
            if (errMaj) console.error(`[ensure-buckets] ${bucket.id} mise à jour :`, errMaj.message);
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
