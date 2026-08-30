import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { stripe, planFromPriceId, accountTypeForPlan, planKeyForPlan } from "@/lib/stripe";
import { upsertUserSettings } from "@/lib/user-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/* statut Stripe → statut interne autorisé par user_settings (garde-fou middleware) */
function internalStatus(s: string): "active" | "past_due" | "expired" | "canceled" {
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due" || s === "incomplete") return "past_due";
  if (s === "canceled") return "canceled";
  return "expired"; // unpaid, incomplete_expired…
}

/* Upsert l'abonnement dans `subscriptions` + reflète l'état dans user_settings. */
async function syncSubscription(db: SupabaseClient, sub: Stripe.Subscription, userIdHint?: string | null) {
  const userId = userIdHint ?? (sub.metadata?.user_id as string | undefined) ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const pp = planFromPriceId(sub.items.data[0]?.price?.id);
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

  // Sans user_id on retombe sur la ligne existante via stripe_subscription_id
  const resolvedUserId = userId ?? (await userIdFromSubId(db, sub.id)) ?? (await userIdFromCustomer(db, customerId));

  await db.from("subscriptions").upsert(
    {
      user_id: resolvedUserId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      plan: pp?.plan ?? null,
      billing_period: pp?.period ?? null,
      status: sub.status,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );

  if (resolvedUserId) {
    const us: Record<string, unknown> = {
      user_id: resolvedUserId,
      subscription_status: internalStatus(sub.status),
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
    };
    if (pp?.plan) {
      // current_plan porte l'OFFRE (starter distinct de studio), account_type
      // la STRUCTURE du compte. Confondre les deux donnait à un abonné Starter
      // les six clients de Studio.
      us.current_plan = planKeyForPlan(pp.plan);
      us.account_type = accountTypeForPlan(pp.plan);
    }
    await upsertUserSettings(db, us);
  }
}

async function userIdFromSubId(db: SupabaseClient, subId: string): Promise<string | null> {
  const { data } = await db.from("subscriptions").select("user_id").eq("stripe_subscription_id", subId).maybeSingle();
  return (data?.user_id as string) ?? null;
}
async function userIdFromCustomer(db: SupabaseClient, customerId: string): Promise<string | null> {
  const { data } = await db.from("user_settings").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  return (data?.user_id as string) ?? null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  }

  // Signature vérifiée sur le RAW body
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
        const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(db, sub, s.metadata?.user_id ?? null);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(db, sub);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
        const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        if (subId) {
          await db.from("subscriptions").update({ status: "past_due", updated_at: new Date().toISOString() }).eq("stripe_subscription_id", subId);
          const uid = (await userIdFromSubId(db, subId)) ?? (customerId ? await userIdFromCustomer(db, customerId) : null);
          if (uid) await db.from("user_settings").update({ subscription_status: "past_due" }).eq("user_id", uid);
        }
        console.warn("[stripe/webhook] payment_failed", subId);
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
