/* lib/plans.ts — configuration centrale des offres KLIP (source de vérité).
   account_type en base : 'solo' = offre Studio · 'agency' = offre Agence. */

export type AccountType = "solo" | "agency";

export type PlanConfig = {
  key: AccountType;
  label: string;            // nom affiché de l'offre
  priceMonthly: number;     // €/mois
  maxClients: number;       // nombre de comptes clients (workspaces)
  maxMembers: number;       // membres d'équipe (l'owner compris)
  features: {
    validation: boolean;    // workflow de validation client
    roles: boolean;         // rôles Manager / Créa
    batch: boolean;         // création en lot
  };
};

export const PLANS: Record<AccountType, PlanConfig> = {
  solo: {
    key: "solo",
    label: "Studio",
    priceMonthly: 29,
    maxClients: 3,
    maxMembers: 1,
    features: { validation: false, roles: false, batch: false },
  },
  agency: {
    key: "agency",
    label: "Agence",
    priceMonthly: 96,
    maxClients: 10,
    maxMembers: 5,
    features: { validation: true, roles: true, batch: true },
  },
};

export const TRIAL_DAYS = 7;

/** Convertit le paramètre d'URL (?plan=studio|agency|solo) en account_type. */
export function planFromParam(p?: string | null): AccountType {
  return p === "agency" ? "agency" : "solo"; // "studio" et défaut → solo
}

export function getPlan(accountType?: string | null): PlanConfig {
  return accountType === "agency" ? PLANS.agency : PLANS.solo;
}

/** Statut d'abonnement stocké dans user_settings.subscription_status. */
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "expired" | "canceled";

/** True si l'accès à l'app doit être bloqué (essai terminé et pas d'abonnement actif). */
export function isAccessBlocked(s: {
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  is_comped?: boolean | null;
} | null | undefined): boolean {
  if (!s) return false; // pas encore onboardé → on laisse passer (l'onboarding gère)
  if (s.is_comped) return false; // accès offert à vie → jamais bloqué, jamais débité
  // Modèle B : accès UNIQUEMENT avec un abonnement Stripe actif/en essai.
  // Le webhook (et /api/stripe/sync) mappent trialing+active Stripe → 'active' ici.
  if (s.subscription_status === "active") return false;
  // Tout le reste (trialing par défaut sans Stripe, expired, canceled, past_due, null) → bloqué.
  return true;
}
