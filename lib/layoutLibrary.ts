// lib/layoutLibrary.ts — la bibliothèque de mises en page partagée.
//
// Elle vivait dans /api/compose-layout, donc toute autre route qui en avait besoin
// devait la recopier — et deux copies finissent toujours par diverger. La géométrie
// des mises en page est le socle du « rendu pro garanti » (l'IA choisit une recette,
// elle n'invente jamais de coordonnées) : elle doit exister en un seul exemplaire.

export type Slot = { role: 'titre' | 'sous-titre' | 'cta'; xPct: number; yPct: number; widthPct: number; fontPct: number; align: 'left' | 'center' | 'right'; color: 'primary' | 'secondary' | 'accent' | 'white' | 'black'; uppercase: boolean };
export type Recipe = { id: string; desc: string; anchor: 'top' | 'center' | 'bottom'; scrim: 'bottom' | 'top' | 'none'; slots: Slot[] };

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
];
