"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

const OB_CSS = `
  *,*::before,*::after{box-sizing:border-box;}
  .ob-wrap{
    min-height:100vh;
    background:linear-gradient(160deg,#0d2015 0%,#06120a 100%);
    display:flex;flex-direction:column;align-items:center;
    padding:52px 24px 72px;
    position:relative;overflow:hidden;
  }
  /* ambient glows */
  .ob-glow-a{position:absolute;top:-80px;left:-80px;width:420px;height:420px;border-radius:50%;
    background:radial-gradient(circle,rgba(47,215,155,.2) 0%,transparent 70%);
    filter:blur(48px);pointer-events:none;}
  .ob-glow-b{position:absolute;bottom:-120px;right:-60px;width:360px;height:360px;border-radius:50%;
    background:radial-gradient(circle,rgba(200,241,53,.12) 0%,transparent 70%);
    filter:blur(48px);pointer-events:none;}

  .ob-logo{display:block;height:44px;width:auto;margin:0 auto 16px;position:relative;z-index:1;}

  .ob-step{font-family:var(--mono);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
    color:rgba(47,215,155,.7);text-align:center;margin-bottom:24px;position:relative;z-index:1;}

  .ob-title{font-family:var(--display);font-weight:800;font-size:32px;text-transform:uppercase;
    color:#fff;letter-spacing:-.02em;text-align:center;margin-bottom:10px;
    position:relative;z-index:1;line-height:1.05;}
  .ob-sub{font-size:14px;color:rgba(238,237,227,.5);text-align:center;margin-bottom:44px;
    font-weight:500;position:relative;z-index:1;max-width:380px;}

  .ob-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;width:100%;max-width:820px;
    margin-bottom:28px;position:relative;z-index:1;}
  @media(max-width:640px){.ob-grid{grid-template-columns:1fr;gap:14px;}}

  .ob-card{
    border-radius:20px;padding:28px 26px;
    display:flex;flex-direction:column;
    background:rgba(255,255,255,.045);
    border:1px solid rgba(255,255,255,.10);
    backdrop-filter:blur(12px);
    transition:border-color .2s,box-shadow .2s;
    position:relative;overflow:hidden;
  }
  .ob-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);}
  .ob-card-studio:hover{border-color:rgba(255,255,255,.22);}

  .ob-card-agency{
    background:rgba(47,215,155,.07);
    border:1.5px solid rgba(47,215,155,.35);
    box-shadow:0 0 48px rgba(47,215,155,.10),inset 0 1px 0 rgba(47,215,155,.15);
  }
  .ob-card-agency::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(47,215,155,.5),transparent);}

  .ob-badge{
    display:inline-flex;align-items:center;gap:5px;
    padding:4px 10px;background:var(--mint);color:#0C2A1D;
    font-family:var(--mono);font-size:9px;font-weight:800;
    text-transform:uppercase;letter-spacing:.12em;
    border-radius:99px;margin-bottom:18px;align-self:flex-start;
  }

  .ob-plan-name{font-family:var(--display);font-weight:800;font-size:21px;
    text-transform:uppercase;color:#fff;letter-spacing:-.01em;margin-bottom:4px;}
  .ob-plan-desc{font-size:12.5px;color:rgba(238,237,227,.45);font-weight:500;margin-bottom:22px;line-height:1.4;}

  .ob-divider{height:1px;background:rgba(255,255,255,.08);margin-bottom:20px;}
  .ob-divider-agency{background:rgba(47,215,155,.15);}

  .ob-features{display:flex;flex-direction:column;gap:9px;margin-bottom:26px;}
  .ob-feature{display:flex;align-items:center;gap:10px;font-size:13px;
    color:rgba(238,237,227,.75);font-weight:500;}
  .ob-check{width:18px;height:18px;border-radius:5px;flex-shrink:0;
    background:rgba(47,215,155,.18);color:var(--mint);display:grid;place-items:center;}
  .ob-check-agency{background:rgba(47,215,155,.25);}

  .ob-price-row{display:flex;align-items:baseline;gap:4px;margin-bottom:4px;}
  .ob-price-big{font-family:var(--display);font-weight:800;font-size:30px;
    color:#fff;letter-spacing:-.03em;line-height:1;}
  .ob-price-period{font-size:13px;color:rgba(238,237,227,.4);font-weight:500;}
  .ob-price-small{font-size:11px;color:rgba(238,237,227,.3);font-weight:500;margin-bottom:22px;}

  .ob-agency-label{display:block;font-family:var(--mono);font-size:10px;font-weight:800;
    text-transform:uppercase;letter-spacing:.1em;color:rgba(47,215,155,.7);margin-bottom:6px;}
  .ob-agency-input{width:100%;border:1.5px solid rgba(47,215,155,.3);border-radius:10px;
    padding:11px 14px;font-family:var(--sans);font-size:14px;color:#fff;
    background:rgba(255,255,255,.06);outline:none;transition:border-color .15s,background .15s;
    margin-bottom:12px;}
  .ob-agency-input::placeholder{color:rgba(238,237,227,.25);}
  .ob-agency-input:focus{border-color:var(--mint);background:rgba(47,215,155,.06);}

  .ob-btn-studio{
    width:100%;padding:13px;margin-top:auto;
    background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);
    color:rgba(238,237,227,.9);font-family:var(--display);font-weight:700;font-size:13px;
    text-transform:uppercase;letter-spacing:.06em;border-radius:10px;cursor:pointer;
    transition:background .15s,border-color .15s,color .15s;
  }
  .ob-btn-studio:hover:not(:disabled){background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff;}
  .ob-btn-studio:disabled{opacity:.4;cursor:not-allowed;}

  .ob-btn-agency{
    width:100%;padding:13px;margin-top:auto;
    background:var(--mint);border:none;
    color:#0C2A1D;font-family:var(--display);font-weight:800;font-size:13px;
    text-transform:uppercase;letter-spacing:.06em;border-radius:10px;cursor:pointer;
    transition:background .15s,box-shadow .15s;
  }
  .ob-btn-agency:hover:not(:disabled){background:#C8F135;box-shadow:0 4px 24px rgba(47,215,155,.35);}
  .ob-btn-agency:disabled{opacity:.5;cursor:not-allowed;}

  .ob-error{font-size:13px;color:#ff6b5b;font-weight:600;text-align:center;
    position:relative;z-index:1;}
  .ob-hint{font-size:11px;color:rgba(238,237,227,.22);text-align:center;
    position:relative;z-index:1;}

  @media(max-width:640px){
    .ob-wrap{padding:36px 16px 56px;}
    .ob-title{font-size:26px;}
    .ob-card{padding:22px 18px;}
    .ob-plan-name{font-size:18px;}
    .ob-price-big{font-size:26px;}
    .ob-btn-studio,.ob-btn-agency{min-height:48px;font-size:14px;}
  }
`;

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
    </svg>
  );
}

