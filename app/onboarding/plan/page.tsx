"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

const OB_CSS = `
  .ob-wrap{min-height:100vh;background:var(--canvas);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;}
  .ob-logo{display:block;height:48px;width:auto;margin:0 auto 44px;}
  .ob-title{font-family:var(--display);font-weight:800;font-size:28px;text-transform:uppercase;color:var(--forest);letter-spacing:-.01em;text-align:center;margin-bottom:8px;}
  .ob-sub{font-size:14px;color:rgba(20,22,15,.6);text-align:center;margin-bottom:40px;font-weight:500;}
  .ob-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;width:100%;max-width:800px;margin-bottom:28px;}
  @media(max-width:640px){.ob-grid{grid-template-columns:1fr;}}
  .ob-card{background:#fff;border-radius:16px;padding:32px;position:relative;transition:border-color .15s,box-shadow .15s;display:flex;flex-direction:column;}
  .ob-card-studio{border:2px solid rgba(20,22,15,.15);}
  .ob-card-studio:hover{border-color:var(--mint);box-shadow:0 8px 32px rgba(47,215,155,.12);}
  .ob-card-agency{border:2px solid var(--mint);box-shadow:0 8px 32px rgba(47,215,155,.12);}
  .ob-badge{display:inline-block;padding:4px 10px;background:var(--mint);color:var(--forest);font-family:var(--sans);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;border-radius:99px;margin-bottom:20px;}
  .ob-plan-name{font-family:var(--display);font-weight:800;font-size:20px;text-transform:uppercase;color:var(--forest);letter-spacing:-.01em;margin-bottom:4px;}
  .ob-plan-desc{font-size:13px;color:rgba(20,22,15,.55);font-weight:500;margin-bottom:20px;}
  .ob-features{display:flex;flex-direction:column;gap:10px;margin-bottom:24px;}
  .ob-feature{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--ink);font-weight:500;}
  .ob-check{width:18px;height:18px;border-radius:5px;flex-shrink:0;background:var(--mint-soft);color:var(--mint-2);display:grid;place-items:center;}
  .ob-price-big{font-family:var(--display);font-weight:800;font-size:28px;color:var(--forest);letter-spacing:-.02em;line-height:1;}
  .ob-price-small{font-size:12px;color:rgba(20,22,15,.45);font-weight:500;margin-top:4px;margin-bottom:24px;}
  .ob-agency-input{width:100%;border:1.5px solid rgba(20,22,15,.15);border-radius:8px;padding:11px 14px;font-family:var(--sans);font-size:14px;color:var(--ink);background:var(--canvas);outline:none;transition:border-color .15s;margin-bottom:14px;}
  .ob-agency-input::placeholder{color:rgba(20,22,15,.30);}
  .ob-agency-input:focus{border-color:var(--mint);background:#fff;}
  .ob-agency-label{display:block;font-family:var(--sans);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(20,22,15,.55);margin-bottom:6px;}
  .ob-btn-studio{width:100%;padding:12px;background:var(--forest);color:var(--canvas);font-family:var(--display);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.06em;border-radius:8px;border:none;cursor:pointer;transition:background .15s,color .15s;margin-top:auto;}
  .ob-btn-studio:hover:not(:disabled){background:var(--mint);color:var(--forest);}
  .ob-btn-studio:disabled{opacity:.5;cursor:not-allowed;}
  .ob-btn-agency{width:100%;padding:12px;background:var(--mint);color:var(--forest);font-family:var(--display);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.06em;border-radius:8px;border:none;cursor:pointer;transition:background .15s,color .15s;margin-top:auto;}
  .ob-btn-agency:hover:not(:disabled){background:var(--forest);color:var(--canvas);}
  .ob-btn-agency:disabled{opacity:.5;cursor:not-allowed;}
  .ob-error{font-size:13px;color:var(--warn);font-weight:600;text-align:center;}
  .ob-hint{font-size:11px;color:rgba(20,22,15,.35);text-align:center;}
`;

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
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

      <img src="/logo-klip-dark.png" alt="Klip" className="ob-logo"
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />

      <h1 className="ob-title">Quel type de compte ?</h1>
      <p className="ob-sub">Choisissez votre plan pour commencer.</p>

      <div className="ob-grid">
        {/* STUDIO */}
        <div className="ob-card ob-card-studio">
          <div className="ob-plan-name">Studio</div>
          <div className="ob-plan-desc">Freelances & community managers</div>

          <div className="ob-features">
            {STUDIO_FEATURES.map(f => (
              <div key={f} className="ob-feature">
                <span className="ob-check"><CheckIcon /></span>
                {f}
              </div>
            ))}
          </div>

          <div className="ob-price-big">29€ <span style={{ fontSize: 16, fontWeight: 600, color: "rgba(20,22,15,.5)" }}>/&nbsp;mois</span></div>
          <div className="ob-price-small">ou 25€/mois en annuel</div>

          <button
            onClick={handleSolo}
            disabled={loadingStudio || loadingAgency}
            className="ob-btn-studio"
          >
            {loadingStudio ? "Création…" : "Choisir Studio"}
          </button>
        </div>

        {/* AGENCE */}
        <div className="ob-card ob-card-agency">
          <div className="ob-badge">Le plus populaire</div>
          <div className="ob-plan-name">Agence</div>
          <div className="ob-plan-desc">Agences & studios de communication</div>

          <div className="ob-features">
            {AGENCY_FEATURES.map(f => (
              <div key={f} className="ob-feature">
                <span className="ob-check"><CheckIcon /></span>
                {f}
              </div>
            ))}
          </div>

          <div className="ob-price-big">96€ <span style={{ fontSize: 16, fontWeight: 600, color: "rgba(20,22,15,.5)" }}>/&nbsp;mois</span></div>
          <div className="ob-price-small">ou 89€/mois en annuel</div>

          {!agencyExpanded ? (
            <button
              onClick={() => setAgencyExpanded(true)}
              disabled={loadingStudio || loadingAgency}
              className="ob-btn-agency"
            >
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
              <button
                onClick={handleAgency}
                disabled={loadingAgency || loadingStudio || !agencyName.trim()}
                className="ob-btn-agency"
              >
                {loadingAgency ? "Création…" : "Choisir Agence"}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="ob-error" style={{ marginBottom: 12 }}>{error}</p>}
      <p className="ob-hint">Modifiable depuis les paramètres à tout moment.</p>
    </div>
  );
}
