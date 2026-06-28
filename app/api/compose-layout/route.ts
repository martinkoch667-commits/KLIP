import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// POST /api/compose-layout
// "Directeur artistique IA" — Option 3 : l'IA NE DESSINE PAS de zéro.
// Elle CHOISIT la meilleure mise en page parmi (a) les templates du client et
// (b) une bibliothèque de layouts pros intégrée, puis la remplit/adapte à la photo.
// La géométrie vient de designs déjà soignés -> rendu pro garanti. L'IA décide :
// quel layout, quel texte dans chaque slot, quelles couleurs (charte), scrim.

type Slot = { role: 'titre' | 'sous-titre' | 'cta'; xPct: number; yPct: number; widthPct: number; fontPct: number; align: 'left' | 'center' | 'right'; color: 'primary' | 'secondary' | 'accent' | 'white' | 'black'; uppercase: boolean };
type Recipe = { id: string; desc: string; anchor: 'top' | 'center' | 'bottom'; scrim: 'bottom' | 'top' | 'none'; slots: Slot[] };

// Bibliothèque de mises en page soignées (style éditorial), valables tous formats.
const LIBRARY: Recipe[] = [
  { id: 'lib-editorial-bottom', desc: 'Titre énorme ancré en bas à gauche, sous-titre fin au-dessus — style magazine.', anchor: 'bottom', scrim: 'bottom', slots: [
    { role: 'sous-titre', xPct: 7, yPct: 70, widthPct: 78, fontPct: 4, align: 'left', color: 'white', uppercase: false },
    { role: 'titre', xPct: 7, yPct: 76, widthPct: 84, fontPct: 10, align: 'left', color: 'white', uppercase: true },
  ] },
  { id: 'lib-hero-center', desc: 'Titre centré au cœur de l’image, aéré, impactant.', anchor: 'center', scrim: 'none', slots: [
    { role: 'titre', xPct: 10, yPct: 40, widthPct: 80, fontPct: 11, align: 'center', color: 'white', uppercase: true },
    { role: 'sous-titre', xPct: 18, yPct: 54, widthPct: 64, fontPct: 4, align: 'center', color: 'white', uppercase: false },
  ] },
  { id: 'lib-top-kicker', desc: 'Petit kicker en accent en haut, gros titre juste dessous.', anchor: 'top', scrim: 'top', slots: [
    { role: 'sous-titre', xPct: 7, yPct: 8, widthPct: 60, fontPct: 3.6, align: 'left', color: 'accent', uppercase: true },
    { role: 'titre', xPct: 7, yPct: 13, widthPct: 86, fontPct: 9.5, align: 'left', color: 'white', uppercase: true },
  ] },
  { id: 'lib-minimal-corner', desc: 'Titre court discret en bas à gauche, très épuré.', anchor: 'bottom', scrim: 'bottom', slots: [
    { role: 'titre', xPct: 7, yPct: 85, widthPct: 60, fontPct: 5.5, align: 'left', color: 'white', uppercase: true },
  ] },
  { id: 'lib-bottom-centered-cta', desc: 'Titre centré en bas + petit call-to-action en accent.', anchor: 'bottom', scrim: 'bottom', slots: [
    { role: 'titre', xPct: 10, yPct: 70, widthPct: 80, fontPct: 9, align: 'center', color: 'white', uppercase: true },
    { role: 'cta', xPct: 25, yPct: 85, widthPct: 50, fontPct: 3.8, align: 'center', color: 'accent', uppercase: true },
  ] },
  { id: 'lib-left-stack', desc: 'Bloc titre + sous-titre aligné à gauche, au tiers central.', anchor: 'center', scrim: 'bottom', slots: [
    { role: 'titre', xPct: 7, yPct: 44, widthPct: 58, fontPct: 9, align: 'left', color: 'white', uppercase: true },
    { role: 'sous-titre', xPct: 7, yPct: 57, widthPct: 52, fontPct: 4, align: 'left', color: 'white', uppercase: false },
  ] },
];

