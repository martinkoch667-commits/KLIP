"use client";

/* Banc d'essai du panneau Texte : page temporaire, hors du produit.
 *
 * Le reproche portait sur l'interface elle-même : de gros boutons là où tout le
 * monde attend de petits carrés à icône, et des commandes qu'on ne reconnaît
 * pas. C'est un jugement qui se porte à l'oeil, pas à la mesure — encore
 * faut-il pouvoir regarder le panneau. Le monteur demande un projet et une
 * session ; le panneau, lui, n'est qu'un composant. On le monte donc seul, avec
 * un titre bidon et une charte bidon.
 */

import React, { useEffect, useState } from "react";
import { TextPanel } from "../workspace/[id]/montage/[postId]/panels";
import type { MontageCtx } from "../workspace/[id]/montage/[postId]/panels";
import type { TitleEl } from "../workspace/[id]/montage/[postId]/constants";

export default function BancPanneau() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <BancPanneauDev />;
}

function BancPanneauDev() {
  const [titles, setTitles] = useState<TitleEl[]>([{
    id: "t1", start: 0, end: 5, text: "CECI EST UN TEST", font: "archivo",
    color: "#FFFFFF", anim: "rise", x: 50, y: 50, scale: 1, rotation: 0,
  }]);

  const ctx = {
    titles,
    total: 12,
    // Charte bidon, aux couleurs d'un client imaginaire.
    brandColors: ["#E0563F", "#FFFFFF", "#3B7FC4"],
    brandFonts: ["Poppins", "Playfair Display"],
    addTitle: () => {},
    removeTitle: () => {},
    updateTitle: (id: string, patch: Partial<TitleEl>) =>
      setTitles((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x))),
  } as unknown as MontageCtx;

  const tt = titles[0];
  // L'aperçu mesure le texte sur un canvas, qui n'existe pas côté serveur :
  // rendu tout de suite, il ne correspondrait pas au HTML envoyé.
  const [monte, setMonte] = useState(false);
  useEffect(() => { setMonte(true); }, []);
  return (
    <div style={{ display: "flex", gap: 0, height: "100vh", background: "var(--canvas)" }}>
      <div className="a-panel" style={{ width: 340, flexShrink: 0, borderRight: "1px solid var(--line)" }}>
        <div className="a-panel-head"><span className="a-panel-title">Texte &amp; titres</span></div>
        <div className="a-panel-scroll">
          <TextPanel ctx={ctx} selectedTitleId="t1" />
        </div>
      </div>

      {/* Aperçu du rendu, pour juger les réglages autant que l'interface. */}
      <div style={{ flex: 1, display: "grid", placeItems: "center", background: "#2A2A34", padding: 30 }}>
        <div style={{ position: "relative", width: 360, height: 640, background: "#3A3A46", borderRadius: 12, overflow: "hidden" }}>
          {monte && <Apercu tt={tt} />}
        </div>
      </div>
    </div>
  );
}

function Apercu({ tt }: { tt: TitleEl }) {
  // Même balisage que l'aperçu du monteur.
  const mod = require("../workspace/[id]/montage/[postId]/constants") as typeof import("../workspace/[id]/montage/[postId]/constants");
  const look = mod.titleLook(tt);
  const f = mod.FONT_CHOICES.find((c) => c.id === tt.font) || mod.FONT_CHOICES[0];
  const unit = tt.scale ?? 1;
  return (
    <div style={{
      position: "absolute", left: tt.x + "%", top: tt.y + "%",
      transform: `translate(-50%,-50%) rotate(${tt.rotation ?? 0}deg)`,
      fontFamily: tt.fontFamily ? `'${tt.fontFamily}', sans-serif` : f.css,
      fontWeight: mod.titleWeight(tt), fontStyle: mod.titleItalic(tt) ? "italic" : "normal",
      color: look.fg, fontSize: mod.TITLE_BASE_FONT * unit, lineHeight: mod.TITLE_LINE_HEIGHT,
      textAlign: look.align,
      textShadow: mod.titleShadowCss(tt, unit),
      WebkitTextStroke: look.stroke && look.strokeW > 0 ? `${look.strokeW * unit}px ${look.stroke}` : undefined,
      paintOrder: "stroke fill",
      opacity: look.opacity,
      letterSpacing: look.letterSpacing ? `${look.letterSpacing}em` : undefined,
      background: look.bg !== "transparent" ? mod.withAlpha(look.bg, look.bgOpacity) : undefined,
      padding: look.bg !== "transparent" ? `${look.padY * unit}px ${look.padX * unit}px` : undefined,
      borderRadius: look.bg !== "transparent" ? (look.pill ? 999 : look.radius * unit) : undefined,
      width: (tt.maxWidth ?? mod.TITLE_DEFAULT_MAX_WIDTH) + "%", whiteSpace: "pre-wrap",
    }}>
      <span>{mod.titleLines(tt, 360).map((ln) => mod.applySubCase(ln, look.caseMode)).join("\n")}</span>
    </div>
  );
}
