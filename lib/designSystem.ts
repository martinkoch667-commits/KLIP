// lib/designSystem.ts — le système de design des visuels générés.
//
// POURQUOI CE FICHIER
// La génération automatique choisissait parmi `layoutLibrary.ts` : dix-huit
// recettes qui font toutes la même chose — poser du texte sur une photo, avec au
// mieux un aplat derrière. Résultat : quel que soit le client, quel que soit le
// secteur, on reconnaissait le même visuel. « Elle a trois templates et c'est
// toujours les mêmes » : le reproche était exact, parce que la bibliothèque ne
// contenait aucune AUTRE idée de composition.
//
// Ici, une composition n'est plus « des positions de texte » mais un DESSIN
// complet : aplats, cadres, pastilles, filets, flèches, cartes, photo recadrée,
// typographies qui se répondent. Le vocabulaire est celui de l'éditeur (les
// mêmes calques que si un graphiste les avait posés à la main), donc ce qui sort
// est immédiatement modifiable par l'utilisateur — rien n'est « gravé ».
//
// CE QUI VIENT DES RÉFÉRENCES (feeds analysés le 23/08)
//  · un rail de marque fin en capitales espacées, répété sur tous les posts ;
//  · la signature manuscrite posée par-dessus la photo ;
//  · le mot corrigé : un mot barré + sa correction manuscrite en accent ;
//  · le mélange serif italique / grotesque gras dans une même phrase ;
//  · la ligne de service en pied (@compte · enregistre · flèche) ;
//  · les aplats saturés avec pastilles, bulles et annotations au marqueur ;
//  · les cartes à coins arrondis, flèches dessinées, badges ;
//  · l'imitation d'interface (note, bulle de message, barre de recherche).
//
// CE QUE L'IA DÉCIDE, CE QU'ELLE NE DÉCIDE PAS
// Elle choisit la recette et écrit les textes. Elle n'invente jamais de
// coordonnées, de couleur ni de taille : le dessin est déjà juste, et c'est ce
// qui garantit un rendu pro à chaque tirage.

import { pickTypeIdentity } from './typeIdentity';
import { pickColorway } from './colorway';
import { nearestWeight } from './fontCatalog';

// ── Vocabulaire ──────────────────────────────────────────────────────────────

/** Rôle de couleur, résolu sur la charte du client au moment du rendu. */
export type Col =
  | 'brand' | 'accent' | 'secondary'
  | 'ink' | 'paper' | 'white' | 'black'
  // Le fond clair n'est plus seul : `surface` est la carte posée SUR le papier
  // (elle doit s'en détacher), `deep` le fond sombre du terrain. Sans eux, une
  // carte ne pouvait être que blanche — la même carte blanche pour toutes les
  // marques, sur le même beige.
  | 'surface' | 'deep'
  | 'onBrand' | 'onAccent' | 'onSecondary' | 'onPaper' | 'onSurface' | 'onDeep'
  // Trois variantes de l'accent, calculées pour un FOND donné. Un accent est
  // une couleur unique ; un visuel a des fonds sombres ET clairs. Sans elles,
  // une charte au bleu nuit perdait ses chiffres, ses filets et ses guillemets
  // sur toutes les photos sombres — la composition existait, on ne la voyait pas.
  | 'accentLight'   // lisible sur une photo assombrie ou un aplat sombre
  | 'accentDeep'    // lisible sur un fond clair (papier, carte blanche)
  | 'accentOnBrand'; // lisible sur l'aplat de la marque

/** Rôle typographique. `display`/`body` viennent de la charte ; les trois autres
 *  sont des typos de GESTE (manuscrit, condensé d'affiche, serif de presse) que
 *  la charte ne fournit presque jamais et sans lesquelles la moitié des codes
 *  Instagram actuels sont inaccessibles. */
export type Fnt = 'display' | 'body' | 'script' | 'condensed' | 'serif';

export type Vibe = 'sobre' | 'audacieux' | 'chaleureux' | 'minimal' | 'ludique' | 'luxe' | 'tech' | 'retro' | 'editorial';
export type Intent = 'accroche' | 'offre' | 'conseil' | 'citation' | 'evenement' | 'preuve' | 'produit' | 'menu' | 'coulisses' | 'annonce' | 'liste';

interface NodeBase { rotation?: number; opacity?: number }

export interface PhotoNode extends NodeBase {
  k: 'photo';
  x: number; y: number; w: number; h: number;
  radius?: number;
  /** Assombrissement posé par-dessus (0-100) : lisibilité garantie sans voile grossier. */
  dark?: number;
  /** Réglages colorimétriques du calque image (-100..100). */
  sat?: number; contrast?: number; bright?: number;
}
export interface RectNode extends NodeBase {
  k: 'rect';
  /** ATTENTION, MÊME PIÈGE QUE `strokeW` : `radius` est une FRACTION de la
   *  largeur du cadre, jamais des pixels. `radius: 16` donnait 16 x 1080 =
   *  17280 px, donc une carte transformée en pastille difforme. Un arrondi
   *  discret vaut 0.004, un arrondi de carte 0.015. */
  x: number; y: number; w: number; h: number;
  fill: Col; radius?: number; stroke?: Col; strokeW?: number;
  scrim?: 'top' | 'bottom';
}
export interface ShapeNode extends NodeBase {
  k: 'shape';
  /** ATTENTION : `strokeW` est une FRACTION de la largeur du cadre, comme tout
   *  le reste ici, jamais des pixels. `strokeW: 3` donnait un contour de
   *  3 x 1080 = 3240 px, donc une forme invisible parce que démesurée. Un
   *  contour fin vaut 0.0012, un contour épais 0.004. */
  shape: 'pill' | 'arrow' | 'circle' | 'star' | 'diamond' | 'triangle' | 'hexagon' | 'rectangle';
  x: number; y: number; w: number; h: number;
  fill: Col | 'none'; stroke?: Col; strokeW?: number; radius?: number;
}
export interface TextNode extends NodeBase {
  k: 'text';
  /** Clé de remplissage : l'IA écrit le texte de CE slot. Absent = texte figé. */
  slot?: string;
  text?: string;
  x: number; y: number; w: number;
  /** Taille en fraction de la LARGEUR du cadre. */
  size: number;
  fill: Col;
  font?: Fnt;
  weight?: 'normal' | 'bold';
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  upper?: boolean;
  lh?: number;
  /** Interlettrage en fraction de la taille de police. */
  track?: number;
  maxLines?: number;
  /** Rôle éditeur : active l'auto-ajustement et l'anti-chevauchement. À OMETTRE
   *  sur les éléments volontairement superposés (mot manuscrit sur mot barré),
   *  que le re-calage écarterait sinon l'un de l'autre. */
  role?: 'titre' | 'sous-titre' | 'accroche' | 'cta' | 'tag' | 'prix' | 'corps';
  /** Surlignage épousant chaque ligne (cartouche, pastille, marqueur). */
  hl?: Col; hlRadius?: number; hlPad?: number;
  /** Lettres évidées (contour seul). */
  hollow?: boolean;
  strokeCol?: Col; strokeW?: number;
  /** Halo doux de lisibilité sur photo. */
  shadow?: boolean;
  /** BLOC DE FOND derrière le texte : le geste le plus courant du social, et
   *  aucune recette ne pouvait l'allumer. `materializeLayout` posait
   *  `hasBg: false` en dur pour toutes, alors que l'éditeur sait le faire
   *  depuis toujours. À ne pas confondre avec `hl`, qui épouse CHAQUE LIGNE :
   *  `bg` est un pavé unique derrière tout le bloc. */
  bg?: Col; bgRadius?: number; bgPad?: number; bgOpacity?: number;
  /** Effet de l'éditeur (panneau Effets). `glow` brille, `neon` brille et se
   *  cerne, `echo` répète le mot en décalé, `lift` le décolle du fond.
   *  Même remarque : le panneau existait, les recettes n'y avaient pas accès. */
  fx?: 'glow' | 'neon' | 'echo' | 'lift';
  fxCol?: Col;
  /** Barré : le geste « ce mot-là, non ». */
  strike?: boolean;
}
export type DesignNode = PhotoNode | RectNode | ShapeNode | TextNode;

export interface DesignSlot {
  key: string;
  /** Ce que ce bloc contient, dit à l'IA en clair. */
  label: string;
  /** Longueur maximale, en caractères. Le dessin a été fait POUR cette longueur. */
  max: number;
}

export interface DesignRecipe {
  id: string;
  name: string;
  family: string;
  vibe: Vibe[];
  intents: Intent[];
  /** Secteurs pour lesquels la recette est particulièrement juste (affinité, pas exclusivité). */
  sectors?: string[];
  photo: 'required' | 'optional' | 'none';
  desc: string;
  slots: DesignSlot[];
  nodes: DesignNode[];
}

// ── Raccourcis d'écriture des recettes ───────────────────────────────────────
const P = (x: number, y: number, w: number, h: number, o: Partial<PhotoNode> = {}): PhotoNode => ({ k: 'photo', x, y, w, h, ...o });
const R = (x: number, y: number, w: number, h: number, fill: Col, o: Partial<RectNode> = {}): RectNode => ({ k: 'rect', x, y, w, h, fill, ...o });
const S = (shape: ShapeNode['shape'], x: number, y: number, w: number, h: number, fill: Col | 'none', o: Partial<ShapeNode> = {}): ShapeNode => ({ k: 'shape', shape, x, y, w, h, fill, ...o });
const T = (slot: string, x: number, y: number, w: number, size: number, fill: Col, o: Partial<TextNode> = {}): TextNode => ({ k: 'text', slot, x, y, w, size, fill, ...o });
const F = (text: string, x: number, y: number, w: number, size: number, fill: Col, o: Partial<TextNode> = {}): TextNode => ({ k: 'text', text, x, y, w, size, fill, ...o });
const sl = (key: string, label: string, max: number): DesignSlot => ({ key, label, max });

// Rail de marque : la ligne fine en capitales espacées que les comptes soignés
// répètent sur CHAQUE post. C'est elle, plus que le logo, qui fait la série.
// `{{marque}}` et `{{handle}}` sont résolus au rendu depuis le workspace : le
// nom du client n'a pas à être deviné par l'IA, il est connu.
const rail = (fill: Col = 'white', y = 0.035): TextNode =>
  F('{{marque}}', 0.08, y, 0.84, 0.024, fill, { align: 'center', upper: true, track: 0.34, maxLines: 1, opacity: 88 });

/** Pied de page utilitaire, repris des comptes de créateurs : compte, invitation
 *  à enregistrer, flèche de suite. Trois signes qui font « compte qui publie
 *  souvent » plutôt que « visuel isolé ». */
const footer = (fill: Col = 'white'): TextNode[] => [
  F('{{handle}}', 0.08, 0.94, 0.42, 0.023, fill, { maxLines: 1, opacity: 72 }),
  F('→', 0.78, 0.928, 0.14, 0.046, fill, { align: 'right', maxLines: 1, opacity: 72 }),
];

// ── Les recettes ─────────────────────────────────────────────────────────────
// Chaque recette est un DESSIN fini. Les slots sont ce que l'IA écrit ; tout le
// reste (géométrie, couleurs, typographies, gestes) est déjà décidé.

