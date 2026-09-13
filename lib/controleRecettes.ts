// CONTRÔLE GÉOMÉTRIQUE DES RECETTES — le garde-fou déterministe.
//
// POURQUOI IL EXISTE, ET POURQUOI IL EST DANS `lib/` ET PLUS DANS UN SCRATCHPAD.
// Le 2026-09-05, un passage à la main sur les 162 recettes avait trouvé 22 fautes
// réelles, dont 3 que Martin avait vues à l'écran. Le script vivait dans un
// scratchpad : il a disparu, et rien n'a empêché les fautes suivantes d'entrer.
// Une vérification qui ne tourne pas est une vérification qui n'existe pas.
//
// CE QU'IL MESURE, ET CE QU'IL NE MESURE PAS. Il ne dit rien du goût : une
// composition laide passe. Il attrape ce qui est FAUX au sens du cadre — un
// texte hors du visuel, deux blocs qui se marchent dessus, une valeur écrite en
// pixels là où tout le fichier est en fractions. C'est précisément la part du
// « montrable » qui ne demande aucun jugement, donc aucun appel IA : elle doit
// être à zéro avant qu'on paie un modèle pour juger le reste.
//
// LES FAUX POSITIFS SONT TRAITÉS À LA SOURCE, pas écartés à la main après coup.
// Trois exemptions, chacune apprise d'une vraie composition :
//   · un calque SANS `role` est superposé exprès (mot manuscrit sur mot barré,
//     effet d'écho) : il ne participe pas au test de chevauchement ;
//   · un calque avec `rotation` déborde exprès (ruban, tampon de travers) : il
//     ne participe pas au test de cadre ;
//   · deux blocs de rôles différents peuvent se toucher d'un cheveu sans que ce
//     soit une faute, d'où le seuil de recouvrement plutôt qu'un test strict.

import { DESIGN_RECIPES, type DesignRecipe, type DesignNode, type TextNode } from './designSystem';

/** Format de référence d'un post Instagram 4:5. Le rapport largeur/hauteur est
 *  ce qui convertit une taille de police (fraction de la LARGEUR) en hauteur de
 *  bloc (fraction de la HAUTEUR). S'en passer, c'est se tromper de 25 %. */
const W = 1080, H = 1350;
const RATIO = W / H;

/** Interligne par défaut appliqué au rendu (cf. `buildDesignElements`). */
const LH_DEFAUT = 1.15;

/** Tolérance de débordement : un arrondi de rendu ne doit pas lever une faute. */
const EPS = 0.005;

/** En-deçà, un texte porteur de rôle est collé au bord. Le sabotage du banc du
 *  juge est à 8 px sur 1080, soit 0.0074 : le seuil doit le voir. Il ne doit en
 *  revanche PAS voir un grand mot centré à 3 % des bords, qui est un calibre
 *  choisi (`ds-deux-calibres`) et pas un accident. */
const MARGE_MIN = 0.025;

/** DÉBORDEMENT VOULU CONTRE CALQUE ÉGARÉ. Mordre le bord est un procédé courant
 *  et assumé : les étoiles de `ds-etoiles-cadre` sortent aux quatre coins, le
 *  mot de `ds-plein-cadre-mot` déborde de 2 % de chaque côté, le chiffre de
 *  `ds-grand-chiffre-cote` pend à gauche. Ce qui n'est jamais voulu, c'est un
 *  calque MAJORITAIREMENT dehors : là, c'est une coordonnée fautive.
 *
 *  LE SEUIL EST MESURÉ, PAS DEVINÉ. L'étoile d'angle de `ds-etoiles-cadre` est
 *  à 49 % dehors et elle est parfaitement voulue : un élément d'angle est
 *  toujours à peu près à moitié sorti, c'est ce qui en fait un élément d'angle.
 *  À 40 % le contrôle la refusait, et le garde-fou de `compose-layout` aurait
 *  retiré une composition saine de la circulation — un contrôle qui coûte des
 *  compositions justes est pire que pas de contrôle. Au-delà de 60 %, en
 *  revanche, on ne voit plus assez de la forme pour que ce soit un parti pris. */
const PART_DEHORS_MAX = 0.6;

/** Un texte peut mordre le bord, pas y perdre un mot. Au-delà, la première ou
 *  la dernière lettre est coupée pour de bon. */
const DEBORD_TEXTE_MAX = 0.12;

