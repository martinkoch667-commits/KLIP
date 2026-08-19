"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { PRICING_CSS, PlanCard } from "@/components/PricingUI";

/* Écran d'offre de l'inscription. La mise en forme vient de `PricingUI`, elle
   même reprise de la section Tarifs de la landing : c'est le même écran, à deux
   minutes d'intervalle, il doit avoir la même tête. */

export default function OnboardingPlanPage() {
  const t = useTranslations('onboardingPlan');
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [agencyExpanded, setAgencyExpanded] = useState(false);
  const [loadingStudio, setLoadingStudio] = useState(false);
  const [loadingAgency, setLoadingAgency] = useState(false);
  const [error, setError] = useState("");

  const STUDIO_FEATURES = [t('studioF1'), t('studioF2'), t('studioF3'), t('studioF4'), t('studioF5')];
  const AGENCY_FEATURES = [t('agencyF1'), t('agencyF2'), t('agencyF3'), t('agencyF4'), t('agencyF5')];

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
      fetch("/api/email/welcome", { method: "POST" }).catch(() => {});
      router.push("/onboarding/survey");
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

      fetch("/api/email/welcome", { method: "POST" }).catch(() => {});
      router.push("/onboarding/survey");
    } catch {
      setError(t('errorGeneric'));
      setLoadingAgency(false);
    }
  }

  return (
    <div className="kp">
      <style dangerouslySetInnerHTML={{ __html: PRICING_CSS }} />

      <img src="/logo-klip-dark.png" alt="Klip" className="kp-logo" />
      <p className="kp-eyebrow">{t('step1of2')}</p>
      <h1 className="kp-title">
        {t('titleLead')} <span className="kp-acc">{t('titleAccent')}</span>
      </h1>
      <p className="kp-lead">{t('subtitle')}</p>

      <div className="kp-grid">
        <PlanCard
          name={t('studioName')}
          tag={t('studioDesc')}
          price={29}
          perMonth={t('perMonth')}
          note={t('studioAnnual')}
          features={STUDIO_FEATURES}
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
          price={96}
          perMonth={t('perMonth')}
          note={t('agencyAnnual')}
          features={AGENCY_FEATURES}
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
