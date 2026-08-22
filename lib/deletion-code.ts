/* Code de confirmation pour la suppression d'un compte.
 *
 * Le code est DÉRIVÉ, jamais stocké : c'est un HMAC de l'identifiant du compte
 * et d'une fenêtre de temps, réduit à six chiffres. Même principe que les liens
 * de désinscription (cf. lib/email.ts), et pour la même raison : une table de
 * codes à créer, purger et migrer, pour une action qu'on fait une fois dans sa
 * vie, coûterait plus cher qu'elle ne rapporte — et une migration oubliée
 * casserait la fonctionnalité en silence.
 *
 * La vérification accepte la fenêtre courante ET la précédente : sans cela, un
 * code reçu à 14h29 cesserait de marcher à 14h30, ce qui est incompréhensible
 * pour qui vient de le recevoir.
 */

import crypto from "node:crypto";

/** Durée de validité d'un code, en minutes. */
export const VALIDITE_MIN = 15;

function secrets(): string[] {
  return [process.env.DELETION_SECRET, process.env.CRON_SECRET, "klip-dev-secret"].filter(Boolean) as string[];
}

function fenetre(decalage = 0): number {
  return Math.floor(Date.now() / (VALIDITE_MIN * 60_000)) - decalage;
}

function derive(userId: string, secret: string, decalage: number): string {
  const brut = crypto
    .createHmac("sha256", secret)
    .update(`suppression:${userId}:${fenetre(decalage)}`)
    .digest();
  // Six chiffres, lisibles au téléphone et recopiables sans ambiguïté.
  return String(brut.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

/** Le code à envoyer maintenant. */
export function codeCourant(userId: string): string {
  return derive(userId, secrets()[0], 0);
}

/** Vrai si le code saisi vaut pour ce compte, dans la fenêtre en cours ou la précédente. */
export function codeValide(userId: string, saisi: string): boolean {
  const propre = (saisi ?? "").replace(/\D/g, "");
  if (propre.length !== 6) return false;
  const attendus = secrets().flatMap(s => [derive(userId, s, 0), derive(userId, s, 1)]);
  // Comparaison à temps constant : un code à six chiffres se devine vite si on
  // peut mesurer combien de caractères sont bons.
  return attendus.some(a =>
    a.length === propre.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(propre)),
  );
}
