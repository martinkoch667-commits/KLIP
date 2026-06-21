import Stripe from "stripe";
import type { AccountType } from "./plans";

/* Client Stripe — null tant que la clé n'est pas configurée (mode "prêt à brancher"). */
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klip-swart.vercel.app";

/* Mapping offre interne (account_type) ↔ price_id Stripe (à définir en env). */
export function priceIdForPlan(plan: AccountType): string | null {
  if (plan === "agency") return process.env.STRIPE_PRICE_AGENCY ?? null;
  return process.env.STRIPE_PRICE_SOLO ?? null;
}

export function planForPriceId(priceId?: string | null): AccountType | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_AGENCY) return "agency";
  if (priceId === process.env.STRIPE_PRICE_SOLO) return "solo";
  return null;
}

/* Statut Stripe → statut interne (user_settings.subscription_status). */
export function mapStripeStatus(s: string): "active" | "past_due" | "expired" | "canceled" {
  switch (s) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "expired";
  }
}
