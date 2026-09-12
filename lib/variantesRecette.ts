// DES VARIANTES QUI NE SONT PAS DES COPIES.
//
// CE QU'ON DEMANDE ICI. Martin dessine cinquante compositions à la main, parce
// qu'il sait ce qui marche sur les réseaux. On doit en tirer deux cents, et pas
// deux cents fois la même : des déclinaisons qui RÉUTILISENT ses partis pris en
// les recombinant, comme un graphiste décline une série.
//
// POURQUOI C'EST DÉTERMINISTE ET PAS UN APPEL D'IA. « Fais-moi des variantes »
// n'est pas une question de goût, c'est une question de GRAMMAIRE : on connaît
// les axes sur lesquels une composition peut bouger sans cesser d'être
// elle-même. Un modèle de langage y répondrait par ses préférences habituelles,
// c'est-à-dire toujours les mêmes trois idées, et il ne saurait pas garantir que
// le résultat tient dans le cadre. Ici tout est calculé, donc reproductible, et
// chaque variante passe le contrôle géométrique avant d'être proposée.
//
// LES DEUX FAMILLES DE VARIATION, et la seconde est celle qui compte :
//   · RÉGLER un axe de la composition (l'échelle, la densité, l'ancrage) ;
//   · EMPRUNTER un geste à une AUTRE composition de la série. C'est ce que veut
//     dire « mélanger » : le rail de marque du modèle 3 posé sur la mise en page
//     du modèle 12. Sans ce croisement, cinquante modèles donnent cinquante
//     séries parallèles, jamais un système.

import {
  controlerRecette,
} from './controleRecettes';
import type { Col, DesignNode, DesignRecipe, TextNode, RectNode } from './designSystem';

export type Variante = {
  recette: DesignRecipe;
  /** Ce qui a été changé, en clair, pour que la relecture ne soit pas un jeu
   *  des sept erreurs. */
  geste: string;
  /** D'où vient le geste emprunté, quand il y en a un. */
  emprunt?: string;
};

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const estTexte = (nd: DesignNode): nd is TextNode => nd.k === 'text';

/** Les blocs porteurs de rôle : ceux qui forment l'ensemble qu'on déplace. Les
 *  autres (rail, mention, mot barré) sont posés là exprès et ne suivent pas. */
const porteurs = (r: DesignRecipe) => r.nodes.filter(estTexte).filter(t => !!t.role);