/** Recouvrement toléré entre deux blocs porteurs de rôle, en fraction de l'aire
 *  du plus petit des deux. Deux blocs voisins qui se frôlent ne sont pas une
 *  faute ; l'un posé sur l'autre en est une. */
const RECOUVREMENT_MAX = 0.12;

/** Au-delà, une valeur donnée en fraction de la largeur ne peut plus être une
 *  fraction : c'est un nombre de pixels écrit par erreur. `strokeW: 3` faisait
 *  un contour de 3240 px. Un contour épais vaut 0.004.
 *
 *  Pour `radius`, pas de seuil fixe : un arrondi n'a de sens que jusqu'à la
 *  MOITIÉ du plus petit côté du calque, où la forme devient un disque. C'est la
 *  borne exacte, et elle innocente d'elle-même `ds-arche` (« Photo en disque »,
 *  radius 0.36 sur un calque large de 0.72) tout en attrapant `radius: 16`. */
const SEUIL_PIXELS_STROKE = 0.05;

export type Faute = {
  recette: string;
  type: 'valeur-en-pixels' | 'hors-cadre' | 'texte-deborde' | 'texte-au-bord' | 'chevauchement';
  detail: string;
};

type Boite = { x: number; y: number; w: number; h: number };

/** Hauteur RÉSERVÉE par un bloc de texte, en fraction de la hauteur du cadre.
 *  C'est la place que le dessin lui donne (`maxLines`), pas celle qu'un texte
 *  reçu occupera : c'est bien la réserve qu'on vérifie ici. */
function hauteurTexte(n: TextNode): number {
  return (n.maxLines ?? 1) * n.size * (n.lh ?? LH_DEFAUT) * RATIO;
}

function boite(n: DesignNode): Boite {
  return n.k === 'text'
    ? { x: n.x, y: n.y, w: n.w, h: hauteurTexte(n) }
    : { x: n.x, y: n.y, w: n.w, h: n.h };
}

function recouvrement(a: Boite, b: Boite): number {
  const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (dx <= 0 || dy <= 0) return 0;
  const aireMin = Math.min(a.w * a.h, b.w * b.h);
  return aireMin > 0 ? (dx * dy) / aireMin : 0;
}

/** Part de l'aire d'un calque tombant HORS du cadre. */
function partDehors(b: Boite): number {
  const dx = Math.min(b.x + b.w, 1) - Math.max(b.x, 0);
  const dy = Math.min(b.y + b.h, 1) - Math.max(b.y, 0);
  const dedans = Math.max(0, dx) * Math.max(0, dy);
  const aire = b.w * b.h;
  return aire > 0 ? 1 - dedans / aire : 0;
}

