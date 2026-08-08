// preEdit.ts — le prémontage IA, SANS interface.
//
// Le pipeline vivait dans le composant de l'éditeur, accroché à son état React :
// on ne pouvait donc le lancer que sur le montage ouvert, un post à la fois.
// Il est ici sous forme de fonctions qui prennent des plans et rendent des plans.
// Deux appelants, un seul comportement :
//   • l'éditeur de montage, qui applique le résultat à son état ;
//   • le workspace, qui enchaîne plusieurs posts et écrit leur montage_json.
// Toute correction (la détection de parole, par exemple) profite donc aux deux.
//
// Aucune traduction ici : les erreurs remontent en CODE, l'appelant les traduit.
// Aucun accès à Supabase non plus — le module calcule, il ne persiste pas.

import {
  analyzeClipQuality, planSemanticCuts, keepRangesFromCuts, voicedFromWords, type TWord,
} from "./autoCut";
import {
  clipTimelineDur, captionsFromWords, segmentCaptions, dedupeSegments,
  type MontageClip, type Caption,
} from "./constants";

// ─── Types d'échange ────────────────────────────────────────────────────────

export type TranscribeErrorCode =
  | "missing_api_key" | "media_too_large" | "rate_limited"
  | "provider_unavailable" | "unsupported_format" | "fetch_media_failed" | "unknown";

export interface TranscriptResult {
  segments: { start: number; end: number; text: string }[];
  words: TWord[];
  error?: TranscribeErrorCode;
  /** Poids du média refusé, pour le message « trop lourd ». */
  sizeMb?: number;
}

/** Cache de transcription partagé par les étapes ET par les posts d'un même lot :
 *  deux posts qui réutilisent le même rush ne le font écouter qu'une fois. */
export type TranscriptCache = Map<string, TranscriptResult>;
export const newTranscriptCache = (): TranscriptCache => new Map();

export interface PreEditProgress {
  /** Étape en cours, 0-2 : dérushage image, discours, sous-titres. */
  step: number;
  /** Ligne de journal — déjà formatée par l'appelant via `onLog`. */
  clipName?: string;
}

export interface PreEditResult {
  clips: MontageClip[];
  captions: Caption[];
  rawSegments: { start: number; end: number; text: string }[];
  rawWords: TWord[];
  /** Secondes retirées par le dérushage image. */
  trimmedSec: number;
  /** Secondes retirées par la coupe du discours. */
  fillersSec: number;
  /** Première erreur de transcription rencontrée, s'il y en a eu une. */
  error?: TranscribeErrorCode;
  /** Plans dont la transcription a échoué. Un montage peut réussir pour trois
   *  rushes et échouer pour le quatrième : sans cette liste, le trou de
   *  sous-titres apparaissait sans la moindre explication. */
  failed: { name: string; code: TranscribeErrorCode }[];
}

/** Événements de journal — l'appelant traduit et affiche. */
export interface PreEditHooks {
  onStep?: (step: number) => void;
  onLog?: (ev:
    | { type: "startRushes"; n: number }
    | { type: "analyzing"; name: string }
    | { type: "speechMapped"; n: number }
    | { type: "trimmed"; seconds: number }
    | { type: "clipClean" }
    | { type: "transcribing"; name: string }
    | { type: "wordsHeard"; n: number }
    | { type: "cutsFound"; n: number }
    | { type: "speechClean" }
    | { type: "captions"; n: number; byWords: boolean }
    | { type: "transcribeFailed"; name: string; code: TranscribeErrorCode }
    | { type: "allDone" }
  ) => void;
  signal?: AbortSignal;
}

// ─── Audio : décodage et transcription ──────────────────────────────────────

/** WAV mono 16 kHz — le format attendu par Whisper, et le seul assez léger pour
 *  passer dans le corps d'une requête serverless. */
