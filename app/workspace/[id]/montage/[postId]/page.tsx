"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { VIcon } from "./icons";
import {
  MontageClip, OverlayClip, Caption, TitleEl, StickerEl, AudioTrack, MontageProject, SubCustom,
  FILTERS, TRANSITIONS, SUB_STYLES, FONT_CHOICES, SUB_LENGTHS, DEFAULT_WORDS_PER_CAPTION, DEFAULT_SUB_POS,
  subStyleById, effectiveSubStyle, resolveCapStyle, resolveCapPos, subtitleBoxCss, subBgLayerCss, curveLayout, SUB_BASE_FONT, applySubCase, DEFAULT_SUB_STYLE_ID,
  captionPartAt, subLines,
  // (analyzeClipQuality importé depuis ./autoCut plus bas)
  fmt, newClipDefaults, newOverlayDefaults, clipFilterCss, overlayFilterCss, clipTimelineDur, clipAudioGainAt, overlayTimelineDur, overlayAudioGainAt, segmentCaptions, captionsFromWords, dedupeSegments,
  audioVolumeAt, audioSrcDur, creneauLibre, kenBurnsScale, withAlpha,
  titleLook, titleShadowCss, titleWeight, titleItalic, VIDEO_FORMATS, videoFormatById, EXPORT_QUALITIES,
  overlayEffectCss,
  transitionPairAt, transitionCss, estTransitionGl,
  TITLE_BASE_FONT, TITLE_LINE_HEIGHT, TITLE_DEFAULT_MAX_WIDTH, titleLines, titleBoxWidth,
} from "./constants";
import { ClipStrip, ClipWave, AudioWave, FadeRamp, type ClipStripData } from "./timeline-parts";
import { chargerPoliceGoogle, declarerPoliceMaison, surPolicesChargees } from "./fonts";
import { lectureRapideDisponible, infosVideo, dureeAudio, imagesAux, enJpeg, vignettes, picsAudio, fermerSources } from "./media-read";
import { MontageCtx, CutPanel, TextPanel, CaptionsPanel, AudioPanel, TransitionsPanel, FilterPanel, SpeedPanel, StickerPanel, OverlayPanel, AiPanel } from "./panels";
import { renderExport } from "./export";
import { drawTransitionFrame, drawPlanFixe } from "./render-core";
import { analyzeClipQuality, type TWord } from "./autoCut";
import {
  runPreEdit, trimClipsByQuality, tightenSpeech, buildCaptions,
  detectSpeechSegments, encodeWavMono, newTranscriptCache, computeStarts,
  type TranscriptCache, type TranscribeErrorCode, type PreEditHooks,
} from "./preEdit";
import { detectBeats, beatsOnTimeline, snapClipsToBeats, type BeatMap } from "./beatSync";
import { transcodeToMp4 } from "@/lib/mp4-transcode";
import { isTextEntry } from "@/lib/keys";
import AiThinkingPanel from "@/components/AiThinkingPanel";
import AiChatDock from "@/components/AiChatDock";

// ─── Types / rail ───────────────────────────────────────────────────────────

type RailTool = "media" | "cut" | "overlay" | "text" | "captions" | "audio" | "transitions" | "filter" | "speed" | "sticker" | "ai";

const RAIL_TOOL_KEYS: [RailTool, string, string][] = [
  ["media", "video", "railMedia"],
  ["cut", "scissors", "railCut"],
  /* « Incrustation » ne figure plus dans le rail : on n'y allait que pour
     importer, ce que Médias fait désormais pour tout, et pour régler une
     incrustation déjà posée — auquel cas on la sélectionne, et son panneau
     s'ouvre tout seul. Un onglet qu'on n'ouvre jamais de son plein gré n'a pas
     à occuper le rail. Le panneau, lui, existe toujours. */
  ["text", "text", "railText"],
  ["captions", "captions", "railCaptions"],
  ["audio", "music", "railAudio"],
  ["transitions", "transition", "railTransitions"],
  ["filter", "filter", "railFilter"],
  ["speed", "speed", "railSpeed"],
  ["sticker", "sticker", "railSticker"],
];

const TOOL_TITLE_KEYS: Record<RailTool, string> = {
  media: "panelTitleMedia", cut: "panelTitleCut", overlay: "panelTitleOverlay", text: "panelTitleText", captions: "panelTitleCaptions",
  audio: "panelTitleAudio", transitions: "panelTitleTransitions", filter: "panelTitleFilter", speed: "panelTitleSpeed",
  sticker: "panelTitleSticker", ai: "panelTitleAi",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

// Un <video> créé en JS garde son tampon de décodage — et, en preload="auto",
// le fichier entier — tant qu'on ne le vide pas. Les helpers ci-dessous en
// fabriquent un par plan, à chaque extraction de vignettes ou de frame : sans
// libération, monter une vidéo de dix plans retient dix vidéos complètes en
// mémoire, et Safari finit par recharger l'onglet. Couper la source puis
// appeler load() est le seul moyen de rendre ce tampon.
function releaseMediaElement(el: HTMLMediaElement | null | undefined) {
  if (!el) return;
  try {
    el.pause();
    el.removeAttribute("src");
    el.srcObject = null;
    el.load();
  } catch { /* élément déjà détruit */ }
}

async function getVideoDuration(src: string): Promise<number> {
  // Lecture des métadonnées sans créer de lecteur média. Le chemin ci-dessous
  // reste en repli, avec sa parade au `duration = Infinity` que Chrome renvoie
  // souvent sur un fichier fraîchement envoyé.
  if (lectureRapideDisponible()) {
    const infos = await infosVideo(src);
    if (infos && infos.dur > 0) return infos.dur;
  }
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = src;
    let done = false;
    const finish = (d: number) => {
      if (done) return;
      done = true;
      resolve(d && isFinite(d) && d > 0 ? d : 4);
      releaseMediaElement(v);
    };
    v.onloadedmetadata = () => {
      // Chrome renvoie souvent duration = Infinity pour un fichier fraîchement uploadé :
      // on force le calcul de la vraie durée en cherchant très loin dans la vidéo.
      if (v.duration && isFinite(v.duration)) { finish(v.duration); return; }
      v.currentTime = 1e101;
      v.ontimeupdate = () => { v.ontimeupdate = null; v.currentTime = 0; finish(v.duration); };
    };
    v.onerror = () => finish(4);
    setTimeout(() => finish(v.duration), 4000); // garde-fou : ne jamais rester bloqué
  });
}
async function getAudioDuration(src: string): Promise<number> {
  if (lectureRapideDisponible()) {
    const d = await dureeAudio(src);
    if (d) return d;
  }
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.src = src;
    const finish = (d: number) => { resolve(d); releaseMediaElement(a); };
    a.onloadedmetadata = () => finish(a.duration && isFinite(a.duration) ? a.duration : 3);
    a.onerror = () => finish(3);
  });
}

// Capture une image basse résolution (≤320px de large) d'un plan — vidéo (frame à
// atTime) ou photo — encodée en dataURL JPEG, pour l'envoyer aux endpoints IA
// (recadrage sujet, montage auto, suggestion musicale). Les sources sont des URLs
// Supabase Storage publiques, sans souci CORS pour toDataURL() (comme dans export.ts).
async function grabFrame(src: string, kind: "video" | "photo", atTime = 0, maxW = 320): Promise<string> {
  if (kind === "video") {
    // Décodage direct : un <video> par capture, sur un montage entier, c'était
    // autant de lecteurs média créés d'un coup.
    if (lectureRapideDisponible()) {
      const lu = await imagesAux(src, [Math.max(0, atTime)], { largeur: maxW });
      if (lu && lu.canvases.length) return await enJpeg(lu.canvases[0]);
    }
    const v = document.createElement("video");
    try {
      v.crossOrigin = "anonymous"; v.muted = true; v.preload = "auto"; v.src = src;
      await new Promise<void>((resolve, reject) => { v.onloadedmetadata = () => resolve(); v.onerror = () => reject(new Error("load")); });
      await new Promise<void>((resolve) => { v.onseeked = () => resolve(); v.currentTime = Math.max(0, Math.min(atTime, (v.duration || 1) - 0.05)); });
      const scale = Math.min(1, maxW / (v.videoWidth || maxW));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round((v.videoWidth || maxW) * scale));
      c.height = Math.max(1, Math.round((v.videoHeight || maxW) * scale));
      c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.82);
    } finally {
      // finally, et pas après le return : une source illisible ne doit pas
      // laisser la vidéo chargée derrière elle.
      releaseMediaElement(v);
    }
  }
  const img = new Image();
  img.crossOrigin = "anonymous"; img.src = src;
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("load")); });
  const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
  c.height = Math.max(1, Math.round((img.naturalHeight || maxW) * scale));
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

// ─── Vignettes de la timeline ────────────────────────────────────────────────
// Chaque plan expose N images extraites de la source, TOUJOURS dans le ratio de
// cette source. La timeline les pose ensuite en tuiles de largeur fixe
// (hauteur de piste × ratio) : quand on zoome, il y a PLUS de tuiles au lieu
// d'une image que l'on étire. L'ancienne version composait une bande unique de
// 540×52 px affichée en `backgroundSize: 100% 100%` — d'où des vignettes de plus
// en plus déformées à mesure qu'on zoomait.
// (ClipStripData vit dans timeline-parts.tsx, avec les composants qui la consomment)

/* Cache d'images par FICHIER SOURCE, et non par plan.

   Les vignettes étaient mémorisées par identifiant de plan. Couper un plan en
   deux crée deux identifiants neufs : les deux moitiés repartaient donc à zéro,
   rechargeaient la vidéo entière et la parcouraient image par image, alors que
   les images étaient déjà décodées une seconde plus tôt. D'où le plan vert vide
   pendant plusieurs secondes après chaque coupe.

   Ici, chaque image extraite est rangée avec son instant, sous la clé du
   fichier. N'importe quel plan issu de ce fichier peut donc s'afficher tout de
   suite avec les images voisines déjà connues, pendant que l'extraction précise
   se fait en tâche de fond. */
type CachedFrame = { t: number; url: string };
const srcFrameCache = new Map<string, { aspect: number; frames: CachedFrame[] }>();

function rememberFrames(src: string, aspect: number, added: CachedFrame[]): void {
  const entry = srcFrameCache.get(src) ?? { aspect, frames: [] };
  entry.aspect = aspect;
  for (const fr of added) {
    if (!entry.frames.some((x) => Math.abs(x.t - fr.t) < 0.05)) entry.frames.push(fr);
  }
  entry.frames.sort((x, y) => x.t - y.t);
  // Un plan long fortement retouché finirait par tout garder en mémoire : on
  // plafonne, en gardant les images réparties sur toute la durée du fichier.
  const MAX = 120;
  if (entry.frames.length > MAX) {
    const step = entry.frames.length / MAX;
    entry.frames = Array.from({ length: MAX }, (_, i) => entry.frames[Math.floor(i * step)]);
  }
  srcFrameCache.set(src, entry);
}

/** Bande provisoire tirée du cache : l'image connue la plus proche de chaque
    instant voulu. Rend `undefined` tant qu'on n'a rien de ce fichier. */
function stripFromCache(src: string, a: number, b: number, count: number): ClipStripData | undefined {
  const entry = srcFrameCache.get(src);
  if (!entry || !entry.frames.length) return undefined;
  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    const tt = count === 1 ? a : a + (b - a) * (i / (count - 1));
    let best = entry.frames[0];
    for (const fr of entry.frames) if (Math.abs(fr.t - tt) < Math.abs(best.t - tt)) best = fr;
    frames.push(best.url);
  }
  return { frames, aspect: entry.aspect };
}

/** Nombre d'images d'une bande, à la même densité que l'extraction. */
function stripCount(a: number, b: number): number {
  return Math.max(3, Math.min(14, Math.ceil((b - a) / 1.2)));
}

async function extractClipFrames(src: string, trimStart: number, trimEnd: number): Promise<ClipStripData> {
  /* Chemin rapide : décodage direct, sans élément <video>.

     L'ancien chemin ci-dessous crée un <video> jetable par extraction, et Chrome
     refuse d'en créer au delà d'une cinquantaine par onglet. Sur un montage un
     peu fourni, c'est ce qui finissait par empêcher des sources de charger.
     Il reste en repli pour les navigateurs sans WebCodecs. */
  if (lectureRapideDisponible()) {
    const infos = await infosVideo(src);
    if (infos) {
      const dur = infos.dur > 0 ? infos.dur : Math.max(0.1, trimEnd - trimStart);
      const a = Math.max(0, Math.min(trimStart || 0, dur - 0.05));
      const b = Math.max(a + 0.05, Math.min(trimEnd || dur, dur));
      const count = stripCount(a, b);
      const instants = Array.from({ length: count }, (_, i) => count === 1 ? a : a + (b - a) * (i / (count - 1)));
      const res = await vignettes(src, instants, 120);
      if (res && res.frames.length) {
        rememberFrames(src, res.aspect, res.frames.map((url, i) => ({ t: instants[Math.min(i, instants.length - 1)], url })));
        return res;
      }
    }
  }
  const v = document.createElement("video");
  try {
  v.crossOrigin = "anonymous"; v.muted = true; v.preload = "auto"; v.src = src;
  await new Promise<void>((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error("load")); });
  const dur = v.duration && isFinite(v.duration) ? v.duration : Math.max(0.1, trimEnd - trimStart);
  const a = Math.max(0, Math.min(trimStart || 0, dur - 0.05));
  const b = Math.max(a + 0.05, Math.min(trimEnd || dur, dur));
  const vw = v.videoWidth || 16, vh = v.videoHeight || 9;
  const aspect = vw / vh;
  const count = stripCount(a, b);
  const FH = 120; // hauteur d'extraction — couvre les pistes agrandies sans flou
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(FH * aspect)); canvas.height = FH;
  const ctx = canvas.getContext("2d")!;
  const frames: string[] = [];
  const cached: CachedFrame[] = [];
  for (let i = 0; i < count; i++) {
    const tt = count === 1 ? a : a + (b - a) * (i / (count - 1));
    await new Promise<void>((res) => { v.onseeked = () => res(); v.currentTime = Math.max(0, Math.min(tt, dur - 0.05)); });
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height); // ratio source → aucune déformation
    const url = canvas.toDataURL("image/jpeg", 0.72);
    frames.push(url);
    cached.push({ t: tt, url });
  }
  rememberFrames(src, aspect, cached);
  return { frames, aspect };
  } finally {
    // La bande de vignettes est ré-extraite à chaque changement de trim : sans
    // libération, chaque ajustement laissait une vidéo complète en mémoire.
    releaseMediaElement(v);
  }
}

// Une photo est une « bande » d'une seule image : mêmes tuiles, même rendu que la vidéo.
async function photoStripData(src: string): Promise<ClipStripData> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => res(im); im.onerror = () => rej(new Error("load")); im.src = src;
  });
  const aspect = (img.naturalWidth || 16) / (img.naturalHeight || 9);
  rememberFrames(src, aspect, [{ t: 0, url: src }]);
  return { frames: [src], aspect };
}

// Objet figé : passé en `style` à un composant mémoïsé, un littéral recréé à
// chaque rendu suffirait à annuler la mémoïsation.
const FADE_ABS: React.CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };

/* Résolution du spectre audio.

   Elle était de 120 valeurs pour TOUT le fichier, quelle que soit sa durée. Sur
   une musique de trois minutes, cela fait une mesure toutes les 1,5 seconde :
   chaque barre écrase un couplet entier, le dessin devient un pavé uniforme et
   on ne reconnaît plus rien. On ne voyait ni les temps, ni les ruptures, ni les
   silences, alors que c'est précisément ce qu'on cherche en calant une musique.

   On échantillonne donc à la SECONDE, pas au fichier : 30 mesures par seconde,
   soit une tous les 33 ms, de quoi distinguer chaque frappe. Le plafond évite
   qu'un fichier très long ne fasse enfler le projet enregistré. */
/* Largeur de la gouttière d'étiquettes, à gauche de la timeline.

   Elle était écrite en dur (92) à six endroits : le curseur de lecture, le
   décalage de la règle, le zoom à la molette, la détection de la zone de dépôt.
   Une seule valeur maintenant, partagée avec la CSS par une variable.

   Elle est large parce qu'elle porte tout : l'icône de la piste, son nom, ses
   trois bascules (verrou, oeil, son) et les deux boutons de rangée. Ces deux
   derniers ont d'abord été cachés au survol pour gagner de la place ; c'était
   une fausse économie, personne ne devine un bouton invisible. */
/* Tailles courantes, proposées dans la fenêtre du format personnalisé.

   Ce sont celles qu'on saisit réellement : les formats des réseaux en pleine
   définition, plus le 4K pour une sortie hors réseau. Les taper à la main à
   chaque fois n'apporte rien. */
const CUSTOM_SIZES: [number, number, string][] = [
  [1080, 1920, "1080×1920"],
  [1080, 1080, "1080×1080"],
  [1080, 1350, "1080×1350"],
  [1920, 1080, "1920×1080"],
  [2160, 3840, "2160×3840"],
  [3840, 2160, "3840×2160"],
];

const LANE_LABEL_W = 160;

const WAVEFORM_PER_SECOND = 30;
const WAVEFORM_MAX = 9000;   // ~5 min à pleine résolution
function waveformCount(seconds: number): number {
  return Math.max(120, Math.min(WAVEFORM_MAX, Math.round(seconds * WAVEFORM_PER_SECOND)));
}
// Décode le fichier audio et calcule les pics d'amplitude normalisés (0-1) pour
// l'affichage visuel dans la timeline. Best-effort : renvoie [] si le décodage échoue
// (ex. format non supporté) plutôt que de bloquer l'import.
async function computeWaveform(file: File): Promise<number[]> {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const data = buf.getChannelData(0);
    const n = waveformCount(buf.duration);
    const blockSize = Math.max(1, Math.floor(data.length / n));
    const peaks: number[] = [];
    for (let i = 0; i < n; i++) {
      let max = 0;
      const start = i * blockSize;
      // Un pas d'échantillonnage : sur un bloc de 33 ms à 48 kHz il y a 1600
      // échantillons, les parcourir tous n'apprend rien de plus que d'en lire un
      // sur quatre, et une musique longue se décode quatre fois plus vite.
      for (let j = 0; j < blockSize && start + j < data.length; j += 4) max = Math.max(max, Math.abs(data[start + j]));
      peaks.push(max);
    }
    ctx.close();
    const peak = Math.max(...peaks, 0.01);
    // Arrondi à deux décimales : le spectre est enregistré dans le projet, et la
    // précision au-delà ne se voit pas à l'écran mais pèse dans le fichier.
    return peaks.map(p => Math.round(Math.min(1, p / peak) * 100) / 100);
  } catch {
    return [];
  }
}

// Comme computeWaveform mais depuis une URL (son embarqué d'un plan vidéo) : on
// télécharge la source et on décode sa piste audio. Best-effort → [] si échec.
async function computeWaveformFromUrl(src: string): Promise<number[]> {
  // Chemin rapide : lecture par plages d'octets et pics calculés au fil du
  // décodage. L'ancien chemin télécharge le fichier ENTIER puis le décode d'un
  // bloc, ce qui met tout le son d'une musique en mémoire d'un coup.
  if (lectureRapideDisponible()) {
    const pics = await picsAudio(src, WAVEFORM_PER_SECOND, WAVEFORM_MAX);
    if (pics && pics.length) return pics;
  }
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const ab = await (await fetch(src)).arrayBuffer();
    const buf = await ctx.decodeAudioData(ab);
    const data = buf.getChannelData(0);
    const n = waveformCount(buf.duration);
    const blockSize = Math.max(1, Math.floor(data.length / n));
    const peaks: number[] = [];
    for (let i = 0; i < n; i++) {
      let max = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize && start + j < data.length; j += 4) max = Math.max(max, Math.abs(data[start + j]));
      peaks.push(max);
    }
    ctx.close();
    const peak = Math.max(...peaks, 0.01);
    return peaks.map((p) => Math.round(Math.min(1, p / peak) * 100) / 100);
  } catch {
    return [];
  }
}

// 120 pics normalisés depuis des échantillons (pour l'affichage timeline après traitement).
// Même résolution que computeWaveform : la voix traitée doit se lire aussi
// finement que la musique importée. `sampleRate` sert à retrouver la durée.
function peaksFromSamples(samples: Float32Array, sampleRate = 48000): number[] {
  const N = waveformCount(samples.length / sampleRate);
  const block = Math.max(1, Math.floor(samples.length / N));
  const peaks: number[] = [];
  for (let i = 0; i < N; i++) { let m = 0; const s = i * block; for (let j = 0; j < block && s + j < samples.length; j += 4) m = Math.max(m, Math.abs(samples[s + j])); peaks.push(m); }
  const peak = Math.max(...peaks, 0.01);
  return peaks.map((p) => Math.round(Math.min(1, p / peak) * 100) / 100);
}

// Style de sous-titres dérivé de la charte du client : surlignage du mot actif dans la
// couleur d'accent de la marque, sur une base lisible (contour noir, texte blanc).
// Appliqué par défaut aux montages jamais personnalisés → sous-titres déjà à la charte.
function charterSubDefault(ws: {
  accent_color?: string | null; subtitle_style_id?: string | null;
  subtitle_custom?: SubCustom | null; subtitle_pos?: { x: number; y: number } | null;
  subtitle_max_words?: number | null;
} | null | undefined): { styleId: string; custom: SubCustom; pos: { x: number; y: number } | null; maxWords: number | null } | null {
  const acc = ws?.accent_color;
  const hasStyle = SUB_STYLES.some((s) => s.id === ws?.subtitle_style_id);
  const custom = ws?.subtitle_custom && typeof ws.subtitle_custom === "object" ? ws.subtitle_custom : null;
  const p = ws?.subtitle_pos;
  const pos = p && typeof p === "object" && typeof p.x === "number" && typeof p.y === "number" ? { x: p.x, y: p.y } : null;
  const maxWords = typeof ws?.subtitle_max_words === "number" ? ws.subtitle_max_words : null;
  // Rien de configuré ET pas de couleur d'accent exploitable → on laisse le défaut du montage.
  if (!hasStyle && !custom && !pos && !maxWords && (!acc || !/^#([0-9a-fA-F]{3,8})$/.test(acc))) return null;
  // Sans style configuré par le client, on part du sobre plutôt que du contour
  // épais : le point de départ doit être neutre, l'habillage vient ensuite.
  const styleId = hasStyle ? (ws!.subtitle_style_id as string) : DEFAULT_SUB_STYLE_ID;
  // Le template du client prime ; à défaut, on surligne simplement à la couleur d'accent.
  return { styleId, custom: custom ?? { hi: acc as string }, pos, maxWords };
}

const PHOTO_DEFAULT_DUR = 3;

// Migration douce depuis l'ancien format (Lot 1) { id, kind, name, src, dur }
function normalizeClip(raw: any): MontageClip {
  if (raw && raw.trimEnd !== undefined) return raw as MontageClip;
  const dur = raw?.dur ?? 4;
  return {
    id: raw.id, kind: raw.kind, name: raw.name, src: raw.src,
    srcDur: raw.kind === "video" ? dur : 15,
    trimStart: 0,
    trimEnd: raw.kind === "video" ? dur : Math.min(dur, 15),
    ...newClipDefaults(),
  };
}

const FONT_CSS: Record<string, string> = {
  archivo: "var(--display)", instrument: "'Instrument Serif', serif", satoshi: "var(--sans)",
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function MontagePage() {
  const t = useTranslations('montage');
  const tc = useTranslations('montageConstants');
  // Ces deux tables ne dépendent que de la langue. Reconstruites à chaque rendu,
  // elles rejouaient une vingtaine de recherches de traduction soixante fois par
  // seconde pendant la lecture, pour un résultat identique.
  const RAIL_TOOLS = useMemo(
    () => RAIL_TOOL_KEYS.map(([id, icon, key]) => [id, icon, t(key)] as [RailTool, string, string]),
    [t],
  );
  const TOOL_TITLES = useMemo(
    () => Object.fromEntries(Object.entries(TOOL_TITLE_KEYS).map(([id, key]) => [id, t(key)])) as Record<RailTool, string>,
    [t],
  );
  const params = useParams();
  const workspaceId = params.id as string;
  const postId = params.postId as string;
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState(t('defaultProjectName'));
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandColors, setBrandColors] = useState<string[]>([]);
  const [brandFonts, setBrandFonts] = useState<string[]>([]);

  const [clips, setClips] = useState<MontageClip[]>([]);
  const [overlays, setOverlays] = useState<OverlayClip[]>([]);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [subStyleId, setSubStyleId] = useState<string>(DEFAULT_SUB_STYLE_ID);
  const [subMaxWords, setSubMaxWords] = useState<number>(DEFAULT_WORDS_PER_CAPTION);
  const [subPos, setSubPos] = useState<{ x: number; y: number }>(DEFAULT_SUB_POS);
  const [subCustom, setSubCustom] = useState<SubCustom>({});
  const [linkedSubs, setLinkedSubs] = useState(true); // true = style commun à tous ; false = par sous-titre
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [rawSegments, setRawSegments] = useState<{ start: number; end: number; text: string }[]>([]);
  // Mots horodatés recalés sur la timeline : source de vérité des sous-titres. Conservés
  // pour pouvoir changer la longueur des sous-titres sans relancer la transcription.
  const [rawWords, setRawWords] = useState<TWord[]>([]);
  const [subSelected, setSubSelected] = useState(false);
  const [titles, setTitles] = useState<TitleEl[]>([]);
  const [stickers, setStickers] = useState<StickerEl[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [formatId, setFormatId] = useState("story");
  const [customW, setCustomW] = useState(1080);
  const [customH, setCustomH] = useState(1920);
  const [exportQuality, setExportQuality] = useState("standard");
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const [tool, setTool] = useState<RailTool>("media");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTitleId, setSelectedTitleId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null); // titre édité en inline sur la preview (double-clic)
  /* Sélection MULTIPLE de textes dans l'aperçu.

     `selectedTitleId` reste le titre « principal » : c'est le sien que montre le
     panneau, et c'est sur lui qu'agissent les poignées de taille et de rotation,
     qui n'ont de sens que sur un seul objet. `titresSel` porte le groupe entier,
     celui qu'on déplace d'un bloc. ⇧ + clic ajoute ou retire du groupe. */
  const [titresSel, setTitresSel] = useState<Set<string>>(new Set());
  // Menu contextuel (clic droit), adapté au type d'élément visé (façon CapCut).
  const [clipMenu, setClipMenu] = useState<{ x: number; y: number; id: string; kind: "clip" | "overlay" | "audio" | "title" | "caption" } | null>(null);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [audioOnlyId, setAudioOnlyId] = useState<string | null>(null); // sélection "audio seul" (Option/Alt+clic)
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null); // piste audio sélectionnée (déplacer/supprimer)
  const [tlFileOver, setTlFileOver] = useState(false); // survol d'un fichier glissé sur la timeline
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set()); // sélection multiple (plans/incrustations/audio)
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null); // rectangle de sélection
  const [dragOver, setDragOver] = useState(false);
  // Glissement en cours : le plan suit le curseur « comme dans la main » (copie fidèle
  // flottante = tlGhost) + piste survolée pour le dépôt (dropLane).
  const [dragActive, setDragActive] = useState(false);
  const [tlGhost, setTlGhost] = useState<{ x: number; y: number; w: number; id: string; kind: "clip" | "overlay" } | null>(null);
  const [dropLane, setDropLane] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingOverlay, setUploadingOverlay] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [croppingClipId, setCroppingClipId] = useState<string | null>(null);
  const [assembling, setAssembling] = useState(false);
  // Légende générée en fin de montage (cf. generateCaptionAI).
  const [captioning, setCaptioning] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  // Prémontage par analyse d'image (cf. autoCutQuality).
  const [autoCutting, setAutoCutting] = useState(false);
  const [cuttingFillers, setCuttingFillers] = useState(false);
  // Couverture (miniature) choisie au playhead, en fin de montage.
  const [settingCover, setSettingCover] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  // Prémontage IA complet lancé à l'ouverture (?premontage=1).
  const [preEditing, setPreEditing] = useState(false);
  const [preEditStep, setPreEditStep] = useState<string | null>(null);
  // Journal fin du prémontage : alimenté par les étapes RÉELLES (un plan analysé,
  // une transcription reçue, des coupes appliquées…) et révélé à la machine à
  // écrire par AiThinkingPanel. Aucune ligne décorative : ce qui s'affiche a eu lieu.
  const [preEditStepIdx, setPreEditStepIdx] = useState(-1);
  // Date du dernier prémontage, relue depuis le projet : elle survit au fait de
  // quitter la page, ce qu'un simple drapeau en mémoire ne faisait pas.
  const preEditedAtRef = useRef<string | null>(null);
  const [aiLog, setAiLog] = useState<string[]>([]);
  const pushAiLog = useCallback((line: string) => setAiLog((l) => (l[l.length - 1] === line ? l : [...l, line])), []);
  // Le journal ne s'alimente que pendant le prémontage complet (les outils lancés
  // à l'unité gardent leurs toasts habituels).
  const loggingRef = useRef(false);
  const logStep = useCallback((line: string) => { if (loggingRef.current) pushAiLog(line); }, [pushAiLog]);
  const [autoCutProgress, setAutoCutProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const [autoCutDone, setAutoCutDone] = useState<{ clips: number; seconds: number } | null>(null);
  const [cuttingSilence, setCuttingSilence] = useState(false);
  const [processingVoice, setProcessingVoice] = useState<string | null>(null); // id de la piste audio en cours de traitement voix
  const [beatSyncing, setBeatSyncing] = useState<string | null>(null); // id de la piste dont on analyse le rythme
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [videoDescription, setVideoDescription] = useState<string | null>(null);
  const [suggestingMusic, setSuggestingMusic] = useState(false);
  const [musicSuggestion, setMusicSuggestion] = useState<string | null>(null);
  const [isRecordingVO, setIsRecordingVO] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportPhase, setExportPhase] = useState<"render" | "transcode">("render");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<"ok" | "error">("ok");
  const [pps, setPps] = useState(40);
  const [histTick, setHistTick] = useState(0);
  const [extraVideoTracks, setExtraVideoTracks] = useState(0); // pistes vidéo vides ajoutées par l'utilisateur (au-delà des pistes occupées)
  const [extraAudioTracks, setExtraAudioTracks] = useState(0); // idem pour les pistes audio ajoutées
  const [extraTextTracks, setExtraTextTracks] = useState(0);   // idem pour les rangées de texte

  // Disposition redimensionnable (persistée) — comme CapCut
  const [panelW, setPanelW] = useState(312);
  const [timelineH, setTimelineH] = useState(178);
  const [trackScale, setTrackScale] = useState(1); // hauteur des pistes (0.7–2.2), façon CapCut
  const [laneHeights, setLaneHeights] = useState<Record<string, number>>({}); // hauteur individuelle par piste (px)
  const [lockedLanes, setLockedLanes] = useState<Set<string>>(new Set()); // pistes verrouillées (pas d'édition)
  const [hiddenLanes, setHiddenLanes] = useState<Set<string>>(new Set());  // pistes masquées (invisibles à l'aperçu/export)
  const [mutedLanes, setMutedLanes] = useState<Set<string>>(new Set());    // pistes muettes
  const mutedLanesRef = useRef(mutedLanes); mutedLanesRef.current = mutedLanes;
  useEffect(() => {
    try {
      const w = Number(localStorage.getItem("klip-mz-panelW"));
      const h = Number(localStorage.getItem("klip-mz-timelineH"));
      const ts = Number(localStorage.getItem("klip-mz-trackScale"));
      if (w >= 240 && w <= 520) setPanelW(w);
      if (h >= 120 && h <= 640) setTimelineH(h);
      if (ts >= 0.7 && ts <= 2.2) setTrackScale(ts);
    } catch {}
  }, []);
  const tsDragRef = useRef<{ startY: number; s0: number } | null>(null);
  function onTsDown(e: React.PointerEvent) { e.preventDefault(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {} tsDragRef.current = { startY: e.clientY, s0: trackScale }; }
  function onTsMove(e: React.PointerEvent) { const d = tsDragRef.current; if (!d) return; setTrackScale(Math.max(0.7, Math.min(2.2, d.s0 - (e.clientY - d.startY) / 140))); }
  function onTsUp(e: React.PointerEvent) { if (tsDragRef.current) { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} tsDragRef.current = null; try { localStorage.setItem("klip-mz-trackScale", String(trackScale)); } catch {} } }
  // Hauteur d'une piste : override individuel sinon défaut (34 × échelle globale).
  const laneH = (key: string) => laneHeights[key] ?? Math.round(34 * trackScale);
  // Hauteur du bloc (plan/texte/audio) : remplit la piste en gardant une petite marge,
  // pour que le contenu s'adapte à la taille de la piste quand on la redimensionne.
  const blockH = (key: string) => Math.max(18, laneH(key) - 4);
  const toggleLane = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    set((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  // Contrôles à gauche d'une piste (verrouiller / masquer / couper le son), façon CapCut.
  function LaneControls({ laneKey, audio }: { laneKey: string; audio?: boolean }) {
    const locked = lockedLanes.has(laneKey), hidden = hiddenLanes.has(laneKey), muted = mutedLanes.has(laneKey);
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2, marginLeft: "auto", flexShrink: 0 }} onPointerDown={(e) => e.stopPropagation()}>
        <button className={"a-lanectl" + (locked ? " on" : "")} title={t('lockTrack')} onClick={() => toggleLane(setLockedLanes, laneKey)}><VIcon name="lock" size={12} /></button>
        {!audio && <button className={"a-lanectl" + (hidden ? " on" : "")} title={t('hideTrack')} onClick={() => toggleLane(setHiddenLanes, laneKey)}><VIcon name={hidden ? "eyeOff" : "eye"} size={12} /></button>}
        <button className={"a-lanectl" + (muted ? " on" : "")} title={t('muteTrack')} onClick={() => toggleLane(setMutedLanes, laneKey)}><VIcon name={muted ? "mute" : "volume"} size={12} /></button>
      </span>
    );
  }
  // Poignée fine au bas d'une piste : tirer ↕ pour la redimensionner individuellement.
  function LaneResize({ laneKey }: { laneKey: string }) {
    return (
      <div className="a-lane-vresize" title={t('trackHeightTitle')}
        onPointerDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
          const startY = e.clientY, h0 = laneHeights[laneKey] ?? Math.round(34 * trackScale);
          const onMove = (ev: PointerEvent) => setLaneHeights((p) => ({ ...p, [laneKey]: Math.max(24, Math.min(240, h0 + (ev.clientY - startY))) }));
          const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
          window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
        }}
      />
    );
  }
  const startPanelResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX, startW = panelW;
    const move = (ev: PointerEvent) => setPanelW(Math.max(240, Math.min(520, startW + (ev.clientX - startX))));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); document.body.style.cursor = ""; setPanelW((w) => { try { localStorage.setItem("klip-mz-panelW", String(w)); } catch {} return w; }); };
    document.body.style.cursor = "ew-resize";
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }, [panelW]);
  const startTimelineResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY, startH = timelineH;
    const move = (ev: PointerEvent) => setTimelineH(Math.max(120, Math.min(window.innerHeight - 220, startH + (startY - ev.clientY))));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); document.body.style.cursor = ""; setTimelineH((h) => { try { localStorage.setItem("klip-mz-timelineH", String(h)); } catch {} return h; }); };
    document.body.style.cursor = "ns-resize";
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }, [timelineH]);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(playing); playingRef.current = playing;
  const [stageW, setStageW] = useState(0); // largeur px réelle de la preview → texte figé à l'échelle de l'image (WYSIWYG avec l'export)
  /* ─── Bibliothèque de médias ───────────────────────────────────────────────
     Un seul inventaire, quel que soit l'endroit où le fichier a été posé :
     plan de la piste principale, incrustation, ou piste sonore. C'est ce qui
     permet de se passer de l'onglet Incrustation, et de retrouver un fichier
     sans se souvenir de ce qu'on en avait fait. */
  const [mediaFilter, setMediaFilter] = useState<"all" | "video" | "photo" | "audio">("all");
  const [mediaQuery, setMediaQuery] = useState("");

  /* Recalcul quand une police finit d'arriver.

     Le découpage des titres en lignes se mesure sur un canvas : mesuré avant que
     la police ne soit là, il porte sur la fonte de repli et coupe au mauvais
     endroit. Ce compteur ne sert qu'à refaire le rendu à ce moment-là. */
  const [policesPretes, setPolicesPretes] = useState(0);
  useEffect(() => surPolicesChargees(() => setPolicesPretes((n) => n + 1)), []);

  const [formatPersoOuvert, setFormatPersoOuvert] = useState(false);
  const [qualiteOuverte, setQualiteOuverte] = useState(false);
  const qualiteRef = useRef<HTMLDivElement>(null);
  // Un menu qui ne se referme pas au clic à côté reste ouvert par-dessus le
  // montage : c'est le comportement attendu de n'importe quelle liste.
  // Échap referme la fenêtre du format : c'est le réflexe, et il n'y a pas de
  // bouton d'annulation puisqu'il n'y a rien à annuler.
  useEffect(() => {
    if (!formatPersoOuvert) return;
    const surTouche = (e: KeyboardEvent) => { if (e.key === "Escape") setFormatPersoOuvert(false); };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [formatPersoOuvert]);

  useEffect(() => {
    if (!qualiteOuverte) return;
    const dehors = (e: MouseEvent) => {
      if (qualiteRef.current && !qualiteRef.current.contains(e.target as Node)) setQualiteOuverte(false);
    };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [qualiteOuverte]);

  const [previewZoom, setPreviewZoom] = useState(1);
  /* Déplacement dans l'aperçu zoomé.

     On pouvait grossir l'image, jamais s'y promener : passé 100 %, tout ce qui
     sortait du cadre était perdu, et zoomer ne servait donc qu'à regarder le
     centre. Deux gestes le permettent maintenant, ceux qu'on attend d'un
     éditeur : le glissement à la souris sur le fond de l'aperçu, et le
     défilement à deux doigts (le pincement, lui, reste le zoom). */
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  // Aperçu en grand : la scène recouvre le module le temps de regarder.
  const [stageFull, setStageFull] = useState(false);
  useEffect(() => {
    if (!stageFull) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setStageFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stageFull]); // zoom de la preview (pincement/molette), 1–5
  const [strips, setStrips] = useState<Record<string, ClipStripData>>({}); // images + ratio source, par id de plan
  const stripReqRef = useRef<Set<string>>(new Set()); // ids déjà demandés (évite les régénérations)
  const [clipWaves, setClipWaves] = useState<Record<string, number[]>>({}); // spectre audio du son embarqué, par src
  const waveReqRef = useRef<Set<string>>(new Set());
  // Valeurs de zoom lues au démarrage d'un geste (Safari) — refs pour éviter les closures figées.
  const ppsRef = useRef(pps); ppsRef.current = pps;
  const previewZoomRef = useRef(previewZoom); previewZoomRef.current = previewZoom;
  /** Empêche de pousser le cadre entièrement hors de vue : on ne peut se
   *  déplacer que dans ce que le zoom a fait déborder. */
  const bornerPan = useCallback((p: { x: number; y: number }) => {
    const el = stageRef.current;
    const z = previewZoomRef.current;
    if (!el || !el.parentElement || z <= 1) return { x: 0, y: 0 };
    const maxX = Math.max(0, (el.offsetWidth * z - el.parentElement.clientWidth) / 2);
    const maxY = Math.max(0, (el.offsetHeight * z - el.parentElement.clientHeight) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, p.x)), y: Math.max(-maxY, Math.min(maxY, p.y)) };
  }, []);
  const bornerPanRef = useRef(bornerPan); bornerPanRef.current = bornerPan;
  // Revenu à 100 %, il n'y a plus rien qui dépasse : le cadre se recentre.
  useEffect(() => { if (previewZoom <= 1) setPreviewPan({ x: 0, y: 0 }); else setPreviewPan((p) => bornerPan(p)); }, [previewZoom, bornerPan]);
  // Génère les bandes-film (aperçu) des plans vidéo, une seule fois chacune, en tâche de
  // fond et en série (pour ne pas saturer le décodage). Les photos affichent déjà leur image.
  useEffect(() => {
    // Pas d'annulation qui jette les résultats : plusieurs rendus rapprochés (ex. glisser
    // un plan vers une nouvelle piste = setClips + setOverlays) relançaient l'effet et le
    // strip de l'incrustation était marqué « demandé » puis annulé → jamais généré. Ici on
    // laisse chaque génération finir ; stripReqRef évite juste les doublons.
    if (playing) return; // on ne décode pas de vignettes pendant la lecture (évite les à-coups)
    (async () => {
      for (const x of [...clips, ...overlays]) {
        if (stripReqRef.current.has(x.id)) continue;
        stripReqRef.current.add(x.id);
        // Aperçu instantané avec ce qu'on sait déjà de ce fichier : après une
        // coupe ou une duplication, le plan est habillé sans attendre.
        const a0 = Math.max(0, x.trimStart || 0);
        const b0 = Math.max(a0 + 0.05, x.trimEnd || a0 + 1);
        const provisional = stripFromCache(x.src, a0, b0, stripCount(a0, b0));
        if (provisional) setStrips((p) => (p[x.id] ? p : { ...p, [x.id]: provisional }));
        try {
          // Les photos passent par le même rendu en tuiles que les vidéos : une seule
          // image, répétée, au lieu d'un `object-fit: cover` étalé sur tout le plan.
          const s = x.kind === "video"
            ? await extractClipFrames(x.src, x.trimStart, x.trimEnd)
            : await photoStripData(x.src);
          setStrips((p) => ({ ...p, [x.id]: s }));
        } catch { stripReqRef.current.delete(x.id); }
      }
    })();
  }, [clips, overlays, playing]);
  // Spectre audio du son embarqué des plans vidéo (clé = src, mutualisé entre plans du
  // même fichier), pour se repérer au son sur la timeline. En tâche de fond, mis en cache.
  useEffect(() => {
    if (playing) return; // idem : pas de décodage audio pendant la lecture
    (async () => {
      for (const c of [...clips, ...overlays]) {
        if (c.kind !== "video" || waveReqRef.current.has(c.src)) continue;
        waveReqRef.current.add(c.src);
        try {
          const w = await computeWaveformFromUrl(c.src);
          if (w.length) setClipWaves((p) => ({ ...p, [c.src]: w }));
          else waveReqRef.current.delete(c.src);
        } catch { waveReqRef.current.delete(c.src); }
      }
    })();
  }, [clips, overlays, playing]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null); // import « vidéos » dédié
  const photoInputRef = useRef<HTMLInputElement>(null); // import « photos » dédié
  const overlayInputRef = useRef<HTMLInputElement>(null);
  // Deux lecteurs qui ALTERNENT : pendant qu'un plan joue, le suivant est déjà
  // chargé et positionné dans l'autre. Le changement de plan devient instantané
  // (un seul <video> imposait un rechargement complet à chaque coupe = saccade).
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null); // pointe sur l'élément AFFICHÉ
  const slotSrcRef = useRef<[string | null, string | null]>([null, null]);
  // Quel PLAN chaque lecteur est prêt à jouer (déjà positionné sur son trimStart).
  const slotClipRef = useRef<[string | null, string | null]>([null, null]);
  const lastSeekRef = useRef(0); // temporisation des recalages de dérive
  const mediaErrRef = useRef<Set<string>>(new Set()); // sources déjà signalées comme illisibles
  const [slot, setSlot] = useState<0 | 1>(0);
  // Couches de l'aperçu : l'image entrante, l'image figée du plan sortant, et la
  // toile réservée aux transitions à shader.
  const imgInRef = useRef<HTMLImageElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  // Jonction visée par un glisser en cours, pour qu'on voie où ça va tomber.
  const [jonctionSurvolee, setJonctionSurvolee] = useState<string | null>(null);
  /* Transition sélectionnée, désignée par le plan ENTRANT qui la porte. Elle est
     un objet de la timeline comme un autre : on la choisit, on la règle, on la
     supprime. Sans ça, on pouvait poser une transition mais jamais la retirer. */
  const [selectedTransId, setSelectedTransId] = useState<string | null>(null);

  /** La coupe la plus proche d'une abscisse écran, ou null s'il n'y en a pas.
   *  Viser un rond de vingt-deux pixels à la souris, en glissant, rate une fois
   *  sur deux : on accepte le dépôt N'IMPORTE OÙ sur la piste et on choisit la
   *  coupe la plus proche. */
  function jonctionLaPlusProche(clientX: number): string | null {
    const r = rulerRef.current?.getBoundingClientRect();
    if (!r || clipStarts.length < 2) return null;
    const t = (clientX - r.left) / pps;
    let meilleur: { id: string; d: number } | null = null;
    for (let i = 1; i < clipStarts.length; i++) {
      const d = Math.abs(clipStarts[i].start - t);
      if (!meilleur || d < meilleur.d) meilleur = { id: clipStarts[i].id, d };
    }
    return meilleur ? meilleur.id : null;
  }

  /** Pose la transition `id` sur la coupe qui précède le plan `clipId`. */
  function poserTransition(clipId: string, transId: string) {
    const cible = clipStarts.find((c) => c.id === clipId);
    if (!cible || !TRANSITIONS.some((tr) => tr.id === transId)) return;
    updateClip(clipId, { transitionIn: transId, transitionDur: cible.transitionDur || 0.5 });
    deselectAll();
    setSelectedTransId(transId === "cut" ? null : clipId);
    setSelectedClipId(clipId);
    setTool("transitions");
    toast(tc(`transition.${transId}`));
  }

  const estGlisserTransition = (dt: DataTransfer) =>
    dt.types.includes("application/x-klip-transition") || dt.types.includes("text/plain");
  /** L'identifiant transporté, quel que soit le format qui a survécu au voyage. */
  function transitionGlissee(dt: DataTransfer): string | null {
    const direct = dt.getData("application/x-klip-transition");
    if (direct && TRANSITIONS.some((tr) => tr.id === direct)) return direct;
    const texte = dt.getData("text/plain");
    if (texte.startsWith("klip-transition:")) {
      const id = texte.slice("klip-transition:".length);
      if (TRANSITIONS.some((tr) => tr.id === id)) return id;
    }
    return null;
  }
  // Miroir SYNCHRONE de `slot`. Indispensable : `setSlot()` n'est appliqué qu'au rendu
  // suivant, or l'effet de préchargement se rejoue DANS LE MÊME commit que la bascule
  // de plan. Avec l'ancienne valeur d'état il calculait « lecteur libre = celui qui
  // vient de devenir actif » et le mettait en pause en le déplaçant sur le plan
  // suivant — d'où l'image bloquée en boucle sur deux frames.
  const activeSlotRef = useRef<0 | 1>(0);
  const loadedSrcRef = useRef<string | null>(null);
  const overlayVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const scrubRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOverlayRef = useRef<{ type: "title" | "sticker" | "caption" | "overlay"; id: string; startX: number; startY: number; offX: number; offY: number; moved: boolean;
    /** Groupe déplacé d'un bloc (sélection multiple de textes) et position de
     *  départ du titre saisi, dont on tire l'écart appliqué à tous. */
    groupe: { id: string; x: number; y: number }[]; x0: number; y0: number } | null>(null);
  const resizeOverlayRef = useRef<{ type: "title" | "sticker" | "caption" | "overlay"; id: string; startDist: number; startScale: number; cx: number; cy: number } | null>(null);
  const voRecorderRef = useRef<MediaRecorder | null>(null);
  const voChunksRef = useRef<Blob[]>([]);
  const rulerRef = useRef<HTMLDivElement>(null);
  const scrubbingRulerRef = useRef(false);
  const trimRef = useRef<{ id: string; edge: "start" | "end"; startX: number; t0start: number; t0end: number;
    kind: "video" | "photo"; srcDur: number; speed: number; t0gap: number;
    /** Position du plan SUR LA TIMELINE au début du geste : c'est là que
     *  raisonne l'aimantation, pas dans le référentiel de la source. */
    t0tlStart: number; t0tlEnd: number } | null>(null);
  const ovTrimRef = useRef<{ id: string; edge: "start" | "end"; startX: number; t0start: number; t0end: number; t0offset: number; srcDur: number; kind: "video" | "photo" } | null>(null);
  const clipboardRef = useRef<{ type: "clip"; data: MontageClip } | { type: "overlay"; data: OverlayClip } | null>(null);
  // Glisser-déposer libre façon CapCut : on attrape le corps d'un plan / d'une
  // incrustation, il suit le curseur (fantôme), et au lâcher il atterrit sur la
  // piste sous le curseur (déplacement temporel, changement de piste, ou création
  // d'une nouvelle piste vidéo en montant tout en haut). Piloté au pointeur, sans
  // drag HTML5 (fini le fantôme moche du navigateur).
  const tlDragRef = useRef<{ id: string; kind: "clip" | "overlay"; startX: number; startY: number; grabDx: number; grabDy: number; widthPx: number; moved: boolean } | null>(null);
  const tlInnerRef = useRef<HTMLDivElement>(null);
  const tlScrollRef = useRef<HTMLDivElement>(null);
  const selDragRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null); // rectangle de sélection

  function toast(msg: string, kind: "ok" | "error" = "ok") {
    setToastMsg(msg); setToastKind(kind);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3200);
  }

  // ── Menu contextuel d'un plan : fermeture au clic/scroll/échap ──────────────
  useEffect(() => {
    if (!clipMenu) return;
    const close = () => setClipMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("click", close); window.removeEventListener("scroll", close, true); window.removeEventListener("keydown", onKey); };
  }, [clipMenu]);

  // ── Édition inline d'un titre : focus + sélection à l'entrée en édition ─────
  const titleEditRef = useRef<HTMLSpanElement | null>(null);
  const captionEditRef = useRef<HTMLSpanElement | null>(null);
  function focusEditable(el: HTMLElement | null) {
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  useEffect(() => { if (editingTitleId) focusEditable(titleEditRef.current); }, [editingTitleId]);
  useEffect(() => { if (editingCaptionId) focusEditable(captionEditRef.current); }, [editingCaptionId]);

  // ── Mesure de la largeur de la preview (pour figer la taille du texte) ──────
  // On lit contentRect (taille de mise en page, hors transform) pour que le zoom
  // du canvas (previewZoom, ci-dessous) ne fausse pas le dimensionnement du texte.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    setStageW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setStageW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  // Empêche le navigateur d'OUVRIR un fichier lâché sur l'éditeur (comportement par défaut
  // = naviguer vers le fichier). Les zones de dépôt (timeline, panneau média) gèrent l'import.
  useEffect(() => {
    const prevent = (e: DragEvent) => { if (e.dataTransfer?.types?.includes("Files")) e.preventDefault(); };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => { window.removeEventListener("dragover", prevent); window.removeEventListener("drop", prevent); };
  }, []);

  // ── Bloque TOTALEMENT le zoom de page du navigateur sur l'éditeur ───────────
  // Un pincement trackpad (ou Ctrl/⌘+molette) n'importe où sur la page de montage ne
  // doit JAMAIS zoomer la page web. On intercepte au niveau du document (non passif) :
  // les zones qui ont leur propre zoom (timeline, preview) le gèrent quand même.
  // Safari émet aussi des « gesture events » → on les bloque également.
  useEffect(() => {
    // UN SEUL point d'entrée pour le pincement/zoom (capture phase + non passif) : on
    // intercepte AVANT tout le reste → blocage fiable du zoom de page, ET on route le zoom
    // vers la bonne zone (timeline ou aperçu) selon l'endroit du curseur. Comme c'est ce
    // même listener qui bloque la page (et ça marche), le zoom part forcément.
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        // Défilement simple SUR L'APERÇU ZOOMÉ : on s'y déplace. Ailleurs, ou à
        // 100 %, on ne touche à rien — la page doit continuer de défiler.
        const st = stageRef.current;
        if (st && st.contains(e.target as Node) && previewZoomRef.current > 1) {
          e.preventDefault();
          setPreviewPan((p) => bornerPanRef.current({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
        }
        return;
      }
      e.preventDefault(); // bloque le zoom de la page web
      const tl = tlScrollRef.current, stage = stageRef.current, target = e.target as Node;
      const factor = Math.min(1.25, Math.max(0.8, Math.exp(-e.deltaY * 0.01)));
      if (tl && tl.contains(target)) {
        setPps((p) => {
          const np = Math.max(10, Math.min(220, p * factor));
          const rect = tl.getBoundingClientRect();
          const tAtCursor = (e.clientX - rect.left + tl.scrollLeft - LANE_LABEL_W) / p;
          requestAnimationFrame(() => { tl.scrollLeft = Math.max(0, tAtCursor * np - (e.clientX - rect.left - LANE_LABEL_W)); });
          return np;
        });
      } else if (stage && stage.contains(target)) {
        setPreviewZoom((z) => Math.max(1, Math.min(5, z * factor)));
      }
    };
    // Safari/WebKit : le pincement trackpad n'émet PAS de ctrl+wheel mais des « gesture
    // events » (e.scale = échelle cumulée depuis le début du geste, 1 = neutre). On zoome
    // dessus la bonne zone, sinon on ne ferait que bloquer la page (→ « rien ne se passe »).
    let gZone: "tl" | "stage" | null = null, gPps = 40, gPrev = 1;
    const zoneOf = (target: Node | null) => {
      const tl = tlScrollRef.current, stage = stageRef.current;
      if (tl && target && tl.contains(target)) return "tl" as const;
      if (stage && target && stage.contains(target)) return "stage" as const;
      return null;
    };
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gZone = zoneOf(e.target as Node);
      gPps = ppsRef.current; gPrev = previewZoomRef.current;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const s = (e as unknown as { scale?: number }).scale || 1;
      if (gZone === "tl") setPps(Math.max(10, Math.min(220, gPps * s)));
      else if (gZone === "stage") setPreviewZoom(Math.max(1, Math.min(5, gPrev * s)));
    };
    const onGestureEnd = (e: Event) => e.preventDefault();
    const opts = { passive: false, capture: true } as AddEventListenerOptions;
    window.addEventListener("wheel", onWheel, opts);
    document.addEventListener("gesturestart", onGestureStart, opts);
    document.addEventListener("gesturechange", onGestureChange, opts);
    document.addEventListener("gestureend", onGestureEnd, opts);
    return () => {
      window.removeEventListener("wheel", onWheel, opts);
      document.removeEventListener("gesturestart", onGestureStart, opts);
      document.removeEventListener("gesturechange", onGestureChange, opts);
      document.removeEventListener("gestureend", onGestureEnd, opts);
    };
  }, []);

  // (Le zoom de l'aperçu ET de la timeline est géré par l'unique listener global ci-dessus.)

  // ── Load project ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [{ data: post }, wsRes] = await Promise.all([
        supabase.from("posts").select("montage_json, brief, photo_url").eq("id", postId).single(),
        supabase.from("workspaces").select("logo_url, accent_color, primary_color, secondary_color, font_family, font_secondary, font_primary_url, font_secondary_url, subtitle_style_id, subtitle_custom, subtitle_pos, subtitle_max_words").eq("id", workspaceId).single(),
      ]);
      // Tolérant : si une colonne subtitle_* n'est pas encore migrée, on relit sans elles.
      let ws = wsRes.data;
      if (wsRes.error && /subtitle_(style_id|custom|pos|max_words)/.test(wsRes.error.message || "")) {
        ws = (await supabase.from("workspaces").select("logo_url, accent_color, primary_color, secondary_color, font_family, font_secondary, font_primary_url, font_secondary_url").eq("id", workspaceId).single()).data as typeof ws;
      }
      if (post?.brief) setProjectName(post.brief);
      if (ws?.logo_url) setLogoUrl(ws.logo_url);
      /* Charte de la marque : couleurs et polices.

         Elles vivent déjà sur le workspace (page Style), mais le monteur ne les
         lisait pas : on repartait d'une palette générique et de trois polices en
         dur pour habiller un texte. Les polices maison téléversées sont
         déclarées à la volée, sinon le navigateur ne saurait pas les dessiner. */
      const charte: string[] = [];
      for (const c of [ws?.primary_color, ws?.secondary_color, ws?.accent_color]) {
        if (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) && !charte.includes(c.toUpperCase())) charte.push(c.toUpperCase());
      }
      setBrandColors(charte);
      const fontes: string[] = [];
      for (const [fam, url] of [[ws?.font_family, ws?.font_primary_url], [ws?.font_secondary, ws?.font_secondary_url]] as const) {
        if (!fam || fontes.includes(fam)) continue;
        fontes.push(fam);
        if (url) declarerPoliceMaison(fam, url); else chargerPoliceGoogle(fam);
      }
      setBrandFonts(fontes);
      const charterSub = charterSubDefault(ws); // sous-titres à la charte (surlignage = accent)
      const proj = post?.montage_json as Partial<MontageProject> | null;
      if (proj?.clips?.length) {
        setClips(proj.clips.map(normalizeClip));
        setOverlays(proj.overlays || []);
        setCaptions(proj.captions || []);
        // Montage jamais personnalisé côté sous-titres → on applique le style de la charte.
        const subUntouched = !proj.subStyleId && (!proj.subCustom || Object.keys(proj.subCustom).length === 0);
        setSubStyleId(subUntouched && charterSub ? charterSub.styleId : (proj.subStyleId || DEFAULT_SUB_STYLE_ID));
        setSubMaxWords(proj.subMaxWords || (subUntouched ? charterSub?.maxWords : null) || DEFAULT_WORDS_PER_CAPTION);
        setSubPos(proj.subPos || (subUntouched ? charterSub?.pos : null) || DEFAULT_SUB_POS);
        setSubCustom(subUntouched && charterSub ? charterSub.custom : (proj.subCustom || {}));
        setLinkedSubs(proj.linkedSubs ?? true);
        setRawSegments(proj.rawSegments || []);
        setRawWords(proj.rawWords || []);
        /* Reprise des montages faits avant la suppression du mode « pilule ».

           Le champ n'existe plus : sans reprise, un titre en pilule retomberait
           sur l'arrondi par défaut et changerait d'allure tout seul en rouvrant
           le projet. On traduit donc l'ancien mode dans le réglage continu qui
           l'a remplacé. */
        setTitles((proj.titles || []).map((ti) => {
          const ancien = ti as TitleEl & { pill?: boolean };
          return ancien.pill ? { ...ti, radius: 60 } : ti;
        }));
        setStickers(proj.stickers || []);
        setAudioTracks(proj.audioTracks || []);
        setShowProgressBar(!!proj.showProgressBar);
        setExportUrl(proj.exportUrl || null);
        setFormatId(proj.formatId || "story");
        if (proj.customW) setCustomW(proj.customW);
        if (proj.customH) setCustomH(proj.customH);
        setExportQuality(proj.exportQuality || "standard");
        if (proj.preEditedAt) preEditedAtRef.current = proj.preEditedAt;
      } else if (post?.photo_url) {
        const dur = await getVideoDuration(post.photo_url);
        setClips([{ id: crypto.randomUUID(), kind: "video", name: t('initialImportName'), src: post.photo_url, srcDur: dur, trimStart: 0, trimEnd: dur, ...newClipDefaults() }]);
        if (charterSub) { setSubStyleId(charterSub.styleId); setSubCustom(charterSub.custom); if (charterSub.pos) setSubPos(charterSub.pos); if (charterSub.maxWords) setSubMaxWords(charterSub.maxWords); }
      } else if (charterSub) {
        setSubStyleId(charterSub.styleId); setSubCustom(charterSub.custom);
        if (charterSub.pos) setSubPos(charterSub.pos);
        if (charterSub.maxWords) setSubMaxWords(charterSub.maxWords);
      }
      setLoading(false);
    })();
  }, [postId, workspaceId, supabase]);

  // ── Playback position persistée (localStorage) ─────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(`montage-time-${postId}`);
    if (saved) setTime(parseFloat(saved) || 0);
  }, [postId]);

  /* Position de lecture retenue d'une visite à l'autre.

     Cette ligne écrivait dans localStorage à CHAQUE changement de `time`, donc à
     chaque image pendant la lecture : soixante écritures synchrones par seconde,
     pour une information qui n'a d'intérêt qu'au moment où l'on quitte la page.
     On n'écrit donc plus qu'à l'arrêt, et une dernière fois en quittant. */
  useEffect(() => {
    if (playing) return;
    localStorage.setItem(`montage-time-${postId}`, String(time));
  }, [time, postId, playing]);
  useEffect(() => () => {
    localStorage.setItem(`montage-time-${postId}`, String(timeRef.current));
  }, [postId]);

  // ── Autosave du projet (debounced) ──────────────────────────────────────────
  // `buildProject` est aussi utilisé par l'enregistrement de sortie : les deux
  // doivent écrire EXACTEMENT le même objet, sinon quitter la page perd un champ.
  const buildProject = useCallback((): MontageProject => ({
    clips, overlays, captions, subStyleId, subMaxWords, subPos, subCustom, linkedSubs,
    rawSegments, rawWords, titles, stickers, audioTracks, showProgressBar, exportUrl,
    formatId, customW, customH, exportQuality,
    ...(preEditedAtRef.current ? { preEditedAt: preEditedAtRef.current } : {}),
  }), [clips, overlays, captions, subStyleId, subMaxWords, subPos, subCustom, linkedSubs,
       rawSegments, rawWords, titles, stickers, audioTracks, showProgressBar, exportUrl,
       formatId, customW, customH, exportQuality]);

  // Quitter la page ne doit rien perdre : l'autosave est temporisé à 700 ms, et
  // un clic sur « Composer », « Publier » ou la fermeture de l'onglet partait
  // sans attendre. On force donc une écriture au moment où la page se cache.
  // `keepalive` : la requête survit à la navigation, contrairement à un fetch
  // normal que le navigateur annule en partant.
  const projectRef = useRef(buildProject);
  projectRef.current = buildProject;
  // Le jeton est lu à l'avance : au moment où la page se cache, il est trop tard
  // pour attendre une promesse.
  const accessTokenRef = useRef<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { accessTokenRef.current = data.session?.access_token ?? null; });
  }, [supabase]);

  useEffect(() => {
    if (loading) return;
    const flush = () => {
      if (document.visibilityState !== "hidden") return;
      if (!accessTokenRef.current) return; // sans jeton, l'écriture serait refusée
      try {
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/posts?id=eq.${postId}`;
        fetch(url, {
          method: "PATCH",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
            Authorization: `Bearer ${accessTokenRef.current}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ montage_json: projectRef.current() }),
        }).catch(() => {});
      } catch { /* la sauvegarde temporisée reprendra la main si la page revient */ }
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [loading, postId]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (loading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      supabase.from("posts").update({ montage_json: buildProject() }).eq("id", postId).then(() => {});
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [clips, overlays, captions, subStyleId, subMaxWords, subPos, subCustom, linkedSubs, rawSegments, rawWords, titles, stickers, audioTracks, showProgressBar, exportUrl, formatId, customW, customH, exportQuality, loading, postId, supabase]);

  // ── Historique undo/redo ────────────────────────────────────────────────────
  type Snapshot = Required<Pick<MontageProject, "subPos" | "subCustom" | "overlays">> & Pick<MontageProject, "clips" | "captions" | "subStyleId" | "titles" | "stickers" | "audioTracks" | "showProgressBar">;
  const historyRef = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const lastSnapRef = useRef<Snapshot | null>(null);
  const applyingHistoryRef = useRef(false);
  const histDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ prev: Snapshot; snap: Snapshot } | null>(null);

  const commitPending = useCallback(() => {
    if (histDebounceRef.current) { clearTimeout(histDebounceRef.current); histDebounceRef.current = null; }
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    historyRef.current.past.push(p.prev);
    if (historyRef.current.past.length > 100) historyRef.current.past.shift();
    historyRef.current.future = [];
    lastSnapRef.current = p.snap;
    setHistTick((t) => t + 1);
  }, []);

  // Enregistre un point d'historique après stabilisation (450ms) : un drag continu
  // (rognage, déplacement d'un overlay, slider) ne crée ainsi qu'une seule étape d'annulation.
  useEffect(() => {
    if (loading) return;
    const snap: Snapshot = { clips, overlays, captions, subStyleId, subPos, subCustom, titles, stickers, audioTracks, showProgressBar };
    if (applyingHistoryRef.current) {
      applyingHistoryRef.current = false;
      if (histDebounceRef.current) { clearTimeout(histDebounceRef.current); histDebounceRef.current = null; }
      pendingRef.current = null;
      lastSnapRef.current = snap;
      return;
    }
    if (lastSnapRef.current === null) { lastSnapRef.current = snap; return; }
    pendingRef.current = { prev: pendingRef.current?.prev ?? lastSnapRef.current, snap };
    if (histDebounceRef.current) clearTimeout(histDebounceRef.current);
    histDebounceRef.current = setTimeout(commitPending, 450);
  }, [clips, overlays, captions, subStyleId, subPos, subCustom, titles, stickers, audioTracks, showProgressBar, loading, commitPending]);

  const applySnapshot = useCallback((s: Snapshot) => {
    applyingHistoryRef.current = true;
    setClips(s.clips); setOverlays(s.overlays || []); setCaptions(s.captions); setSubStyleId(s.subStyleId);
    setSubPos(s.subPos || DEFAULT_SUB_POS); setSubCustom(s.subCustom || {});
    setTitles(s.titles); setStickers(s.stickers); setAudioTracks(s.audioTracks);
    setShowProgressBar(s.showProgressBar);
  }, []);

  const undo = useCallback(() => {
    commitPending();
    const h = historyRef.current;
    if (!h.past.length || !lastSnapRef.current) return;
    const prev = h.past.pop()!;
    h.future.push(lastSnapRef.current);
    applySnapshot(prev);
    setHistTick((t) => t + 1);
  }, [applySnapshot, commitPending]);

  const redo = useCallback(() => {
    commitPending();
    const h = historyRef.current;
    if (!h.future.length || !lastSnapRef.current) return;
    const next = h.future.pop()!;
    h.past.push(lastSnapRef.current);
    applySnapshot(next);
    setHistTick((t) => t + 1);
  }, [applySnapshot, commitPending]);

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;
  void histTick; // force le recalcul de canUndo/canRedo à chaque mutation d'historique

  // ── Temps cumulés des clips ─────────────────────────────────────────────────
  const clipStarts = useMemo(() => computeStarts(clips), [clips]);

  /* ─── L'horloge de lecture, et pourquoi elle ne passe plus par React ───────

     Le monteur est UN seul composant. Tant que l'horloge appelait setTime à
     chaque image, React réexécutait tout le monteur soixante fois par seconde :
     la timeline entière, le panneau de l'outil courant, la barre du haut, et la
     construction de l'objet `ctx` avec ses soixante-dix champs. Mesuré sur un
     banc réduit à la seule timeline de quatorze plans : 5,36 ms de React par
     image, soit un tiers du temps machine, avant même la mise en page, la
     peinture, le décodage vidéo et le mixage audio. C'est là que passait la
     fluidité.

     Le temps vit donc maintenant dans une référence, avancée à chaque image sans
     rendu. React n'est prévenu que lorsque l'écran doit réellement changer :

       - immédiatement quand ce qui est AFFICHÉ change (plan, sous-titre, titre,
         sticker, incrustation), pour qu'aucune bascule n'arrive en retard ;
       - à 30 images par seconde tant qu'une animation continue est à l'écran
         (transition, zoom Ken Burns, sous-titre mot à mot) : c'est la cadence de
         l'export, l'aperçu ne peut pas être plus fin que le fichier rendu ;
       - à 10 images par seconde le reste du temps, où seul le curseur bouge.

     Le curseur, lui, est repositionné à chaque image par une écriture directe
     dans le DOM : c'est le mouvement le plus visible, il reste à 60 Hz sans
     coûter un seul rendu. */
  const clockRef = useRef(0);           // temps de lecture faisant autorité
  /* `timeRef` porte le temps EXACT, à l'image près, que la lecture soit en cours
     ou non : c'est lui que lisent la synchro image/son et les actions qui doivent
     tomber sur l'image affichée (couper au curseur, choisir la couverture).
     L'état React `time`, lui, a jusqu'à un dixième de seconde de retard pendant
     la lecture, et c'est très bien : il ne sert qu'à dessiner. */
  const timeRef = useRef(0);
  const playheadRef = useRef<HTMLDivElement>(null);
  // La barre de lecture sous l'aperçu bouge elle aussi en continu : elle est
  // repositionnée par la même écriture directe, sinon elle avancerait par
  // saccades de dix images par seconde.
  const scrubFillRef = useRef<HTMLDivElement>(null);
  const scrubKnobRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef(0);
  /* Les sous-titres ne s'animent que si le style choisi surligne mot à mot. Un
     style « sans animation » n'a rien à rafraîchir entre deux sous-titres, et il
     serait absurde de tenir 30 images par seconde pour un texte immobile. Style
     délié : chaque sous-titre a le sien, on reste prudent. */
  const sousTitresAnimes = !linkedSubs || effectiveSubStyle(subStyleId, subCustom).anim !== "none";
  const sceneRef = useRef({ clipStarts, captions, titles, stickers, overlays, pps, sousTitresAnimes });
  sceneRef.current = { clipStarts, captions, titles, stickers, overlays, pps, sousTitresAnimes };

  /** Ce qui est à l'écran à l'instant `t`, résumé en une chaîne. Elle change
   *  exactement quand une bascule doit être vue, et pas avant. */
  function signatureScene(t: number): string {
    const sc = sceneRef.current;
    let sig = "c";
    for (let i = 0; i < sc.clipStarts.length; i++) {
      if (t >= sc.clipStarts[i].start && t < sc.clipStarts[i].end) { sig += i; break; }
    }
    for (let i = 0; i < sc.captions.length; i++) {
      if (t >= sc.captions[i].start && t <= sc.captions[i].end) { sig += "s" + i; break; }
    }
    for (let i = 0; i < sc.titles.length; i++) if (t >= sc.titles[i].start && t <= sc.titles[i].end) sig += "t" + i;
    for (let i = 0; i < sc.stickers.length; i++) if (t >= sc.stickers[i].start && t <= sc.stickers[i].end) sig += "k" + i;
    for (let i = 0; i < sc.overlays.length; i++) {
      const o = sc.overlays[i];
      if (t >= o.offset && t < o.offset + overlayTimelineDur(o)) sig += "o" + i;
    }
    return sig;
  }

  /** Une animation continue est-elle à l'écran ? Si oui l'aperçu doit suivre à la
   *  cadence de l'export ; sinon seul le curseur bouge. */
  function animationEnCours(t: number): boolean {
    const sc = sceneRef.current;
    for (const c of sc.clipStarts) {
      if (t < c.start || t >= c.end) continue;
      if (c.kind === "photo" && c.kenBurns) return true;
      if (c.transitionIn && c.transitionIn !== "cut" && t - c.start < (c.transitionDur || 0)) return true;
      break;
    }
    if (sc.sousTitresAnimes) {
      for (const cp of sc.captions) if (t >= cp.start && t <= cp.end) return true; // surlignage mot à mot
    }
    for (const ti of sc.titles) {
      if (t < ti.start || t > ti.end) continue;
      if (ti.anim === "none") continue; // rien ne bouge : inutile de rendre plus souvent
      const duree = ti.anim === "type" ? ti.text.length / 16 + 0.2 : 0.6;
      if (t - ti.start < duree) return true;
    }
    return false;
  }

  /**
   * Repositionne le curseur sans passer par React.
   *
   * ET LE CACHE QUAND IL PASSE DERRIÈRE LA GOUTTIÈRE.
   *
   * Masquer par empilement ne suffisait pas : la tête de lecture porte une
   * poignée qui déborde d'un pixel au-dessus de son trait, et son extrémité
   * basse sort sous la dernière piste. À chaque endroit non couvert, elle
   * reparaissait dans la colonne des pistes. Empiler des caches revient à
   * courir après des cas particuliers ; ne rien dessiner du tout est exact.
   *
   * La position du curseur est en coordonnées de CONTENU ; la gouttière occupe
   * les 160 premiers pixels de la fenêtre de défilement. Le curseur est donc
   * derrière elle tant que `t * pps` est inférieur au défilement horizontal.
   */
  const poserCurseur = useCallback((t: number) => {
    if (playheadRef.current) {
      playheadRef.current.style.left = `${LANE_LABEL_W + t * sceneRef.current.pps}px`;
      const defile = tlScrollRef.current?.scrollLeft ?? 0;
      playheadRef.current.style.visibility = t * sceneRef.current.pps < defile ? "hidden" : "";
    }
    const pct = totalRef.current ? `${(t / totalRef.current) * 100}%` : "0%";
    if (scrubFillRef.current) scrubFillRef.current.style.width = pct;
    if (scrubKnobRef.current) scrubKnobRef.current.style.left = pct;
  }, []);

  // Le curseur ne bouge pas quand on fait DÉFILER, mais la gouttière, elle,
  // avance sur lui : sa visibilité doit être réévaluée à chaque défilement.
  useEffect(() => {
    const el = tlScrollRef.current;
    if (!el) return;
    const surDefilement = () => poserCurseur(timeRef.current);
    el.addEventListener("scroll", surDefilement, { passive: true });
    return () => el.removeEventListener("scroll", surDefilement);
  }, [poserCurseur]);

  const clipsEnd = clipStarts.length ? clipStarts[clipStarts.length - 1].end : 0;
  // Fin réelle du projet = dernière frame de TOUT ce qui est posé sur la timeline
  // (plans, incrustations vidéo/photo, sons, textes, sous-titres) — pas seulement la
  // piste vidéo principale. Sinon une incrustation qui dépasse la fin des plans serait
  // tronquée à la lecture, à l'export et sur la règle temporelle.
  const total = useMemo(() => {
    let end = clipsEnd;
    for (const o of overlays) end = Math.max(end, o.offset + overlayTimelineDur(o));
    for (const a of audioTracks) end = Math.max(end, (a.offset ?? 0) + a.dur);
    for (const ti of titles) end = Math.max(end, ti.end);
    for (const c of captions) end = Math.max(end, c.end);
    return end;
  }, [clipsEnd, overlays, audioTracks, titles, captions]);
  // Plan couvrant l'instant courant. Dans un « trou » (écran noir avant un plan) → null,
  // pour que la preview affiche du noir plutôt que de figer le plan précédent. En toute fin
  // de timeline (time >= total), on garde le dernier plan affiché.
  const coveringClip = clipStarts.find((c) => time >= c.start && time < c.end);
  const activeClip = coveringClip || (clipStarts.length && time >= total ? clipStarts[clipStarts.length - 1] : null);
  const activeClipRef = useRef(activeClip); activeClipRef.current = activeClip;
  // Transition d'entrée du plan courant, calculée avec la MÊME fonction que l'export
  // → l'aperçu montre enfin les transitions au lieu de les révéler seulement au rendu.


  /* Le plan qui S'EN VA, pendant la transition.

     L'aperçu ne montrait que le plan entrant : un fondu apparaissait donc depuis
     le noir, un balayage balayait le vide. On remet l'image d'avant en dessous,
     avec le mouvement qui lui revient — le même calcul qu'à l'export. */
  const activeTransPair = useMemo(() => {
    if (!activeClip) return null;
    const isFirst = clipStarts.length > 0 && clipStarts[0].id === activeClip.id;
    return transitionPairAt(activeClip.transitionIn, activeClip.transitionDur, time - activeClip.start, isFirst);
  }, [activeClip, clipStarts, time]);
  const activeTrans = activeTransPair?.in ?? null;
  const activeTransCss = activeTrans ? transitionCss(activeTrans) : null;

  const outClip = useMemo(() => {
    if (!activeClip) return null;
    const dur = activeClip.transitionDur || 0;
    if (!activeClip.transitionIn || activeClip.transitionIn === "cut" || dur <= 0) return null;
    if (Math.max(0, activeClip.gapBefore ?? 0) > 0) return null; // rien à enchaîner à travers un trou
    if (time - activeClip.start >= dur || time < activeClip.start) return null;
    const i = clipStarts.findIndex((c) => c.id === activeClip.id);
    return i > 0 ? clipStarts[i - 1] : null;
  }, [activeClip, clipStarts, time]);


  // Plan vidéo suivant : préchargé en sourdine pour que le passage d'un plan à
  // l'autre soit net (sans le temps de chargement qui figeait l'image).
  const nextClip = useMemo(() => {
    if (!activeClip) return null;
    const i = clipStarts.findIndex((c) => c.id === activeClip.id);
    for (let j = i + 1; j < clipStarts.length; j++) {
      if (clipStarts[j].kind === "video") return clipStarts[j];
    }
    return null;
  }, [activeClip, clipStarts]);
  const selectedClip = clipStarts.find((c) => c.id === selectedClipId) || null;
  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId) || null;
  const activeOverlays = useMemo(
    () => overlays.filter((o) => time >= o.offset && time < o.offset + overlayTimelineDur(o)),
    [overlays, time],
  );
  // Pistes vidéo empilables : par défaut AUCUNE piste overlay vide (juste la piste vidéo
  // principale). Une rangée n'apparaît qu'avec du contenu (une incrustation) ou quand
  // l'utilisateur en crée une (extraVideoTracks) — façon CapCut, on empile à la demande.
  const maxOverlayTrack = useMemo(() => overlays.reduce((m, o) => Math.max(m, o.track ?? 0), 0), [overlays]);
  const videoTrackCount = (overlays.length ? maxOverlayTrack + 1 : 0) + extraVideoTracks;
  // Pistes audio ajoutées (musique/voix off) : idem, aucune rangée vide par défaut. Le son
  // embarqué des plans a sa propre rangée dédiée (« son des plans »).
  const maxAudioTrack = useMemo(() => audioTracks.reduce((m, a) => Math.max(m, a.track ?? 0), 0), [audioTracks]);
  const audioTrackCount = (audioTracks.length ? maxAudioTrack + 1 : 0) + extraAudioTracks;
  // Pistes de texte : au moins une, et une de plus dès qu'un titre en occupe une
  // plus haute. Même logique d'empilement à la demande que la vidéo et l'audio.
  const maxTextTrack = useMemo(() => titles.reduce((m, ti) => Math.max(m, ti.track ?? 0), 0), [titles]);
  const textTrackCount = Math.max(1, maxTextTrack + 1) + extraTextTracks;

  totalRef.current = total;

  // Hors lecture (déplacement du curseur, zoom, position restaurée à l'ouverture),
  // c'est l'état React qui fait foi : on y recale l'horloge et le curseur.
  useEffect(() => {
    if (playingRef.current) return;
    clockRef.current = time;
    timeRef.current = time;
    poserCurseur(time);
    // `loading` : le curseur n'existe pas encore tant que le monteur charge, et
    // sans ce déclencheur il resterait à zéro une fois la timeline montée.
    // `total` : la barre de lecture est en pourcentage, elle bouge quand la durée
    // du montage change (import, coupe) même si le curseur, lui, n'a pas bougé.
  }, [time, pps, total, loading, poserCurseur]);

  const seek = useCallback((t: number) => {
    const clamped = Math.max(0, Math.min(total, t));
    // L'horloge de lecture est la référence : sans ce recalage, un déplacement du
    // curseur pendant la lecture serait aussitôt écrasé par l'image suivante.
    clockRef.current = clamped;
    poserCurseur(clamped);
    timeRef.current = clamped;
    setTime(clamped);
    const c = clipStarts.find((c) => clamped >= c.start && clamped < c.end); // null dans un trou (écran noir)
    if (c && c.kind === "video" && videoRef.current && loadedSrcRef.current === c.src) {
      videoRef.current.currentTime = c.trimStart + (clamped - c.start) * c.speed;
    }
  }, [total, clipStarts]);

  // ── Bascule sur le lecteur qui contient déjà le plan actif ──────────────────
  useEffect(() => {
    if (!activeClip || activeClip.kind !== "video") return;
    const els: (HTMLVideoElement | null)[] = [videoARef.current, videoBRef.current];
    let target: 0 | 1;
    // 1) un lecteur est déjà PRÊT pour ce plan (source chargée ET position atteinte)
    if (slotClipRef.current[0] === activeClip.id) target = 0;
    else if (slotClipRef.current[1] === activeClip.id) target = 1;
    // 2) sinon, un lecteur a au moins la bonne source
    else if (slotSrcRef.current[slot] === activeClip.src) target = slot;
    else if (slotSrcRef.current[slot === 0 ? 1 : 0] === activeClip.src) target = slot === 0 ? 1 : 0;
    else {
      // 3) source jamais chargée : dans le lecteur NON affiché, pour ne pas faire
      //    clignoter l'image courante.
      target = slot === 0 ? 1 : 0;
      const el = els[target];
      if (el) { el.src = activeClip.src; slotSrcRef.current[target] = activeClip.src; }
    }
    slotClipRef.current[target] = activeClip.id;
    // Un plan n'est prêt que dans UN lecteur : sans ce nettoyage, les deux slots
    // finissaient par revendiquer le même id et la bascule suivante repartait sur
    // le mauvais lecteur.
    const other = target === 0 ? 1 : 0;
    if (slotClipRef.current[other] === activeClip.id) slotClipRef.current[other] = null;
    const v = els[target];
    if (!v) return;
    videoRef.current = v;
    activeSlotRef.current = target; // avant setSlot : l'effet de préchargement le lit dans ce même commit
    loadedSrcRef.current = activeClip.src;
    if (target !== slot) setSlot(target);
    v.playbackRate = activeClip.speed;
    const localTime = activeClip.trimStart + (time - activeClip.start) * activeClip.speed;
    if (Math.abs(v.currentTime - localTime) > 0.35) v.currentTime = Math.max(0, localTime);
    // La temporisation anti-rafale ne doit pas retarder le recalage d'un NOUVEAU
    // plan : sinon l'image restait figée jusqu'à une demi-seconde à chaque coupe.
    lastSeekRef.current = 0;
    if (playing) v.play().catch(() => {});
    els[target === 0 ? 1 : 0]?.pause(); // l'autre ne doit pas jouer en fond
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClip?.id]);

  // ── Précharge le plan suivant dans le lecteur libre, déjà positionné ─────────
  useEffect(() => {
    if (!nextClip) return;
    // `activeSlotRef` et non `slot` : au commit d'un changement de plan, l'état `slot`
    // porte encore l'ANCIENNE valeur et désignait comme « libre » le lecteur qui vient
    // d'être mis à l'antenne.
    const free = activeSlotRef.current === 0 ? 1 : 0;
    const el = [videoARef.current, videoBRef.current][free];
    if (!el) return;
    // Garde-fou : on ne précharge JAMAIS dans le lecteur affiché (pause + seek en
    // pleine lecture = image figée qui ping-pongue entre deux frames).
    if (el === videoRef.current) return;
    if (slotClipRef.current[free] === nextClip.id) return; // déjà prêt
    const seek = () => {
      try { el.currentTime = Math.max(0, nextClip.trimStart); } catch {}
      slotClipRef.current[free] = nextClip.id;
    };
    if (slotSrcRef.current[free] !== nextClip.src) {
      // Fichier différent : charger puis se positionner.
      el.src = nextClip.src;
      slotSrcRef.current[free] = nextClip.src;
      el.addEventListener("loadedmetadata", seek, { once: true });
      el.load();
      return () => el.removeEventListener("loadedmetadata", seek);
    }
    // MÊME fichier (cas courant après dérushage : un rush découpé en segments) :
    // on avance simplement la tête de lecture du lecteur libre. Le seek a donc
    // lieu À L'AVANCE, plus à la frontière du plan — c'est ce qui saccadait.
    el.pause();
    seek();
  }, [nextClip, slot]);

  // ── Play/pause : pilote le <video> quand le clip actif est une vidéo ────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeClip || activeClip.kind !== "video") return;
    if (playing) v.play().catch(() => {}); else v.pause();
  }, [playing, activeClip?.id]);

  // ── Synchro vitesse + volume en direct (changement depuis les panneaux) ──────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeClip || activeClip.kind !== "video") return;
    v.playbackRate = activeClip.speed;
    v.volume = activeClip.vol ?? 1;
  }, [activeClip?.id, activeClip?.speed, activeClip?.vol]);

  // ── Horloge RAF pour les plans photo ET les trous (écran noir) ──────────────
  // Pas de lecture native pour avancer le temps : ni sur une photo, ni dans un « trou »
  // (aucun plan actif). Cette horloge fait défiler la timeline dans ces deux cas.
  // Horloge unique et FIABLE : le temps avance toujours par dt réel pendant la lecture
  // (plans vidéo, photos, trous). La vidéo SUIT cette horloge (synchro plus bas) au lieu
  // de la piloter — sinon, si la vidéo cale ou que play() est bloqué, le temps restait
  // figé et un extrait de son tournait en boucle (« oh là oh là »).
  useEffect(() => {
    if (!playing) return;
    let raf = 0; let last = performance.now();
    let stalledSince = 0; // depuis quand on attend la vidéo (ms)
    let derniereSignature = signatureScene(clockRef.current);
    let dernierRendu = 0;   // horodatage du dernier setTime consenti
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      // ── Anti-décalage au démarrage / au changement de plan ──────────────────
      // Quand la source du <video> vient de changer, le navigateur doit charger et
      // décoder avant de pouvoir jouer. Si l'horloge avançait pendant ce temps,
      // l'image restait figée puis rattrapait d'un coup (saccade). On GÈLE donc le
      // temps tant que la vidéo n'est pas prête — la lecture démarre alors nette.
      const vEl = videoRef.current, ac = activeClipRef.current;
      // On ne gèle plus pendant un `seeking` : les seeks ont désormais lieu à l'avance
      // dans le lecteur libre, et geler à chaque frontière de plan saccadait.
      // On gèle uniquement quand le lecteur n'a AUCUNE image à montrer.
      /* L'horloge ATTEND la vidéo tant qu'elle n'a pas de quoi jouer.

         `readyState < 2` ne couvrait que le cas « aucune image du tout ». Or ce
         qui saccade, c'est le cas d'à côté : le lecteur a une image mais pas la
         suite (readyState 2), le temps continue d'avancer, la dérive se creuse,
         et le recalage plus bas finit par déclencher un saut. Le décodeur vide
         alors son tampon, repart en retard, et le cycle recommence. Sur une
         source lourde tirée du réseau, ça tourne en boucle : c'est précisément
         « ça rame et ça bug » à la lecture. On attend donc d'avoir de la marge
         (readyState 3) avant de laisser le temps courir. */
      /* Deux niveaux d'attente, et deux garde-fous différents.

         « Aucune image » (readyState < 2) : rien à montrer, on attend jusqu'à 3 s.
         « Pas de suite » (readyState < 3) : on a une image mais pas de marge ; on
         n'attend que 600 ms, juste de quoi laisser le tampon se remplir.

         Et on n'attend PAS près de la fin du plan : quand le rognage va jusqu'au
         bout du fichier, le lecteur retombe naturellement à readyState 2 sur ses
         dernières images. Attendre là bloquerait la timeline à chaque fin de
         plan, ce qui serait pire que le mal. */
      const resteDansLePlan = ac ? (ac.end - clockRef.current) : Infinity;
      const rs = ac && ac.kind === "video" && vEl && !vEl.ended ? vEl.readyState : 4;
      const attente = rs < 2 ? 3000 : rs < 3 && resteDansLePlan > 0.35 ? 600 : 0;
      if (attente > 0) {
        if (!stalledSince) stalledSince = now;
        if (now - stalledSince < attente) { raf = requestAnimationFrame(tick); return; }
      } else {
        stalledSince = 0;
      }
      const n = clockRef.current + dt;
      if (total > 0 && n >= total) {
        clockRef.current = 0; timeRef.current = 0;
        poserCurseur(0); setPlaying(false); setTime(0);
        return;
      }
      clockRef.current = n;
      timeRef.current = n;          // la synchro image/son lit ici, à 60 Hz
      poserCurseur(n);              // le curseur bouge sans rendu React

      // React n'est réveillé que si l'écran doit changer, ou à la cadence utile.
      const sig = signatureScene(n);
      const intervalle = animationEnCours(n) ? 1000 / 30 : 1000 / 10;
      if (sig !== derniereSignature || now - dernierRendu >= intervalle) {
        derniereSignature = sig;
        dernierRendu = now;
        setTime(n);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      // À l'arrêt, l'état React rattrape l'horloge : sinon le curseur reculerait
      // de la fraction de seconde non encore rendue.
      setTime(clockRef.current);
    };
  }, [playing, total]);

  // ── Lecture live des pistes audio (musique/voix off) ────────────────────────
  // Un <audio> par piste, joué/mis en pause/mixé (fondu) en direct pendant la
  // lecture — jusqu'ici ces pistes n'étaient audibles qu'à l'export.
  const audioElsRef = useRef<Record<string, HTMLAudioElement>>({});
  const audioTracksRef = useRef(audioTracks);
  useEffect(() => { audioTracksRef.current = audioTracks; }, [audioTracks]);

  useEffect(() => {
    const els = audioElsRef.current;
    const ids = new Set(audioTracks.map((a) => a.id));
    // preload="auto" charge la piste entière : une simple mise en pause la laisse
    // en mémoire. Toute piste retirée ou remplacée doit être vidée, sinon chaque
    // essai de musique ou de voix off s'ajoute au précédent.
    Object.keys(els).forEach((id) => { if (!ids.has(id)) { releaseMediaElement(els[id]); delete els[id]; } });
    audioTracks.forEach((a) => {
      const ex = els[a.id];
      if (!ex) { const el = new Audio(a.src); el.preload = "auto"; els[a.id] = el; }
      else if (ex.src !== a.src) { releaseMediaElement(ex); const el = new Audio(a.src); el.preload = "auto"; els[a.id] = el; } // src changé (voix traitée)
    });
  }, [audioTracks]);

  /* Réparation des projets existants.

     Les pistes audio créées avant que `srcDur` n'existe ne savent pas quelle est
     la vraie longueur de leur fichier : `audioSrcDur` retombe alors sur ce qui
     est posé sur la timeline, et une piste déjà raccourcie ne peut plus être
     rallongée — elle s'est murée toute seule. On va donc lire la durée réelle
     (sans créer de lecteur média) et la poser.

     Même chose pour le spectre : les anciens ne portaient que 120 valeurs pour
     tout le fichier. À trente mesures par seconde attendues, on les recalcule
     dès qu'ils sont manifestement trop grossiers, sinon le dessin resterait un
     pavé sans relief. */
  const repareesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const aFaire = audioTracks.filter((a) => a.src && !repareesRef.current.has(a.id)
      && (!a.srcDur || !a.waveform || a.waveform.length < Math.min(WAVEFORM_MAX, ((a.srcDur ?? a.dur) * WAVEFORM_PER_SECOND) / 3)));
    if (!aFaire.length) return;
    let vivant = true;
    (async () => {
      for (const a of aFaire) {
        repareesRef.current.add(a.id);
        const duree = a.srcDur ?? (await dureeAudio(a.src)) ?? undefined;
        const attendu = duree ? waveformCount(duree) : 0;
        const spectre = (!a.waveform || (attendu && a.waveform.length < attendu / 3))
          ? await computeWaveformFromUrl(a.src)
          : null;
        if (!vivant) return;
        if (!duree && !spectre?.length) continue;
        setAudioTracks((prev) => prev.map((x) => x.id !== a.id ? x : {
          ...x,
          ...(duree ? { srcDur: Math.max(duree, (x.srcOffset ?? 0) + x.dur) } : {}),
          ...(spectre?.length ? { waveform: spectre } : {}),
        }));
      }
    })();
    return () => { vivant = false; };
  }, [audioTracks]);

  // En quittant le monteur, aucune piste ne doit survivre à l'écran, et aucune
  // source ouverte ne doit garder ses octets en mémoire.
  useEffect(() => () => {
    const els = audioElsRef.current;
    Object.keys(els).forEach((id) => { releaseMediaElement(els[id]); delete els[id]; });
    fermerSources();
  }, []);

  useEffect(() => {
    if (!playing) {
      Object.values(audioElsRef.current).forEach((el) => el.pause());
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      const t = timeRef.current;
      // La vidéo SUIT l'horloge : on la maintient en lecture et on corrige la dérive
      // (si elle a calé, été bloquée, ou pris de l'avance/retard). + fondu du son du plan.
      const vEl = videoRef.current, ac = activeClipRef.current;
      if (vEl && ac && ac.kind === "video") {
        // Position visée DANS LA SOURCE, bornée à son métrage réel : si `trimEnd`
        // dépasse la durée du fichier (métadonnée fausse, ré-encodage), viser au-delà
        // rend la cible inatteignable — le lecteur repassait en `ended` à chaque frame
        // et se figeait sur les deux dernières images jusqu'à la fin du plan.
        const srcEnd = isFinite(vEl.duration) && vEl.duration > 0 ? vEl.duration - 0.05 : Infinity;
        const expected = Math.min(ac.trimStart + (t - ac.start) * ac.speed, srcEnd);
        if (vEl.paused) vEl.play().catch(() => {});
        // Recaler seulement en cas de vraie dérive, et pas plus d'une fois par
        // demi-seconde : un re-seek en rafale empêche le décodeur de repartir
        // (l'image restait bloquée sur deux frames en boucle).
        const drift = Math.abs(vEl.currentTime - expected);
        // `ended` : la source a atteint sa fin alors que le plan continue sur la
        // timeline (trimEnd = durée du fichier) — play() n'y peut rien, il faut
        // repositionner.
        // Même un recalage « urgent » garde un délai minimal : si la cible reste
        // inatteignable, un seek à chaque frame empêche définitivement le décodeur
        // de repartir. 250 ms suffisent à rattraper sans bloquer le décodage.
        const mustRecover = (vEl.ended || drift > 1.5) && now - lastSeekRef.current > 250;
        if (isFinite(expected) && !vEl.seeking && (mustRecover || (drift > 1.0 && now - lastSeekRef.current > 500))) {
          lastSeekRef.current = now;
          vEl.currentTime = Math.max(0, expected);
          if (vEl.paused) vEl.play().catch(() => {});
        } else if (isFinite(expected) && !vEl.seeking) {
          /* Petite dérive : on ne SAUTE PAS, on accélère ou on ralentit un peu.

             Un saut coupe le décodage et se voit ; une correction de vitesse de
             quelques pour cent ne s'entend pas et ne se voit pas, et rattrape
             une demi-seconde en quelques secondes. C'est ce que fait n'importe
             quel lecteur en continu. Le seuil du saut est donc remonté à une
             seconde : en dessous, la vitesse suffit. */
          const ecart = (vEl.currentTime - expected) / (ac.speed || 1);
          const correction = Math.max(-0.04, Math.min(0.04, -ecart * 0.25));
          const vise = (ac.speed || 1) * (1 + (Math.abs(ecart) > 0.04 ? correction : 0));
          if (Math.abs(vEl.playbackRate - vise) > 0.002) vEl.playbackRate = vise;
        }
        const g = clipAudioGainAt(ac, t - ac.start);
        vEl.volume = mutedLanesRef.current.has("video") ? 0 : (isFinite(g) ? Math.max(0, Math.min(1, g)) : 0);
      }
      for (const a of audioTracksRef.current) {
        const el = audioElsRef.current[a.id];
        if (!el) continue;
        const within = t >= a.offset && t < a.offset + a.dur;
        if (within) {
          const local = t - a.offset;
          const srcT = (a.srcOffset ?? 0) + local; // audio détaché d'un plan rogné : décalage dans la source
          // Comme pour l'image : au delà d'une demi-seconde on repositionne, en
          // dessous on corrige par la vitesse. Un saut de lecture s'entend comme
          // un hoquet, une correction de 3 % ne s'entend pas.
          const ecart = el.currentTime - srcT;
          if (Math.abs(ecart) > 0.5) { el.currentTime = srcT; el.playbackRate = 1; }
          else {
            const vise = 1 + Math.max(-0.03, Math.min(0.03, -ecart * 0.2));
            if (Math.abs(el.playbackRate - vise) > 0.002) el.playbackRate = vise;
          }
          if (el.paused) el.play().catch(() => {});
          el.volume = mutedLanesRef.current.has(`a${a.track ?? 0}`) ? 0 : Math.min(1, audioVolumeAt(a, local)); // el.volume ∈ [0,1] ; boost >100 % à l'export
        } else if (!el.paused) {
          el.pause();
        }
      }
      syncOverlaysRef.current(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // ── Seek manuel : resynchronise les pistes audio immédiatement ──────────────
  useEffect(() => {
    if (playing) return; // la boucle ci-dessus s'en charge déjà pendant la lecture
    for (const a of audioTracksRef.current) {
      const el = audioElsRef.current[a.id];
      if (!el) continue;
      const within = time >= a.offset && time < a.offset + a.dur;
      if (within) { el.currentTime = (a.srcOffset ?? 0) + (time - a.offset); el.volume = Math.min(1, audioVolumeAt(a, time - a.offset)); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

  // La vidéo ne pilote plus le temps (c'est l'horloge RAF). On garde le handler pour
  // compat, sans effet secondaire.
  function onVideoTimeUpdate() { /* le temps est piloté par l'horloge RAF */ }
  function onVideoEnded() { /* la progression entre plans est gérée par l'horloge */ }

  function togglePlay() { setPlaying((p) => !p); }

  function onScrub(e: React.MouseEvent) {
    const r = scrubRef.current?.getBoundingClientRect();
    if (!r) return;
    seek(((e.clientX - r.left) / r.width) * total);
  }

  // ── Import (drag & drop + click) ────────────────────────────────────────────
  async function importFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("video/") || f.type.startsWith("image/"));
    if (!arr.length) return;
    setUploading(true);
    for (const file of arr) {
      const isVideo = file.type.startsWith("video/");
      const bucket = isVideo ? "videos" : "photos";
      const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
      const path = `${workspaceId}/${postId}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
      // Ne jamais avaler l'échec : un plan sans fichier fige le lecteur.
      if (error) { toast(t('toastUploadFailed', { name: file.name }), "error"); continue; }
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      const dur = isVideo ? await getVideoDuration(urlData.publicUrl) : PHOTO_DEFAULT_DUR;
      setClips((prev) => [...prev, {
        id: crypto.randomUUID(), kind: isVideo ? "video" : "photo", name: file.name, src: urlData.publicUrl,
        srcDur: isVideo ? dur : 15, trimStart: 0, trimEnd: dur, ...newClipDefaults(),
      }]);
    }
    setUploading(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) importFiles(e.target.files);
    e.target.value = "";
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) importFiles(e.dataTransfer.files);
  }
  // Glisser un fichier DIRECTEMENT sur la timeline (comme un logiciel de montage) : il se
  // pose à l'endroit du dépôt — sur la piste principale (à l'instant visé) ou sur une piste
  // vidéo du dessus si on lâche dessus.
  async function importFilesToTimeline(files: FileList | File[], clientX: number, clientY: number) {
    // Le son est accepté au même titre que l'image : on pouvait déposer une vidéo
    // ou une photo sur la timeline, mais une musique devait passer par le panneau
    // Audio, sans pouvoir choisir où elle tombe.
    const arr = Array.from(files).filter((f) => f.type.startsWith("video/") || f.type.startsWith("image/") || estAudio(f));
    if (!arr.length) return;
    const r = rulerRef.current?.getBoundingClientRect();
    let dropT = r ? Math.max(0, snapTime((clientX - r.left) / pps)) : 0;
    const lane = dropTargetAt(clientX, clientY);
    for (const file of arr) {
      if (estAudio(file)) {
        // Piste audio visée par le dépôt ; à défaut, la première.
        const piste = lane && /^a\d+$/.test(lane) ? (parseInt(lane.slice(1), 10) || 0) : 0;
        const t = await importAudioAt(file, "music", dropT, piste);
        dropT += t;
        continue;
      }
      setUploading(true);
      const isVideo = file.type.startsWith("video/");
      const bucket = isVideo ? "videos" : "photos";
      const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
      const path = `${workspaceId}/${postId}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
      // Ne jamais avaler l'échec : un plan sans fichier fige le lecteur.
      if (error) { toast(t('toastUploadFailed', { name: file.name }), "error"); continue; }
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      const dur = isVideo ? await getVideoDuration(urlData.publicUrl) : PHOTO_DEFAULT_DUR;
      if (lane && lane !== "video" && (lane === "new" || /^v\d+$/.test(lane))) {
        const track = lane === "new" ? videoTrackCount : (parseInt(lane.slice(1), 10) || 0);
        setOverlays((prev) => [...prev, {
          id: crypto.randomUUID(), kind: isVideo ? "video" : "photo", name: file.name, src: urlData.publicUrl,
          srcDur: isVideo ? dur : 15, trimStart: 0, trimEnd: dur, offset: dropT, track, ...newOverlayDefaults(),
        }]);
      } else {
        const clip: MontageClip = {
          id: crypto.randomUUID(), kind: isVideo ? "video" : "photo", name: file.name, src: urlData.publicUrl,
          srcDur: isVideo ? dur : 15, trimStart: 0, trimEnd: dur, ...newClipDefaults(),
        };
        const insertT = dropT;
        setClips((prev) => {
          let acc = 0;
          const ws = prev.map((cc) => { acc += Math.max(0, cc.gapBefore ?? 0); const s = acc; acc += clipTimelineDur(cc); return { start: s, end: acc }; });
          let idx = ws.findIndex((w) => w.start >= insertT);
          if (idx < 0) idx = prev.length;
          const prevEnd = idx > 0 ? ws[idx - 1].end : 0;
          clip.gapBefore = Math.max(0, insertT - prevEnd);
          const copy = [...prev]; copy.splice(idx, 0, clip); return copy;
        });
      }
      dropT += dur; // fichiers multiples : posés à la suite
      setUploading(false);
    }
  }

  // ── Actions clip (timeline) ─────────────────────────────────────────────────
  function selectClip(id: string) {
    setSelectedClipId(id);
    setAudioOnlyId(null);
    setSelectedOverlayId(null);
    setSelectedAudioId(null);
    const c = clipStarts.find((c) => c.id === id);
    if (c) seek(c.start + 0.05);
  }
  // Déplace un plan dans l'ordre de la timeline (le montage se relit dans l'ordre
  // des `clips`) — indispensable quand les rushes arrivent mélangés.
  function moveClipOrder(id: string, dir: -1 | 1) {
    setClips((prev) => {
      const i = prev.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      // le vide en tête appartient à la position, pas au plan
      const g = next[0].gapBefore; next[0] = { ...next[0], gapBefore: prev[0].gapBefore };
      if (i === 0 || j === 0) next[Math.max(i, j)] = { ...next[Math.max(i, j)], gapBefore: g };
      return next;
    });
  }

  function removeClip(id: string) {
    setClips((prev) => prev.filter((c) => c.id !== id));
    if (selectedClipId === id) setSelectedClipId(null);
  }
  function duplicateClip(id: string) {
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx < 0) return prev;
      const copy = { ...prev[idx], id: crypto.randomUUID() };
      const out = [...prev]; out.splice(idx + 1, 0, copy); return out;
    });
  }
  // Séparer le son : par défaut le son fait UN avec la vidéo (spectre intégré au plan).
  // Séparer crée une piste audio indépendante (déplaçable/rognable) et coupe le son
  // embarqué du plan — comme CapCut « Extract/Detach audio ».
  function detachAudio(id: string) {
    const c = clipStarts.find((x) => x.id === id);
    if (!c || c.kind !== "video") { toast(t('toastDetachVideoOnly')); return; }
    if ((c.vol ?? 1) === 0) { toast(t('toastAudioAlreadyDetached')); return; }
    const aid = crypto.randomUUID();
    setAudioTracks((prev) => [...prev, {
      id: aid, kind: "voiceover", name: c.name,
      // La source, c'est le rush ENTIER : on doit pouvoir rallonger le son
      // détaché au delà du rognage du plan dont il vient.
      src: c.src, dur: c.dur, srcDur: c.srcDur, vol: c.vol ?? 1, offset: c.start, srcOffset: c.trimStart, track: 0,
      fadeIn: c.audioFadeIn ?? 0, fadeOut: c.audioFadeOut ?? 0,
    }]);
    updateClip(id, { vol: 0 }); // le son passe sur la piste audio → on coupe celui embarqué
    toast(t('toastAudioDetached'));
  }
  // Séparer le son d'une incrustation (Vidéo 2, 3…) → piste audio indépendante + coupe
  // le son de l'incrustation.
  function detachOverlayAudio(id: string) {
    const o = overlays.find((x) => x.id === id);
    if (!o || o.kind !== "video") { toast(t('toastDetachVideoOnly')); return; }
    if ((o.vol ?? 1) === 0) { toast(t('toastAudioAlreadyDetached')); return; }
    setAudioTracks((prev) => [...prev, {
      id: crypto.randomUUID(), kind: "voiceover", name: o.name,
      src: o.src, dur: overlayTimelineDur(o), srcDur: o.srcDur, vol: o.vol ?? 1, offset: o.offset, srcOffset: o.trimStart, track: 0,
    }]);
    updateOverlay(id, { vol: 0 });
    toast(t('toastAudioDetached'));
  }

  // CAP-2 — « empiler » : un plan glissé vers le haut devient une piste vidéo au-dessus
  // (une incrustation plein cadre sur une nouvelle piste, à la position temporelle du plan).
  // duplicate=true (Alt) : garde le plan d'origine ; sinon il est déplacé.
  function clipToOverlayTrack(clipId: string, duplicate: boolean, offset?: number, targetTrack?: number) {
    const c = clipStarts.find((x) => x.id === clipId);
    if (!c) return;
    const track = targetTrack ?? (overlays.length ? maxOverlayTrack + 1 : 0);
    const ov: OverlayClip = {
      id: crypto.randomUUID(), kind: c.kind, name: c.name, src: c.src,
      srcDur: c.srcDur, trimStart: c.trimStart, trimEnd: c.trimEnd,
      offset: Math.max(0, offset ?? c.start), track,
      x: 50, y: 50, scale: 2, rotation: 0, opacity: 1,
      filterId: c.filterId, lum: c.lum, con: c.con, sat: c.sat, vol: c.vol ?? 1,
    };
    setOverlays((prev) => [...prev, ov]);
    if (!duplicate) removeClip(clipId);
    setSelectedOverlayId(ov.id); setSelectedClipId(null); setTool("overlay");
    toast(t('toastNewVideoTrack'));
  }

  // Ramène une incrustation sur la piste vidéo principale (façon CapCut : glisser un plan
  // vers le bas). L'incrustation redevient un plan de la séquence principale, inséré à
  // l'instant du dépôt (les plans suivants se décalent, comme un « ripple »).
  function overlayToClip(overlayId: string, dropTime: number) {
    const o = overlays.find((x) => x.id === overlayId);
    if (!o) return;
    const clip: MontageClip = {
      id: crypto.randomUUID(), kind: o.kind, name: o.name, src: o.src,
      srcDur: o.srcDur, trimStart: o.trimStart, trimEnd: o.trimEnd,
      speed: 1, filterId: o.filterId, lum: o.lum, con: o.con, sat: o.sat,
      transitionIn: "cut", transitionDur: 0.4, vol: o.vol ?? 1,
    };
    setClips((prev) => {
      let acc = 0;
      const ws = prev.map((c) => { acc += Math.max(0, c.gapBefore ?? 0); const s = acc; acc += clipTimelineDur(c); return { start: s, end: acc }; });
      let idx = ws.findIndex((w) => w.start >= dropTime);
      if (idx < 0) idx = prev.length; // au-delà de tout → à la fin
      const prevEnd = idx > 0 ? ws[idx - 1].end : 0;
      clip.gapBefore = Math.max(0, dropTime - prevEnd);
      const copy = [...prev];
      copy.splice(idx, 0, clip);
      return copy;
    });
    setOverlays((prev) => prev.filter((x) => x.id !== overlayId));
    setSelectedOverlayId(null); setSelectedClipId(clip.id); setTool("cut");
  }

  function updateClip(id: string, patch: Partial<MontageClip>) {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  // Insère un plan dans la séquence principale à un instant donné (calcule gapBefore).
  function insertClipAtTime(clip: MontageClip, insertT: number) {
    setClips((prev) => {
      let acc = 0;
      const ws = prev.map((cc) => { acc += Math.max(0, cc.gapBefore ?? 0); const s = acc; acc += clipTimelineDur(cc); return { start: s, end: acc }; });
      let idx = ws.findIndex((w) => w.start >= insertT);
      if (idx < 0) idx = prev.length;
      const prevEnd = idx > 0 ? ws[idx - 1].end : 0;
      clip.gapBefore = Math.max(0, insertT - prevEnd);
      const copy = [...prev]; copy.splice(idx, 0, clip); return copy;
    });
    setSelectedClipId(clip.id);
  }

  /* Déplace un plan DANS la séquence principale, en changeant son rang si
     besoin.

     Avant, le relâchement se contentait de recalculer `gapBefore`, c'est à dire
     le trou entre le plan précédent et lui. Un plan ne pouvait donc que
     s'éloigner vers la droite : tiré vers la gauche, son trou tombait à zéro et
     il restait à sa place. Autrement dit, l'ordre des plans était impossible à
     changer à la souris, alors que c'est le geste le plus courant du montage.

     Le rang d'arrivée se lit à la position du BORD GAUCHE du plan déplacé,
     comparée au milieu de chaque voisin : passer la moitié du plan d'à côté
     suffit à passer devant lui, et il n'y a pas besoin de le dépasser
     entièrement. Comparer les centres semblait plus naturel, mais rendait la
     première place inatteignable : tiré tout à gauche, le centre du plan tombe
     exactement sur le milieu du premier quand ils font la même durée. */
  function moveClipOnMainLane(id: string, dropT: number) {
    setClips((prev) => {
      const from = prev.findIndex((c) => c.id === id);
      if (from < 0) return prev;
      const moving = prev[from];
      const rest = prev.filter((_, i) => i !== from);

      let acc = 0;
      const ws = rest.map((c) => {
        acc += Math.max(0, c.gapBefore ?? 0);
        const start = acc;
        acc += clipTimelineDur(c);
        return { start, end: acc };
      });

      let idx = ws.findIndex((w) => dropT < (w.start + w.end) / 2);
      if (idx < 0) idx = rest.length;

      const prevEnd = idx > 0 ? ws[idx - 1].end : 0;
      const next = [...rest];
      next.splice(idx, 0, { ...moving, gapBefore: Math.max(0, dropT - prevEnd) });
      return next;
    });
  }

  // Couper en deux au curseur — fonctionne sur N'IMPORTE QUEL élément sélectionné :
  // plan principal, incrustation (Vidéo 2, 3…), texte, ou piste audio.
  /**
   * Découpe l'élément sélectionné, au curseur par défaut.
   *
   * `instant` permet à l'outil lame de couper là où l'on CLIQUE, sans déplacer
   * la tête de lecture : c'est ce que font Premiere et Resolve, et c'est ce qui
   * distingue un outil d'un bouton. Toute la logique de découpe reste commune —
   * dupliquer ces cinq cas pour la lame aurait garanti qu'ils divergent.
   */
  function splitAtPlayhead(instant?: number, cible?: { kind: string; id: string }) {
    // Le temps exact, pas celui du dernier rendu : couper au curseur pendant la
    // lecture doit couper là où l'on voit le curseur.
    const time = instant ?? timeRef.current;
    // La LAME désigne sa cible directement. Passer par `selectClip()` puis lire
    // `selectedClipId` ne marcherait pas : l'état React n'est pas encore à jour
    // dans le même tour, et on découperait l'élément précédent.
    const vise = (k: string, courant: string | null) => (cible ? (cible.kind === k ? cible.id : null) : courant);
    const idOverlay = vise("overlay", selectedOverlayId);
    const idTitle = vise("title", selectedTitleId);
    const idCaption = vise("caption", selectedCaptionId);
    const idAudio = vise("audio", selectedAudioId);
    const idClip = vise("clip", selectedClipId);
    // 1) Incrustation sélectionnée
    if (idOverlay) {
      const o = overlays.find((x) => x.id === idOverlay);
      if (!o) return;
      const dur = overlayTimelineDur(o);
      const localT = time - o.offset;
      if (localT <= 0.15 || localT >= dur - 0.15) { toast(t('toastMovePlayhead')); return; }
      const splitTrim = o.trimStart + localT;
      const nid = crypto.randomUUID();
      setOverlays((prev) => {
        const idx = prev.findIndex((x) => x.id === o.id);
        if (idx < 0) return prev;
        const first = { ...prev[idx], trimEnd: splitTrim };
        const second = { ...prev[idx], id: nid, trimStart: splitTrim, offset: time };
        const out = [...prev]; out.splice(idx, 1, first, second); return out;
      });
      setSelectedOverlayId(nid);
      return;
    }
    // 2) Texte sélectionné
    if (idTitle) {
      const ti = titles.find((x) => x.id === idTitle);
      if (!ti) return;
      if (time <= ti.start + 0.1 || time >= ti.end - 0.1) { toast(t('toastMovePlayhead')); return; }
      const nid = crypto.randomUUID();
      setTitles((prev) => {
        const idx = prev.findIndex((x) => x.id === ti.id);
        if (idx < 0) return prev;
        const out = [...prev]; out.splice(idx, 1, { ...prev[idx], end: time }, { ...prev[idx], id: nid, start: time }); return out;
      });
      setSelectedTitleId(nid);
      return;
    }
    // 2bis) Sous-titre sélectionné
    if (idCaption) {
      const c = captions.find((x) => x.id === idCaption);
      if (!c) return;
      if (time <= c.start + 0.1 || time >= c.end - 0.1) { toast(t('toastMovePlayhead')); return; }
      const nid = crypto.randomUUID();
      setCaptions((prev) => {
        const idx = prev.findIndex((x) => x.id === c.id);
        if (idx < 0) return prev;
        const out = [...prev]; out.splice(idx, 1, { ...prev[idx], end: time }, { ...prev[idx], id: nid, start: time }); return out;
      });
      setSelectedCaptionId(nid);
      return;
    }
    // 3) Piste audio sélectionnée
    if (idAudio) {
      const a = audioTracks.find((x) => x.id === idAudio);
      if (!a) return;
      const localT = time - a.offset;
      if (localT <= 0.15 || localT >= a.dur - 0.15) { toast(t('toastMovePlayhead')); return; }
      const nid = crypto.randomUUID();
      setAudioTracks((prev) => {
        const idx = prev.findIndex((x) => x.id === a.id);
        if (idx < 0) return prev;
        const first = { ...prev[idx], dur: localT };
        const second = { ...prev[idx], id: nid, offset: time, srcOffset: (prev[idx].srcOffset ?? 0) + localT, dur: a.dur - localT };
        const out = [...prev]; out.splice(idx, 1, first, second); return out;
      });
      setSelectedAudioId(nid);
      return;
    }
    // 4) Plan principal
    const c = idClip ? clipStarts.find((x) => x.id === idClip) : selectedClip;
    if (!c) return;
    const localSplit = c.kind === "video" ? c.trimStart + (time - c.start) * c.speed : time - c.start;
    if (localSplit <= c.trimStart + 0.15 || localSplit >= c.trimEnd - 0.15) {
      toast(t('toastMovePlayhead'));
      return;
    }
    setClips((prev) => {
      const idx = prev.findIndex((x) => x.id === c.id);
      if (idx < 0) return prev;
      const first = { ...prev[idx], trimEnd: localSplit };
      const second = { ...prev[idx], id: crypto.randomUUID(), trimStart: localSplit, transitionIn: "cut" as const };
      const out = [...prev];
      out.splice(idx, 1, first, second);
      return out;
    });
  }
  function applyTransitionToAll(transitionIn: string, dur: number) {
    setClips((prev) => prev.map((c) => ({ ...c, transitionIn, transitionDur: dur })));
    toast(t('toastTransitionAppliedAll'));
  }

  // ── Titres ───────────────────────────────────────────────────────────────
  function addTitle() {
    const id = crypto.randomUUID();
    const start = time, end = time + 3; // 3 s pleins → toujours visible sous le curseur à l'ajout
    setTitles((prev) => [...prev, { id, start, end, text: t('newTitleDefault'), font: "archivo", color: "#FFFFFF", anim: "rise", x: 50, y: 78 }]);
    setSelectedTitleId(id); setTool("text");
    seek(start + 0.05); // s'assure que le curseur est dans la plage du texte (affiché + éditable)
  }
  function updateTitle(id: string, patch: Partial<TitleEl>) {
    setTitles((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function removeTitle(id: string) {
    setTitles((prev) => prev.filter((t) => t.id !== id));
    if (selectedTitleId === id) setSelectedTitleId(null);
  }

  // ── Sous-titres ──────────────────────────────────────────────────────────
  function addCaption() {
    const id = crypto.randomUUID();
    const start = time, end = Math.min(total || time + 1.5, time + 1.5);
    setCaptions((prev) => [...prev, { id, start, end, text: t('newCaptionDefault') }].sort((a, b) => a.start - b.start));
  }
  function updateCaption(id: string, patch: Partial<Caption>) {
    setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeCaption(id: string) {
    setCaptions((prev) => prev.filter((c) => c.id !== id));
    setSelectedCaptionId((s) => (s === id ? null : s));
  }
  // ── Style « lié » vs « par sous-titre » ──────────────────────────────────────
  // Lié (défaut) : un seul style partagé (subStyleId + subCustom + subPos).
  // Délié : chaque sous-titre porte ses propres surcharges (styleId/custom/x/y).
  // Le sous-titre « actif pour l'édition » = celui sélectionné, sinon celui sous le curseur.
  const editingCaption = captions.find((c) => c.id === selectedCaptionId)
    || captions.find((c) => time >= c.start && time <= c.end)
    || null;
  // Sous-titres VISÉS par les réglages de style. Une sélection au lasso (ou
  // Maj+clic) l'emporte : on règle alors ce lot d'un coup. Elle force aussi le
  // mode « par sous-titre » — choisir une partie des sous-titres et voir le
  // changement s'appliquer à TOUS serait le contraire de ce qu'on a demandé.
  const capMulti = captions.filter((c) => multiSel.has(c.id));
  const perCap = capMulti.length > 0 || (!linkedSubs && !!editingCaption);
  // La valeur affichée dans le panneau vient du premier sous-titre visé.
  const refCap = capMulti[0] ?? (editingCaption ?? null);
  const activeSubStyleId = perCap && refCap ? (refCap.styleId ?? subStyleId) : subStyleId;
  const activeSubCustom: SubCustom = perCap && refCap ? (refCap.custom ?? {}) : subCustom;
  // Cible d'écriture : le lot sélectionné, sinon le sous-titre courant.
  const targetCaps = (): Caption[] => (capMulti.length ? capMulti : (editingCaption ? [editingCaption] : []));
  // Résout le style/position d'UN sous-titre donné (surcharges si déliées).
  // Une surcharge posée sur un sous-titre l'emporte TOUJOURS, même en mode lié.
  // Sans ça, régler un lot sélectionné écrivait bien les surcharges en base mais
  // l'affichage continuait de montrer le style global : le réglage paraissait
  // sans aucun effet.
  // Résolution partagée avec l'export (constants.ts) : l'aperçu et la vidéo
  // rendue doivent appliquer exactement la même règle.
  const capStyleOf = (c: Caption) => resolveCapStyle(c, subStyleId, subCustom, linkedSubs);
  const capPosOf = (c: Caption) => resolveCapPos(c, subPos);
  // Applique un changement de style au bon endroit (global ou sous-titre isolé).
  function pickSubStyle(id: string) {
    const caps = targetCaps();
    if (perCap && caps.length) caps.forEach((c) => updateCaption(c.id, { styleId: id }));
    else setSubStyleId(id);
  }
  function patchSubCustom(p: SubCustom) {
    const caps = targetCaps();
    if (perCap && caps.length) caps.forEach((c) => updateCaption(c.id, { custom: { ...(c.custom ?? {}), ...p } }));
    else setSubCustom((c) => ({ ...c, ...p }));
  }
  function resetSubCustomRouted() {
    const caps = targetCaps();
    if (perCap && caps.length) caps.forEach((c) => updateCaption(c.id, { custom: {}, styleId: undefined }));
    else setSubCustom({});
  }
  // Extrait la piste audio d'un média en WAV mono 16 kHz (format attendu par Whisper).
  // Une vidéo complète pèse trop lourd pour l'API (« Request Entity Too Large ») : on
  // n'envoie que le son, ré-échantillonné — quelques centaines de Ko au lieu de plusieurs Mo.
  // Traduit un code d'erreur de transcription en message lisible. Le serveur ne
  // renvoie plus de texte brut (on affichait du JSON et du HTML Cloudflare tels quels).
  // Le pipeline renvoie des CODES (il ne connaît pas les traductions) : c'est ici
  // qu'ils redeviennent des phrases. Sans ce passage, les toasts affichaient
  // « provider_unavailable » tel quel.
  function transcribeErrorMsg(data: { error?: string; sizeMb?: number } | null | undefined): string {
    switch (data?.error) {
      case "missing_api_key":      return t('errNoKey');
      case "media_too_large":      return t('errTooLarge', { mb: data?.sizeMb ?? 25 });
      case "rate_limited":         return t('errRateLimited');
      case "provider_unavailable": return t('errProviderDown');
      case "unsupported_format":   return t('errFormat');
      case "fetch_media_failed":   return t('errFetchMedia');
      default:                     return t('toastTranscriptionUnavailable');
    }
  }

  // Le cache de transcription du module : partagé par les trois étapes, un rush
  // n'est écouté qu'une fois même s'il sert à plusieurs plans.
  const trCacheRef = useRef<TranscriptCache>(newTranscriptCache());

  // Traduit les événements du pipeline en lignes de journal affichables.
  const preEditHooks = (): PreEditHooks => ({
    onLog: (ev) => {
      switch (ev.type) {
        case "startRushes":  return logStep(t('logStartRushes', { n: ev.n }));
        case "analyzing":    return logStep(t('logAnalyzing', { name: ev.name }));
        case "speechMapped": return logStep(t('logSpeechMapped', { n: ev.n }));
        case "trimmed":      return logStep(t('logTrimmed', { s: ev.seconds.toFixed(1) }));
        case "clipClean":    return logStep(t('logClipClean'));
        case "transcribing": return logStep(t('logTranscribing', { name: ev.name }));
        case "wordsHeard":   return logStep(t('logWordsHeard', { n: ev.n }));
        case "cutsFound":    return logStep(t('logCutsFound', { n: ev.n }));
        case "speechClean":  return logStep(t('logSpeechClean'));
        case "captions":     return logStep(ev.byWords ? t('logCaptionsWords', { n: ev.n }) : t('logCaptionsSegments', { n: ev.n }));
        case "transcribeFailed": return logStep(t('logTranscribeFailed', { name: ev.name }));
        case "trimSkippedNoSpeech": return logStep(t('logTrimSkippedNoSpeech', { name: ev.name }));
        case "allDone":      return logStep(t('logAllDone'));
      }
    },
  });

  // Un code d'erreur du pipeline redevient une phrase.
  const codeMsg = (code?: TranscribeErrorCode) => transcribeErrorMsg(code ? { error: code } : null);

  // ── Découpe fine : hésitations, faux départs, prises refaites ───────────────
  // Nécessite la transcription (clé côté serveur). Chaque plan est scindé en
  // segments à garder, dans l'ordre — le reste disparaît de la timeline.
  async function cutFillers(input?: MontageClip[]): Promise<MontageClip[]> {
    const base = input ?? clips;
    if (cuttingFillers) return base;
    const targets = selectedClipId && !input
      ? base.filter((c) => c.id === selectedClipId && c.kind === "video")
      : base.filter((c) => c.kind === "video");
    if (!targets.length) { toast(t('toastAutoCutNoVideo'), "error"); return base; }
    setCuttingFillers(true);
    try {
      const res = await tightenSpeech(base, trCacheRef.current, {
        ...preEditHooks(), only: new Set(targets.map((c) => c.id)),
      });
      // Un échec de transcription prime sur « rien à retirer » : sans ça on
      // affichait un message rassurant après une panne.
      if (res.error && !res.removedSec) { toast(codeMsg(res.error), "error"); return base; }
      if (!res.removedSec) { toast(t('toastFillersNothing')); return base; }
      setClips(res.clips);
      toast(t('toastFillersCut', { s: res.removedSec.toFixed(1) }));
      return res.clips;
    } catch {
      toast(t('toastTranscriptionError'), "error");
      return base;
    } finally {
      setCuttingFillers(false);
    }
  }

  async function generateCaptionsAI(input?: MontageClip[]) {
    // On travaille sur les plans FOURNIS : quand le prémontage enchaîne les
    // étapes, l'état React n'est pas encore à jour et décrirait l'ancienne
    // timeline (sous-titres totalement décalés).
    const base = input ?? clips;
    if (!base.some((c) => c.kind === "video")) return;
    setTranscribing(true);
    try {
      const res = await buildCaptions(base, subMaxWords, trCacheRef.current, preEditHooks());
      if (!res.captions.length) { toast(codeMsg(res.error), "error"); return; }
      if (res.error) toast(codeMsg(res.error), "error"); // transcription partielle
      setRawSegments(res.rawSegments);
      setRawWords(res.rawWords);
      setCaptions(res.captions);
      toast(t('toastCaptionsGenerated', { count: res.captions.length }));
    } catch {
      toast(t('toastTranscriptionError'), "error");
    } finally {
      setTranscribing(false);
    }
  }

  // ── Recadrage IA du sujet (statique, par plan) ──────────────────────────────
  // Pas de suivi image par image (archi 100% client) : un seul point de recadrage
  // ("focus") calculé par vision IA sur une frame représentative, appliqué à tout
  // le plan (objectPosition en aperçu, drawCover biaisé à l'export).
  async function smartCropClip(clipId: string) {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip || croppingClipId) return;
    setCroppingClipId(clipId);
    try {
      const atTime = clip.kind === "video" ? (clip.trimStart + clip.trimEnd) / 2 : 0;
      const image = await grabFrame(clip.src, clip.kind, atTime);
      const res = await fetch("/api/montage-ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "smart_crop", image }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data?.error || t('toastCropUnavailable')); return; }
      updateClip(clipId, { focusX: data.focusX, focusY: data.focusY });
      toast(t('toastCropApplied'));
    } catch {
      toast(t('toastCropError'));
    } finally {
      setCroppingClipId(null);
    }
  }

  // ── Montage automatique ──────────────────────────────────────────────────────
  // Reprend les plans déjà importés (pas de bibliothèque séparée dans ce module —
  // l'import place directement les plans sur la timeline) et laisse l'IA proposer
  // un ordre + rognage + Ken Burns + transitions cohérents en un clic.
  // Coupe les silences des plans vidéo (le plan sélectionné, sinon tous) : remplace
  // chaque plan par des sous-plans ne couvrant que les segments parlés.
  async function cutSilences() {
    if (cuttingSilence) return;
    const targets = selectedClipId
      ? clips.filter((c) => c.id === selectedClipId && c.kind === "video")
      : clips.filter((c) => c.kind === "video");
    if (!targets.length) { toast(t('toastNoVideoForSilence')); return; }
    setCuttingSilence(true);
    try {
      const ids = new Set(targets.map((c) => c.id));
      const next: MontageClip[] = [];
      let changed = false;
      for (const c of clips) {
        if (!ids.has(c.id)) { next.push(c); continue; }
        const segs = await detectSpeechSegments(c.src, 1.0);
        if (!segs || !segs.length) { next.push(c); continue; }
        const within = segs
          .map((s) => ({ start: Math.max(s.start, c.trimStart), end: Math.min(s.end, c.trimEnd) }))
          .filter((s) => s.end - s.start > 0.2);
        if (!within.length) { next.push(c); continue; }
        // Un seul segment couvrant tout le plan → rien à couper.
        if (within.length === 1 && within[0].start <= c.trimStart + 0.15 && within[0].end >= c.trimEnd - 0.15) { next.push(c); continue; }
        changed = true;
        within.forEach((s, idx) => {
          next.push({ ...c, id: crypto.randomUUID(), trimStart: s.start, trimEnd: s.end, gapBefore: idx === 0 ? c.gapBefore : 0 });
        });
      }
      if (!changed) { toast(t('toastNoSilenceFound')); return; }
      setClips(next);
      toast(t('toastSilencesCut'));
    } catch {
      toast(t('toastSilenceError'));
    } finally {
      setCuttingSilence(false);
    }
  }

  // Génère la légende APRÈS le montage : échantillonne des frames de la vidéo montée
  // et les envoie à la génération (qui applique la charte du workspace). La description
  // vidéo est ainsi basée sur ce qui se passe réellement à l'écran.
  async function generateVideoDescription() {
    if (generatingDesc || !clipStarts.length) return;
    setGeneratingDesc(true);
    try {
      const vids = clipStarts;
      const picks = vids.length <= 6 ? vids : Array.from({ length: 6 }, (_, i) => vids[Math.floor((i * (vids.length - 1)) / 5)]);
      const frames = (await Promise.all(picks.map(async (c) => {
        try {
          const at = c.kind === "video" ? c.trimStart + Math.min(0.5, (c.trimEnd - c.trimStart) / 2) : 0;
          return await grabFrame(c.src, c.kind, at, 384);
        } catch { return null; }
      }))).filter(Boolean) as string[];
      if (!frames.length) { toast(t('toastDescNoFrames')); return; }
      const res = await fetch("/api/generate-description", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: projectName, frames, workspaceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.description) { toast(data?.error || t('toastDescFailed')); return; }
      setVideoDescription(data.description);
      await supabase.from("posts").update({ caption_final: data.description }).eq("id", postId);
      toast(t('toastDescDone'));
    } catch {
      toast(t('toastDescFailed'));
    } finally {
      setGeneratingDesc(false);
    }
  }

  // ── Prémontage : coupe les passages inexploitables (analyse d'image) ───────
  // 100 % local, sans clé API. Complète la découpe « au son » (silences,
  // hésitations) qui, elle, dépend de la transcription (GROQ_API_KEY).
  async function autoCutQuality(input?: MontageClip[]): Promise<MontageClip[]> {
    const base = input ?? clips;
    const vids = base.filter((c) => c.kind === "video");
    if (autoCutting) return base;
    if (!vids.length) { toast(t('toastAutoCutNoVideo'), "error"); return base; }
    setAutoCutting(true);
    setAutoCutDone(null);
    try {
      // Le compteur du panneau se réalimente sur l'événement « analyse en cours »
      // du pipeline : c'est lui qui sait où il en est.
      const hooks = preEditHooks();
      let done = 0;
      const res = await trimClipsByQuality(base, trCacheRef.current, {
        ...hooks,
        onLog: (ev) => {
          if (ev.type === "analyzing") setAutoCutProgress({ done: done++, total: vids.length, name: ev.name });
          hooks.onLog?.(ev);
        },
      });
      // Un plan modifié est un nouvel objet : comparer les références suffit.
      const trimmed = res.clips.filter((c, i) => c !== base[i]).length;
      if (trimmed > 0) {
        // setClips suffit : l'historique enregistre un point d'annulation tout seul.
        setClips(res.clips);
        setAutoCutDone({ clips: trimmed, seconds: res.trimmedSec });
        toast(t('toastAutoCutDone', { n: trimmed, s: res.trimmedSec.toFixed(1) }));
      } else if (res.skippedNoSpeech.length) {
        // « Rien à retirer » serait un mensonge : on n'a rien ANALYSÉ. Sans
        // transcription, on ne sait pas où est la parole, donc on ne coupe pas.
        toast(t('toastTrimSkippedNoSpeech', { n: res.skippedNoSpeech.length }), "error");
      } else {
        toast(t('toastAutoCutNothing'));
      }
      return res.clips;
    } finally {
      setAutoCutting(false);
      setAutoCutProgress(null);
    }
  }

  // ── Habillage IA (« le réalisateur ») ───────────────────────────────────────
  // Dernière étape du prémontage : une fois l'ours propre, on pose les titres et
  // les transitions. C'était le chaînon manquant — le prémontage rendait un
  // montage nettoyé mais NU, sans un seul texte à l'écran, là où une vidéo
  // livrable en porte toujours (accroche, chapitres, chiffres, CTA).
  //
  // Best-effort assumé : un habillage raté ne doit pas emporter un prémontage
  // réussi. En cas d'échec, on garde les coupes et les sous-titres, et on le dit.
  async function runDirector(
    dressed: MontageClip[],
    segments: { start: number; end: number; text: string }[],
  ): Promise<{ clips: MontageClip[]; titles: TitleEl[] } | null> {
    const starts = computeStarts(dressed);
    try {
      const res = await fetch("/api/montage-director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          clips: starts.map((c) => ({
            id: c.id, kind: c.kind, name: c.name,
            tlStart: c.start, tlDur: clipTimelineDur(c),
          })),
          // Déjà dans le référentiel de la timeline (buildCaptions les y ramène) :
          // les timings rendus par le réalisateur sont donc posables tels quels.
          transcript: segments.slice(0, 400),
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();

      const newTitles: TitleEl[] = (Array.isArray(data.titles) ? data.titles : []).map(
        (t: Omit<TitleEl, "id">) => ({ ...t, id: crypto.randomUUID() }),
      );

      const byId = new Map<string, { transition: string; dur: number }>(
        (Array.isArray(data.transitions) ? data.transitions : []).map(
          (tr: { clipId: string; transition: string; dur: number }) => [tr.clipId, { transition: tr.transition, dur: tr.dur }],
        ),
      );
      const withTransitions = dressed.map((c) => {
        const tr = byId.get(c.id);
        return tr ? { ...c, transitionIn: tr.transition, transitionDur: tr.dur } : c;
      });

      return { clips: withTransitions, titles: newTitles };
    } catch (e) {
      console.warn("[réalisateur] habillage indisponible :", e);
      return null;
    }
  }

  // ── Prémontage IA complet (?premontage=1) ───────────────────────────────────
  // Enchaîne automatiquement à l'ouverture ce qu'on lançait outil par outil :
  // dérushage image → dérushage parole → sous-titres à la charte → habillage.
  const preRunRef = useRef(false);
  async function runFullPreEdit() {
    if (preRunRef.current) return;
    preRunRef.current = true;
    setPreEditing(true);
    setAiLog([]);
    loggingRef.current = true;
    const stepLabels = [t('preStepRushes'), t('preStepSpeech'), t('preStepCaptions'), t('preStepDressing')];
    try {
      // Un seul pipeline, partagé avec la génération en lot du workspace : une
      // correction ici vaut pour les deux. Les transitions ne sont plus posées
      // d'office : c'est le réalisateur, ci-dessous, qui les choisit selon le
      // propos — la coupe franche reste le défaut là où il n'en demande pas.
      const res = await runPreEdit(clips, {
        subMaxWords,
        cache: trCacheRef.current,
        ...preEditHooks(),
        onStep: (i) => { setPreEditStepIdx(i); setPreEditStep(stepLabels[i] ?? null); },
      });

      // Habillage : seulement s'il y a de quoi le nourrir. Sans parole transcrite,
      // le réalisateur n'a rien pour décider où poser un titre — on s'arrête à
      // l'ours propre plutôt que d'inventer.
      let finalClips = res.clips;
      if (res.rawSegments.length) {
        setPreEditStepIdx(3);
        setPreEditStep(stepLabels[3]);
        const dressed = await runDirector(res.clips, res.rawSegments);
        if (dressed) {
          finalClips = dressed.clips;
          if (dressed.titles.length) setTitles((prev) => [...prev, ...dressed.titles]);
        }
      }

      setClips(finalClips);
      if (res.captions.length) {
        setCaptions(res.captions);
        setRawSegments(res.rawSegments);
        setRawWords(res.rawWords);
      }
      // La transcription est le socle du prémontage : sans elle, pas de sous-titres
      // ET pas de rognage (on ne coupe pas à l'aveugle). Le dire franchement vaut
      // mieux qu'un « c'est fait » sur une vidéo que l'IA n'a pas touchée.
      if (res.error && !res.captions.length) toast(codeMsg(res.error), "error");
      else if (res.skippedNoSpeech.length) toast(t('toastTrimSkippedNoSpeech', { n: res.skippedNoSpeech.length }), "error");
      else {
        // Réussite PARTIELLE : trois rushes transcrits, un quatrième non. Le trou
        // de sous-titres apparaissait sans un mot d'explication — on le dit.
        if (res.failed.length) toast(t('toastPartialTranscribe', { n: res.failed.length }), "error");
        else toast(t('preEditDone'));
      }
      // On laisse la dernière ligne s'écrire avant de refermer l'écran.
      await new Promise((r) => setTimeout(r, 900));
    } finally {
      /* Le prémontage est marqué comme FAIT, quel qu'ait été son résultat.

         Il ne l'était qu'en cas de réussite parfaite : une vidéo sans parole, ou
         dont la transcription échouait, ne posait jamais l'horodatage. Rouvrir le
         projet relançait alors tout le prémontage, encore et encore, en écrasant
         à chaque fois le travail fait entre-temps.

         Ce que le drapeau doit dire, c'est « on l'a lancé », pas « ça s'est bien
         passé ». Relancer automatiquement ce qui vient d'échouer ne peut que
         rater à nouveau, et détruire du travail au passage. Le panneau IA reste
         là pour le relancer à la main.

         Il est écrit TOUT DE SUITE en base : un prémontage qui ne change rien à
         la timeline ne déclenche aucune sauvegarde automatique, et le drapeau
         serait perdu à la fermeture de l'onglet. */
      preEditedAtRef.current = new Date().toISOString();
      supabase.from("posts").update({ montage_json: projectRef.current() }).eq("id", postId).then(() => {});
      loggingRef.current = false;
      setPreEditing(false);
      setPreEditStep(null);
      setPreEditStepIdx(-1);
    }
  }

  // Déclenché une seule fois, après le chargement du projet.
  useEffect(() => {
    if (loading || preRunRef.current) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("premontage") !== "1") return;
    if (!clips.some((c) => c.kind === "video")) return;
    // on retire le paramètre pour ne pas relancer au rafraîchissement
    window.history.replaceState({}, "", window.location.pathname);
    // Déjà prémonté : on ne recommence PAS. Quitter la page en cours de route
    // puis revenir relançait tout et écrasait le travail fait entre-temps.
    // Le panneau IA reste là pour le relancer volontairement.
    if (preEditedAtRef.current) { preRunRef.current = true; return; }
    runFullPreEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, clips.length]);

  // ── Couverture : choisie À LA FIN, sur l'image affichée ─────────────────────
  // On capture le frame au playhead : on se place sur le moment voulu, on clique.
  // (Avant montage, on ne sait pas encore quelle image représente la vidéo.)
  async function setCoverFromPlayhead() {
    const c = activeClip;
    if (settingCover || !c) return;
    setSettingCover(true);
    try {
      const at = c.kind === "video" ? c.trimStart + (timeRef.current - c.start) * c.speed : 0;
      const dataUrl = await grabFrame(c.src, c.kind, at, 720);
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${workspaceId}/cover-${postId}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("photos").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) { toast(t('toastCoverError'), "error"); return; }
      const url = supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
      await supabase.from("posts").update({ thumbnail_url: url }).eq("id", postId);
      setCoverUrl(url);
      toast(t('toastCoverSet'));
    } catch {
      toast(t('toastCoverError'), "error");
    } finally {
      setSettingCover(false);
    }
  }

  // ── Légende : écrite À LA FIN, une fois le montage terminé ──────────────────
  // Avant montage on ne sait pas ce que la vidéo raconte ; ici on dispose du
  // rendu réel (frames échantillonnées) et de la transcription (sous-titres).
  async function generateCaptionAI() {
    if (captioning || !clips.length) return;
    setCaptioning(true);
    try {
      // 4 images réparties sur la timeline montée + la transcription.
      const picks = [0.1, 0.35, 0.6, 0.85].map((p) => p * Math.max(0.1, total));
      const frames = (await Promise.all(picks.map(async (tAt) => {
        const c = clipStarts.find((cc) => tAt >= cc.start && tAt < cc.end) ?? clipStarts[0];
        if (!c) return null;
        try { return await grabFrame(c.src, c.kind, c.kind === "video" ? c.trimStart + Math.max(0, tAt - c.start) : 0); }
        catch { return null; }
      }))).filter(Boolean) as string[];

      const spoken = captions.map((c) => c.text).join(" ").trim();
      const res = await fetch("/api/generate-description", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: projectName || t('defaultProjectName'),
          frames,
          workspaceId,
          context: spoken ? `Transcription de la vidéo : ${spoken.slice(0, 1500)}` : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.description) { toast(data?.error || t('toastCaptionError')); return; }
      await supabase.from("posts").update({ description: data.description, status: "generated" }).eq("id", postId);
      setCaption(data.description);
      toast(t('toastCaptionDone'));
    } catch {
      toast(t('toastCaptionError'), "error");
    } finally {
      setCaptioning(false);
    }
  }

  async function autoAssembleAI() {
    if (assembling) return;
    if (clips.length < 2) { toast(t('toastNeedTwoClips')); return; }
    setAssembling(true);
    try {
      const sample = clips.slice(0, 10);
      const images = (await Promise.all(sample.map(async (c) => {
        try {
          const dataUrl = await grabFrame(c.src, c.kind, c.kind === "video" ? Math.min(c.trimStart + 0.5, Math.max(0, c.srcDur - 0.1)) : 0);
          return { id: c.id, dataUrl };
        } catch { return null; }
      }))).filter(Boolean) as { id: string; dataUrl: string }[];

      const res = await fetch("/api/montage-ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "auto_assemble",
          clips: clips.map((c) => ({ id: c.id, kind: c.kind, name: c.name, srcDur: c.srcDur })),
          images,
        }),
      });
      const data = await res.json();
      const plan: { id: string; trimStart?: number; trimEnd?: number; kenBurns?: "in" | "out" | null; transitionIn?: string; transitionDur?: number }[] = data?.plan || [];
      if (!res.ok || !plan.length) { toast(data?.error || t('toastAssemblyUnavailable')); return; }

      const byId = new Map(clips.map((c) => [c.id, c]));
      const next: MontageClip[] = [];
      for (const step of plan) {
        const base = byId.get(step.id);
        if (!base) continue;
        const trimStart = typeof step.trimStart === "number" ? Math.max(0, step.trimStart) : base.trimStart;
        const trimEndRaw = typeof step.trimEnd === "number" ? Math.min(base.srcDur, step.trimEnd) : base.trimEnd;
        next.push({
          ...base,
          trimStart,
          trimEnd: trimEndRaw > trimStart ? trimEndRaw : base.trimEnd,
          kenBurns: base.kind === "photo" && (step.kenBurns === "in" || step.kenBurns === "out") ? step.kenBurns : undefined,
          transitionIn: TRANSITIONS.some((tr) => tr.id === step.transitionIn) ? (step.transitionIn as string) : base.transitionIn,
          transitionDur: typeof step.transitionDur === "number" ? Math.max(0, Math.min(2, step.transitionDur)) : base.transitionDur,
        });
      }
      // Sécurité : un plan non repris par l'IA (id oublié dans sa réponse) n'est jamais perdu.
      for (const c of clips) if (!next.some((n) => n.id === c.id)) next.push(c);
      setClips(next);
      toast(t('toastAssemblyApplied'));
    } catch {
      toast(t('toastAssemblyError'));
    } finally {
      setAssembling(false);
    }
  }

  // ── Suggestion d'ambiance musicale (texte) ──────────────────────────────────
  // Pas de bibliothèque de musique sous licence commerciale disponible pour l'instant
  // (Pixabay/Jamendo écartés) : l'IA suggère une AMBIANCE en texte pour guider le choix,
  // l'utilisateur important toujours son propre fichier via l'onglet Audio existant.
  async function suggestMusicMoodAI() {
    if (suggestingMusic) return;
    if (!clips.length) { toast(t('toastNeedOneClip')); return; }
    setSuggestingMusic(true);
    try {
      const sample = clips.slice(0, 4);
      const images = (await Promise.all(sample.map((c) =>
        grabFrame(c.src, c.kind, c.kind === "video" ? Math.min(c.trimStart + 0.5, Math.max(0, c.srcDur - 0.1)) : 0).catch(() => null)
      ))).filter(Boolean) as string[];

      const res = await fetch("/api/montage-ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "music_mood", clips: clips.map((c) => ({ kind: c.kind, name: c.name })), images }),
      });
      const data = await res.json();
      if (!res.ok || !data.suggestion) { toast(data?.error || t('toastMusicSuggestionUnavailable')); return; }
      setMusicSuggestion(data.suggestion);
    } catch {
      toast(t('toastMusicSuggestionError'));
    } finally {
      setSuggestingMusic(false);
    }
  }

  // Re-découpe les sous-titres avec une nouvelle longueur (mots/bloc) sans re-transcrire.
  function setCaptionLength(words: number) {
    setSubMaxWords(words);
    // Re-découpe à partir des mots quand on les a (calage exact), sinon des segments.
    if (rawWords.length) setCaptions(captionsFromWords(rawWords, words));
    else if (rawSegments.length) setCaptions(segmentCaptions(dedupeSegments(rawSegments), words));
  }

  // Applique un modèle de sous-titres enregistré (style + surcharges + position + longueur).
  function applySubTemplate(tpl: { styleId: string; custom: SubCustom; pos: { x: number; y: number }; maxWords: number }) {
    // Un lot sélectionné reçoit le preset POUR LUI SEUL. Sans ce test, appliquer
    // un preset après avoir sélectionné cinq sous-titres le posait sur les
    // quarante autres — l'inverse de ce qu'on demande.
    if (capMulti.length) {
      const pos = tpl.pos || DEFAULT_SUB_POS;
      capMulti.forEach((c) => updateCaption(c.id, { styleId: tpl.styleId, custom: tpl.custom || {}, x: pos.x, y: pos.y }));
      // `maxWords` redécoupe TOUS les sous-titres : ça n'a pas de sens sur un
      // lot, on ne le touche pas ici.
      toast(t('toastSubTemplateApplied'));
      return;
    }
    setSubStyleId(tpl.styleId);
    setSubCustom(tpl.custom || {});
    setSubPos(tpl.pos || DEFAULT_SUB_POS);
    setCaptionLength(tpl.maxWords || DEFAULT_WORDS_PER_CAPTION);
    toast(t('toastSubTemplateApplied'));
  }

  // ── Stickers ─────────────────────────────────────────────────────────────
  function addSticker(glyph: string, isImage?: boolean) {
    const id = crypto.randomUUID();
    const start = time, end = Math.min(total || time + 4, time + 4);
    setStickers((prev) => [...prev, { id, glyph, isImage, start, end, x: 50, y: 42, scale: 1 }]);
    setSelectedStickerId(id);
  }
  function updateSticker(id: string, patch: Partial<StickerEl>) {
    setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removeSticker(id: string) {
    setStickers((prev) => prev.filter((s) => s.id !== id));
    if (selectedStickerId === id) setSelectedStickerId(null);
  }
  function toggleProgressBar() { setShowProgressBar((p) => !p); }

  // ── Audio ────────────────────────────────────────────────────────────────
  /** Un fichier son ? Certains navigateurs ne renseignent pas le type MIME sur un
   *  glisser-déposer : on retombe alors sur l'extension. */
  function estAudio(f: File): boolean {
    if (f.type.startsWith("audio/")) return true;
    return /\.(mp3|wav|m4a|aac|ogg|oga|flac|aiff?|opus|weba)$/i.test(f.name);
  }

  /** Importe un son ET le pose à un endroit précis de la timeline. Rend sa durée,
   *  pour que plusieurs fichiers déposés d'un coup se suivent. */
  async function importAudioAt(file: File, kind: "music" | "voiceover", offset: number, track: number): Promise<number> {
    setUploadingAudio(true);
    try {
      const ext = file.name.split(".").pop() || "mp3";
      const path = `${workspaceId}/${postId}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("audio").upload(path, file, { upsert: true, contentType: file.type || "audio/mpeg" });
      if (error) { toast(t('toastAudioUploadFailed', { msg: error.message })); return 0; }
      const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
      const [dur, waveform] = await Promise.all([getAudioDuration(urlData.publicUrl), computeWaveform(file)]);
      const id = crypto.randomUUID();
      setAudioTracks((prev) => [...prev, {
        id, kind, name: file.name, src: urlData.publicUrl, dur, srcDur: dur,
        vol: 1, offset: Math.max(0, offset), track, waveform,
      }]);
      setSelectedAudioId(id);
      setTool("audio");
      return dur;
    } finally {
      setUploadingAudio(false);
    }
  }

  async function importAudio(file: File, kind: "music" | "voiceover") {
    setUploadingAudio(true);
    try {
      const ext = file.name.split(".").pop() || "mp3";
      const path = `${workspaceId}/${postId}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("audio").upload(path, file, { upsert: true, contentType: file.type || "audio/mpeg" });
      if (error) { toast(t('toastAudioUploadFailed', { msg: error.message })); return; }
      const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
      const [dur, waveform] = await Promise.all([getAudioDuration(urlData.publicUrl), computeWaveform(file)]);
      // `srcDur` : la VRAIE longueur du fichier. Sans elle, `audioSrcDur` retombe
      // sur ce qui est actuellement posé sur la timeline, si bien qu'au premier
      // raccourcissement la piste oublie ce qu'il lui restait de source et ne
      // peut plus jamais être rallongée.
      setAudioTracks((prev) => [...prev, { id: crypto.randomUUID(), kind, name: file.name, src: urlData.publicUrl, dur, srcDur: dur, vol: 1, offset: 0, waveform }]);
    } finally {
      setUploadingAudio(false);
    }
  }
  function removeAudioTrack(id: string) {
    setAudioTracks((prev) => prev.filter((a) => a.id !== id));
  }
  function setAudioVol(id: string, vol: number) {
    setAudioTracks((prev) => prev.map((a) => (a.id === id ? { ...a, vol } : a)));
  }
  function setAudioFade(id: string, kind: "fadeIn" | "fadeOut", seconds: number) {
    setAudioTracks((prev) => prev.map((a) => (a.id === id ? { ...a, [kind]: seconds } : a)));
  }
  // Poignées de fondu (points blancs façon CapCut) : on tire vers l'intérieur pour que le
  // son monte / descende progressivement.
  const fadeDragRef = useRef<{ id: string; kind: "fadeIn" | "fadeOut"; startX: number; t0: number; dur: number } | null>(null);
  function startFadeDrag(e: React.PointerEvent, a: { id: string; dur: number; fadeIn?: number; fadeOut?: number }, kind: "fadeIn" | "fadeOut") {
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    // Sélectionne aussi la piste : sinon, cliquer une poignée de fondu (aux extrémités)
    // ne la sélectionnait pas → « Supprimer » ne marchait pas aux bords.
    setSelectedAudioId(a.id); setSelectedClipId(null); setSelectedOverlayId(null); if (multiSel.size) setMultiSel(new Set());
    fadeDragRef.current = { id: a.id, kind, startX: e.clientX, t0: (kind === "fadeIn" ? a.fadeIn : a.fadeOut) ?? 0, dur: a.dur };
  }
  function onFadeDragMove(e: React.PointerEvent) {
    const d = fadeDragRef.current;
    if (!d) return;
    const delta = (e.clientX - d.startX) / pps;
    const sec = Math.max(0, Math.min(d.dur, d.kind === "fadeIn" ? d.t0 + delta : d.t0 - delta));
    setAudioFade(d.id, d.kind, sec);
  }
  function onFadeDragUp(e: React.PointerEvent) {
    if (fadeDragRef.current) { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} fadeDragRef.current = null; }
  }
  // Idem pour le son EMBARQUÉ d'un plan vidéo (piste « son des plans »).
  const clipFadeRef = useRef<{ id: string; kind: "audioFadeIn" | "audioFadeOut"; startX: number; t0: number; dur: number } | null>(null);
  function startClipFade(e: React.PointerEvent, c: { id: string; dur: number; audioFadeIn?: number; audioFadeOut?: number }, kind: "audioFadeIn" | "audioFadeOut") {
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    clipFadeRef.current = { id: c.id, kind, startX: e.clientX, t0: (kind === "audioFadeIn" ? c.audioFadeIn : c.audioFadeOut) ?? 0, dur: c.dur };
  }
  function onClipFadeMove(e: React.PointerEvent) {
    const d = clipFadeRef.current;
    if (!d) return;
    const delta = (e.clientX - d.startX) / pps;
    const sec = Math.max(0, Math.min(d.dur, d.kind === "audioFadeIn" ? d.t0 + delta : d.t0 - delta));
    updateClip(d.id, { [d.kind]: sec });
  }
  function onClipFadeUp(e: React.PointerEvent) {
    if (clipFadeRef.current) { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} clipFadeRef.current = null; }
  }
  // Fondu du son d'une incrustation (Vidéo 2, 3…).
  const ovFadeRef = useRef<{ id: string; kind: "audioFadeIn" | "audioFadeOut"; startX: number; t0: number; dur: number } | null>(null);
  function startOverlayFade(e: React.PointerEvent, o: OverlayClip, kind: "audioFadeIn" | "audioFadeOut") {
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    ovFadeRef.current = { id: o.id, kind, startX: e.clientX, t0: (kind === "audioFadeIn" ? o.audioFadeIn : o.audioFadeOut) ?? 0, dur: overlayTimelineDur(o) };
  }
  function onOverlayFadeMove(e: React.PointerEvent) {
    const d = ovFadeRef.current;
    if (!d) return;
    const delta = (e.clientX - d.startX) / pps;
    const sec = Math.max(0, Math.min(d.dur, d.kind === "audioFadeIn" ? d.t0 + delta : d.t0 - delta));
    updateOverlay(d.id, { [d.kind]: sec });
  }
  function onOverlayFadeUp(e: React.PointerEvent) {
    if (ovFadeRef.current) { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} ovFadeRef.current = null; }
  }
  // ── Sélection façon éditeur visuel dans l'aperçu : boîte violette + 8 poignées de
  // redimensionnement (échelle) + poignée de rotation. Modèle du montage = échelle uniforme.
  function mzCenterOf(node: HTMLElement | null): { cx: number; cy: number } | null {
    const box = node?.closest(".mz-ov-item, .mz-pip, .mz-cap-box") as HTMLElement | null;
    if (!box) return null;
    const r = box.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }
  function startTransformResize(e: React.PointerEvent, startScale: number, apply: (s: number) => void) {
    e.stopPropagation(); e.preventDefault();
    const c = mzCenterOf(e.currentTarget as HTMLElement); if (!c) return;
    const startDist = Math.hypot(e.clientX - c.cx, e.clientY - c.cy) || 1;
    const onMove = (ev: PointerEvent) => { const d = Math.hypot(ev.clientX - c.cx, ev.clientY - c.cy); apply(Math.max(0.05, startScale * d / startDist)); }; // aucune limite haute d'étirement
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  }
  function startTransformRotate(e: React.PointerEvent, apply: (deg: number) => void) {
    e.stopPropagation(); e.preventDefault();
    const c = mzCenterOf(e.currentTarget as HTMLElement); if (!c) return;
    const onMove = (ev: PointerEvent) => { const a = Math.atan2(ev.clientY - c.cy, ev.clientX - c.cx) * 180 / Math.PI - 90; apply(((Math.round(a) % 360) + 360) % 360); };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  }
  /* Poignées de transformation.

     Le `scale(var(--pzi))` les tient à taille constante à l'écran quand l'aperçu
     est zoomé : sans lui, elles grossissaient avec l'image et finissaient par la
     recouvrir. Elles sont posées à cheval sur le coin (décalage de -6 pour une
     bille de 13), et l'échelle joue autour de leur centre : le centre reste donc
     sur le coin, quel que soit le zoom. */
  const MZ_HANDLES: { id: string; style: React.CSSProperties }[] = [
    { id: "tl", style: { left: -6, top: -6, transform: "scale(var(--pzi,1))", cursor: "nwse-resize" } },
    { id: "tc", style: { left: "50%", top: -6, transform: "translateX(-50%) scale(var(--pzi,1))", cursor: "ns-resize" } },
    { id: "tr", style: { right: -6, top: -6, transform: "scale(var(--pzi,1))", cursor: "nesw-resize" } },
    { id: "mr", style: { right: -6, top: "50%", transform: "translateY(-50%) scale(var(--pzi,1))", cursor: "ew-resize" } },
    { id: "br", style: { right: -6, bottom: -6, transform: "scale(var(--pzi,1))", cursor: "nwse-resize" } },
    { id: "bc", style: { left: "50%", bottom: -6, transform: "translateX(-50%) scale(var(--pzi,1))", cursor: "ns-resize" } },
    { id: "bl", style: { left: -6, bottom: -6, transform: "scale(var(--pzi,1))", cursor: "nesw-resize" } },
    { id: "ml", style: { left: -6, top: "50%", transform: "translateY(-50%) scale(var(--pzi,1))", cursor: "ew-resize" } },
  ];
  function TransformHandles({ scale, onScale, onRotate }: { scale: number; onScale: (s: number) => void; onRotate: (d: number) => void }) {
    return (
      <>
        {MZ_HANDLES.map((h) => (
          <span key={h.id} className="mz-th" style={h.style}
            onPointerDown={(e) => startTransformResize(e, scale, onScale)} onClick={(e) => e.stopPropagation()} />
        ))}
        <div className="mz-rot-line" />
        <div className="mz-rot" title={t('resizeTitle')} onPointerDown={(e) => startTransformRotate(e, onRotate)} onClick={(e) => e.stopPropagation()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" /></svg>
        </div>
      </>
    );
  }
  // Déplacement d'un texte dans le temps sur la timeline (décale start ET end).
  const titleDragRef = useRef<{ id: string; startX: number; t0start: number; dur: number; moved: boolean; alt: boolean } | null>(null);
  function onTitleBarDown(e: React.PointerEvent, ti: TitleEl) {
    e.stopPropagation();
    setSelectedTitleId(ti.id); setTool("text");
    if (lockedLanes.has(`t${ti.track ?? 0}`)) return; // piste verrouillée : sélection ok, déplacement bloqué
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    titleDragRef.current = { id: ti.id, startX: e.clientX, t0start: ti.start, dur: ti.end - ti.start, moved: false, alt: e.altKey };
  }
  function onTitleBarMove(e: React.PointerEvent) {
    const d = titleDragRef.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) < 4) return;
    if (!d.moved && d.alt) {   // ⌥ + glisser = dupliquer
      const src = titles.find((x) => x.id === d.id);
      if (src) {
        const nid = crypto.randomUUID();
        setTitles((prev) => [...prev, { ...src, id: nid }]);
        setSelectedTitleId(nid);
        d.id = nid;
      }
    }
    d.moved = true;
    /* Changement de rangée EN DIRECT.

       La rangée visée n'était calculée qu'au relâchement : en glissant vers le
       haut, rien ne bougeait, on ne savait pas où l'on allait atterrir, et le
       geste passait pour inopérant. Le texte saute donc tout de suite dans la
       rangée survolée, exactement comme un plan. Pour la création d'une NOUVELLE
       rangée, on se contente d'allumer le repère : la créer en pleine main
       décalerait toute la timeline sous le curseur. */
    const cible = pisteTexteCible(e.clientX, e.clientY, textTrackCount);
    if (cible !== null && cible < textTrackCount) {
      if (dropLane) setDropLane(null);
      const actuelle = titles.find((x) => x.id === d.id)?.track ?? 0;
      if (cible !== actuelle) updateTitle(d.id, { track: cible });
    } else if (cible !== null) {
      if (dropLane !== "newtext") setDropLane("newtext");
    } else if (dropLane) {
      setDropLane(null);
    }
    const ns = Math.max(0, snapTime(d.t0start + (e.clientX - d.startX) / pps, { ignorer: d.id }));
    updateTitle(d.id, { start: ns, end: ns + d.dur });
  }
  function onTitleBarUp(e: React.PointerEvent) {
    effacerAimant();
    const d = titleDragRef.current; titleDragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (!d) return;
    if (!d.moved) {
      if (time < d.t0start || time > d.t0start + d.dur) seek(d.t0start + 0.05); // clic simple → recadre le curseur
      return;
    }
    const nouvelle = dropLane === "newtext";
    setDropLane(null);
    const cible = nouvelle ? textTrackCount : pisteTexteCible(e.clientX, e.clientY, textTrackCount);
    setTitles((prev) => {
      const moi = prev.find((x) => x.id === d.id);
      if (!moi) return prev;
      const track = cible ?? (moi.track ?? 0);
      const duree = Math.max(0.05, moi.end - moi.start);
      // Deux textes ne peuvent pas occuper le même instant sur la même rangée :
      // on cale contre le voisin plutôt que de se poser par-dessus.
      const occupes = prev.filter((x) => x.id !== d.id && (x.track ?? 0) === track).map((x) => ({ a: x.start, b: x.end }));
      const debut = creneauLibre(moi.start, duree, occupes);
      return prev.map((x) => (x.id === d.id ? { ...x, track, start: debut, end: debut + duree } : x));
    });
  }
  // Rogner la durée d'un texte (poignées gauche/droite) comme une vidéo.
  const titleTrimRef = useRef<{ id: string; edge: "start" | "end"; startX: number; t0start: number; t0end: number } | null>(null);
  function startTitleTrim(e: React.PointerEvent, ti: TitleEl, edge: "start" | "end") {
    e.stopPropagation();
    setSelectedTitleId(ti.id);
    if (lockedLanes.has(`t${ti.track ?? 0}`)) return; // piste verrouillée
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    titleTrimRef.current = { id: ti.id, edge, startX: e.clientX, t0start: ti.start, t0end: ti.end };
  }
  function onTitleTrimMove(e: React.PointerEvent) {
    const d = titleTrimRef.current; if (!d) return;
    const delta = (e.clientX - d.startX) / pps;
    if (d.edge === "start") updateTitle(d.id, { start: Math.max(0, Math.min(d.t0end - 0.3, snapTime(d.t0start + delta, { ignorer: d.id }))) });
    else updateTitle(d.id, { end: Math.max(d.t0start + 0.3, snapTime(d.t0end + delta, { ignorer: d.id })) });
  }
  function endTitleTrim(e: React.PointerEvent) {
    if (titleTrimRef.current) { try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {} titleTrimRef.current = null; }
  }
  // Déplacement d'un sous-titre sur la timeline (chaque bloc est indépendant : on le
  // déplace, on l'allonge/raccourcit, on double-clique pour l'éditer — comme un texte).
  const capDragRef = useRef<{ id: string; startX: number; t0start: number; dur: number; moved: boolean; alt: boolean } | null>(null);
  function onCaptionBarDown(e: React.PointerEvent, c: Caption) {
    e.stopPropagation();
    // Maj+clic : on cumule, comme sur les plans. Sans ça on ne pouvait
    // sélectionner qu'un sous-titre à la fois.
    if (e.shiftKey) { toggleMulti(c.id); setTool("captions"); return; }
    if (multiSel.size) setMultiSel(new Set());
    setSelectedCaptionId(c.id); setSubSelected(true); setTool("captions");
    if (lockedLanes.has("subs")) return; // piste verrouillée
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    capDragRef.current = { id: c.id, startX: e.clientX, t0start: c.start, dur: c.end - c.start, moved: false, alt: e.altKey };
  }
  function onCaptionBarMove(e: React.PointerEvent) {
    const d = capDragRef.current; if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) < 4) return;
    if (!d.moved && d.alt) {   // ⌥ + glisser = dupliquer
      const src = captions.find((x) => x.id === d.id);
      if (src) {
        const nid = crypto.randomUUID();
        setCaptions((prev) => [...prev, { ...src, id: nid }]);
        setSelectedCaptionId(nid);
        d.id = nid;
      }
    }
    d.moved = true;
    const ns = Math.max(0, snapTime(d.t0start + (e.clientX - d.startX) / pps, { ignorer: d.id }));
    updateCaption(d.id, { start: ns, end: ns + d.dur });
  }
  function onCaptionBarUp(e: React.PointerEvent) {
    effacerAimant();
    const d = capDragRef.current; capDragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (!d) return;
    if (!d.moved) {
      if (time < d.t0start || time > d.t0start + d.dur) seek(d.t0start + 0.05); // clic simple → recadre le curseur
      return;
    }
    setCaptions((prev) => {
      const moi = prev.find((x) => x.id === d.id);
      if (!moi) return prev;
      const duree = Math.max(0.05, moi.end - moi.start);
      const occupes = prev.filter((x) => x.id !== d.id).map((x) => ({ a: x.start, b: x.end }));
      const debut = creneauLibre(moi.start, duree, occupes);
      return prev.map((x) => (x.id === d.id ? { ...x, start: debut, end: debut + duree } : x));
    });
  }
  /* Durée d'une transition réglée À LA MAIN sur la timeline.

     Elle ne se réglait qu'au curseur du panneau. Sur une timeline, tout ce qui a
     une durée se prend par le bord et se tire — un plan, un sous-titre, un titre.
     Une transition n'avait aucune raison d'y échapper. Le bloc étant centré sur la
     coupe, tirer un bord d'un pixel en ajoute deux à la durée. */
  const transTrimRef = useRef<{ id: string; sens: -1 | 1; startX: number; dur0: number; max: number } | null>(null);
  function startTransTrim(e: React.PointerEvent, clipEntrant: MontageClip & { start: number; end: number; dur: number }, sens: -1 | 1) {
    e.stopPropagation();
    const i = clipStarts.findIndex((x) => x.id === clipEntrant.id);
    const sortant = clipStarts[i - 1];
    // Une transition ne peut pas durer plus que le plus court des deux plans :
    // au delà, elle mangerait un plan entier et le montage sauterait.
    const max = Math.max(0.1, Math.min(1.5, clipEntrant.dur, sortant ? sortant.dur : 1.5));
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    transTrimRef.current = { id: clipEntrant.id, sens, startX: e.clientX, dur0: clipEntrant.transitionDur || 0.5, max };
    deselectAll();
    setSelectedTransId(clipEntrant.id);
    setSelectedClipId(clipEntrant.id);
    setTool("transitions");
  }
  function onTransTrimMove(e: React.PointerEvent) {
    const d = transTrimRef.current; if (!d) return;
    const delta = ((e.clientX - d.startX) / pps) * 2 * d.sens;
    updateClip(d.id, { transitionDur: Math.max(0.1, Math.min(d.max, +(d.dur0 + delta).toFixed(2))) });
  }
  function endTransTrim(e: React.PointerEvent) {
    transTrimRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }

  const capTrimRef = useRef<{ id: string; edge: "start" | "end"; startX: number; t0start: number; t0end: number } | null>(null);
  function startCaptionTrim(e: React.PointerEvent, c: Caption, edge: "start" | "end") {
    e.stopPropagation();
    setSelectedCaptionId(c.id); setSubSelected(true);
    if (lockedLanes.has("subs")) return;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    capTrimRef.current = { id: c.id, edge, startX: e.clientX, t0start: c.start, t0end: c.end };
  }
  function onCaptionTrimMove(e: React.PointerEvent) {
    const d = capTrimRef.current; if (!d) return;
    const delta = (e.clientX - d.startX) / pps;
    if (d.edge === "start") updateCaption(d.id, { start: Math.max(0, Math.min(d.t0end - 0.2, snapTime(d.t0start + delta, { ignorer: d.id }))) });
    else updateCaption(d.id, { end: Math.max(d.t0start + 0.2, snapTime(d.t0end + delta, { ignorer: d.id })) });
  }
  function endCaptionTrim(e: React.PointerEvent) {
    if (capTrimRef.current) { try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {} capTrimRef.current = null; }
  }
  // Déplacement d'une piste audio dans le temps + sélection (pour la déplacer/supprimer).
  const audDragRef = useRef<{ id: string; startX: number; t0: number; moved: boolean; alt: boolean } | null>(null);
  // Filet de sécurité : dès que le bouton de la souris est relâché (ou le geste annulé)
  // n'importe où, on solde TOUS les glissements en cours. Évite l'état « souris bloquée »
  // si un relâchement passe inaperçu (poignée démontée en plein drag, capture perdue…).
  useEffect(() => {
    const clearAll = () => {
      tsDragRef.current = null; dragOverlayRef.current = null; resizeOverlayRef.current = null;
      trimRef.current = null; ovTrimRef.current = null; tlDragRef.current = null;
      selDragRef.current = null; fadeDragRef.current = null; clipFadeRef.current = null;
      ovFadeRef.current = null; titleDragRef.current = null; titleTrimRef.current = null;
      audDragRef.current = null; capDragRef.current = null; capTrimRef.current = null;
      setTlGhost(null); setDragActive(false); setDropLane(null); setSelRect(null);
    };
    window.addEventListener("pointerup", clearAll);
    window.addEventListener("pointercancel", clearAll);
    return () => { window.removeEventListener("pointerup", clearAll); window.removeEventListener("pointercancel", clearAll); };
  }, []);
  function onAudioBarDown(e: React.PointerEvent, a: AudioTrack) {
    e.stopPropagation();
    if (lockedLanes.has(`a${a.track ?? 0}`)) return; // piste verrouillée
    if (e.shiftKey) { toggleMulti(a.id); return; }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    audDragRef.current = { id: a.id, startX: e.clientX, t0: a.offset, moved: false, alt: e.altKey };
    if (multiSel.size) setMultiSel(new Set());
    setSelectedAudioId(a.id); setSelectedClipId(null); setSelectedOverlayId(null); setAudioOnlyId(null); setTool("audio");
  }
  function onAudioBarMove(e: React.PointerEvent) {
    const d = audDragRef.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) < 4) return;
    /* ⌥ + glisser = dupliquer, comme sur les plans. Au premier mouvement on crée
       la copie et on lui passe le glissement : l'original reste où il était, et
       c'est le double qu'on voit suivre le curseur. */
    if (!d.moved && d.alt) {
      const src = audioTracksRef.current.find((a) => a.id === d.id);
      if (src) {
        const nid = crypto.randomUUID();
        setAudioTracks((prev) => [...prev, { ...src, id: nid }]);
        setSelectedAudioId(nid);
        d.id = nid;
      }
    }
    d.moved = true;
    // Changement de piste en direct, comme pour un plan ou un texte : sans retour
    // visuel pendant le geste, on ne sait pas où l'on va atterrir.
    const cible = pisteAudioCible(e.clientX, e.clientY, audioTrackCount);
    if (cible !== null && cible < audioTrackCount) {
      if (dropLane) setDropLane(null);
      const actuelle = audioTracksRef.current.find((a) => a.id === d.id)?.track ?? 0;
      if (cible !== actuelle) setAudioTracks((prev) => prev.map((a) => (a.id === d.id ? { ...a, track: cible } : a)));
    } else if (cible !== null) {
      if (dropLane !== "newaudio") setDropLane("newaudio");
    } else if (dropLane) {
      setDropLane(null);
    }
    const off = Math.max(0, snapTime(d.t0 + (e.clientX - d.startX) / pps, { ignorer: d.id }));
    setAudioTracks((prev) => prev.map((a) => (a.id === d.id ? { ...a, offset: off } : a)));
  }
  function onAudioBarUp(e: React.PointerEvent) {
    effacerAimant();
    const d = audDragRef.current; audDragRef.current = null;
    if (!d) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (!d.moved) return;
    const nouvelle = dropLane === "newaudio";
    setDropLane(null);
    const cible = nouvelle ? audioTrackCount : pisteAudioCible(e.clientX, e.clientY, audioTrackCount);
    setAudioTracks((prev) => {
      const moi = prev.find((x) => x.id === d.id);
      if (!moi) return prev;
      const track = cible ?? (moi.track ?? 0);
      const occupes = prev.filter((x) => x.id !== d.id && (x.track ?? 0) === track).map((x) => ({ a: x.offset, b: x.offset + x.dur }));
      const offset = creneauLibre(moi.offset, moi.dur, occupes);
      return prev.map((x) => (x.id === d.id ? { ...x, track, offset } : x));
    });
  }
  /* Rognage d'une piste audio par ses bords, comme un plan vidéo.

     Une piste audio ne pouvait que se déplacer : pour n'en garder qu'un morceau,
     il fallait la couper au curseur. On tire maintenant sur ses bords.

     Bord gauche : on avance le point d'entrée DANS la source (srcOffset) et on
     décale d'autant la piste sur la timeline (offset), pour que le son ne bouge
     pas d'un pouce pendant qu'on rogne. Bord droit : on raccourcit simplement. */
  const audTrimRef = useRef<{ id: string; edge: "start" | "end"; startX: number; offset: number; dur: number; srcOffset: number; srcDur: number } | null>(null);
  function startAudioTrim(e: React.PointerEvent, a: AudioTrack, edge: "start" | "end") {
    e.stopPropagation();
    if (lockedLanes.has(`a${a.track ?? 0}`)) return;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    setSelectedAudioId(a.id); setTool("audio");
    audTrimRef.current = {
      id: a.id, edge, startX: e.clientX,
      offset: a.offset, dur: a.dur, srcOffset: a.srcOffset ?? 0, srcDur: audioSrcDur(a),
    };
  }
  function onAudioTrimMove(e: React.PointerEvent) {
    const d = audTrimRef.current;
    if (!d) return;
    const dt = (e.clientX - d.startX) / pps;
    setAudioTracks((prev) => prev.map((a) => {
      if (a.id !== d.id) return a;
      if (d.edge === "start") {
        // On ne remonte pas avant le début du fichier, ni au delà de sa fin.
        const min = -d.srcOffset;
        const max = d.dur - 0.2;
        // Aimantation du bord, comme pour les plans et les textes.
        const vise = snapTime(d.offset + dt, { ignorer: d.id }) - d.offset;
        const delta = Math.max(min, Math.min(max, vise));
        return { ...a, offset: Math.max(0, d.offset + delta), srcOffset: d.srcOffset + delta, dur: d.dur - delta };
      }
      const restant = d.srcDur - d.srcOffset;   // ce qu'il reste de source après le point d'entrée
      const fin = snapTime(d.offset + d.dur + dt, { ignorer: d.id });
      return { ...a, dur: Math.max(0.2, Math.min(restant, fin - d.offset)) };
    }));
  }
  function endAudioTrim(e: React.PointerEvent) {
    if (audTrimRef.current) { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} audTrimRef.current = null; }
  }

  // ── Points-clés de volume (automation) sur une piste audio ──────────────────
  // Ajoute un point à la position du curseur (temps local dans la piste), avec la
  // valeur de volume courante à cet instant. Si un point existe déjà là, on l'écrase.
  function addVolKey(id: string) {
    setAudioTracks((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const local = Math.max(0, Math.min(a.dur, time - a.offset));
      const v = a.volKeys && a.volKeys.length ? audioVolumeAt({ ...a, fadeIn: 0, fadeOut: 0 }, local) : a.vol;
      const keys = [...(a.volKeys || [])];
      const at = keys.findIndex((k) => Math.abs(k.t - local) < 0.05);
      if (at >= 0) keys[at] = { t: local, v }; else keys.push({ t: local, v });
      keys.sort((x, y) => x.t - y.t);
      return { ...a, volKeys: keys };
    }));
  }
  function setVolKey(id: string, idx: number, v: number) {
    setAudioTracks((prev) => prev.map((a) => (a.id === id ? { ...a, volKeys: (a.volKeys || []).map((k, i) => (i === idx ? { ...k, v } : k)) } : a)));
  }
  function removeVolKey(id: string, idx: number) {
    setAudioTracks((prev) => prev.map((a) => (a.id === id ? { ...a, volKeys: (a.volKeys || []).filter((_, i) => i !== idx) } : a)));
  }

  // Isole la voix (canal central (L+R)/2 + passe-bande voix) ou la supprime (karaoké,
  // (L-R)/2). Best-effort DSP côté client — meilleur résultat sur un son stéréo.
  // Le résultat remplace la source de la piste (WAV encodé + uploadé).
  // ── Caler les coupes sur le rythme ──────────────────────────────────────────
  // Le prémontage décide OÙ couper (sur la parole, sur la qualité d'image) ; il ne
  // décide pas QUAND. Sur une vidéo posée sur une musique, des coupes à côté du
  // temps s'entendent immédiatement — c'est ce qui reste le plus « amateur » dans
  // un montage par ailleurs propre.
  //
  // La grille est mémorisée par piste : l'analyse ne dépend que du fichier, et
  // l'utilisateur relance volontiers le calage après avoir retouché ses plans.
  const beatCacheRef = useRef<Map<string, BeatMap | null>>(new Map());
  async function snapCutsToBeat(id: string) {
    if (beatSyncing) return;
    const track = audioTracks.find((a) => a.id === id);
    if (!track) return;
    if (clips.length < 2) { toast(t('toastBeatNeedsClips')); return; }

    setBeatSyncing(id);
    try {
      let map = beatCacheRef.current.get(track.src);
      if (map === undefined) {
        map = await detectBeats(track.src);
        beatCacheRef.current.set(track.src, map);
      }
      // Pas de pulsation exploitable (nappe, voix seule, ambiance) : on le dit
      // plutôt que de caler sur du bruit et de rendre un montage pire qu'avant.
      if (!map) { toast(t('toastBeatNotFound'), "error"); return; }

      const totalDur = clips.reduce((s, c) => s + Math.max(0, c.gapBefore ?? 0) + clipTimelineDur(c), 0);
      const grid = beatsOnTimeline(map, track, totalDur);
      const res = snapClipsToBeats(clips, grid);

      if (!res.moved) { toast(t('toastBeatAlreadyOn', { bpm: Math.round(map.bpm) })); return; }
      // setClips suffit : l'historique pose son point d'annulation tout seul.
      setClips(res.clips);
      toast(t('toastBeatDone', { n: res.moved, bpm: Math.round(map.bpm) }));
    } catch (e) {
      console.warn("[beatSync] calage impossible :", e);
      toast(t('toastBeatFailed'), "error");
    } finally {
      setBeatSyncing(null);
    }
  }

  async function isolateVoiceOnTrack(id: string, mode: "isolate" | "remove") {
    if (processingVoice) return;
    const track = audioTracks.find((a) => a.id === id);
    if (!track) return;
    setProcessingVoice(id);
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const actx = new AudioCtx();
      const buf = await actx.decodeAudioData(await (await fetch(track.src)).arrayBuffer());
      await actx.close();
      const sr = buf.sampleRate, n = buf.length;
      if (buf.numberOfChannels < 2 && mode === "remove") { toast(t('toastVoiceNeedsStereo')); return; }
      const L = buf.getChannelData(0);
      const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
      const mixed = new Float32Array(n);
      if (mode === "remove") for (let i = 0; i < n; i++) mixed[i] = (L[i] - R[i]) * 0.5;
      else for (let i = 0; i < n; i++) mixed[i] = (L[i] + R[i]) * 0.5;

      let processed = mixed;
      if (mode === "isolate") {
        // Passe-bande ~120 Hz–8 kHz pour dégager la voix.
        const off = new OfflineAudioContext(1, n, sr);
        const srcBuf = off.createBuffer(1, n, sr); srcBuf.copyToChannel(mixed, 0);
        const s = off.createBufferSource(); s.buffer = srcBuf;
        const hp = off.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 120;
        const lp = off.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 8000;
        s.connect(hp).connect(lp).connect(off.destination); s.start();
        processed = (await off.startRendering()).getChannelData(0);
      }

      const wav = encodeWavMono(processed, sr);
      const path = `${workspaceId}/${postId}-voice-${crypto.randomUUID()}.wav`;
      const { error } = await supabase.storage.from("audio").upload(path, wav, { upsert: true, contentType: "audio/wav" });
      if (error) { toast(t('toastVoiceProcessFailed')); return; }
      const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
      const tag = mode === "isolate" ? t('voiceIsolatedTag') : t('voiceRemovedTag');
      setAudioTracks((prev) => prev.map((a) => (a.id === id
        ? { ...a, src: urlData.publicUrl, name: a.name.startsWith(tag) ? a.name : `${tag} · ${a.name}`, waveform: peaksFromSamples(processed) }
        : a)));
      toast(mode === "isolate" ? t('toastVoiceIsolated') : t('toastVoiceRemoved'));
    } catch {
      toast(t('toastVoiceProcessFailed'));
    } finally {
      setProcessingVoice(null);
    }
  }
  async function toggleRecordVO() {
    if (isRecordingVO) { voRecorderRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      voChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) voChunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecordingVO(false);
        const blob = new Blob(voChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voix-off-${Date.now()}.webm`, { type: "audio/webm" });
        await importAudio(file, "voiceover");
      };
      voRecorderRef.current = rec;
      rec.start();
      setIsRecordingVO(true);
    } catch {
      toast(t('toastMicUnavailable'));
    }
  }

  // ── Incrustations (PIP : 2e piste vidéo/photo superposée) ───────────────────
  function addOverlayFiles() { overlayInputRef.current?.click(); }
  async function importOverlayFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("video/") || f.type.startsWith("image/"));
    if (!arr.length) return;
    setUploadingOverlay(true);
    try {
      for (const file of arr) {
        const isVideo = file.type.startsWith("video/");
        const bucket = isVideo ? "videos" : "photos";
        const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
        const path = `${workspaceId}/${postId}-ov-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
        if (error) continue;
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        const dur = isVideo ? await getVideoDuration(urlData.publicUrl) : PHOTO_DEFAULT_DUR;
        const id = crypto.randomUUID();
        setOverlays((prev) => [...prev, {
          id, kind: isVideo ? "video" : "photo", name: file.name, src: urlData.publicUrl,
          srcDur: isVideo ? dur : 15, trimStart: 0, trimEnd: dur, offset: time,
          ...newOverlayDefaults(),
        }]);
        setSelectedOverlayId(id);
      }
    } finally {
      setUploadingOverlay(false);
    }
  }
  function handleOverlayFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) importOverlayFiles(e.target.files);
    e.target.value = "";
  }
  function updateOverlay(id: string, patch: Partial<OverlayClip>) {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  // Superposition sur la même piste : le plan déplacé passe AU-DESSUS et rogne ceux qu'il
  // recouvre (pas de doublon), façon CapCut. S'il coupe un plan en son milieu, on le scinde.
  function resolveOverlayOverlaps(movedId: string) {
    setOverlays((prev) => {
      const moved = prev.find((o) => o.id === movedId);
      if (!moved) return prev;
      const mS = moved.offset, mE = moved.offset + overlayTimelineDur(moved), mT = moved.track ?? 0;
      const out: OverlayClip[] = [];
      for (const o of prev) {
        if (o.id === movedId || (o.track ?? 0) !== mT) { out.push(o); continue; }
        const oS = o.offset, oE = o.offset + overlayTimelineDur(o);
        if (oE <= mS + 0.02 || oS >= mE - 0.02) { out.push(o); continue; } // pas de chevauchement
        if (oS >= mS - 0.02 && oE <= mE + 0.02) continue; // entièrement recouvert → supprimé
        if (oS < mS && oE > mE) {
          // recouvert au milieu → scinde en deux (gauche gardée, droite recréée)
          out.push({ ...o, trimEnd: o.trimStart + (mS - oS) });
          out.push({ ...o, id: crypto.randomUUID(), offset: mE, trimStart: o.trimStart + (mE - oS) });
        } else if (oS < mS) {
          out.push({ ...o, trimEnd: o.trimStart + (mS - oS) }); // rogne la fin
        } else {
          out.push({ ...o, offset: mE, trimStart: o.trimStart + (mE - oS) }); // rogne le début
        }
      }
      return out;
    });
  }
  function removeOverlay(id: string) {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedOverlayId === id) setSelectedOverlayId(null);
  }
  function duplicateOverlay(id: string) {
    setOverlays((prev) => {
      const src = prev.find((o) => o.id === id);
      if (!src) return prev;
      // La copie se place juste APRÈS l'original (à la suite), pas par-dessus.
      const copy = { ...src, id: crypto.randomUUID(), offset: src.offset + overlayTimelineDur(src) };
      return [...prev, copy];
    });
  }
  function selectOverlay(id: string) {
    setSelectedOverlayId(id);
    setSelectedClipId(null); setSelectedTitleId(null); setSelectedStickerId(null); setSubSelected(false); setSelectedAudioId(null);
    setTool("overlay");
    const o = overlays.find((x) => x.id === id);
    if (o) seek(o.offset + 0.05);
  }

  /* Piste d'incrustation : garde les <video> superposées synchronisées avec le
     playhead.

     Cette synchronisation ne passe plus par un effet dépendant de `time`. Un tel
     effet se rejouait à CHAQUE image de lecture, et rien qu'y entrer coûtait un
     `overlays.find` par incrustation. C'est désormais une simple fonction,
     appelée par la boucle de lecture (qui tourne de toute façon) et, à l'arrêt,
     quand le curseur bouge. */
  const syncOverlaysRef = useRef<(t: number) => void>(() => {});
  syncOverlaysRef.current = (t: number) => {
    overlayVideoRefs.current.forEach((v, id) => {
      const o = overlays.find((x) => x.id === id);
      if (!o || o.kind !== "video") return;
      const isActive = t >= o.offset && t < o.offset + overlayTimelineDur(o);
      if (!isActive) { if (!v.paused) v.pause(); return; }
      const g = overlayAudioGainAt(o, t - o.offset);
      v.volume = mutedLanesRef.current.has(`v${o.track ?? 0}`) ? 0 : (isFinite(g) ? Math.max(0, Math.min(1, g)) : 0);
      const localTime = o.trimStart + (t - o.offset);
      if (Math.abs(v.currentTime - localTime) > 0.4) v.currentTime = Math.max(0, localTime);
      if (playingRef.current) v.play().catch(() => {}); else if (!v.paused) v.pause();
    });
  };
  useEffect(() => { if (!playing) syncOverlaysRef.current(time); }, [time, playing, overlays, mutedLanes]);

  // ── Overlays de scène (drag titres/stickers/sous-titres) ────────────────────
  function onOverlayPointerDown(e: React.PointerEvent, type: "title" | "sticker" | "caption" | "overlay", id: string) {
    e.stopPropagation();
    e.preventDefault(); // empêche le drag natif de l'image/vidéo qui « avale » le relâchement
    let groupeIds: string[] = [];
    if (type === "title") {
      setSubSelected(false); setSelectedOverlayId(null);
      if (e.shiftKey) {
        /* ⇧ + clic : on ajoute ou on RETIRE du groupe.

           Retirer doit vraiment retirer : une première version rajoutait le titre
           juste après l'avoir enlevé, pour être sûre qu'il soit le principal, si
           bien qu'on ne pouvait jamais en sortir un. Quand on retire, le titre
           principal passe à un autre membre — ce ne peut pas être celui qu'on
           vient d'exclure — et on ne démarre aucun déplacement : le geste était
           une désélection, pas une prise. */
        const n = new Set(titresSel);
        if (n.has(id) && n.size > 1) {
          n.delete(id);
          setTitresSel(n);
          setSelectedTitleId(Array.from(n)[0] ?? null);
          return;
        }
        n.add(id);
        setTitresSel(n);
        setSelectedTitleId(id);
        groupeIds = Array.from(n);
      } else {
        setSelectedTitleId(id);
        // Clic simple sur un membre du groupe : on garde le groupe, c'est lui
        // qu'on s'apprête à déplacer. Sur un titre hors groupe, on repart de lui.
        groupeIds = titresSel.has(id) ? Array.from(titresSel) : [id];
        if (!titresSel.has(id)) setTitresSel(new Set([id]));
      }
    }
    else if (type === "sticker") { setSelectedStickerId(id); setSubSelected(false); setSelectedOverlayId(null); }
    else if (type === "overlay") { setSelectedOverlayId(id); setSubSelected(false); setSelectedTitleId(null); setSelectedStickerId(null); setTool("overlay"); }
    else setSubSelected(true);
    const laneKey = type === "title" ? `t${titles.find((x) => x.id === id)?.track ?? 0}` : type === "caption" ? "subs" : type === "overlay" ? `v${overlays.find((x) => x.id === id)?.track ?? 0}` : "";
    if (laneKey && lockedLanes.has(laneKey)) return; // piste verrouillée : sélection ok, déplacement bloqué
    // position actuelle (centre) de l'élément en % — pour garder le point de préhension
    const cur = type === "caption" ? (perCap && editingCaption ? capPosOf(editingCaption) : subPos)
      : type === "title" ? titles.find((x) => x.id === id)
      : type === "overlay" ? overlays.find((x) => x.id === id)
      : stickers.find((x) => x.id === id);
    const r = stageRef.current?.getBoundingClientRect();
    let offX = 0, offY = 0;
    if (cur && r) { offX = cur.x - ((e.clientX - r.left) / r.width) * 100; offY = cur.y - ((e.clientY - r.top) / r.height) * 100; }
    /* Positions de départ de TOUT le groupe : on déplacera chacun du même écart,
       pas vers la même position — sans quoi ils se superposeraient tous sur le
       point saisi. */
    const groupe = type === "title" && groupeIds.length > 1
      ? titles.filter((x) => groupeIds.includes(x.id)).map((x) => ({ id: x.id, x: x.x, y: x.y }))
      : [];
    dragOverlayRef.current = { type, id, startX: e.clientX, startY: e.clientY, offX, offY, moved: false,
      groupe, x0: (cur as { x?: number } | undefined)?.x ?? 0, y0: (cur as { y?: number } | undefined)?.y ?? 0 };
    // capture sur la scène : les pointermove/up reviennent toujours ici, même hors cadre → plus de « suivi fantôme »
    try { stageRef.current?.setPointerCapture(e.pointerId); } catch {}
  }
  function onOverlayResizeDown(e: React.PointerEvent, type: "title" | "sticker" | "caption" | "overlay", id: string, currentScale: number) {
    e.stopPropagation();
    e.preventDefault();
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    // centre de l'overlay = position (x,y) en % de la scène (les overlays sont centrés dessus)
    const pos = type === "caption" ? (perCap && editingCaption ? capPosOf(editingCaption) : subPos)
      : type === "title" ? titles.find((t) => t.id === id)
      : type === "overlay" ? overlays.find((o) => o.id === id)
      : stickers.find((s) => s.id === id);
    if (!pos) return;
    const cx = r.left + (pos.x / 100) * r.width;
    const cy = r.top + (pos.y / 100) * r.height;
    const startDist = Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy));
    resizeOverlayRef.current = { type, id, startDist, startScale: currentScale, cx, cy };
    if (type === "title") setSelectedTitleId(id); else if (type === "sticker") setSelectedStickerId(id); else if (type === "overlay") setSelectedOverlayId(id); else setSubSelected(true);
  }
  function onStagePointerMove(e: React.PointerEvent) {
    const rz = resizeOverlayRef.current;
    if (rz) {
      const dist = Math.hypot(e.clientX - rz.cx, e.clientY - rz.cy);
      const scale = Math.max(0.05, rz.startScale * (dist / rz.startDist)); // aucune limite haute
      if (rz.type === "title") updateTitle(rz.id, { scale });
      else if (rz.type === "sticker") updateSticker(rz.id, { scale });
      else if (rz.type === "overlay") updateOverlay(rz.id, { scale });
      else patchSubCustom({ scale });
      return;
    }
    const drag = dragOverlayRef.current;
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 3) return; // seuil : simple clic ≠ déplacement
    drag.moved = true;
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100 + drag.offX));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100 + drag.offY));
    if (drag.type === "title" && drag.groupe.length > 1) {
      // Déplacement d'un bloc : le même écart pour tous.
      const dx = x - drag.x0, dy = y - drag.y0;
      setTitles((prev) => prev.map((ti) => {
        const dep = drag.groupe.find((g) => g.id === ti.id);
        return dep ? { ...ti, x: Math.max(0, Math.min(100, dep.x + dx)), y: Math.max(0, Math.min(100, dep.y + dy)) } : ti;
      }));
    }
    else if (drag.type === "title") updateTitle(drag.id, { x, y });
    else if (drag.type === "sticker") updateSticker(drag.id, { x, y });
    else if (drag.type === "overlay") updateOverlay(drag.id, { x, y });
    else if (perCap && editingCaption) updateCaption(editingCaption.id, { x, y }); // sous-titre délié : position propre
    else setSubPos({ x, y });
  }
  function onStagePointerUp(e?: React.PointerEvent) {
    if (e) { try { stageRef.current?.releasePointerCapture(e.pointerId); } catch {} }
    dragOverlayRef.current = null; resizeOverlayRef.current = null;
  }

  // ── Export réel ──────────────────────────────────────────────────────────
  // publish=true : marque le post « validé » et redirige vers le planning (comme le
  // bouton « Publier » de l'éditeur visuel). publish=false : produit juste le fichier.
  async function handleExport(publish = false) {
    if (!clips.length || exporting) return;
    setExporting(true);
    setExportPhase("render");
    setExportProgress(0);
    try {
      // Applique masquer/couper (pistes) à l'export : on retire le contenu masqué et on
      // coupe le son des pistes muettes AVANT le rendu (sans toucher au moteur d'export).
      const HL = hiddenLanes, ML = mutedLanes;
      const exClips = clips.map((c) => ML.has("video") ? { ...c, vol: 0 } : c); // (masquer la piste principale n'est pas appliqué à l'export)
      const exOverlays = overlays.filter((o) => !HL.has(`v${o.track ?? 0}`)).map((o) => ML.has(`v${o.track ?? 0}`) ? { ...o, vol: 0 } : o);
      const exAudio = audioTracks.filter((a) => !HL.has(`a${a.track ?? 0}`)).map((a) => ML.has(`a${a.track ?? 0}`) ? { ...a, vol: 0 } : a);
      const exTitles = titles.filter((ti) => !HL.has(`t${ti.track ?? 0}`));
      const exCaptions = HL.has("subs") ? [] : captions;
      const { blob: rawBlob, thumbnailBlob, mimeType: recordedType } = await renderExport({ clips: exClips, overlays: exOverlays, captions: exCaptions, subStyleId, subCustom, subPos, linkedSubs, titles: exTitles, stickers, audioTracks: exAudio, showProgressBar, formatId, customW, customH, exportQuality }, (p) => setExportProgress(p));

      // Instagram veut du MP4/H.264. Safari sait l'enregistrer directement : dans
      // ce cas il n'y a rien à transcoder, et on évite ffmpeg.wasm — qui, en
      // mono-thread, mettait plusieurs minutes sur une vidéo de quinze secondes
      // et donnait l'impression d'un export bloqué.
      let blob: Blob = rawBlob;
      let ext = "webm";
      let contentType = recordedType || "video/webm";

      if (recordedType.includes("mp4")) {
        ext = "mp4";
        contentType = "video/mp4";
      } else {
        setExportPhase("transcode");
        setExportProgress(0);
        try {
          blob = await transcodeToMp4(rawBlob, (p) => setExportProgress(p));
          ext = "mp4";
          contentType = "video/mp4";
        } catch (e) {
          // Le repli .webm existait déjà, mais il n'était jamais atteint : sans
          // délai maximum, un transcodage qui n'avançait plus tournait
          // indéfiniment au lieu d'échouer.
          console.warn("[montage] transcodage MP4 abandonné, export conservé tel quel :", e);
          blob = rawBlob;
        }
      }

      /* Téléchargement sur la machine.

         « Exporter » ne faisait qu'envoyer le fichier sur le stockage et
         proposer un lien « Voir l'export » : on ne pouvait pas récupérer la
         vidéo pour la regarder ailleurs, ni vérifier hors de KLIP si le
         problème venait du fichier ou du lecteur. On la télécharge donc, et
         avant l'envoi : si le stockage échoue, la vidéo est déjà sur le disque
         plutôt que perdue avec l'onglet.

         Le lien est construit sur le blob local, il n'y a rien à retélécharger. */
      if (!publish) {
        try {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `klip-${projectName || postId}-${new Date().toISOString().slice(0, 10)}.${ext}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
        } catch (e) {
          console.warn("[montage] téléchargement local impossible :", e);
        }
      }

      const path = `${workspaceId}/${postId}-export-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("videos").upload(path, blob, { upsert: true, contentType });
      if (error) { toast(t('toastExportUploadFailed', { msg: error.message })); return; }
      const { data: urlData } = supabase.storage.from("videos").getPublicUrl(path);
      setExportUrl(urlData.publicUrl);

      let thumbUrl: string | null = null;
      if (thumbnailBlob) {
        const thumbPath = `${workspaceId}/${postId}-thumb-${Date.now()}.jpg`;
        const { error: thumbErr } = await supabase.storage.from("videos").upload(thumbPath, thumbnailBlob, { upsert: true, contentType: "image/jpeg" });
        if (!thumbErr) thumbUrl = supabase.storage.from("videos").getPublicUrl(thumbPath).data.publicUrl;
      }

      await supabase.from("posts").update({
        montage_json: { clips, overlays, captions, subStyleId, subMaxWords, subPos, subCustom, linkedSubs, rawSegments, rawWords, titles, stickers, audioTracks, showProgressBar, exportUrl: urlData.publicUrl, formatId, customW, customH, exportQuality },
        photo_url: urlData.publicUrl,
        ...(thumbUrl ? { thumbnail_url: thumbUrl } : {}),
        ...(publish ? { status: "validated" } : {}),
      }).eq("id", postId);
      toast(publish ? t('toastPublished') : t('toastExportDone'));
      if (publish) {
        // Comme l'éditeur visuel : on file vers le planning pour programmer la publication.
        window.location.href = `/workspace/${workspaceId}/planning?post=${postId}`;
      }
    } catch (e) {
      toast(t('toastExportError', { msg: e instanceof Error ? e.message : t('toastUnknownError') }));
    } finally {
      setExporting(false);
    }
  }

  // ── Raccourcis clavier (type CapCut) ────────────────────────────────────────
  function deleteSelected() {
    // La transition d'abord : c'est le dernier objet sélectionné qui compte, et
    // elle vit sur un plan qu'on ne veut surtout pas supprimer avec elle.
    if (selectedTransId) {
      updateClip(selectedTransId, { transitionIn: "cut" });
      setSelectedTransId(null);
      return;
    }
    if (multiSel.size > 0) {
      const ids = multiSel;
      setClips((prev) => prev.filter((c) => !ids.has(c.id)));
      setOverlays((prev) => prev.filter((o) => !ids.has(o.id)));
      setAudioTracks((prev) => prev.filter((a) => !ids.has(a.id)));
      // Les sous-titres entrent maintenant dans la sélection au lasso : sans
      // cette ligne, en supprimer un lot n'effaçait rien.
      setCaptions((prev) => prev.filter((c) => !ids.has(c.id)));
      setMultiSel(new Set());
      setSelectedClipId(null); setSelectedOverlayId(null); setSelectedAudioId(null); setSelectedCaptionId(null);
      return;
    }
    if (selectedAudioId) { removeAudioTrack(selectedAudioId); setSelectedAudioId(null); return; }
    if (selectedOverlayId) { removeOverlay(selectedOverlayId); return; }
    if (titresSel.size > 1) { const ids = titresSel; setTitles((prev) => prev.filter((x) => !ids.has(x.id))); setTitresSel(new Set()); setSelectedTitleId(null); return; }
    if (selectedTitleId) { removeTitle(selectedTitleId); return; }
    if (selectedCaptionId) { removeCaption(selectedCaptionId); return; }
    if (selectedStickerId) { removeSticker(selectedStickerId); return; }
    if (selectedClipId) removeClip(selectedClipId);
  }
  // Tout désélectionner (clic dans le vide).
  function deselectAll() {
    setSelectedClipId(null); setSelectedOverlayId(null); setSelectedAudioId(null);
    setSelectedTitleId(null); setTitresSel(new Set()); setSelectedStickerId(null); setSubSelected(false);
    setSelectedCaptionId(null); setEditingCaptionId(null); setSelectedTransId(null);
    setAudioOnlyId(null); if (multiSel.size) setMultiSel(new Set());
  }
  // Bascule un élément dans la sélection multiple (⇧+clic).
  function toggleMulti(id: string) {
    setMultiSel((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    setSelectedClipId(null); setSelectedOverlayId(null); setSelectedAudioId(null);
  }
  function copySelected() {
    if (selectedOverlayId) {
      const o = overlays.find((x) => x.id === selectedOverlayId);
      if (o) { clipboardRef.current = { type: "overlay", data: o }; toast(t('toastOverlayCopied')); }
      return;
    }
    if (selectedClipId) {
      const c = clips.find((x) => x.id === selectedClipId);
      if (c) { clipboardRef.current = { type: "clip", data: c }; toast(t('toastClipCopied')); }
    }
  }
  function pasteClipboard() {
    const cb = clipboardRef.current;
    if (!cb) return;
    if (cb.type === "overlay") {
      const id = crypto.randomUUID();
      const copy = { ...cb.data, id, offset: time, x: Math.min(100, cb.data.x + 4), y: Math.min(100, cb.data.y + 4) };
      setOverlays((prev) => [...prev, copy]);
      setSelectedOverlayId(id); setTool("overlay");
    } else {
      const id = crypto.randomUUID();
      const copy = { ...cb.data, id };
      setClips((prev) => {
        const idx = selectedClipId ? prev.findIndex((c) => c.id === selectedClipId) : prev.length - 1;
        const out = [...prev]; out.splice(idx + 1, 0, copy); return out;
      });
      setSelectedClipId(id);
    }
  }
  function duplicateSelectedAny() {
    if (selectedOverlayId) { duplicateOverlay(selectedOverlayId); return; }
    if (selectedClipId) duplicateClip(selectedClipId);
  }
  /* L'OUTIL EN MAIN, PLUTÔT QU'UN BOUTON À CHAQUE COUPE.
     Découper demandait de sélectionner l'élément PUIS de cliquer sur « Diviser » :
     deux gestes par coupe, et autant d'allers-retours vers la barre d'outils.
     Comme dans Premiere ou Resolve, la lame se prend une fois (C) et coupe
     ensuite là où l'on clique, sur n'importe quel élément. V rend la main. */
  const [outilLame, setOutilLame] = useState(false);
  /** Instant survolé avec la lame : on montre OÙ la coupe tombera avant de
   *  cliquer. Sans ce trait, on coupe à l'aveugle et on annule une fois sur
   *  deux. `null` dès qu'on quitte un élément découpable. */
  const [apercuCoupe, setApercuCoupe] = useState<number | null>(null);
  const [marqueAimant, setMarqueAimant] = useState<number | null>(null);
  const marqueAimantRef = useRef<number | null>(null);
  /** À la fin d'un geste, le repère d'aimantation n'a plus lieu d'être. */
  const effacerAimant = useCallback(() => {
    if (marqueAimantRef.current !== null) { marqueAimantRef.current = null; setMarqueAimant(null); }
  }, []);

  /** Découpe l'élément cliqué à l'endroit exact du clic.
   *
   *  FONCTION ORDINAIRE, PAS UN `useCallback`. Mémorisée avec une liste de
   *  dépendances vide, elle gardait le `splitAtPlayhead` du tout PREMIER rendu —
   *  donc une timeline encore vide : la recherche de l'élément échouait à chaque
   *  fois et le clic ne coupait rien, alors que le viseur, lui, s'affichait
   *  correctement. Recréée à chaque rendu, elle voit l'état courant. */
  const couperAuClic = ((e: React.PointerEvent) => {
    const cible = (e.target as HTMLElement).closest<HTMLElement>("[data-lame]");
    const rect = tlInnerRef.current?.getBoundingClientRect();
    if (!cible || !rect) return;
    const [kind, ...reste] = (cible.dataset.lame ?? "").split(":");
    const id = reste.join(":");
    if (!kind || !id) return;
    const t = (e.clientX - rect.left - LANE_LABEL_W) / sceneRef.current.pps;
    if (!Number.isFinite(t) || t < 0) return;
    splitAtPlayhead(t, { kind, id });
  });

  /* NIVEAU AUDIO À LA SOURIS, sur la piste elle-même.
     Régler le volume obligeait à passer par le panneau latéral. Comme dans
     Premiere, une ligne traverse la piste à la hauteur du niveau : on la tire
     vers le haut ou vers le bas et on entend le résultat tout de suite.
     L'échelle va de 0 à 2 — au-delà de 1, c'est du gain, appliqué à l'export
     (la lecture est bornée à 1 par le navigateur). */
  const NIVEAU_MAX = 2;
  const niveauDragRef = useRef<{ id: string; startY: number; v0: number; h: number } | null>(null);

  function onNiveauDown(e: React.PointerEvent, a: { id: string; vol: number }, hauteur: number) {
    e.stopPropagation();
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
    niveauDragRef.current = { id: a.id, startY: e.clientY, v0: a.vol ?? 1, h: Math.max(1, hauteur) };
  }
  function onNiveauMove(e: React.PointerEvent) {
    const d = niveauDragRef.current;
    if (!d) return;
    // Tirer vers le HAUT augmente : l'écran descend en Y, le niveau monte.
    const v = d.v0 + ((d.startY - e.clientY) / d.h) * NIVEAU_MAX;
    setAudioTracks((prev) => prev.map((x) => (x.id === d.id ? { ...x, vol: Math.max(0, Math.min(NIVEAU_MAX, v)) } : x)));
  }
  function onNiveauUp(e: React.PointerEvent) {
    if (!niveauDragRef.current) return;
    niveauDragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    // L'historique se prend tout seul sur changement d'état (cf. historyRef).
  }

  const FRAME = 1 / 30;
  /* Raccourcis clavier.

     L'écouteur était (dés)inscrit à chaque changement de sa liste de dépendances,
     `time` compris : pendant la lecture, cela faisait un removeEventListener et un
     addEventListener SOIXANTE FOIS PAR SECONDE, pour reposer exactement le même
     raccourci. On garde donc le gestionnaire à jour dans une référence et on
     n'inscrit qu'un seul écouteur, une seule fois. */
  function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      const meta = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      /* Annuler / rétablir passent AVANT le garde-fou de saisie. Après avoir
         bougé un curseur ou coché une case du panneau, le focus reste sur ce
         champ : ⌘Z n'arrivait alors jamais jusqu'ici, alors que c'est
         précisément l'instant où l'on veut annuler. Seuls les champs où l'on
         tape gardent leur annulation native (cf. isTextEntry). */
      if (meta && (k === "z" || k === "y")) {
        if (isTextEntry(el)) return;
        e.preventDefault();
        if (k === "y" || e.shiftKey) redo(); else undo();
        return;
      }
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      if (meta && k === "c") { e.preventDefault(); copySelected(); return; }
      if (meta && k === "x") { e.preventDefault(); copySelected(); deleteSelected(); return; }
      if (meta && k === "v") { e.preventDefault(); pasteClipboard(); return; }
      if (meta && k === "d") { e.preventDefault(); duplicateSelectedAny(); return; }
      if (meta && k === "b") { e.preventDefault(); splitAtPlayhead(); return; }
      if (meta && (k === "=" || k === "+")) { e.preventDefault(); setPps((p) => Math.min(160, Math.round(p * 1.3))); return; }
      if (meta && k === "-") { e.preventDefault(); setPps((p) => Math.max(10, Math.round(p / 1.3))); return; }
      if (meta) return; // laisse passer les autres raccourcis système
      if (e.altKey && e.shiftKey && k === "s") { e.preventDefault(); if (selectedOverlayId) detachOverlayAudio(selectedOverlayId); else if (selectedClipId) detachAudio(selectedClipId); return; } // ⇧⌥S : extraire le son (CapCut)
      if (e.altKey) return; // autres combos Option laissées au système
      // C prend la lame, V rend la main — les touches de Premiere et Resolve.
      if (k === "c") { e.preventDefault(); setOutilLame(true); return; }
      if (k === "v") { e.preventDefault(); setOutilLame(false); setApercuCoupe(null); return; }
      if (e.key === "Escape" && outilLame) { e.preventDefault(); setOutilLame(false); return; }
      if (e.key === " ") { e.preventDefault(); togglePlay(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); return; }
      if (k === "s") { e.preventDefault(); splitAtPlayhead(); return; }
      if (k === "j") { e.preventDefault(); seek(time - 1); return; }
      if (k === "k") { e.preventDefault(); setPlaying(false); return; }
      if (k === "l") { e.preventDefault(); seek(time + 1); return; }
      if (e.key === "Home") { e.preventDefault(); seek(0); return; }
      if (e.key === "End") { e.preventDefault(); seek(total); return; }
      if (e.key === ",") { e.preventDefault(); seek(time - FRAME); return; }
      if (e.key === ".") { e.preventDefault(); seek(time + FRAME); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); seek(time - (e.shiftKey ? 1 : 0.1)); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); seek(time + (e.shiftKey ? 1 : 0.1)); return; }
  }
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey; // une affectation par rendu, au lieu de deux appels au DOM
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ── Trim (poignées) & scrub sur la règle ────────────────────────────────────
  function startTrim(e: React.PointerEvent, c: (typeof clipStarts)[number], edge: "start" | "end") {
    e.stopPropagation();
    e.preventDefault();
    setSelectedClipId(c.id);
    if (lockedLanes.has("video")) return; // piste verrouillée
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    trimRef.current = { id: c.id, edge, startX: e.clientX, t0start: c.trimStart, t0end: c.trimEnd, kind: c.kind, srcDur: c.srcDur, speed: c.speed, t0gap: Math.max(0, c.gapBefore ?? 0), t0tlStart: c.start, t0tlEnd: c.end };
  }
  function onTrimMove(e: React.PointerEvent) {
    const d = trimRef.current;
    if (!d) return;
    const vitesse = d.kind === "video" ? d.speed : 1;
    /* Aimantation du bord rogné.

       Elle raisonne sur la TIMELINE, pas dans le référentiel de la source : c'est
       là que se trouvent les repères qu'on vise (la fin d'une musique, le début
       d'un titre). On aimante donc la position d'arrivée du bord sur la timeline,
       puis on reconvertit en secondes de source, la vitesse du plan comprise.
       Le rognage d'un plan ne s'aimante pas aux autres plans : la piste est
       enchaînée, ils se décalent tous ensemble et leurs bords ne sont pas des
       repères. */
    const deltaTl = (e.clientX - d.startX) / pps;
    const bordVise = d.edge === "start" ? d.t0tlStart + deltaTl : d.t0tlEnd + deltaTl;
    const deltaSrc = (snapTime(bordVise, { ignorerPlans: true }) - (d.edge === "start" ? d.t0tlStart : d.t0tlEnd)) * vitesse;
    if (d.edge === "start") {
      // Rogner/étirer le DÉBUT : le bord gauche bouge et le bord droit reste en place
      // (on décale gapBefore en conséquence) — comme les incrustations et CapCut.
      const ns = Math.max(0, Math.min(d.t0end - 0.3, d.t0start + deltaSrc));
      const dtl = (ns - d.t0start) / vitesse;
      updateClip(d.id, { trimStart: ns, gapBefore: Math.max(0, d.t0gap + dtl) });
    } else {
      // Plafond = longueur réelle de la source (vidéo) — on ne peut jamais étirer un plan
      // au-delà de son métrage. Garde-fou si srcDur est corrompu (Infinity/NaN) : on
      // interdit toute extension au lieu de laisser étirer à l'infini.
      const cap = d.kind === "video" ? (isFinite(d.srcDur) && d.srcDur > 0 ? d.srcDur : d.t0end) : 15;
      const ne = Math.max(d.t0start + 0.3, Math.min(cap, d.t0end + deltaSrc));
      updateClip(d.id, { trimEnd: ne });
    }
  }
  function endTrim(e: React.PointerEvent) {
    if (trimRef.current) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      trimRef.current = null;
    }
  }
  function rulerSeek(clientX: number) {
    const r = rulerRef.current?.getBoundingClientRect();
    if (!r) return;
    seek(Math.max(0, (clientX - r.left) / pps));
  }
  function onRulerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrubbingRulerRef.current = true;
    rulerSeek(e.clientX);
  }
  function onRulerMove(e: React.PointerEvent) {
    if (scrubbingRulerRef.current) rulerSeek(e.clientX);
  }
  function onRulerUp(e: React.PointerEvent) {
    scrubbingRulerRef.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }

  // Molette verticale simple (sans Ctrl/⌘) sur la timeline → défilement horizontal.
  // Le ZOOM (avec Ctrl/⌘/pincement) est géré par l'unique listener global plus haut.
  useEffect(() => {
    const scroller = tlScrollRef.current;
    if (!scroller) return;
    const onWheelNative = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return; // zoom : géré globalement
      // Si les pistes débordent en hauteur, on laisse le défilement vertical naturel ;
      // sinon la molette verticale fait défiler horizontalement (timeline large).
      if (scroller.scrollHeight > scroller.clientHeight + 1) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) scroller.scrollLeft += e.deltaY;
    };
    scroller.addEventListener("wheel", onWheelNative, { passive: true });
    return () => scroller.removeEventListener("wheel", onWheelNative);
  }, [loading]);

  // Aimantation (magnétisme) : cale une valeur temporelle sur le playhead, les bords
  // de plans et les extrémités du projet quand on est à ≤ 8 px.
  /* Aimantation.

     Elle ne visait que le curseur, les bornes du projet et les bords des PLANS.
     On ne pouvait donc pas caler un texte sur la fin d'une musique, ni deux
     titres l'un sur l'autre : les repères les plus utiles manquaient. Tous les
     bords comptent maintenant, quel que soit le type d'objet.

     Deux exclusions, sans lesquelles l'aimantation se retourne contre l'objet
     qu'on déplace :

     `ignorer` retire les bords de l'objet lui-même. Ils font partie des cibles
     et suivent le geste : à chaque image, le bord se retrouvait à moins de huit
     pixels de sa propre position d'avant, donc il s'y recollait. Il fallait un
     coup sec de plus de huit pixels pour le décoller, ce qui donnait cette
     impression d'objet « bridé », impossible à poser où l'on veut.

     `ignorerPlans` retire les bords des plans quand c'est justement un plan
     qu'on rogne. La piste principale est enchaînée : rogner un plan décale tous
     les suivants, leurs bords bougent en même temps, et s'y aimanter n'a aucun
     sens. Les autres pistes, elles, restent des repères utiles. */
  /** Instant sur lequel l'aimant vient d'accrocher, pour le tracer à l'écran. */
  function snapTime(t: number, opts?: { ignorer?: string; ignorerPlans?: boolean }): number {
    const hors = opts?.ignorer;
    const targets: number[] = [0, total, time];
    if (!opts?.ignorerPlans) {
      for (const c of clipStarts) if (c.id !== hors) targets.push(c.start, c.end);
    }
    for (const o of overlays) if (o.id !== hors) targets.push(o.offset, o.offset + overlayTimelineDur(o));
    for (const a of audioTracks) if (a.id !== hors) targets.push(a.offset, a.offset + a.dur);
    for (const ti of titles) if (ti.id !== hors) targets.push(ti.start, ti.end);
    for (const c of captions) if (c.id !== hors) targets.push(c.start, c.end);
    for (const k of stickers) if (k.id !== hors) targets.push(k.start, k.end);
    const thresh = 8 / pps;
    let best = t, bestD = thresh;
    let accroche = false;
    for (const tg of targets) { const d = Math.abs(tg - t); if (d < bestD) { bestD = d; best = tg; accroche = true; } }
    // L'aimant agissait en silence : les bords se collaient bien, mais rien ne
    // disait SUR QUOI, ni même qu'il s'était passé quelque chose. On garde donc
    // l'instant accroché pour tracer un repère le temps du geste.
    const marque = accroche ? best : null;
    if (marqueAimantRef.current !== marque) {
      marqueAimantRef.current = marque;
      setMarqueAimant(marque);
    }
    return best;
  }

  /* Supprimer une rangée ajoutée.

     On n'enlève qu'une rangée VIDE : effacer une piste emporterait son contenu
     avec elle, et ce n'est jamais ce qu'on veut d'un clic sur une croix. Les
     rangées au-dessus redescendent d'un cran pour qu'il ne reste pas de trou. */
  function pisteVide(genre: "v" | "a" | "t", index: number): boolean {
    if (genre === "v") return !overlays.some((o) => (o.track ?? 0) === index);
    if (genre === "a") return !audioTracks.some((a) => (a.track ?? 0) === index);
    return !titles.some((ti) => (ti.track ?? 0) === index);
  }
  function supprimerPiste(genre: "v" | "a" | "t", index: number) {
    if (!pisteVide(genre, index)) { toast(t('toastLaneNotEmpty')); return; }
    const descendre = <T extends { track?: number }>(x: T): T =>
      (x.track ?? 0) > index ? { ...x, track: (x.track ?? 0) - 1 } : x;
    if (genre === "v") { setOverlays((prev) => prev.map(descendre)); setExtraVideoTracks((n) => Math.max(0, n - 1)); }
    else if (genre === "a") { setAudioTracks((prev) => prev.map(descendre)); setExtraAudioTracks((n) => Math.max(0, n - 1)); }
    else { setTitles((prev) => prev.map(descendre)); setExtraTextTracks((n) => Math.max(0, n - 1)); }
    // Les réglages de hauteur/visibilité suivent le décalage : sinon la rangée
    // qui remonte hériterait des réglages de celle qu'on vient d'enlever.
    const decalerCles = (set: React.Dispatch<React.SetStateAction<Set<string>>>) =>
      set((prev) => {
        const n = new Set<string>();
        prev.forEach((k) => {
          const m = new RegExp(`^${genre}(\\d+)$`).exec(k);
          if (!m) { n.add(k); return; }
          const i = parseInt(m[1], 10);
          if (i === index) return;
          n.add(i > index ? `${genre}${i - 1}` : k);
        });
        return n;
      });
    decalerCles(setHiddenLanes); decalerCles(setLockedLanes); decalerCles(setMutedLanes);
  }

  /** Bouton « ajouter une rangée », même gabarit que la croix. */
  function LaneAdd({ onClick, title: titre }: { onClick: () => void; title: string }) {
    return (
      <button onClick={onClick} title={titre}
        style={{ width: 16, height: 16, borderRadius: 5, border: "1px solid var(--line)", background: "var(--canvas)",
          color: "var(--ink-2)", fontSize: 12, lineHeight: "12px", cursor: "pointer", flexShrink: 0, padding: 0 }}>+</button>
    );
  }

  /** Petit bouton « supprimer cette rangée », posé dans l'étiquette de piste. */
  function LaneDelete({ genre, index }: { genre: "v" | "a" | "t"; index: number }) {
    const vide = pisteVide(genre, index);
    return (
      <button onClick={() => supprimerPiste(genre, index)} title={vide ? t('removeLane') : t('removeLaneBlocked')}
        style={{ width: 16, height: 16, borderRadius: 5, border: "1px solid var(--line)", background: "var(--canvas)",
          color: vide ? "var(--ink-2)" : "var(--ink-3)", opacity: vide ? 1 : 0.4, fontSize: 12, lineHeight: "12px",
          cursor: vide ? "pointer" : "not-allowed", flexShrink: 0, padding: 0 }}>×</button>
    );
  }

  // Déplace une incrustation d'une piste vers le haut/bas (z-order). Bornée aux pistes visibles.
  function moveOverlayTrack(id: string, dir: 1 | -1) {
    const o = overlays.find((ov) => ov.id === id);
    if (!o) return;
    const next = Math.max(0, Math.min(videoTrackCount - 1, (o.track ?? 0) + dir));
    updateOverlay(id, { track: next });
  }
  // Déplace une piste audio d'une rangée vers le haut/bas (organisation ; le mixage est inchangé).
  function moveAudioTrackRow(id: string, dir: 1 | -1) {
    const a = audioTracks.find((tr) => tr.id === id);
    if (!a) return;
    const next = Math.max(0, Math.min(audioTrackCount - 1, (a.track ?? 0) + dir));
    setAudioTracks((prev) => prev.map((tr) => (tr.id === id ? { ...tr, track: next } : tr)));
  }

  // ── Glisser-déposer libre (unifié plans + incrustations), façon CapCut ───────
  // Renvoie l'identifiant de la piste (data-tllane) située sous le curseur.
  function laneUnder(clientX: number, clientY: number): string | null {
    if (typeof document === "undefined") return null;
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const lane = el?.closest?.("[data-tllane]") as HTMLElement | null;
    return lane?.dataset.tllane ?? null;
  }
  // Cible de dépôt sous le curseur. La zone « nouvelle piste » n'existe PAS dans le
  // flux (aucun décalage quand on déplace un plan horizontalement) : on la détecte
  // uniquement par la géométrie — quand le curseur passe au-dessus du haut du groupe
  // vidéo, c'est-à-dire dans la zone vide au-dessus des pistes existantes.
  function dropTargetAt(clientX: number, clientY: number): string | null {
    const inner = tlInnerRef.current;
    if (inner) {
      const els = Array.from(inner.querySelectorAll<HTMLElement>("[data-tllane]"))
        .filter((e) => { const l = e.dataset.tllane; return l === "video" || /^v\d+$/.test(l || ""); });
      if (els.length) {
        const topY = Math.min(...els.map((e) => e.getBoundingClientRect().top));
        // Zone morte : il faut monter FRANCHEMENT au-dessus des pistes (≥ 16 px) pour
        // déclencher « nouvelle piste ». Un simple glissement horizontal (même avec un
        // léger tremblement vertical) ne déclenche donc rien.
        if (clientY < topY - 16) return "new";
      }
    }
    return laneUnder(clientX, clientY);
  }
  /* Piste visée pour un élément lâché, quand la rangée compte.

     Même principe que pour la vidéo : on lit la piste sous le curseur, et on
     réserve une ZONE MORTE au delà du groupe pour créer une rangée. Le texte
     s'empile vers le HAUT, l'audio vers le BAS — c'est le sens de la timeline,
     l'image monte et le son descend. Il faut sortir franchement du groupe (16 px)
     pour déclencher : un simple tremblement vertical pendant un déplacement
     horizontal ne doit rien créer. */
  function bornesDuGroupe(prefixe: RegExp): { haut: number; bas: number } | null {
    const inner = tlInnerRef.current;
    if (!inner) return null;
    const els = Array.from(inner.querySelectorAll<HTMLElement>("[data-tllane]"))
      .filter((e) => prefixe.test(e.dataset.tllane || ""));
    if (!els.length) return null;
    const rects = els.map((e) => e.getBoundingClientRect());
    return { haut: Math.min(...rects.map((r) => r.top)), bas: Math.max(...rects.map((r) => r.bottom)) };
  }
  /** Rangée de texte visée. `null` = garder la sienne, nombre = cette rangée. */
  function pisteTexteCible(clientX: number, clientY: number, nb: number): number | null {
    const b = bornesDuGroupe(/^t\d+$/);
    if (b && clientY < b.haut - 16) return nb; // au-dessus du groupe → nouvelle rangée
    const lane = laneUnder(clientX, clientY);
    if (lane && /^t\d+$/.test(lane)) return parseInt(lane.slice(1), 10) || 0;
    return null;
  }
  /** Piste audio visée. Même règle, mais l'empilement se fait vers le bas. */
  function pisteAudioCible(clientX: number, clientY: number, nb: number): number | null {
    const b = bornesDuGroupe(/^a\d+$/);
    if (b && clientY > b.bas + 16) return nb; // sous le groupe → nouvelle piste
    const lane = laneUnder(clientX, clientY);
    if (lane && /^a\d+$/.test(lane)) return parseInt(lane.slice(1), 10) || 0;
    return null;
  }

  // Instant temporel du bord gauche du plan lâché (le point saisi reste sous le curseur).
  function dropTimeAt(clientX: number, grabDx: number): number {
    const r = rulerRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.max(0, snapTime((clientX - grabDx - r.left) / pps));
  }
  function startTlDrag(e: React.PointerEvent, id: string, kind: "clip" | "overlay") {
    e.stopPropagation();
    const laneKey = kind === "clip" ? "video" : `v${overlays.find((o) => o.id === id)?.track ?? 0}`;
    const locked = lockedLanes.has(laneKey);
    if (e.shiftKey && !locked) { toggleMulti(id); return; } // ⇧+clic → sélection multiple, pas de glissement
    // Sélection immédiate au clic (sans déplacer le curseur de lecture — on garde le playhead
    // stable pendant qu'on attrape le plan, comme CapCut).
    if (multiSel.size) setMultiSel(new Set());
    if (kind === "clip") { setSelectedClipId(id); setAudioOnlyId(null); setSelectedOverlayId(null); setSelectedTitleId(null); setSelectedStickerId(null); setSelectedAudioId(null); }
    else { setSelectedOverlayId(id); setSelectedClipId(null); setSelectedTitleId(null); setSelectedStickerId(null); setSubSelected(false); setSelectedAudioId(null); setTool("overlay"); }
    if (locked) return; // piste verrouillée : sélection ok, déplacement bloqué
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tlDragRef.current = { id, kind, startX: e.clientX, startY: e.clientY, grabDx: e.clientX - rect.left, grabDy: e.clientY - rect.top, widthPx: rect.width, moved: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  }
  function onTlDragMove(e: React.PointerEvent) {
    const d = tlDragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return; // seuil : un simple clic ne glisse pas
      d.moved = true;
    }
    setDragActive(true);
    setDropLane(dropTargetAt(e.clientX, e.clientY));
    // Copie fidèle flottante « dans la main » : suit le curseur en X (aimanté sur le temps
    // via snapTime) ET en Y (libre → le plan se soulève quand on monte vers une autre piste).
    // Le vrai élément reste en place (estompé) ; on commet la position/piste au relâchement,
    // pour ne pas démonter l'élément capturé au pointeur en plein glissement.
    const dropT = dropTimeAt(e.clientX, d.grabDx);
    const r = rulerRef.current?.getBoundingClientRect();
    const gx = r ? r.left + dropT * pps : e.clientX - d.grabDx;
    setTlGhost({ x: gx, y: e.clientY - d.grabDy, w: d.widthPx, id: d.id, kind: d.kind });
  }
  function onTlDragUp(e: React.PointerEvent) {
    effacerAimant();
    const d = tlDragRef.current;
    tlDragRef.current = null;
    setDragActive(false); setDropLane(null); setTlGhost(null);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (!d || !d.moved) return; // simple clic → sélection déjà faite au down
    const lane = dropTargetAt(e.clientX, e.clientY);
    const dropT = dropTimeAt(e.clientX, d.grabDx);
    const dup = e.altKey; // ⌥ (Option) + glisser = dupliquer (façon Mac / CapCut)
    if (d.kind === "clip") {
      if (!lane || lane === "video" || lane === "audio" || lane === "captions" || lane === "text") {
        if (dup) {
          const cs = clips.find((x) => x.id === d.id);
          if (cs) { const copy: MontageClip = { ...cs, id: crypto.randomUUID(), gapBefore: 0 }; insertClipAtTime(copy, dropT); }
        } else {
          moveClipOnMainLane(d.id, dropT); // reste sur la piste principale → repositionne et réordonne
        }
      } else if (lane === "new") {
        clipToOverlayTrack(d.id, dup, dropT, videoTrackCount); // nouvelle piste au-dessus de tout
      } else if (lane.startsWith("v")) {
        clipToOverlayTrack(d.id, dup, dropT, parseInt(lane.slice(1), 10) || 0);
      }
    } else {
      const o = overlays.find((x) => x.id === d.id);
      if (!o) return;
      const track = lane === "new" ? videoTrackCount : (lane && lane !== "video" && lane.startsWith("v") ? parseInt(lane.slice(1), 10) || 0 : (o.track ?? 0));
      if (dup) {
        const nid = crypto.randomUUID();
        setOverlays((prev) => [...prev, { ...o, id: nid, offset: dropT, track }]);
        setSelectedOverlayId(nid);
        resolveOverlayOverlaps(nid);
      } else if (lane === "video") {
        overlayToClip(d.id, dropT); // redescendue sur la piste principale → redevient un plan
      } else {
        updateOverlay(d.id, { offset: dropT, track });
        resolveOverlayOverlaps(d.id);
      }
    }
  }
  function startOvTrim(e: React.PointerEvent, o: OverlayClip, edge: "start" | "end") {
    e.stopPropagation();
    setSelectedOverlayId(o.id); setTool("overlay");
    if (lockedLanes.has(`v${o.track ?? 0}`)) return; // piste verrouillée
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    ovTrimRef.current = { id: o.id, edge, startX: e.clientX, t0start: o.trimStart, t0end: o.trimEnd, t0offset: o.offset, srcDur: o.srcDur, kind: o.kind };
  }
  function onOvTrimMove(e: React.PointerEvent) {
    const d = ovTrimRef.current;
    if (!d) return;
    // Aimantation, en excluant l'incrustation elle-même : ses propres bords
    // suivent le geste et la recolleraient à sa position d'avant.
    const brut = (e.clientX - d.startX) / pps;
    const bord = d.edge === "end" ? d.t0offset + (d.t0end - d.t0start) : d.t0offset;
    const delta = snapTime(bord + brut, { ignorer: d.id }) - bord;
    if (d.edge === "end") {
      // Plafond = longueur réelle de la source (jamais au-delà du métrage). Garde-fou
      // anti-Infinity/NaN pour ne pas pouvoir étirer une incrustation vidéo à l'infini.
      const cap = d.kind === "video" ? (isFinite(d.srcDur) && d.srcDur > 0 ? d.srcDur : d.t0end) : 15;
      const ne = Math.max(d.t0start + 0.2, Math.min(cap, d.t0end + delta));
      updateOverlay(d.id, { trimEnd: ne });
    } else {
      // rogner le début : décale trimStart (vidéo) et l'offset temporel pour garder la fin en place
      const ns = Math.max(0, Math.min(d.t0end - 0.2, d.t0start + delta));
      updateOverlay(d.id, { trimStart: d.kind === "video" ? ns : 0, offset: Math.max(0, d.t0offset + (ns - d.t0start)) });
    }
  }
  function endOvTrim(e: React.PointerEvent) {
    if (ovTrimRef.current) { try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {} ovTrimRef.current = null; }
  }

  // Quand les sous-titres sont déliés, les réglages de style éditent le sous-titre
  // sélectionné (via activeSubStyleId/activeSubCustom + pickSubStyle/patchSubCustom).
  const routedSetSubCustom: typeof setSubCustom = (updater) => {
    const next = typeof updater === "function" ? (updater as (c: SubCustom) => SubCustom)(activeSubCustom) : updater;
    const caps = targetCaps();
    if (perCap && caps.length) caps.forEach((c) => updateCaption(c.id, { custom: next }));
    else setSubCustom(next);
  };
  // ── Assistant de montage : état envoyé à l'IA + exécution de ses actions ────
  // On n'envoie qu'un RÉSUMÉ du projet (pas les URLs de médias ni les styles
  // complets) : assez pour raisonner, assez court pour tenir dans le contexte.
  const buildChatProject = useCallback(async () => {
    const starts = computeStarts(clips);
    // L'assistant REGARDE le montage : une image par plan (jusqu'à 4, prises au
    // milieu du segment conservé). Sans ça il raisonne à l'aveugle sur des noms
    // de fichiers et ne peut rien dire du contenu réel.
    const sample = starts.filter((c) => c.kind === "video").slice(0, 4);
    const images = (await Promise.all(sample.map((c) =>
      grabFrame(c.src, c.kind, (c.trimStart + c.trimEnd) / 2).catch(() => null),
    ))).filter((x): x is string => !!x);
    return {
      format: formatId,
      images,
      // Ce qui est DIT dans la vidéo : l'assistant comprend le propos et peut
      // juger le rythme, les redites, ce qui mérite un titre à l'écran.
      transcription: captions.map((c) => c.text).join(" ").slice(0, 2500),
      dureeTotale: Number(total.toFixed(2)),
      plans: starts.map((c, i) => ({
        id: c.id, n: i + 1, nom: c.name, type: c.kind,
        debutTimeline: Number(c.start.toFixed(2)),
        duree: Number(c.dur.toFixed(2)),
        trimStart: Number(c.trimStart.toFixed(2)),
        trimEnd: Number(c.trimEnd.toFixed(2)),
        dureeSource: Number((c.srcDur ?? 0).toFixed(2)),
        vitesse: c.speed, volume: c.vol ?? 1,
        filtre: c.filterId, transitionEntree: c.transitionIn, dureeTransition: c.transitionDur,
      })),
      sousTitres: { nombre: captions.length, motsParSousTitre: subMaxWords, style: subStyleId, position: subPos },
      titres: titles.map((x) => ({ id: x.id, texte: x.text, debut: Number(x.start.toFixed(2)), fin: Number(x.end.toFixed(2)) })),
      pistesAudio: audioTracks.map((a) => ({ id: a.id, nom: a.name, debut: a.offset, duree: a.dur })),
      incrustations: overlays.length,
      barreDeProgression: showProgressBar,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, total, formatId, captions, subMaxWords, subStyleId, subPos, titles, audioTracks, overlays.length, showProgressBar]);

  // Applique les actions renvoyées par l'IA. Chaque branche passe par les setters
  // normaux → l'historique enregistre les points d'annulation tout seul (Cmd+Z).
  // Renvoie le nombre d'actions réellement appliquées.
  const applyChatActions = useCallback((actions: { type: string; [k: string]: unknown }[]): number => {
    let done = 0;
    const num = (v: unknown, min: number, max: number, dflt: number) =>
      typeof v === "number" && isFinite(v) ? Math.max(min, Math.min(max, v)) : dflt;
    // « all » ou un id de plan → liste des plans visés.
    const targets = (t: unknown): string[] => {
      if (t === "all" || t == null) return clips.map((c) => c.id);
      return clips.some((c) => c.id === t) ? [String(t)] : [];
    };

    for (const a of actions) {
      switch (a.type) {
        case "run_pre_edit": void runFullPreEdit(); done++; break;
        case "auto_cut": void autoCutQuality(); done++; break;
        case "cut_fillers": void cutFillers(); done++; break;
        case "generate_captions": void generateCaptionsAI(); done++; break;
        case "set_transition": {
          const tr = TRANSITIONS.some((x) => x.id === a.transition) ? String(a.transition) : null;
          if (!tr) break;
          const dur = num(a.dur, 0.1, 2, 0.4);
          if (a.target === "all" || a.target == null) { applyTransitionToAll(tr, dur); done++; }
          else for (const id of targets(a.target)) { updateClip(id, { transitionIn: tr, transitionDur: dur }); done++; }
          break;
        }
        case "set_speed": {
          const sp = num(a.speed, 0.25, 4, 1);
          for (const id of targets(a.target)) { updateClip(id, { speed: sp }); done++; }
          break;
        }
        case "set_volume": {
          const v = num(a.vol, 0, 1, 1);
          for (const id of targets(a.target)) { updateClip(id, { vol: v }); done++; }
          break;
        }
        case "set_filter": {
          const patch: Partial<MontageClip> = {};
          if (typeof a.filterId === "string" && FILTERS.some((f) => f.id === a.filterId)) patch.filterId = a.filterId;
          if (typeof a.lum === "number") patch.lum = num(a.lum, -100, 100, 0);
          if (typeof a.con === "number") patch.con = num(a.con, -100, 100, 0);
          if (typeof a.sat === "number") patch.sat = num(a.sat, -100, 100, 0);
          if (!Object.keys(patch).length) break;
          for (const id of targets(a.target)) { updateClip(id, patch); done++; }
          break;
        }
        case "trim_clip": {
          const c = clips.find((x) => x.id === a.clipId);
          if (!c) break;
          const cap = c.kind === "video" ? (isFinite(c.srcDur) && c.srcDur > 0 ? c.srcDur : c.trimEnd) : 15;
          const ts = num(a.trimStart, 0, cap - 0.2, c.trimStart);
          const te = num(a.trimEnd, ts + 0.2, cap, c.trimEnd);
          updateClip(c.id, { trimStart: ts, trimEnd: te }); done++;
          break;
        }
        case "remove_clip": {
          if (clips.some((c) => c.id === a.clipId)) { removeClip(String(a.clipId)); done++; }
          break;
        }
        case "reorder_clips": {
          if (!Array.isArray(a.order)) break;
          const byId = new Map(clips.map((c) => [c.id, c]));
          const next = (a.order as unknown[])
            .map((id) => byId.get(String(id)))
            .filter((c): c is MontageClip => !!c);
          // On n'accepte qu'une permutation COMPLÈTE : un ordre partiel ferait
          // disparaître des plans du montage.
          if (next.length !== clips.length) break;
          setClips(next); done++;
          break;
        }
        case "set_caption_length": { setCaptionLength(Math.round(num(a.words, 1, 8, 3))); done++; break; }
        case "set_subtitle_style": {
          if (typeof a.styleId === "string" && SUB_STYLES.some((s) => s.id === a.styleId)) { pickSubStyle(a.styleId); done++; }
          break;
        }
        case "set_subtitle_anim": {
          if (a.anim !== "words" && a.anim !== "none") break;
          setSubCustom((c) => ({ ...c, anim: a.anim as "words" | "none" })); done++;
          break;
        }
        case "set_subtitle_custom": {
          const patch: SubCustom = {};
          const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined);
          if (hex(a.fg)) patch.fg = a.fg as string;
          if (hex(a.hi)) patch.hi = a.hi as string;
          if (hex(a.bg)) patch.bg = a.bg as string;
          if (hex(a.stroke)) patch.stroke = a.stroke as string;
          if (typeof a.strokeW === "number") patch.strokeW = num(a.strokeW, 0, 12, 2);
          if (typeof a.weight === "number") patch.weight = Math.round(num(a.weight, 100, 900, 800));
          if (typeof a.italic === "boolean") patch.italic = a.italic;
          if (typeof a.scale === "number") patch.scale = num(a.scale, 0.4, 3, 1);
          if (typeof a.letterSpacing === "number") patch.letterSpacing = num(a.letterSpacing, -0.05, 0.5, 0);
          if (typeof a.bgOpacity === "number") patch.bgOpacity = num(a.bgOpacity, 0, 1, 1);
          if (a.caseMode === "none" || a.caseMode === "upper" || a.caseMode === "lower" || a.caseMode === "title") {
            patch.caseMode = a.caseMode;
            patch.uppercase = a.caseMode === "upper"; // garde l'ancien booléen cohérent
          }
          if (!Object.keys(patch).length) break;
          setSubCustom((c) => ({ ...c, ...patch })); done++;
          break;
        }
        case "set_subtitle_pos": {
          setSubPos({ x: num(a.x, 0, 100, 50), y: num(a.y, 0, 100, 78) }); done++;
          break;
        }
        case "add_title": {
          if (typeof a.text !== "string" || !a.text.trim()) break;
          // `addTitle()` pose un titre par défaut au curseur ; ici l'IA fixe le
          // texte et la plage, donc on crée l'élément directement.
          const st = num(a.start, 0, Math.max(0, total), time);
          setTitles((prev) => [...prev, {
            id: crypto.randomUUID(), start: st, end: st + num(a.dur, 0.5, 30, 2.5),
            text: (a.text as string).trim(), font: "archivo", color: "#FFFFFF", anim: "rise", x: 50, y: 78,
          }]);
          done++;
          break;
        }
        case "set_format": {
          if (typeof a.formatId === "string" && VIDEO_FORMATS.some((f) => f.id === a.formatId)) { setFormatId(a.formatId); done++; }
          break;
        }
        case "toggle_progress_bar": { setShowProgressBar(!!a.on); done++; break; }
        default: break; // action inconnue → ignorée silencieusement
      }
    }
    return done;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, total, time]);




  const ctx: MontageCtx = {
    clips, selectedClip, captions, subStyleId: activeSubStyleId, subMaxWords, subCustom: activeSubCustom, subPos, hasRawSegments: rawSegments.length > 0 || rawWords.length > 0,
    linkedSubs, setLinkedSubs, selectedCaptionId, setSelectedCaptionId,
    seek,
    capSelectedCount: capMulti.length,
    titles, stickers, audioTracks, showProgressBar,
    overlays, selectedOverlay, uploadingOverlay, addOverlayFiles, updateOverlay, removeOverlay, duplicateOverlay, selectOverlay,
    videoTrackCount, moveOverlayTrack,
    time, total, logoUrl, brandColors, brandFonts, uploadingAudio, transcribing, isRecordingVO,
    croppingClipId, smartCropClip, assembling, autoAssembleAI, suggestingMusic, musicSuggestion, suggestMusicMoodAI,
    cuttingSilence, cutSilences,
    autoCutting, autoCutProgress,
    // enveloppés : onClick={fn} passerait l'événement comme liste de plans
    autoCutQuality: () => { void autoCutQuality(); },
    cuttingFillers, cutFillers: () => { void cutFillers(); },
    preEditing, preEditStep, runFullPreEdit,
    generatingDesc, videoDescription, generateVideoDescription,
    toast, updateClip, splitAtPlayhead,
    duplicateSelected: () => selectedClipId && duplicateClip(selectedClipId),
    removeSelected: () => selectedClipId && removeClip(selectedClipId),
    applyTransitionToAll,
    addTitle, updateTitle, removeTitle,
    addCaption, updateCaption, removeCaption, setSubStyleId: pickSubStyle, setCaptionLength, generateCaptionsAI: () => { void generateCaptionsAI(); },
    setSubCustom: routedSetSubCustom, resetSubCustom: resetSubCustomRouted, applySubTemplate,
    addSticker, updateSticker, removeSticker,
    toggleProgressBar, importAudio, removeAudioTrack, setAudioVol, setAudioFade, toggleRecordVO,
    audioTrackCount, moveAudioTrackRow,
    addVolKey, setVolKey, removeVolKey,
    processingVoice, isolateVoiceOnTrack,
    beatSyncing, snapCutsToBeat,
  };

  interface MediaItem {
    cle: string; nom: string; src: string; type: "video" | "photo" | "audio";
    dur: number; ou: string; selectionne: boolean; ouvrir: () => void;
  }
  const mediaLibrary = useMemo<MediaItem[]>(() => {
    const tout: MediaItem[] = [];
    clipStarts.forEach((c, i) => tout.push({
      cle: `c${c.id}`, nom: c.name, src: c.src, type: c.kind === "photo" ? "photo" : "video",
      dur: c.dur, ou: t('mediaInMainTrack', { n: i + 1 }), selectionne: selectedClipId === c.id,
      ouvrir: () => { selectClip(c.id); setTool("cut"); },
    }));
    overlays.forEach((o) => tout.push({
      cle: `o${o.id}`, nom: o.name, src: o.src, type: o.kind === "photo" ? "photo" : "video",
      dur: overlayTimelineDur(o), ou: t('mediaInOverlay', { n: (o.track ?? 0) + 1 }), selectionne: selectedOverlayId === o.id,
      ouvrir: () => selectOverlay(o.id),
    }));
    audioTracks.forEach((a) => tout.push({
      cle: `a${a.id}`, nom: a.name, src: a.src, type: "audio",
      dur: a.dur, ou: t('mediaInAudio', { n: (a.track ?? 0) + 1 }), selectionne: selectedAudioId === a.id,
      ouvrir: () => { setSelectedAudioId(a.id); setTool("audio"); },
    }));
    const q = mediaQuery.trim().toLowerCase();
    return tout.filter((m) => (mediaFilter === "all" || m.type === mediaFilter)
      && (!q || m.nom.toLowerCase().includes(q)));
  }, [clipStarts, overlays, audioTracks, selectedClipId, selectedOverlayId, selectedAudioId, mediaFilter, mediaQuery, t]);

  /** Reposer un média déjà importé en incrustation, sans le retélécharger. */
  function ajouterEnIncrustation(src: string, kind: "video" | "photo", dur: number) {
    const id = crypto.randomUUID();
    setOverlays((prev) => [...prev, {
      id, kind, name: src.split("/").pop() || "", src, srcDur: dur,
      trimStart: 0, trimEnd: dur, offset: time, track: 0,
      ...newOverlayDefaults(),
    }]);
    setSelectedOverlayId(id);
    setTool("overlay");
    toast(t('toastOverlayAdded'));
  }

  const trackW = Math.max(total * pps, 200);
  const ticks: number[] = [];
  for (let s = 0; s <= total; s += 2) ticks.push(s);

  // Échelle aperçu = px réels de la preview / largeur du canvas d'export. Le texte
  // est ainsi dimensionné comme à l'export et suit la taille de l'image (et non un px fixe).
  // Format effectif : preset ou dimensions personnalisées (px).
  const activeFmt = formatId === "custom"
    ? { id: "custom", label: "Perso", sub: `${customW}×${customH}`, w: Math.max(1, customW), h: Math.max(1, customH) }
    : videoFormatById(formatId);
  const previewScale = (stageW || 300) / activeFmt.w;


  const transitionEnCours = !!outClip && !!activeClip && !!activeClip.transitionIn && activeClip.transitionIn !== "cut";
  const transitionGl = transitionEnCours && estTransitionGl(activeClip!.transitionIn);

  /* L'IMAGE FIGÉE du plan qui s'en va.

     C'est la pièce qui manquait. Le plan sortant vivait dans un lecteur vidéo à
     qui on donnait sa source au moment même de la transition : il n'avait donc
     rien de décodé à montrer pendant la demi-seconde où on avait besoin de lui,
     et on voyait du noir à sa place.

     On garde en permanence une image de ce qui est à l'écran. Quand la transition
     commence, elle porte la dernière image du plan qui part — disponible tout de
     suite, rien à charger, rien à décoder.

     Deux fois par seconde suffisent : la capture coûte un dessin de trame, et la
     faire à chaque battement d'horloge hachait le son. */
  const instantaneRef = useRef<HTMLCanvasElement | null>(null);
  const derniereCaptureRef = useRef(0);
  useEffect(() => {
    if (transitionEnCours || !activeClip) return;
    const maintenant = performance.now();
    if (maintenant - derniereCaptureRef.current < 500) return;
    const el: HTMLVideoElement | HTMLImageElement | null =
      activeClip.kind === "video" ? [videoARef, videoBRef][slot].current : imgInRef.current;
    if (!el) return;
    const sw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
    const sh = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
    if (!sw || !sh || (el instanceof HTMLVideoElement && el.readyState < 2)) return;
    derniereCaptureRef.current = maintenant;
    const w = 480, h = Math.max(1, Math.round((sh / sw) * 480));
    let cv = instantaneRef.current;
    if (!cv) { cv = document.createElement("canvas"); instantaneRef.current = cv; }
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    try { cv.getContext("2d")?.drawImage(el, 0, 0, w, h); } catch { /* source non lisible */ }
  }, [time, activeClip, slot, transitionEnCours]);

  /* Cette image, peinte UNE FOIS par coupe dans la toile du plan sortant.

     Une toile visible, pas une image : passer par `toDataURL` demande de RELIRE
     les pixels, ce qu'un navigateur refuse dès qu'une vidéo d'un autre domaine a
     été dessinée dedans. L'appel échouait donc en silence, l'image du plan
     sortant n'existait pas, et la transition se jouait sur du noir. Une toile
     s'affiche sans qu'on ait à la relire. */
  const cvOutRef = useRef<HTMLCanvasElement>(null);
  const cleSortantRef = useRef<string | null>(null);
  const [sortantPret, setSortantPret] = useState(false);
  useEffect(() => {
    if (!transitionEnCours || !outClip || !activeClip) { cleSortantRef.current = null; return; }
    const cle = `${outClip.id}|${activeClip.id}`;
    if (cleSortantRef.current === cle) return;
    const cv = cvOutRef.current, snap = instantaneRef.current;
    if (!cv || !snap || !snap.width) { setSortantPret(false); return; }
    cleSortantRef.current = cle;
    const w = Math.max(120, Math.round(stageW || 360));
    const h = Math.max(120, Math.round(w * (activeFmt.h / activeFmt.w)));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const c2d = cv.getContext("2d");
    if (!c2d) { setSortantPret(false); return; }
    drawPlanFixe(c2d, snap, outClip, outClip.dur, w, h);
    setSortantPret(true);
  }, [transitionEnCours, outClip, activeClip, stageW, activeFmt.w, activeFmt.h]);
  useEffect(() => { if (!transitionEnCours) setSortantPret(false); }, [transitionEnCours]);

  /* Les transitions à SHADER, elles, ne se décrivent pas en CSS : elles
     déforment l'image pixel par pixel. Seules celles-là passent par une toile,
     et seulement le temps de la transition. Les autres se jouent en CSS sur les
     deux couches, ce qui ne coûte rien par image — composer une toile trente
     fois par seconde pendant la lecture, c'était le son haché. */
  useEffect(() => {
    const cv = glCanvasRef.current;
    if (!cv) return;
    if (!transitionGl || !activeClip || !outClip || exporting || hiddenLanes.has("video")) { cv.style.display = "none"; return; }
    const entrant = activeClip.kind === "video" ? [videoARef, videoBRef][slot].current : imgInRef.current;
    const sortant = instantaneRef.current;
    if (!entrant || !sortant || !sortant.width) { cv.style.display = "none"; return; }
    if (entrant instanceof HTMLVideoElement && entrant.readyState < 2) { cv.style.display = "none"; return; }
    const w = Math.max(120, Math.round(stageW || 360));
    const h = Math.max(120, Math.round(w * (activeFmt.h / activeFmt.w)));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const ctx2d = cv.getContext("2d");
    if (!ctx2d) { cv.style.display = "none"; return; }
    const dansLaTransition = time - activeClip.start;
    const avancement = dansLaTransition / Math.max(0.01, activeClip.transitionDur || 0.01);
    try {
      drawTransitionFrame(ctx2d, sortant, outClip, outClip.dur, entrant, activeClip, dansLaTransition,
        activeClip.transitionIn!, avancement, w, h);
      cv.style.display = "block";
    } catch {
      // Source illisible : mieux vaut la transition de repli en CSS que du noir.
      cv.style.display = "none";
    }
  }, [transitionGl, time, activeClip, outClip, slot, stageW, activeFmt.w, activeFmt.h, exporting, hiddenLanes]);
  // Le texte sélectionné s'affiche TOUJOURS dans l'aperçu (même si le curseur sort de sa
  // plage) → on peut toujours le voir, le déplacer et l'éditer.
  // Chaque rangée de texte se masque séparément, comme les pistes vidéo.
  const activeTitles = titles.filter((ti) => !hiddenLanes.has(`t${ti.track ?? 0}`) && ((time >= ti.start && time <= ti.end) || ti.id === selectedTitleId));
  const activeStickers = stickers.filter((s) => time >= s.start && time <= s.end);
  const activeCaption = hiddenLanes.has("subs") ? undefined
    : (captions.find((c) => c.id === selectedCaptionId && editingCaptionId === c.id)
      || captions.find((c) => time >= c.start && time <= c.end)
      || (selectedCaptionId && !playing ? captions.find((c) => c.id === selectedCaptionId) : undefined));
  const capStyle = activeCaption ? capStyleOf(activeCaption) : effectiveSubStyle(subStyleId, subCustom);
  const capPos = activeCaption ? capPosOf(activeCaption) : subPos;
  // Le nombre de lignes autorisé est une VRAIE limite : ce qui ne rentre pas est
  // passé au sous-titre suivant. Le découpage (morceaux + retours à la ligne) est
  // celui de l'export, à la virgule près (cf. fitCaptionParts / subLines).
  const capPart = activeCaption ? captionPartAt(activeCaption, capStyle, activeFmt.w, time) : undefined;
  // En édition on montre le texte ENTIER : on corrige la phrase qu'on a écrite,
  // pas le morceau qui tient à l'écran.
  const capText = editingCaptionId && activeCaption?.id === editingCaptionId
    ? (activeCaption?.text ?? "") : (capPart?.text ?? "");
  const capLines = activeCaption ? subLines(capText, capStyle, activeFmt.w) : [[]];

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--canvas)" }}>
        <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>{t('loadingMontage')}</span>
      </div>
    );
  }

  return (
    <div className="a-root" style={{ height: "100vh" }}>
      {/* topbar */}
      {/* Barre du montage en violet : dans le produit, le violet est la vidéo
          et le vert la photo. C'est la première chose qu'on voit en entrant. */}
      <div className="ed-topbar" style={{ height: 58, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", borderBottom: "1px solid rgba(122,105,232,.20)", background: "radial-gradient(120% 130% at 0% 0%, rgba(122,105,232,.24), transparent 55%), radial-gradient(90% 130% at 100% 0%, rgba(156,140,255,.12), transparent 60%), linear-gradient(90deg, #1E1846 0%, var(--forest) 50%, #171238 100%)", position: "relative", zIndex: 30 }}>
        <a href={`/workspace/${workspaceId}`} className="mz-top" style={{ flexShrink: 0 }}>
          <VIcon name="chevL" size={15} /> {t('composeBack')}
        </a>
        <span style={{ width: 1, height: 24, background: "var(--line)", flexShrink: 0 }} />
        <div style={{ display: "flex", gap: 2 }}>
          <button className="mz-top mz-top-icon" title={t('undoTitle')} disabled={!canUndo} onClick={undo}><VIcon name="undo" size={16} /></button>
          <button className="mz-top mz-top-icon" title={t('redoTitle')} disabled={!canRedo} onClick={redo}><VIcon name="redo" size={16} /></button>
        </div>
        <span style={{ width: 1, height: 24, background: "var(--line)", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em" }} className="trunc">{projectName}</span>
          <div className="mz-fmt" title={t('exportFormatTitle')}>
            {VIDEO_FORMATS.map(f => (
              <button key={f.id} className={formatId === f.id ? "on" : ""} onClick={() => setFormatId(f.id)}>{f.sub}</button>
            ))}
            {/* Le format personnalisé ouvre une FENÊTRE. Les champs largeur et
                hauteur s'ouvraient dans la barre : faute de place, ils passaient
                sous les boutons voisins et se chevauchaient. */}
            <button className={formatId === "custom" ? "on" : ""} title={t('customFormatTitle')}
              onClick={() => { setFormatId("custom"); setFormatPersoOuvert(true); }}>
              {t('customFormatShort')}
            </button>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {exportUrl && (
          <a href={exportUrl} target="_blank" rel="noreferrer" className="mz-top">
            <VIcon name="eye" size={15} /> {t('viewExport')}
          </a>
        )}
        {/* La couverture se choisit ICI : on se place sur l'image voulue, on clique. */}
        <button onClick={setCoverFromPlayhead} disabled={settingCover || !activeClip} className="mz-top" title={t('coverAtPlayheadTitle')}>
          <VIcon name="image" size={15} /> {settingCover ? t('coverSaving') : coverUrl ? t('coverRedo') : t('coverAtPlayhead')}
        </button>

        {/* « Légende IA » retirée de la barre : la fonction est remise à une étape
            ultérieure, et un bouton qui n'aboutit pas encombre plus qu'il ne sert.
            Le code qui la produit reste en place, il n'y a qu'à reposer le bouton. */}

        {/* Qualité d'export : liste déroulante maison. La native ne se style pas,
            son menu restait gris système au milieu d'une barre violette. */}
        <div className="mz-drop" ref={qualiteRef}>
          <button className="mz-top" onClick={() => setQualiteOuverte((v) => !v)} title={t('exportQualityTitle')}>
            {tc(`exportQuality.${exportQuality}`)}
            <span style={{ fontSize: 9, opacity: .7 }}>▼</span>
          </button>
          {qualiteOuverte && (
            <div className="mz-drop-menu">
              {EXPORT_QUALITIES.map((q) => (
                <button key={q.id} className={"mz-drop-item" + (exportQuality === q.id ? " on" : "")}
                  onClick={() => { setExportQuality(q.id); setQualiteOuverte(false); }}>
                  <span>{tc(`exportQuality.${q.id}`)}</span>
                  <span className="mz-drop-sub">{(q.bitrate / 1e6).toFixed(1)} Mb/s</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="mz-top" disabled={!clips.length || exporting} onClick={() => handleExport(false)}>
          <VIcon name="export" size={15} /> {exporting ? t('exportingShort') : t('exportBtn')}
        </button>
        {/* « Publier » et « Planifier » faisaient la même chose : rendre la vidéo,
            la marquer prête et emmener au planning. Deux boutons côte à côte pour
            un seul geste, dont un qui laissait croire à une publication immédiate.
            Il n'en reste qu'un, et c'est le mot le plus juste qui est gardé. */}
        <button className="mz-top mz-top-primary" disabled={!clips.length || exporting} onClick={() => handleExport(true)} title={t('publishBtnTitle')}>
          <VIcon name="calendar" size={15} /> {t('schedule')}
        </button>
      </div>

      {formatPersoOuvert && (
        <div className="mz-modal-fond" onMouseDown={(e) => { if (e.target === e.currentTarget) setFormatPersoOuvert(false); }}>
          <div className="mz-modal">
            <div className="mz-modal-head">
              <h3>{t('customFormatTitle')}</h3>
              <button className="mz-modal-x" onClick={() => setFormatPersoOuvert(false)} title={t('close')}>×</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input className="mz-dim" type="number" min={64} max={4096} value={customW} aria-label={t('widthPx')}
                onChange={e => setCustomW(Math.max(64, Math.min(4096, Math.round(Number(e.target.value) || 0))))} />
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>×</span>
              <input className="mz-dim" type="number" min={64} max={4096} value={customH} aria-label={t('heightPx')}
                onChange={e => setCustomH(Math.max(64, Math.min(4096, Math.round(Number(e.target.value) || 0))))} />
              {/* La forme obtenue, dessinée. Un rapport écrit « 0.56 : 1 » ne dit
                  rien à personne ; un rectangle, si. */}
              <span className="mz-dim-shape" title={`${(customW / Math.max(1, customH)).toFixed(2)} : 1`}>
                <i style={{
                  width: customW >= customH ? 40 : Math.max(6, Math.round((customW / Math.max(1, customH)) * 40)),
                  height: customH >= customW ? 40 : Math.max(6, Math.round((customH / Math.max(1, customW)) * 40)),
                }} />
              </span>
            </div>
            <div className="mz-dim-presets">
              {CUSTOM_SIZES.map(([w, h, nom]) => (
                <button key={nom} className={customW === w && customH === h ? "on" : ""}
                  onClick={() => { setCustomW(w as number); setCustomH(h as number); }}>
                  {nom}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="a-main">
        {/* rail */}
        <div className="a-rail">
          {RAIL_TOOLS.map(([k, ic, lbl]) => (
            <button key={k} className={"a-railbtn" + (tool === k ? " on" : "")} onClick={() => setTool(k)}>
              <VIcon name={ic} size={20} /><span className="a-railcap">{lbl}</span>
            </button>
          ))}
          <button className={"a-railbtn" + (tool === "ai" ? " on" : "")} onClick={() => setTool("ai")} style={{ marginTop: "auto" }}>
            <VIcon name="sparkles" size={20} /><span className="a-railcap">{t('railAi')}</span>
          </button>
        </div>

        {/* panneau de propriétés */}
        <div className="a-panel" key={tool} style={{ width: panelW }}>
          <div className="a-panel-head"><span className="a-panel-title">{TOOL_TITLES[tool]}</span></div>
          <div className="a-panel-scroll">
            {tool === "media" && (
              <>
                <div className="a-section">
                  <div
                    className={"mz-import" + (dragOver ? " drop-on" : "")}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <VIcon name="upload" size={22} />
                    <span className="mz-import-t">{uploading ? t('importingAudio') : t('importMediaCta')}</span>
                    <span className="mz-import-s">{t('dragRushesHint')}</span>
                  </div>
                  <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,image/jpeg,image/png" multiple onChange={handleFileInput} style={{ display: "none" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                    <button className="btn btn-dark" style={{ justifyContent: "center", gap: 6 }} disabled={uploading} onClick={() => videoInputRef.current?.click()}>
                      <VIcon name="video" size={15} /> {t('importVideosCta')}
                    </button>
                    <button className="btn btn-ghost" style={{ justifyContent: "center", gap: 6 }} disabled={uploading} onClick={() => photoInputRef.current?.click()}>
                      <VIcon name="image" size={15} /> {t('importPhotosCta')}
                    </button>
                  </div>
                  <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime" multiple onChange={handleFileInput} style={{ display: "none" }} />
                  <input ref={photoInputRef} type="file" accept="image/jpeg,image/png" multiple onChange={handleFileInput} style={{ display: "none" }} />
                </div>
                <div className="a-section">
                  {/* ── Bibliothèque unique ──────────────────────────────────
                      Les médias étaient éparpillés : les plans ici, les
                      incrustations dans leur onglet, les sons dans le leur. Pour
                      retrouver un fichier il fallait déjà savoir ce qu'on en
                      avait fait. Tout est réuni, avec un filtre et une recherche,
                      et chaque élément dit où il est posé. */}
                  <span className="mz-sec-label">{t('mediaLibrary', { count: mediaLibrary.length })}</span>
                  <div className="mz-fmt" style={{ background: "var(--sunk)", marginTop: 10, width: "100%" }}>
                    {(["all", "video", "photo", "audio"] as const).map((k) => (
                      <button key={k} style={{ flex: 1, color: mediaFilter === k ? "var(--ink)" : "var(--ink-3)", background: mediaFilter === k ? "var(--white)" : "none" }}
                        onClick={() => setMediaFilter(k)}>{t(`mediaFilter_${k}`)}</button>
                    ))}
                  </div>
                  <input className="input" value={mediaQuery} onChange={(e) => setMediaQuery(e.target.value)}
                    placeholder={t('mediaSearch')} style={{ width: "100%", marginTop: 8 }} />

                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                    {mediaLibrary.map((m) => (
                      <div key={m.cle} className={"mz-media" + (m.selectionne ? " on" : "")} onClick={m.ouvrir} title={m.nom}>
                        <span className="mz-media-vue">
                          {m.type === "photo" && <img src={m.src} alt="" />}
                          {m.type === "video" && <video src={m.src} muted preload="metadata" />}
                          {m.type === "audio" && <VIcon name="music" size={16} />}
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span className="mz-media-nom trunc">{m.nom}</span>
                          <span className="mz-media-meta">{m.ou} · {m.dur.toFixed(1)}s</span>
                        </span>
                        {m.type !== "audio" && (
                          <button className="mz-media-act" title={t('useAsOverlay')}
                            onClick={(e) => { e.stopPropagation(); ajouterEnIncrustation(m.src, m.type as "video" | "photo", m.dur); }}>
                            <VIcon name="plus" size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    {!mediaLibrary.length && (
                      <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.45 }}>{t('mediaEmpty')}</p>
                    )}
                  </div>
                </div>
                <div className="a-section">
                  <span className="mz-sec-label">{t('photoOverlayTitle')}</span>
                  <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.45, marginTop: 8 }}>{t('photoOverlayDesc', { dur: PHOTO_DEFAULT_DUR })}</p>
                </div>
              </>
            )}
            {tool === "overlay" && (
              <>
                <OverlayPanel ctx={ctx} />
                <input ref={overlayInputRef} type="file" accept="video/mp4,video/quicktime,image/jpeg,image/png" multiple onChange={handleOverlayFileInput} style={{ display: "none" }} />
              </>
            )}
            {tool === "cut" && <CutPanel ctx={ctx} />}
            {tool === "text" && <TextPanel ctx={ctx} selectedTitleId={selectedTitleId} />}
            {tool === "captions" && <CaptionsPanel ctx={ctx} />}
            {tool === "audio" && <AudioPanel ctx={ctx} />}
            {tool === "transitions" && <TransitionsPanel ctx={ctx} />}
            {tool === "filter" && <FilterPanel ctx={ctx} />}
            {tool === "speed" && <SpeedPanel ctx={ctx} />}
            {tool === "sticker" && <StickerPanel ctx={ctx} />}
            {tool === "ai" && <AiPanel ctx={ctx} />}
          </div>
        </div>

        {/* poignée de redimensionnement du panneau */}
        <div className="a-hresize" onPointerDown={startPanelResize} title={t('resizePanelTitle')}><span className="a-hresize-grip" /></div>

        {/* preview + playbar */}
        <div className="a-canvas">
          <div className={"mz-stage" + (stageFull ? " is-full" : "")}>
            {/* Prémontage IA en cours : on montre l'étape plutôt qu'un écran figé. */}
            {preEditing && (
              <AiThinkingPanel
                title={t('preEditRunning')}
                subtitle={preEditStep || undefined}
                steps={[
                  { id: "rushes", label: t('preStepRushes') },
                  { id: "speech", label: t('preStepSpeech') },
                  { id: "captions", label: t('preStepCaptions') },
                  { id: "dressing", label: t('preStepDressing') },
                ]}
                activeStep={preEditStepIdx}
                lines={aiLog}
                progress={preEditStepIdx < 0 ? 0 : Math.min(1, preEditStepIdx / 4)}
              />
            )}
            {/* Voir la vidéo en grand : l'aperçu était contraint à la colonne
                centrale, sans moyen de l'agrandir pour juger un cadrage ou la
                lisibilité des sous-titres. */}
            <button
              onClick={() => setStageFull((v) => !v)}
              title={stageFull ? t('exitFullPreview') : t('fullPreview')}
              style={{ position: "absolute", top: 12, left: 12, zIndex: 11, width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 8, border: "1px solid var(--line)", background: "rgba(0,0,0,.55)", color: "#fff", cursor: "pointer" }}
            >
              {stageFull
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4"/></svg>}
            </button>
            {previewZoom !== 1 && (
              <button
                onClick={() => { setPreviewZoom(1); setPreviewPan({ x: 0, y: 0 }); }}
                title={t('resetZoomTitle')}
                style={{ position: "absolute", top: 12, right: 12, zIndex: 10, height: 28, padding: "0 10px", borderRadius: 8, border: "1px solid var(--line)", background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
              >
                {Math.round(previewZoom * 100)}% · 1:1
              </button>
            )}
            <div
              className="mz-phone"
              style={{
                aspectRatio: `${activeFmt.w} / ${activeFmt.h}`,
                // `--pz` sert au cadre de sélection, qui s'échelonne à l'envers
                // pour garder la même taille à l'écran quel que soit le zoom.
                ["--pz" as string]: previewZoom,
                transform: previewZoom !== 1 ? `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})` : undefined,
                cursor: previewZoom > 1 ? (panRef.current ? "grabbing" : "grab") : undefined,
              }}
              ref={stageRef}
              onPointerDown={(e) => {
                const el = e.target as HTMLElement;
                if (el.closest(".mz-ov-item, .mz-pip, .mz-cap-box, .mz-th, .mz-rot, .mz-ov-del")) return;
                deselectAll();
                // Le glissement sur le FOND déplace l'aperçu ; sur un objet, c'est
                // l'objet qui bouge, d'où la sortie juste au-dessus.
                if (previewZoom > 1) {
                  panRef.current = { x: e.clientX, y: e.clientY, ox: previewPan.x, oy: previewPan.y };
                  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointeur déjà capturé */ }
                }
              }}
              onPointerMove={(e) => {
                const d = panRef.current;
                if (d) {
                  setPreviewPan(bornerPan({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }));
                  return;
                }
                onStagePointerMove(e);
              }}
              onPointerUp={(e) => {
                if (panRef.current) {
                  panRef.current = null;
                  try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
                }
                onStagePointerUp(e);
              }}
              onPointerLeave={(e) => { panRef.current = null; onStagePointerUp(e); }}
            >
              <div className="mz-video">
                {/* Le plan qui s'en va : son image figée, prise pendant qu'il était
                    encore à l'écran, animée en CSS comme n'importe quelle couche.
                    Toujours montée pendant la transition — c'est elle qu'on ne
                    voyait pas, et c'est pour ça que le fond était noir. */}
                <canvas
                  ref={cvOutRef}
                  style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    zIndex: 0, pointerEvents: "none",
                    display: transitionEnCours && sortantPret && !hiddenLanes.has("video") ? "block" : "none",
                    filter: [outClip ? clipFilterCss(outClip) : "", activeTransPair?.out.extraFilter].filter(Boolean).join(" ") || undefined,
                    ...((activeTransPair ? transitionCss(activeTransPair.out) : {}) as React.CSSProperties),
                    transformOrigin: "center",
                  }}
                />
                {/* Les DEUX lecteurs restent montés en permanence (même sur un plan
                    photo) : les démonter réinitialisait la source et le préchargement,
                    ce qui refaisait saccader le plan vidéo suivant. */}
                {([videoARef, videoBRef] as const).map((ref, i) => {
                  const shown = !!activeClip && activeClip.kind === "video" && i === slot && !hiddenLanes.has("video");
                  return (
                    <video
                      key={i}
                      ref={ref}
                      onTimeUpdate={shown ? onVideoTimeUpdate : undefined}
                      onEnded={shown ? onVideoEnded : undefined}
                      onError={() => {
                        // Source illisible (fichier absent du stockage, format refusé…).
                        // Sans ce signal, le lecteur restait figé sans explication.
                        const ac = activeClipRef.current;
                        if (!shown || !ac) return;
                        if (mediaErrRef.current.has(ac.src)) return;
                        mediaErrRef.current.add(ac.src);
                        setPlaying(false);
                        toast(t('toastMediaMissing', { name: ac.name }), "error");
                      }}
                      playsInline
                      // SANS ceci, dessiner ce lecteur dans une toile la SALIT, et
                      // tout ce qui relit ensuite ces pixels échoue en silence.
                      // C'est ce qui privait la transition de son plan sortant.
                      // Tout le reste du monteur (export, dérushage, vignettes) le
                      // déclare déjà sur les mêmes fichiers.
                      crossOrigin="anonymous"
                      muted={!shown}
                      // Taille et position ne changent JAMAIS (cf. .mz-video > video) :
                      // seule l'opacité bascule. Redimensionner le lecteur au moment
                      // de l'afficher lui faisait montrer une image à l'ancienne
                      // échelle, cernée de noir, le temps de se remettre en place.
                      style={shown
                        ? ({
                            filter: [clipFilterCss(activeClip!), activeTrans?.extraFilter].filter(Boolean).join(" ") || undefined,
                            objectPosition: `${(activeClip!.focusX ?? 0.5) * 100}% ${(activeClip!.focusY ?? 0.5) * 100}%`,
                            ...(activeTransCss || {}),
                            transformOrigin: "center",
                            zIndex: 1,
                          } as React.CSSProperties)
                        : { opacity: 0, pointerEvents: "none", zIndex: 0 }}
                    />
                  );
                })}
                {activeClip && !hiddenLanes.has("video") ? (
                  activeClip.kind === "video"
                    ? null
                    : <img ref={imgInRef} crossOrigin="anonymous" src={activeClip.src} alt="" style={{
                        // Posé et empilé explicitement : le plan sortant est une
                        // couche absolue, et une image restée dans le flux passerait
                        // dessous alors qu'elle doit arriver par-dessus.
                        position: "absolute", inset: 0, zIndex: 1,
                        filter: [clipFilterCss(activeClip), activeTrans?.extraFilter].filter(Boolean).join(" ") || undefined,
                        objectPosition: `${(activeClip.focusX ?? 0.5) * 100}% ${(activeClip.focusY ?? 0.5) * 100}%`,
                        ...(activeTransCss || {}),
                        // Zoom automatique et transition se composent sur le même transform.
                        transform: [activeTransCss?.transform,
                          `scale(${kenBurnsScale(activeClip.kenBurns, activeClip.dur > 0 ? Math.min(1, Math.max(0, (time - activeClip.start) / activeClip.dur)) : 0)})`,
                        ].filter(Boolean).join(" "),
                        transformOrigin: "center",
                      } as React.CSSProperties} />
                ) : clips.length === 0 ? (
                  <div className="mz-vempty">
                    <VIcon name="upload" size={26} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t('importRushesEmpty')}</span>
                  </div>
                ) : (
                  // Des plans existent mais l'instant courant tombe dans un trou → écran noir.
                  null
                )}

                {/* Transition à shader : l'image finale est calculée sur la carte
                    graphique et posée par-dessus. Les lecteurs restent dessous,
                    ce sont eux les textures. Cachée d'office : l'effet ne
                    l'affiche que s'il a vraiment pu dessiner. */}
                <canvas ref={glCanvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "none", zIndex: 2, pointerEvents: "none" }} />

                {/* Voiles (flash blanc, fondu au noir), identiques à l'export. Pas
                    pour les shaders : la toile les pose déjà, et deux couches
                    doubleraient le flash. */}
                {!transitionGl && activeTrans && activeTrans.flash > 0 && (
                  <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: activeTrans.flash, pointerEvents: "none", zIndex: 3 }} />
                )}
                {!transitionGl && activeTrans && activeTrans.dark > 0 && (
                  <div style={{ position: "absolute", inset: 0, background: "#000", opacity: activeTrans.dark, pointerEvents: "none", zIndex: 3 }} />
                )}

                {/* incrustations (PIP) — déplaçables/redimensionnables/pivotables.
                    Triées par piste croissante : l'ordre du DOM fait le z-order (piste haute = au-dessus). */}
                {[...overlays].sort((a, b) => (a.track ?? 0) - (b.track ?? 0)).map((o) => {
                  const hidden = hiddenLanes.has(`v${o.track ?? 0}`);
                  const isActive = time >= o.offset && time < o.offset + overlayTimelineDur(o) && !hidden;
                  /* Le lecteur n'est monté qu'AUTOUR de sa fenêtre d'activité.

                     Toutes les incrustations gardaient un <video> monté en
                     permanence, même celles qui n'apparaissent qu'à la fin du
                     montage : dix incrustations, dix lecteurs média vivants du
                     début à la fin, sur les cinquante que Chrome tolère. La
                     marge (2 s) laisse le temps de charger avant l'entrée à
                     l'image, donc le passage reste net. */
                  const MARGE = 2;
                  const monte = o.kind !== "video" || (
                    time >= o.offset - MARGE && time < o.offset + overlayTimelineDur(o) + MARGE
                  );
                  const sel = selectedOverlayId === o.id;
                  return (
                    <div
                      key={o.id}
                      className={"mz-pip" + (sel ? " sel" : "")}
                      style={{
                        position: "absolute", left: o.x + "%", top: o.y + "%",
                        width: 50 * o.scale + "%",
                        transform: `translate(-50%,-50%) rotate(${o.rotation}deg)`,
                        opacity: isActive ? o.opacity : 0,
                        pointerEvents: isActive ? "auto" : "none",
                        cursor: "move", zIndex: 5,
                      }}
                      onPointerDown={(e) => onOverlayPointerDown(e, "overlay", o.id)}
                    >
                      {(() => {
                        /* Effets de l'objet (ombre portée, contour, coins arrondis).
                           Les distances sont en % de la largeur de l'incrustation : on
                           la calcule ici en pixels écran pour que l'aperçu montre
                           exactement la géométrie de l'export. */
                        const largeurPx = (stageW || 0) * 0.5 * o.scale;
                        const eff = overlayEffectCss(o, largeurPx);
                        const rayon = (o.radius ?? 0) > 0 ? `${((o.radius ?? 0) / 100) * largeurPx}px` : undefined;
                        const st: React.CSSProperties = {
                          width: "100%", display: "block", pointerEvents: "none",
                          filter: [overlayFilterCss(o), eff].filter(Boolean).join(" ") || undefined,
                          borderRadius: rayon,
                        };
                        return o.kind === "video" ? (
                          monte ? (
                            <video
                              ref={(el) => { if (el) overlayVideoRefs.current.set(o.id, el); else overlayVideoRefs.current.delete(o.id); }}
                              src={o.src}
                              playsInline muted={(o.vol ?? 1) === 0} draggable={false}
                              style={st}
                            />
                          ) : null
                        ) : (
                          <img src={o.src} alt="" draggable={false} style={st} />
                        );
                      })()}
                      {sel && <button className="mz-ov-del" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeOverlay(o.id)}><VIcon name="x" size={11} /></button>}
                      {sel && <TransformHandles scale={o.scale} onScale={(s) => updateOverlay(o.id, { scale: s })} onRotate={(d) => updateOverlay(o.id, { rotation: d })} />}
                    </div>
                  );
                })}

                {/* titres */}
                {activeTitles.map((ti) => {
                  const look = titleLook(ti);
                  const unit = (ti.scale ?? 1) * previewScale;
                  return (
                  <div
                    key={ti.id}
                    className={"mz-ov-item" + (selectedTitleId === ti.id || titresSel.has(ti.id) ? " sel" : "")}
                    style={{
                      left: ti.x + "%", top: ti.y + "%",
                      fontFamily: ti.fontFamily ? `'${ti.fontFamily}', system-ui, sans-serif` : (FONT_CSS[ti.font] || FONT_CSS.archivo),
                      fontWeight: titleWeight(ti),
                      fontStyle: titleItalic(ti) ? "italic" : "normal",
                      color: ti.color, fontSize: TITLE_BASE_FONT * (ti.scale ?? 1) * previewScale,
                      /* Habillage : mêmes réglages que l'export, à la même
                         géométrie. `unit` est la taille d'un point de dessin à
                         l'écran, donc l'échelle du titre multipliée par celle de
                         l'aperçu — sans quoi une ombre garderait la même taille
                         quand on grossit le texte. */
                      textAlign: look.align,
                      textShadow: titleShadowCss(ti, unit),
                      WebkitTextStroke: look.stroke && look.strokeW > 0 ? `${look.strokeW * unit}px ${look.stroke}` : undefined,
                      paintOrder: "stroke fill",
                      opacity: look.opacity,
                      letterSpacing: look.letterSpacing ? `${look.letterSpacing}em` : undefined,
                      background: look.bg !== "transparent" ? withAlpha(look.bg, look.bgOpacity) : undefined,
                      // Marge intérieure TOUJOURS posée, fond ou pas : elle entre
                      // dans la largeur de la boîte que l'export calcule aussi.
                      padding: `${look.padY * unit}px ${look.padX * unit}px`,
                      borderRadius: look.bg !== "transparent" ? look.radius * unit : undefined,
                      lineHeight: TITLE_LINE_HEIGHT,
                      /* Largeur calée sur le TEXTE.

                         Elle a d'abord été laissée au navigateur : une boîte en
                         position absolue sans largeur ne peut pas dépasser la
                         place qui reste à sa droite, donc un titre centré était
                         plafonné à la moitié du cadre. Puis figée à `maxWidth` :
                         elle ne suivait alors plus la taille du texte, le cadre
                         de sélection restait immense autour d'un petit mot, et un
                         fond couvrait toute la boîte au lieu du texte.

                         Elle est maintenant MESURÉE sur le texte, par la fonction
                         dont se sert aussi l'export pour peindre son fond.
                         `maxWidth` retrouve son seul rôle : décider où le texte
                         revient à la ligne. */
                      width: editingTitleId === ti.id ? "auto" : titleBoxWidth(ti, activeFmt.w) * unit,
                      minWidth: editingTitleId === ti.id ? titleBoxWidth(ti, activeFmt.w) * unit : undefined,
                      maxWidth: editingTitleId === ti.id ? `${ti.maxWidth ?? TITLE_DEFAULT_MAX_WIDTH}%` : undefined,
                      /* `pre` et non `pre-wrap` : les retours à la ligne sont
                         DÉJÀ calculés, par la même fonction que l'export. Laissé
                         libre de replier, le navigateur recoupait ces lignes dès
                         qu'une d'elles frôlait la largeur de la boîte, et
                         l'aperçu ne montrait plus le découpage du fichier. */
                      whiteSpace: "pre", zIndex: 8, // au-dessus des incrustations (le texte reste visible/cliquable)
                      transform: `translate(-50%,-50%) rotate(${ti.rotation ?? 0}deg)`,
                      animation: ti.anim === "rise" ? "mzRise .35s var(--ease)" : ti.anim === "pop" ? "mzPop .3s var(--ease)" : undefined,
                    }}
                    onPointerDown={(e) => { if (editingTitleId === ti.id) return; onOverlayPointerDown(e, "title", ti.id); }}
                    onDoubleClick={(e) => { e.stopPropagation(); setPlaying(false); setSelectedTitleId(ti.id); setEditingTitleId(ti.id); }}
                    title={editingTitleId === ti.id ? undefined : t('doubleClickToEdit')}
                  >
                    <span
                      ref={editingTitleId === ti.id ? titleEditRef : undefined}
                      contentEditable={editingTitleId === ti.id}
                      suppressContentEditableWarning
                      spellCheck={false}
                      /* En édition, le texte redevient SÉLECTIONNABLE.

                          Le conteneur porte `user-select: none` — nécessaire pour
                          qu'un glissement déplace le titre au lieu de sélectionner
                          ses lettres. Mais il s'applique aussi au champ d'édition :
                          le double-clic ne sélectionnait pas le mot et le curseur
                          ne se posait pas, si bien que la retouche à même l'aperçu
                          paraissait ne pas exister. Et le texte redevient
                          repliable : en édition on montre la phrase entière, pas
                          les lignes calculées. */
                      style={editingTitleId === ti.id
                        ? { outline: "none", cursor: "text", userSelect: "text", WebkitUserSelect: "text", whiteSpace: "pre-wrap" }
                        : { outline: "none", cursor: "inherit" }}
                      onPointerDown={editingTitleId === ti.id ? (e) => e.stopPropagation() : undefined}
                      onKeyDown={editingTitleId === ti.id ? (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } } : undefined}
                      onBlur={editingTitleId === ti.id ? (e) => { const txt = (e.currentTarget.textContent || "").trim(); if (txt) updateTitle(ti.id, { text: txt }); setEditingTitleId(null); } : undefined}
                    >
                      {/* Hors édition, l'aperçu pose LES MÊMES lignes que l'export au lieu
                          de laisser le navigateur replier à sa façon : les retours à la
                          ligne vus ici sont ceux du fichier rendu. En édition on montre le
                          texte brut, c'est celui-là qu'on corrige. */}
                      {editingTitleId === ti.id
                        ? ti.text
                        : titleLines(
                            { ...ti, text: ti.anim === "type" ? ti.text.slice(0, Math.max(0, Math.min(ti.text.length, Math.floor((time - ti.start) * 16)))) : ti.text },
                            activeFmt.w,
                          ).map((ln) => applySubCase(ln, look.caseMode)).join("\n")}
                    </span>
                    {selectedTitleId === ti.id && editingTitleId !== ti.id && <button className="mz-ov-del" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeTitle(ti.id)}><VIcon name="x" size={11} /></button>}
                    {selectedTitleId === ti.id && editingTitleId !== ti.id && <TransformHandles scale={ti.scale ?? 1} onScale={(s) => updateTitle(ti.id, { scale: s })} onRotate={(d) => updateTitle(ti.id, { rotation: d })} />}
                  </div>
                  );
                })}

                {/* stickers */}
                {activeStickers.map((s) => (
                  <div
                    key={s.id}
                    className={"mz-ov-item" + (selectedStickerId === s.id ? " sel" : "")}
                    style={{ left: s.x + "%", top: s.y + "%", fontSize: 34 * s.scale, transform: `translate(-50%,-50%) rotate(${s.rotation ?? 0}deg)` }}
                    onPointerDown={(e) => onOverlayPointerDown(e, "sticker", s.id)}
                  >
                    {s.isImage ? <img src={s.glyph} alt="" draggable={false} style={{ width: 40 * s.scale, height: 40 * s.scale, objectFit: "contain", pointerEvents: "none" }} /> : s.glyph}
                    {selectedStickerId === s.id && <button className="mz-ov-del" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeSticker(s.id)}><VIcon name="x" size={11} /></button>}
                    {selectedStickerId === s.id && <TransformHandles scale={s.scale} onScale={(sc) => updateSticker(s.id, { scale: sc })} onRotate={(d) => updateSticker(s.id, { rotation: d })} />}
                  </div>
                ))}

                {/* sous-titres incrustés — déplaçables/redimensionnables/éditables */}
                {activeCaption && (
                  <div
                    className={"mz-cap-wrap mz-cap-move" + (subSelected ? " sel" : "")}
                    // Pas de scale() ici : l'échelle est portée par la police et les
                    // marges (subtitleBoxCss), sinon on étire une image déjà rendue.
                    style={{ left: capPos.x + "%", top: capPos.y + "%", transform: "translate(-50%,-50%)" }}
                    onPointerDown={(e) => { if (editingCaptionId === activeCaption.id) return; setSelectedCaptionId(activeCaption.id); onOverlayPointerDown(e, "caption", "sub"); }}
                    onDoubleClick={(e) => { e.stopPropagation(); setPlaying(false); setSelectedCaptionId(activeCaption.id); setEditingCaptionId(activeCaption.id); }}
                    title={editingCaptionId === activeCaption.id ? undefined : t('doubleClickToEdit')}
                  >
                    <div className="mz-cap-box" style={{
                      // Rendu piloté par la source unique partagée avec l'assistant client
                      // et répliquée par l'export canvas (cf. subtitleBoxCss / drawCaptions).
                      ...subtitleBoxCss(capStyle, previewScale),
                      transform: capStyle.rotation ? `rotate(${capStyle.rotation}deg)` : undefined,
                    } as React.CSSProperties}>
                      {/* Fond sur son propre calque : il peut être élargi, rehaussé
                          et décalé sans déplacer le texte. */}
                      {(() => { const bg = subBgLayerCss(capStyle, previewScale); return bg ? <span aria-hidden style={bg as React.CSSProperties} /> : null; })()}
                      {editingCaptionId === activeCaption.id ? (
                        <span
                          ref={captionEditRef}
                          contentEditable suppressContentEditableWarning spellCheck={false}
                          style={{ outline: "none", cursor: "text", color: capStyle.fg }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
                          onBlur={(e) => { const txt = (e.currentTarget.textContent || "").trim(); if (txt) updateCaption(activeCaption.id, { text: txt }); setEditingCaptionId(null); }}
                        >{activeCaption.text}</span>
                      ) : capStyle.curve ? (
                        // Texte cintré : un caractère par span, posé sur l'arc selon
                        // la MÊME formule que l'export (curveLayout). L'animation mot
                        // par mot n'a pas de sens ici, la courbe l'emporte.
                        (() => {
                          const chars = Array.from(applySubCase(capText, capStyle.caseMode));
                          const lay = curveLayout(chars.length, capStyle.curve, SUB_BASE_FONT * capStyle.scale * previewScale);
                          return <span style={{ display: "inline-block", whiteSpace: "pre", color: capStyle.fg, position: "relative", zIndex: 1 }}>
                            {chars.map((ch, i) => (
                              <span key={i} style={{ display: "inline-block", transform: `translateY(${lay[i].dy}px) rotate(${lay[i].deg}deg)` }}>{ch}</span>
                            ))}
                          </span>;
                        })()
                      ) : capStyle.anim === "none" ? (
                        // Sous-titre simple : le texte s'affiche d'un bloc, sans
                        // révélation ni surlignage. Tous les réglages de style
                        // (contour, casse, couleur, ombre…) s'appliquent quand même.
                        // Une ligne = un bloc insécable : le pli tombe exactement là
                        // où l'export le met, et jamais une ligne de plus que la limite.
                        <span style={{ color: capStyle.fg, position: "relative", zIndex: 1 }}>
                          {capLines.map((ln, li) => (
                            <span key={li} style={{ display: "block", whiteSpace: "nowrap" }}>{ln.join(" ")}</span>
                          ))}
                        </span>
                      ) : capLines.map((ln, li, allLines) => {
                        // Révélation mot par mot, ligne par ligne. La progression se
                        // compte sur le MORCEAU affiché : le surplus est parti au
                        // sous-titre suivant, il ne consomme plus de temps ici.
                        const nWords = allLines.reduce((n, l) => n + l.length, 0);
                        const before = allLines.slice(0, li).reduce((n, l) => n + l.length, 0);
                        const cStart = capPart?.start ?? activeCaption.start;
                        const cEnd = capPart?.end ?? activeCaption.end;
                        const progress = (time - cStart) / Math.max(0.1, cEnd - cStart);
                        const activeIdx = Math.min(nWords - 1, Math.floor(progress * nWords));
                        return (
                          <span key={li} style={{ display: "block", whiteSpace: "nowrap", position: "relative", zIndex: 1 }}>
                            {ln.map((w, wi) => {
                              const i = before + wi;
                              // Chaque mot apparaît (fondu + pop) à son tour, le mot
                              // actif est surligné et légèrement agrandi.
                              const wordProg = Math.max(0, Math.min(1, progress * nWords - i));
                              const revealed = i <= activeIdx;
                              return (
                                <span
                                  key={i}
                                  className="mz-cap-word"
                                  style={{
                                    color: i === activeIdx ? capStyle.hi : capStyle.fg,
                                    opacity: revealed ? 0.35 + 0.65 * wordProg : 0.28,
                                    transform: `scale(${i === activeIdx ? 0.9 + 0.1 * wordProg + 0.06 : revealed ? 1 : 0.92})`,
                                    display: "inline-block",
                                    transition: "color .12s, opacity .12s, transform .12s var(--ease)",
                                  }}
                                >
                                  {w}{wi < ln.length - 1 ? "\u00A0" : ""}
                                </span>
                              );
                            })}
                          </span>
                        );
                      })}
                    </div>
                    {subSelected && <span className="mz-ov-resize" onPointerDown={(e) => onOverlayResizeDown(e, "caption", "sub", capStyle.scale)} title={t('resizeTitle')} />}
                  </div>
                )}

                {/* barre de progression */}
                {showProgressBar && total > 0 && (
                  <div className="mz-progressbar-track">
                    <div className="mz-progressbar-fill" style={{ width: (time / total) * 100 + "%" }} />
                  </div>
                )}
              </div>
            </div>

            {exporting && (
              <div className="mz-ai-overlay">
                <div className="mz-orb"><span className="mz-spark"><VIcon name="sparkles" size={26} /></span></div>
                <div className="mz-ai-overlay-title">{exportPhase === "render" ? t('renderingInProgress') : t('convertingMp4')}</div>
                <div className="mz-ai-progress"><span style={{ width: Math.round(exportProgress * 100) + "%" }} /></div>
              </div>
            )}
          </div>
          <div className="mz-playbar">
            <button className="mz-play" onClick={togglePlay} disabled={!clips.length}><VIcon name={playing ? "pause" : "play"} size={19} /></button>
            <span className="mz-time">{fmt(time)}</span>
            <div className="mz-scrub" ref={scrubRef} onClick={onScrub}>
              {/* Position posée par `poserCurseur`, comme le curseur de la timeline. */}
              <div className="mz-scrub-fill" ref={scrubFillRef} />
              <div className="mz-scrub-knob" ref={scrubKnobRef} />
            </div>
            <span className="mz-time" style={{ color: "var(--ink-3)" }}>{fmt(total)}</span>
          </div>
        </div>
      </div>

      {/* poignée de redimensionnement de la timeline */}
      <div className="a-vresize" onPointerDown={startTimelineResize} title={t('resizeTimelineTitle')}><span className="a-vresize-grip" /></div>

      {/* timeline dock */}
      <div className="a-timeline" style={{ height: timelineH }}>
        <div className="a-tl-bar">
          {/* Bouton d'OUTIL, pas d'action : il reste enfoncé tant que la lame est
              en main, et n'est plus grisé faute de sélection — c'est justement
              le principe, on coupe sans avoir sélectionné au préalable. */}
          <button className={"a-tl-tool" + (outilLame ? " on" : "")} onClick={() => { setOutilLame((v) => !v); setApercuCoupe(null); }}
            title={`${t('splitShort')} — C`}>
            <VIcon name="split" size={15} /> {t('splitShort')}
          </button>
          <button className="a-tl-tool" disabled={!(selectedClipId || selectedOverlayId)} onClick={duplicateSelectedAny}><VIcon name="copy" size={15} /> {t('duplicate')}</button>
          <button className="a-tl-tool" disabled={!(selectedClipId || selectedOverlayId || selectedAudioId || selectedTitleId || selectedCaptionId || selectedStickerId || multiSel.size)} onClick={deleteSelected}><VIcon name="trash" size={15} /> {t('delete')}</button>
          <div style={{ flex: 1 }} />
          <span className="mz-sec-label">{t('clipsCountTimeline', { count: clips.length, time: fmt(total) })}</span>
          {/* Hauteur des pistes : glisser ↕ (façon CapCut). */}
          <button className="mz-hbtn" title={t('trackHeightTitle')} style={{ cursor: "ns-resize", touchAction: "none" }}
            onPointerDown={onTsDown} onPointerMove={onTsMove} onPointerUp={onTsUp}
            onDoubleClick={() => { setTrackScale(1); try { localStorage.setItem("klip-mz-trackScale", "1"); } catch {} }}>
            <VIcon name="rows" size={15} />
          </button>
          <button className="mz-hbtn" onClick={() => setPps((p) => Math.max(10, Math.round(p / 1.3)))}><VIcon name="zoomOut" size={15} /></button>
          <button className="mz-hbtn" onClick={() => setPps((p) => Math.min(160, Math.round(p * 1.3)))}><VIcon name="zoomIn" size={15} /></button>
        </div>
        <div className="a-tl-scroll" ref={tlScrollRef}
          onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setTlFileOver(true); } }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setTlFileOver(false); }}
          onDrop={(e) => { e.preventDefault(); setTlFileOver(false); if (e.dataTransfer.files?.length) importFilesToTimeline(e.dataTransfer.files, e.clientX, e.clientY); }}
          style={{ outline: tlFileOver ? "2px solid var(--mint-2)" : undefined, outlineOffset: -3 }}>
          <div
            className={"a-tl-inner" + (outilLame ? " lame" : "")}
            ref={tlInnerRef}
            /* Phase de CAPTURE : le clic est traité avant d'atteindre l'élément.
               Sur un clip, `onPointerDown` démarre sinon un glisser-déposer, et
               la lame déplacerait le plan au lieu de le couper. */
            onPointerMoveCapture={(e) => {
              if (!outilLame) { if (apercuCoupe !== null) setApercuCoupe(null); return; }
              const sur = (e.target as HTMLElement).closest("[data-lame]");
              const rect = tlInnerRef.current?.getBoundingClientRect();
              if (!sur || !rect) { if (apercuCoupe !== null) setApercuCoupe(null); return; }
              const t = (e.clientX - rect.left - LANE_LABEL_W) / sceneRef.current.pps;
              setApercuCoupe(Number.isFinite(t) && t >= 0 ? t : null);
            }}
            onPointerLeave={() => setApercuCoupe(null)}
            onPointerDownCapture={(e) => {
              if (!outilLame || e.button !== 0) return;
              const surElement = (e.target as HTMLElement).closest("[data-lame]");
              if (!surElement) return;
              e.preventDefault();
              e.stopPropagation();
              couperAuClic(e);
            }}
            style={{ width: LANE_LABEL_W + trackW + 30, ["--tscale" as string]: trackScale, ["--lane-label-w" as string]: `${LANE_LABEL_W}px` } as React.CSSProperties}
            onPointerDown={(e) => {
              // Sur une zone vide : un simple clic déplace le curseur ; un glissement trace
              // un rectangle de sélection multiple (façon explorateur de fichiers).
              const el = e.target as HTMLElement;
              if (el.closest(".a-clip, .a-chip, .a-wave-bar, .a-trim, .a-fade-dot, .a-lane-label, .a-ruler")) return;
              // Gouttière des labels : elle est COLLÉE à gauche du conteneur qui
              // défile, donc on se repère sur lui. Mesurer depuis le contenu
              // (`tlInnerRef`) donnait une position en coordonnées de piste : dès
              // qu'on avait fait défiler, ce test bloquait des clics légitimes au
              // milieu du montage et laissait passer ceux sur la gouttière.
              const bordScroll = tlScrollRef.current?.getBoundingClientRect().left ?? 0;
              if (e.clientX - bordScroll < LANE_LABEL_W) return;
              try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
              selDragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
            }}
            onPointerMove={(e) => {
              const d = selDragRef.current;
              if (!d) return;
              if (!d.moved && Math.abs(e.clientX - d.startX) < 4 && Math.abs(e.clientY - d.startY) < 4) return;
              d.moved = true;
              const x = Math.min(d.startX, e.clientX), y = Math.min(d.startY, e.clientY);
              const w = Math.abs(e.clientX - d.startX), h = Math.abs(e.clientY - d.startY);
              setSelRect({ x, y, w, h });
              // items intersectés (data-selid)
              const found = new Set<string>();
              tlInnerRef.current?.querySelectorAll<HTMLElement>("[data-selid]").forEach((node) => {
                const r = node.getBoundingClientRect();
                if (r.right >= x && r.left <= x + w && r.bottom >= y && r.top <= y + h) { const sid = node.dataset.selid; if (sid) found.add(sid); }
              });
              setMultiSel(found);
              setSelectedClipId(null); setSelectedOverlayId(null); setSelectedAudioId(null);
            }}
            onPointerUp={(e) => {
              const d = selDragRef.current; selDragRef.current = null;
              try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
              setSelRect(null);
              if (d && !d.moved) { deselectAll(); rulerSeek(e.clientX); } // simple clic dans le vide → désélectionne + curseur
            }}
          >
            {/* COIN HAUT-GAUCHE.
                Le ruban ne colle qu'en HAUT : ses graduations défilent avec le
                contenu et glissaient donc sous la gouttière, où l'on continuait à
                lire « 0:04 » par-dessus les noms de pistes. Son ombre ne pouvait
                pas les masquer — l'ombre appartient au fond du ruban, et ses
                enfants se peignent au-dessus.
                Ce bloc-ci colle dans les DEUX sens et passe devant tout le monde.
                La marge négative annule sa propre hauteur : il se superpose au
                ruban au lieu de le pousser vers le bas. */}
            <div className="a-tl-coin" aria-hidden />
            <div
              className="a-ruler"
              ref={rulerRef}
              style={{ marginLeft: LANE_LABEL_W, width: trackW, cursor: "pointer" }}
              onPointerDown={onRulerDown}
              onPointerMove={onRulerMove}
              onPointerUp={onRulerUp}
            >
              {ticks.map((s) => (
                <div key={s} className="a-tick" style={{ left: s * pps }}><span>{fmt(s).slice(0, -2)}</span></div>
              ))}
            </div>
            <div className={"a-lane" + (videoTrackCount === 0 && dropLane === "new" ? " nt-hint" : "")} style={{ height: laneH("video"), order: 4 }} data-tllane="video">
              <LaneResize laneKey="video" />
              <div className="a-lane-label" style={{ display: "flex", alignItems: "center", gap: 4 }}><VIcon name="video" size={13} /> <span className="trunc">{`${t('labelVideo')} 1`}</span><LaneControls laneKey="video" /></div>
              <div
                className="a-lane-track"
                // La piste entière est une cible : on lâche où on veut, la coupe la
                // plus proche prend la transition. Le rond seul ratait trop souvent.
                onDragOver={(e) => {
                  if (!estGlisserTransition(e.dataTransfer)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  const id = jonctionLaPlusProche(e.clientX);
                  if (id !== jonctionSurvolee) setJonctionSurvolee(id);
                }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setJonctionSurvolee(null); }}
                onDrop={(e) => {
                  if (!estGlisserTransition(e.dataTransfer)) return;
                  e.preventDefault();
                  const transId = transitionGlissee(e.dataTransfer);
                  const cible = jonctionSurvolee || jonctionLaPlusProche(e.clientX);
                  setJonctionSurvolee(null);
                  if (transId && cible) poserTransition(cible, transId);
                }}
              >
                {clips.length === 0 && (
                  <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>{t('importFirstRush')}</span>
                )}
                {clipStarts.map((c, i) => (
                  <div key={c.id} style={{ position: "absolute", left: c.start * pps, display: "flex", alignItems: "center" }}>
                    <div
                      data-selid={c.id}
                      className={"a-clip" + (selectedClipId === c.id || multiSel.has(c.id) ? " on" : "")}
                      style={{ width: c.dur * pps, height: blockH("video"), position: "relative", cursor: tlGhost?.id === c.id ? "grabbing" : "grab", touchAction: "none", opacity: tlGhost?.id === c.id ? 0.3 : 1,
                        background: strips[c.id] ? undefined : (c.kind === "video" ? "linear-gradient(150deg,#2b8d57,#0c2a1d)" : "linear-gradient(150deg,#c8792f,#5e3a1a)") }}
                      onPointerDown={(e) => startTlDrag(e, c.id, "clip")}
                      onPointerMove={onTlDragMove}
                      onPointerUp={onTlDragUp}
                      data-lame={`clip:${c.id}`}
                      onContextMenu={(e) => { e.preventDefault(); selectClip(c.id); setClipMenu({ x: e.clientX, y: e.clientY, id: c.id, kind: "clip" }); }}
                    >
                      <ClipStrip data={strips[c.id]} width={c.dur * pps} height={blockH("video")} filter={clipFilterCss(c)} />
                      {/* Le son fait UN avec la vidéo : spectre audio intégré en bas du plan (façon CapCut). */}
                      {c.kind === "video" && (c.vol ?? 1) > 0 && clipWaves[c.src] && (
                        <ClipWave peaks={clipWaves[c.src]} srcDur={c.srcDur} de={c.trimStart} a={c.trimEnd} />
                      )}
                      {/* Rampe de fondu du son, dessinée sur le plan (mêmes repères que l'audio). */}
                      {c.kind === "video" && (c.vol ?? 1) > 0 && (
                        <FadeRamp className="a-clip-fade" w={c.dur * pps}
                          fi={Math.max(0, Math.min(c.dur, c.audioFadeIn ?? 0)) * pps}
                          fo={Math.max(0, Math.min(c.dur, c.audioFadeOut ?? 0)) * pps}
                          dim="rgba(0,0,0,.4)" />
                      )}
                      <span className="a-clip-badge"><VIcon name={c.kind === "photo" ? "image" : "video"} size={10} /></span>
                      <span className="a-clip-dur">{c.dur.toFixed(1)}s</span>
                      <span className="a-clip-lbl">{c.name}</span>
                      {selectedClipId === c.id && (
                        <>
                          {c.kind === "video" && (
                            <div className="a-trim a-trim-l" draggable={false} onDragStart={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => startTrim(e, c, "start")} onPointerMove={onTrimMove} onPointerUp={endTrim} title={t('trimStartTitle')} />
                          )}
                          <div className="a-trim a-trim-r" draggable={false} onDragStart={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => startTrim(e, c, "end")} onPointerMove={onTrimMove} onPointerUp={endTrim} title={c.kind === "photo" ? t('clipDurationTitle') : t('trimEndTitle')} />
                        </>
                      )}
                    </div>
                    {i < clipStarts.length - 1 && (() => {
                      const suivant = clipStarts[i + 1];
                      const pose = TRANSITIONS.find((tr) => tr.id === suivant.transitionIn && tr.id !== "cut");
                      const vise = jonctionSurvolee === suivant.id;
                      const choisie = selectedTransId === suivant.id;
                      return (
                        <button
                          className={"a-trans-pill" + (pose ? " posee" : "") + (choisie ? " active" : "") + (vise ? " drop" : "")}
                          style={{
                            position: "absolute", left: c.dur * pps,
                            // Un objet qui a une durée occupe la hauteur de sa piste et
                            // la largeur de son temps, comme tout le reste de la timeline.
                            ...(pose ? { width: Math.max(18, (suivant.transitionDur || 0.5) * pps), height: blockH("video") } : {}),
                          }}
                          title={pose ? `${tc(`transition.${suivant.transitionIn}`)} · ${(suivant.transitionDur || 0).toFixed(1)}s` : t('transitionDropHere')}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            if (!pose) { selectClip(suivant.id); setTool("transitions"); return; }
                            // Sélectionner la TRANSITION, pas le plan : la touche Suppr
                            // doit retirer la transition et laisser les deux plans en place.
                            deselectAll();
                            setSelectedTransId(suivant.id);
                            setSelectedClipId(suivant.id);
                            setTool("transitions");
                          }}
                          onDragOver={(ev) => {
                            if (!estGlisserTransition(ev.dataTransfer)) return;
                            ev.preventDefault();
                            ev.dataTransfer.dropEffect = "copy";
                            if (jonctionSurvolee !== suivant.id) setJonctionSurvolee(suivant.id);
                          }}
                          onDrop={(ev) => {
                            if (!estGlisserTransition(ev.dataTransfer)) return;
                            ev.preventDefault();
                            ev.stopPropagation();
                            const id = transitionGlissee(ev.dataTransfer);
                            setJonctionSurvolee(null);
                            if (id) poserTransition(suivant.id, id);
                          }}
                        >
                          <span className="a-trans-glyph">{pose?.glyph || "▮▮"}</span>
                          {pose && (
                            <>
                              <span className="a-trans-trim a-trans-trim-l" title={t('duration')}
                                onPointerDown={(ev) => startTransTrim(ev, suivant, -1)} onPointerMove={onTransTrimMove} onPointerUp={endTransTrim} />
                              <span className="a-trans-trim a-trans-trim-r" title={t('duration')}
                                onPointerDown={(ev) => startTransTrim(ev, suivant, 1)} onPointerMove={onTransTrimMove} onPointerUp={endTransTrim} />
                              <span className="a-trans-del" title={t('deleteTransition')}
                                onPointerDown={(ev) => ev.stopPropagation()}
                                onClick={(ev) => { ev.stopPropagation(); updateClip(suivant.id, { transitionIn: "cut" }); setSelectedTransId(null); }}>×</span>
                            </>
                          )}
                        </button>
                      );
                    })()}
                    {/* Fondus du son du plan : points blancs à tirer (hors du plan pour ne pas
                        être rognés par l'overflow ; visibles quand le plan a du son). */}
                    {c.kind === "video" && (c.vol ?? 1) > 0 && (() => {
                      const fi = Math.max(0, Math.min(c.dur, c.audioFadeIn ?? 0)) * pps;
                      const fo = Math.max(0, Math.min(c.dur, c.audioFadeOut ?? 0)) * pps;
                      return (
                        <>
                          <span className="a-fade-dot" style={{ left: Math.max(0, fi) - 5, top: 3 }} title={t('fadeIn')}
                            onPointerDown={(e) => startClipFade(e, c, "audioFadeIn")} onPointerMove={onClipFadeMove} onPointerUp={onClipFadeUp} />
                          <span className="a-fade-dot" style={{ left: c.dur * pps - Math.max(0, fo) - 5, top: 3 }} title={t('fadeOut')}
                            onPointerDown={(e) => startClipFade(e, c, "audioFadeOut")} onPointerMove={onClipFadeMove} onPointerUp={onClipFadeUp} />
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
            {Array.from({ length: videoTrackCount }).map((_, idx) => {
              const track = videoTrackCount - 1 - idx; // le haut de la timeline = la piste la plus haute (au-dessus)
              const isTop = idx === 0;
              const laneOverlays = overlays.filter((o) => (o.track ?? 0) === track);
              return (
              <div className={"a-lane" + (isTop && dropLane === "new" ? " nt-hint" : "")} style={{ height: laneH(`v${track}`), order: 3 }} data-tllane={`v${track}`} key={"vtrack-" + track}>
                <LaneResize laneKey={`v${track}`} />
                <div className="a-lane-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <VIcon name="video" size={13} />
                  <span className="trunc">{`${t('labelVideo')} ${track + 2}`}</span>
                  <LaneControls laneKey={`v${track}`} />
                  <span className="a-lane-acts">
                    <LaneDelete genre="v" index={track} />
                    {isTop && <LaneAdd onClick={() => setExtraVideoTracks((n) => n + 1)} title={t('addVideoTrack')} />}
                  </span>
                </div>
                <div className={"a-lane-track" + (dropLane === `v${track}` && dragActive ? " drop-hot" : "")}>
                  {overlays.length === 0 && isTop && (
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>{t('addOverlayHint')}</span>
                  )}
                  {laneOverlays.map((o) => (
                    <div
                      key={o.id}
                      data-selid={o.id}
                      className={"a-chip" + (selectedOverlayId === o.id || multiSel.has(o.id) ? " on" : "")}
                      style={{ left: o.offset * pps, width: Math.max(24, overlayTimelineDur(o) * pps), top: 2, height: blockH(`v${o.track ?? 0}`), cursor: tlGhost?.id === o.id ? "grabbing" : "grab", touchAction: "none", opacity: tlGhost?.id === o.id ? 0.3 : 1,
                        background: strips[o.id] ? undefined : (o.kind === "video" ? "linear-gradient(150deg,#2b8d57,#0c2a1d)" : "linear-gradient(150deg,#c8792f,#5e3a1a)") }}
                      title={o.name}
                      onPointerDown={(e) => startTlDrag(e, o.id, "overlay")}
                      onPointerMove={onTlDragMove}
                      onPointerUp={onTlDragUp}
                      data-lame={`overlay:${o.id}`}
                      onContextMenu={(e) => { e.preventDefault(); selectOverlay(o.id); setClipMenu({ x: e.clientX, y: e.clientY, id: o.id, kind: "overlay" }); }}
                    >
                      <ClipStrip data={strips[o.id]} width={Math.max(24, overlayTimelineDur(o) * pps)} height={blockH(`v${o.track ?? 0}`)} filter={overlayFilterCss(o)} />
                      {o.kind === "video" && (o.vol ?? 1) > 0 && clipWaves[o.src] && (
                        <div className="a-clip-wave">
                          <svg width="100%" height="100%" preserveAspectRatio="none">
                            {clipWaves[o.src].map((p, wi) => { const arr = clipWaves[o.src]; const x = (wi / arr.length) * 100; const h = Math.max(10, p * 100); return <rect key={wi} x={`${x}%`} y={`${(100 - h) / 2}%`} width={`${100 / arr.length}%`} height={`${h}%`} fill="rgba(255,255,255,.8)" />; })}
                          </svg>
                        </div>
                      )}
                      {o.kind === "video" && (o.vol ?? 1) > 0 && ((o.audioFadeIn ?? 0) > 0 || (o.audioFadeOut ?? 0) > 0) && (() => {
                        const w = Math.max(24, overlayTimelineDur(o) * pps), H = 30;
                        const fi = Math.max(0, Math.min(overlayTimelineDur(o), o.audioFadeIn ?? 0)) * pps;
                        const fo = Math.max(0, Math.min(overlayTimelineDur(o), o.audioFadeOut ?? 0)) * pps;
                        return (
                          <svg className="a-clip-fade" viewBox={`0 0 ${Math.max(1, w)} ${H}`} preserveAspectRatio="none">
                            {fi > 0 && <><polygon points={`0,${H} ${fi},0 ${fi},${H}`} fill="rgba(0,0,0,.4)" /><line x1="0" y1={H} x2={fi} y2="0" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".95" /></>}
                            {fo > 0 && <><polygon points={`${w},${H} ${w - fo},0 ${w - fo},${H}`} fill="rgba(0,0,0,.4)" /><line x1={w} y1={H} x2={w - fo} y2="0" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".95" /></>}
                          </svg>
                        );
                      })()}
                      <span style={{ position: "absolute", left: 8, top: 4, fontSize: 9.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "calc(100% - 16px)" }}>{o.kind === "video" ? "🎬" : "🖼"} {o.name}</span>
                      {selectedOverlayId === o.id && (
                        <>
                          <div className="a-trim a-trim-l" onPointerDown={(e) => startOvTrim(e, o, "start")} onPointerMove={onOvTrimMove} onPointerUp={endOvTrim} title={t('trimStartTitle')} />
                          <div className="a-trim a-trim-r" onPointerDown={(e) => startOvTrim(e, o, "end")} onPointerMove={onOvTrimMove} onPointerUp={endOvTrim} title={o.kind === "photo" ? t('duration') : t('trimEndTitle')} />
                          {o.kind === "video" && (o.vol ?? 1) > 0 && (() => {
                            const fi = Math.max(0, Math.min(overlayTimelineDur(o), o.audioFadeIn ?? 0)) * pps;
                            const fo = Math.max(0, Math.min(overlayTimelineDur(o), o.audioFadeOut ?? 0)) * pps;
                            const w = Math.max(24, overlayTimelineDur(o) * pps);
                            return (
                              <>
                                <span className="a-fade-dot" style={{ left: Math.max(0, fi) - 5, top: 2 }} title={t('fadeIn')} onPointerDown={(e) => startOverlayFade(e, o, "audioFadeIn")} onPointerMove={onOverlayFadeMove} onPointerUp={onOverlayFadeUp} />
                                <span className="a-fade-dot" style={{ left: w - Math.max(0, fo) - 5, top: 2 }} title={t('fadeOut')} onPointerDown={(e) => startOverlayFade(e, o, "audioFadeOut")} onPointerMove={onOverlayFadeMove} onPointerUp={onOverlayFadeUp} />
                              </>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
            {Array.from({ length: audioTrackCount }).map((_, aIdx) => {
              const atrack = aIdx; // rangée audio (l'ordre n'affecte pas le mixage, uniquement l'organisation)
              const isFirstA = aIdx === 0;
              // `data-tllane` : sans lui, la piste audio n'était identifiable ni au
              // survol ni au dépôt, donc un fichier son lâché sur une piste précise
              // ne savait pas sur laquelle il tombait.
              return (
              <div className={"a-lane" + (aIdx === audioTrackCount - 1 && dropLane === "newaudio" ? " nt-hint" : "")} style={{ height: laneH(`a${atrack}`), order: 6 }} data-tllane={`a${atrack}`} key={"atrack-" + atrack}>
                <LaneResize laneKey={`a${atrack}`} />
                <div className="a-lane-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <VIcon name="music" size={13} />
                  <span className="trunc">{audioTrackCount > 1 ? `${t('railAudio')} ${atrack + 1}` : t('railAudio')}</span>
                  <LaneControls laneKey={`a${atrack}`} audio />
                  <span className="a-lane-acts">
                    <LaneDelete genre="a" index={atrack} />
                    {isFirstA && <LaneAdd onClick={() => setExtraAudioTracks((n) => n + 1)} title={t('addAudioTrack')} />}
                  </span>
                </div>
                <div className="a-lane-track">
                  {audioTracks.filter((a) => (a.track ?? 0) === atrack).map((a) => (
                    <div key={a.id} data-selid={a.id} className="a-wave-bar" style={{ left: a.offset * pps, width: a.dur * pps, top: 2, height: blockH(`a${a.track ?? 0}`), cursor: "grab", touchAction: "none", boxShadow: selectedAudioId === a.id || multiSel.has(a.id) ? "inset 0 0 0 2px var(--acid)" : undefined }} title={a.name}
                      onPointerDown={(e) => onAudioBarDown(e, a)} onPointerMove={onAudioBarMove} onPointerUp={onAudioBarUp}
                      data-lame={`audio:${a.id}`}
                      onContextMenu={(e) => { e.preventDefault(); setSelectedAudioId(a.id); setTool("audio"); setClipMenu({ x: e.clientX, y: e.clientY, id: a.id, kind: "audio" }); }}>
                      {a.waveform && a.waveform.length > 0 && (
                        <AudioWave peaks={a.waveform} srcDur={audioSrcDur(a)} de={a.srcOffset ?? 0} a={(a.srcOffset ?? 0) + a.dur} />
                      )}
                      {/* LIGNE DE NIVEAU. Elle traverse la piste à la hauteur du
                          volume et se tire à la souris. Masquée quand la piste
                          porte des points-clés : le volume y varie dans le temps,
                          une ligne droite mentirait sur ce qui se passe. */}
                      {!(a.volKeys && a.volKeys.length > 0) && (() => {
                        const h = blockH(`a${a.track ?? 0}`);
                        const v = Math.max(0, Math.min(NIVEAU_MAX, a.vol ?? 1));
                        return (
                          <div className="a-niveau" style={{ bottom: (v / NIVEAU_MAX) * h }}
                            title={`${t('audioLevel')} — ${Math.round(v * 100)} %`}
                            onPointerDown={(e) => onNiveauDown(e, a, h)}
                            onPointerMove={onNiveauMove}
                            onPointerUp={onNiveauUp}>
                            <span className="a-niveau-val">{Math.round(v * 100)}%</span>
                          </div>
                        );
                      })()}
                      <span style={{ position: "absolute", left: 6, top: 4, fontSize: 9.5, fontWeight: 700, color: "#fff" }}>{a.kind === "voiceover" ? "🎙" : "🎵"} {a.name}</span>
                      {(() => {
                        const w = a.dur * pps;
                        const fi = Math.max(0, Math.min(a.dur, a.fadeIn ?? 0)) * pps;
                        const fo = Math.max(0, Math.min(a.dur, a.fadeOut ?? 0)) * pps;
                        return (
                          <>
                            <FadeRamp w={w} fi={fi} fo={fo} dim="rgba(0,0,0,.34)" style={FADE_ABS} />
                            <span className="a-fade-dot" style={{ left: Math.max(0, fi) - 5 }} title={t('fadeIn')}
                              onPointerDown={(e) => startFadeDrag(e, a, "fadeIn")} onPointerMove={onFadeDragMove} onPointerUp={onFadeDragUp} />
                            <span className="a-fade-dot" style={{ left: Math.max(0, w - fo) - 5 }} title={t('fadeOut')}
                              onPointerDown={(e) => startFadeDrag(e, a, "fadeOut")} onPointerMove={onFadeDragMove} onPointerUp={onFadeDragUp} />
                          </>
                        );
                      })()}
                      {/* Poignées de rognage, comme sur un plan vidéo : on tire sur
                          un bord pour ne garder qu'un morceau du morceau. */}
                      {selectedAudioId === a.id && <>
                        <div className="a-trim a-trim-l" onPointerDown={(e) => startAudioTrim(e, a, "start")} onPointerMove={onAudioTrimMove} onPointerUp={endAudioTrim} title={t('trimStartTitle')} />
                        <div className="a-trim a-trim-r" onPointerDown={(e) => startAudioTrim(e, a, "end")} onPointerMove={onAudioTrimMove} onPointerUp={endAudioTrim} title={t('trimEndTitle')} />
                      </>}
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
            <div className="a-lane" style={{ height: laneH("subs"), order: 1 }}>
              <LaneResize laneKey="subs" />
              <div className="a-lane-label" style={{ display: "flex", alignItems: "center", gap: 4 }}><VIcon name="captions" size={13} /> <span className="trunc">{t('labelSubtitlesShort')}</span><LaneControls laneKey="subs" audio /></div>
              <div className="a-lane-track">
                {captions.map((c) => (
                  <div key={c.id} data-selid={c.id} className={"a-chip a-chip-cap" + (selectedCaptionId === c.id || multiSel.has(c.id) ? " on" : "")} style={{ left: c.start * pps, width: Math.max(20, (c.end - c.start) * pps), top: 2, height: blockH("subs"), cursor: "grab", touchAction: "none" }} title={c.text}
                    onPointerDown={(e) => onCaptionBarDown(e, c)} onPointerMove={onCaptionBarMove} onPointerUp={onCaptionBarUp}
                    data-lame={`caption:${c.id}`}
                    onContextMenu={(e) => { e.preventDefault(); setSelectedCaptionId(c.id); setClipMenu({ x: e.clientX, y: e.clientY, id: c.id, kind: "caption" }); }}>
                    <VIcon name="captions" size={11} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.text}</span>
                    {selectedCaptionId === c.id && <>
                      <div className="a-trim a-trim-l" onPointerDown={(e) => startCaptionTrim(e, c, "start")} onPointerMove={onCaptionTrimMove} onPointerUp={endCaptionTrim} title={t('trimStartTitle')} />
                      <div className="a-trim a-trim-r" onPointerDown={(e) => startCaptionTrim(e, c, "end")} onPointerMove={onCaptionTrimMove} onPointerUp={endCaptionTrim} title={t('trimEndTitle')} />
                    </>}
                  </div>
                ))}
              </div>
            </div>
            {Array.from({ length: textTrackCount }).map((_, idx) => {
            // Comme pour la vidéo : la rangée la plus HAUTE se dessine en premier,
            // donc en haut de la timeline. Rendues dans l'ordre des indices, une
            // nouvelle rangée apparaissait en bas alors qu'on l'avait demandée
            // en glissant vers le haut.
            const ttrack = textTrackCount - 1 - idx;
            const isTopT = idx === 0;
            return (
            <div className={"a-lane" + (isTopT && dropLane === "newtext" ? " nt-hint" : "")} style={{ height: laneH(`t${ttrack}`), order: 2 }} data-tllane={`t${ttrack}`} key={"ttrack-" + ttrack}>
              <LaneResize laneKey={`t${ttrack}`} />
              <div className="a-lane-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <VIcon name="text" size={13} />
                <span className="trunc">{textTrackCount > 1 ? `${t('railText')} ${ttrack + 1}` : t('railText')}</span>
                <LaneControls laneKey={`t${ttrack}`} audio />
                <span className="a-lane-acts">
                  <LaneDelete genre="t" index={ttrack} />
                  {isTopT && <LaneAdd onClick={() => setExtraTextTracks((n) => n + 1)} title={t('addTextTrack')} />}
                </span>
              </div>
              <div className="a-lane-track">
                {titles.filter((ti) => (ti.track ?? 0) === ttrack).map((ti) => (
                  <div key={ti.id} className={"a-chip a-chip-title" + (selectedTitleId === ti.id ? " on" : "")} style={{ left: ti.start * pps, width: Math.max(20, (ti.end - ti.start) * pps), top: 2, height: blockH(`t${ttrack}`), cursor: "grab", touchAction: "none" }} title={ti.text}
                    onPointerDown={(e) => onTitleBarDown(e, ti)} onPointerMove={onTitleBarMove} onPointerUp={onTitleBarUp}
                    data-lame={`title:${ti.id}`}
                    onContextMenu={(e) => { e.preventDefault(); setSelectedTitleId(ti.id); setClipMenu({ x: e.clientX, y: e.clientY, id: ti.id, kind: "title" }); }}>
                    <VIcon name="text" size={11} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ti.text}</span>
                    {selectedTitleId === ti.id && <>
                      <div className="a-trim a-trim-l" onPointerDown={(e) => startTitleTrim(e, ti, "start")} onPointerMove={onTitleTrimMove} onPointerUp={endTitleTrim} title={t('trimStartTitle')} />
                      <div className="a-trim a-trim-r" onPointerDown={(e) => startTitleTrim(e, ti, "end")} onPointerMove={onTitleTrimMove} onPointerUp={endTitleTrim} title={t('trimEndTitle')} />
                    </>}
                  </div>
                ))}
              </div>
            </div>
            );
            })}
            {/* PIED DE GOUTTIÈRE.
                Sous la dernière piste il reste une bande où plus aucun label ne
                couvre la colonne : la tête de lecture y ressortait et retraversait
                la gouttière sur ses derniers pixels. Ce cache la ferme jusqu'en
                bas. Il ajoute sa hauteur au contenu, ce qui n'est que de la marge
                de fin. */}
            <div className="a-tl-pied" aria-hidden />
            {/* REPÈRE D'AIMANTATION : la ligne sur laquelle le bord vient de se
                coller. Elle n'apparaît que pendant le geste et disparaît au
                relâchement — c'est un retour, pas un élément de la timeline. */}
            {/* APERÇU DE COUPE : le trait rouge suit la lame sur l'élément survolé
                et montre l'endroit exact où le clic coupera. */}
            {outilLame && apercuCoupe !== null && (
              <div className="a-coupe-apercu" aria-hidden style={{ left: LANE_LABEL_W + apercuCoupe * pps }} />
            )}
            {marqueAimant !== null && (
              <div className="a-aimant" aria-hidden style={{ left: LANE_LABEL_W + marqueAimant * pps }} />
            )}
            {/* Position posée par `poserCurseur` (écriture DOM directe) : pendant la
                lecture React ne touche plus à ce style, sinon chaque rendu le
                ramènerait à la valeur du dernier rendu et le curseur sauterait
                en arrière dix fois par seconde. */}
            <div className="a-playhead" ref={playheadRef} />
          </div>
        </div>
      </div>

      {/* Copie fidèle du plan « dans la main » pendant le glissement — suit le curseur
          en X (aimanté) et en Y (libre). Affiche le vrai contenu (vignette / vidéo). */}
      {tlGhost && (() => {
        const gi = tlGhost.kind === "clip" ? clipStarts.find((c) => c.id === tlGhost.id) : overlays.find((o) => o.id === tlGhost.id);
        if (!gi) return null;
        const isPhoto = gi.kind === "photo";
        const strip = strips[gi.id];
        const ghostW = Math.max(28, tlGhost.w);
        return (
          <div className="a-tl-ghost" style={{ left: tlGhost.x, top: tlGhost.y, width: ghostW,
            background: strip ? undefined : (isPhoto ? "linear-gradient(150deg,#c8792f,#5e3a1a)" : "linear-gradient(150deg,#2b8d57,#0c2a1d)") }}>
            <ClipStrip data={strip} width={ghostW} height={34} />{/* 34px = hauteur de .a-tl-ghost */}
            <span className="a-tl-ghost-ic"><VIcon name={isPhoto ? "image" : "video"} size={10} /></span>
            <span className="a-tl-ghost-lbl">{gi.name}</span>
          </div>
        );
      })()}

      {/* Assistant de montage : consignes en langage naturel, appliquées au projet. */}
      <AiChatDock
        endpoint="/api/montage-chat"
        labels={{
          title: t('chatTitle'), intro: t('chatIntro'), placeholder: t('chatPlaceholder'),
              newChat: t('chatNewChat'), hint: t('chatHint'),
          thinking: t('chatThinking'), error: t('chatError'),
          open: t('chatOpen'), close: t('chatClose'),
        }}
        buildProject={buildChatProject}
        applyActions={applyChatActions}
        disabled={preEditing}
      />

      {/* Rectangle de sélection multiple (glisser sur une zone vide de la timeline). */}
      {selRect && (
        <div style={{ position: "fixed", left: selRect.x, top: selRect.y, width: selRect.w, height: selRect.h, zIndex: 1500, pointerEvents: "none", border: "1.5px solid var(--mint-2)", background: "color-mix(in srgb, var(--mint-2) 14%, transparent)", borderRadius: 3 }} />
      )}

      {toastMsg && (
        <div className="mz-toast">
          <span className="mz-toast-ic" style={toastKind === "error" ? { background: "var(--warn-soft)", color: "var(--warn)" } : undefined}>
            <VIcon name={toastKind === "error" ? "alert" : "check"} size={12} />
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{toastMsg}</span>
        </div>
      )}

      {/* Menu contextuel d'un plan (clic droit) — façon CapCut */}
      {clipMenu && (() => {
        const id = clipMenu.id, K = clipMenu.kind;
        const item = (key: string, label: string, onClick: () => void, opts?: { disabled?: boolean; danger?: boolean; sc?: string }) => (
          <button
            key={key}
            className="a-ctx-item"
            data-danger={opts?.danger ? "1" : undefined}
            disabled={opts?.disabled}
            onClick={(e) => { e.stopPropagation(); setClipMenu(null); onClick(); }}
          >
            <span>{label}</span>
            {opts?.sc ? <span className="a-ctx-sc">{opts.sc}</span> : null}
          </button>
        );
        const sep = (key: string) => <div key={key} className="a-ctx-sep" />;
        const rows: React.ReactNode[] = [];
        if (K === "clip") {
          const c = clips.find((x) => x.id === id);
          const isVideo = c?.kind === "video";
          rows.push(item("copy", t('copy'), () => { selectClip(id); copySelected(); }, { sc: "⌘C" }));
          rows.push(item("cut", t('cut'), () => { selectClip(id); copySelected(); removeClip(id); }, { sc: "⌘X" }));
          rows.push(item("del1", t('delete'), () => removeClip(id), { sc: "⌫", danger: true }));
          rows.push(sep("s1"));
          rows.push(item("edit", t('contextEdit'), () => { selectClip(id); setTool("cut"); }));
          rows.push(item("split", t('splitAtPlayhead'), () => { selectClip(id); splitAtPlayhead(); }, { sc: "⌘B" }));
          rows.push(item("detach", t('contextDetachAudio'), () => detachAudio(id), { sc: "⇧⌥S", disabled: !isVideo || (c?.vol ?? 1) === 0 }));
          rows.push(sep("s2"));
          rows.push(item("dup", t('duplicate'), () => duplicateClip(id), { sc: "⌘D" }));
          rows.push(item("mvl", t('moveClipLeft'), () => moveClipOrder(id, -1), { disabled: clips[0]?.id === id }));
          rows.push(item("mvr", t('moveClipRight'), () => moveClipOrder(id, 1), { disabled: clips[clips.length - 1]?.id === id }));
          rows.push(item("speed", t('railSpeed'), () => { selectClip(id); setTool("speed"); }));
          rows.push(item("filter", t('railFilter'), () => { selectClip(id); setTool("filter"); }));
          rows.push(item("transitions", t('railTransitions'), () => { selectClip(id); setTool("transitions"); }));
        } else if (K === "overlay") {
          const o = overlays.find((x) => x.id === id);
          const isVideo = o?.kind === "video";
          rows.push(item("copy", t('copy'), () => { selectOverlay(id); copySelected(); }, { sc: "⌘C" }));
          rows.push(item("del1", t('delete'), () => removeOverlay(id), { sc: "⌫", danger: true }));
          rows.push(sep("s1"));
          rows.push(item("edit", t('contextEdit'), () => selectOverlay(id)));
          rows.push(item("dup", t('duplicate'), () => duplicateOverlay(id), { sc: "⌘D" }));
          if (isVideo) rows.push(item("detach", t('contextDetachAudio'), () => detachOverlayAudio(id), { sc: "⇧⌥S", disabled: (o?.vol ?? 1) === 0 }));
          rows.push(sep("s2"));
          rows.push(item("up", t('trackUp'), () => moveOverlayTrack(id, 1)));
          rows.push(item("down", t('trackDown'), () => moveOverlayTrack(id, -1)));
        } else if (K === "audio") {
          rows.push(item("del1", t('delete'), () => removeAudioTrack(id), { sc: "⌫", danger: true }));
          rows.push(sep("s0"));
          rows.push(item("edit", t('contextEdit'), () => setTool("audio")));
          // Le niveau se règle à la souris sur la piste, mais il faut aussi
          // pouvoir y arriver sans viser une ligne d'un pixel et demi.
          rows.push(item("niveau", t('audioLevel'), () => { setSelectedAudioId(id); setTool("audio"); }));
          rows.push(item("iso", t('voiceIsolate'), () => isolateVoiceOnTrack(id, "isolate"), { disabled: !!processingVoice }));
          rows.push(item("rem", t('voiceRemove'), () => isolateVoiceOnTrack(id, "remove"), { disabled: !!processingVoice }));
          rows.push(sep("s1"));
          rows.push(item("up", t('trackUp'), () => moveAudioTrackRow(id, 1)));
          rows.push(item("down", t('trackDown'), () => moveAudioTrackRow(id, -1)));
        } else if (K === "title") {
          rows.push(item("edit", t('contextEdit'), () => { setSelectedTitleId(id); setTool("text"); }));
          rows.push(sep("s1"));
          rows.push(item("del", t('delete'), () => removeTitle(id), { sc: "⌫", danger: true }));
        } else if (K === "caption") {
          rows.push(item("edit", t('contextEdit'), () => setTool("captions")));
          rows.push(sep("s1"));
          rows.push(item("del", t('delete'), () => removeCaption(id), { sc: "⌫", danger: true }));
        }
        return (
          <div
            className="a-ctx-menu"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); }}
            style={{ left: Math.min(clipMenu.x, (typeof window !== "undefined" ? window.innerWidth : 9999) - 240), top: Math.max(8, Math.min(clipMenu.y, (typeof window !== "undefined" ? window.innerHeight : 9999) - (rows.length * 32 + 20))) }}
          >
            {rows}
          </div>
        );
      })()}
    </div>
  );
}
