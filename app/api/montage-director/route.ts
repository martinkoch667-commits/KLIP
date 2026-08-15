import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAiText } from '@/lib/ai-text';
import { TRANSITIONS } from '@/app/workspace/[id]/montage/[postId]/constants';

// Un appel LLM avec images dépasse régulièrement les 10 s par défaut de Vercel.
export const maxDuration = 60;

// POST /api/montage-director
//
// LA PASSE « RÉALISATEUR ». Elle intervient APRÈS le prémontage (preEdit.ts), une
// fois que les rushes sont nettoyés et la parole transcrite. Le prémontage rend un
// ours propre ; cette passe l'HABILLE — c'est ce qui manquait pour qu'un montage
// sorte livrable sans repasse humaine.
//
// Périmètre volontairement étroit — deux choses, celles qui sont à zéro aujourd'hui :
//   • les TITRES à l'écran (accroche, chapitres, chiffres clés, CTA) : le prémontage
//     n'en pose aucun, et c'est le premier écart visible avec un montage pro ;
//   • les TRANSITIONS, choisies selon le propos au lieu d'être uniformes.
//
// Ce qu'elle ne touche PAS, et pourquoi : le style des sous-titres est déjà dérivé
// de la charte du client (charterSubDefault dans l'éditeur), et les coupes sont déjà
// décidées par le prémontage. Redécider ici reviendrait à défaire du travail réglé.
//
// Le vocabulaire de sortie est fermé et revalidé côté serveur : le modèle ne peut
// demander que ce que l'éditeur sait poser, donc chaque retour est applicable tel
// quel — et annulable en Cmd+Z comme n'importe quelle édition.

const TRANSITION_IDS = TRANSITIONS.map((t) => t.id);
const TITLE_FONTS = ['archivo', 'instrument', 'satoshi'] as const;
const TITLE_ANIMS = ['rise', 'type', 'pop'] as const;

/** Plafond de titres. Au-delà, l'écran est chargé et l'effet s'inverse : la vidéo
 *  fait « template » au lieu de faire montée. Huit couvre accroche + chapitres +
 *  chiffres + CTA sur un format court. */
const MAX_TITLES = 8;

interface BrandRow {
  name?: string | null;
  sector?: string | null;
  tone?: string | null;
  words_to_use?: string | null;
  words_to_avoid?: string | null;
  company_description?: string | null;
  accent_color?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

interface ClipIn { id: string; kind: string; name: string; tlStart: number; tlDur: number }
interface Seg { start: number; end: number; text: string }

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function brandBlock(b: BrandRow | null): string {
  if (!b) return "Aucune charte renseignée : reste sobre, texte blanc, pas de couleur inventée.";
  const palette = [b.accent_color, b.primary_color, b.secondary_color].filter((c): c is string => !!c && HEX.test(c));
  return [
    b.name ? `Marque : ${b.name}` : '',
    b.sector ? `Secteur : ${b.sector}` : '',
    b.company_description ? `Activité : ${b.company_description}` : '',
    b.tone ? `Ton : ${b.tone}` : '',
    b.words_to_use ? `Mots à privilégier : ${b.words_to_use}` : '',
    b.words_to_avoid ? `Mots à bannir : ${b.words_to_avoid}` : '',
    palette.length ? `Couleurs de la charte (n'en utilise AUCUNE autre) : ${palette.join(', ')}` : 'Pas de couleur de charte : utilise #FFFFFF.',
  ].filter(Boolean).join('\n');
}

const SYSTEM = `Tu es directeur artistique vidéo pour des formats courts (Reel, TikTok, Short). Un monteur t'a rendu un ours PROPRE : les rushes sont dérushés, les hésitations coupées, les sous-titres posés et déjà à la charte du client. Ton travail est l'HABILLAGE, rien d'autre.

CE QUE TU DÉCIDES — deux choses :

1. LES TITRES À L'ÉCRAN. Tu lis la transcription et tu repères les moments qui méritent du texte :
   - une ACCROCHE sur les 2 premières secondes (la promesse, pas le titre de la vidéo) ;
   - des TITRES DE CHAPITRE quand le propos change de sujet ;
   - les CHIFFRES ET NOMS PROPRES qui sont dits et qui gagnent à être vus (prix, durée, pourcentage, nom du produit) ;
   - un CTA à la fin s'il y en a un dans le discours.

2. LES TRANSITIONS entre les plans, choisies selon le propos : une coupe franche quand le discours continue, quelque chose de marqué quand on change de sujet ou de lieu.

RÈGLES DE MÉTIER — elles priment sur l'envie d'en faire :
- Un titre REDIT rarement ce que disent les sous-titres. Il ancre, il annonce, il souligne. Si le sous-titre suffit, ne pose pas de titre.
- Un titre est COURT : 2 à 6 mots. Jamais une phrase.
- Un titre ne CHEVAUCHE PAS les sous-titres : les sous-titres sont en bas (y ≈ 78), tes titres vont en haut ou au milieu (y entre 12 et 55).
- Tu ne poses JAMAIS deux titres en même temps.
- Tes couleurs sortent de la charte fournie. Si la charte n'en donne pas, c'est blanc.
- La sobriété est un choix valide : sur une vidéo qui parle bien, 2 titres valent mieux que 8.
- Les transitions marquées se méritent. Par défaut, "cut".

TU ÉCRIS EN FRANÇAIS et tu réponds avec un UNIQUE objet JSON, sans texte autour, sans bloc de code :

{
  "reply": "une phrase courte qui dit ce que tu as posé et pourquoi",
  "titles": [
    { "text": "...", "start": 0.0, "end": 2.4, "font": "archivo|instrument|satoshi", "color": "#RRGGBB", "anim": "rise|type|pop", "x": 50, "y": 22, "scale": 1 }
  ],
  "transitions": [
    { "clipId": "<id exact>", "transition": "<id>", "dur": 0.4 }
  ]
}

- start/end sont en SECONDES SUR LA TIMELINE (pas dans la source), dans les bornes du montage.
- x/y sont en % du cadre. x = 50 centre le titre.
- clipId doit être un identifiant EXACT de la liste fournie. N'en invente aucun.
- Le premier plan n'a pas de transition d'entrée : ne le liste pas.
- Si le montage ne mérite aucun titre, renvoie "titles": [] et dis-le dans "reply".`;

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await request.json();
    const workspaceId: unknown = body?.workspaceId;
    const clipsIn: unknown = body?.clips;
    if (!Array.isArray(clipsIn) || !clipsIn.length) {
      return NextResponse.json({ error: 'clips requis' }, { status: 400 });
    }

