// lib/brandDNA.ts : l'ADN visuel d'une marque, MESURÉ sur ce qu'elle publie déjà.
//
// POURQUOI CE FICHIER
// KLIP choisit aujourd'hui le terrain de couleur d'un client (`colorway.ts`) et
// son identité typographique (`typeIdentity.ts`) à partir d'une EMPREINTE DE SON
// NOM, corrigée par le secteur et le ton déclarés. C'est stable, c'est mieux que
// la constante unique d'avant, mais il faut le dire comme c'est : « Amicii » et
// « Asterisk » reçoivent des terrains différents parce que leurs noms hachent
// différemment, pas parce qu'on a regardé ce qu'ils publient.
//
// Or le compte Instagram du client contient la réponse. Vingt-quatre visuels
// déjà publiés disent la palette réelle, la clarté du fil, la densité de texte,
// et où la marque écrit sur ses photos. Ce fichier les MESURE (déterministe,
// vérifiable, aucun modèle) et traduit la mesure dans les vocabulaires fermés
// que KLIP possède déjà. La lecture qualitative (registre typographique, motifs,
// intentions) reste au modèle de vision, mais elle ne décide jamais seule d'une
// couleur : une couleur, ça se compte.
//
// CE QUI EST MESURÉ ICI, CE QUI EST DEVINÉ AILLEURS
//  · mesuré  : palette, part de chaque couleur, présence par post, clarté,
//              contraste, saturation, et par conséquent le terrain de couleur ;
//  · déduit  : le registre typographique, les motifs, les familles de
//              composition, les manques. Ça vient du modèle, sur planche contact.
//
// La mesure vit côté navigateur : lire les pixels demande un canvas, et les
// images Instagram passent par `/api/proxy-image` comme partout ailleurs dans
// KLIP (une image d'une autre origine rend le canvas illisible). Les fonctions
// de traduction, elles, sont pures et tournent des deux côtés.

import { COLORWAYS, type Colorway } from './colorway';
import { TYPE_IDENTITIES } from './typeIdentity';
import { DESIGN_RECIPES, recipeZone, type DesignRecipe, type RecipeZone, type Vibe } from './designSystem';

// ── Ce qu'on relève ──────────────────────────────────────────────────────────

/** Une couleur relevée sur le fil, avec ce qui permet de la juger. */
export interface ColorReading {
  hex: string;
  /** Part de la surface totale du fil, 0..1. */
  share: number;
  /** Dans combien de publications elle apparaît. C'est LE signal de marque : */
  /** une couleur de charte revient partout, une couleur de plat ne revient pas. */
  posts: number;
  /** Saturation 0..1 et luminance relative 0..1. */
  sat: number;
  lum: number;
  /**
   * Planéité 0..1 : part de la couleur concentrée dans une seule case de
   * l'histogramme. C'est le signal qui sépare une couleur de MARQUE d'une
   * couleur de PHOTO, et il a fallu le banc pour s'en apercevoir. Un aplat, un
   * bandeau, une pastille ou du texte tiennent sur une ou deux valeurs exactes :
   * planéité haute. Le brun d'un plat, la peau d'un visage, un ciel : ce sont
   * des dégradés étalés sur vingt cases voisines, planéité basse.
   *
   * Sans elle, un compte de restaurant ressort toujours avec « brun, beige,
   * doré » : les couleurs de la nourriture, jamais celles de la marque.
   */
  flat: number;
}

export interface FeedMetrics {
  postCount: number;
  /** Toutes les couleurs retenues, les plus présentes d'abord. */
  colors: ColorReading[];
  /** Celles qui reviennent d'un post à l'autre : la charte de fait. */
  signature: ColorReading[];
  /** Moyennes du fil, 0..1. */
  lightness: number;
  contrast: number;
  saturation: number;
  /** Combien d'images ont réellement pu être lues (les autres ont échoué). */
  read: number;
}

