// lib/fontWeights.ts — compatibilité.
//
// Ce fichier tenait la liste des graisses de vingt familles Google. Le catalogue
// vit maintenant dans `fontCatalog.ts`, qui connaît DEUX fournisseurs (Google et
// Fontshare) : garder une liste séparée ici reviendrait à laisser deux vérités
// diverger, et une police Fontshare demandée à Google retombe silencieusement
// sur la police système. Les trois fonctions historiques restent, elles
// délèguent — le nom « google » n'est plus exact, la signature l'est.

import { fontCssHref, fontVariants, weightLabel, fontSpec } from './fontCatalog';

export interface FontWeightSpec {
  weights: number[];
  italic: boolean;
}

/** URL de la feuille de style d'une famille, chez son vrai fournisseur. */
export const googleFontHref = fontCssHref;

/** Variantes proposables : graisses × italique. */
export const googleVariants = fontVariants;

/** Libellé lisible d'une graisse. */
export const weightName = weightLabel;

/** Graisses réelles d'une famille, ou 400/700 si elle est inconnue. */
export function familyWeights(family: string): FontWeightSpec {
  const s = fontSpec(family);
  return s ? { weights: s.weights, italic: s.italic } : { weights: [400, 700], italic: false };
}
