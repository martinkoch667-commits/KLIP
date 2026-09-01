// lib/colorway.ts — le terrain de couleur d'une marque.
//
// POURQUOI CE FICHIER
// Les cinquante-trois compositions se peignaient sur DEUX constantes : un blanc
// cassé (#F6F3EE) et une encre presque noire (#14160F), identiques pour tous les
// clients. La charte n'apportait qu'une couleur de marque et un accent, posés
// sur ce même fond. Résultat : un visuel de burger et un visuel de cabinet de
// conseil partageaient 80 % de leur surface. C'est la moitié du « ça fait
// généré » — l'autre moitié était typographique (`typeIdentity.ts`).
//
// Un terrain n'est pas une couleur de plus : c'est le SOL du visuel. Le fond
// clair, la carte posée dessus, l'encre, le fond sombre, et l'accent de secours
// quand la charte n'en fournit pas d'utilisable. Choisi par secteur et par ton,
// départagé par une empreinte stable du nom : le même client garde son terrain
// d'un post à l'autre, deux clients du même secteur n'ont pas le même.
//
// CE QUE CE FICHIER NE FAIT PAS
// Il ne remplace jamais les couleurs de la charte. La marque reste la marque :
// le terrain est ce sur quoi elle est posée. Un client qui a réglé son bleu
// garde son bleu — il cesse simplement d'être posé sur le même beige que tout
// le monde.
//
// PAS DE TERRAIN SOMBRE POUR L'INSTANT : le rôle `ink` sert d'encre ET d'aplat
// dans les cinquante-trois recettes. Un fond sombre demande de les revoir une
// par une en planche contact, pas de les inverser en aveugle.

import type { Vibe } from './designSystem';

export interface Colorway {
  id: string;
  name: string;
  vibes: Vibe[];
  sectors: string[];
  /** Le fond clair du visuel. */
  paper: string;
  /** Le fond d'une carte posée SUR le fond clair : il doit s'en détacher. */
  surface: string;
  /** L'encre. Toujours sombre, jamais le même noir. */
  ink: string;
  /** Le fond sombre, quand la composition en demande un. */
  deep: string;
  /** Accent de secours, quand la charte n'en donne pas d'utilisable. */
  accent: string;
  note: string;
}

// ── Les terrains ─────────────────────────────────────────────────────────────

