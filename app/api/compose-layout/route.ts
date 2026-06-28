import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// POST /api/compose-layout
// "Directeur artistique IA" : analyse la PHOTO + la charte, et compose une mise en page
// optimale (placement, hiérarchie, lisibilité). Positions en POURCENTAGES du cadre
// (valable tous formats). Couleurs limitées à la charte, polices = marque.

export async function POST(request: NextRequest) {
  try {
    const sb = createRouteHandlerClient({ cookies });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 });

    const { imageUrl, format, brand, blocks } = await request.json();
    const fmt = format ?? { w: 1080, h: 1350 };
    const palette = [
      brand?.primary && `primary=${brand.primary}`,
      brand?.secondary && `secondary=${brand.secondary}`,
      brand?.accent && `accent=${brand.accent}`,
    ].filter(Boolean).join(', ');

    const textList: string[] = Array.isArray(blocks) ? blocks.filter((b: unknown) => typeof b === 'string' && (b as string).trim()) : [];
    const hasText = textList.length > 0;

    const prompt = [
      `Tu es directeur artistique / community manager expert Instagram. Compose la mise en page d'un post.`,
      `Cadre : ${fmt.w}×${fmt.h}px (origine haut-gauche). Toutes les positions/tailles que tu renvoies sont en POURCENTAGES du cadre.`,
      `Charte de la marque — couleurs autorisées UNIQUEMENT : ${palette || 'aucune (utilise blanc/noir)'} + white + black.`,
      `Polices : titres = police principale de la marque, corps = secondaire (gérées par l'app, ne les nomme pas).`,
      brand?.logo ? 'Un logo de marque est disponible (tu peux le placer discrètement).' : 'Pas de logo fourni.',
      '',
      hasText
        ? `Textes à placer (garde-les, ne réinvente pas) :\n${textList.map((t, i) => `${i + 1}. "${t}"`).join('\n')}`
        : `Aucun texte fourni : propose un titre court (≤ 6 mots) cohérent avec la photo et un éventuel sous-titre.`,
      '',
      'ANALYSE la photo : où est le sujet ? quelles zones sont CALMES et homogènes (pour poser le texte sans gêner) ? zones claires/sombres (pour le contraste) ?',
      'COMPOSE comme un pro : hiérarchie claire (titre dominant), texte dans une zone calme, marges respectées (jamais collé aux bords), AUCUN chevauchement, équilibre visuel.',
      'LISIBILITÉ : si le fond sous le texte est clair/chargé, ajoute un dégradé sombre (scrim) ou une ombre.',
      '',
      'Réponds UNIQUEMENT avec ce JSON, rien d\'autre :',
      '{',
      '  "blocks": [ { "text": "...", "role": "titre"|"sous-titre"|"cta", "xPct": number, "yPct": number, "widthPct": number, "fontPct": number, "align": "left"|"center"|"right", "color": "primary"|"secondary"|"accent"|"white"|"black", "uppercase": boolean, "shadow": boolean } ],',
      '  "scrim": { "position": "bottom"|"top"|"none", "opacity": number },',
      '  "logo": { "show": boolean, "xPct": number, "yPct": number, "widthPct": number }',
      '}',
      'fontPct = hauteur de police en % de la hauteur du cadre (titre ~7-12, sous-titre ~4-6, cta ~3.5-5).',
    ].join('\n');

    const hasImage = typeof imageUrl === 'string' && imageUrl.startsWith('http');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];
    if (hasImage) content.push({ type: 'image', source: { type: 'url', url: imageUrl } });
    content.push({ type: 'text', text: prompt });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 1100, temperature: 0.6, messages: [{ role: 'user', content }] }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('[compose-layout] API error:', data);
      return NextResponse.json({ error: 'Composition échouée' }, { status: 500 });
    }
    const raw: string = data.content?.[0]?.text ?? '';
    let layout: unknown = null;
    try { const jm = raw.match(/\{[\s\S]*\}/); if (jm) layout = JSON.parse(jm[0]); } catch { /* noop */ }
    if (!layout) return NextResponse.json({ error: 'Réponse IA illisible' }, { status: 502 });

    return NextResponse.json({ layout });
  } catch (e) {
    console.error('[compose-layout] error:', e);
    return NextResponse.json({ error: 'Erreur composition' }, { status: 500 });
  }
}
