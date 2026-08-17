// lib/layoutLibrary.ts — la bibliothèque de mises en page partagée.
//
// Elle vivait dans /api/compose-layout, donc toute autre route qui en avait besoin
// devait la recopier — et deux copies finissent toujours par diverger. La géométrie
// des mises en page est le socle du « rendu pro garanti » (l'IA choisit une recette,
// elle n'invente jamais de coordonnées) : elle doit exister en un seul exemplaire.

// `box` : aplat de couleur derrière le texte (cartouche / bandeau / badge). Sans
// lui, un post simple ne savait faire QUE du texte posé sur la photo — tout le
// vocabulaire graphique du carrousel (cartouche, bandeau, pastille) lui manquait,
// et c'est une des raisons pour lesquelles les visuels se ressemblaient tous.
export type SlotBox = 'none' | 'brand' | 'accent' | 'white' | 'black';
export type Slot = { role: 'titre' | 'sous-titre' | 'cta'; xPct: number; yPct: number; widthPct: number; fontPct: number; align: 'left' | 'center' | 'right'; color: 'primary' | 'secondary' | 'accent' | 'white' | 'black'; uppercase: boolean; box?: SlotBox; radiusPct?: number };
// `accents` : filets fins de couleur posés par la recette elle-même (soulignement,
// barre de kicker). Ils font partie du dessin, pas d'une décision de l'IA.
export type Accent = { type: 'rule' | 'underline'; xPct: number; yPct: number; widthPct: number; heightPct?: number; color: 'primary' | 'secondary' | 'accent' | 'white' | 'black' };
export type Recipe = { id: string; desc: string; anchor: 'top' | 'center' | 'bottom'; scrim: 'bottom' | 'top' | 'none'; slots: Slot[]; accents?: Accent[] };

