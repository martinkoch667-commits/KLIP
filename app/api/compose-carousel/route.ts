import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAiText } from '@/lib/ai-text';
import { LAYOUT_LIBRARY, type Slot } from '@/lib/layoutLibrary';

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
// Même principe que partout ailleurs ici : l'IA NE DESSINE PAS. Elle choisit une
// recette dans la bibliothèque partagée (`lib/layoutLibrary.ts`) et la remplit.
// La géométrie vient de mises en page déjà soignées, donc le rendu tient debout
// même quand le texte, lui, est à retoucher.
//
// La sortie a EXACTEMENT la forme que `materializeLayout` consomme déjà côté
// éditeur ({ blocks, scrim }) : aucune machinerie de rendu nouvelle, et les slides
// générées sont des slides ordinaires, éditables et annulables comme les autres.

const MIN_SLIDES = 3;
const MAX_SLIDES = 10;
const DEFAULT_SLIDES = 6;

const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const COLORS = ['primary', 'secondary', 'accent', 'white', 'black'];
const SCRIMS = ['bottom', 'top', 'none'];

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
Tu ne places aucune coordonnée. Pour chaque slide tu CHOISIS une recette dans la bibliothèque fournie et tu remplis ses emplacements (chaque emplacement a un rôle : titre, sous-titre, cta). Choisis la recette dont les rôles correspondent à ce que la slide doit dire — n'utilise pas une recette à trois niveaux pour une slide qui n'a qu'un titre.
Varie les recettes entre les slides, mais garde une famille cohérente : un carrousel doit se tenir visuellement.

Tu réponds avec un UNIQUE objet JSON, sans texte autour, sans bloc de code :

{
  "title": "titre interne du carrousel, court",
  "slides": [
    {
      "role": "hook" | "content" | "cta",
      "recipeId": "<id EXACT d'une recette de la bibliothèque>",
      "slots": [ { "role": "titre"|"sous-titre"|"cta", "text": "...", "color": "primary"|"secondary"|"accent"|"white"|"black", "uppercase": true } ],
      "scrim": { "position": "bottom"|"top"|"none", "opacity": 55 }
    }
  ],
  "caption": "la légende du post, prête à publier, avec 3 à 5 hashtags pertinents"
}`;

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

    const palette = [
      brand?.primary_color && `primary=${brand.primary_color}`,
      brand?.secondary_color && `secondary=${brand.secondary_color}`,
      brand?.accent_color && `accent=${brand.accent_color}`,
    ].filter(Boolean).join(', ');

    const recipes = LAYOUT_LIBRARY.map((r) => ({ id: r.id, desc: r.desc, roles: r.slots.map((s) => s.role) }));

    const userText = [
      `CHARTE :\n${brandBlock(brand)}`,
      palette ? `Couleurs disponibles : ${palette}, plus white et black. Aucune autre.` : 'Pas de couleur de charte : utilise white et black.',
      '',
      `BIBLIOTHÈQUE DE MISES EN PAGE (choisis parmi ces id, n'en invente aucun) :\n${JSON.stringify(recipes)}`,
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

    // ── Revalidation. Ce qui sort d'ici doit être matérialisable tel quel par
    //    l'éditeur : recette existante, rôles connus, couleurs de la charte.
    const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];
    const slides = rawSlides
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .map((s) => {
        const recipe = LAYOUT_LIBRARY.find((r) => r.id === s.recipeId) ?? LAYOUT_LIBRARY[0];
        const aiSlots = Array.isArray(s.slots) ? (s.slots as Record<string, unknown>[]) : [];

        // La géométrie vient de la recette, le texte de l'IA. On apparie par rôle,
        // et un emplacement sans texte est simplement omis — mieux vaut une slide
        // à deux blocs qu'un bloc vide qui laisse un trou dans la composition.
        const used = new Set<number>();
        const blocks = recipe.slots.map((g: Slot) => {
          let idx = aiSlots.findIndex((a, i) => !used.has(i) && a.role === g.role);
          if (idx < 0) idx = aiSlots.findIndex((a, i) => !used.has(i) && typeof a.text === 'string' && a.text);
          if (idx < 0) return null;
          used.add(idx);
          const a = aiSlots[idx];
          const text = String(a.text ?? '').trim();
          if (!text) return null;
          return {
            text,
            role: g.role,
            xPct: g.xPct, yPct: g.yPct, widthPct: g.widthPct, fontPct: g.fontPct, align: g.align,
            color: COLORS.includes(String(a.color)) ? String(a.color) : g.color,
            uppercase: typeof a.uppercase === 'boolean' ? a.uppercase : g.uppercase,
          };
        }).filter((b): b is NonNullable<typeof b> => b !== null);

        const scrimIn = (s.scrim ?? {}) as Record<string, unknown>;
        const position = SCRIMS.includes(String(scrimIn.position)) ? String(scrimIn.position) : recipe.scrim;

        return {
          role: ['hook', 'content', 'cta'].includes(String(s.role)) ? String(s.role) : 'content',
          recipeId: recipe.id,
          blocks,
          scrim: { position, opacity: clamp(num(scrimIn.opacity, 55), 0, 100) },
        };
      })
      // Une slide sans un seul bloc de texte serait une slide vide dans le carrousel.
      .filter((s) => s.blocks.length > 0)
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
