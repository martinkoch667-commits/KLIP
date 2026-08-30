import Stripe from "stripe";

/* Client Stripe côté serveur — null tant que la clé n'est pas configurée. */
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/* Domaine de prod (override possible via env).
   On normalise : Stripe exige une URL absolue avec schéma (https://). Si la
   variable d'env est renseignée sans "https://" (ex. "getklip.fr"), on l'ajoute,
   et on retire un éventuel slash final. */
function normalizeAppUrl(raw?: string | null): string {
  const fallback = "https://getklip.fr";
  const v = (raw ?? "").trim();
  if (!v) return fallback;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  return withScheme.replace(/\/+$/, "");
}

export const APP_URL = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);

export type Plan = "starter" | "studio" | "agence";
export type Period = "monthly" | "yearly";

/* Mappe (offre + période) → Price ID Stripe (variables d'env Vercel). */
export function priceId(plan: Plan, period: Period): string | null {
  const map: Record<string, string | undefined> = {
    // Starter : les variables n'existent pas encore côté Vercel. priceId rend
    // donc null, et la route Checkout répond STRIPE_OFF plutôt que de lancer
    // un paiement sur un prix inventé.
    "starter:monthly": process.env.STRIPE_PRICE_STARTER_MONTHLY,
    "starter:yearly": process.env.STRIPE_PRICE_STARTER_YEARLY,
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
  if (id === process.env.STRIPE_PRICE_STARTER_MONTHLY) return { plan: "starter", period: "monthly" };
  if (id === process.env.STRIPE_PRICE_STARTER_YEARLY) return { plan: "starter", period: "yearly" };
  if (id === process.env.STRIPE_PRICE_STUDIO_MONTHLY) return { plan: "studio", period: "monthly" };
  if (id === process.env.STRIPE_PRICE_STUDIO_YEARLY) return { plan: "studio", period: "yearly" };
  if (id === process.env.STRIPE_PRICE_AGENCE_MONTHLY) return { plan: "agence", period: "monthly" };
  if (id === process.env.STRIPE_PRICE_AGENCE_YEARLY) return { plan: "agence", period: "yearly" };
  return null;
}

/* offre Stripe → account_type interne (user_settings : 'solo' = Studio, 'agency' = Agence).
   Starter n'a pas de type à lui : c'est un compte solo dont la limite de
   clients est plus basse. Cette limite se lit dans current_plan, pas ici —
   voir planKeyForPlan juste en dessous, et getPlanFor dans lib/plans.ts. */
export function accountTypeForPlan(plan?: string | null): "solo" | "agency" {
  return plan === "agence" ? "agency" : "solo";
}

/* offre Stripe → clé d'offre interne (user_settings.current_plan).
   C'est elle qui distingue Starter de Studio, et donc 1 client de 6.
   La correspondance vit dans lib/plans.ts, qui est lisible depuis le
   navigateur (le pixel Meta en a besoin) : ici on ne fait que la relayer, pour
   qu'il n'y ait pas deux tables à tenir d'accord. */
export { planKeyFromStripePlan as planKeyForPlan } from "@/lib/plans";
