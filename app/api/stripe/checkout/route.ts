import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { stripe, priceId, APP_URL, type Plan, type Period } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Paiement non configuré.", code: "STRIPE_OFF" }, { status: 503 });
  }

  // ── Auth obligatoire ───────────────────────────────────────────────────
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const email = session.user.email ?? undefined;

  // ── Body : plan + period ──────────────────────────────────────────────
  let body: { plan?: string; period?: string } = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const plan = (body.plan === "agence" ? "agence" : "studio") as Plan;
  const period = (body.period === "yearly" ? "yearly" : "monthly") as Period;

  const price = priceId(plan, period);
  if (!price) {
    return NextResponse.json({ error: "Offre non configurée côté paiement.", code: "STRIPE_OFF" }, { status: 503 });
  }

  // ── Customer Stripe : réutilise/crée, stocke sur user_settings ─────────
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = serviceKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  const { data: settings } = await supabase
    .from("user_settings")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  let customerId = settings?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
    customerId = customer.id;
    if (admin) {
      await admin.from("user_settings").upsert(
        { user_id: userId, stripe_customer_id: customerId },
        { onConflict: "user_id" }
      );
    }
  }

  // ── Essai 7 jours UNE SEULE FOIS ───────────────────────────────────────
  // Si ce client a DÉJÀ eu un abonnement (même annulé/expiré), pas de nouvel essai.
  let hadSubscriptionBefore = false;
  try {
    const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
    hadSubscriptionBefore = existing.data.length > 0;
  } catch { /* en cas d'erreur on ne bloque pas la création */ }

  // ── Session Checkout (abonnement ; essai seulement à la 1re fois) ───────
  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      subscription_data: {
        // Essai uniquement pour un tout nouveau client (jamais d'abonnement auparavant).
        ...(hadSubscriptionBefore ? {} : { trial_period_days: 7 }),
        metadata: { user_id: userId, plan, period },
      },
      allow_promotion_codes: true,
      metadata: { user_id: userId, plan, period },
      success_url: `${APP_URL}/checkout-success`,
      cancel_url: `${APP_URL}/#tarifs`,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
