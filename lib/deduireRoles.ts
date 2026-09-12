// DEVINER CE QU'EST CHAQUE TEXTE, au lieu de le faire déclarer.
//
// CE QUE ÇA CHANGE POUR CELUI QUI DESSINE. Jusqu'ici, pour qu'un bloc devienne
// un champ que l'IA remplit, il fallait lui attribuer un rôle à la main dans un
// menu. C'est une corvée, on l'oublie, et un modèle dont aucun bloc ne porte de
// rôle est joli et parfaitement inutile : l'IA n'a rien à y écrire.
//
// On déduit donc le rôle du DESSIN lui-même. Quelqu'un qui compose écrit son
// titre en grand et sa mention en petit ; il met le prix dans une pastille et le
// nom de la marque en capitales espacées tout en haut. Ces choix SONT
// l'information. Les redemander ensuite dans un menu, c'est demander deux fois
// la même chose.
//
// DÉTERMINISTE, ET PAS UN APPEL D'IA. « Quel est le titre » se lit dans la
// hiérarchie typographique, qui est mesurable : une taille, une position, une
// casse, une forme de contenu. Un modèle de langage répondrait bien la plupart
// du temps et se tromperait sans prévenir, pour un coût par modèle. Ici la règle
// est lisible, testable, et corrigible à la main quand elle se trompe.

/** Les rôles que l'éditeur connaît, dans l'ordre où ils structurent un visuel. */
export type Role = 'titre' | 'sous-titre' | 'accroche' | 'prix' | 'tag' | 'cta' | 'corps';

export type Calque = {
  id?: string;
  type?: string;
  text?: string;
  fontSize?: number;
  x?: number; y?: number; width?: number;
  uppercase?: boolean;
  letterSpacing?: number;
  align?: string;
  hasBg?: boolean;
  fontFamily?: string;
};

export type Deduction = {
  id: string;
  role: Role | null;
  /** Pourquoi ce rôle, en clair. AFFICHÉ à celui qui dessine : une déduction
   *  qu'on ne peut pas contredire est une déduction qu'on subit. */
  pourquoi: string;
  /** Le texte écrit, qui sert de référence de longueur. */
  texte: string;
};

const PRIX = /(^|\s)(\d+[.,]?\d*)\s*(€|eur|euros?|\$)|^\s*(€|\$)\s*\d/i;
const CHIFFRE_SEUL = /^[+\-]?\d+([.,]\d+)?\s*(%|x)?$/;
const CTA = /^(r[ée]serve|commande|appelle|clique|d[ée]couvre|profite|viens|swipe|suis|contacte|inscris|t[ée]l[ée]charge|en savoir plus|voir plus|lien en bio|r[ée]servez|commandez|d[ée]couvrez)/i;
const DATE = /^\d{1,2}\s*(janv|f[ée]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[ée]c)/i;
const HEURE = /^\d{1,2}\s*h(\s*\d{2})?$/i;

/**
 * Attribue un rôle à chaque calque texte d'un dessin.
 *
 * L'ORDRE DES RÈGLES EST LE SUJET. On reconnaît d'abord ce qui se reconnaît à
 * son CONTENU (un prix, un appel à l'action) : ce sont les plus sûres, et elles
 * ne dépendent d'aucune comparaison. Ensuite seulement la hiérarchie des
 * tailles, qui est relative et n'a de sens qu'une fois les cas particuliers
 * écartés — sans quoi un prix écrit en très grand deviendrait le titre.
 */
export function deduireRoles(calques: Calque[]): Deduction[] {
  const textes = calques
    .filter(c => c.type === 'text' && (c.text ?? '').trim().length > 0)
    .map(c => ({ ...c, id: c.id ?? '', texte: (c.text ?? '').trim() }));
  if (!textes.length) return [];

  const tailles = textes.map(t => t.fontSize ?? 0);
  const maxT = Math.max(...tailles);
  const ordre = [...textes].sort((a, b) => (b.fontSize ?? 0) - (a.fontSize ?? 0));

  const out: Deduction[] = [];
  const pris = new Set<string>();
  const pose = (t: typeof textes[number], role: Role | null, pourquoi: string) => {
    if (pris.has(t.id)) return;
    pris.add(t.id);
    out.push({ id: t.id, role, pourquoi, texte: t.texte });
  };

  // 1 — CE QUI SE RECONNAÎT À SON CONTENU, quelle que soit sa taille.
  for (const t of textes) {
    if (PRIX.test(t.texte) || CHIFFRE_SEUL.test(t.texte)) {
      pose(t, 'prix', 'un montant ou un chiffre seul');
    } else if (CTA.test(t.texte)) {
      pose(t, 'cta', 'commence par un verbe d\'action');
    } else if (DATE.test(t.texte) || HEURE.test(t.texte)) {
      pose(t, 'tag', 'une date ou une heure');
    }
  }

  // 2 — LE RAIL DE MARQUE. Une ligne courte, en capitales, très espacée, posée
  //     dans le dixième supérieur : c'est la signature que les comptes soignés
  //     répètent sur chaque post. Elle ne se remplit pas, elle se répète.
  for (const t of textes) {
    if (pris.has(t.id)) continue;
    const haut = (t.y ?? 0) < 0.12 * 1350;
    const espace = (t.letterSpacing ?? 0) >= (t.fontSize ?? 20) * 0.12;
    const petit = (t.fontSize ?? 0) <= maxT * 0.45;
    if (haut && petit && t.uppercase && espace && t.texte.length <= 28) {
      pose(t, 'tag', 'ligne courte en capitales espacées, tout en haut : une signature de marque');
    }
  }

  // 3 — LA HIÉRARCHIE DES TAILLES, une fois les cas particuliers écartés. Le
  //     plus gros texte restant est le titre ; le suivant, s'il est nettement
  //     plus petit, est son sous-titre.
  const restants = ordre.filter(t => !pris.has(t.id));
  if (restants.length) {
    const titre = restants[0];
    pose(titre, 'titre', 'le plus gros texte de la composition');

    for (let i = 1; i < restants.length; i++) {
      const t = restants[i];
      const rapport = (t.fontSize ?? 0) / (titre.fontSize ?? 1);
      if (i === 1 && rapport < 0.8) {
        pose(t, 'sous-titre', 'le second par la taille, nettement sous le titre');
      } else if ((t.texte.length > 60) || ((t.text ?? '').includes('\n'))) {
        pose(t, 'corps', 'un texte long : un paragraphe');
      } else if (t.hasBg) {
        pose(t, 'tag', 'posé sur un aplat : une étiquette');
      } else if (rapport > 0.8) {
        pose(t, 'accroche', 'presque aussi gros que le titre : une seconde ligne de force');
      } else {
        pose(t, 'sous-titre', 'un texte secondaire');
      }
    }
  }

  // Les calques jamais atteints (un texte vide, un calque non textuel) ressortent
  // avec un rôle nul : ils resteront FIGÉS dans la composition, ce qui est le
  // bon défaut pour une mention légale ou un nom de marque écrit en dur.
  for (const t of textes) if (!pris.has(t.id)) pose(t, null, 'texte figé');

  return out;
}
