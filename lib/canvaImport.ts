// lib/canvaImport.ts : une page de PDF exporté devient un modèle KLIP.
//
// POURQUOI CE FICHIER
// `pdfStructure.ts` rend ce qu'il y a dans le fichier : des bouts de texte, des
// rectangles, des boîtes d'image. Ce n'est pas encore un modèle. Un PDF ne
// contient AUCUN bloc de texte : il contient des glyphes posés un par un, avec
// leur position. Le titre « PEPE CHICKEN » du visuel de test en sort en onze
// morceaux séparés, parce que l'interlettrage force le moteur de rendu à
// repositionner chaque lettre. Reconstituer les blocs est donc le vrai travail,
// et c'est ce fichier qui le fait.
//
// CE QU'ON RECONSTRUIT, ET CE QU'ON REFUSE DE RECONSTRUIRE
// Les blocs de texte (avec leur rôle), les aplats, et une ZONE PHOTO à la place
// de chaque image. Jamais l'image elle-même : la licence de contenu Canva
// interdit d'utiliser son contenu hors d'un design Canva, et rien dans un export
// ne distingue de façon fiable la photo du client d'une photo de la banque
// Canva. C'est d'ailleurs ce qu'un modèle veut : un emplacement à remplir.
//
// LE RÔLE, C'EST TOUT L'INTÉRÊT
// Un modèle KLIP dont les blocs n'ont pas de rôle n'est qu'un dessin figé :
// l'IA ne saura pas quoi y écrire, et le client se retrouvera à retaper le
// texte de son ancien visuel. Avec un rôle, le même modèle devient une machine
// à produire : « titre », « prix », « accroche » sont ce que le compositeur
// remplit. On les déduit ici de la hiérarchie réelle du dessin.

import type { PdfPage, PdfTextRun } from './pdfStructure';

// ── Cible : le vocabulaire de calques de l'éditeur ───────────────────────────

export interface ImportedTemplate {
  format_id: string;
  background_style: { type: 'solid'; color: string };
  /** Calques d'éditeur, prêts pour `post_templates.text_zones`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements: any[];
  /** De quoi juger l'import sans ouvrir le modèle. */
  rapport: RapportImport;
}

export interface RapportImport {
  /** Ce que la page contenait. */
  runs: number; blocs: number; aplats: number; zonesPhoto: number;
  /** Polices rencontrées, préfixe de sous-ensemble retiré. */
  polices: string[];
  /** Couleurs rencontrées, les plus utilisées d'abord. */
  couleurs: string[];
  /** Ce qui n'a pas pu être repris, dit en clair. */
  pertes: string[];
  /** Confiance 0..1 : sous 0,5, mieux vaut garder l'image aplatie en référence. */
  confiance: number;
}

/** Formats KLIP, dans les coordonnées où l'éditeur enregistre ses calques. */
const FORMATS = [
  { id: 'ig-portrait', w: 420, h: 560, ratio: 3 / 4 },
  { id: 'ig-45', w: 448, h: 560, ratio: 4 / 5 },
  { id: 'ig-square', w: 560, h: 560, ratio: 1 },
  { id: 'ig-story', w: 315, h: 560, ratio: 9 / 16 },
  { id: 'facebook', w: 560, h: 294, ratio: 1200 / 630 },
];

const PHOTO_PLACEHOLDER = '__PHOTO_PLACEHOLDER__';

function formatPour(w: number, h: number) {
  const r = w / h;
  let best = FORMATS[0], d = Infinity;
  for (const f of FORMATS) {
    const e = Math.abs(Math.log(r / f.ratio));
    if (e < d) { d = e; best = f; }
  }
  return best;
}

// ── Assemblage du texte ──────────────────────────────────────────────────────

interface Ligne {
  runs: PdfTextRun[];
  x: number; y: number; size: number;
  color: string; font: string; bold: boolean; italic: boolean;
  texte: string;
  /** Fin approchée de la ligne, pour deviner la largeur et l'alignement. */
  fin: number;
}

/** Avance moyenne d'un caractère, en fraction du corps. Approchée : le PDF ne
 *  donne pas les largeurs de glyphes sans lire la police elle-même, et une
 *  approximation suffit pour une largeur de bloc que l'utilisateur ajustera. */
