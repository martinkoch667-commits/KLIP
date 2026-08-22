"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// ── Persisted flags ───────────────────────────────────────────────────────────
// Namespacées par COMPTE, jamais globales : des flags par navigateur faisaient
// qu'un poste réutilisé d'un compte à l'autre — le cas le plus banal, une
// agence à plusieurs mains, ou simplement plusieurs essais pendant les tests —
// gardait la checklist fermée pour tout le monde après le premier « fermer »
// du tout premier compte. Même défaut que la visite guidée, mêmes clés.
const TOUR_KEY = "klip-onboarding-done";       // repli hors-session uniquement
const DISMISS_KEY = "klip-checklist-dismissed";
const COLLAPSE_KEY = "klip-checklist-collapsed";
const cle = (base: string, uid: string) => `${base}:${uid}`;

interface WorkspaceRow {
  id: string;
  instagram_account_id?: string | null;
  description_style?: string | null;
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
  const t = useTranslations("onboardingChecklist");
  const supabase = createClientComponentClient();
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);

  // On a besoin du compte AVANT de savoir quoi lire : les trois indicateurs
  // sont namespacés par identifiant, donc rien à consulter tant qu'on ne sait
  // pas pour QUI on regarde.
  const [uid, setUid] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const id = session.user.id;
      setUid(id);

      // La visite guidée écrit sur le compte (métadonnée `tours_done`) depuis
      // le correctif de la visite ; on la lit en priorité, et on ne retombe
      // sur le repère local — namespacé, lui aussi — que hors-ligne.
      const vues: string[] = (session.user.user_metadata?.tours_done as string[] | undefined) ?? [];
      const tourFait = vues.includes("dashboard") || !!localStorage.getItem(cle(TOUR_KEY, id));
      if (!tourFait) return;                                    // attendre la visite d'abord
      if (localStorage.getItem(cle(DISMISS_KEY, id))) return;    // CE compte l'a fermée

      const [{ data: ws }, { data: ps }] = await Promise.all([
        supabase.from("workspaces").select("id, instagram_account_id, description_style"),
        supabase.from("posts").select("status, scheduled_at"),
      ]);
      setWorkspaces(ws ?? []);
      setPosts(ps ?? []);
      try { setCollapsed(!!localStorage.getItem(cle(COLLAPSE_KEY, id))); } catch {}
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
    try { if (uid) localStorage.setItem(cle(DISMISS_KEY, uid), "1"); } catch {}
    setVisible(false);
  }, [uid]);

  const toggleCollapse = useCallback(() => {
    setCollapsed(c => {
      const next = !c;
      try {
        if (!uid) return next;
        if (next) localStorage.setItem(cle(COLLAPSE_KEY, uid), "1");
        else localStorage.removeItem(cle(COLLAPSE_KEY, uid));
      } catch {}
      return next;
    });
  }, [uid]);

  if (!visible) return null;

  const firstWs = workspaces[0]?.id;
  const steps: Step[] = [
    {
      id: "client",
      title: t("clientTitle"),
      description: t("clientDesc"),
      done: workspaces.length > 0,
      href: "/workspace/new",
      cta: t("clientCta"),
    },
    {
      id: "instagram",
      title: t("instagramTitle"),
      description: t("instagramDesc"),
      done: workspaces.some(w => w.instagram_account_id),
      href: firstWs ? `/workspace/${firstWs}/parametres` : "/workspace/new",
      cta: t("instagramCta"),
    },
    {
      id: "style",
      title: t("styleTitle"),
      description: t("styleDesc"),
      done: workspaces.some(w => w.description_style),
      href: firstWs ? `/workspace/${firstWs}/style` : "/workspace/new",
      cta: t("styleCta"),
    },
    {
      id: "post",
      title: t("postTitle"),
      description: t("postDesc"),
      done: posts.length > 0,
      href: firstWs ? `/workspace/${firstWs}` : "/workspace/new",
      cta: t("postCta"),
    },
    {
      id: "schedule",
      title: t("scheduleTitle"),
      description: t("scheduleDesc"),
      done: posts.some(p => p.scheduled_at || p.status === "validated"),
      href: firstWs ? `/workspace/${firstWs}/planning` : "/workspace/new",
      cta: t("scheduleCta"),
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const allDone = doneCount === steps.length;
  // Next actionable step = first not-done
  const nextStep = steps.find(s => !s.done);

  return (
    <div style={{
      /* Le coin bas-droit est déjà occupé par la pastille « signaler un bug »,
         présente sur toutes les pages : elle publie la hauteur qu'elle prend
         (--klip-dock-bas), on se pose juste au-dessus. Sans ça, la prise en
         main recouvrait purement et simplement le bouton de signalement. */
      position: "fixed", right: 18, bottom: "calc(var(--klip-dock-bas, 18px) + 12px)", zIndex: 8000,
      width: collapsed ? "auto" : 336,
      fontFamily: "var(--sans)",
    }}>
      {collapsed ? (
        // ── Réduit : une pastille posée sur le plan de travail ───────────────
        <button onClick={toggleCollapse} className="card lift"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            border: "1px solid var(--line-2)", cursor: "pointer",
            borderRadius: 999, padding: "8px 16px 8px 9px",
            boxShadow: "var(--shadow-pop)", color: "var(--ink)",
            fontFamily: "var(--sans)",
          }}>
          <span style={{ position: "relative", width: 28, height: 28, flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--sunk)" strokeWidth="4" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--leaf)" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 2 * Math.PI * 15} ${2 * Math.PI * 15}`} />
            </svg>
            <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--ink-2)" }}>{doneCount}/{steps.length}</span>
          </span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{t("title")}</span>
        </button>
      ) : (
        // ── Carte complète ───────────────────────────────────────────────────
        <div className="card" style={{ overflow: "hidden", boxShadow: "var(--shadow-float)" }}>
          {/* En-tête */}
          <div style={{ padding: "15px 15px 14px", borderBottom: "1px solid var(--line-2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 28, height: 28, borderRadius: 9, background: "var(--leaf)", color: "var(--leaf-ink)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <IconRocket />
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--display)", fontStyle: "italic", letterSpacing: "-0.02em", color: "var(--ink)" }}>
                {allDone ? t("titleDone") : t("title")}
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                <button onClick={toggleCollapse} title={t("collapse")} className="btn btn-ghost btn-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>
                </button>
                <button onClick={dismiss} title={t("close")} className="btn btn-ghost btn-icon">
                  <IconClose />
                </button>
              </div>
            </div>

            {/* Avancement : ce sont les ÉTAPES qui parlent, le pourcentage n'est
                qu'un repère. L'inverse (un « 60 % » énorme au-dessus d'une barre
                dégradée) tenait plus du tableau de bord que de la charte. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "15px 0 7px" }}>
              <span className="label">{t("steps", { done: doneCount, total: steps.length })}</span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: 11, color: "var(--ink-2)" }}>{pct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "var(--sunk)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "var(--leaf)", borderRadius: 99, transition: "width .4s cubic-bezier(.4,0,.2,1)" }} />
            </div>
          </div>

          {/* Étapes */}
          <div style={{ padding: 8 }}>
            {steps.map(s => {
              const isNext = !s.done && s.id === nextStep?.id;
              return (
                <div key={s.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 9px", borderRadius: 12,
                    background: isNext ? "var(--sunk)" : "transparent",
                  }}>
                  {/* Pastille d'état */}
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    display: "grid", placeItems: "center",
                    background: s.done ? "var(--leaf)" : "transparent",
                    color: s.done ? "var(--leaf-ink)" : "var(--ink-3)",
                    boxShadow: s.done ? "none" : "inset 0 0 0 1.5px var(--line)",
                  }}>
                    {s.done ? <IconCheck /> : isNext ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--leaf-ink)" }} /> : null}
                  </span>
                  {/* Libellé — une étape faite s'efface, elle ne se barre pas :
                      le texte rayé donnait un air de liste de courses. */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 13, fontWeight: isNext ? 700 : 600,
                      color: s.done ? "var(--ink-3)" : "var(--ink)",
                    }}>{s.title}</div>
                    {isNext && (
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2, lineHeight: 1.35 }}>{s.description}</div>
                    )}
                  </div>
                  {/* Action */}
                  {isNext && (
                    <Link href={s.href} className="btn btn-primary btn-sm" style={{ flexShrink: 0, textDecoration: "none" }}>
                      {s.cta} <IconChevR />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {allDone && (
            <div style={{ padding: "0 15px 15px" }}>
              <button onClick={dismiss} className="btn btn-primary" style={{ width: "100%" }}>
                {t("finish")}
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
