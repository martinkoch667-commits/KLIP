import { NextResponse } from 'next/server';
import { DESIGN_RECIPES } from '@/lib/designSystem';
import { declinerSerie } from '@/lib/variantesRecette';

// Banc du générateur de variantes. DÉVELOPPEMENT UNIQUEMENT.
//
// Il répond à la seule question qui décide si l'atelier de modèles est viable :
// à partir de N compositions, combien de déclinaisons SOLIDES sort-on vraiment ?
// Le rendement compte autant que le nombre : un générateur qui propose quatre
// variantes dont trois sont recalées par le contrôle géométrique ne tient pas
// la promesse « cinquante modèles, deux cents compositions ».
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  const url = new URL(request.url);
  const combien = Math.max(1, Math.min(60, Number(url.searchParams.get('base') ?? 12)));
  const par = Math.max(1, Math.min(8, Number(url.searchParams.get('par') ?? 4)));

  const base = DESIGN_RECIPES.filter(r => r.nodes.some(n => n.k === 'photo')).slice(0, combien);
  const t0 = Date.now();
  const variantes = declinerSerie(base, par);
  const ms = Date.now() - t0;

  const parModele: Record<string, number> = {};
  for (const v of variantes) {
    const racine = v.recette.id.replace(/-v\d+$/, '');
    parModele[racine] = (parModele[racine] ?? 0) + 1;
  }
  const gestes: Record<string, number> = {};
  for (const v of variantes) gestes[v.geste] = (gestes[v.geste] ?? 0) + 1;

  return NextResponse.json({
    base: base.length, demandeParModele: par,
    produites: variantes.length,
    rendement: Math.round((variantes.length / (base.length * par)) * 1000) / 10,
    ms,
    modelesSansAucuneVariante: base.filter(r => !parModele[r.id]).map(r => r.id),
    gestes,
    exemples: variantes.slice(0, 6).map(v => ({
      id: v.recette.id, nom: v.recette.name, geste: v.geste, emprunt: v.emprunt ?? null,
    })),
  });
}
