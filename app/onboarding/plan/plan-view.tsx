"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { PRICING_CSS, PlanCard, PeriodToggle } from "@/components/PricingUI";
import { PLANS } from "@/lib/plans";
import { LAUNCH_OFFER, launchApplies, launchPrice, formatPrice } from "@/lib/launch-offer";

/* Écran d'offre de l'inscription. La mise en forme vient de `PricingUI`, elle
   même reprise de la section Tarifs de la landing : c'est le même écran, à deux
   minutes d'intervalle, il doit avoir la même tête. */

export default function PlanView({ seatsLeft }: { seatsLeft: number | null }) {
  const t = useTranslations('onboardingPlan');
  // Les textes de l'offre de lancement sont ceux de la landing : une seule
  // formulation, dans les six langues, pour les deux écrans.
  const tl = useTranslations('landing.pricing');
  const locale = useLocale();
  const fmt = (v: number) => formatPrice(v, locale);
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [agencyExpanded, setAgencyExpanded] = useState(false);
  const [loadingStudio, setLoadingStudio] = useState(false);
  const [loadingAgency, setLoadingAgency] = useState(false);
  const [error, setError] = useState("");
  // La période choisie ici ne facture rien : elle est retenue pour arriver
  // pré-sélectionnée à l'écran de paiement, qui lui appelle la caisse.
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");

  /* Départ vers Stripe. L'offre choisie ici EST celle qu'on paie : refaire
     choisir sur /abonnement juste après était la double étape que Martin a
     repérée. Cet écran mène donc à la caisse, et le questionnaire attend le
     paiement. */
  async function startCheckout(plan: "studio" | "agence"): Promise<boolean> {
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, period, cancelPath: "/onboarding/plan" }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.url) {
        window.location.href = json.url;
        return true;
      }
      setError(json?.error ?? t('errorGeneric'));
    } catch {
      setError(t('errorGeneric'));
    }
    return false;
  }

  function pickPeriod(p: "monthly" | "yearly") {
    setPeriod(p);
    try { localStorage.setItem("klip_period", p); } catch { /* navigation privée */ }
  }

  // L'offre de lancement doit s'afficher ici aussi : la caisse l'applique
  // (voir app/api/stripe/checkout), donc taire la remise sur cet écran ferait
  // croire au plein tarif juste après l'avoir annoncée sur la landing.
  const launched = launchApplies(period) && (seatsLeft === null || seatsLeft > 0);
  const isYearly = period === "yearly";
  const badge = launched ? tl('launchBadge', { percent: LAUNCH_OFFER.percent }) : undefined;
  /** L'annuel s'annonce en équivalent par mois, comme sur la landing. */
  const shownOf = (monthly: number, yearly: number) => (isYearly ? yearly : monthly);
  const priceOf = (monthly: number, yearly: number) => {
    const shown = shownOf(monthly, yearly);
    return launched ? launchPrice(shown) : shown;
  };
  const strikeOf = (monthly: number, yearly: number) =>
    launched ? shownOf(monthly, yearly) : undefined;
  const noteOf = (monthly: number, yearly: number) => {
    if (!launched) return isYearly ? tl('billedYear', { total: fmt(yearly * 12) }) : t('annualNote', { price: fmt(yearly) });
    // Sur l'annuel, la remise porte sur la première facture, donc sur l'année
    // entière : on annonce la somme débitée puis le plein tarif ensuite.
    return isYearly
      ? tl('launchNoteYear', { seats: LAUNCH_OFFER.seats, firstYear: fmt(launchPrice(yearly * 12)), full: fmt(yearly * 12) })
      : tl('launchNote', { seats: LAUNCH_OFFER.seats, price: fmt(monthly) });
  };

  // Les entrées vides sont là pour garder les six clés alignées entre les
  // deux offres, elles ne s'affichent pas.
  const STUDIO_FEATURES = [1, 2, 3, 4, 5, 6, 7, 8].map(n => t(`studioF${n}`)).filter(Boolean);
  const AGENCY_FEATURES = [1, 2, 3, 4, 5, 6, 7, 8].map(n => t(`agencyF${n}`)).filter(Boolean);

  // Pré-sélection de l'offre choisie sur la landing (?plan transmis via register)
  useEffect(() => {
    try {
      const p = localStorage.getItem("klip_plan");
      if (p === "agency") setAgencyExpanded(true);
      localStorage.removeItem("klip_plan");
    } catch { /* ignore */ }
  }, []);

  async function handleSolo() {
    setError("");
    setLoadingStudio(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      await supabase.from("user_settings").upsert(
        { user_id: session.user.id, account_type: "solo" },
        { onConflict: "user_id" }
      );
      const gone = await startCheckout("studio");
      if (!gone) setLoadingStudio(false);
    } catch {
      setError(t('errorGeneric'));
      setLoadingStudio(false);
    }
  }

  async function handleAgency() {
    if (!agencyName.trim()) {
      setError(t('errorAgencyName'));
      return;
    }
    setError("");
    setLoadingAgency(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const userId = session.user.id;

      await supabase.from("user_settings").upsert(
        { user_id: userId, account_type: "agency" },
        { onConflict: "user_id" }
      );

      const { data: agency } = await supabase
        .from("agencies")
        .insert({ name: agencyName.trim(), owner_id: userId })
        .select("id")
        .single();

      if (agency?.id) {
        await supabase.from("agency_members").insert({
          agency_id: agency.id,
          user_id: userId,
          role: "admin",
          accepted_at: new Date().toISOString(),
        });
      }

      const gone = await startCheckout("agence");
      if (!gone) setLoadingAgency(false);
    } catch {
      setError(t('errorGeneric'));
      setLoadingAgency(false);
    }
  }

  return (
    <div className="kp">
      <style dangerouslySetInnerHTML={{ __html: PRICING_CSS }} />

      <img src="/logo-klip-dark.png" alt="Klip" className="kp-logo" />
      <h1 className="kp-title">
        {t('titleLead')} <span className="kp-acc">{t('titleAccent')}</span>
      </h1>
      <p className="kp-lead">{t('subtitle')}</p>

      <PeriodToggle
        period={period}
        onChange={pickPeriod}
        monthlyLabel={tl('monthly')}
        yearlyLabel={tl('yearly')}
        saveLabel={tl('save2mo')}
      />

      <div className="kp-grid">
        <PlanCard
          name={t('studioName')}
          tag={t('studioDesc')}
          price={priceOf(PLANS.solo.priceMonthly, PLANS.solo.priceYearly)}
          strikePrice={strikeOf(PLANS.solo.priceMonthly, PLANS.solo.priceYearly)}
          badge={badge}
          perMonth={t('perMonth')}
          note={noteOf(PLANS.solo.priceMonthly, PLANS.solo.priceYearly)}
          chip={STUDIO_FEATURES[0]}
          features={STUDIO_FEATURES.slice(1)}
        >
          <button onClick={handleSolo} disabled={loadingStudio || loadingAgency} className="kp-btn kp-btn-ghost">
            {loadingStudio ? t('creating') : t('chooseStudio')}
          </button>
        </PlanCard>

        <PlanCard
          popular
          flag={t('mostPopular')}
          name={t('agencyName')}
          tag={t('agencyDesc')}
          price={priceOf(PLANS.agency.priceMonthly, PLANS.agency.priceYearly)}
          strikePrice={strikeOf(PLANS.agency.priceMonthly, PLANS.agency.priceYearly)}
          badge={badge}
          perMonth={t('perMonth')}
          note={noteOf(PLANS.agency.priceMonthly, PLANS.agency.priceYearly)}
          chip={AGENCY_FEATURES[0]}
          features={AGENCY_FEATURES.slice(1)}
        >
          {!agencyExpanded ? (
            <button onClick={() => setAgencyExpanded(true)} disabled={loadingStudio || loadingAgency} className="kp-btn kp-btn-leaf">
              {t('chooseAgency')}
            </button>
          ) : (
            <>
              <label className="kp-label" htmlFor="agency-name">{t('agencyNameLabel')}</label>
              <input
                id="agency-name"
                type="text"
                className="kp-input"
                placeholder={t('agencyNamePlaceholder')}
                value={agencyName}
                onChange={e => setAgencyName(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") handleAgency(); }}
              />
              <button onClick={handleAgency} disabled={loadingAgency || loadingStudio || !agencyName.trim()} className="kp-btn kp-btn-leaf">
                {loadingAgency ? t('creating') : t('confirm')}
              </button>
            </>
          )}
        </PlanCard>
      </div>

      {error && <p className="kp-err">{error}</p>}
      <p className="kp-foot">{t('hint')}</p>
    </div>
  );
}
