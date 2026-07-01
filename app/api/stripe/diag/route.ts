import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

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

  return NextResponse.json({
    ...base,
    prices,
    conseil: base.secretKey === 'LIVE'
      ? "Tes clés sont en mode LIVE -> la carte de test 4242 est REFUSÉE. Utilise une vraie carte (0€ grâce à l'essai), ou bascule en clés TEST (sk_test_/pk_test_) pour tester avec 4242."
      : base.secretKey === 'TEST'
        ? "Clés en TEST -> utilise 4242 4242 4242 4242. Si un prix affiche ok:false, c'est que ce Price ID vient du mode LIVE (mélange) -> reprends les price_ du mode Test."
        : "Clé secrète absente ou invalide dans Vercel.",
  });
}
