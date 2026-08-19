"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/plans";
import { PRICING_CSS, PlanCard, PeriodToggle } from "@/components/PricingUI";
import { LAUNCH_OFFER, launchApplies, launchPrice, formatPrice } from "@/lib/launch-offer";

/* Ecran de paiement. Meme habillage que l'ecran d'offre de l'inscription et que
   la section Tarifs de la landing : la personne doit reconnaitre ce qu'elle a
   deja vu deux fois avant de sortir sa carte. */

export default function AbonnementView({ seatsLeft }: { seatsLeft: number | null }) {
  const t = useTranslations('subscription');
  // Les baselines des offres vivent dans l'espace de l'onboarding : une seule
  // formulation pour les deux écrans, plutôt que deux à maintenir.
  const to = useTranslations('onboardingPlan');
  const tl = useTranslations('landing.pricing');
  const locale = useLocale();
  const fmt = (v: number) => formatPrice(v, locale);
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [chosen, setChosen] = useState<"solo" | "agency" | null>(null);
  // Mensuel par défaut, comme la landing. La période part telle quelle vers la
  // caisse : c'est elle qui choisit le Price ID Stripe.
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setEmail(session.user.email ?? null);
      // Récupère l'offre déjà choisie à l'inscription (onboarding) pour la pré-sélectionner.
      const { data } = await supabase
        .from("user_settings")
        .select("account_type")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data?.account_type === "agency" || data?.account_type === "solo") setChosen(data.account_type);
      // Période retenue à l'onboarding : on arrive pré-sélectionné plutôt que
      // de faire rechoisir, mais elle reste modifiable ici.
      try {
        const p = localStorage.getItem("klip_period");
        if (p === "yearly" || p === "monthly") setPeriod(p);
      } catch { /* navigation privée */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const [busy, setBusy] = useState<string | null>(null);

  async function choose(plan: "solo" | "agency") {
    setBusy(plan);
    try {
      // map account_type interne → offre Stripe (solo = Studio, agency = Agence)
      const stripePlan = plan === "agency" ? "agence" : "studio";
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: stripePlan, period, cancelPath: "/abonnement" }),
      });
      const json = await res.json();
      if (res.ok && json.url) {
        window.location.href = json.url; // redirection vers Stripe Checkout
        return;
      }
      if (json.code === "STRIPE_OFF") {
        alert(t('stripeOffAlert'));
      } else {
        alert(json.error || t('genericError'));
      }
    } catch {
      alert(t('genericError'));
    } finally {
      setBusy(null);
    }
  }

  // La caisse applique le coupon de lancement tant qu'il reste des places
  // (app/api/stripe/checkout). L'écran doit donc annoncer le même prix que
  // celui qui sera débité, sinon on affiche plein tarif juste avant de
  // prélever moins, et le client ne comprend plus rien à sa facture.
  const launched = launchApplies(period) && (seatsLeft === null || seatsLeft > 0);
  const yearly = period === "yearly";
  /** Prix mensuel affiché : l'annuel s'annonce en équivalent par mois. */
  const shownPrice = (p: typeof PLANS.solo) => (yearly ? p.priceYearly : p.priceMonthly);
  /* Sur l'annuel, `duration: once` porte sur la première facture, donc sur une
     année entière : on annonce la somme réellement débitée, puis le plein tarif
     des années suivantes. Même calcul que la landing. */
  const noteFor = (p: typeof PLANS.solo) => {
    const full = shownPrice(p);
    if (!launched) return yearly ? tl('billedYear', { total: fmt(p.priceYearly * 12) }) : tl('billedMonth');
    return yearly
      ? tl('launchNoteYear', {
          seats: LAUNCH_OFFER.seats,
          firstYear: fmt(launchPrice(p.priceYearly * 12)),
          full: fmt(p.priceYearly * 12),
        })
      : tl('launchNote', { seats: LAUNCH_OFFER.seats, price: fmt(p.priceMonthly) });
  };

  const tiers = [
    { p: PLANS.solo, pop: false, feats: [t('featSoloClients'), t('featSoloEditor'), t('featSoloDescriptions'), t('featSoloValidation'), t('featSoloPublish')] },
    { p: PLANS.agency, pop: true, feats: [t('featAgencyClients'), t('featAgencyMembers'), t('featAgencyRoles'), t('featAgencyEditor'), t('featAgencyDescriptions'), t('featAgencyValidation'), t('featAgencyPublish')] },
  ];

  return (
    <div className="kp">
      <style dangerouslySetInnerHTML={{ __html: PRICING_CSS }} />

      <img src="/logo-klip-dark.png" alt="Klip" className="kp-logo" />
      <p className="kp-eyebrow">{t('lastStep')}</p>
      <h1 className="kp-title">
        {chosen
          ? <>{t('titleActivateLead')} <span className="kp-acc">{PLANS[chosen].label}</span></>
          : <>{t('titleChooseLead')} <span className="kp-acc">{t('titleChooseAccent')}</span></>}
      </h1>
      <p className="kp-lead">{chosen ? t('subActivate') : t('subChoose')}</p>

      <PeriodToggle
        period={period}
        onChange={setPeriod}
        monthlyLabel={tl('monthly')}
        yearlyLabel={tl('yearly')}
        saveLabel={tl('save2mo')}
      />

      <div className="kp-grid">
        {tiers.map(({ p, pop, feats }) => {
          const isChosen = chosen === p.key;
          const isOther = chosen !== null && !isChosen;
          // Une seule carte est mise en avant : celle que la personne a choisie
          // a l'inscription, ou l'offre Agence tant qu'elle n'a rien choisi.
          const highlight = isChosen || (pop && chosen === null);
          return (
            <PlanCard
              key={p.key}
              popular={highlight}
              flag={isChosen ? t('yourChoice') : undefined}
              name={p.label}
              tag={p.key === "agency" ? to('agencyDesc') : to('studioDesc')}
              price={launched ? launchPrice(shownPrice(p)) : shownPrice(p)}
              strikePrice={launched ? shownPrice(p) : undefined}
              badge={launched ? tl('launchBadge', { percent: LAUNCH_OFFER.percent }) : undefined}
              note={noteFor(p)}
              perMonth={t('perMonth')}
              chip={feats[0]}
              features={feats.slice(1)}
            >
              <button
                className={`kp-btn ${highlight ? "kp-btn-leaf" : "kp-btn-ghost"}`}
                onClick={() => choose(p.key)}
                disabled={busy !== null}
              >
                {busy === p.key
                  ? t('redirecting')
                  : isChosen ? t('continueWithPlan', { plan: p.label })
                  : isOther ? t('takeInstead', { plan: p.label })
                  : t('choosePlan', { plan: p.label })}
              </button>
            </PlanCard>
          );
        })}
      </div>

      <p className="kp-foot">{t('secureNote')}</p>
      <button className="kp-quiet" onClick={logout}>{t('logout')}{email ? ` (${email})` : ""}</button>
    </div>
  );
}
