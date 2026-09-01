import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { stripe, planFromPriceId, accountTypeForPlan, planKeyForPlan } from "@/lib/stripe";
import { upsertUserSettings } from "@/lib/user-settings";
import { PLANS, planKeyFromStripePlan, planValueEur } from "@/lib/plans";
import { sendStartTrialEvent } from "@/lib/meta-capi";

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
export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ active: false, error: "STRIPE_OFF" }, { status: 200 });

  /* Consentement publicitaire, tel que le navigateur vient de le lire. La
     Conversions API envoie les mêmes données personnelles que le pixel : sans
     ce drapeau on ne lui envoie rien, sinon on suivrait côté serveur quelqu'un
     qui a refusé le bandeau. */
  let trackingConsent = false;
  try {
    const body = await req.json();
    trackingConsent = body?.trackingConsent === true;
  } catch { /* appel sans corps : pas de consentement signalé */ }

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

    const item = sub.items.data[0];
    const pp = planFromPriceId(item?.price?.id);
    const internal = internalStatus(sub.status);

    /* Montant réellement souscrit, pour l'événement StartTrial du pixel Meta
       (voir app/checkout-success). On lit le prix Stripe plutôt que la grille
       affichée : c'est ce qui sera débité à la fin de l'essai, et les deux
       peuvent diverger le temps d'un changement de tarif. La remise de
       lancement n'entre pas dedans (`unit_amount` est le prix catalogue), ce
       qui est voulu : on annonce la valeur de l'abonnement, pas celle de la
       première facture. */
    const unit = item?.price?.unit_amount;
    const depuisStripe = typeof unit === "number" ? (unit * (item?.quantity ?? 1)) / 100 : null;
    const currency = (item?.price?.currency ?? "eur").toUpperCase();

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
    if (pp?.plan) {
      // current_plan porte l'OFFRE (starter distinct de studio), account_type
      // la STRUCTURE du compte.
      us.current_plan = planKeyForPlan(pp.plan);
      us.account_type = accountTypeForPlan(pp.plan);
    }
    await upsertUserSettings(admin, us);

    /* ── Conversion Meta « StartTrial » côté serveur ─────────────────────
       Un essai vient d'être créé : c'est LA conversion de la campagne. Elle
       part d'ici en plus du pixel navigateur (voir app/checkout-success), avec
       un id dérivé de l'abonnement — le même des deux côtés, et stable si
       cette route est rappelée : Meta ne comptera qu'un essai. */
    const eventId = `starttrial_${sub.id}`;
    const key = planKeyFromStripePlan(pp?.plan);

    /* Le montant annoncé à Meta est celui de la FIN d'essai, jamais celui du
       jour même : pendant les 7 jours la facture vaut 0 €, et Meta rejette un
       `value` à zéro. On garde le prix Stripe quand il est exploitable — c'est
       le montant réellement débité, et il reste juste le temps d'un changement
       de tarif où la grille et Stripe divergent — et on retombe sinon sur la
       grille, source unique de vérité. Le `?? 0` d'avant envoyait 0 dès que
       `unit_amount` manquait (prix par paliers, objet non déplié) : c'était
       l'origine des événements refusés. */
    const value = depuisStripe && depuisStripe > 0
      ? depuisStripe
      : planValueEur(key, pp?.period === "yearly" ? "yearly" : "monthly");
    if (!depuisStripe || depuisStripe <= 0) {
      console.error(
        `[stripe/sync] unit_amount inexploitable (${JSON.stringify(unit)}) sur ${sub.id} : ` +
        `repli sur la grille, value=${value} € pour ${key}/${pp?.period ?? "monthly"}.`,
      );
    }

    if (sub.status === "trialing" && trackingConsent) {
      await sendStartTrialEvent({
        eventId,
        email: session.user.email ?? undefined,
        userId,
        value,
        currency: "EUR",
        planLabel: PLANS[key].label,
        contentId: `${key}:${pp?.period ?? "monthly"}`,
        period: pp?.period ?? "monthly",
        eventSourceUrl: req.headers.get("referer") || undefined,
        clientIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
        fbp: req.cookies.get("_fbp")?.value,
        fbc: req.cookies.get("_fbc")?.value,
      });
    }

    return NextResponse.json({
      eventId,
      active: internal === "active",
      status: sub.status,
      subscriptionId: sub.id,
      plan: pp?.plan ?? null,
      period: pp?.period ?? null,
      // Le navigateur reçoit la valeur RÉSOLUE, jamais null : sans quoi il
      // referait le même calcul de repli, ou pire enverrait 0 de son côté.
      value,
      currency: "EUR",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/sync]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
