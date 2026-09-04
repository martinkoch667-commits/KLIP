import { NextRequest, NextResponse } from 'next/server';
import { chercherAssets, KINDS, type AssetSource, type AssetKind } from '@/lib/assetBanks';

// GET /api/assets?source=musee|iconscout&query=...&limit=24
//
// Enveloppe mince autour de `lib/assetBanks.ts`, où vivent les fournisseurs et
// leurs pièges. Tout ce qui est ici concerne HTTP, rien d'autre.

// Une recherche « musée » fait une requête par objet chez le Met : la valeur par
// défaut de 10 s d'une fonction Vercel est trop courte quand leur API traîne.
export const maxDuration = 30;

const SOURCES: AssetSource[] = ['musee', 'iconscout'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const brut = (searchParams.get('source') || 'musee') as AssetSource;
  const source = SOURCES.includes(brut) ? brut : 'musee';
  const query = (searchParams.get('query') || '').trim();
  // `per_page` d'IconScout monte à 200 (défaut 60). Le plafond de 48 qu'on
  // s'imposait n'avait aucune raison d'être : chercher ne coûte pas un crédit.
  const limit = Math.min(200, Math.max(4, parseInt(searchParams.get('limit') || '60', 10) || 60));
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const brutKind = (searchParams.get('kind') || 'illustration') as AssetKind;
  const kind: AssetKind = KINDS.some(k => k.id === brutKind) ? brutKind : 'illustration';

  const style = searchParams.get('style') || undefined;
  const gratuitSeul = searchParams.get('all') !== '1';

  // Une recherche « musée » sans mot-clé n'a pas de sens (le Met exige un terme),
  // mais IconScout parcourt tout son catalogue sans requête : c'est ce qui
  // remplit le panneau à l'ouverture.
  if (source === 'musee' && query.length < 2) return NextResponse.json({ items: [], erreurs: [] });

  try {
    const { items, erreurs } = await chercherAssets(source, query, limit, kind, style, gratuitSeul, page);
    // Les banques sont lentes et leur contenu ne bouge pas d'une minute à
    // l'autre : sans ce cache, chaque frappe dans le champ de recherche
    // repayait une seconde et demie d'attente et un crédit d'API.
    return NextResponse.json({ items, erreurs }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (e) {
    console.error('[assets] erreur :', e);
    return NextResponse.json({ items: [], erreurs: ['banque indisponible'] }, { status: 502 });
  }
}
