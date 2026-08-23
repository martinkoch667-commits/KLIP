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

// ── Vocabulaire ──────────────────────────────────────────────────────────────

/** Rôle de couleur, résolu sur la charte du client au moment du rendu. */
export type Col =
  | 'brand' | 'accent' | 'secondary'
  | 'ink' | 'paper' | 'white' | 'black'
  | 'onBrand' | 'onAccent' | 'onSecondary' | 'onPaper'
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
  x: number; y: number; w: number; h: number;
  fill: Col; radius?: number; stroke?: Col; strokeW?: number;
  scrim?: 'top' | 'bottom';
}
export interface ShapeNode extends NodeBase {
  k: 'shape';
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
    id: 'ds-affiche-pied', name: 'Affiche + ligne de service', family: 'photo-editorial',
    vibe: ['editorial', 'audacieux'], intents: ['conseil', 'accroche', 'liste'],
    photo: 'required',
    desc: 'Photo plein cadre, titre d’affiche en haut, et en bas la ligne de service des comptes de créateurs : le compte à gauche, la flèche de suite à droite. Signale un post qui se lit et s’enregistre.',
    slots: [sl('titre', 'accroche en capitales, deux mots maxi', 24), sl('sous', 'la promesse, en une ligne', 56)],
    nodes: [
      P(0, 0, 1, 1, { dark: 22 }),
      R(0, 0, 1, 0.5, 'black', { scrim: 'top', opacity: 58 }),
      T('titre', 0.07, 0.08, 0.86, 0.2, 'white', { font: 'condensed', upper: true, lh: 0.88, maxLines: 2, role: 'titre' }),
      T('sous', 0.07, 0.4, 0.7, 0.042, 'white', { font: 'serif', italic: true, lh: 1.2, maxLines: 2, role: 'sous-titre' }),
      ...footer('white'),
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
    id: 'ds-split-bas', name: 'Photo haut / aplat bas', family: 'photo-split',
    vibe: ['sobre', 'audacieux'], intents: ['offre', 'annonce', 'produit'],
    photo: 'required',
    desc: 'La photo occupe le haut, un aplat de la couleur de marque prend tout le bas avec le titre et un bouton. Lisibilité totale : le texte n’est jamais sur la photo.',
    slots: [sl('titre', 'titre principal', 40), sl('sous', 'précision', 60), sl('cta', 'appel à l’action, 3 mots maxi', 22)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      P(0, 0, 1, 0.58),
      T('titre', 0.08, 0.63, 0.84, 0.095, 'onBrand', { upper: true, lh: 0.98, maxLines: 2, role: 'titre', weight: 'bold' }),
      T('sous', 0.08, 0.795, 0.72, 0.03, 'onBrand', { font: 'body', maxLines: 2, role: 'sous-titre', opacity: 84 }),
      S('pill', 0.08, 0.875, 0.42, 0.062, 'accent'),
      T('cta', 0.08, 0.891, 0.42, 0.028, 'onAccent', { align: 'center', upper: true, track: 0.12, maxLines: 1, role: 'cta', weight: 'bold' }),
    ],
  },
  {
    id: 'ds-split-cote', name: 'Colonne / photo', family: 'photo-split',
    vibe: ['editorial', 'tech'], intents: ['conseil', 'annonce', 'preuve'],
    photo: 'required',
    desc: 'Une colonne de couleur à gauche porte tout le texte, la photo tient la moitié droite sur toute la hauteur. Composition de site, très lisible, qui marche même avec une photo chargée.',
    slots: [sl('kicker', 'rubrique en capitales', 18), sl('titre', 'titre sur deux lignes', 38), sl('sous', 'phrase d’appui', 70)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      P(0.46, 0, 0.54, 1),
      T('kicker', 0.07, 0.14, 0.32, 0.024, 'accentOnBrand', { upper: true, track: 0.24, maxLines: 1, role: 'tag' }),
      T('titre', 0.07, 0.2, 0.36, 0.085, 'onBrand', { upper: true, lh: 0.95, maxLines: 4, role: 'titre', weight: 'bold' }),
      T('sous', 0.07, 0.56, 0.34, 0.028, 'onBrand', { font: 'body', lh: 1.35, maxLines: 5, role: 'sous-titre', opacity: 84 }),
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
    id: 'ds-carte-basse', name: 'Carte posée', family: 'carte-ui',
    vibe: ['tech', 'sobre'], intents: ['annonce', 'offre', 'conseil'],
    sectors: ['Tech', 'Retail', 'Autre'],
    photo: 'required',
    desc: 'La photo tient le haut, une carte blanche à coins arrondis remonte par-dessus et porte le texte. Le langage des applis : propre, moderne, immédiatement lisible.',
    slots: [sl('tag', 'étiquette courte', 18), sl('titre', 'titre', 40), sl('corps', 'deux phrases d’explication', 120), sl('cta', 'appel à l’action', 22)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      P(0, 0, 1, 0.5),
      R(0.06, 0.44, 0.88, 0.5, 'white', { radius: 0.035 }),
      S('pill', 0.1, 0.47, 0.26, 0.045, 'accent'),
      T('tag', 0.1, 0.482, 0.26, 0.022, 'onAccent', { align: 'center', upper: true, track: 0.12, maxLines: 1 }),
      T('titre', 0.1, 0.545, 0.8, 0.062, 'ink', { lh: 1.05, maxLines: 2, role: 'titre', weight: 'bold' }),
      T('corps', 0.1, 0.68, 0.78, 0.028, 'ink', { font: 'body', lh: 1.4, maxLines: 4, role: 'corps', opacity: 72 }),
      T('cta', 0.1, 0.86, 0.6, 0.028, 'brand', { font: 'body', maxLines: 1, role: 'cta', weight: 'bold' }),
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
    id: 'ds-chiffre-photo', name: 'Chiffre géant', family: 'photo-editorial',
    vibe: ['audacieux', 'tech'], intents: ['preuve', 'liste', 'conseil'],
    photo: 'required',
    desc: 'Un chiffre énorme occupe la moitié du cadre, la photo tient l’autre. Pour un résultat, un classement, un nombre d’années — le chiffre est ce qui s’arrête dans le fil.',
    slots: [sl('chiffre', 'le nombre seul', 5), sl('titre', 'ce que le chiffre veut dire', 36), sl('sous', 'précision', 56)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      P(0, 0.42, 1, 0.58),
      T('chiffre', 0.06, 0.06, 0.88, 0.34, 'accentOnBrand', { font: 'condensed', align: 'left', lh: 0.82, maxLines: 1 }),
      T('titre', 0.06, 0.3, 0.6, 0.055, 'onBrand', { upper: true, lh: 1, maxLines: 2, role: 'titre', weight: 'bold' }),
      R(0, 0.62, 1, 0.38, 'black', { scrim: 'bottom', opacity: 62 }),
      T('sous', 0.06, 0.89, 0.8, 0.03, 'white', { font: 'body', maxLines: 2, role: 'sous-titre' }),
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
    id: 'ds-bandes-marque', name: 'Bandes de marque', family: 'photo-editorial',
    vibe: ['audacieux', 'retro'], intents: ['annonce', 'evenement', 'offre'],
    photo: 'required',
    desc: 'Deux bandeaux de couleur de marque en haut et en bas encadrent la photo, avec le même mot répété en petit. Effet ruban d’affichage, très reconnaissable en série.',
    slots: [sl('ruban', 'mot répété du bandeau, court', 18), sl('titre', 'titre', 36), sl('sous', 'précision', 46)],
    nodes: [
      P(0, 0, 1, 1, { dark: 16 }),
      R(0, 0, 1, 0.08, 'brand'),
      R(0, 0.92, 1, 0.08, 'brand'),
      T('ruban', 0.04, 0.026, 0.92, 0.026, 'onBrand', { align: 'center', upper: true, track: 0.5, maxLines: 1 }),
      R(0, 0.5, 1, 0.42, 'black', { scrim: 'bottom', opacity: 60 }),
      T('titre', 0.08, 0.7, 0.84, 0.1, 'white', { upper: true, lh: 0.96, maxLines: 2, role: 'titre', weight: 'bold' }),
      T('sous', 0.08, 0.845, 0.7, 0.028, 'white', { font: 'body', maxLines: 1, role: 'sous-titre', opacity: 86 }),
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
  {
    id: 'ds-avant-apres', name: 'Avant / après', family: 'photo-split',
    vibe: ['sobre', 'tech'], intents: ['preuve', 'conseil'],
    sectors: ['Beauté', 'Sport', 'Tech', 'Autre'],
    photo: 'required',
    desc: 'La photo à gauche, un aplat de marque à droite, une pastille au centre qui marque la bascule. Pour montrer un changement, un avant/après, un problème/solution.',
    slots: [sl('gauche', 'le côté photo, un mot', 14), sl('titre', 'ce que devient la situation', 46), sl('sous', 'précision', 66)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      P(0, 0, 0.5, 1, { dark: 22 }),
      T('gauche', 0.04, 0.08, 0.42, 0.05, 'white', { upper: true, track: 0.1, maxLines: 1, weight: 'bold' }),
      T('titre', 0.55, 0.24, 0.4, 0.075, 'onBrand', { upper: true, lh: 0.98, maxLines: 4, role: 'titre', weight: 'bold' }),
      T('sous', 0.55, 0.62, 0.38, 0.027, 'onBrand', { font: 'body', lh: 1.35, maxLines: 5, role: 'sous-titre', opacity: 84 }),
      S('circle', 0.4, 0.44, 0.2, 0.15, 'accent'),
      F('→', 0.4, 0.478, 0.2, 0.07, 'onAccent', { align: 'center', maxLines: 1 }),
    ],
  },

  // ══ B. APLATS TYPOGRAPHIQUES (sans photo) ═════════════════════════════════
  {
    id: 'ds-aplat-punchline', name: 'Punchline pleine page', family: 'aplat-typo',
    vibe: ['audacieux'], intents: ['accroche', 'citation'],
    photo: 'none',
    desc: 'Aplat de la couleur de marque, une phrase énorme en capitales dont un mot passe en accent. Aucun décor : c’est la phrase qui est le visuel.',
    slots: [sl('debut', 'début de la phrase', 40), sl('pivot', 'le mot mis en couleur', 16), sl('fin', 'fin de la phrase', 40), sl('pied', 'signature ou mention', 34)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      T('debut', 0.08, 0.2, 0.84, 0.115, 'onBrand', { upper: true, lh: 0.94, maxLines: 2, weight: 'bold' }),
      T('pivot', 0.08, 0.44, 0.84, 0.145, 'accentOnBrand', { font: 'condensed', upper: true, lh: 0.92, maxLines: 1 }),
      T('fin', 0.08, 0.59, 0.84, 0.115, 'onBrand', { upper: true, lh: 0.94, maxLines: 2, weight: 'bold' }),
      T('pied', 0.08, 0.9, 0.6, 0.025, 'onBrand', { font: 'body', upper: true, track: 0.2, maxLines: 1, opacity: 70 }),
    ],
  },
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
    id: 'ds-serif-luxe', name: 'Filets fins', family: 'aplat-typo',
    vibe: ['luxe', 'editorial'], intents: ['annonce', 'evenement', 'accroche'],
    sectors: ['Mode', 'Beauté', 'Restaurant'],
    photo: 'none',
    desc: 'Serif en capitales très espacées entre deux filets, sur fond sombre. Le vocabulaire de la joaillerie et de la haute cuisine.',
    slots: [sl('kicker', 'mention du haut', 26), sl('titre', 'le titre', 34), sl('sous', 'la précision', 50)],
    nodes: [
      R(0, 0, 1, 1, 'ink'),
      T('kicker', 0.12, 0.3, 0.76, 0.022, 'accentLight', { font: 'body', align: 'center', upper: true, track: 0.4, maxLines: 1 }),
      R(0.12, 0.37, 0.76, 0.002, 'white', { opacity: 30 }),
      T('titre', 0.1, 0.42, 0.8, 0.078, 'white', { font: 'serif', align: 'center', upper: true, track: 0.14, lh: 1.3, maxLines: 2, role: 'titre' }),
      R(0.12, 0.6, 0.76, 0.002, 'white', { opacity: 30 }),
      T('sous', 0.16, 0.64, 0.68, 0.026, 'white', { font: 'body', align: 'center', maxLines: 2, role: 'sous-titre', opacity: 70 }),
      F('{{marque}}', 0.1, 0.9, 0.8, 0.02, 'white', { font: 'body', align: 'center', upper: true, track: 0.4, maxLines: 1, opacity: 50 }),
    ],
  },
  {
    id: 'ds-bulles', name: 'Conversation', family: 'carte-ui',
    vibe: ['ludique', 'chaleureux'], intents: ['accroche', 'conseil', 'preuve'],
    photo: 'optional',
    desc: 'Deux bulles de messagerie qui se répondent : la question de tout le monde, la réponse de la marque. Imite une capture d’écran, donc on la lit avant de se méfier.',
    slots: [sl('q', 'la question reçue', 70), sl('r', 'la réponse de la marque', 90), sl('pied', 'la conclusion', 44)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      R(0.07, 0.2, 0.62, 0.17, 'white', { radius: 0.055 }),
      T('q', 0.11, 0.235, 0.54, 0.032, 'ink', { font: 'body', lh: 1.3, maxLines: 3 }),
      R(0.31, 0.42, 0.62, 0.21, 'accent', { radius: 0.055 }),
      T('r', 0.35, 0.455, 0.54, 0.032, 'onAccent', { font: 'body', lh: 1.3, maxLines: 4 }),
      T('pied', 0.07, 0.73, 0.8, 0.05, 'onBrand', { lh: 1.2, maxLines: 2, role: 'sous-titre', weight: 'bold' }),
      ...footer('onBrand'),
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
    id: 'ds-post-it', name: 'Papier collé', family: 'carte-ui',
    vibe: ['chaleureux', 'ludique', 'retro'], intents: ['coulisses', 'annonce', 'conseil'],
    photo: 'optional',
    desc: 'Un papier légèrement incliné posé sur un aplat, texte manuscrit dessus. Une note laissée à la main : chaleureux, artisanal, jamais corporate.',
    slots: [sl('titre', 'le mot manuscrit', 20), sl('corps', 'le message', 110)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      R(0.1, 0.2, 0.8, 0.58, 'paper', { rotation: -2.5 }),
      T('titre', 0.14, 0.26, 0.72, 0.11, 'accentDeep', { font: 'script', maxLines: 1, rotation: -2.5 }),
      T('corps', 0.14, 0.42, 0.7, 0.038, 'ink', { font: 'body', lh: 1.45, maxLines: 5, rotation: -2.5, role: 'corps' }),
      F('{{marque}}', 0.1, 0.87, 0.8, 0.024, 'onBrand', { font: 'body', align: 'center', upper: true, track: 0.3, maxLines: 1, opacity: 70 }),
    ],
  },
  {
    id: 'ds-cercle-focus', name: 'Cercle de focus', family: 'aplat-typo',
    vibe: ['audacieux', 'ludique'], intents: ['accroche', 'annonce', 'offre'],
    photo: 'optional',
    desc: 'Un grand cercle de couleur au centre porte le mot clé, le reste de la phrase l’entoure. Le cercle fait cible : l’œil y va d’abord.',
    slots: [sl('avant', 'ce qui précède', 30), sl('mot', 'le mot dans le cercle', 14), sl('apres', 'ce qui suit', 44)],
    nodes: [
      R(0, 0, 1, 1, 'paper'),
      T('avant', 0.08, 0.13, 0.84, 0.07, 'ink', { upper: true, lh: 1, maxLines: 2, weight: 'bold' }),
      S('circle', 0.16, 0.29, 0.68, 0.51, 'brand'),
      T('mot', 0.16, 0.49, 0.68, 0.115, 'onBrand', { font: 'condensed', align: 'center', upper: true, maxLines: 1 }),
      T('apres', 0.08, 0.85, 0.84, 0.045, 'ink', { align: 'right', lh: 1.1, maxLines: 2, weight: 'bold' }),
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
    id: 'ds-annonce-ruban', name: 'Annonce au ruban', family: 'aplat-typo',
    vibe: ['audacieux', 'retro'], intents: ['annonce', 'offre', 'evenement'],
    photo: 'optional',
    desc: 'Un ruban d’accent en travers du haut, le message en grand dessous sur fond de marque. Structure d’affiche d’ouverture ou de lancement.',
    slots: [sl('ruban', 'la mention du ruban', 20), sl('titre', 'le message', 44), sl('sous', 'la précision', 60), sl('cta', 'la suite à donner', 26)],
    nodes: [
      R(0, 0, 1, 1, 'brand'),
      R(-0.06, 0.1, 1.12, 0.1, 'accent', { rotation: -4 }),
      T('ruban', 0.0, 0.1245, 1.0, 0.045, 'onAccent', { align: 'center', upper: true, track: 0.14, maxLines: 1, rotation: -4, weight: 'bold' }),
      T('titre', 0.08, 0.32, 0.84, 0.115, 'onBrand', { font: 'condensed', upper: true, lh: 0.92, maxLines: 3, role: 'titre' }),
      T('sous', 0.08, 0.67, 0.76, 0.032, 'onBrand', { font: 'body', lh: 1.35, maxLines: 3, role: 'sous-titre', opacity: 82 }),
      S('pill', 0.08, 0.85, 0.5, 0.065, 'paper'),
      T('cta', 0.08, 0.8665, 0.5, 0.028, 'ink', { align: 'center', upper: true, track: 0.1, maxLines: 1, role: 'cta', weight: 'bold' }),
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
];

// ── Résolution sur la charte ─────────────────────────────────────────────────

export interface BuildBrand {
  primary?: string | null; secondary?: string | null; accent?: string | null;
  /** Polices de la charte : titre et texte. */
  display?: string | null; body?: string | null;
  /** Nom de la marque et compte, pour les rails et pieds de page. */
  name?: string | null; handle?: string | null;
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
const INK = '#14160F', PAPER = '#F6F3EE', WHITE = '#FFFFFF', BLACK = '#0A0A0A';

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
const inkOn = (bg: string): string => (relLum(bg) > 0.42 ? INK : WHITE);

// Familles déjà « d'affiche » ou déjà serif : quand la charte en fournit une, on
// l'utilise plutôt que d'imposer la nôtre. Le geste typographique compte, mais
// pas au prix de la charte du client.
const DISPLAY_FAMILIES = ['anton', 'archivo black', 'bebas neue', 'oswald', 'barlow condensed', 'syne', 'impact', 'league gothic', 'teko'];
const SERIF_FAMILIES = ['playfair display', 'lora', 'merriweather', 'dm serif display', 'cormorant', 'cormorant garamond', 'libre baskerville', 'eb garamond', 'crimson pro', 'instrument serif'];

function resolvePalette(brand: BuildBrand) {
  const primary = hex(brand.primary) ?? INK;
  let accent = hex(brand.accent) ?? hex(brand.secondary) ?? '#BDF2A0';
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
        : INK;
  }
  const secondary = hex(brand.secondary) ?? accent;
  const map: Record<Col, string> = {
    brand: primary, accent, secondary,
    ink: INK, paper: PAPER, white: WHITE, black: BLACK,
    onBrand: inkOn(primary), onAccent: inkOn(accent), onSecondary: inkOn(secondary), onPaper: INK,
    accentLight: relLum(accent) >= 0.34 ? accent : versLum(accent, 0.4, WHITE),
    accentDeep: relLum(accent) <= 0.55 ? accent : versLum(accent, 0.42, INK),
    accentOnBrand: ecart(accent, primary) >= 0.18 ? accent : inkOn(primary),
  };
  return map;
}

function resolveFonts(brand: BuildBrand) {
  const display = (brand.display || '').trim() || 'Archivo';
  const body = (brand.body || '').trim() || display;
  const low = (s: string) => s.toLowerCase();
  return {
    display, body,
    // Typo de geste : celle de la charte si elle joue déjà ce rôle, sinon la nôtre.
    condensed: DISPLAY_FAMILIES.includes(low(display)) ? display : 'Anton',
    serif: SERIF_FAMILIES.includes(low(display)) ? display : SERIF_FAMILIES.includes(low(body)) ? body : 'Playfair Display',
    script: 'Caveat',
  };
}

/** Polices qui ne viennent pas de la charte et qu'il faut donc charger à part. */
export const DESIGN_SYSTEM_FONTS = ['Anton', 'Playfair Display', 'Caveat'];

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
    const weight = nd.weight ?? (nd.slot ? 'bold' : 'normal');
    const style = [weight === 'bold' ? 'bold' : '', nd.italic ? 'italic' : ''].filter(Boolean).join(' ') || 'normal';
    out.push({
      id, type: 'text', text,
      x: px(nd.x, w), y: px(nd.y, h), width: px(nd.w, w),
      fontSize: size, fontFamily: font(nd.font), fontStyle: style,
      textDecoration: nd.strike ? 'line-through' : '',
      fill: fill(nd.fill), align: nd.align ?? 'left',
      uppercase: !!nd.upper, lineHeight: nd.lh ?? 1.15,
      letterSpacing: Math.round((nd.track ?? 0) * size),
      rotation: nd.rotation ?? 0, opacity: nd.opacity ?? 100,
      maxLines: nd.maxLines ?? 3,
      // Une taille plancher explicite : l'auto-ajustement de l'éditeur réduit
      // sans jamais casser la hiérarchie voulue par le dessin.
      maxFontSize: size, minFontSize: Math.max(11, Math.round(size * 0.62)),
      // La largeur fait partie du dessin : le re-calage peut réduire la police,
      // jamais étaler le bloc hors de sa colonne.
      lockWidth: true,
      ...(nd.role ? { role: nd.role } : {}),
      hasBg: false, bgColor: '#000000', bgOpacity: 80, cornerRadius: 4,
      padding: 0, paddingH: 0, paddingV: 0,
      ...(nd.hl ? {
        highlightEnabled: true, highlightColor: fill(nd.hl), highlightOpacity: 100,
        highlightBorderRadius: nd.hlRadius ?? 4, highlightPadding: nd.hlPad ?? Math.round(size * 0.22),
      } : {}),
      ...(nd.hollow ? { hollowEnabled: true } : {}),
      ...(nd.strokeCol ? { stroke: fill(nd.strokeCol), strokeWidth: Math.max(1, px(nd.strokeW ?? 0.003, w)) } : {}),
      ...(nd.shadow ? { shadowEnabled: true, shadowColor: '#000000', shadowOpacity: 40, shadowBlur: 14, shadowOffsetX: 0, shadowOffsetY: 0 } : {}),
    });
  }
  return out;
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
export function describeDesignCandidates(list: DesignRecipe[]) {
  return list.map(r => ({
    id: r.id,
    nom: r.name,
    style: r.vibe.join('/'),
    pour: r.intents.join('/'),
    photo: r.photo === 'required' ? 'utilise la photo' : r.photo === 'optional' ? 'photo facultative' : 'sans photo',
    dessin: r.desc,
    champs: r.slots.map(s => ({ cle: s.key, quoi: s.label, max: s.max })),
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
    out[s.key] = t.length > s.max ? t.slice(0, s.max).replace(/[\s,;:.!?-]+$/, '') : t;
  }
  return out;
}
