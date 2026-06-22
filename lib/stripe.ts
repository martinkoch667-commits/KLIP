import Stripe from "stripe";

/* Client Stripe côté serveur — null tant que la clé n'est pas configurée. */
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/* Domaine de prod (override possible via env). */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getklip.fr";

export type Plan = "studio" | "agence";
export type Period = "monthly" | "yearly";

/* Mappe (offre + période) → Price ID Stripe (variables d'env Vercel). */
export function priceId(plan: Plan, period: Period): string | null {
  const map: Record<string, string | undefined> = {
    "studio:monthly": process.env.STRIPE_PRICE_STUDIO_MONTHLY,
    "studio:yearly": process.env.STRIPE_PRICE_STUDIO_YEARLY,
    "agence:monthly": process.env.STRIPE_PRICE_AGENCE_MONTHLY,
    "agence:yearly": process.env.STRIPE_PRICE_AGENCE_YEARLY,
  };
  return map[`${plan}:${period}`] ?? null;
}

/* Price ID → (offre + période), pour le webhook. */
export function planFromPriceId(id?: string | null): { plan: Plan; period: Period } | null {
  if (!id) return null;
  if (id === process.env.STRIPE_PRICE_STUDIO_MONTHLY) return { plan: "studio", period: "monthly" };
  if (id === process.env.STRIPE_PRICE_STUDIO_YEARLY) return { plan: "studio", period: "yearly" };
  if (id === process.env.STRIPE_PRICE_AGENCE_MONTHLY) return { plan: "agence", period: "monthly" };
  if (id === process.env.STRIPE_PRICE_AGENCE_YEARLY) return { plan: "agence", period: "yearly" };
  return null;
}

/* offre Stripe → account_type interne (user_settings : 'solo' = Studio, 'agency' = Agence). */
export function accountTypeForPlan(plan?: string | null): "solo" | "agency" {
  return plan === "agence" ? "agency" : "solo";
}
