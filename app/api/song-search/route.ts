export const runtime = 'edge';

/* Recherche de titres musicaux pour la "Note musicale" d'un post.
   IMPORTANT : la bibliothèque musicale d'Instagram (sons sous licence) n'est
   exposée par AUCUNE API publique. Ce endpoint sert un catalogue réel (iTunes,
   repli Deezer) pour choisir un titre + artiste et un extrait audio. Le son
   choisi est enregistré comme note ; il devra être ajouté côté app Instagram.
   Aucune clé requise, appels serveur-à-serveur (pas de souci CORS).
   Réponse : { songs: [{ id, title, artist, artwork, preview }] }. */

const LIMIT = 15;

type Song = { id: string; title: string; artist: string; artwork: string; preview: string };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return Response.json({ songs: [] });

  // ── 1. iTunes Search API (sans clé) ───────────────────────────────────────
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=${LIMIT}&country=FR`,
      { headers: { 'User-Agent': 'KLIP/1.0 (https://getklip.fr)' } }
    );
    if (res.ok) {
      const data = await res.json();
      type ITResult = { trackId?: number; trackName?: string; artistName?: string; artworkUrl100?: string; previewUrl?: string };
      const songs: Song[] = (data.results ?? [])
        .filter((r: ITResult) => r.trackName && r.artistName)
        .map((r: ITResult, i: number) => ({
          id: String(r.trackId ?? `it-${i}`),
          title: r.trackName!,
          artist: r.artistName!,
          artwork: (r.artworkUrl100 || '').replace('100x100bb', '200x200bb'),
          preview: r.previewUrl || '',
        }));
      if (songs.length) return Response.json({ songs, source: 'itunes' });
    }
  } catch { /* repli Deezer */ }

  // ── 2. Deezer (repli sans clé) ────────────────────────────────────────────
  try {
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${LIMIT}`);
    if (!res.ok) throw new Error(`Deezer ${res.status}`);
    const data = await res.json();
    type DZResult = { id?: number; title?: string; artist?: { name?: string }; album?: { cover_medium?: string }; preview?: string };
    const songs: Song[] = (data.data ?? [])
      .filter((r: DZResult) => r.title && r.artist?.name)
      .map((r: DZResult, i: number) => ({
        id: String(r.id ?? `dz-${i}`),
        title: r.title!,
        artist: r.artist!.name!,
        artwork: r.album?.cover_medium || '',
        preview: r.preview || '',
      }));
    return Response.json({ songs, source: 'deezer' });
  } catch (err) {
    return Response.json({ error: String(err), songs: [] }, { status: 500 });
  }
}
