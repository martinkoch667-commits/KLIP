import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { stripe, APP_URL } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!stripe) {
    return NextResponse.json({ error: "Le paiement n'est pas encore activé.", code: "STRIPE_OFF" }, { status: 503 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: settings } = await supabase
    .from("user_settings")
    .select("stripe_customer_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const customerId = settings?.stripe_customer_id as string | undefined;
  if (!customerId) {
    return NextResponse.json({ error: "Aucun abonnement à gérer." }, { status: 400 });
  }

  // Le portail Stripe n'affiche « Annuler l'abonnement » que si la configuration
  // du portail l'autorise — et ce n'est PAS le cas par défaut. On pilote donc la
  // configuration depuis le code plutôt que de dépendre du réglage du Dashboard.
  const configuration = await portalConfigurationId();

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/settings`,
    ...(configuration ? { configuration } : {}),
  });
  return NextResponse.json({ url: portal.url });
}

/* Configuration du portail : résiliation en fin de période, moyens de paiement,
   factures. Créée une seule fois puis retrouvée par ses métadonnées. */
const CONFIG_TAG = "klip-portal-v1";

async function portalConfigurationId(): Promise<string | null> {
  if (!stripe) return null;
  try {
    const existing = await stripe.billingPortal.configurations.list({ limit: 100, active: true });
    const found = existing.data.find(c => c.metadata?.klip === CONFIG_TAG);
    if (found) return found.id;

    const created = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: "Klip — gérez votre abonnement",
        privacy_policy_url: `${APP_URL}/privacy`,
        terms_of_service_url: `${APP_URL}/mentions-legales`,
      },
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        customer_update: { enabled: true, allowed_updates: ["email", "address", "name"] },
        subscription_cancel: {
          enabled: true,
          // L'accès reste ouvert jusqu'à la fin de la période déjà payée.
          mode: "at_period_end",
          cancellation_reason: {
            enabled: true,
            options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
          },
        },
      },
      metadata: { klip: CONFIG_TAG },
    });
    return created.id;
  } catch (err) {
    // Si la création échoue (droits, profil incomplet), on retombe sur la
    // configuration par défaut du compte plutôt que de bloquer l'accès au portail.
    console.error("[stripe/portal] configuration:", err);
    return null;
  }
}
