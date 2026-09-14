"use client";

/* « Klip est plus confortable sur ordinateur », en une ligne, sur mobile
 * seulement (Martin, 2026-09-14). Montré avant que la personne se serve de
 * l'app : écran juste après le paiement, et haut du tableau de bord tant qu'on
 * ne l'a pas fermé. Rien d'alarmant : l'app marche sur téléphone, créer, monter
 * et publier des vidéos est juste plus à l'aise sur un grand écran.
 */

import { useEffect, useState } from "react";

const CLE = "klip_avis_ordinateur_ferme";

export default function AvisOrdinateur({ fermable = true, style }: { fermable?: boolean; style?: React.CSSProperties }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
    let ferme = false;
    try { ferme = fermable && localStorage.getItem(CLE) === "1"; } catch { /* navigation privée */ }
    setVisible(mobile && !ferme);
  }, [fermable]);

  if (!visible) return null;

  function fermer() {
    setVisible(false);
    try { localStorage.setItem(CLE, "1"); } catch { /* navigation privée */ }
  }

  return (
    <p role="note" style={{
      display: "flex", alignItems: "center", gap: 10, margin: 0, padding: "10px 12px", borderRadius: 12,
      background: "#EFEBFF", color: "#3F32A8", fontFamily: "var(--sans, system-ui)", fontSize: 13.5, fontWeight: 600,
      lineHeight: 1.4, textAlign: "left", ...style,
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
        <rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" />
      </svg>
      <span style={{ flex: 1 }}>Klip est plus à l&apos;aise sur ordinateur pour créer, monter et publier vos vidéos librement.</span>
      {fermable && (
        <button type="button" onClick={fermer} aria-label="Fermer" style={{
          flex: "none", border: "none", background: "none", color: "inherit", cursor: "pointer", padding: 4, fontSize: 18, lineHeight: 1,
        }}>×</button>
      )}
    </p>
  );
}
