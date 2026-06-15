"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

function IconUser() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  );
}

function IconAgency() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3"/>
      <circle cx="17" cy="9" r="2.5"/>
      <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/>
      <path d="M17 14c2.2.5 4 2.3 4 4.5"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  );
}

const SOLO_FEATURES = [
  "Jusqu'à 5 clients",
  "Éditeur canvas complet",
  "Génération de légendes IA",
  "Publication Instagram",
  "Calendrier de contenu",
];

const AGENCY_FEATURES = [
  "Clients illimités",
  "Gestion d'équipe",
  "Accès multi-utilisateurs",
  "Tableau de bord agence",
  "Tout ce que Solo inclut",
];

export default function OnboardingPlanPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [selected, setSelected] = useState<"solo" | "agency" | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!selected || loading) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      // Upsert account_type into user_settings
      await supabase.from("user_settings").upsert({
        user_id: session.user.id,
        account_type: selected,
      }, { onConflict: "user_id" });

      if (selected === "agency") {
        router.push("/onboarding/agency");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--canvas)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      fontFamily: "var(--sans)",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "var(--display)", color: "var(--forest)", letterSpacing: "-.02em" }}>Klip</div>
        <div style={{ width: 32, height: 2, borderRadius: 99, background: "var(--mint)" }} />
      </div>

      {/* Heading */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, fontFamily: "var(--display)", color: "var(--ink)", margin: "0 0 12px", lineHeight: 1.15 }}>
          Comment allez-vous utiliser Klip ?
        </h1>
        <p style={{ fontSize: 15, color: "var(--ink-2)", margin: 0, fontWeight: 500 }}>
          Choisissez le profil qui correspond à votre usage.
        </p>
      </div>

      {/* Plan cards */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginBottom: 36, maxWidth: 680, width: "100%" }}>
        {(["solo", "agency"] as const).map((plan) => {
          const isSolo = plan === "solo";
          const isSelected = selected === plan;
          return (
            <button
              key={plan}
              onClick={() => setSelected(plan)}
              style={{
                flex: "1 1 280px",
                maxWidth: 300,
                background: isSelected ? "var(--forest)" : "var(--card, #fff)",
                border: `2px solid ${isSelected ? "var(--forest)" : "var(--line)"}`,
                borderRadius: "var(--r-xl)",
                padding: "28px 28px 32px",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color .15s, background .15s, transform .12s",
                transform: isSelected ? "translateY(-2px)" : "none",
                boxShadow: isSelected ? "0 12px 36px rgba(12,42,29,.18)" : "0 2px 8px rgba(13,15,10,.06)",
              }}
            >
              {/* Icon */}
              <span style={{
                display: "inline-flex",
                width: 52,
                height: 52,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 18,
                background: isSelected ? "rgba(47,215,155,.18)" : "var(--sunk)",
                color: isSelected ? "var(--mint)" : "var(--ink-2)",
              }}>
                {isSolo ? <IconUser /> : <IconAgency />}
              </span>

              {/* Title */}
              <div style={{ fontWeight: 800, fontSize: 20, fontFamily: "var(--display)", color: isSelected ? "var(--cream)" : "var(--ink)", marginBottom: 6, lineHeight: 1.2 }}>
                {isSolo ? "Solo" : "Agence"}
              </div>
              <div style={{ fontSize: 13, color: isSelected ? "rgba(238,237,227,.6)" : "var(--ink-3)", fontWeight: 500, marginBottom: 22, lineHeight: 1.5 }}>
                {isSolo
                  ? "Je gère mes propres réseaux ou ceux de quelques clients."
                  : "Je gère une équipe et de nombreux clients."}
              </div>

              {/* Features */}
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {(isSolo ? SOLO_FEATURES : AGENCY_FEATURES).map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      background: isSelected ? "rgba(47,215,155,.2)" : "var(--mint-soft)",
                      color: "var(--mint-2)",
                      display: "grid", placeItems: "center",
                    }}>
                      <IconCheck />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? "var(--cream-2, rgba(238,237,227,.8))" : "var(--ink-2)" }}>{f}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* CTA */}
      <button
        onClick={handleContinue}
        disabled={!selected || loading}
        style={{
          padding: "13px 36px",
          borderRadius: "var(--r)",
          background: selected ? "var(--forest)" : "var(--sunk)",
          color: selected ? "var(--mint)" : "var(--ink-3)",
          border: "none",
          cursor: selected ? "pointer" : "default",
          fontSize: 15,
          fontWeight: 800,
          fontFamily: "var(--sans)",
          transition: "background .15s, color .15s",
          minWidth: 200,
        }}
      >
        {loading ? "Chargement…" : "Continuer"}
      </button>

      <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 16 }}>
        Vous pourrez changer de plan depuis les paramètres.
      </p>
    </div>
  );
}
