"use client";

import { useState, useEffect, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface TourStep {
  target: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="dashboard"]',
    title: "Bienvenue sur Klip",
    description: "Voici votre tableau de bord. Retrouvez ici une vue d'ensemble de tous vos clients et contenus.",
    position: "right",
  },
  {
    target: '[data-tour="clients"]',
    title: "Vos clients",
    description: "Créez un espace dédié pour chaque client. Chaque client a ses propres contenus, templates et connexions sociales.",
    position: "right",
  },
  {
    target: '[data-tour="calendar"]',
    title: "Calendrier",
    description: "Visualisez et planifiez tous vos contenus sur un calendrier global. Vue semaine ou mois selon vos préférences.",
    position: "right",
  },
  {
    target: '[data-tour="composer"]',
    title: "Composer",
    description: "Retrouvez ici tous vos brouillons en cours. Reprenez un contenu là où vous l'aviez laissé.",
    position: "right",
  },
  {
    target: '[data-tour="feed"]',
    title: "Fil de publication",
    description: "Suivez l'état de tous vos contenus programmés et publiés en temps réel.",
    position: "right",
  },
  {
    target: '[data-tour="templates"]',
    title: "Templates",
    description: "Créez des modèles réutilisables pour aller plus vite. Assignez un template à un client ou partagez-le entre plusieurs.",
    position: "right",
  },
  {
    target: '[data-tour="new-post"]',
    title: "Créer un contenu",
    description: "Importez une photo ou vidéo, choisissez le type (Post, Reel, Story), et laissez Klip générer votre légende.",
    position: "top",
  },
];

const LS_KEY = "klip-onboarding-done";

interface SpotlightRect { top: number; left: number; width: number; height: number }

function getTooltipPosition(rect: SpotlightRect, position: TourStep["position"], winW: number, winH: number) {
  const GAP = 16;
  const TW = 320;
  const TH = 200; // approx
  let top = 0, left = 0;
  switch (position) {
    case "right":
      top  = rect.top + rect.height / 2 - TH / 2;
      left = rect.left + rect.width + GAP;
      break;
    case "left":
      top  = rect.top + rect.height / 2 - TH / 2;
      left = rect.left - TW - GAP;
      break;
    case "bottom":
      top  = rect.top + rect.height + GAP;
      left = rect.left + rect.width / 2 - TW / 2;
      break;
    case "top":
      top  = rect.top - TH - GAP;
      left = rect.left + rect.width / 2 - TW / 2;
      break;
  }
  // Clamp to viewport
  top  = Math.max(16, Math.min(top, winH - TH - 16));
  left = Math.max(16, Math.min(left, winW - TW - 16));
  return { top, left };
}

interface Props {
  onComplete?: () => void;
}

