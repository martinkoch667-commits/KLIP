import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAiText } from '@/lib/ai-text';

// POST /api/editor-chat
// Assistant conversationnel de l'éditeur visuel : l'utilisateur dit ce qu'il veut
// changer sur le visuel, l'IA répond ET renvoie des ACTIONS que le client applique
// aux calques du canvas. Même principe que /api/montage-chat : vocabulaire fermé,
// donc l'IA ne peut demander que ce que l'éditeur sait faire, et tout est annulable.
//
// Complète (sans les remplacer) les deux IA déjà en place : la composition
// automatique (/api/compose-layout) et l'audit visuel (/api/visual-qa), que
// l'assistant peut d'ailleurs déclencher lui-même via les actions dédiées.

const SYSTEM = `Tu es le directeur artistique de KLIP. L'utilisateur te parle en langage naturel du VISUEL qu'il est en train d'éditer ; tu appliques ses consignes sur les calques.

Tu reçois l'état courant du visuel (dimensions du cadre, liste des calques avec leurs propriétés) et l'historique de la conversation. Tu réponds TOUJOURS avec un unique objet JSON, sans texte autour, sans bloc de code :

{ "reply": "une phrase courte, en français, qui dit ce que tu viens de faire", "actions": [ ... ] }

ACTIONS DISPONIBLES (n'en invente aucune autre) :
- { "type": "set_text", "id": "<id>", "text": "..." } — remplace le contenu d'un calque texte
- { "type": "set_text_style", "id": "<id>" | "all_text", "fontSize": 32, "fill": "#FFFFFF", "align": "left|center|right", "uppercase": true, "letterSpacing": 0, "lineHeight": 1.2, "fontStyle": "normal|bold|italic|italic bold" } — toutes les propriétés sont facultatives
- { "type": "move", "id": "<id>", "x": 40, "y": 120, "width": 300 } — en pixels du cadre ; propriétés facultatives
- { "type": "set_opacity", "id": "<id>", "opacity": 100 } — de 0 à 100
- { "type": "set_effect", "id": "<id>" | "all_text", "effect": "shadow|highlight|glow|hollow|lift|echo", "on": true, "color": "#000000", "intensity": 50 } — un seul effet par action
- { "type": "set_fill", "id": "<id>", "fill": "#RRGGBB" } — couleur d'une forme ou d'un texte
- { "type": "add_text", "text": "...", "x": 40, "y": 60, "fontSize": 34, "fill": "#FFFFFF" }
- { "type": "delete", "id": "<id>" }
- { "type": "set_scrim", "position": "bottom|top|none", "opacity": 55 } — voile sombre de lisibilité derrière le texte
- { "type": "compose" } — relance une composition automatique complète du visuel
- { "type": "visual_qa" } — relance l'audit visuel (lisibilité, débordements, contrastes)

RÈGLES :
- Utilise les identifiants EXACTS des calques fournis. N'invente jamais d'id.
- Les positions et tailles sont en pixels du cadre fourni (largeur x hauteur). Reste dans le cadre.
- Fais exactement ce qui est demandé, rien de plus.
- Si la demande est ambiguë ou impossible avec ces actions, renvoie "actions": [] et pose la question dans "reply".
- Si c'est une simple question, réponds dans "reply" avec "actions": [].
- "reply" est court (une à deux phrases) et ne contient jamais de JSON.`;

interface Body {
  project?: unknown;
  history?: { role: 'user' | 'assistant'; text: string }[];
  instruction?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = (await request.json()) as Body;
    const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
    if (!instruction) return NextResponse.json({ error: 'instruction requise' }, { status: 400 });

    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

    const userText = [
      'ÉTAT COURANT DU VISUEL :',
      JSON.stringify(body.project ?? {}, null, 1),
      '',
      `CONSIGNE : ${instruction}`,
    ].join('\n');

    let raw: string;
    try {
      raw = await generateAiText({
        userId: session.user.id,
        system: SYSTEM,
        userText,
        priorTurns: history.map((h) => ({ role: h.role, text: h.text })),
        temperature: 0.2,
        maxTokens: 1400,
      });
    } catch (err) {
      console.error('[editor-chat] erreur fournisseur IA :', err);
      return NextResponse.json({ error: 'Assistant indisponible pour le moment' }, { status: 502 });
    }

    let parsed: { reply?: unknown; actions?: unknown } = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    } catch {
      return NextResponse.json({ reply: raw.slice(0, 500), actions: [] });
    }

    const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : "C'est fait.";
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions.filter((a) => a && typeof a === 'object' && typeof (a as { type?: unknown }).type === 'string').slice(0, 40)
      : [];

    return NextResponse.json({ reply, actions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[editor-chat] fatal :', msg);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
