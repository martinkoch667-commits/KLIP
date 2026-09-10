import { NextResponse } from 'next/server';
import { DESIGN_RECIPES, type DesignRecipe, type TextNode } from '@/lib/designSystem';
import { controlerCatalogue, controlerRecette } from '@/lib/controleRecettes';

// Runner du contrôle géométrique. DÉVELOPPEMENT UNIQUEMENT : il n'expose rien de
// sensible, mais une route non authentifiée n'a rien à faire en production.
//
// Le contrôle lui-même vit dans `lib/controleRecettes.ts` et ne dépend ni du DOM
// ni du réseau : il a vocation à être appelé AU RENDU, pour qu'une recette
// fautive ne soit jamais proposée. Cette route ne sert qu'à obtenir le chiffre.
export const dynamic = 'force-dynamic';

/* LES TÉMOINS, et pourquoi ils sont ici plutôt que dans un test à part.
 *
 * Un contrôle qui ne signale rien peut être un catalogue sain ou un contrôle
 * mort, et de l'extérieur les deux se ressemblent exactement. C'est l'erreur que
 * le banc du juge avait déjà nommée : « un juge qui garde tout est aussi inutile
 * qu'un juge qui rejette tout ». On sabote donc une recette saine avec les deux
 * défauts que le banc utilise déjà, et le contrôle DOIT les voir. Le rapport
 * porte sa propre preuve de vie. */
function temoins(): { defaut: string; vu: boolean }[] {
  const base = DESIGN_RECIPES.find(r =>
    r.nodes.filter(n => n.k === 'text' && n.role).length >= 2 && controlerRecette(r).length === 0);
  if (!base) return [{ defaut: 'aucune recette saine à saboter', vu: false }];

  const textes = base.nodes.filter((n): n is TextNode => n.k === 'text' && !!n.role);

  // 8 px sur 1080 : le défaut que le palier rapide ne voyait pas.
  const bord: DesignRecipe = { ...base, id: `${base.id}#bord`,
    nodes: base.nodes.map(n => n === textes[0] ? { ...n, x: 8 / 1080, align: 'left' as const } : n) };

  // Le second texte posé sur le premier : chevauchement accidentel.
  const chev: DesignRecipe = { ...base, id: `${base.id}#chev`,
    nodes: base.nodes.map(n => n === textes[1] ? { ...n, x: textes[0].x, y: textes[0].y } : n) };

  return [
    { defaut: `texte-au-bord (8 px) sur ${base.id}`, vu: controlerRecette(bord).some(f => f.type === 'texte-au-bord') },
    { defaut: `chevauchement sur ${base.id}`, vu: controlerRecette(chev).some(f => f.type === 'chevauchement') },
  ];
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  return NextResponse.json({ ...controlerCatalogue(), temoins: temoins() });
}
