"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// ─── Types ──────────────────────────────────────────────────────────────────

type ClipKind = "video" | "photo";

interface MontageClip {
  id: string;
  kind: ClipKind;
  name: string;
  src: string;
  dur: number; // seconds
}

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

// ─── Icônes (sous-ensemble VIcon du design KLIP Montage) ───────────────────

function VIcon({ name, size = 18 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "video": return <svg {...p}><rect x="2.5" y="5.5" width="13" height="13" rx="3" /><path d="M15.5 9.5l6-3v11l-6-3" /></svg>;
    case "image": return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 16l-5-5L5 20" /></svg>;
    case "text": return <svg {...p}><path d="M5 6.5V5h14v1.5M12 5v14M9 19h6" /></svg>;
    case "captions": return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M9 10.5a2.2 2.2 0 0 0-3 2 2.2 2.2 0 0 0 3 2M16 10.5a2.2 2.2 0 0 0-3 2 2.2 2.2 0 0 0 3 2" /></svg>;
    case "music": return <svg {...p}><path d="M9 18V6l11-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>;
    case "transition": return <svg {...p}><rect x="2.5" y="6" width="8" height="12" rx="2" /><rect x="13.5" y="6" width="8" height="12" rx="2" /><path d="M11 12h2M11 9.5l2 2.5-2 2.5" /></svg>;
    case "filter": return <svg {...p}><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" /></svg>;
    case "speed": return <svg {...p}><path d="M5 19a9 9 0 1 1 14 0" /><path d="M12 13l4-3" /><circle cx="12" cy="13" r="1.2" fill="currentColor" stroke="none" /></svg>;
    case "sticker": return <svg {...p}><path d="M20 13a7 7 0 1 1-9-9v0a2 2 0 0 0 0 4 2 2 0 0 1 2 2 2 2 0 0 0 4 0 2 2 0 0 1 3-1Z" /></svg>;
    case "scissors": return <svg {...p}><circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="18" r="2.6" /><path d="M8.2 7.6L20 18M8.2 16.4L20 6" /></svg>;
    case "play": return <svg {...p}><path d="M7 5l12 7-12 7V5Z" fill="currentColor" stroke="none" /></svg>;
    case "pause": return <svg {...p}><rect x="6" y="5" width="4" height="14" rx="1.3" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1.3" fill="currentColor" stroke="none" /></svg>;
    case "chevL": return <svg {...p}><path d="M15 6l-6 6 6 6" /></svg>;
    case "undo": return <svg {...p}><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1" /></svg>;
    case "redo": return <svg {...p}><path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1" /></svg>;
    case "eye": return <svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "upload": return <svg {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" /></svg>;
    case "export": return <svg {...p}><path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" /></svg>;
    case "trash": return <svg {...p}><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13" /></svg>;
    case "copy": return <svg {...p}><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>;
    case "sparkles": return <svg {...p}><path d="M12 3l1.5 5L19 9.5 13.5 11 12 16l-1.5-5L5 9.5 10.5 8 12 3Z" /><path d="M18 15l.7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" /></svg>;
    default: return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.round((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, "0")}.${cs}`;
}

function getVideoDuration(src: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = src;
    v.onloadedmetadata = () => resolve(v.duration && isFinite(v.duration) ? v.duration : 4);
    v.onerror = () => resolve(4);
  });
}

const PHOTO_DEFAULT_DUR = 3;

// ─── Panneau "à venir" (outils des lots suivants) ──────────────────────────

function ComingSoonPanel({ tool }: { tool: RailTool }) {
  const icon = RAIL_TOOLS.find((t) => t[0] === tool)?.[1] || "sparkles";
  return (
    <div className="a-section" style={{ textAlign: "center", padding: "24px 8px" }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--sunk)", display: "grid", placeItems: "center", margin: "0 auto 14px", color: "var(--ink-3)" }}>
        <VIcon name={icon} size={20} />
      </div>
      <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 14.5, marginBottom: 6 }}>{TOOL_TITLES[tool]}</div>
      <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>Disponible dans un prochain lot du module Montage vidéo.</p>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function MontagePage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const postId = params.postId as string;
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("Reel vidéo");
  const [clips, setClips] = useState<MontageClip[]>([]);
  const [tool, setTool] = useState<RailTool>("media");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadedSrcRef = useRef<string | null>(null);
  const scrubRef = useRef<HTMLDivElement>(null);

  // ── Load project ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("posts").select("montage_json, brief, photo_url").eq("id", postId).single();
      if (data?.brief) setProjectName(data.brief);
      const proj = data?.montage_json as { clips?: MontageClip[] } | null;
      if (proj?.clips?.length) {
        setClips(proj.clips);
      } else if (data?.photo_url) {
        const dur = await getVideoDuration(data.photo_url);
        setClips([{ id: crypto.randomUUID(), kind: "video", name: "Import initial", src: data.photo_url, dur }]);
      }
      setLoading(false);
    })();
  }, [postId, supabase]);

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
      supabase.from("posts").update({ montage_json: { clips } }).eq("id", postId).then(() => {});
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [clips, loading, postId, supabase]);

  // ── Temps cumulés des clips ─────────────────────────────────────────────────
  const clipStarts = useMemo(() => {
    let acc = 0;
    return clips.map((c) => { const start = acc; acc += c.dur; return { ...c, start, end: acc }; });
  }, [clips]);
  const total = clipStarts.length ? clipStarts[clipStarts.length - 1].end : 0;
  const activeClip = clipStarts.find((c) => time >= c.start && time < c.end) || clipStarts[clipStarts.length - 1];

  const seek = useCallback((t: number) => {
    const clamped = Math.max(0, Math.min(total, t));
    setTime(clamped);
    const c = clipStarts.find((c) => clamped >= c.start && clamped < c.end) || clipStarts[clipStarts.length - 1];
    if (c && c.kind === "video" && videoRef.current && loadedSrcRef.current === c.src) {
      videoRef.current.currentTime = clamped - c.start;
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
    const localTime = time - activeClip.start;
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
    setTime(activeClip.start + e.currentTarget.currentTime);
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
      setClips((prev) => [...prev, { id: crypto.randomUUID(), kind: isVideo ? "video" : "photo", name: file.name, src: urlData.publicUrl, dur }]);
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

  const pps = 40; // px/seconde (zoom fixe pour ce lot)
  const trackW = Math.max(total * pps, 200);
  const ticks: number[] = [];
  for (let s = 0; s <= total; s += 2) ticks.push(s);

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
          <button className="mz-hbtn" title="Annuler (bientôt)" disabled><VIcon name="undo" size={17} /></button>
          <button className="mz-hbtn" title="Rétablir (bientôt)" disabled><VIcon name="redo" size={17} /></button>
        </div>
        <span style={{ width: 1, height: 24, background: "var(--line)", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em" }} className="trunc">{projectName}</span>
          <span className="chip" style={{ background: "var(--sunk)", color: "var(--ink-2)", flexShrink: 0 }}>9:16</span>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm btn-ghost" title="Bientôt disponible" disabled style={{ opacity: 0.5 }}><VIcon name="eye" size={15} /> Aperçu</button>
        <button className="btn btn-sm btn-primary" title="Bientôt disponible" disabled style={{ opacity: 0.5 }}><VIcon name="export" size={15} /> Exporter</button>
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
            {tool === "media" ? (
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
                        {c.kind === "photo" ? <img src={c.src} alt="" /> : <video src={c.src} muted preload="metadata" />}
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
                  <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.45, marginTop: 8 }}>Les photos s'insèrent comme des plans fixes de {PHOTO_DEFAULT_DUR}s — durée réglable, transitions et filtres identiques aux vidéos (prochain lot).</p>
                </div>
              </>
            ) : (
              <ComingSoonPanel tool={tool} />
            )}
          </div>
        </div>

        {/* preview + playbar */}
        <div className="a-canvas">
          <div className="mz-stage">
            <div className="mz-phone">
              <div className="mz-video">
                {activeClip ? (
                  activeClip.kind === "video"
                    ? <video ref={videoRef} onTimeUpdate={onVideoTimeUpdate} onEnded={onVideoEnded} playsInline muted={false} />
                    : <img src={activeClip.src} alt="" />
                ) : (
                  <div className="mz-vempty">
                    <VIcon name="upload" size={26} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Importez vos rushes pour commencer</span>
                  </div>
                )}
              </div>
            </div>
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
          <button className="a-tl-tool" disabled title="Bientôt disponible"><VIcon name="scissors" size={15} /> Découper</button>
          <button className="a-tl-tool" disabled={!selectedClipId} onClick={() => selectedClipId && duplicateClip(selectedClipId)}><VIcon name="copy" size={15} /> Dupliquer</button>
          <button className="a-tl-tool" disabled={!selectedClipId} onClick={() => selectedClipId && removeClip(selectedClipId)}><VIcon name="trash" size={15} /> Supprimer</button>
          <div style={{ flex: 1 }} />
          <span className="mz-sec-label">{clips.length} clip{clips.length > 1 ? "s" : ""} · {fmt(total)}</span>
        </div>
        <div className="a-tl-scroll">
          <div className="a-tl-inner" style={{ width: 92 + trackW + 30 }}>
            <div className="a-ruler" style={{ marginLeft: 92, width: trackW }}>
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
                {clipStarts.map((c) => (
                  <div
                    key={c.id}
                    className={"a-clip" + (selectedClipId === c.id ? " on" : "") + (draggingId === c.id ? " dragging" : "")}
                    style={{ width: c.dur * pps, background: c.kind === "video" ? "linear-gradient(150deg,#2b8d57,#0c2a1d)" : undefined }}
                    draggable
                    onDragStart={() => setDraggingId(c.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onClipDrop(c.id)}
                    onClick={() => selectClip(c.id)}
                  >
                    {c.kind === "photo" && <img src={c.src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                    <span className="a-clip-badge"><VIcon name={c.kind === "photo" ? "image" : "video"} size={10} /></span>
                    <span className="a-clip-dur">{c.dur.toFixed(1)}s</span>
                    <span className="a-clip-lbl">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="a-lane" style={{ height: 34 }}>
              <div className="a-lane-label"><VIcon name="music" size={13} /> Audio</div>
              <div className="a-lane-track" />
            </div>
            <div className="a-lane" style={{ height: 34 }}>
              <div className="a-lane-label"><VIcon name="captions" size={13} /> S-titres</div>
              <div className="a-lane-track" />
            </div>
            <div className="a-lane" style={{ height: 34 }}>
              <div className="a-lane-label"><VIcon name="text" size={13} /> Texte</div>
              <div className="a-lane-track" />
            </div>
            <div className="a-playhead" style={{ left: 92 + time * pps }} />
          </div>
        </div>
      </div>
    </div>
  );
}
