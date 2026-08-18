import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { LAUNCH_OFFER } from '@/lib/launch-offer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/stripe/diag?secret=CRON_SECRET
// Diagnostique la config Stripe : mode des clés (test/live), présence du webhook,
// et vérifie chaque Price ID avec la clé actuelle (révèle un mélange test/live).
export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé — ajoute ?secret=TON_CRON_SECRET' }, { status: 401 });
  }

  const mode = (v?: string) => !v ? 'MANQUANTE' : v.startsWith('sk_live') || v.startsWith('pk_live') ? 'LIVE' : v.startsWith('sk_test') || v.startsWith('pk_test') ? 'TEST' : 'INCONNU';

  const base = {
    secretKey: mode(process.env.STRIPE_SECRET_KEY),
    publishableKey: mode(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    webhookSecretSet: !!process.env.STRIPE_WEBHOOK_SECRET,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '(non défini)',
  };

  const priceIds: Record<string, string | undefined> = {
    STRIPE_PRICE_STUDIO_MONTHLY: process.env.STRIPE_PRICE_STUDIO_MONTHLY,
    STRIPE_PRICE_STUDIO_YEARLY: process.env.STRIPE_PRICE_STUDIO_YEARLY,
    STRIPE_PRICE_AGENCE_MONTHLY: process.env.STRIPE_PRICE_AGENCE_MONTHLY,
    STRIPE_PRICE_AGENCE_YEARLY: process.env.STRIPE_PRICE_AGENCE_YEARLY,
  };

  // Vérifie chaque prix avec la clé actuelle -> si erreur, c'est un mélange test/live.
  const prices: Record<string, unknown> = {};
  for (const [name, id] of Object.entries(priceIds)) {
    if (!id) { prices[name] = 'MANQUANT'; continue; }
    if (!stripe) { prices[name] = 'clé secrète absente'; continue; }
    try {
      const p = await stripe.prices.retrieve(id);
      prices[name] = { ok: true, livemode: p.livemode, montant: (p.unit_amount ?? 0) / 100 + (p.currency ?? '') };
    } catch (e) {
      prices[name] = { ok: false, erreur: e instanceof Error ? e.message : String(e) };
    }
  }

  // ── Offre de lancement ────────────────────────────────────────────────
  // Le coupon débite ; la landing ne fait qu'afficher. Le moindre écart entre
  // les deux se voit ici plutôt qu'au premier prélèvement.
  const couponId = process.env.STRIPE_LAUNCH_COUPON?.trim();
  let coupon: unknown;
  if (!LAUNCH_OFFER.active) {
    coupon = "offre inactive dans le code (LAUNCH_OFFER.active = false)";
  } else if (!couponId) {
    coupon = "STRIPE_LAUNCH_COUPON MANQUANTE -> la landing annonce une remise que la caisse n'applique PAS.";
  } else if (!stripe) {
    coupon = 'clé secrète absente';
  } else {
    try {
      const c = await stripe.coupons.retrieve(couponId);
      const ecarts: string[] = [];
      if (c.percent_off !== LAUNCH_OFFER.percent) {
        ecarts.push(`le coupon retire ${c.percent_off} % mais la landing annonce ${LAUNCH_OFFER.percent} % -> le client voit un prix et en paie un autre.`);
      }
      if (c.max_redemptions) {
        ecarts.push(`max_redemptions=${c.max_redemptions} -> une fois atteint, la caisse renverra une erreur au lieu de repasser au plein tarif. Recrée le coupon sans limite.`);
      }
      if (!c.valid) ecarts.push('coupon invalide (expiré ou épuisé) -> aucune remise ne sera appliquée.');
      const restantes = Math.max(0, LAUNCH_OFFER.seats - (c.times_redeemed ?? 0));
      coupon = {
        ok: ecarts.length === 0,
        id: c.id,
        livemode: c.livemode,
        percent_off: c.percent_off,
        duration: c.duration,
        times_redeemed: c.times_redeemed,
        max_redemptions: c.max_redemptions ?? null,
        placesAnnoncees: LAUNCH_OFFER.seats,
        placesRestantes: restantes,
        offreOuverte: restantes > 0,
        ecarts,
      };
    } catch (e) {
      coupon = { ok: false, erreur: e instanceof Error ? e.message : String(e), indice: "ID introuvable avec cette clé : coupon créé dans l'autre mode (test/live) ?" };
    }
  }

  return NextResponse.json({
    ...base,
    prices,
    coupon,
    conseil: base.secretKey === 'LIVE'
      ? "Tes clés sont en mode LIVE -> la carte de test 4242 est REFUSÉE. Utilise une vraie carte (0€ grâce à l'essai), ou bascule en clés TEST (sk_test_/pk_test_) pour tester avec 4242."
      : base.secretKey === 'TEST'
        ? "Clés en TEST -> utilise 4242 4242 4242 4242. Si un prix affiche ok:false, c'est que ce Price ID vient du mode LIVE (mélange) -> reprends les price_ du mode Test."
        : "Clé secrète absente ou invalide dans Vercel.",
  });
}