export default function OnboardingTour({ onComplete }: Props) {
  const supabase = createClientComponentClient();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  const measureTarget = useCallback((s: number) => {
    if (s >= TOUR_STEPS.length) return null;
    const el = document.querySelector(TOUR_STEPS[s].target);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }, []);

  useEffect(() => {
    const r = measureTarget(step);
    setRect(r);
  }, [step, measureTarget]);

  // Recalculate on resize
  useEffect(() => {
    const handler = () => setRect(measureTarget(step));
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [step, measureTarget]);

  const markDone = useCallback(async () => {
    try {
      localStorage.setItem(LS_KEY, "1");
    } catch {}
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from("user_settings").upsert({
          user_id: session.user.id,
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }
    } catch {}
  }, [supabase]);

  const close = useCallback(async () => {
    await markDone();
    setVisible(false);
    // Signale à la checklist de prise en main d'apparaître tout de suite
    try { window.dispatchEvent(new Event("klip-onboarding-tour-done")); } catch {}
    onComplete?.();
  }, [markDone, onComplete]);

  const next = useCallback(async () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      await close();
    }
  }, [step, close]);

  const prev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  // Mount: check if should show
  useEffect(() => {
    (async () => {
      // localStorage fast-path
      try {
        if (localStorage.getItem(LS_KEY)) return;
      } catch {}
      // Check Supabase
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from("user_settings")
          .select("onboarding_completed")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (data?.onboarding_completed) {
          localStorage.setItem(LS_KEY, "1");
          return;
        }
      } catch {}
      // Show tour
      setStep(0);
      setVisible(true);
    })();
  }, [supabase]);

  if (!visible) return null;

  const current = TOUR_STEPS[step];
  const winW = typeof window !== "undefined" ? window.innerWidth : 1440;
  const winH = typeof window !== "undefined" ? window.innerHeight : 900;
  const isMobile = winW <= 767;

  // ── Tooltip card (shared between mobile modal + desktop spotlight) ──────────
  const tooltipCard = (
    <div style={{
      background: "var(--forest)",
      color: "var(--canvas)",
      borderRadius: 16,
      padding: "22px 24px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.32)",
      fontFamily: "var(--sans)",
      pointerEvents: "auto",
      width: isMobile ? "100%" : 320,
      maxWidth: isMobile ? 400 : undefined,
      position: "relative",
    }}>
      {/* Progress dots */}
      <div style={{ display:"flex", gap:5, marginBottom:14 }}>
        {TOUR_STEPS.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 20 : 6, height: 6, borderRadius: 99,
            background: i === step ? "var(--mint)" : "rgba(47,215,155,.3)",
            transition: "width .2s, background .2s",
          }}/>
        ))}
      </div>

      {/* Step counter */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--mint-2)", marginBottom:6, fontFamily:"var(--mono)" }}>
        {step + 1} / {TOUR_STEPS.length}
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 800, margin:"0 0 8px", fontFamily:"var(--display)", color:"var(--cream)", lineHeight:1.2 }}>
        {current.title}
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.6, color:"var(--cream-2)", margin:"0 0 20px" }}>
        {current.description}
      </p>

      {/* Buttons */}
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        {step > 0 && (
          <button onClick={prev}
            style={{ padding:"9px 16px", borderRadius:"var(--r-s)", background:"var(--cream-4)", color:"var(--cream)", border:"none", cursor:"pointer", fontSize:13, fontWeight:700 }}>
            Retour
          </button>
        )}
        <button onClick={next}
          style={{ padding:"9px 18px", borderRadius:"var(--r-s)", background:"var(--mint)", color:"var(--mint-ink)", border:"none", cursor:"pointer", fontSize:13, fontWeight:800, flex:1 }}>
          {step === TOUR_STEPS.length - 1 ? "Terminer" : "Suivant"}
        </button>
        <button onClick={close}
          style={{ padding:"9px 10px", background:"none", border:"none", cursor:"pointer", fontSize:12, color:"rgba(238,237,227,.4)", fontWeight:600, flexShrink:0 }}>
          Passer
        </button>
      </div>
    </div>
  );

  // ── Mobile: centered modal (no spotlight — sidebar is hidden) ────────────────
  if (isMobile) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0 16px 40px",
      }}
        onClick={e => { if (e.target === e.currentTarget) close(); }}
      >
        {tooltipCard}
      </div>
    );
  }

  // ── Desktop: spotlight tour ─────────────────────────────────────────────────
  if (!rect) return null;

  const { top: ttTop, left: ttLeft } = getTooltipPosition(rect, current.position, winW, winH);
  const PADDING = 8;

  return (
    <>
      {/* Overlay with spotlight cutout */}
      <div style={{ position: "fixed", inset: 0, zIndex: 9000, pointerEvents: "none" }}>
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}>
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white"/>
              <rect
                x={rect.left - PADDING} y={rect.top - PADDING}
                width={rect.width + PADDING*2} height={rect.height + PADDING*2}
                rx={8} fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask="url(#spotlight-mask)"/>
          <rect
            x={rect.left - PADDING} y={rect.top - PADDING}
            width={rect.width + PADDING*2} height={rect.height + PADDING*2}
            rx={8} fill="none" stroke="rgba(47,215,155,0.6)" strokeWidth="2"
          />
        </svg>
      </div>

      {/* Tooltip */}
      <div style={{ position: "fixed", top: ttTop, left: ttLeft, zIndex: 9001 }}>
        {tooltipCard}
      </div>
    </>
  );
}

// ── Helper to programmatically re-launch the tour ─────────────────────────────
export function resetOnboardingTour() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}