// Bibliothèque de mises en page soignées (issue d'une veille des codes Instagram/Facebook).
// Valables tous formats (positions en %). L'IA en choisit selon la photo + le style de la marque.
export const LAYOUT_LIBRARY: Recipe[] = [
  // — Éditorial / magazine —
  { id: 'lib-editorial-bottom', desc: 'Magazine : titre énorme bas-gauche + kicker fin au-dessus. Photo avec zone calme en bas.', anchor: 'bottom', scrim: 'bottom', slots: [
    { role: 'sous-titre', xPct: 7, yPct: 70, widthPct: 78, fontPct: 4, align: 'left', color: 'white', uppercase: false },
    { role: 'titre', xPct: 7, yPct: 76, widthPct: 84, fontPct: 10, align: 'left', color: 'white', uppercase: true },
  ] },
  { id: 'lib-masthead-top', desc: 'Couverture : gros titre haut-gauche + sous-titre dessous. Sujet plutôt en bas de l’image.', anchor: 'top', scrim: 'top', slots: [
    { role: 'titre', xPct: 7, yPct: 9, widthPct: 84, fontPct: 10, align: 'left', color: 'white', uppercase: true },
    { role: 'sous-titre', xPct: 7, yPct: 22, widthPct: 70, fontPct: 4, align: 'left', color: 'white', uppercase: false },
  ] },
  { id: 'lib-lower-third', desc: 'Bandeau bas (style reportage) : titre + sous-titre dans le tiers inférieur, alignés à gauche.', anchor: 'bottom', scrim: 'bottom', slots: [
    { role: 'titre', xPct: 7, yPct: 74, widthPct: 80, fontPct: 8, align: 'left', color: 'white', uppercase: true },
    { role: 'sous-titre', xPct: 7, yPct: 86, widthPct: 70, fontPct: 3.8, align: 'left', color: 'white', uppercase: false },
  ] },
  // — Centré / hero —
  { id: 'lib-hero-center', desc: 'Hero : titre centré au cœur de l’image, aéré, impactant. Fond assez uni au centre.', anchor: 'center', scrim: 'none', slots: [
    { role: 'titre', xPct: 10, yPct: 40, widthPct: 80, fontPct: 11, align: 'center', color: 'white', uppercase: true },
    { role: 'sous-titre', xPct: 18, yPct: 54, widthPct: 64, fontPct: 4, align: 'center', color: 'white', uppercase: false },
  ] },
  { id: 'lib-big-statement', desc: 'Punchline : une phrase très courte, énorme, centrée — impact maximal.', anchor: 'center', scrim: 'bottom', slots: [
    { role: 'titre', xPct: 8, yPct: 38, widthPct: 84, fontPct: 13, align: 'center', color: 'white', uppercase: true },
  ] },
  { id: 'lib-quote-center', desc: 'Citation : texte centré, taille moyenne, + attribution discrète dessous.', anchor: 'center', scrim: 'bottom', slots: [
    { role: 'titre', xPct: 12, yPct: 40, widthPct: 76, fontPct: 7, align: 'center', color: 'white', uppercase: false },
    { role: 'cta', xPct: 30, yPct: 60, widthPct: 40, fontPct: 3.4, align: 'center', color: 'accent', uppercase: true },
  ] },
  // — Haut / kicker —
  { id: 'lib-top-kicker', desc: 'Kicker accent en haut + gros titre dessous. Sujet plutôt en bas.', anchor: 'top', scrim: 'top', slots: [
    { role: 'sous-titre', xPct: 7, yPct: 8, widthPct: 60, fontPct: 3.6, align: 'left', color: 'accent', uppercase: true },
    { role: 'titre', xPct: 7, yPct: 13, widthPct: 86, fontPct: 9.5, align: 'left', color: 'white', uppercase: true },
  ] },
  { id: 'lib-centered-top', desc: 'Titre centré dans le tiers supérieur, élégant et aéré.', anchor: 'top', scrim: 'top', slots: [
    { role: 'titre', xPct: 10, yPct: 12, widthPct: 80, fontPct: 9, align: 'center', color: 'white', uppercase: true },
    { role: 'sous-titre', xPct: 18, yPct: 25, widthPct: 64, fontPct: 3.8, align: 'center', color: 'white', uppercase: false },
  ] },
  // — Hiérarchie 3 niveaux (éducatif / storytelling) —
  { id: 'lib-three-tier', desc: 'Hiérarchie 3 niveaux bas-gauche : kicker + gros titre + sous-titre. Pédago / storytelling.', anchor: 'bottom', scrim: 'bottom', slots: [
    { role: 'sous-titre', xPct: 7, yPct: 64, widthPct: 60, fontPct: 3.4, align: 'left', color: 'accent', uppercase: true },
    { role: 'titre', xPct: 7, yPct: 69, widthPct: 84, fontPct: 9, align: 'left', color: 'white', uppercase: true },
    { role: 'cta', xPct: 7, yPct: 87, widthPct: 70, fontPct: 3.4, align: 'left', color: 'white', uppercase: false },
  ] },
  { id: 'lib-left-stack', desc: 'Bloc titre + sous-titre aligné à gauche, au tiers central (lecture en Z).', anchor: 'center', scrim: 'bottom', slots: [
    { role: 'titre', xPct: 7, yPct: 44, widthPct: 58, fontPct: 9, align: 'left', color: 'white', uppercase: true },
    { role: 'sous-titre', xPct: 7, yPct: 57, widthPct: 52, fontPct: 4, align: 'left', color: 'white', uppercase: false },
  ] },
  // — Promo / CTA —
  { id: 'lib-bottom-centered-cta', desc: 'Titre centré en bas + call-to-action en accent. Bon pour une offre/annonce.', anchor: 'bottom', scrim: 'bottom', slots: [
    { role: 'titre', xPct: 10, yPct: 70, widthPct: 80, fontPct: 9, align: 'center', color: 'white', uppercase: true },
    { role: 'cta', xPct: 25, yPct: 85, widthPct: 50, fontPct: 3.8, align: 'center', color: 'accent', uppercase: true },
  ] },
  { id: 'lib-promo-top', desc: 'Promo : accroche en haut + grosse offre en accent. Annonce/réduction.', anchor: 'top', scrim: 'top', slots: [
    { role: 'sous-titre', xPct: 7, yPct: 9, widthPct: 70, fontPct: 4, align: 'left', color: 'white', uppercase: true },
    { role: 'titre', xPct: 7, yPct: 15, widthPct: 80, fontPct: 11, align: 'left', color: 'accent', uppercase: true },
  ] },
  // — Minimal —
  { id: 'lib-minimal-corner', desc: 'Minimal : titre court discret en bas à gauche, très épuré.', anchor: 'bottom', scrim: 'none', slots: [
    { role: 'titre', xPct: 7, yPct: 85, widthPct: 60, fontPct: 5.5, align: 'left', color: 'white', uppercase: true },
  ] },
  { id: 'lib-minimal-bottom-center', desc: 'Minimal : titre court centré tout en bas, sobre.', anchor: 'bottom', scrim: 'bottom', slots: [
    { role: 'titre', xPct: 12, yPct: 86, widthPct: 76, fontPct: 5, align: 'center', color: 'white', uppercase: true },
  ] },

  // — Vocabulaire graphique : aplats et filets —
  // Ces recettes ne posent pas le texte NU sur la photo : elles utilisent la
  // couleur de la marque comme matière (cartouche, bandeau, pastille, filet).
  // C'est ce qui distingue un visuel de marque d'une légende posée sur une image.
  { id: 'lib-cartouche-bottom', desc: 'Cartouche de marque : titre dans un aplat de couleur en bas à gauche, très identitaire. Marche même sur une photo chargée.', anchor: 'bottom', scrim: 'none', slots: [
    { role: 'titre', xPct: 7, yPct: 72, widthPct: 74, fontPct: 8, align: 'left', color: 'white', uppercase: true, box: 'brand' },
    { role: 'sous-titre', xPct: 7, yPct: 87, widthPct: 66, fontPct: 3.6, align: 'left', color: 'white', uppercase: false },
  ] },
  { id: 'lib-badge-kicker', desc: 'Badge : petit kicker en pastille de couleur accent, puis gros titre. Annonce, nouveauté, date.', anchor: 'top', scrim: 'top', slots: [
    { role: 'sous-titre', xPct: 7, yPct: 8, widthPct: 34, fontPct: 3.2, align: 'center', color: 'black', uppercase: true, box: 'accent', radiusPct: 50 },
    { role: 'titre', xPct: 7, yPct: 16, widthPct: 84, fontPct: 10, align: 'left', color: 'white', uppercase: true },
  ] },
  { id: 'lib-rule-editorial', desc: 'Éditorial au filet : trait d’accent court, kicker, puis titre. Sobre et très pro.', anchor: 'bottom', scrim: 'bottom', slots: [
    { role: 'sous-titre', xPct: 7, yPct: 66, widthPct: 60, fontPct: 3.2, align: 'left', color: 'accent', uppercase: true },
    { role: 'titre', xPct: 7, yPct: 72, widthPct: 82, fontPct: 9, align: 'left', color: 'white', uppercase: true },
  ], accents: [
    { type: 'rule', xPct: 7, yPct: 62, widthPct: 12, heightPct: 0.7, color: 'accent' },
  ] },
  { id: 'lib-band-statement', desc: 'Bandeau plein : phrase forte dans une bande de couleur au tiers bas. Impact maximal, lisibilité garantie.', anchor: 'bottom', scrim: 'none', slots: [
    { role: 'titre', xPct: 0, yPct: 62, widthPct: 100, fontPct: 9, align: 'center', color: 'white', uppercase: true, box: 'brand', radiusPct: 0 },
  ] },
  { id: 'lib-price-tag', desc: 'Offre : titre au-dessus, prix en pastille d’accent bien visible. Promo, menu, tarif.', anchor: 'bottom', scrim: 'bottom', slots: [
    { role: 'titre', xPct: 7, yPct: 68, widthPct: 78, fontPct: 8.5, align: 'left', color: 'white', uppercase: true },
    { role: 'cta', xPct: 7, yPct: 84, widthPct: 34, fontPct: 4.5, align: 'center', color: 'black', uppercase: true, box: 'accent', radiusPct: 50 },
  ] },
  // — Titre découpé en blocs empilés —
  // Chaque ligne devient son PROPRE bloc, avec son propre aplat : les cartouches
  // épousent la longueur de chaque ligne et créent un décroché. C'est la
  // composition d'affiche par excellence — bien plus forte qu'un pavé unique, et
  // celle que Martin a retenue sur ses essais.
  { id: 'lib-stack-bottom', desc: 'Titre découpé en DEUX blocs empilés en bas à gauche, chacun dans son aplat de marque. Décroché d’affiche, très identitaire. Coupe le titre en deux moitiés qui se tiennent.', anchor: 'bottom', scrim: 'none', slots: [
    { role: 'titre', xPct: 8, yPct: 68, widthPct: 62, fontPct: 8.5, align: 'left', color: 'white', uppercase: false, box: 'brand' },
    { role: 'sous-titre', xPct: 8, yPct: 79, widthPct: 66, fontPct: 8.5, align: 'left', color: 'white', uppercase: false, box: 'brand' },
  ] },
  { id: 'lib-stack-center', desc: 'Titre découpé en deux blocs empilés au centre, chacun dans son aplat. Frappe fort sur une photo calme au milieu.', anchor: 'center', scrim: 'none', slots: [
    { role: 'titre', xPct: 10, yPct: 40, widthPct: 60, fontPct: 9, align: 'left', color: 'white', uppercase: false, box: 'brand' },
    { role: 'sous-titre', xPct: 10, yPct: 52, widthPct: 66, fontPct: 9, align: 'left', color: 'white', uppercase: false, box: 'brand' },
  ] },
  { id: 'lib-stack-accent', desc: 'Trois blocs empilés en bas : deux en couleur de marque, le dernier en accent. Pour une accroche en trois temps.', anchor: 'bottom', scrim: 'none', slots: [
    { role: 'titre', xPct: 8, yPct: 60, widthPct: 58, fontPct: 7.5, align: 'left', color: 'white', uppercase: false, box: 'brand' },
    { role: 'sous-titre', xPct: 8, yPct: 70, widthPct: 64, fontPct: 7.5, align: 'left', color: 'white', uppercase: false, box: 'brand' },
    { role: 'cta', xPct: 8, yPct: 80, widthPct: 44, fontPct: 5, align: 'left', color: 'black', uppercase: true, box: 'accent' },
  ] },

  { id: 'lib-underline-title', desc: 'Titre souligné d’un filet de marque, au centre-gauche. Élégant, presse.', anchor: 'center', scrim: 'bottom', slots: [
    { role: 'titre', xPct: 8, yPct: 42, widthPct: 72, fontPct: 9.5, align: 'left', color: 'white', uppercase: true },
    { role: 'sous-titre', xPct: 8, yPct: 60, widthPct: 60, fontPct: 3.6, align: 'left', color: 'white', uppercase: false },
  ], accents: [
    { type: 'underline', xPct: 8, yPct: 56, widthPct: 26, heightPct: 0.6, color: 'accent' },
  ] },
];
