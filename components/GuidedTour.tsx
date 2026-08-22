"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* Visite guidée réutilisable, une par écran.

   Le tour du tableau de bord existait déjà mais il était soudé à une seule
   liste d'étapes. Ici l'écran passe son `id` et ses étapes, et le composant se
   charge du reste : ne pas se répéter, sauter une étape dont l'élément n'est
   pas là, retenir ce qui a été vu.

   Deux mémoires, à dessein :
   - `localStorage`, pour ne rien réafficher tant qu'on reste sur la machine,
     même hors ligne et sans attendre le réseau ;
   - les métadonnées du compte, pour que quelqu'un qui change d'ordinateur ne
     se retape pas toute la visite. Aucune migration nécessaire, contrairement
     à une colonne dédiée.

   Une étape sans `target` s'affiche au centre : c'est ce qu'il faut pour
   présenter un écran avant d'en désigner les détails. */

export type TourStep = {
  /** Sélecteur CSS de l'élément à mettre en lumière. Absent : carte centrée. */
  target?: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
};

const LS_PREFIX = "klip-tour-";
const META_KEY = "tours_done";
const CARD_W = 340;

type Box = { top: number; left: number; width: number; height: number };

export function tourSeen(id: string): boolean {
  try { return localStorage.getItem(LS_PREFIX + id) === "1"; } catch { return false; }
}

