"use client";

import { useTranslations } from "next-intl";

/* Consigne de rédaction de la légende, au format du chat IA du montage.

   Même vocabulaire que `AiChatDock` : une carte blanche flottante, le texte
   posé dessus sans cadre, les actions en dessous, une pastille sombre ronde
   pour envoyer. Les styles `.mzchat-*` existent déjà dans globals.css, on les
   réutilise plutôt que d'en inventer un deuxième : l'app n'a pas besoin de deux
   façons de parler à une IA.

   Les suggestions du dessus sont des amorces, comme dans n'importe quel chat :
   elles évitent la page blanche, qui est le vrai frein quand on doit écrire une
   consigne pour la première fois. */

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
  const starters = [t("captionStarter1"), t("captionStarter2"), t("captionStarter3")];

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {starters.map(sug => (
          <button
            key={sug}
            type="button"
            onClick={() => onChange(value.trim() ? `${value.trim()} ${sug}` : sug)}
            disabled={busy}
            className="chip"
            style={{
              background: "var(--sunk)", color: "var(--ink-2)", border: "none", cursor: "pointer",
              fontFamily: "var(--sans)", fontWeight: 600, fontSize: 11.5, letterSpacing: 0,
            }}
          >
            {sug}
          </button>
        ))}
      </div>

      <div className="mzchat-input" style={{ margin: 0 }}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={2}
          autoFocus
          placeholder={t("captionPromptPh")}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit();
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="mzchat-actions">
          <span className="mzchat-hint">{busy ? t("captionWriting") : t("captionPromptHint")}</span>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="mzchat-plus"
            title={t("captionCancel")}
            aria-label={t("captionCancel")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !value.trim()}
            className="mzchat-send"
            title={t("captionWrite")}
            aria-label={t("captionWrite")}
          >
            {busy ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="spin">
                <path d="M21 12a9 9 0 1 1-6.2-8.6" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
