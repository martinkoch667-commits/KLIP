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
import { OverlayClip, TitleEl, overlayEffectCss, overlayFilterCss, OVERLAY_EFFECT_PRESETS,
  FONT_CHOICES, titleLines, TITLE_BASE_FONT, TITLE_LINE_HEIGHT, TITLE_DEFAULT_MAX_WIDTH,
  titleLook, titleShadowCss, titleWeight, titleItalic, applySubCase, withAlpha, titleBoxWidth } from "../workspace/[id]/montage/[postId]/constants";
import { drawOverlayFrame, drawTitles, setCanvasSize } from "../workspace/[id]/montage/[postId]/render-core";
import { surPolicesChargees } from "../workspace/[id]/montage/[postId]/fonts";

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

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 34 }}>Titres : aperçu contre export</h2>
      <p style={{ color: "#555", maxWidth: 760 }}>
        L&apos;export écrivait le titre d&apos;un seul trait, sans jamais le replier : un titre
        tenant sur trois lignes dans le monteur sortait sur une ligne, hors du cadre. Les
        retours à la ligne doivent tomber au même endroit des deux côtés.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 26, marginTop: 16 }}>
        {/* Après montage seulement : le découpage en lignes se mesure sur un
            canvas, qui n'existe pas côté serveur. */}
        {srcs && TITRES_TEST.map((tt, i) => <PaireTitre key={i} nom={tt.nom} tt={tt.tt} />)}
      </div>
    </div>
  );
}

function titreDeTest(patch: Partial<TitleEl>): TitleEl {
  return {
    id: "t", start: 0, end: 5, text: "CECI EST UN TEST", font: "archivo",
    color: "#FFFFFF", anim: "rise", x: 50, y: 50, scale: 1, rotation: 0, ...patch,
  };
}

const TITRES_TEST = [
  { nom: "largeur 80 % (défaut)", tt: titreDeTest({}) },
  { nom: "largeur 100 %", tt: titreDeTest({ maxWidth: 100 }) },
  { nom: "largeur 40 %", tt: titreDeTest({ maxWidth: 40 }) },
  { nom: "texte long, taille 1,4", tt: titreDeTest({ text: "UN TITRE NETTEMENT PLUS LONG QUE LE CADRE", scale: 1.4, maxWidth: 90 }) },
  { nom: "police serif, retour à la ligne tapé", tt: titreDeTest({ text: "PREMIERE LIGNE\ndeuxieme ligne plus longue", font: "instrument", scale: 1.1 }) },
  // Habillage : chaque réglage doit sortir identique des deux côtés.
  { nom: "contour épais", tt: titreDeTest({ text: "CONTOUR", scale: 1.5, shadow: false, stroke: "#14160F", strokeW: 3 }) },
  { nom: "ombre portée marquée", tt: titreDeTest({ text: "OMBRE PORTEE", scale: 1.2, shadow: true, shadowColor: "#000000", shadowBlur: 2, shadowX: 3, shadowY: 4, shadowOpacity: 0.75 }) },
  { nom: "néon", tt: titreDeTest({ text: "NEON", scale: 1.5, color: "#FFFFFF", shadow: true, shadowColor: "#2FD79B", shadowBlur: 16, shadowX: 0, shadowY: 0, shadowOpacity: 0.95 }) },
  { nom: "fond pilule", tt: titreDeTest({ text: "PILULE", scale: 1.2, color: "#14160F", shadow: false, bg: "#FFFFFF", bgOpacity: 1, pill: true, padX: 22, padY: 11 }) },
  { nom: "bloc, aligné à gauche", tt: titreDeTest({ text: "UN BLOC ALIGNE A GAUCHE", scale: 1, color: "#FFFFFF", shadow: false, bg: "#7A69E8", bgOpacity: 0.9, radius: 8, align: "left", maxWidth: 70 }) },
  { nom: "majuscules + interlettrage", tt: titreDeTest({ text: "espace entre lettres", scale: 1.1, caseMode: "upper", letterSpacing: 0.18 }) },
  { nom: "opacité 45 %", tt: titreDeTest({ text: "TRANSPARENT", scale: 1.4, opacity: 0.45 }) },
];

