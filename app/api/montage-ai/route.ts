import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAiText } from '@/lib/ai-text';

// Un appel LLM avec images dépasse régulièrement les 10 s par défaut de Vercel.
export const maxDuration = 60;

// POST /api/montage-ai
// 3 chantiers IA du module Montage (palier 3 de l'audit Canva/CapCut), regroupés
// sur un seul endpoint (même auth, même schéma de réponse "JSON dans le texte") :
// - smart_crop     : recadrage statique d'un plan sur son sujet principal
// - auto_assemble  : montage automatique (ordre, rognage, Ken Burns, transitions)
// - music_mood     : suggestion d'ambiance musicale en texte (pas de bibliothèque
//                     sous licence disponible — l'utilisateur importe son propre fichier)

function parseJsonBlock<T>(raw: string, fallback: T): T {
  try {
    const jm = raw.match(/\{[\s\S]*\}/);
    if (jm) return JSON.parse(jm[0]);
  } catch { /* garde le fallback */ }
  return fallback;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const userId = session.user.id;

    const body = await request.json();
    const mode = body?.mode;

    if (mode === 'smart_crop') {
      const image: unknown = body?.image;
      if (typeof image !== 'string') return NextResponse.json({ error: 'image requise' }, { status: 400 });

      const prompt = [
        'Tu analyses une image (plan de montage vidéo) pour un recadrage "cover" automatique.',
        'Repère le SUJET PRINCIPAL (visage/personne en priorité, sinon l\'objet le plus important).',
        'Renvoie le point central de ce sujet en fractions de la largeur/hauteur de l\'image (0 = bord gauche/haut, 1 = bord droit/bas, 0.5 = centre).',
        'Réponds UNIQUEMENT avec ce JSON : { "focusX": number, "focusY": number }',
      ].join('\n');

      let raw: string;
      try {
        raw = await generateAiText({ userId, userText: prompt, images: [image], temperature: 0.1, maxTokens: 100 });
      } catch (err) {
        console.error('[montage-ai:smart_crop] API error:', err);
        return NextResponse.json({ error: 'Recadrage IA indisponible' }, { status: 500 });
      }
      const result = parseJsonBlock<{ focusX?: number; focusY?: number }>(raw, {});
      const focusX = typeof result.focusX === 'number' ? Math.max(0, Math.min(1, result.focusX)) : 0.5;
      const focusY = typeof result.focusY === 'number' ? Math.max(0, Math.min(1, result.focusY)) : 0.5;
      return NextResponse.json({ focusX, focusY });
    }

    if (mode === 'auto_assemble') {
      const clips: unknown = body?.clips;
      const images: unknown = body?.images;
      if (!Array.isArray(clips) || !clips.length) return NextResponse.json({ error: 'clips requis' }, { status: 400 });
      const imgList: { id: string; dataUrl: string }[] = Array.isArray(images) ? images.filter((i) => i && typeof i.dataUrl === 'string') : [];

      const clipLines = clips.map((c: { id: string; kind: string; name: string; srcDur: number }) =>
        `- id="${c.id}" type=${c.kind} nom="${c.name}" durée_source=${c.srcDur.toFixed(1)}s`
      ).join('\n');

      const prompt = [
        'Tu es monteur vidéo professionnel (réseaux sociaux, format court type Reel/Story).',
        `Voici les plans importés (dans l'ordre d'import) :\n${clipLines}`,
        imgList.length ? 'Des images d\'aperçu de certains plans sont fournies (dans le même ordre que la liste ci-dessus, une par id fourni).' : '',
        '',
        'Propose un montage complet : un ORDRE de diffusion cohérent (démarre fort, varie les plans, termine sur un point fort),',
        'et pour CHAQUE plan listé (tous les ids doivent apparaître exactement une fois) :',
        '- trimStart/trimEnd (secondes, dans le référentiel de la source, trimEnd <= durée_source) : pour une vidéo, choisis le meilleur extrait (2 à 6s typiquement) ; pour une photo, une durée entre 2 et 5s.',
        '- kenBurns ("in"|"out"|null) : uniquement pertinent pour les photos (zoom avant/arrière/aucun).',
        '- transitionIn (une valeur EXACTE parmi : "cut","fade","slide","zoom","wipe","blur") et transitionDur (0.2 à 0.8s). Pas de transition sur le tout premier plan (mets "cut").',
        '',
        'Réponds UNIQUEMENT avec ce JSON (le tableau "plan" est l\'ordre final du montage) :',
        '{ "plan": [ { "id": "...", "trimStart": number, "trimEnd": number, "kenBurns": "in"|"out"|null, "transitionIn": "...", "transitionDur": number } ] }',
      ].filter(Boolean).join('\n');

      let raw: string;
      try {
        raw = await generateAiText({
          userId, userText: prompt,
          images: imgList.length ? imgList.map((i) => i.dataUrl) : undefined,
          temperature: 0.4, maxTokens: 1200,
        });
      } catch (err) {
        console.error('[montage-ai:auto_assemble] API error:', err);
        return NextResponse.json({ error: 'Montage automatique indisponible' }, { status: 500 });
      }
      const result = parseJsonBlock<{ plan?: unknown[] }>(raw, {});
      return NextResponse.json({ plan: Array.isArray(result.plan) ? result.plan : [] });
    }

    if (mode === 'music_mood') {
      const clips: unknown = body?.clips;
      const images: unknown = body?.images;
      if (!Array.isArray(clips) || !clips.length) return NextResponse.json({ error: 'clips requis' }, { status: 400 });
      const imgList: string[] = Array.isArray(images) ? images.filter((i) => typeof i === 'string') : [];

      const clipLines = clips.map((c: { kind: string; name: string }) => `- ${c.kind === 'video' ? 'vidéo' : 'photo'} "${c.name}"`).join('\n');

      const prompt = [
        'Tu es directeur artistique musical pour du montage vidéo réseaux sociaux.',
        `Voici les plans du montage :\n${clipLines}`,
        imgList.length ? 'Des images d\'aperçu de quelques plans sont fournies.' : '',
        '',
        'Propose une AMBIANCE MUSICALE adaptée : style/genre, tempo approximatif (bpm), et 2-3 mots-clés de recherche.',
        'Réponds en français, 2-3 phrases maximum, ton direct et concret (pas de blabla). Pas de nom de morceau/artiste précis (pas de garantie de licence).',
        'Réponds UNIQUEMENT avec ce JSON : { "suggestion": "..." }',
      ].filter(Boolean).join('\n');

      let raw: string;
      try {
        raw = await generateAiText({
          userId, userText: prompt,
          images: imgList.length ? imgList : undefined,
          temperature: 0.6, maxTokens: 300,
        });
      } catch (err) {
        console.error('[montage-ai:music_mood] API error:', err);
        return NextResponse.json({ error: 'Suggestion indisponible' }, { status: 500 });
      }
      const result = parseJsonBlock<{ suggestion?: string }>(raw, {});
      return NextResponse.json({ suggestion: result.suggestion || '' });
    }

    return NextResponse.json({ error: 'mode inconnu' }, { status: 400 });
  } catch (e) {
    console.error('[montage-ai] error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
