"use client";

/* Les pictogrammes des outils image.
 *
 * Une scène dessinée une seule fois par outil, et une couleur franche par
 * outil : c'est la couleur qui identifie l'outil d'un coup d'œil, la charte
 * habille le produit autour. Le traitement retenu est la tuile bombée : le
 * relief vient du biseau intérieur, jamais d'une ombre portée colorée sous la
 * tuile, qui faisait vite too much en grille de quatre.
 */

import React from "react";

export type SceneOutil = (corps: string, accent: string) => React.ReactNode;

/** Les dessins, en coordonnées 0..24. Corps = la forme, accent = le second plan. */
export const SCENES_OUTILS: Record<string, SceneOutil> = {
  ajuster: (c, a) => (<>
    <rect x="3" y="6" width="18" height="2.2" rx="1.1" fill={a} />
    <rect x="3" y="11" width="18" height="2.2" rx="1.1" fill={a} />
    <rect x="3" y="16" width="18" height="2.2" rx="1.1" fill={a} />
    <circle cx="8" cy="7.1" r="3.4" fill={c} />
    <circle cx="16" cy="12.1" r="3.4" fill={c} />
    <circle cx="10" cy="17.1" r="3.4" fill={c} />
  </>),
  recadrer: (c, a) => (<>
    <rect x="7" y="7" width="13" height="13" rx="1.6" fill={a} />
    <path d="M6 2h2.4v13.6a2 2 0 0 0 2 2H22V20H10.4a4.4 4.4 0 0 1-4.4-4.4z" fill={c} />
    <path d="M2 6h13.6a2 2 0 0 1 2 2V22h-2.4V10.4a2 2 0 0 0-2-2H2z" fill={c} />
  </>),
  fond: (c, a) => (<>
    <rect x="3" y="3" width="18" height="18" rx="3" fill={a} />
    <path d="M3 12h6v6a3 3 0 0 1-3 3H3zM15 3h3a3 3 0 0 1 3 3v6h-6z" fill={c} opacity=".55" />
    <circle cx="12" cy="11" r="4.2" fill={c} />
    <path d="M6.5 21c1.4-3 3.2-4.4 5.5-4.4S16.1 18 17.5 21z" fill={c} />
  </>),
  capture: (c, a) => (<>
    <rect x="3" y="3" width="12.5" height="12.5" rx="2.6" fill={a} />
    <rect x="8.5" y="8.5" width="12.5" height="12.5" rx="2.6" fill={c} />
    <circle cx="14.7" cy="14.7" r="2.4" fill={a} />
  </>),
  generer: (c, a) => (<>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.6" fill={a} />
    <circle cx="8" cy="10" r="2.2" fill={c} />
    <path d="M2.5 16.4l5.2-5 3.6 3.2 3.2-2.4 7 6.2v.6a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z" fill={c} />
  </>),
  edition: (c, a) => (<>
    <path d="M12 1.6l2.3 6.3 6.3 2.3-6.3 2.3L12 18.8l-2.3-6.3L3.4 10.2l6.3-2.3z" fill={c} />
    <circle cx="19" cy="18.4" r="2.8" fill={a} />
    <circle cx="5" cy="18.8" r="1.8" fill={a} />
  </>),
  gomme: (c, a) => (<>
    <rect x="2.4" y="19.2" width="19.2" height="2.4" rx="1.2" fill={a} />
    <g transform="rotate(-45 12 11)">
      <rect x="5" y="6" width="14" height="9.6" rx="2.2" fill={c} />
      <rect x="5" y="11" width="14" height="4.6" fill={a} opacity=".65" />
    </g>
  </>),
};

/** Deux tons par outil : le vif pour le haut de la tuile, le profond pour le bas. */
export const TEINTES_OUTILS: Record<string, [string, string]> = {
  ajuster:  ['#5B21B6', '#7C3AED'],   // violet
  recadrer: ['#1D4ED8', '#2563EB'],   // bleu
  fond:     ['#0E7490', '#06B6D4'],   // cyan
  capture:  ['#EA580C', '#F97316'],   // orange
  generer:  ['#047857', '#10B981'],   // émeraude
  edition:  ['#BE185D', '#EC4899'],   // magenta
  gomme:    ['#B91C1C', '#EF4444'],   // rouge
};

export function PictoOutil({ outil, style }: { outil: string; style?: React.CSSProperties }) {
  const [profond, vif] = TEINTES_OUTILS[outil] ?? ['#1E3317', '#2F7C55'];
  const scene = SCENES_OUTILS[outil];
  return (
    <span style={{ width: '100%', aspectRatio: '1', borderRadius: '30%', display: 'grid', placeItems: 'center',
      position: 'relative', overflow: 'hidden',
      background: `linear-gradient(155deg, ${vif} 4%, ${profond} 96%)`,
      boxShadow: 'inset 0 2px 0 rgba(255,255,255,.45), inset 0 -7px 14px rgba(0,0,0,.18)',
      ...style }}>
      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(255,255,255,.34), transparent 46%)' }} />
      <svg width="50%" height="50%" viewBox="0 0 24 24" style={{ position: 'relative', filter: 'drop-shadow(0 1.5px 1.5px rgba(0,0,0,.22))' }}>
        {scene ? scene('#FFFFFF', 'rgba(255,255,255,.42)') : null}
      </svg>
    </span>
  );
}
