export const runtime = 'edge';

/* Banque d'images de l'éditeur.
   - Si PEXELS_API_KEY est défini → Pexels (meilleure qualité).
   - Sinon → Openverse (images libres, AUCUNE clé requise) en repli automatique.
   Le format de réponse reste identique : { photos: [{ id, src:{medium,large,original}, photographer, alt }], total_results }. */

const PER_PAGE = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || 'nature';
  const page = parseInt(searchParams.get('page') || '1', 10) || 1;

  const apiKey = process.env.PEXELS_API_KEY;

  // ── 1. Pexels si clé présente ─────────────────────────────────────────────
  if (apiKey) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${PER_PAGE}&page=${page}`,
        { headers: { Authorization: apiKey } }
      );
      if (res.ok) return Response.json(await res.json());
      // sinon on tombe sur le repli Openverse
    } catch {
      // repli Openverse
    }
  }

  // ── 2. Openverse (repli sans clé) ─────────────────────────────────────────
  try {
    const res = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${PER_PAGE}&page=${page}&mature=false`,
      { headers: { 'User-Agent': 'KLIP/1.0 (https://getklip.fr)' } }
    );
    if (!res.ok) throw new Error(`Openverse ${res.status}`);
    const data = await res.json();

    type OVResult = { id: string; title?: string; url?: string; thumbnail?: string; creator?: string };
    const photos = (data.results ?? [])
      .filter((r: OVResult) => r.url || r.thumbnail)
      .map((r: OVResult, i: number) => {
        const full = r.url || r.thumbnail!;
        const thumb = r.thumbnail || r.url!;
        return {
          id: r.id ?? `ov-${page}-${i}`,
          src: { medium: thumb, large: full, original: full, small: thumb, tiny: thumb },
          photographer: r.creator ?? 'Openverse',
          alt: r.title ?? query,
        };
      });

    return Response.json({
      photos,
      total_results: data.result_count ?? photos.length,
      page,
      per_page: PER_PAGE,
      source: 'openverse',
    });
  } catch (err) {
    return Response.json({ error: String(err), photos: [], total_results: 0 }, { status: 500 });
  }
}
