import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAiText } from '@/lib/ai-text';
import {
  colorwayFromMetrics, vibesFromMetrics, brandColorsFromMetrics, typeIdentityFromReading,
  type BrandDNA, type FeedMetrics, type Register,
} from '@/lib/brandDNA';
import { DESIGN_RECIPES, DISPOSITIFS, type RecipeZone, type Vibe, type Dispositif } from '@/lib/designSystem';

export const runtime = 'nodejs';
// Comme les autres routes de jugement : le modèle regarde une planche de seize
// visuels avant de répondre, et c'est cette analyse qui décidera de tout ce que
// la marque recevra ensuite. Le pire endroit où lésiner.
export const maxDuration = 60;

// POST /api/brand-dna
//
// L'ADN VISUEL D'UNE MARQUE, à partir de ce qu'elle publie déjà.
//
// Ce que KLIP faisait avant : deviner le terrain de couleur et l'identité
// typographique d'un client à partir d'une EMPREINTE DE SON NOM. Stable, mais
// c'est un tirage au sort déguisé : « Amicii » et « Asterisk » recevaient des
// terrains différents parce que leurs noms hachent différemment, pas parce
// qu'on avait regardé leur travail.
//
// Le partage des rôles ici est volontaire et vaut d'être respecté :
//  · la MESURE (palette, présence, planéité, clarté) est faite côté navigateur,
//    déterministe, et arrive déjà faite dans `metrics`. Une couleur, ça se
//    compte : on ne la demande pas à un modèle, qui répondrait « bleu marine »
//    avec aplomb pour un compte qui n'en contient pas ;
//  · la LECTURE (registre typographique, motifs, intentions, manques) est
//    demandée au modèle, sur planche contact. C'est ce qu'aucun histogramme ne
//    dira jamais.
//
// Rien n'est écrit en base ici : la réponse alimente un écran que l'utilisateur
// relit et corrige, comme `/api/brand/analyze` pour le site web.

const ZONES: RecipeZone[] = ['haut', 'bas', 'centre', 'partout', 'hors-photo'];
const REGISTRES: Register[] = ['grotesque', 'serif', 'condense', 'manuscrit', 'mixte', 'aucun'];
const VIBES: Vibe[] = ['sobre', 'audacieux', 'chaleureux', 'minimal', 'ludique', 'luxe', 'tech', 'retro', 'editorial'];
// Les familles réellement présentes dans `DESIGN_RECIPES`. Elles sont relevées
// à la construction plutôt que recopiées : une famille inventée dans le prompt
// ressort en choix que `recipePoolForDNA` ne saura pas honorer, et le penchant
// se perd sans erreur visible.
const FAMILLES = Array.from(new Set(DESIGN_RECIPES.map(r => r.family))).sort();

function asMetrics(v: unknown): FeedMetrics | null {
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  if (!Array.isArray(m.colors)) return null;
  const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
  return {
    postCount: num(m.postCount, 0),
    read: num(m.read, 0),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    colors: (m.colors as any[]).slice(0, 24),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signature: Array.isArray(m.signature) ? (m.signature as any[]).slice(0, 12) : [],
    lightness: num(m.lightness, 0.5),
    contrast: num(m.contrast, 0),
    saturation: num(m.saturation, 0),
  };
}

const strArr = (v: unknown, allowed?: readonly string[], max = 8): string[] =>
  (Array.isArray(v) ? v : [])
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map(x => x.trim())
    .filter(x => !allowed || allowed.includes(x))
    .slice(0, max);

