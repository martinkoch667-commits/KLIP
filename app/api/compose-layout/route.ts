import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAiText } from '@/lib/ai-text';
import { LAYOUT_LIBRARY, type Slot } from '@/lib/layoutLibrary';

// POST /api/compose-layout
// "Directeur artistique IA" — Option 3 : l'IA NE DESSINE PAS de zéro.
// Elle CHOISIT la meilleure mise en page parmi (a) les templates du client et
// (b) une bibliothèque de layouts pros intégrée, puis la remplit/adapte à la photo.
// La géométrie vient de designs déjà soignés -> rendu pro garanti. L'IA décide :
// quel layout, quel texte dans chaque slot, quelles couleurs (charte), scrim.


export async function POST(request: NextRequest) {
  try {
    const sb = createRouteHandlerClient({ cookies });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const { imageUrl, format, brand, blocks, styleRef, approvedRef, workspaceId } = await request.json();
    const fmt = format ?? { w: 1080, h: 1350 };
    const palette = [brand?.primary && `primary=${brand.primary}`, brand?.secondary && `secondary=${brand.secondary}`, brand?.accent && `accent=${brand.accent}`].filter(Boolean).join(', ');

    // QUI EST CE CLIENT ?
    //
    // Le directeur artistique ne recevait que trois couleurs. Il ne savait donc
    // pas s'il travaillait pour un burger, un cabinet d'avocats ou une marque de
    // cosmétiques — et il ne pouvait que faire du générique. C'est la première
    // raison pour laquelle tous les clients se ressemblaient.
    //
    // On lit l'identité côté serveur (la RLS reste seule juge de l'accès), et on
    // la lui donne comme un brief : secteur, ton, vocabulaire, typographie.
    let identity = '';
    if (typeof workspaceId === 'string' && workspaceId) {
      const { data: ws } = await sb
        .from('workspaces')
        .select('name, sector, tone, company_description, words_to_use, words_to_avoid, font_family, font_secondary')
        .eq('id', workspaceId)
        .single();
      if (ws) {
        identity = [
          ws.name ? `Marque : ${ws.name}` : '',
          ws.sector ? `Secteur : ${ws.sector}` : '',
          ws.company_description ? `Activité : ${ws.company_description}` : '',
          ws.tone ? `Ton de la marque : ${ws.tone}` : '',
          ws.words_to_use ? `Vocabulaire à privilégier : ${ws.words_to_use}` : '',
          ws.words_to_avoid ? `Vocabulaire à bannir : ${ws.words_to_avoid}` : '',
          ws.font_family ? `Police de titre : ${ws.font_family}${ws.font_secondary ? ` · police de texte : ${ws.font_secondary}` : ''}` : '',
        ].filter(Boolean).join('\n');
      }
    }
    const textList: string[] = Array.isArray(blocks) ? blocks.filter((b: unknown) => typeof b === 'string' && (b as string).trim()) : [];

    // Templates du client = candidats de layout (avec leur géométrie).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tpls: any[] = Array.isArray(styleRef) ? styleRef : [];
    const tplCandidates = tpls.map((t, i) => ({ id: `tpl-${i}`, desc: `Template client "${t.name ?? i}" — rôles: ${(t.blocks ?? []).map((b: { role: string }) => b.role).join(', ')}`, roles: (t.blocks ?? []).map((b: { role: string }) => b.role) }));
    const libCandidates = LAYOUT_LIBRARY.map(r => ({ id: r.id, desc: r.desc, anchor: r.anchor, roles: r.slots.map(s => s.role) }));

    const prompt = [
      `Tu es directeur artistique Instagram. Choisis et adapte une mise en page pour ce post (cadre ${fmt.w}×${fmt.h}px).`,
      `Couleurs charte autorisées : ${palette || 'aucune'} + white + black. Polices = marque (gérées par l'app).`,
      '',
      identity ? `LA MARQUE POUR QUI TU TRAVAILLES :\n${identity}\n\nCette identité doit se VOIR dans ta composition, pas seulement dans les mots. Une marque sobre ne prend pas la mise en page la plus tapageuse ; une marque directe ne prend pas la plus timide. Choisis la composition qui RESSEMBLE à ce client, et un alignement qui va avec son caractère — le centré est solennel, le drapeau à gauche est éditorial et moderne.` : '',
      identity ? '' : '',
      'ANALYSE la photo : où est le sujet/point focal ? quelles zones sont CALMES (pour le texte) ? haut/bas/centre clair ou sombre ?',
      'PRINCIPES (veille design social) : règle des tiers & lecture en Z (haut-gauche -> bas-droite) ; ne place jamais le texte sur le sujet/visage ; hiérarchie claire (titre dominant) ; centré UNIQUEMENT pour une phrase courte, sinon aligné à gauche ; contraste fort ; respiration (marges).',
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

    let raw: string;
    try {
      raw = await generateAiText({
        userId: session.user.id,
        userText: prompt,
        images: hasImage ? [imageUrl] : undefined,
        temperature: 0.7,
        maxTokens: 1800,
      });
    } catch (err) {
      console.error('[compose-layout] API error:', err);
      return NextResponse.json({ error: 'Composition échouée' }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any = null;
    try { const jm = raw.match(/\{[\s\S]*\}/); if (jm) parsed = JSON.parse(jm[0]); } catch { /* noop */ }
    const picks: unknown[] = Array.isArray(parsed?.picks) ? parsed.picks : [];
    if (picks.length === 0) return NextResponse.json({ error: 'Aucune composition' }, { status: 502 });

    // Résolution : on assemble la géométrie (template ou bibliothèque) + le texte/couleur choisis par l'IA.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geomFor = (pick: any): { slots: Slot[]; defaultScrim: 'bottom' | 'top' | 'none' } => {
      if (pick.source === 'library') {
        const r = LAYOUT_LIBRARY.find(x => x.id === pick.id) ?? LAYOUT_LIBRARY[0];
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
      return { slots: LAYOUT_LIBRARY[0].slots, defaultScrim: LAYOUT_LIBRARY[0].scrim };
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
