import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAiText } from '@/lib/ai-text';
import { recipePoolForDNA, type BrandDNA } from '@/lib/brandDNA';
import {
  describeDesignCandidates, findDesignRecipe, sanitizeFields,
  buildDesignElements, type DesignRecipe,
} from '@/lib/designSystem';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/brand-dna/templates
//
// Les modèles de départ d'une marque, tirés de son ADN.
//
// Deuxième temps de l'analyse, et volontairement une route à part : la lecture
// (`/api/brand-dna`) doit s'afficher dès qu'elle est prête, pendant que celle-ci
// travaille. Les deux dans un seul appel dépasseraient la minute et l'écran
// resterait vide tout du long, ce qui est le pire moment pour faire attendre :
// c'est le tout premier écran après la connexion du compte.
//
// L'IA NE DESSINE PAS, ici non plus. Elle choisit dans un tirage de compositions
// déjà dessinées, penché vers ce qui a été relevé sur le fil, et elle écrit les
// textes de chaque bloc. La géométrie, les couleurs et les tailles viennent du
// dessin : c'est ce qui garantit que les modèles proposés tiennent debout.

const FORMATS: Record<string, { w: number; h: number }> = {
  'ig-portrait': { w: 1080, h: 1440 },
  'ig-square': { w: 1080, h: 1080 },
  'ig-story': { w: 1080, h: 1920 },
  facebook: { w: 1200, h: 630 },
};