export type Register = 'grotesque' | 'serif' | 'condense' | 'manuscrit' | 'mixte' | 'aucun';

/** Le résultat complet, tel qu'il sera enregistré sur le workspace. */
export interface BrandDNA {
  version: 1;
  measuredAt: string;
  source: 'instagram' | 'canva' | 'upload' | 'mixte';
  metrics: FeedMetrics;

  /** Personnalité lue, dans le vocabulaire de `designSystem`. */
  vibes: Vibe[];
  register: Register;

  /** Les deux décisions que ce fichier existe pour remplacer. */
  colorwayId: string;
  typeIdentityId: string;
  /** Pourquoi ce terrain, en clair : c'est ce qui rend la mesure discutable. */
  colorwayWhy: string;

  /** Rapport de la marque au texte sur photo. */
  textOnPhoto: 'jamais' | 'rare' | 'souvent' | 'toujours';
  /** Où elle écrit, dans le vocabulaire de `recipeZone`. */
  zones: RecipeZone[];
  /** Familles de recettes qui lui ressemblent (`DesignRecipe.family`). */
  families: string[];

  motifs: string[];
  gaps: string[];
  summary: string;

  /** Proposition de charte : les couleurs à préremplir dans la fiche. */
  brandColors: string[];
}

// ── Couleur : conversions ────────────────────────────────────────────────────
//
// La distance entre deux couleurs se juge en OKLab, pas en RVB. En RVB, un rouge
// et un orange sont plus « loin » qu'un bleu marine et un noir, ce qui fait
// fusionner l'encre d'une marque avec son bleu, et sépare deux rouges qu'un œil
// dirait identiques. Le regroupement de palette repose entièrement sur cette
// distance : la faire en RVB, c'est relever des couleurs qui n'existent pas.

function srgbToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** sRVB 0..255 vers OKLab. */
export function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/** Distance perceptuelle. Sous 0,10 deux couleurs se confondent à l'œil. */
export function oklabDist(a: [number, number, number], b: [number, number, number]): number {
  const dl = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function hexDist(a: string, b: string): number {
  return oklabDist(rgbToOklab(...hexToRgb(a)), rgbToOklab(...hexToRgb(b)));
}

/** Saturation au sens TSL, sur 0..1. */
function satOf(r: number, g: number, b: number): number {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
  const l = (mx + mn) / 2;
  if (mx === mn) return 0;
  return l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
}

function lumOf(r: number, g: number, b: number): number {
  return (0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b));
}

// ── Mesure du fil (navigateur) ───────────────────────────────────────────────

/** Une image lue, réduite à ce qu'on en garde. Exportée : la mesure doit
 *  pouvoir être rejouée hors navigateur, sur un jeu d'images de référence. */
export interface PixelReading {
  /** Compte de pixels par case de l'histogramme (clé = index 4 bits par canal). */
  bins: Map<number, number>;
  pixels: number;
  lightness: number;
  contrast: number;
  saturation: number;
}

const GRID = 72; // une vignette suffit : on cherche une tendance, pas un détail
const LEVELS = 16; // 4 bits par canal, 4096 cases

function binIndex(r: number, g: number, b: number): number {
  const q = (v: number) => Math.min(LEVELS - 1, (v * LEVELS) >> 8);
  return (q(r) << 8) | (q(g) << 4) | q(b);
}

function binCenter(idx: number): [number, number, number] {
  const step = 256 / LEVELS;
  const c = (v: number) => Math.round(v * step + step / 2);
  return [c((idx >> 8) & 15), c((idx >> 4) & 15), c(idx & 15)];
}

/**
 * Relève l'histogramme et les tendances d'une image déjà décodée.
 *
 * Prend du RVBA brut, donc ne dépend d'aucun canvas : c'est ce qui permet de
 * rejouer exactement la même mesure dans un banc hors navigateur, et de vérifier
 * qu'elle retrouve bien la charte d'un client sur ses vraies photos.
 */