function borne(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

// ── Axe 1 : l'échelle typographique ─────────────────────────────────────────
//
// Le titre grossit, le reste tient sa place. C'est la variation la plus visible
// et la moins risquée : elle ne déplace rien, elle change le rapport de force.
function axeEchelle(r: DesignRecipe, facteur: number): DesignRecipe {
  const v = clone(r);
  const tailles = v.nodes.filter(estTexte).map(t => t.size);
  const max = Math.max(...tailles, 0);
  for (const nd of v.nodes) {
    if (!estTexte(nd)) continue;
    // Seul le plus gros bloc change : tout agrandir ne fait que zoomer.
    if (nd.size >= max - 1e-6) nd.size = Math.round(nd.size * facteur * 1000) / 1000;
  }
  return v;
}

// ── Axe 2 : la densité ──────────────────────────────────────────────────────
//
// Les marges latérales s'ouvrent ou se resserrent, et les blocs porteurs se
// rapprochent ou s'aèrent. Une composition serrée et la même respirée ne se
// lisent pas pareil : l'une est directe, l'autre est posée.
function axeDensite(r: DesignRecipe, delta: number): DesignRecipe {
  const v = clone(r);
  for (const nd of v.nodes) {
    if (!estTexte(nd) || !nd.role) continue;
    const nx = borne(nd.x + delta, 0.02, 0.5);
    nd.w = borne(nd.w - 2 * (nx - nd.x), 0.2, 1);
    nd.x = nx;
  }
  return v;
}

// ── Axe 3 : l'ancrage ───────────────────────────────────────────────────────
//
// L'ensemble du texte monte ou descend d'un bloc. On ne bouge QUE les porteurs,
// et on refuse le déplacement s'il sort du cadre : une variante fausse ne vaut
// pas mieux qu'une variante absente.
function axeAncrage(r: DesignRecipe, delta: number): DesignRecipe | null {
  const v = clone(r);
  const ps = porteurs(v);
  if (!ps.length) return null;
  for (const t of ps) {
    const ny = t.y + delta;
    if (ny < 0.03 || ny > 0.92) return null;
    t.y = Math.round(ny * 1000) / 1000;
  }
  return v;
}

// ── Axe 4 : l'intensité de la couleur ───────────────────────────────────────
//
// LE GESTE QUI CHANGE LE PLUS UNE COMPOSITION. Le même texte posé nu sur une
// photo, puis sur un cartouche de la couleur de marque, ce sont deux visuels
// différents — et c'est précisément ce qui fait qu'un visuel a l'air d'une
// MARQUE plutôt que d'une légende. C'est aussi la réponse la plus solide à un
// texte qui manque de contraste.
function axeMatiere(r: DesignRecipe, col: Col, surCol: Col): DesignRecipe | null {
  const v = clone(r);
  const ps = porteurs(v).filter(t => !t.bg && !t.hl);
  if (!ps.length) return null;
  // Le plus gros porteur seulement : cartoucher tout le texte fait un pavé.
  const cible = ps.reduce((a, b) => (b.size > a.size ? b : a));
  cible.hl = col;
  cible.fill = surCol;
  cible.hlRadius = 4;
  cible.hlPad = 14;
  // Un halo sous un texte désormais posé sur un aplat n'a plus de sens.
  delete cible.shadow;
  return v;
}

// ── Axe 5 : l'alignement ────────────────────────────────────────────────────
function axeAlignement(r: DesignRecipe, vers: 'left' | 'center'): DesignRecipe | null {
  const ps = porteurs(r);
  if (!ps.length) return null;
  const actuel = ps[0].align ?? 'left';
  if (actuel === vers) return null;
  const v = clone(r);
  for (const t of porteurs(v)) t.align = vers;
  return v;
}

// ── Axe 6 : LE GESTE EMPRUNTÉ ───────────────────────────────────────────────
//
// C'est lui qui transforme une pile de modèles en système. On prend un geste
// SIGNÉ d'une autre composition — un rail de marque, un filet, une pastille
// d'angle, un voile — et on le pose sur celle-ci.
//
// On n'emprunte QUE des calques non textuels ou à texte figé : emprunter un
// slot reviendrait à demander à l'IA d'écrire un champ que le dessin d'origine
// n'a jamais prévu.
function gestesEmpruntables(r: DesignRecipe): DesignNode[] {
  return r.nodes.filter(nd => {
    if (estTexte(nd)) return !nd.slot && !!nd.text;          // un rail, une mention figée
    if (nd.k === 'rect') return !(nd as RectNode).scrim && nd.h < 0.2;  // un filet, une bande
    if (nd.k === 'shape') return nd.w < 0.45;                 // une pastille, une étoile d'angle
    return false;
  });
}

function axeEmprunt(r: DesignRecipe, source: DesignRecipe): Variante | null {
  const dispo = gestesEmpruntables(source);
  if (!dispo.length) return null;
  // Le geste le plus haut de la source : c'est presque toujours sa signature
  // (rail, badge d'angle), et c'est ce qui se transplante le mieux.
  const geste = clone(dispo.reduce((a, b) => (b.y < a.y ? b : a)));
  const v = clone(r);
  // Refusé si ça tombe sur un bloc porteur : on ne gagne rien à créer la
  // collision qu'on passe notre temps à chasser.
  const zone = { y1: geste.y, y2: geste.y + (estTexte(geste) ? geste.size * 1.2 * 0.8 : geste.h) };
  const gene = porteurs(v).some(t => {
    const t2 = t.y + (t.maxLines ?? 1) * t.size * (t.lh ?? 1.15) * 0.8;
    return !(t2 < zone.y1 || t.y > zone.y2);
  });
  if (gene) return null;
  v.nodes.push(geste);
  return { recette: v, geste: 'geste emprunté', emprunt: source.name };
}

// ════════════════════════════════════════════════════════════════════════════
// LES GESTES DE COMPOSITION — ceux qui changent le VISUEL, pas ses réglages.
//
// Les six axes ci-dessus règlent une composition sans la repenser : plus gros,
// plus serré, plus haut. C'est utile et c'est sûr, mais aligné bout à bout ça
// donne quatre fois le même visuel. Martin le dit : « soit beaucoup plus
// créatif, fais des compositions un peu différentes ».
//
// Ceux qui suivent sont des GESTES DE GRAPHISTE : ils déplacent le rapport de
// force, changent la zone d'écriture, ajoutent une matière. Chacun reste
// gouverné par la même règle — il part du dessin de l'auteur et n'en change
// qu'UNE chose à la fois. Un geste qui en change trois ne se lit plus comme une
// déclinaison, il se lit comme une autre composition.
// ════════════════════════════════════════════════════════════════════════════

/** Le bloc dominant, et le reste. Presque tous les gestes se formulent ainsi. */
function dominant(r: DesignRecipe): TextNode | null {
  const ps = porteurs(r);
  return ps.length ? ps.reduce((a, b) => (b.size > a.size ? b : a)) : null;
}

/** Hauteur occupée par un bloc, en fraction de la HAUTEUR du cadre. */
function hauteurDe(t: TextNode): number {
  return (t.maxLines ?? 1) * t.size * (t.lh ?? 1.15) * (1080 / 1350);
}

// ── L'INVERSION DU RAPPORT DE FORCE ─────────────────────────────────────────
//
// Le second devient le premier. Sur une composition à deux textes, c'est le
// geste qui change le plus la lecture pour le moins de déplacement : la même
// page dit soudain autre chose en premier.
function gesteInversion(r: DesignRecipe): DesignRecipe | null {
  const ps = porteurs(r);
  if (ps.length < 2) return null;
  const v = clone(r);
  const q = porteurs(v).sort((a, b) => b.size - a.size);
  const [gros, petit] = q;
  if (gros.size / Math.max(1e-6, petit.size) < 1.5) return null; // déjà équilibrés : rien à inverser
  const t = gros.size;
  gros.size = Math.round(petit.size * 1000) / 1000;
  petit.size = Math.round(t * 1000) / 1000;
  const g = gros.weight; gros.weight = petit.weight; petit.weight = g;
  const u = gros.upper; gros.upper = petit.upper; petit.upper = u;
  return v;
}

// ── LE BANDEAU PLEIN ────────────────────────────────────────────────────────
//
// Le titre quitte la photo pour une bande de couleur qui traverse le cadre de
// bord à bord. C'est le geste qui fait le plus « marque » : il transforme une
// légende posée sur une image en affiche.
function gesteBandeau(r: DesignRecipe, col: Col, surCol: Col): DesignRecipe | null {
  const cible = dominant(r);
  if (!cible) return null;
  const v = clone(r);
  const t = porteurs(v).reduce((a, b) => (b.size > a.size ? b : a));
  const marge = 0.035;
  const haut = Math.max(0, t.y - marge);
  const bas = Math.min(1, t.y + hauteurDe(t) + marge);
  // La bande se pose SOUS le texte : insérée en fin de liste elle le couvrirait.
  const i = v.nodes.indexOf(v.nodes.find(nd => nd.k === 'text' && (nd as TextNode).slot === t.slot)!);
  v.nodes.splice(Math.max(0, i), 0, { k: 'rect', x: 0, y: haut, w: 1, h: bas - haut, fill: col });
  t.fill = surCol;
  t.x = Math.max(t.x, 0.07);
  delete t.shadow;
  return v;
}

// ── LA ZONE OPPOSÉE ─────────────────────────────────────────────────────────
//
// Le texte écrit en bas passe en haut, et réciproquement. Ce n'est pas un
// réglage d'ancrage de quelques pour cent : c'est l'autre moitié de l'image, et
// donc une autre photo qui devient lisible dessous.
function gesteZoneOpposee(r: DesignRecipe): DesignRecipe | null {
  const ps = porteurs(r);
  if (!ps.length) return null;
  const haut = Math.min(...ps.map(t => t.y));
  const bas = Math.max(...ps.map(t => t.y + hauteurDe(t)));
  const v = clone(r);
  // On renverse le groupe autour du milieu du cadre, en gardant son ordre.
  const nouveauHaut = 1 - bas;
  if (nouveauHaut < 0.04 || nouveauHaut > 0.9) return null;
  const delta = nouveauHaut - haut;
  if (Math.abs(delta) < 0.12) return null; // déjà au milieu : le geste ne se verrait pas
  for (const t of porteurs(v)) t.y = Math.round((t.y + delta) * 1000) / 1000;
  // Le voile de lisibilité, s'il y en a un, suit le texte.
  for (const nd of v.nodes) {
    if (nd.k === 'rect' && (nd as RectNode).scrim) {
      (nd as RectNode).scrim = (nd as RectNode).scrim === 'bottom' ? 'top' : 'bottom';
      nd.y = nd.y > 0.4 ? 0 : 1 - nd.h;
    }
  }
  return v;
}

// ── LA COLONNE ÉTROITE ──────────────────────────────────────────────────────
//
// Le texte se resserre sur une moitié du cadre et laisse l'autre à la photo.
// C'est la composition éditoriale : le sujet respire, le mot se tient à côté.
function gesteColonne(r: DesignRecipe, cote: 'gauche' | 'droite'): DesignRecipe | null {
  const ps = porteurs(r);
  if (!ps.length) return null;
  const v = clone(r);
  for (const t of porteurs(v)) {
    t.w = 0.46;
    t.x = cote === 'gauche' ? 0.07 : 0.47;
    t.align = cote === 'gauche' ? 'left' : 'right';
    // Un texte deux fois plus étroit prend deux fois plus de lignes : on lui en
    // donne le droit, sinon il déborde de sa réserve et le re-calage le pousse.
    t.maxLines = Math.min(4, Math.max(2, (t.maxLines ?? 1) + 1));
  }
  return v;
}

// ── LE MOT GÉANT ────────────────────────────────────────────────────────────
//
// Le texte le plus COURT devient énorme, le reste se range. C'est le geste des
// comptes qui assument un seul mot par visuel, et il ne marche que si un des
// blocs est réellement court — sur une phrase, il produit une bouillie.
function gesteMotGeant(r: DesignRecipe): DesignRecipe | null {
  const ps = porteurs(r);
  if (ps.length < 2) return null;
  const court = ps.reduce((a, b) => ((b.maxLines ?? 1) <= (a.maxLines ?? 1) ? b : a));
  if ((court.maxLines ?? 1) > 1) return null;
  const v = clone(r);
  const q = porteurs(v);
  const c = q.find(t => t.slot === court.slot);
  if (!c) return null;
  const plusGros = Math.max(...q.map(t => t.size));
  if (c.size >= plusGros * 0.9) return null; // c'est déjà lui le géant
  c.size = Math.round(Math.min(0.3, plusGros * 1.6) * 1000) / 1000;
  c.weight = 'bold';
  c.upper = true;
  for (const t of q) if (t !== c) t.size = Math.round(t.size * 0.8 * 1000) / 1000;
  return v;
}

// ── LE VOILE ────────────────────────────────────────────────────────────────
//
// Une bande sombre dégressive sous le texte. Ce n'est pas un ornement : c'est la
// réponse standard à un texte clair posé sur une photo dont on ne maîtrise pas
// les zones. Refusé si la composition en a déjà un.
function gesteVoile(r: DesignRecipe): DesignRecipe | null {
  if (!r.nodes.some(nd => nd.k === 'photo')) return null;
  if (r.nodes.some(nd => nd.k === 'rect' && (nd as RectNode).scrim)) return null;
  const ps = porteurs(r);
  if (!ps.length) return null;
  const milieu = ps.reduce((n, t) => n + t.y, 0) / ps.length;
  const v = clone(r);
  const cote: 'top' | 'bottom' = milieu > 0.5 ? 'bottom' : 'top';
  const i = v.nodes.findIndex(nd => nd.k === 'text');
  v.nodes.splice(Math.max(0, i), 0, {
    k: 'rect', x: 0, y: cote === 'bottom' ? 0.45 : 0, w: 1, h: 0.55,
    fill: 'black', scrim: cote, opacity: 62,
  });
  return v;
}

// ── LE FILET ────────────────────────────────────────────────────────────────
//
// Un trait fin de la couleur de marque, posé juste au-dessus du titre. Le plus
// petit geste du répertoire, et celui qui fait le plus « journal ».
function gesteFilet(r: DesignRecipe, col: Col): DesignRecipe | null {
  const cible = dominant(r);
  if (!cible || cible.y < 0.06) return null;
  const v = clone(r);
  v.nodes.push({ k: 'rect', x: cible.x, y: Math.max(0.02, cible.y - 0.035), w: 0.12, h: 0.005, fill: col });
  return v;
}

// ── LA PASTILLE D'ANGLE ─────────────────────────────────────────────────────
//
// Le texte le plus court file dans une pastille en haut à droite, façon badge.
// Il quitte le groupe, donc il cesse de peser sur la mise en page du reste.
function gestePastille(r: DesignRecipe, col: Col, surCol: Col): DesignRecipe | null {
  const ps = porteurs(r);
  if (ps.length < 2) return null;
  const court = ps.reduce((a, b) => ((b.maxLines ?? 1) <= (a.maxLines ?? 1) && b.size <= a.size ? b : a));
  if ((court.maxLines ?? 1) > 1 || court.size > 0.06) return null;
  if (ps.some(t => t.y < 0.2)) return null; // le haut est déjà occupé
  const v = clone(r);
  const c = porteurs(v).find(t => t.slot === court.slot);
  if (!c) return null;
  v.nodes.splice(0, 0, { k: 'shape', shape: 'circle', x: 0.63, y: 0.05, w: 0.29, h: 0.232, fill: col, rotation: -8 });
  c.x = 0.645; c.y = 0.145; c.w = 0.26; c.size = 0.032;
  c.align = 'center'; c.upper = true; c.fill = surCol; c.rotation = -8; c.maxLines = 2;
  return v;
}

// ── La série ────────────────────────────────────────────────────────────────

/**
 * Les variantes d'une composition, dans l'ordre où elles méritent d'être
 * regardées : d'abord les réglages d'axe, ensuite les emprunts.
 *
 * `voisines` sont les autres compositions de la série, celles à qui emprunter.
 * Chaque variante produite passe le CONTRÔLE GÉOMÉTRIQUE : une déclinaison qui
 * sort du cadre ou qui superpose deux blocs n'est jamais proposée. C'est ce qui
 * permet d'en générer deux cents sans les relire une par une pour vérifier
 * qu'elles tiennent debout — la relecture humaine porte alors sur le GOÛT, pas
 * sur la solidité.
 */
/** Combien de propositions en tête de liste sont des GESTES de composition, et
 *  non des réglages fins. C'est la frontière que la rotation ne franchit pas. */
const NB_GESTES = 10;

export function variantesDe(
  r: DesignRecipe, voisines: DesignRecipe[] = [], combien = 4,
): Variante[] {
  const candidates: Variante[] = [];
  const pousse = (rec: DesignRecipe | null, geste: string, emprunt?: string) => {
    if (rec) candidates.push({ recette: rec, geste, emprunt });
  };

  // LES GESTES DE COMPOSITION D'ABORD. Ce sont eux qu'on veut voir : ils
  // changent le visuel, pas ses réglages. Les axes fins viennent ensuite, pour
  // compléter la série quand un geste ne s'applique pas à ce dessin-là.
  pousse(gesteBandeau(r, 'brand', 'onBrand'), 'titre en bandeau de marque');
  pousse(gesteZoneOpposee(r), 'texte passé dans l\'autre moitié');
  pousse(gesteMotGeant(r), 'un mot en géant');
  pousse(gesteColonne(r, 'gauche'), 'texte en colonne, photo à droite');
  pousse(gesteInversion(r), 'rapport de force inversé');
  pousse(gesteVoile(r), 'voile de lisibilité');
  pousse(gestePastille(r, 'accent', 'onAccent'), 'mention en pastille d\'angle');
  pousse(gesteColonne(r, 'droite'), 'texte en colonne, photo à gauche');
  pousse(gesteBandeau(r, 'accent', 'onAccent'), 'titre en bandeau d\'accent');
  pousse(gesteFilet(r, 'brand'), 'filet de marque au-dessus du titre');

  // Les réglages fins, en repli.
  pousse(axeMatiere(r, 'brand', 'onBrand'), 'titre sur cartouche de marque');
  pousse(axeEchelle(r, 1.22), 'titre agrandi');
  pousse(axeAncrage(r, -0.16), 'texte remonté');
  pousse(axeDensite(r, 0.05), 'marges resserrées');
  pousse(axeAlignement(r, 'center'), 'aligné au centre');
  pousse(axeAlignement(r, 'left'), 'aligné à gauche');
  pousse(axeEchelle(r, 0.82), 'titre réduit');
  pousse(axeAncrage(r, 0.12), 'texte descendu');
  pousse(axeMatiere(r, 'accent', 'onAccent'), 'titre sur cartouche d\'accent');
  pousse(axeDensite(r, -0.03), 'marges ouvertes');

  // ON FAIT TOURNER L'ORDRE D'UN MODÈLE À L'AUTRE.
  //
  // Mesuré sur les 19 compositions : le bandeau sortait sur 18 d'entre elles et
  // la colonne sur 17, simplement parce qu'ils sont en tête de liste et
  // s'appliquent presque toujours. Quatre-vingts déclinaisons faisaient donc
  // vingt fois les quatre mêmes gestes — l'inverse d'une série.
  //
  // Le décalage est tiré de l'IDENTIFIANT de la recette, donc stable : relancer
  // l'atelier sur les mêmes modèles redonne exactement les mêmes propositions,
  // et deux modèles voisins n'ouvrent pas sur le même geste.
  // ON NE FAIT TOURNER QUE LES GESTES DE COMPOSITION, jamais toute la liste :
  // une rotation aveugle ramenait les réglages fins en tête, et deux modèles se
  // retrouvaient avec quatre variantes qui ne changent que des marges. Les
  // gestes passent devant, toujours ; c'est leur ORDRE ENTRE EUX qui tourne.
  let graine = 7;
  for (let i = 0; i < r.id.length; i++) graine = (graine * 31 + r.id.charCodeAt(i)) >>> 0;
  const nbGestes = Math.min(NB_GESTES, candidates.length);
  const gestes = candidates.slice(0, nbGestes);
  const reglages = candidates.slice(nbGestes);
  const d = nbGestes ? graine % nbGestes : 0;
  candidates.length = 0;
  candidates.push(...gestes.slice(d), ...gestes.slice(0, d), ...reglages);

  // Les emprunts en dernier : ce sont les plus surprenants, donc ceux qu'on
  // veut voir quand les réglages sûrs n'ont pas suffi à remplir la série.
  for (const source of voisines) {
    if (source.id === r.id) continue;
    const e = axeEmprunt(r, source);
    if (e) candidates.push(e);
  }

  // LE FILTRE QUI REND LE VOLUME POSSIBLE. Sans lui, deux cents variantes
  // demanderaient deux cents relectures de solidité avant même de parler de goût.
  //
  // ON JUGE LA VARIANTE PAR RAPPORT À SA BASE, PAS DANS L'ABSOLU. Une
  // composition dessinée à la main porte souvent des superpositions VOULUES : un
  // mot posé sur un badge, un prix par-dessus un titre. Le contrôle les compte
  // comme des fautes, à raison quand c'est une machine qui les a produites — mais
  // ici c'est un parti pris d'auteur, et refuser toutes les variantes d'une
  // composition volontairement dense revenait à n'en décliner aucune. Mesuré sur
  // les modèles de Martin : deux d'entre eux ne sortaient qu'UNE variante au lieu
  // de quatre pour cette seule raison.
  //
  // Ce qu'on refuse, c'est donc une variante qui AJOUTE une faute : celle-là, on
  // l'a bien introduite nous-mêmes.
  const fautesBase = controlerRecette(r).length;
  const retenues: Variante[] = [];
  const vues = new Set<string>();
  for (const c of candidates) {
    if (retenues.length >= combien) break;
    if (controlerRecette(c.recette).length > fautesBase) continue;
    // Deux réglages peuvent tomber sur le même dessin : on ne propose pas
    // deux fois la même chose à valider.
    const empreinte = JSON.stringify(c.recette.nodes);
    if (vues.has(empreinte)) continue;
    vues.add(empreinte);
    c.recette = {
      ...c.recette,
      id: `${r.id}-v${retenues.length + 1}`,
      name: `${r.name} · ${c.geste}`,
    };
    retenues.push(c);
  }
  return retenues;
}

/** Toute la série d'un coup : chaque composition décline, et emprunte aux autres. */
export function declinerSerie(base: DesignRecipe[], parModele = 4): Variante[] {
  return base.flatMap(r => variantesDe(r, base, parModele));
}
