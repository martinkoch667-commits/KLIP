import { NextRequest, NextResponse } from 'next/server';

/* Dépôt du résultat du banc du catalogue. DÉVELOPPEMENT UNIQUEMENT.
 *
 * POURQUOI IL EXISTE. Le banc tourne dans le NAVIGATEUR (le rendu a besoin d'un
 * canvas) et le jugement demande une session. Le chiffre reste donc chez celui
 * qui a cliqué, et personne d'autre ne peut le lire — ni un second oeil, ni la
 * session qui a écrit le banc. Un dépôt d'une ligne suffit à le rendre lisible.
 *
 * En mémoire, volontairement : c'est une mesure de chantier, pas une donnée du
 * produit. Elle ne survit pas au redémarrage du serveur, et c'est très bien —
 * une mesure vieille d'une semaine sur un catalogue qui a changé est un piège.
 */
export const dynamic = 'force-dynamic';

let dernier: { recu: string; [k: string]: unknown } | null = null;

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  const corps = await request.json().catch(() => null);
  if (!corps || typeof corps !== 'object') return NextResponse.json({ error: 'corps illisible' }, { status: 400 });
  dernier = { recu: new Date().toISOString(), ...corps };
  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  return NextResponse.json(dernier ?? { vide: true, note: "Aucun résultat déposé depuis le démarrage du serveur." });
}
