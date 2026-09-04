import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAiText } from '@/lib/ai-text';
import {
  findDesignRecipe, recipeSiblings, describeDesignCandidates,
  sanitizeFields, buildDesignElements, resolveFonts, resolvePalette, type DesignRecipe,
} from '@/lib/designSystem';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/brand-dna/variantes
//
// « Ce n'est pas juste copier-coller, c'est faire des variantes, d'autres
// compositions qui se ressemblent un peu mais qui s'adaptent à chaque format. »
//
// DEUX DÉCISIONS PORTENT CETTE ROUTE.
//
// 1. LE CHOIX DES COMPOSITIONS EST DÉTERMINISTE (`recipeSiblings`). « Qu'est-ce
//    qui ressemble à ça » est une question de parenté — même zone, mêmes
//    intentions, même personnalité, autre dessin — pas une question de goût. Un
//    modèle de langage y répondrait par ses préférences habituelles, c'est-à-dire
//    toujours les mêmes trois recettes. On ne lui laisse que ce qu'il fait bien :
//    écrire les textes de chaque bloc.
//
// 2. L'ADAPTATION AUX FORMATS EST GRATUITE, et c'est le dessin qui la donne. Les
//    recettes sont écrites en FRACTIONS du cadre, jamais en pixels : la même
//    composition se rend en 4:5, en carré ou en story sans qu'on y touche. Il
//    suffisait de l'exposer.

const FORMATS: Record<string, { w: number; h: number; label: string }> = {
  'ig-portrait': { w: 1080, h: 1440, label: 'Portrait 3:4' },
  'ig-45': { w: 1080, h: 1350, label: 'Portrait 4:5' },
  'ig-square': { w: 1080, h: 1080, label: 'Carré' },
  'ig-story': { w: 1080, h: 1920, label: 'Story' },
  facebook: { w: 1200, h: 630, label: 'Facebook' },
};

