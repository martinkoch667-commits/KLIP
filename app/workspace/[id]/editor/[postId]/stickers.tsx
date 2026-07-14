'use client';

// ─── Stickers / illustrations maison (façon Canva) ───────────────────────────
// Deux familles :
//  1) Recolorables (recolor:true) — SVG géométriques mono-accent construits à
//     partir d'UNE couleur (variantes claires/sombres dérivées via mix()).
//  2) Illustrations multicolores (recolor absent) — palettes fixes, plein de
//     styles / DA (food, animaux, nature, rétro, objets, fun). Elles ignorent la
//     couleur d'accent.
// À l'insertion, le SVG est encodé en data-URI et posé comme élément image.

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

export const STICKER_CATS = ['Formes', 'Symboles', 'Déco', 'Food', 'Animaux', 'Nature', 'Ameublement', 'Tech', 'Voyage', 'Météo', 'Business', 'Rétro', 'Objets', 'Fun'] as const;

// `sub` = collection/sous-catégorie (façon Canva : sections « Afficher tout » dans une catégorie).
export interface Sticker { id: string; name: string; cat: string; sub?: string; recolor?: boolean; build: (c: string) => string; }

export const STICKERS: Sticker[] = [
  // ═════════ RECOLORABLES — FORMES ═════════
  { id: 'blob', name: 'Blob', cat: 'Formes', recolor: true, build: c => svg(
    `<path d='M43 63 C 33 33 73 16 106 27 C 150 42 186 47 176 96 C 168 138 148 182 99 176 C 56 171 21 149 27 110 C 30 87 50 90 43 63 Z' fill='${c}'/>`) },
  { id: 'star', name: 'Étoile', cat: 'Formes', recolor: true, build: c => svg(
    `<polygon points='100,10 121.2,70.9 185.6,72.2 134.2,111.1 152.9,172.8 100,136 47.1,172.8 65.8,111.1 14.4,72.2 78.8,70.9' fill='${c}'/>`) },
  { id: 'sparkle', name: 'Étincelle', cat: 'Formes', recolor: true, build: c => svg(
    `<polygon points='100,8 115.6,84.4 192,100 115.6,115.6 100,192 84.4,115.6 8,100 84.4,84.4' fill='${c}'/>`) },
  { id: 'burst', name: 'Éclat', cat: 'Formes', recolor: true, build: c => {
    const pts: string[] = [];
    for (let i = 0; i < 24; i++) { const r = i % 2 === 0 ? 92 : 74; const a = (i * 15 - 90) * Math.PI / 180; pts.push(`${(100 + r * Math.cos(a)).toFixed(1)},${(100 + r * Math.sin(a)).toFixed(1)}`); }
    return svg(`<polygon points='${pts.join(' ')}' fill='${c}'/><circle cx='100' cy='100' r='52' fill='${mix(c, -0.22)}'/>`);
  } },
  { id: 'ring', name: 'Anneau', cat: 'Formes', recolor: true, build: c => svg(
    `<circle cx='100' cy='100' r='80' fill='none' stroke='${c}' stroke-width='18'/>`) },
  { id: 'plus', name: 'Plus', cat: 'Formes', recolor: true, build: c => svg(
    `<rect x='84' y='30' width='32' height='140' rx='9' fill='${c}'/><rect x='30' y='84' width='140' height='32' rx='9' fill='${c}'/>`) },
  { id: 'gem', name: 'Gemme', cat: 'Formes', recolor: true, build: c => svg(
    `<polygon points='40,88 68,54 132,54 160,88 100,176' fill='${c}'/>` +
    `<polygon points='40,88 68,54 100,88' fill='${mix(c, 0.32)}'/>` +
    `<polygon points='132,54 160,88 100,88' fill='${mix(c, -0.26)}'/>` +
    `<polygon points='40,88 100,88 100,176' fill='${mix(c, 0.14)}'/>`) },
  { id: 'squiggle', name: 'Vaguelette', cat: 'Formes', recolor: true, build: c => svg(
    `<path d='M18 118 Q 40 84 62 118 T 106 118 T 150 118 T 194 118' stroke='${c}' stroke-width='13' fill='none' stroke-linecap='round'/>`) },
  { id: 'arrow', name: 'Flèche', cat: 'Formes', recolor: true, build: c => svg(
    `<path d='M36 148 C 56 66 138 62 158 104' stroke='${c}' stroke-width='14' fill='none' stroke-linecap='round'/>` +
    `<polygon points='166,112 138,96 148,128' fill='${c}'/>`) },

  // ═════════ RECOLORABLES — DÉCO ═════════
  { id: 'heart', name: 'Cœur', cat: 'Déco', recolor: true, build: c => svg(
    `<path d='M100 178 C 42 132 22 98 22 70 C 22 44 44 28 66 28 C 83 28 95 40 100 54 C 105 40 117 28 134 28 C 156 28 178 44 178 70 C 178 98 158 132 100 178 Z' fill='${c}'/>` +
    `<ellipse cx='72' cy='62' rx='14' ry='9' fill='${mix(c, 0.4)}' transform='rotate(-30 72 62)'/>`) },
  { id: 'quote', name: 'Guillemets', cat: 'Déco', recolor: true, build: c => svg(
    `<g fill='${c}'>` +
    `<path d='M42 62 h46 v42 q0 34 -32 50 l-8 -17 q15 -8 15 -23 h-21 z'/>` +
    `<path d='M110 62 h46 v42 q0 34 -32 50 l-8 -17 q15 -8 15 -23 h-21 z'/>` +
    `</g>`) },
  { id: 'speech', name: 'Bulle', cat: 'Déco', recolor: true, build: c => svg(
    `<rect x='28' y='40' width='144' height='94' rx='22' fill='${c}'/>` +
    `<polygon points='70,130 70,168 108,132' fill='${c}'/>`) },
  { id: 'ribbon', name: 'Ruban', cat: 'Déco', recolor: true, build: c => svg(
    `<polygon points='42,66 42,126 14,96' fill='${mix(c, -0.26)}'/>` +
    `<polygon points='158,66 158,126 186,96' fill='${mix(c, -0.26)}'/>` +
    `<rect x='40' y='58' width='120' height='60' rx='6' fill='${c}'/>`) },
  { id: 'crown', name: 'Couronne', cat: 'Déco', recolor: true, build: c => svg(
    `<polygon points='28,152 28,74 64,104 100,58 136,104 172,74 172,152' fill='${c}'/>` +
    `<rect x='28' y='150' width='144' height='16' rx='3' fill='${mix(c, -0.28)}'/>` +
    `<circle cx='100' cy='52' r='9' fill='${mix(c, 0.35)}'/>`) },
  { id: 'tag', name: 'Étiquette', cat: 'Déco', recolor: true, build: c => svg(
    `<path d='M28 50 H118 L172 100 L118 150 H28 Z' fill='${c}'/>` +
    `<circle cx='150' cy='100' r='11' fill='${WHITE}'/>`) },
  { id: 'gift', name: 'Cadeau', cat: 'Déco', recolor: true, build: c => svg(
    `<rect x='40' y='78' width='120' height='92' rx='7' fill='${c}'/>` +
    `<rect x='34' y='56' width='132' height='28' rx='7' fill='${mix(c, -0.24)}'/>` +
    `<rect x='88' y='56' width='24' height='114' fill='${mix(c, 0.32)}'/>` +
    `<circle cx='82' cy='48' r='16' fill='${mix(c, 0.32)}'/><circle cx='118' cy='48' r='16' fill='${mix(c, 0.32)}'/>`) },
  { id: 'seal', name: 'Validé', cat: 'Déco', recolor: true, build: c => svg(
    `<circle cx='100' cy='100' r='84' fill='${c}'/>` +
    `<path d='M62 102 L90 130 L140 72' stroke='${WHITE}' stroke-width='16' fill='none' stroke-linecap='round' stroke-linejoin='round'/>`) },

  // ═════════ RECOLORABLES — NATURE ═════════
  { id: 'sun', name: 'Soleil', cat: 'Nature', recolor: true, build: c => {
    let rays = '';
    for (let i = 0; i < 12; i++) { const a = i * 30 * Math.PI / 180; rays += `<line x1='${(100 + 54 * Math.cos(a)).toFixed(1)}' y1='${(100 + 54 * Math.sin(a)).toFixed(1)}' x2='${(100 + 84 * Math.cos(a)).toFixed(1)}' y2='${(100 + 84 * Math.sin(a)).toFixed(1)}' stroke='${c}' stroke-width='12' stroke-linecap='round'/>`; }
    return svg(rays + `<circle cx='100' cy='100' r='44' fill='${c}'/>`);
  } },
  { id: 'moon', name: 'Lune', cat: 'Nature', recolor: true, build: c => svg(
    `<path d='M132 28 A78 78 0 1 0 132 172 A60 60 0 1 1 132 28 Z' fill='${c}'/>`) },
  { id: 'cloud', name: 'Nuage', cat: 'Nature', recolor: true, build: c => svg(
    `<g fill='${c}'><circle cx='62' cy='122' r='30'/><circle cx='100' cy='104' r='40'/><circle cx='140' cy='122' r='30'/><rect x='60' y='118' width='82' height='34' rx='8'/></g>`) },
  { id: 'flower', name: 'Fleur', cat: 'Nature', recolor: true, build: c => {
    let petals = `<g fill='${c}'>`;
    for (let i = 0; i < 6; i++) petals += `<ellipse cx='100' cy='52' rx='22' ry='40' transform='rotate(${i * 60} 100 100)'/>`;
    petals += `</g>`;
    return svg(petals + `<circle cx='100' cy='100' r='26' fill='${mix(c, -0.3)}'/>`);
  } },
  { id: 'leaf', name: 'Feuille', cat: 'Nature', recolor: true, build: c => svg(
    `<path d='M100 22 C 44 58 44 142 100 180 C 156 142 156 58 100 22 Z' fill='${c}'/>` +
    `<path d='M100 30 L100 172' stroke='${mix(c, -0.34)}' stroke-width='6'/>`) },
  { id: 'flame', name: 'Flamme', cat: 'Nature', recolor: true, build: c => svg(
    `<path d='M100 22 C 122 58 152 74 140 122 C 133 158 114 178 100 180 C 82 178 62 158 62 122 C 58 94 78 92 82 70 C 86 92 96 86 100 22 Z' fill='${c}'/>` +
    `<path d='M100 96 C 112 114 118 130 108 150 C 103 160 96 164 100 168 C 90 166 82 154 82 138 C 82 122 96 118 100 96 Z' fill='${mix(c, 0.42)}'/>`) },
  { id: 'bolt', name: 'Éclair', cat: 'Nature', recolor: true, build: c => svg(
    `<polygon points='112,12 46,110 92,110 82,188 158,84 104,84' fill='${c}'/>`) },

  // ═════════ RECOLORABLES — OBJETS ═════════
  { id: 'smiley', name: 'Smiley', cat: 'Objets', recolor: true, build: c => svg(
    `<circle cx='100' cy='100' r='88' fill='${c}'/>` +
    `<circle cx='72' cy='84' r='11' fill='${INK}'/><circle cx='128' cy='84' r='11' fill='${INK}'/>` +
    `<path d='M64 118 Q 100 156 136 118' stroke='${INK}' stroke-width='12' fill='none' stroke-linecap='round'/>`) },
  { id: 'bell', name: 'Cloche', cat: 'Objets', recolor: true, build: c => svg(
    `<path d='M100 28 C 72 28 62 54 62 88 C 62 120 46 130 46 142 H154 C 154 130 138 120 138 88 C 138 54 128 28 100 28 Z' fill='${c}'/>` +
    `<circle cx='100' cy='24' r='10' fill='${c}'/>` +
    `<circle cx='100' cy='160' r='12' fill='${mix(c, -0.3)}'/>`) },
  { id: 'music', name: 'Note', cat: 'Objets', recolor: true, build: c => svg(
    `<g fill='${c}'><rect x='78' y='46' width='10' height='104'/><rect x='150' y='36' width='10' height='104'/><rect x='78' y='36' width='82' height='16'/><ellipse cx='66' cy='150' rx='24' ry='18'/><ellipse cx='138' cy='140' rx='24' ry='18'/></g>`) },
  { id: 'pin', name: 'Localisation', cat: 'Objets', recolor: true, build: c => svg(
    `<path d='M100 24 C 66 24 40 50 40 84 C 40 128 100 178 100 178 C 100 178 160 128 160 84 C 160 50 134 24 100 24 Z' fill='${c}'/>` +
    `<circle cx='100' cy='84' r='22' fill='${WHITE}'/>`) },

  // ═════════ MULTICOLORE — FOOD ═════════
  { id: 'food-pizza', name: 'Pizza', cat: 'Food', build: () => svg(
    `<polygon points='100,28 168,172 32,172' fill='#F6C453'/><polygon points='100,44 150,150 50,150' fill='#EF9A2A'/><rect x='30' y='164' width='140' height='14' rx='7' fill='#C77D3A'/><circle cx='88' cy='96' r='10' fill='#E63946'/><circle cx='118' cy='116' r='10' fill='#E63946'/><circle cx='84' cy='134' r='9' fill='#E63946'/><circle cx='120' cy='150' r='8' fill='#7FB04F'/><circle cx='102' cy='78' r='7' fill='#7FB04F'/>`) },
  { id: 'food-burger', name: 'Burger', cat: 'Food', build: () => svg(
    `<path d='M42 80 A58 42 0 0 1 158 80 Z' fill='#E9A94F'/><circle cx='78' cy='58' r='3' fill='#F4E3C1'/><circle cx='100' cy='50' r='3' fill='#F4E3C1'/><circle cx='122' cy='58' r='3' fill='#F4E3C1'/><path d='M40 80 h120 l-8 12 h-104 Z' fill='#7FB04F'/><rect x='42' y='92' width='116' height='16' rx='4' fill='#8B4A2B'/><polygon points='44,108 156,108 146,122 54,122' fill='#FFC93C'/><path d='M44 122 h112 a56 26 0 0 1 -112 0 Z' fill='#E9A94F'/>`) },
  { id: 'food-coffee', name: 'Café', cat: 'Food', build: () => svg(
    `<polygon points='60,72 140,72 130,176 70,176' fill='#F2E7D5'/><rect x='54' y='58' width='92' height='16' rx='4' fill='#B0552F'/><rect x='94' y='30' width='8' height='30' rx='4' fill='#E86A5B'/><rect x='62' y='108' width='76' height='36' rx='4' fill='#8B5E3C'/>`) },
  { id: 'food-icecream', name: 'Glace', cat: 'Food', build: () => svg(
    `<polygon points='72,108 128,108 100,184' fill='#E0A96D'/><path d='M78 116 L100 178 M92 108 L112 150 M108 116 L124 148' stroke='#C98A4E' stroke-width='4'/><circle cx='100' cy='92' r='34' fill='#FF9EC4'/><circle cx='76' cy='80' r='26' fill='#FCE38A'/><circle cx='124' cy='82' r='24' fill='#A8E6CF'/><circle cx='100' cy='58' r='9' fill='#E63946'/><rect x='98' y='48' width='4' height='12' fill='#3B7A2A'/>`) },
  { id: 'food-donut', name: 'Donut', cat: 'Food', build: () => svg(
    `<circle cx='100' cy='104' r='58' fill='#E7A75A'/><circle cx='100' cy='100' r='52' fill='#F49CB8'/><circle cx='100' cy='104' r='22' fill='#FDF6EE'/><rect x='72' y='80' width='10' height='4' rx='2' fill='#4EA8FF' transform='rotate(30 77 82)'/><rect x='118' y='84' width='10' height='4' rx='2' fill='#B6E24B' transform='rotate(-20 123 86)'/><rect x='96' y='70' width='10' height='4' rx='2' fill='#FFD400' transform='rotate(10 101 72)'/><rect x='118' y='118' width='10' height='4' rx='2' fill='#7B3FE4' transform='rotate(40 123 120)'/><rect x='70' y='120' width='10' height='4' rx='2' fill='#2FBF71' transform='rotate(-30 75 122)'/>`) },
  { id: 'food-avocado', name: 'Avocat', cat: 'Food', build: () => svg(
    `<ellipse cx='100' cy='106' rx='50' ry='64' fill='#2F6B24'/><ellipse cx='100' cy='106' rx='38' ry='52' fill='#C3E06B'/><circle cx='100' cy='120' r='22' fill='#7A4A22'/>`) },
  { id: 'food-cherry', name: 'Cerises', cat: 'Food', build: () => svg(
    `<path d='M78 70 C 110 40 140 55 120 92' fill='none' stroke='#5A8A2A' stroke-width='6'/><path d='M78 70 C 70 100 66 118 72 128' fill='none' stroke='#5A8A2A' stroke-width='6'/><circle cx='72' cy='134' r='30' fill='#E63946'/><circle cx='128' cy='138' r='30' fill='#C1121F'/><circle cx='64' cy='124' r='7' fill='#FF8FA3'/>`) },
  { id: 'food-cupcake', name: 'Cupcake', cat: 'Food', build: () => svg(
    `<path d='M60 96 h80 l-12 78 h-56 Z' fill='#E9C46A'/><path d='M56 96 h88 v-6 a44 30 0 0 0 -88 0 Z' fill='#F49CB8'/><circle cx='100' cy='58' r='8' fill='#E63946'/><path d='M70 96 l-6 78 M100 96 v78 M130 96 l6 78' stroke='#D9A94F' stroke-width='3'/>`) },
  { id: 'food-watermelon', name: 'Pastèque', cat: 'Food', build: () => svg(
    `<path d='M28 60 A72 72 0 0 0 172 60 Z' fill='#3B7A2A'/><path d='M36 60 A64 64 0 0 0 164 60 Z' fill='#EFEFE0'/><path d='M44 60 A56 56 0 0 0 156 60 Z' fill='#EF476F'/><circle cx='80' cy='78' r='4' fill='#1B1B1B'/><circle cx='100' cy='90' r='4' fill='#1B1B1B'/><circle cx='120' cy='78' r='4' fill='#1B1B1B'/>`) },
  { id: 'food-taco', name: 'Taco', cat: 'Food', build: () => svg(
    `<path d='M40 150 A70 70 0 0 1 160 150 Z' fill='#F2C14E'/><path d='M46 150 A64 60 0 0 1 154 150 Z' fill='#7FB04F'/><ellipse cx='80' cy='140' rx='14' ry='9' fill='#E63946'/><ellipse cx='118' cy='142' rx='14' ry='9' fill='#E63946'/><rect x='60' y='150' width='80' height='16' rx='6' fill='#F2C14E'/>`) },

  // ═════════ MULTICOLORE — ANIMAUX ═════════
  { id: 'animal-cat', name: 'Chat', cat: 'Animaux', build: () => svg(
    `<polygon points='58,74 46,26 98,62' fill='#F4A259'/><polygon points='142,74 154,26 102,62' fill='#F4A259'/><polygon points='62,66 56,42 84,60' fill='#F48FB1'/><polygon points='138,66 144,42 116,60' fill='#F48FB1'/><circle cx='100' cy='112' r='56' fill='#F4A259'/><circle cx='80' cy='106' r='8' fill='#1B1B1B'/><circle cx='120' cy='106' r='8' fill='#1B1B1B'/><polygon points='100,120 92,128 108,128' fill='#F48FB1'/><path d='M52 112 h-24 M52 122 h-24 M148 112 h24 M148 122 h24' stroke='#C9884E' stroke-width='3'/>`) },
  { id: 'animal-dog', name: 'Chien', cat: 'Animaux', build: () => svg(
    `<ellipse cx='56' cy='104' rx='22' ry='40' fill='#8B5E3C'/><ellipse cx='144' cy='104' rx='22' ry='40' fill='#8B5E3C'/><circle cx='100' cy='108' r='54' fill='#C68A4E'/><circle cx='82' cy='100' r='8' fill='#1B1B1B'/><circle cx='118' cy='100' r='8' fill='#1B1B1B'/><ellipse cx='100' cy='128' rx='16' ry='12' fill='#F2E3D0'/><ellipse cx='100' cy='122' rx='9' ry='7' fill='#1B1B1B'/>`) },
  { id: 'animal-bird', name: 'Oiseau', cat: 'Animaux', build: () => svg(
    `<circle cx='96' cy='108' r='52' fill='#4EA8FF'/><circle cx='96' cy='120' r='36' fill='#BFE3FF'/><path d='M140 108 q34 -6 28 18 q-16 8 -28 -4 Z' fill='#2D6CFF'/><circle cx='80' cy='96' r='8' fill='#14160F'/><polygon points='58,104 34,110 58,118' fill='#FFB020'/>`) },
  { id: 'animal-butterfly', name: 'Papillon', cat: 'Animaux', build: () => svg(
    `<ellipse cx='72' cy='78' rx='30' ry='36' fill='#F15BB5'/><ellipse cx='128' cy='78' rx='30' ry='36' fill='#9B5DE5'/><ellipse cx='76' cy='128' rx='24' ry='28' fill='#FF9EC4'/><ellipse cx='124' cy='128' rx='24' ry='28' fill='#B58BE8'/><rect x='96' y='60' width='8' height='90' rx='4' fill='#3A2E4A'/><circle cx='100' cy='58' r='7' fill='#3A2E4A'/><path d='M100 58 q-10 -18 -20 -22 M100 58 q10 -18 20 -22' stroke='#3A2E4A' stroke-width='3' fill='none'/>`) },
  { id: 'animal-bee', name: 'Abeille', cat: 'Animaux', build: () => svg(
    `<ellipse cx='100' cy='112' rx='46' ry='40' fill='#FFC93C'/><path d='M82 78 v68 M110 76 v72' stroke='#2A2A2A' stroke-width='12'/><ellipse cx='66' cy='84' rx='26' ry='16' fill='#DFF3FF' transform='rotate(-25 66 84)'/><ellipse cx='134' cy='84' rx='26' ry='16' fill='#DFF3FF' transform='rotate(25 134 84)'/><circle cx='90' cy='104' r='5' fill='#2A2A2A'/><circle cx='114' cy='104' r='5' fill='#2A2A2A'/>`) },
  { id: 'animal-fish', name: 'Poisson', cat: 'Animaux', build: () => svg(
    `<ellipse cx='94' cy='104' rx='54' ry='38' fill='#22C3E6'/><polygon points='140,104 178,76 178,132' fill='#12A5C4'/><circle cx='72' cy='96' r='8' fill='#14160F'/><path d='M70 118 q20 12 44 0' stroke='#0E8AA6' stroke-width='4' fill='none'/><polygon points='96,66 110,86 82,86' fill='#12A5C4'/>`) },
  { id: 'animal-rabbit', name: 'Lapin', cat: 'Animaux', build: () => svg(
    `<ellipse cx='78' cy='60' rx='16' ry='42' fill='#F4E3E9'/><ellipse cx='122' cy='60' rx='16' ry='42' fill='#F4E3E9'/><ellipse cx='78' cy='60' rx='8' ry='30' fill='#F6A6C1'/><ellipse cx='122' cy='60' rx='8' ry='30' fill='#F6A6C1'/><circle cx='100' cy='128' r='48' fill='#F7EEF1'/><circle cx='84' cy='122' r='7' fill='#14160F'/><circle cx='116' cy='122' r='7' fill='#14160F'/><polygon points='100,134 94,140 106,140' fill='#F6A6C1'/>`) },
  { id: 'animal-panda', name: 'Panda', cat: 'Animaux', build: () => svg(
    `<circle cx='64' cy='72' r='22' fill='#2A2A2A'/><circle cx='136' cy='72' r='22' fill='#2A2A2A'/><circle cx='100' cy='114' r='56' fill='#FFFFFF'/><ellipse cx='78' cy='108' rx='16' ry='20' fill='#2A2A2A'/><ellipse cx='122' cy='108' rx='16' ry='20' fill='#2A2A2A'/><circle cx='78' cy='110' r='6' fill='#FFFFFF'/><circle cx='122' cy='110' r='6' fill='#FFFFFF'/><ellipse cx='100' cy='134' rx='9' ry='7' fill='#2A2A2A'/>`) },
  { id: 'animal-fox', name: 'Renard', cat: 'Animaux', build: () => svg(
    `<polygon points='52,58 44,110 88,88' fill='#E8662A'/><polygon points='148,58 156,110 112,88' fill='#E8662A'/><polygon points='100,64 150,96 100,170 50,96' fill='#F4863E'/><polygon points='100,120 150,96 100,170' fill='#F5F0E6'/><polygon points='100,120 50,96 100,170' fill='#FBF6EE'/><circle cx='82' cy='104' r='6' fill='#2A2A2A'/><circle cx='118' cy='104' r='6' fill='#2A2A2A'/><polygon points='100,150 92,140 108,140' fill='#2A2A2A'/>`) },
  { id: 'animal-chick', name: 'Poussin', cat: 'Animaux', build: () => svg(
    `<circle cx='100' cy='112' r='52' fill='#FFD400'/><circle cx='100' cy='150' r='40' fill='#FFDE59'/><polygon points='100,110 78,124 100,132' fill='#FF8A00'/><circle cx='84' cy='98' r='7' fill='#2A2A2A'/><circle cx='116' cy='98' r='7' fill='#2A2A2A'/><path d='M74 60 l10 18 M100 52 v20 M126 60 l-10 18' stroke='#F2B705' stroke-width='5'/>`) },

  // ═════════ MULTICOLORE — NATURE (scènes) ═════════
  { id: 'nat-mountain', name: 'Montagne', cat: 'Nature', build: () => svg(
    `<circle cx='140' cy='60' r='22' fill='#FFC93C'/><polygon points='20,160 78,66 136,160' fill='#5A8A6B'/><polygon points='96,160 140,88 184,160' fill='#3E6B54'/><polygon points='60,102 78,66 96,102' fill='#FFFFFF'/><polygon points='126,116 140,88 154,116' fill='#FFFFFF'/><rect x='20' y='158' width='164' height='10' fill='#3E6B54'/>`) },
  { id: 'nat-rainbow', name: 'Arc-en-ciel', cat: 'Nature', build: () => svg(
    `<path d='M30 150 a70 70 0 0 1 140 0' fill='none' stroke='#EF476F' stroke-width='12'/><path d='M42 150 a58 58 0 0 1 116 0' fill='none' stroke='#FFB020' stroke-width='12'/><path d='M54 150 a46 46 0 0 1 92 0' fill='none' stroke='#FFD400' stroke-width='12'/><path d='M66 150 a34 34 0 0 1 68 0' fill='none' stroke='#2FBF71' stroke-width='12'/><path d='M78 150 a22 22 0 0 1 44 0' fill='none' stroke='#4EA8FF' stroke-width='12'/><circle cx='36' cy='150' r='12' fill='#FFFFFF'/><circle cx='164' cy='150' r='12' fill='#FFFFFF'/>`) },
  { id: 'nat-palm', name: 'Palmier', cat: 'Nature', build: () => svg(
    `<rect x='94' y='96' width='14' height='84' rx='6' fill='#B07A44'/><path d='M100 96 q-40 -30 -70 -18 q34 -6 70 8' fill='#2FA05A'/><path d='M100 96 q40 -30 70 -18 q-34 -6 -70 8' fill='#2FA05A'/><path d='M100 96 q-20 -44 -50 -50 q26 12 50 46' fill='#37B368'/><path d='M100 96 q20 -44 50 -50 q-26 12 -50 46' fill='#37B368'/><path d='M100 96 q0 -40 0 -56 q10 24 0 56' fill='#42C878'/>`) },
  { id: 'nat-cactus', name: 'Cactus', cat: 'Nature', build: () => svg(
    `<path d='M56 172 h88 l-6 -22 h-76 Z' fill='#D9762B'/><rect x='86' y='54' width='28' height='100' rx='14' fill='#2FA05A'/><path d='M86 108 h-14 a12 12 0 0 1 -12 -12 v-10 a10 10 0 0 1 20 0 v6' fill='none' stroke='#37B368' stroke-width='16' stroke-linecap='round'/><path d='M114 96 h14 a12 12 0 0 1 12 12 v10 a10 10 0 0 1 -20 0 v-6' fill='none' stroke='#37B368' stroke-width='16' stroke-linecap='round'/><circle cx='100' cy='52' r='9' fill='#F15BB5'/>`) },
  { id: 'nat-tree', name: 'Arbre', cat: 'Nature', build: () => svg(
    `<rect x='92' y='120' width='16' height='56' rx='4' fill='#8B5E3C'/><circle cx='100' cy='90' r='44' fill='#3E8E5A'/><circle cx='72' cy='104' r='30' fill='#4CA36A'/><circle cx='128' cy='104' r='30' fill='#4CA36A'/><circle cx='90' cy='70' r='8' fill='#FF6B4A'/><circle cx='116' cy='84' r='8' fill='#FFB020'/>`) },
  { id: 'nat-mushroom', name: 'Champignon', cat: 'Nature', build: () => svg(
    `<path d='M40 100 a60 46 0 0 1 120 0 Z' fill='#E63946'/><circle cx='72' cy='82' r='10' fill='#FFF3E6'/><circle cx='118' cy='74' r='8' fill='#FFF3E6'/><circle cx='100' cy='94' r='7' fill='#FFF3E6'/><path d='M82 100 h36 v46 a18 18 0 0 1 -36 0 Z' fill='#F2E3D0'/>`) },
  { id: 'nat-tulip', name: 'Tulipe', cat: 'Nature', build: () => svg(
    `<rect x='96' y='96' width='8' height='84' fill='#3E8E5A'/><path d='M78 100 v-24 a22 22 0 0 1 44 0 v24 Z' fill='#FF6B9D'/><path d='M60 100 v-16 a20 20 0 0 1 40 0 v16 Z' fill='#EF476F'/><path d='M100 100 v-16 a20 20 0 0 1 40 0 v16 Z' fill='#F15BB5'/><path d='M96 180 q-40 -20 -50 -50 q34 8 50 40' fill='#4CA36A'/>`) },
  { id: 'nat-wave', name: 'Vague', cat: 'Nature', build: () => svg(
    `<path d='M20 120 q30 -40 60 0 t60 0 t60 0 v60 h-180 Z' fill='#22C3E6'/><path d='M20 140 q30 -30 60 0 t60 0 t60 0 v40 h-180 Z' fill='#4EC8E8'/><path d='M40 116 q10 -14 20 0' fill='none' stroke='#FFFFFF' stroke-width='4'/>`) },
  { id: 'nat-planet', name: 'Planète', cat: 'Nature', build: () => svg(
    `<circle cx='100' cy='100' r='50' fill='#7B3FE4'/><circle cx='82' cy='84' r='12' fill='#9B67F0'/><circle cx='120' cy='116' r='16' fill='#6A2FD0'/><ellipse cx='100' cy='104' rx='84' ry='24' fill='none' stroke='#FFB020' stroke-width='8' transform='rotate(-20 100 104)'/>`) },

  // ═════════ MULTICOLORE — RÉTRO ═════════
  { id: 'retro-sun70', name: 'Soleil 70s', cat: 'Rétro', build: () => svg(
    `<circle cx='100' cy='100' r='60' fill='#FF6B4A'/><path d='M40 100 a60 60 0 0 1 120 0 Z' fill='#FFB84D'/><rect x='40' y='100' width='120' height='4' fill='#FDF6EE'/><rect x='36' y='110' width='128' height='6' fill='#FDF6EE'/><rect x='30' y='122' width='140' height='8' fill='#FDF6EE'/><rect x='24' y='136' width='152' height='10' fill='#FDF6EE'/>`) },
  { id: 'retro-check', name: 'Damier', cat: 'Rétro', build: () => {
    let cells = '';
    for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) if ((xx + yy) % 2 === 0) cells += `<rect x='${20 + xx * 20}' y='${20 + yy * 20}' width='20' height='20' fill='#14160F'/>`;
    return svg(`<clipPath id='cc'><circle cx='100' cy='100' r='80'/></clipPath><circle cx='100' cy='100' r='80' fill='#FDF6EE'/><g clip-path='url(#cc)'>${cells}</g>`);
  } },
  { id: 'retro-groovy', name: 'Groovy', cat: 'Rétro', build: () => {
    let p = `<g fill='#FF6B9D'>`;
    for (let i = 0; i < 8; i++) p += `<rect x='84' y='16' width='32' height='50' rx='16' transform='rotate(${i * 45} 100 100)'/>`;
    p += `</g>`;
    return svg(p + `<circle cx='100' cy='100' r='26' fill='#FFD400'/>`);
  } },
  { id: 'retro-star', name: 'Étoile rétro', cat: 'Rétro', build: () => svg(
    `<polygon points='100,16 118,74 180,74 130,110 148,170 100,132 52,170 70,110 20,74 82,74' fill='#FFB020'/><polygon points='100,44 110,80 146,80 116,102 128,138 100,116 72,138 84,102 54,80 90,80' fill='#FFD400'/>`) },
  { id: 'retro-smiley', name: 'Smiley rétro', cat: 'Rétro', build: () => svg(
    `<circle cx='100' cy='100' r='84' fill='#FFD400'/><path d='M62 78 q10 -16 22 0' stroke='#14160F' stroke-width='9' fill='none' stroke-linecap='round'/><path d='M116 78 q10 -16 22 0' stroke='#14160F' stroke-width='9' fill='none' stroke-linecap='round'/><path d='M60 116 q40 44 80 0' stroke='#14160F' stroke-width='11' fill='none' stroke-linecap='round'/>`) },

  // ═════════ MULTICOLORE — FORMES (abstrait) ═════════
  { id: 'abs-orb', name: 'Orbe dégradé', cat: 'Formes', build: () => svg(
    `<clipPath id='ob'><circle cx='100' cy='100' r='70'/></clipPath><g clip-path='url(#ob)'><rect x='30' y='30' width='140' height='47' fill='#FFB020'/><rect x='30' y='77' width='140' height='47' fill='#F15BB5'/><rect x='30' y='124' width='140' height='47' fill='#7B3FE4'/></g>`) },
  { id: 'abs-memphis', name: 'Memphis', cat: 'Formes', build: () => svg(
    `<circle cx='60' cy='70' r='24' fill='#4EA8FF'/><polygon points='140,40 168,96 112,96' fill='#FFD400'/><rect x='110' y='120' width='50' height='40' rx='8' fill='#EF476F' transform='rotate(12 135 140)'/><path d='M30 140 q16 -20 32 0 t32 0' fill='none' stroke='#2FBF71' stroke-width='6'/>`) },
  { id: 'abs-confetti', name: 'Confettis', cat: 'Formes', build: () => svg(
    `<rect x='40' y='40' width='16' height='16' rx='3' fill='#EF476F' transform='rotate(20 48 48)'/><circle cx='150' cy='50' r='9' fill='#4EA8FF'/><rect x='120' y='120' width='14' height='14' rx='3' fill='#FFD400' transform='rotate(-15 127 127)'/><circle cx='60' cy='140' r='8' fill='#2FBF71'/><polygon points='160,140 172,160 148,160' fill='#7B3FE4'/><path d='M90 60 l14 8' stroke='#FF8A00' stroke-width='5' stroke-linecap='round'/><circle cx='100' cy='100' r='7' fill='#F15BB5'/>`) },

  // ═════════ MULTICOLORE — OBJETS ═════════
  { id: 'obj-camera', name: 'Appareil photo', cat: 'Objets', build: () => svg(
    `<rect x='34' y='72' width='132' height='90' rx='14' fill='#3A4A5A'/><rect x='70' y='58' width='40' height='20' rx='6' fill='#3A4A5A'/><circle cx='100' cy='118' r='30' fill='#22C3E6'/><circle cx='100' cy='118' r='16' fill='#14343E'/><circle cx='140' cy='90' r='7' fill='#FFD400'/>`) },
  { id: 'obj-phone', name: 'Téléphone', cat: 'Objets', build: () => svg(
    `<rect x='60' y='28' width='80' height='144' rx='16' fill='#2A2E38'/><rect x='68' y='44' width='64' height='104' rx='4' fill='#4EA8FF'/><circle cx='100' cy='160' r='7' fill='#5A6472'/><rect x='88' y='34' width='24' height='4' rx='2' fill='#5A6472'/>`) },
  { id: 'obj-bulb', name: 'Ampoule', cat: 'Objets', build: () => svg(
    `<circle cx='100' cy='90' r='50' fill='#FFD400'/><path d='M78 126 h44 v14 a10 10 0 0 1 -10 10 h-24 a10 10 0 0 1 -10 -10 Z' fill='#C9C4B2'/><rect x='82' y='150' width='36' height='8' rx='4' fill='#9AA0A6'/><rect x='86' y='160' width='28' height='8' rx='4' fill='#9AA0A6'/><path d='M100 60 v40 M84 96 l32 0' stroke='#FF8A00' stroke-width='4'/>`) },
  { id: 'obj-trophy', name: 'Trophée', cat: 'Objets', build: () => svg(
    `<path d='M70 40 h60 v34 a30 30 0 0 1 -60 0 Z' fill='#E0B54A'/><path d='M70 48 h-18 a12 12 0 0 0 12 22' fill='none' stroke='#E0B54A' stroke-width='8'/><path d='M130 48 h18 a12 12 0 0 1 -12 22' fill='none' stroke='#E0B54A' stroke-width='8'/><rect x='92' y='104' width='16' height='24' fill='#C99A2E'/><rect x='74' y='128' width='52' height='14' rx='4' fill='#C99A2E'/><rect x='66' y='142' width='68' height='14' rx='4' fill='#B0842A'/><polygon points='100,50 106,62 118,62 108,70 112,82 100,74 88,82 92,70 82,62 94,62' fill='#FFF3C4'/>`) },
  { id: 'obj-medal', name: 'Médaille', cat: 'Objets', build: () => svg(
    `<polygon points='72,30 92,90 60,90' fill='#4EA8FF'/><polygon points='128,30 108,90 140,90' fill='#EF476F'/><circle cx='100' cy='128' r='46' fill='#E0B54A'/><circle cx='100' cy='128' r='34' fill='#F2CD6B'/><polygon points='100,104 108,124 130,124 112,138 118,160 100,146 82,160 88,138 70,124 92,124' fill='#C99A2E'/>`) },
  { id: 'obj-rocket', name: 'Fusée déco', cat: 'Objets', build: () => svg(
    `<path d='M100 18 C 130 46 140 92 132 132 H68 C 60 92 70 46 100 18 Z' fill='#EDEFF3'/><circle cx='100' cy='74' r='16' fill='#4EA8FF'/><circle cx='100' cy='74' r='9' fill='#2D6CFF'/><polygon points='68,120 44,156 68,142' fill='#EF476F'/><polygon points='132,120 156,156 132,142' fill='#EF476F'/><polygon points='84,132 100,178 116,132' fill='#FFB020'/><polygon points='90,132 100,164 110,132' fill='#FF6B4A'/>`) },
  { id: 'obj-balloon', name: 'Ballon', cat: 'Objets', build: () => svg(
    `<ellipse cx='100' cy='84' rx='48' ry='56' fill='#EF476F'/><polygon points='92,138 108,138 100,150' fill='#C1121F'/><path d='M100 150 q-10 20 6 34' fill='none' stroke='#9AA0A6' stroke-width='3'/><ellipse cx='84' cy='66' rx='12' ry='16' fill='#FF88A6'/>`) },
  { id: 'obj-crown-gold', name: 'Couronne or', cat: 'Objets', build: () => svg(
    `<polygon points='28,150 28,72 64,102 100,54 136,102 172,72 172,150' fill='#E0B54A'/><rect x='28' y='148' width='144' height='16' rx='3' fill='#C99A2E'/><circle cx='64' cy='96' r='7' fill='#EF476F'/><circle cx='100' cy='50' r='8' fill='#4EA8FF'/><circle cx='136' cy='96' r='7' fill='#2FBF71'/>`) },
  { id: 'obj-ring', name: 'Bague diamant', cat: 'Objets', build: () => svg(
    `<circle cx='100' cy='128' r='42' fill='none' stroke='#E0B54A' stroke-width='12'/><polygon points='100,36 78,66 122,66' fill='#8FE3F0'/><polygon points='78,66 122,66 100,104' fill='#22C3E6'/><polygon points='78,66 100,66 100,104' fill='#5AD0E6'/>`) },
  { id: 'obj-gift-color', name: 'Cadeau coloré', cat: 'Objets', build: () => svg(
    `<rect x='40' y='80' width='120' height='90' rx='8' fill='#EF476F'/><rect x='34' y='58' width='132' height='28' rx='8' fill='#C1121F'/><rect x='88' y='58' width='24' height='112' fill='#FFD400'/><path d='M100 58 C 80 36 54 44 66 58 M100 58 C 120 36 146 44 134 58' fill='none' stroke='#FFD400' stroke-width='10'/>`) },

  // ═════════ MULTICOLORE — FUN ═════════
  { id: 'fun-fire', name: 'Feu', cat: 'Fun', build: () => svg(
    `<path d='M100 20 C 124 56 156 74 142 124 C 134 160 114 180 100 182 C 82 180 60 160 60 122 C 56 92 78 90 82 66 C 86 90 96 84 100 20 Z' fill='#FF8A00'/><path d='M100 70 C 116 96 132 108 122 146 C 116 168 106 176 100 178 C 88 176 76 160 76 136 C 74 112 92 108 96 88 C 98 106 96 92 100 70 Z' fill='#FFD400'/><path d='M100 120 C 108 134 114 146 106 162 C 102 170 96 172 100 176 C 92 174 86 164 86 152 C 86 138 96 136 100 120 Z' fill='#FFF3A0'/>`) },
  { id: 'fun-thumbsup', name: 'Pouce', cat: 'Fun', build: () => svg(
    `<rect x='40' y='96' width='30' height='66' rx='8' fill='#FFB020'/><path d='M78 162 h56 a14 14 0 0 0 14 -12 l8 -40 a12 12 0 0 0 -12 -14 h-40 l6 -28 a14 14 0 0 0 -26 -10 l-22 44 v50 a12 12 0 0 0 12 12 Z' fill='#FFC93C'/>`) },
  { id: 'fun-heart-sparkle', name: 'Cœur étoilé', cat: 'Fun', build: () => svg(
    `<path d='M100 168 C 48 128 30 98 30 72 C 30 48 50 34 70 34 C 85 34 96 44 100 56 C 104 44 115 34 130 34 C 150 34 170 48 170 72 C 170 98 152 128 100 168 Z' fill='#F15BB5'/><polygon points='150,40 156,58 174,64 156,70 150,88 144,70 126,64 144,58' fill='#FFD400'/><polygon points='44,96 48,108 60,112 48,116 44,128 40,116 28,112 40,108' fill='#FFD400'/>`) },
  { id: 'fun-star-eyes', name: 'Yeux étoiles', cat: 'Fun', build: () => svg(
    `<circle cx='100' cy='100' r='84' fill='#FFD400'/><polygon points='72,72 78,88 94,88 81,98 86,114 72,104 58,114 63,98 50,88 66,88' fill='#EF476F'/><polygon points='128,72 134,88 150,88 137,98 142,114 128,104 114,114 119,98 106,88 122,88' fill='#EF476F'/><path d='M64 128 q36 34 72 0' stroke='#14160F' stroke-width='10' fill='none' stroke-linecap='round'/>`) },
  { id: 'fun-lightning', name: 'Éclair jaune', cat: 'Fun', build: () => svg(
    `<polygon points='114,14 44,112 92,112 82,190 160,84 106,84' fill='#FFD400'/><polygon points='108,40 68,104 96,104 90,150 132,92 100,92' fill='#FFB020'/>`) },
  { id: 'fun-peace', name: 'Peace', cat: 'Fun', build: () => svg(
    `<circle cx='100' cy='100' r='80' fill='#2FBF71'/><circle cx='100' cy='100' r='72' fill='none' stroke='#FDF6EE' stroke-width='10'/><g stroke='#FDF6EE' stroke-width='10'><line x1='100' y1='28' x2='100' y2='172'/><line x1='100' y1='100' x2='150' y2='150'/><line x1='100' y1='100' x2='50' y2='150'/></g>`) },

  // ═════════ RECOLORABLES — SYMBOLES (signes) ═════════
  { id: 'sym-check', name: 'Coche', cat: 'Symboles', sub: 'Signes', recolor: true, build: c => svg(
    `<path d='M40 108 l38 40 l82 -96' stroke='${c}' stroke-width='22' fill='none' stroke-linecap='round' stroke-linejoin='round'/>`) },
  { id: 'sym-cross', name: 'Croix', cat: 'Symboles', sub: 'Signes', recolor: true, build: c => svg(
    `<path d='M52 52 l96 96 M148 52 l-96 96' stroke='${c}' stroke-width='22' fill='none' stroke-linecap='round'/>`) },
  { id: 'sym-info', name: 'Info', cat: 'Symboles', sub: 'Signes', recolor: true, build: c => svg(
    `<circle cx='100' cy='100' r='80' fill='${c}'/><circle cx='100' cy='66' r='11' fill='${WHITE}'/><rect x='89' y='90' width='22' height='56' rx='8' fill='${WHITE}'/>`) },
  { id: 'sym-warning', name: 'Attention', cat: 'Symboles', sub: 'Signes', recolor: true, build: c => svg(
    `<path d='M100 26 L182 168 H18 Z' fill='${c}'/><rect x='90' y='76' width='20' height='52' rx='8' fill='${WHITE}'/><circle cx='100' cy='144' r='11' fill='${WHITE}'/>`) },
  { id: 'sym-play', name: 'Lecture', cat: 'Symboles', sub: 'Signes', recolor: true, build: c => svg(
    `<circle cx='100' cy='100' r='80' fill='${c}'/><polygon points='82,66 82,134 140,100' fill='${WHITE}'/>`) },
  { id: 'sym-search', name: 'Loupe', cat: 'Symboles', sub: 'Signes', recolor: true, build: c => svg(
    `<circle cx='88' cy='88' r='44' fill='none' stroke='${c}' stroke-width='16'/><line x1='120' y1='120' x2='168' y2='168' stroke='${c}' stroke-width='18' stroke-linecap='round'/>`) },
  { id: 'sym-lock', name: 'Cadenas', cat: 'Symboles', sub: 'Signes', recolor: true, build: c => svg(
    `<path d='M70 90 v-14 a30 30 0 0 1 60 0 v14' fill='none' stroke='${c}' stroke-width='14'/><rect x='52' y='88' width='96' height='82' rx='14' fill='${c}'/><circle cx='100' cy='122' r='11' fill='${WHITE}'/><rect x='94' y='126' width='12' height='26' rx='4' fill='${WHITE}'/>`) },
  { id: 'sym-wifi', name: 'Wifi', cat: 'Symboles', sub: 'Signes', recolor: true, build: c => svg(
    `<g fill='none' stroke='${c}' stroke-width='15' stroke-linecap='round'><path d='M44 88 a80 80 0 0 1 112 0'/><path d='M66 112 a48 48 0 0 1 68 0'/></g><circle cx='100' cy='150' r='12' fill='${c}'/>`) },
  { id: 'sym-star-out', name: 'Étoile ligne', cat: 'Symboles', sub: 'Signes', recolor: true, build: c => svg(
    `<polygon points='100,20 121,74 179,78 135,116 149,174 100,142 51,174 65,116 21,78 79,74' fill='none' stroke='${c}' stroke-width='14' stroke-linejoin='round'/>`) },
  { id: 'sym-bookmark', name: 'Marque-page', cat: 'Symboles', sub: 'Signes', recolor: true, build: c => svg(
    `<path d='M56 30 h88 v152 l-44 -34 l-44 34 Z' fill='${c}'/>`) },
  { id: 'sym-hashtag', name: 'Hashtag', cat: 'Symboles', sub: 'Signes', recolor: true, build: c => svg(
    `<g stroke='${c}' stroke-width='16' stroke-linecap='round'><line x1='72' y1='34' x2='56' y2='166'/><line x1='144' y1='34' x2='128' y2='166'/><line x1='36' y1='76' x2='168' y2='76'/><line x1='32' y1='124' x2='164' y2='124'/></g>`) },
  { id: 'sym-at', name: 'Arobase', cat: 'Symboles', sub: 'Signes', recolor: true, build: c => svg(
    `<circle cx='100' cy='100' r='28' fill='none' stroke='${c}' stroke-width='14'/><path d='M128 100 v14 a20 20 0 0 0 40 0 a68 68 0 1 0 -30 56' fill='none' stroke='${c}' stroke-width='14' stroke-linecap='round'/>`) },

  // ═════════ MULTICOLORE — AMEUBLEMENT ═════════
  { id: 'furn-chair', name: 'Chaise', cat: 'Ameublement', sub: 'Sièges', build: () => svg(
    `<rect x='54' y='44' width='92' height='70' rx='12' fill='#E8825A'/><rect x='60' y='52' width='80' height='54' rx='8' fill='#F29B77'/><rect x='50' y='110' width='100' height='20' rx='6' fill='#C96A44'/><rect x='56' y='130' width='12' height='42' rx='4' fill='#8B5E3C'/><rect x='132' y='130' width='12' height='42' rx='4' fill='#8B5E3C'/>`) },
  { id: 'furn-sofa', name: 'Canapé', cat: 'Ameublement', sub: 'Sièges', build: () => svg(
    `<rect x='34' y='66' width='132' height='46' rx='14' fill='#5E90A0'/><rect x='24' y='90' width='26' height='58' rx='12' fill='#5E90A0'/><rect x='150' y='90' width='26' height='58' rx='12' fill='#5E90A0'/><rect x='44' y='96' width='112' height='46' rx='10' fill='#4E7C8A'/><rect x='50' y='100' width='50' height='40' rx='8' fill='#6AA0B0'/><rect x='102' y='100' width='50' height='40' rx='8' fill='#6AA0B0'/><rect x='42' y='142' width='10' height='20' rx='3' fill='#3A5A64'/><rect x='148' y='142' width='10' height='20' rx='3' fill='#3A5A64'/>`) },
  { id: 'furn-armchair', name: 'Fauteuil', cat: 'Ameublement', sub: 'Sièges', build: () => svg(
    `<rect x='64' y='60' width='72' height='46' rx='14' fill='#E8825A'/><rect x='48' y='86' width='24' height='56' rx='11' fill='#E8825A'/><rect x='128' y='86' width='24' height='56' rx='11' fill='#E8825A'/><rect x='60' y='96' width='80' height='46' rx='10' fill='#C96A44'/><rect x='64' y='138' width='10' height='22' rx='3' fill='#8B5E3C'/><rect x='126' y='138' width='10' height='22' rx='3' fill='#8B5E3C'/>`) },
  { id: 'furn-table', name: 'Table', cat: 'Ameublement', sub: 'Meubles', build: () => svg(
    `<rect x='34' y='72' width='132' height='16' rx='4' fill='#B07A44'/><rect x='48' y='88' width='12' height='76' rx='3' fill='#8B5E3C'/><rect x='140' y='88' width='12' height='76' rx='3' fill='#8B5E3C'/>`) },
  { id: 'furn-bed', name: 'Lit', cat: 'Ameublement', sub: 'Meubles', build: () => svg(
    `<rect x='28' y='58' width='16' height='74' rx='4' fill='#8B5E3C'/><rect x='156' y='72' width='16' height='60' rx='4' fill='#8B5E3C'/><rect x='36' y='58' width='120' height='34' rx='8' fill='#A8C0CE'/><rect x='30' y='90' width='140' height='40' rx='8' fill='#8FA9B8'/><rect x='42' y='72' width='42' height='24' rx='9' fill='#FFFFFF'/>`) },
  { id: 'furn-shelf', name: 'Étagère', cat: 'Ameublement', sub: 'Meubles', build: () => svg(
    `<rect x='40' y='42' width='120' height='11' rx='3' fill='#B07A44'/><rect x='40' y='96' width='120' height='11' rx='3' fill='#B07A44'/><rect x='40' y='150' width='120' height='11' rx='3' fill='#B07A44'/><rect x='52' y='58' width='11' height='38' fill='#EF476F'/><rect x='65' y='54' width='11' height='42' fill='#4EA8FF'/><rect x='78' y='60' width='11' height='36' fill='#FFB020'/><rect x='120' y='112' width='11' height='38' fill='#2FBF71'/><rect x='133' y='108' width='11' height='42' fill='#9B5DE5'/>`) },
  { id: 'furn-lamp', name: 'Lampe', cat: 'Ameublement', sub: 'Déco maison', build: () => svg(
    `<polygon points='70,52 130,52 150,104 50,104' fill='#F2C14E'/><polygon points='70,52 130,52 138,74 62,74' fill='#F7D178'/><rect x='96' y='104' width='8' height='64' fill='#9AA0A6'/><rect x='72' y='166' width='56' height='12' rx='5' fill='#5A6472'/>`) },
  { id: 'furn-plant', name: 'Plante', cat: 'Ameublement', sub: 'Déco maison', build: () => svg(
    `<ellipse cx='100' cy='84' rx='16' ry='42' fill='#3E8E5A'/><ellipse cx='72' cy='98' rx='14' ry='34' fill='#4CA36A' transform='rotate(-28 72 98)'/><ellipse cx='128' cy='98' rx='14' ry='34' fill='#4CA36A' transform='rotate(28 128 98)'/><path d='M72 128 h56 l-8 46 h-40 Z' fill='#D9762B'/><rect x='66' y='118' width='68' height='14' rx='4' fill='#E88B3F'/>`) },
  { id: 'furn-frame', name: 'Cadre', cat: 'Ameublement', sub: 'Déco maison', build: () => svg(
    `<rect x='48' y='36' width='104' height='128' rx='6' fill='#B07A44'/><rect x='62' y='50' width='76' height='100' rx='3' fill='#EDE7DA'/><circle cx='120' cy='78' r='11' fill='#FFC93C'/><polygon points='62,150 92,108 116,150' fill='#5A8A6B'/><polygon points='104,150 128,120 138,150' fill='#3E6B54'/>`) },
  { id: 'furn-rug', name: 'Tapis', cat: 'Ameublement', sub: 'Déco maison', build: () => svg(
    `<rect x='36' y='70' width='128' height='84' rx='8' fill='#C1445E'/><rect x='48' y='82' width='104' height='60' rx='4' fill='none' stroke='#F2D3DA' stroke-width='4'/><circle cx='100' cy='112' r='16' fill='#F2D3DA'/><g stroke='#C1445E' stroke-width='4'><line x1='40' y1='158' x2='40' y2='168'/><line x1='60' y1='158' x2='60' y2='168'/><line x1='80' y1='158' x2='80' y2='168'/><line x1='100' y1='158' x2='100' y2='168'/><line x1='120' y1='158' x2='120' y2='168'/><line x1='140' y1='158' x2='140' y2='168'/><line x1='160' y1='158' x2='160' y2='168'/></g>`) },
  { id: 'furn-clock', name: 'Horloge', cat: 'Ameublement', sub: 'Déco maison', build: () => svg(
    `<circle cx='100' cy='100' r='68' fill='#EDE7DA'/><circle cx='100' cy='100' r='68' fill='none' stroke='#3A4A5A' stroke-width='8'/><line x1='100' y1='100' x2='100' y2='58' stroke='#14160F' stroke-width='6' stroke-linecap='round'/><line x1='100' y1='100' x2='134' y2='112' stroke='#14160F' stroke-width='6' stroke-linecap='round'/><circle cx='100' cy='100' r='6' fill='#EF476F'/>`) },
  { id: 'furn-mirror', name: 'Miroir', cat: 'Ameublement', sub: 'Déco maison', build: () => svg(
    `<ellipse cx='100' cy='100' rx='52' ry='68' fill='#CFE3EA'/><ellipse cx='100' cy='100' rx='52' ry='68' fill='none' stroke='#C99A2E' stroke-width='10'/><path d='M78 68 q-8 22 0 46' stroke='#FFFFFF' stroke-width='6' fill='none' stroke-linecap='round'/>`) },

  // ═════════ MULTICOLORE — TECH (appareils) ═════════
  { id: 'tech-laptop', name: 'Ordinateur portable', cat: 'Tech', sub: 'Appareils', build: () => svg(
    `<rect x='50' y='50' width='100' height='66' rx='6' fill='#3A4A5A'/><rect x='58' y='58' width='84' height='50' rx='2' fill='#4EA8FF'/><path d='M38 116 h124 l10 22 h-144 Z' fill='#9AA0A6'/><rect x='84' y='116' width='32' height='7' rx='3' fill='#7A828C'/>`) },
  { id: 'tech-keyboard', name: 'Clavier', cat: 'Tech', sub: 'Appareils', build: () => {
    let keys = '';
    for (let r = 0; r < 3; r++) for (let cc = 0; cc < 8; cc++) keys += `<rect x='${40 + cc * 15}' y='${82 + r * 13}' width='11' height='9' rx='2' fill='#CFD6DD'/>`;
    keys += `<rect x='72' y='121' width='56' height='9' rx='2' fill='#CFD6DD'/>`;
    return svg(`<rect x='28' y='72' width='144' height='64' rx='10' fill='#3A4A5A'/>${keys}`);
  } },
  { id: 'tech-mouse', name: 'Souris', cat: 'Tech', sub: 'Appareils', build: () => svg(
    `<rect x='72' y='56' width='56' height='96' rx='28' fill='#CFD6DD'/><rect x='72' y='56' width='56' height='96' rx='28' fill='none' stroke='#9AA0A6' stroke-width='3'/><line x1='100' y1='58' x2='100' y2='96' stroke='#9AA0A6' stroke-width='3'/><rect x='96' y='70' width='8' height='16' rx='4' fill='#4EA8FF'/>`) },
  { id: 'tech-headphones', name: 'Casque', cat: 'Tech', sub: 'Appareils', build: () => svg(
    `<path d='M44 112 a56 56 0 0 1 112 0' fill='none' stroke='#3A4A5A' stroke-width='12'/><rect x='34' y='106' width='26' height='48' rx='11' fill='#EF476F'/><rect x='140' y='106' width='26' height='48' rx='11' fill='#EF476F'/>`) },
  { id: 'tech-tv', name: 'Télévision', cat: 'Tech', sub: 'Appareils', build: () => svg(
    `<rect x='34' y='46' width='132' height='84' rx='8' fill='#2A2E38'/><rect x='42' y='54' width='116' height='68' rx='3' fill='#4EA8FF'/><rect x='86' y='130' width='28' height='10' fill='#5A6472'/><rect x='66' y='140' width='68' height='9' rx='4' fill='#3A4A5A'/>`) },
  { id: 'tech-watch', name: 'Montre', cat: 'Tech', sub: 'Appareils', build: () => svg(
    `<rect x='80' y='28' width='40' height='32' rx='6' fill='#3A4A5A'/><rect x='80' y='140' width='40' height='32' rx='6' fill='#3A4A5A'/><rect x='64' y='58' width='72' height='84' rx='18' fill='#2A2E38'/><rect x='72' y='66' width='56' height='68' rx='10' fill='#22C3E6'/>`) },
  { id: 'tech-gamepad', name: 'Manette', cat: 'Tech', sub: 'Appareils', build: () => svg(
    `<path d='M52 86 h96 a34 34 0 0 1 30 46 a20 20 0 0 1 -38 2 l-6 -14 h-68 l-6 14 a20 20 0 0 1 -38 -2 a34 34 0 0 1 30 -46 Z' fill='#3A4A5A'/><rect x='62' y='102' width='10' height='30' rx='3' fill='#CFD6DD'/><rect x='52' y='112' width='30' height='10' rx='3' fill='#CFD6DD'/><circle cx='128' cy='108' r='7' fill='#EF476F'/><circle cx='146' cy='122' r='7' fill='#FFD400'/>`) },
  { id: 'tech-printer', name: 'Imprimante', cat: 'Tech', sub: 'Appareils', build: () => svg(
    `<rect x='58' y='40' width='84' height='40' rx='4' fill='#EDE7DA'/><rect x='40' y='76' width='120' height='56' rx='8' fill='#9AA0A6'/><rect x='58' y='128' width='84' height='30' rx='4' fill='#EDE7DA'/><rect x='118' y='90' width='26' height='8' rx='4' fill='#2FBF71'/><circle cx='60' cy='94' r='5' fill='#EF476F'/>`) },
  { id: 'tech-camera-dev', name: 'Caméra', cat: 'Tech', sub: 'Appareils', build: () => svg(
    `<rect x='34' y='74' width='120' height='74' rx='10' fill='#2A2E38'/><polygon points='154,90 184,74 184,148 154,132' fill='#3A4A5A'/><circle cx='84' cy='111' r='24' fill='#4EA8FF'/><circle cx='84' cy='111' r='12' fill='#14343E'/><circle cx='130' cy='92' r='6' fill='#EF476F'/>`) },

  // ═════════ MULTICOLORE — VOYAGE ═════════
  { id: 'trav-plane', name: 'Avion', cat: 'Voyage', sub: 'Voyage', build: () => svg(
    `<path d='M100 22 l12 62 l62 30 v14 l-62 -14 l-6 42 l18 14 v10 l-24 -8 l-24 8 v-10 l18 -14 l-6 -42 l-62 14 v-14 l62 -30 Z' fill='#4EA8FF'/>`) },
  { id: 'trav-suitcase', name: 'Valise', cat: 'Voyage', sub: 'Voyage', build: () => svg(
    `<rect x='78' y='52' width='44' height='24' rx='6' fill='none' stroke='#8B2E42' stroke-width='8'/><rect x='48' y='72' width='104' height='86' rx='10' fill='#C1445E'/><rect x='48' y='96' width='104' height='10' fill='#8B2E42'/><rect x='70' y='118' width='8' height='22' rx='3' fill='#F2D3DA'/><rect x='122' y='118' width='8' height='22' rx='3' fill='#F2D3DA'/>`) },
  { id: 'trav-compass', name: 'Boussole', cat: 'Voyage', sub: 'Voyage', build: () => svg(
    `<circle cx='100' cy='100' r='68' fill='#EDE7DA'/><circle cx='100' cy='100' r='68' fill='none' stroke='#3A4A5A' stroke-width='8'/><polygon points='100,50 116,100 100,90 84,100' fill='#EF476F'/><polygon points='100,150 116,100 100,110 84,100' fill='#CFD6DD'/><circle cx='100' cy='100' r='7' fill='#3A4A5A'/>`) },
  { id: 'trav-map', name: 'Carte', cat: 'Voyage', sub: 'Voyage', build: () => svg(
    `<path d='M40 60 l40 -12 l40 12 l40 -12 v92 l-40 12 l-40 -12 l-40 12 Z' fill='#CDE6C4'/><path d='M80 48 v92 M120 60 v92' stroke='#8FB98A' stroke-width='3'/><path d='M50 92 q30 20 60 -6 t38 4' fill='none' stroke='#4EA8FF' stroke-width='4'/><circle cx='128' cy='86' r='9' fill='#EF476F'/><polygon points='120,90 136,90 128,108' fill='#EF476F'/>`) },
  { id: 'trav-balloon', name: 'Montgolfière', cat: 'Voyage', sub: 'Voyage', build: () => svg(
    `<path d='M60 96 a40 46 0 1 1 80 0 c0 20 -18 34 -40 40 c-22 -6 -40 -20 -40 -40 Z' fill='#EF476F'/><path d='M100 50 v88' stroke='#FFD400' stroke-width='8'/><path d='M76 60 q-2 40 0 74' stroke='#FFFFFF' stroke-width='6' fill='none'/><path d='M124 60 q2 40 0 74' stroke='#FFFFFF' stroke-width='6' fill='none'/><rect x='86' y='150' width='28' height='22' rx='4' fill='#8B5E3C'/><path d='M84 138 l4 12 M116 138 l-4 12' stroke='#9AA0A6' stroke-width='2'/>`) },
  { id: 'trav-ticket', name: 'Billet', cat: 'Voyage', sub: 'Voyage', build: () => svg(
    `<path d='M36 76 h128 v18 a10 10 0 0 0 0 20 v18 h-128 v-18 a10 10 0 0 0 0 -20 Z' fill='#FFB020'/><line x1='120' y1='80' x2='120' y2='146' stroke='#FDF6EE' stroke-width='4' stroke-dasharray='6 6'/><circle cx='72' cy='104' r='11' fill='#FDF6EE'/><rect x='54' y='126' width='40' height='6' rx='3' fill='#FDF6EE'/>`) },

  // ═════════ MULTICOLORE — MÉTÉO ═════════
  { id: 'weat-rain', name: 'Pluie', cat: 'Météo', sub: 'Météo', build: () => svg(
    `<g fill='#9AB4C4'><circle cx='74' cy='84' r='26'/><circle cx='112' cy='70' r='34'/><circle cx='142' cy='90' r='24'/><rect x='72' y='84' width='72' height='30' rx='10'/></g><g stroke='#4EA8FF' stroke-width='7' stroke-linecap='round'><line x1='80' y1='128' x2='72' y2='150'/><line x1='108' y1='128' x2='100' y2='150'/><line x1='136' y1='128' x2='128' y2='150'/></g>`) },
  { id: 'weat-snow', name: 'Neige', cat: 'Météo', sub: 'Météo', build: () => svg(
    `<g fill='#B7C7D2'><circle cx='74' cy='84' r='26'/><circle cx='112' cy='70' r='34'/><circle cx='142' cy='90' r='24'/><rect x='72' y='84' width='72' height='30' rx='10'/></g><g fill='#EAF4FB'><circle cx='78' cy='140' r='7'/><circle cx='110' cy='150' r='7'/><circle cx='140' cy='138' r='7'/></g>`) },
  { id: 'weat-storm', name: 'Orage', cat: 'Météo', sub: 'Météo', build: () => svg(
    `<g fill='#5A6472'><circle cx='74' cy='80' r='26'/><circle cx='112' cy='66' r='34'/><circle cx='142' cy='86' r='24'/><rect x='72' y='80' width='72' height='30' rx='10'/></g><polygon points='108,108 82,150 104,150 96,182 132,132 106,132' fill='#FFD400'/>`) },
  { id: 'weat-partly', name: 'Éclaircies', cat: 'Météo', sub: 'Météo', build: () => svg(
    `<g stroke='#FFC93C' stroke-width='6' stroke-linecap='round'><line x1='78' y1='26' x2='78' y2='40'/><line x1='40' y1='68' x2='28' y2='68'/><line x1='48' y1='40' x2='40' y2='32'/><line x1='108' y1='40' x2='116' y2='32'/></g><circle cx='78' cy='68' r='26' fill='#FFC93C'/><g fill='#EDF2F5'><circle cx='96' cy='120' r='28'/><circle cx='134' cy='106' r='34'/><circle cx='160' cy='124' r='22'/><rect x='94' y='120' width='68' height='30' rx='10'/></g>`) },
  { id: 'weat-wind', name: 'Vent', cat: 'Météo', sub: 'Météo', build: () => svg(
    `<g stroke='#8FB0C0' stroke-width='9' fill='none' stroke-linecap='round'><path d='M30 76 h84 a18 18 0 1 0 -18 -18'/><path d='M30 108 h108 a18 18 0 1 1 -18 18'/><path d='M30 140 h64 a16 16 0 1 1 -16 16'/></g>`) },
  { id: 'weat-sun', name: 'Grand soleil', cat: 'Météo', sub: 'Météo', build: () => {
    let rays = '';
    for (let i = 0; i < 8; i++) { const a = i * 45 * Math.PI / 180; rays += `<line x1='${(100 + 52 * Math.cos(a)).toFixed(1)}' y1='${(100 + 52 * Math.sin(a)).toFixed(1)}' x2='${(100 + 78 * Math.cos(a)).toFixed(1)}' y2='${(100 + 78 * Math.sin(a)).toFixed(1)}' stroke='#FFB020' stroke-width='11' stroke-linecap='round'/>`; }
    return svg(`${rays}<circle cx='100' cy='100' r='40' fill='#FFC93C'/>`);
  } },

  // ═════════ MULTICOLORE — BUSINESS (bureau) ═════════
  { id: 'biz-chart', name: 'Graphique', cat: 'Business', sub: 'Bureau', build: () => svg(
    `<rect x='36' y='36' width='128' height='128' rx='10' fill='#FFFFFF' stroke='#E3E0D5' stroke-width='3'/><rect x='54' y='104' width='18' height='40' fill='#4EA8FF'/><rect x='90' y='80' width='18' height='64' fill='#2FBF71'/><rect x='126' y='60' width='18' height='84' fill='#FFB020'/>`) },
  { id: 'biz-linechart', name: 'Courbe', cat: 'Business', sub: 'Bureau', build: () => svg(
    `<rect x='36' y='36' width='128' height='128' rx='10' fill='#FFFFFF' stroke='#E3E0D5' stroke-width='3'/><polyline points='56,130 84,98 108,116 148,64' fill='none' stroke='#EF476F' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/><circle cx='148' cy='64' r='7' fill='#EF476F'/>`) },
  { id: 'biz-folder', name: 'Dossier', cat: 'Business', sub: 'Bureau', build: () => svg(
    `<path d='M34 62 h44 l12 16 h76 a8 8 0 0 1 8 8 v66 a8 8 0 0 1 -8 8 h-132 a8 8 0 0 1 -8 -8 v-82 a8 8 0 0 1 8 -8 Z' fill='#E0A02E'/><rect x='30' y='88' width='140' height='62' rx='8' fill='#FFC93C'/>`) },
  { id: 'biz-calendar', name: 'Calendrier', cat: 'Business', sub: 'Bureau', build: () => {
    let dots = '';
    for (let r = 0; r < 3; r++) for (let cc = 0; cc < 4; cc++) dots += `<circle cx='${64 + cc * 24}' cy='${102 + r * 20}' r='5' fill='#9AA0A6'/>`;
    return svg(`<rect x='40' y='52' width='120' height='108' rx='10' fill='#FFFFFF' stroke='#E3E0D5' stroke-width='3'/><rect x='40' y='52' width='120' height='28' rx='10' fill='#EF476F'/><rect x='64' y='40' width='10' height='24' rx='4' fill='#B0324A'/><rect x='126' y='40' width='10' height='24' rx='4' fill='#B0324A'/>${dots}`);
  } },
  { id: 'biz-envelope', name: 'Enveloppe', cat: 'Business', sub: 'Bureau', build: () => svg(
    `<rect x='36' y='60' width='128' height='84' rx='8' fill='#4EA8FF'/><path d='M36 66 l64 46 l64 -46' fill='none' stroke='#FFFFFF' stroke-width='6'/>`) },
  { id: 'biz-briefcase', name: 'Mallette', cat: 'Business', sub: 'Bureau', build: () => svg(
    `<rect x='78' y='52' width='44' height='26' rx='8' fill='none' stroke='#8B5E3C' stroke-width='8'/><rect x='36' y='74' width='128' height='82' rx='10' fill='#8B5E3C'/><rect x='36' y='74' width='128' height='30' fill='#7A4E2E'/><rect x='92' y='104' width='16' height='16' rx='3' fill='#C99A2E'/>`) },
  { id: 'biz-target', name: 'Cible', cat: 'Business', sub: 'Bureau', build: () => svg(
    `<circle cx='100' cy='100' r='70' fill='#EF476F'/><circle cx='100' cy='100' r='50' fill='#FDF6EE'/><circle cx='100' cy='100' r='30' fill='#EF476F'/><circle cx='100' cy='100' r='12' fill='#FDF6EE'/>`) },
  { id: 'biz-coin', name: 'Pièce', cat: 'Business', sub: 'Bureau', build: () => svg(
    `<circle cx='100' cy='100' r='58' fill='#E0B54A'/><circle cx='100' cy='100' r='44' fill='#F2CD6B'/><path d='M100 66 v68 M84 80 a16 13 0 0 1 32 0 M84 122 a16 13 0 0 0 32 0 M84 100 h32' stroke='#C99A2E' stroke-width='6' fill='none' stroke-linecap='round'/>`) },
  { id: 'biz-clip', name: 'Trombone', cat: 'Business', sub: 'Bureau', build: () => svg(
    `<path d='M118 40 a26 26 0 0 1 26 26 v76 a34 34 0 0 1 -68 0 v-70 a18 18 0 0 1 36 0 v58 a8 8 0 0 1 -16 0 v-52' fill='none' stroke='#5A6472' stroke-width='12' stroke-linecap='round'/>`) },
  { id: 'biz-pin', name: 'Punaise', cat: 'Business', sub: 'Bureau', build: () => svg(
    `<path d='M100 30 l30 30 l-14 8 l4 40 l-40 0 l4 -40 l-14 -8 Z' fill='#EF476F'/><rect x='96' y='108' width='8' height='60' rx='4' fill='#B0324A'/>`) },

  // ═════════ MULTICOLORE — FORMES / FRAMES À CLIPPER ═════════
  { id: 'frame-blob', name: 'Cadre blob', cat: 'Formes', sub: 'Cadres', build: () => svg(
    `<path d='M43 63 C 33 33 73 16 106 27 C 150 42 186 47 176 96 C 168 138 148 182 99 176 C 56 171 21 149 27 110 C 30 87 50 90 43 63 Z' fill='none' stroke='#14160F' stroke-width='10'/>`) },
  { id: 'frame-flower', name: 'Cadre fleur', cat: 'Formes', sub: 'Cadres', build: () => {
    let petals = `<g fill='none' stroke='#14160F' stroke-width='9'>`;
    for (let i = 0; i < 8; i++) petals += `<ellipse cx='100' cy='48' rx='24' ry='44' transform='rotate(${i * 45} 100 100)'/>`;
    petals += `</g>`;
    return svg(petals);
  } },
  { id: 'frame-heart', name: 'Cadre cœur', cat: 'Formes', sub: 'Cadres', build: () => svg(
    `<path d='M100 178 C 42 132 22 98 22 70 C 22 44 44 28 66 28 C 83 28 95 40 100 54 C 105 40 117 28 134 28 C 156 28 178 44 178 70 C 178 98 158 132 100 178 Z' fill='none' stroke='#14160F' stroke-width='10'/>`) },
  { id: 'frame-hex', name: 'Cadre hexagone', cat: 'Formes', sub: 'Cadres', build: () => svg(
    `<polygon points='100,20 168,60 168,140 100,180 32,140 32,60' fill='none' stroke='#14160F' stroke-width='10' stroke-linejoin='round'/>`) },
];

export function stickerDataUri(s: Sticker, color: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(s.build(color))}`;
}
