// APPLIQUER LES CORRECTIONS DU RÉPARATEUR À LA RECETTE ELLE-MÊME.
//
// POURQUOI ÇA NE PEUT PAS RESTER DANS L'APERÇU. Le réparateur rend des
// coordonnées en PIXELS, sur le rendu qu'il a sous les yeux. Les appliquer aux
// calques déjà construits corrigerait l'image affichée et rien d'autre : la
// composition ENREGISTRÉE resterait fautive, et le défaut reviendrait au premier
// client qui la reçoit. On les reporte donc sur la RECETTE, en fractions.
//
// LE PONT ENTRE LES DEUX EST L'IDENTIFIANT. `buildDesignElements` nomme chaque
// calque `ds-<recette>-<rang>`, où le rang est la position du noeud dans la
// recette. C'est ce rang qui permet de retrouver le noeud d'origine. Si ce
// nommage change un jour, cette fonction cesse silencieusement de corriger quoi
// que ce soit — d'où le compteur rendu à l'appelant, qui le dirait tout de suite.

import type { DesignRecipe, TextNode } from './designSystem';

export type Retouche = {
  id?: string;
  problem?: string;
  fix?: { x?: number; y?: number; width?: number; fontSize?: number; align?: string };
};

const nb = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/**
 * Reporte les corrections sur une COPIE de la recette.
 *
 * @param w @param h dimensions du rendu que le réparateur a regardé.
 * @returns la recette corrigée et le nombre de gestes réellement appliqués.
 */
export function appliquerRetouches(
  recette: DesignRecipe, retouches: Retouche[], w: number, h: number,
): { recette: DesignRecipe; appliquees: number } {
  const v = JSON.parse(JSON.stringify(recette)) as DesignRecipe;
  let appliquees = 0;

  for (const r of retouches) {
    const m = /-(\d+)$/.exec(String(r?.id ?? ''));
    if (!m || !r.fix) continue;
    const nd = v.nodes[Number(m[1])];
    if (!nd || nd.k !== 'text') continue;
    const t = nd as TextNode;

    const x = nb(r.fix.x), y = nb(r.fix.y);
    const lg = nb(r.fix.width), corps = nb(r.fix.fontSize);
    let touche = false;

    // ON BORNE TOUT. Le réparateur regarde une image et se trompe parfois d'un
    // facteur dix sur une coordonnée ; accepter sa valeur telle quelle
    // remplacerait un défaut visible par un calque expédié hors du cadre. Une
    // correction qui sort des bornes est IGNORÉE, pas ramenée de force : si elle
    // est absurde, son intention l'est aussi.
    if (x !== null && x / w >= -0.02 && x / w <= 0.95) { t.x = Math.round((x / w) * 1000) / 1000; touche = true; }
    if (y !== null && y / h >= -0.02 && y / h <= 0.97) { t.y = Math.round((y / h) * 1000) / 1000; touche = true; }
    if (lg !== null && lg / w >= 0.1 && lg / w <= 1.02) { t.w = Math.round((lg / w) * 1000) / 1000; touche = true; }
    // LE CORPS NE BOUGE QUE DE 30 % AU PLUS. Au-delà, ce n'est plus une
    // correction, c'est une autre composition — et la hiérarchie que l'auteur a
    // posée entre ses blocs se perdrait.
    if (corps !== null) {
      const f = corps / w / t.size;
      if (f >= 0.7 && f <= 1.3) { t.size = Math.round((corps / w) * 1000) / 1000; touche = true; }
    }
    if (r.fix.align && ['left', 'center', 'right'].includes(r.fix.align)) {
      t.align = r.fix.align as TextNode['align']; touche = true;
    }
    if (touche) appliquees++;
  }

  return { recette: v, appliquees };
}