export function encodeWavMono(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const w = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  w(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE");
  w(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  w(36, "data"); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}

async function decodeToMono16k(src: string): Promise<Float32Array> {
  const ab = await (await fetch(src)).arrayBuffer();
  const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const actx = new AC();
  const decoded = await actx.decodeAudioData(ab.slice(0));
  try { await actx.close(); } catch {}
  const rate = 16000;
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
  const node = off.createBufferSource(); node.buffer = decoded; node.connect(off.destination); node.start();
  return (await off.startRendering()).getChannelData(0);
}

// Une route serverless n'accepte qu'un corps limité (~4,5 Mo) et un WAV 16 kHz
// mono pèse ~1,8 Mo/min : au-delà de ~2,5 min l'envoi échouait avant Whisper.
// On découpe donc en tranches et on recale les horodatages de chacune.
const TRANSCRIBE_CHUNK_SEC = 100;

const errCode = (raw: unknown): TranscribeErrorCode => {
  const known: TranscribeErrorCode[] = ["missing_api_key", "media_too_large", "rate_limited", "provider_unavailable", "unsupported_format", "fetch_media_failed"];
  return known.includes(raw as TranscribeErrorCode) ? (raw as TranscribeErrorCode) : "unknown";
};

// Échecs PASSAGERS : le palier gratuit de Groq limite au débit, et transcrire
// quatre rushes à la suite le déclenche facilement. Sans réessai, la première
// tranche refusée condamnait tout le plan — d'où un montage où un plan sur
// quatre n'a ni sous-titres ni coupes calées sur la parole, sans rien qui le
// signale. Les échecs définitifs (pas de clé, fichier trop lourd, format
// refusé) ne sont PAS réessayés : insister n'y changerait rien.
const RETRYABLE: TranscribeErrorCode[] = ["rate_limited", "provider_unavailable", "unknown"];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postChunk(body: BodyInit, headers?: HeadersInit): Promise<
  { ok: true; data: { segments?: { start: number; end: number; text: string }[]; words?: TWord[] } }
  | { ok: false; code: TranscribeErrorCode; sizeMb?: number }
> {
  let last: { code: TranscribeErrorCode; sizeMb?: number } = { code: "unknown" };
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await wait(700 * 2 ** (attempt - 1)); // 0.7 s, puis 1.4 s
    try {
      const res = await fetch("/api/transcribe", { method: "POST", body, ...(headers ? { headers } : {}) });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) return { ok: true, data };
      const code = errCode(data?.error);
      last = { code, sizeMb: data?.sizeMb };
      if (!RETRYABLE.includes(code)) return { ok: false, ...last };
    } catch {
      last = { code: "unknown" }; // réseau : on retente
    }
  }
  return { ok: false, ...last };
}

export async function transcribeMedia(
  src: string,
  onProgress?: (done: number, total: number) => void,
): Promise<TranscriptResult> {
  const rate = 16000;
  let pcm: Float32Array | null = null;
  try { pcm = await decodeToMono16k(src); } catch (e) {
    // Cause n°1 du repli qui envoie la vidéo entière au serveur (« trop lourde »).
    console.warn("[transcribe] décodage audio local impossible, repli serveur :", e);
    pcm = null;
  }

  // Repli : décodage impossible (CORS, conteneur illisible) → le serveur va
  // chercher le média lui-même.
  if (!pcm) {
    const r = await postChunk(JSON.stringify({ url: src }), { "Content-Type": "application/json" });
    if (!r.ok) return { segments: [], words: [], error: r.code, sizeMb: r.sizeMb };
    return { segments: r.data.segments || [], words: r.data.words || [] };
  }

  const chunkLen = TRANSCRIBE_CHUNK_SEC * rate;
  const total = Math.max(1, Math.ceil(pcm.length / chunkLen));
  const segments: { start: number; end: number; text: string }[] = [];
  const words: TWord[] = [];

  for (let i = 0; i < total; i++) {
    onProgress?.(i, total);
    const slice = pcm.subarray(i * chunkLen, Math.min(pcm.length, (i + 1) * chunkLen));
    if (!slice.length) continue;
    const offset = (i * chunkLen) / rate;
    const form = new FormData();
    form.append("audio", encodeWavMono(slice, rate), "audio.wav");
    const r = await postChunk(form);
    if (!r.ok) return { segments, words, error: r.code, sizeMb: r.sizeMb };
    for (const sg of r.data.segments || []) segments.push({ start: sg.start + offset, end: sg.end + offset, text: sg.text });
    for (const w of r.data.words || []) words.push({ start: w.start + offset, end: w.end + offset, word: w.word });
  }
  onProgress?.(total, total);
  return { segments, words };
}

