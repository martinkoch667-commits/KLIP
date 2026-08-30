/* lib/plans.ts : configuration centrale des offres KLIP (source de vérité).
   account_type en base : 'solo' = offre Studio, 'agency' = offre Agence.

   LES PRIX AFFICHÉS SE LISENT ICI, NULLE PART AILLEURS. Ils étaient recopiés à
   la main sur la landing, sur l'écran d'offre et dans la facturation, et les
   trois avaient fini par diverger : Studio annoncé à 35 € avant l'inscription
   et à 29 € trois minutes plus tard. Toute nouvelle grille se change ici.

   Ce qui débite réellement, ce sont les Price ID Stripe (voir lib/stripe.ts) :
   ces montants ne sont que l'affichage, ils doivent être tenus d'accord avec
   Stripe à la main.

   L'annuel, c'est deux mois offerts : le tarif mensuel × 10 ÷ 12. Studio à
   39 € tombe juste (32,50 × 12 = 390 = dix mois pile). Starter arrondit au
   centime inférieur, jamais au-dessus du montant débité.

   ATTENTION — Starter n'est PAS encore branché sur le paiement : il n'a ni
   Price ID Stripe ni type de compte en base. La grille l'affiche, le bouton
   « Essai » retombera sur « le paiement arrive bientôt » tant que
   STRIPE_PRICE_STARTER_* n'existe pas. */

/* Ce que la base connaît. Elle ne stocke que deux types de compte, et ça ne
   bouge pas ici : Starter est une offre d'entrée sur le même compte que
   Studio, avec un seul client autorisé. */
export type AccountType = "solo" | "agency";

/* Ce que la grille affiche. Trois offres, dont une (starter) qui n'a pas de
   type de compte à elle. */
export type PlanKey = "starter" | "solo" | "agency";

export type PlanConfig = {
  key: PlanKey;
  label: string;            // nom affiché de l'offre
  priceMonthly: number;     // €/mois, à l'engagement mensuel
  priceYearly: number;      // €/mois équivalent, à l'engagement annuel
  maxClients: number;       // nombre de comptes clients (workspaces)
  maxMembers: number;       // membres d'équipe (l'owner compris)
  features: {
    validation: boolean;    // workflow de validation client (les deux offres)
    roles: boolean;         // rôles Manager / Créa
    batch: boolean;         // création en lot
  };
};

export const PLANS: Record<PlanKey, PlanConfig> = {
  starter: {
    key: "starter",
    label: "Starter",
    priceMonthly: 14.99,
    priceYearly: 12.49,
    maxClients: 1,
    maxMembers: 1,
    features: { validation: true, roles: false, batch: false },
  },
  solo: {
    key: "solo",
    label: "Studio",
    priceMonthly: 39,
    priceYearly: 32.50,
    maxClients: 6,
    maxMembers: 1,
    features: { validation: true, roles: false, batch: false },
  },
  agency: {
    key: "agency",
    label: "Agence",
    priceMonthly: 96,
    priceYearly: 80,
    maxClients: 12,
    maxMembers: 5,
    features: { validation: true, roles: true, batch: true },
  },
};

export const TRIAL_DAYS = 7;

/* ── Lire l'offre d'un compte ───────────────────────────────────────────────
   Deux colonnes, deux notions, et il faut les garder distinctes :

   · account_type  = la STRUCTURE du compte (solo / agency). Elle décide des
                     membres d'équipe, des rôles, de la création en lot.
   · current_plan  = l'OFFRE souscrite (starter / solo / agency). Elle porte le
                     prix et la limite de clients.

   Starter est un compte solo qui n'a droit qu'à un client. Lire account_type
   seul lui donnerait les six clients de Studio pour 14,99 € : tout ce qui
   compte des clients doit passer par getPlanFor, jamais par getPlan seul. */

type SettingsLike = { account_type?: string | null; current_plan?: string | null } | null | undefined;

export function planKeyFrom(settings: SettingsLike): PlanKey {
  const p = settings?.current_plan;
  if (p === "starter" || p === "solo" || p === "agency") return p;
  // Comptes d'avant l'offre Starter, ou base pas encore migrée (027) :
  // current_plan est nul ou invalide, on retombe sur la structure du compte.
  return settings?.account_type === "agency" ? "agency" : "solo";
}

/** L'offre réellement souscrite. C'est CELLE-CI qu'il faut pour tout bridage. */
export function getPlanFor(settings: SettingsLike): PlanConfig {
  return PLANS[planKeyFrom(settings)];
}

/** Convertit le paramètre d'URL (?plan=studio|agency|solo) en account_type. */
export function planFromParam(p?: string | null): AccountType {
  return p === "agency" ? "agency" : "solo"; // "studio" et défaut → solo
}

/** Offre déduite du seul type de compte. Ne distingue PAS Starter de Studio :
    pour un bridage, utiliser getPlanFor, qui lit aussi current_plan. */
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

/* ── Valeur d'une offre pour les conversions publicitaires ──────────────────
   Meta veut un montant sur InitiateCheckout / StartTrial, et ce montant est
   celui qui sera réellement facturé à la fin de l'essai : la somme engagée sur
   la période choisie, pas le prix mensuel affiché. L'annuel s'affiche en
   équivalent par mois, il se compte donc × 12.

   La remise de lancement n'entre pas dans ce calcul : on annonce à Meta la
   valeur de l'abonnement, pas celle de la première facture, sinon la valeur
   d'une conversion changerait le jour où le coupon s'éteint. */
export function planValueEur(plan: PlanKey, period: "monthly" | "yearly"): number {
  const p = PLANS[plan];
  return period === "yearly" ? Math.round(p.priceYearly * 12 * 100) / 100 : p.priceMonthly;
}

/* Nom d'offre côté Stripe ("starter" | "studio" | "agence") → clé d'offre
   interne. Même correspondance que `planKeyForPlan` dans lib/stripe.ts, qui
   délègue ici : lib/stripe.ts charge le SDK Stripe et ne peut pas être importé
   depuis le navigateur, alors que ce fichier le peut. */
export function planKeyFromStripePlan(plan?: string | null): PlanKey {
  if (plan === "starter") return "starter";
  return plan === "agence" ? "agency" : "solo";
}
