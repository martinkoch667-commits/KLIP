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

/* Spectre audio.

   Dessiné sur un CANVAS, plus en SVG. Deux raisons.

   La première est la lisibilité, qui est le but. Le spectre ne portait que 120
   valeurs pour tout le fichier : sur une musique de trois minutes, une barre
   couvrait une seconde et demie, tout s'écrasait en un pavé uniforme et on ne
   reconnaissait plus rien. Il en porte maintenant trente par seconde, et il faut
   pouvoir en dessiner plusieurs milliers.

   La seconde est le coût. Un rectangle SVG par valeur, c'était déjà une centaine
   d'éléments DOM par piste ; à cette résolution ce serait plusieurs milliers, et
   le monteur les reconstruirait à chaque changement. Un canvas, c'est un seul
   élément quelle que soit la finesse.

   On dessine une colonne par PIXEL disponible, en prenant le pic du tronçon
   qu'elle couvre : le dessin reste juste à tous les zooms, sans jamais dépendre
   du nombre de valeurs stockées. */
function dessinerSpectre(
  cv: HTMLCanvasElement, peaks: number[], couleur: string, opacite: number, minRel: number,
) {
  const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(cv.clientWidth));
  const h = Math.max(1, Math.round(cv.clientHeight));
  if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!peaks.length) return;
  ctx.globalAlpha = opacite;
  ctx.fillStyle = couleur;
  const milieu = h / 2;
  const parCol = peaks.length / w;
  for (let x = 0; x < w; x++) {
    // Pic du tronçon couvert par cette colonne : à fort dézoom une colonne
    // représente plusieurs mesures, et c'est la plus forte qui doit se voir.
    const a = Math.floor(x * parCol);
    const b = Math.max(a + 1, Math.floor((x + 1) * parCol));
    let p = 0;
    for (let i = a; i < b && i < peaks.length; i++) if (peaks[i] > p) p = peaks[i];
    const demi = Math.max(minRel * h, p * h * 0.46);
    ctx.fillRect(x, milieu - demi, 1, demi * 2);
  }
  ctx.globalAlpha = 1;
}

function SpectreBase({ peaks, couleur, opacite, minRel, className, style }: {
  peaks: number[]; couleur: string; opacite: number; minRel: number;
  className?: string; style?: React.CSSProperties;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  // Redessiné quand les données changent ET quand la taille change (zoom de la
  // timeline, hauteur de piste) : le canvas ne se remet pas à l'échelle tout seul.
  React.useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const peindre = () => dessinerSpectre(cv, peaks, couleur, opacite, minRel);
    peindre();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(peindre);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [peaks, couleur, opacite, minRel]);
  return <canvas ref={ref} className={className} style={{ display: "block", width: "100%", height: "100%", ...style }} aria-hidden />;
}
const Spectre = React.memo(SpectreBase);

/** Spectre intégré au plan vidéo (façon CapCut), en bas du bloc. */
function ClipWaveBase({ peaks }: { peaks: number[] }) {
  if (!peaks.length) return null;
  return (
    <div className="a-clip-wave">
      <Spectre peaks={peaks} couleur="rgba(255,255,255,.82)" opacite={1} minRel={0.03} />
    </div>
  );
}
export const ClipWave = React.memo(ClipWaveBase);

/** Spectre d'une piste audio de la timeline. */
function AudioWaveBase({ peaks }: { peaks: number[] }) {
  if (!peaks.length) return null;
  return <Spectre peaks={peaks} couleur="#fff" opacite={0.62} minRel={0.015}
    style={{ position: "absolute", inset: 0 }} />;
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
