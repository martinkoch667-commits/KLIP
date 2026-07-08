// Consentement RGPD pour les traceurs publicitaires (Meta Pixel).
// Stocké côté navigateur ; un évènement custom permet aux composants (pixel,
// bandeau) de réagir en direct au choix de l'utilisateur, sans rechargement.

export const CONSENT_KEY = "klip-consent";
export const CONSENT_EVENT = "klip-consent-change";

export type ConsentValue = "granted" | "denied";

export function readConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: ConsentValue) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // stockage indisponible (mode privé strict) : on notifie quand même la session
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<ConsentValue>(CONSENT_EVENT, { detail: value }));
  }
}
