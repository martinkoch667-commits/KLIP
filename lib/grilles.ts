// lib/grilles.ts — compositions photo prêtes à remplir.
//
// Une grille n'est pas une forme : c'est une MISE EN PAGE. On pose d'un clic
// deux, trois ou neuf cadres qui se partagent la page, puis on double-clique
// dans chacun pour y glisser une image. C'est le geste des « Grilles » de
// Canva, et c'est ce qui manquait : jusqu'ici le panneau ne savait poser qu'un
// cadre à la fois, donc composer un collage se faisait à la main, au pixel.
//
// Les cellules sont en proportions de la page (0 à 1), jamais en pixels : la
// même grille sert un carré Instagram, un 4:5 et une story.

export type Cellule = { x: number; y: number; w: number; h: number };
export type Grille = { id: string; nom: string; cellules: Cellule[] };

const c = (x: number, y: number, w: number, h: number): Cellule => ({ x, y, w, h });

/** Découpe régulière en `col` × `lig`. */
function damier(col: number, lig: number): Cellule[] {
  const out: Cellule[] = [];
  for (let j = 0; j < lig; j++) for (let i = 0; i < col; i++) out.push(c(i / col, j / lig, 1 / col, 1 / lig));
  return out;
}

/** Une bande de `n` cellules, horizontale ou verticale, dans un rectangle. */
function bande(n: number, x: number, y: number, w: number, h: number, vertical = false): Cellule[] {
  return Array.from({ length: n }, (_, i) => vertical
    ? c(x, y + (h * i) / n, w, h / n)
    : c(x + (w * i) / n, y, w / n, h));
}

export const GRILLES: Grille[] = [
  { id: 'pleine', nom: 'Pleine page', cellules: [c(0, 0, 1, 1)] },
  { id: 'col-2', nom: 'Deux colonnes', cellules: damier(2, 1) },
  { id: 'lig-2', nom: 'Deux bandes', cellules: damier(1, 2) },
  { id: 'col-2-inegal', nom: 'Deux colonnes inégales', cellules: [c(0, 0, 0.62, 1), c(0.62, 0, 0.38, 1)] },
  { id: 'lig-2-inegal', nom: 'Deux bandes inégales', cellules: [c(0, 0, 1, 0.62), c(0, 0.62, 1, 0.38)] },
  { id: 'col-3', nom: 'Trois colonnes', cellules: damier(3, 1) },
  { id: 'lig-3', nom: 'Trois bandes', cellules: damier(1, 3) },
  { id: 'grande-gauche-2', nom: 'Grande à gauche', cellules: [c(0, 0, 0.6, 1), ...bande(2, 0.6, 0, 0.4, 1, true)] },
  { id: 'grande-droite-2', nom: 'Grande à droite', cellules: [...bande(2, 0, 0, 0.4, 1, true), c(0.4, 0, 0.6, 1)] },
  { id: 'grande-haut-2', nom: 'Grande en haut', cellules: [c(0, 0, 1, 0.6), ...bande(2, 0, 0.6, 1, 0.4)] },
  { id: 'grande-bas-2', nom: 'Grande en bas', cellules: [...bande(2, 0, 0, 1, 0.4), c(0, 0.4, 1, 0.6)] },
  { id: 'quatre', nom: 'Quatre carrés', cellules: damier(2, 2) },
  { id: 'col-4', nom: 'Quatre colonnes', cellules: damier(4, 1) },
  { id: 'grande-gauche-3', nom: 'Grande et trois', cellules: [c(0, 0, 0.62, 1), ...bande(3, 0.62, 0, 0.38, 1, true)] },
  { id: 'grande-haut-3', nom: 'Bandeau et trois', cellules: [c(0, 0, 1, 0.55), ...bande(3, 0, 0.55, 1, 0.45)] },
  { id: 'grande-bas-3', nom: 'Trois et bandeau', cellules: [...bande(3, 0, 0, 1, 0.45), c(0, 0.45, 1, 0.55)] },
  { id: 'cinq-mosaique', nom: 'Mosaïque de cinq', cellules: [c(0, 0, 0.5, 0.5), c(0.5, 0, 0.5, 0.25), c(0.5, 0.25, 0.5, 0.25), c(0, 0.5, 0.5, 0.5), c(0.5, 0.5, 0.5, 0.5)] },
  { id: 'cinq-bandeau', nom: 'Bandeau et quatre', cellules: [c(0, 0, 1, 0.48), ...damier(2, 1).map(k => c(k.x, 0.48, k.w, 0.26)), ...damier(2, 1).map(k => c(k.x, 0.74, k.w, 0.26))] },
  { id: 'six', nom: 'Six cases', cellules: damier(3, 2) },
  { id: 'six-hautes', nom: 'Six hautes', cellules: damier(2, 3) },
  { id: 'grande-gauche-4', nom: 'Grande et quatre', cellules: [c(0, 0, 0.5, 1), ...damier(2, 2).map(k => c(0.5 + k.x * 0.5, k.y, k.w * 0.5, k.h))] },
  { id: 'neuf', nom: 'Neuf cases', cellules: damier(3, 3) },
  { id: 'bande-centre', nom: 'Bande centrale', cellules: [c(0, 0, 1, 0.28), c(0, 0.28, 1, 0.44), c(0, 0.72, 1, 0.28)] },
  { id: 'colonne-decalee', nom: 'Colonne décalée', cellules: [c(0, 0, 0.5, 0.62), c(0.5, 0, 0.5, 0.38), c(0.5, 0.38, 0.5, 0.62), c(0, 0.62, 0.5, 0.38)] },
];

/**
 * Visuel témoin des cases vides, dans l'esprit des grilles de Canva : un
 * paysage neutre, reconnaissable au premier coup d'oeil comme un emplacement
 * de photo. Une case grise, elle, se lit comme un rectangle gris — on ne
 * devine pas qu'on peut y déposer une image.
 */
export function paysageTemoin(w = 800, h = 800): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">`
    + `<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="#BFE3F7"/><stop offset="1" stop-color="#E8F5FD"/></linearGradient></defs>`
    + `<rect width="100" height="100" fill="url(#c)"/>`
    + `<ellipse cx="30" cy="27" rx="15" ry="9" fill="#ffffff"/>`
    + `<ellipse cx="44" cy="30" rx="11" ry="7" fill="#ffffff"/>`
    + `<ellipse cx="72" cy="18" rx="10" ry="6" fill="#ffffff" opacity="0.85"/>`
    + `<path d="M0 70C16 60 32 66 50 70c18 4 34-2 50-9v39H0z" fill="#A8D26D"/>`
    + `<path d="M0 82C20 74 38 80 57 82c19 2 30-2 43-6v24H0z" fill="#7FB945"/>`
    + `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
