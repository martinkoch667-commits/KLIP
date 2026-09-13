// lib/formes.ts — bibliothèque de formes vectorielles de l'éditeur.
//
// POURQUOI DES TRACÉS PLUTÔT QUE DES IMAGES. Une forme posée sur le plan de
// travail doit se recolorer, se dégrader, se contourer et s'étirer comme un
// rectangle : un PNG ne sait rien faire de tout ça. Chaque forme est donc un
// chemin SVG dans une boîte de référence, redessiné à la taille du calque.
//
// POURQUOI ELLES SONT CALCULÉES. Écrire à la main 12 polygones, 10 étoiles,
// 4 rouages et 12 fleurs, c'est 2 000 caractères de coordonnées impossibles à
// relire et à corriger. Les générateurs ci-dessous produisent la même famille
// avec un paramètre — le nombre de côtés, la profondeur du creux — donc la
// bibliothèque s'élargit sans s'alourdir.
//
// Les tracés n'utilisent que M, L, C, Q, T et Z, en absolu : c'est ce que sait
// lire `tracerForme`, et c'est ce qui permet de faire tourner un tracé
// (`tourner`) sans dépendre d'un moteur SVG.

export type FamilleForme =
  | 'base' | 'polygones' | 'etoiles' | 'larmes' | 'rouages' | 'asterisques'
  | 'naturelles' | 'abstraites' | 'bulles' | 'lignes' | 'fleches';

export type Forme = {
  id: string;
  nom: string;
  famille: FamilleForme;
  /** Tracé, dans la boîte `vb` (100 × 100 par défaut). */
  d: string;
  /** Boîte du tracé. Rectangulaire pour les lignes, sinon elles flottent. */
  vb?: [number, number];
  /** Épaisseur du trait, dans le repère du tracé. Présent = forme au trait
   *  (pas de remplissage) : une ligne, une flèche fine. */
  trait?: number;
  /** Pointillés, dans le repère du tracé. */
  dash?: number[];
  /** Mots-clés supplémentaires pour la recherche. */
  mots?: string[];
};

export const FAMILLES: { id: FamilleForme; label: string }[] = [
  { id: 'lignes', label: 'Lignes' },
  { id: 'fleches', label: 'Flèches' },
  { id: 'base', label: 'Formes de base' },
  { id: 'polygones', label: 'Polygones' },
  { id: 'etoiles', label: 'Étoiles' },
  { id: 'larmes', label: 'Larmes' },
  { id: 'rouages', label: 'Rouages' },
  { id: 'asterisques', label: 'Astérisques' },
  { id: 'naturelles', label: 'Formes naturelles' },
  { id: 'abstraites', label: 'Formes abstraites' },
  { id: 'bulles', label: 'Bulles' },
];

// ─── Fabrique de tracés ──────────────────────────────────────────────────────

const RAD = Math.PI / 180;
const N = (v: number) => String(Math.round(v * 100) / 100);
/** Point sur un cercle, angle en degrés (0 = droite, -90 = haut). */
const pt = (cx: number, cy: number, r: number, deg: number): [number, number] =>
  [cx + r * Math.cos(deg * RAD), cy + r * Math.sin(deg * RAD)];

