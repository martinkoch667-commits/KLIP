// Stickers décoratifs die-cut — repris de la landing v3 (composant Stk).
// Contour blanc via paintOrder:stroke, couleurs de la DA (leaf/violet/mint/rose).
// Version app : purement décorative (pas de drag/GSAP), float CSS léger via les
// classes .stk-floatA / .stk-floatB / .stk-spin définies dans globals.css.
import React from "react";

export type StickerName = "sparkle" | "eyes" | "smiley" | "flower" | "bolt" | "heart" | "star" | "at";

export function Sticker({ name, size = 56, style, className, float }: {
  name: StickerName;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
  /** animation légère optionnelle */
  float?: "A" | "B" | "spin";
}) {
  const anim = float === "A" ? " stk-floatA" : float === "B" ? " stk-floatB" : float === "spin" ? " stk-spin" : "";
  const cls = `stk${anim}${className ? " " + className : ""}`;
  const outline = { stroke: "#fff", strokeWidth: 14, strokeLinejoin: "round" as const, paintOrder: "stroke" as const };
  const sharp = { stroke: "#fff", strokeWidth: 11, strokeLinejoin: "miter" as const, strokeMiterlimit: 14, paintOrder: "stroke" as const };
  const common = { className: cls, style, "aria-hidden": true as const };
  switch (name) {
    case "sparkle":
      return <svg {...common} width={size} height={size} viewBox="-8 -8 116 116" overflow="visible"><path d="M50 0 C56 32 68 44 100 50 C68 56 56 68 50 100 C44 68 32 56 0 50 C32 44 44 32 50 0 Z" fill="#BDF2A0" {...sharp} /></svg>;
    case "eyes":
      return (
        <svg {...common} width={size} height={size * 0.72} viewBox="0 0 140 100">
          <g transform="rotate(-10 70 50)">
            <ellipse cx="45" cy="50" rx="27" ry="36" fill="#6656D9" {...outline} />
            <ellipse cx="95" cy="50" rx="27" ry="36" fill="#6656D9" {...outline} />
            <g className="stk-eyes-pupils">
              <ellipse cx="41" cy="44" rx="11" ry="14" fill="#fff" />
              <ellipse cx="91" cy="44" rx="11" ry="14" fill="#fff" />
            </g>
          </g>
        </svg>
      );
    case "smiley":
      return (
        <svg {...common} width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="#BDF2A0" {...outline} />
          <circle cx="37" cy="42" r="5.5" fill="#1E3317" /><circle cx="63" cy="42" r="5.5" fill="#1E3317" />
          <path d="M32 58 Q50 76 68 58" fill="none" stroke="#1E3317" strokeWidth="6" strokeLinecap="round" />
        </svg>
      );
    case "flower":
      return (
        <svg {...common} width={size} height={size} viewBox="0 0 100 100">
          <g {...{ stroke: "#fff", strokeWidth: 12, strokeLinejoin: "round" as const, paintOrder: "stroke" as const }}>
            {[0, 60, 120, 180, 240, 300].map(a => <ellipse key={a} cx="50" cy="26" rx="13" ry="22" fill="#2FD79B" transform={`rotate(${a} 50 50)`} />)}
          </g>
          <circle cx="50" cy="50" r="11" fill="#072117" />
        </svg>
      );
    case "bolt":
      return <svg {...common} width={size} height={size} viewBox="0 0 100 100"><path d="M58 6 L22 56 h20 L40 94 L78 42 H56 Z" fill="#6656D9" {...outline} /></svg>;
    case "heart":
      return <svg {...common} width={size} height={size} viewBox="0 0 100 100"><path d="M50 88 C20 66 8 48 12 32 C15 18 32 12 43 22 L50 30 L57 22 C68 12 85 18 88 32 C92 48 80 66 50 88 Z" fill="#FF7BAC" {...outline} /></svg>;
    case "star":
      return <svg {...common} width={size} height={size} viewBox="-8 -8 116 116" overflow="visible"><path d="M50 6 L61 38 L95 38 L67 58 L78 92 L50 71 L22 92 L33 58 L5 38 L39 38 Z" fill="#BDF2A0" {...sharp} /></svg>;
    case "at":
      return (
        <svg {...common} width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="41" fill="#2FD79B" {...outline} />
          <text x="50" y="66" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="800" fontSize="52" fill="#072117">@</text>
        </svg>
      );
    default:
      return null;
  }
}

export default Sticker;