function PaireTitre({ nom, tt }: { nom: string; tt: TitleEl }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ecartRef = useRef<HTMLCanvasElement>(null);
  // Comme le monteur : on remesure quand la police est vraiment là.
  const [pretes, setPretes] = useState(0);
  useEffect(() => surPolicesChargees(() => setPretes((n) => n + 1)), []);

  useEffect(() => {
    for (const cv of [canvasRef.current, ecartRef.current]) {
      if (!cv) continue;
      const ctx = cv.getContext("2d")!;
      setCanvasSize(W, H);
      ctx.fillStyle = "#3A3A46";
      ctx.fillRect(0, 0, W, H);
      // t = 1 s : passé l'animation d'entrée, le titre est à pleine opacité.
      drawTitles(ctx, [tt], 1);
    }
  }, [tt, pretes]);

  const f = FONT_CHOICES.find((c) => c.id === tt.font) || FONT_CHOICES[0];
  const look = titleLook(tt);
  const unit = tt.scale ?? 1; // l'aperçu du banc est à l'échelle 1 du cadre
  // Copie conforme du balisage de l'aperçu du monteur (cf. page.tsx).
  const apercuDom = (
    <div style={{ position: "absolute", inset: 0, transform: "scale(0.5)", transformOrigin: "top left", width: W, height: H }}>
      <div style={{
        position: "absolute", left: tt.x + "%", top: tt.y + "%",
        transform: `translate(-50%,-50%) rotate(${tt.rotation ?? 0}deg)`,
        fontFamily: tt.fontFamily ? `'${tt.fontFamily}', sans-serif` : f.css,
        fontWeight: titleWeight(tt), fontStyle: titleItalic(tt) ? "italic" : "normal",
        color: look.fg, fontSize: TITLE_BASE_FONT * (tt.scale ?? 1),
        lineHeight: TITLE_LINE_HEIGHT,
        textAlign: look.align,
        textShadow: titleShadowCss(tt, unit),
        WebkitTextStroke: look.stroke && look.strokeW > 0 ? `${look.strokeW * unit}px ${look.stroke}` : undefined,
        paintOrder: "stroke fill",
        opacity: look.opacity,
        letterSpacing: look.letterSpacing ? `${look.letterSpacing}em` : undefined,
        background: look.bg !== "transparent" ? withAlpha(look.bg, look.bgOpacity) : undefined,
        padding: `${look.padY * unit}px ${look.padX * unit}px`,
        borderRadius: look.bg !== "transparent" ? (look.pill ? 999 : look.radius * unit) : undefined,
        width: titleBoxWidth(tt, W) * unit, whiteSpace: "pre",
      }}>
        <span>{titleLines(tt, W).map((ln) => applySubCase(ln, look.caseMode)).join("\n")}</span>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{nom}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ position: "relative", width: W / 2, height: H / 2, background: "#3A3A46", overflow: "hidden" }}>
          {apercuDom}<span style={etiquette}>aperçu</span>
        </div>
        <div style={{ position: "relative" }}>
          <canvas ref={canvasRef} width={W} height={H} style={{ width: W / 2, height: H / 2, display: "block" }} />
          <span style={etiquette}>export</span>
        </div>
        <div style={{ position: "relative", width: W / 2, height: H / 2, background: "#3A3A46", overflow: "hidden", isolation: "isolate" }}>
          {apercuDom}
          <canvas ref={ecartRef} width={W} height={H}
            style={{ position: "absolute", inset: 0, width: W / 2, height: H / 2, mixBlendMode: "difference" }} />
          <span style={etiquette}>écart</span>
        </div>
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
