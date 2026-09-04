import { ornementSvg } from '@/lib/ornaments';

export const runtime = 'edge';

// GET /api/ornement?id=fleche-courbe&color=%23FF4438
//
// Sert l'ornement en SVG depuis NOTRE origine, et c'est le point important :
// une image d'un autre domaine posée sur le canevas le rend « souillé », et
// l'export échoue alors tout à la fin, quand le montage est déjà fait.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const svg = ornementSvg(searchParams.get('id') || '', searchParams.get('color') || '#14160F');
  if (!svg) return new Response('Ornement inconnu', { status: 404 });

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // Le tracé ne change jamais pour un id et une couleur donnés.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