/** Transcription mise en cache. Un résultat VIDE n'est pas mémorisé : il peut
 *  venir d'une panne passagère, il ne faut pas le figer pour la session. */
export async function transcriptFor(src: string, cache: TranscriptCache): Promise<TranscriptResult> {
  const hit = cache.get(src);
  if (hit) return hit;
  const r = await transcribeMedia(src);
  // On mémorise le résultat MÊME s'il a échoué. Les trois étapes demandent la
  // transcription du même rush : sans ça, un plan qui échoue était redemandé
  // trois fois, ce qui triplait la charge sur une API déjà en train de refuser.
  // Les réessais internes ont déjà fait le nécessaire contre le passager.
  cache.set(src, r);
  return r;
}

// ─── Détection de parole ────────────────────────────────────────────────────

/**
 * Repli local quand aucune clé de transcription n'est configurée : RMS par
 * fenêtres de 30 ms, seuil calé sur le BRUIT DE FOND (et non sur le pic) avec
 * hystérésis. Un seuil relatif au maximum se trompait dans les deux sens — un
 * éclat faisait passer la voix pour du silence, un plan sans pic faisait passer
 * le souffle pour de la parole.
 */
export async function detectSpeechSegments(
  src: string, minSilenceSec = 1.0, padSec = 0.12,
): Promise<{ start: number; end: number }[] | null> {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const actx = new AudioCtx();
    const buf = await actx.decodeAudioData(await (await fetch(src)).arrayBuffer());
    const data = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const win = Math.max(1, Math.floor(sr * 0.03));
    const nWin = Math.floor(data.length / win);
    const rms = new Array<number>(nWin);
    let maxR = 0;
    for (let i = 0; i < nWin; i++) {
      let s = 0; const off = i * win;
      for (let j = 0; j < win; j++) { const v = data[off + j]; s += v * v; }
      const r = Math.sqrt(s / win); rms[i] = r; if (r > maxR) maxR = r;
    }
    await actx.close();
    if (maxR <= 0) return null;

    const sorted = [...rms].sort((a, b) => a - b);
    const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
    const floor = pct(0.2);   // 20e centile ≈ le silence de ce plan
    const mid = pct(0.5);
    const loud = pct(0.95);
    const winSec = win / sr;

    // Plan sans dynamique : soit ça parle d'un bout à l'autre, soit c'est du
    // souffle constant — les deux ont le même profil, aucun seuil relatif ne
    // peut trancher. Le niveau ABSOLU décide, et dans le doute on protège :
    // rater une coupe est bénin, couper la parole ne l'est pas.
    // (0.02 RMS ≈ -34 dBFS : au-dessus d'un fond de pièce, sous une voix.)
    if (loud / Math.max(floor, 1e-6) < 3) {
      return mid >= 0.02 ? [{ start: 0, end: buf.duration }] : [];
    }

    const open = Math.max(0.006, floor * 2.4);
    const close = Math.max(0.004, open * 0.55);
    const minSilWin = Math.ceil(minSilenceSec / winSec);
    const voiced: boolean[] = new Array(nWin);
    let on = false;
    for (let i = 0; i < nWin; i++) { on = on ? rms[i] >= close : rms[i] >= open; voiced[i] = on; }

    const segs: { start: number; end: number }[] = [];
    let i = 0;
    while (i < nWin) {
      if (!voiced[i]) { i++; continue; }
      let j = i;
      while (j < nWin) {
        if (voiced[j]) { j++; continue; }
        let k = j; while (k < nWin && !voiced[k]) k++;
        if (k - j >= minSilWin) break;
        j = k;
      }
      segs.push({ start: Math.max(0, i * winSec - padSec), end: Math.min(buf.duration, j * winSec + padSec) });
      i = j;
    }
    const merged: { start: number; end: number }[] = [];
    for (const s of segs) {
      const last = merged[merged.length - 1];
      if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
      else merged.push({ ...s });
    }
    return merged;
  } catch { return null; }
}