export async function POST(request: NextRequest) {
  try {
    const sb = createRouteHandlerClient({ cookies });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await request.json();
    const source = findDesignRecipe(body?.recipeId);
    if (!source) return NextResponse.json({ error: 'Composition de départ inconnue' }, { status: 400 });

    const demandes: string[] = Array.isArray(body?.formats) && body.formats.length
      ? body.formats.filter((f: unknown) => typeof f === 'string' && FORMATS[f as string])
      : ['ig-portrait'];
    const combien = Math.max(1, Math.min(Number(body?.count) || 4, 8));

    let brand = { primary: null as string | null, secondary: null as string | null, accent: null as string | null,
      display: null as string | null, body: null as string | null, name: null as string | null,
      handle: null as string | null, sector: null as string | null, tone: null as string | null,
      colorwayId: null as string | null, typeIdentityId: null as string | null };

    // Les polices déposées par le client, comme pour les modèles : sans leurs
    // adresses, l'aperçu des variantes retombe sur la police du navigateur et la
    // charte paraît ignorée alors qu'elle est appliquée.
    let polices: { family: string; url: string; weight?: number }[] = [];

    if (typeof body?.workspaceId === 'string' && body.workspaceId) {
      // UNE COLONNE OPTIONNELLE NE DOIT JAMAIS EFFACER LA CHARTE.
      //
      // `visual_dna` était demandé dans la même requête que le reste. La colonne
      // n'existe pas encore en base (migration 028 non passée), donc TOUTE la
      // requête échouait : la marque restait vide et les variantes repartaient
      // sur une identité déduite du nom, alors que les modèles — dont la requête
      // ne demandait pas cette colonne — respectaient la charte. Deux
      // comportements pour un même client, à cause d'un champ facultatif.
      //
      // On lit donc l'essentiel d'abord, et l'ADN à part, en tolérant son
      // absence. La base a du retard sur le code, c'est un fait avec lequel il
      // faut composer plutôt que le découvrir en production.
      const { data: ws, error: errWs } = await sb.from('workspaces')
        .select('name, sector, tone, instagram_username, primary_color, secondary_color, accent_color, font_family, font_secondary, font_primary_url, font_secondary_url, brand_fonts')
        .eq('id', body.workspaceId).single();

      let adn: { colorwayId?: string; typeIdentityId?: string } = {};
      const { data: wsDna } = await sb.from('workspaces').select('visual_dna').eq('id', body.workspaceId).single();
      if (wsDna?.visual_dna) adn = wsDna.visual_dna as typeof adn;
      // UNE LECTURE MUETTE FAISAIT PASSER LA CHARTE À LA TRAPPE. Sans ce
      // journal, un workspace introuvable ou une colonne absente laissait la
      // marque entièrement vide, et les variantes sortaient en police générique
      // pendant que les modèles, eux, respectaient la charte. Deux chemins, un
      // seul silencieux : c'est exactement ce qui rend un défaut introuvable.
      if (errWs) console.error('[brand-dna/variantes] charte illisible :', errWs.message);
      if (ws) {
        const dna = adn;
        const familles = Array.isArray(ws.brand_fonts) ? ws.brand_fonts as { family?: string; variants?: { weight?: number; italic?: boolean; url?: string }[] }[] : [];
        polices = [
          ...familles.flatMap(f => (f.variants ?? []).filter(v => v.url && !v.italic)
            .map(v => ({ family: String(f.family ?? ''), url: String(v.url), weight: v.weight }))),
          ...(ws.font_family && ws.font_primary_url ? [{ family: ws.font_family as string, url: ws.font_primary_url as string }] : []),
          ...(ws.font_secondary && ws.font_secondary_url ? [{ family: ws.font_secondary as string, url: ws.font_secondary_url as string }] : []),
        ].filter(p => p.family && p.url);
        brand = {
          primary: ws.primary_color ?? null, secondary: ws.secondary_color ?? null, accent: ws.accent_color ?? null,
          display: ws.font_family ?? null, body: ws.font_secondary ?? null,
          name: ws.name ?? null, handle: ws.instagram_username ? `@${ws.instagram_username}` : null,
          sector: ws.sector ?? null, tone: ws.tone ?? null,
          colorwayId: dna.colorwayId ?? null, typeIdentityId: dna.typeIdentityId ?? null,
        };
      }
    }

    const soeurs = recipeSiblings(source, combien);
    if (!soeurs.length) return NextResponse.json({ error: 'Aucune composition parente' }, { status: 404 });

    // Les textes du modèle de départ servent de brief : les variantes doivent
    // dire la MÊME chose autrement, pas inventer un autre sujet.
    const depart = sanitizeFields(source, body?.fields ?? {});
    const prompt = [
      'Tu écris les textes de VARIANTES d’un modèle de marque déjà validé.',
      brand.name ? `Marque : ${brand.name}${brand.sector ? ` (${brand.sector})` : ''}.` : '',
      '',
      `MODÈLE DE DÉPART — « ${source.name} » : ${source.desc}`,
      `Ses textes, qui disent ce que la marque veut dire : ${JSON.stringify(depart)}`,
      '',
      'COMPOSITIONS À REMPLIR. Le dessin est fixé, tu écris seulement le contenu de chaque champ :',
      JSON.stringify(describeDesignCandidates(soeurs)),
      '',
      'RÈGLES :',
      '1. Chaque variante dit la MÊME chose que le modèle de départ, autrement. Ce n’est pas un nouveau sujet.',
      '2. ÉCRIS COURT. La longueur décide de la taille du titre : trois mots remplissent la colonne, douze la réduisent à du corps de texte. Quand un champ annonce un maximum, vise la moitié.',
      '3. Écris comme cette marque parle. Pas de formule creuse, pas de superlatif vide.',
      '4. Remplis TOUS les champs de chaque composition, et seulement ceux-là.',
      '',
      'Réponds UNIQUEMENT avec ce JSON :',
      '{ "variantes": [ { "id": "<id de composition>", "fields": { "<cle>": "<texte>" } } ] }',
    ].filter(Boolean).join('\n');

    let raw: string;
    try {
      raw = await generateAiText({ userId: session.user.id, userText: prompt, quality: 'high', temperature: 0.7, maxTokens: 2200 });
    } catch {
      raw = await generateAiText({ userId: session.user.id, userText: prompt, quality: 'fast', temperature: 0.7, maxTokens: 1600 });
    }

    let ecrits: Record<string, Record<string, string>> = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      const arr = m ? JSON.parse(m[0])?.variantes ?? [] : [];
      ecrits = Object.fromEntries(
        (arr as { id?: string; fields?: Record<string, string> }[])
          .filter(v => typeof v?.id === 'string')
          .map(v => [v.id as string, v.fields ?? {}]),
      );
    } catch { /* on retombe sur les textes du modèle de départ */ }

    // Chaque variante est rendue dans CHAQUE format demandé. Les recettes étant
    // écrites en fractions, c'est le même dessin qui se recadre, pas un autre.
    const variantes = soeurs.map((r: DesignRecipe) => {
      const fields = sanitizeFields(r, { ...depart, ...(ecrits[r.id] ?? {}) });
      return {
        recipeId: r.id, name: r.name, family: r.family, desc: r.desc, fields,
        rendus: demandes.map((f) => {
          const fmt = FORMATS[f];
          return {
            format_id: f, label: fmt.label, w: fmt.w, h: fmt.h,
            elements: buildDesignElements(r, { fields, brand, w: fmt.w, h: fmt.h, hasPhoto: true }),
          };
        }),
      };
    });

    const ft = resolveFonts(brand);
    const pal = resolvePalette(brand);
    return NextResponse.json({
      source: { recipeId: source.id, name: source.name },
      variantes,
      polices,
      // La charte appliquée AUX VARIANTES, pour qu'un écart avec celle des
      // modèles se voie au lieu de se deviner.
      applique: { titre: ft.display, texte: ft.body, identiteNom: ft.ident.name,
        titreDeLaCharte: ft.displayDeLaCharte, couleurs: { marque: pal.brand, accent: pal.accent } },
    });
  } catch (err) {
    console.error('[brand-dna/variantes] inattendu :', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
