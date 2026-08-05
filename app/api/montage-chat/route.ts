import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAiText } from '@/lib/ai-text';

// POST /api/montage-chat
// Assistant de montage conversationnel : l'utilisateur décrit ce qu'il veut en
// langage naturel, l'IA répond ET renvoie une liste d'ACTIONS que le client
// applique au projet. Le vocabulaire d'actions est volontairement fermé — l'IA
// ne peut demander que ce que l'éditeur sait déjà faire, ce qui évite les
// réponses inapplicables et rend chaque modification annulable (Cmd+Z).
//
// L'historique de conversation est renvoyé par le client à chaque tour, avec
// l'ÉTAT COURANT du projet : l'IA voit donc le résultat de ses propres actions
// et peut enchaîner des retouches (« finalement mets plutôt un fondu au noir »).

const TRANSITIONS = 'cut, fade, fadeblack, flash, slide, slideright, slideup, slidedown, zoom, zoomout, bounce, wipe, wiperight, wipeup, wipedown, iris, spin, swirl, blur, whip, shake, glitch';
const FILTERS = 'none, chaud, doux, froid, argent, nb, vif, cinema, vintage, pastel, noir-intense, nuit, dore';
const SUB_STYLES = 'simple, karaoke, editorial, clean, mint, bold-white, bold-yellow, bold-mint, bold-pink, bold-blue, pill-black, pill-acid, pill-coral, pill-violet, pill-forest, band-black, band-cream, band-red, serif-white, serif-cream, mono-tech, sunset, ocean, gold, candy';
const FORMATS = 'story (9:16), square (1:1), portrait (4:5), landscape (16:9)';

