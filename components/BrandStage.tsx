"use client";
import React from "react";

// ─── Plateau de composition ──────────────────────────────────────────────────
// Colonne de droite du parcours « nouveau client ». Son rôle n'est pas décoratif :
// il transforme « remplir un formulaire » en « voir la marque apparaître ». Ce
// qu'on tape à gauche s'assemble ici en direct — nom, couleurs, logo, typo — sur
// un vrai visuel au format Instagram.
//
// Le vocabulaire vient de la landing : fond forest, cadre de sélection en
// pointillés animés (« fourmis »), curseur collaboratif étiqueté, cartes
// flottantes inclinées, étoiles à quatre branches.

export interface StageProps {
  step: number;
  name: string;
  sector?: string;
  handle?: string;
  description?: string;
  tone?: string;
  primary: string;
  secondary: string;
  accent: string;
  logo?: string | null;
  fontPrimary: string;
  fontSecondary?: string;
  templatesCount?: number;
}

const STEP_TAG = ["", "Le client", "Sa voix", "Sa charte", "Sa typo", "Ses modèles"];

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const inkOn = (bg: string) => (luminance(bg) > 0.5 ? "#14160F" : "#F4EDE4");

export default function BrandStage(p: StageProps) {
  const brandName = p.name.trim() || "Votre client";
  const onPrimary = inkOn(p.primary);

  return (
    <div className="brandstage">
      <div className="bs-inner">
        <div className="bs-head">
          <span className="bs-dot" />
          {STEP_TAG[p.step] || "Aperçu"}
          <span className="bs-live">en direct</span>
        </div>

        {/* Décors de la landing */}
        <svg className="bs-star bs-star-a" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10Z" fill="#BDF2A0" /></svg>
        <svg className="bs-star bs-star-b" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10Z" fill="#6656D9" /></svg>

        {/* La composition — ce qu'on remplit à gauche se voit ici */}
        <div className="bs-frame">
          <div className="bs-post" style={{ background: p.primary }}>
            {p.step >= 3 && p.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logo} alt="" className="bs-logo" />
            )}

            <div className="bs-post-body">
              <span className="bs-eyebrow" style={{ color: p.accent }}>
                {p.sector?.trim() || "Votre secteur"}
              </span>
              <span
                className="bs-title"
                style={{ color: onPrimary, fontFamily: `"${p.fontPrimary}", var(--display), sans-serif` }}
              >
                {brandName}
              </span>
              {p.step >= 2 && (
                <span
                  className="bs-sub"
                  style={{ color: onPrimary, opacity: .78, fontFamily: `"${p.fontSecondary || p.fontPrimary}", var(--sans), sans-serif` }}
                >
                  {p.description?.trim() || p.tone?.trim() || "La voix de la marque, en une ligne."}
                </span>
              )}
            </div>

            {p.step >= 3 && (
              <span className="bs-badge" style={{ background: p.accent, color: inkOn(p.accent) }}>
                {p.handle?.trim() ? `@${p.handle.trim().replace(/^@/, "")}` : "@votrecompte"}
              </span>
            )}
          </div>

          {/* Cadre de sélection façon logiciel de design */}
          <svg className="bs-ants" aria-hidden="true"><rect x="1" y="1" rx="10" /></svg>

          <div className="bs-cursor" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M3.5 2.2 L11 20.5 L13.6 12.6 L21.5 10 Z" fill="#6656D9" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            <span className="bs-cursor-tag">Klip</span>
          </div>
        </div>

        {/* Palette — apparaît quand la charte entre en jeu */}
        {p.step >= 3 && (
          <div className="bs-swatches">
            {[p.primary, p.secondary, p.accent].map((c, i) => (
              <span key={i} className="bs-swatch" style={{ background: c }} title={c} />
            ))}
          </div>
        )}

        {/* Spécimen typographique */}
        {p.step >= 4 && (
          <div className="bs-card bs-card-leaf">
            <span style={{ fontFamily: `"${p.fontPrimary}", serif`, fontSize: 26, fontWeight: 800, lineHeight: 1 }}>Aa</span>
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <strong style={{ fontSize: 12.5 }}>{p.fontPrimary}</strong>
              <span style={{ fontSize: 11, opacity: .7 }}>la typo de la marque</span>
            </span>
          </div>
        )}

        {p.step >= 5 && (
          <div className="bs-card bs-card-forest">
            {(p.templatesCount ?? 0) > 0
              ? `${p.templatesCount} modèle${(p.templatesCount ?? 0) > 1 ? "s" : ""} prêt${(p.templatesCount ?? 0) > 1 ? "s" : ""}`
              : "Choisissez ses modèles"}
          </div>
        )}
      </div>

      <style>{`
        .brandstage {
          position: sticky; top: 0; align-self: start;
          height: 100vh; overflow: hidden;
          background: #0C2A1D;
          display: grid; place-items: center;
          font-family: var(--sans), system-ui, sans-serif;
        }
        .bs-inner { position: relative; width: 300px; display: flex; flex-direction: column; align-items: center; gap: 16px; }

        .bs-head {
          display: flex; align-items: center; gap: 7px;
          font-size: 10.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
          color: rgba(238,237,227,.62);
        }
        .bs-dot { width: 6px; height: 6px; border-radius: 50%; background: #2FD79B; }
        .bs-live { color: #2FD79B; letter-spacing: .1em; }

        .bs-frame { position: relative; width: 244px; }
        .bs-post {
          width: 244px; aspect-ratio: 4 / 5; border-radius: 12px;
          position: relative; overflow: hidden;
          display: flex; flex-direction: column; justify-content: flex-end;
          padding: 20px; transition: background .3s ease;
          box-shadow: 0 26px 50px -22px rgba(0,0,0,.7);
        }
        .bs-logo { position: absolute; top: 16px; left: 20px; height: 26px; width: auto; max-width: 90px; object-fit: contain; }
        .bs-post-body { display: flex; flex-direction: column; gap: 6px; }
        .bs-eyebrow { font-size: 10px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
        .bs-title { font-size: 30px; font-weight: 800; letter-spacing: -.02em; line-height: 1.02; word-break: break-word; }
        .bs-sub { font-size: 12px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .bs-badge {
          position: absolute; top: 16px; right: 16px;
          font-size: 10.5px; font-weight: 800; padding: 4px 9px; border-radius: 99px;
        }

        .bs-ants { position: absolute; inset: -7px; width: calc(100% + 14px); height: calc(100% + 14px); overflow: visible; pointer-events: none; }
        .bs-ants rect {
          width: calc(100% - 2px); height: calc(100% - 2px);
          fill: none; stroke: #6656D9; stroke-width: 2; stroke-dasharray: 8 7;
          animation: bs-ants 1.2s linear infinite;
        }
        @keyframes bs-ants { to { stroke-dashoffset: -15; } }

        .bs-cursor {
          position: absolute; right: -30px; bottom: 34px;
          display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
          pointer-events: none; filter: drop-shadow(0 6px 14px rgba(0,0,0,.4));
          animation: bs-drift 9s ease-in-out infinite;
        }
        .bs-cursor-tag {
          font-size: 10.5px; font-weight: 800; color: #fff; background: #6656D9;
          padding: 3px 8px; border-radius: 999px 999px 999px 4px; margin-left: 12px;
        }
        @keyframes bs-drift { 0%,100% { transform: translate(0,0); } 45% { transform: translate(-12px,-16px); } }

        .bs-swatches { display: flex; gap: 7px; }
        .bs-swatch { width: 30px; height: 30px; border-radius: 8px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.22); }

        .bs-card {
          display: inline-flex; align-items: center; gap: 10px;
          border-radius: 12px; padding: 9px 13px; font-weight: 800; font-size: 12.5px;
          box-shadow: 0 16px 32px -18px rgba(0,0,0,.6);
        }
        .bs-card-leaf { background: #BDF2A0; color: #1E3317; transform: rotate(-3deg); }
        .bs-card-forest { background: rgba(238,237,227,.1); color: #EEEDE3; transform: rotate(2deg); box-shadow: inset 0 0 0 1px rgba(238,237,227,.16); }

        .bs-star { position: absolute; }
        .bs-star-a { top: -14px; right: -6px; animation: bs-float 7s ease-in-out infinite; }
        .bs-star-b { bottom: 40px; left: -22px; animation: bs-float 6s ease-in-out infinite reverse; }
        @keyframes bs-float { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-12px) rotate(8deg); } }

        @media (prefers-reduced-motion: reduce) {
          .bs-ants rect, .bs-cursor, .bs-star { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
