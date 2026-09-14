/* Brouillon de marque du parcours d'essai (prototype).
 *
 * Les trois écrans du parcours — saisie du site, questionnaire, board ADN —
 * se passent ce qu'ils savent de la marque. Tant que rien n'est branché sur
 * Supabase, ça vit dans le `sessionStorage` : c'est volontairement éphémère,
 * on ne veut pas laisser traîner la charte d'un visiteur qui n'a pas de compte.
 *
 * `prefilled` retient QUELLES valeurs viennent de l'analyse et non de la
 * personne : c'est ce qui permet d'afficher la pastille « pré-rempli » sur les
 * bonnes réponses, comme sur la référence.
 */

export type OnbDraft = {
  source: "site" | "instagram" | "manuel";
  /** Le compte Meta a-t-il été relié à la première étape.
   *
   *  C'est la variable la plus lourde du parcours, et elle voyage jusqu'au bout :
   *  sans compte relié on lit une CHARTE (couleurs, polices, logo du site) mais
   *  on ne mesure pas des HABITUDES (où la marque écrit sur ses photos, ses
   *  motifs récurrents, sa palette réelle relevée sur ses posts). Les écrans
   *  suivants doivent le dire au lieu de laisser croire à une analyse complète. */
  igConnected?: boolean;
  url?: string;
  /** « Je n'ai pas de site » : l'étape du site est faite, sans adresse. */
  sansSite?: boolean;
  handle?: string;
  name?: string;
  sector?: string;
  /** Le secteur tel que l'analyse l'a écrit, quand il ne rentre dans aucune
   *  case du questionnaire (« Autre » pré-rempli avec ce texte). */
  sectorAutre?: string;
  /** « Vous nous avez connus comment ? », précisé quand c'est « Autre ». */
  origine?: string;
  tone?: string;
  description?: string;
  colors?: string[];
  fonts?: string[];
  logoUrl?: string;
  /** Relevés sur le compte Instagram relié (photo de profil) : en complément
   *  des couleurs du site, et en logo de secours. */
  igColors?: string[];
  igLogo?: string;
  headline?: string;
  /** Champs devinés par l'analyse — sert à marquer « pré-rempli » à l'écran. */
  prefilled: string[];
  /** Vrai quand l'analyse réelle n'a pas pu tourner et qu'on montre un exemple. */
  demo?: boolean;
  /** Le client (workspace) du parcours. Créé dès la connexion Instagram ou
   *  Facebook (la connexion a besoin d'un client), sinon après le paiement. */
  clientId?: string;
  /** Vrai une fois la charte recopiée dans ce client : pas de second passage
   *  si /checkout-success est rechargée. */
  charteEcrite?: boolean;
};

const CLE = "klip_onb_draft";

export function lireDraft(): OnbDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = sessionStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as OnbDraft) : null;
  } catch {
    return null; // navigation privée, stockage refusé : on repart à vide
  }
}

export function ecrireDraft(d: OnbDraft): void {
  try {
    sessionStorage.setItem(CLE, JSON.stringify(d));
  } catch {
    /* pas de stockage : le parcours marche quand même, sans pré-remplissage */
  }
}

/** « smashy-burger.fr » → « Smashy Burger ». Suffisant pour proposer un nom. */
export function nomDepuisUrl(url: string): string {
  const hote = url.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const racine = hote.split(".")[0] || hote;
  return racine
    .split(/[-_]/)
    .filter(Boolean)
    .map(m => m.charAt(0).toUpperCase() + m.slice(1))
    .join(" ");
}
