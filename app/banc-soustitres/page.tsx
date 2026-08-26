"use client";

/* Banc d'essai du panneau Sous-titres : page temporaire, hors du produit.
 *
 * Le reproche portait sur la forme du panneau : tout dans un seul défilement,
 * la transcription tout en bas sous une page entière de réglages. La réponse
 * (deux onglets, et un sous-titre sélectionné qui amène à sa ligne) se juge à
 * l'oeil et au clic — encore faut-il pouvoir ouvrir le panneau. Le monteur
 * demande un projet et une session ; le panneau, lui, n'est qu'un composant.
 * On le monte donc seul, avec une transcription bidon assez longue pour que le
 * défilement existe vraiment.
 */

import React, { useState } from "react";
import { CaptionsPanel } from "../workspace/[id]/montage/[postId]/panels";
import type { MontageCtx } from "../workspace/[id]/montage/[postId]/panels";
import type { Caption } from "../workspace/[id]/montage/[postId]/constants";

export default function BancSousTitres() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <BancSousTitresDev />;
}

const PHRASES = [
  "Capcote. regarde", "ça tu", "as juste", "à apporter", "des visuels", "photos et",
  "vidéos et", "ensuite", "de générer", "des visuels", "évidemment", "les", "c", "Canva",
  "c", "d", "s", "comme ça.", "en fait", "tu vois", "c'est plus", "simple", "au final",
  "voilà",
];

function BancSousTitresDev() {
  const [captions, setCaptions] = useState<Caption[]>(() =>
    PHRASES.map((text, i) => ({ id: `c${i}`, start: i * 1.1, end: i * 1.1 + 0.9, text })),
  );
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [seekedTo, setSeekedTo] = useState<number | null>(null);
  const [subStyleId, setSubStyleId] = useState("classique");

  const ctx = {
    clips: [{ kind: "video" }],
    captions,
    subStyleId,
    subMaxWords: 4,
    subCustom: {},
    subPos: { x: 50, y: 78 },
    linkedSubs: true,
    capSelectedCount: 0,
    selectedCaptionId,
    hasRawSegments: true,
    transcribing: false,
    brandColors: ["#E0563F", "#FFFFFF", "#3B7FC4"],
    brandFonts: ["Poppins", "Playfair Display"],
    setSelectedCaptionId,
    seek: (t: number) => setSeekedTo(t),
    setLinkedSubs: () => {},
    setSubStyleId,
    setCaptionLength: () => {},
    setSubCustom: () => {},
    resetSubCustom: () => {},
    applySubTemplate: () => {},
    generateCaptionsAI: () => {},
    addCaption: () => {},
    removeCaption: (id: string) => setCaptions((prev) => prev.filter((c) => c.id !== id)),
    updateCaption: (id: string, patch: Partial<Caption>) =>
      setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    toast: () => {},
  } as unknown as MontageCtx;

  return (
    <div style={{ height: "100vh", display: "flex", background: "var(--canvas)" }}>
      <div className="a-panel" style={{ width: 340, flexShrink: 0, borderRight: "1px solid var(--line)" }}>
        <div className="a-panel-head"><span className="a-panel-title">Sous-titres</span></div>
        <div className="a-panel-scroll">
          <CaptionsPanel ctx={ctx} />
        </div>
      </div>

      {/* Tient lieu de timeline : cliquer une pastille sélectionne le sous-titre,
          exactement comme un clic sur son bloc dans la piste S-TITRES. */}
      <div style={{ flex: 1, padding: 24, overflow: "auto" }}>
        <p style={{ fontFamily: "system-ui", fontSize: 13, marginBottom: 12 }}>
          Cliquez une pastille : le panneau doit basculer sur Transcription et faire défiler jusqu&apos;à la ligne.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {captions.map((c) => (
            <button key={c.id} onClick={() => setSelectedCaptionId(c.id)}
              style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer",
                border: selectedCaptionId === c.id ? "2px solid #6C4CF1" : "1px solid #ccc",
                background: selectedCaptionId === c.id ? "#EFEAFE" : "#fff", fontSize: 12 }}>
              {c.text}
            </button>
          ))}
        </div>
        <pre id="banc-etat" style={{ fontFamily: "ui-monospace", fontSize: 12 }}>
          {JSON.stringify({ selectedCaptionId, seekedTo }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
