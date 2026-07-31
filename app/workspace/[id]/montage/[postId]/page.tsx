"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { VIcon } from "./icons";
import {
  MontageClip, OverlayClip, Caption, TitleEl, StickerEl, AudioTrack, MontageProject, SubCustom,
  FILTERS, TRANSITIONS, SUB_STYLES, FONT_CHOICES, SUB_LENGTHS, DEFAULT_WORDS_PER_CAPTION, DEFAULT_SUB_POS,
  subStyleById, effectiveSubStyle, subtitleBoxCss, applySubCase,
  transitionStateAt, transitionCss,
  // (analyzeClipQuality importé depuis ./autoCut plus bas)
  fmt, newClipDefaults, newOverlayDefaults, clipFilterCss, overlayFilterCss, clipTimelineDur, clipAudioGainAt, overlayTimelineDur, overlayAudioGainAt, segmentCaptions,
  audioVolumeAt, kenBurnsScale, VIDEO_FORMATS, videoFormatById, EXPORT_QUALITIES,
} from "./constants";
import { MontageCtx, CutPanel, TextPanel, CaptionsPanel, AudioPanel, TransitionsPanel, FilterPanel, SpeedPanel, StickerPanel, OverlayPanel, AiPanel } from "./panels";
import { renderExport } from "./export";
import { analyzeClipQuality, planSemanticCuts, keepRangesFromCuts, type TWord } from "./autoCut";
import { transcodeToMp4 } from "@/lib/mp4-transcode";

// ─── Types / rail ───────────────────────────────────────────────────────────

type RailTool = "media" | "cut" | "overlay" | "text" | "captions" | "audio" | "transitions" | "filter" | "speed" | "sticker" | "ai";

const RAIL_TOOL_KEYS: [RailTool, string, string][] = [
  ["media", "video", "railMedia"],
  ["cut", "scissors", "railCut"],
  ["overlay", "image", "railOverlay"],
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

function getVideoDuration(src: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = src;
    let done = false;
    const finish = (d: number) => { if (done) return; done = true; resolve(d && isFinite(d) && d > 0 ? d : 4); };
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
function getAudioDuration(src: string): Promise<number> {
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.src = src;
    a.onloadedmetadata = () => resolve(a.duration && isFinite(a.duration) ? a.duration : 3);
    a.onerror = () => resolve(3);
  });
}

// Capture une image basse résolution (≤320px de large) d'un plan — vidéo (frame à
// atTime) ou photo — encodée en dataURL JPEG, pour l'envoyer aux endpoints IA
// (recadrage sujet, montage auto, suggestion musicale). Les sources sont des URLs
// Supabase Storage publiques, sans souci CORS pour toDataURL() (comme dans export.ts).
async function grabFrame(src: string, kind: "video" | "photo", atTime = 0, maxW = 320): Promise<string> {
  if (kind === "video") {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous"; v.muted = true; v.preload = "auto"; v.src = src;
    await new Promise<void>((resolve, reject) => { v.onloadedmetadata = () => resolve(); v.onerror = () => reject(new Error("load")); });
    await new Promise<void>((resolve) => { v.onseeked = () => resolve(); v.currentTime = Math.max(0, Math.min(atTime, (v.duration || 1) - 0.05)); });
    const scale = Math.min(1, maxW / (v.videoWidth || maxW));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round((v.videoWidth || maxW) * scale));
    c.height = Math.max(1, Math.round((v.videoHeight || maxW) * scale));
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
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

// Bande-film (façon CapCut) : compose N frames d'une vidéo côte à côte en une seule
// image, pour afficher un aperçu qui « avance » le long du plan sur la timeline.
async function makeFilmstrip(src: string, trimStart: number, trimEnd: number): Promise<string> {
  const v = document.createElement("video");
  v.crossOrigin = "anonymous"; v.muted = true; v.preload = "auto"; v.src = src;
  await new Promise<void>((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error("load")); });
  const COUNT = 6, fw = 90, fh = 52;
  const canvas = document.createElement("canvas");
  canvas.width = COUNT * fw; canvas.height = fh;
  const ctx = canvas.getContext("2d")!;
  const dur = v.duration && isFinite(v.duration) ? v.duration : Math.max(0.1, trimEnd - trimStart);
  const a = Math.max(0, Math.min(trimStart || 0, dur - 0.05));
  const b = Math.max(a + 0.05, Math.min(trimEnd || dur, dur));
  const vw = v.videoWidth || fw, vh = v.videoHeight || fh;
  const scale = Math.max(fw / vw, fh / vh);
  const dw = vw * scale, dh = vh * scale;
  for (let i = 0; i < COUNT; i++) {
    const tt = a + (b - a) * (i / (COUNT - 1));
    await new Promise<void>((res) => { v.onseeked = () => res(); v.currentTime = Math.max(0, Math.min(tt, dur - 0.05)); });
    ctx.drawImage(v, i * fw + (fw - dw) / 2, (fh - dh) / 2, dw, dh);
  }
  return canvas.toDataURL("image/jpeg", 0.72);
}

const WAVEFORM_SAMPLES = 120;
// Décode le fichier audio et calcule 120 pics d'amplitude normalisés (0-1) pour
// l'affichage visuel dans la timeline. Best-effort : renvoie [] si le décodage échoue
// (ex. format non supporté) plutôt que de bloquer l'import.
async function computeWaveform(file: File): Promise<number[]> {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const data = buf.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(data.length / WAVEFORM_SAMPLES));
    const peaks: number[] = [];
    for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
      let max = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize && start + j < data.length; j++) max = Math.max(max, Math.abs(data[start + j]));
      peaks.push(max);
    }
    ctx.close();
    const peak = Math.max(...peaks, 0.01);
    return peaks.map(p => Math.min(1, p / peak));
  } catch {
    return [];
  }
}

// Comme computeWaveform mais depuis une URL (son embarqué d'un plan vidéo) : on
// télécharge la source et on décode sa piste audio. Best-effort → [] si échec.
async function computeWaveformFromUrl(src: string): Promise<number[]> {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const ab = await (await fetch(src)).arrayBuffer();
    const buf = await ctx.decodeAudioData(ab);
    const data = buf.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(data.length / WAVEFORM_SAMPLES));
    const peaks: number[] = [];
    for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
      let max = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize && start + j < data.length; j++) max = Math.max(max, Math.abs(data[start + j]));
      peaks.push(max);
    }
    ctx.close();
    const peak = Math.max(...peaks, 0.01);
    return peaks.map((p) => Math.min(1, p / peak));
  } catch {
    return [];
  }
}

// Encode des échantillons mono (Float32, -1..1) en WAV PCM 16 bits.
function encodeWavMono(samples: Float32Array, sampleRate: number): Blob {
  const n = samples.length;
  const view = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); view.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); w(36, "data"); view.setUint32(40, n * 2, true);
  let off = 44;
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, samples[i])); view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2; }
  return new Blob([view], { type: "audio/wav" });
}
// 120 pics normalisés depuis des échantillons (pour l'affichage timeline après traitement).
function peaksFromSamples(samples: Float32Array): number[] {
  const N = 120;
  const block = Math.max(1, Math.floor(samples.length / N));
  const peaks: number[] = [];
  for (let i = 0; i < N; i++) { let m = 0; const s = i * block; for (let j = 0; j < block && s + j < samples.length; j++) m = Math.max(m, Math.abs(samples[s + j])); peaks.push(m); }
  const peak = Math.max(...peaks, 0.01);
  return peaks.map((p) => Math.min(1, p / peak));
}

