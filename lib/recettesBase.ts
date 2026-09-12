// LE CATALOGUE ÉLARGI : les recettes du code + celles de la base.
//
// POURQUOI CE MODULE EXISTE. `DESIGN_RECIPES` est une constante de fichier :
// solide, versionnée, relue en revue, mais figée jusqu'au prochain déploiement.
// L'atelier en produit des dizaines en un après-midi. Les deux doivent cohabiter
// sans que l'une remplace l'autre.
//
// LA RÈGLE DE PRÉSÉANCE, et elle n'est pas anodine : à identifiant égal, LA BASE
// GAGNE. C'est ce qui permet de corriger une composition fautive en production
// sans attendre une mise en ligne — on réécrit la ligne, le tirage suivant la
// sert corrigée. L'inverse (le code gagne) rendrait toute correction urgente
// impossible.
//
// CE QU'ON NE FAIT PAS ICI : lire la base à chaque appel de `pickDesignCandidates`.
// Cette fonction est synchrone, appelée plusieurs fois par génération, et le
// vivier n'a pas besoin d'être frais à la seconde. On charge, on garde un court
// instant, on relit.

import { DESIGN_RECIPES, type DesignRecipe, type DesignNode, type DesignSlot, type Vibe, type Intent } from './designSystem';

type Ligne = {
  recipe_id: string; name: string; family: string;
  vibe: string[] | null; intents: string[] | null; sectors: string[] | null;
  photo: string; description: string | null;
  nodes: unknown; slots: unknown;
};

/** Une ligne de base ne devient une recette que si son dessin tient debout.
 *  Une `nodes` vide ou mal formée casserait `buildDesignElements` au milieu
 *  d'une génération, chez un client, sans que rien ne dise d'où ça vient. */
function versRecette(l: Ligne): DesignRecipe | null {
  if (!Array.isArray(l.nodes) || l.nodes.length === 0) return null;
  if (!l.recipe_id || !l.name) return null;
  return {
    id: l.recipe_id,
    name: l.name,
    family: l.family || 'maison',
    vibe: (l.vibe ?? []) as Vibe[],
    intents: (l.intents ?? []) as Intent[],
    ...(l.sectors?.length ? { sectors: l.sectors } : {}),
    photo: (['required', 'optional', 'none'].includes(l.photo) ? l.photo : 'required') as DesignRecipe['photo'],
    desc: l.description ?? l.name,
    slots: (Array.isArray(l.slots) ? l.slots : []) as DesignSlot[],
    nodes: l.nodes as DesignNode[],
  };
}

type Cache = { at: number; recettes: DesignRecipe[] };
const caches = new Map<string, Cache>();
const DUREE = 60_000;

/**
 * Le catalogue servi à ce workspace : le code, plus les compositions de
 * portée `catalogue`, plus les siennes.
 *
 * `lire` reçoit la requête à exécuter pour que ce module reste sans dépendance
 * à Supabase : il est ainsi contrôlable hors ligne, et une panne de base ne
 * fait jamais tomber la génération — elle la ramène au catalogue du code, ce
 * qui est un repli parfaitement utilisable.
 */
export async function catalogueDe(
  workspaceId: string | null,
  lire: () => Promise<{ data: Ligne[] | null; error: unknown }>,
): Promise<DesignRecipe[]> {
  const cle = workspaceId ?? 'global';
  const vu = caches.get(cle);
  if (vu && Date.now() - vu.at < DUREE) return vu.recettes;

  let base: DesignRecipe[] = [];
  try {
    const { data, error } = await lire();
    if (error) throw error;
    base = (data ?? []).map(versRecette).filter((r): r is DesignRecipe => !!r);
  } catch (err) {
    // JAMAIS BLOQUANT. Le catalogue du code suffit à composer ; une base
    // injoignable doit dégrader le CHOIX, pas empêcher la génération.
    console.warn('[recettes] catalogue de base illisible, repli sur le code seul :', err);
    caches.set(cle, { at: Date.now(), recettes: DESIGN_RECIPES });
    return DESIGN_RECIPES;
  }

  // À identifiant égal, la base gagne.
  const parId = new Map<string, DesignRecipe>();
  for (const r of DESIGN_RECIPES) parId.set(r.id, r);
  for (const r of base) parId.set(r.id, r);

  const recettes = Array.from(parId.values());
  caches.set(cle, { at: Date.now(), recettes });
  return recettes;
}

/** À appeler après une écriture : sans ça l'atelier enregistre et rien ne change
 *  pendant une minute, ce qui se lit comme un bug. */
export function oublierCatalogue(workspaceId?: string | null): void {
  if (workspaceId === undefined) caches.clear();
  else caches.delete(workspaceId ?? 'global');
}
