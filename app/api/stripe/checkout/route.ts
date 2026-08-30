import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { stripe, priceId, APP_URL, type Plan, type Period } from "@/lib/stripe";
import { launchApplies } from "@/lib/launch-offer";
import { launchSeatsOpen, forgetLaunchSeats } from "@/lib/launch-seats";
import { PLANS, planKeyFromStripePlan, planValueEur } from "@/lib/plans";
import { sendInitiateCheckoutEvent } from "@/lib/meta-capi";

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
  let body: { plan?: string; period?: string; cancelPath?: string; eventId?: string } = {};
  try { body = await req.json(); } catch { /* defaults */ }
  /* Les trois offres de la grille, Starter compris. Le raccourci d'avant
     (« agence, sinon studio ») transformait silencieusement un Starter en
     Studio : la personne cliquait sur 14,99 € et arrivait sur la caisse à 39 €.
     Une offre inconnue retombe sur Studio, l'offre par défaut. */
  const plan = (body.plan === "agence" || body.plan === "starter" ? body.plan : "studio") as Plan;
  const period = (body.period === "yearly" ? "yearly" : "monthly") as Period;

  // Retour en cas d'abandon : la page d'où l'on vient, sinon les tarifs de la
  // landing. Filtré comme le `next` de /auth/callback, un chemin relatif
  // uniquement, sans quoi on offrirait une redirection ouverte à qui appelle
  // cette route.
  const rawCancel = typeof body.cancelPath === "string" ? body.cancelPath : "";
  const cancelPath = rawCancel.startsWith("/") && !rawCancel.startsWith("//") ? rawCancel : "/#tarifs";

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
    const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
    hadSubscriptionBefore = existing.data.length > 0;

    /* Un abonnement en cours interdit d'en ouvrir un second. Sans ce garde-fou,
       la même personne pouvait être débitée deux fois : c'est arrivé en test,
       une caisse aboutie puis une seconde rouverte 41 s plus tard par la clé
       `klip_pending_checkout` restée dans le navigateur. La clé est maintenant
       effacée à la réussite du paiement, mais la vraie protection est ici :
       elle vaut quelle que soit la façon dont la caisse est appelée.
       Changer d'offre passe par le portail Stripe, pas par une 2e caisse. */
    const enCours = existing.data.find(sub => sub.status === "active" || sub.status === "trialing");
    if (enCours) {
      return NextResponse.json({
        error: "Vous avez déjà un abonnement en cours. Gérez-le depuis votre espace Abonnement.",
        code: "ALREADY_SUBSCRIBED",
      }, { status: 409 });
    }
  } catch (err) {
    // Une panne de lecture ne doit pas empêcher un nouveau client de payer ;
    // elle est journalisée pour qu'un doublon reste explicable.
    console.error("[checkout] abonnements existants illisibles :", err instanceof Error ? err.message : err);
  }

  // ── Offre de lancement ─────────────────────────────────────────────────
  // Coupon Stripe (percent_off, duration: once) appliqué automatiquement quand
  // l'offre court sur cette période. Sans STRIPE_LAUNCH_COUPON en env, rien
  // n'est appliqué : on préviendra dans les logs plutôt que de débiter le plein
  // tarif après avoir affiché un prix barré.
  // Les places restantes se lisent au même endroit que sur la landing (compteur
  // partagé, cache de 60 s) : ce que le visiteur a vu est ce qu'il paiera.
  const launchOn = launchApplies(period) && (await launchSeatsOpen());
  const launchCoupon = launchOn ? process.env.STRIPE_LAUNCH_COUPON?.trim() : undefined;
  if (launchOn && !launchCoupon) {
    console.warn("[checkout] LAUNCH_OFFER active mais STRIPE_LAUNCH_COUPON absent : le prix barré de la landing ne sera PAS appliqué.");
  }

  /* ── Conversion Meta « InitiateCheckout » côté serveur ─────────────────
     Le pixel navigateur l'a déjà envoyée au clic ; celle-ci passe même si le
     pixel est bloqué. Le même `eventId` sur les deux permet à Meta de n'en
     compter qu'une. Pas d'eventId = consentement publicitaire refusé (ou
     pixel absent) : on n'envoie rien, la CAPI est soumise au même
     consentement que le pixel.
     Lancée AVANT la création de la session Stripe et attendue après : les
     deux appels réseau se recouvrent, le départ vers la caisse n'attend pas. */
  const capiKey = planKeyFromStripePlan(plan);
  const capi = body.eventId
    ? sendInitiateCheckoutEvent({
        eventId: body.eventId,
        email,
        userId,
        value: planValueEur(capiKey, period),
        currency: "EUR",
        planLabel: PLANS[capiKey].label,
        contentId: `${capiKey}:${period}`,
        period,
        eventSourceUrl: req.headers.get("referer") || undefined,
        clientIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
        fbp: req.cookies.get("_fbp")?.value,
        fbc: req.cookies.get("_fbc")?.value,
      })
    : null;

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
      // Offre de lancement : la remise annoncée sur la landing est appliquée
      // ici, sinon le prix affiché serait un mensonge. Stripe refuse
      // `discounts` et `allow_promotion_codes` ensemble — le coupon
      // automatique l'emporte, le champ code promo revient sans lui.
      ...(launchCoupon
        ? { discounts: [{ coupon: launchCoupon }] }
        : { allow_promotion_codes: true as const }),
      metadata: { user_id: userId, plan, period },
      success_url: `${APP_URL}/checkout-success`,
      cancel_url: `${APP_URL}${cancelPath}`,
    });
    if (launchCoupon) forgetLaunchSeats(); // la place vient d'être prise
    if (capi) await capi; // ne lève jamais : les erreurs sont loggées côté meta-capi
    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