export const DESIGN_RECIPES: DesignRecipe[] = [

  // ══ A. PHOTO ÉDITORIALE ═══════════════════════════════════════════════════
  {
    id: 'ds-rail-editorial', name: 'Rail de marque', family: 'photo-editorial',
    vibe: ['editorial', 'sobre'], intents: ['accroche', 'coulisses', 'annonce'],
    photo: 'required',
    desc: 'Photo plein cadre, rail de marque fin en capitales espacées tout en haut, gros titre en bas à gauche avec un kicker en accent. Le code des comptes soignés : la même barre de marque sur chaque post fait la série.',
    slots: [sl('kicker', 'mot-clé court en capitales (rubrique, catégorie)', 22), sl('titre', 'titre principal, très court et frappant', 42), sl('sous', 'phrase de précision', 70)],
    nodes: [
      P(0, 0, 1, 1, { dark: 12 }),
      R(0, 0.5, 1, 0.5, 'black', { scrim: 'bottom', opacity: 72 }),
      rail('white'),
      T('kicker', 0.08, 0.655, 0.6, 0.028, 'accentLight', { upper: true, track: 0.22, maxLines: 1, role: 'tag', weight: 'bold' }),
      T('titre', 0.08, 0.7, 0.84, 0.105, 'white', { upper: true, lh: 0.95, maxLines: 2, role: 'titre', weight: 'bold' }),
      T('sous', 0.08, 0.885, 0.72, 0.03, 'white', { font: 'body', maxLines: 2, role: 'sous-titre', opacity: 88 }),
    ],
  },
  {
    id: 'ds-signature', name: 'Signature manuscrite', family: 'photo-editorial',
    vibe: ['chaleureux', 'editorial'], intents: ['coulisses', 'produit', 'accroche'],
    sectors: ['Restaurant', 'Café', 'Mode', 'Beauté'],
    photo: 'required',
    desc: 'Photo plein cadre, rail de marque en haut, et la signature manuscrite de la marque posée grand au milieu-bas, en couleur de marque. Le geste du restaurant Amicii : la photo parle, la marque signe.',
    slots: [sl('signature', 'le nom de la marque ou un mot manuscrit très court', 16), sl('sous', 'mention discrète sous la signature', 40)],
    nodes: [
      P(0, 0, 1, 1, { dark: 8 }),
      rail('white'),
      T('signature', 0.12, 0.6, 0.76, 0.17, 'brand', { font: 'script', align: 'center', maxLines: 1, shadow: true }),
      T('sous', 0.18, 0.79, 0.64, 0.028, 'white', { font: 'body', align: 'center', upper: true, track: 0.2, maxLines: 1, role: 'sous-titre' }),
    ],
  },
  {
    id: 'ds-mot-corrige', name: 'Le mot corrigé', family: 'photo-editorial',
    vibe: ['audacieux', 'editorial'], intents: ['accroche', 'conseil'],
    photo: 'required',
    desc: 'Gros titre en capitales sur la photo, dont UN mot est barré et remplacé par sa correction manuscrite en couleur d’accent, posée par-dessus et légèrement inclinée. Le geste éditorial le plus repris aujourd’hui : il transforme une phrase en prise de position.',
    slots: [sl('avant', 'début de la phrase, en capitales', 34), sl('barre', 'LE mot qu’on rature', 14), sl('corrige', 'le mot manuscrit qui le remplace', 14), sl('apres', 'fin de la phrase', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 26 }),
      R(0, 0.35, 1, 0.65, 'black', { scrim: 'bottom', opacity: 55 }),
      T('avant', 0.08, 0.46, 0.84, 0.09, 'white', { upper: true, lh: 0.96, maxLines: 2, weight: 'bold' }),
      T('barre', 0.08, 0.63, 0.6, 0.09, 'white', { upper: true, maxLines: 1, weight: 'bold', strike: true, opacity: 70 }),
      T('corrige', 0.26, 0.608, 0.6, 0.105, 'accentLight', { font: 'script', maxLines: 1, rotation: -6 }),
      T('apres', 0.08, 0.76, 0.84, 0.09, 'white', { upper: true, lh: 0.96, maxLines: 1, weight: 'bold' }),
    ],
  },
  {
    id: 'ds-serif-grotesque', name: 'Serif + grotesque', family: 'photo-editorial',
    vibe: ['editorial', 'sobre'], intents: ['accroche', 'conseil', 'citation'],
    photo: 'required',
    desc: 'Une phrase dont un mot passe en grotesque très gras et le reste en serif italique. Le contraste de deux familles dans la même phrase donne l’air d’un magazine, pas d’une légende.',
    slots: [sl('debut', 'premier mot ou deux, en serif italique', 18), sl('pivot', 'LE mot qui frappe, en capitales grasses', 14), sl('suite', 'la suite de la phrase, en serif italique', 64), sl('pied', 'ligne de pied, invitation ou précision', 40)],
    nodes: [
      P(0, 0, 1, 1, { dark: 30 }),
      T('debut', 0.08, 0.34, 0.5, 0.075, 'white', { font: 'serif', italic: true, maxLines: 1 }),
      T('pivot', 0.08, 0.4, 0.84, 0.19, 'accentLight', { font: 'condensed', upper: true, lh: 0.9, maxLines: 1 }),
      T('suite', 0.08, 0.6, 0.8, 0.055, 'white', { font: 'serif', italic: true, lh: 1.15, maxLines: 3, role: 'sous-titre' }),
      T('pied', 0.08, 0.9, 0.6, 0.026, 'white', { font: 'body', maxLines: 1, opacity: 74 }),
    ],
  },
  {
    id: 'ds-cadre-inset', name: 'Photo encadrée', family: 'photo-editorial',
    vibe: ['minimal', 'luxe'], intents: ['produit', 'accroche', 'annonce'],
    sectors: ['Mode', 'Beauté', 'Retail'],
    photo: 'required',
    desc: 'Fond de couleur claire, photo posée en retrait avec une vraie marge autour, titre dans la marge basse. Le vide fait le luxe : c’est la composition la plus calme de la bibliothèque.',
    slots: [sl('kicker', 'catégorie en capitales', 20), sl('titre', 'titre court', 34), sl('sous', 'précision courte', 48)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      P(0.08, 0.08, 0.84, 0.56, { radius: 0.01 }),
      T('kicker', 0.08, 0.69, 0.5, 0.024, 'brand', { upper: true, track: 0.28, maxLines: 1, role: 'tag' }),
      T('titre', 0.08, 0.735, 0.84, 0.085, 'ink', { font: 'serif', lh: 1.05, maxLines: 2, role: 'titre' }),
      T('sous', 0.08, 0.88, 0.7, 0.028, 'ink', { font: 'body', maxLines: 2, role: 'sous-titre', opacity: 72 }),
    ],
  },
  {
    id: 'ds-arche', name: 'Photo en disque', family: 'photo-editorial',
    vibe: ['chaleureux', 'luxe'], intents: ['produit', 'accroche', 'coulisses'],
    sectors: ['Beauté', 'Café', 'Restaurant', 'Mode'],
    photo: 'required',
    desc: 'La photo est détourée en disque sur un aplat de couleur, titre en serif dessous. Une forme, un fond, une typo : la mise en page la plus douce de la bibliothèque.',
    slots: [sl('titre', 'titre court', 30), sl('sous', 'précision', 54)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      P(0.14, 0.09, 0.72, 0.58, { radius: 0.36 }),
      T('titre', 0.1, 0.73, 0.8, 0.085, 'onBrand', { font: 'serif', align: 'center', lh: 1.05, maxLines: 2, role: 'titre' }),
      T('sous', 0.16, 0.87, 0.68, 0.027, 'onBrand', { font: 'body', align: 'center', upper: true, track: 0.18, maxLines: 2, role: 'sous-titre', opacity: 78 }),
    ],
  },
  {
    id: 'ds-polaroid', name: 'Polaroid incliné', family: 'photo-editorial',
    vibe: ['chaleureux', 'retro', 'ludique'], intents: ['coulisses', 'accroche', 'preuve'],
    photo: 'required',
    desc: 'La photo dans un cadre blanc légèrement incliné sur un aplat de couleur, avec une légende manuscrite. Effet album, très humain — l’inverse du visuel corporate.',
    slots: [sl('legende', 'légende manuscrite, quelques mots', 26), sl('sous', 'précision discrète', 44)],
    nodes: [
      R(0, 0, 1, 1, 'accent'),
      R(0.12, 0.11, 0.76, 0.64, 'white', { rotation: -3 }),
      P(0.15, 0.135, 0.7, 0.52, { rotation: -3 }),
      T('legende', 0.12, 0.79, 0.76, 0.085, 'onAccent', { font: 'script', align: 'center', maxLines: 2 }),
      T('sous', 0.16, 0.92, 0.68, 0.024, 'onAccent', { font: 'body', align: 'center', upper: true, track: 0.2, maxLines: 1 }),
    ],
  },
  {
    id: 'ds-legende-filet', name: 'Légende au filet', family: 'photo-editorial',
    vibe: ['minimal', 'sobre'], intents: ['coulisses', 'produit', 'accroche'],
    photo: 'required',
    desc: 'Photo plein cadre laissée intacte, un simple filet d’accent et deux lignes discrètes en bas à gauche. Quand la photo est très belle, on ne l’écrase pas.',
    slots: [sl('titre', 'titre court', 32), sl('sous', 'précision', 52)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      R(0, 0.62, 1, 0.38, 'black', { scrim: 'bottom', opacity: 58 }),
      R(0.08, 0.815, 0.09, 0.005, 'accentLight'),
      T('titre', 0.08, 0.845, 0.7, 0.05, 'white', { maxLines: 2, role: 'titre', weight: 'bold' }),
      T('sous', 0.08, 0.925, 0.66, 0.025, 'white', { font: 'body', maxLines: 1, role: 'sous-titre', opacity: 80 }),
    ],
  },
  {
    id: 'ds-badge-coin', name: 'Badge d’angle', family: 'photo-editorial',
    vibe: ['audacieux', 'ludique'], intents: ['offre', 'annonce', 'produit'],
    sectors: ['Retail', 'Restaurant', 'Mode', 'Sport'],
    photo: 'required',
    desc: 'Photo plein cadre avec une pastille d’accent en haut à droite (nouveauté, remise, date) et le titre en bas. La pastille attire l’œil avant même la lecture.',
    slots: [sl('badge', 'mention de la pastille, 2 mots maxi', 14), sl('titre', 'titre', 38), sl('cta', 'appel à l’action', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 14 }),
      R(0, 0.55, 1, 0.45, 'black', { scrim: 'bottom', opacity: 66 }),
      S('circle', 0.62, 0.055, 0.3, 0.225, 'accent', { rotation: -8 }),
      T('badge', 0.63, 0.135, 0.28, 0.05, 'onAccent', { align: 'center', upper: true, lh: 0.95, maxLines: 2, rotation: -8, weight: 'bold' }),
      T('titre', 0.08, 0.755, 0.84, 0.105, 'white', { upper: true, lh: 0.95, maxLines: 2, role: 'titre', weight: 'bold' }),
      T('cta', 0.08, 0.905, 0.7, 0.028, 'accentLight', { font: 'body', upper: true, track: 0.14, maxLines: 1, role: 'cta' }),
    ],
  },
  {
    id: 'ds-hero-serif', name: 'Hero serif', family: 'photo-editorial',
    vibe: ['luxe', 'editorial'], intents: ['accroche', 'citation'],
    photo: 'required',
    desc: 'Un titre en serif, en bas de casse, très grand et centré sur la photo, encadré de deux filets fins. Élégant, calme, adulte — l’opposé du visuel qui crie.',
    slots: [sl('titre', 'titre en bas de casse, court', 34), sl('sous', 'mention en capitales espacées', 34)],
    nodes: [
      P(0, 0, 1, 1, { dark: 34 }),
      R(0.34, 0.355, 0.32, 0.0035, 'white', { opacity: 60 }),
      T('titre', 0.1, 0.4, 0.8, 0.125, 'white', { font: 'serif', align: 'center', lh: 1.02, maxLines: 2, role: 'titre' }),
      T('sous', 0.18, 0.6, 0.64, 0.024, 'white', { font: 'body', align: 'center', upper: true, track: 0.32, maxLines: 1, role: 'sous-titre', opacity: 82 }),
      R(0.34, 0.66, 0.32, 0.0035, 'white', { opacity: 60 }),
    ],
  },
  {
    id: 'ds-citation-photo', name: 'Citation sur photo', family: 'citation',
    vibe: ['editorial', 'chaleureux'], intents: ['citation', 'preuve'],
    photo: 'required',
    desc: 'Un guillemet géant en couleur d’accent, la citation en serif italique par-dessus la photo assombrie, l’attribution en dessous. Le format « avis client » qui ne fait pas publicité.',
    slots: [sl('citation', 'la citation, une à deux phrases', 130), sl('auteur', 'qui parle', 34)],
    nodes: [
      P(0, 0, 1, 1, { dark: 46 }),
      F('“', 0.08, 0.14, 0.4, 0.28, 'accentLight', { maxLines: 1, font: 'serif' }),
      T('citation', 0.1, 0.36, 0.8, 0.058, 'white', { font: 'serif', italic: true, lh: 1.25, maxLines: 4, role: 'corps' }),
      R(0.1, 0.74, 0.08, 0.004, 'accentLight'),
      T('auteur', 0.1, 0.775, 0.7, 0.026, 'white', { font: 'body', upper: true, track: 0.16, maxLines: 1, role: 'sous-titre', opacity: 82 }),
    ],
  },
  {
    id: 'ds-diagonale', name: 'Bandeau oblique', family: 'photo-editorial',
    vibe: ['audacieux', 'ludique'], intents: ['offre', 'evenement', 'annonce'],
    sectors: ['Sport', 'Retail', 'Restaurant'],
    photo: 'required',
    desc: 'Un bandeau d’accent traverse la photo en oblique avec le message dedans. Le mouvement de la diagonale donne de l’urgence : promo, événement, annonce.',
    slots: [sl('titre', 'le message du bandeau, très court', 24), sl('sous', 'la précision, sous le bandeau', 50)],
    nodes: [
      P(0, 0, 1, 1, { dark: 18 }),
      R(-0.1, 0.42, 1.2, 0.16, 'accent', { rotation: -8 }),
      T('titre', 0.0, 0.462, 1.0, 0.075, 'onAccent', { align: 'center', upper: true, maxLines: 1, rotation: -8, weight: 'bold' }),
      R(0, 0.68, 1, 0.32, 'black', { scrim: 'bottom', opacity: 62 }),
      T('sous', 0.1, 0.86, 0.8, 0.034, 'white', { font: 'body', align: 'center', maxLines: 2, role: 'sous-titre' }),
    ],
  },
  {
    id: 'ds-couverture', name: 'Une de magazine', family: 'photo-editorial',
    vibe: ['editorial', 'luxe'], intents: ['accroche', 'annonce', 'coulisses'],
    photo: 'required',
    desc: 'Le nom de la marque en très grand tout en haut comme un titre de magazine, la photo dessous, et deux accroches courtes. Donne immédiatement un statut de publication.',
    slots: [sl('accroche1', 'première accroche', 40), sl('accroche2', 'seconde accroche', 40)],
    nodes: [
      P(0, 0, 1, 1, { dark: 20 }),
      F('{{marque}}', 0.05, 0.045, 0.9, 0.135, 'white', { font: 'condensed', align: 'center', upper: true, maxLines: 1, track: -0.01 }),
      R(0, 0.62, 1, 0.38, 'black', { scrim: 'bottom', opacity: 60 }),
      R(0.08, 0.755, 0.055, 0.004, 'accentLight'),
      T('accroche1', 0.08, 0.78, 0.62, 0.038, 'white', { maxLines: 2, role: 'sous-titre', weight: 'bold' }),
      R(0.08, 0.868, 0.055, 0.004, 'accentLight'),
      T('accroche2', 0.08, 0.893, 0.62, 0.038, 'white', { maxLines: 2, role: 'sous-titre', weight: 'bold' }),
    ],
  },
  {
    id: 'ds-mot-evide', name: 'Mot évidé', family: 'photo-editorial',
    vibe: ['audacieux', 'tech'], intents: ['accroche', 'annonce'],
    photo: 'required',
    desc: 'Un seul mot, énorme, en lettres évidées par-dessus la photo, avec une ligne de contexte dessous. Le mot devient une forme, pas une légende.',
    slots: [sl('mot', 'LE mot, un seul', 12), sl('sous', 'la phrase de contexte', 62)],
    nodes: [
      P(0, 0, 1, 1, { dark: 24 }),
      T('mot', 0.04, 0.3, 0.92, 0.26, 'white', { font: 'condensed', align: 'center', upper: true, maxLines: 1, hollow: true, strokeCol: 'white', strokeW: 0.004 }),
      T('sous', 0.12, 0.63, 0.76, 0.036, 'white', { font: 'body', align: 'center', lh: 1.3, maxLines: 2, role: 'sous-titre' }),
      ...footer('white'),
    ],
  },
  {
    id: 'ds-etiquettes', name: 'Étiquettes éparpillées', family: 'photo-editorial',
    vibe: ['ludique', 'audacieux'], intents: ['produit', 'offre', 'liste'],
    sectors: ['Retail', 'Restaurant', 'Café', 'Sport'],
    photo: 'required',
    desc: 'Trois pastilles de couleur inclinées se posent autour du sujet, comme des stickers, avec un mot chacune. Le langage des marques jeunes : ça bouge, ça se lit en une seconde.',
    slots: [sl('titre', 'titre principal', 26), sl('tag1', 'argument 1, très court', 16), sl('tag2', 'argument 2, très court', 16), sl('tag3', 'argument 3, très court', 16)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      T('titre', 0.06, 0.075, 0.88, 0.14, 'white', { font: 'condensed', upper: true, lh: 0.9, maxLines: 2, role: 'titre', shadow: true }),
      S('pill', 0.06, 0.42, 0.42, 0.075, 'accent', { rotation: -6 }),
      T('tag1', 0.06, 0.4425, 0.42, 0.032, 'onAccent', { align: 'center', upper: true, maxLines: 1, rotation: -6, weight: 'bold' }),
      S('pill', 0.48, 0.56, 0.44, 0.075, 'brand', { rotation: 5 }),
      T('tag2', 0.48, 0.5825, 0.44, 0.032, 'onBrand', { align: 'center', upper: true, maxLines: 1, rotation: 5, weight: 'bold' }),
      S('pill', 0.14, 0.71, 0.44, 0.075, 'white', { rotation: -3 }),
      T('tag3', 0.14, 0.7325, 0.44, 0.032, 'ink', { align: 'center', upper: true, maxLines: 1, rotation: -3, weight: 'bold' }),
    ],
  },

  // ══ B. APLATS TYPOGRAPHIQUES (sans photo) ═════════════════════════════════
  {
    id: 'ds-question-serif', name: 'La question', family: 'aplat-typo',
    vibe: ['sobre', 'editorial'], intents: ['accroche', 'conseil'],
    photo: 'none',
    desc: 'Fond clair, une question posée en serif, très grande, et la réponse annoncée en petit dessous. Ouvre une conversation au lieu d’affirmer.',
    slots: [sl('question', 'la question, courte', 64), sl('reponse', 'l’amorce de réponse', 56)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      S('circle', 0.08, 0.12, 0.055, 0.041, 'accentDeep'),
      T('question', 0.08, 0.24, 0.8, 0.095, 'ink', { font: 'serif', lh: 1.08, maxLines: 4, role: 'titre' }),
      R(0.08, 0.72, 0.12, 0.004, 'accentDeep'),
      T('reponse', 0.08, 0.755, 0.72, 0.032, 'ink', { font: 'body', lh: 1.4, maxLines: 3, role: 'sous-titre', opacity: 70 }),
      F('{{handle}}', 0.08, 0.93, 0.5, 0.022, 'ink', { font: 'body', maxLines: 1, opacity: 45 }),
    ],
  },
  {
    id: 'ds-liste-conseils', name: 'Trois conseils', family: 'liste',
    vibe: ['tech', 'sobre'], intents: ['conseil', 'liste'],
    photo: 'none',
    desc: 'Fond sombre, un titre, puis trois conseils numérotés dans des pastilles. Le format « à enregistrer » par excellence, celui qui fait les partages.',
    slots: [sl('titre', 'le titre de la liste', 42), sl('item1', 'conseil 1', 54), sl('item2', 'conseil 2', 54), sl('item3', 'conseil 3', 54)],
    nodes: [
      R(0, 0, 1, 1, 'ink'),
      T('titre', 0.08, 0.1, 0.84, 0.085, 'white', { upper: true, lh: 0.98, maxLines: 2, role: 'titre', weight: 'bold' }),
      R(0.08, 0.265, 0.1, 0.005, 'accentLight'),
      F('01', 0.08, 0.335, 0.12, 0.05, 'accentLight', { font: 'condensed', maxLines: 1 }),
      T('item1', 0.22, 0.335, 0.7, 0.042, 'white', { font: 'body', lh: 1.25, maxLines: 2, role: 'sous-titre' }),
      F('02', 0.08, 0.5, 0.12, 0.05, 'accentLight', { font: 'condensed', maxLines: 1 }),
      T('item2', 0.22, 0.5, 0.7, 0.042, 'white', { font: 'body', lh: 1.25, maxLines: 2, role: 'sous-titre' }),
      F('03', 0.08, 0.665, 0.12, 0.05, 'accentLight', { font: 'condensed', maxLines: 1 }),
      T('item3', 0.22, 0.665, 0.7, 0.042, 'white', { font: 'body', lh: 1.25, maxLines: 2, role: 'sous-titre' }),
      ...footer('white'),
    ],
  },
  {
    id: 'ds-checklist', name: 'Checklist', family: 'liste',
    vibe: ['sobre', 'chaleureux'], intents: ['conseil', 'liste', 'preuve'],
    photo: 'none',
    desc: 'Une liste à cocher sur fond clair, chaque ligne précédée d’une coche de couleur. Rassure et se lit en diagonale.',
    slots: [sl('titre', 'le titre de la liste', 44), sl('item1', 'point 1', 46), sl('item2', 'point 2', 46), sl('item3', 'point 3', 46), sl('item4', 'point 4', 46)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      R(0, 0, 1, 0.2, 'brand'),
      T('titre', 0.08, 0.065, 0.84, 0.058, 'onBrand', { upper: true, lh: 1, maxLines: 2, role: 'titre', weight: 'bold' }),
      F('✓', 0.08, 0.29, 0.08, 0.05, 'accentDeep', { maxLines: 1 }),
      T('item1', 0.19, 0.295, 0.74, 0.04, 'ink', { font: 'body', maxLines: 1, role: 'sous-titre' }),
      F('✓', 0.08, 0.42, 0.08, 0.05, 'accentDeep', { maxLines: 1 }),
      T('item2', 0.19, 0.425, 0.74, 0.04, 'ink', { font: 'body', maxLines: 1, role: 'sous-titre' }),
      F('✓', 0.08, 0.55, 0.08, 0.05, 'accentDeep', { maxLines: 1 }),
      T('item3', 0.19, 0.555, 0.74, 0.04, 'ink', { font: 'body', maxLines: 1, role: 'sous-titre' }),
      F('✓', 0.08, 0.68, 0.08, 0.05, 'accentDeep', { maxLines: 1 }),
      T('item4', 0.19, 0.685, 0.74, 0.04, 'ink', { font: 'body', maxLines: 1, role: 'sous-titre' }),
      R(0.08, 0.85, 0.84, 0.004, 'ink', { opacity: 15 }),
      F('{{marque}}', 0.08, 0.885, 0.84, 0.024, 'ink', { font: 'body', upper: true, track: 0.28, maxLines: 1, opacity: 55 }),
    ],
  },
  {
    id: 'ds-stat-geante', name: 'Statistique', family: 'preuve',
    vibe: ['tech', 'audacieux'], intents: ['preuve', 'annonce'],
    photo: 'none',
    desc: 'Un chiffre qui prend la moitié de la page, ce qu’il signifie en dessous, la source en pied. Une preuve chiffrée vaut dix arguments.',
    slots: [sl('chiffre', 'le chiffre, avec son signe (%, +, €)', 8), sl('titre', 'ce que mesure ce chiffre', 60), sl('source', 'la source ou la période', 40)],
    nodes: [
      R(0, 0, 1, 1, 'ink'),
      S('circle', 0.52, 0.06, 0.52, 0.39, 'brand', { opacity: 26 }),
      T('chiffre', 0.07, 0.16, 0.86, 0.33, 'accentLight', { font: 'condensed', lh: 0.85, maxLines: 1 }),
      R(0.07, 0.56, 0.16, 0.006, 'accentLight'),
      T('titre', 0.07, 0.6, 0.8, 0.055, 'white', { lh: 1.15, maxLines: 3, role: 'titre', weight: 'bold' }),
      T('source', 0.07, 0.88, 0.7, 0.023, 'white', { font: 'body', upper: true, track: 0.16, maxLines: 1, opacity: 55 }),
    ],
  },
  {
    id: 'ds-carte-citation', name: 'Carte citation', family: 'citation',
    vibe: ['luxe', 'sobre'], intents: ['citation', 'preuve'],
    photo: 'none',
    desc: 'Une carte claire posée sur un aplat de marque, la citation en serif italique et un guillemet géant en filigrane. Sobre, imprimable, intemporel.',
    slots: [sl('citation', 'la citation', 140), sl('auteur', 'l’auteur', 32), sl('role', 'sa fonction', 34)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      R(0.07, 0.1, 0.86, 0.8, 'paper', { radius: 0.02 }),
      F('“', 0.11, 0.13, 0.4, 0.22, 'accentDeep', { font: 'serif', maxLines: 1, opacity: 45 }),
      T('citation', 0.13, 0.33, 0.74, 0.055, 'ink', { font: 'serif', italic: true, lh: 1.3, maxLines: 5, role: 'corps' }),
      R(0.13, 0.72, 0.08, 0.004, 'accentDeep'),
      T('auteur', 0.13, 0.75, 0.7, 0.032, 'ink', { maxLines: 1, role: 'sous-titre', weight: 'bold' }),
      T('role', 0.13, 0.805, 0.7, 0.024, 'ink', { font: 'body', upper: true, track: 0.14, maxLines: 1, opacity: 60 }),
    ],
  },
  {
    id: 'ds-comparatif', name: 'Ceci, pas cela', family: 'liste',
    vibe: ['tech', 'audacieux'], intents: ['conseil', 'preuve'],
    photo: 'none',
    desc: 'Deux colonnes face à face : ce qui ne marche pas, ce qui marche. La croix et la coche font tout le travail de démonstration.',
    slots: [sl('titre', 'le titre du comparatif', 40), sl('mauvais1', 'à éviter 1', 32), sl('mauvais2', 'à éviter 2', 32), sl('bon1', 'à faire 1', 32), sl('bon2', 'à faire 2', 32)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      T('titre', 0.07, 0.08, 0.86, 0.065, 'ink', { upper: true, align: 'center', lh: 1, maxLines: 2, role: 'titre', weight: 'bold' }),
      R(0.07, 0.24, 0.4, 0.54, 'ink', { radius: 0.02 }),
      F('✕', 0.1, 0.275, 0.1, 0.055, 'accentLight', { maxLines: 1 }),
      T('mauvais1', 0.1, 0.38, 0.34, 0.033, 'white', { font: 'body', lh: 1.25, maxLines: 3 }),
      T('mauvais2', 0.1, 0.56, 0.34, 0.033, 'white', { font: 'body', lh: 1.25, maxLines: 3 }),
      R(0.53, 0.24, 0.4, 0.54, 'brand', { radius: 0.02 }),
      F('✓', 0.56, 0.275, 0.1, 0.055, 'onBrand', { maxLines: 1 }),
      T('bon1', 0.56, 0.38, 0.34, 0.033, 'onBrand', { font: 'body', lh: 1.25, maxLines: 3 }),
      T('bon2', 0.56, 0.56, 0.34, 0.033, 'onBrand', { font: 'body', lh: 1.25, maxLines: 3 }),
      F('{{marque}}', 0.07, 0.88, 0.86, 0.024, 'ink', { font: 'body', align: 'center', upper: true, track: 0.26, maxLines: 1, opacity: 50 }),
    ],
  },
  {
    id: 'ds-offre-prix', name: 'Offre chiffrée', family: 'offre',
    vibe: ['audacieux', 'sobre'], intents: ['offre', 'produit'],
    sectors: ['Retail', 'Restaurant', 'Sport', 'Beauté'],
    photo: 'optional',
    desc: 'Une offre présentée comme une carte de prix : intitulé, prix en très gros, trois avantages, bouton. Le format qui fait passer à l’acte.',
    slots: [sl('titre', 'l’intitulé de l’offre', 34), sl('prix', 'le prix', 10), sl('detail', 'ce que le prix comprend', 40), sl('a1', 'avantage 1', 34), sl('a2', 'avantage 2', 34), sl('cta', 'bouton', 22)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      T('titre', 0.08, 0.1, 0.84, 0.055, 'onBrand', { upper: true, align: 'center', track: 0.1, maxLines: 2, role: 'titre', weight: 'bold' }),
      T('prix', 0.08, 0.21, 0.84, 0.24, 'accentOnBrand', { font: 'condensed', align: 'center', lh: 0.9, maxLines: 1 }),
      T('detail', 0.14, 0.45, 0.72, 0.026, 'onBrand', { font: 'body', align: 'center', upper: true, track: 0.16, maxLines: 1, opacity: 78 }),
      R(0.14, 0.55, 0.72, 0.004, 'onBrand', { opacity: 25 }),
      T('a1', 0.14, 0.6, 0.72, 0.032, 'onBrand', { font: 'body', align: 'center', maxLines: 1 }),
      T('a2', 0.14, 0.67, 0.72, 0.032, 'onBrand', { font: 'body', align: 'center', maxLines: 1 }),
      S('pill', 0.22, 0.79, 0.56, 0.075, 'accent'),
      T('cta', 0.22, 0.8125, 0.56, 0.032, 'onAccent', { align: 'center', upper: true, track: 0.1, maxLines: 1, role: 'cta', weight: 'bold' }),
    ],
  },
  {
    id: 'ds-evenement', name: 'Carton d’invitation', family: 'evenement',
    vibe: ['luxe', 'editorial'], intents: ['evenement', 'annonce'],
    sectors: ['Restaurant', 'Café', 'Mode', 'Autre'],
    photo: 'optional',
    desc: 'La date en très grand, le nom de l’événement, le lieu et l’heure en capitales espacées. Structure de carton d’invitation, immédiatement lisible.',
    slots: [sl('date', 'la date, format court', 14), sl('titre', 'le nom de l’événement', 34), sl('lieu', 'le lieu', 34), sl('heure', 'l’heure', 16)],
    nodes: [
      R(0, 0, 1, 1, 'ink'),
      R(0.06, 0.06, 0.88, 0.88, 'ink', { stroke: 'accentLight', strokeW: 0.003 }),
      F('{{marque}}', 0.1, 0.12, 0.8, 0.022, 'white', { font: 'body', align: 'center', upper: true, track: 0.32, maxLines: 1, opacity: 60 }),
      T('date', 0.1, 0.22, 0.8, 0.19, 'accentLight', { font: 'condensed', align: 'center', upper: true, lh: 0.9, maxLines: 1 }),
      T('titre', 0.1, 0.45, 0.8, 0.075, 'white', { font: 'serif', align: 'center', lh: 1.1, maxLines: 2, role: 'titre' }),
      R(0.44, 0.62, 0.12, 0.003, 'accentLight'),
      T('lieu', 0.1, 0.67, 0.8, 0.028, 'white', { font: 'body', align: 'center', upper: true, track: 0.22, maxLines: 1, role: 'sous-titre' }),
      T('heure', 0.1, 0.74, 0.8, 0.028, 'white', { font: 'body', align: 'center', upper: true, track: 0.22, maxLines: 1, opacity: 70 }),
    ],
  },
  {
    id: 'ds-menu', name: 'Ardoise', family: 'menu',
    vibe: ['chaleureux', 'retro'], intents: ['menu', 'produit', 'offre'],
    sectors: ['Restaurant', 'Café'],
    photo: 'none',
    desc: 'Une ardoise : titre manuscrit en haut, puis les lignes du menu avec leur prix aligné à droite. Le visuel que tout restaurant publie, enfin bien dessiné.',
    slots: [sl('titre', 'titre manuscrit (Menu, Carte, Du jour…)', 18), sl('l1', 'plat 1', 34), sl('p1', 'prix 1', 8), sl('l2', 'plat 2', 34), sl('p2', 'prix 2', 8), sl('l3', 'plat 3', 34), sl('p3', 'prix 3', 8)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      T('titre', 0.1, 0.09, 0.8, 0.16, 'accentOnBrand', { font: 'script', align: 'center', maxLines: 1 }),
      F('{{marque}}', 0.1, 0.28, 0.8, 0.022, 'onBrand', { font: 'body', align: 'center', upper: true, track: 0.34, maxLines: 1, opacity: 62 }),
      T('l1', 0.1, 0.4, 0.62, 0.038, 'onBrand', { font: 'body', maxLines: 1 }),
      T('p1', 0.74, 0.4, 0.16, 0.038, 'accentOnBrand', { align: 'right', maxLines: 1 }),
      R(0.1, 0.462, 0.8, 0.002, 'onBrand', { opacity: 22 }),
      T('l2', 0.1, 0.51, 0.62, 0.038, 'onBrand', { font: 'body', maxLines: 1 }),
      T('p2', 0.74, 0.51, 0.16, 0.038, 'accentOnBrand', { align: 'right', maxLines: 1 }),
      R(0.1, 0.572, 0.8, 0.002, 'onBrand', { opacity: 22 }),
      T('l3', 0.1, 0.62, 0.62, 0.038, 'onBrand', { font: 'body', maxLines: 1 }),
      T('p3', 0.74, 0.62, 0.16, 0.038, 'accentOnBrand', { align: 'right', maxLines: 1 }),
      R(0.1, 0.682, 0.8, 0.002, 'onBrand', { opacity: 22 }),
    ],
  },
  {
    id: 'ds-temoignage', name: 'Avis client', family: 'preuve',
    vibe: ['chaleureux', 'sobre'], intents: ['preuve', 'citation'],
    photo: 'optional',
    desc: 'Cinq étoiles, l’avis en grand, le prénom du client en pied. La preuve sociale sous sa forme la plus directe.',
    slots: [sl('avis', 'l’avis, tel qu’il a été écrit', 150), sl('client', 'prénom du client', 24), sl('detail', 'ce qu’il a pris / son contexte', 36)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      R(0, 0, 1, 0.014, 'accentDeep'),
      F('★★★★★', 0.08, 0.12, 0.84, 0.055, 'accentDeep', { maxLines: 1, track: 0.1 }),
      T('avis', 0.08, 0.24, 0.82, 0.062, 'ink', { lh: 1.25, maxLines: 5, role: 'corps' }),
      R(0.08, 0.74, 0.09, 0.005, 'ink', { opacity: 25 }),
      T('client', 0.08, 0.775, 0.7, 0.036, 'brand', { maxLines: 1, role: 'sous-titre', weight: 'bold' }),
      T('detail', 0.08, 0.835, 0.7, 0.024, 'ink', { font: 'body', upper: true, track: 0.14, maxLines: 1, opacity: 55 }),
      F('{{handle}}', 0.08, 0.93, 0.6, 0.022, 'ink', { font: 'body', maxLines: 1, opacity: 40 }),
    ],
  },
  {
    id: 'ds-etapes', name: 'Trois étapes', family: 'liste',
    vibe: ['tech', 'sobre'], intents: ['conseil', 'liste', 'produit'],
    photo: 'none',
    desc: 'Trois pastilles reliées par des flèches : la méthode en un coup d’œil. Pour expliquer un fonctionnement, un parcours, une recette.',
    slots: [sl('titre', 'ce qu’on explique', 40), sl('e1', 'étape 1', 26), sl('e2', 'étape 2', 26), sl('e3', 'étape 3', 26), sl('pied', 'la promesse finale', 50)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      T('titre', 0.08, 0.09, 0.84, 0.07, 'onBrand', { upper: true, lh: 1, maxLines: 2, role: 'titre', weight: 'bold' }),
      S('pill', 0.08, 0.3, 0.84, 0.09, 'paper'),
      T('e1', 0.12, 0.328, 0.76, 0.036, 'ink', { maxLines: 1, weight: 'bold' }),
      F('↓', 0.08, 0.405, 0.84, 0.04, 'accentOnBrand', { align: 'center', maxLines: 1 }),
      S('pill', 0.08, 0.47, 0.84, 0.09, 'paper'),
      T('e2', 0.12, 0.498, 0.76, 0.036, 'ink', { maxLines: 1, weight: 'bold' }),
      F('↓', 0.08, 0.575, 0.84, 0.04, 'accentOnBrand', { align: 'center', maxLines: 1 }),
      S('pill', 0.08, 0.64, 0.84, 0.09, 'accent'),
      T('e3', 0.12, 0.668, 0.76, 0.036, 'onAccent', { maxLines: 1, weight: 'bold' }),
      T('pied', 0.08, 0.82, 0.8, 0.03, 'onBrand', { font: 'body', lh: 1.3, maxLines: 2, role: 'sous-titre', opacity: 80 }),
    ],
  },
  {
    id: 'ds-surligne', name: 'Au marqueur', family: 'aplat-typo',
    vibe: ['ludique', 'audacieux'], intents: ['accroche', 'conseil'],
    photo: 'none',
    desc: 'Un texte dont chaque ligne est surlignée au marqueur, comme un passage annoté. Le geste rend une phrase plate immédiatement vivante.',
    slots: [sl('l1', 'ligne 1', 24), sl('l2', 'ligne 2, la plus importante', 24), sl('l3', 'ligne 3', 24), sl('sous', 'la précision en dessous', 60)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      T('l1', 0.08, 0.22, 0.84, 0.095, 'onAccent', { upper: true, maxLines: 1, weight: 'bold', hl: 'accent', hlRadius: 6, hlPad: 14 }),
      T('l2', 0.08, 0.36, 0.84, 0.095, 'white', { upper: true, maxLines: 1, weight: 'bold', hl: 'ink', hlRadius: 6, hlPad: 14 }),
      T('l3', 0.08, 0.5, 0.84, 0.095, 'onAccent', { upper: true, maxLines: 1, weight: 'bold', hl: 'accent', hlRadius: 6, hlPad: 14 }),
      T('sous', 0.08, 0.68, 0.74, 0.032, 'ink', { font: 'body', lh: 1.4, maxLines: 3, role: 'sous-titre', opacity: 72 }),
      F('{{handle}}', 0.08, 0.92, 0.6, 0.022, 'ink', { font: 'body', maxLines: 1, opacity: 40 }),
    ],
  },
  {
    id: 'ds-blocs-decales', name: 'Blocs décalés', family: 'aplat-typo',
    vibe: ['audacieux', 'tech'], intents: ['accroche', 'annonce'],
    photo: 'none',
    desc: 'Trois blocs de couleur décalés, chacun portant un morceau de la phrase. Composition d’affiche : le décroché fait le rythme.',
    slots: [sl('m1', 'morceau 1', 18), sl('m2', 'morceau 2', 18), sl('m3', 'morceau 3', 18), sl('pied', 'la précision', 54)],
    nodes: [
      R(0, 0, 1, 1, 'ink'),
      R(0.06, 0.16, 0.6, 0.13, 'brand'),
      T('m1', 0.09, 0.192, 0.54, 0.072, 'onBrand', { upper: true, maxLines: 1, weight: 'bold' }),
      R(0.2, 0.31, 0.7, 0.13, 'accent'),
      T('m2', 0.23, 0.342, 0.64, 0.072, 'onAccent', { upper: true, maxLines: 1, weight: 'bold' }),
      R(0.1, 0.46, 0.62, 0.13, 'paper'),
      T('m3', 0.13, 0.492, 0.56, 0.072, 'ink', { upper: true, maxLines: 1, weight: 'bold' }),
      T('pied', 0.06, 0.68, 0.76, 0.032, 'white', { font: 'body', lh: 1.35, maxLines: 3, role: 'sous-titre', opacity: 80 }),
      ...footer('white'),
    ],
  },
  {
    id: 'ds-mono-minimal', name: 'Presque rien', family: 'aplat-typo',
    vibe: ['minimal', 'luxe'], intents: ['annonce', 'accroche'],
    sectors: ['Mode', 'Beauté', 'Tech'],
    photo: 'none',
    desc: 'Un aplat, trois mots au centre, une mention minuscule en pied. Tout le reste est du vide — et le vide est le message.',
    slots: [sl('titre', 'trois mots maximum', 26), sl('pied', 'mention en pied', 34)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      T('titre', 0.14, 0.44, 0.72, 0.062, 'ink', { align: 'center', upper: true, track: 0.22, lh: 1.5, maxLines: 2, role: 'titre' }),
      R(0.47, 0.58, 0.06, 0.003, 'accentDeep'),
      T('pied', 0.2, 0.9, 0.6, 0.02, 'ink', { font: 'body', align: 'center', upper: true, track: 0.3, maxLines: 1, opacity: 45 }),
    ],
  },
  {
    id: 'ds-note', name: 'Note d’écran', family: 'carte-ui',
    vibe: ['minimal', 'ludique'], intents: ['conseil', 'accroche', 'citation'],
    photo: 'optional',
    desc: 'Une carte blanche façon application de notes, avec sa barre d’en-tête et un texte manuscrit dedans. Le format le plus partagé en story : il ne ressemble pas à une publicité.',
    slots: [sl('titre', 'le titre de la note', 34), sl('corps', 'le texte de la note, deux à quatre lignes', 170)],
    nodes: [
      R(0, 0, 1, 1, 'accent'),
      R(0.08, 0.16, 0.84, 0.66, 'white', { radius: 0.03 }),
      R(0.08, 0.16, 0.84, 0.075, 'paper', { radius: 0.03 }),
      F('•••', 0.11, 0.182, 0.2, 0.028, 'ink', { maxLines: 1, opacity: 35 }),
      T('titre', 0.12, 0.26, 0.76, 0.05, 'ink', { maxLines: 2, role: 'titre', weight: 'bold' }),
      R(0.12, 0.365, 0.76, 0.003, 'ink', { opacity: 12 }),
      T('corps', 0.12, 0.4, 0.76, 0.036, 'ink', { font: 'body', lh: 1.55, maxLines: 8, role: 'corps', opacity: 82 }),
      F('{{handle}}', 0.08, 0.88, 0.84, 0.026, 'onAccent', { font: 'body', align: 'center', maxLines: 1, opacity: 75 }),
    ],
  },
  {
    id: 'ds-recherche', name: 'Barre de recherche', family: 'carte-ui',
    vibe: ['tech', 'ludique'], intents: ['accroche', 'conseil'],
    sectors: ['Tech', 'Autre', 'Retail'],
    photo: 'optional',
    desc: 'Une fausse barre de recherche contenant la question que tout le monde tape, et la réponse en dessous. Capte l’attention parce que la question est déjà celle du lecteur.',
    slots: [sl('requete', 'la question tapée', 54), sl('titre', 'la réponse, en grand', 44), sl('sous', 'le développement', 80)],
    nodes: [
      R(0, 0, 1, 1, 'ink'),
      S('pill', 0.08, 0.16, 0.84, 0.085, 'white'),
      F('⌕', 0.11, 0.178, 0.08, 0.045, 'ink', { maxLines: 1, opacity: 45 }),
      T('requete', 0.18, 0.187, 0.7, 0.03, 'ink', { font: 'body', maxLines: 1, opacity: 70 }),
      T('titre', 0.08, 0.34, 0.84, 0.09, 'accentLight', { upper: true, lh: 0.98, maxLines: 3, role: 'titre', weight: 'bold' }),
      T('sous', 0.08, 0.65, 0.78, 0.032, 'white', { font: 'body', lh: 1.4, maxLines: 4, role: 'sous-titre', opacity: 80 }),
      ...footer('white'),
    ],
  },
  {
    id: 'ds-hook-carrousel', name: 'Accroche à faire défiler', family: 'aplat-typo',
    vibe: ['audacieux', 'tech'], intents: ['accroche', 'conseil'],
    photo: 'optional',
    desc: 'Une accroche énorme et, en bas à droite, l’invitation à faire défiler. Conçue pour être la première image d’une série.',
    slots: [sl('titre', 'l’accroche, la plus courte possible', 46), sl('sous', 'la promesse de ce qui suit', 60), sl('cta', 'l’invitation à faire défiler', 20)],
    nodes: [
      R(0, 0, 1, 1, 'accent'),
      T('titre', 0.07, 0.17, 0.86, 0.135, 'onAccent', { font: 'condensed', upper: true, lh: 0.88, maxLines: 3, role: 'titre' }),
      R(0.07, 0.62, 0.14, 0.006, 'onAccent'),
      T('sous', 0.07, 0.66, 0.74, 0.034, 'onAccent', { font: 'body', lh: 1.35, maxLines: 3, role: 'sous-titre', opacity: 82 }),
      S('pill', 0.55, 0.85, 0.38, 0.07, 'ink'),
      T('cta', 0.55, 0.8705, 0.38, 0.028, 'white', { align: 'center', upper: true, track: 0.1, maxLines: 1, role: 'cta' }),
    ],
  },
  {
    id: 'ds-echo', name: 'Écho', family: 'aplat-typo',
    vibe: ['retro', 'audacieux'], intents: ['annonce', 'accroche', 'evenement'],
    photo: 'optional',
    desc: 'Le mot principal répété en contour derrière lui-même, comme un écho imprimé. Effet d’affiche sérigraphiée, très graphique, sans aucune photo.',
    slots: [sl('mot', 'le mot, un seul', 14), sl('sous', 'la phrase de contexte', 64), sl('cta', 'la mention finale', 26)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      T('mot', 0.06, 0.24, 0.88, 0.19, 'accentOnBrand', { font: 'condensed', upper: true, maxLines: 1, hollow: true, strokeCol: 'accentOnBrand', strokeW: 0.003, opacity: 40 }),
      T('mot', 0.06, 0.3, 0.88, 0.19, 'onBrand', { font: 'condensed', upper: true, maxLines: 1 }),
      T('sous', 0.06, 0.56, 0.8, 0.034, 'onBrand', { font: 'body', lh: 1.35, maxLines: 3, role: 'sous-titre', opacity: 82 }),
      T('cta', 0.06, 0.88, 0.7, 0.026, 'accentOnBrand', { font: 'body', upper: true, track: 0.18, maxLines: 1, role: 'cta' }),
    ],
  },
  {
    id: 'ds-fleche-cta', name: 'Flèche', family: 'aplat-typo',
    vibe: ['ludique', 'tech'], intents: ['offre', 'annonce', 'conseil'],
    photo: 'optional',
    desc: 'Une affirmation, une grosse flèche de couleur, et l’action à faire. La flèche dirige littéralement l’œil vers le bouton.',
    slots: [sl('titre', 'l’affirmation', 56), sl('cta', 'l’action à faire', 26), sl('pied', 'la précision', 44)],
    nodes: [
      R(0, 0, 1, 1, 'ink'),
      T('titre', 0.08, 0.14, 0.8, 0.085, 'white', { lh: 1.08, maxLines: 3, role: 'titre', weight: 'bold' }),
      S('arrow', 0.14, 0.44, 0.5, 0.13, 'accent', { rotation: 12 }),
      S('pill', 0.12, 0.68, 0.66, 0.085, 'accent'),
      T('cta', 0.12, 0.7045, 0.66, 0.034, 'onAccent', { align: 'center', upper: true, track: 0.08, maxLines: 1, role: 'cta', weight: 'bold' }),
      T('pied', 0.08, 0.85, 0.7, 0.026, 'white', { font: 'body', maxLines: 2, opacity: 60 }),
    ],
  },
  {
    id: 'ds-horaires', name: 'Horaires', family: 'liste',
    vibe: ['sobre', 'chaleureux'], intents: ['annonce', 'menu'],
    sectors: ['Restaurant', 'Café', 'Retail', 'Beauté', 'Sport'],
    photo: 'optional',
    desc: 'Le tableau des horaires ou des créneaux, propre et centré, avec le nom de la marque en tête. Un des posts les plus consultés d’un commerce.',
    slots: [sl('titre', 'le titre (Horaires, Créneaux…)', 24), sl('j1', 'ligne 1', 30), sl('h1', 'horaire 1', 18), sl('j2', 'ligne 2', 30), sl('h2', 'horaire 2', 18), sl('j3', 'ligne 3', 30), sl('h3', 'horaire 3', 18)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      R(0, 0, 1, 0.16, 'brand'),
      F('{{marque}}', 0.08, 0.06, 0.84, 0.026, 'onBrand', { font: 'body', align: 'center', upper: true, track: 0.32, maxLines: 1 }),
      T('titre', 0.1, 0.24, 0.8, 0.075, 'ink', { align: 'center', upper: true, maxLines: 1, role: 'titre', weight: 'bold' }),
      T('j1', 0.12, 0.42, 0.44, 0.034, 'ink', { font: 'body', maxLines: 1 }),
      T('h1', 0.56, 0.42, 0.32, 0.034, 'brand', { align: 'right', maxLines: 1, weight: 'bold' }),
      R(0.12, 0.478, 0.76, 0.002, 'ink', { opacity: 14 }),
      T('j2', 0.12, 0.52, 0.44, 0.034, 'ink', { font: 'body', maxLines: 1 }),
      T('h2', 0.56, 0.52, 0.32, 0.034, 'brand', { align: 'right', maxLines: 1, weight: 'bold' }),
      R(0.12, 0.578, 0.76, 0.002, 'ink', { opacity: 14 }),
      T('j3', 0.12, 0.62, 0.44, 0.034, 'ink', { font: 'body', maxLines: 1 }),
      T('h3', 0.56, 0.62, 0.32, 0.034, 'brand', { align: 'right', maxLines: 1, weight: 'bold' }),
      R(0.12, 0.678, 0.76, 0.002, 'ink', { opacity: 14 }),
      S('pill', 0.3, 0.83, 0.4, 0.06, 'accent'),
      F('{{handle}}', 0.3, 0.8455, 0.4, 0.024, 'onAccent', { align: 'center', maxLines: 1 }),
    ],
  },
  {
    id: 'ds-faq', name: 'Question / réponse', family: 'liste',
    vibe: ['sobre', 'tech'], intents: ['conseil', 'preuve'],
    photo: 'optional',
    desc: 'Une question en accent, sa réponse en dessous, et la marque en pied. Le format qui traite une objection sans avoir l’air d’y répondre.',
    slots: [sl('question', 'la question, telle qu’on la pose vraiment', 70), sl('reponse', 'la réponse, franche', 170), sl('cta', 'la suite à donner', 34)],
    nodes: [
      R(0, 0, 1, 1, 'ink'),
      F('Q.', 0.08, 0.13, 0.12, 0.05, 'accentLight', { maxLines: 1 }),
      T('question', 0.08, 0.2, 0.82, 0.062, 'white', { lh: 1.12, maxLines: 3, role: 'titre', weight: 'bold' }),
      R(0.08, 0.44, 0.14, 0.005, 'accentLight'),
      F('R.', 0.08, 0.49, 0.12, 0.04, 'accentLight', { maxLines: 1 }),
      T('reponse', 0.08, 0.55, 0.8, 0.033, 'white', { font: 'body', lh: 1.45, maxLines: 6, role: 'corps', opacity: 84 }),
      T('cta', 0.08, 0.89, 0.7, 0.026, 'accentLight', { font: 'body', upper: true, track: 0.16, maxLines: 1, role: 'cta' }),
    ],
  },
  {
    id: 'ds-mots-cles', name: 'Nuage de mots', family: 'aplat-typo',
    vibe: ['ludique', 'audacieux'], intents: ['produit', 'liste', 'accroche'],
    photo: 'optional',
    desc: 'Quatre mots-clés empilés à des tailles différentes, un seul en couleur d’accent. Résume une offre sans faire de phrase.',
    slots: [sl('m1', 'mot 1', 16), sl('m2', 'mot 2', 16), sl('m3', 'mot 3, celui qu’on met en avant', 16), sl('m4', 'mot 4', 16), sl('pied', 'la phrase qui relie tout', 56)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      T('m1', 0.07, 0.12, 0.86, 0.1, 'onBrand', { font: 'condensed', upper: true, maxLines: 1, opacity: 55 }),
      T('m2', 0.07, 0.25, 0.86, 0.13, 'onBrand', { font: 'condensed', upper: true, maxLines: 1 }),
      T('m3', 0.07, 0.41, 0.86, 0.16, 'accentOnBrand', { font: 'condensed', upper: true, maxLines: 1 }),
      T('m4', 0.07, 0.6, 0.86, 0.1, 'onBrand', { font: 'condensed', upper: true, maxLines: 1, opacity: 55 }),
      R(0.07, 0.76, 0.16, 0.005, 'accentOnBrand'),
      T('pied', 0.07, 0.8, 0.78, 0.03, 'onBrand', { font: 'body', lh: 1.35, maxLines: 3, role: 'sous-titre', opacity: 80 }),
    ],
  },
  {
    id: 'ds-double-bande', name: 'Deux bandes', family: 'aplat-typo',
    vibe: ['audacieux', 'editorial'], intents: ['accroche', 'annonce'],
    photo: 'optional',
    desc: 'Deux bandes pleine largeur, l’une en marque, l’autre en accent, chacune portant une moitié de la phrase. Le décroché d’affiche le plus simple et le plus efficace.',
    slots: [sl('haut', 'première moitié', 26), sl('bas', 'seconde moitié', 26), sl('pied', 'la précision', 56)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      R(0, 0.26, 1, 0.17, 'brand'),
      T('haut', 0.07, 0.303, 0.86, 0.095, 'onBrand', { upper: true, maxLines: 1, weight: 'bold' }),
      R(0, 0.45, 1, 0.17, 'accent'),
      T('bas', 0.07, 0.493, 0.86, 0.095, 'onAccent', { upper: true, align: 'right', maxLines: 1, weight: 'bold' }),
      T('pied', 0.07, 0.7, 0.78, 0.032, 'ink', { font: 'body', lh: 1.4, maxLines: 3, role: 'sous-titre', opacity: 74 }),
      F('{{handle}}', 0.07, 0.92, 0.6, 0.022, 'ink', { font: 'body', maxLines: 1, opacity: 40 }),
    ],
  },
  {
    id: 'ds-grille-quatre', name: 'Grille de quatre', family: 'liste',
    vibe: ['tech', 'sobre'], intents: ['liste', 'produit', 'conseil'],
    photo: 'optional',
    desc: 'Quatre cases égales, chacune avec son intitulé. Pour une offre en quatre volets, quatre services, quatre erreurs à éviter.',
    slots: [sl('titre', 'le titre au-dessus de la grille', 40), sl('c1', 'case 1', 26), sl('c2', 'case 2', 26), sl('c3', 'case 3', 26), sl('c4', 'case 4', 26)],
    nodes: [
      R(0, 0, 1, 1, 'ink'),
      T('titre', 0.07, 0.09, 0.86, 0.062, 'white', { upper: true, lh: 1, maxLines: 2, role: 'titre', weight: 'bold' }),
      R(0.07, 0.24, 0.415, 0.26, 'brand', { radius: 0.02 }),
      T('c1', 0.1, 0.4, 0.355, 0.034, 'onBrand', { lh: 1.2, maxLines: 2, weight: 'bold' }),
      R(0.515, 0.24, 0.415, 0.26, 'paper', { radius: 0.02 }),
      T('c2', 0.545, 0.4, 0.355, 0.034, 'ink', { lh: 1.2, maxLines: 2, weight: 'bold' }),
      R(0.07, 0.52, 0.415, 0.26, 'paper', { radius: 0.02 }),
      T('c3', 0.1, 0.68, 0.355, 0.034, 'ink', { lh: 1.2, maxLines: 2, weight: 'bold' }),
      R(0.515, 0.52, 0.415, 0.26, 'accent', { radius: 0.02 }),
      T('c4', 0.545, 0.68, 0.355, 0.034, 'onAccent', { lh: 1.2, maxLines: 2, weight: 'bold' }),
      ...footer('white'),
    ],
  },
  {
    id: 'ds-manuscrit-plein', name: 'Manuscrit pleine page', family: 'aplat-typo',
    vibe: ['chaleureux', 'minimal'], intents: ['citation', 'accroche', 'coulisses'],
    sectors: ['Café', 'Beauté', 'Mode', 'Restaurant'],
    photo: 'optional',
    desc: 'Une phrase manuscrite qui occupe toute la page sur un fond doux, et une signature discrète. Intime, artisanal, très éloigné du visuel d’entreprise.',
    slots: [sl('phrase', 'la phrase manuscrite, courte', 46), sl('signature', 'la signature', 28)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      T('phrase', 0.1, 0.28, 0.8, 0.115, 'brand', { font: 'script', align: 'center', lh: 1.1, maxLines: 3, role: 'titre' }),
      R(0.42, 0.68, 0.16, 0.003, 'accentDeep'),
      T('signature', 0.15, 0.72, 0.7, 0.024, 'ink', { font: 'body', align: 'center', upper: true, track: 0.28, maxLines: 1, opacity: 60 }),
    ],
  },

  // ══ G. TIRÉES DES RÉFÉRENCES DU 26/08 ═════════════════════════════════════
  //
  // Vingt compositions relevées sur les 42 visuels déposés dans
  // `design-reference/inspiration/`. Elles ne rejouent aucune des 53 premières :
  // à chaque fois, c'est un GESTE qui n'existait pas dans la maison.
  //
  //  · le titre à deux calibres (un mot petit collé sur un mot énorme) ;
  //  · le mot qui déborde du cadre, jusqu'à sortir à gauche et à droite ;
  //  · le titre posé en diagonale le long du sujet ;
  //  · le texte-autocollant : un contour épais de papier autour des lettres ;
  //  · l'étiquette de couleur inclinée, collée derrière le titre ;
  //  · le tampon ovale posé de travers ;
  //  · les repères d'imprimeur en bordure ;
  //  · l'affiche de film : crédits minuscules, titre serif, sous-titre espacé ;
  //  · les mots en cartouches décalés en escalier ;
  //  · le chiffre géant AU MILIEU de la phrase ;
  //  · le mot serif italique géant entre deux petites lignes ;
  //  · la réplique : deux citations et une flèche entre elles ;
  //  · le post dans le post, barre d'icônes comprise ;
  //  · la rangée de pastilles rondes en tête ;
  //  · la liste en pilules décalées ;
  //  · le ticket promotionnel incliné.
  //
  // Deux d'entre elles ouvrent une famille : `sticker`, pour les compositions
  // faites d'éléments collés de travers. Sans famille à part, la répartition du
  // tirage les aurait noyées dans « photo éditoriale » alors que c'est un tout
  // autre langage.

  {
    id: 'ds-deux-calibres', name: 'Deux calibres', family: 'photo-editorial',
    vibe: ['audacieux', 'chaleureux'], intents: ['accroche', 'annonce', 'produit'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Un mot court posé juste au-dessus d’un mot énorme, tous deux centrés en haut, collés l’un à l’autre. Le contraste d’échelle fait tout le travail : c’est le titre le plus vu sur les comptes de restaurants et de boissons.',
    slots: [sl('petit', 'le mot d’appel, très court', 14), sl('gros', 'LE mot, un seul, court', 12), sl('sous', 'la mention de pied', 42)],
    nodes: [
      P(0, 0, 1, 1, { dark: 12 }),
      R(0, 0, 1, 0.5, 'black', { scrim: 'top', opacity: 42 }),
      T('petit', 0.1, 0.135, 0.8, 0.062, 'white', { font: 'condensed', align: 'center', upper: true, maxLines: 1, weight: 'bold', shadow: true }),
      T('gros', 0.03, 0.185, 0.94, 0.175, 'white', { font: 'condensed', align: 'center', upper: true, lh: 0.9, maxLines: 1, role: 'titre', weight: 'bold', shadow: true }),
      T('sous', 0.14, 0.9, 0.72, 0.026, 'white', { font: 'body', align: 'center', upper: true, track: 0.18, maxLines: 1, role: 'sous-titre', opacity: 88 }),
    ],
  },
  {
    id: 'ds-titre-oblique', name: 'Titre en diagonale', family: 'photo-editorial',
    vibe: ['ludique', 'audacieux'], intents: ['produit', 'accroche'],
    sectors: ['Retail', 'Café', 'Sport'],
    photo: 'required',
    desc: 'Le titre monte en diagonale le long du sujet, en capitales espacées. Le geste des marques de boisson : le texte suit l’objet au lieu de se poser dessus.',
    slots: [sl('titre', 'la phrase, courte, d’un seul tenant', 30), sl('sous', 'la mention de pied', 36)],
    nodes: [
      P(0, 0, 1, 1, { dark: 6 }),
      T('titre', 0.03, 0.42, 0.72, 0.056, 'white', { upper: true, track: 0.16, maxLines: 1, rotation: -32, role: 'titre', weight: 'bold', shadow: true }),
      rail('white'),
      T('sous', 0.08, 0.92, 0.62, 0.024, 'white', { font: 'body', upper: true, track: 0.18, maxLines: 1, opacity: 82 }),
    ],
  },
  {
    id: 'ds-affiche-cinema', name: 'Affiche de film', family: 'photo-editorial',
    vibe: ['editorial', 'luxe', 'retro'], intents: ['annonce', 'evenement', 'accroche'],
    sectors: ['Mode', 'Café', 'Autre'],
    photo: 'required',
    desc: 'Photo pleine assombrie du bas, ligne de crédits en capitales minuscules très espacées, gros titre serif juste dessous, et une mention finale espacée. Le code de l’affiche de cinéma, repris tel quel par les marques de voyage et de mode.',
    slots: [sl('credits', 'la ligne de crédits, courte', 54), sl('titre', 'le titre', 32), sl('sous', 'la mention finale', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      R(0, 0.5, 1, 0.5, 'black', { scrim: 'bottom', opacity: 62 }),
      T('credits', 0.1, 0.7, 0.8, 0.019, 'white', { font: 'body', align: 'center', upper: true, track: 0.24, lh: 1.6, maxLines: 2, opacity: 80 }),
      T('titre', 0.05, 0.765, 0.9, 0.115, 'white', { font: 'serif', align: 'center', lh: 0.98, maxLines: 2, role: 'titre' }),
      T('sous', 0.14, 0.92, 0.72, 0.021, 'white', { font: 'body', align: 'center', upper: true, track: 0.32, maxLines: 1, opacity: 88 }),
    ],
  },
  {
    id: 'ds-cadre-imprimeur', name: 'Repères d’imprimeur', family: 'photo-editorial',
    vibe: ['tech', 'audacieux', 'retro'], intents: ['annonce', 'evenement', 'produit'],
    sectors: ['Sport', 'Mode', 'Retail'],
    photo: 'required',
    desc: 'La photo posée dans une marge de papier, entourée de repères de calage et de petits carrés de contrôle, avec le nom de la marque répété en haut et en bas. Le langage des grandes marques de sport : ça ressemble à une planche d’imprimeur, pas à un post.',
    slots: [sl('titre', 'le titre', 34), sl('sous', 'la mention de pied', 34)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      P(0.075, 0.075, 0.85, 0.66, { radius: 0.004 }),
      rail('ink', 0.03),
      R(0.03, 0.028, 0.022, 0.0018, 'ink'), R(0.0395, 0.0215, 0.0025, 0.014, 'ink'),
      R(0.948, 0.028, 0.022, 0.0018, 'ink'), R(0.9575, 0.0215, 0.0025, 0.014, 'ink'),
      R(0.03, 0.962, 0.022, 0.0018, 'ink'), R(0.0395, 0.9555, 0.0025, 0.014, 'ink'),
      R(0.948, 0.962, 0.022, 0.0018, 'ink'), R(0.9575, 0.9555, 0.0025, 0.014, 'ink'),
      R(0.4, 0.049, 0.016, 0.008, 'ink'), R(0.425, 0.049, 0.016, 0.008, 'accentDeep'),
      R(0.45, 0.049, 0.016, 0.008, 'ink'), R(0.475, 0.049, 0.016, 0.008, 'brand'),
      T('titre', 0.075, 0.78, 0.85, 0.078, 'ink', { font: 'condensed', upper: true, lh: 0.95, maxLines: 2, role: 'titre', weight: 'bold' }),
      T('sous', 0.075, 0.915, 0.62, 0.022, 'ink', { font: 'body', upper: true, track: 0.16, maxLines: 1, opacity: 70 }),
    ],
  },
  {
    id: 'ds-manuscrit-coin', name: 'Mot manuscrit en coin', family: 'photo-editorial',
    vibe: ['chaleureux', 'minimal'], intents: ['produit', 'coulisses', 'accroche'],
    sectors: ['Café', 'Beauté', 'Restaurant', 'Mode'],
    photo: 'required',
    desc: 'La photo seule, et une phrase manuscrite posée de travers dans le coin haut. Rien d’autre. La retenue est le parti pris : la photo porte le visuel, l’écriture signe.',
    slots: [sl('mot', 'la phrase manuscrite, très courte', 24), sl('sous', 'la mention de pied', 32)],
    nodes: [
      P(0, 0, 1, 1, { dark: 6 }),
      T('mot', 0.06, 0.085, 0.56, 0.075, 'white', { font: 'script', lh: 1.05, maxLines: 2, rotation: -6, role: 'titre', shadow: true }),
      T('sous', 0.06, 0.9, 0.6, 0.024, 'white', { font: 'body', upper: true, track: 0.16, maxLines: 1, opacity: 82 }),
      ...footer('white'),
    ],
  },

  // ── Autocollants ────────────────────────────────────────────────────────
  {
    id: 'ds-texte-autocollant', name: 'Texte autocollant', family: 'sticker',
    vibe: ['audacieux', 'retro', 'ludique'], intents: ['accroche', 'citation', 'annonce'],
    sectors: ['Café', 'Retail', 'Sport', 'Restaurant'],
    photo: 'required',
    desc: 'La phrase en gros condensé de couleur, cernée d’un contour épais de papier qui épouse les lettres : un autocollant découpé, collé de travers sur la photo. Le geste le plus repris de l’année, et impossible à confondre avec du texte posé.',
    slots: [sl('titre', 'la phrase, en trois ou quatre mots par ligne', 58), sl('sous', 'la mention de pied', 40)],
    nodes: [
      // Photo bien assombrie : un autocollant se voit parce que son contour clair
      // TRANCHE. Sur une photo laissée claire, le contour se confond avec elle et
      // il ne reste qu'un bloc de texte sombre.
      P(0, 0, 1, 1, { dark: 24 }),
      // Le contour d'abord, en calque séparé : le rendu dessine le plein PUIS le
      // contour, donc un seul calque cerné effacerait ses propres lettres.
      // Contour épais : c'est LUI qui découpe l'autocollant. À dix pixels il
      // ressemblait à un liseré, et les lettres se noyaient dans la photo —
      // vu sur la charte au jaune sombre, où le plein est presque de la couleur
      // du fond. Le contour doit isoler, pas souligner.
      T('titre', 0.09, 0.28, 0.82, 0.105, 'paper', { font: 'condensed', align: 'center', upper: true, lh: 0.98, maxLines: 4, rotation: -2, hollow: true, strokeCol: 'paper', strokeW: 0.03 }),
      T('titre', 0.09, 0.28, 0.82, 0.105, 'accentDeep', { font: 'condensed', align: 'center', upper: true, lh: 0.98, maxLines: 4, rotation: -2, role: 'titre', weight: 'bold' }),
      T('sous', 0.12, 0.85, 0.76, 0.027, 'white', { font: 'body', align: 'center', maxLines: 2, role: 'sous-titre', shadow: true }),
    ],
  },
  {
    id: 'ds-etiquette-dechiree', name: 'Étiquette collée', family: 'sticker',
    vibe: ['ludique', 'chaleureux', 'retro'], intents: ['conseil', 'accroche', 'coulisses'],
    sectors: ['Café', 'Beauté', 'Restaurant', 'Retail'],
    photo: 'required',
    desc: 'Une bande de couleur collée légèrement de travers porte le titre, une petite étiquette de rubrique se pose par-dessus en biais, une étoile déborde à droite, et un paragraphe manuscrit ferme en bas. Le collage d’un carnet de voyage.',
    slots: [sl('titre', 'le titre', 44), sl('rubrique', 'la rubrique, deux mots', 16), sl('signature', 'la phrase manuscrite finale', 76)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      R(0.05, 0.085, 0.9, 0.15, 'accent', { radius: 0.006, rotation: -1.5 }),
      T('titre', 0.08, 0.1, 0.84, 0.082, 'onAccent', { font: 'condensed', upper: true, lh: 0.95, maxLines: 2, role: 'titre', rotation: -1.5, weight: 'bold' }),
      R(0.06, 0.192, 0.3, 0.062, 'ink', { rotation: -8 }),
      T('rubrique', 0.06, 0.207, 0.3, 0.028, 'paper', { align: 'center', upper: true, track: 0.1, maxLines: 1, rotation: -8, weight: 'bold' }),
      S('star', 0.75, 0.2, 0.17, 0.122, 'accent', { rotation: 14 }),
      T('signature', 0.08, 0.78, 0.62, 0.04, 'white', { font: 'script', lh: 1.25, maxLines: 3, rotation: -3, shadow: true }),
      ...footer('white'),
    ],
  },
  {
    id: 'ds-tampon', name: 'Tampon', family: 'sticker',
    vibe: ['audacieux', 'tech'], intents: ['offre', 'annonce', 'produit'],
    sectors: ['Sport', 'Retail', 'Mode'],
    photo: 'required',
    desc: 'Un tampon ovale sombre, cerné d’un filet clair, posé de travers sur la photo : une ligne de capitales espacées au-dessus, le mot fort en dessous. Le badge des grandes marques de sport, celui qu’on reconnaît avant de lire.',
    slots: [sl('titre', 'le titre, en haut', 34), sl('kicker', 'la ligne espacée du tampon, très courte', 18), sl('mot', 'le mot fort du tampon', 12)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      T('titre', 0.06, 0.07, 0.7, 0.078, 'white', { font: 'condensed', upper: true, lh: 0.95, maxLines: 2, role: 'titre', shadow: true }),
      S('pill', 0.4, 0.52, 0.54, 0.15, 'ink', { rotation: -8, stroke: 'paper', strokeW: 0.004 }),
      T('kicker', 0.42, 0.558, 0.5, 0.022, 'paper', { align: 'center', upper: true, track: 0.2, maxLines: 1, rotation: -8 }),
      T('mot', 0.42, 0.588, 0.5, 0.055, 'accentLight', { font: 'condensed', align: 'center', upper: true, maxLines: 1, rotation: -8, weight: 'bold' }),
      ...footer('white'),
    ],
  },
  {
    id: 'ds-note-fleche', name: 'Note et flèche', family: 'sticker',
    vibe: ['ludique', 'chaleureux'], intents: ['annonce', 'conseil', 'coulisses'],
    sectors: ['Retail', 'Tech', 'Café'],
    photo: 'required',
    desc: 'Une petite carte de papier posée de travers sur la photo, et une flèche dessinée qui pointe vers ce qu’il faut regarder. Le geste de la story annotée, transposé en post.',
    slots: [sl('titre', 'ce que dit la note', 46), sl('sous', 'la précision', 40), sl('cta', 'l’appel à l’action', 26)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      R(0.14, 0.29, 0.62, 0.24, 'paper', { radius: 0.012, rotation: -3 }),
      T('titre', 0.17, 0.325, 0.56, 0.056, 'ink', { lh: 1.05, maxLines: 3, role: 'titre', rotation: -3, weight: 'bold' }),
      T('sous', 0.17, 0.455, 0.5, 0.025, 'ink', { font: 'body', maxLines: 2, rotation: -3, opacity: 70 }),
      S('arrow', 0.6, 0.565, 0.22, 0.06, 'accentLight', { rotation: -28 }),
      T('cta', 0.1, 0.87, 0.62, 0.028, 'white', { font: 'body', upper: true, track: 0.14, maxLines: 1, role: 'cta', shadow: true }),
    ],
  },

  // ── Typographie sur aplat ───────────────────────────────────────────────
  {
    id: 'ds-titre-plein-pastille', name: 'Titre plein cadre', family: 'aplat-typo',
    vibe: ['editorial', 'audacieux'], intents: ['accroche', 'conseil', 'annonce'],
    photo: 'none',
    desc: 'Le titre occupe tout l’aplat, ligne après ligne, jusqu’aux marges, et une petite pastille d’annotation vient se loger dans un creux du texte. Le nom de la marque en haut ET en bas ferme la page.',
    slots: [sl('titre', 'la question ou l’affirmation, en une phrase', 96), sl('note', 'l’annotation de la pastille, deux ou trois mots', 30)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      rail('onBrand', 0.04),
      T('titre', 0.07, 0.125, 0.86, 0.125, 'paper', { lh: 0.98, maxLines: 6, role: 'titre', weight: 'bold' }),
      S('pill', 0.57, 0.5, 0.35, 0.06, 'paper'),
      T('note', 0.585, 0.514, 0.32, 0.021, 'ink', { align: 'center', upper: true, track: 0.06, lh: 1.3, maxLines: 2, weight: 'bold' }),
      F('{{marque}}', 0.08, 0.945, 0.84, 0.024, 'onBrand', { align: 'center', upper: true, track: 0.34, maxLines: 1, opacity: 88 }),
    ],
  },
  {
    id: 'ds-chiffre-dans-phrase', name: 'Le chiffre dans la phrase', family: 'preuve',
    vibe: ['audacieux', 'tech'], intents: ['conseil', 'preuve', 'liste'],
    photo: 'none',
    desc: 'Le début de la phrase, puis le chiffre écrit en énorme dans la couleur d’accent, puis la fin de la phrase à côté de lui. Le chiffre ne commente pas la phrase, il en fait partie.',
    slots: [sl('avant', 'le début de la phrase', 20), sl('chiffre', 'le chiffre ou le nombre', 5), sl('apres', 'la fin de la phrase', 40), sl('sous', 'la précision', 110)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      T('avant', 0.09, 0.205, 0.6, 0.055, 'ink', { font: 'condensed', upper: true, lh: 1, maxLines: 1, weight: 'bold' }),
      T('chiffre', 0.05, 0.275, 0.44, 0.255, 'accentDeep', { font: 'condensed', maxLines: 1, weight: 'bold' }),
      T('apres', 0.49, 0.325, 0.46, 0.062, 'ink', { font: 'condensed', upper: true, lh: 0.98, maxLines: 3, role: 'titre', weight: 'bold' }),
      T('sous', 0.09, 0.71, 0.74, 0.029, 'ink', { font: 'body', lh: 1.4, maxLines: 3, role: 'corps', opacity: 76 }),
      ...footer('ink'),
    ],
  },
  {
    id: 'ds-deux-repliques', name: 'La réplique', family: 'citation',
    vibe: ['editorial', 'audacieux'], intents: ['conseil', 'citation', 'accroche'],
    photo: 'required',
    desc: 'Deux répliques entre guillemets, l’une en haut à gauche, l’autre en bas à droite, et une flèche entre les deux. La composition raconte une objection et sa réponse : c’est un dialogue, pas une citation.',
    slots: [sl('kicker', 'le contexte, en une ligne', 40), sl('q1', 'la première réplique, entre guillemets', 44), sl('q2', 'la réponse, entre guillemets', 56), sl('sous', 'la précision finale', 90)],
    nodes: [
      P(0, 0, 1, 1, { dark: 22 }),
      T('kicker', 0.06, 0.05, 0.72, 0.026, 'white', { font: 'body', maxLines: 1, opacity: 88, weight: 'bold' }),
      T('q1', 0.06, 0.145, 0.5, 0.072, 'accentLight', { lh: 1.05, maxLines: 3, weight: 'bold', shadow: true }),
      S('arrow', 0.38, 0.315, 0.24, 0.07, 'accentLight', { rotation: 24 }),
      T('q2', 0.42, 0.42, 0.52, 0.072, 'accentLight', { align: 'right', lh: 1.05, maxLines: 4, role: 'titre', weight: 'bold', shadow: true }),
      T('sous', 0.42, 0.79, 0.52, 0.025, 'white', { font: 'body', lh: 1.4, maxLines: 3, opacity: 85 }),
    ],
  },

  // ── Interface ───────────────────────────────────────────────────────────
  {
    id: 'ds-post-instagram', name: 'Le post dans le post', family: 'carte-ui',
    vibe: ['ludique', 'minimal'], intents: ['coulisses', 'accroche', 'produit'],
    sectors: ['Café', 'Restaurant', 'Mode', 'Autre'],
    photo: 'required',
    desc: 'La photo remplit le fond, désaturée, et un faux post — cadre blanc, photo, légende, barre d’icônes — se pose par-dessus. Le visuel parle de lui-même : on publie un post qui contient un post.',
    slots: [sl('legende', 'la légende du faux post', 40)],
    nodes: [
      P(0, 0, 1, 1, { dark: 16, sat: -25 }),
      R(0.11, 0.13, 0.78, 0.7, 'white', { radius: 0.006 }),
      P(0.13, 0.15, 0.74, 0.44),
      T('legende', 0.14, 0.625, 0.72, 0.042, 'ink', { align: 'center', lh: 1.2, maxLines: 2, role: 'titre', weight: 'bold' }),
      S('circle', 0.15, 0.735, 0.038, 0.03, 'none', { stroke: 'ink', strokeW: 0.0035 }),
      S('pill', 0.205, 0.735, 0.04, 0.03, 'none', { stroke: 'ink', strokeW: 0.0035 }),
      S('triangle', 0.265, 0.735, 0.038, 0.03, 'none', { stroke: 'ink', strokeW: 0.0035, rotation: 90 }),
      S('rectangle', 0.815, 0.732, 0.03, 0.036, 'none', { stroke: 'ink', strokeW: 0.0035 }),
      ...footer('white'),
    ],
  },

  // ── Listes ──────────────────────────────────────────────────────────────
  {
    id: 'ds-pastilles-rondes', name: 'Pastilles en tête', family: 'liste',
    vibe: ['ludique', 'minimal', 'chaleureux'], intents: ['liste', 'conseil', 'annonce'],
    sectors: ['Sport', 'Beauté', 'Tech', 'Café'],
    photo: 'none',
    desc: 'Quatre gros ronds de couleur alignés en tête, un mot dans chacun, puis le titre en dessous. La rangée de pastilles se lit avant le titre : c’est le sommaire du post.',
    slots: [sl('r1', 'mot 1', 12), sl('r2', 'mot 2', 12), sl('r3', 'mot 3', 12), sl('r4', 'mot 4', 12), sl('titre', 'le titre', 46), sl('sous', 'la précision', 110)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      S('circle', 0.055, 0.115, 0.2, 0.16, 'brand'),
      T('r1', 0.055, 0.183, 0.2, 0.026, 'onBrand', { align: 'center', upper: true, lh: 1.2, maxLines: 2, weight: 'bold' }),
      S('circle', 0.285, 0.115, 0.2, 0.16, 'accent'),
      T('r2', 0.285, 0.183, 0.2, 0.026, 'onAccent', { align: 'center', upper: true, lh: 1.2, maxLines: 2, weight: 'bold' }),
      S('circle', 0.515, 0.115, 0.2, 0.16, 'ink'),
      T('r3', 0.515, 0.183, 0.2, 0.026, 'paper', { align: 'center', upper: true, lh: 1.2, maxLines: 2, weight: 'bold' }),
      S('circle', 0.745, 0.115, 0.2, 0.16, 'secondary'),
      T('r4', 0.745, 0.183, 0.2, 0.026, 'onSecondary', { align: 'center', upper: true, lh: 1.2, maxLines: 2, weight: 'bold' }),
      T('titre', 0.055, 0.38, 0.89, 0.088, 'ink', { lh: 1.02, maxLines: 3, role: 'titre', weight: 'bold' }),
      T('sous', 0.055, 0.68, 0.8, 0.029, 'ink', { font: 'body', lh: 1.4, maxLines: 3, role: 'corps', opacity: 74 }),
      ...footer('ink'),
    ],
  },
  {
    id: 'ds-bulles-empilees', name: 'Liste en pilules', family: 'liste',
    vibe: ['tech', 'minimal', 'sobre'], intents: ['liste', 'conseil', 'produit'],
    sectors: ['Tech', 'Autre', 'Retail'],
    photo: 'none',
    desc: 'Quatre pilules de papier empilées et légèrement décalées, chacune précédée d’un point de couleur. Le langage des applications : une liste qui ressemble à une interface, pas à un tract.',
    slots: [sl('titre', 'le titre', 44), sl('b1', 'item 1', 26), sl('b2', 'item 2', 26), sl('b3', 'item 3', 26), sl('b4', 'item 4', 26)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      rail('onBrand'),
      T('titre', 0.08, 0.13, 0.8, 0.072, 'onBrand', { lh: 1.05, maxLines: 2, role: 'titre', weight: 'bold' }),
      S('pill', 0.07, 0.35, 0.66, 0.068, 'paper'),
      S('circle', 0.095, 0.362, 0.042, 0.034, 'accentDeep'),
      T('b1', 0.155, 0.365, 0.55, 0.03, 'ink', { maxLines: 1, weight: 'bold' }),
      S('pill', 0.12, 0.44, 0.66, 0.068, 'paper'),
      S('circle', 0.145, 0.452, 0.042, 0.034, 'accentDeep'),
      T('b2', 0.205, 0.455, 0.55, 0.03, 'ink', { maxLines: 1, weight: 'bold' }),
      S('pill', 0.09, 0.53, 0.66, 0.068, 'paper'),
      S('circle', 0.115, 0.542, 0.042, 0.034, 'accentDeep'),
      T('b3', 0.175, 0.545, 0.55, 0.03, 'ink', { maxLines: 1, weight: 'bold' }),
      S('pill', 0.15, 0.62, 0.66, 0.068, 'paper'),
      S('circle', 0.175, 0.632, 0.042, 0.034, 'accentDeep'),
      T('b4', 0.235, 0.635, 0.55, 0.03, 'ink', { maxLines: 1, weight: 'bold' }),
      ...footer('onBrand'),
    ],
  },

  // ══ H. LES TROIS SIMPLES ══════════════════════════════════════════════════
  //
  // Martin, en cours de route : « des compositions très simples, mais qui font
  // le taf parce qu'elles sont harmonieuses et modernes ». Les trois références
  // qu'il a envoyées ont un point commun que le reste de la bibliothèque n'avait
  // pas : elles ne font qu'UNE chose.
  //
  // Pas de rubrique + titre + sous-titre + rail + pied dans le même cadre. Pas
  // de voile noir pour rattraper la lisibilité. Une seule couleur de texte, un
  // crème plutôt qu'un blanc pur, et un titre qui occupe vraiment la moitié de
  // la hauteur. C'est l'inverse de la prudence : ce qui rendait les visuels
  // « corrects et sans intérêt », c'était d'empiler quatre niveaux de petits
  // textes bien alignés.
  //
  // RÈGLE QU'ELLES INSTALLENT, et qui vaut pour les recettes à venir : un texte
  // enfermé dans une forme de taille fixe (pilule, cartouche) ne porte JAMAIS le
  // rôle `titre`. Le remplissage optique ferait grandir le texte de 34 % et il
  // sortirait de sa forme. Dans une forme, on met un `tag` ou un `cta`.

  {
    id: 'ds-affiche-creme', name: 'Affiche crème', family: 'photo-editorial',
    vibe: ['chaleureux', 'audacieux', 'retro'], intents: ['annonce', 'accroche', 'evenement'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Un seul geste : un titre énorme en crème qui occupe la moitié de la hauteur, une rubrique espacée au-dessus séparée par une étoile, une ligne espacée en dessous. Aucun voile, aucun aplat, aucune deuxième couleur. La photo reste lumineuse et c’est le calibre du titre qui tient tout.',
    slots: [sl('kicker', 'la rubrique, un mot', 10), sl('titre', 'le titre, deux ou trois mots', 22), sl('sous', 'la ligne du bas, courte', 30)],
    nodes: [
      // Assombrissement léger : la photo doit rester une photo. Un voile à 40 %
      // rend le texte lisible et le visuel terne, ce qui n'est pas un échange.
      P(0, 0, 1, 1, { dark: 12 }),
      T('kicker', 0.1, 0.075, 0.8, 0.07, 'paper', { font: 'condensed', align: 'center', upper: true, track: 0.22, maxLines: 1, weight: 'bold' }),
      S('star', 0.465, 0.152, 0.07, 0.05, 'paper'),
      T('titre', 0.04, 0.205, 0.92, 0.175, 'paper', { font: 'condensed', align: 'center', upper: true, lh: 0.86, maxLines: 3, role: 'titre', weight: 'bold' }),
      T('sous', 0.08, 0.755, 0.84, 0.036, 'paper', { font: 'condensed', align: 'center', upper: true, track: 0.1, maxLines: 1, role: 'sous-titre' }),
      S('star', 0.455, 0.855, 0.09, 0.065, 'paper', { opacity: 92 }),
    ],
  },
  {
    id: 'ds-etoiles-cadre', name: 'Cadre d’étoiles', family: 'sticker',
    vibe: ['ludique', 'audacieux'], intents: ['produit', 'accroche', 'annonce'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'De grandes étoiles de la couleur de marque mordent les quatre coins de la photo, comme un cadre découpé. Le titre se pose en bas, court. Aucun texte ne dépend de la photo pour être lisible : ce sont les formes qui font le visuel.',
    slots: [sl('titre', 'le titre, très court', 22)],
    nodes: [
      P(0, 0, 1, 1),
      S('star', -0.14, -0.08, 0.44, 0.315, 'brand'),
      S('star', 0.74, -0.1, 0.48, 0.345, 'brand', { rotation: 18 }),
      S('star', -0.18, 0.42, 0.42, 0.3, 'brand', { rotation: -12 }),
      S('star', 0.76, 0.44, 0.44, 0.315, 'brand', { rotation: 8 }),
      S('star', 0.26, 0.87, 0.4, 0.285, 'brand', { rotation: 24 }),
      T('titre', 0.1, 0.76, 0.8, 0.082, 'paper', { font: 'condensed', align: 'center', upper: true, lh: 0.92, maxLines: 2, role: 'titre', weight: 'bold', shadow: true }),
    ],
  },

  // ══ I. LA BANDE HAUTE ═════════════════════════════════════════════════════
  //
  // Mesure faite le 26/08 sur les vraies photos de Pepe Chicken, dans le banc :
  // sur 76 compositions, DEUX seulement écrivaient dans le haut de la photo, et
  // vingt écrivaient en travers de toute sa hauteur. Or un plan produit — un
  // burger, un plat, un flacon — a son sujet au centre et son calme en haut.
  // Autrement dit, pour le cas le plus fréquent du métier, le compositeur
  // n'avait presque aucune composition juste qui montre la photo en grand. Ce
  // n'était pas une question de goût : c'était un trou dans la bibliothèque.
  //
  // Ces cinq-là écrivent toutes dans la moitié haute et laissent le sujet
  // intact. Elles sont volontairement différentes les unes des autres : un
  // bandeau plein, un voile, un filet éditorial, une offre, des cartouches.
  //
  // TOUTES CALÉES À GAUCHE OU PLEINE LARGEUR, jamais dans le coin haut-droit :
  // les photos produit des clients portent très souvent un badge ou une pastille
  // à cet endroit (les six photos de Pepe Chicken en ont quatre). Poser un texte
  // par-dessus le badge du client est exactement le détail qui trahit un visuel
  // fabriqué.

  {
    id: 'ds-tag-haut', name: 'Pastille et titre en haut', family: 'photo-editorial',
    vibe: ['audacieux', 'ludique'], intents: ['annonce', 'produit', 'offre'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Une pastille de couleur porte la rubrique, le titre tombe juste dessous en gros condensé, le tout dans le tiers haut sur un voile léger. La photo reste entière en dessous.',
    slots: [sl('tag', 'la rubrique, deux mots', 16), sl('titre', 'le titre', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 6 }),
      R(0, 0, 1, 0.44, 'black', { scrim: 'top', opacity: 52 }),
      S('pill', 0.06, 0.055, 0.3, 0.05, 'accent'),
      T('tag', 0.06, 0.0685, 0.3, 0.022, 'onAccent', { align: 'center', upper: true, track: 0.1, maxLines: 1, role: 'tag', weight: 'bold' }),
      // Colonne arrêtée aux deux tiers : au-delà, le titre passe sous le badge que
      // les photos produit portent presque toujours en haut à droite. Vérifié sur
      // les six photos de Pepe Chicken, quatre en ont un.
      T('titre', 0.06, 0.135, 0.62, 0.1, 'white', { font: 'condensed', upper: true, lh: 0.92, maxLines: 3, role: 'titre', weight: 'bold' }),
    ],
  },

  // ── Bandes hautes et basses sur photo plein cadre ──────────────────────────
  //
  // COMPTÉ le 2026-09-03 : sur les 36 recettes à photo plein cadre, 20 écrivaient
  // EN TRAVERS de toute la hauteur, 7 en haut, 7 en bas. Sur un plan produit, dont
  // le sujet est au centre, seules 14 recettes sur 81 n'écrivaient donc pas sur le
  // plat. C'est la cause mécanique de « c'est toujours pareil » et « c'est moche » :
  // le tirage tourne bien, mais le sous-ensemble JUSTE était minuscule.
  //
  // Les gestes ci-dessous sont relevés sur ce qui fonctionne réellement en social
  // aujourd'hui, pas inventés : lettres évidées qui laissent voir la photo, collage
  // de calibres (un mot énorme contre une ligne minuscule), étiquette inclinée,
  // texte vertical le long du bord, cartouches en escalier, crème plutôt que blanc
  // pur. Règle tenue partout : UNE seule idée par visuel, et le coin haut-droit
  // laissé libre pour le badge que portent la plupart des photos clientes.

  {
    id: 'ds-evide-haut', name: 'Titre évidé en haut', family: 'photo-editorial',
    vibe: ['audacieux', 'editorial'], intents: ['accroche', 'annonce', 'produit'],
    sectors: ['Restaurant', 'Mode', 'Sport', 'Café'],
    photo: 'required',
    desc: 'Un titre en très gros condensé, lettres ÉVIDÉES : on lit le mot et on voit la photo au travers. Aucun voile, aucun aplat, rien d’autre. Le geste qui fait moderne sans rien recouvrir.',
    slots: [sl('titre', 'deux ou trois mots, pas plus', 24)],
    nodes: [
      P(0, 0, 1, 1, { dark: 14 }),
      T('titre', 0.055, 0.075, 0.66, 0.145, 'white', { font: 'condensed', upper: true, lh: 0.88, maxLines: 2, role: 'titre', weight: 'bold', hollow: true, strokeCol: 'white', strokeW: 0.004 }),
    ],
  },
  {
    id: 'ds-etiquette-inclinee', name: 'Étiquette collée de travers', family: 'sticker',
    vibe: ['ludique', 'audacieux', 'chaleureux'], intents: ['offre', 'annonce', 'evenement'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Une étiquette de couleur posée de travers en haut à gauche, comme collée à la main, et le titre juste dessous bien droit. Le contraste travers/droit donne l’air fait main que cherchent les comptes qui marchent.',
    slots: [sl('tag', 'le mot de l’étiquette', 14), sl('titre', 'le titre', 32)],
    nodes: [
      P(0, 0, 1, 1, { dark: 12 }),
      S('pill', 0.05, 0.05, 0.32, 0.058, 'accent', { rotation: -6 }),
      T('tag', 0.05, 0.0655, 0.32, 0.026, 'onAccent', { align: 'center', upper: true, track: 0.1, maxLines: 1, role: 'tag', weight: 'bold', rotation: -6 }),
      T('titre', 0.05, 0.135, 0.62, 0.105, 'white', { font: 'condensed', upper: true, lh: 0.92, maxLines: 2, role: 'titre', weight: 'bold', shadow: true }),
    ],
  },
  {
    id: 'ds-vertical-cote', name: 'Marque à la verticale', family: 'photo-editorial',
    vibe: ['minimal', 'editorial', 'luxe'], intents: ['accroche', 'produit', 'coulisses'],
    sectors: ['Restaurant', 'Mode', 'Beauté', 'Café'],
    photo: 'required',
    desc: 'Le nom de la marque court à la VERTICALE le long du bord gauche, et un titre court se pose en haut. La photo n’est presque pas touchée : le cadrage vient du texte lui-même.',
    slots: [sl('titre', 'le titre, court', 28)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      F('{{marque}}', 0.032, 0.8, 0.46, 0.024, 'white', { upper: true, track: 0.34, maxLines: 1, rotation: -90, opacity: 82 }),
      T('titre', 0.12, 0.08, 0.58, 0.095, 'paper', { font: 'condensed', upper: true, lh: 0.94, maxLines: 3, role: 'titre', weight: 'bold', shadow: true }),
    ],
  },
  {
    id: 'ds-escalier-haut', name: 'Cartouches en escalier', family: 'photo-editorial',
    vibe: ['audacieux', 'ludique'], intents: ['accroche', 'annonce', 'offre'],
    sectors: ['Restaurant', 'Café', 'Sport', 'Retail'],
    photo: 'required',
    desc: 'Chaque ligne du titre est enfermée dans son propre cartouche de couleur, et les cartouches se décalent en escalier. La couleur de marque devient la MATIÈRE du visuel, pas une décoration posée à côté.',
    slots: [sl('titre', 'le titre sur deux ou trois lignes courtes', 34)],
    nodes: [
      P(0, 0, 1, 1, { dark: 8 }),
      T('titre', 0.055, 0.07, 0.6, 0.082, 'onBrand', { font: 'condensed', upper: true, lh: 1.34, maxLines: 3, role: 'titre', weight: 'bold', hl: 'brand', hlRadius: 4, hlPad: 16 }),
    ],
  },
  {
    id: 'ds-question-haut', name: 'La question en haut', family: 'photo-editorial',
    vibe: ['editorial', 'sobre', 'chaleureux'], intents: ['accroche', 'conseil'],
    sectors: ['Restaurant', 'Beauté', 'Café', 'Santé'],
    photo: 'required',
    desc: 'Une question en serif italique, grande, posée dans le haut, et la réponse en une ligne minuscule dessous. Le registre de la presse : ça se lit, ça n’assène pas.',
    slots: [sl('question', 'la question, une phrase', 46), sl('reponse', 'la réponse en quelques mots', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 18 }),
      T('question', 0.06, 0.075, 0.64, 0.078, 'paper', { font: 'serif', italic: true, lh: 1.1, maxLines: 3, role: 'titre' }),
      T('reponse', 0.06, 0.31, 0.44, 0.026, 'paper', { font: 'body', upper: true, track: 0.2, maxLines: 1, role: 'sous-titre', opacity: 92, shadow: true }),
    ],
  },

  {
    id: 'ds-creme-bas', name: 'Crème en bas', family: 'photo-editorial',
    vibe: ['editorial', 'minimal', 'luxe'], intents: ['accroche', 'produit', 'annonce'],
    sectors: ['Restaurant', 'Mode', 'Café', 'Beauté'],
    photo: 'required',
    desc: 'Un gros titre crème en bas à gauche, et rien d’autre. Pas de voile noir : c’est la photo elle-même qui est assombrie, ce qui garde ses couleurs. Le visuel le plus simple du répertoire, et celui qui vieillit le mieux.',
    slots: [sl('titre', 'le titre, court et frappant', 38)],
    nodes: [
      P(0, 0, 1, 1, { dark: 26 }),
      T('titre', 0.06, 0.6, 0.8, 0.125, 'paper', { font: 'condensed', upper: true, lh: 0.9, maxLines: 3, role: 'titre', weight: 'bold' }),
    ],
  },
  {
    id: 'ds-evide-bas', name: 'Titre évidé en bas', family: 'photo-editorial',
    vibe: ['audacieux', 'minimal'], intents: ['accroche', 'produit'],
    sectors: ['Restaurant', 'Sport', 'Mode'],
    photo: 'required',
    desc: 'Le même geste des lettres évidées, mais ancré en bas : la photo respire en haut, le mot se lit en transparence sur la matière. À réserver aux photos dont le bas est calme.',
    slots: [sl('mot', 'un ou deux mots', 16)],
    nodes: [
      P(0, 0, 1, 1, { dark: 16 }),
      T('mot', 0.05, 0.68, 0.9, 0.165, 'paper', { font: 'condensed', upper: true, lh: 0.86, maxLines: 2, role: 'titre', weight: 'bold', hollow: true, strokeCol: 'paper', strokeW: 0.004 }),
    ],
  },
  {
    id: 'ds-manuscrit-bas', name: 'Mot manuscrit en bas', family: 'photo-editorial',
    vibe: ['chaleureux', 'ludique'], intents: ['coulisses', 'produit', 'accroche'],
    sectors: ['Restaurant', 'Café', 'Beauté'],
    photo: 'required',
    desc: 'Un mot manuscrit posé grand en bas, légèrement de travers, en couleur de marque. Le geste humain qui casse la perfection numérique, et que les comptes de restaurant utilisent tous.',
    slots: [sl('mot', 'un mot manuscrit, très court', 18), sl('mention', 'la mention sous le mot', 34)],
    nodes: [
      P(0, 0, 1, 1, { dark: 20 }),
      T('mot', 0.07, 0.63, 0.7, 0.145, 'accentLight', { font: 'script', maxLines: 1, role: 'titre', rotation: -4, shadow: true }),
      T('mention', 0.07, 0.83, 0.6, 0.026, 'paper', { font: 'body', upper: true, track: 0.2, maxLines: 1, role: 'sous-titre', opacity: 88 }),
    ],
  },
  {
    id: 'ds-prix-geant-bas', name: 'Le prix en géant', family: 'offre',
    vibe: ['audacieux', 'ludique'], intents: ['offre', 'produit', 'menu'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Le nom du plat en petit, le prix en ÉNORME juste dessous, calés en bas à gauche. L’information que le client cherche est celle qu’on écrit le plus gros : c’est ce qui fait cliquer sur une offre.',
    slots: [sl('libelle', 'le nom du plat ou de l’offre', 28), sl('prix', 'le prix, avec sa devise', 8)],
    nodes: [
      P(0, 0, 1, 1, { dark: 24 }),
      T('libelle', 0.06, 0.655, 0.66, 0.036, 'paper', { font: 'body', upper: true, track: 0.16, maxLines: 1, role: 'sous-titre' }),
      T('prix', 0.06, 0.705, 0.7, 0.19, 'accentLight', { font: 'condensed', maxLines: 1, role: 'prix', weight: 'bold', lh: 0.9 }),
    ],
  },
  {
    id: 'ds-menu-trois-bas', name: 'Trois plats en bas', family: 'menu',
    vibe: ['sobre', 'chaleureux', 'editorial'], intents: ['menu', 'annonce'],
    sectors: ['Restaurant', 'Café'],
    photo: 'required',
    desc: 'Une rubrique fine, puis trois lignes de plats séparées par des filets, calées dans le bas sur la photo. Le geste de la carte, sans jamais recouvrir le plat photographié.',
    slots: [sl('rubrique', 'la rubrique de la carte', 20), sl('p1', 'premier plat', 34), sl('p2', 'deuxième plat', 34), sl('p3', 'troisième plat', 34)],
    nodes: [
      P(0, 0, 1, 1, { dark: 30 }),
      T('rubrique', 0.07, 0.565, 0.6, 0.026, 'paper', { font: 'body', upper: true, track: 0.24, maxLines: 1, role: 'tag', opacity: 92, shadow: true }),
      T('p1', 0.07, 0.635, 0.78, 0.046, 'paper', { font: 'serif', maxLines: 1, role: 'corps' }),
      R(0.07, 0.706, 0.78, 0.0022, 'paper', { opacity: 34 }),
      T('p2', 0.07, 0.728, 0.78, 0.046, 'paper', { font: 'serif', maxLines: 1, role: 'corps' }),
      R(0.07, 0.799, 0.78, 0.0022, 'paper', { opacity: 34 }),
      T('p3', 0.07, 0.821, 0.78, 0.046, 'paper', { font: 'serif', maxLines: 1, role: 'corps' }),
    ],
  },
  {
    id: 'ds-evenement-bas', name: 'La date en bas', family: 'evenement',
    vibe: ['audacieux', 'editorial'], intents: ['evenement', 'annonce'],
    sectors: ['Restaurant', 'Café', 'Sport', 'Culture'],
    photo: 'required',
    desc: 'Le nom de l’événement en gros, et la date dans une pastille de couleur posée juste à côté. Deux informations, deux traitements : on sait quoi et quand en une demi-seconde.',
    slots: [sl('titre', 'le nom de l’événement', 30), sl('date', 'la date, très courte', 14)],
    nodes: [
      P(0, 0, 1, 1, { dark: 26 }),
      T('titre', 0.06, 0.6, 0.72, 0.108, 'paper', { font: 'condensed', upper: true, lh: 0.92, maxLines: 2, role: 'titre', weight: 'bold' }),
      S('pill', 0.06, 0.845, 0.42, 0.062, 'accent'),
      T('date', 0.06, 0.8625, 0.42, 0.028, 'onAccent', { align: 'center', upper: true, track: 0.08, maxLines: 1, role: 'tag', weight: 'bold' }),
    ],
  },


  // ── Relevé sur les 42 références déposées (2026-09-03) ────────────────────
  //
  // Deuxième lecture du dossier, après le comptage de couverture. Ce qui revient
  // dans ces feeds et que le répertoire n'avait PAS : le mot manuscrit qui double
  // le titre, le titre serif dont les mots se décalent en escalier, l'étiquette
  // blanche posée de travers, le mot surligné À L'INTÉRIEUR du titre, le très
  // grand serif d'un seul mot. Presque aucune de ces références n'est en condensé
  // carré : elles sont en serif à fort contraste ou en grotesque rond. D'où le
  // choix de `serif` et de `script` ici plutôt que de `condensed`, qui portait
  // seul presque tout le répertoire.

  {
    id: 'ds-serif-escalier-bas', name: 'Serif en escalier', family: 'photo-editorial',
    vibe: ['editorial', 'luxe', 'chaleureux'], intents: ['accroche', 'coulisses', 'produit'],
    sectors: ['Restaurant', 'Mode', 'Beauté', 'Café'],
    photo: 'required',
    desc: 'Un titre serif dont les mots se décalent l’un sous l’autre, en escalier, à des calibres différents. Le geste des comptes éditoriaux : la phrase se lit comme un objet, pas comme une légende.',
    slots: [sl('m1', 'premier mot, petit', 12), sl('m2', 'deuxième mot, grand', 14), sl('m3', 'troisième mot, grand', 14)],
    nodes: [
      P(0, 0, 1, 1, { dark: 24 }),
      T('m1', 0.08, 0.545, 0.4, 0.052, 'paper', { font: 'serif', italic: true, maxLines: 1, role: 'sous-titre' }),
      T('m2', 0.13, 0.615, 0.7, 0.13, 'paper', { font: 'serif', lh: 0.92, maxLines: 1, role: 'titre' }),
      T('m3', 0.2, 0.755, 0.72, 0.13, 'paper', { font: 'serif', lh: 0.92, maxLines: 1, role: 'titre' }),
    ],
  },
  {
    id: 'ds-script-double-bas', name: 'Le mot manuscrit qui double le titre', family: 'photo-editorial',
    vibe: ['chaleureux', 'ludique', 'audacieux'], intents: ['accroche', 'produit', 'annonce'],
    sectors: ['Restaurant', 'Café', 'Beauté'],
    photo: 'required',
    desc: 'Le titre en capitales, et juste sous lui le même propos repris d’un mot manuscrit en couleur de marque, légèrement de travers. Deux voix pour une idée : c’est le geste le plus fréquent des feeds qui marchent.',
    slots: [sl('titre', 'le titre en capitales', 26), sl('mot', 'le mot manuscrit, très court', 14)],
    nodes: [
      P(0, 0, 1, 1, { dark: 26 }),
      T('titre', 0.07, 0.63, 0.82, 0.1, 'paper', { upper: true, lh: 0.96, maxLines: 1, role: 'titre', weight: 'bold', track: -0.01 }),
      T('mot', 0.09, 0.755, 0.66, 0.115, 'accentLight', { font: 'script', maxLines: 1, role: 'accroche', rotation: -5 }),
    ],
  },
  {
    id: 'ds-etiquettes-blanches', name: 'Étiquettes blanches dispersées', family: 'sticker',
    vibe: ['ludique', 'audacieux'], intents: ['accroche', 'annonce', 'evenement'],
    sectors: ['Restaurant', 'Café', 'Sport', 'Retail'],
    photo: 'required',
    desc: 'Trois étiquettes de papier blanc posées de travers dans le haut, chacune portant un mot. Le collage fait main, celui qu’on retrouve sur tous les comptes qui ne veulent pas avoir l’air fabriqués.',
    slots: [sl('e1', 'premier mot', 12), sl('e2', 'deuxième mot', 12), sl('e3', 'troisième mot', 14)],
    nodes: [
      P(0, 0, 1, 1, { dark: 6 }),
      R(0.06, 0.055, 0.3, 0.058, 'paper', { rotation: -4 }),
      T('e1', 0.06, 0.0705, 0.3, 0.03, 'ink', { align: 'center', upper: true, maxLines: 1, role: 'tag', weight: 'bold', rotation: -4 }),
      R(0.4, 0.115, 0.28, 0.058, 'paper', { rotation: 3 }),
      T('e2', 0.4, 0.1305, 0.28, 0.03, 'ink', { align: 'center', upper: true, maxLines: 1, role: 'tag', weight: 'bold', rotation: 3 }),
      R(0.11, 0.185, 0.34, 0.058, 'paper', { rotation: -2 }),
      T('e3', 0.11, 0.2005, 0.34, 0.03, 'ink', { align: 'center', upper: true, maxLines: 1, role: 'tag', weight: 'bold', rotation: -2 }),
    ],
  },
  {
    id: 'ds-mot-surligne-bas', name: 'Le mot surligné dans le titre', family: 'photo-editorial',
    vibe: ['audacieux', 'editorial'], intents: ['accroche', 'offre', 'annonce'],
    sectors: ['Restaurant', 'Retail', 'Sport', 'Café'],
    photo: 'required',
    desc: 'Un titre sur trois lignes dont UNE seule est surlignée en couleur de marque. L’œil va droit au mot surligné : c’est le moyen le plus simple de dire ce qui compte sans grossir tout le reste.',
    slots: [sl('l1', 'début du titre', 22), sl('l2', 'LE mot qui compte', 16), sl('l3', 'fin du titre', 22)],
    nodes: [
      P(0, 0, 1, 1, { dark: 22 }),
      T('l1', 0.07, 0.565, 0.8, 0.082, 'paper', { maxLines: 1, role: 'sous-titre', weight: 'bold', track: -0.01 }),
      T('l2', 0.07, 0.665, 0.8, 0.082, 'onBrand', { maxLines: 1, role: 'tag', weight: 'bold', hl: 'brand', hlRadius: 3, hlPad: 12 }),
      T('l3', 0.07, 0.775, 0.8, 0.082, 'paper', { maxLines: 1, role: 'sous-titre', weight: 'bold', track: -0.01 }),
    ],
  },
  {
    id: 'ds-un-mot-serif', name: 'Un mot, très grand', family: 'photo-editorial',
    vibe: ['minimal', 'luxe', 'editorial'], intents: ['accroche', 'produit'],
    sectors: ['Restaurant', 'Mode', 'Beauté', 'Café'],
    photo: 'required',
    desc: 'Un seul mot en serif, énorme, posé bas à gauche. Rien d’autre du tout. Le visuel le plus difficile à rater et le plus difficile à faire : tout tient dans le choix du mot.',
    slots: [sl('mot', 'UN mot, ou une interjection', 10)],
    nodes: [
      P(0, 0, 1, 1, { dark: 20 }),
      T('mot', 0.06, 0.6, 0.86, 0.28, 'paper', { font: 'serif', lh: 0.86, maxLines: 1, role: 'titre', shadow: true }),
    ],
  },
  {
    id: 'ds-serif-espace-bas', name: 'Serif interlettré en bas', family: 'photo-editorial',
    vibe: ['luxe', 'minimal', 'editorial'], intents: ['annonce', 'produit', 'accroche'],
    sectors: ['Mode', 'Beauté', 'Restaurant', 'Café'],
    photo: 'required',
    desc: 'Une rubrique minuscule très espacée tout en haut, et le titre en serif largement interlettré en bas. Deux extrémités du cadre, rien au milieu : la photo garde tout son centre.',
    slots: [sl('kicker', 'la rubrique', 22), sl('titre', 'le titre sur deux lignes', 34)],
    nodes: [
      P(0, 0, 1, 1, { dark: 22 }),
      T('kicker', 0.07, 0.055, 0.56, 0.021, 'paper', { font: 'body', upper: true, track: 0.34, maxLines: 1, role: 'tag', opacity: 86 }),
      T('titre', 0.07, 0.7, 0.82, 0.088, 'paper', { font: 'serif', upper: true, track: 0.06, lh: 1.08, maxLines: 2, role: 'titre' }),
    ],
  },
  {
    id: 'ds-citation-travers', name: 'La citation de travers', family: 'citation',
    vibe: ['ludique', 'chaleureux', 'audacieux'], intents: ['citation', 'accroche', 'conseil'],
    sectors: ['Restaurant', 'Café', 'Beauté', 'Santé'],
    photo: 'required',
    desc: 'Deux répliques manuscrites en couleur d’accent, posées de travers l’une au-dessus de l’autre, comme annotées à la main sur la photo. Le geste des carrousels de conseils qui circulent le plus.',
    slots: [sl('q1', 'la première réplique', 34), sl('q2', 'la réponse', 34)],
    nodes: [
      P(0, 0, 1, 1, { dark: 26 }),
      T('q1', 0.07, 0.085, 0.5, 0.062, 'accentLight', { font: 'script', lh: 1.05, maxLines: 2, role: 'accroche', rotation: -4 }),
      T('q2', 0.4, 0.275, 0.52, 0.062, 'paper', { font: 'script', lh: 1.05, maxLines: 2, role: 'accroche', rotation: 3 }),
    ],
  },
  {
    id: 'ds-badge-rond-haut', name: 'Badge rond et étiquette', family: 'sticker',
    vibe: ['ludique', 'retro', 'chaleureux'], intents: ['offre', 'annonce', 'produit'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Une étiquette de papier en haut à gauche pour le propos, et un badge rond de couleur en surimpression pour l’argument. Le duo papier/pastille qu’on voit sur les comptes de marques de boisson et de snack.',
    slots: [sl('titre', 'le propos, deux ou trois mots', 22), sl('badge', 'l’argument, très court', 14)],
    nodes: [
      P(0, 0, 1, 1, { dark: 8 }),
      R(0.05, 0.06, 0.44, 0.075, 'paper', { rotation: -3 }),
      T('titre', 0.05, 0.0805, 0.44, 0.036, 'ink', { align: 'center', upper: true, maxLines: 1, role: 'tag', weight: 'bold', rotation: -3 }),
      S('circle', 0.56, 0.15, 0.24, 0.192, 'brand', { rotation: -10 }),
      T('badge', 0.565, 0.222, 0.23, 0.034, 'onBrand', { align: 'center', upper: true, lh: 0.98, maxLines: 2, weight: 'bold', rotation: -10, role: 'tag' }),
    ],
  },
  {
    id: 'ds-arc-produit-haut', name: 'Rubrique en arc de cercle', family: 'photo-editorial',
    vibe: ['retro', 'ludique', 'chaleureux'], intents: ['produit', 'annonce', 'offre'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Trois mots posés en éventail au-dessus du sujet, chacun légèrement pivoté, pour épouser la courbe du produit photographié. L’effet d’étiquette de bouteille, sans rien recouvrir du plat.',
    slots: [sl('a1', 'premier mot', 10), sl('a2', 'mot du milieu', 12), sl('a3', 'dernier mot', 10)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      T('a1', 0.05, 0.115, 0.24, 0.05, 'paper', { align: 'center', upper: true, maxLines: 1, role: 'tag', weight: 'bold', rotation: -14, shadow: true }),
      T('a2', 0.3, 0.07, 0.3, 0.05, 'paper', { align: 'center', upper: true, maxLines: 1, role: 'tag', weight: 'bold', shadow: true }),
      T('a3', 0.62, 0.115, 0.24, 0.05, 'paper', { align: 'center', upper: true, maxLines: 1, role: 'tag', weight: 'bold', rotation: 14, shadow: true }),
    ],
  },


  // ══ LOT A — Objets graphiques posés sur la photo ═══════════════════════════
  //
  // RELEVÉ SUR LE TRI DE MARTIN (2026-09-04). Sur 105 compositions il en a gardé
  // 78, et les trois qu'il a citées comme justes sont `ds-badge-coin`,
  // `ds-texte-autocollant` et `ds-tampon` : toutes les trois posent un OBJET sur
  // la photo (pastille, autocollant cerné, tampon de travers) au lieu d'y poser
  // du texte à plat. Toutes les trois sont classées « partout », que le comptage
  // précédent tenait pour mauvais : la leçon est qu'écrire EN TRAVERS d'une photo
  // est mauvais, mais qu'y POSER UN OBJET ne l'est pas. C'est la direction de ce
  // lot, et il utilise le vocabulaire qui vient d'être ouvert : bloc de fond
  // derrière le texte (`bg`) et effets du panneau (`fx`).

  {
    id: 'ds-sceau-rond', name: 'Sceau rond', family: 'sticker',
    vibe: ['retro', 'chaleureux', 'audacieux'], intents: ['annonce', 'produit', 'preuve'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Un sceau circulaire en couleur de marque posé de travers en haut à droite, deux lignes dedans, et le titre calé en bas dans un bloc de fond. Le geste du cachet de qualité, celui qu’on colle sur un bocal.',
    slots: [sl('sceau', 'deux mots dans le sceau', 18), sl('titre', 'le titre', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 14 }),
      S('circle', 0.62, 0.05, 0.3, 0.24, 'brand', { rotation: -9 }),
      T('sceau', 0.635, 0.115, 0.27, 0.036, 'onBrand', { align: 'center', upper: true, lh: 1.02, maxLines: 2, weight: 'bold', rotation: -9, role: 'tag' }),
      T('titre', 0.07, 0.76, 0.66, 0.072, 'onAccent', { upper: true, lh: 1.05, maxLines: 2, role: 'titre', weight: 'bold', bg: 'accent', bgRadius: 4, bgPad: 0.5 }),
    ],
  },
  {
    id: 'ds-ruban-angle', name: 'Ruban d’angle', family: 'sticker',
    vibe: ['audacieux', 'ludique'], intents: ['offre', 'annonce'],
    sectors: ['Restaurant', 'Retail', 'Café'],
    photo: 'required',
    desc: 'Un ruban de couleur barre le coin haut-gauche en diagonale et porte la mention, la photo reste entière, le titre se pose en bas. Le code de l’étiquette de promotion, sans le clinquant.',
    slots: [sl('ruban', 'la mention du ruban', 14), sl('titre', 'le titre', 32)],
    nodes: [
      P(0, 0, 1, 1, { dark: 12 }),
      R(-0.14, 0.09, 0.5, 0.062, 'brand', { rotation: -38 }),
      T('ruban', -0.14, 0.1055, 0.5, 0.028, 'onBrand', { align: 'center', upper: true, track: 0.12, maxLines: 1, weight: 'bold', rotation: -38, role: 'tag' }),
      T('titre', 0.07, 0.74, 0.8, 0.098, 'paper', { upper: true, lh: 0.98, maxLines: 2, role: 'titre', weight: 'bold', fx: 'lift' }),
    ],
  },
  {
    id: 'ds-timbre', name: 'Timbre-poste', family: 'sticker',
    vibe: ['retro', 'editorial', 'chaleureux'], intents: ['annonce', 'evenement', 'coulisses'],
    sectors: ['Restaurant', 'Café', 'Culture'],
    photo: 'required',
    desc: 'Un timbre crème posé de travers en haut, la photo cadrée dedans, et une légende dactylographiée dessous. L’objet postal, qui fait immédiatement collection plutôt que publicité.',
    slots: [sl('titre', 'le titre du timbre', 22), sl('mention', 'la légende', 34)],
    nodes: [
      P(0, 0, 1, 1, { dark: 34 }),
      R(0.13, 0.13, 0.74, 0.5, 'paper', { rotation: -3 }),
      P(0.16, 0.16, 0.68, 0.36, { rotation: -3 }),
      T('titre', 0.16, 0.535, 0.68, 0.05, 'ink', { align: 'center', upper: true, track: 0.06, maxLines: 1, role: 'titre', weight: 'bold', rotation: -3 }),
      T('mention', 0.16, 0.66, 0.7, 0.028, 'paper', { font: 'body', align: 'center', upper: true, track: 0.2, maxLines: 2, role: 'sous-titre' }),
    ],
  },
  {
    id: 'ds-onglet-dossier', name: 'Onglet de dossier', family: 'sticker',
    vibe: ['minimal', 'editorial'], intents: ['annonce', 'menu', 'liste'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Un onglet de couleur dépasse en haut à gauche comme d’une chemise cartonnée, et le titre s’installe en bas sur un bloc plein. Le geste du classement, propre et net.',
    slots: [sl('onglet', 'le mot de l’onglet', 14), sl('titre', 'le titre', 34)],
    nodes: [
      P(0, 0, 1, 1, { dark: 12 }),
      R(0.06, 0, 0.34, 0.075, 'accent', { radius: 0.006 }),
      T('onglet', 0.06, 0.019, 0.34, 0.03, 'onAccent', { align: 'center', upper: true, track: 0.1, maxLines: 1, weight: 'bold', role: 'tag' }),
      T('titre', 0.06, 0.755, 0.72, 0.078, 'onBrand', { upper: true, lh: 1.04, maxLines: 2, role: 'titre', weight: 'bold', bg: 'brand', bgRadius: 0, bgPad: 0.52 }),
    ],
  },
  {
    id: 'ds-medaille', name: 'Médaille', family: 'preuve',
    vibe: ['luxe', 'retro', 'sobre'], intents: ['preuve', 'annonce'],
    sectors: ['Restaurant', 'Café', 'Beauté'],
    photo: 'required',
    desc: 'Un médaillon cerné d’un double filet au centre-bas, portant une distinction en trois lignes. La preuve traitée comme une récompense gravée, pas comme un logo d’avis en ligne.',
    slots: [sl('haut', 'la mention du haut', 16), sl('coeur', 'le mot central', 12), sl('bas', 'la mention du bas', 16)],
    nodes: [
      P(0, 0, 1, 1, { dark: 30 }),
      S('circle', 0.29, 0.5, 0.42, 0.336, 'none', { stroke: 'paper', strokeW: 0.003 }),
      S('circle', 0.315, 0.52, 0.37, 0.296, 'none', { stroke: 'paper', strokeW: 0.0012 }),
      T('haut', 0.32, 0.575, 0.36, 0.024, 'paper', { font: 'body', align: 'center', upper: true, track: 0.2, maxLines: 1, role: 'tag' }),
      T('coeur', 0.3, 0.625, 0.4, 0.072, 'accentLight', { align: 'center', upper: true, maxLines: 1, role: 'titre', weight: 'bold' }),
      T('bas', 0.32, 0.72, 0.36, 0.024, 'paper', { font: 'body', align: 'center', upper: true, track: 0.2, maxLines: 1, role: 'sous-titre' }),
    ],
  },
  {
    id: 'ds-etiquette-prix', name: 'Étiquette de prix', family: 'offre',
    vibe: ['ludique', 'audacieux'], intents: ['offre', 'menu', 'produit'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Une étiquette découpée pend en haut à droite avec le prix en gros, et le nom du plat se pose en bas sur un bloc de fond. On lit le prix avant tout le reste, ce qui est le but d’une offre.',
    slots: [sl('prix', 'le prix', 8), sl('libelle', 'le nom du plat', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 14 }),
      R(0.6, -0.02, 0.32, 0.2, 'accent', { rotation: 6, radius: 0.005 }),
      T('prix', 0.6, 0.062, 0.32, 0.08, 'onAccent', { align: 'center', maxLines: 1, weight: 'bold', rotation: 6, role: 'prix' }),
      T('libelle', 0.07, 0.775, 0.66, 0.062, 'onDeep', { upper: true, lh: 1.06, maxLines: 2, role: 'titre', weight: 'bold', bg: 'deep', bgRadius: 3, bgPad: 0.5 }),
    ],
  },
  {
    id: 'ds-punaise-carte', name: 'Carte punaisée', family: 'sticker',
    vibe: ['chaleureux', 'ludique', 'retro'], intents: ['annonce', 'evenement', 'coulisses'],
    sectors: ['Restaurant', 'Café', 'Culture'],
    photo: 'required',
    desc: 'Une fiche de papier posée de travers au centre-bas, tenue par une pastille ronde en haut, avec le message écrit dessus. Le mot laissé sur un tableau de liège.',
    slots: [sl('titre', 'le message, court', 34), sl('mention', 'la précision', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 22 }),
      R(0.14, 0.52, 0.72, 0.34, 'paper', { rotation: -2.5 }),
      S('circle', 0.475, 0.5, 0.05, 0.04, 'brand'),
      T('titre', 0.18, 0.61, 0.64, 0.064, 'ink', { align: 'center', lh: 1.08, maxLines: 2, role: 'titre', weight: 'bold', rotation: -2.5 }),
      T('mention', 0.2, 0.775, 0.6, 0.026, 'ink', { font: 'body', align: 'center', upper: true, track: 0.16, maxLines: 1, role: 'sous-titre', opacity: 66, rotation: -2.5 }),
    ],
  },
  {
    id: 'ds-neon-mot', name: 'Mot au néon', family: 'photo-editorial',
    vibe: ['audacieux', 'tech', 'ludique'], intents: ['accroche', 'evenement', 'annonce'],
    sectors: ['Restaurant', 'Café', 'Sport', 'Culture'],
    photo: 'required',
    desc: 'Un mot unique en très gros, cerné et brillant comme une enseigne au néon, posé au centre-bas de la photo assombrie. Fonctionne surtout de nuit, en intérieur, sur une photo sombre.',
    slots: [sl('mot', 'UN mot', 12)],
    nodes: [
      P(0, 0, 1, 1, { dark: 44 }),
      T('mot', 0.06, 0.6, 0.88, 0.17, 'deep', { font: 'condensed', align: 'center', upper: true, maxLines: 1, role: 'titre', weight: 'bold', fx: 'neon', fxCol: 'accentLight' }),
    ],
  },
  {
    id: 'ds-echo-titre', name: 'Titre en écho', family: 'photo-editorial',
    vibe: ['audacieux', 'retro', 'ludique'], intents: ['accroche', 'annonce'],
    sectors: ['Restaurant', 'Sport', 'Retail', 'Café'],
    photo: 'required',
    desc: 'Le titre se répète en décalé derrière lui-même, en couleur de marque, comme une impression mal calée. Le geste rétro qui donne du mouvement à une photo fixe.',
    slots: [sl('titre', 'le titre, deux mots', 20)],
    nodes: [
      P(0, 0, 1, 1, { dark: 26 }),
      T('titre', 0.07, 0.62, 0.78, 0.12, 'paper', { font: 'condensed', upper: true, lh: 0.94, maxLines: 2, role: 'titre', weight: 'bold', fx: 'echo', fxCol: 'brand' }),
    ],
  },
  {
    id: 'ds-bloc-plein-bas', name: 'Bloc plein en bas', family: 'photo-editorial',
    vibe: ['audacieux', 'sobre', 'minimal'], intents: ['annonce', 'accroche', 'produit'],
    sectors: ['Restaurant', 'Café', 'Retail', 'Sport'],
    photo: 'required',
    desc: 'Le titre est posé dans un bloc de couleur pleine qui épouse le texte, en bas à gauche, et rien d’autre. La lisibilité est garantie quelle que soit la photo : c’est la composition la plus sûre du répertoire.',
    slots: [sl('titre', 'le titre sur deux lignes', 38)],
    nodes: [
      P(0, 0, 1, 1, { dark: 8 }),
      T('titre', 0.06, 0.7, 0.7, 0.084, 'onBrand', { upper: true, lh: 1.06, maxLines: 2, role: 'titre', weight: 'bold', bg: 'brand', bgRadius: 0, bgPad: 0.55 }),
    ],
  },
  {
    id: 'ds-bloc-duo', name: 'Deux blocs empilés', family: 'photo-editorial',
    vibe: ['audacieux', 'ludique'], intents: ['annonce', 'offre', 'accroche'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Deux blocs de fond empilés et décalés, l’un en couleur de marque, l’autre en accent, chacun portant sa ligne. Le contraste des deux couleurs de la charte fait tout le travail.',
    slots: [sl('l1', 'la première ligne', 20), sl('l2', 'la seconde ligne', 20)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      T('l1', 0.07, 0.63, 0.6, 0.076, 'onBrand', { upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'brand', bgRadius: 0, bgPad: 0.5 }),
      T('l2', 0.12, 0.735, 0.62, 0.076, 'onAccent', { upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'accent', bgRadius: 0, bgPad: 0.5 }),
    ],
  },
  {
    id: 'ds-bloc-haut-tag', name: 'Bloc haut et pastille', family: 'photo-editorial',
    vibe: ['sobre', 'minimal'], intents: ['annonce', 'produit'],
    sectors: ['Restaurant', 'Café', 'Beauté', 'Retail'],
    photo: 'required',
    desc: 'Le titre dans un bloc de fond en haut à gauche, et une petite pastille d’accent juste en dessous pour la mention. Deux objets nets dans le tiers haut, la photo garde tout son sujet.',
    slots: [sl('titre', 'le titre', 30), sl('tag', 'la mention', 16)],
    nodes: [
      P(0, 0, 1, 1, { dark: 8 }),
      T('titre', 0.06, 0.06, 0.62, 0.072, 'onDeep', { upper: true, lh: 1.05, maxLines: 2, role: 'titre', weight: 'bold', bg: 'deep', bgRadius: 2, bgPad: 0.5 }),
      S('pill', 0.06, 0.245, 0.3, 0.05, 'accent'),
      T('tag', 0.06, 0.2585, 0.3, 0.024, 'onAccent', { align: 'center', upper: true, track: 0.1, maxLines: 1, weight: 'bold', role: 'tag' }),
    ],
  },
  {
    id: 'ds-brillance-chiffre', name: 'Chiffre brillant', family: 'offre',
    vibe: ['audacieux', 'ludique', 'tech'], intents: ['offre', 'preuve'],
    sectors: ['Restaurant', 'Sport', 'Retail'],
    photo: 'required',
    desc: 'Un chiffre énorme qui brille au centre, et son libellé en petites capitales dessous. Pour une remise, un anniversaire, un record : le nombre est le message.',
    slots: [sl('chiffre', 'le nombre', 6), sl('libelle', 'ce qu’il désigne', 26)],
    nodes: [
      P(0, 0, 1, 1, { dark: 40 }),
      T('chiffre', 0.08, 0.44, 0.84, 0.2, 'paper', { font: 'condensed', align: 'center', lh: 0.92, maxLines: 1, role: 'prix', weight: 'bold', fx: 'glow', fxCol: 'accentLight' }),
      T('libelle', 0.15, 0.63, 0.7, 0.03, 'paper', { font: 'body', align: 'center', upper: true, track: 0.26, maxLines: 1, role: 'sous-titre' }),
    ],
  },
  {
    id: 'ds-ticket-perfore', name: 'Ticket perforé', family: 'offre',
    vibe: ['retro', 'ludique'], intents: ['offre', 'evenement'],
    sectors: ['Restaurant', 'Café', 'Culture'],
    photo: 'required',
    desc: 'Un ticket crème en travers du bas, bordé d’une rangée de perforations, avec l’offre écrite dessus. L’objet détachable, qu’on a envie de garder.',
    slots: [sl('titre', 'l’offre', 26), sl('mention', 'la condition', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 18 }),
      R(0.05, 0.6, 0.9, 0.24, 'paper', { rotation: -2 }),
      R(0.05, 0.69, 0.9, 0.004, 'ink', { rotation: -2, opacity: 22 }),
      T('titre', 0.09, 0.625, 0.82, 0.056, 'ink', { align: 'center', upper: true, maxLines: 1, role: 'titre', weight: 'bold', rotation: -2 }),
      T('mention', 0.12, 0.73, 0.76, 0.026, 'ink', { font: 'body', align: 'center', upper: true, track: 0.14, maxLines: 2, role: 'sous-titre', opacity: 62, rotation: -2 }),
    ],
  },
  {
    id: 'ds-cocarde', name: 'Cocarde', family: 'sticker',
    vibe: ['retro', 'chaleureux'], intents: ['evenement', 'annonce', 'preuve'],
    sectors: ['Restaurant', 'Café', 'Culture'],
    photo: 'required',
    desc: 'Une cocarde en étoile posée de travers en haut à droite, et le titre en bas dans un bloc sombre. Le geste de la foire et du concours, chaleureux sans être kitsch.',
    slots: [sl('cocarde', 'le mot de la cocarde', 12), sl('titre', 'le titre', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 16 }),
      S('star', 0.6, 0.04, 0.32, 0.256, 'accent', { rotation: 12 }),
      T('cocarde', 0.62, 0.135, 0.28, 0.036, 'onAccent', { align: 'center', upper: true, maxLines: 1, weight: 'bold', rotation: 12, role: 'tag' }),
      T('titre', 0.07, 0.76, 0.68, 0.07, 'onDeep', { upper: true, lh: 1.05, maxLines: 2, role: 'titre', weight: 'bold', bg: 'deep', bgRadius: 3, bgPad: 0.5 }),
    ],
  },
  {
    id: 'ds-bande-adhesive', name: 'Bande adhésive', family: 'sticker',
    vibe: ['audacieux', 'ludique'], intents: ['annonce', 'offre'],
    sectors: ['Restaurant', 'Sport', 'Retail'],
    photo: 'required',
    desc: 'Une bande de couleur traverse la photo en biais au milieu, portant la mention en capitales serrées. Le ruban de chantier, franc et impossible à manquer.',
    slots: [sl('bande', 'la mention', 24), sl('titre', 'le titre', 28)],
    nodes: [
      P(0, 0, 1, 1, { dark: 20 }),
      R(-0.1, 0.42, 1.2, 0.09, 'accent', { rotation: -7 }),
      T('bande', -0.1, 0.4455, 1.2, 0.04, 'onAccent', { align: 'center', upper: true, track: 0.08, maxLines: 1, weight: 'bold', rotation: -7, role: 'tag' }),
      T('titre', 0.07, 0.71, 0.76, 0.084, 'paper', { upper: true, lh: 1.02, maxLines: 2, role: 'titre', weight: 'bold', fx: 'lift' }),
    ],
  },


  // ══ LOT B — Blocs de fond et découpes ═════════════════════════════════════
  //
  // « Plutôt utiliser tous les panneaux effets qu'il y a déjà » : ce lot exploite
  // le bloc de fond (`bg`), qui épouse le texte et garantit la lisibilité sur
  // n'importe quelle photo, et les découpes franches de l'image. Contrairement
  // au voile noir, un bloc de COULEUR DE MARQUE fait un visuel de marque et non
  // une légende posée sur une image.

  {
    id: 'ds-triptyque-mots', name: 'Triptyque de mots', family: 'photo-editorial',
    vibe: ['audacieux', 'minimal'], intents: ['accroche', 'liste', 'annonce'],
    sectors: ['Restaurant', 'Sport', 'Retail', 'Café'],
    photo: 'required',
    desc: 'Trois mots, trois blocs de fond alignés à gauche et décalés en escalier, alternant marque et accent. Une idée en trois temps, lisible en une seconde.',
    slots: [sl('m1', 'premier mot', 14), sl('m2', 'deuxième mot', 14), sl('m3', 'troisième mot', 14)],
    nodes: [
      P(0, 0, 1, 1, { dark: 12 }),
      T('m1', 0.06, 0.52, 0.5, 0.07, 'onBrand', { upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'brand', bgPad: 0.48 }),
      T('m2', 0.11, 0.63, 0.5, 0.07, 'onAccent', { upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'accent', bgPad: 0.48 }),
      T('m3', 0.16, 0.74, 0.5, 0.07, 'onDeep', { upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'deep', bgPad: 0.48 }),
    ],
  },
  {
    id: 'ds-cadre-blanc', name: 'Cadre de marge', family: 'photo-editorial',
    vibe: ['minimal', 'luxe', 'editorial'], intents: ['produit', 'accroche', 'annonce'],
    sectors: ['Mode', 'Beauté', 'Restaurant', 'Café'],
    photo: 'required',
    desc: 'La photo est réduite et cernée d’une large marge crème, le titre occupe le pied comme sur un tirage encadré. Le vide autour de l’image lui donne de la valeur.',
    slots: [sl('titre', 'le titre', 28), sl('mention', 'la mention', 26)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      P(0.075, 0.07, 0.85, 0.62),
      T('titre', 0.075, 0.73, 0.85, 0.072, 'ink', { font: 'serif', lh: 1.06, maxLines: 2, role: 'titre' }),
      T('mention', 0.075, 0.885, 0.7, 0.024, 'ink', { font: 'body', upper: true, track: 0.22, maxLines: 1, role: 'sous-titre', opacity: 58 }),
    ],
  },
  {
    id: 'ds-diagonale-couleur', name: 'Découpe diagonale', family: 'photo-editorial',
    vibe: ['audacieux', 'tech'], intents: ['annonce', 'offre', 'evenement'],
    sectors: ['Sport', 'Restaurant', 'Retail'],
    photo: 'required',
    desc: 'Un aplat de marque coupe la photo en diagonale par le bas et porte le titre. La découpe oblique donne de l’élan à une photo statique.',
    slots: [sl('titre', 'le titre', 32), sl('sous', 'la précision', 30)],
    nodes: [
      P(0, 0, 1, 1),
      R(-0.16, 0.62, 1.4, 0.6, 'brand', { rotation: -9 }),
      T('titre', 0.08, 0.7, 0.8, 0.084, 'onBrand', { upper: true, lh: 1.02, maxLines: 2, role: 'titre', weight: 'bold' }),
      T('sous', 0.08, 0.865, 0.7, 0.026, 'onBrand', { font: 'body', upper: true, track: 0.16, maxLines: 1, role: 'sous-titre', opacity: 82 }),
    ],
  },
  {
    id: 'ds-tiers-aplat', name: 'Deux tiers photo', family: 'photo-split',
    vibe: ['sobre', 'minimal', 'editorial'], intents: ['annonce', 'menu', 'produit'],
    sectors: ['Restaurant', 'Café', 'Beauté'],
    photo: 'required',
    desc: 'La photo occupe les deux tiers hauts, un aplat de marque ferme le tiers bas avec le titre et une pilule d’appel. Franc, structuré, reconnaissable d’un post à l’autre.',
    slots: [sl('titre', 'le titre', 36), sl('cta', 'l’appel à l’action', 18)],
    nodes: [
      P(0, 0, 1, 0.66),
      R(0, 0.66, 1, 0.34, 'brand'),
      T('titre', 0.07, 0.705, 0.86, 0.076, 'onBrand', { upper: true, lh: 1.04, maxLines: 2, role: 'titre', weight: 'bold' }),
      S('pill', 0.07, 0.865, 0.42, 0.058, 'accent'),
      T('cta', 0.07, 0.8815, 0.42, 0.026, 'onAccent', { align: 'center', upper: true, track: 0.1, maxLines: 1, weight: 'bold', role: 'cta' }),
    ],
  },
  {
    id: 'ds-colonne-verticale', name: 'Colonne de couleur', family: 'photo-split',
    vibe: ['minimal', 'editorial', 'tech'], intents: ['annonce', 'accroche'],
    sectors: ['Restaurant', 'Mode', 'Tech', 'Café'],
    photo: 'required',
    desc: 'Une colonne de marque tient le tiers gauche avec le titre à la verticale de lecture, la photo occupe le reste. Le format d’affiche de festival.',
    slots: [sl('titre', 'le titre', 30), sl('mention', 'la mention', 24)],
    nodes: [
      P(0.32, 0, 0.68, 1),
      R(0, 0, 0.32, 1, 'brand'),
      T('titre', 0.04, 0.42, 0.24, 0.064, 'onBrand', { upper: true, lh: 1.02, maxLines: 4, role: 'titre', weight: 'bold' }),
      T('mention', 0.04, 0.9, 0.24, 0.022, 'onBrand', { font: 'body', upper: true, track: 0.18, maxLines: 1, role: 'sous-titre', opacity: 76 }),
    ],
  },
  {
    id: 'ds-mot-negatif', name: 'Mot en négatif', family: 'aplat-typo',
    vibe: ['audacieux', 'minimal'], intents: ['accroche', 'annonce'],
    sectors: ['Restaurant', 'Sport', 'Mode', 'Retail'],
    photo: 'required',
    desc: 'Un bandeau de marque en travers du bas, et le mot fort évidé dedans : la couleur devient la lettre. Le geste graphique le plus fort du répertoire, à réserver aux mots courts.',
    slots: [sl('mot', 'UN mot court', 12), sl('sous', 'la précision', 28)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      R(0, 0.655, 1, 0.345, 'brand'),
      T('mot', 0.05, 0.7, 0.9, 0.145, 'onBrand', { font: 'condensed', align: 'center', upper: true, maxLines: 1, role: 'titre', weight: 'bold', hollow: true, strokeCol: 'onBrand', strokeW: 0.005 }),
      T('sous', 0.15, 0.885, 0.7, 0.026, 'onBrand', { font: 'body', align: 'center', upper: true, track: 0.2, maxLines: 1, role: 'sous-titre', opacity: 84 }),
    ],
  },
  {
    id: 'ds-numero-carrousel', name: 'Numéro de série', family: 'liste',
    vibe: ['editorial', 'minimal'], intents: ['liste', 'conseil'],
    sectors: ['Restaurant', 'Beauté', 'Santé', 'Café'],
    photo: 'required',
    desc: 'Un grand numéro d’ordre en haut à gauche, le titre en bas dans un bloc. Fait pour une série : le même dessin avec 01, 02, 03 tient un carrousel entier.',
    slots: [sl('num', 'le numéro', 4), sl('titre', 'le titre de l’étape', 34)],
    nodes: [
      P(0, 0, 1, 1, { dark: 18 }),
      T('num', 0.06, 0.05, 0.3, 0.13, 'accentLight', { font: 'condensed', maxLines: 1, weight: 'bold', role: 'tag' }),
      T('titre', 0.06, 0.72, 0.72, 0.076, 'onDeep', { upper: true, lh: 1.05, maxLines: 2, role: 'titre', weight: 'bold', bg: 'deep', bgPad: 0.5 }),
    ],
  },
  {
    id: 'ds-filet-encadre', name: 'Titre encadré au filet', family: 'photo-editorial',
    vibe: ['luxe', 'editorial', 'sobre'], intents: ['annonce', 'evenement', 'accroche'],
    sectors: ['Mode', 'Beauté', 'Restaurant', 'Culture'],
    photo: 'required',
    desc: 'Un cadre au filet fin enferme le titre en serif au centre-bas, sans aplat. La retenue d’un carton d’invitation, qui laisse la photo respirer.',
    slots: [sl('titre', 'le titre', 30), sl('mention', 'la mention', 24)],
    nodes: [
      P(0, 0, 1, 1, { dark: 24 }),
      S('rectangle', 0.1, 0.6, 0.8, 0.28, 'none', { stroke: 'paper', strokeW: 0.0012 }),
      T('titre', 0.14, 0.645, 0.72, 0.062, 'paper', { font: 'serif', align: 'center', lh: 1.1, maxLines: 2, role: 'titre' }),
      T('mention', 0.16, 0.805, 0.68, 0.022, 'paper', { font: 'body', align: 'center', upper: true, track: 0.24, maxLines: 1, role: 'sous-titre', opacity: 74 }),
    ],
  },
  {
    id: 'ds-souligne-epais', name: 'Souligné épais', family: 'photo-editorial',
    vibe: ['audacieux', 'minimal'], intents: ['accroche', 'annonce'],
    sectors: ['Restaurant', 'Sport', 'Retail', 'Café'],
    photo: 'required',
    desc: 'Le titre en bas à gauche, souligné d’un trait épais en couleur d’accent qui court sous la dernière ligne. Un seul geste de couleur, et la photo garde tout le reste.',
    slots: [sl('titre', 'le titre', 34)],
    nodes: [
      P(0, 0, 1, 1, { dark: 26 }),
      T('titre', 0.07, 0.66, 0.78, 0.098, 'paper', { upper: true, lh: 1.0, maxLines: 2, role: 'titre', weight: 'bold' }),
      R(0.07, 0.855, 0.42, 0.014, 'accent'),
    ],
  },
  {
    id: 'ds-pilules-menu', name: 'Menu en pilules', family: 'menu',
    vibe: ['ludique', 'sobre'], intents: ['menu', 'liste', 'offre'],
    sectors: ['Restaurant', 'Café'],
    photo: 'required',
    desc: 'Trois pilules empilées en bas, chacune portant un plat, sur la photo à peine assombrie. La carte lue en trois gestes, sans jamais recouvrir le plat photographié.',
    slots: [sl('p1', 'premier plat', 26), sl('p2', 'deuxième plat', 26), sl('p3', 'troisième plat', 26)],
    nodes: [
      P(0, 0, 1, 1, { dark: 16 }),
      T('p1', 0.07, 0.585, 0.62, 0.038, 'onPaper', { upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'paper', bgRadius: 999, bgPad: 0.7 }),
      T('p2', 0.07, 0.695, 0.62, 0.038, 'onPaper', { upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'paper', bgRadius: 999, bgPad: 0.7 }),
      T('p3', 0.07, 0.805, 0.62, 0.038, 'onAccent', { upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'accent', bgRadius: 999, bgPad: 0.7 }),
    ],
  },
  {
    id: 'ds-fleche-bas', name: 'Titre et flèche', family: 'photo-editorial',
    vibe: ['ludique', 'audacieux'], intents: ['accroche', 'conseil', 'annonce'],
    sectors: ['Restaurant', 'Café', 'Sport', 'Retail'],
    photo: 'required',
    desc: 'Le titre en haut dans un bloc, et une flèche d’accent qui descend vers le sujet de la photo. Elle dirige le regard au lieu de le laisser flotter.',
    slots: [sl('titre', 'le titre', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      T('titre', 0.06, 0.06, 0.64, 0.072, 'onDeep', { upper: true, lh: 1.05, maxLines: 2, role: 'titre', weight: 'bold', bg: 'deep', bgPad: 0.5 }),
      S('triangle', 0.13, 0.245, 0.1, 0.075, 'accent', { rotation: 180 }),
    ],
  },
  {
    id: 'ds-avant-apres-blocs', name: 'Avant et après', family: 'preuve',
    vibe: ['sobre', 'tech'], intents: ['preuve', 'conseil'],
    sectors: ['Beauté', 'Santé', 'Sport', 'Restaurant'],
    photo: 'required',
    desc: 'Deux blocs de fond côte à côte en bas, l’un neutre, l’autre en accent, pour opposer deux états. La démonstration la plus simple qui soit.',
    slots: [sl('avant', 'l’état de départ', 18), sl('apres', 'l’état d’arrivée', 18)],
    nodes: [
      P(0, 0, 1, 1, { dark: 20 }),
      T('avant', 0.06, 0.74, 0.38, 0.042, 'onDeep', { align: 'center', upper: true, maxLines: 2, role: 'tag', weight: 'bold', bg: 'deep', bgPad: 0.55 }),
      T('apres', 0.54, 0.74, 0.38, 0.042, 'onAccent', { align: 'center', upper: true, maxLines: 2, role: 'tag', weight: 'bold', bg: 'accent', bgPad: 0.55 }),
    ],
  },
  {
    id: 'ds-bandeau-signature', name: 'Bandeau de signature', family: 'photo-editorial',
    vibe: ['sobre', 'luxe'], intents: ['annonce', 'produit', 'coulisses'],
    sectors: ['Restaurant', 'Café', 'Mode', 'Beauté'],
    photo: 'required',
    desc: 'Un bandeau fin en pied porte le nom de la marque et une mention, le titre reste au-dessus sur la photo. La barre de signature qui fait la série d’un post à l’autre.',
    slots: [sl('titre', 'le titre', 32), sl('mention', 'la mention du bandeau', 24)],
    nodes: [
      P(0, 0, 1, 1, { dark: 24 }),
      T('titre', 0.07, 0.62, 0.78, 0.092, 'paper', { upper: true, lh: 1.02, maxLines: 2, role: 'titre', weight: 'bold' }),
      R(0, 0.9, 1, 0.1, 'brand'),
      F('{{marque}}', 0.06, 0.928, 0.44, 0.026, 'onBrand', { upper: true, track: 0.24, maxLines: 1, weight: 'bold' }),
      T('mention', 0.52, 0.928, 0.42, 0.026, 'onBrand', { font: 'body', align: 'right', upper: true, track: 0.14, maxLines: 1, role: 'sous-titre', opacity: 80 }),
    ],
  },
  {
    id: 'ds-etiquette-laterale', name: 'Étiquette latérale', family: 'sticker',
    vibe: ['minimal', 'tech', 'editorial'], intents: ['annonce', 'produit'],
    sectors: ['Mode', 'Retail', 'Tech', 'Restaurant'],
    photo: 'required',
    desc: 'Une étiquette de couleur dépasse du bord droit à mi-hauteur, et le titre se pose en bas à gauche. L’onglet qui sort de la page, discret et net.',
    slots: [sl('tag', 'le mot de l’étiquette', 14), sl('titre', 'le titre', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 14 }),
      R(0.66, 0.34, 0.34, 0.058, 'accent'),
      T('tag', 0.66, 0.3505, 0.3, 0.028, 'onAccent', { align: 'center', upper: true, track: 0.1, maxLines: 1, weight: 'bold', role: 'tag' }),
      T('titre', 0.07, 0.73, 0.7, 0.086, 'paper', { upper: true, lh: 1.02, maxLines: 2, role: 'titre', weight: 'bold', fx: 'lift' }),
    ],
  },
  {
    id: 'ds-quatre-pastilles', name: 'Quatre pastilles', family: 'liste',
    vibe: ['ludique', 'sobre'], intents: ['liste', 'menu', 'conseil'],
    sectors: ['Restaurant', 'Café', 'Beauté', 'Sport'],
    photo: 'required',
    desc: 'Quatre pastilles en damier dans le bas, deux par ligne, pour quatre arguments courts. La liste sans puce ni alignement de texte, qui reste graphique.',
    slots: [sl('a', 'premier', 14), sl('b', 'deuxième', 14), sl('c', 'troisième', 14), sl('d', 'quatrième', 14)],
    nodes: [
      P(0, 0, 1, 1, { dark: 20 }),
      T('a', 0.06, 0.63, 0.4, 0.032, 'onBrand', { align: 'center', upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'brand', bgRadius: 999, bgPad: 0.62 }),
      T('b', 0.52, 0.63, 0.4, 0.032, 'onPaper', { align: 'center', upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'paper', bgRadius: 999, bgPad: 0.62 }),
      T('c', 0.06, 0.74, 0.4, 0.032, 'onPaper', { align: 'center', upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'paper', bgRadius: 999, bgPad: 0.62 }),
      T('d', 0.52, 0.74, 0.4, 0.032, 'onAccent', { align: 'center', upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'accent', bgRadius: 999, bgPad: 0.62 }),
    ],
  },


  // ══ LOT C — Éditorial moderne ═════════════════════════════════════════════
  //
  // Le registre de presse et d'affiche, sans aplat ni objet : c'est la typographie
  // seule qui compose. Les tailles sont volontairement généreuses — l'ajustement
  // de l'éditeur réduit ce qui dépasse, alors qu'un titre trop petit ne grandira
  // jamais tout seul au-delà de sa mesure.

  {
    id: 'ds-kicker-titre-serif', name: 'Rubrique et serif', family: 'photo-editorial',
    vibe: ['editorial', 'luxe'], intents: ['accroche', 'annonce', 'coulisses'],
    sectors: ['Restaurant', 'Mode', 'Beauté', 'Café'],
    photo: 'required',
    desc: 'Une rubrique minuscule très espacée, un filet court, puis le titre en serif large. Trois signes, alignés à gauche dans le bas, et rien d’autre.',
    slots: [sl('kicker', 'la rubrique', 20), sl('titre', 'le titre', 40)],
    nodes: [
      P(0, 0, 1, 1, { dark: 28 }),
      T('kicker', 0.07, 0.6, 0.5, 0.022, 'accentLight', { font: 'body', upper: true, track: 0.28, maxLines: 1, role: 'tag' }),
      R(0.07, 0.645, 0.07, 0.003, 'accentLight'),
      T('titre', 0.07, 0.68, 0.8, 0.086, 'paper', { font: 'serif', lh: 1.06, maxLines: 3, role: 'titre' }),
    ],
  },
  {
    id: 'ds-titre-droite', name: 'Titre à droite', family: 'photo-editorial',
    vibe: ['minimal', 'editorial'], intents: ['accroche', 'produit'],
    sectors: ['Mode', 'Beauté', 'Restaurant', 'Café'],
    photo: 'required',
    desc: 'Le titre aligné à droite dans le bas, contre le bord. L’ancrage inverse de tous les autres : sur une photo dont le sujet est à gauche, c’est le seul juste.',
    slots: [sl('titre', 'le titre', 34), sl('sous', 'la précision', 28)],
    nodes: [
      P(0, 0, 1, 1, { dark: 26 }),
      T('titre', 0.2, 0.66, 0.73, 0.096, 'paper', { align: 'right', upper: true, lh: 1.0, maxLines: 2, role: 'titre', weight: 'bold' }),
      T('sous', 0.3, 0.85, 0.63, 0.026, 'accentLight', { font: 'body', align: 'right', upper: true, track: 0.18, maxLines: 1, role: 'sous-titre' }),
    ],
  },
  {
    id: 'ds-italique-centre', name: 'Italique centrée', family: 'citation',
    vibe: ['luxe', 'chaleureux', 'editorial'], intents: ['citation', 'accroche'],
    sectors: ['Restaurant', 'Beauté', 'Café', 'Mode'],
    photo: 'required',
    desc: 'Une phrase en serif italique, centrée au milieu-bas, encadrée de deux filets courts. Le ton de la confidence, pas de l’annonce.',
    slots: [sl('phrase', 'la phrase', 60)],
    nodes: [
      P(0, 0, 1, 1, { dark: 34 }),
      R(0.44, 0.6, 0.12, 0.002, 'paper', { opacity: 60 }),
      T('phrase', 0.12, 0.64, 0.76, 0.058, 'paper', { font: 'serif', italic: true, align: 'center', lh: 1.2, maxLines: 3, role: 'titre' }),
      R(0.44, 0.86, 0.12, 0.002, 'paper', { opacity: 60 }),
    ],
  },
  {
    id: 'ds-condense-trois', name: 'Trois lignes serrées', family: 'photo-editorial',
    vibe: ['audacieux', 'editorial'], intents: ['accroche', 'annonce'],
    sectors: ['Restaurant', 'Sport', 'Retail'],
    photo: 'required',
    desc: 'Trois lignes de condensé très serrées, interligne courte, calées en bas à gauche. Le bloc de titre d’un magazine de sport, dense et frontal.',
    slots: [sl('titre', 'le titre sur trois lignes', 46)],
    nodes: [
      P(0, 0, 1, 1, { dark: 30 }),
      T('titre', 0.06, 0.56, 0.82, 0.105, 'paper', { font: 'condensed', upper: true, lh: 0.9, maxLines: 3, role: 'titre', weight: 'bold', track: -0.02 }),
    ],
  },
  {
    id: 'ds-duo-couleur-mot', name: 'Un mot en couleur', family: 'photo-editorial',
    vibe: ['audacieux', 'ludique'], intents: ['accroche', 'annonce'],
    sectors: ['Restaurant', 'Café', 'Retail', 'Sport'],
    photo: 'required',
    desc: 'Le titre en deux lignes, dont la seconde passe en couleur d’accent : la phrase se lit d’un trait, mais l’œil s’arrête sur le mot qui compte.',
    slots: [sl('l1', 'le début du titre', 22), sl('l2', 'le mot qui compte', 20)],
    nodes: [
      P(0, 0, 1, 1, { dark: 26 }),
      T('l1', 0.07, 0.63, 0.8, 0.088, 'paper', { upper: true, maxLines: 1, role: 'sous-titre', weight: 'bold' }),
      T('l2', 0.07, 0.735, 0.8, 0.112, 'accentLight', { upper: true, maxLines: 1, role: 'titre', weight: 'bold' }),
    ],
  },
  {
    id: 'ds-manuscrit-haut', name: 'Manuscrit en haut', family: 'photo-editorial',
    vibe: ['chaleureux', 'ludique'], intents: ['accroche', 'coulisses'],
    sectors: ['Restaurant', 'Café', 'Beauté'],
    photo: 'required',
    desc: 'Un mot manuscrit posé grand dans le haut, et une ligne de capitales espacées dessous. Le geste humain en ouverture, la photo intacte en dessous.',
    slots: [sl('mot', 'le mot manuscrit', 16), sl('sous', 'la ligne de précision', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 16 }),
      T('mot', 0.06, 0.055, 0.62, 0.13, 'accentLight', { font: 'script', maxLines: 1, role: 'titre', rotation: -3, shadow: true }),
      T('sous', 0.06, 0.225, 0.56, 0.024, 'paper', { font: 'body', upper: true, track: 0.24, maxLines: 1, role: 'sous-titre' }),
    ],
  },
  {
    id: 'ds-grand-chiffre-cote', name: 'Chiffre de côté', family: 'preuve',
    vibe: ['audacieux', 'tech'], intents: ['preuve', 'offre'],
    sectors: ['Restaurant', 'Sport', 'Santé', 'Retail'],
    photo: 'required',
    desc: 'Un chiffre géant collé au bord gauche, coupé par le cadre, et le libellé à côté. Le débordement volontaire donne l’échelle et la modernité.',
    slots: [sl('chiffre', 'le nombre', 5), sl('libelle', 'ce qu’il désigne', 32)],
    nodes: [
      P(0, 0, 1, 1, { dark: 28 }),
      T('chiffre', -0.03, 0.56, 0.44, 0.26, 'accentLight', { font: 'condensed', maxLines: 1, weight: 'bold', role: 'prix' }),
      T('libelle', 0.44, 0.68, 0.5, 0.038, 'paper', { font: 'body', upper: true, track: 0.12, lh: 1.25, maxLines: 3, role: 'sous-titre' }),
    ],
  },
  {
    id: 'ds-deux-colonnes-bas', name: 'Deux colonnes en pied', family: 'photo-editorial',
    vibe: ['editorial', 'sobre'], intents: ['annonce', 'evenement', 'menu'],
    sectors: ['Restaurant', 'Café', 'Culture'],
    photo: 'required',
    desc: 'Le titre à gauche, l’information pratique à droite, séparés par un filet vertical. La mise en page d’un carton d’événement.',
    slots: [sl('titre', 'le titre', 28), sl('info', 'lieu, date, heure', 40)],
    nodes: [
      P(0, 0, 1, 1, { dark: 30 }),
      T('titre', 0.07, 0.68, 0.44, 0.07, 'paper', { upper: true, lh: 1.04, maxLines: 3, role: 'titre', weight: 'bold' }),
      R(0.55, 0.68, 0.002, 0.2, 'paper', { opacity: 40 }),
      T('info', 0.6, 0.68, 0.34, 0.028, 'paper', { font: 'body', upper: true, track: 0.1, lh: 1.5, maxLines: 4, role: 'sous-titre', opacity: 86 }),
    ],
  },
  {
    id: 'ds-mot-repete', name: 'Mot répété', family: 'aplat-typo',
    vibe: ['audacieux', 'ludique', 'retro'], intents: ['accroche', 'annonce'],
    sectors: ['Restaurant', 'Sport', 'Retail'],
    photo: 'required',
    desc: 'Le même mot répété sur trois lignes en fondu descendant, en travers du bas. L’effet de scansion, qui martèle une seule idée.',
    slots: [sl('mot', 'LE mot, répété', 14)],
    nodes: [
      P(0, 0, 1, 1, { dark: 30 }),
      T('mot', 0.05, 0.56, 0.9, 0.12, 'paper', { font: 'condensed', upper: true, maxLines: 1, weight: 'bold', role: 'titre' }),
      T('mot', 0.05, 0.68, 0.9, 0.12, 'paper', { font: 'condensed', upper: true, maxLines: 1, weight: 'bold', opacity: 55 }),
      T('mot', 0.05, 0.8, 0.9, 0.12, 'paper', { font: 'condensed', upper: true, maxLines: 1, weight: 'bold', opacity: 25 }),
    ],
  },
  {
    id: 'ds-coin-haut-gauche', name: 'Coin haut-gauche', family: 'photo-editorial',
    vibe: ['minimal', 'sobre'], intents: ['produit', 'annonce'],
    sectors: ['Mode', 'Beauté', 'Restaurant', 'Tech'],
    photo: 'required',
    desc: 'Un petit bloc de trois lignes serrées dans le coin haut-gauche, et rien d’autre du tout. La retenue maximale : la photo occupe quatre-vingt-quinze pour cent du visuel.',
    slots: [sl('titre', 'le titre', 24), sl('sous', 'la précision', 34)],
    nodes: [
      P(0, 0, 1, 1, { dark: 12 }),
      T('titre', 0.06, 0.06, 0.46, 0.05, 'paper', { upper: true, lh: 1.1, maxLines: 2, role: 'titre', weight: 'bold', shadow: true }),
      T('sous', 0.06, 0.185, 0.42, 0.022, 'paper', { font: 'body', maxLines: 2, role: 'sous-titre', opacity: 84, shadow: true }),
    ],
  },
  {
    id: 'ds-serif-geant-bas', name: 'Serif géant en pied', family: 'photo-editorial',
    vibe: ['luxe', 'editorial'], intents: ['accroche', 'produit'],
    sectors: ['Mode', 'Beauté', 'Restaurant'],
    photo: 'required',
    desc: 'Un titre en serif, très grand, deux lignes, qui occupe tout le pied du cadre. Aucun autre signe : c’est la typographie qui fait le visuel.',
    slots: [sl('titre', 'le titre, court', 26)],
    nodes: [
      P(0, 0, 1, 1, { dark: 30 }),
      T('titre', 0.06, 0.62, 0.88, 0.145, 'paper', { font: 'serif', lh: 0.98, maxLines: 2, role: 'titre' }),
    ],
  },
  {
    id: 'ds-tag-duo-haut', name: 'Deux rubriques en haut', family: 'photo-editorial',
    vibe: ['minimal', 'tech'], intents: ['annonce', 'liste'],
    sectors: ['Restaurant', 'Retail', 'Tech', 'Café'],
    photo: 'required',
    desc: 'Deux rubriques côte à côte en haut, séparées d’un point, et le titre juste dessous. Le fil d’Ariane d’un article, transposé sur une photo.',
    slots: [sl('t1', 'première rubrique', 14), sl('t2', 'seconde rubrique', 14), sl('titre', 'le titre', 32)],
    nodes: [
      P(0, 0, 1, 1, { dark: 20 }),
      T('t1', 0.06, 0.055, 0.24, 0.022, 'accentLight', { font: 'body', upper: true, track: 0.2, maxLines: 1, role: 'tag' }),
      T('t2', 0.33, 0.055, 0.3, 0.022, 'paper', { font: 'body', upper: true, track: 0.2, maxLines: 1, role: 'tag', opacity: 70 }),
      T('titre', 0.06, 0.1, 0.66, 0.086, 'paper', { upper: true, lh: 1.02, maxLines: 3, role: 'titre', weight: 'bold' }),
    ],
  },


  // ══ LOT D — Objets, suite ═════════════════════════════════════════════════

  {
    id: 'ds-double-autocollant', name: 'Double autocollant', family: 'sticker',
    vibe: ['ludique', 'audacieux'], intents: ['accroche', 'annonce', 'offre'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Deux autocollants de couleur se chevauchent en bas à gauche, l’un droit, l’autre de travers. La superposition fait main, comme deux étiquettes collées l’une après l’autre.',
    slots: [sl('a', 'le premier mot', 16), sl('b', 'le second mot', 16)],
    nodes: [
      P(0, 0, 1, 1, { dark: 12 }),
      T('a', 0.07, 0.68, 0.5, 0.058, 'onBrand', { upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'brand', bgRadius: 4, bgPad: 0.5, rotation: -3 }),
      T('b', 0.16, 0.775, 0.5, 0.058, 'onAccent', { upper: true, maxLines: 1, role: 'tag', weight: 'bold', bg: 'accent', bgRadius: 4, bgPad: 0.5, rotation: 2.5 }),
    ],
  },
  {
    id: 'ds-badge-brillant', name: 'Badge brillant', family: 'sticker',
    vibe: ['audacieux', 'tech', 'ludique'], intents: ['offre', 'annonce'],
    sectors: ['Restaurant', 'Sport', 'Retail'],
    photo: 'required',
    desc: 'Une pastille sombre en haut à droite dont le texte brille en couleur d’accent, et le titre en bas. Le halo attire l’œil sans aplat criard.',
    slots: [sl('badge', 'le mot du badge', 14), sl('titre', 'le titre', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 22 }),
      S('circle', 0.63, 0.05, 0.28, 0.224, 'deep', { rotation: -6 }),
      T('badge', 0.645, 0.118, 0.25, 0.034, 'onDeep', { align: 'center', upper: true, lh: 1.05, maxLines: 2, weight: 'bold', rotation: -6, role: 'tag', fx: 'glow', fxCol: 'accentLight' }),
      T('titre', 0.07, 0.74, 0.72, 0.09, 'paper', { upper: true, lh: 1.02, maxLines: 2, role: 'titre', weight: 'bold', fx: 'lift' }),
    ],
  },
  {
    id: 'ds-tampon-date', name: 'Tampon daté', family: 'sticker',
    vibe: ['retro', 'editorial'], intents: ['evenement', 'annonce'],
    sectors: ['Restaurant', 'Café', 'Culture'],
    photo: 'required',
    desc: 'Un tampon rectangulaire cerné, posé de travers au centre-bas, avec la date en gros et la mention au-dessus. Le cachet d’une administration, détourné en objet de marque.',
    slots: [sl('mention', 'la mention', 18), sl('date', 'la date', 16)],
    nodes: [
      P(0, 0, 1, 1, { dark: 26 }),
      S('rectangle', 0.2, 0.6, 0.6, 0.19, 'none', { stroke: 'accentLight', strokeW: 0.003, rotation: -7, radius: 0.004 }),
      T('mention', 0.22, 0.635, 0.56, 0.024, 'accentLight', { font: 'body', align: 'center', upper: true, track: 0.24, maxLines: 1, role: 'tag', rotation: -7 }),
      T('date', 0.22, 0.68, 0.56, 0.066, 'accentLight', { align: 'center', upper: true, maxLines: 1, role: 'titre', weight: 'bold', rotation: -7 }),
    ],
  },
  {
    id: 'ds-bulle-coin', name: 'Bulle en coin', family: 'sticker',
    vibe: ['ludique', 'chaleureux'], intents: ['citation', 'accroche', 'preuve'],
    sectors: ['Restaurant', 'Café', 'Beauté'],
    photo: 'required',
    desc: 'Une bulle de bande dessinée en haut à droite avec une réplique courte, et le titre en bas. Le commentaire posé sur la scène, plutôt que la légende sous l’image.',
    slots: [sl('bulle', 'la réplique', 30), sl('titre', 'le titre', 28)],
    nodes: [
      P(0, 0, 1, 1, { dark: 14 }),
      T('bulle', 0.46, 0.06, 0.44, 0.036, 'onPaper', { align: 'center', lh: 1.2, maxLines: 3, role: 'tag', weight: 'bold', bg: 'paper', bgRadius: 14, bgPad: 0.7, rotation: 3 }),
      T('titre', 0.07, 0.76, 0.68, 0.08, 'paper', { upper: true, lh: 1.03, maxLines: 2, role: 'titre', weight: 'bold', fx: 'lift' }),
    ],
  },
  {
    id: 'ds-carte-verre', name: 'Carte translucide', family: 'carte-ui',
    vibe: ['tech', 'minimal', 'luxe'], intents: ['annonce', 'produit', 'conseil'],
    sectors: ['Tech', 'Beauté', 'Restaurant', 'Retail'],
    photo: 'required',
    desc: 'Une carte sombre à demi transparente posée dans le bas, avec titre et texte dedans. Le voile devient un objet, ce qui vaut mieux qu’un dégradé anonyme.',
    slots: [sl('titre', 'le titre', 28), sl('texte', 'le texte', 70)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      R(0.06, 0.58, 0.88, 0.34, 'deep', { radius: 0.015, opacity: 82 }),
      T('titre', 0.1, 0.62, 0.8, 0.06, 'onDeep', { upper: true, lh: 1.05, maxLines: 2, role: 'titre', weight: 'bold' }),
      T('texte', 0.1, 0.755, 0.78, 0.028, 'onDeep', { font: 'body', lh: 1.45, maxLines: 3, role: 'corps', opacity: 84 }),
    ],
  },
  {
    id: 'ds-etoile-prix', name: 'Étoile de prix', family: 'offre',
    vibe: ['ludique', 'retro', 'audacieux'], intents: ['offre', 'produit'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Une étoile éclatée en couleur d’accent porte le prix en haut à droite, le nom du plat se cale en bas. Le code de la promotion de quartier, franc et joyeux.',
    slots: [sl('prix', 'le prix', 8), sl('libelle', 'le nom du plat', 28)],
    nodes: [
      P(0, 0, 1, 1, { dark: 12 }),
      S('star', 0.58, 0.03, 0.36, 0.288, 'accent', { rotation: -14 }),
      T('prix', 0.6, 0.135, 0.32, 0.062, 'onAccent', { align: 'center', maxLines: 1, weight: 'bold', rotation: -14, role: 'prix' }),
      T('libelle', 0.07, 0.79, 0.66, 0.066, 'onDeep', { upper: true, lh: 1.05, maxLines: 2, role: 'titre', weight: 'bold', bg: 'deep', bgRadius: 3, bgPad: 0.48 }),
    ],
  },
  {
    id: 'ds-losange-mention', name: 'Losange de mention', family: 'sticker',
    vibe: ['minimal', 'tech'], intents: ['annonce', 'preuve'],
    sectors: ['Tech', 'Retail', 'Restaurant'],
    photo: 'required',
    desc: 'Un losange d’accent au centre-droit porte une mention courte, le titre reste en bas à gauche. La forme géométrique franche, qui ne ressemble à aucune pastille.',
    slots: [sl('mention', 'la mention', 14), sl('titre', 'le titre', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 18 }),
      S('diamond', 0.62, 0.26, 0.28, 0.224, 'accent'),
      T('mention', 0.63, 0.345, 0.26, 0.03, 'onAccent', { align: 'center', upper: true, lh: 1.05, maxLines: 2, weight: 'bold', role: 'tag' }),
      T('titre', 0.07, 0.74, 0.68, 0.086, 'paper', { upper: true, lh: 1.02, maxLines: 2, role: 'titre', weight: 'bold', fx: 'lift' }),
    ],
  },
  {
    id: 'ds-bandeau-haut-plein', name: 'Bandeau plein en haut', family: 'photo-editorial',
    vibe: ['audacieux', 'sobre'], intents: ['annonce', 'offre', 'evenement'],
    sectors: ['Restaurant', 'Café', 'Retail', 'Sport'],
    photo: 'required',
    desc: 'Un bandeau de marque occupe le quart haut avec le titre dedans, la photo tient tout le reste. L’inverse du bandeau bas, pour une photo dont le sujet est en bas.',
    slots: [sl('titre', 'le titre', 34), sl('sous', 'la précision', 28)],
    nodes: [
      R(0, 0, 1, 0.27, 'brand'),
      P(0, 0.27, 1, 0.73),
      T('titre', 0.07, 0.055, 0.86, 0.078, 'onBrand', { upper: true, lh: 1.02, maxLines: 2, role: 'titre', weight: 'bold' }),
      T('sous', 0.07, 0.205, 0.7, 0.024, 'onBrand', { font: 'body', upper: true, track: 0.16, maxLines: 1, role: 'sous-titre', opacity: 84 }),
    ],
  },
  {
    id: 'ds-carre-central', name: 'Carré central', family: 'aplat-typo',
    vibe: ['minimal', 'luxe'], intents: ['citation', 'accroche', 'annonce'],
    sectors: ['Mode', 'Beauté', 'Restaurant', 'Café'],
    photo: 'required',
    desc: 'Un carré crème posé au centre exact de la photo, avec une phrase courte en serif dedans. La symétrie parfaite, à réserver aux photos dont le centre est calme.',
    slots: [sl('phrase', 'la phrase, courte', 40)],
    nodes: [
      P(0, 0, 1, 1, { dark: 18 }),
      R(0.17, 0.34, 0.66, 0.32, 'paper'),
      T('phrase', 0.21, 0.4, 0.58, 0.056, 'onPaper', { font: 'serif', align: 'center', lh: 1.15, maxLines: 3, role: 'titre' }),
    ],
  },
  {
    id: 'ds-liste-numerotee', name: 'Liste numérotée', family: 'liste',
    vibe: ['sobre', 'editorial'], intents: ['liste', 'conseil', 'menu'],
    sectors: ['Restaurant', 'Beauté', 'Santé', 'Café'],
    photo: 'required',
    desc: 'Trois lignes numérotées en accent dans le bas, chacune sur sa ligne, sans puce ni cadre. La liste la plus sobre du répertoire, celle qui se lit vraiment.',
    slots: [sl('u1', 'premier point', 30), sl('u2', 'deuxième point', 30), sl('u3', 'troisième point', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 34 }),
      F('01', 0.07, 0.6, 0.08, 0.026, 'accentLight', { font: 'body', maxLines: 1, weight: 'bold' }),
      T('u1', 0.16, 0.594, 0.76, 0.036, 'paper', { maxLines: 1, role: 'corps' }),
      F('02', 0.07, 0.69, 0.08, 0.026, 'accentLight', { font: 'body', maxLines: 1, weight: 'bold' }),
      T('u2', 0.16, 0.684, 0.76, 0.036, 'paper', { maxLines: 1, role: 'corps' }),
      F('03', 0.07, 0.78, 0.08, 0.026, 'accentLight', { font: 'body', maxLines: 1, weight: 'bold' }),
      T('u3', 0.16, 0.774, 0.76, 0.036, 'paper', { maxLines: 1, role: 'corps' }),
    ],
  },
  {
    id: 'ds-hexagone-tag', name: 'Hexagone', family: 'sticker',
    vibe: ['tech', 'audacieux'], intents: ['annonce', 'preuve', 'produit'],
    sectors: ['Tech', 'Sport', 'Retail'],
    photo: 'required',
    desc: 'Un hexagone de marque en haut à gauche porte une mention courte, et le titre s’installe en bas. La forme technique, pour les marques qui ne veulent pas d’arrondi.',
    slots: [sl('tag', 'la mention', 12), sl('titre', 'le titre', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 16 }),
      S('hexagon', 0.05, 0.05, 0.26, 0.208, 'brand'),
      T('tag', 0.055, 0.128, 0.25, 0.03, 'onBrand', { align: 'center', upper: true, lh: 1.05, maxLines: 2, weight: 'bold', role: 'tag' }),
      T('titre', 0.07, 0.75, 0.72, 0.086, 'paper', { upper: true, lh: 1.02, maxLines: 2, role: 'titre', weight: 'bold', fx: 'lift' }),
    ],
  },
  {
    id: 'ds-question-bloc', name: 'La question en bloc', family: 'photo-editorial',
    vibe: ['ludique', 'chaleureux'], intents: ['accroche', 'conseil'],
    sectors: ['Restaurant', 'Beauté', 'Santé', 'Café'],
    photo: 'required',
    desc: 'Une question posée dans un bloc d’accent en bas, et la réponse en une ligne dessous sur la photo. L’aller-retour qui fait commenter.',
    slots: [sl('question', 'la question', 40), sl('reponse', 'la réponse', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 20 }),
      T('question', 0.07, 0.63, 0.72, 0.062, 'onAccent', { lh: 1.1, maxLines: 2, role: 'titre', weight: 'bold', bg: 'accent', bgRadius: 6, bgPad: 0.5 }),
      T('reponse', 0.07, 0.83, 0.62, 0.03, 'paper', { font: 'body', upper: true, track: 0.14, maxLines: 1, role: 'sous-titre', shadow: true }),
    ],
  },
  {
    id: 'ds-signature-bas-droite', name: 'Signature en bas à droite', family: 'photo-editorial',
    vibe: ['chaleureux', 'luxe'], intents: ['coulisses', 'produit'],
    sectors: ['Restaurant', 'Café', 'Beauté', 'Mode'],
    photo: 'required',
    desc: 'La photo presque nue, et seulement une signature manuscrite dans le coin bas-droit. Le minimum absolu : la marque signe son image et se tait.',
    slots: [sl('signature', 'le mot manuscrit', 16)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      T('signature', 0.42, 0.79, 0.5, 0.096, 'paper', { font: 'script', align: 'right', maxLines: 1, role: 'titre', rotation: -4, shadow: true }),
    ],
  },
  {
    id: 'ds-triangle-coin', name: 'Coin plein', family: 'photo-editorial',
    vibe: ['audacieux', 'minimal', 'tech'], intents: ['annonce', 'offre'],
    sectors: ['Sport', 'Retail', 'Restaurant'],
    photo: 'required',
    desc: 'Un triangle de marque remplit le coin bas-gauche et porte deux lignes courtes. La découpe la plus économe : un seul geste de couleur, en angle.',
    slots: [sl('l1', 'la première ligne', 16), sl('l2', 'la seconde', 16)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      S('triangle', -0.12, 0.5, 0.9, 0.72, 'brand', { rotation: -90 }),
      T('l1', 0.06, 0.7, 0.42, 0.05, 'onBrand', { upper: true, maxLines: 1, role: 'tag', weight: 'bold' }),
      T('l2', 0.06, 0.775, 0.36, 0.05, 'onBrand', { upper: true, maxLines: 1, role: 'titre', weight: 'bold' }),
    ],
  },
  {
    id: 'ds-mot-cle-glow', name: 'Mot-clé brillant', family: 'photo-editorial',
    vibe: ['tech', 'audacieux'], intents: ['accroche', 'annonce'],
    sectors: ['Sport', 'Tech', 'Restaurant', 'Culture'],
    photo: 'required',
    desc: 'Le titre en blanc, et sous lui un seul mot qui brille en couleur d’accent. Le contraste mat contre lumineux, sans changer de taille.',
    slots: [sl('titre', 'le titre', 30), sl('mot', 'le mot qui brille', 16)],
    nodes: [
      P(0, 0, 1, 1, { dark: 38 }),
      T('titre', 0.07, 0.6, 0.8, 0.072, 'paper', { upper: true, lh: 1.04, maxLines: 2, role: 'sous-titre', weight: 'bold' }),
      T('mot', 0.07, 0.755, 0.8, 0.108, 'deep', { font: 'condensed', upper: true, maxLines: 1, role: 'titre', weight: 'bold', fx: 'neon', fxCol: 'accentLight' }),
    ],
  },


  // ══ LOT E — Familles d'usage ══════════════════════════════════════════════
  //
  // Le comptage du 2026-09-03 avait montré que menu, événement, offre et preuve
  // ne comptaient qu'une ou trois recettes chacune, alors que ce sont les posts
  // qu'un restaurant publie toutes les semaines. Ce lot les nourrit.

  {
    id: 'ds-menu-jour', name: 'Menu du jour', family: 'menu',
    vibe: ['chaleureux', 'sobre'], intents: ['menu', 'annonce'],
    sectors: ['Restaurant', 'Café'],
    photo: 'required',
    desc: 'Un en-tête en bloc de marque avec le jour, puis deux plats et un prix, alignés dans le bas. La formule du midi, lisible depuis le trottoir.',
    slots: [sl('jour', 'le jour', 16), sl('plat1', 'le plat', 34), sl('plat2', 'le second plat', 34), sl('prix', 'le prix', 8)],
    nodes: [
      P(0, 0, 1, 1, { dark: 34 }),
      T('jour', 0.07, 0.53, 0.4, 0.034, 'onBrand', { upper: true, track: 0.08, maxLines: 1, role: 'tag', weight: 'bold', bg: 'brand', bgPad: 0.5 }),
      T('plat1', 0.07, 0.645, 0.66, 0.044, 'paper', { font: 'serif', maxLines: 1, role: 'corps' }),
      T('plat2', 0.07, 0.72, 0.66, 0.044, 'paper', { font: 'serif', maxLines: 1, role: 'corps' }),
      T('prix', 0.07, 0.82, 0.3, 0.078, 'accentLight', { maxLines: 1, weight: 'bold', role: 'prix' }),
    ],
  },
  {
    id: 'ds-menu-carte-pliee', name: 'Carte pliée', family: 'menu',
    vibe: ['luxe', 'editorial'], intents: ['menu'],
    sectors: ['Restaurant', 'Café'],
    photo: 'required',
    desc: 'Une carte crème occupe la moitié basse, la photo la moitié haute, avec une rubrique en petites capitales et trois lignes de plats. Le menu posé sur la table.',
    slots: [sl('rubrique', 'la rubrique', 18), sl('a', 'premier plat', 30), sl('b', 'deuxième plat', 30), sl('c', 'troisième plat', 30)],
    nodes: [
      P(0, 0, 1, 0.52),
      R(0, 0.52, 1, 0.48, 'paper'),
      T('rubrique', 0.09, 0.57, 0.5, 0.024, 'accentDeep', { font: 'body', upper: true, track: 0.26, maxLines: 1, role: 'tag' }),
      T('a', 0.09, 0.635, 0.82, 0.04, 'ink', { font: 'serif', maxLines: 1, role: 'corps' }),
      T('b', 0.09, 0.72, 0.82, 0.04, 'ink', { font: 'serif', maxLines: 1, role: 'corps' }),
      T('c', 0.09, 0.805, 0.82, 0.04, 'ink', { font: 'serif', maxLines: 1, role: 'corps' }),
    ],
  },
  {
    id: 'ds-evenement-affiche', name: 'Affiche d’événement', family: 'evenement',
    vibe: ['audacieux', 'retro'], intents: ['evenement', 'annonce'],
    sectors: ['Restaurant', 'Café', 'Culture', 'Sport'],
    photo: 'required',
    desc: 'Le nom de l’événement en très gros au centre, la date en bloc au-dessus, le lieu en pied. La structure d’une affiche collée en ville.',
    slots: [sl('date', 'la date', 16), sl('titre', 'le nom', 26), sl('lieu', 'le lieu', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 40 }),
      T('date', 0.3, 0.34, 0.4, 0.028, 'onAccent', { align: 'center', upper: true, track: 0.14, maxLines: 1, role: 'tag', weight: 'bold', bg: 'accent', bgPad: 0.5 }),
      T('titre', 0.06, 0.44, 0.88, 0.14, 'paper', { font: 'condensed', align: 'center', upper: true, lh: 0.92, maxLines: 2, role: 'titre', weight: 'bold' }),
      T('lieu', 0.15, 0.79, 0.7, 0.026, 'paper', { font: 'body', align: 'center', upper: true, track: 0.24, maxLines: 1, role: 'sous-titre', opacity: 84 }),
    ],
  },
  {
    id: 'ds-evenement-compte', name: 'Compte à rebours', family: 'evenement',
    vibe: ['audacieux', 'tech'], intents: ['evenement', 'offre'],
    sectors: ['Restaurant', 'Sport', 'Retail', 'Culture'],
    photo: 'required',
    desc: 'Un nombre de jours en géant qui brille, le mot « jours » dessous, et l’événement en pied. L’urgence dite par un chiffre plutôt que par un point d’exclamation.',
    slots: [sl('n', 'le nombre', 3), sl('unite', 'l’unité', 12), sl('quoi', 'l’événement', 30)],
    nodes: [
      P(0, 0, 1, 1, { dark: 44 }),
      T('n', 0.15, 0.34, 0.7, 0.26, 'paper', { font: 'condensed', align: 'center', maxLines: 1, weight: 'bold', role: 'prix', fx: 'glow', fxCol: 'accentLight' }),
      T('unite', 0.3, 0.63, 0.4, 0.03, 'paper', { font: 'body', align: 'center', upper: true, track: 0.3, maxLines: 1, role: 'tag' }),
      T('quoi', 0.1, 0.78, 0.8, 0.05, 'paper', { align: 'center', upper: true, lh: 1.06, maxLines: 2, role: 'titre', weight: 'bold' }),
    ],
  },
  {
    id: 'ds-offre-deux-temps', name: 'Offre en deux temps', family: 'offre',
    vibe: ['audacieux', 'ludique'], intents: ['offre'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'La condition en petit dans un bloc sombre, la remise en géant dessous en couleur d’accent. On lit la remise, puis la condition : l’ordre qui fait cliquer.',
    slots: [sl('condition', 'la condition', 30), sl('remise', 'la remise', 10)],
    nodes: [
      P(0, 0, 1, 1, { dark: 26 }),
      T('condition', 0.07, 0.6, 0.6, 0.03, 'onDeep', { upper: true, track: 0.1, maxLines: 1, role: 'tag', weight: 'bold', bg: 'deep', bgPad: 0.55 }),
      T('remise', 0.07, 0.67, 0.7, 0.19, 'accentLight', { font: 'condensed', maxLines: 1, weight: 'bold', role: 'prix' }),
    ],
  },
  {
    id: 'ds-offre-barre', name: 'Prix barré', family: 'offre',
    vibe: ['ludique', 'audacieux'], intents: ['offre', 'produit'],
    sectors: ['Restaurant', 'Retail', 'Café'],
    photo: 'required',
    desc: 'L’ancien prix barré en petit, le nouveau en gros à côté. Le geste du marché : la comparaison se fait à l’œil, sans une phrase.',
    slots: [sl('avant', 'l’ancien prix', 8), sl('apres', 'le nouveau prix', 8), sl('libelle', 'ce qui est en offre', 28)],
    nodes: [
      P(0, 0, 1, 1, { dark: 24 }),
      T('libelle', 0.07, 0.6, 0.7, 0.036, 'paper', { font: 'body', upper: true, track: 0.14, maxLines: 2, role: 'sous-titre' }),
      T('avant', 0.07, 0.7, 0.22, 0.062, 'paper', { maxLines: 1, opacity: 62, strike: true, role: 'sous-titre' }),
      T('apres', 0.32, 0.68, 0.44, 0.13, 'accentLight', { font: 'condensed', maxLines: 1, weight: 'bold', role: 'prix' }),
    ],
  },
  {
    id: 'ds-preuve-etoiles', name: 'Cinq étoiles', family: 'preuve',
    vibe: ['chaleureux', 'sobre'], intents: ['preuve'],
    sectors: ['Restaurant', 'Café', 'Beauté', 'Santé'],
    photo: 'required',
    desc: 'Une rangée de cinq étoiles d’accent, l’avis en dessous, la signature en pied. La preuve sociale dans son code universel, sans capture d’écran.',
    slots: [sl('avis', 'l’avis, court', 70), sl('qui', 'le prénom', 24)],
    nodes: [
      P(0, 0, 1, 1, { dark: 38 }),
      S('star', 0.07, 0.57, 0.06, 0.048, 'accentLight'),
      S('star', 0.15, 0.57, 0.06, 0.048, 'accentLight'),
      S('star', 0.23, 0.57, 0.06, 0.048, 'accentLight'),
      S('star', 0.31, 0.57, 0.06, 0.048, 'accentLight'),
      S('star', 0.39, 0.57, 0.06, 0.048, 'accentLight'),
      T('avis', 0.07, 0.66, 0.8, 0.05, 'paper', { font: 'serif', italic: true, lh: 1.18, maxLines: 3, role: 'corps' }),
      T('qui', 0.07, 0.87, 0.6, 0.024, 'paper', { font: 'body', upper: true, track: 0.2, maxLines: 1, role: 'sous-titre', opacity: 72 }),
    ],
  },
  {
    id: 'ds-preuve-chiffre-bloc', name: 'Le chiffre qui prouve', family: 'preuve',
    vibe: ['sobre', 'tech'], intents: ['preuve', 'annonce'],
    sectors: ['Restaurant', 'Sport', 'Santé', 'Retail'],
    photo: 'required',
    desc: 'Un chiffre dans un bloc de marque, et la phrase qu’il prouve juste à côté. La donnée mise en objet plutôt qu’en légende.',
    slots: [sl('n', 'le chiffre', 6), sl('quoi', 'ce qu’il prouve', 40)],
    nodes: [
      P(0, 0, 1, 1, { dark: 30 }),
      T('n', 0.07, 0.66, 0.3, 0.1, 'onBrand', { align: 'center', maxLines: 1, weight: 'bold', role: 'prix', bg: 'brand', bgPad: 0.4 }),
      T('quoi', 0.45, 0.67, 0.48, 0.034, 'paper', { font: 'body', upper: true, track: 0.1, lh: 1.35, maxLines: 3, role: 'sous-titre' }),
    ],
  },
  {
    id: 'ds-citation-bloc-large', name: 'Citation en bloc', family: 'citation',
    vibe: ['editorial', 'audacieux'], intents: ['citation', 'accroche'],
    sectors: ['Restaurant', 'Café', 'Culture', 'Beauté'],
    photo: 'required',
    desc: 'La citation dans un large bloc de marque qui traverse le bas, et l’auteur en pied sur la photo. Le pavé de couleur donne à la phrase le poids d’une déclaration.',
    slots: [sl('phrase', 'la citation', 70), sl('qui', 'de qui', 26)],
    nodes: [
      P(0, 0, 1, 1, { dark: 14 }),
      T('phrase', 0.07, 0.58, 0.8, 0.05, 'onBrand', { font: 'serif', lh: 1.24, maxLines: 3, role: 'titre', bg: 'brand', bgPad: 0.48 }),
      T('qui', 0.07, 0.88, 0.6, 0.024, 'paper', { font: 'body', upper: true, track: 0.2, maxLines: 1, role: 'sous-titre', shadow: true }),
    ],
  },
  {
    id: 'ds-coulisses-polaroid', name: 'Coulisses en polaroid', family: 'photo-editorial',
    vibe: ['chaleureux', 'retro'], intents: ['coulisses', 'produit'],
    sectors: ['Restaurant', 'Café', 'Mode'],
    photo: 'required',
    desc: 'La photo dans un cadre polaroid légèrement de travers, sur un fond de marque, avec une légende manuscrite dessous. L’album de l’équipe, pas la campagne.',
    slots: [sl('legende', 'la légende manuscrite', 26)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      R(0.1, 0.1, 0.8, 0.72, 'paper', { rotation: -2.5 }),
      P(0.13, 0.13, 0.74, 0.52, { rotation: -2.5 }),
      T('legende', 0.14, 0.685, 0.72, 0.058, 'ink', { font: 'script', align: 'center', maxLines: 1, role: 'titre', rotation: -2.5 }),
    ],
  },
  {
    id: 'ds-conseil-numero-bloc', name: 'Le conseil numéroté', family: 'liste',
    vibe: ['sobre', 'chaleureux'], intents: ['conseil', 'liste'],
    sectors: ['Restaurant', 'Beauté', 'Santé', 'Café'],
    photo: 'required',
    desc: 'Un numéro dans une pastille d’accent, le conseil dans un bloc sombre juste dessous. Fait pour la série : trois posts avec 1, 2, 3 tiennent une semaine.',
    slots: [sl('n', 'le numéro', 3), sl('conseil', 'le conseil', 44)],
    nodes: [
      P(0, 0, 1, 1, { dark: 22 }),
      S('circle', 0.07, 0.55, 0.13, 0.104, 'accent'),
      T('n', 0.07, 0.583, 0.13, 0.05, 'onAccent', { align: 'center', maxLines: 1, weight: 'bold', role: 'tag' }),
      T('conseil', 0.07, 0.7, 0.76, 0.056, 'onDeep', { lh: 1.14, maxLines: 3, role: 'titre', weight: 'bold', bg: 'deep', bgPad: 0.48 }),
    ],
  },
  {
    id: 'ds-produit-fleche-prix', name: 'Flèche vers le prix', family: 'offre',
    vibe: ['ludique', 'audacieux'], intents: ['offre', 'produit', 'menu'],
    sectors: ['Restaurant', 'Café', 'Retail'],
    photo: 'required',
    desc: 'Une flèche d’accent pointe depuis le titre vers le prix posé plus bas. Le regard suit le trait, ce qui vaut mieux que deux blocs qui s’ignorent.',
    slots: [sl('titre', 'le nom du produit', 26), sl('prix', 'le prix', 8)],
    nodes: [
      P(0, 0, 1, 1, { dark: 26 }),
      T('titre', 0.07, 0.56, 0.6, 0.056, 'paper', { upper: true, lh: 1.05, maxLines: 2, role: 'titre', weight: 'bold' }),
      S('arrow', 0.1, 0.68, 0.16, 0.09, 'accent', { rotation: 90 }),
      T('prix', 0.32, 0.7, 0.5, 0.14, 'accentLight', { font: 'condensed', maxLines: 1, weight: 'bold', role: 'prix' }),
    ],
  },
  {
    id: 'ds-annonce-deux-blocs-haut', name: 'Deux blocs en haut', family: 'photo-editorial',
    vibe: ['sobre', 'minimal'], intents: ['annonce', 'produit'],
    sectors: ['Restaurant', 'Café', 'Retail', 'Beauté'],
    photo: 'required',
    desc: 'Une rubrique en bloc d’accent, le titre en bloc sombre juste dessous, tous deux dans le tiers haut. Deux objets nets, et la photo garde son sujet.',
    slots: [sl('tag', 'la rubrique', 16), sl('titre', 'le titre', 32)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      T('tag', 0.06, 0.06, 0.34, 0.03, 'onAccent', { upper: true, track: 0.1, maxLines: 1, role: 'tag', weight: 'bold', bg: 'accent', bgPad: 0.55 }),
      T('titre', 0.06, 0.14, 0.62, 0.072, 'onDeep', { upper: true, lh: 1.05, maxLines: 2, role: 'titre', weight: 'bold', bg: 'deep', bgPad: 0.5 }),
    ],
  },
  {
    id: 'ds-plein-cadre-mot', name: 'Un mot plein cadre', family: 'aplat-typo',
    vibe: ['audacieux', 'minimal'], intents: ['accroche'],
    sectors: ['Restaurant', 'Sport', 'Mode', 'Retail'],
    photo: 'required',
    desc: 'Un seul mot, en condensé, si grand qu’il touche les deux bords et déborde légèrement. La photo n’est plus qu’une matière derrière la lettre.',
    slots: [sl('mot', 'UN mot court', 10)],
    nodes: [
      P(0, 0, 1, 1, { dark: 32 }),
      T('mot', -0.02, 0.4, 1.04, 0.24, 'paper', { font: 'condensed', align: 'center', upper: true, maxLines: 1, role: 'titre', weight: 'bold', track: -0.03 }),
    ],
  },


  // ══ LOT F — Le surlignage, et le texte posé nu ════════════════════════════
  //
  // MESURÉ LE 2026-09-05 SUR LE VRAI COMPTE D'UN CLIENT. La lecture du fil a
  // relevé deux procédés, et elle avait raison : `surlignage` et `texte-nu`. Or
  // sur 150 recettes, TROIS utilisaient le surlignage et UNE SEULE le combinait
  // avec une écriture en bas de photo. Le modèle voyait juste et n'avait rien à
  // proposer : le manque était dans le répertoire, pas dans l'intelligence.
  //
  // La grammaire visée, relevée sur ses publications : titre gras sur trois ou
  // quatre lignes en bas à gauche, posé À MÊME la photo sans voile, dont UNE
  // ligne est surlignée en couleur d'accent, parfois un mot cerclé à la main, et
  // un entête discret nom-et-rôle en haut. Aucun aplat, aucun voile : c'est le
  // refus du voile qui fait le style, et c'est exactement ce que « texte-nu »
  // désigne.

  {
    id: 'ds-surlignage-bas', name: 'Surlignage en bas', family: 'photo-editorial',
    vibe: ['audacieux', 'chaleureux'], intents: ['accroche', 'conseil', 'annonce'],
    sectors: ['Restaurant', 'Beauté', 'Santé', 'Café', 'Tech'],
    photo: 'required',
    desc: 'Un titre gras sur trois lignes posé à même la photo en bas à gauche, dont la dernière est surlignée en couleur d’accent. Aucun voile : c’est le refus du fond sombre qui fait le style.',
    slots: [sl('l1', 'première ligne', 26), sl('l2', 'deuxième ligne', 26), sl('l3', 'la ligne surlignée', 24)],
    nodes: [
      P(0, 0, 1, 1, { dark: 8 }),
      T('l1', 0.07, 0.6, 0.84, 0.082, 'paper', { maxLines: 1, role: 'titre', weight: 'bold', shadow: true }),
      T('l2', 0.07, 0.695, 0.84, 0.082, 'paper', { maxLines: 1, role: 'titre', weight: 'bold', shadow: true }),
      T('l3', 0.07, 0.79, 0.8, 0.082, 'onAccent', { maxLines: 1, role: 'titre', weight: 'bold', hl: 'accent', hlRadius: 6, hlPad: 14 }),
    ],
  },
  {
    id: 'ds-surlignage-milieu', name: 'Surlignage au milieu du titre', family: 'photo-editorial',
    vibe: ['audacieux', 'chaleureux'], intents: ['accroche', 'conseil'],
    sectors: ['Restaurant', 'Beauté', 'Santé', 'Café', 'Tech'],
    photo: 'required',
    desc: 'Trois lignes en bas, la ligne du MILIEU surlignée. Le regard s’arrête au centre de la phrase plutôt qu’à sa fin, ce qui change complètement le rythme de lecture.',
    slots: [sl('l1', 'première ligne', 26), sl('l2', 'la ligne surlignée', 24), sl('l3', 'dernière ligne', 26)],
    nodes: [
      P(0, 0, 1, 1, { dark: 8 }),
      T('l1', 0.07, 0.6, 0.84, 0.082, 'paper', { maxLines: 1, role: 'titre', weight: 'bold', shadow: true }),
      T('l2', 0.07, 0.695, 0.8, 0.082, 'onAccent', { maxLines: 1, role: 'titre', weight: 'bold', hl: 'accent', hlRadius: 6, hlPad: 14 }),
      T('l3', 0.07, 0.79, 0.84, 0.082, 'paper', { maxLines: 1, role: 'titre', weight: 'bold', shadow: true }),
    ],
  },
  {
    id: 'ds-mot-cercle', name: 'Le mot cerclé', family: 'photo-editorial',
    vibe: ['chaleureux', 'ludique', 'audacieux'], intents: ['accroche', 'conseil', 'annonce'],
    sectors: ['Restaurant', 'Beauté', 'Santé', 'Café', 'Culture'],
    photo: 'required',
    desc: 'Le titre en bas, posé nu sur la photo, et un mot entouré d’une ellipse tracée de travers en couleur d’accent. Le geste de l’annotation à la main, celui qui fait qu’un visuel n’a pas l’air fabriqué.',
    slots: [sl('l1', 'première ligne, le mot fort à la fin', 26), sl('l2', 'deuxième ligne', 28)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      S('circle', 0.42, 0.625, 0.46, 0.086, 'none', { stroke: 'accentLight', strokeW: 0.004, rotation: -2.5 }),
      T('l1', 0.07, 0.615, 0.86, 0.09, 'paper', { maxLines: 1, role: 'titre', weight: 'bold', shadow: true }),
      T('l2', 0.07, 0.72, 0.86, 0.09, 'paper', { maxLines: 2, role: 'titre', weight: 'bold', shadow: true }),
    ],
  },
  {
    id: 'ds-entete-role', name: 'Entête nom et rôle', family: 'photo-editorial',
    vibe: ['sobre', 'chaleureux', 'editorial'], intents: ['coulisses', 'preuve', 'accroche'],
    sectors: ['Beauté', 'Santé', 'Tech', 'Restaurant', 'Culture'],
    photo: 'required',
    desc: 'Le nom en haut à gauche, le rôle en haut à droite, et le titre en bas posé nu. La signature d’un compte de personne plutôt que de marque : on sait tout de suite qui parle.',
    slots: [sl('role', 'le rôle, sur deux lignes', 40), sl('titre', 'le titre', 44)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      F('{{marque}}', 0.06, 0.05, 0.42, 0.03, 'paper', { maxLines: 1, shadow: true }),
      T('role', 0.52, 0.05, 0.42, 0.03, 'paper', { align: 'right', lh: 1.3, maxLines: 2, role: 'tag', shadow: true }),
      T('titre', 0.07, 0.68, 0.86, 0.088, 'paper', { lh: 1.08, maxLines: 3, role: 'titre', weight: 'bold', shadow: true }),
    ],
  },
  {
    id: 'ds-entete-surligne', name: 'Entête et ligne surlignée', family: 'photo-editorial',
    vibe: ['chaleureux', 'audacieux'], intents: ['accroche', 'conseil', 'coulisses'],
    sectors: ['Beauté', 'Santé', 'Tech', 'Restaurant', 'Culture'],
    photo: 'required',
    desc: 'La grammaire complète : entête nom et rôle en haut, titre gras en bas posé nu, dernière ligne surlignée en accent. Rien d’autre, et surtout aucun voile.',
    slots: [sl('role', 'le rôle', 36), sl('l1', 'première ligne', 28), sl('l2', 'la ligne surlignée', 24)],
    nodes: [
      P(0, 0, 1, 1, { dark: 8 }),
      F('{{marque}}', 0.06, 0.05, 0.42, 0.028, 'paper', { maxLines: 1, shadow: true }),
      T('role', 0.52, 0.05, 0.42, 0.028, 'paper', { align: 'right', lh: 1.3, maxLines: 2, role: 'tag', shadow: true }),
      T('l1', 0.07, 0.66, 0.86, 0.088, 'paper', { lh: 1.06, maxLines: 2, role: 'titre', weight: 'bold', shadow: true }),
      T('l2', 0.07, 0.815, 0.8, 0.088, 'onAccent', { maxLines: 1, role: 'titre', weight: 'bold', hl: 'accent', hlRadius: 6, hlPad: 15 }),
    ],
  },
  {
    id: 'ds-surlignage-question', name: 'Question surlignée', family: 'photo-editorial',
    vibe: ['ludique', 'chaleureux'], intents: ['accroche', 'conseil'],
    sectors: ['Beauté', 'Santé', 'Restaurant', 'Café', 'Tech'],
    photo: 'required',
    desc: 'Une question en gras posée nu sur la photo, dont les deux derniers mots sont surlignés. Le surlignage sert d’intonation : il dit où appuyer la voix.',
    slots: [sl('debut', 'le début de la question', 34), sl('fin', 'la fin, surlignée', 22)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      T('debut', 0.07, 0.63, 0.86, 0.086, 'paper', { lh: 1.06, maxLines: 2, role: 'titre', weight: 'bold', shadow: true }),
      T('fin', 0.07, 0.8, 0.78, 0.086, 'onAccent', { maxLines: 1, role: 'titre', weight: 'bold', hl: 'accent', hlRadius: 6, hlPad: 15 }),
    ],
  },
  {
    id: 'ds-surlignage-haut', name: 'Surlignage en haut', family: 'photo-editorial',
    vibe: ['audacieux', 'chaleureux'], intents: ['annonce', 'accroche', 'offre'],
    sectors: ['Restaurant', 'Beauté', 'Café', 'Tech'],
    photo: 'required',
    desc: 'La même grammaire, mais ancrée en haut : deux lignes posées nu dans le tiers supérieur, la seconde surlignée. Pour les photos dont le sujet occupe le bas.',
    slots: [sl('l1', 'première ligne', 26), sl('l2', 'la ligne surlignée', 24)],
    nodes: [
      P(0, 0, 1, 1, { dark: 8 }),
      T('l1', 0.07, 0.06, 0.72, 0.082, 'paper', { maxLines: 1, role: 'titre', weight: 'bold', shadow: true }),
      T('l2', 0.07, 0.155, 0.68, 0.082, 'onAccent', { maxLines: 1, role: 'titre', weight: 'bold', hl: 'accent', hlRadius: 6, hlPad: 14 }),
    ],
  },
  {
    id: 'ds-nu-quatre-lignes', name: 'Quatre lignes posées nu', family: 'photo-editorial',
    vibe: ['chaleureux', 'editorial'], intents: ['accroche', 'conseil', 'citation'],
    sectors: ['Beauté', 'Santé', 'Restaurant', 'Culture', 'Tech'],
    photo: 'required',
    desc: 'Un paragraphe de quatre lignes en gras, posé à même la photo en bas à gauche, sans le moindre fond. La photo est simplement assombrie ce qu’il faut : elle garde toutes ses couleurs.',
    slots: [sl('titre', 'la phrase, quatre lignes', 76)],
    nodes: [
      P(0, 0, 1, 1, { dark: 22 }),
      T('titre', 0.07, 0.56, 0.86, 0.082, 'paper', { lh: 1.1, maxLines: 4, role: 'titre', weight: 'bold', shadow: true }),
    ],
  },
  {
    id: 'ds-surlignage-double', name: 'Deux lignes surlignées', family: 'photo-editorial',
    vibe: ['audacieux', 'ludique'], intents: ['accroche', 'offre', 'annonce'],
    sectors: ['Restaurant', 'Retail', 'Sport', 'Café'],
    photo: 'required',
    desc: 'Deux lignes surlignées l’une sous l’autre, de largeurs différentes, sur une photo nue. Le bloc de couleur naît du texte lui-même au lieu d’être un rectangle posé derrière.',
    slots: [sl('l1', 'première ligne', 22), sl('l2', 'seconde ligne', 26)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      T('l1', 0.07, 0.66, 0.66, 0.086, 'onAccent', { maxLines: 1, role: 'titre', weight: 'bold', hl: 'accent', hlRadius: 6, hlPad: 15 }),
      T('l2', 0.07, 0.775, 0.78, 0.086, 'onBrand', { maxLines: 1, role: 'titre', weight: 'bold', hl: 'brand', hlRadius: 6, hlPad: 15 }),
    ],
  },
  {
    id: 'ds-cercle-et-surlignage', name: 'Cerclé et surligné', family: 'photo-editorial',
    vibe: ['ludique', 'chaleureux', 'audacieux'], intents: ['accroche', 'conseil'],
    sectors: ['Beauté', 'Santé', 'Restaurant', 'Culture'],
    photo: 'required',
    desc: 'Les deux gestes ensemble : une ligne surlignée, et un mot cerclé à la main sur la ligne au-dessus. À réserver aux marques qui assument l’annotation, sinon c’est trop.',
    slots: [sl('l1', 'la ligne au mot cerclé', 26), sl('l2', 'la ligne surlignée', 24)],
    nodes: [
      P(0, 0, 1, 1, { dark: 10 }),
      S('circle', 0.44, 0.635, 0.42, 0.082, 'none', { stroke: 'accentLight', strokeW: 0.004, rotation: -3 }),
      T('l1', 0.07, 0.625, 0.86, 0.086, 'paper', { maxLines: 1, role: 'titre', weight: 'bold', shadow: true }),
      T('l2', 0.07, 0.755, 0.78, 0.086, 'onAccent', { maxLines: 1, role: 'titre', weight: 'bold', hl: 'accent', hlRadius: 6, hlPad: 15 }),
    ],
  },
  {
    id: 'ds-nu-centre-bas', name: 'Posé nu, centré', family: 'photo-editorial',
    vibe: ['chaleureux', 'minimal'], intents: ['accroche', 'citation'],
    sectors: ['Beauté', 'Santé', 'Culture', 'Restaurant'],
    photo: 'required',
    desc: 'Trois lignes centrées en bas, posées nu, dont la dernière surlignée. Le centrage adoucit : la même grammaire, mais moins frontale que l’alignement à gauche.',
    slots: [sl('l1', 'première ligne', 26), sl('l2', 'deuxième ligne', 26), sl('l3', 'la ligne surlignée', 22)],
    nodes: [
      P(0, 0, 1, 1, { dark: 14 }),
      T('l1', 0.08, 0.6, 0.84, 0.078, 'paper', { align: 'center', maxLines: 1, role: 'titre', weight: 'bold', shadow: true }),
      T('l2', 0.08, 0.69, 0.84, 0.078, 'paper', { align: 'center', maxLines: 1, role: 'titre', weight: 'bold', shadow: true }),
      T('l3', 0.16, 0.78, 0.68, 0.078, 'onAccent', { align: 'center', maxLines: 1, role: 'titre', weight: 'bold', hl: 'accent', hlRadius: 6, hlPad: 15 }),
    ],
  },
  {
    id: 'ds-surlignage-kicker', name: 'Rubrique surlignée', family: 'photo-editorial',
    vibe: ['sobre', 'audacieux'], intents: ['annonce', 'liste', 'conseil'],
    sectors: ['Restaurant', 'Beauté', 'Tech', 'Café'],
    photo: 'required',
    desc: 'Une petite rubrique surlignée au-dessus du titre, comme un signet. Le surlignage sert ici d’étiquette et non d’insistance, ce qui laisse le titre respirer.',
    slots: [sl('kicker', 'la rubrique, deux mots', 18), sl('titre', 'le titre', 46)],
    nodes: [
      P(0, 0, 1, 1, { dark: 12 }),
      T('kicker', 0.07, 0.6, 0.36, 0.032, 'onAccent', { upper: true, track: 0.06, maxLines: 1, role: 'tag', weight: 'bold', hl: 'accent', hlRadius: 4, hlPad: 12 }),
      T('titre', 0.07, 0.685, 0.86, 0.086, 'paper', { lh: 1.08, maxLines: 3, role: 'titre', weight: 'bold', shadow: true }),
    ],
  },

];

// ── Résolution sur la charte ─────────────────────────────────────────────────

export interface BuildBrand {
  primary?: string | null; secondary?: string | null; accent?: string | null;
  /** Polices de la charte : titre et texte. */
  display?: string | null; body?: string | null;
  /** Nom de la marque et compte, pour les rails et pieds de page. */
  name?: string | null; handle?: string | null;
  /** Secteur et ton : ils ne servent pas qu'à écrire les textes, ils CHOISISSENT
   *  l'identité typographique. Sans eux, toutes les marques repartent sur la
   *  même — c'est-à-dire sur aucune. */
  sector?: string | null; tone?: string | null;
  /**
   * Les deux décisions MESURÉES sur le compte du client, quand son ADN visuel a
   * été relevé (`lib/brandDNA.ts`). Elles court-circuitent le choix par secteur,
   * ton et empreinte du nom, qui reste le comportement par défaut.
   *
   * Sans ces deux champs, un client analysé recevait quand même le terrain de
   * son empreinte : l'analyse s'affichait à l'écran et ne changeait rien aux
   * visuels, ce qui est la pire façon de livrer une mesure.
   */
  colorwayId?: string | null; typeIdentityId?: string | null;
}

const HEX = /^#([0-9a-f]{6})$/i;
const hex = (v?: string | null): string | null => {
  const s = String(v ?? '').trim();
  return HEX.test(s) ? s.toUpperCase() : null;
};
function relLum(h: string): number {
  const n = parseInt(h.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Le blanc et le noir purs restent des constantes : ce sont des ABSOLUS du
// vocabulaire (texte blanc sur photo, aplat noir), pas des choix de terrain.
// Le papier et l'encre, eux, viennent du terrain de la marque.
const WHITE = '#FFFFFF', BLACK = '#0A0A0A';

/** Mélange deux couleurs, `t` = part de `b`. */
function mix(a: string, b: string, t: number): string {
  const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
  const c = (sh: number) => {
    const va = (na >> sh) & 255, vb = (nb >> sh) & 255;
    return Math.round(va + (vb - va) * t);
  };
  return `#${[c(16), c(8), c(0)].map(v => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}
/** Éclaircit (ou assombrit) juste ce qu'il faut pour atteindre une luminance. */
function versLum(c: string, cible: number, vers: string): string {
  let out = c;
  for (let i = 0; i < 10; i++) {
    if (vers === WHITE ? relLum(out) >= cible : relLum(out) <= cible) break;
    out = mix(out, vers, 0.12);
  }
  return out;
}
/** Encre lisible sur un fond donné — jamais la couleur d'origine si elle disparaît. */

// Familles déjà « d'affiche » ou déjà serif : quand la charte en fournit une, on
// l'utilise plutôt que d'imposer la nôtre. Le geste typographique compte, mais
// pas au prix de la charte du client.
const DISPLAY_FAMILIES = ['anton', 'archivo black', 'bebas neue', 'oswald', 'barlow condensed', 'syne', 'impact', 'league gothic', 'teko'];
const SERIF_FAMILIES = ['playfair display', 'lora', 'merriweather', 'dm serif display', 'cormorant', 'cormorant garamond', 'libre baskerville', 'eb garamond', 'crimson pro', 'instrument serif'];

export function resolvePalette(brand: BuildBrand) {
  // LE TERRAIN. Le fond clair, l'encre et le fond sombre étaient trois
  // constantes, donc identiques d'un client à l'autre : deux visuels de marques
  // opposées partageaient la majorité de leur surface. Ils viennent maintenant
  // d'un terrain choisi pour CETTE marque (`colorway.ts`). Les couleurs de la
  // charte, elles, ne bougent pas : c'est le sol qui change, pas la marque.
  const way = pickColorway({ name: brand.name, sector: brand.sector, tone: brand.tone, colorwayId: brand.colorwayId });
  const INK = way.ink, PAPER = way.paper;
  // L'encre lisible SUR une couleur donnée. Elle doit venir du TERRAIN : une
  // encre générique donnerait du brun sur le papier et du vert-noir sur l'aplat
  // de marque, dans le même visuel.
  const encreSur = (bg: string): string => (relLum(bg) > 0.42 ? INK : WHITE);
  const primary = hex(brand.primary) ?? INK;
  let accent = hex(brand.accent) ?? hex(brand.secondary) ?? way.accent;
  // Beaucoup de chartes déclarent un « accent » quasi blanc (le crème d'un fond,
  // le blanc d'un logo). Sur un fond clair il devient invisible : pastilles,
  // surlignages et filets disparaissent, et la composition se vide de ses
  // repères sans qu'on comprenne pourquoi.
  //
  // On lui cherche un remplaçant DANS la charte, et dans cet ordre : la couleur
  // secondaire d'abord — c'est presque toujours la vraie couleur d'appoint de la
  // marque — puis la couleur principale, puis l'encre. Prendre la principale
  // trop tôt était une erreur : l'accent devenait identique au fond de marque,
  // et un bouton rouge sur un aplat rouge ne se voit pas plus qu'un blanc sur
  // du blanc.
  const ecart = (a: string, b: string) => Math.abs(relLum(a) - relLum(b));
  const lisible = (c: string) => ecart(c, PAPER) >= 0.16;
  if (!lisible(accent)) {
    const secours = hex(brand.secondary);
    accent = (secours && secours !== accent && lisible(secours)) ? secours
      : lisible(primary) ? primary
        // Dernier recours : l'accent du terrain plutôt que l'encre. Retomber sur
        // l'encre revenait à effacer l'accent — une pastille noire sur fond clair
        // n'est plus un repère de couleur, c'est un trou.
        : lisible(way.accent) ? way.accent
          : INK;
  }
  const secondary = hex(brand.secondary) ?? accent;
  const map: Record<Col, string> = {
    brand: primary, accent, secondary,
    ink: INK, paper: PAPER, white: WHITE, black: BLACK,
    surface: way.surface, deep: way.deep,
    onBrand: encreSur(primary), onAccent: encreSur(accent), onSecondary: encreSur(secondary), onPaper: INK,
    onSurface: encreSur(way.surface), onDeep: encreSur(way.deep),
    accentLight: relLum(accent) >= 0.34 ? accent : versLum(accent, 0.4, WHITE),
    accentDeep: relLum(accent) <= 0.55 ? accent : versLum(accent, 0.42, INK),
    accentOnBrand: ecart(accent, primary) >= 0.18 ? accent : encreSur(primary),
  };
  return map;
}

/**
 * Les cinq rôles typographiques d'un visuel, résolus sur la marque.
 *
 * Avant : la police de la charte (ou Archivo), et trois constantes en dur pour
 * les gestes — Anton, Playfair Display, Caveat, les mêmes pour tous les clients.
 * C'est la raison typographique du « ça fait généré ». Maintenant, une identité
 * choisie pour CETTE marque (`typeIdentity.ts`) fournit les gestes, et son
 * titrage prend le relais quand la charte n'en déclare pas.
 *
 * La charte reste souveraine : si le client a une police de titre, elle titre.
 */
export function resolveFonts(brand: BuildBrand) {
  const ident = pickTypeIdentity({ name: brand.name, sector: brand.sector, tone: brand.tone, typeIdentityId: brand.typeIdentityId });
  const charteDisplay = (brand.display || '').trim();
  const charteBody = (brand.body || '').trim();
  const display = charteDisplay || ident.display;
  const body = charteBody || (charteDisplay || ident.body);
  const low = (s: string) => s.toLowerCase();
  return {
    ident,
    display, body,
    /** La police de titre vient-elle de la charte ? La graisse en dépend. */
    displayDeLaCharte: !!charteDisplay,
    // Geste d'affiche et geste de presse : ceux de la charte quand elle joue
    // déjà ce rôle (sinon on remplacerait une identité par la nôtre), sinon
    // ceux de l'identité.
    // LA CHARTE DU CLIENT PASSE AVANT L'IDENTITÉ DÉDUITE, TOUJOURS.
    //
    // Avant, le geste d'affiche n'acceptait la police du client que si elle
    // figurait dans une liste écrite en dur. Une police IMPORTÉE — donc absente
    // de tout catalogue, ce qui est le cas de toutes les vraies chartes — n'y
    // était jamais, et la recette repartait sur la police d'une identité
    // déduite du NOM du client. Résultat : un client qui a déposé sa police
    // voyait ses visuels composés dans une autre, sans que rien ne le dise.
    // Une police de titre déclarée EST la police d'affiche de la marque.
    condensed: charteDisplay || (DISPLAY_FAMILIES.includes(low(display)) ? display : ident.condensed),
    // Le serif reste un GESTE : si la charte n'en déclare pas, on garde celui de
    // l'identité plutôt que d'étirer une grotesque dans un rôle qu'elle ne tient
    // pas. Mais une charte serif gagne, comme partout ailleurs.
    serif: SERIF_FAMILIES.includes(low(display)) ? display : SERIF_FAMILIES.includes(low(body)) ? body : ident.serif,
    // Le manuscrit ne vient JAMAIS d'une charte : aucune n'en déclare.
    script: ident.script,
  };
}

/**
 * Les polices à charger pour cette marque, en plus de celles de sa charte.
 *
 * C'était une constante de trois noms. Ça ne peut plus l'être : les gestes
 * dépendent de l'identité, et charger Anton pour une marque qui compose en
 * Bespoke Stencil ne sert à rien — pire, l'absence de la bonne feuille de style
 * fait sortir le visuel en police système sans la moindre erreur.
 */
export function designSystemFonts(brand: BuildBrand): string[] {
  const f = resolveFonts(brand);
  return Array.from(new Set([f.display, f.body, f.condensed, f.serif, f.script].filter(Boolean)));
}

/** Marqueur de la photo du post — remplacé par la vraie photo à la matérialisation. */
export const DESIGN_PHOTO_PLACEHOLDER = '__PHOTO_PLACEHOLDER__';

export interface BuildOptions {
  fields: Record<string, string>;
  brand: BuildBrand;
  w: number;
  h: number;
  /** Sans photo, les recettes `photo: 'optional'` remplacent la zone par un aplat. */
  hasPhoto?: boolean;
}

/**
 * Transforme une recette en calques d'éditeur — exactement ceux qu'un graphiste
 * aurait posés à la main. Rien n'est verrouillé : l'utilisateur peut tout
 * déplacer ensuite, c'est le point de départ qui change.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildDesignElements(recipe: DesignRecipe, opt: BuildOptions): any[] {
  const { w, h } = opt;
  const C = resolvePalette(opt.brand);
  const FT = resolveFonts(opt.brand);
  const brandName = (opt.brand.name || '').trim();
  const handle = (opt.brand.handle || '').trim() || (brandName ? `@${brandName.toLowerCase().replace(/[^a-z0-9]+/g, '')}` : '');
  const fill = (c: Col | 'none'): string => (c === 'none' ? 'rgba(0,0,0,0)' : C[c] ?? WHITE);
  const font = (f?: Fnt): string => (f === 'body' ? FT.body : f === 'script' ? FT.script : f === 'condensed' ? FT.condensed : f === 'serif' ? FT.serif : FT.display);

  const subst = (t: string) => t.replace(/\{\{marque\}\}/g, brandName).replace(/\{\{handle\}\}/g, handle);
  const px = (v: number, base: number) => Math.round(v * base);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = [];
  let i = 0;
  for (const nd of recipe.nodes) {
    const id = `ds-${recipe.id}-${i++}`;

    if (nd.k === 'photo') {
      const box = { x: px(nd.x, w), y: px(nd.y, h), width: px(nd.w, w), height: px(nd.h, h) };
      if (opt.hasPhoto === false) {
        // Pas de photo : la zone devient un aplat de marque plutôt qu'un trou gris.
        out.push({ id, type: 'rect', ...box, fill: C.brand, stroke: '', strokeWidth: 0, cornerRadius: px(nd.radius ?? 0, w), rotation: nd.rotation ?? 0, opacity: nd.opacity ?? 100 });
      } else {
        out.push({
          id, type: 'image', src: DESIGN_PHOTO_PLACEHOLDER, ...box,
          cornerRadius: px(nd.radius ?? 0, w), rotation: nd.rotation ?? 0, opacity: nd.opacity ?? 100,
          ...(nd.sat !== undefined ? { adjSaturation: nd.sat } : {}),
          ...(nd.contrast !== undefined ? { adjContrast: nd.contrast } : {}),
          ...(nd.bright !== undefined ? { adjBrightness: nd.bright } : {}),
        });
      }
      // L'assombrissement est un calque à part : l'utilisateur peut le retirer
      // d'un clic si sa photo est déjà sombre.
      if (nd.dark) {
        out.push({ id: `${id}-v`, type: 'rect', ...box, fill: '#000000', stroke: '', strokeWidth: 0, cornerRadius: px(nd.radius ?? 0, w), rotation: nd.rotation ?? 0, opacity: nd.dark });
      }
      continue;
    }

    if (nd.k === 'rect') {
      out.push({
        id, type: 'rect',
        x: px(nd.x, w), y: px(nd.y, h), width: px(nd.w, w), height: px(nd.h, h),
        fill: fill(nd.fill), stroke: nd.stroke ? fill(nd.stroke) : '', strokeWidth: nd.strokeW ? Math.max(1, px(nd.strokeW, w)) : 0,
        cornerRadius: px(nd.radius ?? 0, w), rotation: nd.rotation ?? 0, opacity: nd.opacity ?? 100,
        ...(nd.scrim ? { scrim: nd.scrim } : {}),
      });
      continue;
    }

    if (nd.k === 'shape') {
      out.push({
        id, type: 'vector', shape: nd.shape,
        x: px(nd.x, w), y: px(nd.y, h), width: px(nd.w, w), height: px(nd.h, h),
        fill: fill(nd.fill), fillType: nd.fill === 'none' ? 'none' : 'color',
        stroke: nd.stroke ? fill(nd.stroke) : '', strokeWidth: nd.strokeW ? Math.max(1, px(nd.strokeW, w)) : 0,
        cornerRadius: px(nd.radius ?? 0, w), rotation: nd.rotation ?? 0, opacity: nd.opacity ?? 100,
      });
      continue;
    }

    // — texte —
    const raw = nd.slot ? (opt.fields[nd.slot] ?? '') : (nd.text ?? '');
    const text = subst(String(raw)).trim();
    if (!text) continue; // un slot vide ne laisse pas de bloc fantôme
    const size = Math.max(11, px(nd.size, w));
    const famille = font(nd.font);
    const weight = nd.weight ?? (nd.slot ? 'bold' : 'normal');

    // LA GRAISSE FAIT L'IDENTITÉ AUTANT QUE LA FAMILLE.
    //
    // Tout ce qui était « bold » sortait en 700, pour toutes les marques : un
    // titre de maison de mode et un titre de burger avaient exactement le même
    // poids. On applique donc la graisse de l'identité là où la personnalité se
    // lit — les titres et les petites capitales — et on laisse le reste à 700,
    // parce qu'un sous-titre allégé devient illisible sur photo.
    //
    // UN VISUEL SOCIAL SE LIT EN VIGNETTE : LE PLANCHER EST ÉPAIS.
    //
    // L'identité pouvait descendre un titre à 400, et c'est juste dans une revue
    // — pas dans un fil, où le visuel est vu à deux centimètres de large avant
    // qu'on décide de s'arrêter. Un titre fin y disparaît. Il y a aussi un piège
    // technique : une police importée dont la graisse demandée n'existe pas fait
    // appliquer au navigateur sa règle de substitution, et pour une cible sous
    // 500 celle-ci cherche D'ABORD vers le BAS. Demander 400 à une famille qui
    // publie 300 et 900 donne le 300. D'où « il m'a mis la typo la plus light ».
    //
    // Planchers, donc, et ils priment sur l'identité :
    //  · un titre ne descend jamais sous 700, sauf en serif ou en manuscrit où
    //    700 devient pâteux : 600 y suffit ;
    //  · les petites capitales ne descendent pas sous 600, c'est là que la
    //    lisibilité se perd le plus vite ;
    //  · même un texte « normal » part à 500 : sur une photo, un 400 est mou.
    //
    // Et la graisse est ramenée à une graisse RÉELLEMENT publiée par la famille,
    // en arrondissant VERS LE HAUT : sur un visuel, un titre trop fin est un
    // défaut, un titre trop gras est un parti pris.
    const microCap = !!nd.upper && nd.size <= 0.036;
    const titre = nd.role === 'titre' || nd.role === 'accroche' || nd.role === 'prix';
    const gesteDelicat = nd.font === 'serif' || nd.font === 'script';
    let poids = weight === 'bold' ? 700 : 500;
    if (weight === 'bold' && titre) {
      poids = Math.max(gesteDelicat ? 600 : 700, FT.ident.titleWeight);
    } else if (weight === 'bold' && microCap) {
      poids = Math.max(600, FT.ident.microWeight);
    }
    poids = nearestWeight(famille, poids);
    const style = [nd.italic ? 'italic' : '', String(poids)].filter(Boolean).join(' ');

    // L'INTERLETTRAGE, MÊME RAISON.
    //
    // Le dessin garde la main — c'est lui qui sait ce qui tient dans sa colonne
    // — mais on le déplace d'un tiers vers la valeur de l'identité. Assez pour
    // qu'une Didone respire et qu'une affiche se serre, trop peu pour casser une
    // composition réglée au pixel.
    // Le repère est la TAILLE, pas la casse. Viser l'interlettrage des petites
    // capitales dès qu'un texte est en majuscules étalait aussi les titres
    // d'affiche : un gros titre à 0,20 d'interlettrage se lit lettre à lettre,
    // se replie sur une ligne de plus et perd la moitié de son calibre. Les
    // capitales espacées sont un geste de PETIT texte (rail, rubrique, mention).
    const cibleTrack = (nd.upper && nd.size <= 0.036) ? FT.ident.microTrack : FT.ident.titleTrack;
    const track = nd.track === undefined ? cibleTrack : nd.track + (cibleTrack - nd.track) * 0.34;
    out.push({
      id, type: 'text', text,
      x: px(nd.x, w), y: px(nd.y, h), width: px(nd.w, w),
      fontSize: size, fontFamily: famille, fontStyle: style,
      // LE RÔLE, PAS SEULEMENT LA POLICE.
      //
      // Un calque ne gardait que le nom de la police résolue. Changer la
      // typographie de la charte ne pouvait donc rien y faire : le document
      // disait « Oswald », pas « le titrage de la marque ». En gardant le rôle,
      // l'éditeur peut re-résoudre la police à l'ouverture — et seulement pour
      // les calques que le système a écrits, jamais pour ceux où quelqu'un a
      // choisi une police à la main (le rôle est effacé à ce moment-là).
      fontRole: nd.font ?? 'display',
      textDecoration: nd.strike ? 'line-through' : '',
      fill: fill(nd.fill), align: nd.align ?? 'left',
      uppercase: !!nd.upper, lineHeight: nd.lh ?? 1.15,
      letterSpacing: Math.round(track * size),
      rotation: nd.rotation ?? 0, opacity: nd.opacity ?? 100,
      maxLines: nd.maxLines ?? 3,
      // Une taille plancher explicite : l'auto-ajustement de l'éditeur réduit
      // sans jamais casser la hiérarchie voulue par le dessin.
      maxFontSize: size, minFontSize: Math.max(11, Math.round(size * 0.62)),
      // La largeur fait partie du dessin : le re-calage peut réduire la police,
      // jamais étaler le bloc hors de sa colonne.
      lockWidth: true,
      ...(nd.role ? { role: nd.role } : {}),
      ...(nd.bg
        ? { hasBg: true, bgColor: fill(nd.bg), bgOpacity: nd.bgOpacity ?? 100,
            cornerRadius: nd.bgRadius ?? 0,
            padding: 0,
            paddingH: Math.round(size * (nd.bgPad ?? 0.55)),
            paddingV: Math.round(size * (nd.bgPad ?? 0.55) * 0.62) }
        : { hasBg: false, bgColor: '#000000', bgOpacity: 80, cornerRadius: 4,
            padding: 0, paddingH: 0, paddingV: 0 }),
      ...(nd.hl ? {
        highlightEnabled: true, highlightColor: fill(nd.hl), highlightOpacity: 100,
        // Un cartouche se coupe NET et respire sur les côtés. À 4 px de rayon il
        // n'était ni carré ni arrondi — l'arrondi mou des générateurs — et son
        // padding horizontal trop court collait les lettres au bord.
        highlightBorderRadius: nd.hlRadius ?? 0, highlightPadding: nd.hlPad ?? Math.round(size * 0.34),
      } : {}),
      ...(nd.hollow ? { hollowEnabled: true } : {}),
      ...(nd.strokeCol ? { stroke: fill(nd.strokeCol), strokeWidth: Math.max(1, px(nd.strokeW ?? 0.003, w)) } : {}),
      ...(nd.shadow ? { shadowEnabled: true, shadowColor: '#000000', shadowOpacity: 40, shadowBlur: 14, shadowOffsetX: 0, shadowOffsetY: 0 } : {}),
      // Les quatre effets du panneau, avec les mêmes réglages que les préréglages
      // de l'éditeur : une recette et un clic doivent donner le même rendu.
      ...(nd.fx === 'glow' ? { glowEnabled: true, glowColor: fill(nd.fxCol ?? 'accentLight'), glowIntensity: 70, glowSize: Math.max(8, Math.round(size * 0.22)) } : {}),
      ...(nd.fx === 'neon' ? { glowEnabled: true, glowColor: fill(nd.fxCol ?? 'accentLight'), glowIntensity: 95, glowSize: Math.max(10, Math.round(size * 0.3)),
                               stroke: fill(nd.fxCol ?? 'accentLight'), strokeWidth: Math.max(1, Math.round(size * 0.035)) } : {}),
      ...(nd.fx === 'echo' ? { echoEnabled: true, echoColor: fill(nd.fxCol ?? 'brand'), echoCount: 3, echoOffset: Math.max(4, Math.round(size * 0.11)), echoFade: true } : {}),
      ...(nd.fx === 'lift' ? { liftEnabled: true, liftColor: '#000000', liftDepth: Math.max(3, Math.round(size * 0.09)), liftDirection: 'br' } : {}),
    });
  }
  recalerGroupes(out, h);
  return out;
}

/**
 * LE RECALAGE AU CAS RÉEL, et c'est le vrai sujet de « ça ne s'adapte pas ».
 *
 * Une recette réserve la place de `maxLines`. Le texte reçu en occupe souvent
 * moins : un titre prévu sur trois lignes qui en tient deux laisse l'écart du
 * dessin sous lui, et le bloc suivant reste où il était. D'où les trous que
 * l'on voyait — « trop grande marge entre les deux » — et l'impression que la
 * composition est mal calée alors que le dessin est juste. Le défaut n'est pas
 * dans la recette, il est dans l'absence d'adaptation.
 *
 * On estime donc le nombre de lignes RÉEL de chaque bloc, à partir du texte
 * effectivement écrit et de l'avance de sa police, puis on re-empile les blocs
 * d'un même groupe avec le rythme voulu par le dessin.
 *
 * DEUX PRUDENCES.
 *  · On ne touche qu'aux blocs qui portent un `role` : les autres sont
 *    volontairement superposés (mot barré sous un mot manuscrit, écho), et les
 *    séparer défairait le geste.
 *  · L'ancrage est conservé. Un groupe du bas reste collé au bas, un groupe du
 *    haut au haut : sinon une composition « bandeau bas » remonterait au milieu
 *    dès que son titre raccourcit.
 */
function recalerGroupes(out: Array<Record<string, unknown>>, h: number): void {
  type Bloc = {
    e: Record<string, unknown>; y: number; x: number; w: number;
    /** Hauteur que le DESSIN a réservée : `maxLines` lignes pleines. */
    reserve: number;
    /** Hauteur que le texte REÇU occupe vraiment. */
    reelle: number;
  };

  const blocs: Bloc[] = out
    .filter(e => e.type === 'text' && e.role && !e.rotation)
    .map((e) => {
      const taille = Number(e.fontSize) || 0;
      const largeur = Number(e.width) || 0;
      const inter = Number(e.lineHeight) || 1.15;
      const maxL = Math.max(1, Number(e.maxLines) || 3);
      const avance = AVANCE[String(e.fontRole ?? 'display')] ?? 0.54;
      const texte = String(e.text ?? '');
      const parLigne = Math.max(1, Math.floor(largeur / Math.max(1, taille * avance)));
      const lignes = Math.max(1, Math.min(maxL, Math.ceil(texte.length / parLigne)));
      const marge = (Number(e.paddingV) || 0) * 2;
      return {
        e, y: Number(e.y) || 0, x: Number(e.x) || 0, w: largeur,
        reserve: maxL * taille * inter + marge,
        reelle: lignes * taille * inter + marge,
      };
    })
    .sort((a, b) => a.y - b.y);

  if (blocs.length < 2) return;

  // Un GROUPE, ce sont des blocs qui partagent une colonne et se suivent de
  // près DANS LE DESSIN. Deux blocs séparés par un septième de cadre sont à
  // deux endroits de la composition, pas dans un même ensemble.
  const seuil = h * 0.14;
  const groupes: Bloc[][] = [];
  let courant: Bloc[] = [blocs[0]];
  for (let i = 1; i < blocs.length; i++) {
    const a = courant[courant.length - 1], b = blocs[i];
    const memeColonne = !(a.x + a.w <= b.x + 4 || b.x + b.w <= a.x + 4);
    if (memeColonne && b.y - (a.y + a.reserve) < seuil) courant.push(b);
    else { groupes.push(courant); courant = [b]; }
  }
  groupes.push(courant);

  for (const g of groupes) {
    if (g.length < 2) continue;

    // Le rythme voulu par le dessin : l'espace LIBRE entre deux blocs, une fois
    // retirée la place réservée au premier. C'est lui qu'on conserve ; ce qu'on
    // supprime, c'est la place réservée et non utilisée.
    const respirations: number[] = [];
    for (let i = 0; i < g.length - 1; i++) {
      respirations.push(Math.max(0, g[i + 1].y - (g[i].y + g[i].reserve)));
    }

    // Rien à récupérer : chaque bloc remplit ce qu'on lui a réservé.
    const gagne = g.reduce((n, b) => n + (b.reserve - b.reelle), 0);
    if (gagne < 6) continue;

    // ANCRAGE EN HAUT, toujours. Le trou à supprimer est celui qui sépare deux
    // blocs de texte ; celui qui reste sous le groupe laisse simplement voir la
    // photo, ce qui ne se lit pas comme un défaut. Remonter le groupe depuis le
    // bas déplacerait la composition entière dès qu'un titre raccourcit, ce qui
    // est bien plus surprenant que le trou qu'on répare.
    let y = g[0].y;
    for (let i = 0; i < g.length; i++) {
      g[i].e.y = Math.round(y);
      y += g[i].reelle + (respirations[i] ?? 0);
    }
  }
}

// ── Choix des candidats ──────────────────────────────────────────────────────
//
// « Elle part à chaque fois sur les mêmes templates » : ce n'est pas seulement
// que la bibliothèque était pauvre, c'est qu'on présentait TOUJOURS la même
// liste, dans le même ordre, à un modèle qui a des préférences stables. Même
// avec cinquante recettes, il en choisirait trois. On ne lui montre donc jamais
// tout le catalogue : un sous-ensemble, tiré à chaque appel, réparti entre les
// familles, et amputé de ce qui vient d'être utilisé pour ce client.

export const DESIGN_RECIPE_BY_ID: Record<string, DesignRecipe> =
  Object.fromEntries(DESIGN_RECIPES.map(r => [r.id, r]));

export function findDesignRecipe(id: unknown): DesignRecipe | null {
  return typeof id === 'string' ? (DESIGN_RECIPE_BY_ID[id] ?? null) : null;
}

/** Générateur pseudo-aléatoire à graine : deux appels du même client à la même
 *  seconde ne doivent pas donner la même sélection, mais un tirage doit rester
 *  reproductible dans les journaux. */
function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export interface PickOptions {
  hasPhoto: boolean;
  sector?: string | null;
  /** Recettes déjà servies récemment à ce client : à écarter en priorité. */
  avoid?: string[];
  count?: number;
  seed?: number;
}

export function pickDesignCandidates(o: PickOptions): DesignRecipe[] {
  const count = Math.max(6, Math.min(o.count ?? 22, DESIGN_RECIPES.length));
  const avoid = new Set((o.avoid ?? []).map(String));
  const sector = (o.sector ?? '').trim().toLowerCase();
  const rand = rng(o.seed ?? Date.now());

  // 1 — compatibilité photo, jugée sur le DESSIN et non sur l'étiquette.
  //
  // On se fiait au champ `photo`, mais « facultative » voulait dire en pratique
  // « aucune zone photo dans le dessin » : proposer ces recettes à quelqu'un qui
  // vient d'importer une image revenait à jeter son image. Quand une photo
  // existe, toute composition proposée doit donc avoir une zone pour l'accueillir
  // — sans exception, c'est la raison pour laquelle la personne l'a importée.
  const aUneZonePhoto = (r: DesignRecipe) => r.nodes.some(n => n.k === 'photo');
  const usable = DESIGN_RECIPES.filter(r => (o.hasPhoto ? aUneZonePhoto(r) : !aUneZonePhoto(r)));

  // Une note TIRÉE UNE FOIS par recette. Calculée dans le comparateur, elle
  // changeait à chaque comparaison : le tri devenait du bruit, et l'affinité de
  // secteur ne pesait plus rien.
  const notes = new Map<string, number>();
  for (const r of DESIGN_RECIPES) {
    let n = rand();
    if (sector && r.sectors?.some(x => x.toLowerCase() === sector)) n += 1.2; // affinité de secteur
    if (avoid.has(r.id)) n -= 3;                                             // déjà vu récemment
    notes.set(r.id, n);
  }
  const score = (r: DesignRecipe) => notes.get(r.id) ?? 0;

  // 2 — répartition par famille : sans elle, un tirage peut sortir huit photos
  // éditoriales et rien d'autre, et « varié » redevient « pareil ».
  const byFamily = new Map<string, DesignRecipe[]>();
  for (const r of usable) {
    const list = byFamily.get(r.family) ?? [];
    list.push(r);
    byFamily.set(r.family, list);
  }
  byFamily.forEach((list) => list.sort((a: DesignRecipe, b: DesignRecipe) => score(b) - score(a)));

  const families = Array.from(byFamily.keys()).sort(() => rand() - 0.5);
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

/** Fiche compacte d'une recette, telle que le modèle la lit pour choisir. */
// ── Ce qu'un bloc peut VRAIMENT contenir ─────────────────────────────────────
//
// Chaque slot annonçait une longueur maximale, écrite à la main, et l'IA écrivait
// jusqu'à cette longueur. Mais le DESSIN a sa propre capacité : sa colonne, son
// calibre et son nombre de lignes décident combien de caractères tiennent. Les
// deux ont été posés séparément, donc ils divergeaient — 93 slots sur 250
// annonçaient plus long que leur dessin ne pouvait tenir.
//
// Ce que ça donnait à l'écran, et c'est exactement le reproche « ça ne rend
// rien » : l'IA remplit les 42 caractères annoncés, le bloc n'en tient que 25,
// l'ajustement automatique descend la police jusqu'à son plancher, et le titre
// d'affiche finit en corps de texte flottant au milieu de son aplat — quand il
// n'est pas simplement rogné.
//
// La géométrie tranche désormais. `max` reste ce que l'auteur de la recette
// voulait, mais il ne peut plus dépasser ce que le dessin porte. Une recette
// écrite demain hérite de la règle sans qu'on y pense.

/** Avance moyenne d'un caractère, en fraction du corps, par rôle typographique. */
const AVANCE: Record<string, number> = { condensed: 0.46, display: 0.56, body: 0.52, serif: 0.5, script: 0.44 };

/** Nombre de caractères que le DESSIN peut tenir pour ce slot. */
/**
 * Les compositions SŒURS d'une recette : celles qui tiennent le même parti pris.
 *
 * POURQUOI C'EST DÉTERMINISTE, ET PAS UN APPEL DE PLUS AU MODÈLE. « Fais-moi des
 * variantes » est une question de PARENTÉ, pas de goût : deux compositions sont
 * sœurs si elles écrivent dans la même zone, servent les mêmes intentions et
 * partagent le registre. Un modèle de langage y répondrait par ses préférences
 * habituelles, c'est-à-dire toujours les mêmes trois recettes. On mesure donc la
 * parenté sur les métadonnées, et on ne laisse au modèle que ce qu'il fait bien :
 * écrire les textes.
 *
 * La note privilégie, dans l'ordre : la même zone (c'est elle qui décide si une
 * composition est juste sur une photo donnée), les intentions communes, la
 * personnalité commune, puis une famille DIFFÉRENTE — une variante qui reste
 * dans la même famille se reconnaît en vignette, et ce n'est plus une variante.
 */
/**
 * LES DISPOSITIFS D'UNE COMPOSITION, déduits de son dessin.
 *
 * POURQUOI UNE LISTE FERMÉE. La lecture du fil rendait déjà des « motifs », mais
 * en TEXTE LIBRE : « ellipse jaune autour d'un mot », « bandeau doré ». Personne
 * ne s'en servait pour choisir, parce qu'aucune machine ne sait relier cette
 * phrase à une recette. Le modèle de vision voyait juste, et sa lecture tombait
 * dans le vide.
 *
 * Ici les dispositifs sont un vocabulaire FERMÉ, déduit des nœuds comme la zone
 * l'est déjà : une recette écrite demain est décrite correctement sans qu'on y
 * pense, et la description ne peut pas mentir sur le dessin. Le modèle nomme ce
 * qu'il voit dans ce même vocabulaire, et l'appariement devient mécanique.
 */
export type Dispositif =
  | 'surlignage' | 'bloc-de-fond' | 'voile' | 'aplat' | 'pastille' | 'cadre'
  | 'rail-de-marque' | 'manuscrit' | 'serif' | 'condense' | 'evide' | 'contour'
  | 'de-travers' | 'chiffre-geant' | 'filet' | 'photo-encadree' | 'texte-nu';

export const DISPOSITIFS: { id: Dispositif; label: string }[] = [
  { id: 'surlignage', label: 'texte surligné, un cartouche épouse chaque ligne' },
  { id: 'bloc-de-fond', label: 'bloc de couleur plein derrière le texte' },
  { id: 'voile', label: 'voile dégradé sombre pour la lisibilité' },
  { id: 'aplat', label: 'grand aplat de couleur, bandeau ou moitié de cadre' },
  { id: 'pastille', label: 'pastille, badge ou cachet rond' },
  { id: 'cadre', label: 'cadre ou filet qui entoure' },
  { id: 'rail-de-marque', label: 'nom de la marque répété en petit, haut ou pied' },
  { id: 'manuscrit', label: 'mot manuscrit' },
  { id: 'serif', label: 'titre en serif' },
  { id: 'condense', label: 'titre en condensé d’affiche' },
  { id: 'evide', label: 'lettres évidées, la photo se voit au travers' },
  { id: 'contour', label: 'lettres cernées d’un contour' },
  { id: 'de-travers', label: 'éléments posés de travers' },
  { id: 'chiffre-geant', label: 'chiffre ou prix en très gros' },
  { id: 'filet', label: 'filet fin, trait de séparation' },
  { id: 'photo-encadree', label: 'photo réduite, marge autour' },
  { id: 'texte-nu', label: 'texte posé nu sur la photo, sans fond ni voile' },
];

export function recipeDevices(r: DesignRecipe): Dispositif[] {
  const d = new Set<Dispositif>();
  const textes = r.nodes.filter((n): n is TextNode => n.k === 'text');
  const pleinCadre = r.nodes.some(n => n.k === 'photo' && n.w >= 0.99 && n.h >= 0.99);

  for (const n of r.nodes) {
    if (n.rotation) d.add('de-travers');
    if (n.k === 'rect') {
      if (n.scrim) d.add('voile');
      else if (n.h <= 0.012 || n.w <= 0.012) d.add('filet');
      else if (n.w * n.h >= 0.06) d.add('aplat');
      if (n.stroke) d.add('cadre');
    }
    if (n.k === 'shape') {
      if (n.fill === 'none' || n.stroke) d.add('cadre');
      else d.add('pastille');
    }
    if (n.k === 'photo' && !(n.w >= 0.99 && n.h >= 0.99)) d.add('photo-encadree');
  }
  for (const t of textes) {
    if (t.hl) d.add('surlignage');
    if (t.bg) d.add('bloc-de-fond');
    if (t.hollow) d.add('evide');
    if (t.strokeCol) d.add('contour');
    if (t.font === 'script') d.add('manuscrit');
    if (t.font === 'serif') d.add('serif');
    if (t.font === 'condensed') d.add('condense');
    if (!t.slot && /\{\{marque\}\}/.test(t.text ?? '')) d.add('rail-de-marque');
    if (t.role === 'prix' && t.size >= 0.12) d.add('chiffre-geant');
  }
  // « Texte nu » n'est pas une absence : c'est un parti pris, celui des comptes
  // qui refusent le voile et posent la lettre à même l'image.
  if (pleinCadre && textes.some(t => t.slot) && !d.has('voile') && !d.has('bloc-de-fond')
      && !d.has('surlignage') && !d.has('aplat')) d.add('texte-nu');
  return Array.from(d);
}

export function recipeSiblings(source: DesignRecipe, n = 5, pool: DesignRecipe[] = DESIGN_RECIPES): DesignRecipe[] {
  const zoneSrc = recipeZone(source);
  const inter = <T,>(a: T[] = [], b: T[] = []) => a.filter(x => b.includes(x)).length;

  return pool
    .filter(r => r.id !== source.id && r.photo === source.photo)
    .map(r => {
      let note = 0;
      if (recipeZone(r) === zoneSrc) note += 4;
      note += inter(r.intents, source.intents) * 1.6;
      note += inter(r.vibe, source.vibe) * 1.1;
      // Même parti pris, autre dessin : c'est la définition d'une variante.
      if (r.family !== source.family) note += 1.2;
      return { r, note };
    })
    .filter(x => x.note > 2)
    .sort((a, b) => b.note - a.note)
    .slice(0, n)
    .map(x => x.r);
}

export function slotCapacity(r: DesignRecipe, key: string): number | null {
  const nd = r.nodes.find(n => n.k === 'text' && n.slot === key) as TextNode | undefined;
  if (!nd) return null;
  // Les capitales sont plus larges, l'interlettrage s'ajoute à chaque signe.
  const avance = (AVANCE[nd.font ?? 'display'] ?? 0.54) * (nd.upper ? 1.1 : 1) + (nd.track ?? 0);
  return Math.max(3, Math.floor((nd.maxLines ?? 2) * (nd.w / (nd.size * avance))));
}

/** La longueur réellement annoncée à l'IA, et réellement appliquée au texte. */
export function effectiveMax(r: DesignRecipe, slot: DesignSlot): number {
  const cap = slotCapacity(r, slot.key);
  return cap === null ? slot.max : Math.min(slot.max, cap);
}

// ── Où la composition écrit sur la photo ─────────────────────────────────────
//
// L'IA regarde bien la photo, mais les recettes ont des positions de texte
// FIXES : elle choisissait une composition sans aucune garantie que sa zone de
// texte tombe sur une zone calme. Sur les photos de Pepe Chicken, le plan
// produit est calme en haut et occupé au centre ; la photo de téléphone n'a
// aucune zone calme. Une recette qui écrit au centre est juste sur l'une et
// catastrophique sur l'autre, et rien ne le disait au modèle.
//
// La zone n'est pas déclarée à la main : on la DÉDUIT du dessin. Une recette
// écrite demain est décrite correctement sans qu'on y pense, et surtout la
// description ne peut pas mentir sur le dessin qu'elle accompagne.

export type RecipeZone = 'haut' | 'bas' | 'centre' | 'partout' | 'hors-photo';

export function recipeZone(r: DesignRecipe): RecipeZone {
  const pleinCadre = r.nodes.some(n => n.k === 'photo' && n.x <= 0.01 && n.y <= 0.01 && n.w >= 0.99 && n.h >= 0.99);
  // Sans photo plein cadre, le texte est posé sur un aplat ou dans une carte :
  // sa lisibilité ne dépend pas de l'image, la question ne se pose pas.
  if (!pleinCadre) return 'hors-photo';

  const textes = r.nodes.filter((n): n is TextNode => n.k === 'text' && !!n.slot);
  if (!textes.length) return 'hors-photo';
  let haut = 1, bas = 0;
  for (const t of textes) {
    // Hauteur approchée du bloc, en fraction de la hauteur du cadre : la taille
    // est une fraction de la LARGEUR, et un post est plus haut que large.
    const h = (t.maxLines ?? 2) * t.size * (t.lh ?? 1.15) * 0.8;
    haut = Math.min(haut, t.y);
    bas = Math.max(bas, t.y + h);
  }
  // La moitié du cadre est le bon repère : une composition qui tient dans la
  // moitié haute laisse le sujet tranquille sur un plan produit, et c'est tout
  // ce qu'on lui demande. Des seuils plus serrés classaient « partout » des
  // recettes qui n'écrivent que dans le tiers supérieur.
  if (bas <= 0.5) return 'haut';
  if (haut >= 0.5) return 'bas';
  if (haut >= 0.28 && bas <= 0.76) return 'centre';
  return 'partout';
}

const ZONE_DITE: Record<RecipeZone, string> = {
  haut: 'écrit dans le HAUT de la photo : à ne choisir que si le haut est calme',
  bas: 'écrit dans le BAS de la photo : à ne choisir que si le bas est calme',
  centre: 'écrit en PLEIN CENTRE de la photo : à ne choisir que si le sujet n’est pas au centre',
  partout: 'occupe TOUTE la hauteur de la photo : le texte passera forcément sur le sujet, à ne choisir que si la photo est un fond (matière, table, mur) et non un sujet à montrer',
  'hors-photo': 'le texte est sur un aplat ou dans une carte, jamais sur la photo : marche avec n’importe quelle image',
};

export function describeDesignCandidates(list: DesignRecipe[]) {
  return list.map(r => ({
    id: r.id,
    nom: r.name,
    style: r.vibe.join('/'),
    pour: r.intents.join('/'),
    photo: r.photo === 'required' ? 'utilise la photo' : r.photo === 'optional' ? 'photo facultative' : 'sans photo',
    dessin: r.desc,
    zone: ZONE_DITE[recipeZone(r)],
    champs: r.slots.map(s => ({ cle: s.key, quoi: s.label, max: effectiveMax(r, s) })),
  }));
}

/** Nettoie ce que le modèle a écrit : on ne garde que les slots de la recette, et
 *  chacun à la longueur pour laquelle le dessin a été fait. Un titre trois fois
 *  trop long ne casse pas la composition, il est coupé. */
export function sanitizeFields(recipe: DesignRecipe, raw: unknown): Record<string, string> {
  const src = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const out: Record<string, string> = {};
  for (const s of recipe.slots) {
    const v = src[s.key];
    if (typeof v !== 'string') continue;
    const t = v.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const max = effectiveMax(recipe, s);
    if (t.length <= max) { out[s.key] = t; continue; }
    // COUPER SUR UN MOT, JAMAIS DEDANS.
    //
    // La coupe se faisait au caractère : « La carte change chaque semaine »
    // ressortait en « LA CARTE CHANGE CHAQUE SE » en gros sur la photo. Un
    // visuel entier discrédité par deux lettres orphelines. On recule jusqu'à
    // la dernière espace — sauf si elle ampute plus de la moitié du texte,
    // auquel cas c'est un seul mot trop long et il n'y a rien à sauver.
    // « À découvrir » ressortait en « À décou » : la garde « sauf si la coupe
    // ampute plus de la moitié » retombait sur une coupe AU CARACTÈRE dès que le
    // texte tenait en peu de mots. Un mot mutilé discrédite le visuel entier,
    // alors qu'un mot entier un peu trop long est simplement réduit par
    // l'ajustement de l'éditeur. On ne coupe donc JAMAIS dans un mot : on garde
    // les mots entiers qui tiennent, et au minimum le premier, quel qu'il soit.
    const mots = t.split(' ');
    let garde = mots[0];
    for (let i = 1; i < mots.length; i++) {
      const essai = garde + ' ' + mots[i];
      if (essai.length > max) break;
      garde = essai;
    }
    // Une coupe qui finit sur « de », « en », « à » ou « et » se lit comme une
    // phrase inachevée. On retire ce dernier mot outil, sauf s'il ne reste rien.
    const net = garde.replace(/\s+(de|du|des|en|et|à|au|aux|la|le|les|un|une|pour|sur|dans|avec)$/i, '');
    out[s.key] = (net || garde).replace(/[\s,;:.!?…-]+$/, '');
  }
  return out;
}
