// LE CADRE DANS LEQUEL L'ÉDITEUR DESSINE, écrit UNE FOIS.
//
// CE N'EST PAS LA TAILLE DU VISUEL FINAL. L'éditeur travaille dans un repère de
// 420 × 560 pour un portrait Instagram ; le visuel exporté fait 1080 × 1350. Les
// coordonnées enregistrées dans `post_templates` sont donc dans CE repère-ci, et
// un modèle converti avec les dimensions de l'export sort 2,6 fois trop petit,
// tassé en haut à gauche — sans que rien ne plante, puisque des fractions
// fausses restent des fractions valides.
//
// C'est arrivé, et Martin l'a vu avant moi : ses six compositions rendaient des
// vignettes minuscules dans un coin. La table vit ici pour que plus personne ne
// la recopie de travers ; elle était déjà dupliquée dans l'éditeur et dans
// `compose-layout`.
export const FORMATS_EDITEUR: Record<string, [number, number]> = {
  'ig-portrait': [420, 560],
  'ig-45': [448, 560],
  'ig-square': [560, 560],
  'ig-story': [315, 560],
  facebook: [560, 294],
};

/** Le cadre d'un modèle, avec le portrait pour défaut. */
export function cadreDe(formatId: unknown): [number, number] {
  return FORMATS_EDITEUR[String(formatId)] ?? FORMATS_EDITEUR['ig-portrait'];
}
