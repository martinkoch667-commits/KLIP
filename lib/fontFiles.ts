// ─── Analyse des fichiers de police importés ─────────────────────────────────
// Une famille typographique arrive en PLUSIEURS fichiers (Archivo-Regular.ttf,
// Archivo-Bold.ttf, Archivo-BoldItalic.ttf…). Jusqu'ici KLIP n'en gardait qu'un
// seul par police : le client perdait toutes ses graisses. On déduit donc la
// famille, la graisse et l'italique du nom de fichier, puis on regroupe.

export interface FontVariant {
  weight: number;
  italic: boolean;
  /** URL publique une fois téléversée ; blob local avant enregistrement. */
  url: string;
  fileName: string;
}

export interface FontFamily {
  family: string;
  variants: FontVariant[];
}

// Du plus spécifique au plus général : « extrabold » doit être testé avant
// « bold », sinon « ExtraBold » serait lu comme 700.
const WEIGHTS: [RegExp, number][] = [
  [/(extra|ultra)[\s_-]*light/i, 200],
  [/(extra|ultra)[\s_-]*bold/i, 800],
  [/(semi|demi)[\s_-]*bold/i, 600],
  [/thin|hairline/i, 100],
  [/black|heavy/i, 900],
  [/light/i, 300],
  [/medium/i, 500],
  [/bold/i, 700],
  [/regular|normal|book/i, 400],
];

/** Retire l'extension et normalise les séparateurs. */
function stem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

// Qualificatifs de graisse/style qui peuvent être COLLÉS en fin de mot à un
// descriptif légitime sans séparateur (« ObviouslyDemo-CompressedBold » : le
// split sur « - » isole « CompressedBold », mais « compressed » n'est pas un
// qualificatif connu, donc le mot entier passait jusqu'ici pour la famille —
// chaque graisse devenait sa propre « famille », et une seule s'affichait à
// l'écran). Triés du plus long au plus court pour lire « extrabold » avant
// « bold ».
const EMBEDDED_QUALIFIERS = [
  'extralight', 'ultralight', 'semibold', 'demibold', 'extrabold', 'ultrabold',
  'hairline', 'regular', 'medium', 'normal', 'light', 'black', 'heavy', 'book',
  'bold', 'thin', 'italic', 'oblique',
].sort((a, b) => b.length - a.length);

function splitEmbeddedQualifier(token: string): { prefix: string; suffix: string } {
  const lower = token.toLowerCase();
  for (const w of EMBEDDED_QUALIFIERS) {
    if (lower.length > w.length && lower.endsWith(w)) {
      return { prefix: token.slice(0, token.length - w.length), suffix: token.slice(token.length - w.length) };
    }
  }
  return { prefix: token, suffix: '' };
}

export function parseFontFile(fileName: string): { family: string; weight: number; italic: boolean } {
  const s = stem(fileName);

  // On isole d'abord les qualificatifs de FIN, puis on n'y cherche la graisse
  // que là. Sinon « Blackout-Regular » serait lu en 900 parce que le nom de
  // famille lui-même contient « black ».
  const QUAL = /^(thin|hairline|extra|ultra|semi|demi|light|medium|bold|regular|normal|book|black|heavy|italic|oblique|[1-9]00)+$/i;
  const parts = s.split(/[\s_-]+/).filter(Boolean);
  const tail: string[] = [];
  while (parts.length > 1 && QUAL.test(parts[parts.length - 1])) tail.unshift(parts.pop()!);

  // Reste-t-il un qualificatif COLLÉ au mot précédent (« CompressedBold ») ?
  // On le détache : le préfixe (« Compressed ») reste dans la famille, le
  // suffixe (« Bold ») rejoint les qualificatifs pour la détection de graisse.
  if (parts.length > 0) {
    const { prefix, suffix } = splitEmbeddedQualifier(parts[parts.length - 1]);
    if (suffix && prefix) {
      parts[parts.length - 1] = prefix;
      tail.unshift(suffix);
    }
  }

  // Sans suffixe reconnaissable, on retombe sur le nom entier (« Inter700 »).
  const probe = tail.length > 0 ? tail.join(' ') : s;

  const italic = /italic|oblique/i.test(probe);
  let weight = 400;
  for (const [re, w] of WEIGHTS) {
    if (re.test(probe)) { weight = w; break; }
  }
  // Graisse écrite en chiffres (« Inter-700 », « Roboto_300 »).
  const num = probe.match(/(?:^|[\s_-])?([1-9]00)(?:[\s_-]|$)/);
  if (num) weight = parseInt(num[1], 10);

  // La famille = le nom une fois retirés les qualificatifs (mêmes `parts` que
  // la détection de graisse : une seule lecture, une seule vérité — l'ancien
  // code refaisait le découpage en double, et les deux pouvaient diverger).
  let family = parts.join(' ').trim();
  // Nom entièrement composé de qualificatifs : on retombe sur le nom de fichier.
  if (!family) family = s.replace(/[-_]+/g, ' ').trim();
  return { family, weight, italic };
}

/** Regroupe une sélection de fichiers en familles, triées par graisse. */
export function groupFontFiles(files: { name: string; url: string }[]): FontFamily[] {
  const map = new Map<string, FontFamily>();
  for (const f of files) {
    const { family, weight, italic } = parseFontFile(f.name);
    const key = family.toLowerCase();
    if (!map.has(key)) map.set(key, { family, variants: [] });
    map.get(key)!.variants.push({ weight, italic, url: f.url, fileName: f.name });
  }
  // Array.from plutôt que la déstructuration d'itérateur : la cible TS du projet
  // ne permet pas d'itérer directement sur Map.values().
  const out = Array.from(map.values());
  out.forEach((fam: FontFamily) => {
    fam.variants.sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic));
  });
  return out;
}

/** Enregistre toutes les variantes d'une famille auprès du navigateur. */
export async function registerFontFamily(fam: FontFamily): Promise<void> {
  if (typeof document === 'undefined') return;
  await Promise.all(fam.variants.map(async v => {
    try {
      const ff = new FontFace(fam.family, `url(${v.url})`, {
        weight: String(v.weight),
        style: v.italic ? 'italic' : 'normal',
      });
      await ff.load();
      document.fonts.add(ff);
    } catch { /* une variante illisible ne doit pas bloquer les autres */ }
  }));
}

/** Libellé lisible d'une graisse, pour les sélecteurs. */
export function weightLabel(weight: number, italic: boolean): string {
  const names: Record<number, string> = {
    100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular',
    500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black',
  };
  return (names[weight] ?? String(weight)) + (italic ? ' Italic' : '');
}
