import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAiText } from '@/lib/ai-text';

// Un appel IA avec image dépasse volontiers les 10 s par défaut de Vercel :
// sans cette marge, la requête est coupée en plein travail.
export const maxDuration = 60;

// POST /api/editor-chat
// Assistant conversationnel de l'éditeur visuel : l'utilisateur dit ce qu'il veut
// changer sur le visuel, l'IA répond ET renvoie des ACTIONS que le client applique
// aux calques du canvas. Même principe que /api/montage-chat : vocabulaire fermé,
// donc l'IA ne peut demander que ce que l'éditeur sait faire, et tout est annulable.
//
// Complète (sans les remplacer) les deux IA déjà en place : la composition
// automatique (/api/compose-layout) et l'audit visuel (/api/visual-qa), que
// l'assistant peut d'ailleurs déclencher lui-même via les actions dédiées.

const SYSTEM = `Tu es le directeur artistique de KLIP. L'utilisateur te confie une mission sur le VISUEL qu'il est en train d'éditer, comme à un designer.

MÉTHODE — dans cet ordre, avant de décider :
1. REGARDE l'image fournie : c'est le rendu actuel. Repère la composition (où est le sujet, quelles zones sont calmes ou chargées), la hiérarchie de lecture, l'équilibre des masses, les vides, et tout ce qui nuit à la lisibilité.
2. RELIS la charte du client (couleurs, polices) : tu ne proposes JAMAIS une couleur ou une police hors charte, sauf demande explicite.
3. REGARDE les références : gabarits du client et posts qu'il a déjà validés. Ils disent ses habitudes de composition — aligne-toi dessus, c'est son style.
4. COMPRENDS L'INTENTION derrière la consigne. « ça fait vide », « ça claque pas », « on voit rien » sont des diagnostics, pas des instructions littérales : à toi de traduire en décisions de design (hiérarchie, échelle, contraste, respiration, voile de lisibilité).

Tu reçois l'état courant (cadre, charte, références, calques) et l'historique de la conversation. Tu réponds TOUJOURS avec un unique objet JSON, sans texte autour, sans bloc de code :

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
- { "type": "visual_qa" } — relance l'audit visuel (lisibilité, débordements, contrastes)
- { "type": "generate_carousel", "brief": "le sujet, tel que l'utilisateur l'a formulé", "slides": 6 } — écrit et met en page un CARROUSEL ENTIER (3 à 10 slides) à partir d'un sujet. À utiliser dès que l'utilisateur demande un carrousel sur un thème (« fais-moi un carrousel sur X », « 5 slides pour expliquer Y »). Tu ne rédiges RIEN toi-même : tu passes le sujet, un module dédié écrit l'accroche, le contenu et la conclusion, et remplace les slides du post. Si le nombre de slides n'est pas précisé, mets 6.

ACTION DE REFONTE — c'est la principale quand on te demande de restructurer, redesigner, réorganiser, « aérer », « donner du punch », ou quand le visuel ne fonctionne pas :
{ "type": "redesign",
  "scrim": "bottom" | "top" | "none",
  "blocks": [
    { "text": "…", "role": "titre" | "sous-titre" | "cta",
      "xPct": 7, "yPct": 74, "widthPct": 84, "fontPct": 9,
      "align": "left" | "center" | "right",
      "color": "primary" | "secondary" | "accent" | "white" | "black",
      "uppercase": true }
  ] }
Elle REMPLACE tous les calques texte par cette nouvelle mise en page. Positions et tailles en % du cadre ; la couleur est un RÔLE de la charte (jamais un code hexadécimal), et le moteur ajuste ensuite le contraste sur la photo et pose un voile si le fond est chargé.

Repères de composition éprouvés (inspire-t'en, adapte à la photo) :
- Éditorial bas-gauche : kicker fin (fontPct 3.5-4) à yPct 68-70, gros titre (fontPct 9-11, majuscules) à yPct 74-78, largeur 84 %, aligné à gauche, scrim "bottom".
- Couverture haut : titre à yPct 9-13, sous-titre dessous à yPct 22-25, scrim "top".
- Punchline centrée : un seul bloc très court, fontPct 12-14, centré à yPct 38-44, scrim "bottom".
- Hiérarchie 3 niveaux : kicker accent, gros titre, puis CTA discret en bas.
Règles de mise en page : garde une marge d'au moins 7 % sur les côtés, ne dépasse jamais 3 blocs, un seul bloc dominant, et pose le texte dans la zone la plus CALME de la photo (celle que tu vois sur l'image).

RÈGLES GÉNÉRALES :
- Utilise les identifiants EXACTS des calques fournis. N'invente jamais d'id.
- Pour les actions ciblées, positions et tailles sont en PIXELS du cadre ; pour "redesign", en POURCENTAGES. Reste dans le cadre.
- Une retouche ponctuelle (« titre en jaune », « descends le sous-titre ») → actions ciblées. Une demande de refonte ou un diagnostic global → "redesign".
- Ne réécris le texte du client que s'il te le demande ; sinon reprends ses textes tels quels dans les blocs.
- Si la demande est ambiguë au point que deux refontes opposées seraient valables, renvoie "actions": [] et pose UNE question courte dans "reply".
- Mais AGIS par défaut : devant une demande floue mais orientée (« ça fait vide », « rends-le plus percutant », « c'est moche »), tranche et fais quelque chose, en disant ce que tu as choisi. Rendre la main sans rien changer est le pire résultat possible — l'utilisateur t'a confié une mission, pas demandé un avis.
- La demande peut aussi porter sur ce qui n'est pas du texte : une forme, une couleur de fond, un élément à supprimer parce qu'il encombre. Utilise alors set_fill, set_opacity, move ou delete sur les calques concernés.
- Si c'est une simple question, réponds dans "reply" avec "actions": [].
- "reply" est court (une à deux phrases), dit ce que tu as fait ET pourquoi en termes de design, et ne contient jamais de JSON.`;

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

    // Le rendu du canvas voyage dans `project.image` : on le sort du JSON pour
    // l'envoyer comme VRAIE image au modèle (sinon on lui enverrait une énorme
    // chaîne base64 en texte, illisible et ruineuse en tokens).
    const proj = (body.project ?? {}) as Record<string, unknown>;
    const image = typeof proj.image === 'string' && proj.image.startsWith('data:') ? proj.image : null;
    const { image: _omit, ...projectSansImage } = proj;
    void _omit;

    const userText = [
      image ? "L'image jointe est le RENDU ACTUEL du visuel. Regarde-la avant de décider." : '',
      'ÉTAT COURANT DU VISUEL :',
      JSON.stringify(projectSansImage, null, 1),
      '',
      `CONSIGNE : ${instruction}`,
    ].filter(Boolean).join('\n');

    // Comprendre « ça claque pas » ou « c'est mal équilibré » et le traduire en
    // décisions de design EST un travail de jugement : il faut regarder le rendu,
    // le comparer à la charte, et décider. D'où le modèle de jugement en premier.
    const ask = (quality: 'high' | 'fast') => generateAiText({
      userId: session.user.id,
      system: SYSTEM,
      userText,
      images: image ? [image] : undefined,
      priorTurns: history.map((h) => ({ role: h.role, text: h.text })),
      quality,
      temperature: 0.3,
      maxTokens: quality === 'high' ? 4000 : 2200,
    });

    let raw: string;
    try {
      raw = await ask('high');
    } catch (err) {
      // La qualité ne doit jamais coûter la RÉPONSE. Sans ce repli, une
      // indisponibilité du modèle de jugement rendait l'assistant muet —
      // « Assistant indisponible » — alors que le modèle rapide répond très bien
      // aux consignes explicites (« centre tout », « titre en jaune »).
      console.warn('[editor-chat] modèle de jugement indisponible, repli rapide :', err);
      try {
        raw = await ask('fast');
      } catch (err2) {
        console.error('[editor-chat] erreur fournisseur IA :', err2);
        // « Indisponible » n'apprend rien à personne et oblige à rediagnostiquer à
        // l'aveugle. On remonte la cause réelle, courte, telle que le fournisseur
        // la donne : c'est ce qui a permis de trouver le vrai défaut la dernière fois.
        const why = err2 instanceof Error ? err2.message.slice(0, 140) : '';
        return NextResponse.json({ error: why ? `Assistant indisponible — ${why}` : 'Assistant indisponible pour le moment' }, { status: 502 });
      }
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
