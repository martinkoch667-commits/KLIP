"use client";

/* Banc : les deux panneaux de retouche d'image, montés seuls. */

import React from "react";
import { PanneauAjuster, PanneauOutils, type ImageRetouchable } from "@/components/PanneauImage";

export default function BancImage() {
  const [img, setImg] = React.useState<ImageRetouchable>({ id: "x", src: "/banc-detourage2.jpg" });
  const [busy, setBusy] = React.useState<string | null>(null);
  const maj = (p: Partial<ImageRetouchable>) => setImg(v => ({ ...v, ...p }));
  const simuler = (cle: string) => { setBusy(cle); setTimeout(() => setBusy(null), 1800); };
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return (
    <main style={{ minHeight: "100vh", background: "#FBFAF6", padding: 26, display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div style={{ width: 340, background: "var(--white, #fff)", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,.06)", overflow: "auto", maxHeight: "94vh" }}>
        <PanneauOutils sel={img} busy={busy} erreur={null}
          onAjuster={() => { /* le banc montre les deux côte à côte */ }}
          onRecadrer={() => simuler("crop")}
          onDetourer={() => simuler("detour")}
          onCapturer={() => simuler("capture")}
          onRetoucher={(_, cle) => simuler(cle)}
          onFiltre={maj}
          onClose={() => {}} />
      </div>
      <div style={{ width: 340, background: "var(--white, #fff)", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,.06)", overflow: "auto", maxHeight: "94vh" }}>
        <PanneauAjuster sel={img} onUpdate={maj} onClose={() => {}} />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.src} alt="" style={{ width: 300, borderRadius: 12 }} />
    </main>
  );
}