/** Remet toutes les visites à zéro (bouton « revoir le tutoriel »). */
export function resetTours(ids?: string[]): void {
  try {
    if (ids?.length) {
      ids.forEach(id => localStorage.removeItem(LS_PREFIX + id));
      return;
    }
    Object.keys(localStorage)
      .filter(k => k.startsWith(LS_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* navigation privée */ }
}

export default function GuidedTour({ id, steps, delayMs = 700, onFinish, force = false, waitForAbsent }: {
  id: string;
  steps: TourStep[];
  /** Laisse à l'écran le temps de se peindre avant de mesurer les cibles. */
  delayMs?: number;
  /** Appelé une fois la visite terminée ou passée. */
  onFinish?: () => void;
  /** Rejoue la visite même si elle a déjà été vue (lien `?tour=`). */
  force?: boolean;
  /** Sélecteur d'un écran de chargement à attendre disparu avant de démarrer —
   *  l'éditeur affiche la visite dès `delayMs`, alors que composer un visuel
   *  par IA peut prendre bien plus longtemps que ça : la première étape
   *  (sans cible propre) s'affichait alors EN PLEIN SUR l'écran « génération
   *  en cours ». `delayMs` reste un délai de PEINTURE, pas de chargement. */
  waitForAbsent?: string;
}) {
  const supabase = createClientComponentClient();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const doneRef = useRef(false);
  /* La carte est mesurée après rendu : son texte varie d'une étape à l'autre,
     et une hauteur devinée la faisait chevaucher l'élément qu'elle désigne. */
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(220);

  /* Les étapes dont l'élément n'existe pas sur cet écran sont retirées une
     fois pour toutes : un panneau replié ou une option réservée à une offre ne
     doit pas produire une étape qui pointe dans le vide. */
  const [live, setLive] = useState<TourStep[]>([]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;

      // On attend que l'écran de chargement ait disparu — pas un délai fixe,
      // qui devine toujours faux pour une opération de durée variable. Plafond
      // à 20s : passé ça, mieux vaut montrer la visite en retard que jamais.
      if (waitForAbsent) {
        const debut = Date.now();
        while (document.querySelector(waitForAbsent) && Date.now() - debut < 20000) {
          await new Promise(r => setTimeout(r, 300));
          if (cancelled) return;
        }
      }

      /* Qui a vu la visite : le COMPTE, pas le navigateur. L'ordre comptait —
         on lisait d'abord le stockage local, si bien qu'un nouvel arrivant sur
         un poste déjà utilisé n'avait jamais droit à la visite : elle était
         marquée « vue » par quelqu'un d'autre. Le stockage local ne sert plus
         que de repli quand la session est illisible. */
      let vue: boolean;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const seen: string[] = user.user_metadata?.[META_KEY] ?? [];
          vue = seen.includes(id);
          // Le cache local se réaligne sur le compte, dans les deux sens.
          try {
            if (vue) localStorage.setItem(LS_PREFIX + id, "1");
            else localStorage.removeItem(LS_PREFIX + id);
          } catch { /* navigation privée */ }
        } else {
          vue = tourSeen(id);
        }
      } catch {
        vue = tourSeen(id);
      }
      if (!force && vue) return;
      if (cancelled) return;

      /* Les cibles peuvent arriver après nous : le tableau de bord attend ses
         données, le rail attend la liste des clients. Plutôt que d'abandonner,
         on regarde à nouveau un peu plus tard. */
      const utilisables = () => steps.filter(s => !s.target || document.querySelector(s.target));
      let usable = utilisables();
      if (!usable.length) {
        await new Promise(r => setTimeout(r, 1200));
        if (cancelled) return;
        usable = utilisables();
      }
      if (!usable.length) return;
      setLive(usable);
      setStep(0);
      setVisible(true);
    }, delayMs);

    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, force]);

  const measure = useCallback(() => {
    const s = live[step];
    if (!s?.target) { setBox(null); return; }
    const el = document.querySelector(s.target);
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [live, step]);

  useEffect(() => {
    if (!visible) return;
    measure();
    const on = () => measure();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
    };
  }, [visible, measure]);

  const finish = useCallback(async () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setVisible(false);
    try { localStorage.setItem(LS_PREFIX + id, "1"); } catch { /* ignore */ }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const seen: string[] = user.user_metadata?.[META_KEY] ?? [];
        if (!seen.includes(id)) {
          await supabase.auth.updateUser({ data: { [META_KEY]: [...seen, id] } });
        }
      }
    } catch { /* la mémoire locale suffit */ }
    onFinish?.();
  }, [id, supabase, onFinish]);

  useLayoutEffect(() => {
    if (!visible) return;
    const h = cardRef.current?.offsetHeight;
    if (h && Math.abs(h - cardH) > 4) setCardH(h);
  });

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setStep(s => Math.min(s + 1, live.length - 1));
      if (e.key === "ArrowLeft") setStep(s => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, live.length, finish]);

  if (!visible || !live.length) return null;

  const current = live[step];
  const isLast = step === live.length - 1;
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const narrow = winW <= 767;

  // Position de la carte : à côté de l'élément sur grand écran, en bas sur
  // mobile où il n'y a de la place nulle part ailleurs.
  let cardStyle: React.CSSProperties = {
    position: "fixed", width: CARD_W, maxWidth: "calc(100vw - 32px)", zIndex: 100002,
  };
  if (!box || narrow) {
    cardStyle = box && narrow
      ? { ...cardStyle, left: 16, right: 16, width: "auto", bottom: 20 }
      : { ...cardStyle, left: "50%", top: "50%", transform: "translate(-50%,-50%)" };
  } else {
    const gap = 18;
    const place = current.placement ?? "right";
    let top = box.top + box.height / 2 - cardH / 2;
    let left = box.left + box.width + gap;
    if (place === "left") left = box.left - CARD_W - gap;
    if (place === "top") { top = box.top - cardH - gap; left = box.left + box.width / 2 - CARD_W / 2; }
    if (place === "bottom") { top = box.top + box.height + gap; left = box.left + box.width / 2 - CARD_W / 2; }
    // On rabat dans l'écran plutôt que de laisser la carte sortir du cadre,
    // et on bascule de l'autre côté quand la place manque.
    if (left + CARD_W > winW - 16) left = Math.max(16, box.left - CARD_W - gap);
    if (left < 16) left = 16;
    if (place === "top" && top < 16) top = box.top + box.height + gap;
    if (place === "bottom" && top + cardH > winH - 16) top = Math.max(16, box.top - cardH - gap);
    top = Math.min(Math.max(16, top), Math.max(16, winH - cardH - 16));
    cardStyle = { ...cardStyle, top, left };
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100000 }} aria-live="polite">
      {/* Voile + trou de lumière. Le box-shadow géant évite de découper le
          voile en quatre morceaux qui laissent des coutures visibles. */}
      <div
        onClick={finish}
        style={{
          position: "fixed",
          ...(box
            ? {
                top: box.top - 6, left: box.left - 6,
                width: box.width + 12, height: box.height + 12,
                borderRadius: 12,
                boxShadow: "0 0 0 9999px rgba(7,33,23,.72)",
                border: "2px solid var(--leaf)",
                pointerEvents: "none",
              }
            : { inset: 0, background: "rgba(7,33,23,.72)" }),
          transition: "all .25s cubic-bezier(.2,.8,.3,1)",
        }}
      />
      {box && <div onClick={finish} style={{ position: "fixed", inset: 0, zIndex: -1 }} />}

      <div ref={cardRef} style={{
        ...cardStyle,
        background: "var(--forest, #072117)",
        color: "var(--cream, #F1F0E5)",
        borderRadius: 16,
        padding: "22px 24px 18px",
        boxShadow: "0 30px 60px -20px rgba(0,0,0,.55)",
        fontFamily: "var(--sans)",
      }}>
        <div style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--leaf, #BDF2A0)", marginBottom: 10 }}>
          Étape {step + 1} sur {live.length}
        </div>
        <h2 style={{ margin: "0 0 8px", fontFamily: "var(--display)", fontWeight: 800, fontSize: 19, letterSpacing: "-.02em", lineHeight: 1.15 }}>
          {current.title}
        </h2>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "rgba(241,240,229,.72)" }}>
          {current.body}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
          <button onClick={finish}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "rgba(241,240,229,.5)", textDecoration: "underline", textUnderlineOffset: 3, padding: 0 }}>
            Passer
          </button>
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              style={{ padding: "9px 14px", borderRadius: 999, border: "1.5px solid rgba(241,240,229,.28)", background: "transparent", color: "var(--cream, #F1F0E5)", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
              Retour
            </button>
          )}
          <button onClick={() => (isLast ? finish() : setStep(s => s + 1))}
            style={{ padding: "9px 18px", borderRadius: 999, border: "none", background: "var(--leaf, #BDF2A0)", color: "var(--leaf-ink, #1E3317)", fontFamily: "var(--sans)", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
            {isLast ? "J'ai compris" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}