export const COLORWAYS: Colorway[] = [
  { id: 'os',      name: 'Os',            vibes: ['minimal', 'sobre', 'editorial'], sectors: ['Mode', 'Autre', 'Retail'],
    paper: '#F3EFE7', surface: '#FFFFFF', ink: '#1A1714', deep: '#201C17', accent: '#E4572E',
    note: 'Blanc d\'os, encre brune : neutre sans être froid.' },
  { id: 'craie',   name: 'Craie',         vibes: ['minimal', 'tech', 'sobre'], sectors: ['Tech', 'Autre'],
    paper: '#EFEFEA', surface: '#FBFBF8', ink: '#16181A', deep: '#101214', accent: '#2E5BFF',
    note: 'Gris de craie et bleu électrique : le terrain des studios.' },
  { id: 'creme',   name: 'Crème',         vibes: ['chaleureux', 'retro'], sectors: ['Restaurant', 'Café', 'Beauté'],
    paper: '#F7F0E1', surface: '#FFFDF7', ink: '#241C10', deep: '#2B2113', accent: '#D8572A',
    note: 'Crème et brique : chaud, un peu daté, volontairement.' },
  { id: 'argile',  name: 'Argile',        vibes: ['chaleureux', 'luxe'], sectors: ['Beauté', 'Mode', 'Café'],
    paper: '#EEE3D8', surface: '#F9F3EC', ink: '#2A1F19', deep: '#33251C', accent: '#B5543A',
    note: 'Terre cuite délavée : le terrain des marques de soin.' },
  { id: 'menthe',  name: 'Menthe',        vibes: ['minimal', 'chaleureux'], sectors: ['Beauté', 'Café', 'Sport'],
    paper: '#E8F1EA', surface: '#F7FBF7', ink: '#10201A', deep: '#0E2A20', accent: '#2FBF71',
    note: 'Vert pâle et vert franc : sain sans être clinique.' },
  { id: 'brume',   name: 'Brume',         vibes: ['sobre', 'tech', 'editorial'], sectors: ['Tech', 'Retail', 'Autre'],
    paper: '#E9EAEC', surface: '#F6F7F8', ink: '#15171B', deep: '#1B1E24', accent: '#4B49E8',
    note: 'Gris froid, violet électrique : sérieux mais pas gris.' },
  { id: 'sable',   name: 'Sable',         vibes: ['chaleureux', 'retro', 'editorial'], sectors: ['Restaurant', 'Retail', 'Mode'],
    paper: '#F0E6D6', surface: '#FAF4EA', ink: '#2B2114', deep: '#322616', accent: '#C2410C',
    note: 'Sable et orange brûlé : le terrain des cartes et des menus.' },
  { id: 'lavande', name: 'Lavande',       vibes: ['ludique', 'tech', 'luxe'], sectors: ['Beauté', 'Tech', 'Mode'],
    paper: '#ECEAF4', surface: '#F8F7FC', ink: '#1B1830', deep: '#221D3D', accent: '#6D4AFF',
    note: 'Violet pâle sur violet saturé : contemporain et assumé.' },
  { id: 'peche',   name: 'Pêche',         vibes: ['ludique', 'chaleureux'], sectors: ['Café', 'Beauté', 'Restaurant'],
    paper: '#F9EAE1', surface: '#FEF6F1', ink: '#2A1B15', deep: '#33211A', accent: '#FF5C39',
    note: 'Pêche et corail : accueillant, jeune, pas enfantin.' },
  { id: 'ciel',    name: 'Ciel',          vibes: ['sobre', 'tech', 'minimal'], sectors: ['Sport', 'Tech', 'Autre'],
    paper: '#E6EEF4', surface: '#F5FAFD', ink: '#10202B', deep: '#0E2532', accent: '#0E7BC4',
    note: 'Bleu pâle et bleu profond : clair, net, respirable.' },
  { id: 'beurre',  name: 'Beurre',        vibes: ['ludique', 'chaleureux', 'retro'], sectors: ['Restaurant', 'Café', 'Retail'],
    paper: '#F6EFD8', surface: '#FDF9EC', ink: '#241F10', deep: '#2C2513', accent: '#E0A200',
    note: 'Jaune beurre et safran : ça donne faim, c\'est le but.' },
  { id: 'poudre',  name: 'Poudre',        vibes: ['luxe', 'chaleureux'], sectors: ['Beauté', 'Mode'],
    paper: '#F5E9EC', surface: '#FDF6F8', ink: '#26161B', deep: '#2E1A20', accent: '#D6336C',
    note: 'Rose poudré, framboise : féminin sans le vocabulaire des années 2010.' },
  { id: 'olive',   name: 'Olive',         vibes: ['sobre', 'editorial', 'retro'], sectors: ['Restaurant', 'Retail', 'Autre'],
    paper: '#E7E9E4', surface: '#F5F6F3', ink: '#14170F', deep: '#1A1E14', accent: '#4F772D',
    note: 'Gris-vert et olive : le terrain des maisons qui durent.' },
  { id: 'terre',   name: 'Terre',         vibes: ['chaleureux', 'audacieux', 'retro'], sectors: ['Restaurant', 'Sport', 'Mode'],
    paper: '#F2E4DC', surface: '#FBF2EE', ink: '#2B1A14', deep: '#341F17', accent: '#A63A22',
    note: 'Terracotta pâle et rouge de terre : chaud et solide.' },
  { id: 'acide',   name: 'Acide',         vibes: ['audacieux', 'ludique', 'tech'], sectors: ['Sport', 'Tech', 'Retail'],
    paper: '#EFF2E6', surface: '#F9FBF3', ink: '#12180C', deep: '#171E0F', accent: '#A3E635',
    note: 'Vert acide sur fond presque blanc : ça se voit dans un fil.' },
  { id: 'encre',   name: 'Encre',         vibes: ['editorial', 'luxe', 'sobre'], sectors: ['Mode', 'Autre', 'Tech'],
    paper: '#EDEDEB', surface: '#FFFFFF', ink: '#101010', deep: '#000000', accent: '#C8102E',
    note: 'Noir, blanc, un rouge : le terrain le plus court qui existe.' },
];