function avance(t: string, size: number): number {
  const caps = t === t.toUpperCase() && /[A-Z]/.test(t);
  return t.length * size * (caps ? 0.6 : 0.52);
}

const memeStyle = (a: PdfTextRun, b: PdfTextRun) =>
  a.color === b.color && a.font === b.font && a.bold === b.bold
  && Math.abs(a.size - b.size) <= Math.max(a.size, b.size) * 0.12;

/**
 * Les glyphes redeviennent des lignes.
 *
 * Le point délicat est de savoir où remettre les espaces : un PDF n'en écrit
 * pas quand la lettre suivante est simplement repositionnée. On ne peut pas se
 * fier à un seuil absolu, l'interlettrage variant d'un visuel à l'autre. On
 * prend donc l'écart MÉDIAN entre morceaux de la ligne comme unité : un écart
 * nettement plus grand que la médiane est une espace, le reste est de
 * l'interlettrage. Sur le visuel de test, les écarts entre lettres valent 28 et
 * l'écart entre les deux mots 45 : la médiane les sépare sans réglage.
 */
function assembler(runs: PdfTextRun[]): Ligne[] {
  const tries = runs.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const lignes: Ligne[] = [];

  for (const r of tries) {
    const cur = lignes[lignes.length - 1];
    const proche = cur
      && Math.abs(r.y - cur.y) <= cur.size * 0.45
      && memeStyle(cur.runs[0], r)
      && r.x >= cur.x - cur.size;
    if (proche) { cur.runs.push(r); cur.y = Math.min(cur.y, r.y); }
    else {
      lignes.push({
        runs: [r], x: r.x, y: r.y, size: r.size,
        color: r.color, font: r.font, bold: r.bold, italic: r.italic,
        texte: '', fin: r.x,
      });
    }
  }

  for (const l of lignes) {
    l.runs.sort((a, b) => a.x - b.x);
    const ecarts: number[] = [];
    for (let i = 1; i < l.runs.length; i++) ecarts.push(l.runs[i].x - l.runs[i - 1].x);
    const mediane = ecarts.length
      ? ecarts.slice().sort((a, b) => a - b)[Math.floor(ecarts.length / 2)]
      : 0;

    let t = l.runs[0].text;
    for (let i = 1; i < l.runs.length; i++) {
      const d = l.runs[i].x - l.runs[i - 1].x;
      const attendu = Math.max(mediane, avance(l.runs[i - 1].text, l.size));
      // Un morceau qui porte déjà plusieurs caractères a sa propre avance : le
      // seuil doit s'y adapter, sinon deux mots collés deviennent un seul.
      const espace = d > attendu * 1.45 && d > l.size * 0.28;
      t += (espace ? ' ' : '') + l.runs[i].text;
    }
    l.texte = t.replace(/\s+/g, ' ').trim();
    const dernier = l.runs[l.runs.length - 1];
    l.fin = dernier.x + avance(dernier.text, l.size);
    l.x = l.runs[0].x;
  }

  return lignes.filter(l => l.texte.length > 0);
}

interface Bloc {
  lignes: Ligne[];
  x: number; y: number; w: number; size: number;
  color: string; font: string; bold: boolean; italic: boolean;
  texte: string;
  align: 'left' | 'center' | 'right';
  ordre: number;
}