const STUDIO_FEATURES = [
  "3 comptes clients",
  "1 profil utilisateur",
  "Posts illimités",
  "IA incluse",
  "Publication Instagram & Facebook",
];

const AGENCY_FEATURES = [
  "10 clients inclus",
  "5 membres inclus",
  "Workflow de validation",
  "Rôles Manager / Créa",
  "Tout ce que Studio inclut",
];

export default function OnboardingPlanPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [agencyExpanded, setAgencyExpanded] = useState(false);
  const [loadingStudio, setLoadingStudio] = useState(false);
  const [loadingAgency, setLoadingAgency] = useState(false);
  const [error, setError] = useState("");

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
      router.push("/onboarding/survey");
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
      setLoadingStudio(false);
    }
  }

  async function handleAgency() {
    if (!agencyName.trim()) {
      setError("Veuillez entrer le nom de votre agence.");
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

      router.push("/onboarding/survey");
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
      setLoadingAgency(false);
    }
  }

  return (
    <div className="ob-wrap">
      <style dangerouslySetInnerHTML={{ __html: OB_CSS }} />

      {/* Ambient glows */}
      <div className="ob-glow-a" />
      <div className="ob-glow-b" />

      <img src="/logo-klip-mint.png" alt="Klip" className="ob-logo"
        onError={e => {
          const img = e.target as HTMLImageElement;
          img.src = "/logo-klip-dark.png";
          img.style.filter = "invert(1) brightness(2)";
        }} />

      <div className="ob-step">Étape 1 sur 2 — Votre compte</div>

      <h1 className="ob-title">Quel type de compte ?</h1>
      <p className="ob-sub">Choisissez votre plan pour commencer. Modifiable à tout moment.</p>

      <div className="ob-grid">
        {/* STUDIO */}
        <div className="ob-card ob-card-studio">
          <div className="ob-plan-name">Studio</div>
          <div className="ob-plan-desc">Freelances & community managers indépendants</div>

          <div className="ob-divider" />

          <div className="ob-features">
            {STUDIO_FEATURES.map(f => (
              <div key={f} className="ob-feature">
                <span className="ob-check"><CheckIcon /></span>
                {f}
              </div>
            ))}
          </div>

          <div className="ob-price-row">
            <span className="ob-price-big">29€</span>
            <span className="ob-price-period">&nbsp;/ mois</span>
          </div>
          <div className="ob-price-small">ou 25€/mois en annuel · sans engagement</div>

          <button onClick={handleSolo} disabled={loadingStudio || loadingAgency} className="ob-btn-studio">
            {loadingStudio ? "Création…" : "Choisir Studio"}
          </button>
        </div>

        {/* AGENCE */}
        <div className="ob-card ob-card-agency">
          <div className="ob-badge"><StarIcon />Le plus populaire</div>
          <div className="ob-plan-name">Agence</div>
          <div className="ob-plan-desc">Agences & studios de communication multi-clients</div>

          <div className="ob-divider ob-divider-agency" />

          <div className="ob-features">
            {AGENCY_FEATURES.map(f => (
              <div key={f} className="ob-feature">
                <span className="ob-check ob-check-agency"><CheckIcon /></span>
                {f}
              </div>
            ))}
          </div>

          <div className="ob-price-row">
            <span className="ob-price-big">96€</span>
            <span className="ob-price-period">&nbsp;/ mois</span>
          </div>
          <div className="ob-price-small">ou 89€/mois en annuel · sans engagement</div>

          {!agencyExpanded ? (
            <button onClick={() => setAgencyExpanded(true)} disabled={loadingStudio || loadingAgency} className="ob-btn-agency">
              Choisir Agence
            </button>
          ) : (
            <>
              <label className="ob-agency-label">Nom de votre agence</label>
              <input
                type="text"
                className="ob-agency-input"
                placeholder="Ex : Studio Créatif"
                value={agencyName}
                onChange={e => setAgencyName(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") handleAgency(); }}
              />
              <button onClick={handleAgency} disabled={loadingAgency || loadingStudio || !agencyName.trim()} className="ob-btn-agency">
                {loadingAgency ? "Création…" : "Confirmer"}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="ob-error" style={{ marginBottom: 12 }}>{error}</p>}
      <p className="ob-hint">Modifiable depuis les paramètres · Aucun CB requis pour commencer</p>
    </div>
  );
}
