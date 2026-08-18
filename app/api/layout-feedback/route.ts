import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// POST /api/layout-feedback
// Enregistre la mise en page RETENUE parmi les propositions du compositeur.
// C'est la boucle d'apprentissage : /api/compose-layout relit ces choix au tour
// suivant pour privilégier ce que ce client garde vraiment.
//
// Volontairement silencieux en cas d'échec côté appelant : un avis perdu ne doit
// jamais interrompre le travail en cours.
export async function POST(request: NextRequest) {
  try {
    const sb = createRouteHandlerClient({ cookies });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : '';
    const recipeId = typeof body?.recipeId === 'string' ? body.recipeId.slice(0, 120) : '';
    if (!workspaceId || !recipeId) {
      return NextResponse.json({ error: 'workspaceId et recipeId requis' }, { status: 400 });
    }

    const source = body?.source === 'template' ? 'template' : 'library';
    const variant = Number.isFinite(body?.variant) ? Math.max(1, Math.min(9, Math.round(body.variant))) : null;
    const postId = typeof body?.postId === 'string' && /^[0-9a-f-]{36}$/i.test(body.postId) ? body.postId : null;

    // La RLS est seule juge de l'appartenance du workspace : inutile de la doubler ici.
    const { error } = await sb.from('layout_feedback').insert({
      workspace_id: workspaceId,
      post_id: postId,
      recipe_id: recipeId,
      source,
      variant,
    });
    // Tant que la migration 023 n'est pas passée, la table n'existe pas : on le
    // signale sans le traiter comme une panne, l'appelant l'ignore.
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 200 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[layout-feedback]', err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