/** Les lignes redeviennent des paragraphes. */
function paragrapher(lignes: Ligne[], pageW: number): Bloc[] {
  const blocs: Bloc[] = [];
  for (const l of lignes) {
    const cur = blocs[blocs.length - 1];
    const suite = cur
      && memeStyle(cur.lignes[0].runs[0], l.runs[0])
      && l.y - (cur.lignes[cur.lignes.length - 1].y) <= cur.size * 2.1
      && l.y > cur.lignes[cur.lignes.length - 1].y
      // Deux colonnes côte à côte ne sont pas un paragraphe : on compare aussi
      // les bords, et pas seulement le style et l'écart vertical.
      && (Math.abs(l.x - cur.x) <= cur.size * 0.6
        || Math.abs((l.x + l.fin) / 2 - (cur.x + cur.lignes[0].fin) / 2) <= cur.size * 0.6);
    if (suite) cur.lignes.push(l);
    else {
      blocs.push({
        lignes: [l], x: l.x, y: l.y, w: 0, size: l.size,
        color: l.color, font: l.font, bold: l.bold, italic: l.italic,
        texte: '', align: 'left', ordre: l.runs[0].ordre,
      });
    }
  }

  for (const b of blocs) {
    b.texte = b.lignes.map(l => l.texte).join('\n');
    b.x = Math.min(...b.lignes.map(l => l.x));
    const fin = Math.max(...b.lignes.map(l => l.fin));
    b.w = Math.min(pageW - b.x, Math.max(fin - b.x, b.size * 2));

    // L'alignement se DÉDUIT : sur plusieurs lignes, des centres qui coïncident
    // alors que les bords gauches ne coïncident pas, c'est du centré. Un bloc
    // d'une seule ligne n'en dit rien, on le laisse à gauche.
    if (b.lignes.length >= 2) {
      const gauches = b.lignes.map(l => l.x);
      const droites = b.lignes.map(l => l.fin);
      const centres = b.lignes.map(l => (l.x + l.fin) / 2);
      const etale = (a: number[]) => Math.max(...a) - Math.min(...a);
      const tol = b.size * 0.45;
      if (etale(centres) < tol && etale(gauches) > tol) b.align = 'center';
      else if (etale(droites) < tol && etale(gauches) > tol) b.align = 'right';
    } else {
      // Une seule ligne ne dit rien d'elle-même, mais elle dit quelque chose de
      // sa place : un rail de marque centré dans la page est centré, et le
      // laisser à gauche casse la composition dès que l'IA en change le texte.
      const centreBloc = (b.x + b.lignes[0].fin) / 2;
      const marges = Math.abs(b.x - (pageW - b.lignes[0].fin));
      if (Math.abs(centreBloc - pageW / 2) < pageW * 0.04 && marges < pageW * 0.08 && b.x > pageW * 0.06) {
        b.align = 'center';
      }
    }
  }
  return blocs;
}

// ── Les rôles ────────────────────────────────────────────────────────────────

const RE_PRIX = /^\s*[-+]?\d{1,4}([.,]\d{1,2})?\s*(€|eur|euros?|\$|£)\s*$|^\s*(€|\$|£)\s*\d/i;

/**
 * Quel bloc contient quoi, déduit de la hiérarchie du dessin.
 *
 * Sans rôle, un modèle importé est un dessin figé que le client devra retaper à
 * chaque publication ; avec, c'est le compositeur qui le remplit. On ne cherche
 * pas à deviner le SENS du texte (impossible et inutile), seulement sa FONCTION
 * dans la composition, qui se lit dans le calibre et la position.
 */
function roles(blocs: Bloc[], pageH: number): (string | undefined)[] {
  const out: (string | undefined)[] = new Array(blocs.length).fill(undefined);
  const capitalesDe = (t: string) => t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t);
  const maxTaille = Math.max(...blocs.map(b => b.size), 1);

  // PREMIÈRE PASSE : ce qui se reconnaît à sa FORME, quelle que soit sa taille.
  // Un prix et un rail de marque ne sont pas des titres même quand ils sont
  // gros, et les laisser dans le classement des calibres décale tout le reste :
  // c'est ce qui faisait tomber le vrai sous-titre en « corps de texte ».
  blocs.forEach((b, i) => {
    if (RE_PRIX.test(b.texte)) { out[i] = 'prix'; return; }
    const petit = b.size <= maxTaille * 0.42;
    if (petit && capitalesDe(b.texte) && (b.y < pageH * 0.18 || b.y > pageH * 0.86)) out[i] = 'accroche';
  });

  // SECONDE PASSE : la hiérarchie de calibre, sur ce qui reste seulement.
  const restants = blocs.map((b, i) => ({ b, i })).filter(x => !out[x.i]);
  const tailles = Array.from(new Set(restants.map(x => Math.round(x.b.size)))).sort((a, b) => b - a);
  for (const { b, i } of restants) {
    const rang = tailles.indexOf(Math.round(b.size));
    if (rang === 0) out[i] = 'titre';
    else if (rang === 1) out[i] = 'sous-titre';
    else if (b.size <= maxTaille * 0.42 && b.texte.length <= 24) out[i] = 'cta';
    else out[i] = 'corps';
  }

  // UN SEUL TITRE. Deux blocs au même calibre sont fréquents (un titre coupé en
  // deux blocs par une couleur différente) : garder deux « titre » ferait écrire
  // deux fois la même chose par le compositeur.
  let vuTitre = false;
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== 'titre') continue;
    if (vuTitre) out[i] = 'sous-titre';
    vuTitre = true;
  }
  return out;
}

