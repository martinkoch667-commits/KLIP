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
  // `voiced` : plages où quelqu'un parle (référentiel source). Elles sont
  // PROTÉGÉES : une image un peu floue pendant que la personne parle reste dans
  // le montage — on ne coupe jamais la parole pour un défaut d'image.
  opts: { step?: number; maxSamples?: number; signal?: AbortSignal; voiced?: { start: number; end: number }[] } = {},
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

    const speaking = !!opts.voiced?.some((v) => t >= v.start - 0.15 && t <= v.end + 0.15);
    let why: QualitySample["why"] | undefined;
    // Le noir franc reste éliminé même sur de la parole (rien à voir à l'écran) ;
    // le flou et l'image figée, eux, sont tolérés tant que ça parle.
    if (lum < DARK_MAX) why = "dark";
    else if (lum > BRIGHT_MIN && !speaking) why = "bright";
    else if (sharp < SHARP_MIN && !speaking) why = "blurry";
    else if (samples.length > 0 && diff < FROZEN_MAX && !speaking) why = "frozen";

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

  let keep = bestStart >= 0 ? { start: bestStart, end: bestEnd } : null;

  // La fenêtre est choisie sur des critères d'IMAGE ; ses bords peuvent donc
  // tomber en pleine phrase. On les repousse jusqu'au bord de la plage parlée :
  // un mot tranché en deux s'entend immédiatement, alors qu'une demi-seconde
  // d'image moyenne en plus ne se voit pas.
  if (keep && opts.voiced?.length) {
    for (const seg of opts.voiced) {
      if (keep.start > seg.start && keep.start < seg.end) keep.start = Math.max(from, seg.start);
      if (keep.end > seg.start && keep.end < seg.end) keep.end = Math.min(to, seg.end);
    }
    if (keep.end - keep.start < MIN_KEEP) keep = null;
  }

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

// ─── Découpe sémantique (transcription) ─────────────────────────────────────
// Repère dans une transcription horodatée au mot ce qu'on retire d'un rush :
//   • les hésitations   (« euh », « hum », « bah »…)
//   • les faux départs  (un mot répété immédiatement : « je… je vais »)
//   • les prises refaites (une même suite de mots redite plus loin → on garde la DERNIÈRE)
// Nécessite la transcription (GROQ_API_KEY côté serveur, cf. /api/transcribe).

export interface TWord { start: number; end: number; word: string }

/**
 * Plages où quelqu'un parle, déduites des mots HORODATÉS de la transcription.
 *
 * C'est la vérité terrain : un mot reconnu à 3.2 s, c'est de la parole à 3.2 s.
 * L'alternative — deviner la parole au niveau sonore — se trompe dès qu'un rush
 * a un pic (la voix normale passe sous le seuil) ou n'en a aucun (le souffle
 * passe pour de la parole), et se trompe DIFFÉREMMENT sur chaque rush.
 *
 * `joinSec` : deux mots séparés par moins que ça appartiennent à la même phrase
 * (on ne veut pas une plage par mot). `padSec` : marge de sécurité de part et
 * d'autre, une attaque de syllabe démarre avant l'horodatage.
 */
export function voicedFromWords(words: TWord[], joinSec = 0.35, padSec = 0.15): { start: number; end: number }[] {
  const w = words
    .filter((x) => x.word && Number.isFinite(x.start) && Number.isFinite(x.end) && x.end > x.start)
    .sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  for (const x of w) {
    const last = out[out.length - 1];
    if (last && x.start - last.end <= joinSec) last.end = Math.max(last.end, x.end);
    else out.push({ start: x.start, end: x.end });
  }
  return out.map((r) => ({ start: Math.max(0, r.start - padSec), end: r.end + padSec }));
}

export interface SemanticCut {
  start: number;
  end: number;
  reason: "filler" | "stutter" | "retake" | "gap";
  text: string;
}

// Hésitations courantes (fr + en). Comparaison sur le mot normalisé.
// UNIQUEMENT des sons d'hésitation, jamais des mots porteurs de sens.
// « voilà », « bref », « ben », « bah », « like » en faisaient partie et étaient
// supprimés alors qu'ils appartiennent au discours — d'où des coupes en pleine phrase.
const FILLERS = new Set([
  "euh", "euuh", "euhh", "heu", "heuu", "hum", "humm", "hmm", "hmmm", "mmh", "mmm",
  "uh", "uhh", "uhm", "um", "umm", "erm", "ehm",
]);

