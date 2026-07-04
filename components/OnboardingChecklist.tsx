"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// ── Persisted flags ───────────────────────────────────────────────────────────
const TOUR_KEY = "klip-onboarding-done";       // spotlight tour completed
const DISMISS_KEY = "klip-checklist-dismissed"; // user closed the checklist
const COLLAPSE_KEY = "klip-checklist-collapsed";

interface WorkspaceRow {
  id: string;
  instagram_account_id?: string | null;
}
interface PostRow {
  status: string;
  scheduled_at: string | null;
}

interface Step {
  id: string;
  title: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function IconCheck() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
}
function IconChevR() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>;
}
function IconClose() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
function IconRocket() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg>;
}

export default function OnboardingChecklist() {
  const supabase = createClientComponentClient();
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);

  // Load progress data — only if the spotlight tour is done and not dismissed
  const check = useCallback(async () => {
    try {
      if (!localStorage.getItem(TOUR_KEY)) return;    // wait for intro tour first
      if (localStorage.getItem(DISMISS_KEY)) return;  // user closed it
    } catch { return; }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const [{ data: ws }, { data: ps }] = await Promise.all([
        supabase.from("workspaces").select("id, instagram_account_id"),
        supabase.from("posts").select("status, scheduled_at"),
      ]);
      setWorkspaces(ws ?? []);
      setPosts(ps ?? []);
      try { setCollapsed(!!localStorage.getItem(COLLAPSE_KEY)); } catch {}
      setVisible(true);
    } catch {}
  }, [supabase]);

  // Check on mount AND when the intro tour finishes (so it appears immediately
  // for a brand-new account, without needing a page reload).
  useEffect(() => {
    check();
    const onTourDone = () => check();
    window.addEventListener("klip-onboarding-tour-done", onTourDone);
    return () => window.removeEventListener("klip-onboarding-tour-done", onTourDone);
  }, [check]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setVisible(false);
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed(c => {
      const next = !c;
      try {
        if (next) localStorage.setItem(COLLAPSE_KEY, "1");
        else localStorage.removeItem(COLLAPSE_KEY);
      } catch {}
      return next;
    });
  }, []);

  if (!visible) return null;

  const firstWs = workspaces[0]?.id;
  const steps: Step[] = [
    {
      id: "client",
      title: "Créer votre premier client",
      description: "Ajoutez un espace dédié à une marque.",
      done: workspaces.length > 0,
      href: "/workspace/new",
      cta: "Nouveau client",
    },
    {
      id: "instagram",
      title: "Connecter Instagram",
      description: "Reliez le compte pour publier automatiquement.",
      done: workspaces.some(w => w.instagram_account_id),
      href: firstWs ? `/workspace/${firstWs}/parametres` : "/workspace/new",
      cta: "Connecter",
    },
    {
      id: "post",
      title: "Composer un premier post",
      description: "Importez une photo et laissez l'IA écrire.",
      done: posts.length > 0,
      href: firstWs ? `/workspace/${firstWs}` : "/workspace/new",
      cta: "Composer",
    },
    {
      id: "schedule",
      title: "Valider & planifier",
      description: "Validez un post et placez-le au calendrier.",
      done: posts.some(p => p.scheduled_at || p.status === "validated"),
      href: firstWs ? `/workspace/${firstWs}/planning` : "/workspace/new",
      cta: "Planifier",
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const allDone = doneCount === steps.length;
  // Next actionable step = first not-done
  const nextStep = steps.find(s => !s.done);

  return (
    <div style={{
      position: "fixed", right: 24, bottom: 24, zIndex: 8000,
      width: collapsed ? "auto" : 340,
      fontFamily: "var(--sans)",
    }}>
      {collapsed ? (
        // ── Collapsed pill ──────────────────────────────────────────────────
        <button onClick={toggleCollapse}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "var(--forest)", color: "var(--cream)",
            border: "none", cursor: "pointer",
            borderRadius: 999, padding: "10px 16px 10px 12px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.28)",
          }}>
          <span style={{ position: "relative", width: 30, height: 30, flexShrink: 0 }}>
            <svg width="30" height="30" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(238,237,227,.18)" strokeWidth="4" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--mint)" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 2 * Math.PI * 15} ${2 * Math.PI * 15}`} />
            </svg>
            <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--cream)" }}>{pct}%</span>
          </span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Prise en main</span>
        </button>
      ) : (
        // ── Full card ───────────────────────────────────────────────────────
        <div style={{
          background: "var(--forest)", color: "var(--cream)",
          borderRadius: 18, overflow: "hidden",
          boxShadow: "0 12px 44px rgba(0,0,0,0.34)",
        }}>
          {/* Header */}
          <div style={{ padding: "18px 18px 14px", position: "relative" }}>
            <div className="halo-blob" style={{ width: 140, height: 140, right: -40, top: -70, background: "var(--mint)", opacity: .22 }} />
            <div style={{ position: "relative", zIndex: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--mint)", color: "var(--mint-ink)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <IconRocket />
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--display)", color: "var(--cream)" }}>
                  {allDone ? "Vous êtes prêt !" : "Prise en main"}
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                  <button onClick={toggleCollapse} title="Réduire"
                    style={{ width: 26, height: 26, display: "grid", placeItems: "center", background: "var(--cream-4)", border: "none", borderRadius: 7, cursor: "pointer", color: "var(--cream)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>
                  </button>
                  <button onClick={dismiss} title="Fermer"
                    style={{ width: 26, height: 26, display: "grid", placeItems: "center", background: "var(--cream-4)", border: "none", borderRadius: 7, cursor: "pointer", color: "var(--cream)" }}>
                    <IconClose />
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--acid)", lineHeight: 1 }}>{pct}%</span>
                <span style={{ fontSize: 12, color: "var(--cream-2)", fontWeight: 600 }}>{doneCount} / {steps.length} étapes</span>
              </div>
              <div style={{ height: 7, borderRadius: 99, background: "rgba(238,237,227,.15)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--mint), var(--acid))", borderRadius: 99, transition: "width .4s cubic-bezier(.4,0,.2,1)" }} />
              </div>
            </div>
          </div>

          {/* Steps */}
          <div style={{ padding: "4px 10px 12px" }}>
            {steps.map(s => {
              const isNext = !s.done && s.id === nextStep?.id;
              return (
                <div key={s.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 11,
                    padding: "10px 10px", borderRadius: 11,
                    background: isNext ? "rgba(47,215,155,.1)" : "transparent",
                  }}>
                  {/* Check circle */}
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    display: "grid", placeItems: "center",
                    background: s.done ? "var(--mint)" : "transparent",
                    color: s.done ? "var(--mint-ink)" : "var(--cream-2)",
                    boxShadow: s.done ? "none" : "inset 0 0 0 1.5px var(--cream-4)",
                  }}>
                    {s.done ? <IconCheck /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: isNext ? "var(--mint)" : "var(--cream-3)" }} />}
                  </span>
                  {/* Text */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: s.done ? "var(--cream-2)" : "var(--cream)",
                      textDecoration: s.done ? "line-through" : "none",
                    }}>{s.title}</div>
                    {isNext && (
                      <div style={{ fontSize: 11.5, color: "var(--cream-2)", marginTop: 1 }}>{s.description}</div>
                    )}
                  </div>
                  {/* CTA */}
                  {isNext && (
                    <Link href={s.href}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0,
                        padding: "6px 11px", borderRadius: 8,
                        background: "var(--mint)", color: "var(--mint-ink)",
                        fontSize: 12, fontWeight: 800, textDecoration: "none",
                      }}>
                      {s.cta} <IconChevR />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {allDone && (
            <div style={{ padding: "0 18px 16px" }}>
              <button onClick={dismiss}
                style={{ width: "100%", padding: "10px 0", borderRadius: 10, background: "var(--mint)", color: "var(--mint-ink)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>
                Terminer la prise en main
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helper pour ré-afficher la checklist (ex: depuis les Réglages) ─────────────
export function resetOnboardingChecklist() {
  try {
    localStorage.removeItem(DISMISS_KEY);
    localStorage.removeItem(COLLAPSE_KEY);
  } catch {}
}
