"use client";

/* Banc d'essai des effets d'incrustation : page temporaire, hors du produit.
 *
 * Un effet n'a de valeur que s'il sort de l'export tel qu'on l'a vu dans le
 * monteur. Or les deux chemins n'ont rien en commun : l'aperçu empile des
 * filtres CSS sur un élément du DOM, l'export compose sur un canvas 2D. Deux
 * implémentations d'une même intention, donc deux occasions de diverger.
 *
 * Cette page les met côte à côte, au même instant et à la même taille : à
 * gauche l'aperçu (DOM), à droite le rendu d'export (le VRAI drawOverlayFrame).
 * Si les deux images ne se superposent pas, l'effet n'est pas bon.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { OverlayClip, overlayEffectCss, overlayFilterCss, OVERLAY_EFFECT_PRESETS } from "../workspace/[id]/montage/[postId]/constants";
import { drawOverlayFrame, setCanvasSize } from "../workspace/[id]/montage/[postId]/render-core";

const W = 360, H = 640; // cadre de comparaison (9:16 réduit)

/** Une découpe PNG avec de la transparence : c'est le cas qui compte, une ombre
 *  doit suivre la forme et pas le rectangle de l'image. */
function imageDecoupee(): string {
  const c = document.createElement("canvas");
  c.width = 300; c.height = 300;
  const x = c.getContext("2d")!;
  x.fillStyle = "#2FD79B";
  x.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
    x.moveTo(150, 150);
    x.arc(150 + Math.cos(a) * 60, 150 + Math.sin(a) * 60, 52, 0, Math.PI * 2);
  }
  x.fill();
  x.fillStyle = "#0C2A1D";
  x.beginPath(); x.arc(150, 150, 40, 0, Math.PI * 2); x.fill();
  return c.toDataURL("image/png");
}

/** Un rectangle plein : c'est le cas des coins arrondis et du cadre. */
function imagePleine(): string {
  const c = document.createElement("canvas");
  c.width = 300; c.height = 200;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 300, 200);
  g.addColorStop(0, "#7A69E8"); g.addColorStop(1, "#F2A03D");
  x.fillStyle = g; x.fillRect(0, 0, 300, 200);
  x.fillStyle = "#fff"; x.font = "700 34px system-ui"; x.textAlign = "center";
  x.fillText("PIP", 150, 112);
  return c.toDataURL("image/png");
}

function overlayDeTest(src: string, patch: Partial<OverlayClip>): OverlayClip {
  return {
    id: "o", kind: "photo", name: "test", src, srcDur: 5,
    trimStart: 0, trimEnd: 5, offset: 0, track: 0,
    x: 50, y: 50, scale: 1, rotation: 0, opacity: 1,
    filterId: "none", lum: 0, con: 0, sat: 0,
    ...patch,
  };
}

export default function BancEffets() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <BancEffetsDev />;
}

function BancEffetsDev() {
  const [srcs, setSrcs] = useState<{ decoupe: string; plein: string } | null>(null);
  useEffect(() => { setSrcs({ decoupe: imageDecoupee(), plein: imagePleine() }); }, []);

  const cas = srcs ? [
    ...OVERLAY_EFFECT_PRESETS.map((p) => ({ nom: p.id, src: p.id === "card" ? srcs.plein : srcs.decoupe, o: overlayDeTest(p.id === "card" ? srcs.plein : srcs.decoupe, p.patch) })),
    { nom: "ombre + rotation", src: srcs.decoupe, o: overlayDeTest(srcs.decoupe, { shadow: true, shadowBlur: 6, shadowX: 3, shadowY: 4, shadowOpacity: 0.6, rotation: -18 }) },
    { nom: "ombre + opacité 50 %", src: srcs.decoupe, o: overlayDeTest(srcs.decoupe, { shadow: true, shadowBlur: 6, shadowX: 3, shadowY: 4, shadowOpacity: 0.6, opacity: 0.5 }) },
    { nom: "coins + contour", src: srcs.plein, o: overlayDeTest(srcs.plein, { radius: 10, outlineW: 2.5, outlineColor: "#FFFFFF", shadow: true, shadowBlur: 7, shadowY: 3, shadowOpacity: 0.5 }) },
  ] : [];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, color: "#111" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Effets d&apos;incrustation : aperçu contre export</h1>
      <p style={{ color: "#555", maxWidth: 760 }}>
        À gauche l&apos;aperçu du monteur (filtres CSS sur le DOM), à droite le rendu d&apos;export
        (<code>drawOverlayFrame</code> sur canvas). Les deux doivent se superposer.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 26, marginTop: 20 }}>
        {cas.map((c, i) => <Paire key={i} nom={c.nom} o={c.o} />)}
      </div>
    </div>
  );
}

function Paire({ nom, o }: { nom: string; o: OverlayClip }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ecartRef = useRef<HTMLCanvasElement>(null);

  const peindre = useCallback(() => {
    const img = new Image();
    img.onload = () => {
      for (const cv of [canvasRef.current, ecartRef.current]) {
        if (!cv) continue;
        const ctx = cv.getContext("2d")!;
        setCanvasSize(W, H);
        ctx.fillStyle = "#F4F4F7";
        ctx.fillRect(0, 0, W, H);
        drawOverlayFrame(ctx, img, o);
      }
    };
    img.src = o.src;
  }, [o]);
  useEffect(() => { peindre(); }, [peindre]);

  // Aperçu DOM : mêmes règles que le monteur (cf. mz-pip dans page.tsx).
  const largeurPx = W * 0.5 * o.scale;
  const eff = overlayEffectCss(o, largeurPx);
  const rayon = (o.radius ?? 0) > 0 ? `${((o.radius ?? 0) / 100) * largeurPx}px` : undefined;

  const apercuDom = (
    <div style={{ position: "absolute", inset: 0, transform: "scale(0.5)", transformOrigin: "top left", width: W, height: H }}>
      <div style={{
        position: "absolute", left: o.x + "%", top: o.y + "%", width: 50 * o.scale + "%",
        transform: `translate(-50%,-50%) rotate(${o.rotation}deg)`, opacity: o.opacity,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={o.src} alt="" style={{
          width: "100%", display: "block",
          filter: [overlayFilterCss(o), eff].filter(Boolean).join(" ") || undefined,
          borderRadius: rayon,
        }} />
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{nom}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ position: "relative", width: W / 2, height: H / 2, background: "#F4F4F7", overflow: "hidden" }}>
          {apercuDom}
          <span style={etiquette}>aperçu</span>
        </div>
        <div style={{ position: "relative" }}>
          <canvas ref={canvasRef} width={W} height={H} style={{ width: W / 2, height: H / 2, display: "block" }} />
          <span style={etiquette}>export</span>
        </div>
        {/* Écart : les deux superposés en mode « différence ». Tout ce qui n'est
            pas noir est un désaccord entre l'aperçu et l'export. */}
        <div style={{ position: "relative", width: W / 2, height: H / 2, background: "#F4F4F7", overflow: "hidden", isolation: "isolate" }}>
          {apercuDom}
          <canvas ref={ecartRef} width={W} height={H}
            style={{ position: "absolute", inset: 0, width: W / 2, height: H / 2, mixBlendMode: "difference" }} />
          <span style={etiquette}>écart</span>
        </div>
      </div>
    </div>
  );
}

const etiquette: React.CSSProperties = {
  position: "absolute", bottom: 4, left: 4, fontSize: 9, fontWeight: 800,
  fontFamily: "monospace", color: "#fff", background: "rgba(0,0,0,.55)",
  padding: "1px 5px", borderRadius: 3,
};