const norm = (w: string) => w.toLowerCase().replace(/[.,!?;:…"'’«»]/g, "").trim();

/** Construit la liste des passages à retirer à partir des mots horodatés. */
export function planSemanticCuts(
  words: TWord[],
  // `maxGap` : au-delà de ce blanc entre deux mots, on resserre (rythme plus vif).
  // `gapKeep` : on laisse ce petit souffle pour que ça ne colle pas.
  opts: { retakes?: boolean; maxGap?: number; gapKeep?: number } = {},
): SemanticCut[] {
  const cuts: SemanticCut[] = [];
  const w = words.filter((x) => x.word && x.end > x.start);
  if (!w.length) return cuts;

  // 1) Hésitations isolées.
  for (const x of w) {
    if (FILLERS.has(norm(x.word))) cuts.push({ start: x.start, end: x.end, reason: "filler", text: x.word });
  }

  // 2) Bégaiements / faux départs : mot identique répété d'affilée (< 1.2 s d'écart)
  //    → on retire la PREMIÈRE occurrence, on garde la bonne.
  for (let i = 1; i < w.length; i++) {
    const a = w[i - 1], b = w[i];
    if (norm(a.word) && norm(a.word) === norm(b.word) && b.start - a.end < 1.2) {
      cuts.push({ start: a.start, end: a.end, reason: "stutter", text: a.word });
    }
  }

  // 2 bis) Temps morts : tout blanc entre deux mots dépassant `maxGap` est resserré
  //        (on garde `gapKeep` de respiration). C'est ce qui rend le montage vif.
  const maxGap = opts.maxGap ?? 0.6;
  const gapKeep = opts.gapKeep ?? 0.25;
  for (let i = 1; i < w.length; i++) {
    const gap = w[i].start - w[i - 1].end;
    if (gap > maxGap) {
      cuts.push({ start: w[i - 1].end + gapKeep, end: w[i].start - gapKeep / 2, reason: "gap", text: `${gap.toFixed(1)}s` });
    }
  }

  // 3) Prises refaites : une suite de ≥ 4 mots identique réapparaît plus loin
  //    → on retire la première (l'orateur s'est repris).
  if (opts.retakes !== false) {
    const N = 4;
    const seen = new Map<string, number>(); // clé → index de début de la 1re occurrence
    for (let i = 0; i + N <= w.length; i++) {
      const key = w.slice(i, i + N).map((x) => norm(x.word)).join(" ");
      if (!key.trim()) continue;
      const prev = seen.get(key);
      if (prev !== undefined && i - prev >= N) {
        // on coupe de la 1re occurrence jusqu'au début de la seconde
        cuts.push({ start: w[prev].start, end: w[i].start, reason: "retake", text: key });
        seen.delete(key);
      } else if (prev === undefined) {
        seen.set(key, i);
      }
    }
  }

  return mergeCuts(cuts);
}

/** Fusionne les intervalles qui se chevauchent (triés). */
export function mergeCuts(cuts: SemanticCut[]): SemanticCut[] {
  const sorted = [...cuts].sort((a, b) => a.start - b.start);
  const out: SemanticCut[] = [];
  for (const c of sorted) {
    const last = out[out.length - 1];
    if (last && c.start <= last.end + 0.05) {
      last.end = Math.max(last.end, c.end);
      if (last.reason !== c.reason) last.text = `${last.text} + ${c.text}`;
    } else out.push({ ...c });
  }
  return out;
}

/**
 * Convertit des passages à retirer en segments À GARDER, dans les bornes [from, to].
 * Les segments plus courts que `minKeep` sont écartés (bribes inutilisables).
 */
export function keepRangesFromCuts(
  cuts: SemanticCut[], from: number, to: number, minKeep = 0.22, pad = 0.12,
): { start: number; end: number }[] {
  const keep: { start: number; end: number }[] = [];
  let cursor = from;
  for (const c of cuts) {
    const cs = Math.max(from, c.start - pad);
    const ce = Math.min(to, c.end + pad);
    if (ce <= cursor) continue;
    if (cs > cursor) keep.push({ start: cursor, end: Math.min(cs, to) });
    cursor = Math.max(cursor, ce);
  }
  if (cursor < to) keep.push({ start: cursor, end: to });
  return keep.filter((k) => k.end - k.start >= minKeep);
}
