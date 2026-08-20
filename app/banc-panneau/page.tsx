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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--canvas)" }}>
      <BarreDuHaut />
      <FenetreTaille />
      <div style={{ display: "flex", gap: 0, flex: 1, minHeight: 0 }}>
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
    </div>
  );
}

/* Réplique de la fenêtre de taille personnalisée, pour juger son dessin. */
function FenetreTaille() {
  const [w, setW] = useState(1080);
  const [h, setH] = useState(1920);
  const tailles: [number, number][] = [[1080,1920],[1080,1080],[1080,1350],[1920,1080],[2160,3840],[3840,2160]];
  return (
    <div className="mz-modal-fond" style={{ position: "absolute", inset: "58px 0 0", zIndex: 5 }}>
      <div className="mz-modal">
        <div className="mz-modal-head">
          <h3>Taille personnalisée</h3>
          <button className="mz-modal-x">×</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input className="mz-dim" type="number" value={w} onChange={(e) => setW(Number(e.target.value) || 0)} />
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>×</span>
          <input className="mz-dim" type="number" value={h} onChange={(e) => setH(Number(e.target.value) || 0)} />
          <span className="mz-dim-shape">
            <i style={{ width: w >= h ? 40 : Math.max(6, Math.round((w / Math.max(1, h)) * 40)), height: h >= w ? 40 : Math.max(6, Math.round((h / Math.max(1, w)) * 40)) }} />
          </span>
        </div>
        <div className="mz-dim-presets">
          {tailles.map(([a, b]) => (
            <button key={`${a}x${b}`} className={w === a && h === b ? "on" : ""} onClick={() => { setW(a); setH(b); }}>{a}×{b}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Réplique de la barre du haut du montage, avec les mêmes classes : c'est le
   rendu qu'on juge, et le monteur demande un projet et une session. */
function BarreDuHaut() {
  const [q, setQ] = useState(false);
  const [qualite, setQualite] = useState("standard");
  const qualites = [["low", "Légère (rapide)", "2.5"], ["standard", "Standard", "4.0"], ["high", "Haute qualité", "6.5"]];
  return (
    <div className="ed-topbar" style={{ height: 58, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", borderBottom: "1px solid rgba(122,105,232,.20)", background: "radial-gradient(120% 130% at 0% 0%, rgba(122,105,232,.24), transparent 55%), radial-gradient(90% 130% at 100% 0%, rgba(156,140,255,.12), transparent 60%), linear-gradient(90deg, #1E1846 0%, var(--forest) 50%, #171238 100%)", position: "relative", zIndex: 30 }}>
      <a className="mz-top" style={{ flexShrink: 0 }}>‹ Composer</a>
      <span style={{ width: 1, height: 24, background: "var(--line)", flexShrink: 0 }} />
      <div style={{ display: "flex", gap: 2 }}>
        <button className="mz-top mz-top-icon">↺</button>
        <button className="mz-top mz-top-icon" disabled>↻</button>
      </div>
      <span style={{ width: 1, height: 24, background: "var(--line)", flexShrink: 0 }} />
      <div className="mz-fmt">
        {["9:16", "1:1", "4:5", "16:9", "Custom"].map((f, i) => <button key={f} className={i === 0 ? "on" : ""}>{f}</button>)}
      </div>
      <div style={{ flex: 1 }} />
      <a className="mz-top">Voir l&apos;export</a>
      <button className="mz-top">Couverture</button>
      <div className="mz-drop">
        <button className="mz-top" onClick={() => setQ((v) => !v)}>
          {qualites.find((x) => x[0] === qualite)?.[1]} <span style={{ fontSize: 9, opacity: .7 }}>▼</span>
        </button>
        {q && (
          <div className="mz-drop-menu">
            {qualites.map(([id, nom, deb]) => (
              <button key={id} className={"mz-drop-item" + (qualite === id ? " on" : "")} onClick={() => { setQualite(id); setQ(false); }}>
                <span>{nom}</span><span className="mz-drop-sub">{deb} Mb/s</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="mz-top">Exporter</button>
      <button className="mz-top mz-top-primary">Planifier</button>
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
      padding: `${look.padY * unit}px ${look.padX * unit}px`,
      borderRadius: look.bg !== "transparent" ? (look.pill ? 999 : look.radius * unit) : undefined,
      width: mod.titleBoxWidth(tt, 360) * unit, whiteSpace: "pre",
    }}>
      <span>{mod.titleLines(tt, 360).map((ln) => mod.applySubCase(ln, look.caseMode)).join("\n")}</span>
    </div>
  );
}
