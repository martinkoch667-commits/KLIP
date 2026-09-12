import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { controlerRecette } from '@/lib/controleRecettes';
import { oublierCatalogue } from '@/lib/recettesBase';
import type { DesignRecipe } from '@/lib/designSystem';

/* POST /api/atelier/enregistrer — ce que l'humain a RETENU entre dans le vivier.
 *
 * LE CONTRÔLE EST REFAIT ICI, même si l'atelier l'a déjà fait avant d'afficher.
 * Le client envoie ce qu'il veut ; une composition fautive écrite en base serait
 * servie à des clients jusqu'à ce que quelqu'un la retrouve à la main. La règle
 * du projet vaut ici comme ailleurs : ce qui protège doit être du côté serveur.
 *
 * LA PORTÉE RESTE 'client'. Faire entrer une composition dans le catalogue de
 * TOUT LE MONDE n'est pas une opération d'interface : la politique RLS
 * l'interdit explicitement à un utilisateur. Ça se décide, et ça se fait avec la
 * clé de service. */
export async function POST(request: NextRequest) {
  try {
    const sb = createRouteHandlerClient({ cookies });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const { workspaceId, recettes } = await request.json();
    if (typeof workspaceId !== 'string' || !workspaceId) {
      return NextResponse.json({ error: 'workspaceId requis' }, { status: 400 });
    }
    if (!Array.isArray(recettes) || recettes.length === 0) {
      return NextResponse.json({ error: 'Aucune composition à enregistrer' }, { status: 400 });
    }

    const lignes: Record<string, unknown>[] = [];
    const refusees: { id: string; raison: string }[] = [];

    for (const item of recettes.slice(0, 400)) {
      const r = item?.recette as DesignRecipe | undefined;
      if (!r?.id || !Array.isArray(r.nodes) || r.nodes.length === 0) {
        refusees.push({ id: String(r?.id ?? '?'), raison: 'dessin vide ou illisible' });
        continue;
      }
      const fautes = controlerRecette(r);
      if (fautes.length) { refusees.push({ id: r.id, raison: fautes[0].detail }); continue; }

      lignes.push({
        recipe_id: r.id, name: r.name, family: r.family || 'maison',
        vibe: r.vibe ?? [], intents: r.intents ?? [],
        ...(r.sectors?.length ? { sectors: r.sectors } : {}),
        photo: r.photo ?? 'required', description: r.desc ?? r.name,
        nodes: r.nodes, slots: r.slots ?? [],
        source: item?.geste ? 'variante' : 'atelier',
        parent_id: item?.parent ?? null,
        geste: item?.geste ?? null,
        portee: 'client',
        workspace_id: workspaceId,
        active: true,
      });
    }

    if (!lignes.length) {
      return NextResponse.json({ error: 'Toutes les compositions ont été refusées', refusees }, { status: 400 });
    }

    // `upsert` et non `insert` : relancer l'atelier après avoir corrigé un
    // modèle doit REMPLACER sa composition, pas en créer une seconde sous un
    // identifiant voisin que plus personne ne saurait distinguer.
    const { data, error } = await sb.from('design_recipes')
      .upsert(lignes, { onConflict: 'recipe_id' })
      .select('recipe_id');

    if (error) return NextResponse.json({ error: error.message, refusees }, { status: 500 });

    // Sans ça l'atelier enregistre et le compositeur sert l'ancien vivier
    // pendant une minute, ce qui se lit comme un bug.
    oublierCatalogue(workspaceId);
    oublierCatalogue(null);

    return NextResponse.json({ enregistrees: data?.length ?? 0, refusees });
  } catch (e) {
    console.error('[atelier/enregistrer]', e);
    return NextResponse.json({ error: 'Enregistrement échoué' }, { status: 500 });
  }
}
