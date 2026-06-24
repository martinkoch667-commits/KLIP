import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { stripe, planFromPriceId, accountTypeForPlan } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function internalStatus(s: string): "active" | "past_due" | "expired" | "canceled" {
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due" || s === "incomplete") return "past_due";
  if (s === "canceled") return "canceled";
  return "expired";
}

/* Synchronise l'abonnement Stripe de l'utilisateur connecté vers la DB.
   Appelé juste après le retour du Checkout pour éviter d'attendre le webhook. */
export async function POST() {
  if (!stripe) return NextResponse.json({ active: false, error: "STRIPE_OFF" }, { status: 200 });

  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { data: settings } = await supabase
    .from("user_settings")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const customerId = settings?.stripe_customer_id as string | undefined;
  if (!customerId) return NextResponse.json({ active: false });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = serviceKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : supabase;

  try {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
    const sub = subs.data[0];
    if (!sub) return NextResponse.json({ active: false });

    const pp = planFromPriceId(sub.items.data[0]?.price?.id);
    const internal = internalStatus(sub.status);

    await admin.from("subscriptions").upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      plan: pp?.plan ?? null,
      billing_period: pp?.period ?? null,
      status: sub.status,
      current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "stripe_subscription_id" });

    const us: Record<string, unknown> = { user_id: userId, subscription_status: internal, stripe_subscription_id: sub.id, stripe_customer_id: customerId };
    if (pp?.plan) { us.current_plan = accountTypeForPlan(pp.plan); us.account_type = accountTypeForPlan(pp.plan); }
    await admin.from("user_settings").upsert(us, { onConflict: "user_id" });

    return NextResponse.json({ active: internal === "active", status: sub.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/sync]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
