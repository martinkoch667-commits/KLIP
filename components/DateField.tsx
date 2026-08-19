"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";

/* Champ date avec son calendrier, aux couleurs de KLIP.

   Le champ natif `<input type="date">` ouvre le calendrier du navigateur : bleu
   système, polices système, boutons « Effacer / Aujourd'hui » en anglais ou en
   français selon l'OS. Aucune ligne de CSS ne peut le toucher, c'est le seul
   morceau d'interface que le produit ne dessinait pas.

   La valeur échangée reste au format `AAAA-MM-JJ`, exactement comme le champ
   natif : les écrans qui l'utilisaient n'ont rien à changer.

   Le calendrier est rendu dans <body> et positionné à l'écran : posé dans le
   flux, il était coupé par le panneau de programmation, qui défile. */

const ISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseISO = (v: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
};

export default function DateField({
  value, onChange, min, style, id,
}: {
  value: string;
  onChange: (iso: string) => void;
  /** Date minimale, au même format. Les jours antérieurs sont désactivés. */
  min?: string;
  style?: React.CSSProperties;
  id?: string;
}) {
  const locale = useLocale();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const selected = parseISO(value);
  const minDate = min ? parseISO(min) : null;
  const [view, setView] = useState<Date>(() => selected ?? new Date());

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (selected) setView(selected); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const W = 288, H = 340;
      // On ouvre vers le haut quand le bas manque de place : dans un panneau
      // bas de page, le calendrier sortait sous l'écran.
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

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const { label, weekdays, cells, monthLabel } = useMemo(() => {
    const fmtLong = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    const fmtMonth = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
    const fmtDay = new Intl.DateTimeFormat(locale, { weekday: "narrow" });

    // Semaine commençant le lundi, comme le reste du produit.
    const ref = new Date(2024, 0, 1); // un lundi
    const days = Array.from({ length: 7 }, (_, i) => fmtDay.format(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + i)));

    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const grid = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return d;
    });

    return {
      label: selected ? fmtLong.format(selected) : "",
      weekdays: days,
      cells: grid,
      monthLabel: fmtMonth.format(view),
    };
  }, [view, locale, selected]);

  const pick = (d: Date) => { onChange(ISO(d)); setOpen(false); };

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
          <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
        <span style={{ color: label ? "var(--ink)" : "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label || "Choisir une date"}
        </span>
      </button>

      {open && mounted && pos && createPortal(
        <div
          ref={popRef}
          style={{
            position: "fixed", top: pos.top, left: pos.left, width: 288, zIndex: 9500,
            background: "var(--card, #fff)", borderRadius: 14, padding: 12,
            boxShadow: "0 24px 50px -18px rgba(13,15,10,.35), 0 0 0 1px var(--line-2)",
            fontFamily: "var(--sans)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 13.5, color: "var(--ink)", textTransform: "capitalize" }}>
              {monthLabel}
            </span>
            <button type="button" onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
              className="mzchat-plus" style={{ marginLeft: "auto", width: 26, height: 26 }} aria-label="Mois précédent">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <button type="button" onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
              className="mzchat-plus" style={{ width: 26, height: 26 }} aria-label="Mois suivant">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
            {weekdays.map((w, i) => (
              <span key={i} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-3)", padding: "4px 0" }}>{w}</span>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {cells.map((d, i) => {
              const outside = d.getMonth() !== view.getMonth();
              const isSel = !!selected && ISO(d) === ISO(selected);
              const isToday = ISO(d) === ISO(today);
              const disabled = !!minDate && d < minDate;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(d)}
                  style={{
                    height: 32, borderRadius: 9, border: "none", cursor: disabled ? "not-allowed" : "pointer",
                    fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: isSel ? 800 : 600,
                    background: isSel ? "var(--leaf)" : "transparent",
                    color: isSel ? "var(--leaf-ink)" : disabled ? "rgba(20,22,15,.25)" : outside ? "var(--ink-3)" : "var(--ink)",
                    opacity: outside && !isSel ? .55 : 1,
                    boxShadow: !isSel && isToday ? "inset 0 0 0 1.5px var(--mint-2)" : "none",
                    transition: "background .12s",
                  }}
                  onMouseEnter={e => { if (!isSel && !disabled) e.currentTarget.style.background = "var(--sunk)"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-2)" }}>
            <button type="button" onClick={() => { setView(new Date()); pick(new Date()); }}
              className="btn btn-sm btn-ghost" style={{ height: 28, fontSize: 11.5 }}>
              Aujourd&apos;hui
            </button>
            {value && (
              <button type="button" onClick={() => { onChange(""); setOpen(false); }}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>
                Effacer
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
