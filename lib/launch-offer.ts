// Offre de lancement — remise sur la PREMIÈRE facture mensuelle, réservée aux
// premiers inscrits. Un seul endroit décide : la landing (prix barré) et la
// route Checkout (remise réellement appliquée) lisent la même constante, pour
// que le prix affiché soit toujours le prix débité.
//
// Côté Stripe il faut un coupon `percent_off: 40, duration: once` et son id dans
// STRIPE_LAUNCH_COUPON. Sans cette variable, la remise n'est PAS appliquée au
// paiement : `LAUNCH_OFFER.active` doit alors rester false, sinon la landing
// annoncerait un prix que la caisse ne fait pas.
export const LAUNCH_OFFER = {
  active: true,
  /** Pourcentage de remise (doit refléter le coupon Stripe). */
  percent: 40,
  /** Nombre de places annoncé. */
  seats: 50,
  /** La remise ne vaut que pour le mensuel : sur l'annuel, `duration: once`
   *  offrirait 40 % d'une année entière. */
  periods: ['monthly'] as const,
};

export function launchApplies(period: string): boolean {
  return LAUNCH_OFFER.active && (LAUNCH_OFFER.periods as readonly string[]).includes(period);
}

/** Prix remisé, arrondi au centime (jamais au-dessus du montant débité). */
export function launchPrice(price: number): number {
  return Math.round(price * (1 - LAUNCH_OFFER.percent / 100) * 100) / 100;
}

/** 21 → « 21 », 57.6 → « 57,60 » (séparateur laissé au formatage local). */
export function formatPrice(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}