export async function POST(request: NextRequest) {
  try {
    const sb = createRouteHandlerClient({ cookies });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await request.json();
    const metrics = asMetrics(body?.metrics);
    if (!metrics || metrics.read < 3) {
      return NextResponse.json(
        { error: 'Pas assez de publications lisibles pour analyser le style (3 minimum).' },
        { status: 422 },
      );
    }
    const sheet: string | null = typeof body?.sheet === 'string' && body.sheet.startsWith('data:') ? body.sheet : null;
    const captions = strArr(body?.captions, undefined, 12);
    const source: BrandDNA['source'] = ['instagram', 'canva', 'upload', 'mixte'].includes(body?.source)
      ? body.source : 'instagram';

    // Identité déclarée : elle ne décide plus du terrain, mais elle reste le
    // brief. Le modèle doit savoir pour qui il lit ces visuels.
    let name: string | null = null, sector: string | null = null, tone: string | null = null;
    if (typeof body?.workspaceId === 'string' && body.workspaceId) {
      const { data: ws } = await sb
        .from('workspaces')
        .select('name, sector, tone')
        .eq('id', body.workspaceId)
        .single();
      if (ws) { name = ws.name ?? null; sector = ws.sector ?? null; tone = ws.tone ?? null; }
    }
    if (typeof body?.name === 'string' && body.name.trim()) name = body.name.trim();
    if (typeof body?.sector === 'string' && body.sector.trim()) sector = body.sector.trim();

    // ── 1. Ce qui est MESURÉ, et qui ne se discute pas ────────────────────────
    const way = colorwayFromMetrics(metrics);
    const vibesMesurees = vibesFromMetrics(metrics);
    const brandColors = brandColorsFromMetrics(metrics);

    const dire = (c: { hex: string; share: number; posts: number; sat: number; flat: number }) =>
      `${c.hex} (${Math.round(c.share * 100)} % de la surface, vue dans ${c.posts}/${metrics.read} publications, saturation ${c.sat.toFixed(2)}, posée à plat ${Math.round(c.flat * 100)} %)`;

    const releve = [
      `${metrics.read} publications lues sur ${metrics.postCount}.`,
      `Clarté moyenne du fil : ${metrics.lightness.toFixed(2)} sur 1 (0 = fil sombre, 1 = fil très clair).`,
      `Contraste moyen : ${metrics.contrast.toFixed(2)}. Saturation moyenne : ${metrics.saturation.toFixed(2)}.`,
      '',
      'PALETTE RELEVÉE, la plus présente en premier :',
      ...metrics.colors.slice(0, 10).map(c => `  ${dire(c)}`),
      '',
      metrics.signature.length
        ? `COULEURS DE SIGNATURE (elles reviennent d'une publication à l'autre ET sont posées à plat, donc ce sont des choix de marque et non des couleurs de photo) :\n${metrics.signature.map(c => `  ${dire(c)}`).join('\n')}`
        : "AUCUNE couleur de signature : rien ne revient à plat d'une publication à l'autre. Ce compte n'a pas encore d'identité de couleur, il n'a que des photos.",
    ].join('\n');

    // ── 2. Ce qui est LU, et qu'aucun histogramme ne donnera ──────────────────
    const system = `Tu es directeur artistique. Tu lis un compte Instagram de marque comme on lit une planche contact : ce qui revient, ce qui est décidé, ce qui manque.
Tu es précis et tu ne flattes pas. Un compte sans identité doit s'entendre dire qu'il n'en a pas encore.
Tu ne décris JAMAIS une couleur toi-même : les couleurs sont mesurées et te sont données. Tu parles de composition, de typographie, de gestes, de sujets.
Tu réponds en français, UNIQUEMENT avec le JSON demandé.`;

    const user = [
      name ? `Marque : ${name}${sector ? ` (secteur : ${sector})` : ''}${tone ? ` ; ton déclaré : ${tone}` : ''}.` : 'Marque non renseignée.',
      '',
      sheet
        ? "L'IMAGE JOINTE est la planche contact des dernières publications du compte, dans l'ordre, de gauche à droite puis de haut en bas."
        : "Aucune image n'a pu être jointe : appuie-toi uniquement sur le relevé chiffré et les légendes.",
      '',
      'RELEVÉ MESURÉ SUR LES IMAGES (fiable, ne le contredis pas) :',
      releve,
      '',
      captions.length ? `LÉGENDES RÉCENTES :\n${captions.map((c, i) => `${i + 1}. ${c.slice(0, 240)}`).join('\n')}` : '',
      '',
      'Réponds UNIQUEMENT avec ce JSON valide, sans rien avant ni après :',
      JSON.stringify({
        summary: 'ce que ce fil raconte visuellement, 2 a 3 phrases, sans complaisance',
        register: `le registre typographique dominant, une valeur parmi ${REGISTRES.join(' | ')} ("aucun" si les visuels ne portent pas de texte)`,
        vibes: `1 a 3 personnalites parmi ${VIBES.join(' | ')}`,
        textOnPhoto: 'jamais | rare | souvent | toujours',
        zones: `ou la marque ecrit sur ses photos, 1 a 3 valeurs parmi ${ZONES.join(' | ')}`,
        families: `1 a 4 familles de composition qui ressemblent a ce compte, parmi ${FAMILLES.join(' | ')}`,
        motifs: ['3 a 5 gestes visuels qui REVIENNENT (badge en haut a droite, signature manuscrite, cadre blanc, filet, gros chiffre...)'],
        dispositifs: `les procedes de composition que tu vois REVENIR, 1 a 6 valeurs STRICTEMENT parmi : ${DISPOSITIFS.map(d => d.id).join(' | ')}`,
        gaps: ['2 a 4 manques concrets et actionnables : ce que ce compte ne fait jamais et qui lui servirait'],
      }, null, 0),
      '',
      'CONTRAINTES : « zones » et « families » servent à choisir de vraies compositions ensuite, donc n\'invente aucune valeur hors des listes. « motifs » décrit ce que tu VOIS se répéter, pas ce que tu imagines. Si tu ne vois rien se répéter, renvoie une liste vide plutôt qu\'une invention.',
      // « motifs » est du texte libre : il informe, il ne peut rien choisir.
      // « dispositifs » est le MÊME constat dit dans le vocabulaire des recettes,
      // donc il pèse mécaniquement sur le tirage. C'est la différence entre voir
      // juste et servir à quelque chose.
      `DISPOSITIFS, ce que chaque valeur désigne : ${DISPOSITIFS.map(d => `${d.id} = ${d.label}`).join(' ; ')}. N'en cite aucun que tu ne vois pas RÉELLEMENT sur ces visuels.`,
    ].filter(Boolean).join('\n');

    let raw: string;
    try {
      raw = await generateAiText({
        userId: session.user.id,
        system,
        userText: user,
        images: sheet ? [sheet] : undefined,
        quality: 'high',
        temperature: 0.4,
        maxTokens: 1600,
      });
    } catch (err) {
      console.warn('[brand-dna] modèle de jugement indisponible, repli rapide :', err);
      try {
        raw = await generateAiText({
          userId: session.user.id, system, userText: user,
          images: sheet ? [sheet] : undefined,
          quality: 'fast', temperature: 0.4, maxTokens: 1200,
        });
      } catch (err2) {
        console.error('[brand-dna] API error:', err2);
        return NextResponse.json({ error: 'Analyse impossible pour le moment' }, { status: 500 });
      }
    }

    let p: Record<string, unknown> = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) p = JSON.parse(m[0]);
    } catch {
      return NextResponse.json({ error: 'Réponse IA illisible' }, { status: 500 });
    }

    // ── 3. On recolle, et la mesure garde le dernier mot sur les couleurs ─────
    const register = (REGISTRES.includes(p.register as Register) ? p.register : 'aucun') as Register;
    // Les personnalités lues et mesurées se complètent : la mesure connaît la
    // clarté et la saturation, le modèle connaît le geste. Les deux d'abord,
    // dédoublonnées, la mesure en tête parce qu'elle ne se trompe pas de fil.
    const vibes = Array.from(new Set([
      ...vibesMesurees,
      ...(strArr(p.vibes, VIBES, 3) as Vibe[]),
    ])).slice(0, 4) as Vibe[];

    const dna: BrandDNA = {
      version: 1,
      measuredAt: new Date().toISOString(),
      source,
      metrics,
      vibes,
      register,
      colorwayId: way?.colorway.id ?? '',
      typeIdentityId: typeIdentityFromReading(register, vibes, sector, name),
      colorwayWhy: way?.why ?? 'palette trop pauvre pour choisir un terrain',
      textOnPhoto: (['jamais', 'rare', 'souvent', 'toujours'] as const).includes(p.textOnPhoto as never)
        ? p.textOnPhoto as BrandDNA['textOnPhoto'] : 'rare',
      zones: strArr(p.zones, ZONES, 3) as RecipeZone[],
      families: strArr(p.families, FAMILLES, 4),
      motifs: strArr(p.motifs, undefined, 5),
      dispositifs: strArr(p.dispositifs, DISPOSITIFS.map(d => d.id), 6) as Dispositif[],
      gaps: strArr(p.gaps, undefined, 4),
      summary: typeof p.summary === 'string' ? p.summary.slice(0, 600) : '',
      brandColors,
    };

    return NextResponse.json({ dna, colorway: way?.colorway ?? null });
  } catch (err) {
    console.error('[brand-dna] unexpected:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
