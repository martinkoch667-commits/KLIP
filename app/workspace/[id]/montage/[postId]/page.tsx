"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { VIcon } from "./icons";
import {
  MontageClip, OverlayClip, Caption, TitleEl, StickerEl, AudioTrack, MontageProject, SubCustom,
  FILTERS, TRANSITIONS, SUB_STYLES, FONT_CHOICES, SUB_LENGTHS, DEFAULT_WORDS_PER_CAPTION, DEFAULT_SUB_POS,
  subStyleById, effectiveSubStyle,
  fmt, newClipDefaults, newOverlayDefaults, clipFilterCss, overlayFilterCss, clipTimelineDur, overlayTimelineDur, segmentCaptions,
  audioVolumeAt, kenBurnsScale, VIDEO_FORMATS, videoFormatById, EXPORT_QUALITIES,
} from "./constants";
import { MontageCtx, CutPanel, TextPanel, CaptionsPanel, AudioPanel, TransitionsPanel, FilterPanel, SpeedPanel, StickerPanel, OverlayPanel, AiPanel } from "./panels";
import { renderExport } from "./export";
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
    v.onloadedmetadata = () => resolve(v.duration && isFinite(v.duration) ? v.duration : 4);
    v.onerror = () => resolve(4);
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
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [audioOnlyId, setAudioOnlyId] = useState<string | null>(null); // sélection "audio seul" (Option/Alt+clic)
  const [dragOver, setDragOver] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingOverlay, setUploadingOverlay] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [croppingClipId, setCroppingClipId] = useState<string | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [suggestingMusic, setSuggestingMusic] = useState(false);
  const [musicSuggestion, setMusicSuggestion] = useState<string | null>(null);
  const [isRecordingVO, setIsRecordingVO] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportPhase, setExportPhase] = useState<"render" | "transcode">("render");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pps, setPps] = useState(40);
  const [histTick, setHistTick] = useState(0);
  const [extraVideoTracks, setExtraVideoTracks] = useState(0); // pistes vidéo vides ajoutées par l'utilisateur (au-delà des pistes occupées)
  const [extraAudioTracks, setExtraAudioTracks] = useState(0); // idem pour les pistes audio ajoutées

  // Disposition redimensionnable (persistée) — comme CapCut
  const [panelW, setPanelW] = useState(312);
  const [timelineH, setTimelineH] = useState(178);
  useEffect(() => {
    try {
      const w = Number(localStorage.getItem("klip-mz-panelW"));
      const h = Number(localStorage.getItem("klip-mz-timelineH"));
      if (w >= 240 && w <= 520) setPanelW(w);
      if (h >= 120 && h <= 640) setTimelineH(h);
    } catch {}
  }, []);
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null); // import « vidéos » dédié
  const photoInputRef = useRef<HTMLInputElement>(null); // import « photos » dédié
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadedSrcRef = useRef<string | null>(null);
  const overlayVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const scrubRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOverlayRef = useRef<{ type: "title" | "sticker" | "caption" | "overlay"; id: string } | null>(null);
  const resizeOverlayRef = useRef<{ type: "title" | "sticker" | "caption" | "overlay"; id: string; startDist: number; startScale: number; cx: number; cy: number } | null>(null);
  const voRecorderRef = useRef<MediaRecorder | null>(null);
  const voChunksRef = useRef<Blob[]>([]);
  const rulerRef = useRef<HTMLDivElement>(null);
  const scrubbingRulerRef = useRef(false);
  const trimRef = useRef<{ id: string; edge: "start" | "end"; startX: number; t0start: number; t0end: number; kind: "video" | "photo"; srcDur: number; speed: number } | null>(null);
  const ovDragRef = useRef<{ id: string; startX: number; t0offset: number } | null>(null);
  // Déplacement d'un plan dans le temps (ajuste gapBefore = écran noir devant lui).
  // anchor = fin du plan précédent (point fixe pendant le drag) ; playAt = curseur figé au down.
  const clipDragRef = useRef<{ id: string; startX: number; t0gap: number; anchor: number; playAt: number; moved: boolean } | null>(null);
  const ovTrimRef = useRef<{ id: string; edge: "start" | "end"; startX: number; t0start: number; t0end: number; t0offset: number; srcDur: number; kind: "video" | "photo" } | null>(null);
  const clipboardRef = useRef<{ type: "clip"; data: MontageClip } | { type: "overlay"; data: OverlayClip } | null>(null);

  function toast(msg: string) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3200);
  }

  // ── Édition inline d'un titre : focus + sélection à l'entrée en édition ─────
  const titleEditRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!editingTitleId || !titleEditRef.current) return;
    const el = titleEditRef.current;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editingTitleId]);

  // ── Mesure de la largeur de la preview (pour figer la taille du texte) ──────
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStageW(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  // ── Load project ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [{ data: post }, { data: ws }] = await Promise.all([
        supabase.from("posts").select("montage_json, brief, photo_url").eq("id", postId).single(),
        supabase.from("workspaces").select("logo_url").eq("id", workspaceId).single(),
      ]);
      if (post?.brief) setProjectName(post.brief);
      if (ws?.logo_url) setLogoUrl(ws.logo_url);
      const proj = post?.montage_json as Partial<MontageProject> | null;
      if (proj?.clips?.length) {
        setClips(proj.clips.map(normalizeClip));
        setOverlays(proj.overlays || []);
        setCaptions(proj.captions || []);
        setSubStyleId(proj.subStyleId || SUB_STYLES[0].id);
        setSubMaxWords(proj.subMaxWords || DEFAULT_WORDS_PER_CAPTION);
        setSubPos(proj.subPos || DEFAULT_SUB_POS);
        setSubCustom(proj.subCustom || {});
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
      const project: MontageProject = { clips, overlays, captions, subStyleId, subMaxWords, subPos, subCustom, rawSegments, titles, stickers, audioTracks, showProgressBar, exportUrl, formatId, customW, customH, exportQuality };
      supabase.from("posts").update({ montage_json: project }).eq("id", postId).then(() => {});
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [clips, overlays, captions, subStyleId, subMaxWords, subPos, subCustom, rawSegments, titles, stickers, audioTracks, showProgressBar, exportUrl, formatId, customW, customH, exportQuality, loading, postId, supabase]);

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
  const clipStarts = useMemo(() => {
    let acc = 0;
    return clips.map((c) => { acc += Math.max(0, c.gapBefore ?? 0); const start = acc; const dur = clipTimelineDur(c); acc += dur; return { ...c, start, end: acc, dur }; });
  }, [clips]);
  const total = clipStarts.length ? clipStarts[clipStarts.length - 1].end : 0;
  // Plan couvrant l'instant courant. Dans un « trou » (écran noir avant un plan) → null,
  // pour que la preview affiche du noir plutôt que de figer le plan précédent. En toute fin
  // de timeline (time >= total), on garde le dernier plan affiché.
  const coveringClip = clipStarts.find((c) => time >= c.start && time < c.end);
  const activeClip = coveringClip || (clipStarts.length && time >= total ? clipStarts[clipStarts.length - 1] : null);
  const selectedClip = clipStarts.find((c) => c.id === selectedClipId) || null;
  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId) || null;
  const activeOverlays = useMemo(
    () => overlays.filter((o) => time >= o.offset && time < o.offset + overlayTimelineDur(o)),
    [overlays, time],
  );
  // Pistes vidéo empilables : autant que la piste la plus haute occupée (+1), plus les
  // pistes vides ajoutées à la main. Toujours au moins une.
  const maxOverlayTrack = useMemo(() => overlays.reduce((m, o) => Math.max(m, o.track ?? 0), 0), [overlays]);
  const videoTrackCount = Math.max(1, maxOverlayTrack + 1) + extraVideoTracks;
  // Pistes audio ajoutées (musique/voix off). Le son embarqué des plans a sa propre rangée dédiée.
  const maxAudioTrack = useMemo(() => audioTracks.reduce((m, a) => Math.max(m, a.track ?? 0), 0), [audioTracks]);
  const audioTrackCount = Math.max(1, maxAudioTrack + 1) + extraAudioTracks;

  const seek = useCallback((t: number) => {
    const clamped = Math.max(0, Math.min(total, t));
    setTime(clamped);
    const c = clipStarts.find((c) => clamped >= c.start && clamped < c.end); // null dans un trou (écran noir)
    if (c && c.kind === "video" && videoRef.current && loadedSrcRef.current === c.src) {
      videoRef.current.currentTime = c.trimStart + (clamped - c.start) * c.speed;
    }
  }, [total, clipStarts]);

  // ── Charge/synchronise le <video> quand le clip actif change ────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeClip || activeClip.kind !== "video") return;
    if (loadedSrcRef.current !== activeClip.src) {
      v.src = activeClip.src;
      loadedSrcRef.current = activeClip.src;
    }
    v.playbackRate = activeClip.speed;
    const localTime = activeClip.trimStart + (time - activeClip.start) * activeClip.speed;
    if (Math.abs(v.currentTime - localTime) > 0.35) v.currentTime = Math.max(0, localTime);
    if (playing) v.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClip?.id]);

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
  useEffect(() => {
    if (!playing) return;
    if (activeClip && activeClip.kind !== "photo") return; // un plan vidéo pilote lui-même l'horloge
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setTime((t) => { const n = t + dt; if (n >= total) { setPlaying(false); return 0; } return n; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, activeClip?.id, activeClip?.kind, total]);

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
      if (!els[a.id]) { const el = new Audio(a.src); el.preload = "auto"; els[a.id] = el; }
    });
  }, [audioTracks]);

  useEffect(() => {
    if (!playing) {
      Object.values(audioElsRef.current).forEach((el) => el.pause());
      return;
    }
    let raf = 0;
    const tick = () => {
      const t = timeRef.current;
      for (const a of audioTracksRef.current) {
        const el = audioElsRef.current[a.id];
        if (!el) continue;
        const within = t >= a.offset && t < a.offset + a.dur;
        if (within) {
          const local = t - a.offset;
          if (Math.abs(el.currentTime - local) > 0.3) el.currentTime = local;
          if (el.paused) el.play().catch(() => {});
          el.volume = audioVolumeAt(a, local);
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
      if (within) { el.currentTime = time - a.offset; el.volume = audioVolumeAt(a, time - a.offset); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

  function onVideoTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    if (!activeClip || activeClip.kind !== "video") return;
    const v = e.currentTarget;
    if (v.currentTime >= activeClip.trimEnd - 0.02) { onVideoEnded(); return; }
    const localTimelineTime = (v.currentTime - activeClip.trimStart) / activeClip.speed;
    setTime(activeClip.start + Math.max(0, localTimelineTime));
  }
  function onVideoEnded() {
    if (!activeClip) return;
    const idx = clipStarts.findIndex((c) => c.id === activeClip.id);
    if (idx >= 0 && idx < clipStarts.length - 1) {
      // Avance jusqu'à la fin du plan : s'il y a un trou (écran noir) avant le suivant,
      // l'horloge RAF le traversera ; sinon on est déjà au début du plan suivant.
      setTime(activeClip.end + 0.001);
    } else { setTime(0); setPlaying(false); }
  }

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
      if (error) continue;
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

  // ── Actions clip (timeline) ─────────────────────────────────────────────────
  function selectClip(id: string) {
    setSelectedClipId(id);
    setAudioOnlyId(null);
    setSelectedOverlayId(null);
    const c = clipStarts.find((c) => c.id === id);
    if (c) seek(c.start + 0.05);
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
  function onClipDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) { setDraggingId(null); return; }
    setClips((prev) => {
      const from = prev.findIndex((c) => c.id === draggingId);
      const to = prev.findIndex((c) => c.id === targetId);
      if (from < 0 || to < 0) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
    setDraggingId(null);
  }

  function updateClip(id: string, patch: Partial<MontageClip>) {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function splitAtPlayhead() {
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
    const start = time, end = Math.min(total || time + 3, time + 3);
    setTitles((prev) => [...prev, { id, start, end, text: t('newTitleDefault'), font: "archivo", color: "#FFFFFF", anim: "rise", x: 50, y: 78 }]);
    setSelectedTitleId(id);
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
  }
  async function generateCaptionsAI() {
    const videoClip = clips.find((c) => c.kind === "video");
    if (!videoClip) return;
    setTranscribing(true);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoClip.src }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast(data?.message || t('toastTranscriptionUnavailable'));
        return;
      }
      const segs = (data.segments || []) as { start: number; end: number; text: string }[];
      setRawSegments(segs);
      const newCaps: Caption[] = segmentCaptions(segs, subMaxWords);
      setCaptions(newCaps);
      toast(t('toastCaptionsGenerated', { count: newCaps.length }));
    } catch {
      toast(t('toastTranscriptionError'));
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
  function removeOverlay(id: string) {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedOverlayId === id) setSelectedOverlayId(null);
  }
  function duplicateOverlay(id: string) {
    setOverlays((prev) => {
      const src = prev.find((o) => o.id === id);
      if (!src) return prev;
      const copy = { ...src, id: crypto.randomUUID(), offset: src.offset + 0.3, x: Math.min(100, src.x + 4), y: Math.min(100, src.y + 4) };
      return [...prev, copy];
    });
  }
  function selectOverlay(id: string) {
    setSelectedOverlayId(id);
    setSelectedClipId(null); setSelectedTitleId(null); setSelectedStickerId(null); setSubSelected(false);
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
      v.volume = o.vol ?? 1;
      const localTime = o.trimStart + (time - o.offset);
      if (Math.abs(v.currentTime - localTime) > 0.4) v.currentTime = Math.max(0, localTime);
      if (playing) v.play().catch(() => {}); else if (!v.paused) v.pause();
    });
  }, [overlays, time, playing]);

  // ── Overlays de scène (drag titres/stickers/sous-titres) ────────────────────
  function onOverlayPointerDown(e: React.PointerEvent, type: "title" | "sticker" | "caption" | "overlay", id: string) {
    e.stopPropagation();
    dragOverlayRef.current = { type, id };
    if (type === "title") { setSelectedTitleId(id); setSubSelected(false); setSelectedOverlayId(null); }
    else if (type === "sticker") { setSelectedStickerId(id); setSubSelected(false); setSelectedOverlayId(null); }
    else if (type === "overlay") { setSelectedOverlayId(id); setSubSelected(false); setSelectedTitleId(null); setSelectedStickerId(null); setTool("overlay"); }
    else setSubSelected(true);
  }
  function onOverlayResizeDown(e: React.PointerEvent, type: "title" | "sticker" | "caption" | "overlay", id: string, currentScale: number) {
    e.stopPropagation();
    e.preventDefault();
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    // centre de l'overlay = position (x,y) en % de la scène (les overlays sont centrés dessus)
    const pos = type === "caption" ? subPos
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
      const scale = Math.max(0.4, Math.min(4, rz.startScale * (dist / rz.startDist)));
      if (rz.type === "title") updateTitle(rz.id, { scale });
      else if (rz.type === "sticker") updateSticker(rz.id, { scale });
      else if (rz.type === "overlay") updateOverlay(rz.id, { scale: Math.max(0.2, Math.min(2.5, scale)) });
      else setSubCustom((c) => ({ ...c, scale: Math.max(0.5, Math.min(2.4, scale)) }));
      return;
    }
    const drag = dragOverlayRef.current;
    if (!drag) return;
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    if (drag.type === "title") updateTitle(drag.id, { x, y });
    else if (drag.type === "sticker") updateSticker(drag.id, { x, y });
    else if (drag.type === "overlay") updateOverlay(drag.id, { x, y });
    else setSubPos({ x, y });
  }
  function onStagePointerUp() { dragOverlayRef.current = null; resizeOverlayRef.current = null; }

  // ── Export réel ──────────────────────────────────────────────────────────
  async function handleExport() {
    if (!clips.length || exporting) return;
    setExporting(true);
    setExportPhase("render");
    setExportProgress(0);
    try {
      const { blob: webmBlob, thumbnailBlob } = await renderExport({ clips, overlays, captions, subStyleId, subCustom, subPos, titles, stickers, audioTracks, showProgressBar, formatId, customW, customH, exportQuality }, (p) => setExportProgress(p));

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
        montage_json: { clips, overlays, captions, subStyleId, subMaxWords, subPos, subCustom, rawSegments, titles, stickers, audioTracks, showProgressBar, exportUrl: urlData.publicUrl, formatId, customW, customH, exportQuality },
        photo_url: urlData.publicUrl,
        ...(thumbUrl ? { thumbnail_url: thumbUrl } : {}),
      }).eq("id", postId);
      toast(t('toastExportDone'));
    } catch (e) {
      toast(t('toastExportError', { msg: e instanceof Error ? e.message : t('toastUnknownError') }));
    } finally {
      setExporting(false);
    }
  }

  // ── Raccourcis clavier (type CapCut) ────────────────────────────────────────
  function deleteSelected() {
    if (selectedOverlayId) { removeOverlay(selectedOverlayId); return; }
    if (selectedTitleId) { removeTitle(selectedTitleId); return; }
    if (selectedStickerId) { removeSticker(selectedStickerId); return; }
    if (selectedClipId) removeClip(selectedClipId);
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
      if (meta && k === "v") { e.preventDefault(); pasteClipboard(); return; }
      if (meta && k === "d") { e.preventDefault(); duplicateSelectedAny(); return; }
      if (meta && k === "b") { e.preventDefault(); splitAtPlayhead(); return; }
      if (meta && (k === "=" || k === "+")) { e.preventDefault(); setPps((p) => Math.min(160, Math.round(p * 1.3))); return; }
      if (meta && k === "-") { e.preventDefault(); setPps((p) => Math.max(10, Math.round(p / 1.3))); return; }
      if (meta) return; // laisse passer les autres raccourcis système
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
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    trimRef.current = { id: c.id, edge, startX: e.clientX, t0start: c.trimStart, t0end: c.trimEnd, kind: c.kind, srcDur: c.srcDur, speed: c.speed };
    setSelectedClipId(c.id);
  }
  function onTrimMove(e: React.PointerEvent) {
    const d = trimRef.current;
    if (!d) return;
    const deltaSrc = ((e.clientX - d.startX) / pps) * (d.kind === "video" ? d.speed : 1);
    if (d.edge === "start") {
      const ns = Math.max(0, Math.min(d.t0end - 0.3, d.t0start + deltaSrc));
      updateClip(d.id, { trimStart: ns });
    } else {
      const cap = d.kind === "video" ? d.srcDur : 15;
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

  // Zoom timeline à la molette (Ctrl/⌘ + molette), comme CapCut / Premiere.
  function onTimelineWheel(e: React.WheelEvent) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setPps((p) => Math.max(10, Math.min(160, Math.round(p * (e.deltaY < 0 ? 1.12 : 0.89)))));
  }

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

  // ── Plan principal : déplacement dans le temps (poignée) = ajuste gapBefore ──
  function onClipBarDown(e: React.PointerEvent, c: { id: string; start: number; gapBefore?: number }) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const t0gap = Math.max(0, c.gapBefore ?? 0);
    clipDragRef.current = { id: c.id, startX: e.clientX, t0gap, anchor: c.start - t0gap, playAt: time, moved: false };
  }
  function onClipBarMove(e: React.PointerEvent) {
    const d = clipDragRef.current;
    if (!d) return;
    const deltaPx = e.clientX - d.startX;
    if (!d.moved && Math.abs(deltaPx) < 4) return; // seuil : un simple clic ne déplace rien
    d.moved = true;
    let newStart = d.anchor + d.t0gap + deltaPx / pps;
    const th = 8 / pps;
    if (Math.abs(newStart - d.anchor) < th) newStart = d.anchor;      // colle au plan précédent (trou = 0)
    else if (Math.abs(newStart - d.playAt) < th) newStart = d.playAt; // colle au curseur de lecture
    updateClip(d.id, { gapBefore: Math.max(0, newStart - d.anchor) });
  }
  function onClipBarUp(e: React.PointerEvent) {
    if (clipDragRef.current) { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} clipDragRef.current = null; }
  }

  // ── Incrustation : déplacement (offset) + rognage sur la timeline ───────────
  function onOvBarDown(e: React.PointerEvent, o: OverlayClip) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ovDragRef.current = { id: o.id, startX: e.clientX, t0offset: o.offset };
    setSelectedOverlayId(o.id); setSelectedClipId(null); setTool("overlay");
  }
  function onOvBarMove(e: React.PointerEvent) {
    const d = ovDragRef.current;
    if (!d) return;
    const delta = (e.clientX - d.startX) / pps;
    updateOverlay(d.id, { offset: Math.max(0, snapTime(d.t0offset + delta)) });
  }
  function onOvBarUp(e: React.PointerEvent) {
    if (ovDragRef.current) { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} ovDragRef.current = null; }
  }
  function startOvTrim(e: React.PointerEvent, o: OverlayClip, edge: "start" | "end") {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    ovTrimRef.current = { id: o.id, edge, startX: e.clientX, t0start: o.trimStart, t0end: o.trimEnd, t0offset: o.offset, srcDur: o.srcDur, kind: o.kind };
    setSelectedOverlayId(o.id); setTool("overlay");
  }
  function onOvTrimMove(e: React.PointerEvent) {
    const d = ovTrimRef.current;
    if (!d) return;
    const delta = (e.clientX - d.startX) / pps;
    if (d.edge === "end") {
      const cap = d.kind === "video" ? d.srcDur : 15;
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

  const ctx: MontageCtx = {
    clips, selectedClip, captions, subStyleId, subMaxWords, subCustom, subPos, hasRawSegments: rawSegments.length > 0,
    titles, stickers, audioTracks, showProgressBar,
    overlays, selectedOverlay, uploadingOverlay, addOverlayFiles, updateOverlay, removeOverlay, duplicateOverlay, selectOverlay,
    videoTrackCount, moveOverlayTrack,
    time, total, logoUrl, uploadingAudio, transcribing, isRecordingVO,
    croppingClipId, smartCropClip, assembling, autoAssembleAI, suggestingMusic, musicSuggestion, suggestMusicMoodAI,
    toast, updateClip, splitAtPlayhead,
    duplicateSelected: () => selectedClipId && duplicateClip(selectedClipId),
    removeSelected: () => selectedClipId && removeClip(selectedClipId),
    applyTransitionToAll,
    addTitle, updateTitle, removeTitle,
    addCaption, updateCaption, removeCaption, setSubStyleId, setCaptionLength, generateCaptionsAI,
    setSubCustom, resetSubCustom: () => setSubCustom({}), applySubTemplate,
    addSticker, updateSticker, removeSticker,
    toggleProgressBar, importAudio, removeAudioTrack, setAudioVol, setAudioFade, toggleRecordVO,
    audioTrackCount, moveAudioTrackRow,
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
  const activeTitles = titles.filter((t) => time >= t.start && time <= t.end);
  const activeStickers = stickers.filter((s) => time >= s.start && time <= s.end);
  const activeCaption = captions.find((c) => time >= c.start && time <= c.end);
  const capStyle = effectiveSubStyle(subStyleId, subCustom);

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
      <div className="ed-topbar" style={{ height: 58, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", borderBottom: "1px solid var(--line)", background: "color-mix(in srgb, var(--canvas) 72%, transparent)", backdropFilter: "blur(10px)", position: "relative", zIndex: 30 }}>
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
        {exportUrl && (
          <a href={`/workspace/${workspaceId}/planning?post=${postId}`} className="btn btn-sm btn-dark" style={{ gap: 5, textDecoration: "none" }}>
            <VIcon name="calendar" size={15} /> {t('schedule')}
          </a>
        )}
        <select value={exportQuality} onChange={e => setExportQuality(e.target.value)} title={t('exportQualityTitle')}
          style={{ height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "var(--canvas)", color: "var(--ink-2)", fontSize: 12.5, fontWeight: 600, padding: "0 8px" }}>
          {EXPORT_QUALITIES.map(q => <option key={q.id} value={q.id}>{tc(`exportQuality.${q.id}`)}</option>)}
        </select>
        <button className="btn btn-sm btn-primary" disabled={!clips.length || exporting} onClick={handleExport}>
          <VIcon name="export" size={15} /> {exporting ? t('exportingShort') : t('exportBtn')}
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
            <div
              className="mz-phone"
              style={{ aspectRatio: `${activeFmt.w} / ${activeFmt.h}` }}
              ref={stageRef}
              onPointerMove={onStagePointerMove}
              onPointerUp={onStagePointerUp}
              onPointerLeave={onStagePointerUp}
            >
              <div className="mz-video">
                {activeClip ? (
                  activeClip.kind === "video"
                    ? <video ref={videoRef} onTimeUpdate={onVideoTimeUpdate} onEnded={onVideoEnded} playsInline muted={false} style={{ filter: clipFilterCss(activeClip), objectPosition: `${(activeClip.focusX ?? 0.5) * 100}% ${(activeClip.focusY ?? 0.5) * 100}%` }} />
                    : <img src={activeClip.src} alt="" style={{
                        filter: clipFilterCss(activeClip),
                        objectPosition: `${(activeClip.focusX ?? 0.5) * 100}% ${(activeClip.focusY ?? 0.5) * 100}%`,
                        transform: `scale(${kenBurnsScale(activeClip.kenBurns, activeClip.dur > 0 ? Math.min(1, Math.max(0, (time - activeClip.start) / activeClip.dur)) : 0)})`,
                        transformOrigin: "center",
                      }} />
                ) : clips.length === 0 ? (
                  <div className="mz-vempty">
                    <VIcon name="upload" size={26} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t('importRushesEmpty')}</span>
                  </div>
                ) : (
                  // Des plans existent mais l'instant courant tombe dans un trou → écran noir.
                  null
                )}

                {/* incrustations (PIP) — déplaçables/redimensionnables/pivotables.
                    Triées par piste croissante : l'ordre du DOM fait le z-order (piste haute = au-dessus). */}
                {[...overlays].sort((a, b) => (a.track ?? 0) - (b.track ?? 0)).map((o) => {
                  const isActive = time >= o.offset && time < o.offset + overlayTimelineDur(o);
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
                          playsInline muted={(o.vol ?? 1) === 0}
                          style={{ width: "100%", display: "block", filter: overlayFilterCss(o) }}
                        />
                      ) : (
                        <img src={o.src} alt="" style={{ width: "100%", display: "block", filter: overlayFilterCss(o) }} />
                      )}
                      {sel && <button className="mz-ov-del" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeOverlay(o.id)}><VIcon name="x" size={11} /></button>}
                      {sel && <span className="mz-ov-resize" onPointerDown={(e) => onOverlayResizeDown(e, "overlay", o.id, o.scale)} title={t('resizeTitle')} />}
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
                      maxWidth: "80%", whiteSpace: "pre-wrap",
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
                    {selectedTitleId === ti.id && editingTitleId !== ti.id && <span className="mz-ov-resize" onPointerDown={(e) => onOverlayResizeDown(e, "title", ti.id, ti.scale ?? 1)} title={t('resizeTitle')} />}
                  </div>
                ))}

                {/* stickers */}
                {activeStickers.map((s) => (
                  <div
                    key={s.id}
                    className={"mz-ov-item" + (selectedStickerId === s.id ? " sel" : "")}
                    style={{ left: s.x + "%", top: s.y + "%", fontSize: 34 * s.scale, transform: `translate(-50%,-50%) scale(${s.isImage ? 1 : 1})` }}
                    onPointerDown={(e) => onOverlayPointerDown(e, "sticker", s.id)}
                  >
                    {s.isImage ? <img src={s.glyph} alt="" style={{ width: 40 * s.scale, height: 40 * s.scale, objectFit: "contain" }} /> : s.glyph}
                    {selectedStickerId === s.id && <button className="mz-ov-del" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeSticker(s.id)}><VIcon name="x" size={11} /></button>}
                    {selectedStickerId === s.id && <span className="mz-ov-resize" onPointerDown={(e) => onOverlayResizeDown(e, "sticker", s.id, s.scale)} title={t('resizeTitle')} />}
                  </div>
                ))}

                {/* sous-titres incrustés — déplaçables/redimensionnables */}
                {activeCaption && (
                  <div
                    className={"mz-cap-wrap mz-cap-move" + (subSelected ? " sel" : "")}
                    style={{ left: subPos.x + "%", top: subPos.y + "%", transform: `translate(-50%,-50%) scale(${capStyle.scale})` }}
                    onPointerDown={(e) => onOverlayPointerDown(e, "caption", "sub")}
                  >
                    <div className="mz-cap-box" style={{
                      background: capStyle.bg, color: capStyle.fg,
                      fontWeight: capStyle.weight, fontStyle: capStyle.italic ? "italic" : "normal",
                      fontFamily: capStyle.font || (capStyle.italic ? "var(--display)" : "var(--sans)"),
                      padding: capStyle.pill ? "6px 16px" : "8px 12px",
                      borderRadius: capStyle.pill ? 99 : 8,
                      textShadow: capStyle.bg === "transparent" && !capStyle.stroke ? "0 1px 8px rgba(0,0,0,.6)" : "none",
                      textTransform: capStyle.uppercase ? "uppercase" : "none",
                      WebkitTextStroke: capStyle.stroke ? `2px ${capStyle.stroke}` : undefined,
                      paintOrder: "stroke fill",
                      fontSize: 34 * previewScale,
                    }}>
                      {activeCaption.text.split(/\s+/).filter(Boolean).map((w, i, arr) => {
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
                            {w}{i < arr.length - 1 ? "\u00A0" : ""}
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
          <button className="a-tl-tool" disabled={!selectedClipId} onClick={splitAtPlayhead}><VIcon name="split" size={15} /> {t('splitShort')}</button>
          <button className="a-tl-tool" disabled={!selectedClipId} onClick={() => selectedClipId && duplicateClip(selectedClipId)}><VIcon name="copy" size={15} /> {t('duplicate')}</button>
          <button className="a-tl-tool" disabled={!selectedClipId} onClick={() => selectedClipId && removeClip(selectedClipId)}><VIcon name="trash" size={15} /> {t('delete')}</button>
          <div style={{ flex: 1 }} />
          <span className="mz-sec-label">{t('clipsCountTimeline', { count: clips.length, time: fmt(total) })}</span>
          <button className="mz-hbtn" onClick={() => setPps((p) => Math.max(10, Math.round(p / 1.3)))}><VIcon name="zoomOut" size={15} /></button>
          <button className="mz-hbtn" onClick={() => setPps((p) => Math.min(160, Math.round(p * 1.3)))}><VIcon name="zoomIn" size={15} /></button>
        </div>
        <div className="a-tl-scroll" onWheel={onTimelineWheel}>
          <div className="a-tl-inner" style={{ width: 92 + trackW + 30 }}>
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
            <div className="a-lane">
              <div className="a-lane-label"><VIcon name="video" size={13} /> {t('labelVideo')}</div>
              <div className="a-lane-track">
                {clips.length === 0 && (
                  <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>{t('importFirstRush')}</span>
                )}
                {clipStarts.map((c, i) => (
                  <div key={c.id} style={{ position: "absolute", left: c.start * pps, display: "flex", alignItems: "center" }}>
                    <div
                      className={"a-clip" + (selectedClipId === c.id ? " on" : "") + (draggingId === c.id ? " dragging" : "")}
                      style={{ width: c.dur * pps, background: c.kind === "video" ? "linear-gradient(150deg,#2b8d57,#0c2a1d)" : undefined, position: "static" }}
                      draggable
                      onDragStart={() => setDraggingId(c.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onClipDrop(c.id)}
                      onClick={() => selectClip(c.id)}
                    >
                      {c.kind === "photo" && <img src={c.src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: clipFilterCss(c) }} />}
                      <span className="a-clip-badge"><VIcon name={c.kind === "photo" ? "image" : "video"} size={10} /></span>
                      <span className="a-clip-dur">{c.dur.toFixed(1)}s</span>
                      <span className="a-clip-lbl">{c.name}</span>
                      {selectedClipId === c.id && (
                        <>
                          <div
                            draggable={false}
                            onDragStart={(e) => e.preventDefault()}
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => onClipBarDown(e, c)}
                            onPointerMove={onClipBarMove}
                            onPointerUp={onClipBarUp}
                            title={t('moveInTimeTitle')}
                            style={{ position: "absolute", top: 3, left: "50%", transform: "translateX(-50%)", width: 28, height: 9, borderRadius: 5, background: "rgba(255,255,255,.55)", cursor: "ew-resize", zIndex: 4, touchAction: "none" }}
                          />
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
                  </div>
                ))}
              </div>
            </div>
            {Array.from({ length: videoTrackCount }).map((_, idx) => {
              const track = videoTrackCount - 1 - idx; // le haut de la timeline = la piste la plus haute (au-dessus)
              const isTop = idx === 0;
              const laneOverlays = overlays.filter((o) => (o.track ?? 0) === track);
              return (
              <div className="a-lane" style={{ height: 34 }} key={"vtrack-" + track}>
                <div className="a-lane-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <VIcon name="image" size={13} />
                  <span className="trunc">{videoTrackCount > 1 ? `${t('railOverlay')} ${track + 1}` : t('railOverlay')}</span>
                  {isTop && (
                    <button onClick={() => setExtraVideoTracks((n) => n + 1)} title={t('addVideoTrack')}
                      style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: 5, border: "1px solid var(--line)", background: "var(--canvas)", color: "var(--ink-2)", fontSize: 14, lineHeight: "14px", cursor: "pointer", flexShrink: 0, padding: 0 }}>+</button>
                  )}
                </div>
                <div className="a-lane-track">
                  {overlays.length === 0 && isTop && (
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>{t('addOverlayHint')}</span>
                  )}
                  {laneOverlays.map((o) => (
                    <div
                      key={o.id}
                      className={"a-chip" + (selectedOverlayId === o.id ? " on" : "")}
                      style={{ left: o.offset * pps, width: Math.max(24, overlayTimelineDur(o) * pps), top: 2, bottom: 2, cursor: "move", background: o.kind === "video" ? "linear-gradient(150deg,#6d4bd8,#2a1a5e)" : "linear-gradient(150deg,#c8792f,#5e3a1a)" }}
                      title={o.name}
                      onPointerDown={(e) => onOvBarDown(e, o)}
                      onPointerMove={onOvBarMove}
                      onPointerUp={onOvBarUp}
                    >
                      <span style={{ position: "absolute", left: 8, top: 4, fontSize: 9.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "calc(100% - 16px)" }}>{o.kind === "video" ? "🎬" : "🖼"} {o.name}</span>
                      {selectedOverlayId === o.id && (
                        <>
                          <div className="a-trim a-trim-l" onPointerDown={(e) => startOvTrim(e, o, "start")} onPointerMove={onOvTrimMove} onPointerUp={endOvTrim} title={t('trimStartTitle')} />
                          <div className="a-trim a-trim-r" onPointerDown={(e) => startOvTrim(e, o, "end")} onPointerMove={onOvTrimMove} onPointerUp={endOvTrim} title={o.kind === "photo" ? t('duration') : t('trimEndTitle')} />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
            <div className="a-lane" style={{ height: 34 }}>
              <div className="a-lane-label"><VIcon name="music" size={13} /> {t('audioClipsLabel')}</div>
              <div className="a-lane-track">
                {/* son embarqué des plans vidéo — clic = sélectionne la piste audio seule ; Option/Alt+clic = aussi le plan vidéo lié */}
                {clipStarts.filter((c) => c.kind === "video").map((c) => (
                  <div
                    key={"va-" + c.id}
                    className={"a-wave-bar" + (audioOnlyId === c.id ? " on" : "")}
                    style={{ left: c.start * pps, width: c.dur * pps, top: 2, bottom: 2, background: (c.vol ?? 1) === 0 ? "var(--sunk)" : "linear-gradient(150deg,#1f7a4d,#0c2a1d)", opacity: (c.vol ?? 1) === 0 ? 0.5 : 1, cursor: "pointer", boxShadow: audioOnlyId === c.id ? "inset 0 0 0 2px var(--acid)" : undefined }}
                    title={t('soundOfClip', { name: c.name, percent: Math.round((c.vol ?? 1) * 100) })}
                    onClick={(e) => {
                      setAudioOnlyId(c.id);
                      if (e.altKey) { setSelectedClipId(c.id); }
                      else { setSelectedClipId(null); }
                      setSelectedTitleId(null); setSelectedStickerId(null);
                      setTool("audio");
                    }}
                  >
                    <span style={{ position: "absolute", left: 6, top: 4, fontSize: 9.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "calc(100% - 12px)" }}>{(c.vol ?? 1) === 0 ? "🔇" : "🔊"} {c.name}</span>
                  </div>
                ))}
              </div>
            </div>
            {Array.from({ length: audioTrackCount }).map((_, aIdx) => {
              const atrack = aIdx; // rangée audio (l'ordre n'affecte pas le mixage, uniquement l'organisation)
              const isFirstA = aIdx === 0;
              return (
              <div className="a-lane" style={{ height: 34 }} key={"atrack-" + atrack}>
                <div className="a-lane-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <VIcon name="music" size={13} />
                  <span className="trunc">{audioTrackCount > 1 ? `${t('railAudio')} ${atrack + 1}` : t('railAudio')}</span>
                  {isFirstA && (
                    <button onClick={() => setExtraAudioTracks((n) => n + 1)} title={t('addAudioTrack')}
                      style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: 5, border: "1px solid var(--line)", background: "var(--canvas)", color: "var(--ink-2)", fontSize: 14, lineHeight: "14px", cursor: "pointer", flexShrink: 0, padding: 0 }}>+</button>
                  )}
                </div>
                <div className="a-lane-track">
                  {audioTracks.filter((a) => (a.track ?? 0) === atrack).map((a) => (
                    <div key={a.id} className="a-wave-bar" style={{ left: a.offset * pps, width: a.dur * pps, top: 2, bottom: 2 }} title={a.name}>
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
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
            <div className="a-lane" style={{ height: 34 }}>
              <div className="a-lane-label"><VIcon name="captions" size={13} /> {t('labelSubtitlesShort')}</div>
              <div className="a-lane-track">
                {captions.map((c) => (
                  <div key={c.id} className="a-chip" style={{ left: c.start * pps, width: Math.max(20, (c.end - c.start) * pps) }} title={c.text} onClick={() => setTool("captions")}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="a-lane" style={{ height: 34 }}>
              <div className="a-lane-label"><VIcon name="text" size={13} /> {t('railText')}</div>
              <div className="a-lane-track">
                {titles.map((ti) => (
                  <div key={ti.id} className={"a-chip" + (selectedTitleId === ti.id ? " on" : "")} style={{ left: ti.start * pps, width: Math.max(20, (ti.end - ti.start) * pps) }} title={ti.text} onClick={() => { setSelectedTitleId(ti.id); setTool("text"); }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ti.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="a-playhead" style={{ left: 92 + time * pps }} />
          </div>
        </div>
      </div>

      {toastMsg && (
        <div className="mz-toast">
          <span className="mz-toast-ic"><VIcon name="check" size={12} /></span>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
