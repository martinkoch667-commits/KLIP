"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";

// ─── Sélecteur de musique (recherche catalogue réel + extrait audio) ──────────
type Song = { id: string; title: string; artist: string; artwork: string; preview: string };

function MusicPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations('planning');
  const [q, setQ] = useState(value);
  const [results, setResults] = useState<Song[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resynchronise quand on change de post sélectionné
  useEffect(() => { setQ(value); }, [value]);

  // Ferme le menu au clic extérieur + coupe l'extrait au démontage
  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => { document.removeEventListener("mousedown", h); audioRef.current?.pause(); };
  }, []);

  const runSearch = (term: string) => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      if (!term.trim()) { setResults([]); return; }
      setLoading(true);
      try {
        const r = await fetch(`/api/song-search?q=${encodeURIComponent(term)}`);
        const d = await r.json();
        setResults(Array.isArray(d.songs) ? d.songs : []);
        setOpen(true);
      } catch { setResults([]); }
      setLoading(false);
    }, 350);
  };

  const onType = (v: string) => { setQ(v); onChange(v); runSearch(v); };

  const pick = (s: Song) => {
    const label = `${s.title} — ${s.artist}`;
    setQ(label); onChange(label); setOpen(false);
    audioRef.current?.pause(); setPlayingId(null);
  };

  const togglePreview = (s: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!s.preview) return;
    if (playingId === s.id) { audioRef.current?.pause(); setPlayingId(null); return; }
    audioRef.current?.pause();
    const a = new Audio(s.preview); a.volume = 0.85; audioRef.current = a;
    a.play().catch(() => {}); setPlayingId(s.id);
    a.onended = () => setPlayingId(null);
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          type="text" value={q} placeholder={t('musicSearchPh')}
          className="input" style={{ fontSize: 12.5, paddingLeft: 30 }}
          onChange={e => onType(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
        />
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", pointerEvents: "none" }}>
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
        {loading && (
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, border: "2px solid var(--line)", borderTopColor: "var(--ink-3)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 40, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r)", boxShadow: "var(--shadow-pop, 0 12px 32px -12px rgba(0,0,0,.25))", maxHeight: 288, overflowY: "auto", padding: 4 }}>
          {results.map(s => (
            <div key={s.id} onClick={() => pick(s)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--sunk)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <div style={{ position: "relative", width: 38, height: 38, flexShrink: 0, borderRadius: 6, overflow: "hidden", background: "var(--sunk)" }}>
                {s.artwork && <img src={s.artwork} alt="" width={38} height={38} style={{ objectFit: "cover", display: "block" }} />}
                {s.preview && (
                  <button onClick={e => togglePreview(s, e)} title={playingId === s.id ? t('musicPause') : t('musicPlay')}
                    style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", border: "none", cursor: "pointer", background: "rgba(0,0,0,.38)", color: "#fff" }}>
                    {playingId === s.id
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z"/></svg>}
                  </button>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.artist}</div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: "var(--ink-3)", padding: "6px 8px 3px", lineHeight: 1.4 }}>
            {t('musicApiHint')}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PostType = "post" | "reel" | "story";

const POST_TYPE_CFG: Record<PostType, { label: string; tKey: string; color: string; bg: string }> = {
  post:  { label: "Post",  tKey: "ptPost",  color: "#4F8EF7", bg: "#4F8EF715" },
  reel:  { label: "Reel",  tKey: "ptReel",  color: "#A259FF", bg: "#A259FF15" },
  story: { label: "Story", tKey: "ptStory", color: "#FF6B35", bg: "#FF6B3515" },
};

interface Post {
  id: string;
  photo_url: string;
  exported_image_url: string | null;
  texte_visuel: string;
  description: string;
  status: string;
  scheduled_at: string | null;
  brief: string;
  post_type?: PostType | null;
  target_platforms?: string[] | null;
  tagged_users?: string[] | null;
  music_note?: string | null;
  thumbnail_url?: string | null;
  approved_by_client?: boolean | null;
  client_comment?: string | null;
  client_reviewed_at?: string | null;
}

interface Workspace {
  id: string;
  name: string;
  primary_color: string | null;
  secondary_color: string | null;
  font_family: string | null;
  instagram_account_id: string | null;
  instagram_username: string | null;
  facebook_page_id: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_H       = 48; // px per hour — 48px gives readable slots with proportional post blocks
const HOURS        = Array.from({ length: 24 }, (_, i) => i);

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
// ← Bug fix: use local date parts (not toISOString which is UTC)
function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function formatTime(iso: string | null, locale = "fr-FR"): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
function formatMonthYear(date: Date, locale = "fr-FR"): string {
  return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
}
// Noms de mois / jours localisés dérivés de la locale active (via Intl) — évite
// de maintenir des tableaux traduits à la main pour les dates.
function localizedMonthNames(locale: string): string[] {
  const f = new Intl.DateTimeFormat(locale, { month: "long" });
  return Array.from({ length: 12 }, (_, m) => { const s = f.format(new Date(2021, m, 1)); return s.charAt(0).toUpperCase() + s.slice(1); });
}
function localizedDayNamesShort(locale: string): string[] {
  const f = new Intl.DateTimeFormat(locale, { weekday: "short" });
  // 1er janvier 2024 = lundi → i=0..6 donne lun..dim.
  return Array.from({ length: 7 }, (_, i) => { const s = f.format(new Date(2024, 0, 1 + i)); return s.charAt(0).toUpperCase() + s.slice(1); });
}
function buildScheduledAt(dateStr: string, timeStr: string): string | null {
  const d = new Date(`${dateStr}T${timeStr || "09:00"}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
// Ratio d'affichage selon le format du post (story/reel = vertical 9:16).
function aspectForType(t?: string | null): string {
  return t === "story" || t === "reel" ? "9 / 16" : "4 / 5";
}
// Détecte une source vidéo (export du monteur .webm, imports .mp4/.mov).
function isVideoUrl(url?: string | null): boolean {
  return !!url && /\.(webm|mp4|mov|m4v|quicktime)(\?|$)/i.test(url);
}
// Un post vidéo ne peut être que Reel ou Story ; une photo ne peut pas être un Reel.
function allowedTypesFor(isVideo: boolean): PostType[] {
  return isVideo ? ["reel", "story"] : ["post", "story"];
}
// Miniature média : rend une <video> (première image comme poster) pour les sources vidéo,
// sinon une <img> via le proxy. Évite l'image cassée "?" pour les exports .webm/.mp4.
function MediaThumb({ raw, style }: { raw?: string | null; style?: React.CSSProperties }) {
  if (!raw) return null;
  const base: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block", ...style };
  if (isVideoUrl(raw)) {
    return <video src={`${raw}#t=0.1`} muted playsInline preload="metadata" style={base} />;
  }
  return <img src={`/api/proxy-image?url=${encodeURIComponent(raw)}`} alt="" style={base} />;
}
// Month view grid: Mon-based, pads with nulls
function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const dow   = first.getDay(); // 0=Sun
  const off   = dow === 0 ? 6 : dow - 1;
  const days  = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((off + days) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const n = i - off + 1;
    return n < 1 || n > days ? null : new Date(year, month, n);
  });
}

// ─── Status chip ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; tKey: string; bg: string; color: string; dot: string }> = {
  scheduled: { label: "Programmé", tKey: "stScheduled", bg: "var(--mint-soft)",  color: "var(--mint-2)",  dot: "var(--mint-2)"   },
  published:  { label: "Publié",    tKey: "stPublished", bg: "var(--mint)",       color: "var(--mint-ink)", dot: "var(--mint-ink)" },
  generated:  { label: "Brouillon", tKey: "stGenerated", bg: "var(--sunk)",       color: "var(--ink-3)",   dot: "var(--ink-3)"    },
  validated:  { label: "Brouillon", tKey: "stGenerated", bg: "var(--sunk)",       color: "var(--ink-3)",   dot: "var(--ink-3)"    },
};
function StatusChip({ status }: { status: string }) {
  const t = useTranslations('planning');
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.generated;
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
      <span className="dot" style={{ background: cfg.dot }} />{t(cfg.tKey)}
    </span>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconChevL() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>; }
function IconChevR() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>; }
function IconClose() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IconCalendar() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>; }
function IconEdit() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M13.5 7.5l3 3"/></svg>; }
function IconInstagram() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>; }
function IconPlus() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>; }
function IconSpark() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/></svg>; }