export function controlerRecette(r: DesignRecipe): Faute[] {
  const f: Faute[] = [];
  const ajout = (type: Faute['type'], detail: string) => f.push({ recette: r.id, type, detail });

  r.nodes.forEach((n, i) => {
    const nom = n.k === 'text' ? `texte «${n.slot ?? n.text ?? i}»` : `${n.k} #${i}`;

    // 1. Une fraction écrite en pixels. Le piège le plus coûteux du fichier :
    //    la valeur est acceptée, la forme devient démesurée, et rien ne plante.
    if ((n.k === 'rect' || n.k === 'shape') && n.strokeW !== undefined && n.strokeW > SEUIL_PIXELS_STROKE)
      ajout('valeur-en-pixels', `${nom} : strokeW=${n.strokeW} → ${Math.round(n.strokeW * W)} px de contour`);
    if ((n.k === 'rect' || n.k === 'shape' || n.k === 'photo') && n.radius !== undefined) {
      // Le plus petit côté, ramené à la largeur : `h` est une fraction de la
      // HAUTEUR, `radius` une fraction de la LARGEUR, on ne peut pas les
      // comparer sans convertir.
      const cote = Math.min(n.w, n.h / RATIO);
      if (n.radius > cote / 2 + EPS)
        ajout('valeur-en-pixels', `${nom} : radius=${n.radius} dépasse la moitié du côté (${(cote / 2).toFixed(3)}) → ${Math.round(n.radius * W)} px`);
    }

    const b = boite(n);

    // 2. Calque égaré. Mordre le bord est un procédé ; être majoritairement
    //    dehors est une coordonnée fautive. Un calque pivoté est exempté : le
    //    ruban et le tampon de travers débordent par construction.
    if (!n.rotation) {
      const dehors = partDehors(b);
      if (n.k === 'text') {
        // Pour un texte, ce qui compte n'est pas l'aire perdue mais la lettre
        // coupée : on mesure le débord de chaque côté.
        const debords: string[] = [];
        if (-b.x > DEBORD_TEXTE_MAX) debords.push(`gauche ${b.x.toFixed(3)}`);
        if (b.x + b.w - 1 > DEBORD_TEXTE_MAX) debords.push(`droite ${(b.x + b.w).toFixed(3)}`);
        if (-b.y > DEBORD_TEXTE_MAX) debords.push(`haut ${b.y.toFixed(3)}`);
        if (b.y + b.h - 1 > DEBORD_TEXTE_MAX) debords.push(`bas ${(b.y + b.h).toFixed(3)}`);
        if (debords.length) ajout('texte-deborde', `${nom} est coupé (${debords.join(', ')})`);
      } else if (dehors > PART_DEHORS_MAX) {
        ajout('hors-cadre', `${nom} est à ${Math.round(dehors * 100)} % hors du cadre`);
      }
    }

    // 3. Texte collé au bord. Seulement sur les blocs porteurs de rôle, et
    //    jamais sur un bloc CENTRÉ : ses marges sont un calibre choisi, pas une
    //    position subie. Un bloc aligné, lui, ne doit rien toucher.
    if (n.k === 'text' && n.role && !n.rotation && n.align !== 'center' && b.x >= -DEBORD_TEXTE_MAX) {
      if (n.x > -EPS && n.x < MARGE_MIN) ajout('texte-au-bord', `${nom} à ${n.x.toFixed(3)} du bord gauche`);
      const droite = 1 - n.x - n.w;
      if (droite > -EPS && droite < MARGE_MIN) ajout('texte-au-bord', `${nom} à ${droite.toFixed(3)} du bord droit`);
    }
  });

  // 4. Chevauchement ACCIDENTEL, mesuré APRÈS re-calage.
  //
  //    C'EST LE PIÈGE DE CE CONTRÔLE, et la première version y est tombée. Une
  //    recette RÉSERVE `maxLines` lignes à son titre ; deux blocs consécutifs se
  //    recouvrent donc sur le papier dès que le titre en réserve deux. Mais
  //    `recalerGroupes()` re-empile précisément ces blocs sur leur hauteur RÉELLE
  //    au moment du rendu : la collision n'arrive jamais à l'écran. Signaler
  //    l'état d'avant re-calage, c'est produire des fautes que le pipeline
  //    corrige déjà — exactement le genre de bruit qui fait abandonner un
  //    contrôle. On teste donc le cas où le bloc du haut tient sur UNE ligne :
  //    s'il y a encore collision, elle est structurelle et le re-calage n'y
  //    pourra rien.
  const textes = r.nodes.filter((n): n is TextNode => n.k === 'text' && !!n.role && !n.rotation);
  for (let i = 0; i < textes.length; i++) {
    for (let j = i + 1; j < textes.length; j++) {
      const a = textes[i], b2 = textes[j];
      const haut = a.y <= b2.y ? a : b2, bas = a.y <= b2.y ? b2 : a;
      const bHaut = { ...boite(haut), h: 1 * haut.size * (haut.lh ?? LH_DEFAUT) * RATIO };
      const taux = recouvrement(bHaut, boite(bas));
      if (taux > RECOUVREMENT_MAX)
        ajout('chevauchement', `«${haut.slot ?? '?'}» et «${bas.slot ?? '?'}» se recouvrent à ${Math.round(taux * 100)} % même sur une ligne`);
    }
  }

  return f;
}

export type Rapport = {
  recettes: number;
  saines: number;
  fautives: number;
  /** Part des recettes sans aucune faute géométrique. C'est le plancher du
   *  « montrable » : une recette fautive ne peut pas être publiable, une recette
   *  saine n'est pas encore garantie belle. */
  tauxSaines: number;
  parType: Record<string, number>;
  fautes: Faute[];
};

export function controlerCatalogue(recettes: DesignRecipe[] = DESIGN_RECIPES): Rapport {
  const fautes = recettes.flatMap(controlerRecette);
  const fautives = new Set(fautes.map(x => x.recette)).size;
  const parType: Record<string, number> = {};
  for (const x of fautes) parType[x.type] = (parType[x.type] ?? 0) + 1;
  return {
    recettes: recettes.length,
    saines: recettes.length - fautives,
    fautives,
    tauxSaines: Math.round(((recettes.length - fautives) / recettes.length) * 1000) / 10,
    parType,
    fautes,
  };
}
