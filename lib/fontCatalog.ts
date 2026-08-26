// lib/fontCatalog.ts — le catalogue typographique de KLIP.
//
// POURQUOI CE FICHIER
// Les visuels générés sortaient « trop IA » : couleurs plates et typo scolaire.
// La typo n'était pas un accident de rendu, c'était le catalogue. KLIP ne
// connaissait que vingt familles Google, toutes de la première page du
// classement de popularité (Montserrat, Poppins, Playfair, Raleway…) : les
// mêmes que tous les générateurs de la terre. Une composition juste habillée
// d'une police vue mille fois ressemble à un template, quoi qu'on fasse du
// reste.
//
// Deux banques cohabitent donc désormais :
//  · Google Fonts — on garde l'existant (les chartes clientes s'y réfèrent
//    déjà) et on y ajoute la génération récente, absente jusqu'ici :
//    Instrument Serif, Bricolage Grotesque, Unbounded, Fraunces, Geist…
//  · Fontshare (Indian Type Foundry) — libre d'usage commercial, et déjà
//    utilisée par KLIP pour SA PROPRE identité (`app/layout.tsx` charge
//    Cabinet Grotesk, Satoshi et Gambetta). C'est là que vivent les grotesques
//    et les serifs qu'on voit réellement sur les comptes soignés en 2026.
//
// CE QUE LE CATALOGUE SAIT, ET POURQUOI
//  1. le FOURNISSEUR : l'URL d'une feuille de style n'a pas la même forme chez
//     Google et chez Fontshare. Sans cette information, une famille Fontshare
//     demandée à Google retombe silencieusement sur la police système — le
//     geste typographique disparaît et personne ne voit d'erreur.
//  2. les GRAISSES RÉELLES : Google renvoie une 400 pour TOUTE la requête si on
//     demande une graisse qu'une famille ne publie pas. Les listes ci-dessous
//     ont été relevées famille par famille sur les deux API, pas devinées.
//  3. le GESTE : à quoi cette police sert dans une composition (grotesque de
//     travail, condensé d'affiche, serif de presse, manuscrit…). C'est ce qui
//     permet de choisir une identité typographique par marque au lieu de
//     resservir Anton + Playfair Display à tout le monde.

export type FontProvider = 'google' | 'fontshare';

/** Ce que la police FAIT dans une composition — pas sa classification Vox. */
export type FontGesture =
  | 'grotesque'   // le sans de travail : neutre, moderne, lisible partout
  | 'geometrique' // cercles parfaits, air suisse / tech
  | 'display'     // faite pour être grosse, à ne jamais mettre en corps de texte
  | 'condense'    // colonne étroite, geste d'affiche
  | 'gras'        // très gras, très plein : le mot qui prend tout le cadre
  | 'editorial'   // serif de presse, contraste marqué
  | 'serif'       // serif de lecture, chaleureuse
  | 'slab'        // empattements rectangulaires
  | 'stencil'
  | 'script'      // calligraphie, signature
  | 'manuscrit'   // écriture à la main, marqueur
  | 'mono'
  | 'arrondi'
  | 'bizarre';    // caractère marqué, à réserver aux marques qui l'assument

export interface FontSpec {
  provider: FontProvider;
  /** Identifiant Fontshare : le nom CSS ne suffit pas à construire l'URL. */
  slug?: string;
  /** Graisses réellement publiées. Relevées sur l'API, jamais supposées. */
  weights: number[];
  italic: boolean;
  gestures: FontGesture[];
  /** Repli système, utilisé le temps que la webfont arrive. */
  fallback?: string;
}

// ── Le catalogue ─────────────────────────────────────────────────────────────