const poly = (pts: [number, number][]) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${N(x)} ${N(y)}`).join(' ') + ' Z';

/** Polygone régulier à `n` côtés, pointe en haut par défaut. */
function polygone(n: number, depart = -90, r = 48): string {
  return poly(Array.from({ length: n }, (_, i) => pt(50, 50, r, depart + (360 / n) * i)));
}

/** Polygone aux sommets adoucis : les coins deviennent des quadratiques. */
function polygoneArrondi(n: number, arrondi = 0.22, depart = -90, r = 48): string {
  const s = Array.from({ length: n }, (_, i) => pt(50, 50, r, depart + (360 / n) * i));
  const bouts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = s[i], b = s[(i + 1) % n], p = s[(i - 1 + n) % n];
    const e1: [number, number] = [a[0] + (p[0] - a[0]) * arrondi, a[1] + (p[1] - a[1]) * arrondi];
    const e2: [number, number] = [a[0] + (b[0] - a[0]) * arrondi, a[1] + (b[1] - a[1]) * arrondi];
    bouts.push(`${i ? 'L' : 'M'}${N(e1[0])} ${N(e1[1])} Q${N(a[0])} ${N(a[1])} ${N(e2[0])} ${N(e2[1])}`);
  }
  return bouts.join(' ') + ' Z';
}

/** Étoile à `n` branches ; `creux` = rayon intérieur rapporté à l'extérieur. */
function etoile(n: number, creux = 0.42, depart = -90, r = 48): string {
  return poly(Array.from({ length: n * 2 }, (_, i) =>
    pt(50, 50, i % 2 ? r * creux : r, depart + (180 / n) * i)));
}

/** Étincelle : branches concaves, comme le « sparkle » des logiciels de design. */
function etincelle(n = 4, creux = 0.16, depart = -90, r = 48): string {
  const bouts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = depart + (360 / n) * i;
    const b = a + 360 / n;
    const [x0, y0] = pt(50, 50, r, a);
    const [cx, cy] = pt(50, 50, r * creux, (a + b) / 2);
    const [x1, y1] = pt(50, 50, r, b);
    if (!i) bouts.push(`M${N(x0)} ${N(y0)}`);
    bouts.push(`Q${N(cx)} ${N(cy)} ${N(x1)} ${N(y1)}`);
  }
  return bouts.join(' ') + ' Z';
}

/** Fleur à `n` pétales : chaque pétale est une cubique bombée entre deux bases. */
function fleur(n: number, rBase = 17, r = 46, bombe = 1.42): string {
  const pas = 360 / n;
  const bouts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = -90 + pas * i - pas / 2;
    const a1 = a0 + pas;
    const [x0, y0] = pt(50, 50, rBase, a0);
    const [x1, y1] = pt(50, 50, rBase, a1);
    const [c0x, c0y] = pt(50, 50, r * bombe, a0 + pas * 0.22);
    const [c1x, c1y] = pt(50, 50, r * bombe, a1 - pas * 0.22);
    if (!i) bouts.push(`M${N(x0)} ${N(y0)}`);
    bouts.push(`C${N(c0x)} ${N(c0y)} ${N(c1x)} ${N(c1y)} ${N(x1)} ${N(y1)}`);
  }
  return bouts.join(' ') + ' Z';
}

/** Cercle en cubiques. `sens` -1 perce un trou dans la forme qui précède. */
function cercle(cx: number, cy: number, r: number, sens: 1 | -1 = 1): string {
  const k = 0.5523 * r;
  const bouts = sens === 1
    ? [`M${N(cx + r)} ${N(cy)}`,
       `C${N(cx + r)} ${N(cy + k)} ${N(cx + k)} ${N(cy + r)} ${N(cx)} ${N(cy + r)}`,
       `C${N(cx - k)} ${N(cy + r)} ${N(cx - r)} ${N(cy + k)} ${N(cx - r)} ${N(cy)}`,
       `C${N(cx - r)} ${N(cy - k)} ${N(cx - k)} ${N(cy - r)} ${N(cx)} ${N(cy - r)}`,
       `C${N(cx + k)} ${N(cy - r)} ${N(cx + r)} ${N(cy - k)} ${N(cx + r)} ${N(cy)}`]
    : [`M${N(cx + r)} ${N(cy)}`,
       `C${N(cx + r)} ${N(cy - k)} ${N(cx + k)} ${N(cy - r)} ${N(cx)} ${N(cy - r)}`,
       `C${N(cx - k)} ${N(cy - r)} ${N(cx - r)} ${N(cy - k)} ${N(cx - r)} ${N(cy)}`,
       `C${N(cx - r)} ${N(cy + k)} ${N(cx - k)} ${N(cy + r)} ${N(cx)} ${N(cy + r)}`,
       `C${N(cx + k)} ${N(cy + r)} ${N(cx + r)} ${N(cy + k)} ${N(cx + r)} ${N(cy)}`];
  return bouts.join(' ') + ' Z';
}

/** Rouage à `n` dents, percé en son centre. */
function rouage(n: number, rExt = 48, rInt = 33, rTrou = 15): string {
  const pas = 360 / n;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const c = -90 + pas * i;
    pts.push(pt(50, 50, rExt, c - pas * 0.22));
    pts.push(pt(50, 50, rExt, c + pas * 0.22));
    pts.push(pt(50, 50, rInt, c + pas * 0.30));
    pts.push(pt(50, 50, rInt, c + pas * 0.70));
  }
  return poly(pts) + (rTrou > 0 ? ' ' + cercle(50, 50, rTrou, -1) : '');
}

/** Astérisque : `n` barres pleines rayonnant depuis le centre. */
function asterisque(n: number, ep = 10, r = 48, depart = -90): string {
  const bouts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (depart + (360 / n) * i) * RAD;
    const dx = Math.cos(a), dy = Math.sin(a);
    const px = -dy * ep / 2, py = dx * ep / 2;
    bouts.push(poly([
      [50 + px, 50 + py],
      [50 + dx * r + px, 50 + dy * r + py],
      [50 + dx * r - px, 50 + dy * r - py],
      [50 - px, 50 - py],
    ]));
  }
  return bouts.join(' ');
}

/** Larme : une pointe en haut, un ventre rond en bas. */
function larme(r = 38): string {
  const cy = 98 - r;
  return [
    `M50 3`,
    `C${N(50 + r * 0.62)} ${N(cy - r * 0.88)} ${N(50 + r)} ${N(cy - r * 0.56)} ${N(50 + r)} ${N(cy)}`,
    `C${N(50 + r)} ${N(cy + r * 0.55)} ${N(50 + r * 0.55)} ${N(cy + r)} 50 ${N(cy + r)}`,
    `C${N(50 - r * 0.55)} ${N(cy + r)} ${N(50 - r)} ${N(cy + r * 0.55)} ${N(50 - r)} ${N(cy)}`,
    `C${N(50 - r)} ${N(cy - r * 0.56)} ${N(50 - r * 0.62)} ${N(cy - r * 0.88)} 50 3`,
  ].join(' ') + ' Z';
}

/** Tache organique, lissée en Catmull-Rom. La graine fixe le dessin : la même
 *  valeur redonne toujours la même tache, sinon la vignette du panneau et le
 *  calque posé ne montreraient pas la même forme. */
function tache(graine: number, n = 7, ampleur = 0.2, r = 46): string {
  let s = graine * 9301 + 49297;
  const hasard = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const pts: [number, number][] = Array.from({ length: n }, (_, i) =>
    pt(50, 50, r * (1 - ampleur + hasard() * ampleur * 2), -90 + (360 / n) * i));
  const bouts: string[] = [`M${N(pts[0][0])} ${N(pts[0][1])}`];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    bouts.push(`C${N(c1[0])} ${N(c1[1])} ${N(c2[0])} ${N(c2[1])} ${N(p2[0])} ${N(p2[1])}`);
  }
  return bouts.join(' ') + ' Z';
}

/** Rectangle aux coins arrondis, en quadratiques. */
function rectArrondi(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M${N(x + rr)} ${N(y)}`, `L${N(x + w - rr)} ${N(y)}`, `Q${N(x + w)} ${N(y)} ${N(x + w)} ${N(y + rr)}`,
    `L${N(x + w)} ${N(y + h - rr)}`, `Q${N(x + w)} ${N(y + h)} ${N(x + w - rr)} ${N(y + h)}`,
    `L${N(x + rr)} ${N(y + h)}`, `Q${N(x)} ${N(y + h)} ${N(x)} ${N(y + h - rr)}`,
    `L${N(x)} ${N(y + rr)}`, `Q${N(x)} ${N(y)} ${N(x + rr)} ${N(y)}`,
  ].join(' ') + ' Z';
}

