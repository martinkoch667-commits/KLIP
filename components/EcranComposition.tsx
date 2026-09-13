"use client";

import React, { useEffect, useRef, useState } from 'react';

// ─── Écran de composition IA ─────────────────────────────────────────────────
//
// LA TRAME QUI S'EFFACE. Piste retenue après six essais (cf. /banc-trame) :
// l'écran est une trame de points crème sur fond forêt, et c'est le VIDE qui
// dessine le visuel. Les points s'effacent zone par zone, l'image naît du
// creux. On ne montre pas une machine qui travaille, et surtout pas une
// maquette en carton avec un curseur qui fait semblant : on montre une page
// qui se dégage.
//
// Dessiné sur un CANEVAS et non en DOM : une trame plein écran, c'est deux
// mille points ; deux mille noeuds animés pendant qu'une composition tourne,
// c'est la machine qui rame au pire moment.
const GEN_STEPS = [
  'On lit votre photo',
  'La charte du client s’applique',
  'Le titre trouve sa place',
  'Les marges se recalent',
  'Les couleurs de la marque arrivent',
];

export default function AiGeneratingOverlay({ title, detail }: {
  title: string;
  detail?: string;
  /** Le journal de l'IA n'est plus affiché : une phrase vaut mieux qu'une
   *  liste de traces techniques pendant qu'on attend. Le paramètre reste pour
   *  les appelants existants. */
  lines?: string[];
}) {
  const [etape, setEtape] = useState(0);
  const toileRef = useRef<HTMLCanvasElement>(null);
  const avanceeRef = useRef(0);      // progression lissée, 0 → 1
  const cibleRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setEtape(e => (e + 1) % GEN_STEPS.length), 1600);
    return () => clearInterval(id);
  }, []);
  cibleRef.current = (etape + 1) / GEN_STEPS.length;

  useEffect(() => {
    const toile = toileRef.current;
    if (!toile) return;
    const ctx = toile.getContext('2d');
    if (!ctx) return;
    let vivant = true;
    let trame = 0;

    const PAS = 26;          // écart entre deux points
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let l = 0, h = 0;
    const redimensionner = () => {
      l = toile.clientWidth; h = toile.clientHeight;
      toile.width = Math.round(l * dpr); toile.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    redimensionner();
    window.addEventListener('resize', redimensionner);

    const dessiner = (t: number) => {
      if (!vivant) return;
      // La progression rattrape sa cible en douceur : les étapes sautent, le
      // dessin non.
      avanceeRef.current += (cibleRef.current - avanceeRef.current) * 0.045;
      const p = avanceeRef.current;

      // La page qui se dégage : un rectangle 4:5 centré, jamais plus large que
      // le tiers de l'écran.
      const pageL = Math.min(320, l * 0.34, h * 0.336);
      const pageH = pageL * 1.25;
      const px = (l - pageL) / 2, py = (h - pageH) / 2 - Math.min(60, h * 0.07);

      ctx.clearRect(0, 0, l, h);
      const cols = Math.ceil(l / PAS) + 1;
      const ligs = Math.ceil(h / PAS) + 1;
      for (let j = 0; j < ligs; j++) {
        for (let i = 0; i < cols; i++) {
          const x = i * PAS + PAS / 2;
          const y = j * PAS + PAS / 2;
          const dansPage = x > px && x < px + pageL && y > py && y < py + pageH;
          // Le creux se propage du haut vers le bas de la page.
          const avanceeLocale = dansPage ? Math.min(1, Math.max(0, (p * pageH * 1.25 - (y - py)) / 40)) : 0;
          // Respiration très lente : sans elle, entre deux étapes, l'écran
          // paraît figé — et un écran figé passe pour un écran planté.
          const souffle = (Math.sin((x * 0.012 + y * 0.018) - t / 900) + 1) / 2;
          const taille = (1.7 + souffle * 1.5) * (1 - avanceeLocale * 0.75);
          const alpha = (0.10 + souffle * 0.17) * (1 - avanceeLocale * 0.96);
          if (alpha <= 0.004 || taille <= 0.05) continue;
          ctx.beginPath();
          ctx.arc(x, y, taille, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(245,240,232,${alpha.toFixed(3)})`;
          ctx.fill();
        }
      }
      trame = requestAnimationFrame(dessiner);
    };
    trame = requestAnimationFrame(dessiner);
    return () => { vivant = false; cancelAnimationFrame(trame); window.removeEventListener('resize', redimensionner); };
  }, []);

  return (
    <div className="klipgen" role="status" aria-live="polite">
      <canvas ref={toileRef} className="klipgen-toile" aria-hidden="true" />
      <div className="klipgen-copy">
        {/* La marque, tracée en boucle : le signe s'écrit, se pose, recommence.
            Un logo qui se dessine occupe l'attente sans la commenter. */}
        <span className="klipgen-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--leaf, #BDF2A0)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            {/* Un arc qui tourne, plutôt qu'un cercle complet : un cercle qui
                pivote ne se voit pas bouger. */}
            <circle className="klipgen-arc" cx="12" cy="12" r="10.4" strokeWidth="1.1" />
            {/* La baguette se trace d'un seul geste : un seul sous-tracé, donc
                un vrai tiret qui court. L'ancienne version animait les sept
                segments d'un coup, ce qui donnait des bouts épars. */}
            <path className="klipgen-baguette" d="M4 21l10-10" />
            <g className="klipgen-etincelles">
              <path style={{ animationDelay: '.42s' }} d="M15 4V2" />
              <path style={{ animationDelay: '.50s' }} d="M20 9h2" />
              <path style={{ animationDelay: '.58s' }} d="M15 14v-2" />
              <path style={{ animationDelay: '.66s' }} d="M8 9h2" />
              <path style={{ animationDelay: '.74s' }} d="M17.6 6.4l1.4-1.4" />
              <path style={{ animationDelay: '.82s' }} d="M17.6 11.6l1.4 1.4" />
            </g>
          </svg>
        </span>
        <h2>{title}</h2>
        <p className="klipgen-step">{detail || GEN_STEPS[etape]}</p>
        <div className="klipgen-rule" aria-hidden="true">
          <span style={{ width: `${((etape + 1) / GEN_STEPS.length) * 100}%` }} />
        </div>

      </div>

      <style>{`
        .klipgen {
          position: fixed; inset: 0; z-index: 5000;
          background: var(--forest, #0C2A1D);
          display: grid; place-items: center;
          isolation: isolate;
        }
        .klipgen-toile { position: absolute; inset: 0; width: 100%; height: 100%; }
        .klipgen-copy {
          position: absolute; left: 0; right: 0; z-index: 1; text-align: center;
          top: calc(50% + (min(320px, 34vw, 33.6vh) * 0.625) - 20px);
          padding: 0 24px; margin: 0 auto; max-width: 520px;
        }
        .klipgen-mark {
          display: block; width: 46px; height: 46px; margin: 0 auto 16px;
          filter: drop-shadow(0 0 14px rgba(189,242,160,.28));
        }
        .klipgen-mark svg { width: 100%; height: 100%; }
        .klipgen-arc {
          stroke-dasharray: 16 50;
          opacity: .45;
          transform-origin: 12px 12px;
          animation: klipArc 3.2s linear infinite;
        }
        .klipgen-baguette {
          stroke-dasharray: 15;
          stroke-dashoffset: 15;
          animation: klipBaguette 3.2s cubic-bezier(.65,0,.35,1) infinite;
        }
        .klipgen-etincelles path {
          opacity: 0;
          transform-origin: 15px 9px;
          animation: klipEtincelle 3.2s cubic-bezier(.2,.8,.2,1) infinite;
        }
        @keyframes klipArc {
          to { transform: rotate(360deg); }
        }
        @keyframes klipBaguette {
          0%   { stroke-dashoffset: 15; }
          26%  { stroke-dashoffset: 0; }
          82%  { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes klipEtincelle {
          0%, 12%  { opacity: 0; transform: scale(.4); }
          30%      { opacity: 1; transform: scale(1); }
          82%      { opacity: 1; transform: scale(1); }
          100%     { opacity: 0; transform: scale(.85); }
        }
        .klipgen-copy h2 {
          font-family: var(--display, Archivo), system-ui, sans-serif;
          font-weight: 800; letter-spacing: -0.03em; line-height: 1.05;
          font-size: clamp(22px, 3.4vw, 34px); color: #F5F0E8; margin: 0;
        }
        .klipgen-step {
          margin: 10px 0 0; font-size: 13px; font-weight: 600;
          color: rgba(245,240,232,.72);
        }
        .klipgen-rule {
          width: min(260px, 60vw); height: 2px; margin: 18px auto 0;
          background: rgba(245,240,232,.16); border-radius: 2px; overflow: hidden;
        }
        .klipgen-rule span {
          display: block; height: 100%; background: var(--leaf, #BDF2A0);
          transition: width .7s cubic-bezier(.2,.8,.2,1);
        }
        @media (prefers-reduced-motion: reduce) {
          .klipgen-rule span { transition: none; }
          .klipgen-arc, .klipgen-baguette, .klipgen-etincelles path { animation: none; stroke-dashoffset: 0; opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