export const FONT_CATALOG: Record<string, FontSpec> = {
  // ── Fontshare : grotesques contemporains ────────────────────────────────
  'Satoshi':            { provider: 'fontshare', slug: 'satoshi',           weights: [300, 400, 500, 700, 900], italic: true,  gestures: ['grotesque'] },
  'Switzer':            { provider: 'fontshare', slug: 'switzer',           weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['grotesque'] },
  'General Sans':       { provider: 'fontshare', slug: 'general-sans',      weights: [200, 300, 400, 500, 600, 700], italic: true, gestures: ['grotesque'] },
  'Cabinet Grotesk':    { provider: 'fontshare', slug: 'cabinet-grotesk',   weights: [100, 200, 300, 400, 500, 700, 800, 900], italic: false, gestures: ['grotesque', 'display'] },
  'Clash Grotesk':      { provider: 'fontshare', slug: 'clash-grotesk',     weights: [200, 300, 400, 500, 600, 700], italic: false, gestures: ['grotesque', 'display'] },
  'Supreme':            { provider: 'fontshare', slug: 'supreme',           weights: [100, 200, 300, 400, 500, 700, 800], italic: true, gestures: ['grotesque'] },
  'Author':             { provider: 'fontshare', slug: 'author',            weights: [200, 300, 400, 500, 600, 700], italic: true, gestures: ['grotesque'] },
  'Synonym':            { provider: 'fontshare', slug: 'synonym',           weights: [200, 300, 400, 500, 600, 700], italic: false, gestures: ['grotesque'] },
  'Plein':              { provider: 'fontshare', slug: 'plein',             weights: [300, 400, 500, 700, 900], italic: true,  gestures: ['grotesque', 'display'] },
  'Ranade':             { provider: 'fontshare', slug: 'ranade',            weights: [100, 300, 400, 500, 700], italic: true,  gestures: ['grotesque'] },
  'Excon':              { provider: 'fontshare', slug: 'excon',             weights: [100, 300, 400, 500, 700, 900], italic: false, gestures: ['grotesque', 'display'] },
  'Technor':            { provider: 'fontshare', slug: 'technor',           weights: [200, 300, 400, 500, 600, 700, 900], italic: false, gestures: ['grotesque', 'bizarre'] },
  'Bespoke Sans':       { provider: 'fontshare', slug: 'bespoke-sans',      weights: [300, 400, 500, 700, 800], italic: true,  gestures: ['grotesque', 'bizarre'] },
  'Alpino':             { provider: 'fontshare', slug: 'alpino',            weights: [100, 300, 400, 500, 700, 900], italic: false, gestures: ['grotesque', 'geometrique'] },
  'Nippo':              { provider: 'fontshare', slug: 'nippo',             weights: [200, 300, 400, 500, 700], italic: false, gestures: ['display', 'geometrique'] },
  'New Title':          { provider: 'fontshare', slug: 'new-title',         weights: [200, 300, 400, 500, 700], italic: false, gestures: ['display', 'grotesque'] },

  // ── Fontshare : titrage et display ──────────────────────────────────────
  'Clash Display':      { provider: 'fontshare', slug: 'clash-display',     weights: [200, 300, 400, 500, 600, 700], italic: false, gestures: ['display'] },
  'Panchang':           { provider: 'fontshare', slug: 'panchang',          weights: [200, 300, 400, 500, 600, 700, 800], italic: false, gestures: ['display', 'bizarre'] },
  'Chillax':            { provider: 'fontshare', slug: 'chillax',           weights: [200, 300, 400, 500, 600, 700], italic: false, gestures: ['display', 'arrondi'] },
  'Melodrama':          { provider: 'fontshare', slug: 'melodrama',         weights: [300, 400, 500, 600, 700], italic: false, gestures: ['display', 'editorial'] },
  'Tanker':             { provider: 'fontshare', slug: 'tanker',            weights: [400], italic: false, gestures: ['display', 'gras'] },
  'Array':              { provider: 'fontshare', slug: 'array',             weights: [400, 600, 700], italic: false, gestures: ['display', 'gras', 'bizarre'] },
  'Sharpie':            { provider: 'fontshare', slug: 'sharpie',           weights: [300, 400, 700, 800, 900], italic: false, gestures: ['display', 'bizarre'] },
  'Stardom':            { provider: 'fontshare', slug: 'stardom',           weights: [400], italic: false, gestures: ['display', 'editorial'] },
  'Segment':            { provider: 'fontshare', slug: 'segment',           weights: [400], italic: false, gestures: ['display', 'bizarre'] },
  'Bevellier':          { provider: 'fontshare', slug: 'bevellier',         weights: [100, 200, 300, 400, 500, 600, 700, 900], italic: true, gestures: ['display', 'editorial'] },
  'Chubbo':             { provider: 'fontshare', slug: 'chubbo',            weights: [200, 300, 400, 500, 700], italic: true,  gestures: ['display', 'gras'] },
  'Expose':             { provider: 'fontshare', slug: 'expose',            weights: [400, 500, 700, 900], italic: false, gestures: ['display', 'condense'] },
  'Kola':               { provider: 'fontshare', slug: 'kola',              weights: [400], italic: false, gestures: ['display', 'gras', 'condense'] },
  'Boxing':             { provider: 'fontshare', slug: 'boxing',            weights: [400], italic: false, gestures: ['display', 'bizarre'] },

  // ── Fontshare : condensés d'affiche ─────────────────────────────────────
  'Khand':              { provider: 'fontshare', slug: 'khand',             weights: [300, 400, 500, 600, 700], italic: false, gestures: ['condense', 'display'] },
  'Teko':               { provider: 'fontshare', slug: 'teko',              weights: [300, 400, 500, 600, 700], italic: false, gestures: ['condense', 'display'] },

  // ── Fontshare : serifs éditoriaux ───────────────────────────────────────
  'Zodiak':             { provider: 'fontshare', slug: 'zodiak',            weights: [100, 300, 400, 700, 800, 900], italic: true, gestures: ['editorial', 'display'] },
  'Boska':              { provider: 'fontshare', slug: 'boska',             weights: [200, 300, 400, 500, 700, 900], italic: true, gestures: ['editorial', 'display'] },
  'Sentient':           { provider: 'fontshare', slug: 'sentient',          weights: [200, 300, 400, 500, 700], italic: true, gestures: ['editorial', 'serif'] },
  'Gambetta':           { provider: 'fontshare', slug: 'gambetta',          weights: [300, 400, 500, 600, 700], italic: true, gestures: ['editorial', 'serif'] },
  'Erode':              { provider: 'fontshare', slug: 'erode',             weights: [300, 400, 500, 600, 700], italic: true, gestures: ['serif'] },
  'Recia':              { provider: 'fontshare', slug: 'recia',             weights: [300, 400, 500, 600, 700], italic: true, gestures: ['editorial', 'serif'] },
  'Neco':               { provider: 'fontshare', slug: 'neco',              weights: [400, 500, 700, 900], italic: true, gestures: ['serif', 'bizarre'] },
  'Rowan':              { provider: 'fontshare', slug: 'rowan',             weights: [300, 400, 500, 600, 700], italic: true, gestures: ['editorial', 'bizarre'] },
  'Bespoke Serif':      { provider: 'fontshare', slug: 'bespoke-serif',     weights: [300, 400, 500, 700, 800], italic: true, gestures: ['editorial', 'serif'] },
  'Gambarino':          { provider: 'fontshare', slug: 'gambarino',         weights: [400], italic: false, gestures: ['editorial', 'display'] },
  'Bonny':              { provider: 'fontshare', slug: 'bonny',             weights: [100, 300, 400, 500, 700], italic: false, gestures: ['display', 'bizarre'] },

  // ── Fontshare : slab, stencil, mono, arrondi ────────────────────────────
  'Bespoke Slab':       { provider: 'fontshare', slug: 'bespoke-slab',      weights: [300, 400, 500, 700, 800], italic: true, gestures: ['slab'] },
  'Trench Slab':        { provider: 'fontshare', slug: 'trench-slab',       weights: [300, 400, 500, 600, 700], italic: false, gestures: ['slab', 'condense'] },
  'Hoover':             { provider: 'fontshare', slug: 'hoover',            weights: [100, 300, 400, 500, 700], italic: false, gestures: ['slab'] },
  'Bespoke Stencil':    { provider: 'fontshare', slug: 'bespoke-stencil',   weights: [300, 400, 500, 700, 800], italic: true, gestures: ['stencil', 'display'] },
  'Azeret Mono':        { provider: 'fontshare', slug: 'azeret-mono',       weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['mono'] },
  'JetBrains Mono':     { provider: 'fontshare', slug: 'jet-brains-mono',   weights: [100, 200, 300, 400, 500, 600, 700, 800], italic: true, gestures: ['mono'] },
  'Tabular':            { provider: 'fontshare', slug: 'tabular',           weights: [300, 400, 500, 600, 700], italic: true, gestures: ['mono', 'grotesque'] },
  'Pilcrow Rounded':    { provider: 'fontshare', slug: 'pilcrow-rounded',   weights: [400, 500, 600, 700, 900], italic: false, gestures: ['arrondi'] },
  'Roundo':             { provider: 'fontshare', slug: 'roundo',            weights: [200, 300, 400, 500, 600, 700], italic: false, gestures: ['arrondi', 'geometrique'] },
  'Quilon':             { provider: 'fontshare', slug: 'quilon',            weights: [400, 500, 600, 700], italic: false, gestures: ['arrondi', 'grotesque'] },
  'Pally':              { provider: 'fontshare', slug: 'pally',             weights: [400, 500, 700], italic: false, gestures: ['arrondi', 'display'] },

  // ── Fontshare : gestes manuscrits ───────────────────────────────────────
  'Britney':            { provider: 'fontshare', slug: 'britney',           weights: [300, 400, 700, 1000], italic: false, gestures: ['script', 'display'] },
  'Telma':              { provider: 'fontshare', slug: 'telma',             weights: [300, 400, 500, 700, 900], italic: false, gestures: ['script'] },
  'Rosaline':           { provider: 'fontshare', slug: 'rosaline',          weights: [400], italic: false, gestures: ['script'] },
  'Comico':             { provider: 'fontshare', slug: 'comico',            weights: [400], italic: false, gestures: ['manuscrit'] },
  'Kalam':              { provider: 'fontshare', slug: 'kalam',             weights: [300, 400, 700], italic: false, gestures: ['manuscrit'] },

  // ── Google : la génération récente (absente de KLIP jusqu'ici) ──────────
  'Instrument Serif':   { provider: 'google', weights: [400], italic: true,  gestures: ['editorial', 'display'] },
  'Instrument Sans':    { provider: 'google', weights: [400, 500, 600, 700], italic: true, gestures: ['grotesque'] },
  'Bricolage Grotesque':{ provider: 'google', weights: [200, 300, 400, 500, 600, 700, 800], italic: false, gestures: ['grotesque', 'display', 'bizarre'] },
  'Unbounded':          { provider: 'google', weights: [200, 300, 400, 500, 600, 700, 800, 900], italic: false, gestures: ['display', 'bizarre'] },
  'Schibsted Grotesk':  { provider: 'google', weights: [400, 500, 600, 700, 800, 900], italic: true, gestures: ['grotesque'] },
  'Gabarito':           { provider: 'google', weights: [400, 500, 600, 700, 800, 900], italic: false, gestures: ['grotesque', 'arrondi'] },
  'Fraunces':           { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['editorial', 'display', 'bizarre'] },
  'Bodoni Moda':        { provider: 'google', weights: [400, 500, 600, 700, 800, 900], italic: true, gestures: ['editorial', 'display'] },
  'Darker Grotesque':   { provider: 'google', weights: [300, 400, 500, 600, 700, 800, 900], italic: false, gestures: ['condense', 'display'] },
  'Anybody':            { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['display', 'bizarre'] },
  'Big Shoulders Display': { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false, gestures: ['condense', 'display'] },
  'Funnel Display':     { provider: 'google', weights: [300, 400, 500, 600, 700, 800], italic: false, gestures: ['display', 'grotesque'] },
  'Host Grotesk':       { provider: 'google', weights: [300, 400, 500, 600, 700, 800], italic: true, gestures: ['grotesque'] },
  'Geist':              { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['grotesque', 'geometrique'] },
  'Bungee':             { provider: 'google', weights: [400], italic: false, gestures: ['display', 'gras', 'bizarre'] },

  // ── Google : l'existant, conservé (des chartes clientes s'y réfèrent) ───
  'Anton':              { provider: 'google', weights: [400], italic: false, gestures: ['condense', 'gras', 'display'] },
  'Oswald':             { provider: 'google', weights: [200, 300, 400, 500, 600, 700], italic: false, gestures: ['condense', 'display'] },
  'Bebas Neue':         { provider: 'google', weights: [400], italic: false, gestures: ['condense', 'display'] },
  'Montserrat':         { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['geometrique'] },
  'Syne':               { provider: 'google', weights: [400, 500, 600, 700, 800], italic: false, gestures: ['display', 'bizarre'] },
  'Inter':              { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false, gestures: ['grotesque'] },
  'Poppins':            { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['geometrique'] },
  'Barlow Condensed':   { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['condense'] },
  'Raleway':            { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['geometrique'] },
  'Roboto Condensed':   { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['condense'] },
  'Playfair Display':   { provider: 'google', weights: [400, 500, 600, 700, 800, 900], italic: true, gestures: ['editorial'] },
  'Lato':               { provider: 'google', weights: [100, 300, 400, 700, 900], italic: true, gestures: ['grotesque'] },
  'Nunito':             { provider: 'google', weights: [200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['arrondi'] },
  'Work Sans':          { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['grotesque'] },
  'DM Sans':            { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['geometrique'] },
  'Space Grotesk':      { provider: 'google', weights: [300, 400, 500, 600, 700], italic: false, gestures: ['grotesque', 'bizarre'] },
  'Archivo':            { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['grotesque'] },
  'Archivo Black':      { provider: 'google', weights: [400], italic: false, gestures: ['gras', 'display'] },
  'Fjalla One':         { provider: 'google', weights: [400], italic: false, gestures: ['condense', 'display'] },
  'Exo 2':              { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['geometrique'] },
  'Ubuntu':             { provider: 'google', weights: [300, 400, 500, 700], italic: true, gestures: ['grotesque'] },
  'Outfit':             { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false, gestures: ['geometrique'] },
  'Plus Jakarta Sans':  { provider: 'google', weights: [200, 300, 400, 500, 600, 700, 800], italic: true, gestures: ['grotesque', 'geometrique'] },
  'Rubik':              { provider: 'google', weights: [300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['arrondi', 'grotesque'] },
  'Josefin Sans':       { provider: 'google', weights: [100, 200, 300, 400, 500, 600, 700], italic: true, gestures: ['geometrique'] },
  'Merriweather':       { provider: 'google', weights: [300, 400, 500, 600, 700, 800, 900], italic: true, gestures: ['serif'] },
  'Caveat':             { provider: 'google', weights: [400, 500, 600, 700], italic: false, gestures: ['manuscrit'] },
};

// ── Résolution ───────────────────────────────────────────────────────────────

/** Recherche insensible à la casse : les chartes clientes écrivent « satoshi ». */
const PAR_CLE: Record<string, string> = Object.fromEntries(
  Object.keys(FONT_CATALOG).map(f => [f.toLowerCase(), f]),
);

/** Nom canonique d'une famille, ou `null` si KLIP ne la connaît pas. */
export function canonicalFont(family: string | null | undefined): string | null {
  const s = String(family ?? '').trim();
  return s ? (PAR_CLE[s.toLowerCase()] ?? null) : null;
}

export function fontSpec(family: string | null | undefined): FontSpec | null {
  const c = canonicalFont(family);
  return c ? FONT_CATALOG[c] : null;
}

export function isFontshare(family: string | null | undefined): boolean {
  return fontSpec(family)?.provider === 'fontshare';
}

function googleHref(family: string, spec: FontSpec): string {
  const fam = family.replace(/ /g, '+');
  const axis = spec.italic
    ? `ital,wght@${spec.weights.map(w => `0,${w}`).join(';')};${spec.weights.map(w => `1,${w}`).join(';')}`
    : `wght@${spec.weights.join(';')}`;
  return `https://fonts.googleapis.com/css2?family=${fam}:${axis}&display=swap`;
}

function fontshareParam(spec: FontSpec): string {
  // Fontshare écrit l'italique en suffixant la graisse : « 400i ».
  const vals = spec.italic
    ? [...spec.weights.map(String), ...spec.weights.map(w => `${w}i`)]
    : spec.weights.map(String);
  return `${spec.slug}@${vals.join(',')}`;
}

/**
 * URL de la feuille de style d'UNE famille, chez le bon fournisseur.
 *
 * Une famille inconnue reçoit quand même une URL Google avec 400/700 : c'est le
 * cas d'une charte cliente qui nomme une police qu'on n'a pas répertoriée, et
 * une tentative vaut mieux qu'un repli système silencieux.
 */
export function fontCssHref(family: string): string {
  const canon = canonicalFont(family);
  if (!canon) {
    const fam = encodeURIComponent(family).replace(/%20/g, '+');
    return `https://fonts.googleapis.com/css2?family=${fam}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
  }
  const spec = FONT_CATALOG[canon];
  return spec.provider === 'fontshare'
    ? `https://api.fontshare.com/v2/css?f[]=${fontshareParam(spec)}&display=swap`
    : googleHref(canon, spec);
}

/**
 * URLs pour un LOT de familles, UNE ENTRÉE PAR FAMILLE.
 *
 * Fontshare sait grouper plusieurs `f[]` dans une même requête, et la première
 * version en profitait. C'était une fausse économie : l'identifiant dépendait
 * alors de l'ENSEMBLE demandé, donc deux appels aux familles voisines
 * produisaient deux feuilles de style distinctes et redondantes. Le banc de
 * design en injectait trente-quatre pour douze polices. Une entrée par famille
 * reste idempotente — l'appelant vérifie l'identifiant avant d'insérer — et les
 * requêtes vont de toute façon au même hôte, donc au même multiplexage.
 */
export function fontCssHrefs(families: string[]): { id: string; href: string }[] {
  const uniques = Array.from(new Set(families.map(f => String(f ?? '').trim()).filter(Boolean)));
  return uniques.map(f => ({
    id: `kf-${f.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    href: fontCssHref(f),
  }));
}

/** Variantes proposables dans l'éditeur : graisses × italique. */
export function fontVariants(family: string): { weight: number; italic: boolean }[] {
  const spec = fontSpec(family);
  if (!spec) return [];
  const out = spec.weights.map(weight => ({ weight, italic: false }));
  if (spec.italic) out.push(...spec.weights.map(weight => ({ weight, italic: true })));
  return out;
}

/**
 * La graisse publiée la plus proche de celle qu'on veut.
 *
 * Demander un 800 à une famille qui s'arrête à 700 ne donne pas un 800 : le
 * navigateur fabrique un faux gras, baveux à l'écran et pire encore une fois
 * rastérisé dans le visuel exporté. Une famille inconnue garde la valeur
 * demandée : c'est une charte cliente, elle sait ce qu'elle a chargé.
 */
export function nearestWeight(family: string, wanted: number): number {
  const spec = fontSpec(family);
  if (!spec || !spec.weights.length) return wanted;
  return spec.weights.reduce((a, b) => (Math.abs(b - wanted) < Math.abs(a - wanted) ? b : a));
}

/** Familles portant un geste donné, dans l'ordre du catalogue. */
export function fontsByGesture(...gestures: FontGesture[]): string[] {
  return Object.entries(FONT_CATALOG)
    .filter(([, s]) => gestures.some(g => s.gestures.includes(g)))
    .map(([f]) => f);
}

/** Toutes les familles du catalogue, les modernes d'abord. */
export const CATALOG_FAMILIES = Object.keys(FONT_CATALOG);

/** Libellé lisible d'une graisse. */
export function weightLabel(weight: number): string {
  const names: Record<number, string> = {
    100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular',
    500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black', 1000: 'Ultra',
  };
  return names[weight] ?? String(weight);
}
