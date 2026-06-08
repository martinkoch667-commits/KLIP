"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
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
  instagram_access_token: string | null;
  instagram_username: string | null;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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
function toDateInput(date: Date): string { return date.toISOString().slice(0, 10); }
function formatShortDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}
function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function buildScheduledAt(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr || "09:00"}:00`).toISOString();
}

// ─── Status chip ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  scheduled: { label: "Programmé", bg: "var(--mint-soft)",  color: "var(--mint-2)",  dot: "var(--mint-2)" },
  published:  { label: "Publié",    bg: "var(--mint)",       color: "var(--mint-ink)", dot: "var(--mint-ink)" },
  generated:  { label: "Brouillon", bg: "var(--sunk)",       color: "var(--ink-3)",   dot: "var(--ink-3)" },
  validated:  { label: "Brouillon", bg: "var(--sunk)",       color: "var(--ink-3)",   dot: "var(--ink-3)" },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.generated;
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
      <span className="dot" style={{ background: cfg.dot }} />
      {cfg.label}
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
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const preSelectedId = searchParams.get("post");
  const supabase = createClientComponentClient();

  const [workspace, setWorkspace]       = useState<Workspace | null>(null);
  const [posts, setPosts]               = useState<Post[]>([]);
  const [loading, setLoading]           = useState(true);
  const [weekStart, setWeekStart]       = useState<Date>(() => getMonday(new Date()));
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [draggedId, setDraggedId]       = useState<string | null>(null);
  const [dragOverDay, setDragOverDay]   = useState<string | null>(null);

  const [panelDate, setPanelDate] = useState("");
  const [panelTime, setPanelTime] = useState("09:00");
  const [panelDesc, setPanelDesc] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showIgModal, setShowIgModal] = useState(false);
  const [showCanva, setShowCanva] = useState(false);
  const [canvaPostId, setCanvaPostId] = useState('');

  const connected = searchParams.get("connected") === "true";

  const loadData = useCallback(async () => {
    const [{ data: ws }, { data: postsData }] = await Promise.all([
      supabase.from("workspaces").select("id, name, primary_color, secondary_color, font_family, instagram_account_id, instagram_access_token, instagram_username").eq("id", id).single(),
      supabase.from("posts").select("id, photo_url, exported_image_url, texte_visuel, description, status, scheduled_at, brief").eq("workspace_id", id).in("status", ["generated", "validated", "scheduled", "published"]).order("scheduled_at", { ascending: true }),
    ]);
    if (ws) setWorkspace(ws);
    if (postsData) setPosts(postsData);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!preSelectedId || posts.length === 0) return;
    const post = posts.find((p) => p.id === preSelectedId);
    if (post) selectPost(post);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectedId, posts]);

  function selectPost(post: Post) {
    setSelectedPost(post);
    setPanelDesc(post.description ?? "");
    if (post.scheduled_at) {
      const d = new Date(post.scheduled_at);
      setPanelDate(toDateInput(d));
      setPanelTime(d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", ":"));
    } else {
      setPanelDate(toDateInput(new Date()));
      setPanelTime("09:00");
    }
  }

  async function handleDrop(day: Date) {
    if (!draggedId) return;
    setDragOverDay(null);
    const post = posts.find((p) => p.id === draggedId);
    if (!post) return;
    let time = "09:00";
    if (post.scheduled_at) {
      const d = new Date(post.scheduled_at);
      time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    const scheduled_at = buildScheduledAt(toDateInput(day), time);
    await supabase.from("posts").update({ scheduled_at, status: "scheduled" }).eq("id", draggedId);
    setPosts((prev) => prev.map((p) => p.id === draggedId ? { ...p, scheduled_at, status: "scheduled" } : p));
    if (selectedPost?.id === draggedId) { setSelectedPost((prev) => prev ? { ...prev, scheduled_at, status: "scheduled" } : null); setPanelDate(toDateInput(day)); }
    setDraggedId(null);
  }

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); }

  async function handleSchedule() {
    if (!selectedPost || !panelDate) return;
    setScheduling(true);
    const scheduled_at = buildScheduledAt(panelDate, panelTime);
    await supabase.from("posts").update({ scheduled_at, description: panelDesc, status: "scheduled" }).eq("id", selectedPost.id);
    setPosts((prev) => prev.map((p) => p.id === selectedPost.id ? { ...p, scheduled_at, description: panelDesc, status: "scheduled" } : p));
    setScheduling(false);
    setSelectedPost(null);
    showToast("Post programmé ✓");
  }

  async function handlePublish() {
    if (!selectedPost) return;
    const isConnected = !!(workspace?.instagram_account_id || workspace?.instagram_access_token || workspace?.instagram_username);
    if (!isConnected) { setShowIgModal(true); return; }
    setPublishing(true);
    if (panelDesc !== selectedPost.description) {
      await supabase.from("posts").update({ description: panelDesc }).eq("id", selectedPost.id);
    }
    const res = await fetch("/api/publish/instagram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: selectedPost.id, workspaceId: id }) });
    const data = await res.json();
    setPublishing(false);
    setSelectedPost(null);
    if (res.ok) {
      setPosts((prev) => prev.map((p) => p.id === selectedPost.id ? { ...p, status: "published", description: panelDesc } : p));
      showToast("Publié sur Instagram ✓");
    } else {
      showToast(data?.error === "Compte Instagram non connecté" ? "Erreur — compte non connecté" : `Erreur — ${data?.error ?? "publication échouée"}`, false);
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = isSameDay(getMonday(new Date()), weekStart);
  const postsForDay = (day: Date) => posts.filter((p) => p.scheduled_at && isSameDay(new Date(p.scheduled_at), day));
  const unscheduled = posts.filter((p) => !p.scheduled_at || p.status === "generated" || p.status === "validated");

  return (
    <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden', position: 'relative' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 50, padding: '11px 22px', borderRadius: 99, fontWeight: 700, fontSize: 13.5, boxShadow: 'var(--shadow-pop)', background: toast.ok ? 'var(--ink)' : 'var(--warn)', color: toast.ok ? 'var(--paper)' : '#fff', whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}

      {/* Instagram modal */}
      {showIgModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,15,10,.45)' }} onClick={() => setShowIgModal(false)}>
          <div className="card pop-in" style={{ padding: 32, maxWidth: 360, width: '100%', margin: '0 16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)', display: 'grid', placeItems: 'center', color: '#fff', marginBottom: 16 }}>
              <IconInstagram />
            </div>
            <h2 className="h-title" style={{ fontSize: 18, marginBottom: 8 }}>Instagram non connecté</h2>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Connectez d&apos;abord le compte Instagram de ce client pour publier depuis Klip.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowIgModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Annuler</button>
              <Link href={`/workspace/${id}/parametres`} className="btn btn-dark" style={{ flex: 1, textAlign: 'center' }}>Connecter Instagram</Link>
            </div>
          </div>
        </div>
      )}

      {/* Canva modal */}
      {showCanva && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,15,10,.9)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: 'var(--forest)', borderBottom: '1px solid var(--cream-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 20, color: 'var(--cream)', letterSpacing: '-0.04em' }}>Kl<span style={{ color: 'var(--mint)' }}>ip</span></span>
              <span style={{ color: 'var(--cream-3)', fontSize: 14 }}>× Canva Editor</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                Uploader le PNG
                <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fileName = `${id}/${canvaPostId}-canva-${Date.now()}.png`;
                    await supabase.storage.from('exports').upload(fileName, file, { contentType: file.type, upsert: true });
                    const { data: urlData } = supabase.storage.from('exports').getPublicUrl(fileName);
                    await supabase.from('posts').update({ exported_image_url: urlData.publicUrl, status: 'validated' }).eq('id', canvaPostId);
                    setShowCanva(false);
                    window.location.reload();
                  }}
                />
              </label>
              <button onClick={() => setShowCanva(false)} className="btn btn-ghost btn-sm" style={{ color: 'var(--cream)' }}>Fermer</button>
            </div>
          </div>
          <iframe src="https://www.canva.com/_partnership/embed?action=createDesign&type=InstagramPost&fileType=png&supportDesignButtonErrorPage=false&apiMode=button&embed" style={{ flex: 1, width: '100%', border: 'none' }} allow="fullscreen" title="Canva Editor" />
        </div>
      )}

      {/* ── Main calendar column ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setWeekStart(w => addDays(w, -7))} className="btn btn-ghost btn-icon"><IconChevL /></button>
            <h1 className="h-title" style={{ fontSize: 16, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
              {formatMonthYear(weekStart)}
            </h1>
            <button onClick={() => setWeekStart(w => addDays(w, 7))} className="btn btn-ghost btn-icon"><IconChevR /></button>
            {!isCurrentWeek && (
              <button onClick={() => setWeekStart(getMonday(new Date()))} className="btn btn-ghost btn-sm">Aujourd'hui</button>
            )}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <Link href={`/workspace/${id}`} className="btn btn-primary btn-sm">
              <IconPlus /> Nouveau post
            </Link>
          </div>
        </header>

        {/* Instagram connected banner */}
        {connected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 26px', background: 'var(--mint-soft)', borderBottom: '1px solid var(--mint-soft)', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--mint-2)" strokeWidth="1.5"/><path d="M5 8l2.5 2.5 4-4" stroke="var(--mint-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--mint-2)' }}>Compte Instagram connecté avec succès.</p>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* 7-day week grid */}
          <div className="card" style={{ margin: '16px 20px 0', overflow: 'hidden', flexShrink: 0 }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--line)' }}>
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={i} style={{ padding: '11px 12px', borderRight: i < 6 ? '1px solid var(--line)' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="label" style={{ fontSize: 10 }}>{DAY_NAMES[i]}</span>
                    <span className="num" style={{ fontSize: 15, width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: '50%', background: isToday ? 'var(--mint)' : 'transparent', color: isToday ? 'var(--mint-ink)' : 'var(--ink)' }}>
                      {formatShortDate(day).split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
              {weekDays.map((day, i) => {
                const dayKey = toDateInput(day);
                const isDragOver = dragOverDay === dayKey;
                const dayPosts = postsForDay(day);
                return (
                  <div
                    key={dayKey}
                    style={{ borderRight: i < 6 ? '1px solid var(--line)' : 'none', minHeight: 280, display: 'flex', flexDirection: 'column', background: isDragOver ? 'var(--mint-soft)' : 'transparent', transition: 'background 0.15s' }}
                    onDragOver={e => { e.preventDefault(); setDragOverDay(dayKey); }}
                    onDragLeave={() => setDragOverDay(null)}
                    onDrop={() => handleDrop(day)}
                  >
                    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      {dayPosts.map((post) => (
                        <button
                          key={post.id}
                          draggable
                          onDragStart={() => setDraggedId(post.id)}
                          onDragEnd={() => { setDraggedId(null); setDragOverDay(null); }}
                          onClick={() => selectPost(post)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 7, background: 'var(--white)', boxShadow: selectedPost?.id === post.id ? `inset 0 0 0 2px var(--mint-2)` : 'inset 0 0 0 1px var(--line)', textAlign: 'left', cursor: 'pointer', transition: 'transform .12s', borderLeft: `3px solid var(--mint-2)`, width: '100%', opacity: draggedId === post.id ? 0.4 : 1, userSelect: 'none' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
                        >
                          {(post.exported_image_url || post.photo_url) && (
                            <span style={{ width: 18, height: 18, borderRadius: 4, overflow: 'hidden', flexShrink: 0, display: 'block' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={post.exported_image_url || post.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </span>
                          )}
                          <span style={{ minWidth: 0, flex: 1 }}>
                            {post.texte_visuel && <span style={{ display: 'block', fontWeight: 700, fontSize: 11, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{post.texte_visuel}</span>}
                            {post.scheduled_at && <span style={{ fontSize: 9.5, color: 'var(--ink-3)', fontWeight: 600 }}>{formatTime(post.scheduled_at)}</span>}
                          </span>
                          <span className="dot" style={{ background: post.status === 'published' ? 'var(--mint-2)' : post.status === 'scheduled' ? 'var(--mint-2)' : 'var(--ink-3)', width: 6, height: 6, flexShrink: 0 }} />
                        </button>
                      ))}

                      {isDragOver && draggedId && (
                        <div style={{ border: '2px dashed var(--mint-2)', borderRadius: 8, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--mint-2)', fontWeight: 700 }}>Déposer ici</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unscheduled posts */}
          {unscheduled.length > 0 && (
            <div style={{ padding: '20px 20px 0' }}>
              <div className="label" style={{ marginBottom: 10 }}>Posts non programmés ({unscheduled.length}) · Glisse sur une colonne</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {unscheduled.map((post) => (
                  <div
                    key={post.id}
                    draggable
                    onDragStart={() => setDraggedId(post.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverDay(null); }}
                    onClick={() => selectPost(post)}
                    className="card lift"
                    style={{ width: 100, overflow: 'hidden', cursor: 'pointer', opacity: draggedId === post.id ? 0.4 : 1, userSelect: 'none', outline: selectedPost?.id === post.id ? '2px solid var(--mint-2)' : 'none' }}
                  >
                    {(post.exported_image_url || post.photo_url) && (
                      <div style={{ aspectRatio: '4/5', overflow: 'hidden' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={post.exported_image_url || post.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ padding: '6px 8px' }}>
                      <StatusChip status={post.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid var(--mint-soft)', borderTopColor: 'var(--mint-2)', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
            </div>
          )}

          <div style={{ height: 40 }} />
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────────── */}
      {selectedPost && (
        <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid var(--line)', background: 'var(--white)', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '-4px 0 20px rgba(13,15,10,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <span className="h-title" style={{ fontSize: 15 }}>Programmer</span>
            <button onClick={() => setSelectedPost(null)} className="btn btn-ghost btn-icon"><IconClose /></button>
          </div>

          <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Photo */}
            {(selectedPost.exported_image_url || selectedPost.photo_url) && (
              <div style={{ position: 'relative', width: '100%', aspectRatio: '4/5', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                {selectedPost.exported_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedPost.exported_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedPost.photo_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {selectedPost.texte_visuel && (
                      <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, background: workspace?.primary_color ?? "#0038FF", color: workspace?.secondary_color ?? "#FFFFFF", fontFamily: workspace?.font_family ? `"${workspace.font_family}", sans-serif` : "Oswald, sans-serif", fontWeight: 'bold', fontSize: 14, padding: '6px 12px', borderRadius: 4, textTransform: 'uppercase', maxWidth: '80%' }}>
                        {selectedPost.texte_visuel}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Description Instagram</label>
              <textarea value={panelDesc} onChange={e => setPanelDesc(e.target.value)} rows={4} className="input" style={{ resize: 'none', fontSize: 12.5, color: 'var(--ink-2)' }} />
            </div>

            {/* Date + time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Date</label>
                <input type="date" value={panelDate} onChange={e => setPanelDate(e.target.value)} className="input" style={{ height: 40, fontSize: 12.5 }} />
              </div>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Heure</label>
                <input type="time" value={panelTime} onChange={e => setPanelTime(e.target.value)} className="input" style={{ height: 40, fontSize: 12.5 }} />
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 7 }}>
              <Link href={`/workspace/${id}/editor/${selectedPost.id}`} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                <IconEdit /> Éditer
              </Link>
              <button onClick={() => { setCanvaPostId(selectedPost.id); setShowCanva(true); }} className="btn btn-dark btn-sm" style={{ flex: 1 }}>
                <IconSpark /> Canva
              </button>
            </div>
          </div>

          {/* Panel actions */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={handleSchedule} disabled={scheduling || !panelDate} className="btn btn-primary" style={{ width: '100%', padding: '12px', opacity: (scheduling || !panelDate) ? 0.5 : 1 }}>
              <IconCalendar /> {scheduling ? "Programmation…" : "Programmer ce post"}
            </button>
            <button onClick={handlePublish} disabled={publishing} className="btn btn-ghost" style={{ width: '100%', opacity: publishing ? 0.5 : 1 }}>
              {publishing ? "Publication…" : "Publier maintenant"}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function PlanningPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas)', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sb-w)', flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Suspense fallback={
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid var(--mint-soft)', borderTopColor: 'var(--mint-2)', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        }>
          <PlanningContent />
        </Suspense>
      </div>
    </div>
  );
}