/** Fait tourner un tracé autour du centre de sa boîte. N'accepte que les
 *  commandes absolues produites ici — c'est suffisant, et ça évite d'embarquer
 *  un moteur de transformation SVG. */
export function tourner(d: string, deg: number, cx = 50, cy = 50): string {
  const cos = Math.cos(deg * RAD), sin = Math.sin(deg * RAD);
  const jetons = d.match(/[MLCQTZ]|-?\d*\.?\d+/gi) ?? [];
  const sortie: string[] = [];
  let i = 0;
  while (i < jetons.length) {
    const j = jetons[i];
    if (/[a-z]/i.test(j)) { sortie.push(j); i++; continue; }
    const x = parseFloat(jetons[i++]), y = parseFloat(jetons[i++]);
    const dx = x - cx, dy = y - cy;
    sortie.push(`${N(cx + dx * cos - dy * sin)} ${N(cy + dx * sin + dy * cos)}`);
  }
  return sortie.join(' ');
}

// ─── Tracé sur un canevas ────────────────────────────────────────────────────

/**
 * Trace `d` dans le contexte, mis à l'échelle de `vb` vers `w × h`.
 *
 * L'échelle est appliquée aux COORDONNÉES, pas au contexte : un `ctx.scale`
 * non uniforme écraserait aussi l'épaisseur du contour, et une ligne étirée
 * n'aurait plus la même épaisseur en haut qu'en bas.
 */
