'use client';

// ─── Stickers / illustrations maison recolorables (façon Canva) ──────────────
// Chaque sticker est un SVG géométrique construit à partir d'UNE couleur d'accent
// (choisie dans le panneau Éléments). Des variantes plus claires / plus sombres
// sont dérivées automatiquement (mix) pour donner du volume. À l'insertion, le
// SVG est encodé en data-URI et posé comme élément image, centré sur le plan de
// travail. Recoloration = on change la couleur AVANT d'ajouter (aperçu live).

const INK = '#14160F';
const WHITE = '#FFFFFF';

// Éclaircit (amt>0, vers le blanc) ou assombrit (amt<0, vers le noir) un hex.
export function mix(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  const t = amt < 0 ? 0 : 255, p = Math.min(1, Math.abs(amt));
  const ch = (x: number) => Math.round((t - x) * p + x);
  const to = (x: number) => x.toString(16).padStart(2, '0');
  return `#${to(ch(r))}${to(ch(g))}${to(ch(b))}`;
}

const svg = (inner: string) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>${inner}</svg>`;

export const STICKER_CATS = ['Formes', 'Déco', 'Nature', 'Objets'] as const;

export interface Sticker { id: string; name: string; cat: string; build: (c: string) => string; }

export const STICKERS: Sticker[] = [
  // ───────── FORMES ─────────
  { id: 'blob', name: 'Blob', cat: 'Formes', build: c => svg(
    `<path d='M43 63 C 33 33 73 16 106 27 C 150 42 186 47 176 96 C 168 138 148 182 99 176 C 56 171 21 149 27 110 C 30 87 50 90 43 63 Z' fill='${c}'/>`) },
  { id: 'star', name: 'Étoile', cat: 'Formes', build: c => svg(
    `<polygon points='100,10 121.2,70.9 185.6,72.2 134.2,111.1 152.9,172.8 100,136 47.1,172.8 65.8,111.1 14.4,72.2 78.8,70.9' fill='${c}'/>`) },
  { id: 'sparkle', name: 'Étincelle', cat: 'Formes', build: c => svg(
    `<polygon points='100,8 115.6,84.4 192,100 115.6,115.6 100,192 84.4,115.6 8,100 84.4,84.4' fill='${c}'/>`) },
  { id: 'burst', name: 'Éclat', cat: 'Formes', build: c => {
    const pts: string[] = [];
    for (let i = 0; i < 24; i++) { const r = i % 2 === 0 ? 92 : 74; const a = (i * 15 - 90) * Math.PI / 180; pts.push(`${(100 + r * Math.cos(a)).toFixed(1)},${(100 + r * Math.sin(a)).toFixed(1)}`); }
    return svg(`<polygon points='${pts.join(' ')}' fill='${c}'/><circle cx='100' cy='100' r='52' fill='${mix(c, -0.22)}'/>`);
  } },
  { id: 'ring', name: 'Anneau', cat: 'Formes', build: c => svg(
    `<circle cx='100' cy='100' r='80' fill='none' stroke='${c}' stroke-width='18'/>`) },
  { id: 'plus', name: 'Plus', cat: 'Formes', build: c => svg(
    `<rect x='84' y='30' width='32' height='140' rx='9' fill='${c}'/><rect x='30' y='84' width='140' height='32' rx='9' fill='${c}'/>`) },
  { id: 'gem', name: 'Gemme', cat: 'Formes', build: c => svg(
    `<polygon points='40,88 68,54 132,54 160,88 100,176' fill='${c}'/>` +
    `<polygon points='40,88 68,54 100,88' fill='${mix(c, 0.32)}'/>` +
    `<polygon points='132,54 160,88 100,88' fill='${mix(c, -0.26)}'/>` +
    `<polygon points='40,88 100,88 100,176' fill='${mix(c, 0.14)}'/>`) },
  { id: 'squiggle', name: 'Vaguelette', cat: 'Formes', build: c => svg(
    `<path d='M18 118 Q 40 84 62 118 T 106 118 T 150 118 T 194 118' stroke='${c}' stroke-width='13' fill='none' stroke-linecap='round'/>`) },
  { id: 'arrow', name: 'Flèche', cat: 'Formes', build: c => svg(
    `<path d='M36 148 C 56 66 138 62 158 104' stroke='${c}' stroke-width='14' fill='none' stroke-linecap='round'/>` +
    `<polygon points='166,112 138,96 148,128' fill='${c}'/>`) },

  // ───────── DÉCO ─────────
  { id: 'heart', name: 'Cœur', cat: 'Déco', build: c => svg(
    `<path d='M100 178 C 42 132 22 98 22 70 C 22 44 44 28 66 28 C 83 28 95 40 100 54 C 105 40 117 28 134 28 C 156 28 178 44 178 70 C 178 98 158 132 100 178 Z' fill='${c}'/>` +
    `<ellipse cx='72' cy='62' rx='14' ry='9' fill='${mix(c, 0.4)}' transform='rotate(-30 72 62)'/>`) },
  { id: 'quote', name: 'Guillemets', cat: 'Déco', build: c => svg(
    `<g fill='${c}'>` +
    `<path d='M42 62 h46 v42 q0 34 -32 50 l-8 -17 q15 -8 15 -23 h-21 z'/>` +
    `<path d='M110 62 h46 v42 q0 34 -32 50 l-8 -17 q15 -8 15 -23 h-21 z'/>` +
    `</g>`) },
  { id: 'speech', name: 'Bulle', cat: 'Déco', build: c => svg(
    `<rect x='28' y='40' width='144' height='94' rx='22' fill='${c}'/>` +
    `<polygon points='70,130 70,168 108,132' fill='${c}'/>`) },
  { id: 'ribbon', name: 'Ruban', cat: 'Déco', build: c => svg(
    `<polygon points='42,66 42,126 14,96' fill='${mix(c, -0.26)}'/>` +
    `<polygon points='158,66 158,126 186,96' fill='${mix(c, -0.26)}'/>` +
    `<rect x='40' y='58' width='120' height='60' rx='6' fill='${c}'/>`) },
  { id: 'crown', name: 'Couronne', cat: 'Déco', build: c => svg(
    `<polygon points='28,152 28,74 64,104 100,58 136,104 172,74 172,152' fill='${c}'/>` +
    `<rect x='28' y='150' width='144' height='16' rx='3' fill='${mix(c, -0.28)}'/>` +
    `<circle cx='100' cy='52' r='9' fill='${mix(c, 0.35)}'/>`) },
  { id: 'tag', name: 'Étiquette', cat: 'Déco', build: c => svg(
    `<path d='M28 50 H118 L172 100 L118 150 H28 Z' fill='${c}'/>` +
    `<circle cx='150' cy='100' r='11' fill='${WHITE}'/>`) },
  { id: 'gift', name: 'Cadeau', cat: 'Déco', build: c => svg(
    `<rect x='40' y='78' width='120' height='92' rx='7' fill='${c}'/>` +
    `<rect x='34' y='56' width='132' height='28' rx='7' fill='${mix(c, -0.24)}'/>` +
    `<rect x='88' y='56' width='24' height='114' fill='${mix(c, 0.32)}'/>` +
    `<circle cx='82' cy='48' r='16' fill='${mix(c, 0.32)}'/><circle cx='118' cy='48' r='16' fill='${mix(c, 0.32)}'/>`) },
  { id: 'seal', name: 'Validé', cat: 'Déco', build: c => svg(
    `<circle cx='100' cy='100' r='84' fill='${c}'/>` +
    `<path d='M62 102 L90 130 L140 72' stroke='${WHITE}' stroke-width='16' fill='none' stroke-linecap='round' stroke-linejoin='round'/>`) },

  // ───────── NATURE ─────────
  { id: 'sun', name: 'Soleil', cat: 'Nature', build: c => {
    let rays = '';
    for (let i = 0; i < 12; i++) { const a = i * 30 * Math.PI / 180; rays += `<line x1='${(100 + 54 * Math.cos(a)).toFixed(1)}' y1='${(100 + 54 * Math.sin(a)).toFixed(1)}' x2='${(100 + 84 * Math.cos(a)).toFixed(1)}' y2='${(100 + 84 * Math.sin(a)).toFixed(1)}' stroke='${c}' stroke-width='12' stroke-linecap='round'/>`; }
    return svg(rays + `<circle cx='100' cy='100' r='44' fill='${c}'/>`);
  } },
  { id: 'moon', name: 'Lune', cat: 'Nature', build: c => svg(
    `<path d='M132 28 A78 78 0 1 0 132 172 A60 60 0 1 1 132 28 Z' fill='${c}'/>`) },
  { id: 'cloud', name: 'Nuage', cat: 'Nature', build: c => svg(
    `<g fill='${c}'><circle cx='62' cy='122' r='30'/><circle cx='100' cy='104' r='40'/><circle cx='140' cy='122' r='30'/><rect x='60' y='118' width='82' height='34' rx='8'/></g>`) },
  { id: 'flower', name: 'Fleur', cat: 'Nature', build: c => {
    let petals = `<g fill='${c}'>`;
    for (let i = 0; i < 6; i++) petals += `<ellipse cx='100' cy='52' rx='22' ry='40' transform='rotate(${i * 60} 100 100)'/>`;
    petals += `</g>`;
    return svg(petals + `<circle cx='100' cy='100' r='26' fill='${mix(c, -0.3)}'/>`);
  } },
  { id: 'leaf', name: 'Feuille', cat: 'Nature', build: c => svg(
    `<path d='M100 22 C 44 58 44 142 100 180 C 156 142 156 58 100 22 Z' fill='${c}'/>` +
    `<path d='M100 30 L100 172' stroke='${mix(c, -0.34)}' stroke-width='6'/>`) },
  { id: 'flame', name: 'Flamme', cat: 'Nature', build: c => svg(
    `<path d='M100 22 C 122 58 152 74 140 122 C 133 158 114 178 100 180 C 82 178 62 158 62 122 C 58 94 78 92 82 70 C 86 92 96 86 100 22 Z' fill='${c}'/>` +
    `<path d='M100 96 C 112 114 118 130 108 150 C 103 160 96 164 100 168 C 90 166 82 154 82 138 C 82 122 96 118 100 96 Z' fill='${mix(c, 0.42)}'/>`) },
  { id: 'bolt', name: 'Éclair', cat: 'Nature', build: c => svg(
    `<polygon points='112,12 46,110 92,110 82,188 158,84 104,84' fill='${c}'/>`) },

  // ───────── OBJETS ─────────
  { id: 'smiley', name: 'Smiley', cat: 'Objets', build: c => svg(
    `<circle cx='100' cy='100' r='88' fill='${c}'/>` +
    `<circle cx='72' cy='84' r='11' fill='${INK}'/><circle cx='128' cy='84' r='11' fill='${INK}'/>` +
    `<path d='M64 118 Q 100 156 136 118' stroke='${INK}' stroke-width='12' fill='none' stroke-linecap='round'/>`) },
  { id: 'bell', name: 'Cloche', cat: 'Objets', build: c => svg(
    `<path d='M100 28 C 72 28 62 54 62 88 C 62 120 46 130 46 142 H154 C 154 130 138 120 138 88 C 138 54 128 28 100 28 Z' fill='${c}'/>` +
    `<circle cx='100' cy='24' r='10' fill='${c}'/>` +
    `<circle cx='100' cy='160' r='12' fill='${mix(c, -0.3)}'/>`) },
  { id: 'music', name: 'Note', cat: 'Objets', build: c => svg(
    `<g fill='${c}'><rect x='78' y='46' width='10' height='104'/><rect x='150' y='36' width='10' height='104'/><rect x='78' y='36' width='82' height='16'/><ellipse cx='66' cy='150' rx='24' ry='18'/><ellipse cx='138' cy='140' rx='24' ry='18'/></g>`) },
  { id: 'rocket', name: 'Fusée', cat: 'Objets', build: c => svg(
    `<path d='M100 20 C 128 48 138 88 132 128 H68 C 62 88 72 48 100 20 Z' fill='${c}'/>` +
    `<circle cx='100' cy='78' r='16' fill='${WHITE}'/>` +
    `<polygon points='68,116 44,152 68,140' fill='${mix(c, -0.28)}'/>` +
    `<polygon points='132,116 156,152 132,140' fill='${mix(c, -0.28)}'/>` +
    `<polygon points='84,128 100,176 116,128' fill='${mix(c, 0.4)}'/>`) },
  { id: 'coffee', name: 'Café', cat: 'Objets', build: c => svg(
    `<path d='M52 72 H138 V116 A36 36 0 0 1 102 152 H88 A36 36 0 0 1 52 116 Z' fill='${c}'/>` +
    `<path d='M138 84 h16 a20 20 0 0 1 0 40 h-14' fill='none' stroke='${c}' stroke-width='12'/>` +
    `<rect x='70' y='40' width='8' height='20' rx='4' fill='${mix(c, 0.35)}'/>` +
    `<rect x='96' y='36' width='8' height='24' rx='4' fill='${mix(c, 0.35)}'/>`) },
  { id: 'pin', name: 'Localisation', cat: 'Objets', build: c => svg(
    `<path d='M100 24 C 66 24 40 50 40 84 C 40 128 100 178 100 178 C 100 178 160 128 160 84 C 160 50 134 24 100 24 Z' fill='${c}'/>` +
    `<circle cx='100' cy='84' r='22' fill='${WHITE}'/>`) },
];

export function stickerDataUri(s: Sticker, color: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(s.build(color))}`;
}
