"use client";

/* Banc : l'écran de composition IA, en vrai et en plein écran. */

import React from "react";
import AiGeneratingOverlay from "@/components/EcranComposition";

export default function BancEcran() {
  const [log, setLog] = React.useState<string[]>([]);
  React.useEffect(() => {
    const messages = [
      "Lecture de la photo (1080 × 1350)",
      "Charte : #FF4F37, #BDF2A0, Montserrat",
      "Composition choisie : titre bas, voile",
      "Contraste vérifié sous le titre",
    ];
    let i = 0;
    const id = setInterval(() => { setLog(l => [...l, messages[i % messages.length]]); i++; }, 1700);
    return () => clearInterval(id);
  }, []);
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <AiGeneratingOverlay title="Klip compose votre visuel" lines={log} />;
}