export function tracerForme(
  ctx: CanvasRenderingContext2D, d: string, vb: [number, number], w: number, h: number,
): void {
  const ex = w / vb[0], ey = h / vb[1];
  const jetons = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  let i = 0, cmd = 'M', x = 0, y = 0, departX = 0, departY = 0;
  let ctrlC: [number, number] | null = null, ctrlQ: [number, number] | null = null;
  const n = () => parseFloat(jetons[i++]);
  ctx.beginPath();
  while (i < jetons.length) {
    if (/[a-zA-Z]/.test(jetons[i])) { cmd = jetons[i]; i++; if (cmd.toUpperCase() === 'Z') { ctx.closePath(); x = departX; y = departY; ctrlC = ctrlQ = null; continue; } }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ax = (v: number) => (rel ? x + v : v);
    const ay = (v: number) => (rel ? y + v : v);
    if (C === 'M') {
      x = ax(n()); y = ay(n()); departX = x; departY = y;
      ctx.moveTo(x * ex, y * ey);
      cmd = rel ? 'l' : 'L'; ctrlC = ctrlQ = null;
    } else if (C === 'L') {
      x = ax(n()); y = ay(n()); ctx.lineTo(x * ex, y * ey); ctrlC = ctrlQ = null;
    } else if (C === 'H') {
      x = ax(n()); ctx.lineTo(x * ex, y * ey); ctrlC = ctrlQ = null;
    } else if (C === 'V') {
      y = ay(n()); ctx.lineTo(x * ex, y * ey); ctrlC = ctrlQ = null;
    } else if (C === 'C' || C === 'S') {
      let c1x: number, c1y: number;
      if (C === 'C') { c1x = ax(n()); c1y = ay(n()); }
      else { c1x = ctrlC ? 2 * x - ctrlC[0] : x; c1y = ctrlC ? 2 * y - ctrlC[1] : y; }
      const c2x = ax(n()), c2y = ay(n());
      const px = ax(n()), py = ay(n());
      ctx.bezierCurveTo(c1x * ex, c1y * ey, c2x * ex, c2y * ey, px * ex, py * ey);
      ctrlC = [c2x, c2y]; ctrlQ = null; x = px; y = py;
    } else if (C === 'Q' || C === 'T') {
      let qx: number, qy: number;
      if (C === 'Q') { qx = ax(n()); qy = ay(n()); }
      else { qx = ctrlQ ? 2 * x - ctrlQ[0] : x; qy = ctrlQ ? 2 * y - ctrlQ[1] : y; }
      const px = ax(n()), py = ay(n());
      ctx.quadraticCurveTo(qx * ex, qy * ey, px * ex, py * ey);
      ctrlQ = [qx, qy]; ctrlC = null; x = px; y = py;
    } else {
      i++; // commande non gérée (arcs) : on ne les produit pas ici
    }
  }
}

// ─── La bibliothèque ─────────────────────────────────────────────────────────

const L: [number, number] = [200, 40]; // boîte des lignes et flèches fines

