import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { stripe, planForPriceId, mapStripeStatus } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/webhook] signature invalide:", msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  const db = admin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.metadata?.user_id;
        const plan = s.metadata?.plan === "agency" ? "agency" : "solo";
        if (userId) {
          await db.from("user_settings").upsert({
            user_id: userId,
            account_type: plan,
            current_plan: plan,
            subscription_status: "active",
            stripe_customer_id: typeof s.customer === "string" ? s.customer : s.customer?.id,
            stripe_subscription_id: typeof s.subscription === "string" ? s.subscription : s.subscription?.id,
          }, { onConflict: "user_id" });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const priceId = sub.items.data[0]?.price?.id;
        const plan = planForPriceId(priceId);
        const status = event.type === "customer.subscription.deleted"
          ? "canceled"
          : mapStripeStatus(sub.status);

        const update: Record<string, unknown> = {
          subscription_status: status,
          stripe_subscription_id: sub.id,
        };
        if (plan) { update.account_type = plan; update.current_plan = plan; }

        await db.from("user_settings").update(update).eq("stripe_customer_id", customerId);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/webhook] handler error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
