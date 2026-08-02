// Graisses réellement disponibles pour les polices Google embarquées.
// Google Fonts renvoie une 400 pour TOUTE la requête si on demande une graisse
// qu'une famille ne publie pas : impossible de demander 100→900 partout. On
// tient donc la liste par famille — c'est aussi elle qui alimente le sélecteur
// de graisse de l'éditeur, pour ne jamais proposer une variante qui rendrait un
// faux gras baveux à l'écran.

export interface FontWeightSpec {
  weights: number[];
  /** La famille publie-t-elle des italiques ? */
  italic: boolean;
}

export const GOOGLE_FONT_WEIGHTS: Record<string, FontWeightSpec> = {
  'Anton':             { weights: [400], italic: false },
  'Oswald':            { weights: [200, 300, 400, 500, 600, 700], italic: false },
  'Bebas Neue':        { weights: [400], italic: false },
  'Montserrat':        { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  'Syne':              { weights: [400, 500, 600, 700, 800], italic: false },
  'Inter':             { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false },
  'Poppins':           { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  'Barlow Condensed':  { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  'Raleway':           { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  'Roboto Condensed':  { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  'Playfair Display':  { weights: [400, 500, 600, 700, 800, 900], italic: true },
  'Lato':              { weights: [100, 300, 400, 700, 900], italic: true },
  'Nunito':            { weights: [200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  'Work Sans':         { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  'DM Sans':           { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  'Space Grotesk':     { weights: [300, 400, 500, 600, 700], italic: false },
  'Archivo Black':     { weights: [400], italic: false },
  'Fjalla One':        { weights: [400], italic: false },
  'Exo 2':             { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  'Ubuntu':            { weights: [300, 400, 500, 700], italic: true },
};

/** URL Google Fonts d'une famille, avec ses graisses (et italiques) réelles. */
export function googleFontHref(family: string): string {
  const spec = GOOGLE_FONT_WEIGHTS[family] ?? { weights: [400, 700], italic: false };
  const fam = family.replace(/ /g, '+');
  const axis = spec.italic
    ? `ital,wght@${spec.weights.map(w => `0,${w}`).join(';')};${spec.weights.map(w => `1,${w}`).join(';')}`
    : `wght@${spec.weights.join(';')}`;
  return `https://fonts.googleapis.com/css2?family=${fam}:${axis}&display=swap`;
}

/** Libellé lisible d'une graisse. */
export function weightName(weight: number): string {
  const names: Record<number, string> = {
    100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular',
    500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black',
  };
  return names[weight] ?? String(weight);
}

/** Variantes proposées pour une famille Google : graisses × italique. */
export function googleVariants(family: string): { weight: number; italic: boolean }[] {
  const spec = GOOGLE_FONT_WEIGHTS[family];
  if (!spec) return [];
  const out = spec.weights.map(weight => ({ weight, italic: false }));
  if (spec.italic) out.push(...spec.weights.map(weight => ({ weight, italic: true })));
  return out;
}
