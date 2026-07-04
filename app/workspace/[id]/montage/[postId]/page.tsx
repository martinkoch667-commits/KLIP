"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { VIcon } from "./icons";
import {
  MontageClip, Caption, TitleEl, StickerEl, AudioTrack, MontageProject,
  FILTERS, TRANSITIONS, SUB_STYLES, FONT_CHOICES,
  fmt, newClipDefaults, clipFilterCss, clipTimelineDur, segmentCaptions,
} from "./constants";
import { MontageCtx, CutPanel, TextPanel, CaptionsPanel, AudioPanel, TransitionsPanel, FilterPanel, SpeedPanel, StickerPanel, AiPanel } from "./panels";
import { renderExport } from "./export";

// ─── Types / rail ───────────────────────────────────────────────────────────

type RailTool = "media" | "cut" | "text" | "captions" | "audio" | "transitions" | "filter" | "speed" | "sticker" | "ai";

const RAIL_TOOLS: [RailTool, string, string][] = [
  ["media", "video", "Média"],
  ["cut", "scissors", "Découper"],
  ["text", "text", "Texte"],
  ["captions", "captions", "Sous-titres"],
  ["audio", "music", "Audio"],
  ["transitions", "transition", "Transit."],
  ["filter", "filter", "Filtres"],
  ["speed", "speed", "Vitesse"],
  ["sticker", "sticker", "Stickers"],
];

