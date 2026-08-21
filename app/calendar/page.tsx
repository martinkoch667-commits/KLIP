"use client";

// Calendrier « tous les clients ». Reprend la grille du planning d'un client
// (créneaux horaires, teinte d'affluence, glisser-déposer pour programmer) mais
// à l'échelle de l'agence : chaque client a sa couleur, un filtre en haut permet
// de n'en regarder qu'un. L'ancienne version n'affichait qu'une grille sans
// information ni action : on ne pouvait rien y faire.

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import PostPreviewPane from "@/components/PostPreviewPane";
import DateField from "@/components/DateField";
import TimeField from "@/components/TimeField";
import {
  HOUR_H, HOURS, getMonday, addDays, isSameDay, toDateInput, toTimeInput,
  buildScheduledAt, slotHeat, wsColor,
} from "@/lib/calendar";

interface Workspace {
  id: string;
  name: string;
  instagram_username?: string | null;
  logo_url?: string | null;
}
interface Post {
  id: string;
  workspace_id: string;
  scheduled_at: string | null;
  exported_image_url: string | null;
  thumbnail_url?: string | null;
  photo_url: string | null;
  description: string | null;
  texte_visuel?: string | null;
  post_type: string | null;
  status: string;
}

function localizedMonthNames(locale: string): string[] {
  const f = new Intl.DateTimeFormat(locale, { month: "long" });
  return Array.from({ length: 12 }, (_, m) => {
    const s = f.format(new Date(2021, m, 1));
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
}
function localizedDayNamesShort(locale: string): string[] {
  const f = new Intl.DateTimeFormat(locale, { weekday: "short" });
  return Array.from({ length: 7 }, (_, i) => {
    const s = f.format(new Date(2024, 0, 1 + i));
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
}

export default function CalendarPage() {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [calView, setCalView] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [monthDate, setMonthDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [selected, setSelected] = useState<Post | null>(null);
  const [panelDate, setPanelDate] = useState("");
  const [panelTime, setPanelTime] = useState("09:00");
  const [panelCaption, setPanelCaption] = useState("");
  const [saving, setSaving] = useState(false);

  const MONTH_NAMES = localizedMonthNames(locale);
  const DAY_NAMES = localizedDayNamesShort(locale);
  const today = new Date();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const [{ data: ws }, { data: ps }] = await Promise.all([
        supabase.from("workspaces").select("id,name,instagram_username,logo_url").order("created_at"),
        supabase
          .from("posts")
          .select("id,workspace_id,scheduled_at,exported_image_url,thumbnail_url,photo_url,description,texte_visuel,post_type,status")
          .order("scheduled_at", { nullsFirst: false }),
      ]);
      setWorkspaces(ws ?? []);
      setPosts(ps ?? []);
      setLoading(false);
    })();
  }, [supabase, router]);

  // Couleur + nom par client, une fois pour toutes.
  const wsMap = useMemo(() => Object.fromEntries(
    workspaces.map((w, i) => [w.id, { ...w, color: wsColor(i) }])
  ) as Record<string, Workspace & { color: string }>, [workspaces]);

  // Cette page est la vue d'ensemble, et rien d'autre : choisir un client
  // ouvre SON calendrier, celui qui porte la validation, le lien de partage et
  // les meilleurs horaires. Deux calendriers qui se ressemblaient à moitié,
  // avec un renvoi de l'un vers l'autre au milieu d'un filtre, faisaient perdre
  // pied (retour Martin).
  const visible = posts;

  const scheduled = visible.filter(p => p.scheduled_at && p.status !== "published");
  const published = visible.filter(p => p.status === "published");
  // Prêts mais sans date : c'est la pile qu'on vient déposer sur la grille.
  const unscheduled = visible.filter(p => !p.scheduled_at && (p.status === "generated" || p.status === "validated"));

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 7);
  const thisWeekCount = scheduled.filter(p => {
    const d = new Date(p.scheduled_at!);
    return d >= weekStart && d < weekEnd;
  }).length;

  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstDow = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const monthCells = Array.from({ length: Math.ceil((firstDow + daysInMonth) / 7) * 7 }, (_, i) => {
    const offset = i - firstDow;
    return offset < 0 || offset >= daysInMonth ? null : new Date(monthDate.getFullYear(), monthDate.getMonth(), offset + 1);
  });

  const postsForDay = (day: Date) =>
    scheduled
      .filter(p => isSameDay(new Date(p.scheduled_at!), day))
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());

  const nowTop = today.getHours() * HOUR_H + Math.round((today.getMinutes() * HOUR_H) / 60);

  function navWeek(dir: number) { setWeekStart(getMonday(addDays(weekStart, 7 * dir))); }
  function navMonth(dir: number) { const d = new Date(monthDate); d.setMonth(d.getMonth() + dir); d.setDate(1); setMonthDate(d); }

  function selectPost(p: Post) {
    setSelected(p);
    setPanelCaption(p.description ?? "");
    const d = p.scheduled_at ? new Date(p.scheduled_at) : new Date();
    setPanelDate(toDateInput(d));
    setPanelTime(p.scheduled_at ? toTimeInput(d) : "09:00");
  }

  // Déposer un post sur un créneau = le programmer là. Même geste que sur le
  // calendrier d'un client, mais tous clients confondus.
  async function scheduleAt(postId: string, date: Date, hour?: number) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const time = hour !== undefined
      ? `${String(hour).padStart(2, "0")}:00`
      : post.scheduled_at ? toTimeInput(new Date(post.scheduled_at)) : "09:00";
    const scheduled_at = buildScheduledAt(toDateInput(date), time);
    if (!scheduled_at) return;
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, scheduled_at, status: "scheduled" } : p)));
    setSelected(prev => (prev?.id === postId ? { ...prev, scheduled_at, status: "scheduled" } : prev));
    await supabase.from("posts").update({ scheduled_at, status: "scheduled" }).eq("id", postId);
  }

  async function savePanel() {
    if (!selected) return;
    setSaving(true);
    const scheduled_at = buildScheduledAt(panelDate, panelTime);
    const patch: Record<string, unknown> = { description: panelCaption };
    if (scheduled_at) { patch.scheduled_at = scheduled_at; patch.status = "scheduled"; }
    await supabase.from("posts").update(patch).eq("id", selected.id);
    setPosts(prev => prev.map(p => (p.id === selected.id
      ? { ...p, description: panelCaption, ...(scheduled_at ? { scheduled_at, status: "scheduled" } : {}) }
      : p)));
    setSaving(false);
    setSelected(null);
  }

  // ── Vignette d'un post dans la grille ──────────────────────────────────────
  function PostBlock({ p, style, compact = false }: { p: Post; style?: React.CSSProperties; compact?: boolean }) {
    const ws = wsMap[p.workspace_id];
    const raw = p.exported_image_url || p.thumbnail_url || p.photo_url;
    const thumb = raw ? `/api/proxy-image?url=${encodeURIComponent(raw)}` : null;
    const isPub = p.status === "published";
    const time = p.scheduled_at ? new Date(p.scheduled_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : null;
    return (
      <div
        draggable
        onDragStart={e => { e.stopPropagation(); setDraggedId(p.id); }}
        onDragEnd={() => { setDraggedId(null); setDragOver(null); }}
        onClick={e => { e.stopPropagation(); selectPost(p); }}
        title={`${ws?.name ?? ""} · ${p.texte_visuel || p.description || ""}`}
        style={{
          display: "flex", alignItems: "center", gap: 7, overflow: "hidden",
          background: isPub ? "var(--mint-soft)" : "var(--white)",
          borderLeft: `3px solid ${ws?.color ?? "var(--vio)"}`,
          borderRadius: 8, padding: compact ? "3px 6px 3px 0" : "0 8px 0 0",
          boxShadow: selected?.id === p.id ? `0 0 0 2px ${ws?.color ?? "var(--vio)"}, var(--shadow-card)` : "inset 0 0 0 1px var(--line)",
          opacity: draggedId === p.id ? 0.35 : 1,
          cursor: "grab", userSelect: "none", ...style,
        }}
      >
        {thumb && (
          <div style={{ width: compact ? 18 : 30, height: compact ? 22 : 36, flexShrink: 0, overflow: "hidden", borderRadius: 5, marginLeft: compact ? 5 : 6 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: compact ? 10 : 11.5, fontWeight: 800, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ws?.name ?? t("clientFallback")}
          </div>
          {!compact && (
            <div style={{ fontSize: 10.5, color: "var(--ink-3)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {time} · {p.texte_visuel || p.description || t("clientFallback")}
            </div>
          )}
        </div>
      </div>
    );
  }

  const statTiles = [
    { label: t("scheduled"), n: scheduled.length, color: "var(--vio)" },
    { label: t("thisWeek"), n: thisWeekCount, color: "var(--mint-2)" },
    { label: t("published"), n: published.length, color: "var(--ink-2)" },
    { label: t("drafts"), n: unscheduled.length, color: "var(--warn)" },
  ];

  return (
    <div className="app">
      <Sidebar />
      <div className="work">
        <div className="topbar" style={{ justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{t("title")}</h1>
          <div className="ws-topbar-link" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="seg">
              {(["week", "month"] as const).map(v => (
                <button key={v} onClick={() => setCalView(v)} className={calView === v ? "on" : ""}>
                  {v === "week" ? t("week") : t("month")}
                </button>
              ))}
            </div>
            <button onClick={() => (calView === "week" ? navWeek(-1) : navMonth(-1))} className="btn btn-ghost btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 170, textAlign: "center" }}>
              {calView === "week"
                ? `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${MONTH_NAMES[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`
                : `${MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()}`}
            </span>
            <button onClick={() => (calView === "week" ? navWeek(1) : navMonth(1))} className="btn btn-ghost btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
            <button
              onClick={() => { setWeekStart(getMonday(new Date())); setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1)); }}
              className="btn btn-ghost btn-sm"
            >
              {t("today")}
            </button>
          </div>
        </div>

        <div className="scroll">
          <div style={{ padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Vos clients — « Tous les clients » dit où l'on est, chaque client
                est une porte vers SON calendrier. Le chevron annonce qu'on
                quitte la page : un filtre qui déménageait sans prévenir, c'était
                le contraire d'une promesse tenue. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, background: 'var(--sunk)', borderRadius: 'var(--r-l)', overflowX: 'auto' }}>
              <span
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
                  padding: '7px 13px', borderRadius: 'var(--r)',
                  fontSize: 12.5, fontWeight: 800, color: 'var(--ink)',
                  background: 'var(--white)', boxShadow: 'var(--shadow-card)',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink)', flexShrink: 0 }} />
                {t('allClients')}
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-3)' }}>{posts.length}</span>
              </span>

              {workspaces.map(w => (
                <Link
                  key={w.id}
                  href={`/workspace/${w.id}/planning`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
                    padding: '7px 11px 7px 13px', borderRadius: 'var(--r)',
                    fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)',
                    textDecoration: 'none', transition: 'background .14s, color .14s',
                  }}
                  className="cal-client-link"
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: wsMap[w.id]?.color, flexShrink: 0 }} />
                  {w.name}
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-3)' }}>
                    {posts.filter(p => p.workspace_id === w.id).length}
                  </span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .5 }}>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              ))}
            </div>

            {/* Chiffres du périmètre affiché */}
            <div className="dash-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {statTiles.map(s => (
                <div key={s.label} className="card card-hover" style={{ padding: "14px 16px" }}>
                  <div className="num" style={{ fontSize: 28, lineHeight: 1, color: s.color }}>{s.n}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Pile à programmer — on la glisse sur la grille */}
            {unscheduled.length > 0 && (
              <div className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, overflowX: "auto" }}>
                <span className="label" style={{ flexShrink: 0 }}>{t("unscheduled")} · {unscheduled.length}</span>
                {unscheduled.map(p => (
                  <PostBlock key={p.id} p={p} compact style={{ flexShrink: 0, maxWidth: 190, height: 30 }} />
                ))}
              </div>
            )}

            {loading ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>…</div>
            ) : calView === "week" ? (
              <div className="card" style={{ overflow: "hidden" }}>
                {/* En-têtes de jours */}
                <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7,1fr)", borderBottom: "1px solid var(--line)", background: "var(--sunk)" }}>
                  <div />
                  {weekDays.map(d => {
                    const isToday = isSameDay(d, today);
                    const n = postsForDay(d).length;
                    return (
                      <div key={toDateInput(d)} style={{ padding: "9px 8px", textAlign: "center", borderLeft: "1px solid var(--line)" }}>
                        <div className="label" style={{ marginBottom: 4 }}>{DAY_NAMES[(d.getDay() + 6) % 7]}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          <span style={{ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13.5, background: isToday ? "var(--leaf)" : "transparent", color: isToday ? "var(--leaf-ink)" : "var(--ink)" }}>
                            {d.getDate()}
                          </span>
                          {n > 0 && <span style={{ fontSize: 10, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--mint-2)", background: "var(--mint-soft)", borderRadius: 99, padding: "1px 6px" }}>{n}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Corps : 24 créneaux par jour */}
                <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7,1fr)", maxHeight: "62vh", overflowY: "auto" }}>
                  <div style={{ borderRight: "1px solid var(--line)" }}>
                    {HOURS.map(h => (
                      <div key={h} style={{ height: HOUR_H, boxSizing: "border-box", display: "flex", justifyContent: "flex-end", paddingRight: 9, paddingTop: 4, fontSize: 11, color: "var(--ink-3)", borderBottom: "1px solid var(--line-2)" }}>
                        {h === 0 ? "" : `${String(h).padStart(2, "0")}h`}
                      </div>
                    ))}
                  </div>
                  {weekDays.map((day, di) => {
                    const dayKey = toDateInput(day);
                    const dayPosts = postsForDay(day);
                    return (
                      <div key={dayKey} style={{ position: "relative", borderLeft: di === 0 ? "none" : "1px solid var(--line-2)" }}>
                        {HOURS.map(h => {
                          const key = `${dayKey}-${h}`;
                          const heat = slotHeat(day.getDay(), h);
                          return (
                            <div
                              key={h}
                              className="cal-slot"
                              style={{
                                height: HOUR_H, boxSizing: "border-box", borderBottom: "1px solid var(--line-2)",
                                background: dragOver === key ? "rgba(47,215,155,.18)" : `rgba(102,86,217,${(heat * 0.13).toFixed(3)})`,
                                transition: "background .1s",
                              }}
                              onDragOver={e => { e.preventDefault(); setDragOver(key); }}
                              onDragLeave={() => setDragOver(null)}
                              onDrop={() => { if (draggedId) { void scheduleAt(draggedId, day, h); } setDraggedId(null); setDragOver(null); }}
                            />
                          );
                        })}
                        {isSameDay(day, today) && (
                          <div style={{ position: "absolute", top: nowTop, left: 0, right: 0, height: 2, background: "var(--mint)", zIndex: 4, pointerEvents: "none" }}>
                            <div style={{ position: "absolute", left: -4, top: -3, width: 8, height: 8, borderRadius: "50%", background: "var(--mint)" }} />
                          </div>
                        )}
                        {dayPosts.map(p => {
                          const d = new Date(p.scheduled_at!);
                          const top = d.getHours() * HOUR_H + Math.round((d.getMinutes() * HOUR_H) / 60);
                          return (
                            <PostBlock
                              key={p.id}
                              p={p}
                              style={{ position: "absolute", top: top + 2, left: 4, right: 4, height: HOUR_H - 6, zIndex: 2 }}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="card" style={{ overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid var(--line)", background: "var(--sunk)" }}>
                  {DAY_NAMES.map(d => <div key={d} className="label" style={{ padding: "10px 0", textAlign: "center" }}>{d}</div>)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
                  {monthCells.map((d, i) => {
                    if (!d) return <div key={i} style={{ minHeight: 108, borderRight: "1px solid var(--line-2)", borderBottom: "1px solid var(--line-2)", background: "var(--sunk)", opacity: .5 }} />;
                    const dayKey = toDateInput(d);
                    const dayPosts = postsForDay(d);
                    const isToday = isSameDay(d, today);
                    return (
                      <div
                        key={dayKey}
                        onDragOver={e => { e.preventDefault(); setDragOver(dayKey); }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={() => { if (draggedId) { void scheduleAt(draggedId, d); } setDraggedId(null); setDragOver(null); }}
                        style={{
                          minHeight: 108, borderRight: "1px solid var(--line-2)", borderBottom: "1px solid var(--line-2)",
                          padding: "6px 7px", display: "flex", flexDirection: "column", gap: 3,
                          background: dragOver === dayKey ? "rgba(47,215,155,.14)" : "transparent",
                          boxShadow: isToday ? "inset 0 0 0 2px var(--leaf)" : "none",
                        }}
                      >
                        <span style={{ width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, background: isToday ? "var(--leaf)" : "transparent", color: isToday ? "var(--leaf-ink)" : "var(--ink)" }}>
                          {d.getDate()}
                        </span>
                        {dayPosts.slice(0, 3).map(p => <PostBlock key={p.id} p={p} compact style={{ height: 26 }} />)}
                        {dayPosts.length > 3 && <span style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 700 }}>+{dayPosts.length - 3}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p style={{ fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l4-4 4 4M9 5v14M19 15l-4 4-4-4M15 5v14" /></svg>
              {t("dragHint")}
            </p>

            {!loading && posts.length === 0 && (
              <div className="card" style={{ padding: "28px 32px", display: "flex", alignItems: "center", gap: 24 }}>
                <div style={{ flex: 1 }}>
                  <h2 className="h-title" style={{ fontSize: 18, marginBottom: 4 }}>{t("emptyTitle")}</h2>
                  <p style={{ fontSize: 13, color: "var(--ink-3)" }}>{t("emptyText")}</p>
                </div>
                <Link href="/composer" className="btn btn-primary" style={{ flexShrink: 0 }}>{t("createPost")}</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Volet de détail — on voit le rendu et on ajuste sans quitter la vue */}
      {selected && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(13,15,10,.45)", display: "flex", justifyContent: "flex-end" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="card"
            style={{ width: 460, maxWidth: "94vw", height: "100%", borderRadius: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
              <span className="h-title" style={{ fontSize: 15 }}>{t("detailTitle")}</span>
              <button onClick={() => setSelected(null)} className="btn btn-ghost btn-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: wsMap[selected.workspace_id]?.color }} />
                <span style={{ fontWeight: 800, fontSize: 14 }}>{wsMap[selected.workspace_id]?.name}</span>
              </div>

              <PostPreviewPane
                workspace={wsMap[selected.workspace_id] ?? null}
                mediaUrl={selected.exported_image_url || selected.photo_url}
                posterUrl={selected.thumbnail_url}
                caption={panelCaption}
                postType={selected.post_type}
                platforms={["instagram"]}
                mediaHeight="min(38vh, 380px)"
              />

              <div>
                <label className="label" style={{ display: "block", marginBottom: 6 }}>{t("dateTime")}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <DateField value={panelDate} onChange={setPanelDate} />
                  <TimeField value={panelTime} onChange={setPanelTime} style={{ maxWidth: 130 }} />
                </div>
              </div>

              <div>
                <label className="label" style={{ display: "block", marginBottom: 6 }}>{t("caption")}</label>
                <textarea value={panelCaption} onChange={e => setPanelCaption(e.target.value)} className="input" rows={5} style={{ resize: "vertical", lineHeight: 1.5 }} />
              </div>
            </div>

            <div style={{ padding: "14px 18px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={savePanel} disabled={saving} className="btn btn-primary" style={{ width: "100%", opacity: saving ? .5 : 1 }}>
                {saving ? "…" : t("save")}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href={`/workspace/${selected.workspace_id}/editor/${selected.id}`} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }}>
                  {t("editPost")}
                </Link>
                <Link href={`/workspace/${selected.workspace_id}/planning`} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }}>
                  {t("openClient")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`.cal-slot:hover{background:rgba(47,215,155,.06)!important}`}</style>
    </div>
  );
}
