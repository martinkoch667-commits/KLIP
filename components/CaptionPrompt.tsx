"use client";

import { useTranslations } from "next-intl";

/* Panneau de consigne pour la rédaction de la légende.

   Fond forest et non gris : c'est un moment d'IA, pas un champ de formulaire de
   plus, et le contraste le détache nettement du volet blanc autour. Le halo
   leaf en coin reprend le bandeau d'accueil du tableau de bord.

   Sorti de la page de programmation, qui passe les 1500 lignes, et pour pouvoir
   le regarder tourner sans avoir à ouvrir une session. */

export default function CaptionPrompt({
  value, onChange, onSubmit, onCancel, busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const t = useTranslations("planning");

  return (
    <div style={{
      marginBottom: 12, padding: "14px 15px 13px", borderRadius: 14,
      background: "linear-gradient(150deg, var(--forest-2) 0%, var(--forest) 70%)",
      boxShadow: "0 18px 34px -22px rgba(7,33,23,.8)",
      position: "relative", overflow: "hidden",
    }}>
      <span aria-hidden style={{ position: "absolute", right: -30, top: -40, width: 150, height: 150, borderRadius: "50%", background: "var(--leaf)", opacity: .13, filter: "blur(18px)", pointerEvents: "none" }} />

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--leaf)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 3l1.6 4.9L16 9.5l-4.9 1.6L9.5 16l-1.6-4.9L3 9.5l4.9-1.6z" /><path d="M18 14l.8 2.5L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.5z" />
        </svg>
        <span style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--leaf)" }}>
          {t("captionPromptLabel")}
        </span>
      </div>

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        autoFocus
        placeholder={t("captionPromptPh")}
        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(); }}
        style={{
          position: "relative", width: "100%", resize: "none", display: "block",
          background: "rgba(238,237,227,.07)", color: "var(--cream)",
          border: "1.5px solid rgba(238,237,227,.16)", borderRadius: 10,
          padding: "10px 12px", fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.55,
          outline: "none", transition: "border-color .15s, background .15s",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = "var(--leaf)"; e.currentTarget.style.background = "rgba(189,242,160,.09)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "rgba(238,237,227,.16)"; e.currentTarget.style.background = "rgba(238,237,227,.07)"; }}
      />

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, marginTop: 11 }}>
        <button onClick={onSubmit} disabled={busy} className="btn btn-primary btn-sm" style={{ height: 30, fontSize: 12 }}>
          {busy ? t("captionWriting") : t("captionWrite")}
        </button>
        <button onClick={onCancel} disabled={busy}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "rgba(238,237,227,.55)", padding: "0 4px" }}>
          {t("captionCancel")}
        </button>
        <kbd style={{ marginLeft: "auto", fontFamily: "var(--sans)", fontSize: 10.5, fontWeight: 700, color: "rgba(238,237,227,.4)", background: "rgba(238,237,227,.08)", borderRadius: 6, padding: "3px 7px" }}>
          {t("captionPromptHint")}
        </kbd>
      </div>
    </div>
  );
}