// ── L'assemblage final ───────────────────────────────────────────────────────

let compteur = 0;
const newId = () => `imp-${Date.now().toString(36)}-${(compteur++).toString(36)}`;

/**
 * Une page de PDF devient un modèle KLIP.
 *
 * La confiance renvoyée est le vrai livrable de cette fonction : sous 0,5, il
 * faut proposer l'image aplatie comme simple référence plutôt qu'un modèle
 * bancal. Un import approximatif qu'on présente comme fidèle coûte plus cher
 * qu'un import refusé, parce que le client le découvre en le modifiant.
 */
export function pageToTemplate(page: PdfPage): ImportedTemplate {
  const fmt = formatPour(page.width, page.height);
  const s = fmt.w / page.width; // les deux échelles sont égales au ratio près
  const sy = fmt.h / page.height;

  const lignes = assembler(page.texts);
  const blocs = paragrapher(lignes, page.width);
  const rls = roles(blocs, page.height);

  const pertes: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elements: any[] = [];

  // Fond : un aplat qui couvre toute la page n'est pas un calque, c'est le fond.
  const plein = page.rects.find(r =>
    r.x <= page.width * 0.02 && r.y <= page.height * 0.02
    && r.w >= page.width * 0.96 && r.h >= page.height * 0.96);
  const background_style = { type: 'solid' as const, color: plein?.color ?? '#FFFFFF' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parOrdre: { ordre: number; el: any }[] = [];

  for (const img of page.images) {
    parOrdre.push({
      ordre: img.ordre,
      el: {
        id: newId(), type: 'image', src: PHOTO_PLACEHOLDER,
        x: Math.round(img.x * s), y: Math.round(img.y * sy),
        width: Math.round(img.w * s), height: Math.round(img.h * sy),
        rotation: 0, opacity: 100,
      },
    });
  }

  for (const r of page.rects) {
    if (r === plein) continue;
    parOrdre.push({
      ordre: r.ordre,
      el: {
        id: newId(), type: 'rect',
        x: Math.round(r.x * s), y: Math.round(r.y * sy),
        width: Math.round(r.w * s), height: Math.round(r.h * sy),
        fill: r.color, stroke: '', strokeWidth: 0,
        // Un tracé arrondi rend sa forme par un rayon égal à la moitié du petit
        // côté : c'est exact pour un cercle et une pilule, approché pour un
        // rectangle à coins doux. La forme reste modifiable dans l'éditeur.
        cornerRadius: r.arrondi ? Math.round(Math.min(r.w * s, r.h * sy) / 2) : 0,
        rotation: 0, opacity: 100,
      },
    });
  }

  blocs.forEach((b, i) => {
    const style = [b.bold ? 'bold' : '', b.italic ? 'italic' : ''].filter(Boolean).join(' ') || 'normal';
    parOrdre.push({
      ordre: b.ordre,
      el: {
        id: newId(), type: 'text', text: b.texte,
        x: Math.round(b.x * s), y: Math.round(b.y * sy),
        width: Math.round(b.w * s),
        fontSize: Math.max(8, Math.round(b.size * sy)),
        fontFamily: b.font, fontStyle: style, textDecoration: '',
        fill: b.color, align: b.align,
        hasBg: false, bgColor: '#000000', bgOpacity: 100, cornerRadius: 0,
        padding: 0, paddingH: 0, paddingV: 0,
        rotation: 0, opacity: 100,
        role: rls[i],
      },
    });
  });

  parOrdre.sort((a, b) => a.ordre - b.ordre);
  for (const p of parOrdre) elements.push(p.el);

  // ── Ce qui n'a pas suivi, dit en clair ─────────────────────────────────────
  if (page.images.length) {
    pertes.push(`${page.images.length} image${page.images.length > 1 ? 's' : ''} remplacée${page.images.length > 1 ? 's' : ''} par une zone photo (la licence Canva interdit de les reprendre hors de Canva).`);
  }
  const glyphesSeuls = page.texts.filter(t => t.text.trim().length === 1).length;
  if (page.texts.length && glyphesSeuls / page.texts.length > 0.8 && blocs.length > page.texts.length * 0.5) {
    pertes.push('Le texte est arrivé lettre par lettre et le regroupement a peu fonctionné : vérifier les blocs.');
  }
  const sansTexte = page.texts.length === 0;
  if (sansTexte) pertes.push('Aucun texte lisible : le design a probablement été exporté en aplati, ou son texte est vectorisé.');

  // LE FORMAT, et c'est le manque le plus fréquent.
  //
  // Instagram publie aujourd'hui en 3:4 (1080x1440) ; le 4:5 (1080x1350) reste
  // propose pas : ses formats portrait sont le 3:4 et la story. Un design 4:5
  // importé est donc légèrement étiré en hauteur. Ce n'est pas un défaut de
  // l'import, c'est un format manquant dans le produit, et le dire ici est la
  // seule façon que ça remonte.
  const ratioSource = page.width / page.height;
  const ecartRatio = Math.abs(Math.log(ratioSource / fmt.ratio));
  if (ecartRatio > 0.05) {
    pertes.push(`Le design est en ${ratioSource.toFixed(2)}:1, rapproché du format ${fmt.id} : la composition est légèrement étirée.`);
  }

  const polices = Array.from(new Set(blocs.map(b => b.font))).filter(f => f && f !== 'inconnue');
  const compte = new Map<string, number>();
  for (const b of blocs) compte.set(b.color, (compte.get(b.color) ?? 0) + 1);
  for (const r of page.rects) compte.set(r.color, (compte.get(r.color) ?? 0) + 2);
  const couleurs = Array.from(compte.entries()).sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 8);

  // La confiance : trois questions simples, et aucune complaisance.
  let confiance = 1;
  if (sansTexte) confiance -= 0.6;
  if (!blocs.length && !page.rects.length) confiance -= 0.4;
  if (blocs.some(b => b.texte.length > 400)) confiance -= 0.15;
  if (polices.length === 0 && blocs.length) confiance -= 0.2;
  if (blocs.length > 14) confiance -= 0.15; // un modèle à quinze blocs n'en est pas un
  if (ecartRatio > 0.16) confiance -= 0.1;
  confiance = Math.max(0, Math.min(1, confiance));

  return {
    format_id: fmt.id,
    background_style,
    elements,
    rapport: {
      runs: page.texts.length, blocs: blocs.length,
      aplats: page.rects.length - (plein ? 1 : 0),
      zonesPhoto: page.images.length,
      polices, couleurs, pertes, confiance,
    },
  };
}

