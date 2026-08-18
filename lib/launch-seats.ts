// Combien de places de lancement sont déjà prises — SERVEUR UNIQUEMENT (ce
// module importe le client Stripe ; ne l'importez jamais depuis un composant
// 'use client', qui doit se contenter de lib/launch-offer).
//
// La source de vérité est le coupon Stripe lui-même : `times_redeemed` compte
// les remises réellement accordées. Compter les abonnements en base donnerait
// un autre chiffre (essais sans paiement, comptes offerts), et c'est bien la
// remise qu'on rationne, pas les inscriptions.
//
// IMPORTANT : ne mettez PAS `max_redemptions` sur le coupon. Stripe refuserait
// alors le coupon épuisé et `checkout.sessions.create` lèverait une erreur —
// le client ne pourrait plus s'abonner du tout, au lieu de payer plein tarif.
// C'est ce compteur-ci qui ferme l'offre, des deux côtés à la fois.
import { stripe } from "@/lib/stripe";
import { LAUNCH_OFFER } from "@/lib/launch-offer";

const TTL_MS = 60_000;
let cache: { at: number; taken: number } | null = null;

/** Places déjà prises, ou null si Stripe n'a pas su répondre. */
export async function launchSeatsTaken(): Promise<number | null> {
  const couponId = process.env.STRIPE_LAUNCH_COUPON?.trim();
  if (!stripe || !couponId) return null;

  if (cache && Date.now() - cache.at < TTL_MS) return cache.taken;
  try {
    const coupon = await stripe.coupons.retrieve(couponId);
    const taken = coupon.times_redeemed ?? 0;
    cache = { at: Date.now(), taken };
    return taken;
  } catch (err) {
    console.error("[launch-seats] lecture du coupon impossible :", err instanceof Error ? err.message : err);
    // On garde la dernière valeur connue plutôt que de basculer l'offre sur un
    // hoquet réseau : la landing et la caisse resteront d'accord entre elles.
    return cache?.taken ?? null;
  }
}

/** Places restantes, ou null si le compte est inconnu (offre laissée ouverte). */
export async function launchSeatsLeft(): Promise<number | null> {
  const taken = await launchSeatsTaken();
  if (taken === null) return null;
  return Math.max(0, LAUNCH_OFFER.seats - taken);
}

/** L'offre court-elle encore ? Un compte inconnu la laisse ouverte : c'est le
 *  comportement d'avant ce compteur, et la caisse appliquera bien la remise. */
export async function launchSeatsOpen(): Promise<boolean> {
  const left = await launchSeatsLeft();
  return left === null || left > 0;
}

/** À appeler après une souscription pour que la prochaine lecture soit fraîche. */
export function forgetLaunchSeats(): void {
  cache = null;
}