    const clips = (clipsIn as ClipIn[]).filter((c) => c && typeof c.id === 'string');
    const clipIds = new Set(clips.map((c) => c.id));
    const firstClipId = clips[0]?.id;
    // Borne haute des timings : un titre posé après la fin ne s'afficherait jamais,
    // et rien dans l'interface ne le signalerait.
    const totalDur = clips.reduce((s, c) => s + Math.max(0, num(c.tlDur, 0)), 0) || 60;

    const transcript = (Array.isArray(body?.transcript) ? body.transcript : []) as Seg[];
    // Les extraits de plans arrivent en data: URL — mêmes précautions que montage-chat :
    // on les sort du JSON pour les envoyer comme vraies images.
    const images = (Array.isArray(body?.images) ? body.images : [])
      .filter((i: unknown): i is string => typeof i === 'string' && i.startsWith('data:'))
      .slice(0, 4);

    // La charte vit sur le workspace. On la lit côté serveur plutôt que de la faire
    // voyager depuis le client : la RLS de Supabase reste la seule autorité sur qui
    // a le droit de la lire.
    let brand: BrandRow | null = null;
    if (typeof workspaceId === 'string' && workspaceId) {
      const { data } = await supabase
        .from('workspaces')
        .select('name, sector, tone, words_to_use, words_to_avoid, company_description, accent_color, primary_color, secondary_color')
        .eq('id', workspaceId)
        .single();
      brand = (data as BrandRow) ?? null;
    }

    const clipLines = clips.map((c) =>
      `- id="${c.id}" ${c.kind === 'photo' ? 'photo' : 'vidéo'} "${c.name}" — de ${num(c.tlStart, 0).toFixed(1)}s à ${(num(c.tlStart, 0) + num(c.tlDur, 0)).toFixed(1)}s`
    ).join('\n');

    const transcriptLines = transcript.length
      ? transcript.map((s) => `[${num(s.start, 0).toFixed(1)}s] ${String(s.text ?? '').trim()}`).join('\n')
      : '(aucune parole transcrite — habille à l\'image seule, et reste très sobre)';

