import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// POST /api/brand-dna/adopt
//
// Le chaînon qui manquait. `/api/brand-dna/templates` savait déjà PROPOSER des
// modèles tirés du fil Instagram d'une marque, mais rien ne les enregistrait :
// la route n'était appelée que depuis `/banc-adn`, et ses propositions
// mouraient à la fermeture de l'onglet. Résultat, un client fraîchement créé
// n'avait AUCUN modèle, et le compositeur tirait au sort dans le catalogue
// général au lieu de partir de ce que la marque publie déjà.
//
// Cette route prend les propositions retenues et les écrit dans
// `post_templates`, c'est-à-dire là où le produit va déjà chercher les modèles
// du client : le compositeur les privilégie (`styleRef`), l'éditeur les ouvre,
// et la personne ne repart plus de zéro.

export const runtime = 'nodejs';

type Proposition = {
  recipeId?: unknown;
  name?: unknown;
  intention?: unknown;
  format_id?: unknown;
  elements?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const sb = createRouteHandlerClient({ cookies });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await request.json();
    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : '';
    const props: Proposition[] = Array.isArray(body?.templates) ? body.templates : [];
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId requis' }, { status: 400 });
    if (!props.length) return NextResponse.json({ error: 'aucune proposition' }, { status: 400 });

    // Le workspace doit appartenir à qui demande : sans ce contrôle, un
    // identifiant deviné suffirait à écrire des modèles chez un autre client.
    const { data: ws } = await sb.from('workspaces').select('id').eq('id', workspaceId).single();
    if (!ws) return NextResponse.json({ error: 'Workspace introuvable' }, { status: 404 });

    // On ne remplace jamais ce qui existe : ces modèles s'AJOUTENT. Un client
    // qui a déjà travaillé ses gabarits ne doit pas les voir disparaître parce
    // qu'il a reconnecté son compte Instagram.
    const { data: deja } = await sb
      .from('post_templates')
      .select('sort_order')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: false })
      .limit(1);
    let rang = (deja?.[0]?.sort_order ?? 0) as number;

    const lignes = props.flatMap((p) => {
      const elements = Array.isArray(p.elements) ? p.elements : null;
      if (!elements || !elements.length) return [];
      const nom = typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 60) : 'Modèle de marque';
      return [{
        workspace_id: workspaceId,
        name: nom,
        format_id: typeof p.format_id === 'string' ? p.format_id : 'ig-portrait',
        // Les calques produits par la composition SONT le modèle : ce sont les
        // mêmes objets que l'éditeur manipule, donc tout reste modifiable.
        text_zones: elements,
        background_style: { type: 'photo' },
        logo_placement: null,
        thumbnail_url: null,
        sort_order: ++rang,
      }];
    });

    if (!lignes.length) return NextResponse.json({ error: 'aucune proposition exploitable' }, { status: 400 });

    const { data, error } = await sb.from('post_templates').insert(lignes).select('id, name');
    if (error) {
      console.error('[brand-dna/adopt] écriture refusée :', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ enregistres: data?.length ?? 0, templates: data ?? [] }, { status: 201 });
  } catch (err) {
    console.error('[brand-dna/adopt] inattendu :', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
