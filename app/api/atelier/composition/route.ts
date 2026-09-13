import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { oublierCatalogue } from '@/lib/recettesBase';

/* Gérer une composition déjà enregistrée.
 *
 * DEUX GESTES, ET ILS NE SE VALENT PAS :
 *   PATCH  { active } — la retire du vivier SANS l'effacer. C'est le geste
 *     courant : une composition qui ne convient pas aujourd'hui peut resservir,
 *     et la réécarter à chaque tour est exactement le genre de détail qui fait
 *     abandonner un outil.
 *   DELETE — l'efface pour de bon. Réservé à ce qu'on ne veut jamais revoir.
 *
 * La RLS fait le reste : un utilisateur ne peut toucher que les compositions
 * des clients qui lui appartiennent, et jamais celles de portée « catalogue ».
 */
export const dynamic = 'force-dynamic';

async function verifier(request: NextRequest) {
  const sb = createRouteHandlerClient({ cookies });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return { erreur: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) };
  const body = await request.json().catch(() => null);
  const id = typeof body?.recipeId === 'string' ? body.recipeId.trim() : '';
  if (!id) return { erreur: NextResponse.json({ error: 'recipeId requis' }, { status: 400 }) };
  return { sb, id, body };
}

export async function PATCH(request: NextRequest) {
  const v = await verifier(request);
  if (v.erreur) return v.erreur;
  const { error } = await v.sb!.from('design_recipes')
    .update({ active: v.body?.active !== false })
    .eq('recipe_id', v.id!);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  oublierCatalogue();
  return NextResponse.json({ ok: true, active: v.body?.active !== false });
}

export async function DELETE(request: NextRequest) {
  const v = await verifier(request);
  if (v.erreur) return v.erreur;
  const { error } = await v.sb!.from('design_recipes').delete().eq('recipe_id', v.id!);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  oublierCatalogue();
  return NextResponse.json({ ok: true, supprimee: v.id });
}
