/* Ranger ce que l'analyse d'un site renvoie dans les choix du questionnaire.
 *
 * `/api/brand/analyze` fait écrire au modèle un secteur en 1 à 3 mots
 * (« Restauration rapide ») et un ton en adjectifs (« Gourmand, décontracté »).
 * Le questionnaire du parcours d'essai propose, lui, des listes fermées
 * (Restaurant, Café…, Chic, Punchy…) et ne présélectionnait qu'une égalité
 * exacte : avec Pepe Chicken (2026-09-14), rien n'était coché alors que
 * l'analyse avait tout trouvé. On range donc par mots-clés, et ce qui ne rentre
 * dans aucune case part dans « Autre » avec son texte.
 */

export const SECTEURS = ["Restaurant", "Café", "Retail", "Mode", "Beauté", "Sport", "Tech", "Autre"] as const;
export const TONS = ["Chic", "Punchy", "Minimal", "Chaleureux", "Direct", "Doux"] as const;

/** Minuscules, sans accents : « Café » et « cafe » se valent. */
function plat(v: string) {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const MOTS_SECTEUR: [typeof SECTEURS[number], RegExp][] = [
  ["Café", /\bcafe|coffee|salon de the|boulang|patiss|brunch|torrefact|\bthe\b/],
  ["Restaurant", /restau|food|burger|pizz|chicken|poulet|traiteur|cuisine|gastronom|snack|sushi|kebab|brasserie|bistro|bar\b|livraison de repas|street ?food|fast|tacos|crepe|glace/],
  ["Beauté", /beaute|cosmet|coiff|esthet|spa\b|ongl|maquill|soin|barb|parfum|institut/],
  ["Mode", /mode|vetement|pret.a.porter|fashion|textile|chaussur|bijou|joaill|accessoire|lingerie|maroquin/],
  ["Sport", /sport|fitness|salle de|yoga|crossfit|coach|club|musculation|pilates|running|velo/],
  ["Tech", /tech|logiciel|saas|digital|numerique|informatique|application|\bapp\b|startup|\bia\b|intelligence artificielle|web|cyber/],
  ["Retail", /commerce|boutique|magasin|vente|retail|epicerie|concept.store|decoration|deco\b|librairie|fleur|caviste/],
];

/** Le secteur de la liste, et le texte d'origine quand il faut passer par « Autre ». */
export function rangerSecteur(brut?: string | null): { secteur: string; autre: string } {
  const texte = (brut ?? "").trim();
  if (!texte) return { secteur: "", autre: "" };
  const exact = SECTEURS.find(s => plat(s) === plat(texte));
  if (exact && exact !== "Autre") return { secteur: exact, autre: "" };
  const trouve = MOTS_SECTEUR.find(([, re]) => re.test(plat(texte)));
  return trouve ? { secteur: trouve[0], autre: "" } : { secteur: "Autre", autre: texte };
}

const MOTS_TON: [typeof TONS[number], RegExp][] = [
  ["Chic", /chic|elegan|raffin|luxe|haut de gamme|sophisti|premium|prestig|exclusi/],
  ["Punchy", /punchy|dynami|energi|percutan|fun|decale|audaci|jeune|accroch|ludique|humour|impertin|street|moderne|tendance/],
  ["Minimal", /minimal|sobre|epure|simple|essentiel|zen/],
  ["Chaleureux", /chaleur|convivi|familial|humain|authenti|genereu|gourmand|proche|accueill|sympa|decontract|festif|partage/],
  ["Direct", /direct|clair|efficace|pratique|informati|professionnel|precis|factuel|expert/],
  ["Doux", /doux|douce|bienveill|rassur|apais|delicat|naturel|serein|poeti|tendre/],
];

/** Le ton de la liste le plus proche du premier adjectif qui s'y range. */
export function rangerTon(brut?: string | null): string {
  const texte = (brut ?? "").trim();
  if (!texte) return "";
  const exact = TONS.find(t => plat(t) === plat(texte));
  if (exact) return exact;
  for (const mot of texte.split(/[,;/]| et /)) {
    const trouve = MOTS_TON.find(([, re]) => re.test(plat(mot)));
    if (trouve) return trouve[0];
  }
  return "";
}

/** « Pepe Chicken (dev) » → « Pepe Chicken » : les balises d'environnement
 *  laissées dans le nom du site n'ont rien à faire dans le nom de la marque. */
export function nettoyerNom(brut?: string | null): string {
  return (brut ?? "")
    .replace(/\s*[([](dev|develop|staging|preprod|pre-prod|recette|test|beta|demo)[)\]]\s*$/i, "")
    .replace(/\s*[|·–-]\s*(accueil|home|site officiel|official site)\s*$/i, "")
    .trim();
}
