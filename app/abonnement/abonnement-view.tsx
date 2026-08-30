"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { PLANS, planKeyFrom, type PlanConfig, type PlanKey } from "@/lib/plans";
import { trackInitiateCheckout } from "@/components/analytics/MetaPixel";
import { PRICING_CSS, PlanCard, PeriodToggle } from "@/components/PricingUI";
import { LAUNCH_OFFER, launchApplies, launchPrice, formatPrice } from "@/lib/launch-offer";

/* Ecran de paiement. Meme habillage que l'ecran d'offre de l'inscription et que
   la section Tarifs de la landing : la personne doit reconnaitre ce qu'elle a
   deja vu deux fois avant de sortir sa carte. */

export default function AbonnementView({ seatsLeft }: { seatsLeft: number | null }) {
  const t = useTranslations('subscription');
  // Baselines, nombre de clients et détail des offres : lus dans l'espace de la
  // landing, pas recopiés ici. C'est la grille que la personne a lue avant de
  // s'inscrire, elle doit retrouver mot pour mot la même à la caisse.
  const tl = useTranslations('landing.pricing');
  const locale = useLocale();
  const fmt = (v: number) => formatPrice(v, locale);
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [chosen, setChosen] = useState<PlanKey | null>(null);
  // Annuel d'entrée, comme la landing : c'est le tarif le plus bas, donc celui
  // que la grille doit montrer en premier. La période part telle quelle vers la
  // caisse : c'est elle qui choisit le Price ID Stripe.
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setEmail(session.user.email ?? null);
      // Offre déjà choisie à l'inscription, pour la pré-sélectionner. Il faut
      // current_plan en plus du type de compte : Starter et Studio sont tous
      // deux des comptes `solo`, seule l'offre les distingue.
      const { data } = await supabase
        .from("user_settings")
        .select("account_type, current_plan")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data?.account_type === "agency" || data?.account_type === "solo") setChosen(planKeyFrom(data));
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

  async function choose(plan: PlanKey, stripePlan: string) {
    setBusy(plan);
    try {
      // Compté avant la redirection : une fois sur stripe.com, le pixel n'y est
      // plus. L'eventId part au serveur pour dédupliquer avec la CAPI.
      const eventId = trackInitiateCheckout(stripePlan, period);
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: stripePlan, period, cancelPath: "/abonnement", ...(eventId ? { eventId } : {}) }),
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
  const shownPrice = (p: PlanConfig) => (yearly ? p.priceYearly : p.priceMonthly);
  /* Sur l'annuel, `duration: once` porte sur la première facture, donc sur une
     année entière : on annonce la somme réellement débitée, puis le plein tarif
     des années suivantes. Même calcul que la landing. */
  const noteFor = (p: PlanConfig) => {
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

  /* Les entrées vides gardent les huit clés alignées entre les trois offres :
     elles ne s'affichent pas. */
  const featsOf = (k: string) => [1, 2, 3, 4, 5, 6, 7, 8].map(n => tl(`${k}F${n}`)).filter(Boolean);

  /* Les trois offres, dans l'ordre de la landing. `key` est la clé d'offre
     interne (Starter est un compte solo à un seul client, il n'a pas de type de
     compte à lui), `stripe` le nom que la caisse attend. */
  const tiers: { p: PlanConfig; key: PlanKey; stripe: string; pop: boolean; chip: string; tag: string; feats: string[] }[] = [
    { p: PLANS.starter, key: "starter", stripe: "starter", pop: false, chip: tl('starterClients'), tag: tl('starterTag'), feats: featsOf("starter") },
    { p: PLANS.solo, key: "solo", stripe: "studio", pop: true, chip: tl('studioClients'), tag: tl('studioTag'), feats: featsOf("studio") },
    { p: PLANS.agency, key: "agency", stripe: "agence", pop: false, chip: tl('agencyClients'), tag: tl('agencyTag'), feats: featsOf("agency") },
  ];

  return (
    <div className="kp">
      <style dangerouslySetInnerHTML={{ __html: PRICING_CSS }} />

      {/* Lien de sortie autant que marque : sans lui, une personne arrivée ici
          parce que son essai est terminé n'avait plus aucun moyen de revenir sur
          le site. Un vrai `href` (pas le routeur) pour quitter franchement. */}
      <a href="/" className="kp-mark-link" aria-label="Klip">
        <img src="/icon-192.png" alt="Klip" className="kp-mark" />
      </a>
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

      <div className="kp-grid kp-grid-3">
        {tiers.map(({ p, key, stripe, pop, chip, tag, feats }) => {
          const isChosen = chosen === key;
          const isOther = chosen !== null && !isChosen;
          // Une seule carte est mise en avant : celle que la personne a choisie
          // a l'inscription, ou Studio tant qu'elle n'a rien choisi — la meme
          // que la landing met au milieu.
          const highlight = isChosen || (pop && chosen === null);
          return (
            <PlanCard
              key={key}
              popular={highlight}
              flag={isChosen ? t('yourChoice') : tl('popular')}
              name={p.label}
              tag={tag}
              price={launched ? launchPrice(shownPrice(p)) : shownPrice(p)}
              strikePrice={launched ? shownPrice(p) : undefined}
              badge={launched ? tl('launchBadge', { percent: LAUNCH_OFFER.percent }) : undefined}
              note={noteFor(p)}
              perMonth={t('perMonth')}
              chip={chip}
              features={feats}
            >
              <button
                className={`kp-btn ${highlight ? "kp-btn-leaf" : "kp-btn-ghost"}`}
                onClick={() => choose(key, stripe)}
                disabled={busy !== null}
              >
                {busy === key
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