// ─── Engagement heatmap helpers ────────────────────────────────────────────────

function engageScore(dayOfWeek: number, hour: number): number {
  // Simulated engagement curve — peaks at typical Instagram best-times
  // TODO: replace with real Instagram Insights API data per workspace
  const base: Record<number, number[]> = {
    1: [4,3,3,2,2,3,5,18,32,44,52,48,42,38,35,30,28,40,62,78,88,82,70,40], // Mon
    2: [4,3,3,2,2,3,6,20,35,48,55,50,45,40,38,34,30,44,65,80,90,84,72,42], // Tue
    3: [5,3,3,2,2,4,7,22,38,50,58,52,48,42,40,36,32,46,68,82,92,86,74,44], // Wed
    4: [5,3,3,2,2,4,6,20,36,48,55,50,46,40,38,34,30,44,66,80,90,84,72,42], // Thu
    5: [5,4,3,2,2,3,6,18,30,40,48,45,40,38,36,32,30,42,60,75,85,82,70,45], // Fri
    6: [6,4,3,3,2,3,5,14,22,30,38,42,46,50,52,54,55,58,65,72,78,75,62,48], // Sat
    0: [7,5,4,3,2,3,5,12,18,26,32,38,42,46,50,54,58,60,65,70,75,72,62,50], // Sun
  };
  const curve = base[dayOfWeek] ?? base[1];
  return curve[hour] ?? 5;
}

function peakHours(dayOfWeek: number, n = 3): number[] {
  const scores = Array.from({ length: 24 }, (_, h) => ({ h, s: engageScore(dayOfWeek, h) }));
  return scores.sort((a, b) => b.s - a.s).slice(0, n).map(x => x.h);
}

function heatBg(s: number): string {
  if (s >= 88) return "var(--acid)";
  if (s >= 72) return "var(--mint)";
  if (s >= 50) return "rgba(47,215,155,.55)";
  if (s >= 30) return "rgba(47,215,155,.30)";
  return "rgba(13,15,10,.09)";
}
function heatInk(s: number): string { return s >= 72 ? "var(--mint-ink)" : "var(--ink-2)"; }

function BestTimeStrip({ dayOfWeek, label }: { dayOfWeek: number; label: string }) {
  const t = useTranslations('planning');
  const curve = Array.from({ length: 24 }, (_, h) => ({ h, s: engageScore(dayOfWeek, h) }));
  const peaks = peakHours(dayOfWeek, 3);
  return (
    <div className="card" style={{ margin: "0 26px 14px", padding: "13px 18px 11px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--mint-soft)", color: "var(--mint-2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </span>
        <span className="h-title" style={{ fontSize: 14 }}>{t('bestTime')}</span>
        <span className="chip" style={{ background: "var(--sunk)", color: "var(--ink-2)", fontSize: 10.5 }}>{label}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>
          <span>{t('engagement')}</span>
          <span style={{ width: 72, height: 7, borderRadius: 99, background: "linear-gradient(90deg, rgba(13,15,10,.09), rgba(47,215,155,.5), var(--mint), var(--acid))", display: "block" }} />
          <span className="tnum">100%</span>
        </div>
      </div>
      {/* bars */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 46 }}>
        {curve.map(({ h, s }) => {
          const isPeak = peaks.includes(h);
          return (
            <div key={h} title={`${h}h — ${s}% d'engagement`} className="heat-bar"
              style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 2, cursor: "default" }}>
              {isPeak && <span className="tnum" style={{ fontSize: 9, fontWeight: 800, color: "var(--mint-2)", lineHeight: 1 }}>{s}%</span>}
              <div style={{ width: "100%", height: `${8 + (s / 100) * 28}px`, background: heatBg(s), borderRadius: "3px 3px 2px 2px", boxShadow: isPeak ? "0 0 0 1.5px var(--mint-2)" : "none", transition: "height .2s" }} />
            </div>
          );
        })}
      </div>
      {/* hour ticks */}
      <div style={{ display: "flex", marginTop: 4 }}>
        {curve.map(({ h }) => (
          <span key={h} className="tnum" style={{ flex: 1, textAlign: "center", fontSize: 9, fontWeight: 700, color: "var(--ink-3)", visibility: (h % 3 === 0) ? "visible" : "hidden" }}>{h}h</span>
        ))}
      </div>
    </div>
  );
}

// ─── Calendar right rail ──────────────────────────────────────────────────────