/** Où l'on parle dans un rush. La transcription est la source de vérité ; le
 *  niveau sonore n'est qu'un repli, il ne distingue pas une voix d'un vent. */
export async function speechMapFor(
  src: string, cache: TranscriptCache,
): Promise<{ voiced: { start: number; end: number }[]; fromWords: boolean }> {
  try {
    const tr = await transcriptFor(src, cache);
    if (tr.words.length) return { voiced: voicedFromWords(tr.words), fromWords: true };
  } catch { /* on tombe sur le repli */ }
  const local = await detectSpeechSegments(src, 0.6).catch(() => null);
  return { voiced: local ?? [], fromWords: false };
}

// ─── Étape 1 — dérushage image ──────────────────────────────────────────────

/** Rogne chaque plan vidéo à sa meilleure fenêtre exploitable, sans jamais
 *  sacrifier de parole. Ne modifie un plan que si le gain est réel. */
export async function trimClipsByQuality(
  clips: MontageClip[], cache: TranscriptCache, hooks: PreEditHooks & { only?: Set<string> } = {},
): Promise<{ clips: MontageClip[]; trimmedSec: number }> {
  const next = [...clips];
  let trimmedSec = 0;
  for (let i = 0; i < next.length; i++) {
    if (hooks.signal?.aborted) break;
    const c = next[i];
    if (c.kind !== "video" || (hooks.only && !hooks.only.has(c.id))) continue;
    hooks.onLog?.({ type: "analyzing", name: c.name });

    const { voiced, fromWords } = await speechMapFor(c.src, cache);
    if (fromWords && voiced.length) hooks.onLog?.({ type: "speechMapped", n: voiced.length });

    let rep;
    try { rep = await analyzeClipQuality(c.src, c.trimStart, c.trimEnd, { voiced: voiced.length ? voiced : undefined, signal: hooks.signal }); }
    catch { continue; }
    if (!rep.keep) continue; // rien d'exploitable détecté → on ne touche pas au plan

    const start = Math.max(c.trimStart, rep.keep.start);
    const end = Math.min(c.trimEnd, rep.keep.end);
    // On n'applique que si le gain est réel (> 0.3 s) et la plage valide.
    if (end - start > 0.5 && (c.trimEnd - c.trimStart) - (end - start) > 0.3) {
      const gain = (c.trimEnd - c.trimStart) - (end - start);
      trimmedSec += gain;
      next[i] = { ...c, trimStart: start, trimEnd: end };
      hooks.onLog?.({ type: "trimmed", seconds: gain });
    } else {
      hooks.onLog?.({ type: "clipClean" });
    }
  }
  return { clips: next, trimmedSec };
}

// ─── Étape 2 — resserrage du discours ───────────────────────────────────────

/** Retire hésitations, faux départs, prises refaites et temps morts. Un plan
 *  peut être scindé en plusieurs sous-plans. */
