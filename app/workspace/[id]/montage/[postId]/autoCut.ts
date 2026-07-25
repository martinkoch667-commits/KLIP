// autoCut.ts — analyse de qualité d'image d'un plan, 100 % côté navigateur.
//
// Objectif : repérer automatiquement les portions inexploitables d'un rush
// (noir de début/fin, flou de mise au point, sur/sous-exposition, image figée)
// et proposer la meilleure fenêtre à garder — sans aucune clé API.
//
// C'est le complément visuel de la découpe « au son » (silences / hésitations),
// qui elle nécessite la transcription (GROQ_API_KEY, cf. /api/transcribe).
//
// Méthode : on échantillonne des images le long du plan (via un <video> masqué),
// on les réduit en niveaux de gris, puis pour chacune on mesure
//   • la luminance moyenne      → noir, sous-exposé, cramé
//   • la netteté (Laplacien)    → flou de bougé / mise au point ratée
//   • l'écart avec l'image précédente → plan figé (rien ne bouge)
// Un score global par échantillon décide « exploitable » ou non, puis on retient
// la plus longue plage exploitable continue.

export interface QualitySample {
  t: number;      // instant dans la SOURCE (s)
  lum: number;    // 0-1, luminance moyenne
  sharp: number;  // variance du Laplacien, normalisée (0-1+)
  diff: number;   // écart moyen avec l'échantillon précédent (0-1)
  ok: boolean;    // exploitable ?
  why?: "dark" | "bright" | "blurry" | "frozen";
}

export interface ClipQualityReport {
  samples: QualitySample[];
  keep: { start: number; end: number } | null; // meilleure plage (référentiel source)
  dropped: number;   // durée écartée (s)
  analyzed: number;  // durée analysée (s)
}

// Seuils — volontairement prudents : on ne coupe que ce qui est franchement mauvais.
const DARK_MAX = 0.055;   // en dessous : quasi noir
const BRIGHT_MIN = 0.965; // au dessus : cramé
const SHARP_MIN = 0.012;  // en dessous : franchement flou
const FROZEN_MAX = 0.0035; // écart quasi nul entre deux images = plan figé
const MIN_KEEP = 0.6;     // on ne propose pas une fenêtre plus courte que ça

// Luminance + netteté d'une image déjà dessinée sur un canvas (niveaux de gris).
function measure(data: Uint8ClampedArray, w: number, h: number) {
  const n = w * h;
  const gray = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    // luma perceptuelle
    const g = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
    gray[i] = g;
    sum += g;
  }
  const lum = sum / n;

  // Variance du Laplacien : mesure classique de netteté (plus c'est haut, plus c'est net).
  let lapSum = 0, lapSum2 = 0, count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      lapSum += lap; lapSum2 += lap * lap; count++;
    }
  }
  const mean = count ? lapSum / count : 0;
  const sharp = count ? Math.max(0, lapSum2 / count - mean * mean) : 0;
  return { lum, sharp, gray };
}

function meanAbsDiff(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 1;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
  return s / n;
}

/**
 * Analyse la qualité d'image d'un plan vidéo entre `from` et `to` (référentiel source).
 * `step` = intervalle d'échantillonnage en secondes.
 */
export async function analyzeClipQuality(
  src: string,
  from: number,
  to: number,
  opts: { step?: number; maxSamples?: number; signal?: AbortSignal } = {},
): Promise<ClipQualityReport> {
  const span = Math.max(0, to - from);
  const step = opts.step ?? Math.max(0.25, Math.min(0.8, span / 40));
  const maxSamples = opts.maxSamples ?? 60;

  const v = document.createElement("video");
  v.crossOrigin = "anonymous"; v.muted = true; v.preload = "auto"; v.src = src;
  await new Promise<void>((res, rej) => {
    v.onloadedmetadata = () => res();
    v.onerror = () => rej(new Error("load"));
  });

  // Petite résolution : l'analyse est statistique, 160px de large suffisent.
  const W = 160;
  const scale = Math.min(1, W / (v.videoWidth || W));
  const cw = Math.max(8, Math.round((v.videoWidth || W) * scale));
  const ch = Math.max(8, Math.round((v.videoHeight || W) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const times: number[] = [];
  for (let t = from; t < to && times.length < maxSamples; t += step) times.push(t);
  if (!times.length) times.push(from);

  const samples: QualitySample[] = [];
  let prevGray: Float32Array | null = null;

  for (const t of times) {
    if (opts.signal?.aborted) break;
    await new Promise<void>((res) => {
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      v.onseeked = fin;
      // garde-fou : certains encodages ne déclenchent pas onseeked
      setTimeout(fin, 400);
      v.currentTime = Math.max(0, Math.min(t, (v.duration || 1) - 0.05));
    });
    try { ctx.drawImage(v, 0, 0, cw, ch); } catch { continue; }
    const img = ctx.getImageData(0, 0, cw, ch);
    const { lum, sharp, gray } = measure(img.data, cw, ch);
    const diff = prevGray ? meanAbsDiff(gray, prevGray) : 1;
    prevGray = gray;

    let why: QualitySample["why"] | undefined;
    if (lum < DARK_MAX) why = "dark";
    else if (lum > BRIGHT_MIN) why = "bright";
    else if (sharp < SHARP_MIN) why = "blurry";
    else if (samples.length > 0 && diff < FROZEN_MAX) why = "frozen";

    samples.push({ t, lum, sharp, diff, ok: !why, why });
  }

  v.removeAttribute("src"); v.load();

  // Plus longue plage continue d'échantillons exploitables.
  let bestStart = -1, bestEnd = -1;
  let runStart: number | null = null;
  const closeRun = (endT: number) => {
    if (runStart === null) return;
    const len = endT - runStart;
    if (len >= MIN_KEEP && len > bestEnd - bestStart) { bestStart = runStart; bestEnd = endT; }
    runStart = null;
  };
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.ok && runStart === null) runStart = s.t;
    if (!s.ok) closeRun(s.t);
  }
  closeRun(to);

  const keep = bestStart >= 0 ? { start: bestStart, end: bestEnd } : null;
  const analyzed = span;
  const dropped = keep ? Math.max(0, span - (keep.end - keep.start)) : span;
  return { samples, keep, dropped, analyzed };
}

// Libellé court expliquant pourquoi une portion a été écartée (pour l'UI).
export function dominantIssue(samples: QualitySample[]): QualitySample["why"] | null {
  const counts: Record<string, number> = {};
  for (const s of samples) if (s.why) counts[s.why] = (counts[s.why] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return (top?.[0] as QualitySample["why"]) ?? null;
}
