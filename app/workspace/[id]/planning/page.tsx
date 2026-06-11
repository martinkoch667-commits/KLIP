"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  photo_url: string;
  exported_image_url: string | null;
  texte_visuel: string;
  description: string;
  status: string;
  scheduled_at: string | null;
  brief: string;
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

const DAY_NAMES    = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_NAMES  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
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
function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}
function buildScheduledAt(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr || "09:00"}:00`).toISOString();
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

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  scheduled: { label: "Programmé", bg: "var(--mint-soft)",  color: "var(--mint-2)",  dot: "var(--mint-2)"   },
  published:  { label: "Publié",    bg: "var(--mint)",       color: "var(--mint-ink)", dot: "var(--mint-ink)" },
  generated:  { label: "Brouillon", bg: "var(--sunk)",       color: "var(--ink-3)",   dot: "var(--ink-3)"    },
  validated:  { label: "Brouillon", bg: "var(--sunk)",       color: "var(--ink-3)",   dot: "var(--ink-3)"    },
};
function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.generated;
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
      <span className="dot" style={{ background: cfg.dot }} />{cfg.label}
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

// ─── Planning content ─────────────────────────────────────────────────────────

function PlanningContent() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const id           = params.id as string;
  const preSelectedId = searchParams.get("post");
  const supabase     = createClientComponentClient();
  const gridRef      = useRef<HTMLDivElement>(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [workspace,    setWorkspace]    = useState<Workspace | null>(null);
  const [posts,        setPosts]        = useState<Post[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [weekStart,    setWeekStart]    = useState<Date>(() => getMonday(new Date()));
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [draggedId,    setDraggedId]    = useState<string | null>(null);
  const [dragOverDay,  setDragOverDay]  = useState<string | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [panelDate,    setPanelDate]    = useState("");
  const [panelTime,    setPanelTime]    = useState("09:00");
  const [panelDesc,    setPanelDesc]    = useState("");
  const [scheduling,   setScheduling]   = useState(false);
  const [publishing,   setPublishing]   = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);
  const [showIgModal,  setShowIgModal]  = useState(false);
  const [showCanva,    setShowCanva]    = useState(false);
  const [canvaPostId,  setCanvaPostId]  = useState("");
  const [calView,      setCalView]      = useState<"week" | "month">("week");
  const [monthDate,    setMonthDate]    = useState<Date>(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [nowTop,       setNowTop]       = useState(() => new Date().getHours() * HOUR_H + new Date().getMinutes());

  const connected = searchParams.get("connected") === "true";

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const [{ data: ws }, { data: postsData }] = await Promise.all([
      supabase.from("workspaces").select("id, name, primary_color, secondary_color, font_family, instagram_account_id, instagram_username, facebook_page_id").eq("id", id).single(),
      supabase.from("posts")
        .select("id, photo_url, exported_image_url, texte_visuel, description, status, scheduled_at, brief")
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
    await supabase.from("posts").update({ scheduled_at, status: "scheduled" }).eq("id", draggedId);
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
    await supabase.from("posts").update({ scheduled_at, status: "scheduled" }).eq("id", draggedId);
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
    await supabase.from("posts").update({ scheduled_at, description: panelDesc, status: "scheduled" }).eq("id", selectedPost.id);
    setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, scheduled_at, description: panelDesc, status: "scheduled" } : p));
    setScheduling(false); setSelectedPost(null);
    showToast("Post programmé ✓");
  }

  async function deletePost(post: Post) {
    if (!confirm("Supprimer ce post ? Cette action est irréversible.")) return;
    await supabase.from("posts").delete().eq("id", post.id);
    setPosts(prev => prev.filter(p => p.id !== post.id));
    setSelectedPost(null);
  }

  async function handlePublish() {
    if (!selectedPost) return;
    const isConnected = !!(workspace?.instagram_account_id || workspace?.instagram_username);
    if (!isConnected) { setShowIgModal(true); return; }
    setPublishing(true);
    if (panelDesc !== selectedPost.description) {
      await supabase.from("posts").update({ description: panelDesc }).eq("id", selectedPost.id);
    }
    const res  = await fetch("/api/publish/instagram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: selectedPost.id, workspaceId: id }) });
    const data = await res.json();
    setPublishing(false); setSelectedPost(null);
    if (res.ok) {
      setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, status: "published", description: panelDesc } : p));
      showToast("Publié sur Instagram ✓");
    } else {
      showToast(data?.error === "Compte Instagram non connecté" ? "Erreur — compte non connecté" : `Erreur — ${data?.error ?? "publication échouée"}`, false);
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
    <div style={{ flex: 1, display: "flex", minWidth: 0, overflow: "hidden", position: "relative" }}>

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
            <h2 className="h-title" style={{ fontSize: 18, marginBottom: 8 }}>Instagram non connecté</h2>
            <p style={{ color: "var(--ink-2)", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>Connectez d&apos;abord le compte Instagram de ce client pour publier depuis Klip.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowIgModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Annuler</button>
              <Link href={`/workspace/${id}/parametres`} className="btn btn-dark" style={{ flex: 1, textAlign: "center" }}>Connecter Instagram</Link>
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
              <span style={{ color: "var(--cream-3)", fontSize: 14 }}>× Canva Editor</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label className="btn btn-primary btn-sm" style={{ cursor: "pointer" }}>
                Uploader le PNG
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
              <button onClick={() => setShowCanva(false)} className="btn btn-ghost btn-sm" style={{ color: "var(--cream)" }}>Fermer</button>
            </div>
          </div>
          <iframe src="https://www.canva.com/_partnership/embed?action=createDesign&type=InstagramPost&fileType=png&supportDesignButtonErrorPage=false&apiMode=button&embed" style={{ flex: 1, width: "100%", border: "none" }} allow="fullscreen" title="Canva Editor" />
        </div>
      )}

      {/* ── Main area ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => calView === "week" ? setWeekStart(w => addDays(w, -7)) : prevMonth()} className="btn btn-ghost btn-icon"><IconChevL /></button>
            <h1 style={{ fontSize: 15, fontFamily: "'Archivo', var(--display)", fontWeight: 700, letterSpacing: "-0.02em", textTransform: "capitalize", whiteSpace: "nowrap", color: "var(--ink)" }}>
              {calView === "week" ? formatMonthYear(weekStart) : `${MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()}`}
            </h1>
            <button onClick={() => calView === "week" ? setWeekStart(w => addDays(w, 7)) : nextMonth()} className="btn btn-ghost btn-icon"><IconChevR /></button>
            {calView === "week" && !isCurrentWeek && (
              <button onClick={() => setWeekStart(getMonday(new Date()))} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "4px 10px" }}>Aujourd&apos;hui</button>
            )}
          </div>

          {/* Segmented toggle */}
          <div style={{ display: "flex", background: "rgba(13,15,10,.07)", borderRadius: 9, padding: 3, gap: 2 }}>
            {(["week","month"] as const).map(v => (
              <button key={v} onClick={() => setCalView(v)}
                style={{ padding: "5px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, letterSpacing: "0.01em", transition: "all .15s",
                  background: calView === v ? "var(--white)" : "transparent",
                  color: calView === v ? "var(--ink)" : "var(--ink-3)",
                  boxShadow: calView === v ? "0 1px 4px rgba(13,15,10,.14), 0 0 0 .5px rgba(13,15,10,.06)" : "none" }}>
                {v === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <Link href={`/workspace/${id}`} className="btn btn-primary btn-sm" style={{ background: "#2FD79B", color: "#0D2E1C", fontWeight: 700, gap: 6 }}><IconPlus /> Nouveau post</Link>
          </div>
        </header>

        {/* Instagram connected banner */}
        {connected && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 26px", background: "var(--mint-soft)", borderBottom: "1px solid var(--mint-soft)", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--mint-2)" strokeWidth="1.5"/><path d="M5 8l2.5 2.5 4-4" stroke="var(--mint-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--mint-2)" }}>Compte Instagram connecté avec succès.</p>
          </div>
        )}

        {/* ─── WEEK VIEW ───────────────────────────────────────────────────── */}
        {calView === "week" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: "calc(100vh - 64px)" }}>

            {/* Single scrollable area — day headers sticky at top inside it */}
            <div ref={gridRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", position: "relative", background: "var(--canvas)" }}>

              {/* Sticky day-header row */}
              <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7,1fr)", position: "sticky", top: 0, zIndex: 10, background: "var(--canvas)", borderBottom: `1px solid rgba(13,15,10,.08)`, boxShadow: "0 1px 0 rgba(13,15,10,.04)" }}>
                {/* Corner cell */}
                <div style={{ borderRight: `1px solid rgba(13,15,10,.08)`, background: "var(--canvas)" }} />
                {weekDays.map((day, i) => {
                  const isToday = isSameDay(day, today);
                  return (
                    <div key={i} style={{ padding: "11px 14px 10px", borderRight: i < 6 ? `1px solid rgba(13,15,10,.08)` : "none", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--ink-3)" }}>{DAY_NAMES[i]}</span>
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
              <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7,1fr)" }}>

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
                        const blockH     = Math.max(HOUR_H - 4, 44); // min 1 slot height
                        const isSelected = selectedPost?.id === post.id;
                        const rawImg     = post.exported_image_url || post.photo_url;
                        const thumbSrc   = rawImg ? `/api/proxy-image?url=${encodeURIComponent(rawImg)}` : null;
                        const initials   = (workspace?.name ?? "??").slice(0, 2).toUpperCase();
                        return (
                          <div key={post.id}
                            draggable
                            onDragStart={e => { e.stopPropagation(); setDraggedId(post.id); }}
                            onDragEnd={() => { setDraggedId(null); setDragOverDay(null); setDragOverHour(null); }}
                            onClick={e => { e.stopPropagation(); selectPost(post); }}
                            style={{
                              position: "absolute", top: topPx + 2, left: 4, right: 4,
                              height: blockH, borderRadius: 6,
                              padding: "0 8px 0 0",
                              background: `${chipColor}26`,
                              borderLeft: `3px solid ${chipColor}`,
                              color: "var(--ink)",
                              fontFamily: "var(--sans)", fontSize: 11,
                              cursor: "pointer", zIndex: 2,
                              boxShadow: isSelected ? `0 0 0 2px ${chipColor}, 0 2px 8px rgba(0,0,0,.10)` : "0 1px 3px rgba(13,15,10,.08)",
                              opacity: draggedId === post.id ? 0.35 : 1,
                              overflow: "hidden", userSelect: "none",
                              display: "flex", alignItems: "center", gap: 7,
                              transition: "box-shadow .12s, opacity .12s",
                            }}
                          >
                            {/* 28×28 thumbnail */}
                            <div style={{ width: 28, height: 28, flexShrink: 0, overflow: "hidden", borderRadius: 4, marginLeft: 5 }}>
                              {thumbSrc ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumbSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                              ) : (
                                <div style={{ width: "100%", height: "100%", background: chipColor, display: "grid", placeItems: "center" }}>
                                  <span style={{ fontSize: 8, fontWeight: 800, color: "#fff", fontFamily: "var(--sans)" }}>{initials}</span>
                                </div>
                              )}
                            </div>
                            {/* Text */}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.25, color: "var(--ink)" }}>
                                {post.texte_visuel || "Post"}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 500, lineHeight: 1 }}>{formatTime(post.scheduled_at)}</div>
                            </div>
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
                    {(post.exported_image_url || post.photo_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.exported_image_url || post.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
              {DAY_NAMES.map(d => (
                <div key={d} style={{ padding: "11px 0 9px", textAlign: "center", fontFamily: "var(--display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--ink-3)" }}>{d}</div>
              ))}
            </div>
            {/* Month grid */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: "minmax(90px, 1fr)" }}>
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
                          const rawImg  = post.exported_image_url || post.photo_url;
                          const thumb   = rawImg ? `/api/proxy-image?url=${encodeURIComponent(rawImg)}` : null;
                          return (
                          <div key={post.id}
                            draggable
                            onDragStart={e => { e.stopPropagation(); setDraggedId(post.id); }}
                            onDragEnd={() => { setDraggedId(null); setDragOverDay(null); }}
                            onClick={e => { e.stopPropagation(); selectPost(post); }}
                            style={{ borderRadius: 4, padding: "2px 5px 2px 0", background: `${chipColor}22`, borderLeft: `3px solid ${chipColor}`, color: "var(--ink)", fontFamily: "var(--sans)", fontSize: 10, fontWeight: 500, overflow: "hidden", whiteSpace: "nowrap", cursor: "pointer", opacity: draggedId === post.id ? 0.35 : 1, display: "flex", alignItems: "center", gap: 4 }}>
                            {/* Mini thumb */}
                            <div style={{ width: 14, height: 14, borderRadius: 2, overflow: "hidden", flexShrink: 0, marginLeft: 3 }}>
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                              ) : (
                                <div style={{ width: "100%", height: "100%", background: chipColor }} />
                              )}
                            </div>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                              {formatTime(post.scheduled_at)} {post.texte_visuel || "Post"}
                            </span>
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
                <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-3)", flexShrink: 0 }}>Non programmés — glisse sur une date</span>
                {unscheduled.map(post => (
                  <div key={post.id} draggable
                    onDragStart={() => setDraggedId(post.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverDay(null); }}
                    onClick={() => selectPost(post)}
                    style={{ flexShrink: 0, width: 56, height: 68, borderRadius: 8, overflow: "hidden", cursor: "pointer", opacity: draggedId === post.id ? 0.35 : 1, boxShadow: selectedPost?.id === post.id ? `0 0 0 2.5px ${chipColor}` : "0 1px 4px rgba(13,15,10,.12)", userSelect: "none", background: "var(--white)" }}>
                    {(post.exported_image_url || post.photo_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.exported_image_url || post.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: chipColor, display: "grid", placeItems: "center" }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>Post</span>
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
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────────── */}
      {selectedPost && (
        <div style={{ width: 300, flexShrink: 0, borderLeft: "1px solid var(--line)", background: "var(--white)", display: "flex", flexDirection: "column", overflowY: "auto", boxShadow: "-4px 0 20px rgba(13,15,10,.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
            <span className="h-title" style={{ fontSize: 15 }}>Programmer</span>
            <button onClick={() => setSelectedPost(null)} className="btn btn-ghost btn-icon"><IconClose /></button>
          </div>

          <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            {(selectedPost.exported_image_url || selectedPost.photo_url) && (
              <div style={{ position: "relative", width: "100%", aspectRatio: "4/5", borderRadius: "var(--r)", overflow: "hidden" }}>
                {selectedPost.exported_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedPost.exported_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedPost.photo_url || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {selectedPost.texte_visuel && (
                      <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, background: workspace?.primary_color ?? "#0038FF", color: workspace?.secondary_color ?? "#FFFFFF", fontFamily: workspace?.font_family ? `"${workspace.font_family}", sans-serif` : "Oswald, sans-serif", fontWeight: "bold", fontSize: 14, padding: "6px 12px", borderRadius: 4, textTransform: "uppercase", maxWidth: "80%" }}>
                        {selectedPost.texte_visuel}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>Description Instagram</label>
              <textarea value={panelDesc} onChange={e => setPanelDesc(e.target.value)} rows={4} className="input" style={{ resize: "none", fontSize: 12.5, color: "var(--ink-2)" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 6 }}>Date</label>
                <input type="date" value={panelDate} onChange={e => setPanelDate(e.target.value)} className="input" style={{ height: 40, fontSize: 12.5 }} />
              </div>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 6 }}>Heure</label>
                <input type="time" value={panelTime} onChange={e => setPanelTime(e.target.value)} className="input" style={{ height: 40, fontSize: 12.5 }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 7 }}>
              <Link href={`/workspace/${id}/editor/${selectedPost.id}`} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }}>
                <IconEdit /> Éditer
              </Link>
              <button onClick={() => { setCanvaPostId(selectedPost.id); setShowCanva(true); }} className="btn btn-dark btn-sm" style={{ flex: 1 }}>
                <IconSpark /> Canva
              </button>
            </div>

            <button onClick={() => deletePost(selectedPost)} className="btn btn-ghost btn-sm"
              style={{ color: "var(--warn)", borderColor: "rgba(200,115,43,.3)", width: "100%", justifyContent: "center" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>
              Supprimer ce post
            </button>
          </div>

          <div style={{ padding: "16px 20px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={handleSchedule} disabled={scheduling || !panelDate} className="btn btn-primary" style={{ width: "100%", padding: "12px", opacity: (scheduling || !panelDate) ? 0.5 : 1 }}>
              <IconCalendar /> {scheduling ? "Programmation…" : "Programmer ce post"}
            </button>
            <button onClick={handlePublish} disabled={publishing} className="btn btn-ghost" style={{ width: "100%", opacity: publishing ? 0.5 : 1 }}>
              {publishing ? "Publication…" : "Publier maintenant"}
            </button>
          </div>
        </div>
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