function CalendarRail({ posts, weekDays, chipColor, workspaceId }: {
  posts: Post[];
  weekDays: Date[];
  chipColor: string;
  workspaceId: string;
}) {
  const t = useTranslations('planning');
  const locale = useLocale();
  const dowShort = localizedDayNamesShort(locale);
  const weekPosts  = posts.filter(p => p.scheduled_at && weekDays.some(d => isSameDay(new Date(p.scheduled_at!), d)));
  const byStatus = (s: string) => weekPosts.filter(p => p.status === s).length;
  // Validation client (tous les posts du client, pas seulement la semaine)
  const approvedCount = posts.filter(p => p.approved_by_client).length;
  const pendingCount = posts.filter(p => !p.approved_by_client && !p.client_comment && ["scheduled", "validated", "generated"].includes(p.status)).length;
  const stats = [
    { label: t('statScheduled'),      n: byStatus("scheduled"), tone: "mint" },
    { label: t('statClientApproved'), n: approvedCount,          tone: "mint" },
    { label: t('statPending'),        n: pendingCount,           tone: "warn" },
    { label: t('statPublished'),      n: byStatus("published"),  tone: "mint" },
  ];
  const toFinish = posts.filter(p => p.status === "generated" || p.status === "validated").slice(0, 5);

  // load per day-of-week
  const load = dowShort.map((_, i) => weekPosts.filter(p => {
    const d = new Date(p.scheduled_at!).getDay();
    return (d === 0 ? 6 : d - 1) === i;
  }).length);
  const maxLoad = Math.max(1, ...load);

  return (
    <aside className="plan-rail" style={{ width: 288, flexShrink: 0, borderLeft: "1px solid var(--line)", background: "var(--paper)", display: "flex", flexDirection: "column", gap: 0, overflowY: "auto" }}>
      {/* Week overview */}
      <div style={{ padding: 16, borderBottom: "1px solid var(--line)" }}>
        <div className="label" style={{ marginBottom: 12 }}>{t('thisWeek')}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {stats.map(s => (
            <div key={s.label} className="well" style={{ padding: "11px 13px" }}>
              <div className="num" style={{ fontSize: 24, lineHeight: 1, color: s.tone === "warn" ? "var(--warn)" : s.tone === "mint" && s.n > 0 ? "var(--mint-2)" : "var(--ink)" }}>{s.n}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)", fontWeight: 600, marginTop: 5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* À finaliser */}
      <div style={{ padding: 16, borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 className="h-title" style={{ fontSize: 13 }}>{t('toFinish')}</h3>
          {toFinish.length > 0 && <span className="chip" style={{ background: "var(--warn-soft)", color: "var(--warn)", fontSize: 10.5 }}>{posts.filter(p => p.status === "generated" || p.status === "validated").length}</span>}
        </div>
        {toFinish.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", padding: "6px 0" }}>{t('allPlanned')}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {toFinish.map(p => {
              const rawImg = p.exported_image_url || p.thumbnail_url || p.photo_url;
              return (
                <Link key={p.id} href={`/workspace/${workspaceId}/${isVideoUrl(p.photo_url) ? "montage" : "editor"}/${p.id}`}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: 7, borderRadius: 10, textDecoration: "none", boxShadow: "inset 0 0 0 1px var(--line)", transition: "background .14s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--sunk)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <div style={{ width: 30, height: 38, borderRadius: 7, background: chipColor, flexShrink: 0, overflow: "hidden" }}>
                    <MediaThumb raw={rawImg} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink)" }} className="trunc">{p.texte_visuel || p.description?.slice(0, 40) || t('postFallback')}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600, marginTop: 2 }}>{t(STATUS_CFG[p.status]?.tKey ?? 'stGenerated')}</div>
                  </div>
                  <IconChevR />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Charge de la semaine */}
      <div style={{ padding: 16 }}>
        <h3 className="h-title" style={{ fontSize: 13, marginBottom: 14 }}>{t('weekLoad')}</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 64 }}>
          {dowShort.map((d, i) => (
            <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <span className="tnum" style={{ fontSize: 10, fontWeight: 800, color: load[i] ? "var(--ink-2)" : "var(--ink-3)" }}>{load[i] || ""}</span>
              <div style={{ width: "100%", height: `${10 + (load[i] / maxLoad) * 36}px`, borderRadius: "4px 4px 2px 2px", background: load[i] >= maxLoad && maxLoad > 1 ? chipColor : load[i] ? `${chipColor}66` : "var(--sunk)" }} />
              <span className="label" style={{ fontSize: 9 }}>{d}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ─── Planning content ─────────────────────────────────────────────────────────

function PlanningContent() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const id           = params.id as string;
  const preSelectedId = searchParams.get("post");
  const supabase     = createClientComponentClient();
  const gridRef      = useRef<HTMLDivElement>(null);
  const t            = useTranslations('planning');
  const locale       = useLocale();
  const MONTH_LOC    = localizedMonthNames(locale);
  const DAY_LOC      = localizedDayNamesShort(locale);

  // ── State ─────────────────────────────────────────────────────────────────
  const [workspace,    setWorkspace]    = useState<Workspace | null>(null);
  const [posts,        setPosts]        = useState<Post[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [weekStart,    setWeekStart]    = useState<Date>(() => getMonday(new Date()));
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [draggedId,    setDraggedId]    = useState<string | null>(null);
  const [dragOverDay,  setDragOverDay]  = useState<string | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [panelDate,         setPanelDate]         = useState("");
  const [panelTime,         setPanelTime]         = useState("09:00");
  const [panelDesc,         setPanelDesc]         = useState("");
  const [panelPostType,     setPanelPostType]     = useState<PostType>("post");
  const [panelPlatforms,    setPanelPlatforms]    = useState<string[]>(["instagram"]);
  const [panelTaggedUsers,  setPanelTaggedUsers]  = useState("");
  const [panelMusicNote,    setPanelMusicNote]    = useState("");
  const [scheduling,   setScheduling]   = useState(false);
  const [publishing,   setPublishing]   = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);
  const [showIgModal,  setShowIgModal]  = useState(false);
  const [showCanva,    setShowCanva]    = useState(false);
  const [canvaPostId,  setCanvaPostId]  = useState("");
  const [calView,      setCalView]      = useState<"week" | "month">("week");
  const [monthDate,    setMonthDate]    = useState<Date>(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [nowTop,       setNowTop]       = useState(() => new Date().getHours() * HOUR_H + new Date().getMinutes());
  // Partage pour validation client
  const isoDay = (d: Date) => d.toISOString().slice(0, 10);
  const [shareOpen,  setShareOpen]  = useState(false);
  const [shareFrom,  setShareFrom]  = useState(() => isoDay(new Date()));
  const [shareTo,    setShareTo]    = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return isoDay(d); });
  const [shareLink,  setShareLink]  = useState("");
  const [shareBusy,  setShareBusy]  = useState(false);

  async function generateShareLink() {
    setShareBusy(true); setShareLink("");
    try {
      const res = await fetch("/api/share-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: id,
          label: "Validation client",
          dateFrom: shareFrom ? new Date(shareFrom + "T00:00:00").toISOString() : null,
          dateTo:   shareTo   ? new Date(shareTo + "T23:59:59").toISOString()   : null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.token?.token) {
        setShareLink(`${window.location.origin}/preview/${json.token.token}`);
      } else {
        setToast({ msg: json.error || t('errLinkGen'), ok: false });
      }
    } catch {
      setToast({ msg: t('errNetwork'), ok: false });
    }
    setShareBusy(false);
  }

  const connected = searchParams.get("connected") === "true";

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const [{ data: ws }, { data: postsData }] = await Promise.all([
      supabase.from("workspaces").select("id, name, primary_color, secondary_color, font_family, instagram_account_id, instagram_username, facebook_page_id").eq("id", id).single(),
      supabase.from("posts")
        .select("id, photo_url, exported_image_url, texte_visuel, description, status, scheduled_at, brief, post_type, target_platforms, tagged_users, music_note, thumbnail_url, approved_by_client, client_comment, client_reviewed_at")
        .eq("workspace_id", id)
        .in("status", ["generated", "validated", "scheduled", "published"])
        .order("scheduled_at", { ascending: true }),
    ]);
    if (ws) setWorkspace(ws);
    if (postsData) setPosts(postsData);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!preSelectedId || posts.length === 0) return;
    const post = posts.find(p => p.id === preSelectedId);
    if (post) selectPost(post);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectedId, posts]);

  // ── Live clock line ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNowTop(new Date().getHours() * HOUR_H + new Date().getMinutes()), 30000);
    return () => clearInterval(t);
  }, []);

  // ── Auto-scroll to 8h on week view load (start of working day, not midnight) ──
  useEffect(() => {
    if (calView !== "week" || !gridRef.current) return;
    gridRef.current.scrollTop = 8 * HOUR_H; // scroll to 8:00
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calView]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function selectPost(post: Post) {
    setSelectedPost(post);
    setPanelDesc(post.description ?? "");
    // Clampe le type au format du média : une vidéo ne peut être que Reel/Story, une photo Post/Story.
    const allowed = allowedTypesFor(isVideoUrl(post.photo_url));
    const currentType = (post.post_type as PostType) ?? "post";
    setPanelPostType(allowed.includes(currentType) ? currentType : allowed[0]);
    const connected = [
      ...(workspace?.instagram_account_id ? ["instagram"] : []),
      ...(workspace?.facebook_page_id ? ["facebook"] : []),
    ];
    setPanelPlatforms(post.target_platforms?.length ? post.target_platforms : (connected.length ? connected : ["instagram"]));
    setPanelTaggedUsers((post.tagged_users ?? []).join(", "));
    setPanelMusicNote(post.music_note ?? "");
    if (post.scheduled_at) {
      const d = new Date(post.scheduled_at);
      setPanelDate(toDateInput(d));
      setPanelTime(`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`);
    } else {
      setPanelDate(toDateInput(new Date()));
      setPanelTime("09:00");
    }
  }
  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); }

  // ── Drag handlers ─────────────────────────────────────────────────────────

  // Week view: drop onto a specific hour slot
  async function handleDropOnHour(day: Date, hour: number) {
    if (!draggedId) return;
    setDragOverDay(null); setDragOverHour(null);
    const timeStr = `${String(hour).padStart(2,"0")}:00`;
    const scheduled_at = buildScheduledAt(toDateInput(day), timeStr);
    if (!scheduled_at) { setDraggedId(null); showToast("Date invalide", false); return; }
    const { error } = await supabase.from("posts").update({ scheduled_at, status: "scheduled" }).eq("id", draggedId);
    if (error) { setDraggedId(null); showToast(`Échec : ${error.message}`, false); return; }
    setPosts(prev => prev.map(p => p.id === draggedId ? { ...p, scheduled_at, status: "scheduled" } : p));
    if (selectedPost?.id === draggedId) {
      setSelectedPost(prev => prev ? { ...prev, scheduled_at, status: "scheduled" } : null);
      setPanelDate(toDateInput(day)); setPanelTime(timeStr);
    }
    setDraggedId(null);
  }

  // Old day-only drop (month view / unscheduled list)
  async function handleDropOnDay(day: Date) {
    if (!draggedId) return;
    setDragOverDay(null);
    const post = posts.find(p => p.id === draggedId);
    if (!post) return;
    const time = post.scheduled_at
      ? `${String(new Date(post.scheduled_at).getHours()).padStart(2,"0")}:${String(new Date(post.scheduled_at).getMinutes()).padStart(2,"0")}`
      : "09:00";
    const scheduled_at = buildScheduledAt(toDateInput(day), time);
    if (!scheduled_at) { setDraggedId(null); showToast("Date invalide", false); return; }
    const { error } = await supabase.from("posts").update({ scheduled_at, status: "scheduled" }).eq("id", draggedId);
    if (error) { setDraggedId(null); showToast(`Échec : ${error.message}`, false); return; }
    setPosts(prev => prev.map(p => p.id === draggedId ? { ...p, scheduled_at, status: "scheduled" } : p));
    if (selectedPost?.id === draggedId) {
      setSelectedPost(prev => prev ? { ...prev, scheduled_at, status: "scheduled" } : null);
      setPanelDate(toDateInput(day));
    }
    setDraggedId(null);
  }

  // ── Schedule / publish / delete ───────────────────────────────────────────
  async function handleSchedule() {
    if (!selectedPost || !panelDate) return;
    setScheduling(true);
    const scheduled_at = buildScheduledAt(panelDate, panelTime);
    if (!scheduled_at) { setScheduling(false); showToast("Date ou heure invalide", false); return; }
    const tagged_users = panelTaggedUsers
      .split(",")
      .map(s => s.trim().replace(/^@/, ""))
      .filter(Boolean);
    const { error } = await supabase.from("posts").update({
      scheduled_at,
      description: panelDesc,
      status: "scheduled",
      post_type: panelPostType,
      target_platforms: panelPlatforms,
      tagged_users,
      music_note: panelMusicNote || null,
    }).eq("id", selectedPost.id);
    setScheduling(false);
    if (error) { showToast(`Échec de la programmation : ${error.message}`, false); return; }
    setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, scheduled_at, description: panelDesc, status: "scheduled", post_type: panelPostType, target_platforms: panelPlatforms, tagged_users, music_note: panelMusicNote || null } : p));
    setSelectedPost(null);
    showToast("Post programmé");
  }

  async function deletePost(post: Post) {
    if (!confirm("Supprimer ce post ? Cette action est irréversible.")) return;
    await supabase.from("posts").delete().eq("id", post.id);
    setPosts(prev => prev.filter(p => p.id !== post.id));
    setSelectedPost(null);
  }

  async function handlePublish() {
    if (!selectedPost) return;
    const igConnected = !!workspace?.instagram_account_id;
    const fbConnected = !!workspace?.facebook_page_id;
    if (!igConnected && !fbConnected) { setShowIgModal(true); return; }
    // Cibles = plateformes sélectionnées ET réellement connectées ; sinon on retombe sur ce qui est connecté.
    let targets = panelPlatforms.filter(p => (p === "instagram" && igConnected) || (p === "facebook" && fbConnected));
    if (targets.length === 0) targets = [igConnected ? "instagram" : "facebook"];
    setPublishing(true);
    if (panelDesc !== selectedPost.description) {
      await supabase.from("posts").update({ description: panelDesc }).eq("id", selectedPost.id);
    }
    const endpoints: Record<string, string> = { instagram: "/api/publish/instagram", facebook: "/api/publish/facebook" };
    const nameOf = (p: string) => (p === "instagram" ? "Instagram" : "Facebook");
    const results = await Promise.all(targets.map(async (plat) => {
      const res  = await fetch(endpoints[plat], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: selectedPost.id, workspaceId: id }) });
      const data = await res.json().catch(() => ({}));
      return { plat, ok: res.ok, error: data?.error as string | undefined };
    }));
    setPublishing(false);
    const ok   = results.filter(r => r.ok).map(r => r.plat);
    const fail = results.filter(r => !r.ok);
    if (ok.length) {
      setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, status: "published", description: panelDesc } : p));
    }
    if (fail.length === 0) {
      showToast(`Publié sur ${ok.map(nameOf).join(" et ")}`);
      setSelectedPost(null);
    } else if (ok.length) {
      showToast(`Publié sur ${ok.map(nameOf).join(" et ")} — échec ${fail.map(r => nameOf(r.plat)).join(" et ")}`, false);
      setSelectedPost(null);
    } else {
      showToast(`Erreur — ${fail[0].error ?? "publication échouée"}`, false);
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const weekDays      = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = isSameDay(getMonday(new Date()), weekStart);
  const postsForDay   = (day: Date) => posts.filter(p => p.scheduled_at && isSameDay(new Date(p.scheduled_at), day));
  const unscheduled   = posts.filter(p => !p.scheduled_at || p.status === "generated" || p.status === "validated");
  const monthGrid     = getMonthGrid(monthDate.getFullYear(), monthDate.getMonth());
  const today         = new Date();
  const chipColor     = workspace?.primary_color || "#2FD79B";

  const prevMonth = () => setMonthDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; });
  const nextMonth = () => setMonthDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="plan-root" style={{ flex: 1, display: "flex", minWidth: 0, overflow: "hidden", position: "relative" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 50, padding: "11px 22px", borderRadius: 99, fontWeight: 700, fontSize: 13.5, boxShadow: "var(--shadow-pop)", background: toast.ok ? "var(--ink)" : "var(--warn)", color: toast.ok ? "var(--paper)" : "#fff", whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      {/* Instagram modal */}
      {showIgModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(13,15,10,.45)" }} onClick={() => setShowIgModal(false)}>
          <div className="card pop-in" style={{ padding: 32, maxWidth: 360, width: "100%", margin: "0 16px" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)", display: "grid", placeItems: "center", color: "#fff", marginBottom: 16 }}><IconInstagram /></div>
            <h2 className="h-title" style={{ fontSize: 18, marginBottom: 8 }}>{t('igNotConnected')}</h2>
            <p style={{ color: "var(--ink-2)", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>{t('igConnectHint')}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowIgModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>{t('cancel')}</button>
              <Link href={`/workspace/${id}/parametres`} className="btn btn-dark" style={{ flex: 1, textAlign: "center" }}>{t('connectInstagram')}</Link>
            </div>
          </div>
        </div>
      )}

      {/* Canva modal */}
      {showCanva && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,15,10,.9)", zIndex: 1000, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", background: "var(--forest)", borderBottom: "1px solid var(--cream-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: "var(--display)", fontWeight: 900, fontSize: 20, color: "var(--cream)", letterSpacing: "-0.04em" }}>Kl<span style={{ color: "var(--mint)" }}>ip</span></span>
              <span style={{ color: "var(--cream-3)", fontSize: 14 }}>{t('canvaEditor')}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label className="btn btn-primary btn-sm" style={{ cursor: "pointer" }}>
                {t('uploadPng')}
                <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }}
                  onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const fileName = `${id}/${canvaPostId}-canva-${Date.now()}.png`;
                    await supabase.storage.from("exports").upload(fileName, file, { contentType: file.type, upsert: true });
                    const { data: urlData } = supabase.storage.from("exports").getPublicUrl(fileName);
                    await supabase.from("posts").update({ exported_image_url: urlData.publicUrl, status: "validated" }).eq("id", canvaPostId);
                    setShowCanva(false); window.location.reload();
                  }}
                />
              </label>
              <button onClick={() => setShowCanva(false)} className="btn btn-ghost btn-sm" style={{ color: "var(--cream)" }}>{t('close')}</button>
            </div>
          </div>
          <iframe src="https://www.canva.com/_partnership/embed?action=createDesign&type=InstagramPost&fileType=png&supportDesignButtonErrorPage=false&apiMode=button&embed" style={{ flex: 1, width: "100%", border: "none" }} allow="fullscreen" title="Canva Editor" />
        </div>
      )}

      {/* Modale : partager pour validation client */}
      {shareOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(13,15,10,.45)", padding: 16 }} onClick={() => setShareOpen(false)}>
          <div className="card pop-in" style={{ padding: 28, maxWidth: 440, width: "100%" }} onClick={e => e.stopPropagation()}>
            <h2 className="h-title" style={{ fontSize: 18, marginBottom: 6 }}>{t('shareTitle')}</h2>
            <p style={{ color: "var(--ink-2)", fontSize: 13.5, marginBottom: 20, lineHeight: 1.5 }}>
              {t('shareHint')}
            </p>
            <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
              <label style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>{t('from')}
                <input type="date" value={shareFrom} onChange={e => setShareFrom(e.target.value)}
                  style={{ width: "100%", marginTop: 5, padding: "9px 11px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--sunk)", color: "var(--ink)", fontFamily: "var(--sans)", outline: "none" }} />
              </label>
              <label style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>{t('to')}
                <input type="date" value={shareTo} min={shareFrom} onChange={e => setShareTo(e.target.value)}
                  style={{ width: "100%", marginTop: 5, padding: "9px 11px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--sunk)", color: "var(--ink)", fontFamily: "var(--sans)", outline: "none" }} />
              </label>
            </div>

            {!shareLink ? (
              <button onClick={generateShareLink} disabled={shareBusy} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", background: "#2FD79B", color: "#0D2E1C", fontWeight: 700 }}>
                {shareBusy ? t('generating') : t('generateLink')}
              </button>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input readOnly value={shareLink} onFocus={e => e.currentTarget.select()}
                    style={{ flex: 1, padding: "9px 11px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--sunk)", color: "var(--ink-2)", fontSize: 12.5, fontFamily: "var(--mono)", outline: "none" }} />
                  <button onClick={() => { navigator.clipboard.writeText(shareLink); setToast({ msg: t('linkCopied'), ok: true }); }} className="btn btn-dark btn-sm">{t('copy')}</button>
                </div>
                <p style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>
                  {t('shareLinkHint')}
                </p>
              </>
            )}

            <button onClick={() => { setShareOpen(false); setShareLink(""); }} className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", marginTop: 14 }}>{t('close')}</button>
          </div>
        </div>
      )}

      {/* ── Main area ─────────────────────────────────────────────────────────── */}
      <div className="plan-main" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Topbar */}
        <header className="topbar">
          <h1 className="h-display" style={{ fontSize: 22, textTransform: "capitalize", whiteSpace: "nowrap" }}>
            {calView === "week" ? formatMonthYear(weekStart, locale) : `${MONTH_LOC[monthDate.getMonth()]} ${monthDate.getFullYear()}`}
          </h1>

          {calView === "week" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => setWeekStart(w => addDays(w, -7))} className="btn btn-ghost btn-icon"><IconChevL /></button>
              <button onClick={() => setWeekStart(w => addDays(w, 7))} className="btn btn-ghost btn-icon"><IconChevR /></button>
            </div>
          )}
          {calView === "month" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={prevMonth} className="btn btn-ghost btn-icon"><IconChevL /></button>
              <button onClick={nextMonth} className="btn btn-ghost btn-icon"><IconChevR /></button>
            </div>
          )}

          {!isCurrentWeek && calView === "week" && (
            <button onClick={() => setWeekStart(getMonday(new Date()))} className="btn btn-sm btn-ghost">{t('today')}</button>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <NotificationBell />
            <button onClick={() => setShareOpen(true)} className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
              {t('shareTitle')}
            </button>
            <Link href={`/workspace/${id}`} className="btn btn-primary btn-sm" style={{ background: "#2FD79B", color: "#0D2E1C", fontWeight: 700, gap: 6 }}><IconPlus /> {t('newPost')}</Link>
            {/* Segmented toggle */}
            <div className="seg">
              {(["month","week"] as const).map(v => (
                <button key={v} onClick={() => setCalView(v)} className={calView === v ? "on" : ""}>
                  {v === "week" ? t('week') : t('month')}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Instagram connected banner */}
        {connected && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 26px", background: "var(--mint-soft)", borderBottom: "1px solid var(--mint-soft)", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--mint-2)" strokeWidth="1.5"/><path d="M5 8l2.5 2.5 4-4" stroke="var(--mint-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--mint-2)" }}>{t('igConnectedSuccess')}</p>
          </div>
        )}

        {/* ── BestTimeStrip ── */}
        <BestTimeStrip
          dayOfWeek={calView === "week" ? weekStart.getDay() : today.getDay()}
          label={calView === "week" ? DAY_LOC[weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1] : MONTH_LOC[monthDate.getMonth()]}
        />

        {/* Section « À publier » retirée (redondante avec le calendrier ci-dessous) */}
        {false && (() => {
          const scheduled = posts.filter(p => p.scheduled_at && (p.status === "scheduled" || p.status === "published")).sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
          return (
            <div style={{ flexShrink: 0, borderBottom: "1px solid var(--line)", background: "var(--white)", padding: "14px 26px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span className="h-title" style={{ fontSize: 14 }}>À publier</span>
                {scheduled.length > 0 && <span className="chip" style={{ background: "var(--mint-soft)", color: "var(--mint-2)", fontSize: 11 }}>{scheduled.length}</span>}
              </div>
              {scheduled.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-3)", fontSize: 13 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>
                  Aucun contenu programmé pour le moment
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                  {scheduled.map(post => {
                    const rawImg  = post.exported_image_url || post.thumbnail_url || post.photo_url;
                    const isPub   = post.status === "published";
                    const pType   = (post.post_type as PostType) ?? "post";
                    const ptCfg   = POST_TYPE_CFG[pType];
                    const isSelected = selectedPost?.id === post.id;
                    return (
                      <div key={post.id} onClick={() => selectPost(post)}
                        style={{ flexShrink: 0, width: 100, borderRadius: 10, overflow: "hidden", cursor: "pointer", border: `2px solid ${isSelected ? chipColor : "var(--line)"}`, background: "var(--canvas)", boxShadow: isSelected ? `0 0 0 2px ${chipColor}30` : "none", transition: "border-color .12s" }}>
                        {/* Thumbnail */}
                        <div style={{ width: "100%", aspectRatio: "1", overflow: "hidden", background: "#000", position: "relative" }}>
                          {rawImg ? (
                            <MediaThumb raw={rawImg} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", background: chipColor }} />
                          )}
                          {/* Platform badge */}
                          <div style={{ position: "absolute", top: 4, left: 4, display: "flex", gap: 2 }}>
                            {(!post.target_platforms || post.target_platforms.includes("instagram")) && (
                              <span style={{ width: 16, height: 16, borderRadius: 4, background: isPub ? "#E1306C" : "rgba(225,48,108,.8)", display: "grid", placeItems: "center" }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg>
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Meta */}
                        <div style={{ padding: "6px 7px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-3)", marginBottom: 3, fontFamily: "var(--mono)" }}>
                            {new Date(post.scheduled_at!).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · {formatTime(post.scheduled_at)}
                          </div>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: ptCfg.color, color: "#fff", fontFamily: "var(--sans)" }}>{ptCfg.label}</span>
                            {isPub && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--mint-2)" }}>Publié</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ─── WEEK VIEW ───────────────────────────────────────────────────── */}
        {calView === "week" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: "calc(100vh - 64px)" }}>

            {/* Single scrollable area — day headers sticky at top inside it */}
            <div ref={gridRef} className="plan-cal-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", position: "relative", background: "var(--canvas)" }}>

              {/* Sticky day-header row */}
              <div className="plan-cal-grid" style={{ display: "grid", gridTemplateColumns: "56px repeat(7,1fr)", position: "sticky", top: 0, zIndex: 10, background: "var(--canvas)", borderBottom: `1px solid rgba(13,15,10,.08)`, boxShadow: "0 1px 0 rgba(13,15,10,.04)" }}>
                {/* Corner cell */}
                <div style={{ borderRight: `1px solid rgba(13,15,10,.08)`, background: "var(--canvas)" }} />
                {weekDays.map((day, i) => {
                  const isToday = isSameDay(day, today);
                  return (
                    <div key={i} style={{ padding: "11px 14px 10px", borderRight: i < 6 ? `1px solid rgba(13,15,10,.08)` : "none", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--ink-3)" }}>{DAY_LOC[i]}</span>
                      <span style={{ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", fontFamily: "'Archivo', var(--sans)", fontWeight: 700, fontSize: 13, transition: "background .12s",
                        background: isToday ? "#2FD79B" : "transparent",
                        color: isToday ? "#0D2E1C" : "var(--ink)" }}>
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Grid body */}
              <div className="plan-cal-grid" style={{ display: "grid", gridTemplateColumns: "56px repeat(7,1fr)" }}>

                {/* Hour labels column — sticky left */}
                <div style={{ position: "sticky", left: 0, zIndex: 3, background: "var(--canvas)", borderRight: `1px solid rgba(13,15,10,.08)` }}>
                  {HOURS.map(h => (
                    <div key={h} style={{ height: HOUR_H, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 10, paddingTop: 5, boxSizing: "border-box", fontFamily: "var(--display)", fontSize: 11, fontWeight: 400, color: "var(--ink-3)", borderBottom: `1px solid rgba(13,15,10,.06)` }}>
                      {h === 0 ? "" : `${String(h).padStart(2, "0")}h`}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((day, di) => {
                  const dayKey    = toDateInput(day);
                  const isToday   = isSameDay(day, today);
                  const dayPosts  = postsForDay(day);
                  return (
                    <div key={dayKey} style={{ position: "relative", borderRight: di < 6 ? `1px solid rgba(13,15,10,.08)` : "none" }}>

                      {/* Hour slots (drop targets + hover) */}
                      {HOURS.map(h => {
                        const isOver = dragOverDay === dayKey && dragOverHour === h;
                        return (
                          <div key={h}
                            className="cal-slot"
                            style={{ height: HOUR_H, borderBottom: `1px solid rgba(13,15,10,.06)`, boxSizing: "border-box", background: isOver ? "rgba(47,215,155,.08)" : "transparent", cursor: "pointer", transition: "background .1s" }}
                            onDragOver={e => { e.preventDefault(); setDragOverDay(dayKey); setDragOverHour(h); }}
                            onDragLeave={() => { setDragOverDay(null); setDragOverHour(null); }}
                            onDrop={() => handleDropOnHour(day, h)}
                            onClick={() => { if (!draggedId) window.location.href = `/workspace/${id}`; }}
                          />
                        );
                      })}

                      {/* Current time line */}
                      {isToday && (
                        <div style={{ position: "absolute", top: nowTop, left: 0, right: 0, height: 2, background: "#2FD79B", zIndex: 4, pointerEvents: "none" }}>
                          <div style={{ position: "absolute", left: -4, top: -3, width: 8, height: 8, borderRadius: "50%", background: "#2FD79B" }} />
                        </div>
                      )}

                      {/* Post blocks */}
                      {dayPosts.map(post => {
                        const d          = new Date(post.scheduled_at!);
                        const topPx      = d.getHours() * HOUR_H + Math.round(d.getMinutes() * HOUR_H / 60);
                        const blockH     = Math.max(HOUR_H - 4, 44);
                        const isSelected = selectedPost?.id === post.id;
                        const isPub      = post.status === "published";
                        const rawImg     = post.exported_image_url || post.thumbnail_url || post.photo_url;
                        const initials   = (workspace?.name ?? "??").slice(0, 2).toUpperCase();
                        return (
                          <div key={post.id}
                            draggable
                            onDragStart={e => { e.stopPropagation(); setDraggedId(post.id); }}
                            onDragEnd={() => { setDraggedId(null); setDragOverDay(null); setDragOverHour(null); }}
                            onClick={e => { e.stopPropagation(); selectPost(post); }}
                            style={{
                              position: "absolute", top: topPx + 2, left: 4, right: 4,
                              height: blockH, borderRadius: 8,
                              padding: "0 8px 0 0",
                              background: isPub ? "var(--mint-soft)" : "var(--white)",
                              borderLeft: `3px solid ${chipColor}`,
                              boxShadow: isSelected
                                ? `0 0 0 2px ${chipColor}, var(--shadow-card)`
                                : isPub ? "inset 0 0 0 1px rgba(47,215,155,.4)" : "inset 0 0 0 1px var(--line)",
                              opacity: draggedId === post.id ? 0.35 : 1,
                              overflow: "hidden", userSelect: "none",
                              display: "flex", alignItems: "center", gap: 7,
                              cursor: "grab", zIndex: 2,
                              transition: "box-shadow .12s, opacity .12s, transform .12s",
                            }}
                          >
                            {/* thumbnail */}
                            <div style={{ width: 30, height: 36, flexShrink: 0, overflow: "hidden", borderRadius: 5, marginLeft: 6 }}>
                              {rawImg ? (
                                <MediaThumb raw={rawImg} />
                              ) : (
                                <div style={{ width: "100%", height: "100%", background: chipColor, display: "grid", placeItems: "center" }}>
                                  <span style={{ fontSize: 8, fontWeight: 800, color: "#fff", fontFamily: "var(--sans)" }}>{initials}</span>
                                </div>
                              )}
                            </div>
                            {/* Text */}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.25, color: "var(--ink)" }}>
                                {post.texte_visuel || "Post"}
                              </div>
                              <div style={{ fontSize: 10.5, color: isPub ? "var(--mint-2)" : "var(--ink-3)", fontWeight: 700, lineHeight: 1 }}>
                                {isPub ? t('stPublished') : formatTime(post.scheduled_at, locale)}
                              </div>
                            </div>
                            {(post.approved_by_client || post.client_comment) && (
                              <span title={post.approved_by_client ? "Validé par le client" : "Modification demandée"} style={{ flexShrink: 0, width: 16, height: 16, borderRadius: "50%", display: "grid", placeItems: "center", background: post.approved_by_client ? "var(--mint-2)" : "#F59E0B", color: "#fff", fontSize: 10, fontWeight: 900, marginRight: 2 }}>
                                {post.approved_by_client ? "✓" : "!"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Unscheduled strip */}
            {unscheduled.length > 0 && (
              <div style={{ flexShrink: 0, borderTop: `1px solid rgba(13,15,10,.08)`, padding: "10px 20px", background: "var(--canvas)", display: "flex", gap: 8, overflowX: "auto", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--display)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-3)", flexShrink: 0 }}>Non programmés ({unscheduled.length})</span>
                {unscheduled.map(post => (
                  <div key={post.id} draggable
                    onDragStart={() => setDraggedId(post.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverDay(null); setDragOverHour(null); }}
                    onClick={() => selectPost(post)}
                    style={{ flexShrink: 0, width: 52, height: 64, borderRadius: 8, overflow: "hidden", cursor: "pointer", opacity: draggedId === post.id ? 0.35 : 1, boxShadow: selectedPost?.id === post.id ? `0 0 0 2.5px ${chipColor}` : "0 1px 4px rgba(13,15,10,.12)", userSelect: "none", background: "var(--white)" }}>
                    {(post.exported_image_url || post.thumbnail_url || post.photo_url) ? (
                      <MediaThumb raw={post.exported_image_url || post.thumbnail_url || post.photo_url} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: chipColor, display: "grid", placeItems: "center" }}>
                        <span style={{ fontFamily: "var(--sans)", fontSize: 9, fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>Post</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── MONTH VIEW ──────────────────────────────────────────────────── */}
        {calView === "month" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: `1px solid rgba(13,15,10,.08)`, flexShrink: 0, background: "var(--canvas)" }}>
              {DAY_LOC.map(d => (
                <div key={d} style={{ padding: "11px 0 9px", textAlign: "center", fontFamily: "var(--display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--ink-3)" }}>{d}</div>
              ))}
            </div>
            {/* Month grid */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: "minmax(116px, 1fr)" }}>
                {monthGrid.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} style={{ borderRight: `1px solid rgba(13,15,10,.06)`, borderBottom: `1px solid rgba(13,15,10,.06)`, background: "rgba(13,15,10,.02)", opacity: .7 }} />;
                  const isToday   = isSameDay(day, today);
                  const dayPosts  = postsForDay(day);
                  const dayKey    = toDateInput(day);
                  const isDragOver = dragOverDay === dayKey && !dragOverHour;
                  return (
                    <div key={i}
                      style={{ borderRight: `1px solid rgba(13,15,10,.06)`, borderBottom: `1px solid rgba(13,15,10,.06)`, padding: "6px 6px 4px", cursor: "pointer", background: isDragOver ? "rgba(47,215,155,.07)" : "var(--white)", transition: "background .1s" }}
                      onDragOver={e => { e.preventDefault(); setDragOverDay(dayKey); }}
                      onDragLeave={() => setDragOverDay(null)}
                      onDrop={() => handleDropOnDay(day)}
                      onClick={() => { setWeekStart(getMonday(day)); setCalView("week"); }}
                    >
                      {/* Day number */}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                        <span style={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", fontFamily: "'Archivo', var(--sans)", fontSize: 11, fontWeight: 700,
                          background: isToday ? "#2FD79B" : "transparent",
                          color: isToday ? "#0D2E1C" : "var(--ink-3)" }}>
                          {day.getDate()}
                        </span>
                      </div>
                      {/* Post chips */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {dayPosts.slice(0, 3).map(post => {
                          const rawImg  = post.exported_image_url || post.thumbnail_url || post.photo_url;
                          const isPub   = post.status === "published";
                          return (
                          <div key={post.id}
                            draggable
                            onDragStart={e => { e.stopPropagation(); setDraggedId(post.id); }}
                            onDragEnd={() => { setDraggedId(null); setDragOverDay(null); }}
                            onClick={e => { e.stopPropagation(); selectPost(post); }}
                            style={{
                              borderRadius: 6, padding: "3px 5px 3px 0",
                              background: isPub ? "var(--mint-soft)" : "var(--white)",
                              borderLeft: `3px solid ${chipColor}`,
                              boxShadow: isPub ? "inset 0 0 0 1px rgba(47,215,155,.3)" : "inset 0 0 0 1px var(--line)",
                              color: "var(--ink)", fontSize: 10.5, fontWeight: 600,
                              overflow: "hidden", whiteSpace: "nowrap",
                              cursor: "grab", opacity: draggedId === post.id ? 0.35 : 1,
                              display: "flex", alignItems: "center", gap: 4,
                              transition: "transform .12s",
                            }}>
                            {/* Mini thumb */}
                            <div style={{ width: 16, height: 16, borderRadius: 3, overflow: "hidden", flexShrink: 0, marginLeft: 4, position: "relative" }}>
                              {rawImg ? (
                                <MediaThumb raw={rawImg} />
                              ) : (
                                <div style={{ width: "100%", height: "100%", background: chipColor }} />
                              )}
                            </div>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                              {formatTime(post.scheduled_at, locale)} {post.texte_visuel || t('postFallback')}
                            </span>
                            {isPub && <span className="dot" style={{ background: "var(--mint-2)", marginLeft: "auto", marginRight: 4 }} />}
                          </div>
                          );
                        })}
                        {dayPosts.length > 3 && (
                          <div style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--mono)", fontWeight: 700, padding: "1px 4px" }}>+{dayPosts.length - 3} de plus</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Unscheduled (month view) */}
            {unscheduled.length > 0 && (
              <div style={{ flexShrink: 0, borderTop: "1px solid var(--line)", padding: "10px 20px", background: "var(--canvas)", display: "flex", gap: 8, overflowX: "auto", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-3)", flexShrink: 0 }}>{t('unscheduled')}</span>
                {unscheduled.map(post => (
                  <div key={post.id} draggable
                    onDragStart={() => setDraggedId(post.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverDay(null); }}
                    onClick={() => selectPost(post)}
                    style={{ flexShrink: 0, width: 56, height: 68, borderRadius: 8, overflow: "hidden", cursor: "pointer", opacity: draggedId === post.id ? 0.35 : 1, boxShadow: selectedPost?.id === post.id ? `0 0 0 2.5px ${chipColor}` : "0 1px 4px rgba(13,15,10,.12)", userSelect: "none", background: "var(--white)" }}>
                    {(post.exported_image_url || post.thumbnail_url || post.photo_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.exported_image_url || post.thumbnail_url || post.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: chipColor, display: "grid", placeItems: "center" }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>{t('postFallback')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", border: "2.5px solid var(--mint-soft)", borderTopColor: "var(--mint-2)", display: "inline-block", animation: "spin .7s linear infinite" }} />
          </div>
        )}

        {/* ── Status legend ── */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 18, padding: "10px 26px", borderTop: "1px solid var(--line)", background: "var(--canvas)", flexWrap: "wrap" }}>
          {([
            { key: "scheduled", dot: "var(--mint-2)",  label: t('stScheduled') },
            { key: "published", dot: "var(--mint)",    label: t('stPublished') },
            { key: "generated", dot: "var(--ink-3)",   label: t('legendDraft') },
          ]).map(({ key, dot, label }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--ink-2)", fontWeight: 600 }}>
              <span className="dot" style={{ background: dot }} /> {label}
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l4-4 4 4M9 5v14M19 15l-4 4-4-4M15 5v14"/></svg>
            {t('dragHint')}
          </div>
        </div>
      </div>

      {/* ── Calendar Rail ─────────────────────────────────────────────────────── */}
      <CalendarRail posts={posts} weekDays={weekDays} chipColor={chipColor} workspaceId={id} />

      {/* ── Post panel modal ─────────────────────────────────────────────────── */}
      {selectedPost && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(13,15,10,.45)" }} onClick={() => setSelectedPost(null)}>
        <div style={{ width: 420, maxHeight: "90vh", borderRadius: 16, background: "var(--white)", display: "flex", flexDirection: "column", overflowY: "auto", boxShadow: "0 24px 60px -12px rgba(13,15,10,.45), 0 0 0 1px rgba(13,15,10,.06)" }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
            <span className="h-title" style={{ fontSize: 15 }}>{t('schedule')}</span>
            <button onClick={() => setSelectedPost(null)} className="btn btn-ghost btn-icon"><IconClose /></button>
          </div>

          <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            {(selectedPost.exported_image_url || selectedPost.thumbnail_url || selectedPost.photo_url) && (
              <div style={{ position: "relative", width: "100%", maxWidth: (selectedPost.post_type === "story" || selectedPost.post_type === "reel") ? 260 : "100%", margin: "0 auto", aspectRatio: aspectForType(selectedPost.post_type), borderRadius: "var(--r)", overflow: "hidden", background: "#000" }}>
                {isVideoUrl(selectedPost.exported_image_url) ? (
                  <video src={selectedPost.exported_image_url!} controls playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : isVideoUrl(selectedPost.photo_url) ? (
                  <video src={selectedPost.photo_url} controls playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : selectedPost.exported_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedPost.exported_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedPost.thumbnail_url || selectedPost.photo_url || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {selectedPost.texte_visuel && (
                      <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, background: workspace?.primary_color ?? "#0038FF", color: workspace?.secondary_color ?? "#FFFFFF", fontFamily: workspace?.font_family ? `"${workspace.font_family}", sans-serif` : "Oswald, sans-serif", fontWeight: "bold", fontSize: 14, padding: "6px 12px", borderRadius: 4, textTransform: "uppercase", maxWidth: "80%" }}>
                        {selectedPost.texte_visuel}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Retour du client (validation ou demande de modif) */}
            {selectedPost.approved_by_client && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(47,215,155,.12)", border: "1px solid var(--mint-2)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mint-2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--mint-2)" }}>{t('approvedByClient')}</span>
              </div>
            )}
            {!selectedPost.approved_by_client && selectedPost.client_comment && (
              <div style={{ padding: "10px 12px", borderRadius: 10, background: "#FEF3C7", border: "1px solid #FCD34D" }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "#B45309", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{t('changeRequested')}</div>
                <div style={{ fontSize: 13, color: "#92400E", lineHeight: 1.5 }}>{selectedPost.client_comment}</div>
              </div>
            )}

            <div>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>{t('igDescription')}</label>
              <textarea value={panelDesc} onChange={e => setPanelDesc(e.target.value)} rows={4} className="input" style={{ resize: "none", fontSize: 12.5, color: "var(--ink-2)" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 6 }}>{t('date')}</label>
                <input type="date" value={panelDate} onChange={e => setPanelDate(e.target.value)} className="input" style={{ height: 40, fontSize: 12.5 }} />
              </div>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 6 }}>{t('time')}</label>
                <input type="time" value={panelTime} onChange={e => setPanelTime(e.target.value)} className="input" style={{ height: 40, fontSize: 12.5 }} />
              </div>
            </div>

            {/* ── Type de contenu (règles de format : vidéo → Reel/Story, photo → Post/Story) ── */}
            {(() => {
              const isVid = isVideoUrl(selectedPost.photo_url);
              const allowed = allowedTypesFor(isVid);
              return (
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 8 }}>{t('contentType')}</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(Object.entries(POST_TYPE_CFG) as [PostType, typeof POST_TYPE_CFG[PostType]][]).map(([tid, cfg]) => {
                      const ok = allowed.includes(tid);
                      return (
                        <button key={tid} disabled={!ok} onClick={() => ok && setPanelPostType(tid)}
                          title={ok ? undefined : isVid ? t('videoTypeTooltip') : t('photoTypeTooltip')}
                          style={{ flex: 1, padding: "6px 4px", borderRadius: 7, border: `1.5px solid ${panelPostType === tid ? cfg.color : "var(--line)"}`, background: panelPostType === tid ? cfg.bg : "transparent", color: panelPostType === tid ? cfg.color : "var(--ink-3)", fontSize: 12, fontWeight: 700, cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.4, fontFamily: "var(--sans)", transition: "all .15s" }}>
                          {t(cfg.tKey)}
                        </button>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6, display: "block" }}>
                    {isVid ? t('videoTypeHint') : t('photoTypeHint')}
                  </span>
                </div>
              );
            })()}

            {/* ── Tags Instagram ── */}
            <div>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>{t('taggedPeople')}</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={panelTaggedUsers}
                  onChange={e => setPanelTaggedUsers(e.target.value)}
                  placeholder={t('taggedPh')}
                  className="input"
                  style={{ fontSize: 12.5, paddingLeft: 30 }}
                />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", pointerEvents: "none" }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <span style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, display: "block" }}>{t('separateComma')}</span>
            </div>

            {/* ── Note musicale (affichage seul si rempli, éditable) ── */}
            <div>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>{t('musicNote')}</label>
              <MusicPicker value={panelMusicNote} onChange={setPanelMusicNote} />
            </div>

            {/* ── Publier sur ── */}
            {(workspace?.instagram_account_id || workspace?.facebook_page_id) && (
              <div>
                <label className="label" style={{ display: "block", marginBottom: 8 }}>{t('publishOn')}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {workspace?.instagram_account_id && (() => {
                    const active = panelPlatforms.includes("instagram");
                    const onlyOne = !workspace?.facebook_page_id;
                    return (
                      <button onClick={() => { if (onlyOne) return; setPanelPlatforms(prev => active ? prev.filter(p => p !== "instagram") : [...prev, "instagram"]); }}
                        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 8px", borderRadius: 10, border: `2px solid ${active ? "#E1306C" : "var(--line)"}`, background: active ? "#E1306C15" : "transparent", cursor: onlyOne ? "default" : "pointer", transition: "all .15s" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#E1306C" : "#9CA3AF"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill={active ? "#E1306C" : "#9CA3AF"} stroke="none"/></svg>
                        <span style={{ fontSize: 11, fontWeight: 600, color: active ? "#E1306C" : "#9CA3AF", fontFamily: "var(--sans)" }}>{t('instagram')}</span>
                      </button>
                    );
                  })()}
                  {workspace?.facebook_page_id && (() => {
                    const active = panelPlatforms.includes("facebook");
                    const onlyOne = !workspace?.instagram_account_id;
                    return (
                      <button onClick={() => { if (onlyOne) return; setPanelPlatforms(prev => active ? prev.filter(p => p !== "facebook") : [...prev, "facebook"]); }}
                        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 8px", borderRadius: 10, border: `2px solid ${active ? "#1877F2" : "var(--line)"}`, background: active ? "#1877F215" : "transparent", cursor: onlyOne ? "default" : "pointer", transition: "all .15s" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#1877F2" : "#9CA3AF"} xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
                        <span style={{ fontSize: 11, fontWeight: 600, color: active ? "#1877F2" : "#9CA3AF", fontFamily: "var(--sans)" }}>{t('facebook')}</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 7 }}>
              <Link href={isVideoUrl(selectedPost.photo_url) ? `/workspace/${id}/montage/${selectedPost.id}` : `/workspace/${id}/editor/${selectedPost.id}`} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }}>
                <IconEdit /> {isVideoUrl(selectedPost.photo_url) ? t('montageShort') : t('editShort')}
              </Link>
              {!isVideoUrl(selectedPost.photo_url) && (
                <button onClick={() => { setCanvaPostId(selectedPost.id); setShowCanva(true); }} className="btn btn-dark btn-sm" style={{ flex: 1 }}>
                  <IconSpark /> {t('canva')}
                </button>
              )}
            </div>

            <button onClick={() => deletePost(selectedPost)} className="btn btn-ghost btn-sm"
              style={{ color: "var(--warn)", borderColor: "rgba(200,115,43,.3)", width: "100%", justifyContent: "center" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>
              {t('deletePost')}
            </button>
          </div>

          <div style={{ padding: "16px 20px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={handleSchedule} disabled={scheduling || !panelDate} className="btn btn-primary" style={{ width: "100%", padding: "12px", opacity: (scheduling || !panelDate) ? 0.5 : 1 }}>
              <IconCalendar /> {scheduling ? t('scheduling') : t('schedulePost')}
            </button>
            <button onClick={handlePublish} disabled={publishing} className="btn btn-ghost" style={{ width: "100%", opacity: publishing ? 0.5 : 1 }}>
              {publishing ? t('publishing') : t('publishNow')}
            </button>
          </div>
        </div></div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .cal-slot:hover{background:rgba(47,215,155,.04)!important}`}</style>
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function PlanningPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--canvas)", overflow: "hidden" }}>
      <Sidebar />
      <div style={{ marginLeft: "var(--sb-w)", flex: 1, display: "flex", overflow: "hidden" }}>
        <Suspense fallback={
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", border: "2.5px solid var(--mint-soft)", borderTopColor: "var(--mint-2)", display: "inline-block", animation: "spin .7s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}} .cal-slot:hover{background:rgba(47,215,155,.04)!important}`}</style>
          </div>
        }>
          <PlanningContent />
        </Suspense>
      </div>
    </div>
  );
}
