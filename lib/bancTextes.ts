// LE TEXTE D'ESSAI DES BANCS, écrit UNE FOIS pour les deux.
//
// POURQUOI CE FICHIER EXISTE. Les deux bancs avaient chacun leur copie de cette
// fonction. Elle a été corrigée dans l'un et pas dans l'autre, et le banc resté
// en arrière a produit une mesure FAUSSE qu'on a prise pour un défaut du juge :
// 0 témoin propre sur 4, rejetés pour « texte coupé par le bord ». Le juge avait
// raison, les témoins n'étaient pas propres. Une fonction dupliquée dérive, et
// une mesure qui dérive coûte plus cher qu'elle ne rapporte.
//
// CE QU'ELLE NE DOIT JAMAIS FAIRE : couper une phrase. Une recette réserve N
// signes parce que son dessin a été fait POUR cette longueur ; un texte plus
// long déborde du cadre ou écrase le bloc suivant, et le banc mesure alors sa
// propre maladresse. « Ouvert ce soir » coupé à 12 signes donne « OUVERT CE »,
// et « La carte change chaque semaine » coupé donne un titre qui touche le bord.
// Les deux ont été rejetés par le juge, à juste titre, sans que le dessin y soit
// pour rien.

/** Des phrases plausibles, de la plus longue à la plus courte. On descend
 *  l'échelle jusqu'à celle qui entre : à chaque étage, une phrase qui a du sens. */
const PHRASES = [
  'La carte change chaque semaine',
  'Trois places restantes',
  'Ouvert ce soir',
  'Nouveau menu',
  'Ce soir',
  'Neuf',
];

/**
 * Un texte plausible pour ce slot, garanti de TENIR dans la place que le dessin
 * lui réserve.
 *
 * @param cle  clé du slot : certaines ont une forme attendue (un prix, une date)
 * @param max  longueur maximale réelle, via `effectiveMax(recette, slot)`
 * @param i    rang du slot dans la recette, pour varier d'un bloc à l'autre
 */
export function echantillon(cle: string, max: number, i: number, deja?: Set<string>): string {
  if (/^p\d|prix/.test(cle)) return ['12€', '8,50€', '19€'][i % 3];
  if (cle === 'chiffre') return ['+248%', '12', '4,9'][i % 3];
  if (cle === 'date') return '12 OCT';
  if (cle === 'heure') return '19H00';

  const depart = i % PHRASES.length;
  // Deux passes : d'abord une phrase qui entre ET qu'aucun autre bloc n'a déjà,
  // puis, si le dessin est trop serré pour ça, n'importe laquelle qui entre.
  for (const exiger of [true, false]) {
    for (let k = 0; k < PHRASES.length; k++) {
      const t = PHRASES[(depart + k) % PHRASES.length];
      if (t.length > max) continue;
      if (exiger && deja?.has(t)) continue;
      deja?.add(t);
      return t;
    }
  }
  // Aucune ne rentre : le slot est minuscule. Un mot, jamais un moignon de phrase.
  return 'Neuf'.slice(0, Math.max(1, max));
}

/**
 * Remplit TOUS les slots d'une recette d'un coup, sans jamais répéter la même
 * phrase d'un bloc à l'autre.
 *
 * POURQUOI ÇA COMPTE, et ça a coûté quatre tours de banc : en remplissant slot
 * par slot, le rail de `ds-rail-editorial` et son titre recevaient tous les deux
 * « Trois places restantes ». Le visuel affichait la même phrase en petit puis
 * en géant. Le juge cherchait ce qui clochait dans un visuel qui clochait
 * vraiment, et sa note partait sur autre chose. Un banc ne doit pas donner à
 * juger des visuels que personne n'enverrait à un client.
 */
export function remplirSlots<S extends { key: string }>(
  slots: readonly S[], maxPour: (s: S) => number,
): Record<string, string> {
  const deja = new Set<string>();
  const out: Record<string, string> = {};
  slots.forEach((s, i) => { out[s.key] = echantillon(s.key, maxPour(s), i, deja); });
  return out;
}
