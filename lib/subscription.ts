import { createClient } from "@supabase/supabase-js";

/* À utiliser UNIQUEMENT côté serveur (utilise la clé service_role). */

export type ActiveSubscription = {
  plan: string | null;
  billing_period: string | null;
  status: string;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
};

/**
 * Retourne l'abonnement actif de l'utilisateur (status 'active' ou 'trialing'),
 * sinon null. Sert à protéger l'accès aux fonctionnalités après la fin de l'essai.
 */
export async function getActiveSubscription(userId: string): Promise<ActiveSubscription | null> {
  if (!userId) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, billing_period, status, current_period_end, stripe_subscription_id")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getActiveSubscription]", error.message);
    return null;
  }
  return (data as ActiveSubscription) ?? null;
}

/** Raccourci booléen : l'utilisateur a-t-il un accès payant/essai actif ? */
export async function hasActiveAccess(userId: string): Promise<boolean> {
  return (await getActiveSubscription(userId)) !== null;
}