export async function POST(request: NextRequest) {
  try {
    const sb = createRouteHandlerClient({ cookies });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await request.json();
    const dna = body?.dna as BrandDNA | undefined;
    if (!dna || typeof dna !== 'object' || !Array.isArray(dna.families)) {
      return NextResponse.json({ error: 'ADN manquant' }, { status: 400 });
    }
    const formatId = typeof body?.formatId === 'string' && FORMATS[body.formatId] ? body.formatId : 'ig-portrait';
    const fmt = FORMATS[formatId];
    const wanted = Math.max(3, Math.min(Number(body?.count) || 6, 9));
    const avoid: string[] = Array.isArray(body?.avoid) ? body.avoid.filter((x: unknown) => typeof x === 'string') : [];

    let name: string | null = typeof body?.name === 'string' ? body.name : null;
    let sector: string | null = typeof body?.sector === 'string' ? body.sector : null;
    let tone: string | null = null;
    let handle: string | null = typeof body?.handle === 'string' ? body.handle : null;
    let brand = { primary: null as string | null, secondary: null as string | null, accent: null as string | null, display: null as string | null, bodyFont: null as string | null };

    if (typeof body?.workspaceId === 'string' && body.workspaceId) {
      const { data: ws } = await sb
        .from('workspaces')
        .select('name, sector, tone, instagram_username, primary_color, secondary_color, accent_color, font_family, font_secondary, company_description')
        .eq('id', body.workspaceId)
        .single();
      if (ws) {
        name = name ?? ws.name ?? null;
        sector = sector ?? ws.sector ?? null;
        tone = ws.tone ?? null;
        handle = handle ?? (ws.instagram_username ? `@${ws.instagram_username}` : null);
        brand = {
          primary: ws.primary_color ?? null, secondary: ws.secondary_color ?? null,
          accent: ws.accent_color ?? null, display: ws.font_family ?? null, bodyFont: ws.font_secondary ?? null,
        };
      }
    }

    // LA CHARTE MESURÉE PASSE DEVANT LA CHARTE DÉCLARÉE.
    //
    // Un compte tout juste connecté n'a le plus souvent aucune couleur en base :
    // les trois champs sont vides et les compositions repartent sur le terrain
    // de secours, c'est-à-dire sur du générique. Les couleurs relevées sur le
    // fil sont, à ce moment précis du parcours, la meilleure charte disponible.
    // Elles ne sont pas ÉCRITES en base : l'écran les propose, l'utilisateur
    // tranche.
    const mesurees = Array.isArray(dna.brandColors) ? dna.brandColors : [];
    const buildBrand = {
      primary: brand.primary ?? mesurees[0] ?? null,
      secondary: brand.secondary ?? mesurees[1] ?? null,
      accent: brand.accent ?? mesurees[2] ?? mesurees[1] ?? null,
      display: brand.display, body: brand.bodyFont,
      name, handle, sector, tone,
      // Les deux décisions mesurées, qui remplacent l'empreinte du nom.
      colorwayId: dna.colorwayId || null,
      typeIdentityId: dna.typeIdentityId || null,
    };

    // Un tirage penché vers l'ADN, jamais le catalogue entier : un modèle à
    // préférences stables rechoisit les mêmes trois recettes quand on lui en
    // montre quatre-vingts.
    const pool = recipePoolForDNA(dna, { hasPhoto: true, count: Math.max(14, wanted * 2), avoid });
    if (!pool.length) return NextResponse.json({ error: 'Aucune composition disponible' }, { status: 500 });

    const prompt = [
      `Tu prépares les MODÈLES DE DÉPART d'une marque sur KLIP, à partir de la lecture de son compte Instagram.`,
      name ? `Marque : ${name}${sector ? ` (${sector})` : ''}${handle ? ` ${handle}` : ''}.` : '',
      '',
      "CE QU'ON A LU DE CE COMPTE :",
      dna.summary ? `Résumé : ${dna.summary}` : '',
      `Personnalité : ${(dna.vibes ?? []).join(', ') || 'non déterminée'}.`,
      `Registre typographique : ${dna.register}. Texte sur photo : ${dna.textOnPhoto}.`,
      dna.zones?.length ? `La marque écrit dans ces zones de ses photos : ${dna.zones.join(', ')}.` : '',
      dna.motifs?.length ? `Gestes qui reviennent chez elle : ${dna.motifs.join(' ; ')}.` : '',
      dna.gaps?.length ? `Ce qu'elle ne fait JAMAIS et qui lui servirait : ${dna.gaps.join(' ; ')}.` : '',
      mesurees.length ? `Couleurs relevées sur son fil : ${mesurees.join(', ')}.` : '',
      '',
      `COMPOSITIONS DISPONIBLES (cadre ${fmt.w}x${fmt.h}). Tu CHOISIS parmi elles, tu n'inventes ni coordonnées, ni couleurs, ni tailles :`,
      JSON.stringify(describeDesignCandidates(pool)),
      '',
      `Choisis ${wanted} compositions et remplis leurs champs pour en faire les modèles de départ de CETTE marque.`,
      'RÈGLES :',
      `1. Les ${wanted} doivent venir de familles DIFFÉRENTES et ne pas se ressembler en vignette. Un jeu de modèles où tout se ressemble ne sert à rien : c'est le reproche « elle a trois templates et c'est toujours les mêmes ».`,
      "2. La majorité doit ressembler à ce que la marque fait DÉJÀ (mêmes zones, mêmes gestes) : la personne doit se reconnaître au premier coup d'œil. Une ou deux peuvent viser un manque relevé, à condition que ça reste crédible pour elle.",
      "3. Chaque modèle sert une INTENTION de publication différente et réutilisable (l'annonce, l'offre, le conseil, la preuve client, les coulisses, le menu). Un modèle qui ne sert qu'une fois n'est pas un modèle.",
      "4. Les textes sont des EXEMPLES tenables pour cette marque, écrits comme elle parle. Pas de formule creuse. Un champ « max 14 caractères » veut dire un ou deux mots.",
      "5. ÉCRIS COURT. C'est la longueur du texte qui décide si un titre sera grand ou minuscule : trois mots remplissent la colonne, douze la réduisent à du corps de texte. Quand un champ annonce un maximum, vise la moitié.",
      '',
      'Réponds UNIQUEMENT avec ce JSON :',
      '{ "picks": [ { "id": "<id de composition>", "nom": "<nom du modèle, 2 a 4 mots, ce à quoi il sert>", "intention": "<a quoi il sert, une phrase courte>", "fields": { "<cle>": "<texte>" } } ] }',
    ].filter(Boolean).join('\n');

    let raw: string;
    try {
      raw = await generateAiText({
        userId: session.user.id, userText: prompt,
        quality: 'high', temperature: 0.75, maxTokens: 3000,
      });
    } catch (err) {
      console.warn('[brand-dna/templates] repli rapide :', err);
      try {
        raw = await generateAiText({ userId: session.user.id, userText: prompt, quality: 'fast', temperature: 0.75, maxTokens: 2000 });
      } catch (err2) {
        console.error('[brand-dna/templates] API error:', err2);
        return NextResponse.json({ error: 'Proposition impossible pour le moment' }, { status: 500 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let picks: any[] = [];
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) picks = JSON.parse(m[0])?.picks ?? [];
    } catch { /* traité juste après */ }
    if (!Array.isArray(picks) || !picks.length) {
      return NextResponse.json({ error: 'Réponse IA illisible' }, { status: 500 });
    }

    // Revalidation contre les VRAIES recettes : le modèle peut citer un id qui
    // n'existe pas, ou remplir un champ qui n'appartient pas à la composition.
    const vus = new Set<string>();
    const templates = picks.map((p) => {
      const recipe: DesignRecipe | null = findDesignRecipe(p?.id);
      if (!recipe || vus.has(recipe.id)) return null;
      vus.add(recipe.id);
      const fields = sanitizeFields(recipe, p?.fields);
      const elements = buildDesignElements(recipe, { fields, brand: buildBrand, w: fmt.w, h: fmt.h, hasPhoto: true });
      return {
        recipeId: recipe.id,
        name: typeof p?.nom === 'string' && p.nom.trim() ? p.nom.trim().slice(0, 60) : recipe.name,
        intention: typeof p?.intention === 'string' ? p.intention.trim().slice(0, 160) : '',
        family: recipe.family,
        fields,
        format_id: formatId,
        sourceFormat: fmt,
        elements,
      };
    }).filter(Boolean);

    if (!templates.length) {
      return NextResponse.json({ error: 'Aucune composition valide retenue' }, { status: 500 });
    }
    return NextResponse.json({ templates, brand: buildBrand });
  } catch (err) {
    console.error('[brand-dna/templates] unexpected:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
