"use client";

import { useEffect, useState } from "react";
import { readConsent, writeConsent } from "./consent";

// Dataset "KLIP Web" (Meta) — distinct de l'ID d'app Facebook Login (1998010880798347).
const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "1390029399657000";

// Bandeau de consentement CNIL. N'apparaît que si un traceur publicitaire est
// configuré (Meta Pixel) et tant qu'aucun choix n'a été enregistré. Le pixel
// (MetaPixel) reste inactif tant que l'utilisateur n'a pas cliqué « Accepter ».
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!PIXEL_ID) return;
    if (readConsent() === null) setVisible(true);
  }, []);

  if (!PIXEL_ID || !visible) return null;

  function decide(value: "granted" | "denied") {
    writeConsent(value);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Consentement aux cookies de mesure d'audience"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 9999,
        maxWidth: 720,
        margin: "0 auto",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 14,
        padding: "16px 18px",
        borderRadius: "var(--r-l, 18px)",
        background: "var(--forest, #0C2A1D)",
        border: "1px solid rgba(47,215,155,.28)",
        boxShadow: "0 20px 50px -20px rgba(0,0,0,.55)",
        color: "#F4F3EC",
        fontFamily: "var(--sans)",
      }}
    >
      <p style={{ flex: "1 1 320px", margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "rgba(244,243,236,.82)" }}>
        Nous utilisons un traceur de mesure d&apos;audience (Meta) pour améliorer Klip. Vous
        pouvez l&apos;accepter ou le refuser.{" "}
        <a href="/cookies" style={{ color: "var(--mint, #2FD79B)", textDecoration: "underline" }}>
          En savoir plus
        </a>
        .
      </p>
      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        <button
          onClick={() => decide("denied")}
          style={{
            padding: "10px 16px",
            borderRadius: "var(--r, 13px)",
            border: "1px solid rgba(238,237,227,.24)",
            background: "transparent",
            color: "#F4F3EC",
            fontFamily: "var(--display)",
            fontWeight: 700,
            fontSize: 13.5,
            cursor: "pointer",
          }}
        >
          Refuser
        </button>
        <button
          onClick={() => decide("granted")}
          style={{
            padding: "10px 18px",
            borderRadius: "var(--r, 13px)",
            border: "none",
            background: "var(--mint, #2FD79B)",
            color: "#06281C",
            fontFamily: "var(--display)",
            fontWeight: 800,
            fontSize: 13.5,
            cursor: "pointer",
          }}
        >
          Accepter
        </button>
      </div>
    </div>
  );
}
