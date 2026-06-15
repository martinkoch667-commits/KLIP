"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { resetOnboardingTour } from "@/components/OnboardingTour";

function IconPlay() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 12H3m0 0l3.5-3.5M3 12l3.5 3.5"/>
    </svg>
  );
}

export default function SettingsPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState<string>("solo");
  const [tourReset, setTourReset] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setEmail(session.user.email ?? "");
      const { data } = await supabase
        .from("user_settings")
        .select("account_type")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data?.account_type) setAccountType(data.account_type);
    })();
  }, [supabase, router]);

  function handleResetTour() {
    resetOnboardingTour();
    setTourReset(true);
    setTimeout(() => router.push("/dashboard"), 800);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const displayName = email.split("@")[0] ?? "Utilisateur";

  return (
    <div className="app">
      <Sidebar />
      <div className="work">
        <div className="topbar">
          <h1 style={{ fontSize: 17, fontWeight: 800, fontFamily: "var(--display)", margin: 0 }}>Paramètres</h1>
        </div>

        <div className="scroll">
          <div className="page" style={{ maxWidth: 640 }}>

            {/* ── Compte ── */}
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12, fontFamily: "var(--mono)" }}>
                Compte
              </h2>
              <div className="card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 44, height: 44, borderRadius: 12, background: "#7B5CF5", display: "grid", placeItems: "center", color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "var(--mono)", flexShrink: 0 }}>
                  {displayName.slice(0, 2).toUpperCase()}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{displayName}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>{email}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, background: "var(--mint-soft)", color: "var(--mint-2)", padding: "3px 9px", borderRadius: 99 }}>
                  {accountType === "agency" ? "Agence" : "Solo"}
                </span>
              </div>
            </section>

            {/* ── Aide & Tutoriel ── */}
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12, fontFamily: "var(--mono)" }}>
                Aide &amp; Tutoriel
              </h2>
              <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--sunk)", display: "grid", placeItems: "center", color: "var(--ink-2)", flexShrink: 0 }}>
                  <IconPlay />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 2 }}>Tutoriel de démarrage</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Revoir les fonctionnalités principales de Klip.</div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleResetTour}
                  disabled={tourReset}
                >
                  {tourReset ? "Redirection…" : "Revoir le tutoriel"}
                </button>
              </div>
            </section>

            {/* ── Déconnexion ── */}
            <section>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12, fontFamily: "var(--mono)" }}>
                Session
              </h2>
              <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--sunk)", display: "grid", placeItems: "center", color: "var(--ink-2)", flexShrink: 0 }}>
                  <IconLogout />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 2 }}>Se déconnecter</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Fermer la session en cours.</div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--warn)", borderColor: "rgba(200,115,43,.3)" }}
                  onClick={handleLogout}
                >
                  Déconnexion
                </button>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
