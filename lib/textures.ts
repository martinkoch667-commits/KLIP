// lib/textures.ts — matières à poser sur un visuel : grain, papier, trame.
//
// POURQUOI ELLES SONT CALCULÉES. Une texture, c'est du bruit et des motifs :
// exactement ce que `feTurbulence` sait produire, dans un SVG de quelques
// lignes, à n'importe quelle taille et sans un octet à télécharger. Les
// acheter serait payer chaque mois pour des fichiers lourds et figés, alors
// que celles-ci se génèrent à la dimension exacte de la page.
//
// POURQUOI ELLES SE POSENT EN CALQUE ET NON EN REMPLISSAGE. Une matière ne
// remplace pas la couleur d'un élément, elle passe PAR-DESSUS : c'est le mode
// de fusion (`multiply`, `overlay`, `soft-light`) qui laisse voir ce qu'il y a
// dessous. Poser la texture comme fond d'une forme donnerait un aplat gris.

export type Texture = {
  id: string;
  nom: string;
  /** Mode de fusion du calque posé. */
  fusion: 'multiply' | 'overlay' | 'soft-light' | 'screen';
  /** Opacité de départ, en pourcentage. Réglable ensuite comme tout calque. */
  opacite: number;
  /** Le SVG de la matière, aux dimensions demandées. */
  svg: (w: number, h: number) => string;
};

const enveloppe = (w: number, h: number, corps: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${corps}</svg>`;

/** Bruit fractal en niveaux de gris, la base de presque toutes les matières. */
const bruit = (w: number, h: number, frequence: number, octaves: number, contraste = 1, teinte = '') =>
  enveloppe(w, h,
    `<filter id="t" x="0" y="0" width="100%" height="100%">`
    + `<feTurbulence type="fractalNoise" baseFrequency="${frequence}" numOctaves="${octaves}" seed="7" stitchTiles="stitch"/>`
    + `<feColorMatrix type="saturate" values="0"/>`
    + `<feComponentTransfer><feFuncA type="linear" slope="${contraste}"/></feComponentTransfer>`
    + `</filter>`
    + `<rect width="100%" height="100%" filter="url(#t)"/>`
    + teinte);

export const TEXTURES: Texture[] = [
  { id: 'grain-fin', nom: 'Grain fin', fusion: 'multiply', opacite: 26,
    svg: (w, h) => bruit(w, h, 0.9, 3, 1) },
  { id: 'grain-gros', nom: 'Gros grain', fusion: 'multiply', opacite: 32,
    svg: (w, h) => bruit(w, h, 0.45, 2, 1.1) },
  { id: 'grain-argentique', nom: 'Argentique', fusion: 'soft-light', opacite: 55,
    svg: (w, h) => bruit(w, h, 1.3, 4, 1.4) },
  { id: 'papier', nom: 'Papier', fusion: 'multiply', opacite: 30,
    svg: (w, h) => bruit(w, h, 0.06, 5, 0.9) },
  { id: 'papier-froisse', nom: 'Papier froissé', fusion: 'multiply', opacite: 34,
    svg: (w, h) => bruit(w, h, 0.012, 6, 1.2) },
  { id: 'vieux-papier', nom: 'Vieux papier', fusion: 'multiply', opacite: 40,
    svg: (w, h) => bruit(w, h, 0.03, 5, 1, `<rect width="100%" height="100%" fill="#C8A165" opacity="0.28"/>`) },
  { id: 'beton', nom: 'Béton', fusion: 'multiply', opacite: 36,
    svg: (w, h) => bruit(w, h, 0.02, 4, 1.5) },
  { id: 'nuage', nom: 'Nuage', fusion: 'soft-light', opacite: 60,
    svg: (w, h) => bruit(w, h, 0.008, 4, 1) },
  { id: 'toile', nom: 'Toile', fusion: 'multiply', opacite: 26,
    svg: (w, h) => enveloppe(w, h,
      `<defs><pattern id="p" width="6" height="6" patternUnits="userSpaceOnUse">`
      + `<rect width="6" height="6" fill="#ffffff"/><path d="M0 0H6M0 3H6" stroke="#000" stroke-width="1" opacity="0.35"/>`
      + `<path d="M0 0V6M3 0V6" stroke="#000" stroke-width="1" opacity="0.22"/></pattern></defs>`
      + `<rect width="100%" height="100%" fill="url(#p)"/>`) },
  { id: 'trame', nom: 'Trame', fusion: 'multiply', opacite: 24,
    svg: (w, h) => enveloppe(w, h,
      `<defs><pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse">`
      + `<rect width="8" height="8" fill="#ffffff"/><circle cx="4" cy="4" r="2.1" fill="#000"/></pattern></defs>`
      + `<rect width="100%" height="100%" fill="url(#p)"/>`) },
  { id: 'rayures', nom: 'Rayures', fusion: 'multiply', opacite: 20,
    svg: (w, h) => enveloppe(w, h,
      `<defs><pattern id="p" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
      + `<rect width="10" height="10" fill="#ffffff"/><rect width="4" height="10" fill="#000"/></pattern></defs>`
      + `<rect width="100%" height="100%" fill="url(#p)"/>`) },
  { id: 'poussiere', nom: 'Poussière', fusion: 'screen', opacite: 34,
    svg: (w, h) => enveloppe(w, h,
      `<filter id="t"><feTurbulence type="turbulence" baseFrequency="0.7" numOctaves="2" seed="3"/>`
      + `<feColorMatrix type="saturate" values="0"/>`
      + `<feComponentTransfer><feFuncA type="discrete" tableValues="0 0 0 0 0 0 1"/></feComponentTransfer></filter>`
      + `<rect width="100%" height="100%" fill="#000"/><rect width="100%" height="100%" filter="url(#t)"/>`) },
  { id: 'halo', nom: 'Halo', fusion: 'soft-light', opacite: 70,
    svg: (w, h) => enveloppe(w, h,
      `<defs><radialGradient id="g"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#000000"/></radialGradient></defs>`
      + `<rect width="100%" height="100%" fill="url(#g)"/>`) },
  { id: 'vignette', nom: 'Vignetage', fusion: 'multiply', opacite: 55,
    svg: (w, h) => enveloppe(w, h,
      `<defs><radialGradient id="g"><stop offset="0.45" stop-color="#ffffff"/><stop offset="1" stop-color="#3a3a3a"/></radialGradient></defs>`
      + `<rect width="100%" height="100%" fill="url(#g)"/>`) },
];

export const textureDataUri = (t: Texture, w: number, h: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(t.svg(w, h))}`;