export const COLORWAY_BY_ID: Record<string, Colorway> =
  Object.fromEntries(COLORWAYS.map(c => [c.id, c]));

// ── Choix ────────────────────────────────────────────────────────────────────

function empreinte(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

/** Mots qui trahissent une personnalité dans le champ « ton » d'une charte. */
const TON_VERS_VIBE: [RegExp, Vibe][] = [
  [/\b(luxe|luxueux|haut de gamme|premium|élégan|raffin|chic)/i, 'luxe'],
  [/\b(minimal|épur|sobre|simple|discret|essentiel)/i, 'minimal'],
  [/\b(chaleur|convivial|famil|proche|humain|bienveill|doux)/i, 'chaleureux'],
  [/\b(fun|ludique|drôle|décal|joyeux|pétillant|jeune)/i, 'ludique'],
  [/\b(audac|punch|direct|franc|cash|percut|énergi|fort)/i, 'audacieux'],
  [/\b(tech|innov|moderne|digital|pointu|futur)/i, 'tech'],
  [/\b(vintage|rétro|retro|artisan|authentique|tradition)/i, 'retro'],
  [/\b(éditorial|editorial|magazine|journal|récit|storytelling)/i, 'editorial'],
  [/\b(pro|sérieux|rigoureux|expert|institutionnel)/i, 'sobre'],
];

export interface ColorwayInput {
  name?: string | null;
  sector?: string | null;
  tone?: string | null;
  /**
   * Terrain MESURÉ sur le compte Instagram de la marque (`lib/brandDNA.ts`).
   *
   * Quand il est là, il gagne, et sans discussion : tout ce qui suit dans cette
   * fonction est une façon honnête de deviner, mais ça reste deviner. Un terrain
   * choisi d'après les couleurs réellement publiées n'a pas à être départagé par
   * l'empreinte d'un nom.
   */
  colorwayId?: string | null;
}

/**
 * Le terrain de couleur d'une marque.
 *
 * Même mécanique que l'identité typographique, et VOLONTAIREMENT une empreinte
 * décalée : si les deux se décidaient sur la même graine, terrain et typo
 * arriveraient toujours par paires et on aurait quatorze marques possibles au
 * lieu de deux cents.
 */
export function pickColorway(b: ColorwayInput): Colorway {
  const mesure = b.colorwayId ? COLORWAY_BY_ID[b.colorwayId] : null;
  if (mesure) return mesure;
  const nom = String(b.name ?? '').trim().toLowerCase();
  const secteur = String(b.sector ?? '').trim().toLowerCase();
  const ton = String(b.tone ?? '');
  const vibes: Vibe[] = [];
  for (const [re, v] of TON_VERS_VIBE) if (re.test(ton) && !vibes.includes(v)) vibes.push(v);

  const graine = empreinte(`couleur:${nom || secteur || 'klip'}`);
  const notes = COLORWAYS.map((c, i) => {
    let n = 0;
    if (secteur && c.sectors.some(s => s.toLowerCase() === secteur)) n += 2;
    for (const v of vibes) {
      const rang = c.vibes.indexOf(v);
      if (rang === 0) n += 2.2;
      else if (rang > 0) n += 1.4;
    }
    n += ((graine + i * 40503) % 1000) / 1250;
    return { c, n };
  });
  notes.sort((a, b2) => b2.n - a.n);
  return notes[0].c;
}
