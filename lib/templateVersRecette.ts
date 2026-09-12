// DU MODÈLE DESSINÉ À LA RECETTE RÉUTILISABLE.
//
// LE PROBLÈME QU'IL RÉSOUT, ET IL EST TOUT LE SUJET. Un modèle dessiné dans
// l'éditeur porte des couleurs LITTÉRALES (#FF4438) et des noms de police
// ("Oswald"), en PIXELS, pour UN client. Tel quel il ne s'adapte à personne :
// le resservir à un cabinet d'avocats lui donnerait le rouge d'un fast-food.
//
// Les recettes de `designSystem.ts` ne portent, elles, que des RÔLES : `brand`,
// `onBrand`, `display`, `script`, en FRACTIONS du cadre. C'est ça, et seulement
// ça, qui fait qu'une composition se repeint aux couleurs de chaque marque.
//
// Ce module fait la traduction. Il est PUR : pas de base, pas de réseau, pas de
// DOM — on peut donc le contrôler sur un modèle connu sans rien lancer.
//
// CE QU'IL NE PEUT PAS DEVINER, et qu'il faut savoir avant de dessiner : il
// rapproche chaque couleur du rôle le plus proche DANS LA CHARTE DU CLIENT OÙ LE
// MODÈLE A ÉTÉ DESSINÉ. Si ce client n'a pas de charte renseignée, tout se
// rattache aux couleurs par défaut et la conversion ne vaut rien. Dessiner sur
// un compte sans charte, c'est perdre le travail.

import {
  resolvePalette, resolveFonts,
  type Col, type Fnt, type DesignNode, type DesignRecipe, type DesignSlot,
  type TextNode, type Vibe, type Intent,
} from './designSystem';
import { deduireRoles } from './deduireRoles';

/** Le cadre du modèle, en pixels, tel que l'éditeur l'a dessiné. */
export type Format = { w: number; h: number };

/** La charte du client chez qui le modèle a été dessiné. */
export type Charte = {
  primary?: string | null; secondary?: string | null; accent?: string | null;
  name?: string | null; sector?: string | null; tone?: string | null;
  display?: string | null; body?: string | null;
};

type El = Record<string, unknown>;

const n = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const s = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

// ── Couleurs ────────────────────────────────────────────────────────────────

function rvb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Distance perceptuelle approchée : le vert pèse plus que le bleu dans l'oeil.
 *  Une distance euclidienne brute rapprochait un orange d'un vert plus que d'un
 *  rouge, ce qui donnait des rôles absurdes sur les chartes chaudes. */
