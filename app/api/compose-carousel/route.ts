import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAiText } from '@/lib/ai-text';
import { CAROUSEL_ARCHETYPES, type Archetype } from '@/lib/carouselDesigns';

// Un carrousel = plusieurs slides rédigées et mises en page d'un coup. Le budget
// par défaut de Vercel (10 s) ne suffit pas.
export const maxDuration = 60;

// POST /api/compose-carousel
//
// UN SUJET → LE CARROUSEL ENTIER.
//
// `compose-layout` sait habiller UNE image : il choisit une mise en page et la
// remplit. Ce qu'il ne sait pas faire, c'est écrire un CARROUSEL — l'arc narratif
// qui court sur N slides (on accroche, on déroule, on conclut), où chaque slide
// n'a de sens que par rapport à celle d'avant et celle d'après.
//
// Même principe que partout ailleurs ici : l'IA NE DESSINE PAS. Elle choisit un
// ARCHÉTYPE de slide (`lib/carouselDesigns.ts`) et écrit ses textes ; tout le
// décor — formes, chiffres géants, cartes, pastilles, filets — est dessiné par le
// moteur. La première version réutilisait la bibliothèque de mises en page prévue
// pour du texte SUR PHOTO : sans photo elle ne produisait qu'un aplat de couleur
// avec du texte centré, c'est-à-dire aucun design.
//
// La route ne rend donc que des TEXTES et un nom d'archétype. Les slides obtenues
// restent des slides ordinaires, éditables et annulables comme les autres.

const MIN_SLIDES = 3;
const MAX_SLIDES = 10;
const DEFAULT_SLIDES = 6;

const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface BrandRow {
  name?: string | null;
  sector?: string | null;
  tone?: string | null;
  words_to_use?: string | null;
  words_to_avoid?: string | null;
  company_description?: string | null;
  caption_examples?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
}

function brandBlock(b: BrandRow | null): string {
  if (!b) return "Aucune charte renseignée : reste sobre et neutre.";
  return [
    b.name ? `Marque : ${b.name}` : '',
    b.sector ? `Secteur : ${b.sector}` : '',
    b.company_description ? `Activité : ${b.company_description}` : '',
    b.tone ? `Ton de la marque : ${b.tone}` : '',
    b.words_to_use ? `Mots à privilégier : ${b.words_to_use}` : '',
    b.words_to_avoid ? `Mots à BANNIR : ${b.words_to_avoid}` : '',
    b.caption_examples ? `Exemples de sa façon d'écrire :\n${b.caption_examples}` : '',
  ].filter(Boolean).join('\n');
}