export async function POST(request: NextRequest) {
  try {
    const sb = createRouteHandlerClient({ cookies });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 });

    const { imageUrl, format, brand, blocks, styleRef, approvedRef } = await request.json();
    const fmt = format ?? { w: 1080, h: 1350 };
    const palette = [brand?.primary && `primary=${brand.primary}`, brand?.secondary && `secondary=${brand.secondary}`, brand?.accent && `accent=${brand.accent}`].filter(Boolean).join(', ');
    const textList: string[] = Array.isArray(blocks) ? blocks.filter((b: unknown) => typeof b === 'string' && (b as string).trim()) : [];

    // Templates du client = candidats de layout (avec leur géométrie).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tpls: any[] = Array.isArray(styleRef) ? styleRef : [];
    const tplCandidates = tpls.map((t, i) => ({ id: `tpl-${i}`, desc: `Template client "${t.name ?? i}" — rôles: ${(t.blocks ?? []).map((b: { role: string }) => b.role).join(', ')}`, roles: (t.blocks ?? []).map((b: { role: string }) => b.role) }));
    const libCandidates = LIBRARY.map(r => ({ id: r.id, desc: r.desc, anchor: r.anchor, roles: r.slots.map(s => s.role) }));

    const prompt = [
      `Tu es directeur artistique Instagram. Choisis et adapte une mise en page pour ce post (cadre ${fmt.w}×${fmt.h}px).`,
      `Couleurs charte autorisées : ${palette || 'aucune'} + white + black. Polices = marque (gérées par l'app).`,
      '',
      'ANALYSE la photo : où est le sujet/point focal ? quelles zones sont CALMES (pour le texte) ? haut/bas/centre clair ou sombre ?',
      '',
      'CANDIDATS DE MISE EN PAGE (tu DOIS en choisir, tu n\'inventes pas de coordonnées) :',
      'A) Templates du client (à privilégier pour rester dans son univers) :',
      JSON.stringify(tplCandidates),
      'B) Bibliothèque de layouts pros :',
      JSON.stringify(libCandidates),
      '',
      Array.isArray(approvedRef) && approvedRef.length > 0 ? `Posts déjà validés par le client (ce qui lui plaît) : ${JSON.stringify(approvedRef)}` : '',
      textList.length ? `Textes à utiliser :\n${textList.map((t, i) => `${i + 1}. "${t}"`).join('\n')}` : 'Aucun texte fourni : rédige un titre court (≤6 mots) + éventuel sous-titre, cohérents avec la photo.',
      '',
      'Choisis les 3 MEILLEURS layouts (selon où le texte tombera dans une zone calme de CETTE photo). Pour chacun : remplis chaque slot (rôle->texte), choisis une couleur de charte par slot (contraste avec le fond), décide du scrim.',
      'Préfère un template client quand il colle ; sinon un layout de la bibliothèque. Évite de placer le texte sur le sujet.',
      '',
      'Réponds UNIQUEMENT avec ce JSON :',
      '{ "picks": [ { "source": "template"|"library", "id": "<id candidat>", "slots": [ { "role": "titre"|"sous-titre"|"cta", "text": "...", "color": "primary"|"secondary"|"accent"|"white"|"black", "uppercase": boolean } ], "scrim": { "position": "bottom"|"top"|"none", "opacity": number } } ] }',
    ].filter(Boolean).join('\n');

    const hasImage = typeof imageUrl === 'string' && imageUrl.startsWith('http');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];
    if (hasImage) content.push({ type: 'image', source: { type: 'url', url: imageUrl } });
    content.push({ type: 'text', text: prompt });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 1800, temperature: 0.7, messages: [{ role: 'user', content }] }),
    });
    const data = await response.json();
    if (!response.ok) { console.error('[compose-layout] API error:', data); return NextResponse.json({ error: 'Composition échouée' }, { status: 500 }); }

    const raw: string = data.content?.[0]?.text ?? '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any = null;
    try { const jm = raw.match(/\{[\s\S]*\}/); if (jm) parsed = JSON.parse(jm[0]); } catch { /* noop */ }
    const picks: unknown[] = Array.isArray(parsed?.picks) ? parsed.picks : [];
    if (picks.length === 0) return NextResponse.json({ error: 'Aucune composition' }, { status: 502 });

    // Résolution : on assemble la géométrie (template ou bibliothèque) + le texte/couleur choisis par l'IA.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geomFor = (pick: any): { slots: Slot[]; defaultScrim: 'bottom' | 'top' | 'none' } => {
      if (pick.source === 'library') {
        const r = LIBRARY.find(x => x.id === pick.id) ?? LIBRARY[0];
        return { slots: r.slots, defaultScrim: r.scrim };
      }
      const idx = parseInt(String(pick.id).replace('tpl-', ''), 10);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = tpls[idx];
      if (t && Array.isArray(t.blocks)) {
        const slots: Slot[] = t.blocks.map((b: { role: Slot['role']; xPct: number; yPct: number; wPct?: number; widthPct?: number; fontPct: number; align: Slot['align']; upper?: boolean }) => ({
          role: b.role, xPct: b.xPct, yPct: b.yPct, widthPct: b.widthPct ?? b.wPct ?? 80, fontPct: b.fontPct, align: b.align ?? 'left', color: 'white', uppercase: !!b.upper,
        }));
        return { slots, defaultScrim: 'bottom' };
      }
      return { slots: LIBRARY[0].slots, defaultScrim: LIBRARY[0].scrim };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layouts = picks.slice(0, 3).map((pick: any) => {
      const { slots, defaultScrim } = geomFor(pick);
      const aiSlots: { role: string; text?: string; color?: string; uppercase?: boolean }[] = Array.isArray(pick.slots) ? pick.slots : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outBlocks: any[] = [];
      const usedAi = new Set<number>();
      for (const g of slots) {
        let ai = aiSlots.find((s, idx) => s.role === g.role && !usedAi.has(idx));
        if (ai) usedAi.add(aiSlots.indexOf(ai));
        else { const k = aiSlots.findIndex((s, idx) => !usedAi.has(idx) && s.text); if (k >= 0) { ai = aiSlots[k]; usedAi.add(k); } }
        const text = ai?.text?.trim();
        if (!text) continue;
        const a = ai;
        outBlocks.push({
          text, role: g.role,
          xPct: g.xPct, yPct: g.yPct, widthPct: g.widthPct, fontPct: g.fontPct, align: g.align,
          color: ['primary', 'secondary', 'accent', 'white', 'black'].includes(a?.color ?? '') ? a!.color : g.color,
          uppercase: typeof a?.uppercase === 'boolean' ? a!.uppercase : g.uppercase,
        });
      }
      const scrim = pick.scrim && ['bottom', 'top', 'none'].includes(pick.scrim.position)
        ? pick.scrim
        : { position: defaultScrim, opacity: 55 };
      return { blocks: outBlocks, scrim, accents: [], logo: { show: false } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).filter((l: any) => l.blocks.length > 0);

    if (layouts.length === 0) return NextResponse.json({ error: 'Composition vide' }, { status: 502 });
    return NextResponse.json({ layouts });
  } catch (e) {
    console.error('[compose-layout] error:', e);
    return NextResponse.json({ error: 'Erreur composition' }, { status: 500 });
  }
}