// Style de sous-titres dérivé de la charte du client : surlignage du mot actif dans la
// couleur d'accent de la marque, sur une base lisible (contour noir, texte blanc).
// Appliqué par défaut aux montages jamais personnalisés → sous-titres déjà à la charte.
function charterSubDefault(ws: {
  accent_color?: string | null; subtitle_style_id?: string | null;
  subtitle_custom?: SubCustom | null; subtitle_pos?: { x: number; y: number } | null;
} | null | undefined): { styleId: string; custom: SubCustom; pos: { x: number; y: number } | null } | null {
  const acc = ws?.accent_color;
  const hasStyle = SUB_STYLES.some((s) => s.id === ws?.subtitle_style_id);
  const custom = ws?.subtitle_custom && typeof ws.subtitle_custom === "object" ? ws.subtitle_custom : null;
  const p = ws?.subtitle_pos;
  const pos = p && typeof p === "object" && typeof p.x === "number" && typeof p.y === "number" ? { x: p.x, y: p.y } : null;
  // Rien de configuré ET pas de couleur d'accent exploitable → on laisse le défaut du montage.
  if (!hasStyle && !custom && !pos && (!acc || !/^#([0-9a-fA-F]{3,8})$/.test(acc))) return null;
  const styleId = hasStyle ? (ws!.subtitle_style_id as string) : "bold-white";
  // Le template du client prime ; à défaut, on surligne simplement à la couleur d'accent.
  return { styleId, custom: custom ?? { hi: acc as string }, pos };
}

// Positions sur la timeline d'une liste de plans. Fonction PURE : les étapes du
// prémontage l'appellent sur le résultat de l'étape précédente, sans dépendre de
// l'état React (qui n'est pas encore à jour quand on enchaîne).
function computeStarts(list: MontageClip[]) {
  let acc = 0;
  return list.map((c) => {
    acc += Math.max(0, c.gapBefore ?? 0);
    const start = acc;
    const dur = clipTimelineDur(c);
    acc += dur;
    return { ...c, start, end: acc, dur };
  });
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
  const RAIL_TOOLS = RAIL_TOOL_KEYS.map(([id, icon, key]) => [id, icon, t(key)] as [RailTool, string, string]);
  const TOOL_TITLES: Record<RailTool, string> = Object.fromEntries(
    Object.entries(TOOL_TITLE_KEYS).map(([id, key]) => [id, t(key)])
  ) as Record<RailTool, string>;
  const params = useParams();
  const workspaceId = params.id as string;
  const postId = params.postId as string;
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState(t('defaultProjectName'));
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [clips, setClips] = useState<MontageClip[]>([]);
  const [overlays, setOverlays] = useState<OverlayClip[]>([]);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [subStyleId, setSubStyleId] = useState<string>(SUB_STYLES[0].id);
  const [subMaxWords, setSubMaxWords] = useState<number>(DEFAULT_WORDS_PER_CAPTION);
  const [subPos, setSubPos] = useState<{ x: number; y: number }>(DEFAULT_SUB_POS);
  const [subCustom, setSubCustom] = useState<SubCustom>({});
  const [linkedSubs, setLinkedSubs] = useState(true); // true = style commun à tous ; false = par sous-titre
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [rawSegments, setRawSegments] = useState<{ start: number; end: number; text: string }[]>([]);
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
  const [autoCutProgress, setAutoCutProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const [autoCutDone, setAutoCutDone] = useState<{ clips: number; seconds: number } | null>(null);
  const [cuttingSilence, setCuttingSilence] = useState(false);
  const [processingVoice, setProcessingVoice] = useState<string | null>(null); // id de la piste audio en cours de traitement voix
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
  const [stageW, setStageW] = useState(0); // largeur px réelle de la preview → texte figé à l'échelle de l'image (WYSIWYG avec l'export)
  const [previewZoom, setPreviewZoom] = useState(1); // zoom de la preview (pincement/molette), 1–5
  const [strips, setStrips] = useState<Record<string, string>>({}); // bandes-film (aperçu) par id de plan
  const stripReqRef = useRef<Set<string>>(new Set()); // ids déjà demandés (évite les régénérations)
  const [clipWaves, setClipWaves] = useState<Record<string, number[]>>({}); // spectre audio du son embarqué, par src
  const waveReqRef = useRef<Set<string>>(new Set());
  // Valeurs de zoom lues au démarrage d'un geste (Safari) — refs pour éviter les closures figées.
  const ppsRef = useRef(pps); ppsRef.current = pps;
  const previewZoomRef = useRef(previewZoom); previewZoomRef.current = previewZoom;
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
        if (x.kind !== "video" || stripReqRef.current.has(x.id)) continue;
        stripReqRef.current.add(x.id);
        try {
          const s = await makeFilmstrip(x.src, x.trimStart, x.trimEnd);
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
  const loadedSrcRef = useRef<string | null>(null);
  const overlayVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const scrubRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOverlayRef = useRef<{ type: "title" | "sticker" | "caption" | "overlay"; id: string; startX: number; startY: number; offX: number; offY: number; moved: boolean } | null>(null);
  const resizeOverlayRef = useRef<{ type: "title" | "sticker" | "caption" | "overlay"; id: string; startDist: number; startScale: number; cx: number; cy: number } | null>(null);
  const voRecorderRef = useRef<MediaRecorder | null>(null);
  const voChunksRef = useRef<Blob[]>([]);
  const rulerRef = useRef<HTMLDivElement>(null);
  const scrubbingRulerRef = useRef(false);
  const trimRef = useRef<{ id: string; edge: "start" | "end"; startX: number; t0start: number; t0end: number; kind: "video" | "photo"; srcDur: number; speed: number; t0gap: number } | null>(null);
  const ovTrimRef = useRef<{ id: string; edge: "start" | "end"; startX: number; t0start: number; t0end: number; t0offset: number; srcDur: number; kind: "video" | "photo" } | null>(null);
  const clipboardRef = useRef<{ type: "clip"; data: MontageClip } | { type: "overlay"; data: OverlayClip } | null>(null);
  // Glisser-déposer libre façon CapCut : on attrape le corps d'un plan / d'une
  // incrustation, il suit le curseur (fantôme), et au lâcher il atterrit sur la
  // piste sous le curseur (déplacement temporel, changement de piste, ou création
  // d'une nouvelle piste vidéo en montant tout en haut). Piloté au pointeur, sans
  // drag HTML5 (fini le fantôme moche du navigateur).
  const tlDragRef = useRef<{ id: string; kind: "clip" | "overlay"; startX: number; startY: number; grabDx: number; grabDy: number; widthPx: number; moved: boolean; anchor: number } | null>(null);
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
      if (!(e.ctrlKey || e.metaKey)) return; // molette/scroll normal : on ne touche pas
      e.preventDefault(); // bloque le zoom de la page web
      const tl = tlScrollRef.current, stage = stageRef.current, target = e.target as Node;
      const factor = Math.min(1.25, Math.max(0.8, Math.exp(-e.deltaY * 0.01)));
      if (tl && tl.contains(target)) {
        setPps((p) => {
          const np = Math.max(10, Math.min(220, p * factor));
          const rect = tl.getBoundingClientRect();
          const tAtCursor = (e.clientX - rect.left + tl.scrollLeft - 92) / p; // 92 = label
          requestAnimationFrame(() => { tl.scrollLeft = Math.max(0, tAtCursor * np - (e.clientX - rect.left - 92)); });
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
        supabase.from("workspaces").select("logo_url, accent_color, subtitle_style_id, subtitle_custom, subtitle_pos").eq("id", workspaceId).single(),
      ]);
      // Tolérant : si subtitle_style_id n'est pas encore migré, on relit sans la colonne.
      let ws = wsRes.data;
      if (wsRes.error && /subtitle_(style_id|custom|pos)/.test(wsRes.error.message || "")) {
        ws = (await supabase.from("workspaces").select("logo_url, accent_color").eq("id", workspaceId).single()).data as typeof ws;
      }
      if (post?.brief) setProjectName(post.brief);
      if (ws?.logo_url) setLogoUrl(ws.logo_url);
      const charterSub = charterSubDefault(ws); // sous-titres à la charte (surlignage = accent)
      const proj = post?.montage_json as Partial<MontageProject> | null;
      if (proj?.clips?.length) {
        setClips(proj.clips.map(normalizeClip));
        setOverlays(proj.overlays || []);
        setCaptions(proj.captions || []);
        // Montage jamais personnalisé côté sous-titres → on applique le style de la charte.
        const subUntouched = !proj.subStyleId && (!proj.subCustom || Object.keys(proj.subCustom).length === 0);
        setSubStyleId(subUntouched && charterSub ? charterSub.styleId : (proj.subStyleId || SUB_STYLES[0].id));
        setSubMaxWords(proj.subMaxWords || DEFAULT_WORDS_PER_CAPTION);
        setSubPos(proj.subPos || (subUntouched ? charterSub?.pos : null) || DEFAULT_SUB_POS);
        setSubCustom(subUntouched && charterSub ? charterSub.custom : (proj.subCustom || {}));
        setLinkedSubs(proj.linkedSubs ?? true);
        setRawSegments(proj.rawSegments || []);
        setTitles(proj.titles || []);
        setStickers(proj.stickers || []);
        setAudioTracks(proj.audioTracks || []);
        setShowProgressBar(!!proj.showProgressBar);
        setExportUrl(proj.exportUrl || null);
        setFormatId(proj.formatId || "story");
        if (proj.customW) setCustomW(proj.customW);
        if (proj.customH) setCustomH(proj.customH);
        setExportQuality(proj.exportQuality || "standard");
      } else if (post?.photo_url) {
        const dur = await getVideoDuration(post.photo_url);
        setClips([{ id: crypto.randomUUID(), kind: "video", name: t('initialImportName'), src: post.photo_url, srcDur: dur, trimStart: 0, trimEnd: dur, ...newClipDefaults() }]);
        if (charterSub) { setSubStyleId(charterSub.styleId); setSubCustom(charterSub.custom); if (charterSub.pos) setSubPos(charterSub.pos); }
      } else if (charterSub) {
        setSubStyleId(charterSub.styleId); setSubCustom(charterSub.custom);
        if (charterSub.pos) setSubPos(charterSub.pos);
      }
      setLoading(false);
    })();
  }, [postId, workspaceId, supabase]);

  // ── Playback position persistée (localStorage) ─────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(`montage-time-${postId}`);
    if (saved) setTime(parseFloat(saved) || 0);
  }, [postId]);

  useEffect(() => {
    localStorage.setItem(`montage-time-${postId}`, String(time));
  }, [time, postId]);

  // ── Autosave du projet (debounced) ──────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (loading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const project: MontageProject = { clips, overlays, captions, subStyleId, subMaxWords, subPos, subCustom, linkedSubs, rawSegments, titles, stickers, audioTracks, showProgressBar, exportUrl, formatId, customW, customH, exportQuality };
      supabase.from("posts").update({ montage_json: project }).eq("id", postId).then(() => {});
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [clips, overlays, captions, subStyleId, subMaxWords, subPos, subCustom, linkedSubs, rawSegments, titles, stickers, audioTracks, showProgressBar, exportUrl, formatId, customW, customH, exportQuality, loading, postId, supabase]);

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
  const activeTrans = useMemo(() => {
    if (!activeClip) return null;
    const isFirst = clipStarts.length > 0 && clipStarts[0].id === activeClip.id;
    return transitionStateAt(activeClip.transitionIn, activeClip.transitionDur, time - activeClip.start, isFirst);
  }, [activeClip, clipStarts, time]);
  const activeTransCss = activeTrans ? transitionCss(activeTrans) : null;
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

  const seek = useCallback((t: number) => {
    const clamped = Math.max(0, Math.min(total, t));
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
    const v = els[target];
    if (!v) return;
    videoRef.current = v;
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
    const free = slot === 0 ? 1 : 0;
    const el = [videoARef.current, videoBRef.current][free];
    if (!el) return;
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
      const notReady = !!(ac && ac.kind === "video" && vEl && vEl.readyState < 2);
      if (notReady) {
        if (!stalledSince) stalledSince = now;
        // Garde-fou : source illisible → on repart au bout de 3 s plutôt que de rester bloqué.
        if (now - stalledSince < 3000) { raf = requestAnimationFrame(tick); return; }
      } else {
        stalledSince = 0;
      }
      setTime((t) => { const n = t + dt; if (total > 0 && n >= total) { setPlaying(false); return 0; } return n; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  // ── Lecture live des pistes audio (musique/voix off) ────────────────────────
  // Un <audio> par piste, joué/mis en pause/mixé (fondu) en direct pendant la
  // lecture — jusqu'ici ces pistes n'étaient audibles qu'à l'export.
  const audioElsRef = useRef<Record<string, HTMLAudioElement>>({});
  const timeRef = useRef(time);
  useEffect(() => { timeRef.current = time; }, [time]);
  const audioTracksRef = useRef(audioTracks);
  useEffect(() => { audioTracksRef.current = audioTracks; }, [audioTracks]);

  useEffect(() => {
    const els = audioElsRef.current;
    const ids = new Set(audioTracks.map((a) => a.id));
    Object.keys(els).forEach((id) => { if (!ids.has(id)) { els[id].pause(); delete els[id]; } });
    audioTracks.forEach((a) => {
      const ex = els[a.id];
      if (!ex) { const el = new Audio(a.src); el.preload = "auto"; els[a.id] = el; }
      else if (ex.src !== a.src) { ex.pause(); const el = new Audio(a.src); el.preload = "auto"; els[a.id] = el; } // src changé (voix traitée)
    });
  }, [audioTracks]);

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
        const expected = ac.trimStart + (t - ac.start) * ac.speed;
        if (vEl.paused) vEl.play().catch(() => {});
        // Recaler seulement en cas de vraie dérive, et pas plus d'une fois par
        // demi-seconde : un re-seek en rafale empêche le décodeur de repartir
        // (l'image restait bloquée sur deux frames en boucle).
        const drift = Math.abs(vEl.currentTime - expected);
        // `ended` : la source a atteint sa fin alors que le plan continue sur la
        // timeline (trimEnd = durée du fichier) — play() n'y peut rien, il faut
        // repositionner. On ne temporise pas dans ce cas.
        const mustRecover = vEl.ended || drift > 1.5;
        if (isFinite(expected) && !vEl.seeking && (mustRecover || (drift > 0.5 && now - lastSeekRef.current > 500))) {
          lastSeekRef.current = now;
          vEl.currentTime = Math.max(0, expected);
          if (vEl.paused) vEl.play().catch(() => {});
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
          if (Math.abs(el.currentTime - srcT) > 0.3) el.currentTime = srcT;
          if (el.paused) el.play().catch(() => {});
          el.volume = mutedLanesRef.current.has(`a${a.track ?? 0}`) ? 0 : Math.min(1, audioVolumeAt(a, local)); // el.volume ∈ [0,1] ; boost >100 % à l'export
        } else if (!el.paused) {
          el.pause();
        }
      }
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
    const arr = Array.from(files).filter((f) => f.type.startsWith("video/") || f.type.startsWith("image/"));
    if (!arr.length) return;
    const r = rulerRef.current?.getBoundingClientRect();
    let dropT = r ? Math.max(0, snapTime((clientX - r.left) / pps)) : 0;
    const lane = dropTargetAt(clientX, clientY);
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
    }
    setUploading(false);
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
      src: c.src, dur: c.dur, vol: c.vol ?? 1, offset: c.start, srcOffset: c.trimStart, track: 0,
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
      src: o.src, dur: overlayTimelineDur(o), vol: o.vol ?? 1, offset: o.offset, srcOffset: o.trimStart, track: 0,
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

  // Couper en deux au curseur — fonctionne sur N'IMPORTE QUEL élément sélectionné :
  // plan principal, incrustation (Vidéo 2, 3…), texte, ou piste audio.
  function splitAtPlayhead() {
    // 1) Incrustation sélectionnée
    if (selectedOverlayId) {
      const o = overlays.find((x) => x.id === selectedOverlayId);
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
    if (selectedTitleId) {
      const ti = titles.find((x) => x.id === selectedTitleId);
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
    if (selectedCaptionId) {
      const c = captions.find((x) => x.id === selectedCaptionId);
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
    if (selectedAudioId) {
      const a = audioTracks.find((x) => x.id === selectedAudioId);
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
    const c = selectedClip;
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
  const perCap = !linkedSubs && !!editingCaption; // on édite le sous-titre isolé
  const activeSubStyleId = perCap ? (editingCaption!.styleId ?? subStyleId) : subStyleId;
  const activeSubCustom: SubCustom = perCap ? (editingCaption!.custom ?? {}) : subCustom;
  // Résout le style/position d'UN sous-titre donné (surcharges si déliées).
  function capStyleOf(c: Caption) {
    return linkedSubs ? effectiveSubStyle(subStyleId, subCustom) : effectiveSubStyle(c.styleId ?? subStyleId, c.custom ?? {});
  }
  function capPosOf(c: Caption) {
    return linkedSubs ? subPos : { x: c.x ?? subPos.x, y: c.y ?? subPos.y };
  }
  // Applique un changement de style au bon endroit (global ou sous-titre isolé).
  function pickSubStyle(id: string) {
    if (perCap && editingCaption) updateCaption(editingCaption.id, { styleId: id });
    else setSubStyleId(id);
  }
  function patchSubCustom(p: SubCustom) {
    if (perCap && editingCaption) updateCaption(editingCaption.id, { custom: { ...(editingCaption.custom ?? {}), ...p } });
    else setSubCustom((c) => ({ ...c, ...p }));
  }
  function resetSubCustomRouted() {
    if (perCap && editingCaption) updateCaption(editingCaption.id, { custom: {}, styleId: undefined });
    else setSubCustom({});
  }
  // Extrait la piste audio d'un média en WAV mono 16 kHz (format attendu par Whisper).
  // Une vidéo complète pèse trop lourd pour l'API (« Request Entity Too Large ») : on
  // n'envoie que le son, ré-échantillonné — quelques centaines de Ko au lieu de plusieurs Mo.
  // Traduit un code d'erreur de transcription en message lisible. Le serveur ne
  // renvoie plus de texte brut (on affichait du JSON et du HTML Cloudflare tels quels).
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

  // ── Transcription d'un média, par TRANCHES ──────────────────────────────────
  // Une route serverless n'accepte qu'un corps de requête limité (~4,5 Mo). Or un
  // WAV 16 kHz mono pèse ~1,8 Mo par minute : au-delà de ~2,5 min, l'envoi échouait
  // avant même d'atteindre Whisper. On découpe donc l'audio en tranches de 100 s
  // et on recale les horodatages de chaque tranche.
  const TRANSCRIBE_CHUNK_SEC = 100;

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

  interface TranscriptResult { segments: { start: number; end: number; text: string }[]; words: TWord[]; error?: string }

  async function transcribeMedia(src: string, onProgress?: (done: number, total: number) => void): Promise<TranscriptResult> {
    const rate = 16000;
    let pcm: Float32Array | null = null;
    let decodeErr: unknown = null;
    try { pcm = await decodeToMono16k(src); } catch (e) { decodeErr = e; pcm = null; }
    if (!pcm) {
      // Le décodage local a échoué (conteneur illisible par Web Audio, CORS…).
      // On le journalise : c'est LA cause du repli qui envoie la vidéo entière au
      // serveur et déclenche « vidéo trop lourde ».
      console.warn("[transcribe] décodage audio local impossible, repli serveur :", decodeErr);
    }

    // Repli : décodage impossible (CORS…) → le serveur récupère le média lui-même.
    if (!pcm) {
      const res = await fetch("/api/transcribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: src }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) return { segments: [], words: [], error: transcribeErrorMsg(data) };
      return { segments: data.segments || [], words: data.words || [] };
    }

    const chunkLen = TRANSCRIBE_CHUNK_SEC * rate;
    const total = Math.max(1, Math.ceil(pcm.length / chunkLen));
    const segments: { start: number; end: number; text: string }[] = [];
    const words: TWord[] = [];

    for (let i = 0; i < total; i++) {
      onProgress?.(i, total);
      const slice = pcm.subarray(i * chunkLen, Math.min(pcm.length, (i + 1) * chunkLen));
      if (!slice.length) continue;
      const offset = (i * chunkLen) / rate; // recalage temporel de la tranche
      const form = new FormData();
      form.append("audio", encodeWavMono(slice, rate), "audio.wav");
      let data: { ok?: boolean; error?: string; sizeMb?: number; segments?: { start: number; end: number; text: string }[]; words?: TWord[] } | null = null;
      try {
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) return { segments, words, error: transcribeErrorMsg(data) };
      } catch {
        return { segments, words, error: t('toastTranscriptionError') };
      }
      for (const sg of data.segments || []) segments.push({ start: sg.start + offset, end: sg.end + offset, text: sg.text });
      for (const w of data.words || []) words.push({ start: w.start + offset, end: w.end + offset, word: w.word });
    }
    onProgress?.(total, total);
    return { segments, words };
  }

  // Mots horodatés d'un plan (liste vide + message si la transcription échoue).
  async function transcribeWords(src: string): Promise<{ words: TWord[]; error?: string }> {
    const r = await transcribeMedia(src);
    return { words: r.words, error: r.error };
  }

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
      const ids = new Set(targets.map((c) => c.id));
      const next: MontageClip[] = [];
      let removed = 0, changed = false;
      let failure: string | null = null;
      for (const c of base) {
        if (!ids.has(c.id)) { next.push(c); continue; }
        const r = await transcribeWords(c.src);
        if (!r) { next.push(c); continue; }
        if (!r.words.length) {
          // Transcription indisponible → on ne touche à rien, et surtout on ne
          // conclut pas « rien à retirer » (message contradictoire après un échec).
          next.push(c);
          if (r.error) failure = r.error;
          continue;
        }
        const cuts = planSemanticCuts(r.words).filter((x) => x.end > c.trimStart && x.start < c.trimEnd);
        if (!cuts.length) { next.push(c); continue; }
        const keeps = keepRangesFromCuts(cuts, c.trimStart, c.trimEnd);
        if (!keeps.length) { next.push(c); continue; }
        removed += (c.trimEnd - c.trimStart) - keeps.reduce((s, k) => s + (k.end - k.start), 0);
        changed = true;
        keeps.forEach((k, idx) => {
          next.push({ ...c, id: crypto.randomUUID(), trimStart: k.start, trimEnd: k.end, gapBefore: idx === 0 ? c.gapBefore : 0 });
        });
      }
      // Un échec de transcription prime sur « rien à retirer ».
      if (failure) { toast(failure, "error"); return base; }
      if (!changed) { toast(t('toastFillersNothing')); return base; }
      setClips(next);
      toast(t('toastFillersCut', { s: removed.toFixed(1) }));
      return next;
    } catch {
      toast(t('toastTranscriptionError'), "error");
      return base;
    } finally {
      setCuttingFillers(false);
    }
  }

  async function generateCaptionsAI(input?: MontageClip[]) {
    // On calcule les positions à partir des plans FOURNIS : quand le prémontage
    // enchaîne les étapes, l'état React n'est pas encore à jour et `clipStarts`
    // décrirait l'ancienne timeline (sous-titres totalement décalés).
    const vids = computeStarts(input ?? clips).filter((c) => c.kind === "video");
    if (!vids.length) return;
    setTranscribing(true);
    try {
      // On transcrit TOUS les plans vidéo (pas seulement le premier), et on convertit
      // le temps de la SOURCE en temps de la TIMELINE — sinon les sous-titres ne
      // couvraient que le début et tombaient à côté dès qu'un plan était rogné.
      const all: { start: number; end: number; text: string }[] = [];
      let firstError: string | null = null;
      // Une même source utilisée par plusieurs plans n'est transcrite qu'une fois.
      const cache = new Map<string, { start: number; end: number; text: string }[]>();

      for (const c of vids) {
        let segs = cache.get(c.src);
        if (!segs) {
          const r = await transcribeMedia(c.src);
          if (r.error && !r.segments.length) { firstError = firstError ?? r.error; continue; }
          if (r.error && !firstError) firstError = r.error;
          segs = r.segments;
          cache.set(c.src, segs);
        }
        for (const sg of segs) {
          // ne garder que ce qui tombe dans la partie conservée du plan
          const from = Math.max(sg.start, c.trimStart);
          const to = Math.min(sg.end, c.trimEnd);
          if (to - from < 0.08) continue;
          const toTimeline = (srcT: number) => c.start + (srcT - c.trimStart) / c.speed;
          all.push({ start: toTimeline(from), end: toTimeline(to), text: sg.text });
        }
      }

      if (!all.length) { toast(firstError || t('toastTranscriptionError'), "error"); return; }
      if (firstError) toast(firstError, "error"); // transcription partielle
      all.sort((a, b) => a.start - b.start);
      setRawSegments(all);
      const newCaps: Caption[] = segmentCaptions(all, subMaxWords);
      setCaptions(newCaps);
      toast(t('toastCaptionsGenerated', { count: newCaps.length }));
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
  // Détecte les segments « parlés » d'une source audio/vidéo : RMS par fenêtres de 30 ms,
  // seuil relatif, on fusionne les courts silences et on coupe ceux ≥ minSilenceSec.
  // Renvoie des segments [start,end] en secondes dans le référentiel de la source.
  async function detectSpeechSegments(src: string, minSilenceSec = 1.0, padSec = 0.12): Promise<{ start: number; end: number }[] | null> {
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
      const thresh = Math.max(0.008, maxR * 0.08);
      const winSec = win / sr;
      const minSilWin = Math.ceil(minSilenceSec / winSec);
      const voiced = rms.map((r) => r >= thresh);
      const segs: { start: number; end: number }[] = [];
      let i = 0;
      while (i < nWin) {
        if (!voiced[i]) { i++; continue; }
        let j = i;
        while (j < nWin) {
          if (voiced[j]) { j++; continue; }
          let k = j; while (k < nWin && !voiced[k]) k++;
          if (k - j >= minSilWin) break; // silence long → fin du segment
          j = k;                         // silence court → on fusionne
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
      let trimmedCount = 0, savedSec = 0;
      const next = [...base];
      for (let i = 0; i < next.length; i++) {
        const c = next[i];
        if (c.kind !== "video") continue;
        setAutoCutProgress({ done: trimmedCount, total: vids.length, name: c.name });
        // On repère d'abord où ça parle (analyse locale, sans clé) pour ne jamais
        // sacrifier de la parole à cause d'un défaut d'image.
        let voiced: { start: number; end: number }[] | undefined;
        try { voiced = (await detectSpeechSegments(c.src, 0.6)) ?? undefined; } catch { voiced = undefined; }
        let rep;
        try { rep = await analyzeClipQuality(c.src, c.trimStart, c.trimEnd, { voiced }); }
        catch { continue; }
        if (!rep.keep) continue; // rien d'exploitable détecté → on ne touche pas au plan
        const start = Math.max(c.trimStart, rep.keep.start);
        const end = Math.min(c.trimEnd, rep.keep.end);
        // On n'applique que si le gain est réel (> 0.3 s) et la plage valide.
        if (end - start > 0.5 && (c.trimEnd - c.trimStart) - (end - start) > 0.3) {
          savedSec += (c.trimEnd - c.trimStart) - (end - start);
          next[i] = { ...c, trimStart: start, trimEnd: end };
          trimmedCount++;
        }
      }
      if (trimmedCount > 0) {
        // setClips suffit : l'historique enregistre un point d'annulation tout seul.
        setClips(next);
        setAutoCutDone({ clips: trimmedCount, seconds: savedSec });
        toast(t('toastAutoCutDone', { n: trimmedCount, s: savedSec.toFixed(1) }));
      } else {
        toast(t('toastAutoCutNothing'));
      }
      return next;
    } finally {
      setAutoCutting(false);
      setAutoCutProgress(null);
    }
  }

  // ── Prémontage IA complet (?premontage=1) ───────────────────────────────────
  // Enchaîne automatiquement à l'ouverture ce qu'on lançait outil par outil :
  // dérushage image → dérushage parole → sous-titres à la charte → transitions.
  const preRunRef = useRef(false);
  async function runFullPreEdit() {
    if (preRunRef.current) return;
    preRunRef.current = true;
    setPreEditing(true);
    try {
      setPreEditStep(t('preStepRushes'));
      let work = await autoCutQuality();
      setPreEditStep(t('preStepSpeech'));
      work = await cutFillers(work);
      setPreEditStep(t('preStepCaptions'));
      // on passe les plans RÉELS issus des deux étapes précédentes
      await generateCaptionsAI(work);
      setPreEditStep(t('preStepTransitions'));
      // Enchaînement plus vif : fondu court entre les plans.
      applyTransitionToAll("fade", 0.25);
      toast(t('preEditDone'));
    } finally {
      setPreEditing(false);
      setPreEditStep(null);
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
      const at = c.kind === "video" ? c.trimStart + (time - c.start) * c.speed : 0;
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
    if (rawSegments.length) setCaptions(segmentCaptions(rawSegments, words));
  }

  // Applique un modèle de sous-titres enregistré (style + surcharges + position + longueur).
  function applySubTemplate(tpl: { styleId: string; custom: SubCustom; pos: { x: number; y: number }; maxWords: number }) {
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
  async function importAudio(file: File, kind: "music" | "voiceover") {
    setUploadingAudio(true);
    try {
      const ext = file.name.split(".").pop() || "mp3";
      const path = `${workspaceId}/${postId}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("audio").upload(path, file, { upsert: true, contentType: file.type || "audio/mpeg" });
      if (error) { toast(t('toastAudioUploadFailed', { msg: error.message })); return; }
      const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
      const [dur, waveform] = await Promise.all([getAudioDuration(urlData.publicUrl), computeWaveform(file)]);
      setAudioTracks((prev) => [...prev, { id: crypto.randomUUID(), kind, name: file.name, src: urlData.publicUrl, dur, vol: 1, offset: 0, waveform }]);
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
  const MZ_HANDLES: { id: string; style: React.CSSProperties }[] = [
    { id: "tl", style: { left: -6, top: -6, cursor: "nwse-resize" } },
    { id: "tc", style: { left: "50%", top: -6, transform: "translateX(-50%)", cursor: "ns-resize" } },
    { id: "tr", style: { right: -6, top: -6, cursor: "nesw-resize" } },
    { id: "mr", style: { right: -6, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
    { id: "br", style: { right: -6, bottom: -6, cursor: "nwse-resize" } },
    { id: "bc", style: { left: "50%", bottom: -6, transform: "translateX(-50%)", cursor: "ns-resize" } },
    { id: "bl", style: { left: -6, bottom: -6, cursor: "nesw-resize" } },
    { id: "ml", style: { left: -6, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
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
  const titleDragRef = useRef<{ id: string; startX: number; t0start: number; dur: number; moved: boolean } | null>(null);
  function onTitleBarDown(e: React.PointerEvent, ti: TitleEl) {
    e.stopPropagation();
    setSelectedTitleId(ti.id); setTool("text");
    if (lockedLanes.has("text")) return; // piste verrouillée : sélection ok, déplacement bloqué
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    titleDragRef.current = { id: ti.id, startX: e.clientX, t0start: ti.start, dur: ti.end - ti.start, moved: false };
  }
  function onTitleBarMove(e: React.PointerEvent) {
    const d = titleDragRef.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) < 4) return;
    d.moved = true;
    const ns = Math.max(0, snapTime(d.t0start + (e.clientX - d.startX) / pps));
    updateTitle(d.id, { start: ns, end: ns + d.dur });
  }
  function onTitleBarUp(e: React.PointerEvent) {
    const d = titleDragRef.current; titleDragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (d && !d.moved && (time < d.t0start || time > d.t0start + d.dur)) seek(d.t0start + 0.05); // clic simple → recadre le curseur
  }
  // Rogner la durée d'un texte (poignées gauche/droite) comme une vidéo.
  const titleTrimRef = useRef<{ id: string; edge: "start" | "end"; startX: number; t0start: number; t0end: number } | null>(null);
  function startTitleTrim(e: React.PointerEvent, ti: TitleEl, edge: "start" | "end") {
    e.stopPropagation();
    setSelectedTitleId(ti.id);
    if (lockedLanes.has("text")) return; // piste verrouillée
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    titleTrimRef.current = { id: ti.id, edge, startX: e.clientX, t0start: ti.start, t0end: ti.end };
  }
  function onTitleTrimMove(e: React.PointerEvent) {
    const d = titleTrimRef.current; if (!d) return;
    const delta = (e.clientX - d.startX) / pps;
    if (d.edge === "start") updateTitle(d.id, { start: Math.max(0, Math.min(d.t0end - 0.3, snapTime(d.t0start + delta))) });
    else updateTitle(d.id, { end: Math.max(d.t0start + 0.3, snapTime(d.t0end + delta)) });
  }
  function endTitleTrim(e: React.PointerEvent) {
    if (titleTrimRef.current) { try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {} titleTrimRef.current = null; }
  }
  // Déplacement d'un sous-titre sur la timeline (chaque bloc est indépendant : on le
  // déplace, on l'allonge/raccourcit, on double-clique pour l'éditer — comme un texte).
  const capDragRef = useRef<{ id: string; startX: number; t0start: number; dur: number; moved: boolean } | null>(null);
  function onCaptionBarDown(e: React.PointerEvent, c: Caption) {
    e.stopPropagation();
    setSelectedCaptionId(c.id); setSubSelected(true); setTool("captions");
    if (lockedLanes.has("subs")) return; // piste verrouillée
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    capDragRef.current = { id: c.id, startX: e.clientX, t0start: c.start, dur: c.end - c.start, moved: false };
  }
  function onCaptionBarMove(e: React.PointerEvent) {
    const d = capDragRef.current; if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) < 4) return;
    d.moved = true;
    const ns = Math.max(0, snapTime(d.t0start + (e.clientX - d.startX) / pps));
    updateCaption(d.id, { start: ns, end: ns + d.dur });
  }
  function onCaptionBarUp(e: React.PointerEvent) {
    const d = capDragRef.current; capDragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (d && !d.moved && (time < d.t0start || time > d.t0start + d.dur)) seek(d.t0start + 0.05); // clic simple → recadre le curseur
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
    if (d.edge === "start") updateCaption(d.id, { start: Math.max(0, Math.min(d.t0end - 0.2, snapTime(d.t0start + delta))) });
    else updateCaption(d.id, { end: Math.max(d.t0start + 0.2, snapTime(d.t0end + delta)) });
  }
  function endCaptionTrim(e: React.PointerEvent) {
    if (capTrimRef.current) { try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {} capTrimRef.current = null; }
  }
  // Déplacement d'une piste audio dans le temps + sélection (pour la déplacer/supprimer).
  const audDragRef = useRef<{ id: string; startX: number; t0: number; moved: boolean } | null>(null);
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
    audDragRef.current = { id: a.id, startX: e.clientX, t0: a.offset, moved: false };
    if (multiSel.size) setMultiSel(new Set());
    setSelectedAudioId(a.id); setSelectedClipId(null); setSelectedOverlayId(null); setAudioOnlyId(null); setTool("audio");
  }
  function onAudioBarMove(e: React.PointerEvent) {
    const d = audDragRef.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) < 4) return;
    d.moved = true;
    const off = Math.max(0, snapTime(d.t0 + (e.clientX - d.startX) / pps));
    setAudioTracks((prev) => prev.map((a) => (a.id === d.id ? { ...a, offset: off } : a)));
  }
  function onAudioBarUp(e: React.PointerEvent) {
    if (audDragRef.current) { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} audDragRef.current = null; }
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

  // Piste d'incrustation : garde les <video> superposées synchronisées avec le playhead.
  useEffect(() => {
    overlayVideoRefs.current.forEach((v, id) => {
      const o = overlays.find((x) => x.id === id);
      if (!o || o.kind !== "video") return;
      const isActive = time >= o.offset && time < o.offset + overlayTimelineDur(o);
      if (!isActive) { if (!v.paused) v.pause(); return; }
      const g = overlayAudioGainAt(o, time - o.offset);
      v.volume = mutedLanes.has(`v${o.track ?? 0}`) ? 0 : (isFinite(g) ? Math.max(0, Math.min(1, g)) : 0);
      const localTime = o.trimStart + (time - o.offset);
      if (Math.abs(v.currentTime - localTime) > 0.4) v.currentTime = Math.max(0, localTime);
      if (playing) v.play().catch(() => {}); else if (!v.paused) v.pause();
    });
  }, [overlays, time, playing, mutedLanes]);

  // ── Overlays de scène (drag titres/stickers/sous-titres) ────────────────────
  function onOverlayPointerDown(e: React.PointerEvent, type: "title" | "sticker" | "caption" | "overlay", id: string) {
    e.stopPropagation();
    e.preventDefault(); // empêche le drag natif de l'image/vidéo qui « avale » le relâchement
    if (type === "title") { setSelectedTitleId(id); setSubSelected(false); setSelectedOverlayId(null); }
    else if (type === "sticker") { setSelectedStickerId(id); setSubSelected(false); setSelectedOverlayId(null); }
    else if (type === "overlay") { setSelectedOverlayId(id); setSubSelected(false); setSelectedTitleId(null); setSelectedStickerId(null); setTool("overlay"); }
    else setSubSelected(true);
    const laneKey = type === "title" ? "text" : type === "caption" ? "subs" : type === "overlay" ? `v${overlays.find((x) => x.id === id)?.track ?? 0}` : "";
    if (laneKey && lockedLanes.has(laneKey)) return; // piste verrouillée : sélection ok, déplacement bloqué
    // position actuelle (centre) de l'élément en % — pour garder le point de préhension
    const cur = type === "caption" ? (perCap && editingCaption ? capPosOf(editingCaption) : subPos)
      : type === "title" ? titles.find((x) => x.id === id)
      : type === "overlay" ? overlays.find((x) => x.id === id)
      : stickers.find((x) => x.id === id);
    const r = stageRef.current?.getBoundingClientRect();
    let offX = 0, offY = 0;
    if (cur && r) { offX = cur.x - ((e.clientX - r.left) / r.width) * 100; offY = cur.y - ((e.clientY - r.top) / r.height) * 100; }
    dragOverlayRef.current = { type, id, startX: e.clientX, startY: e.clientY, offX, offY, moved: false };
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
    if (drag.type === "title") updateTitle(drag.id, { x, y });
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
      const exTitles = HL.has("text") ? [] : titles;
      const exCaptions = HL.has("subs") ? [] : captions;
      const { blob: webmBlob, thumbnailBlob } = await renderExport({ clips: exClips, overlays: exOverlays, captions: exCaptions, subStyleId, subCustom, subPos, linkedSubs, titles: exTitles, stickers, audioTracks: exAudio, showProgressBar, formatId, customW, customH, exportQuality }, (p) => setExportProgress(p));

      // Transcodage en MP4 (H.264/AAC) pour compatibilité universelle — le
      // rendu brut Canvas/MediaRecorder est en .webm.
      setExportPhase("transcode");
      setExportProgress(0);
      let blob: Blob;
      let ext = "webm";
      let contentType = "video/webm";
      try {
        blob = await transcodeToMp4(webmBlob, (p) => setExportProgress(p));
        ext = "mp4";
        contentType = "video/mp4";
      } catch (e) {
        console.warn("[montage] transcodage MP4 échoué, export .webm conservé :", e);
        blob = webmBlob;
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
        montage_json: { clips, overlays, captions, subStyleId, subMaxWords, subPos, subCustom, linkedSubs, rawSegments, titles, stickers, audioTracks, showProgressBar, exportUrl: urlData.publicUrl, formatId, customW, customH, exportQuality },
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
    if (multiSel.size > 0) {
      const ids = multiSel;
      setClips((prev) => prev.filter((c) => !ids.has(c.id)));
      setOverlays((prev) => prev.filter((o) => !ids.has(o.id)));
      setAudioTracks((prev) => prev.filter((a) => !ids.has(a.id)));
      setMultiSel(new Set());
      setSelectedClipId(null); setSelectedOverlayId(null); setSelectedAudioId(null);
      return;
    }
    if (selectedAudioId) { removeAudioTrack(selectedAudioId); setSelectedAudioId(null); return; }
    if (selectedOverlayId) { removeOverlay(selectedOverlayId); return; }
    if (selectedTitleId) { removeTitle(selectedTitleId); return; }
    if (selectedCaptionId) { removeCaption(selectedCaptionId); return; }
    if (selectedStickerId) { removeSticker(selectedStickerId); return; }
    if (selectedClipId) removeClip(selectedClipId);
  }
  // Tout désélectionner (clic dans le vide).
  function deselectAll() {
    setSelectedClipId(null); setSelectedOverlayId(null); setSelectedAudioId(null);
    setSelectedTitleId(null); setSelectedStickerId(null); setSubSelected(false);
    setSelectedCaptionId(null); setEditingCaptionId(null);
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
  const FRAME = 1 / 30;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      const meta = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (meta && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (meta && k === "y") { e.preventDefault(); redo(); return; }
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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, time, total, clipStarts, selectedClipId, selectedOverlayId, selectedTitleId, selectedStickerId, playing, selectedClip, overlays, clips]);

  // ── Trim (poignées) & scrub sur la règle ────────────────────────────────────
  function startTrim(e: React.PointerEvent, c: (typeof clipStarts)[number], edge: "start" | "end") {
    e.stopPropagation();
    e.preventDefault();
    setSelectedClipId(c.id);
    if (lockedLanes.has("video")) return; // piste verrouillée
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    trimRef.current = { id: c.id, edge, startX: e.clientX, t0start: c.trimStart, t0end: c.trimEnd, kind: c.kind, srcDur: c.srcDur, speed: c.speed, t0gap: Math.max(0, c.gapBefore ?? 0) };
  }
  function onTrimMove(e: React.PointerEvent) {
    const d = trimRef.current;
    if (!d) return;
    const deltaSrc = ((e.clientX - d.startX) / pps) * (d.kind === "video" ? d.speed : 1);
    if (d.edge === "start") {
      // Rogner/étirer le DÉBUT : le bord gauche bouge et le bord droit reste en place
      // (on décale gapBefore en conséquence) — comme les incrustations et CapCut.
      const ns = Math.max(0, Math.min(d.t0end - 0.3, d.t0start + deltaSrc));
      const dtl = (ns - d.t0start) / (d.kind === "video" ? d.speed : 1);
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
  function snapTime(t: number): number {
    const targets = [0, total, time, ...clipStarts.map((c) => c.start), ...clipStarts.map((c) => c.end)];
    const thresh = 8 / pps;
    let best = t, bestD = thresh;
    for (const tg of targets) { const d = Math.abs(tg - t); if (d < bestD) { bestD = d; best = tg; } }
    return best;
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
    // anchor (plans) = fin du plan précédent = point fixe pour recalculer le trou (gapBefore)
    // pendant le glissement live.
    let anchor = 0;
    if (kind === "clip") { const c = clipStarts.find((x) => x.id === id); if (c) anchor = c.start - Math.max(0, c.gapBefore ?? 0); }
    tlDragRef.current = { id, kind, startX: e.clientX, startY: e.clientY, grabDx: e.clientX - rect.left, grabDy: e.clientY - rect.top, widthPx: rect.width, moved: false, anchor };
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
          updateClip(d.id, { gapBefore: Math.max(0, dropT - d.anchor) }); // reste sur la piste principale → repositionne
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
    const delta = (e.clientX - d.startX) / pps;
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
    if (perCap && editingCaption) updateCaption(editingCaption.id, { custom: next });
    else setSubCustom(next);
  };
  const ctx: MontageCtx = {
    clips, selectedClip, captions, subStyleId: activeSubStyleId, subMaxWords, subCustom: activeSubCustom, subPos, hasRawSegments: rawSegments.length > 0,
    linkedSubs, setLinkedSubs, selectedCaptionId, setSelectedCaptionId,
    titles, stickers, audioTracks, showProgressBar,
    overlays, selectedOverlay, uploadingOverlay, addOverlayFiles, updateOverlay, removeOverlay, duplicateOverlay, selectOverlay,
    videoTrackCount, moveOverlayTrack,
    time, total, logoUrl, uploadingAudio, transcribing, isRecordingVO,
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
  };

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
  // Le texte sélectionné s'affiche TOUJOURS dans l'aperçu (même si le curseur sort de sa
  // plage) → on peut toujours le voir, le déplacer et l'éditer.
  const activeTitles = hiddenLanes.has("text") ? [] : titles.filter((ti) => (time >= ti.start && time <= ti.end) || ti.id === selectedTitleId);
  const activeStickers = stickers.filter((s) => time >= s.start && time <= s.end);
  const activeCaption = hiddenLanes.has("subs") ? undefined
    : (captions.find((c) => c.id === selectedCaptionId && editingCaptionId === c.id)
      || captions.find((c) => time >= c.start && time <= c.end)
      || (selectedCaptionId && !playing ? captions.find((c) => c.id === selectedCaptionId) : undefined));
  const capStyle = activeCaption ? capStyleOf(activeCaption) : effectiveSubStyle(subStyleId, subCustom);
  const capPos = activeCaption ? capPosOf(activeCaption) : subPos;

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
      <div className="ed-topbar" style={{ height: 58, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", borderBottom: "1px solid rgba(47,215,155,.14)", background: "radial-gradient(120% 130% at 0% 0%, rgba(47,215,155,.18), transparent 55%), radial-gradient(90% 130% at 100% 0%, rgba(200,241,53,.10), transparent 60%), linear-gradient(90deg, #0E2F20 0%, var(--forest) 50%, #0A2316 100%)", position: "relative", zIndex: 30 }}>
        <a href={`/workspace/${workspaceId}`} className="btn btn-sm btn-ghost" style={{ gap: 5, textDecoration: "none", flexShrink: 0 }}>
          <VIcon name="chevL" size={15} /> {t('composeBack')}
        </a>
        <span style={{ width: 1, height: 24, background: "var(--line)", flexShrink: 0 }} />
        <div style={{ display: "flex", gap: 2 }}>
          <button className="mz-hbtn" title={t('undoTitle')} disabled={!canUndo} onClick={undo}><VIcon name="undo" size={17} /></button>
          <button className="mz-hbtn" title={t('redoTitle')} disabled={!canRedo} onClick={redo}><VIcon name="redo" size={17} /></button>
        </div>
        <span style={{ width: 1, height: 24, background: "var(--line)", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em" }} className="trunc">{projectName}</span>
          <div className="mz-seg" style={{ flexShrink: 0 }} title={t('exportFormatTitle')}>
            {VIDEO_FORMATS.map(f => (
              <button key={f.id} className={formatId === f.id ? "on" : ""} onClick={() => setFormatId(f.id)}>{f.sub}</button>
            ))}
            <button className={formatId === "custom" ? "on" : ""} onClick={() => setFormatId("custom")} title={t('customFormatTitle')}>{t('customFormatShort')}</button>
          </div>
          {formatId === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <input type="number" min={64} max={4096} value={customW}
                onChange={e => setCustomW(Math.max(64, Math.min(4096, Math.round(Number(e.target.value) || 0))))}
                title={t('widthPx')} style={{ width: 58, height: 30, borderRadius: 7, border: "1px solid var(--line)", background: "var(--canvas)", color: "var(--ink-2)", fontSize: 12.5, fontWeight: 600, padding: "0 6px", textAlign: "center" }} />
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>×</span>
              <input type="number" min={64} max={4096} value={customH}
                onChange={e => setCustomH(Math.max(64, Math.min(4096, Math.round(Number(e.target.value) || 0))))}
                title={t('heightPx')} style={{ width: 58, height: 30, borderRadius: 7, border: "1px solid var(--line)", background: "var(--canvas)", color: "var(--ink-2)", fontSize: 12.5, fontWeight: 600, padding: "0 6px", textAlign: "center" }} />
              <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>px</span>
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        {exportUrl && (
          <a href={exportUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" style={{ gap: 5, textDecoration: "none" }}>
            <VIcon name="eye" size={15} /> {t('viewExport')}
          </a>
        )}
        {/* La couverture se choisit ICI : on se place sur l'image voulue, on clique. */}
        <button onClick={setCoverFromPlayhead} disabled={settingCover || !activeClip} className="btn btn-sm btn-ghost" style={{ gap: 5 }} title={t('coverAtPlayheadTitle')}>
          <VIcon name="image" size={15} /> {settingCover ? t('coverSaving') : coverUrl ? t('coverRedo') : t('coverAtPlayhead')}
        </button>

        {/* La légende s'écrit ICI, une fois la vidéo montée — pas au compositeur. */}
        {exportUrl && (
          <button onClick={generateCaptionAI} disabled={captioning} className="btn btn-sm btn-ghost" style={{ gap: 5 }} title={t('captionAiTitle')}>
            <VIcon name="sparkles" size={15} /> {captioning ? t('captionAiBusy') : caption ? t('captionAiRedo') : t('captionAi')}
          </button>
        )}
        {exportUrl && (
          <a href={`/workspace/${workspaceId}/planning?post=${postId}`} className="btn btn-sm btn-dark" style={{ gap: 5, textDecoration: "none" }}>
            <VIcon name="calendar" size={15} /> {t('schedule')}
          </a>
        )}
        <select value={exportQuality} onChange={e => setExportQuality(e.target.value)} title={t('exportQualityTitle')}
          style={{ height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "var(--canvas)", color: "var(--ink-2)", fontSize: 12.5, fontWeight: 600, padding: "0 8px" }}>
          {EXPORT_QUALITIES.map(q => <option key={q.id} value={q.id}>{tc(`exportQuality.${q.id}`)}</option>)}
        </select>
        <button className="btn btn-sm btn-ghost" disabled={!clips.length || exporting} onClick={() => handleExport(false)}>
          <VIcon name="export" size={15} /> {exporting ? t('exportingShort') : t('exportBtn')}
        </button>
        <button className="btn btn-sm btn-primary" disabled={!clips.length || exporting} onClick={() => handleExport(true)} title={t('publishBtnTitle')}>
          <VIcon name="check" size={15} /> {t('publishBtn')}
        </button>
      </div>

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
                  <span className="mz-sec-label">{t('projectClipsTitle', { count: clips.length })}</span>
                  <div className="mz-grid3" style={{ marginTop: 10 }}>
                    {clipStarts.map((c) => (
                      <div key={c.id} className={"mz-thumb" + (selectedClipId === c.id ? " on" : "")} onClick={() => selectClip(c.id)}>
                        {c.kind === "photo" ? <img src={c.src} alt="" style={{ filter: clipFilterCss(c) }} /> : <video src={c.src} muted preload="metadata" style={{ filter: clipFilterCss(c) }} />}
                        <span style={{ position: "absolute", top: 5, left: 5, width: 16, height: 16, borderRadius: 5, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", color: "#fff" }}>
                          <VIcon name={c.kind === "photo" ? "image" : "video"} size={10} />
                        </span>
                        <span style={{ position: "absolute", bottom: 5, right: 5, fontFamily: "var(--mono)", fontWeight: 700, fontSize: 8.5, color: "#fff", background: "rgba(0,0,0,.4)", padding: "1px 4px", borderRadius: 4 }}>{c.dur.toFixed(0)}s</span>
                      </div>
                    ))}
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
          <div className="mz-stage">
            {/* Prémontage IA en cours : on montre l'étape plutôt qu'un écran figé. */}
            {preEditing && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 40, display: "grid", placeItems: "center",
                background: "rgba(8,12,8,.72)", backdropFilter: "blur(3px)",
              }}>
                <div style={{ textAlign: "center", padding: 20 }}>
                  <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "italic", fontSize: 20, color: "var(--leaf)", marginBottom: 8 }}>
                    {t('preEditRunning')}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--cream-2)" }}>{preEditStep}</div>
                </div>
              </div>
            )}
            {previewZoom !== 1 && (
              <button
                onClick={() => setPreviewZoom(1)}
                title={t('resetZoomTitle')}
                style={{ position: "absolute", top: 12, right: 12, zIndex: 10, height: 28, padding: "0 10px", borderRadius: 8, border: "1px solid var(--line)", background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
              >
                {Math.round(previewZoom * 100)}% · 1:1
              </button>
            )}
            <div
              className="mz-phone"
              style={{ aspectRatio: `${activeFmt.w} / ${activeFmt.h}`, transform: previewZoom !== 1 ? `scale(${previewZoom})` : undefined }}
              ref={stageRef}
              onPointerDown={(e) => { const el = e.target as HTMLElement; if (!el.closest(".mz-ov-item, .mz-pip, .mz-cap-box, .mz-th, .mz-rot, .mz-ov-del")) deselectAll(); }}
              onPointerMove={onStagePointerMove}
              onPointerUp={onStagePointerUp}
              onPointerLeave={onStagePointerUp}
            >
              <div className="mz-video">
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
                      muted={!shown}
                      style={shown
                        ? ({
                            filter: [clipFilterCss(activeClip!), activeTrans?.extraFilter].filter(Boolean).join(" ") || undefined,
                            objectPosition: `${(activeClip!.focusX ?? 0.5) * 100}% ${(activeClip!.focusY ?? 0.5) * 100}%`,
                            ...(activeTransCss || {}),
                            transformOrigin: "center",
                          } as React.CSSProperties)
                        : { position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                    />
                  );
                })}
                {activeClip && !hiddenLanes.has("video") ? (
                  activeClip.kind === "video"
                    ? null
                    : <img src={activeClip.src} alt="" style={{
                        filter: [clipFilterCss(activeClip), activeTrans?.extraFilter].filter(Boolean).join(" ") || undefined,
                        objectPosition: `${(activeClip.focusX ?? 0.5) * 100}% ${(activeClip.focusY ?? 0.5) * 100}%`,
                        ...(activeTransCss || {}),
                        // Ken Burns et transition se composent sur le même transform.
                        transform: [
                          activeTransCss?.transform,
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

                {/* Voiles de transition (flash blanc / fondu au noir) — identiques à l'export. */}
                {activeTrans && activeTrans.flash > 0 && (
                  <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: activeTrans.flash, pointerEvents: "none", zIndex: 3 }} />
                )}
                {activeTrans && activeTrans.dark > 0 && (
                  <div style={{ position: "absolute", inset: 0, background: "#000", opacity: activeTrans.dark, pointerEvents: "none", zIndex: 3 }} />
                )}

                {/* incrustations (PIP) — déplaçables/redimensionnables/pivotables.
                    Triées par piste croissante : l'ordre du DOM fait le z-order (piste haute = au-dessus). */}
                {[...overlays].sort((a, b) => (a.track ?? 0) - (b.track ?? 0)).map((o) => {
                  const hidden = hiddenLanes.has(`v${o.track ?? 0}`);
                  const isActive = time >= o.offset && time < o.offset + overlayTimelineDur(o) && !hidden;
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
                      {o.kind === "video" ? (
                        <video
                          ref={(el) => { if (el) overlayVideoRefs.current.set(o.id, el); else overlayVideoRefs.current.delete(o.id); }}
                          src={o.src}
                          playsInline muted={(o.vol ?? 1) === 0} draggable={false}
                          style={{ width: "100%", display: "block", filter: overlayFilterCss(o), pointerEvents: "none" }}
                        />
                      ) : (
                        <img src={o.src} alt="" draggable={false} style={{ width: "100%", display: "block", filter: overlayFilterCss(o), pointerEvents: "none" }} />
                      )}
                      {sel && <button className="mz-ov-del" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeOverlay(o.id)}><VIcon name="x" size={11} /></button>}
                      {sel && <TransformHandles scale={o.scale} onScale={(s) => updateOverlay(o.id, { scale: s })} onRotate={(d) => updateOverlay(o.id, { rotation: d })} />}
                    </div>
                  );
                })}

                {/* titres */}
                {activeTitles.map((ti) => (
                  <div
                    key={ti.id}
                    className={"mz-ov-item" + (selectedTitleId === ti.id ? " sel" : "")}
                    style={{
                      left: ti.x + "%", top: ti.y + "%",
                      fontFamily: FONT_CSS[ti.font] || FONT_CSS.archivo,
                      fontWeight: FONT_CHOICES.find((f) => f.id === ti.font)?.weight || 800,
                      fontStyle: FONT_CHOICES.find((f) => f.id === ti.font)?.italic ? "italic" : "normal",
                      color: ti.color, fontSize: 40 * (ti.scale ?? 1) * previewScale, textAlign: "center", textShadow: "0 1px 8px rgba(0,0,0,.5)",
                      maxWidth: "80%", whiteSpace: "pre-wrap", zIndex: 8, // au-dessus des incrustations (le texte reste visible/cliquable)
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
                      style={{ outline: "none", cursor: editingTitleId === ti.id ? "text" : "inherit" }}
                      onPointerDown={editingTitleId === ti.id ? (e) => e.stopPropagation() : undefined}
                      onKeyDown={editingTitleId === ti.id ? (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } } : undefined}
                      onBlur={editingTitleId === ti.id ? (e) => { const txt = (e.currentTarget.textContent || "").trim(); if (txt) updateTitle(ti.id, { text: txt }); setEditingTitleId(null); } : undefined}
                    >
                      {editingTitleId === ti.id
                        ? ti.text
                        : (ti.anim === "type" ? ti.text.slice(0, Math.max(0, Math.min(ti.text.length, Math.floor((time - ti.start) * 16)))) : ti.text)}
                    </span>
                    {selectedTitleId === ti.id && editingTitleId !== ti.id && <button className="mz-ov-del" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeTitle(ti.id)}><VIcon name="x" size={11} /></button>}
                    {selectedTitleId === ti.id && editingTitleId !== ti.id && <TransformHandles scale={ti.scale ?? 1} onScale={(s) => updateTitle(ti.id, { scale: s })} onRotate={(d) => updateTitle(ti.id, { rotation: d })} />}
                  </div>
                ))}

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
                    style={{ left: capPos.x + "%", top: capPos.y + "%", transform: `translate(-50%,-50%) scale(${capStyle.scale})` }}
                    onPointerDown={(e) => { if (editingCaptionId === activeCaption.id) return; setSelectedCaptionId(activeCaption.id); onOverlayPointerDown(e, "caption", "sub"); }}
                    onDoubleClick={(e) => { e.stopPropagation(); setPlaying(false); setSelectedCaptionId(activeCaption.id); setEditingCaptionId(activeCaption.id); }}
                    title={editingCaptionId === activeCaption.id ? undefined : t('doubleClickToEdit')}
                  >
                    <div className="mz-cap-box" style={{
                      // Rendu piloté par la source unique partagée avec l'assistant client
                      // et répliquée par l'export canvas (cf. subtitleBoxCss / drawCaptions).
                      ...subtitleBoxCss(capStyle, 34 * previewScale),
                      transform: capStyle.rotation ? `rotate(${capStyle.rotation}deg)` : undefined,
                    } as React.CSSProperties}>
                      {editingCaptionId === activeCaption.id ? (
                        <span
                          ref={captionEditRef}
                          contentEditable suppressContentEditableWarning spellCheck={false}
                          style={{ outline: "none", cursor: "text", color: capStyle.fg }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
                          onBlur={(e) => { const txt = (e.currentTarget.textContent || "").trim(); if (txt) updateCaption(activeCaption.id, { text: txt }); setEditingCaptionId(null); }}
                        >{activeCaption.text}</span>
                      ) : activeCaption.text.split(/\s+/).filter(Boolean).map((w, i, arr) => {
                        const progress = (time - activeCaption.start) / Math.max(0.1, activeCaption.end - activeCaption.start);
                        const activeIdx = Math.min(arr.length - 1, Math.floor(progress * arr.length));
                        // Révélation mot par mot : chaque mot apparaît (fondu + pop) à son tour,
                        // le mot actif est surligné et légèrement agrandi.
                        const wordProg = Math.max(0, Math.min(1, progress * arr.length - i));
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
                            {applySubCase(w, capStyle.caseMode)}{i < arr.length - 1 ? "\u00A0" : ""}
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
              <div className="mz-scrub-fill" style={{ width: total ? (time / total) * 100 + "%" : "0%" }} />
              <div className="mz-scrub-knob" style={{ left: total ? (time / total) * 100 + "%" : "0%" }} />
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
          <button className="a-tl-tool" disabled={!(selectedClipId || selectedOverlayId || selectedTitleId || selectedCaptionId || selectedAudioId)} onClick={splitAtPlayhead}><VIcon name="split" size={15} /> {t('splitShort')}</button>
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
          style={{ outline: tlFileOver ? "2px dashed var(--mint-2)" : undefined, outlineOffset: -3 }}>
          <div
            className="a-tl-inner"
            ref={tlInnerRef}
            style={{ width: 92 + trackW + 30, ["--tscale" as string]: trackScale } as React.CSSProperties}
            onPointerDown={(e) => {
              // Sur une zone vide : un simple clic déplace le curseur ; un glissement trace
              // un rectangle de sélection multiple (façon explorateur de fichiers).
              const el = e.target as HTMLElement;
              if (el.closest(".a-clip, .a-chip, .a-wave-bar, .a-trim, .a-fade-dot, .a-lane-label, .a-ruler")) return;
              if (e.clientX - (tlInnerRef.current?.getBoundingClientRect().left ?? 0) < 92) return; // gouttière labels
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
            <div
              className="a-ruler"
              ref={rulerRef}
              style={{ marginLeft: 92, width: trackW, cursor: "pointer" }}
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
              <div className="a-lane-track">
                {clips.length === 0 && (
                  <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>{t('importFirstRush')}</span>
                )}
                {clipStarts.map((c, i) => (
                  <div key={c.id} style={{ position: "absolute", left: c.start * pps, display: "flex", alignItems: "center" }}>
                    <div
                      data-selid={c.id}
                      className={"a-clip" + (selectedClipId === c.id || multiSel.has(c.id) ? " on" : "")}
                      style={{ width: c.dur * pps, height: blockH("video"), position: "relative", cursor: tlGhost?.id === c.id ? "grabbing" : "grab", touchAction: "none", opacity: tlGhost?.id === c.id ? 0.3 : 1,
                        background: c.kind === "video"
                          ? (strips[c.id] ? `linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.34)), url("${strips[c.id]}")` : "linear-gradient(150deg,#2b8d57,#0c2a1d)")
                          : undefined,
                        backgroundSize: c.kind === "video" && strips[c.id] ? "100% 100%, 100% 100%" : undefined }}
                      onPointerDown={(e) => startTlDrag(e, c.id, "clip")}
                      onPointerMove={onTlDragMove}
                      onPointerUp={onTlDragUp}
                      onContextMenu={(e) => { e.preventDefault(); selectClip(c.id); setClipMenu({ x: e.clientX, y: e.clientY, id: c.id, kind: "clip" }); }}
                    >
                      {c.kind === "photo" && <img src={c.src} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: clipFilterCss(c) }} />}
                      {/* Le son fait UN avec la vidéo : spectre audio intégré en bas du plan (façon CapCut). */}
                      {c.kind === "video" && (c.vol ?? 1) > 0 && clipWaves[c.src] && (
                        <div className="a-clip-wave">
                          <svg width="100%" height="100%" preserveAspectRatio="none">
                            {clipWaves[c.src].map((p, wi) => { const arr = clipWaves[c.src]; const x = (wi / arr.length) * 100; const h = Math.max(10, p * 100); return <rect key={wi} x={`${x}%`} y={`${(100 - h) / 2}%`} width={`${100 / arr.length}%`} height={`${h}%`} fill="rgba(255,255,255,.82)" />; })}
                          </svg>
                        </div>
                      )}
                      {/* Rampe de fondu du son, dessinée sur le plan (mêmes repères que l'audio). */}
                      {c.kind === "video" && (c.vol ?? 1) > 0 && ((c.audioFadeIn ?? 0) > 0 || (c.audioFadeOut ?? 0) > 0) && (() => {
                        const w = c.dur * pps, H = 30;
                        const fi = Math.max(0, Math.min(c.dur, c.audioFadeIn ?? 0)) * pps;
                        const fo = Math.max(0, Math.min(c.dur, c.audioFadeOut ?? 0)) * pps;
                        return (
                          <svg className="a-clip-fade" viewBox={`0 0 ${Math.max(1, w)} ${H}`} preserveAspectRatio="none">
                            {fi > 0 && <><polygon points={`0,${H} ${fi},0 ${fi},${H}`} fill="rgba(0,0,0,.4)" /><line x1="0" y1={H} x2={fi} y2="0" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".95" /></>}
                            {fo > 0 && <><polygon points={`${w},${H} ${w - fo},0 ${w - fo},${H}`} fill="rgba(0,0,0,.4)" /><line x1={w} y1={H} x2={w - fo} y2="0" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".95" /></>}
                          </svg>
                        );
                      })()}
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
                    {i < clipStarts.length - 1 && (
                      <button
                        className={"a-trans-pill" + (selectedClipId === clipStarts[i + 1].id ? " active" : "")}
                        style={{ position: "absolute", left: c.dur * pps }}
                        title={TRANSITIONS.find((tr) => tr.id === clipStarts[i + 1].transitionIn) ? tc(`transition.${clipStarts[i + 1].transitionIn}`) : tc('transition.cut')}
                        onClick={() => { selectClip(clipStarts[i + 1].id); setTool("transitions"); }}
                      >
                        {TRANSITIONS.find((tr) => tr.id === clipStarts[i + 1].transitionIn)?.glyph || "▮▮"}
                      </button>
                    )}
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
                  {isTop && (
                    <button onClick={() => setExtraVideoTracks((n) => n + 1)} title={t('addVideoTrack')}
                      style={{ width: 18, height: 18, borderRadius: 5, border: "1px solid var(--line)", background: "var(--canvas)", color: "var(--ink-2)", fontSize: 14, lineHeight: "14px", cursor: "pointer", flexShrink: 0, padding: 0 }}>+</button>
                  )}
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
                        background: o.kind === "video"
                          ? (strips[o.id] ? `linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.4)), url("${strips[o.id]}")` : "linear-gradient(150deg,#2b8d57,#0c2a1d)")
                          : "linear-gradient(150deg,#c8792f,#5e3a1a)",
                        backgroundSize: o.kind === "video" && strips[o.id] ? "100% 100%, 100% 100%" : undefined }}
                      title={o.name}
                      onPointerDown={(e) => startTlDrag(e, o.id, "overlay")}
                      onPointerMove={onTlDragMove}
                      onPointerUp={onTlDragUp}
                      onContextMenu={(e) => { e.preventDefault(); selectOverlay(o.id); setClipMenu({ x: e.clientX, y: e.clientY, id: o.id, kind: "overlay" }); }}
                    >
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
              return (
              <div className="a-lane" style={{ height: laneH(`a${atrack}`), order: 6 }} key={"atrack-" + atrack}>
                <LaneResize laneKey={`a${atrack}`} />
                <div className="a-lane-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <VIcon name="music" size={13} />
                  <span className="trunc">{audioTrackCount > 1 ? `${t('railAudio')} ${atrack + 1}` : t('railAudio')}</span>
                  <LaneControls laneKey={`a${atrack}`} audio />
                  {isFirstA && (
                    <button onClick={() => setExtraAudioTracks((n) => n + 1)} title={t('addAudioTrack')}
                      style={{ width: 18, height: 18, borderRadius: 5, border: "1px solid var(--line)", background: "var(--canvas)", color: "var(--ink-2)", fontSize: 14, lineHeight: "14px", cursor: "pointer", flexShrink: 0, padding: 0 }}>+</button>
                  )}
                </div>
                <div className="a-lane-track">
                  {audioTracks.filter((a) => (a.track ?? 0) === atrack).map((a) => (
                    <div key={a.id} data-selid={a.id} className="a-wave-bar" style={{ left: a.offset * pps, width: a.dur * pps, top: 2, height: blockH(`a${a.track ?? 0}`), cursor: "grab", touchAction: "none", boxShadow: selectedAudioId === a.id || multiSel.has(a.id) ? "inset 0 0 0 2px var(--acid)" : undefined }} title={a.name}
                      onPointerDown={(e) => onAudioBarDown(e, a)} onPointerMove={onAudioBarMove} onPointerUp={onAudioBarUp}
                      onContextMenu={(e) => { e.preventDefault(); setSelectedAudioId(a.id); setTool("audio"); setClipMenu({ x: e.clientX, y: e.clientY, id: a.id, kind: "audio" }); }}>
                      {a.waveform && a.waveform.length > 0 && (
                        <svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
                          {a.waveform.map((p, i) => {
                            const x = (i / a.waveform!.length) * 100;
                            const h = Math.max(6, p * 100);
                            return <rect key={i} x={`${x}%`} y={`${(100 - h) / 2}%`} width={`${100 / a.waveform!.length}%`} height={`${h}%`} fill="#fff" />;
                          })}
                        </svg>
                      )}
                      <span style={{ position: "absolute", left: 6, top: 4, fontSize: 9.5, fontWeight: 700, color: "#fff" }}>{a.kind === "voiceover" ? "🎙" : "🎵"} {a.name}</span>
                      {(() => {
                        const w = a.dur * pps, H = 30;
                        const fi = Math.max(0, Math.min(a.dur, a.fadeIn ?? 0)) * pps;
                        const fo = Math.max(0, Math.min(a.dur, a.fadeOut ?? 0)) * pps;
                        return (
                          <>
                            <svg width="100%" height="100%" viewBox={`0 0 ${Math.max(1, w)} ${H}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                              {fi > 0 && <polygon points={`0,${H} ${fi},0 ${fi},${H}`} fill="rgba(0,0,0,.34)" />}
                              {fo > 0 && <polygon points={`${w},${H} ${w - fo},0 ${w - fo},${H}`} fill="rgba(0,0,0,.34)" />}
                              {fi > 0 && <line x1="0" y1={H} x2={fi} y2="0" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".95" />}
                              {fo > 0 && <line x1={w} y1={H} x2={w - fo} y2="0" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".95" />}
                            </svg>
                            <span className="a-fade-dot" style={{ left: Math.max(0, fi) - 5 }} title={t('fadeIn')}
                              onPointerDown={(e) => startFadeDrag(e, a, "fadeIn")} onPointerMove={onFadeDragMove} onPointerUp={onFadeDragUp} />
                            <span className="a-fade-dot" style={{ left: Math.max(0, w - fo) - 5 }} title={t('fadeOut')}
                              onPointerDown={(e) => startFadeDrag(e, a, "fadeOut")} onPointerMove={onFadeDragMove} onPointerUp={onFadeDragUp} />
                          </>
                        );
                      })()}
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
                  <div key={c.id} className={"a-chip a-chip-cap" + (selectedCaptionId === c.id ? " on" : "")} style={{ left: c.start * pps, width: Math.max(20, (c.end - c.start) * pps), top: 2, height: blockH("subs"), cursor: "grab", touchAction: "none" }} title={c.text}
                    onPointerDown={(e) => onCaptionBarDown(e, c)} onPointerMove={onCaptionBarMove} onPointerUp={onCaptionBarUp}
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
            <div className="a-lane" style={{ height: laneH("text"), order: 2 }}>
              <LaneResize laneKey="text" />
              <div className="a-lane-label" style={{ display: "flex", alignItems: "center", gap: 4 }}><VIcon name="text" size={13} /> <span className="trunc">{t('railText')}</span><LaneControls laneKey="text" audio /></div>
              <div className="a-lane-track">
                {titles.map((ti) => (
                  <div key={ti.id} className={"a-chip a-chip-title" + (selectedTitleId === ti.id ? " on" : "")} style={{ left: ti.start * pps, width: Math.max(20, (ti.end - ti.start) * pps), top: 2, height: blockH("text"), cursor: "grab", touchAction: "none" }} title={ti.text}
                    onPointerDown={(e) => onTitleBarDown(e, ti)} onPointerMove={onTitleBarMove} onPointerUp={onTitleBarUp}
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
            <div className="a-playhead" style={{ left: 92 + time * pps }} />
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
        const bg = isPhoto ? "linear-gradient(150deg,#c8792f,#5e3a1a)" : (strip ? `linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.34)), url("${strip}")` : "linear-gradient(150deg,#2b8d57,#0c2a1d)");
        return (
          <div className="a-tl-ghost" style={{ left: tlGhost.x, top: tlGhost.y, width: Math.max(28, tlGhost.w), background: bg, backgroundSize: strip && !isPhoto ? "100% 100%, 100% 100%" : undefined }}>
            {isPhoto && (gi as { src?: string }).src && (
              <img src={(gi as { src?: string }).src} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: .9 }} />
            )}
            <span className="a-tl-ghost-ic"><VIcon name={isPhoto ? "image" : "video"} size={10} /></span>
            <span className="a-tl-ghost-lbl">{gi.name}</span>
          </div>
        );
      })()}

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