export async function tightenSpeech(
  clips: MontageClip[], cache: TranscriptCache,
  // `only` : ne traiter que ces identifiants (l'outil manuel peut ne viser qu'un
  // plan). Les autres traversent inchangés, ce qui préserve l'ordre sans avoir à
  // recoller les sous-plans à leur origine après coup.
  hooks: PreEditHooks & { only?: Set<string> } = {},
): Promise<{ clips: MontageClip[]; removedSec: number; error?: TranscribeErrorCode; failed: { name: string; code: TranscribeErrorCode }[] }> {
  const out: MontageClip[] = [];
  const failed: { name: string; code: TranscribeErrorCode }[] = [];
  let removedSec = 0;
  let error: TranscribeErrorCode | undefined;

  for (const c of clips) {
    if (c.kind !== "video" || hooks.signal?.aborted || (hooks.only && !hooks.only.has(c.id))) { out.push(c); continue; }
    hooks.onLog?.({ type: "transcribing", name: c.name });
    const tr = await transcriptFor(c.src, cache);
    if (!tr.words.length) {
      // Transcription indisponible → on ne touche à rien, et surtout on ne
      // conclut pas « rien à retirer » (message contradictoire après un échec).
      out.push(c);
      const code = tr.error ?? "unknown";
      error = error ?? code;
      if (!failed.some((f) => f.name === c.name)) failed.push({ name: c.name, code });
      hooks.onLog?.({ type: "transcribeFailed", name: c.name, code });
      continue;
    }
    hooks.onLog?.({ type: "wordsHeard", n: tr.words.length });

    // Blanc de TÊTE et de QUEUE : un rush démarre presque toujours avant la
    // première syllabe et court après la dernière (on lance, on se place, on
    // coupe). `planSemanticCuts` ne voit que les trous ENTRE deux mots : ces
    // deux blancs-là lui échappaient complètement et restaient dans le montage.
    // On resserre sur la parole, en laissant juste une amorce et une chute.
    const inClip = tr.words.filter((w) => w.end > c.trimStart && w.start < c.trimEnd);
    let from = c.trimStart, to = c.trimEnd;
    if (inClip.length) {
      const first = Math.min(...inClip.map((w) => w.start));
      const last = Math.max(...inClip.map((w) => w.end));
      // Amorce courte, chute un peu plus longue : couper net après le dernier
      // mot donne l'impression que la phrase est tronquée.
      from = Math.max(c.trimStart, first - 0.12);
      to = Math.min(c.trimEnd, last + 0.28);
      // Un plan quasiment muet n'est pas un plan à resserrer : on n'y touche pas.
      if (to - from < 0.4) { from = c.trimStart; to = c.trimEnd; }
    }

    const cuts = planSemanticCuts(tr.words).filter((x) => x.end > from && x.start < to);
    const headTail = (c.trimEnd - c.trimStart) - (to - from);
    if (!cuts.length && headTail < 0.15) { out.push(c); hooks.onLog?.({ type: "speechClean" }); continue; }
    if (cuts.length) hooks.onLog?.({ type: "cutsFound", n: cuts.length });

    const keeps = keepRangesFromCuts(cuts, from, to);
    if (!keeps.length) { out.push(c); continue; }
    removedSec += (c.trimEnd - c.trimStart) - keeps.reduce((s, k) => s + (k.end - k.start), 0);
    keeps.forEach((k, idx) => {
      out.push({ ...c, id: crypto.randomUUID(), trimStart: k.start, trimEnd: k.end, gapBefore: idx === 0 ? c.gapBefore : 0 });
    });
  }
  return { clips: out, removedSec, error, failed };
}

// ─── Étape 3 — sous-titres ──────────────────────────────────────────────────

/** Positions sur la timeline. PURE : les étapes s'enchaînent sur le résultat de
 *  la précédente, sans dépendre d'un état React pas encore à jour. */
export function computeStarts(list: MontageClip[]) {
  let acc = 0;
  return list.map((c) => {
    acc += Math.max(0, c.gapBefore ?? 0);
    const start = acc;
    const dur = clipTimelineDur(c);
    acc += dur;
    return { ...c, start, end: acc, dur };
  });
}

/** Sous-titres calés sur la TIMELINE (et non sur la source) : sans cette
 *  conversion ils ne couvraient que le début et tombaient à côté dès qu'un plan
 *  était rogné. */
