"use client";

import { useEffect, useState } from "react";
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
  color:#0C2A1D;background:var(--mint);padding:5px 12px;border-radius:99px;margin-bottom:18px;position:relative;z-index:1;}
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
  background:var(--mint);color:#0C2A1D;transition:background .15s,box-shadow .15s;}
.ab-btn:hover{background:#C8F135;box-shadow:0 4px 24px rgba(47,215,155,.3);}
.ab-btn.ghost{background:rgba(255,255,255,.09);color:rgba(238,237,227,.9);border:1px solid rgba(255,255,255,.18);}
.ab-note{font-size:12px;color:rgba(238,237,227,.4);text-align:center;max-width:440px;
  position:relative;z-index:1;margin-top:6px;line-height:1.5;}
.ab-logout{margin-top:26px;font-size:13px;color:rgba(238,237,227,.45);text-decoration:underline;
  text-underline-offset:3px;background:none;border:none;cursor:pointer;position:relative;z-index:1;}
.ab-choice{align-self:flex-start;font-family:var(--mono);font-size:9.5px;font-weight:800;letter-spacing:.12em;
  text-transform:uppercase;color:#0C2A1D;background:var(--mint);padding:3px 9px;border-radius:99px;margin-bottom:10px;}
`;

function Check() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
}

export default function AbonnementPage() {
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
        alert("Le paiement en ligne arrive très bientôt. Écrivez-nous à martinkoch667@gmail.com pour activer votre offre dès maintenant.");
      } else {
        alert(json.error || "Une erreur est survenue. Réessayez.");
      }
    } catch {
      alert("Une erreur est survenue. Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  const tiers = [
    { p: PLANS.solo, pop: false, feats: ["Jusqu’à 3 clients", "Éditeur visuel complet", "Descriptions IA illimitées", "Publication Instagram & Facebook"] },
    { p: PLANS.agency, pop: true, feats: ["Jusqu’à 10 clients", "Jusqu’à 5 membres d’équipe", "Workflow de validation client", "Rôles Manager & Créa"] },
  ];

  return (
    <div className="ab-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ab-glow" />
      <img src="/logo-klip-mint.png" alt="Klip" className="ab-logo"
        onError={e => { const i = e.target as HTMLImageElement; i.src = "/logo-klip-dark.png"; i.style.filter = "invert(1) brightness(2)"; }} />
      <span className="ab-badge">Dernière étape</span>
      <h1 className="ab-title">{chosen ? "Activez votre offre :" : "Choisissez votre offre"}<br />{chosen ? PLANS[chosen].label : "pour démarrer"}</h1>
      <p className="ab-sub">{chosen
        ? "On vous emmène directement au paiement de l’offre choisie à l’inscription. Essai gratuit de 7 jours, sans engagement, résiliable à tout moment — vous n’êtes débité qu’à la fin de l’essai."
        : "Activez votre essai gratuit de 7 jours — sans engagement, résiliable à tout moment. Vous n’êtes débité qu’à la fin de l’essai."}</p>

      <div className="ab-grid">
        {tiers.map(({ p, pop, feats }) => {
          const isChosen = chosen === p.key;
          const isOther  = chosen !== null && !isChosen;
          return (
            <div key={p.key} className={`ab-card${(isChosen || (pop && !chosen)) ? " pop" : ""}`}>
              {isChosen && <span className="ab-choice">Votre choix</span>}
              <div className="ab-name">{p.label}</div>
              <div className="ab-price">{p.priceMonthly}€ <span>/ mois</span></div>
              <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "16px 0" }} />
              {feats.map(f => <div key={f} className="ab-li"><span className="ab-dot"><Check /></span>{f}</div>)}
              <button className={`ab-btn${isOther ? " ghost" : ""}`} onClick={() => choose(p.key)} disabled={busy !== null}>
                {busy === p.key ? "Redirection…" : isChosen ? `Continuer avec ${p.label} →` : isOther ? `Prendre ${p.label} à la place` : `Choisir ${p.label}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="ab-note">🔒 Paiement sécurisé par Stripe · Carte requise pour activer l’essai · Aucun débit avant la fin des 7 jours.</p>
      <button className="ab-logout" onClick={logout}>Se déconnecter{email ? ` (${email})` : ""}</button>
    </div>
  );
}