const TOOL_TITLES: Record<RailTool, string> = {
  media: "Média", cut: "Découper", text: "Texte & titres", captions: "Sous-titres",
  audio: "Audio", transitions: "Transitions", filter: "Filtres", speed: "Vitesse",
  sticker: "Stickers", ai: "Assistant IA",
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
  const params = useParams();
  const workspaceId = params.id as string;
  const postId = params.postId as string;
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("Reel vidéo");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [clips, setClips] = useState<MontageClip[]>([]);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [subStyleId, setSubStyleId] = useState<string>(SUB_STYLES[0].id);
  const [titles, setTitles] = useState<TitleEl[]>([]);
  const [stickers, setStickers] = useState<StickerEl[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const [tool, setTool] = useState<RailTool>("media");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTitleId, setSelectedTitleId] = useState<string | null>(null);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [isRecordingVO, setIsRecordingVO] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pps, setPps] = useState(40);
  const [histTick, setHistTick] = useState(0);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadedSrcRef = useRef<string | null>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOverlayRef = useRef<{ type: "title" | "sticker"; id: string } | null>(null);
  const resizeOverlayRef = useRef<{ type: "title" | "sticker"; id: string; startDist: number; startScale: number; cx: number; cy: number } | null>(null);
  const voRecorderRef = useRef<MediaRecorder | null>(null);
  const voChunksRef = useRef<Blob[]>([]);
  const rulerRef = useRef<HTMLDivElement>(null);
  const scrubbingRulerRef = useRef(false);
  const trimRef = useRef<{ id: string; edge: "start" | "end"; startX: number; t0start: number; t0end: number; kind: "video" | "photo"; srcDur: number; speed: number } | null>(null);

  function toast(msg: string) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3200);
  }

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
        setCaptions(proj.captions || []);
        setSubStyleId(proj.subStyleId || SUB_STYLES[0].id);
        setTitles(proj.titles || []);
        setStickers(proj.stickers || []);
        setAudioTracks(proj.audioTracks || []);
        setShowProgressBar(!!proj.showProgressBar);
        setExportUrl(proj.exportUrl || null);
      } else if (post?.photo_url) {
        const dur = await getVideoDuration(post.photo_url);
        setClips([{ id: crypto.randomUUID(), kind: "video", name: "Import initial", src: post.photo_url, srcDur: dur, trimStart: 0, trimEnd: dur, ...newClipDefaults() }]);
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
      const project: MontageProject = { clips, captions, subStyleId, titles, stickers, audioTracks, showProgressBar, exportUrl };
      supabase.from("posts").update({ montage_json: project }).eq("id", postId).then(() => {});
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [clips, captions, subStyleId, titles, stickers, audioTracks, showProgressBar, exportUrl, loading, postId, supabase]);

  // ── Historique undo/redo ────────────────────────────────────────────────────
  type Snapshot = Pick<MontageProject, "clips" | "captions" | "subStyleId" | "titles" | "stickers" | "audioTracks" | "showProgressBar">;
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
    const snap: Snapshot = { clips, captions, subStyleId, titles, stickers, audioTracks, showProgressBar };
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
  }, [clips, captions, subStyleId, titles, stickers, audioTracks, showProgressBar, loading, commitPending]);

  const applySnapshot = useCallback((s: Snapshot) => {
    applyingHistoryRef.current = true;
    setClips(s.clips); setCaptions(s.captions); setSubStyleId(s.subStyleId);
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
    return clips.map((c) => { const start = acc; const dur = clipTimelineDur(c); acc += dur; return { ...c, start, end: acc, dur }; });
  }, [clips]);
  const total = clipStarts.length ? clipStarts[clipStarts.length - 1].end : 0;
  const activeClip = clipStarts.find((c) => time >= c.start && time < c.end) || clipStarts[clipStarts.length - 1];
  const selectedClip = clipStarts.find((c) => c.id === selectedClipId) || null;

  const seek = useCallback((t: number) => {
    const clamped = Math.max(0, Math.min(total, t));
    setTime(clamped);
    const c = clipStarts.find((c) => clamped >= c.start && clamped < c.end) || clipStarts[clipStarts.length - 1];
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

  // ── Horloge RAF pour les plans photo (pas de lecture native) ────────────────
  useEffect(() => {
    if (!playing || !activeClip || activeClip.kind !== "photo") return;
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setTime((t) => { const n = t + dt; if (n >= total) { setPlaying(false); return 0; } return n; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, activeClip?.id, activeClip?.kind, total]);

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
    if (idx >= 0 && idx < clipStarts.length - 1) setTime(clipStarts[idx + 1].start + 0.001);
    else { setTime(0); setPlaying(false); }
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
      toast("Déplacez le curseur à l'intérieur du plan pour diviser.");
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
    toast("Transition appliquée à tous les plans.");
  }

  // ── Titres ───────────────────────────────────────────────────────────────
  function addTitle() {
    const id = crypto.randomUUID();
    const start = time, end = Math.min(total || time + 3, time + 3);
    setTitles((prev) => [...prev, { id, start, end, text: "Nouveau titre", font: "archivo", color: "#FFFFFF", anim: "rise", x: 50, y: 78 }]);
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
    setCaptions((prev) => [...prev, { id, start, end, text: "Nouveau sous-titre" }].sort((a, b) => a.start - b.start));
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
        toast(data?.message || "Transcription indisponible (clé API manquante).");
        return;
      }
      const newCaps: Caption[] = segmentCaptions(data.segments || []);
      setCaptions(newCaps);
      toast(`${newCaps.length} sous-titres générés.`);
    } catch {
      toast("Erreur pendant la transcription.");
    } finally {
      setTranscribing(false);
    }
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
      if (error) { toast("Échec de l'upload audio : " + error.message); return; }
      const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
      const dur = await getAudioDuration(urlData.publicUrl);
      setAudioTracks((prev) => [...prev, { id: crypto.randomUUID(), kind, name: file.name, src: urlData.publicUrl, dur, vol: 1, offset: 0 }]);
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
      toast("Micro indisponible ou accès refusé.");
    }
  }

  // ── Overlays de scène (drag titres/stickers) ────────────────────────────────
  function onOverlayPointerDown(e: React.PointerEvent, type: "title" | "sticker", id: string) {
    e.stopPropagation();
    dragOverlayRef.current = { type, id };
    if (type === "title") setSelectedTitleId(id); else setSelectedStickerId(id);
  }
  function onOverlayResizeDown(e: React.PointerEvent, type: "title" | "sticker", id: string, currentScale: number) {
    e.stopPropagation();
    e.preventDefault();
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    // centre de l'overlay = position (x,y) en % de la scène (les overlays sont centrés dessus)
    const el = type === "title" ? titles.find((t) => t.id === id) : stickers.find((s) => s.id === id);
    if (!el) return;
    const cx = r.left + (el.x / 100) * r.width;
    const cy = r.top + (el.y / 100) * r.height;
    const startDist = Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy));
    resizeOverlayRef.current = { type, id, startDist, startScale: currentScale, cx, cy };
    if (type === "title") setSelectedTitleId(id); else setSelectedStickerId(id);
  }
  function onStagePointerMove(e: React.PointerEvent) {
    const rz = resizeOverlayRef.current;
    if (rz) {
      const dist = Math.hypot(e.clientX - rz.cx, e.clientY - rz.cy);
      const scale = Math.max(0.4, Math.min(4, rz.startScale * (dist / rz.startDist)));
      if (rz.type === "title") updateTitle(rz.id, { scale }); else updateSticker(rz.id, { scale });
      return;
    }
    const drag = dragOverlayRef.current;
    if (!drag) return;
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    if (drag.type === "title") updateTitle(drag.id, { x, y }); else updateSticker(drag.id, { x, y });
  }
  function onStagePointerUp() { dragOverlayRef.current = null; resizeOverlayRef.current = null; }

  // ── Export réel ──────────────────────────────────────────────────────────
  async function handleExport() {
    if (!clips.length || exporting) return;
    setExporting(true);
    setExportProgress(0);
    try {
      const blob = await renderExport({ clips, captions, subStyleId, titles, stickers, audioTracks, showProgressBar }, (p) => setExportProgress(p));
      const path = `${workspaceId}/${postId}-export-${Date.now()}.webm`;
      const { error } = await supabase.storage.from("videos").upload(path, blob, { upsert: true, contentType: "video/webm" });
      if (error) { toast("Échec de l'upload de l'export : " + error.message); return; }
      const { data: urlData } = supabase.storage.from("videos").getPublicUrl(path);
      setExportUrl(urlData.publicUrl);
      await supabase.from("posts").update({
        montage_json: { clips, captions, subStyleId, titles, stickers, audioTracks, showProgressBar, exportUrl: urlData.publicUrl },
        photo_url: urlData.publicUrl,
      }).eq("id", postId);
      toast("Export terminé ✓");
    } catch (e) {
      toast("Erreur pendant l'export : " + (e instanceof Error ? e.message : "inconnue"));
    } finally {
      setExporting(false);
    }
  }

  // ── Raccourcis clavier (type CapCut) ────────────────────────────────────────
  function deleteSelected() {
    if (selectedTitleId) { removeTitle(selectedTitleId); return; }
    if (selectedStickerId) { removeSticker(selectedStickerId); return; }
    if (selectedClipId) removeClip(selectedClipId);
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (meta && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (e.key === " ") { e.preventDefault(); togglePlay(); return; }
      if ((e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); deleteSelected(); return; }
      if (e.key.toLowerCase() === "s" && !meta) { e.preventDefault(); splitAtPlayhead(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); seek(time - (e.shiftKey ? 1 : 0.1)); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); seek(time + (e.shiftKey ? 1 : 0.1)); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, time, total, clipStarts, selectedClipId, selectedTitleId, selectedStickerId, playing, selectedClip]);

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

  const ctx: MontageCtx = {
    clips, selectedClip, captions, subStyleId, titles, stickers, audioTracks, showProgressBar,
    time, total, logoUrl, uploadingAudio, transcribing, isRecordingVO,
    toast, updateClip, splitAtPlayhead,
    duplicateSelected: () => selectedClipId && duplicateClip(selectedClipId),
    removeSelected: () => selectedClipId && removeClip(selectedClipId),
    applyTransitionToAll,
    addTitle, updateTitle, removeTitle,
    addCaption, updateCaption, removeCaption, setSubStyleId, generateCaptionsAI,
    addSticker, updateSticker, removeSticker,
    toggleProgressBar, importAudio, removeAudioTrack, setAudioVol, toggleRecordVO,
  };

  const trackW = Math.max(total * pps, 200);
  const ticks: number[] = [];
  for (let s = 0; s <= total; s += 2) ticks.push(s);

  const activeTitles = titles.filter((t) => time >= t.start && time <= t.end);
  const activeStickers = stickers.filter((s) => time >= s.start && time <= s.end);
  const activeCaption = captions.find((c) => time >= c.start && time <= c.end);
  const capStyle = SUB_STYLES.find((s) => s.id === subStyleId) || SUB_STYLES[0];

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--canvas)" }}>
        <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>Chargement du montage…</span>
      </div>
    );
  }

  return (
    <div className="a-root" style={{ height: "100vh" }}>
      {/* topbar */}
      <div className="ed-topbar" style={{ height: 58, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", borderBottom: "1px solid var(--line)", background: "color-mix(in srgb, var(--canvas) 72%, transparent)", backdropFilter: "blur(10px)", position: "relative", zIndex: 30 }}>
        <a href={`/workspace/${workspaceId}`} className="btn btn-sm btn-ghost" style={{ gap: 5, textDecoration: "none", flexShrink: 0 }}>
          <VIcon name="chevL" size={15} /> Composer
        </a>
        <span style={{ width: 1, height: 24, background: "var(--line)", flexShrink: 0 }} />
        <div style={{ display: "flex", gap: 2 }}>
          <button className="mz-hbtn" title="Annuler (⌘Z)" disabled={!canUndo} onClick={undo}><VIcon name="undo" size={17} /></button>
          <button className="mz-hbtn" title="Rétablir (⌘⇧Z)" disabled={!canRedo} onClick={redo}><VIcon name="redo" size={17} /></button>
        </div>
        <span style={{ width: 1, height: 24, background: "var(--line)", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em" }} className="trunc">{projectName}</span>
          <span className="chip" style={{ background: "var(--sunk)", color: "var(--ink-2)", flexShrink: 0 }}>9:16</span>
        </div>
        <div style={{ flex: 1 }} />
        {exportUrl && (
          <a href={exportUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" style={{ gap: 5, textDecoration: "none" }}>
            <VIcon name="eye" size={15} /> Voir l'export
          </a>
        )}
        {exportUrl && (
          <a href={`/workspace/${workspaceId}/planning?post=${postId}`} className="btn btn-sm btn-dark" style={{ gap: 5, textDecoration: "none" }}>
            <VIcon name="calendar" size={15} /> Planifier
          </a>
        )}
        <button className="btn btn-sm btn-primary" disabled={!clips.length || exporting} onClick={handleExport}>
          <VIcon name="export" size={15} /> {exporting ? "Export…" : "Exporter"}
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
            <VIcon name="sparkles" size={20} /><span className="a-railcap">IA</span>
          </button>
        </div>

        {/* panneau de propriétés */}
        <div className="a-panel" key={tool}>
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
                    <span className="mz-import-t">{uploading ? "Import en cours…" : "Importer vidéos & photos"}</span>
                    <span className="mz-import-s">Glissez vos rushes · MP4, MOV, JPG</span>
                  </div>
                  <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,image/jpeg,image/png" multiple onChange={handleFileInput} style={{ display: "none" }} />
                </div>
                <div className="a-section">
                  <span className="mz-sec-label">Plans du projet · {clips.length}</span>
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
                  <span className="mz-sec-label">Incrustation photo</span>
                  <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.45, marginTop: 8 }}>Les photos s'insèrent comme des plans fixes de {PHOTO_DEFAULT_DUR}s — durée réglable dans « Découper », filtres et transitions identiques aux vidéos.</p>
                </div>
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

        {/* preview + playbar */}
        <div className="a-canvas">
          <div className="mz-stage">
            <div
              className="mz-phone"
              ref={stageRef}
              onPointerMove={onStagePointerMove}
              onPointerUp={onStagePointerUp}
              onPointerLeave={onStagePointerUp}
            >
              <div className="mz-video">
                {activeClip ? (
                  activeClip.kind === "video"
                    ? <video ref={videoRef} onTimeUpdate={onVideoTimeUpdate} onEnded={onVideoEnded} playsInline muted={false} style={{ filter: clipFilterCss(activeClip) }} />
                    : <img src={activeClip.src} alt="" style={{ filter: clipFilterCss(activeClip) }} />
                ) : (
                  <div className="mz-vempty">
                    <VIcon name="upload" size={26} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Importez vos rushes pour commencer</span>
                  </div>
                )}

                {/* titres */}
                {activeTitles.map((t) => (
                  <div
                    key={t.id}
                    className={"mz-ov-item" + (selectedTitleId === t.id ? " sel" : "")}
                    style={{
                      left: t.x + "%", top: t.y + "%",
                      fontFamily: FONT_CSS[t.font] || FONT_CSS.archivo,
                      fontWeight: FONT_CHOICES.find((f) => f.id === t.font)?.weight || 800,
                      fontStyle: FONT_CHOICES.find((f) => f.id === t.font)?.italic ? "italic" : "normal",
                      color: t.color, fontSize: 22 * (t.scale ?? 1), textAlign: "center", textShadow: "0 1px 8px rgba(0,0,0,.5)",
                      maxWidth: "80%", whiteSpace: "pre-wrap",
                      animation: t.anim === "rise" ? "mzRise .35s var(--ease)" : t.anim === "pop" ? "mzPop .3s var(--ease)" : undefined,
                    }}
                    onPointerDown={(e) => onOverlayPointerDown(e, "title", t.id)}
                  >
                    {t.anim === "type" ? t.text.slice(0, Math.max(0, Math.min(t.text.length, Math.floor((time - t.start) * 16)))) : t.text}
                    {selectedTitleId === t.id && <button className="mz-ov-del" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeTitle(t.id)}><VIcon name="x" size={11} /></button>}
                    {selectedTitleId === t.id && <span className="mz-ov-resize" onPointerDown={(e) => onOverlayResizeDown(e, "title", t.id, t.scale ?? 1)} title="Redimensionner" />}
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
                    {selectedStickerId === s.id && <span className="mz-ov-resize" onPointerDown={(e) => onOverlayResizeDown(e, "sticker", s.id, s.scale)} title="Redimensionner" />}
                  </div>
                ))}

                {/* sous-titres incrustés */}
                {activeCaption && (
                  <div className="mz-cap-wrap">
                    <div className="mz-cap-box" style={{
                      background: capStyle.bg, color: capStyle.fg,
                      fontWeight: capStyle.weight, fontStyle: capStyle.italic ? "italic" : "normal",
                      fontFamily: capStyle.italic ? "var(--display)" : "var(--sans)",
                      padding: capStyle.pill ? "6px 16px" : "8px 12px",
                      borderRadius: capStyle.pill ? 99 : 8,
                      textShadow: capStyle.bg === "transparent" ? "0 1px 8px rgba(0,0,0,.6)" : "none",
                      fontSize: 15,
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
                <div className="mz-ai-overlay-title">Export en cours…</div>
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

      {/* timeline dock */}
      <div className="a-timeline">
        <div className="a-tl-bar">
          <button className="a-tl-tool" disabled={!selectedClipId} onClick={splitAtPlayhead}><VIcon name="split" size={15} /> Diviser</button>
          <button className="a-tl-tool" disabled={!selectedClipId} onClick={() => selectedClipId && duplicateClip(selectedClipId)}><VIcon name="copy" size={15} /> Dupliquer</button>
          <button className="a-tl-tool" disabled={!selectedClipId} onClick={() => selectedClipId && removeClip(selectedClipId)}><VIcon name="trash" size={15} /> Supprimer</button>
          <div style={{ flex: 1 }} />
          <span className="mz-sec-label">{clips.length} clip{clips.length > 1 ? "s" : ""} · {fmt(total)}</span>
          <button className="mz-hbtn" onClick={() => setPps((p) => Math.max(10, Math.round(p / 1.3)))}><VIcon name="zoomOut" size={15} /></button>
          <button className="mz-hbtn" onClick={() => setPps((p) => Math.min(160, Math.round(p * 1.3)))}><VIcon name="zoomIn" size={15} /></button>
        </div>
        <div className="a-tl-scroll">
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
              <div className="a-lane-label"><VIcon name="video" size={13} /> Vidéo</div>
              <div className="a-lane-track">
                {clips.length === 0 && (
                  <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Importez un premier rush pour démarrer l'assemblage.</span>
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
                          {c.kind === "video" && (
                            <div className="a-trim a-trim-l" draggable={false} onDragStart={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => startTrim(e, c, "start")} onPointerMove={onTrimMove} onPointerUp={endTrim} title="Rogner le début" />
                          )}
                          <div className="a-trim a-trim-r" draggable={false} onDragStart={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => startTrim(e, c, "end")} onPointerMove={onTrimMove} onPointerUp={endTrim} title={c.kind === "photo" ? "Durée du plan" : "Rogner la fin"} />
                        </>
                      )}
                    </div>
                    {i < clipStarts.length - 1 && (
                      <button
                        className={"a-trans-pill" + (selectedClipId === clipStarts[i + 1].id ? " active" : "")}
                        style={{ position: "absolute", left: c.dur * pps }}
                        title={TRANSITIONS.find((t) => t.id === clipStarts[i + 1].transitionIn)?.name || "Cut"}
                        onClick={() => { selectClip(clipStarts[i + 1].id); setTool("transitions"); }}
                      >
                        {TRANSITIONS.find((t) => t.id === clipStarts[i + 1].transitionIn)?.glyph || "▮▮"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="a-lane" style={{ height: 34 }}>
              <div className="a-lane-label"><VIcon name="music" size={13} /> Audio</div>
              <div className="a-lane-track">
                {/* son embarqué des plans vidéo (cliquable → panneau Audio pour régler le volume) */}
                {clipStarts.filter((c) => c.kind === "video").map((c) => (
                  <div
                    key={"va-" + c.id}
                    className={"a-wave-bar" + (selectedClipId === c.id ? " on" : "")}
                    style={{ left: c.start * pps, width: c.dur * pps, top: 2, bottom: 2, background: (c.vol ?? 1) === 0 ? "var(--sunk)" : "linear-gradient(150deg,#1f7a4d,#0c2a1d)", opacity: (c.vol ?? 1) === 0 ? 0.5 : 1, cursor: "pointer" }}
                    title={`Son de « ${c.name} » — ${Math.round((c.vol ?? 1) * 100)}%`}
                    onClick={() => { setSelectedClipId(c.id); setTool("audio"); }}
                  >
                    <span style={{ position: "absolute", left: 6, top: 4, fontSize: 9.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "calc(100% - 12px)" }}>{(c.vol ?? 1) === 0 ? "🔇" : "🔊"} {c.name}</span>
                  </div>
                ))}
                {audioTracks.map((a) => (
                  <div key={a.id} className="a-wave-bar" style={{ left: a.offset * pps, width: a.dur * pps, top: 2, bottom: 2 }} title={a.name}>
                    <span style={{ position: "absolute", left: 6, top: 4, fontSize: 9.5, fontWeight: 700, color: "#fff" }}>{a.kind === "voiceover" ? "🎙" : "🎵"} {a.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="a-lane" style={{ height: 34 }}>
              <div className="a-lane-label"><VIcon name="captions" size={13} /> S-titres</div>
              <div className="a-lane-track">
                {captions.map((c) => (
                  <div key={c.id} className="a-chip" style={{ left: c.start * pps, width: Math.max(20, (c.end - c.start) * pps) }} title={c.text} onClick={() => setTool("captions")}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="a-lane" style={{ height: 34 }}>
              <div className="a-lane-label"><VIcon name="text" size={13} /> Texte</div>
              <div className="a-lane-track">
                {titles.map((t) => (
                  <div key={t.id} className={"a-chip" + (selectedTitleId === t.id ? " on" : "")} style={{ left: t.start * pps, width: Math.max(20, (t.end - t.start) * pps) }} title={t.text} onClick={() => { setSelectedTitleId(t.id); setTool("text"); }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.text}</span>
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
