"use client";

/* timeline-parts.tsx : les morceaux LOURDS et PUREMENT VISUELS de la timeline.
 *
 * Pourquoi ils sortent de page.tsx.
 * Le monteur est un seul composant React de plus de quatre mille lignes. Pendant
 * la lecture, l'horloge appelle setTime à chaque image : React réexécute alors
 * TOUT ce composant, soixante fois par seconde. Or ce qu'il y a de plus gros
 * dedans, ce sont ces quatre blocs, et aucun d'eux ne dépend du temps qui passe :
 *
 *   ClipStrip : jusqu'à 220 tuiles de vignettes par plan
 *   ClipWave  : une centaine de rectangles SVG par plan sonore
 *   AudioWave : 120 rectangles SVG par piste audio
 *   FadeRamp  : les rampes de fondu
 *
 * Sur un montage d'une quinzaine de plans, cela fait plusieurs milliers
 * d'éléments React recréés et rapprochés du DOM à chaque image, pour un résultat
 * rigoureusement identique. C'est là que part la fluidité de la lecture.
 *
 * Isolés ici et enveloppés dans React.memo, ils ne se redessinent que lorsque
 * leurs propres données changent (zoom, rognage, sélection), plus jamais parce
 * que le curseur a avancé.
 */

import React from "react";

export interface ClipStripData { frames: string[]; aspect: number }

/* Tuiles d'un plan : largeur fixe = hauteur × ratio source. On en pose autant que
   nécessaire pour couvrir la largeur du plan ; la dernière est simplement rognée
   par l'`overflow: hidden` du plan (exactement le comportement de CapCut). */
function ClipStripBase({ data, width, height, filter }: { data?: ClipStripData; width: number; height: number; filter?: string }) {
  if (!data || !data.frames.length || width <= 0 || height <= 0) return null;
  let tileW = Math.max(14, Math.round(height * data.aspect));
  // Garde-fou DOM : sur un plan très long fortement zoomé, on élargit les tuiles
  // plutôt que d'en produire des milliers (elles rognent, elles ne s'étirent pas).
  const MAX_TILES = 220;
  if (width / tileW > MAX_TILES) tileW = Math.ceil(width / MAX_TILES);
  const count = Math.max(1, Math.ceil(width / tileW));
  const last = data.frames.length - 1;
  const tiles: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    // image la plus proche du moment représenté au CENTRE de la tuile
    const progress = count === 1 ? 0 : Math.min(1, (i * tileW + tileW / 2) / width);
    tiles.push(
      <span key={i} className="a-strip-tile" style={{ width: tileW, backgroundImage: `url("${data.frames[Math.round(progress * last)]}")` }} />,
    );
  }
  return <div className="a-clip-strip" style={filter ? { filter } : undefined} aria-hidden>{tiles}</div>;
}
export const ClipStrip = React.memo(ClipStripBase);

/* Spectre audio intégré au plan vidéo (façon CapCut). `peaks` est la même
   référence de tableau tant que la source ne change pas, donc memo tient. */
function ClipWaveBase({ peaks }: { peaks: number[] }) {
  if (!peaks.length) return null;
  const w = 100 / peaks.length;
  return (
    <div className="a-clip-wave">
      <svg width="100%" height="100%" preserveAspectRatio="none">
        {peaks.map((p, i) => {
          const h = Math.max(10, p * 100);
          return <rect key={i} x={`${(i / peaks.length) * 100}%`} y={`${(100 - h) / 2}%`} width={`${w}%`} height={`${h}%`} fill="rgba(255,255,255,.82)" />;
        })}
      </svg>
    </div>
  );
}
export const ClipWave = React.memo(ClipWaveBase);

/* Forme d'onde d'une piste audio de la timeline. */
function AudioWaveBase({ peaks }: { peaks: number[] }) {
  if (!peaks.length) return null;
  const w = 100 / peaks.length;
  return (
    <svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
      {peaks.map((p, i) => {
        const h = Math.max(6, p * 100);
        return <rect key={i} x={`${(i / peaks.length) * 100}%`} y={`${(100 - h) / 2}%`} width={`${w}%`} height={`${h}%`} fill="#fff" />;
      })}
    </svg>
  );
}
export const AudioWave = React.memo(AudioWaveBase);

/* Rampes de fondu dessinées sur un bloc (plan vidéo ou piste audio). */
function FadeRampBase({ w, fi, fo, className, dim, style }: {
  w: number; fi: number; fo: number; className?: string; dim: string; style?: React.CSSProperties;
}) {
  const H = 30;
  if (fi <= 0 && fo <= 0) return null;
  const W = Math.max(1, w);
  return (
    <svg className={className} width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={style}>
      {fi > 0 && <><polygon points={`0,${H} ${fi},0 ${fi},${H}`} fill={dim} /><line x1="0" y1={H} x2={fi} y2="0" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".95" /></>}
      {fo > 0 && <><polygon points={`${w},${H} ${w - fo},0 ${w - fo},${H}`} fill={dim} /><line x1={w} y1={H} x2={w - fo} y2="0" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".95" /></>}
    </svg>
  );
}
export const FadeRamp = React.memo(FadeRampBase);
