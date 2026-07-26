"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/plans";

const CSS = `
*,*::before,*::after{box-sizing:border-box;}
.ab-wrap{min-height:100vh;background:linear-gradient(160deg,#0d2015 0%,#06120a 100%);
  display:flex;flex-direction:column;align-items:center;padding:56px 24px 72px;position:relative;overflow:hidden;}
.ab-glow{position:absolute;top:-90px;left:-80px;width:440px;height:440px;border-radius:50%;
  background:radial-gradient(circle,rgba(47,215,155,.18),transparent 70%);filter:blur(50px);pointer-events:none;}
.ab-logo{height:40px;width:auto;margin:0 auto 22px;position:relative;z-index:1;}
.ab-badge{font-family:var(--mono);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:#0C2A1D;background:var(--leaf);padding:5px 12px;border-radius:99px;margin-bottom:18px;position:relative;z-index:1;}
.ab-title{font-family:var(--display);font-weight:800;font-size:34px;text-transform:uppercase;color:#fff;
  letter-spacing:-.02em;text-align:center;line-height:1.05;margin-bottom:12px;position:relative;z-index:1;}
.ab-sub{font-size:15px;color:rgba(238,237,227,.55);text-align:center;max-width:440px;margin-bottom:40px;
  position:relative;z-index:1;line-height:1.6;}
.ab-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;width:100%;max-width:760px;
  position:relative;z-index:1;margin-bottom:26px;}
@media(max-width:640px){.ab-grid{grid-template-columns:1fr;}}
.ab-card{border-radius:20px;padding:28px 26px;display:flex;flex-direction:column;
  background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(12px);}
.ab-card.pop{background:rgba(47,215,155,.07);border:1.5px solid rgba(47,215,155,.35);
  box-shadow:0 0 48px rgba(47,215,155,.10);}
.ab-name{font-family:var(--display);font-weight:800;font-size:20px;text-transform:uppercase;color:#fff;margin-bottom:4px;}
.ab-price{font-family:var(--display);font-weight:800;font-size:30px;color:#fff;letter-spacing:-.03em;margin:10px 0 4px;}
.ab-price span{font-size:13px;color:rgba(238,237,227,.4);font-weight:500;}
.ab-li{display:flex;align-items:center;gap:9px;font-size:13.5px;color:rgba(238,237,227,.75);margin-bottom:8px;}
.ab-dot{width:16px;height:16px;border-radius:5px;background:rgba(47,215,155,.2);color:var(--mint);
  display:grid;place-items:center;flex-shrink:0;}
.ab-btn{width:100%;padding:13px;margin-top:18px;border-radius:10px;cursor:pointer;border:none;
  font-family:var(--display);font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:.05em;
  background:var(--leaf);color:#0C2A1D;transition:background .15s,box-shadow .15s;}
.ab-btn:hover{background:#C9F5B2;box-shadow:0 4px 24px rgba(47,215,155,.3);}
.ab-btn.ghost{background:rgba(255,255,255,.09);color:rgba(238,237,227,.9);border:1px solid rgba(255,255,255,.18);}
.ab-note{font-size:12px;color:rgba(238,237,227,.4);text-align:center;max-width:440px;
  position:relative;z-index:1;margin-top:6px;line-height:1.5;}
.ab-logout{margin-top:26px;font-size:13px;color:rgba(238,237,227,.45);text-decoration:underline;
  text-underline-offset:3px;background:none;border:none;cursor:pointer;position:relative;z-index:1;}
.ab-choice{align-self:flex-start;font-family:var(--mono);font-size:9.5px;font-weight:800;letter-spacing:.12em;
  text-transform:uppercase;color:#0C2A1D;background:var(--leaf);padding:3px 9px;border-radius:99px;margin-bottom:10px;}
`;

function Check() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
}

export default function AbonnementPage() {
  const t = useTranslations('subscription');
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
    <div className="ab-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ab-glow" />
      <img src="/logo-klip-mint.png" alt="Klip" className="ab-logo"
        onError={e => { const i = e.target as HTMLImageElement; i.src = "/logo-klip-dark.png"; i.style.filter = "invert(1) brightness(2)"; }} />
      <span className="ab-badge">{t('lastStep')}</span>
      <h1 className="ab-title">{chosen ? t('titleActivate') : t('titleChoose')}<br />{chosen ? PLANS[chosen].label : t('titleStart')}</h1>
      <p className="ab-sub">{chosen ? t('subActivate') : t('subChoose')}</p>

      <div className="ab-grid">
        {tiers.map(({ p, pop, feats }) => {
          const isChosen = chosen === p.key;
          const isOther  = chosen !== null && !isChosen;
          return (
            <div key={p.key} className={`ab-card${(isChosen || (pop && !chosen)) ? " pop" : ""}`}>
              {isChosen && <span className="ab-choice">{t('yourChoice')}</span>}
              <div className="ab-name">{p.label}</div>
              <div className="ab-price">{p.priceMonthly}€ <span>{t('perMonth')}</span></div>
              <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "16px 0" }} />
              {feats.map(f => <div key={f} className="ab-li"><span className="ab-dot"><Check /></span>{f}</div>)}
              <button className={`ab-btn${isOther ? " ghost" : ""}`} onClick={() => choose(p.key)} disabled={busy !== null}>
                {busy === p.key ? t('redirecting') : isChosen ? t('continueWithPlan', { plan: p.label }) : isOther ? t('takeInstead', { plan: p.label }) : t('choosePlan', { plan: p.label })}
              </button>
            </div>
          );
        })}
      </div>

      <p className="ab-note">{t('secureNote')}</p>
      <button className="ab-logout" onClick={logout}>{t('logout')}{email ? ` (${email})` : ""}</button>
    </div>
  );
}