export function readPixels(data: Uint8ClampedArray | Uint8Array): PixelReading | null {
  const bins = new Map<number, number>();
  let sumL = 0, sumL2 = 0, sumS = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const k = binIndex(r, g, b);
    bins.set(k, (bins.get(k) ?? 0) + 1);
    const l = lumOf(r, g, b);
    sumL += l; sumL2 += l * l; sumS += satOf(r, g, b); n++;
  }
  if (!n) return null;
  const mean = sumL / n;
  return {
    bins,
    pixels: n,
    lightness: mean,
    contrast: Math.sqrt(Math.max(0, sumL2 / n - mean * mean)),
    saturation: sumS / n,
  };
}

/** Charge une image dans un canvas et en relève l'histogramme. Navigateur seul. */
async function readImage(url: string): Promise<PixelReading | null> {
  if (typeof document === 'undefined') return null;
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    // Même règle que `composeRender` : une image locale n'a rien à faire dans le
    // proxy, une image distante ne peut pas s'en passer sans salir le canvas.
    el.src = /^(data:|blob:|\/)/.test(url) ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`;
  });
  if (!img) return null;

  const c = document.createElement('canvas');
  c.width = GRID; c.height = GRID;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, GRID, GRID);
  try { return readPixels(ctx.getImageData(0, 0, GRID, GRID).data); } catch { return null; }
}

/** Seuil de fusion des couleurs de PHOTO : sous cette distance, c'est la même. */
const MERGE = 0.11;
/**
 * Seuil de fusion des APLATS. Beaucoup plus serré, et c'est le cœur du fichier.
 *
 * Mesuré au banc sur les photos de Pepe Chicken habillées de sa vraie charte :
 * le jaune de sa pastille (#FFC600) et le doré de son poulet pané (#EBBD51) ne
 * sont qu'à 0,053 l'un de l'autre. Au seuil des photos, la pastille disparaît
 * dans la panure et la marque perd sa deuxième couleur. Au seuil des aplats,
 * les deux restent distincts.
 */
const FLAT_MERGE = 0.045;
/** Au-delà de cette distance, une case n'appartient à aucune couleur retenue. */
const ASSIGN = 0.17;
/**
 * Part minimale d'une image pour qu'une couleur y « apparaisse ».
 *
 * Le premier réglage était à 1,2 %, et le banc a montré pourquoi c'était faux :
 * le rouge de la marque pesait 0,3 % de la surface, donc il n'apparaissait
 * NULLE PART. Or une couleur de charte se porte justement en petit (une
 * pastille, un filet, un bandeau) : la mesure écartait exactement ce qu'elle
 * était censée trouver.
 */
const PRESENCE = 0.004;
/** Un pic doit peser ça dans l'ensemble pour être un aplat et non du bruit. */
const PIC_MIN = 0.0015;
/** Concentration à partir de laquelle une case est un aplat et non un dégradé. */
const PIC_SEUIL = 0.42;

/**
 * Relève la palette et les tendances d'un ensemble d'images.
 *
 * Le point important est `posts` : la part de surface seule ferait ressortir le
 * brun des plats et le blanc des assiettes pour tous les restaurants du monde.
 * Ce qui distingue une marque, c'est la couleur qui revient d'un post à l'autre,
 * même en petite quantité : le rouge d'un bandeau, le jaune d'une pastille.
 */
export async function measureFeed(urls: string[]): Promise<FeedMetrics> {
  const readings: PixelReading[] = [];
  for (const u of urls) {
    const r = await readImage(u);
    if (r) readings.push(r);
  }
  return clusterReadings(readings, urls.length);
}

/** Somme des 27 cases du voisinage d'une case, elle comprise. */
function voisinage(total: Map<number, number>, k: number): number {
  const r = (k >> 8) & 15, g = (k >> 4) & 15, b = k & 15;
  let s = 0;
  for (let dr = -1; dr <= 1; dr++) {
    const rr = r + dr; if (rr < 0 || rr > 15) continue;
    for (let dg = -1; dg <= 1; dg++) {
      const gg = g + dg; if (gg < 0 || gg > 15) continue;
      for (let db = -1; db <= 1; db++) {
        const bb = b + db; if (bb < 0 || bb > 15) continue;
        s += total.get((rr << 8) | (gg << 4) | bb) ?? 0;
      }
    }
  }
  return s;
}

/**
 * Le regroupement, pur : entrée les relevés, sortie la palette.
 *
 * TROIS IDÉES, et chacune vient d'un défaut constaté au banc.
 *
 * 1. UN APLAT N'EST PAS UNE COULEUR DE PHOTO. Une pastille, un bandeau, un
 *    titre : une valeur exacte répétée sur une surface, donc un PIC dans
 *    l'histogramme, dont le voisinage est vide. Une photo ne fait jamais ça :
 *    un plat doré, une peau, un ciel s'étalent sur vingt cases voisines. On
 *    mesure donc la concentration de chaque case dans son voisinage, et les
 *    pics sont regroupés à part, à un seuil serré. Sans ça, la couleur de la
 *    marque se noie dans la couleur du produit, ce qui est exactement ce qui
 *    s'est produit au premier essai.
 *
 * 2. LA PRÉSENCE SE COMPTE APRÈS LE REGROUPEMENT. Une couleur réelle s'étale
 *    sur cinq ou six cases voisines (anticrénelage, JPEG), chacune sous le
 *    seuil : la compter case par case la fait disparaître alors qu'elle est là.
 *    D'où la seconde passe, qui redemande à chaque image la part de chaque
 *    couleur RETENUE.
 *
 * 3. LES CENTRES SONT DES MOYENNES PONDÉRÉES. Le centre de la case seule
 *    décalerait chaque couleur d'un demi-pas, soit huit points de gris sur un
 *    aplat, et la charte proposée ne serait jamais tout à fait la bonne.
 */
export function clusterReadings(readings: PixelReading[], postCount: number): FeedMetrics {
  const empty: FeedMetrics = {
    postCount, read: 0, colors: [], signature: [],
    lightness: 0.5, contrast: 0, saturation: 0,
  };
  if (!readings.length) return empty;

  const total = new Map<number, number>();
  let pixels = 0;
  for (const r of readings) {
    pixels += r.pixels;
    r.bins.forEach((n, k) => total.set(k, (total.get(k) ?? 0) + n));
  }
  if (!total.size) return empty;

  interface Cluster {
    lab: [number, number, number];
    r: number; g: number; b: number;
    n: number;
    /** Concentration du pic fondateur : la planéité de la couleur. */
    pic: number;
    aplat: boolean;
  }
  const clusters: Cluster[] = [];
  const MAX = 24;

  const ajouter = (k: number, n: number, pic: number, aplat: boolean, rayon: number) => {
    const [r, g, b] = binCenter(k);
    const lab = rgbToOklab(r, g, b);
    for (const c of clusters) {
      // Un aplat ne se laisse absorber que par un aplat proche : c'est ce qui
      // empêche le jaune de la pastille de rejoindre le doré du produit.
      const seuil = (aplat || c.aplat) ? Math.min(rayon, FLAT_MERGE) : rayon;
      if (oklabDist(lab, c.lab) < seuil) {
        const w = c.n + n;
        c.r = (c.r * c.n + r * n) / w;
        c.g = (c.g * c.n + g * n) / w;
        c.b = (c.b * c.n + b * n) / w;
        c.n = w;
        c.lab = rgbToOklab(c.r, c.g, c.b);
        c.pic = Math.max(c.pic, pic);
        c.aplat = c.aplat || aplat;
        return;
      }
    }
    if (clusters.length < MAX) clusters.push({ lab, r, g, b, n, pic, aplat });
  };

  const cases = Array.from(total.entries()).sort((a, b) => b[1] - a[1]);
  const pics = new Map<number, number>();
  for (const [k, n] of cases) pics.set(k, n / Math.max(1, voisinage(total, k)));

  // Passe 1a : les aplats d'abord. Ils prennent leur place avant que la masse
  // des couleurs de photo n'occupe le terrain.
  for (const [k, n] of cases) {
    const pic = pics.get(k) ?? 0;
    if (pic >= PIC_SEUIL && n / pixels >= PIC_MIN) ajouter(k, n, pic, true, FLAT_MERGE);
  }
  // Passe 1b : tout le reste, au seuil large.
  for (const [k, n] of cases) {
    const pic = pics.get(k) ?? 0;
    if (!(pic >= PIC_SEUIL && n / pixels >= PIC_MIN)) ajouter(k, n, pic, false, MERGE);
  }
  if (!clusters.length) return empty;

  const centres = clusters.map(c => rgbToOklab(c.r, c.g, c.b));

  // Passe 2 : chaque image redit la part de chaque couleur retenue.
  const posts = new Array<number>(clusters.length).fill(0);
  for (const r of readings) {
    const part = new Array<number>(clusters.length).fill(0);
    r.bins.forEach((n, k) => {
      const [rr, gg, bb] = binCenter(k);
      const lab = rgbToOklab(rr, gg, bb);
      let best = -1, bestD = ASSIGN;
      for (let i = 0; i < centres.length; i++) {
        const d = oklabDist(lab, centres[i]);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) part[best] += n;
    });
    for (let i = 0; i < part.length; i++) {
      if (part[i] / r.pixels >= PRESENCE) posts[i]++;
    }
  }

  const colors: ColorReading[] = clusters
    .map((c, i) => ({
      hex: rgbToHex(c.r, c.g, c.b),
      share: c.n / pixels,
      posts: posts[i],
      sat: satOf(c.r, c.g, c.b),
      lum: lumOf(c.r, c.g, c.b),
      flat: c.pic,
    }))
    .sort((a, b) => b.share - a.share);

  // La signature : ce qui revient, ET qui est posé à plat, ET qui pèse assez
  // pour ne pas être du bruit de compression. Les trois conditions comptent :
  // sans la dernière, une case isolée sort avec une planéité de 1,00.
  const seuil = Math.max(2, Math.ceil(readings.length * 0.5));
  const signature = colors
    .filter(c => c.posts >= seuil && c.flat >= 0.3 && c.share >= 0.004)
    .sort((a, b) => (b.flat * 1.5 + b.posts / readings.length) - (a.flat * 1.5 + a.posts / readings.length))
    .slice(0, 8);

  return {
    postCount,
    read: readings.length,
    colors: colors.slice(0, 14),
    signature,
    lightness: readings.reduce((s, r) => s + r.lightness, 0) / readings.length,
    contrast: readings.reduce((s, r) => s + r.contrast, 0) / readings.length,
    saturation: readings.reduce((s, r) => s + r.saturation, 0) / readings.length,
  };
}

/**
 * Planche contact des publications, en une seule image.
 *
 * Le modèle de vision juge un FIL, pas des images isolées : ce qui fait une
 * marque est ce qui se répète, et ça ne se voit qu'en planche. Envoyer vingt
 * images séparées coûte vingt fois plus cher et donne une lecture plus faible.
 */
export async function buildContactSheet(
  urls: string[],
  opts: { cols?: number; cell?: number; max?: number } = {},
): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const cols = opts.cols ?? 4;
  const cell = opts.cell ?? 320;
  const list = urls.slice(0, opts.max ?? 16);
  if (!list.length) return null;
  const rows = Math.ceil(list.length / cols);

  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await Promise.all(list.map((u, i) => new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Recadrage centré : une planche où chaque case a un format différent ne
      // se lit pas comme un feed, et c'est le feed qu'on veut faire juger.
      const s = Math.min(img.naturalWidth, img.naturalHeight) || 1;
      const sx = (img.naturalWidth - s) / 2, sy = (img.naturalHeight - s) / 2;
      const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
      try { ctx.drawImage(img, sx, sy, s, s, x, y, cell, cell); } catch { /* case vide */ }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = /^(data:|blob:|\/)/.test(u) ? u : `/api/proxy-image?url=${encodeURIComponent(u)}`;
  })));

  try { return canvas.toDataURL('image/jpeg', 0.72); } catch { return null; }
}

// ── Traduction : de la mesure vers les vocabulaires de KLIP ──────────────────

export interface ColorwayMatch {
  colorway: Colorway;
  score: number;
  why: string;
}

/**
 * Le terrain de couleur, choisi par DISTANCE à la palette relevée.
 *
 * Un terrain, c'est trois décisions : le papier (le fond clair), l'encre (le
 * sombre), l'accent de secours. On les compare aux trois candidats équivalents
 * du fil : sa couleur claire la plus présente, sa couleur sombre la plus
 * présente, sa couleur colorée la plus présente. La note est une distance, donc
 * la plus petite gagne, et on peut la montrer.
 *
 * Remplace, quand elle est disponible, l'empreinte du nom de `pickColorway`.
 */
export function colorwayFromMetrics(m: FeedMetrics): ColorwayMatch | null {
  const pool = m.colors;
  if (pool.length < 2) return null;

  const parPresence = (a: ColorReading, b: ColorReading) => (b.posts - a.posts) || (b.share - a.share);

  // LE NEUTRE CLAIR, pas la couleur claire. Le premier essai prenait « la
  // couleur la plus claire », et sur un compte de restauration rapide c'était le
  // JAUNE DE LA MARQUE : le terrain était alors choisi pour ressembler à un
  // accent, ce qui n'a aucun sens. Le papier d'un terrain est un fond, donc on
  // ne le compare qu'à un fond : clair ET peu saturé.
  const clair = pool.filter(c => c.lum > 0.45 && c.sat < 0.32).sort(parPresence)[0] ?? null;
  // Une encre est sombre ET peu colorée : un brun de sauce est sombre aussi,
  // mais en faire l'encre d'une marque teinte tous ses textes.
  const noteEncre = (c: ColorReading) => c.posts / Math.max(1, m.read) - c.sat * 0.8;
  const sombre = pool.filter(c => c.lum < 0.18).sort((a, b) => noteEncre(b) - noteEncre(a))[0]
    ?? pool.slice().sort((a, b) => a.lum - b.lum)[0];
  // L'accent ne sert qu'à départager : les vraies couleurs de la marque partent
  // dans la charte (`brandColorsFromMetrics`), pas dans le terrain.
  // Pour l'accent, la planéité et la saturation priment sur la présence : un
  // rouge d'aplat vu dans cinq posts sur six est plus « la couleur de cette
  // marque » qu'un brun de photo vu dans les six.
  const seuilAccent = Math.max(2, Math.ceil(m.read * 0.4));
  const colore = pool
    .filter(c => c.sat >= 0.4 && c.flat >= 0.3 && c.posts >= seuilAccent)
    .sort((a, b) => (b.flat * 1.5 + b.sat) - (a.flat * 1.5 + a.sat))[0] ?? null;

  // Chaleur du fil, pour les comptes qui n'ont AUCUN fond clair (photographie
  // sombre, fond noir). Comparer leur papier à rien donnerait le même terrain
  // pour tout le monde ; leur température, elle, se mesure toujours.
  let chaud = 0, poids = 0;
  for (const c of pool) {
    const [r, , b] = hexToRgb(c.hex);
    chaud += ((r - b) / 255) * c.share;
    poids += c.share;
  }
  const chaleurFil = poids ? chaud / poids : 0;
  const chaleur = (h: string) => { const [r, , b] = hexToRgb(h); return (r - b) / 255; };

  let best: ColorwayMatch | null = null;
  for (const way of COLORWAYS) {
    const dInk = hexDist(way.ink, sombre.hex);
    const dPaper = clair ? hexDist(way.paper, clair.hex) : Math.abs(chaleur(way.paper) - chaleurFil);
    const dAccent = colore ? hexDist(way.accent, colore.hex) : 0;
    const score = dInk * 1.0 + dPaper * (clair ? 1.4 : 1.1) + dAccent * 0.3;
    if (!best || score < best.score) {
      best = {
        colorway: way,
        score,
        why: [
          `encre ${way.ink} contre ${sombre.hex} relevé`,
          clair
            ? `papier ${way.paper} contre le neutre clair ${clair.hex}`
            : `aucun neutre clair dans le fil, papier ${way.paper} choisi sur la chaleur (${chaleurFil.toFixed(2)})`,
          colore ? `accent ${way.accent} contre ${colore.hex}` : 'aucun aplat saturé récurrent',
        ].join(', '),
      };
    }
  }
  return best;
}

/** Personnalités déduites des mesures seules, avant même de regarder les images. */
export function vibesFromMetrics(m: FeedMetrics): Vibe[] {
  const out: Vibe[] = [];
  const chroma = m.signature.filter(c => c.sat >= 0.35).length;
  if (m.saturation >= 0.42 && chroma >= 2) out.push('audacieux');
  if (m.saturation <= 0.2 && m.contrast <= 0.2) out.push('minimal');
  if (m.lightness >= 0.55 && m.saturation < 0.35) out.push('sobre');
  if (m.lightness <= 0.24) out.push('luxe');
  const chaud = m.signature.some(c => c.sat > 0.3 && c.hex && hexIsWarm(c.hex));
  if (chaud && m.saturation > 0.28) out.push('chaleureux');
  return out.length ? out : ['sobre'];
}

function hexIsWarm(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return r > b + 18;
}

/** Registre lu vers identité typographique, dans le catalogue existant. */
const REGISTRE_VERS_IDENTITES: Record<Register, string[]> = {
  grotesque: ['suisse', 'brut'],
  serif: ['editorial-contraste', 'douceur'],
  condense: ['affiche', 'brut'],
  manuscrit: ['douceur'],
  mixte: ['editorial-contraste', 'affiche'],
  aucun: [],
};

/**
 * L'identité typographique, orientée par le registre LU sur les visuels.
 *
 * On ne peut pas mesurer une police sur une vignette, mais on peut lire un
 * registre : des empattements, un condensé d'affiche, un manuscrit. Il suffit à
 * écarter les identités qui n'ont rien à voir. Le reste du départage garde la
 * logique existante (secteur et personnalité), et le nom sert de dernier arbitre
 * pour que deux marques du même registre ne repartent pas avec la même typo.
 */
export function typeIdentityFromReading(
  register: Register,
  vibes: Vibe[],
  sector?: string | null,
  name?: string | null,
): string {
  const favoris = new Set(REGISTRE_VERS_IDENTITES[register] ?? []);
  const secteur = String(sector ?? '').trim().toLowerCase();
  let graine = 0;
  for (const ch of String(name ?? 'klip').toLowerCase()) graine = (graine * 31 + ch.charCodeAt(0)) >>> 0;

  const notes = TYPE_IDENTITIES.map((t, i) => {
    let n = 0;
    if (favoris.has(t.id)) n += 3;
    if (secteur && t.sectors.some(s => s.toLowerCase() === secteur)) n += 1.6;
    for (const v of vibes) {
      const rang = t.vibes.indexOf(v);
      if (rang === 0) n += 2.2;
      else if (rang > 0) n += 1.2;
    }
    n += ((graine + i * 40503) % 1000) / 1400;
    return { id: t.id, n };
  });
  notes.sort((a, b) => b.n - a.n);
  return notes[0].id;
}

export interface PoolOptions {
  hasPhoto: boolean;
  count?: number;
  /** Recettes déjà proposées, à ne pas resservir. */
  avoid?: string[];
}

/**
 * Le tirage de compositions proposé au modèle, penché vers l'ADN.
 *
 * Même principe que `pickDesignCandidates` : jamais le catalogue entier, une
 * répartition par famille. La différence est le penchant : les familles et les
 * zones RELEVÉES sur le fil du client remontent, les autres restent présentes
 * (une marque qui n'écrit jamais en haut de ses photos n'a pas décidé de ne
 * jamais le faire, elle ne l'a pas essayé) mais moins nombreuses.
 */
export function recipePoolForDNA(dna: Pick<BrandDNA, 'families' | 'zones' | 'vibes'>, o: PoolOptions): DesignRecipe[] {
  const count = Math.max(6, Math.min(o.count ?? 12, DESIGN_RECIPES.length));
  const avoid = new Set(o.avoid ?? []);
  const famVoulues = new Set(dna.families ?? []);
  const zonesVoulues = new Set<RecipeZone>((dna.zones ?? []) as RecipeZone[]);
  const vibes = new Set(dna.vibes ?? []);

  const aUneZonePhoto = (r: DesignRecipe) => r.nodes.some(n => n.k === 'photo');
  const usable = DESIGN_RECIPES.filter(r => (o.hasPhoto ? aUneZonePhoto(r) : !aUneZonePhoto(r)) && !avoid.has(r.id));

  const note = (r: DesignRecipe): number => {
    let n = 0;
    if (famVoulues.has(r.family)) n += 2.4;
    if (zonesVoulues.has(recipeZone(r))) n += 1.8;
    for (const v of r.vibe) if (vibes.has(v)) n += 1.1;
    return n;
  };

  const byFamily = new Map<string, DesignRecipe[]>();
  for (const r of usable) {
    const list = byFamily.get(r.family) ?? [];
    list.push(r);
    byFamily.set(r.family, list);
  }
  byFamily.forEach(list => list.sort((a, b) => note(b) - note(a)));

  // Les familles voulues passent en tête du tour de table : sur un tirage de
  // douze, l'ordre des familles décide de qui entre et qui n'entre pas.
  const families = Array.from(byFamily.keys())
    .sort((a, b) => (famVoulues.has(b) ? 1 : 0) - (famVoulues.has(a) ? 1 : 0));

  const out: DesignRecipe[] = [];
  for (let round = 0; out.length < count; round++) {
    let added = 0;
    for (const f of families) {
      const list = byFamily.get(f)!;
      if (round < list.length && out.length < count) { out.push(list[round]); added++; }
    }
    if (!added) break;
  }
  return out.slice(0, count);
}

/** Ce qui fait une bonne candidate de charte : posée à plat, saturée, répétée. */
function note(c: ColorReading, m: FeedMetrics): number {
  return c.flat * 1.8 + c.sat * 1.2 + c.posts / Math.max(1, m.read);
}

/** Les couleurs à proposer dans la fiche de marque, les plus fiables d'abord. */
export function brandColorsFromMetrics(m: FeedMetrics): string[] {
  // Une signature d'une ou deux couleurs ne fait pas une charte : dans ce cas on
  // reprend toute la palette et on laisse la note trancher.
  const pool = m.signature.length >= 3 ? m.signature : m.colors;
  const out: string[] = [];
  // On propose d'abord ce qui EST une couleur (saturée et récurrente) : une
  // charte préremplie avec trois gris de photo ne sert à personne.
  const rank = pool.slice().sort((a, b) => note(b, m) - note(a, m));
  for (const c of rank) {
    if (out.some(h => hexDist(h, c.hex) < 0.14)) continue;
    out.push(c.hex);
    if (out.length >= 6) break;
  }
  return out;
}

/** Le libellé d'une part, pour l'affichage. */
export function pct(v: number): string {
  return `${Math.round(v * 100)} %`;
}
