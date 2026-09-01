import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

// POST /api/brand-dna/save
//
// Enregistre l'ADN visuel validé par l'utilisateur sur son workspace.
//
// Route à part, et volontairement : `/api/brand-dna` PROPOSE, celle-ci ENGAGE.
// L'écran d'analyse doit pouvoir s'afficher, être corrigé, et n'écrire en base
// que si la personne garde ce qu'elle voit.
//
// La colonne `visual_dna` arrive avec la migration 028, et la base de
// production a déjà été en retard sur ses migrations. On lit donc l'erreur au
// lieu de répondre « enregistré » dans le vide : une colonne manquante doit
// remonter en clair, avec le nom du fichier à passer.
export async function POST(request: NextRequest) {
  const sb = createRouteHandlerClient({ cookies });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  let workspaceId = '';
  let dna: unknown = null;
  let brandColors: unknown = null;
  try {
    const b = await request.json();
    workspaceId = typeof b?.workspaceId === 'string' ? b.workspaceId : '';
    dna = b?.dna ?? null;
    brandColors = Array.isArray(b?.brandColors) ? b.brandColors : null;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  if (!workspaceId || !dna || typeof dna !== 'object') {
    return NextResponse.json({ error: 'workspaceId et dna requis' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { visual_dna: dna };
  // Les couleurs relevées ne s'imposent pas : elles ne sont écrites que si
  // l'écran les a fait valider, et la fiche de marque reste souveraine ensuite.
  if (Array.isArray(brandColors) && brandColors.length) {
    const hex = brandColors.filter((c): c is string => typeof c === 'string' && /^#[0-9A-F]{6}$/i.test(c));
    if (hex[0]) patch.primary_color = hex[0];
    if (hex[1]) patch.secondary_color = hex[1];
    if (hex[2]) patch.accent_color = hex[2];
    patch.brand_colors = hex;
  }

  const { error } = await sb.from('workspaces').update(patch).eq('id', workspaceId);
  if (error) {
    const manque = /column .*(visual_dna|brand_colors)/i.test(error.message);
    console.error('[brand-dna/save]', error.message);
    return NextResponse.json({
      error: manque
        ? "La base n'a pas encore la colonne visual_dna : passer supabase/migrations/028_adn_visuel.sql."
        : error.message,
    }, { status: 500 });
  }
  return NextResponse.json({ saved: true });
}