    const userText = [
      images.length ? `Les ${images.length} image(s) jointe(s) sont des extraits des plans, dans l'ordre. Regarde-les avant de décider.` : '',
      `CHARTE DU CLIENT :\n${brandBlock(brand)}`,
      '',
      `PLANS DU MONTAGE (durée totale ${totalDur.toFixed(1)}s) :\n${clipLines}`,
      '',
      `TRANSCRIPTION (horodatée sur la timeline) :\n${transcriptLines}`,
      '',
      `TRANSITIONS DISPONIBLES : ${TRANSITION_IDS.join(', ')}`,
    ].filter(Boolean).join('\n');

    let raw: string;
    try {
      raw = await generateAiText({
        userId: session.user.id,
        system: SYSTEM,
        userText,
        images: images.length ? images : undefined,
        temperature: 0.5,
        maxTokens: 2000,
      });
    } catch (err) {
      console.error('[montage-director] erreur fournisseur IA :', err);
      return NextResponse.json({ error: 'Réalisateur indisponible pour le moment' }, { status: 502 });
    }

    let parsed: { reply?: unknown; titles?: unknown; transitions?: unknown } = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    } catch {
      // JSON illisible : on ne devine pas d'habillage. Mieux vaut ne rien poser
      // qu'un titre au mauvais endroit sur un montage que l'utilisateur croit fini.
      return NextResponse.json({ reply: '', titles: [], transitions: [] });
    }

    // ── Revalidation. Le modèle propose, le serveur dispose : tout ce qui sort
    //    d'ici doit être posable tel quel par l'éditeur, sans qu'il re-vérifie.
    const accent = brand?.accent_color && HEX.test(brand.accent_color) ? brand.accent_color : '#FFFFFF';

    const rawTitles = Array.isArray(parsed.titles) ? parsed.titles : [];
    const titles = rawTitles
      .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
      .map((t) => {
        const text = String(t.text ?? '').trim().slice(0, 60);
        const start = clamp(num(t.start, 0), 0, totalDur);
        // Une durée plancher : un titre de 0,2 s est illisible, et le modèle en
        // propose quand il cale sur un mot isolé de la transcription.
        const end = clamp(num(t.end, start + 2), start + 0.8, totalDur);
        const font = (TITLE_FONTS as readonly string[]).includes(String(t.font)) ? String(t.font) : 'archivo';
        const anim = (TITLE_ANIMS as readonly string[]).includes(String(t.anim)) ? String(t.anim) : 'rise';
        const color = typeof t.color === 'string' && HEX.test(t.color) ? t.color : accent;
        return {
          text,
          start,
          end,
          font,
          anim,
          color,
          x: clamp(num(t.x, 50), 0, 100),
          // Le bas du cadre appartient aux sous-titres : on y ramène tout titre qui
          // déborde, plutôt que de le laisser se superposer à la parole.
          y: clamp(num(t.y, 22), 8, 60),
          scale: clamp(num(t.scale, 1), 0.5, 2.5),
        };
      })
      .filter((t) => t.text.length > 0)
      .sort((a, b) => a.start - b.start)
      .slice(0, MAX_TITLES);

    // Deux titres simultanés se chevauchent à l'écran — la consigne le dit, mais
    // elle ne suffit pas : on tronque le précédent au démarrage du suivant.
    for (let i = 0; i < titles.length - 1; i++) {
      if (titles[i].end > titles[i + 1].start) titles[i].end = titles[i + 1].start;
    }
    const cleanTitles = titles.filter((t) => t.end - t.start >= 0.5);

    const rawTr = Array.isArray(parsed.transitions) ? parsed.transitions : [];
    const seen = new Set<string>();
    const transitions = rawTr
      .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
      .map((t) => ({
        clipId: String(t.clipId ?? ''),
        transition: String(t.transition ?? ''),
        dur: clamp(num(t.dur, 0.4), 0.15, 1.2),
      }))
      .filter((t) => {
        if (!clipIds.has(t.clipId) || seen.has(t.clipId)) return false;
        // Le premier plan n'a pas d'entrée : une transition y produirait un fondu
        // depuis le noir que personne n'a demandé.
        if (t.clipId === firstClipId) return false;
        if (!TRANSITION_IDS.includes(t.transition)) return false;
        seen.add(t.clipId);
        return true;
      });

    const reply = typeof parsed.reply === 'string' ? parsed.reply.trim().slice(0, 300) : '';

    return NextResponse.json({ reply, titles: cleanTitles, transitions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[montage-director] fatal :', msg);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
