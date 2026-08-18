import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAiText } from '@/lib/ai-text';
import { LAYOUT_LIBRARY, type Slot, type Accent } from '@/lib/layoutLibrary';

// Diriger un visuel prend plus que les 10 s par défaut d'une fonction Vercel :
// le modèle regarde la photo, les références, et réfléchit. Sans cette ligne,
// l'appel était coupé en plein travail et remontait comme « composition échouée ».
export const maxDuration = 60;

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
    const fmt = format ?? { w: 1080, h: 1440 };
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

    // CE QUE LA MARQUE A DÉJÀ FAIT.
    //
    // L'éditeur envoyait ses références (templates, posts validés) ; le composer,
    // lui, appelait cette route les mains vides — donc le même client obtenait une
    // composition informée dans un écran et générique dans l'autre. Les références
    // se lisent maintenant ICI quand elles ne sont pas fournies : tout appelant en
    // profite, et la RLS reste seule juge de ce qui est lisible.
    const FMT_DIMS: Record<string, [number, number]> = { 'ig-portrait': [420, 560], 'ig-square': [560, 560], 'ig-story': [315, 560], facebook: [560, 294] };
    const PT_FORMAT: Record<string, string> = { post: 'ig-portrait', reel: 'ig-story', story: 'ig-story', carrousel: 'ig-square' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summarizeZones = (zones: any[], fw: number, fh: number) => (Array.isArray(zones) ? zones : [])
      .filter(z => z?.type === 'text' && z.role)
      .map(z => ({
        role: z.role, xPct: Math.round(((z.x ?? 0) / fw) * 100), yPct: Math.round(((z.y ?? 0) / fh) * 100),
        wPct: Math.round(((z.width ?? fw) / fw) * 100), fontPct: Math.round(((z.fontSize ?? 24) / fh) * 100),
        align: z.align ?? 'left', upper: !!z.uppercase,
      }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let serverStyleRef: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let serverApprovedRef: any[] = [];
    // Derniers visuels publiés sur le compte : la meilleure description de ce que
    // « ressemble à cette marque » veut dire, bien meilleure qu'une liste d'adjectifs.
    let instaRefs: string[] = [];
    if (typeof workspaceId === 'string' && workspaceId) {
      const needStyle = !Array.isArray(styleRef) || styleRef.length === 0;
      const needApproved = !Array.isArray(approvedRef) || approvedRef.length === 0;
      try {
        const [tplRes, apprRes, tokRes] = await Promise.all([
          needStyle
            // `pages` peut ne pas exister encore en base (migration 022) : sans ce
            // repli, la requête échoue et le compositeur perd TOUTES ses références.
            ? sb.from('post_templates').select('name, format_id, background_style, text_zones, pages').eq('workspace_id', workspaceId).limit(6)
                .then(r => (r.error ? sb.from('post_templates').select('name, format_id, background_style, text_zones').eq('workspace_id', workspaceId).limit(6) : r))
            : Promise.resolve({ data: null }),
          needApproved
            ? sb.from('posts').select('post_type, editor_json').eq('workspace_id', workspaceId).eq('approved_by_client', true).limit(4)
            : Promise.resolve({ data: null }),
          sb.from('workspaces').select('instagram_access_token').eq('id', workspaceId).single(),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serverStyleRef = (tplRes.data ?? []).map((t: any) => {
          const [fw, fh] = FMT_DIMS[t.format_id as string] ?? [420, 560];
          const firstPage = Array.isArray(t.pages) && t.pages.length ? (t.pages[0]?.elements ?? []) : t.text_zones;
          return {
            name: t.name,
            bg: (t.background_style as { type?: string } | null)?.type ?? 'none',
            blocks: summarizeZones(firstPage, fw, fh),
            // Le DESSIN complet du template, conservé tel quel. Sans lui, choisir un
            // template ne rapportait qu'une grille de positions : ses couleurs, ses
            // aplats, son fond et ses formes étaient perdus, et le visuel ressortait
            // en texte nu — d'où « elle ne s'inspire pas du template ».
            elements: Array.isArray(firstPage) ? firstPage : [],
            backgroundStyle: t.background_style ?? null,
            format: [fw, fh] as [number, number],
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).filter((s: any) => s.blocks.length > 0).slice(0, 4);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serverApprovedRef = (apprRes.data ?? []).map((p: any) => {
          const [fw, fh] = FMT_DIMS[PT_FORMAT[p.post_type as string] ?? 'ig-portrait'] ?? [420, 560];
          let blks: unknown[] = [];
          try { const j = JSON.parse(p.editor_json as string); blks = summarizeZones(j?.slides?.[0]?.elements ?? [], fw, fh); } catch { /* noop */ }
          return { blocks: blks };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).filter((s: any) => (s.blocks as unknown[]).length > 0).slice(0, 3);

        const token = (tokRes.data as { instagram_access_token?: string } | null)?.instagram_access_token?.trim();
        if (token) {
          const r = await fetch(`https://graph.instagram.com/me/media?fields=media_url,media_type&limit=6&access_token=${token}`);
          const j = await r.json();
          instaRefs = (Array.isArray(j?.data) ? j.data : [])
            .filter((m: { media_type?: string; media_url?: string }) => m.media_type === 'IMAGE' && typeof m.media_url === 'string')
            .slice(0, 2)
            .map((m: { media_url: string }) => m.media_url);
        }
      } catch { /* les références sont un bonus, jamais un point de blocage */ }
    }

    // CE QUE CE CLIENT RETIENT.
    //
    // Les propositions étaient jugées trois par trois puis oubliées : une recette
    // écartée cent fois revenait intacte à la centième-et-unième. On relit les
    // choix passés — ce sont les seules préférences OBSERVÉES, pas déclarées.
    let preferred: string[] = [];
    if (typeof workspaceId === 'string' && workspaceId) {
      try {
        const { data: fb } = await sb
          .from('layout_feedback')
          .select('recipe_id')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(40);
        const tally = new Map<string, number>();
        for (const row of (fb ?? []) as { recipe_id?: string }[]) {
          const id = String(row.recipe_id ?? '');
          if (id) tally.set(id, (tally.get(id) ?? 0) + 1);
        }
        preferred = Array.from(tally.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([id, n]) => `${id} (retenue ${n} fois)`);
      } catch { /* la table peut ne pas exister encore (migration 023) */ }
    }

    // Templates du client = candidats de layout (avec leur géométrie).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tpls: any[] = Array.isArray(styleRef) && styleRef.length ? styleRef : serverStyleRef;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const approved: any[] = Array.isArray(approvedRef) && approvedRef.length ? approvedRef : serverApprovedRef;
    // Un candidat template doit se DÉCRIRE : combien de blocs, quel fond, quels
    // aplats. « Template client 3 — rôles: titre, cta » ne donne aucune raison de
    // le choisir plutôt qu'une recette générique.
    const tplCandidates = tpls.map((t, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const els: any[] = Array.isArray(t.elements) ? t.elements : [];
      const nShapes = els.filter(e => e?.type === 'rect' || e?.type === 'vector').length;
      const nBoxed = els.filter(e => e?.type === 'text' && e?.hasBg).length;
      const traits = [
        t.bg && t.bg !== 'none' ? `fond ${t.bg}` : '',
        nShapes ? `${nShapes} forme${nShapes > 1 ? 's' : ''} de couleur` : '',
        nBoxed ? `${nBoxed} texte${nBoxed > 1 ? 's' : ''} en cartouche` : '',
      ].filter(Boolean).join(', ');
      return {
        id: `tpl-${i}`,
        desc: `Template MAISON du client « ${t.name ?? i} » — ${(t.blocks ?? []).length} blocs (${(t.blocks ?? []).map((b: { role: string }) => b.role).join(', ')})${traits ? ` ; ${traits}` : ''}. Le choisir applique son dessin complet, aux couleurs de la marque.`,
        roles: (t.blocks ?? []).map((b: { role: string }) => b.role),
      };
    });
    const libCandidates = LAYOUT_LIBRARY.map(r => ({ id: r.id, desc: r.desc, anchor: r.anchor, roles: r.slots.map(s => s.role) }));

    const prompt = [
      `Tu es directeur artistique Instagram. Choisis et adapte une mise en page pour ce post (cadre ${fmt.w}×${fmt.h}px).`,
      `Couleurs charte autorisées : ${palette || 'aucune'} + white + black. Polices = marque (gérées par l'app).`,
      '',
      identity ? `LA MARQUE POUR QUI TU TRAVAILLES :\n${identity}\n\nCette identité doit se VOIR dans ta composition, pas seulement dans les mots. Une marque sobre ne prend pas la mise en page la plus tapageuse ; une marque directe ne prend pas la plus timide. Choisis la composition qui RESSEMBLE à ce client, et un alignement qui va avec son caractère — le centré est solennel, le drapeau à gauche est éditorial et moderne.` : '',
      identity ? '' : '',
      'ANALYSE la photo : où est le sujet/point focal ? quelles zones sont CALMES (pour le texte) ? haut/bas/centre clair ou sombre ?',
      'Toutes les compositions ne posent pas le texte NU sur la photo : certaines utilisent la couleur de la marque comme MATIÈRE (cartouche, bandeau plein, pastille, filet). Sur une photo chargée, ou pour une marque affirmée, elles valent mieux qu\'un simple voile noir — et ce sont elles qui donnent au visuel un air de marque plutôt qu\'une légende posée sur une image.',
      'PRINCIPES (veille design social) : règle des tiers & lecture en Z (haut-gauche -> bas-droite) ; ne place jamais le texte sur le sujet/visage ; hiérarchie claire (titre dominant) ; centré UNIQUEMENT pour une phrase courte, sinon aligné à gauche ; contraste fort ; respiration (marges).',
      '',
      'CANDIDATS DE MISE EN PAGE (tu DOIS en choisir, tu n\'inventes pas de coordonnées) :',
      'A) Templates du client (à privilégier pour rester dans son univers) :',
      JSON.stringify(tplCandidates),
      'B) Bibliothèque de layouts pros :',
      JSON.stringify(libCandidates),
      '',
      approved.length > 0 ? `Posts déjà validés par le client (ce qui lui plaît) : ${JSON.stringify(approved)}` : '',
      instaRefs.length > 0 ? `LES ${instaRefs.length} DERNIÈRES IMAGES DU COMPTE INSTAGRAM SONT JOINTES APRÈS LA PHOTO À HABILLER. Elles montrent ce que la marque publie déjà : densité de texte, place du sujet, rapport au vide, façon d'utiliser la couleur. Ta composition doit pouvoir se poser à côté d'elles sans détonner — même famille visuelle, sans les copier. La PREMIÈRE image jointe est la photo à habiller ; les suivantes ne sont que des références.` : '',
      textList.length ? `Textes à utiliser :\n${textList.map((t, i) => `${i + 1}. "${t}"`).join('\n')}` : 'Aucun texte fourni : rédige un titre court (≤6 mots) + éventuel sous-titre, cohérents avec la photo.',
      '',
      'Choisis les 3 MEILLEURS layouts (selon où le texte tombera dans une zone calme de CETTE photo). Pour chacun : remplis chaque slot (rôle->texte), choisis une couleur de charte par slot (contraste avec le fond), décide du scrim.',
      preferred.length ? `CE QUE CE CLIENT A DÉJÀ RETENU, quand on lui a proposé plusieurs mises en page : ${preferred.join(', ')}. C'est son goût OBSERVÉ, pas une règle : privilégie ces directions quand elles conviennent à cette photo, et écarte-les franchement quand elles ne conviennent pas.` : '',
      'DÉCOUPER LE TITRE EN PLUSIEURS BLOCS est une composition à part entière, souvent la plus forte : au lieu d\'un pavé de deux lignes, tu écris chaque ligne dans SON bloc (« Pause midi » / « au Shadok »), chacun avec son propre aplat. Les cartouches épousent alors la longueur de chaque ligne et créent un décroché d\'affiche. Coupe au bon endroit — là où la phrase respire naturellement, jamais au milieu d\'un groupe de mots. Les recettes « lib-stack-* » sont faites pour ça.',
      'Les trois propositions doivent être VRAIMENT différentes — pas trois variantes de texte posé sur la photo. Au moins UNE doit utiliser la couleur de la marque comme matière (cartouche, bandeau, pastille, filet) ou reprendre un template maison. Du texte blanc sur voile noir est le rendu par défaut de n\'importe quelle marque : ne le proposez que s\'il est vraiment le meilleur choix pour cette photo, jamais deux fois.',
      'Préfère TOUJOURS un template maison du client quand il peut accueillir ce contenu : le choisir applique son dessin complet — son fond, ses aplats, ses couleurs, ses formes — donc le visuel ressemble immédiatement à cette marque. Ne prends une recette de la bibliothèque que si aucun template ne convient. Évite de placer le texte sur le sujet.',
      '',
      // Un parti pris formulé AVANT les choix : ça oblige à décider d'une direction
      // (et non à prendre la mise en page la plus neutre), et ça donne à
      // l'utilisateur une raison lisible — il voit ce que l'IA a compris de sa marque.
      'Commence par formuler ton PARTI PRIS en une phrase (français, ≤ 22 mots) : quelle personnalité de marque tu lis, et quelle direction de composition tu en tires. Puis choisis.',
      '',
      'Réponds UNIQUEMENT avec ce JSON :',
      '{ "rationale": "<ton parti pris en une phrase>", "picks": [ { "source": "template"|"library", "id": "<id candidat>", "slots": [ { "role": "titre"|"sous-titre"|"cta", "text": "...", "color": "primary"|"secondary"|"accent"|"white"|"black", "uppercase": boolean } ], "scrim": { "position": "bottom"|"top"|"none", "opacity": number } } ] }',
    ].filter(Boolean).join('\n');

    const hasImage = typeof imageUrl === 'string' && imageUrl.startsWith('http');

    // La photo à habiller D'ABORD, les références Instagram ensuite (le prompt
    // dit explicitement laquelle est laquelle).
    const images = hasImage ? [imageUrl, ...instaRefs] : (instaRefs.length ? instaRefs : undefined);
    const askAi = (quality: 'high' | 'fast') => generateAiText({
      userId: session.user.id,
      userText: prompt,
      images: quality === 'high' ? images : (hasImage ? [imageUrl] : undefined),
      quality,
      temperature: 0.7,
      maxTokens: quality === 'high' ? 4000 : 1800,
    });

    let raw: string;
    try {
      // Diriger un visuel est un travail de jugement : on prend d'abord le modèle
      // qui regarde vraiment la photo et les références, et on lui laisse le droit
      // de réfléchir.
      raw = await askAi('high');
    } catch (err) {
      // Mais la qualité ne doit jamais coûter le RÉSULTAT : si ce modèle échoue
      // (indisponible, trop lent, quota), on repasse aussitôt par le modèle rapide
      // avec la seule photo. Une composition ordinaire vaut mieux qu'un échec.
      console.warn('[compose-layout] modèle de jugement indisponible, repli rapide :', err);
      try {
        raw = await askAi('fast');
      } catch (err2) {
        console.error('[compose-layout] API error:', err2);
        return NextResponse.json({ error: 'Composition échouée' }, { status: 500 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any = null;
    try { const jm = raw.match(/\{[\s\S]*\}/); if (jm) parsed = JSON.parse(jm[0]); } catch { /* noop */ }
    const picks: unknown[] = Array.isArray(parsed?.picks) ? parsed.picks : [];
    if (picks.length === 0) return NextResponse.json({ error: 'Aucune composition' }, { status: 502 });

    // Résolution : on assemble la géométrie (template ou bibliothèque) + le texte/couleur choisis par l'IA.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geomFor = (pick: any): { slots: Slot[]; defaultScrim: 'bottom' | 'top' | 'none'; accents?: Accent[] } => {
      if (pick.source === 'library') {
        const r = LAYOUT_LIBRARY.find(x => x.id === pick.id) ?? LAYOUT_LIBRARY[0];
        return { slots: r.slots, defaultScrim: r.scrim, accents: r.accents };
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

    // Un template choisi est appliqué EN ENTIER : on renvoie ses éléments, avec
    // seulement les textes remplacés par ceux que l'IA a écrits. C'est la
    // différence entre « s'inspirer du template » et « reprendre trois positions ».
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templateLayout = (pick: any) => {
      if (pick.source !== 'template') return null;
      const idx = parseInt(String(pick.id).replace('tpl-', ''), 10);
      const t = tpls[idx];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const els: any[] = Array.isArray(t?.elements) ? t.elements : [];
      if (!els.length) return null;
      const aiSlots: { role?: string; text?: string; uppercase?: boolean }[] = Array.isArray(pick.slots) ? pick.slots : [];
      const used = new Set<number>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filled = els.map((el: any) => {
        if (el?.type !== 'text' || !el.role) return el;
        let k = aiSlots.findIndex((sl, i) => !used.has(i) && sl.role === el.role && sl.text);
        if (k < 0) k = aiSlots.findIndex((sl, i) => !used.has(i) && sl.text);
        if (k < 0) return el;
        used.add(k);
        return { ...el, text: String(aiSlots[k].text) };
      });
      const [fw, fh] = (t.format as [number, number]) ?? [420, 560];
      return { elements: filled, backgroundStyle: t.backgroundStyle ?? null, sourceFormat: { w: fw, h: fh }, name: t.name };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layouts = picks.slice(0, 3).map((pick: any) => {
      const tpl = templateLayout(pick);
      if (tpl) {
        // Le dessin du template FAIT la composition — pas de voile ni d'accents
        // ajoutés par-dessus, ils défigureraient le modèle du client.
        return { template: tpl, recipeId: `tpl:${tpl.name ?? pick.id}`, source: 'template', blocks: [], scrim: { position: 'none', opacity: 0 }, accents: [], logo: { show: false } };
      }
      const { slots, defaultScrim, accents } = geomFor(pick);
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
          // L'aplat vient de la RECETTE, jamais de l'IA : c'est du dessin, et le
          // dessin reste garanti par la bibliothèque.
          ...(g.box && g.box !== 'none' ? { box: g.box, radiusPct: g.radiusPct } : {}),
        });
      }
      const scrim = pick.scrim && ['bottom', 'top', 'none'].includes(pick.scrim.position)
        ? pick.scrim
        : { position: defaultScrim, opacity: 55 };
      return { blocks: outBlocks, recipeId: String(pick.id ?? ''), source: 'library', scrim, accents: accents ?? [], logo: { show: false } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).filter((l: any) => l.blocks.length > 0 || l.template);

    if (layouts.length === 0) return NextResponse.json({ error: 'Composition vide' }, { status: 502 });
    // `rationale` = le parti pris, à afficher tel quel : c'est ce qui montre qu'une
    // intelligence a lu la marque, au lieu d'une barre de chargement muette.
    const rationale = typeof parsed?.rationale === 'string' ? parsed.rationale.trim().slice(0, 200) : null;
    return NextResponse.json({
      layouts,
      ...(rationale ? { rationale } : {}),
      refs: { templates: tpls.length, approved: approved.length, instagram: instaRefs.length },
    });
  } catch (e) {
    console.error('[compose-layout] error:', e);
    return NextResponse.json({ error: 'Erreur composition' }, { status: 500 });
  }
}