function ecart(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

/** Les rôles auxquels une couleur littérale a le droit de se rattacher.
 *  On EXCLUT volontairement les rôles calculés pour un fond donné (`onBrand`,
 *  `accentLight`…) : ils ne sont pas des couleurs qu'un graphiste choisit, ce
 *  sont des conséquences. Les attribuer ici produirait des recettes dont la
 *  couleur change de sens dès qu'on change de fond. */
const ROLES_CHOISIS: Col[] = ['brand', 'accent', 'secondary', 'ink', 'paper', 'white', 'black', 'surface', 'deep'];

/** Les rôles NEUTRES : ceux qui ne portent aucune couleur de marque. */
const ROLES_NEUTRES: Col[] = ['white', 'black', 'ink', 'paper', 'surface', 'deep'];

/** Saturation (0 = gris parfait, 1 = couleur pure). */
function saturation([r, g, b]: [number, number, number]): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** En-deçà, la couleur est un NEUTRE : un blanc, un noir, un gris, un crème. */
const SEUIL_NEUTRE = 0.12;

export function couleurVersRole(hex: string, charte: Charte): Col {
  const cible = rvb(hex);
  if (!cible) return 'white';

  // UN BLANC RESTE UN BLANC, MÊME SI LA MARQUE EN A FAIT SA COULEUR SECONDAIRE.
  //
  // Mesuré sur un vrai client : la couleur secondaire de « Resto Chez GG » est
  // littéralement #FFFFFF. Tous ses textes blancs se rattachaient donc au rôle
  // `secondary` — et chez un client dont la secondaire est un vert foncé, le
  // même texte serait repeint en vert foncé sur une photo. Illisible, et
  // invisible au moment de la conversion.
  //
  // Un neutre n'est pas un choix de marque, c'est un choix de LISIBILITÉ : il
  // ne doit jamais se rattacher à un rôle coloré, même quand ce rôle porte par
  // hasard la même valeur. La réciproque est vraie aussi : une couleur franche
  // ne doit pas atterrir sur un neutre.
  const candidats = saturation(cible) < SEUIL_NEUTRE ? ROLES_NEUTRES : ROLES_CHOISIS;

  const palette = resolvePalette({
    primary: charte.primary ?? null, secondary: charte.secondary ?? null,
    accent: charte.accent ?? null, name: charte.name ?? null,
    sector: charte.sector ?? null, tone: charte.tone ?? null,
  } as Parameters<typeof resolvePalette>[0]) as Record<string, string>;

  let meilleur: Col = 'white', best = Infinity;
  for (const role of candidats) {
    const ref = rvb(palette[role] ?? '');
    if (!ref) continue;
    const d = ecart(cible, ref);
    if (d < best) { best = d; meilleur = role; }
  }
  return meilleur;
}

// ── Polices ─────────────────────────────────────────────────────────────────

/** Les familles dont le NOM trahit le geste, quand le calque ne porte pas déjà
 *  son `fontRole`. C'est volontairement grossier : mieux vaut un `display` par
 *  défaut qu'un `script` attribué à tort, qui rendrait un titre en cursive. */
const INDICES: [RegExp, Fnt][] = [
  [/script|hand|brush|signat|caveat|pacifico|dancing|sacramento|satisfy|marker/i, 'script'],
  [/serif|playfair|georgia|garamond|times|merriweather|lora|libre baskerville/i, 'serif'],
  [/condens|oswald|bebas|anton|impact|teko|barlow ?condensed/i, 'condensed'],
];

export function policeVersRole(famille: string, roleDejaLa: string | undefined, charte: Charte): Fnt {
  // Un calque écrit par le système de design porte déjà son rôle : il fait foi.
  if (roleDejaLa && ['display', 'body', 'script', 'condensed', 'serif'].includes(roleDejaLa)) return roleDejaLa as Fnt;
  const f = famille.trim();
  if (!f) return 'display';
  // La charte d'abord : si c'est littéralement la police de titre du client,
  // c'est `display`, quel que soit ce que son nom évoque.
  const fonts = resolveFonts({
    display: charte.display ?? null, body: charte.body ?? null,
    name: charte.name ?? null, sector: charte.sector ?? null, tone: charte.tone ?? null,
  } as Parameters<typeof resolveFonts>[0]);
  const meme = (a: string, b?: string) => !!b && a.toLowerCase().split(',')[0].trim() === b.toLowerCase().split(',')[0].trim();
  if (meme(f, fonts.display)) return 'display';
  if (meme(f, fonts.body)) return 'body';
  for (const [re, role] of INDICES) if (re.test(f)) return role;
  return 'display';
}

// ── Les calques ─────────────────────────────────────────────────────────────

/** Effet de l'éditeur → geste de recette. Un seul peut vivre à la fois. */
function effet(el: El): TextNode['fx'] | undefined {
  if (el.glowEnabled) return 'glow';
  if (el.echoEnabled) return 'echo';
  if (el.liftEnabled) return 'lift';
  return undefined;
}

function texteVersNoeud(el: El, fmt: Format, charte: Charte, cle: string | null, role: string | null): TextNode {
  const taille = n(el.fontSize) / fmt.w;
  const nd: TextNode = {
    k: 'text',
    ...(cle ? { slot: cle } : { text: s(el.text) }),
    x: n(el.x) / fmt.w,
    y: n(el.y) / fmt.h,
    w: n(el.width, fmt.w * 0.8) / fmt.w,
    size: taille,
    fill: couleurVersRole(s(el.fill, '#FFFFFF'), charte),
    font: policeVersRole(s(el.fontFamily), s(el.fontRole) || undefined, charte),
  };
  // RAMENER LA BOÎTE DANS LE CADRE.
  //
  // L'éditeur laisse volontiers une boîte de texte dépasser : le bloc est large,
  // le texte à l'intérieur ne l'est pas, et à l'écran tout paraît juste. Mais une
  // recette dit à l'IA combien de signes elle peut écrire à partir de cette
  // largeur — une boîte qui sort du cadre l'autorise donc à écrire hors champ,
  // et le contrôle géométrique refuse la composition à raison.
  //
  // On rogne la LARGEUR, jamais la position : déplacer le bloc changerait le
  // dessin, le rogner ne fait que dire la vérité sur la place disponible.
  if (nd.x < 0) { nd.w += nd.x; nd.x = 0; }
  if (nd.x + nd.w > 1) nd.w = Math.max(0.1, 1 - nd.x);
  nd.w = Math.round(nd.w * 1000) / 1000;
  nd.x = Math.round(nd.x * 1000) / 1000;

  if (s(el.fontStyle).includes('bold')) nd.weight = 'bold';
  if (s(el.fontStyle).includes('italic')) nd.italic = true;
  if (el.align && el.align !== 'left') nd.align = el.align as TextNode['align'];
  if (el.uppercase) nd.upper = true;
  if (n(el.lineHeight)) nd.lh = n(el.lineHeight);
  // `letterSpacing` est en PIXELS dans l'éditeur, `track` est une fraction du
  // corps. Copier la valeur telle quelle donnait un interlettrage de plusieurs
  // fois la taille du texte.
  if (n(el.letterSpacing) && n(el.fontSize)) nd.track = n(el.letterSpacing) / n(el.fontSize);
  if (n(el.maxLines)) nd.maxLines = n(el.maxLines);
  if (role) nd.role = role as TextNode['role'];
  if (n(el.rotation)) nd.rotation = n(el.rotation);
  if (n(el.opacity, 100) !== 100) nd.opacity = n(el.opacity, 100);
  if (s(el.textDecoration).includes('line-through')) nd.strike = true;
  if (el.hollowEnabled) nd.hollow = true;
  if (el.shadowEnabled) nd.shadow = true;
  const fx = effet(el);
  if (fx) { nd.fx = fx; nd.fxCol = couleurVersRole(s(el.glowColor || el.echoColor || el.liftColor, '#FFFFFF'), charte); }
  if (el.highlightEnabled) {
    nd.hl = couleurVersRole(s(el.highlightColor, '#FFFFFF'), charte);
    // `hlRadius` et `hlPad` restent en PIXELS côté rendu : cf. la note du
    // 2026-09-10, tout n'est pas en fractions dans ce fichier.
    if (n(el.highlightBorderRadius)) nd.hlRadius = n(el.highlightBorderRadius);
    if (n(el.highlightPadding)) nd.hlPad = n(el.highlightPadding);
  }
  if (el.hasBg) {
    nd.bg = couleurVersRole(s(el.bgColor, '#000000'), charte);
    if (n(el.cornerRadius)) nd.bgRadius = n(el.cornerRadius);
    // `bgPad` est une fraction DU CORPS, pas du cadre.
    if (n(el.paddingH) && n(el.fontSize)) nd.bgPad = n(el.paddingH) / n(el.fontSize);
    if (n(el.bgOpacity, 100) !== 100) nd.bgOpacity = n(el.bgOpacity, 100);
  }
  return nd;
}

const FORMES: Record<string, 'pill' | 'arrow' | 'circle' | 'star' | 'diamond' | 'triangle' | 'hexagon' | 'rectangle'> = {
  rectangle: 'rectangle', circle: 'circle', triangle: 'triangle', star: 'star',
  pill: 'pill', arrow: 'arrow', diamond: 'diamond', hexagon: 'hexagon',
};

function autreVersNoeud(el: El, fmt: Format, charte: Charte): DesignNode | null {
  const base = { x: n(el.x) / fmt.w, y: n(el.y) / fmt.h };
  const rot = n(el.rotation) ? { rotation: n(el.rotation) } : {};
  const op = n(el.opacity, 100) !== 100 ? { opacity: n(el.opacity, 100) } : {};

  if (el.type === 'image') {
    return {
      k: 'photo', ...base, w: n(el.width, fmt.w) / fmt.w, h: n(el.height, fmt.h) / fmt.h,
      // `radius` sur un noeud est une FRACTION de la largeur ; l'éditeur le
      // stocke en pixels. C'est le piège qui rendait des formes invisibles.
      ...(n(el.cornerRadius) ? { radius: n(el.cornerRadius) / fmt.w } : {}),
      ...rot, ...op,
    };
  }
  if (el.type === 'rect') {
    return {
      k: 'rect', ...base, w: n(el.width) / fmt.w, h: n(el.height) / fmt.h,
      fill: couleurVersRole(s(el.fill, '#000000'), charte),
      ...(n(el.cornerRadius) ? { radius: n(el.cornerRadius) / fmt.w } : {}),
      ...(s(el.stroke) ? { stroke: couleurVersRole(s(el.stroke), charte), strokeW: n(el.strokeWidth) / fmt.w } : {}),
      ...(el.scrim ? { scrim: el.scrim as 'top' | 'bottom' } : {}),
      ...rot, ...op,
    };
  }
  if (el.type === 'circle' || el.type === 'star' || el.type === 'vector') {
    // Un cercle et une étoile de l'éditeur sont donnés par leur RAYON, depuis
    // leur centre ; un noeud de recette par son coin haut-gauche et sa taille.
    const r = el.type === 'circle' ? n(el.radius) : n(el.outerRadius);
    const w = el.type === 'vector' ? n(el.width) : r * 2;
    const h = el.type === 'vector' ? n(el.height) : r * 2;
    const x = el.type === 'vector' ? n(el.x) : n(el.x) - r;
    const y = el.type === 'vector' ? n(el.y) : n(el.y) - r;
    const forme = el.type === 'vector' ? (FORMES[s(el.shape)] ?? 'rectangle')
      : el.type === 'circle' ? 'circle' : 'star';
    if (el.type === 'vector' && s(el.shape) === 'custom') return null; // un tracé libre n'a pas d'équivalent
    return {
      k: 'shape', shape: forme, x: x / fmt.w, y: y / fmt.h, w: w / fmt.w, h: h / fmt.h,
      fill: s(el.fillType) === 'none' ? 'none' : couleurVersRole(s(el.fill, '#000000'), charte),
      ...(n(el.cornerRadius) ? { radius: n(el.cornerRadius) / fmt.w } : {}),
      ...(s(el.stroke) ? { stroke: couleurVersRole(s(el.stroke), charte), strokeW: n(el.strokeWidth) / fmt.w } : {}),
      ...rot, ...op,
    };
  }
  return null;
}

// ── La conversion ───────────────────────────────────────────────────────────

export type Conversion = {
  recette: DesignRecipe;
  /** Ce que la conversion a dû abandonner ou deviner. À MONTRER, jamais à
   *  taire : un modèle qui perd un calque sans le dire se découvre trois
   *  semaines plus tard, sur le visuel d'un client. */
  pertes: string[];
};

/** Un slot par bloc de texte que l'IA devra écrire.
 *
 *  LE RÔLE N'EST PLUS EXIGÉ DE CELUI QUI DESSINE. S'il en a posé un, il fait
 *  foi. Sinon on le DÉDUIT du dessin (`deduireRoles`) : quelqu'un qui compose
 *  écrit son titre en grand et sa mention en petit, et ces choix sont déjà
 *  l'information. Avant, un modèle dont aucun bloc ne portait de rôle était
 *  joli et parfaitement inutile — l'IA n'avait rien à y écrire. */
function estRemplissable(el: El, roleDeduit: string | null): boolean {
  return el.type === 'text' && !!(s(el.role) || roleDeduit) && s(el.text).trim().length > 0;
}

export function convertirModele(opt: {
  elements: unknown[];
  format: Format;
  charte: Charte;
  id: string;
  nom: string;
  /** Le fond du modèle, que l'éditeur garde à PART des calques
   *  (`post_templates.background_style`). Sans lui, une composition sans photo
   *  rendait une page blanche : son texte blanc sur un fond blanc. Il devient
   *  ici un aplat plein cadre, converti en rôle comme le reste. */
  fond?: { type?: string; color?: string; colorFrom?: string } | null;
  famille?: string;
  vibe?: Vibe[];
  intents?: Intent[];
}): Conversion {
  const pertes: string[] = [];
  const els = (opt.elements ?? []).filter((e): e is El => !!e && typeof e === 'object');

  // Les rôles déduits du dessin, une fois pour toute la composition : la
  // hiérarchie des tailles n'a de sens que comparée à l'ensemble.
  const deduits = new Map<string, string | null>();
  for (const d of deduireRoles(els as Parameters<typeof deduireRoles>[0])) deduits.set(d.id, d.role);
  const nodes: DesignNode[] = [];
  const slots: DesignSlot[] = [];

  // LE FOND EN PREMIER, donc SOUS tout le reste. Posé après, il masquerait la
  // composition entière.
  const couleurFond = opt.fond?.color || opt.fond?.colorFrom;
  if (couleurFond) {
    nodes.push({ k: 'rect', x: 0, y: 0, w: 1, h: 1, fill: couleurVersRole(couleurFond, opt.charte) });
  }
  const prises = new Set<string>();

  for (const el of els) {
    if (el.type === 'text') {
      const roleDeduit = deduits.get(s(el.id)) ?? null;
      let cle: string | null = null;
      if (estRemplissable(el, roleDeduit)) {
        const base = (s(el.roleLabel) || s(el.role) || roleDeduit || 'texte').toLowerCase()
          .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'texte';
        cle = base; let i = 2;
        while (prises.has(cle)) cle = `${base}-${i++}`;
        prises.add(cle);
        // La longueur MAXIMALE vient du texte que tu as écrit : c'est lui qui
        // dit la silhouette voulue. Un peu de marge, sans plus — le dessin a
        // été fait pour cette longueur-là.
        const max = Math.max(4, Math.round(s(el.text).length * 1.15));
        slots.push({
          key: cle,
          label: s(el.roleHint) || s(el.roleLabel) || s(el.role) || roleDeduit || 'texte',
          max,
          // ON GARDE LE TEXTE ÉCRIT PAR L'AUTEUR. Il ne sert pas au client final
          // — l'IA écrira le sien — mais il sert à MONTRER la composition telle
          // qu'elle a été pensée. Un aperçu rempli d'autre chose ne dit rien du
          // dessin, il dit ce qui arrive à ce dessin quand on lui donne un texte
          // de la mauvaise longueur.
          exemple: s(el.text).trim(),
        });
      }
      nodes.push(texteVersNoeud(el, opt.format, opt.charte, cle, s(el.role) || roleDeduit));
      continue;
    }
    const nd = autreVersNoeud(el, opt.format, opt.charte);
    if (nd) nodes.push(nd);
    else pertes.push(`calque « ${s(el.type) || 'inconnu'} » abandonné : pas d'équivalent dans une recette`);
  }

  if (!slots.length) pertes.push('aucun bloc de texte : l\'IA n\'aura rien à écrire dans cette composition');
  if (!nodes.some(x => x.k === 'photo')) pertes.push('aucune zone photo : cette composition ne sera proposée qu\'aux visuels SANS image');

  return {
    pertes,
    recette: {
      id: opt.id, name: opt.nom,
      family: opt.famille ?? 'maison',
      vibe: opt.vibe ?? [], intents: opt.intents ?? [],
      photo: nodes.some(x => x.k === 'photo') ? 'required' : 'none',
      desc: `${opt.nom} — composition dessinée à la main puis convertie en rôles de charte.`,
      slots, nodes,
    },
  };
}
