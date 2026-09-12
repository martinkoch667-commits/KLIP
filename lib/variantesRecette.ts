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
export function variantesDe(
  r: DesignRecipe, voisines: DesignRecipe[] = [], combien = 4,
): Variante[] {
  const candidates: Variante[] = [];
  const pousse = (rec: DesignRecipe | null, geste: string, emprunt?: string) => {
    if (rec) candidates.push({ recette: rec, geste, emprunt });
  };

  pousse(axeEchelle(r, 1.22), 'titre agrandi');
  pousse(axeMatiere(r, 'brand', 'onBrand'), 'titre sur cartouche de marque');
  pousse(axeAncrage(r, -0.16), 'texte remonté');
  pousse(axeDensite(r, 0.05), 'marges resserrées');
  pousse(axeAlignement(r, 'center'), 'aligné au centre');
  pousse(axeAlignement(r, 'left'), 'aligné à gauche');
  pousse(axeEchelle(r, 0.82), 'titre réduit');
  pousse(axeAncrage(r, 0.12), 'texte descendu');
  pousse(axeMatiere(r, 'accent', 'onAccent'), 'titre sur cartouche d\'accent');
  pousse(axeDensite(r, -0.03), 'marges ouvertes');

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