const SYSTEM = `Tu écris et mets en page des CARROUSELS Instagram/LinkedIn pour une marque. Un carrousel n'est pas une suite d'images : c'est UN raisonnement découpé en slides qu'on fait défiler.

LA STRUCTURE, non négociable :
- SLIDE 1 = L'ACCROCHE. Elle doit donner envie de swiper, et elle seule décide si le carrousel est lu. Une promesse, une tension, un chiffre qui surprend, une idée reçue qu'on va casser. JAMAIS un titre de chapitre ("Nos services"), jamais le nom de la marque seul.
- SLIDES DU MILIEU = LE CONTENU. Une seule idée par slide. Elles avancent : chacune apporte quelque chose que la précédente n'avait pas. Si deux slides pourraient être interverties sans que rien ne change, c'est qu'il en manque une ou qu'il y en a une de trop.
- DERNIÈRE SLIDE = LA CONCLUSION + L'APPEL À L'ACTION. Ce qu'on retient, et ce qu'on fait maintenant.

L'ÉCRITURE :
- Court. Une slide se lit en deux secondes, pouce en l'air. Un titre fait 3 à 8 mots.
- Concret. Un exemple, un chiffre, un cas valent mieux qu'un adjectif.
- Pas de remplissage : ni "Introduction", ni "En conclusion", ni "N'hésitez pas à".
- Tu écris dans le TON de la marque, avec ses mots, sans ceux qu'elle bannit.
- Tu écris en FRANÇAIS.

LA MISE EN PAGE :
Tu ne dessines RIEN et tu ne places aucune coordonnée. Pour chaque slide tu CHOISIS un ARCHÉTYPE dans la liste fournie et tu écris ses textes. Le décor — formes, chiffres géants, cartes, pastilles, filets d'accent — est dessiné par le moteur.
- La PREMIÈRE slide prend un archétype "cover", la DERNIÈRE un archétype "closing", les autres un archétype "content".
- VARIE les archétypes de contenu : trois slides "numbered" d'affilée, c'est un document Word. Alterne pour donner du rythme.
- Chaque archétype liste ses emplacements avec une longueur conseillée en mots (« max »). RESPECTE-LA : le moteur rétrécit le texte trop long, mais une slide dont tout est rétréci est une slide ratée.
- Un emplacement marqué « required » doit être rempli. Les autres, seulement s'ils apportent quelque chose.
- Pour l'archétype "checklist", le champ "corps" contient les points séparés par le caractère « | » (3 points maximum).

Tu réponds avec un UNIQUE objet JSON, sans texte autour, sans bloc de code :

{
  "title": "titre interne du carrousel, court",
  "slides": [
    { "archetype": "<id EXACT d'un archétype>", "kicker": "...", "titre": "...", "corps": "...", "cta": "..." }
  ],
  "caption": "la légende du post, prête à publier, avec 3 à 5 hashtags pertinents"
}

N'inclus que les champs de texte que l'archétype choisi accepte. Pas de champ vide.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await request.json();
    const brief = typeof body?.brief === 'string' ? body.brief.trim() : '';
    if (!brief) return NextResponse.json({ error: 'brief requis' }, { status: 400 });

    const workspaceId: unknown = body?.workspaceId;
    const slideCount = clamp(Math.round(num(body?.slideCount, DEFAULT_SLIDES)), MIN_SLIDES, MAX_SLIDES);

    // La charte est lue côté serveur : la RLS de Supabase reste la seule autorité
    // sur qui a le droit d'y accéder.
    let brand: BrandRow | null = null;
    if (typeof workspaceId === 'string' && workspaceId) {
      const { data } = await supabase
        .from('workspaces')
        .select('name, sector, tone, words_to_use, words_to_avoid, company_description, caption_examples, primary_color, secondary_color, accent_color')
        .eq('id', workspaceId)
        .single();
      brand = (data as BrandRow) ?? null;
    }

    const archetypes = CAROUSEL_ARCHETYPES.map((a) => ({ id: a.id, usage: a.use, desc: a.desc, slots: a.slots }));

    const userText = [
      `CHARTE :\n${brandBlock(brand)}`,
      '',
      `ARCHÉTYPES DE SLIDES (choisis parmi ces id, n'en invente aucun) :\n${JSON.stringify(archetypes)}`,
      '',
      `SUJET DU CARROUSEL :\n${brief}`,
      '',
      `Écris EXACTEMENT ${slideCount} slides : 1 accroche, ${slideCount - 2} slides de contenu, 1 conclusion avec appel à l'action.`,
    ].join('\n');

    let raw: string;
    try {
      raw = await generateAiText({
        userId: session.user.id,
        system: SYSTEM,
        userText,
        temperature: 0.75, // on veut de l'angle, pas la version moyenne du sujet
        maxTokens: 3000,
        // Écrire huit slides qui s'enchaînent demande de tenir un fil : c'est
        // exactement ce que la réflexion coupée fait perdre.
        quality: 'high',
      });
    } catch (err) {
      console.error('[compose-carousel] erreur fournisseur IA :', err);
      return NextResponse.json({ error: 'Génération indisponible pour le moment' }, { status: 502 });
    }

    let parsed: { title?: unknown; slides?: unknown; caption?: unknown } = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    } catch {
      return NextResponse.json({ error: 'Réponse illisible' }, { status: 502 });
    }

    // ── Revalidation. L'IA n'écrit que des TEXTES et le NOM d'un archétype :
    //    tout ce qui touche au dessin est décidé par le moteur, donc il n'y a
    //    ici ni coordonnée ni couleur à contrôler — seulement l'existence de
    //    l'archétype et la présence des textes obligatoires.
    const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];
    const txt = (v: unknown, maxWords: number): string => {
      const s = String(v ?? '').replace(/\s+/g, ' ').trim();
      if (!s) return '';
      // Coupe de sécurité : au-delà du double de la longueur conseillée, le texte
      // ne rentre plus dans la composition même rétréci au minimum.
      const words = s.split(' ');
      return words.length > maxWords * 2 ? words.slice(0, maxWords * 2).join(' ') : s;
    };

    const slides = rawSlides
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .map((s, i) => {
        const wanted = CAROUSEL_ARCHETYPES.find((a) => a.id === s.archetype);
        // Position attendue dans le carrousel : si l'IA se trompe d'usage (une
        // couverture au milieu, une clôture en tête), on la ramène à sa place.
        const want: Archetype['use'] = i === 0 ? 'cover' : i === rawSlides.length - 1 ? 'closing' : 'content';
        const arch = wanted && wanted.use === want
          ? wanted
          : CAROUSEL_ARCHETYPES.find((a) => a.use === want) ?? CAROUSEL_ARCHETYPES[2];

        const texts: Record<string, string> = {};
        for (const slot of arch.slots) {
          const v = txt(s[slot.role], slot.max);
          if (v) texts[slot.role] = v;
        }
        const missing = arch.slots.some((sl) => sl.required && !texts[sl.role]);
        return missing ? null : { archetype: arch.id, texts };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .slice(0, MAX_SLIDES);

    if (slides.length < MIN_SLIDES) {
      return NextResponse.json({ error: 'Carrousel trop court' }, { status: 502 });
    }

    return NextResponse.json({
      title: typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 120) : '',
      caption: typeof parsed.caption === 'string' ? parsed.caption.trim().slice(0, 2200) : '',
      slides,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compose-carousel] fatal :', msg);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
