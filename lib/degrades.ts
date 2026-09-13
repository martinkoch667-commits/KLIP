// lib/degrades.ts — dégradés à poser sur un visuel.
//
// POURQUOI ILS SONT CALCULÉS. Un dégradé, c'est deux couleurs et une
// direction : le décrire coûte une ligne, le télécharger coûte 200 Ko. Les
// générer permet en plus de les décliner (huit directions, la palette du
// client, avec ou sans fond) sans tenir cinq cents fichiers.
//
// TOUS PORTENT UN CANAL ALPHA. Un voile qui va du transparent vers le noir se
// pose SUR une photo pour asseoir un texte : c'est son seul usage. Un aplat
// opaque, lui, se fait déjà avec une forme.

export type FamilleDegrade = 'voile' | 'couleur' | 'duo' | 'radial' | 'flou' | 'trame';

export type Degrade = {
  id: string;
  nom: string;
  famille: FamilleDegrade;
  /** Le SVG, aux dimensions demandées. */
  svg: (w: number, h: number) => string;
  /** Mots-clés pour la recherche. */
  mots?: string[];
};

const env = (w: number, h: number, corps: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none">${corps}</svg>`;

/** Direction du dégradé, en coordonnées de 0 à 1. */
const DIRS: Record<string, [number, number, number, number]> = {
  bas: [0, 0, 0, 1], haut: [0, 1, 0, 0], droite: [0, 0, 1, 0], gauche: [1, 0, 0, 0],
  'bas-droite': [0, 0, 1, 1], 'bas-gauche': [1, 0, 0, 1],
};

/** Transparent vers une couleur, dans une direction. */
function fondu(couleur: string, dir: keyof typeof DIRS, douceur = 0.55): (w: number, h: number) => string {
  const [x1, y1, x2, y2] = DIRS[dir];
  return (w, h) => env(w, h,
    `<defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">`
    + `<stop offset="0" stop-color="${couleur}" stop-opacity="0"/>`
    + `<stop offset="${douceur}" stop-color="${couleur}" stop-opacity="0.55"/>`
    + `<stop offset="1" stop-color="${couleur}" stop-opacity="1"/></linearGradient></defs>`
    + `<rect width="100" height="100" fill="url(#g)"/>`);
}

/** Deux couleurs franches. */
function duo(a: string, b: string, dir: keyof typeof DIRS = 'bas-droite'): (w: number, h: number) => string {
  const [x1, y1, x2, y2] = DIRS[dir];
  return (w, h) => env(w, h,
    `<defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">`
    + `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`
    + `<rect width="100" height="100" fill="url(#g)"/>`);
}

/** Halo rond : du centre coloré vers le transparent, ou l'inverse. */
function halo(couleur: string, sens: 'dedans' | 'dehors' = 'dedans', cx = 50, cy = 50, r = 62): (w: number, h: number) => string {
  const dedans = sens === 'dedans';
  return (w, h) => env(w, h,
    `<defs><radialGradient id="g" cx="${cx}%" cy="${cy}%" r="${r}%">`
    + `<stop offset="0" stop-color="${couleur}" stop-opacity="${dedans ? 1 : 0}"/>`
    + `<stop offset="1" stop-color="${couleur}" stop-opacity="${dedans ? 0 : 1}"/>`
    + `</radialGradient></defs><rect width="100" height="100" fill="url(#g)"/>`);
}

/** Taches floues : le dégradé « mesh » des interfaces récentes. Le flou est
 *  énorme et volontaire, c'est ce qui fait fondre les taches entre elles. */
function taches(couleurs: string[], graine = 1): (w: number, h: number) => string {
  let s = graine * 9301 + 49297;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const pois = couleurs.map((c, i) => {
    const cx = 18 + r() * 64, cy = 18 + r() * 64, rx = 26 + r() * 26, ry = 26 + r() * 26;
    return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${c}" opacity="${(0.75 - i * 0.06).toFixed(2)}"/>`;
  }).join('');
  return (w, h) => env(w, h,
    `<defs><filter id="f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter></defs>`
    + `<g filter="url(#f)">${pois}</g>`);
}

/** Trame de points qui s'efface : le halftone des affiches. */
function trame(couleur: string, dir: keyof typeof DIRS = 'bas', pas = 5): (w: number, h: number) => string {
  const [x1, y1, x2, y2] = DIRS[dir];
  return (w, h) => env(w, h,
    `<defs>`
    + `<pattern id="p" width="${pas}" height="${pas}" patternUnits="userSpaceOnUse">`
    + `<circle cx="${pas / 2}" cy="${pas / 2}" r="${pas * 0.32}" fill="${couleur}"/></pattern>`
    + `<linearGradient id="m" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">`
    + `<stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>`
    + `<mask id="k"><rect width="100" height="100" fill="url(#m)"/></mask></defs>`
    + `<rect width="100" height="100" fill="url(#p)" mask="url(#k)"/>`);
}

const NOIR = '#0B0D0A', BLANC = '#FFFFFF';

export const FAMILLES_DEGRADE: { id: FamilleDegrade; label: string }[] = [
  { id: 'voile', label: 'Voiles' },
  { id: 'couleur', label: 'Fondus de couleur' },
  { id: 'duo', label: 'Deux couleurs' },
  { id: 'radial', label: 'Halos' },
  { id: 'flou', label: 'Taches floues' },
  { id: 'trame', label: 'Trames' },
];

const dirsVoile: (keyof typeof DIRS)[] = ['bas', 'haut', 'droite', 'gauche', 'bas-droite', 'bas-gauche'];
const nomDir: Record<string, string> = { bas: 'vers le bas', haut: 'vers le haut', droite: 'vers la droite', gauche: 'vers la gauche', 'bas-droite': 'en diagonale', 'bas-gauche': 'en diagonale inverse' };

export const DEGRADES: Degrade[] = [
  // ── Voiles : c'est ce qui rend un texte lisible sur une photo ────────────
  ...dirsVoile.map(d => ({
    id: `voile-noir-${d}`, nom: `Voile noir ${nomDir[d]}`, famille: 'voile' as const,
    svg: fondu(NOIR, d), mots: ['sombre', 'assombrir', 'lisibilité'],
  })),
  ...dirsVoile.slice(0, 4).map(d => ({
    id: `voile-blanc-${d}`, nom: `Voile blanc ${nomDir[d]}`, famille: 'voile' as const,
    svg: fondu(BLANC, d), mots: ['clair', 'éclaircir'],
  })),
  { id: 'voile-noir-double', nom: 'Voile haut et bas', famille: 'voile', mots: ['cinéma'],
    svg: (w, h) => env(w, h,
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">`
      + `<stop offset="0" stop-color="${NOIR}" stop-opacity="0.85"/><stop offset="0.35" stop-color="${NOIR}" stop-opacity="0"/>`
      + `<stop offset="0.65" stop-color="${NOIR}" stop-opacity="0"/><stop offset="1" stop-color="${NOIR}" stop-opacity="0.9"/>`
      + `</linearGradient></defs><rect width="100" height="100" fill="url(#g)"/>`) },
  { id: 'voile-vignette', nom: 'Vignetage', famille: 'voile', mots: ['bords', 'sombre'],
    svg: halo(NOIR, 'dehors', 50, 50, 72) },

  // ── Fondus de couleur ───────────────────────────────────────────────────
  ...([['#FF5A3C', 'Corail'], ['#0038FF', 'Bleu'], ['#2FD79B', 'Menthe'], ['#FFD400', 'Jaune'],
       ['#9B5DE5', 'Violet'], ['#F15BB5', 'Rose'], ['#0C2A1D', 'Forêt'], ['#C8A165', 'Sable']] as const)
    .map(([c, nom]) => ({
      id: `fondu-${nom.toLowerCase()}`, nom: `Fondu ${nom.toLowerCase()}`, famille: 'couleur' as const,
      svg: fondu(c, 'bas'), mots: [nom],
    })),

  // ── Deux couleurs ───────────────────────────────────────────────────────
  { id: 'duo-coucher', nom: 'Coucher', famille: 'duo', svg: duo('#FF8A3C', '#F15BB5') },
  { id: 'duo-ocean', nom: 'Océan', famille: 'duo', svg: duo('#0038FF', '#2FD79B') },
  { id: 'duo-foret', nom: 'Forêt', famille: 'duo', svg: duo('#0C2A1D', '#2FD79B') },
  { id: 'duo-pastel', nom: 'Pastel', famille: 'duo', svg: duo('#FFD9E8', '#D6E8FF') },
  { id: 'duo-neon', nom: 'Néon', famille: 'duo', svg: duo('#9B5DE5', '#00F5D4') },
  { id: 'duo-braise', nom: 'Braise', famille: 'duo', svg: duo('#FF5A3C', '#FFD400') },
  { id: 'duo-nuit', nom: 'Nuit', famille: 'duo', svg: duo('#0B0D0A', '#2B3A67') },
  { id: 'duo-creme', nom: 'Crème', famille: 'duo', svg: duo('#F5F0E8', '#C8A165') },
  { id: 'duo-argent', nom: 'Argent', famille: 'duo', svg: duo('#E9EAEE', '#8A8F99') },
  { id: 'duo-encre', nom: 'Encre', famille: 'duo', svg: duo('#14160F', '#5A5E50') },

  // ── Halos ───────────────────────────────────────────────────────────────
  { id: 'halo-blanc', nom: 'Halo blanc', famille: 'radial', svg: halo(BLANC) },
  { id: 'halo-jaune', nom: 'Halo jaune', famille: 'radial', svg: halo('#FFD400') },
  { id: 'halo-menthe', nom: 'Halo menthe', famille: 'radial', svg: halo('#2FD79B') },
  { id: 'halo-violet', nom: 'Halo violet', famille: 'radial', svg: halo('#9B5DE5') },
  { id: 'halo-coin', nom: 'Lueur en coin', famille: 'radial', svg: halo('#FF8A3C', 'dedans', 18, 18, 70) },
  { id: 'halo-bas', nom: 'Lueur basse', famille: 'radial', svg: halo('#0038FF', 'dedans', 50, 100, 68) },

  // ── Taches floues ───────────────────────────────────────────────────────
  { id: 'flou-chaud', nom: 'Taches chaudes', famille: 'flou', svg: taches(['#FF5A3C', '#FFD400', '#F15BB5'], 3) },
  { id: 'flou-froid', nom: 'Taches froides', famille: 'flou', svg: taches(['#0038FF', '#00F5D4', '#9B5DE5'], 7) },
  { id: 'flou-pastel', nom: 'Taches pastel', famille: 'flou', svg: taches(['#FFD9E8', '#D6E8FF', '#D9F8C7'], 11) },
  { id: 'flou-menthe', nom: 'Taches menthe', famille: 'flou', svg: taches(['#2FD79B', '#BDF2A0', '#0C2A1D'], 13) },
  { id: 'flou-sable', nom: 'Taches sable', famille: 'flou', svg: taches(['#C8A165', '#F5F0E8', '#FF8A3C'], 17) },
  { id: 'flou-nuit', nom: 'Taches nuit', famille: 'flou', svg: taches(['#2B3A67', '#9B5DE5', '#0B0D0A'], 19) },

  // ── Trames ──────────────────────────────────────────────────────────────
  { id: 'trame-noire', nom: 'Trame noire', famille: 'trame', svg: trame(NOIR, 'bas'), mots: ['halftone', 'points'] },
  { id: 'trame-blanche', nom: 'Trame blanche', famille: 'trame', svg: trame(BLANC, 'haut'), mots: ['halftone'] },
  { id: 'trame-corail', nom: 'Trame corail', famille: 'trame', svg: trame('#FF5A3C', 'bas-droite'), mots: ['halftone'] },
  { id: 'trame-large', nom: 'Grosse trame', famille: 'trame', svg: trame(NOIR, 'droite', 9), mots: ['halftone'] },
];

export const degradeDataUri = (d: Degrade, w: number, h: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(d.svg(w, h))}`;

/** Recherche par nom, famille et synonymes. */
export function chercherDegrades(q: string): Degrade[] {
  const norme = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norme(q.trim());
  if (!t) return DEGRADES;
  const fam = (id: FamilleDegrade) => FAMILLES_DEGRADE.find(f => f.id === id)?.label ?? '';
  return DEGRADES.filter(d =>
    norme(d.nom).includes(t) || norme(fam(d.famille)).includes(t) || (d.mots ?? []).some(m => norme(m).includes(t)));
}
