"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

function IconUser() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  );
}
function IconAgency() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/>
      <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><path d="M17 14c2.2.5 4 2.3 4 4.5"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  );
}

const PLANS = [
  {
    key: "solo" as const,
    label: "Solo",
    desc: "Je gère mes propres comptes sociaux ou ceux de quelques clients.",
    features: ["1 utilisateur","Jusqu'à 5 clients","Éditeur canvas complet","Génération IA","Publication Instagram"],
    icon: <IconUser />,
  },
  {
    key: "agency" as const,
    label: "Agence",
    desc: "Je gère une équipe et de nombreux clients avec workflow de validation.",
    features: ["Multi-membres","Workflow de validation","Rôles & droits","Clients illimités","Tout ce que Solo inclut"],
    icon: <IconAgency />,
  },
];

export default function OnboardingPlanPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [selected, setSelected] = useState<"solo"|"agency"|null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (!selected || loading) return;
    if (selected === "agency" && !agencyName.trim()) {
      setError("Veuillez entrer le nom de votre agence.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const userId = session.user.id;

      // 1. Upsert user_settings with account_type
      await supabase.from("user_settings").upsert({
        user_id: userId,
        account_type: selected,
      }, { onConflict: "user_id" });

      if (selected === "agency") {
        // 2. Create agency
        const { data: agency } = await supabase
          .from("agencies")
          .insert({ name: agencyName.trim(), owner_id: userId })
          .select("id")
          .single();

        // 3. Add owner as agency_member
        if (agency?.id) {
          await supabase.from("agency_members").insert({
            agency_id: agency.id,
            user_id: userId,
            role: "admin",
            accepted_at: new Date().toISOString(),
          });
        }
      }

      router.push("/dashboard");
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight:"100vh", background:"var(--canvas)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"40px 24px", fontFamily:"var(--sans)",
    }}>
      {/* Logo */}
      <div style={{ marginBottom:44 }}>
        <img src="/logo-klip-dark.png" alt="Klip" style={{ height:36, width:"auto" }}
          onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
        <div style={{ fontSize:22, fontWeight:900, fontFamily:"var(--display)", color:"var(--forest)", letterSpacing:"-.02em", textAlign:"center" }}>
          Klip
        </div>
      </div>

      {/* Heading */}
      <div style={{ textAlign:"center", marginBottom:36 }}>
        <h1 style={{ fontSize:28, fontWeight:900, fontFamily:"var(--sans)", textTransform:"uppercase", letterSpacing:".06em", color:"var(--ink)", margin:"0 0 10px", lineHeight:1.1 }}>
          Quel type de compte ?
        </h1>
        <p style={{ fontSize:14, color:"var(--ink-2)", margin:0, fontWeight:500 }}>
          Choisissez le profil qui correspond à votre usage.
        </p>
      </div>

      {/* Cards */}
      <div style={{ display:"flex", gap:14, flexWrap:"wrap", justifyContent:"center", marginBottom:28, width:"100%", maxWidth:640 }}>
        {PLANS.map(plan => {
          const active = selected === plan.key;
          return (
            <button
              key={plan.key}
              onClick={() => setSelected(plan.key)}
              style={{
                flex:"1 1 260px", maxWidth:290, textAlign:"left",
                background: active ? "var(--forest)" : "var(--card)",
                border:`2px solid ${active ? "var(--forest)" : "var(--line)"}`,
                borderRadius:"var(--r-xl)", padding:"26px 26px 30px",
                cursor:"pointer", transition:"all .15s",
                transform: active ? "translateY(-2px)" : "none",
                boxShadow: active ? "0 16px 40px -12px rgba(12,42,29,.28)" : "0 2px 8px rgba(13,15,10,.06)",
              }}
            >
              {/* Icon */}
              <span style={{
                display:"inline-flex", width:50, height:50, borderRadius:13,
                alignItems:"center", justifyContent:"center", marginBottom:16,
                background: active ? "rgba(47,215,155,.18)" : "var(--sunk)",
                color: active ? "var(--mint)" : "var(--ink-2)",
              }}>
                {plan.icon}
              </span>

              <div style={{ fontWeight:900, fontSize:20, fontFamily:"var(--sans)", textTransform:"uppercase", letterSpacing:".06em", color: active ? "var(--cream)" : "var(--ink)", marginBottom:6 }}>
                {plan.label}
              </div>
              <div style={{ fontSize:12.5, color: active ? "rgba(238,237,227,.6)" : "var(--ink-3)", fontWeight:500, marginBottom:20, lineHeight:1.5 }}>
                {plan.desc}
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ width:18, height:18, borderRadius:5, flexShrink:0, background: active ? "rgba(47,215,155,.2)" : "var(--mint-soft)", color:"var(--mint-2)", display:"grid", placeItems:"center" }}>
                      <IconCheck />
                    </span>
                    <span style={{ fontSize:12, fontWeight:600, color: active ? "rgba(238,237,227,.8)" : "var(--ink-2)" }}>{f}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Agency name field */}
      {selected === "agency" && (
        <div style={{ width:"100%", maxWidth:360, marginBottom:20 }}>
          <label style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", color:"var(--ink-3)", display:"block", marginBottom:6, fontFamily:"var(--mono)" }}>
            Nom de votre agence
          </label>
          <input
            className="input"
            type="text"
            placeholder="Ex : Studio Créatif"
            value={agencyName}
            onChange={e => setAgencyName(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ fontSize:13, color:"var(--warn)", marginBottom:14, fontWeight:600 }}>{error}</div>
      )}

      {/* CTA */}
      <button
        onClick={handleConfirm}
        disabled={!selected || loading}
        className="btn btn-primary"
        style={{
          padding:"12px 40px", fontSize:14, fontWeight:800,
          textTransform:"uppercase", letterSpacing:".06em",
          opacity: selected ? 1 : 0.4, cursor: selected ? "pointer" : "default",
          minWidth:200,
        }}
      >
        {loading ? "Création…" : "Commencer"}
      </button>

      <p style={{ fontSize:11, color:"var(--ink-3)", marginTop:14 }}>
        Modifiable depuis les paramètres à tout moment.
      </p>
    </div>
  );
}