/** Un document entier : une page par diapositive de carrousel. */
export function pdfToTemplate(pages: PdfPage[]): {
  format_id: string;
  background_style: { type: 'solid'; color: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pages: { elements: any[] }[];
  rapport: RapportImport;
} | null {
  if (!pages.length) return null;
  const rendus = pages.map(pageToTemplate);
  const premier = rendus[0];
  const rapport: RapportImport = {
    runs: rendus.reduce((n, r) => n + r.rapport.runs, 0),
    blocs: rendus.reduce((n, r) => n + r.rapport.blocs, 0),
    aplats: rendus.reduce((n, r) => n + r.rapport.aplats, 0),
    zonesPhoto: rendus.reduce((n, r) => n + r.rapport.zonesPhoto, 0),
    polices: Array.from(new Set(rendus.flatMap(r => r.rapport.polices))),
    couleurs: Array.from(new Set(rendus.flatMap(r => r.rapport.couleurs))).slice(0, 10),
    pertes: Array.from(new Set(rendus.flatMap(r => r.rapport.pertes))),
    // La confiance d'un carrousel est celle de sa page la PIRE : une diapositive
    // ratée sur cinq suffit à décrédibiliser le modèle entier.
    confiance: Math.min(...rendus.map(r => r.rapport.confiance)),
  };
  return {
    format_id: premier.format_id,
    background_style: premier.background_style,
    pages: rendus.map(r => ({ elements: r.elements })),
    rapport,
  };
}
