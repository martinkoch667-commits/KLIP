import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateDescriptionForUser } from '@/lib/generate-description';

// Un appel IA avec image dépasse volontiers les 10 s par défaut de Vercel :
// sans cette marge, la requête est coupée en plein travail.
export const maxDuration = 60;

// Mince wrapper : vérifie la session cookie puis délègue à
// lib/generate-description.ts (partagée avec l'outil MCP generate_caption,
// qui résout userId depuis un token OAuth au lieu d'une session cookie).
export async function POST(request: NextRequest) {
  try {
    const authClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await authClient.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await request.json();
    const result = await generateDescriptionForUser({ userId: session.user.id, ...body });
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[generate-description] unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    const status = message === 'Brief manquant' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