export async function buildCaptions(
  clips: MontageClip[], subMaxWords: number | null | undefined, cache: TranscriptCache, hooks: PreEditHooks = {},
): Promise<{ captions: Caption[]; rawSegments: { start: number; end: number; text: string }[]; rawWords: TWord[]; error?: TranscribeErrorCode }> {
  const vids = computeStarts(clips).filter((c) => c.kind === "video");
  const all: { start: number; end: number; text: string }[] = [];
  const allWords: TWord[] = [];
  let error: TranscribeErrorCode | undefined;

  for (const c of vids) {
    if (hooks.signal?.aborted) break;
    const tr = await transcriptFor(c.src, cache);
    if (tr.error && !tr.segments.length && !tr.words.length) { error = error ?? tr.error; continue; }
    if (tr.error && !error) error = tr.error;

    const toTimeline = (srcT: number) => c.start + (srcT - c.trimStart) / c.speed;
    // Un mot appartient au plan dont la partie conservée contient son MILIEU.
    // Ce test d'appartenance unique empêche un même passage d'être réécrit deux
    // fois quand le prémontage scinde un rush en plusieurs plans.
    for (const w of tr.words) {
      const mid = (w.start + w.end) / 2;
      if (mid < c.trimStart || mid >= c.trimEnd) continue;
      allWords.push({
        start: toTimeline(Math.max(w.start, c.trimStart)),
        end: toTimeline(Math.min(w.end, c.trimEnd)),
        word: w.word,
      });
    }
    for (const sg of tr.segments) {
      const from = Math.max(sg.start, c.trimStart);
      const to = Math.min(sg.end, c.trimEnd);
      if (to - from < 0.08) continue;
      all.push({ start: toTimeline(from), end: toTimeline(to), text: sg.text });
    }
  }

  all.sort((a, b) => a.start - b.start);
  allWords.sort((a, b) => a.start - b.start);
  if (!all.length && !allWords.length) return { captions: [], rawSegments: [], rawWords: [], error: error ?? "unknown" };

  // Repli sur les segments seulement si le fournisseur n'a pas renvoyé de mots.
  const maxWords = subMaxWords ?? undefined;
  const captions = allWords.length
    ? captionsFromWords(allWords, maxWords)
    : segmentCaptions(dedupeSegments(all), maxWords);
  hooks.onLog?.({ type: "captions", n: captions.length, byWords: allWords.length > 0 });
  return { captions, rawSegments: all, rawWords: allWords, error };
}

// ─── Le pipeline complet ────────────────────────────────────────────────────

/**
 * Enchaîne les trois étapes sur une liste de plans et rend le résultat.
 * Ne pose AUCUNE transition : la coupe franche est le montage par défaut.
 * Ne touche ni au DOM de l'éditeur ni à la base — l'appelant décide quoi en faire.
 */
export async function runPreEdit(
  clips: MontageClip[],
  opts: { subMaxWords?: number | null; cache?: TranscriptCache } & PreEditHooks = {},
): Promise<PreEditResult> {
  const cache = opts.cache ?? newTranscriptCache();
  const hooks: PreEditHooks = { onLog: opts.onLog, onStep: opts.onStep, signal: opts.signal };

  hooks.onStep?.(0);
  hooks.onLog?.({ type: "startRushes", n: clips.filter((c) => c.kind === "video").length });
  const trimmed = await trimClipsByQuality(clips, cache, hooks);

  hooks.onStep?.(1);
  const tightened = await tightenSpeech(trimmed.clips, cache, hooks);

  hooks.onStep?.(2);
  const caps = await buildCaptions(tightened.clips, opts.subMaxWords, cache, hooks);

  hooks.onStep?.(3);
  hooks.onLog?.({ type: "allDone" });

  return {
    clips: tightened.clips,
    captions: caps.captions,
    rawSegments: caps.rawSegments,
    rawWords: caps.rawWords,
    trimmedSec: trimmed.trimmedSec,
    fillersSec: tightened.removedSec,
    error: tightened.error ?? caps.error,
    failed: tightened.failed,
  };
}
