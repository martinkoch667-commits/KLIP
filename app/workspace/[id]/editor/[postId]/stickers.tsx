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

export const STICKER_CATS = ['Formes', 'Déco', 'Food', 'Animaux', 'Nature', 'Rétro', 'Objets', 'Fun'] as const;

export interface Sticker { id: string; name: string; cat: string; recolor?: boolean; build: (c: string) => string; }

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
];

export function stickerDataUri(s: Sticker, color: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(s.build(color))}`;
}
