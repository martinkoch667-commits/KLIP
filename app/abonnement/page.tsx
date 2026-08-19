"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/plans";
import { PRICING_CSS, PlanCard } from "@/components/PricingUI";

/* Ecran de paiement. Meme habillage que l'ecran d'offre de l'inscription et que
   la section Tarifs de la landing : la personne doit reconnaitre ce qu'elle a
   deja vu deux fois avant de sortir sa carte. */

export default function AbonnementPage() {
  const t = useTranslations('subscription');
  // Les baselines des offres vivent dans l'espace de l'onboarding : une seule
  // formulation pour les deux écrans, plutôt que deux à maintenir.
  const to = useTranslations('onboardingPlan');
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [chosen, setChosen] = useState<"solo" | "agency" | null>(null);

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
        body: JSON.stringify({ plan: stripePlan, period: "monthly" }),
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

  const tiers = [
    { p: PLANS.solo, pop: false, feats: [t('featSoloClients'), t('featSoloEditor'), t('featSoloDescriptions'), t('featSoloPublish')] },
    { p: PLANS.agency, pop: true, feats: [t('featAgencyClients'), t('featAgencyMembers'), t('featAgencyWorkflow'), t('featAgencyRoles')] },
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
              price={p.priceMonthly}
              perMonth={t('perMonth')}
              features={feats}
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