const SYSTEM = `Tu es le monteur vidéo de KLIP. L'utilisateur te confie une mission sur SON montage en cours, comme à un monteur professionnel.

MÉTHODE — dans cet ordre, avant de décider :
1. REGARDE les images fournies : ce sont des extraits des plans du montage, dans l'ordre. Juge ce qu'elles montrent (cadrage, lumière, sujet), et si l'enchaînement se tient.
2. LIS la transcription : c'est ce qui est dit. Elle te dit le propos, le rythme, les redites, et les moments qui méritent un titre à l'écran.
3. COMPRENDS L'INTENTION derrière la consigne. « c'est mou », « ça traîne », « on décroche » sont des diagnostics, pas des instructions littérales : traduis-les en décisions de montage (couper les temps morts, raccourcir les plans, accélérer, poser des transitions plus vives, resserrer les sous-titres).
4. AGIS sur les vrais leviers. Pour rendre une vidéo plus dynamique, on coupe et on resserre AVANT d'ajouter des effets.

Tu reçois l'état courant du projet (plans, sous-titres, titres, audio, format) et l'historique de la conversation. Tu réponds TOUJOURS avec un unique objet JSON, sans texte autour, sans bloc de code :

{ "reply": "une phrase courte, en français, qui dit ce que tu viens de faire", "actions": [ ... ] }

ACTIONS DISPONIBLES (n'en invente aucune autre) :
- { "type": "run_pre_edit" } — prémontage complet : nettoie les rushes, coupe les hésitations, génère les sous-titres, pose les transitions
- { "type": "auto_cut" } — retire seulement les portions inexploitables (flou, noir, image figée)
- { "type": "cut_fillers" } — retire seulement les hésitations, faux départs et prises refaites
- { "type": "generate_captions" } — (re)génère les sous-titres depuis la parole
- { "type": "set_transition", "target": "all" | "<clipId>", "transition": "<id>", "dur": 0.4 } — transitions : ${TRANSITIONS}
- { "type": "set_speed", "target": "all" | "<clipId>", "speed": 1.0 } — de 0.25 à 4
- { "type": "set_volume", "target": "all" | "<clipId>", "vol": 1.0 } — de 0 à 1
- { "type": "set_filter", "target": "all" | "<clipId>", "filterId": "<id>", "lum": 0, "con": 0, "sat": 0 } — filtres : ${FILTERS} ; lum/con/sat de -100 à 100, facultatifs
- { "type": "trim_clip", "clipId": "<id>", "trimStart": 0, "trimEnd": 5 } — en secondes DANS LA SOURCE
- { "type": "remove_clip", "clipId": "<id>" }
- { "type": "reorder_clips", "order": ["<id>", "<id>", ...] } — tous les ids, dans le nouvel ordre
- { "type": "set_caption_length", "words": 3 } — mots par sous-titre, de 1 à 8
- { "type": "set_subtitle_style", "styleId": "<id>" } — styles : ${SUB_STYLES}
- { "type": "set_subtitle_anim", "anim": "words" | "none" } — "words" révèle mot par mot en surlignant le mot dit ; "none" affiche le sous-titre d'un bloc, sans animation
- { "type": "set_subtitle_custom", "fg": "#RRGGBB", "hi": "#RRGGBB", "stroke": "#RRGGBB", "strokeW": 2, "weight": 800, "italic": false, "caseMode": "none|upper|lower|title", "scale": 1, "letterSpacing": 0, "bg": "#RRGGBB", "bgOpacity": 1 } — réglages fins des sous-titres, toutes les propriétés facultatives
- { "type": "set_subtitle_pos", "x": 50, "y": 78 } — en % du cadre
- { "type": "add_title", "text": "...", "start": 0, "dur": 2.5 }
- { "type": "set_format", "formatId": "story" } — formats : ${FORMATS}
- { "type": "toggle_progress_bar", "on": true }

RÈGLES :
- Utilise les identifiants EXACTS des plans fournis dans l'état du projet. N'invente jamais d'id.
- Fais exactement ce qui est demandé, rien de plus. Pas d'initiative décorative non sollicitée.
- Si la demande est ambiguë ou impossible avec les actions ci-dessus, renvoie "actions": [] et pose la question dans "reply".
- Si la demande est une simple question sur le montage, réponds dans "reply" avec "actions": [].
- "reply" est court (une à deux phrases), au passé une fois l'action faite, et ne contient jamais de JSON.`;

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

    // L'historique est borné : au-delà, on garde les derniers échanges (le contexte
    // utile est l'état COURANT du projet, pas la conversation entière).
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

    // Les extraits de plans voyagent dans `project.images` : on les sort du JSON
    // pour les envoyer comme VRAIES images (sinon ce serait du base64 en texte).
    const proj = (body.project ?? {}) as Record<string, unknown>;
    const images = Array.isArray(proj.images)
      ? (proj.images as unknown[]).filter((i): i is string => typeof i === 'string' && i.startsWith('data:')).slice(0, 4)
      : [];
    const { images: _omit, ...projectSansImages } = proj;
    void _omit;

    const userText = [
      images.length ? `Les ${images.length} image(s) jointe(s) sont des extraits des plans du montage, dans l'ordre. Regarde-les avant de décider.` : '',
      'ÉTAT COURANT DU PROJET :',
      JSON.stringify(projectSansImages, null, 1),
      '',
      `CONSIGNE : ${instruction}`,
    ].filter(Boolean).join('\n');

    let raw: string;
    try {
      raw = await generateAiText({
        userId: session.user.id,
        system: SYSTEM,
        userText,
        images: images.length ? images : undefined,
        priorTurns: history.map((h) => ({ role: h.role, text: h.text })),
        temperature: 0.3,
        maxTokens: 2000,
      });
    } catch (err) {
      console.error('[montage-chat] erreur fournisseur IA :', err);
      return NextResponse.json({ error: 'Assistant indisponible pour le moment' }, { status: 502 });
    }

    // La réponse doit être un objet JSON ; certains modèles l'enrobent malgré tout.
    let parsed: { reply?: unknown; actions?: unknown } = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    } catch {
      // JSON illisible : on ne devine pas d'actions, on rend le texte tel quel.
      return NextResponse.json({ reply: raw.slice(0, 500), actions: [] });
    }

    const reply = typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : 'C\'est fait.';
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions.filter((a) => a && typeof a === 'object' && typeof (a as { type?: unknown }).type === 'string').slice(0, 40)
      : [];

    return NextResponse.json({ reply, actions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[montage-chat] fatal :', msg);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
