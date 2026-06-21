import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { stripe, priceIdForPlan, APP_URL } from "@/lib/stripe";
import { planFromParam } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Le paiement n'est pas encore activé.", code: "STRIPE_OFF" }, { status: 503 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const email = session.user.email ?? undefined;

  let body: { plan?: string } = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const plan = planFromParam(body.plan);
  const priceId = priceIdForPlan(plan);
  if (!priceId) {
    return NextResponse.json({ error: "Offre non configurée côté paiement.", code: "STRIPE_OFF" }, { status: 503 });
  }

  // Récupère/crée le client Stripe, réutilise celui déjà stocké si présent.
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

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${APP_URL}/dashboard?checkout=success`,
      cancel_url: `${APP_URL}/abonnement?checkout=cancel`,
      metadata: { user_id: userId, plan },
      subscription_data: { metadata: { user_id: userId, plan } },
    });
    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