export const FORMES: Forme[] = [
  // ── Lignes ────────────────────────────────────────────────────────────────
  { id: 'ligne', nom: 'Trait', famille: 'lignes', vb: L, d: 'M6 20 L194 20', trait: 5 },
  { id: 'ligne-fine', nom: 'Trait fin', famille: 'lignes', vb: L, d: 'M6 20 L194 20', trait: 2 },
  { id: 'ligne-epaisse', nom: 'Trait épais', famille: 'lignes', vb: L, d: 'M6 20 L194 20', trait: 12 },
  { id: 'ligne-tirets', nom: 'Tirets', famille: 'lignes', vb: L, d: 'M6 20 L194 20', trait: 5, dash: [18, 13], mots: ['pointillé'] },
  { id: 'ligne-tirets-longs', nom: 'Grands tirets', famille: 'lignes', vb: L, d: 'M6 20 L194 20', trait: 5, dash: [34, 16] },
  { id: 'ligne-points', nom: 'Pointillés', famille: 'lignes', vb: L, d: 'M6 20 L194 20', trait: 6, dash: [0.01, 15] },
  { id: 'ligne-double', nom: 'Double trait', famille: 'lignes', vb: L, d: 'M6 13 L194 13 M6 27 L194 27', trait: 4 },
  { id: 'ligne-ondulee', nom: 'Trait ondulé', famille: 'lignes', vb: L, d: 'M6 20 Q21.5 4 37 20 T68 20 T99 20 T130 20 T161 20 T192 20', trait: 5, mots: ['vague'] },
  { id: 'ligne-vaguelette', nom: 'Vaguelette', famille: 'lignes', vb: L, d: 'M6 20 Q14 8 22 20 T38 20 T54 20 T70 20 T86 20 T102 20 T118 20 T134 20 T150 20 T166 20 T182 20', trait: 4 },
  { id: 'ligne-zigzag', nom: 'Zigzag', famille: 'lignes', vb: L, d: 'M6 32 L29 8 L52 32 L75 8 L98 32 L121 8 L144 32 L167 8 L190 32', trait: 5 },
  { id: 'ligne-barre', nom: 'Barre pleine', famille: 'lignes', vb: [200, 40], d: 'M0 12 L200 12 L200 28 L0 28 Z', mots: ['bande', 'rectangle'] },

  // ── Flèches ───────────────────────────────────────────────────────────────
  { id: 'fleche-trait', nom: 'Flèche', famille: 'fleches', vb: L, d: 'M6 20 L178 20 M158 6 L180 20 L158 34', trait: 5 },
  { id: 'fleche-trait-fine', nom: 'Flèche fine', famille: 'fleches', vb: L, d: 'M6 20 L180 20 M162 8 L182 20 L162 32', trait: 2.4 },
  { id: 'fleche-trait-epaisse', nom: 'Flèche épaisse', famille: 'fleches', vb: L, d: 'M8 20 L172 20 M152 5 L176 20 L152 35', trait: 10 },
  { id: 'fleche-double-trait', nom: 'Double flèche', famille: 'fleches', vb: L, d: 'M22 20 L178 20 M40 6 L18 20 L40 34 M160 6 L182 20 L160 34', trait: 5 },
  { id: 'fleche-tirets', nom: 'Flèche en tirets', famille: 'fleches', vb: L, d: 'M6 20 L170 20', trait: 5, dash: [16, 12] },
  { id: 'fleche-courbe-trait', nom: 'Flèche courbe', famille: 'fleches', vb: L, d: 'M10 34 Q98 -12 180 18 M160 4 L184 20 L158 28', trait: 5 },
  { id: 'fleche-coudee', nom: 'Flèche coudée', famille: 'fleches', vb: L, d: 'M10 34 L10 14 L176 14 M158 2 L180 14 L158 26', trait: 5 },
  { id: 'fleche-retour', nom: 'Flèche retour', famille: 'fleches', vb: L, d: 'M192 32 L64 32 Q18 32 18 19 Q18 8 46 8 M36 2 L20 8 L36 16', trait: 5 },
  { id: 'chevron-trait', nom: 'Chevron', famille: 'fleches', vb: [100, 100], d: 'M34 10 L74 50 L34 90', trait: 11 },
  { id: 'fleche-pleine', nom: 'Flèche pleine', famille: 'fleches', vb: [200, 100], d: 'M0 34 L120 34 L120 6 L198 50 L120 94 L120 66 L0 66 Z' },
  { id: 'fleche-double-pleine', nom: 'Double flèche pleine', famille: 'fleches', vb: [200, 100], d: 'M2 50 L58 6 L58 34 L142 34 L142 6 L198 50 L142 94 L142 66 L58 66 L58 94 Z' },
  { id: 'triangle-pointe', nom: 'Pointe', famille: 'fleches', vb: [100, 100], d: 'M18 8 L88 50 L18 92 Z' },

  // ── Formes de base ────────────────────────────────────────────────────────
  { id: 'carre', nom: 'Carré', famille: 'base', d: 'M4 4 L96 4 L96 96 L4 96 Z', mots: ['rectangle'] },
  { id: 'carre-arrondi', nom: 'Carré arrondi', famille: 'base', d: rectArrondi(4, 4, 92, 92, 18) },
  { id: 'carre-doux', nom: 'Carré très arrondi', famille: 'base', d: rectArrondi(4, 4, 92, 92, 34) },
  { id: 'cercle', nom: 'Cercle', famille: 'base', d: cercle(50, 50, 48), mots: ['rond'] },
  { id: 'anneau', nom: 'Anneau', famille: 'base', d: cercle(50, 50, 48) + ' ' + cercle(50, 50, 28, -1), mots: ['donut', 'cercle vide'] },
  { id: 'demi-cercle', nom: 'Demi-cercle', famille: 'base', d: 'M2 74 C2 34 23 10 50 10 C77 10 98 34 98 74 Z' },
  { id: 'quart-cercle', nom: 'Quart de rond', famille: 'base', d: 'M6 94 L6 30 C6 16 20 6 40 6 L94 6 L94 94 Z' },
  { id: 'triangle', nom: 'Triangle', famille: 'base', d: 'M50 4 L96 92 L4 92 Z' },
  { id: 'triangle-inverse', nom: 'Triangle inversé', famille: 'base', d: 'M4 8 L96 8 L50 96 Z' },
  { id: 'triangle-rect', nom: 'Triangle rectangle', famille: 'base', d: 'M6 6 L94 94 L6 94 Z' },
  { id: 'triangle-arrondi', nom: 'Triangle arrondi', famille: 'base', d: polygoneArrondi(3, 0.26) },
  { id: 'losange', nom: 'Losange', famille: 'base', d: 'M50 2 L98 50 L50 98 L2 50 Z' },
  { id: 'losange-arrondi', nom: 'Losange arrondi', famille: 'base', d: polygoneArrondi(4, 0.28, -90) },
  { id: 'pilule', nom: 'Pilule', famille: 'base', vb: [200, 100], d: 'M50 2 L150 2 Q198 2 198 50 Q198 98 150 98 L50 98 Q2 98 2 50 Q2 2 50 2 Z' },
  { id: 'parallelogramme', nom: 'Parallélogramme', famille: 'base', vb: [200, 100], d: 'M40 6 L198 6 L160 94 L2 94 Z' },
  { id: 'trapeze', nom: 'Trapèze', famille: 'base', vb: [200, 100], d: 'M42 6 L158 6 L198 94 L2 94 Z' },
  { id: 'croix', nom: 'Croix', famille: 'base', d: 'M34 4 L66 4 L66 34 L96 34 L96 66 L66 66 L66 96 L34 96 L34 66 L4 66 L4 34 L34 34 Z', mots: ['plus'] },
  { id: 'croix-x', nom: 'Croix en X', famille: 'base', d: asterisque(4, 15, 46, -45) },

  // ── Polygones ─────────────────────────────────────────────────────────────
  { id: 'pentagone', nom: 'Pentagone', famille: 'polygones', d: polygone(5) },
  { id: 'hexagone', nom: 'Hexagone', famille: 'polygones', d: polygone(6) },
  { id: 'hexagone-plat', nom: 'Hexagone couché', famille: 'polygones', d: polygone(6, 0) },
  { id: 'heptagone', nom: 'Heptagone', famille: 'polygones', d: polygone(7) },
  { id: 'octogone', nom: 'Octogone', famille: 'polygones', d: polygone(8, -67.5) },
  { id: 'nonagone', nom: 'Nonagone', famille: 'polygones', d: polygone(9) },
  { id: 'decagone', nom: 'Décagone', famille: 'polygones', d: polygone(10) },
  { id: 'dodecagone', nom: 'Dodécagone', famille: 'polygones', d: polygone(12) },
  { id: 'pentagone-arrondi', nom: 'Pentagone arrondi', famille: 'polygones', d: polygoneArrondi(5, 0.24) },
  { id: 'hexagone-arrondi', nom: 'Hexagone arrondi', famille: 'polygones', d: polygoneArrondi(6, 0.18) },
  { id: 'octogone-arrondi', nom: 'Octogone arrondi', famille: 'polygones', d: polygoneArrondi(8, 0.15, -67.5) },

  // ── Étoiles ───────────────────────────────────────────────────────────────
  { id: 'etoile-4', nom: 'Étoile 4 branches', famille: 'etoiles', d: etoile(4, 0.34) },
  { id: 'etoile-5', nom: 'Étoile', famille: 'etoiles', d: etoile(5, 0.42) },
  { id: 'etoile-6', nom: 'Étoile 6 branches', famille: 'etoiles', d: etoile(6, 0.52) },
  { id: 'etoile-8', nom: 'Étoile 8 branches', famille: 'etoiles', d: etoile(8, 0.56) },
  { id: 'etoile-10', nom: 'Étoile 10 branches', famille: 'etoiles', d: etoile(10, 0.62) },
  { id: 'etoile-12', nom: 'Étoile 12 branches', famille: 'etoiles', d: etoile(12, 0.68) },
  { id: 'etoile-fine', nom: 'Étoile pointue', famille: 'etoiles', d: etoile(5, 0.26) },
  { id: 'etoile-gonflee', nom: 'Étoile gonflée', famille: 'etoiles', d: etoile(5, 0.62) },
  { id: 'etincelle-4', nom: 'Étincelle', famille: 'etoiles', d: etincelle(4, 0.14), mots: ['brillance', 'sparkle'] },
  { id: 'etincelle-5', nom: 'Étincelle 5', famille: 'etoiles', d: etincelle(5, 0.18) },
  { id: 'etincelle-6', nom: 'Étincelle 6', famille: 'etoiles', d: etincelle(6, 0.2) },
  { id: 'etincelle-8', nom: 'Étincelle 8', famille: 'etoiles', d: etincelle(8, 0.26) },
  { id: 'eclat', nom: 'Éclat', famille: 'etoiles', d: etoile(16, 0.74), mots: ['soleil', 'explosion'] },
  { id: 'sceau', nom: 'Sceau dentelé', famille: 'etoiles', d: etoile(24, 0.84), mots: ['cachet', 'badge'] },

  // ── Larmes ────────────────────────────────────────────────────────────────
  { id: 'larme', nom: 'Larme', famille: 'larmes', d: larme(36), mots: ['goutte'] },
  { id: 'larme-large', nom: 'Larme large', famille: 'larmes', d: larme(44) },
  { id: 'larme-fine', nom: 'Larme fine', famille: 'larmes', d: larme(28) },
  { id: 'larme-droite', nom: 'Larme couchée', famille: 'larmes', d: tourner(larme(36), 90) },
  { id: 'larme-gauche', nom: 'Larme couchée gauche', famille: 'larmes', d: tourner(larme(36), -90) },
  { id: 'larme-inverse', nom: 'Larme inversée', famille: 'larmes', d: tourner(larme(36), 180) },
  { id: 'larme-oblique', nom: 'Larme oblique', famille: 'larmes', d: tourner(larme(36), 45) },

  // ── Rouages ───────────────────────────────────────────────────────────────
  { id: 'rouage-8', nom: 'Rouage 8 dents', famille: 'rouages', d: rouage(8), mots: ['engrenage'] },
  { id: 'rouage-10', nom: 'Rouage 10 dents', famille: 'rouages', d: rouage(10) },
  { id: 'rouage-12', nom: 'Rouage 12 dents', famille: 'rouages', d: rouage(12) },
  { id: 'rouage-16', nom: 'Rouage 16 dents', famille: 'rouages', d: rouage(16, 48, 38, 14) },
  { id: 'rouage-plein', nom: 'Rouage plein', famille: 'rouages', d: rouage(10, 48, 33, 0) },
  { id: 'rouage-large', nom: 'Rouage à grosses dents', famille: 'rouages', d: rouage(6, 48, 30, 17) },
  { id: 'soleil', nom: 'Soleil', famille: 'rouages', d: etoile(12, 0.66) + ' ' + cercle(50, 50, 20, -1) },

  // ── Astérisques ───────────────────────────────────────────────────────────
  { id: 'asterisque-5', nom: 'Astérisque 5', famille: 'asterisques', d: asterisque(5, 11) },
  { id: 'asterisque-6', nom: 'Astérisque 6', famille: 'asterisques', d: asterisque(6, 10) },
  { id: 'asterisque-8', nom: 'Astérisque 8', famille: 'asterisques', d: asterisque(8, 9) },
  { id: 'asterisque-12', nom: 'Astérisque 12', famille: 'asterisques', d: asterisque(12, 7) },
  { id: 'asterisque-epais', nom: 'Astérisque épais', famille: 'asterisques', d: asterisque(6, 19) },
  { id: 'asterisque-fin', nom: 'Astérisque fin', famille: 'asterisques', d: asterisque(8, 4) },
  { id: 'plus-epais', nom: 'Plus épais', famille: 'asterisques', d: asterisque(4, 24) },
  { id: 'etoile-trait', nom: 'Étoile au trait', famille: 'asterisques', d: asterisque(5, 6) },

  // ── Formes naturelles ─────────────────────────────────────────────────────
  { id: 'fleur-5', nom: 'Fleur 5 pétales', famille: 'naturelles', d: fleur(5, 21, 46, 1.28) },
  { id: 'fleur-6', nom: 'Fleur 6 pétales', famille: 'naturelles', d: fleur(6, 20, 46, 1.26) },
  { id: 'fleur-8', nom: 'Fleur 8 pétales', famille: 'naturelles', d: fleur(8, 19, 46, 1.22) },
  { id: 'fleur-12', nom: 'Fleur 12 pétales', famille: 'naturelles', d: fleur(12, 17, 46, 1.16) },
  { id: 'marguerite', nom: 'Marguerite', famille: 'naturelles', d: fleur(8, 12, 47, 1.55) },
  { id: 'trefle', nom: 'Trèfle', famille: 'naturelles', d: fleur(4, 20, 46, 1.34), mots: ['quatre-feuilles'] },
  { id: 'fleur-large', nom: 'Fleur large', famille: 'naturelles', d: fleur(5, 26, 46, 1.16) },
  { id: 'feuille', nom: 'Feuille', famille: 'naturelles', d: 'M50 4 C80 20 92 36 92 50 C92 64 80 80 50 96 C20 80 8 64 8 50 C8 36 20 20 50 4 Z' },
  { id: 'feuille-pointe', nom: 'Feuille pointue', famille: 'naturelles', d: 'M8 92 C8 44 30 12 92 8 C88 70 56 92 8 92 Z' },
  { id: 'oeil', nom: 'Œil', famille: 'naturelles', vb: [200, 100], d: 'M4 50 C50 4 150 4 196 50 C150 96 50 96 4 50 Z', mots: ['amande'] },
  { id: 'coeur', nom: 'Cœur', famille: 'naturelles', d: 'M50 92 C18 70 4 52 4 34 C4 18 16 8 30 8 C40 8 47 14 50 21 C53 14 60 8 70 8 C84 8 96 18 96 34 C96 52 82 70 50 92 Z' },
  { id: 'lune', nom: 'Croissant de lune', famille: 'naturelles', d: cercle(50, 50, 46) + ' ' + cercle(68, 42, 38, -1) },

  // ── Formes abstraites ─────────────────────────────────────────────────────
  { id: 'arche', nom: 'Arche', famille: 'abstraites', d: 'M8 96 L8 44 C8 20 27 4 50 4 C73 4 92 20 92 44 L92 96 Z' },
  { id: 'arche-plate', nom: 'Arche plate', famille: 'abstraites', d: 'M8 96 L8 30 Q8 6 50 6 Q92 6 92 30 L92 96 Z' },
  { id: 'arche-double', nom: 'Double arche', famille: 'abstraites', vb: [200, 100], d: 'M6 96 L6 44 C6 20 24 6 46 6 C68 6 86 20 86 44 L86 96 Z M114 96 L114 44 C114 20 132 6 154 6 C176 6 194 20 194 44 L194 96 Z' },
  { id: 'squircle', nom: 'Squircle', famille: 'abstraites', d: 'M50 3 C86 3 97 14 97 50 C97 86 86 97 50 97 C14 97 3 86 3 50 C3 14 14 3 50 3 Z' },
  { id: 'vague-bloc', nom: 'Bloc vague', famille: 'abstraites', d: 'M0 28 Q25 4 50 28 T100 28 L100 100 L0 100 Z' },
  { id: 'vague-double', nom: 'Bande vague', famille: 'abstraites', d: 'M0 26 Q25 2 50 26 T100 26 L100 74 Q75 98 50 74 T0 74 Z' },
  { id: 'marches', nom: 'Marches', famille: 'abstraites', d: 'M4 96 L4 66 L36 66 L36 38 L68 38 L68 10 L96 10 L96 96 Z' },
  { id: 'demi-lune', nom: 'Demi-lune', famille: 'abstraites', vb: [200, 100], d: 'M4 96 Q4 4 100 4 Q196 4 196 96 Z' },
  { id: 'ruban', nom: 'Ruban', famille: 'abstraites', vb: [200, 100], d: 'M2 10 L198 10 L198 90 L160 66 L120 90 L80 66 L40 90 L2 66 Z' },
  { id: 'fanion', nom: 'Fanion', famille: 'abstraites', vb: [200, 100], d: 'M2 8 L198 8 L198 92 L100 62 L2 92 Z' },
  { id: 'biseau', nom: 'Coin biseauté', famille: 'abstraites', d: 'M4 4 L70 4 L96 30 L96 96 L4 96 Z' },
  { id: 'goutte-carree', nom: 'Goutte carrée', famille: 'abstraites', d: 'M50 4 C76 4 96 24 96 50 C96 76 76 96 50 96 L4 96 L4 50 C4 24 24 4 50 4 Z' },
  { id: 'tache-1', nom: 'Tache 1', famille: 'abstraites', d: tache(7), mots: ['blob'] },
  { id: 'tache-2', nom: 'Tache 2', famille: 'abstraites', d: tache(23, 8, 0.24) },
  { id: 'tache-3', nom: 'Tache 3', famille: 'abstraites', d: tache(51, 6, 0.18) },
  { id: 'tache-4', nom: 'Tache 4', famille: 'abstraites', d: tache(97, 9, 0.22) },
  { id: 'tache-5', nom: 'Tache 5', famille: 'abstraites', d: tache(131, 5, 0.16) },
  { id: 'galet', nom: 'Galet', famille: 'abstraites', d: tache(311, 7, 0.1) },

  // ── Bulles ────────────────────────────────────────────────────────────────
  { id: 'bulle-ronde', nom: 'Bulle ronde', famille: 'bulles', vb: [200, 160], d: 'M100 8 C152 8 194 38 194 76 C194 114 152 144 100 144 L74 144 L34 158 L46 140 C20 128 6 104 6 76 C6 38 48 8 100 8 Z' },
  { id: 'bulle-rect', nom: 'Bulle rectangle', famille: 'bulles', vb: [200, 160], d: 'M20 6 L180 6 Q196 6 196 22 L196 104 Q196 120 180 120 L92 120 L40 156 L56 120 L20 120 Q4 120 4 104 L4 22 Q4 6 20 6 Z' },
  { id: 'bulle-carree', nom: 'Bulle carrée', famille: 'bulles', vb: [200, 160], d: 'M4 6 L196 6 L196 114 L80 114 L24 156 L44 114 L4 114 Z' },
  { id: 'bulle-pensee', nom: 'Bulle pensée', famille: 'bulles', vb: [200, 160], d: 'M100 4 C150 4 190 30 190 64 C190 98 150 124 100 124 C50 124 10 98 10 64 C10 30 50 4 100 4 Z ' + cercle(58, 136, 14) + ' ' + cercle(28, 152, 8) },
  { id: 'bulle-bd', nom: 'Bulle explosive', famille: 'bulles', d: etoile(14, 0.74), mots: ['bd', 'crier'] },
  { id: 'bulle-nuage', nom: 'Bulle nuage', famille: 'bulles', vb: [200, 160], d: 'M46 120 C22 120 6 104 6 84 C6 68 16 56 30 51 C28 30 44 12 66 12 C80 12 92 19 99 30 C107 20 119 14 132 14 C156 14 174 32 174 55 C188 62 196 74 196 88 C196 106 180 120 158 120 L80 120 L40 152 Z' },
];

