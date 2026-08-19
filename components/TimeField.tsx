"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* Champ heure, pendant de `DateField`.

   Même raison d'être : `<input type="time">` ouvre la liste déroulante du
   navigateur, bleu système et impossible à habiller. Ici, deux colonnes aux
   couleurs du produit, l'heure sélectionnée en leaf.

   La valeur échangée reste `HH:MM`, comme le champ natif.

   Les minutes vont de cinq en cinq : à la minute près, la colonne devient une
   liste de soixante lignes qu'on parcourt à l'aveugle, alors qu'une publication
   ne se programme jamais à 09h37. Une valeur déjà enregistrée hors de ce pas
   reste affichée et proposée, pour ne pas la perdre au premier clic. */

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const STEP = 5;

export default function TimeField({
  value, onChange, style, id,
}: {
  value: string;
  onChange: (hhmm: string) => void;
  style?: React.CSSProperties;
  id?: string;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minColRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => setMounted(true), []);

  const m = /^(\d{1,2}):(\d{2})$/.exec(value || "");
  const hh = m ? String(Math.min(23, Number(m[1]))).padStart(2, "0") : "";
  const mm = m ? m[2] : "";

  const minutes = (() => {
    const base = Array.from({ length: 60 / STEP }, (_, i) => String(i * STEP).padStart(2, "0"));
    return mm && !base.includes(mm) ? [...base, mm].sort() : base;
  })();

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const W = 176, H = 250;
      const below = window.innerHeight - r.bottom;
      setPos({
        top: below > H + 12 ? r.bottom + 6 : Math.max(8, r.top - H - 6),
        left: Math.min(Math.max(8, r.left), window.innerWidth - W - 8),
      });
    };
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Les colonnes s'ouvrent sur la valeur en cours : sans ça, on tombe à minuit
  // et il faut faire défiler pour retrouver l'heure déjà choisie.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      for (const [col, val] of [[hourColRef.current, hh], [minColRef.current, mm]] as const) {
        if (!col || !val) continue;
        const el = col.querySelector<HTMLElement>(`[data-v="${val}"]`);
        if (el) col.scrollTop = Math.max(0, el.offsetTop - 64);
      }
    }, 10);
    return () => clearTimeout(t);
  }, [open, hh, mm]);

  const set = (h: string, mi: string) => onChange(`${h}:${mi}`);

  const cell = (active: boolean): React.CSSProperties => ({
    width: "100%", padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer",
    fontFamily: "var(--sans)", fontSize: 13, fontWeight: active ? 800 : 600,
    background: active ? "var(--leaf)" : "transparent",
    color: active ? "var(--leaf-ink)" : "var(--ink)",
    transition: "background .12s",
  });

  return (
    <>
      <button
        id={id}
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input"
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left", ...style }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ color: "var(--ink-3)", flexShrink: 0 }}>
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
        </svg>
        <span style={{ color: value ? "var(--ink)" : "var(--ink-3)" }}>{value || "--:--"}</span>
      </button>

      {open && mounted && pos && createPortal(
        <div
          ref={popRef}
          style={{
            position: "fixed", top: pos.top, left: pos.left, width: 176, zIndex: 9500,
            background: "var(--card, #fff)", borderRadius: 14, padding: 10,
            boxShadow: "0 24px 50px -18px rgba(13,15,10,.35), 0 0 0 1px var(--line-2)",
            fontFamily: "var(--sans)",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            {([["Heure", HOURS, hh, hourColRef, (v: string) => set(v, mm || "00")],
               ["Minute", minutes, mm, minColRef, (v: string) => set(hh || "09", v)]] as const).map(([title, list, current, ref, pick]) => (
              <div key={title} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-3)", textAlign: "center", marginBottom: 5 }}>
                  {title}
                </div>
                <div ref={ref} style={{ maxHeight: 168, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, scrollbarWidth: "thin" }}>
                  {list.map(v => {
                    const active = v === current;
                    return (
                      <button
                        key={v}
                        type="button"
                        data-v={v}
                        onClick={() => pick(v)}
                        style={cell(active)}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--sunk)"; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setOpen(false)} className="btn btn-sm btn-ghost" style={{ width: "100%", marginTop: 9, height: 28, fontSize: 11.5, justifyContent: "center" }}>
            Terminé
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