/** Une forme par identifiant. */
export const FORME = (id: string): Forme | undefined => FORMES.find(f => f.id === id);

/** Boîte de référence d'une forme. */
export const boite = (f: Forme): [number, number] => f.vb ?? [100, 100];

/** Recherche par nom, famille et synonymes, accents et casse ignorés. */
export function chercherFormes(q: string): Forme[] {
  const norme = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norme(q.trim());
  if (!t) return FORMES;
  const famille = (id: FamilleForme) => FAMILLES.find(f => f.id === id)?.label ?? '';
  return FORMES.filter(f =>
    norme(f.nom).includes(t) || norme(famille(f.famille)).includes(t) ||
    (f.mots ?? []).some(m => norme(m).includes(t)));
}

/** Vignette SVG d'une forme, pour le panneau. */
export function apercuForme(f: Forme, couleur: string): string {
  const [w, h] = boite(f);
  const corps = f.trait
    ? `<path d="${f.d}" fill="none" stroke="${couleur}" stroke-width="${f.trait}" stroke-linecap="round" stroke-linejoin="round"${f.dash ? ` stroke-dasharray="${f.dash.join(' ')}"` : ''}/>`
    : `<path d="${f.d}" fill="${couleur}"/>`;
  const marge = f.trait ? f.trait : 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-marge} ${-marge} ${w + marge * 2} ${h + marge * 2}">${corps}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
