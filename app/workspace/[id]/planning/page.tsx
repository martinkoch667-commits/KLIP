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
const DAY_NAMES_LONG = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

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

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  scheduled:  { label: "Programmé", cls: "bg-green-100 text-green-700" },
  published:  { label: "Publié",    cls: "bg-blue-100 text-blue-700" },
  generated:  { label: "Brouillon", cls: "bg-[#F0F0F0] text-[#888]" },
  validated:  { label: "Brouillon", cls: "bg-[#F0F0F0] text-[#888]" },
};

function getImageUrl(post: Post): string {
  if (post.exported_image_url && post.exported_image_url.startsWith('https://')) {
    return post.exported_image_url;
  }
  return post.photo_url || '';
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.generated;
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-inter font-bold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Planning content (needs Suspense for useSearchParams) ────────────────────

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

  // Panel form state
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

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const [{ data: ws }, { data: postsData }] = await Promise.all([
      supabase.from("workspaces").select("id, name, primary_color, secondary_color, font_family, instagram_account_id, instagram_access_token, instagram_username").eq("id", id).single(),
      supabase
        .from("posts")
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

  // Pre-select post from URL param
  useEffect(() => {
    if (!preSelectedId || posts.length === 0) return;
    const post = posts.find((p) => p.id === preSelectedId);
    if (post) selectPost(post);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectedId, posts]);

  // ── Select post → populate panel ─────────────────────────────────────────────

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

  // ── Drag & drop ──────────────────────────────────────────────────────────────

  async function handleDrop(day: Date) {
    if (!draggedId) return;
    setDragOverDay(null);
    const post = posts.find((p) => p.id === draggedId);
    if (!post) return;

    // Preserve existing time or default to 09:00
    let time = "09:00";
    if (post.scheduled_at) {
      const d = new Date(post.scheduled_at);
      time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }

    const scheduled_at = buildScheduledAt(toDateInput(day), time);
    const status = "scheduled";

    await supabase.from("posts").update({ scheduled_at, status }).eq("id", draggedId);
    setPosts((prev) => prev.map((p) => p.id === draggedId ? { ...p, scheduled_at, status } : p));
    if (selectedPost?.id === draggedId) {
      setSelectedPost((prev) => prev ? { ...prev, scheduled_at, status } : null);
      setPanelDate(toDateInput(day));
    }
    setDraggedId(null);
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Schedule ─────────────────────────────────────────────────────────────────

  async function handleSchedule() {
    if (!selectedPost || !panelDate) return;
    setScheduling(true);
    const scheduled_at = buildScheduledAt(panelDate, panelTime);
    await supabase.from("posts").update({
      scheduled_at,
      description: panelDesc,
      status: "scheduled",
    }).eq("id", selectedPost.id);
    setPosts((prev) => prev.map((p) =>
      p.id === selectedPost.id ? { ...p, scheduled_at, description: panelDesc, status: "scheduled" } : p
    ));
    setScheduling(false);
    setSelectedPost(null);
    showToast("Post programmé ✓", true);
  }

  // ── Publish now (via Instagram API) ──────────────────────────────────────────

  async function handlePublish() {
    if (!selectedPost) return;

    // Check Instagram connection before publishing — same logic as parametres page
    const isConnected = !!(workspace?.instagram_account_id || workspace?.instagram_access_token || workspace?.instagram_username);
    if (!isConnected) {
      setShowIgModal(true);
      return;
    }

    setPublishing(true);

    // Save description first if changed
    if (panelDesc !== selectedPost.description) {
      await supabase.from("posts").update({ description: panelDesc }).eq("id", selectedPost.id);
    }

    const res = await fetch("/api/publish/instagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: selectedPost.id, workspaceId: id }),
    });
    const data = await res.json();

    setPublishing(false);
    setSelectedPost(null);

    if (res.ok) {
      setPosts((prev) => prev.map((p) =>
        p.id === selectedPost.id ? { ...p, status: "published", description: panelDesc } : p
      ));
      showToast("Publié sur Instagram ✓", true);
    } else {
      const msg = data?.error === "Compte Instagram non connecté"
        ? "Erreur — compte Instagram non connecté"
        : `Erreur — ${data?.error ?? "publication échouée"}`;
      showToast(msg, false);
    }
  }

  // ── Week data ────────────────────────────────────────────────────────────────

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = isSameDay(getMonday(new Date()), weekStart);

  function postsForDay(day: Date) {
    return posts.filter((p) => p.scheduled_at && isSameDay(new Date(p.scheduled_at), day));
  }

  const unscheduled = posts.filter((p) => !p.scheduled_at || p.status === "generated" || p.status === "validated");

  return (
    <div className="flex-1 flex min-w-0 overflow-hidden relative">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-sm font-inter font-bold px-5 py-3 rounded-full shadow-xl transition-all ${toast.ok ? "bg-black text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Instagram connection required modal */}
      {showIgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowIgModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </div>
            <h2 className="font-syne font-extrabold text-lg text-black mb-2">Instagram non connecté</h2>
            <p className="font-inter text-sm text-[#555] mb-6">
              Connectez d&apos;abord le compte Instagram de ce client pour pouvoir publier directement depuis Klip.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowIgModal(false)}
                className="flex-1 py-2.5 rounded border border-[#E0E0E0] text-sm font-inter font-bold text-[#888] hover:border-black hover:text-black transition-colors"
              >
                Annuler
              </button>
              <Link
                href={`/workspace/${id}/parametres`}
                className="flex-1 py-2.5 rounded bg-black text-white text-sm font-inter font-bold hover:bg-black/80 transition-colors text-center"
              >
                Connecter Instagram
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Main column ─────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>

        {/* Header */}
        <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 32px', borderBottom:'1px solid #1E1E1E', flexShrink:0 }}>
          <div>
            <h1 style={{ fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:700, fontSize:18, color:'#F0EFE9', lineHeight:1 }}>
              {workspace?.name ?? "…"}
            </h1>
            <p style={{ fontSize:12, color:'#555', marginTop:4 }}>Planning éditorial</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Link
              href={`/workspace/${id}`}
              style={{ padding:'8px 16px', borderRadius:8, background:'#B8F028', color:'#000', fontSize:13, fontWeight:700, textDecoration:'none', fontFamily:'Cabinet Grotesk,sans-serif' }}
            >
              + Nouveau post
            </Link>
          </div>
        </header>

        {/* Instagram connected banner */}
        {connected && (
          <div className="flex items-center gap-3 px-8 py-3 bg-green-50 border-b border-green-200 shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#16a34a" strokeWidth="1.5"/><path d="M5 8l2.5 2.5 4-4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <p className="text-sm font-inter font-medium text-green-700">Compte Instagram connecté avec succès.</p>
          </div>
        )}

        {/* Week nav */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 32px', borderBottom:'1px solid #1E1E1E', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, border:'1px solid #2A2A2A', background:'transparent', cursor:'pointer' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span style={{ fontSize:14, fontWeight:700, color:'#F0EFE9', textTransform:'capitalize', fontFamily:'Cabinet Grotesk,sans-serif' }}>
              {formatMonthYear(weekStart)}
            </span>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, border:'1px solid #2A2A2A', background:'transparent', cursor:'pointer' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeekStart(getMonday(new Date()))}
              style={{ fontSize:12, color:'#555', background:'none', border:'none', cursor:'pointer', fontFamily:'Satoshi,sans-serif' }}
            >
              Aujourd&apos;hui
            </button>
          )}
        </div>

        {/* Calendar + unscheduled */}
        <div className="flex-1 overflow-auto">

          {/* 7-day grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid #1E1E1E', minHeight:500 }}>
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, new Date());
              const dayPosts = postsForDay(day);
              const dayKey = toDateInput(day);
              const isDragOver = dragOverDay === dayKey;

              return (
                <div
                  key={dayKey}
                  style={{ borderRight:'1px solid #1E1E1E', display:'flex', flexDirection:'column', minHeight:500, background: isDragOver ? 'rgba(184,240,40,0.04)' : 'transparent', transition:'background 0.15s' }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverDay(dayKey); }}
                  onDragLeave={() => setDragOverDay(null)}
                  onDrop={() => handleDrop(day)}
                >
                  {/* Day header */}
                  <div style={{ padding:'10px 12px', borderBottom:'1px solid #1E1E1E', textAlign:'center', background: isToday ? '#B8F028' : 'transparent' }}>
                    <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color: isToday ? '#000' : '#555', fontFamily:'Cabinet Grotesk,sans-serif' }}>
                      {DAY_NAMES[i]}
                    </p>
                    <p style={{ fontSize:13, fontWeight:700, color: isToday ? '#000' : '#F0EFE9', marginTop:2, fontFamily:'Cabinet Grotesk,sans-serif' }}>
                      {formatShortDate(day)}
                    </p>
                  </div>

                  {/* Posts in this day */}
                  <div style={{ flex:1, padding:8, display:'flex', flexDirection:'column', gap:8 }}>
                    {dayPosts.map((post) => (
                      <div
                        key={post.id}
                        draggable
                        onDragStart={() => setDraggedId(post.id)}
                        onDragEnd={() => { setDraggedId(null); setDragOverDay(null); }}
                        onClick={() => selectPost(post)}
                        style={{ borderRadius:6, border: selectedPost?.id === post.id ? '1px solid #B8F028' : '1px solid #2A2A2A', cursor:'pointer', transition:'all 0.15s', userSelect:'none', opacity: draggedId === post.id ? 0.4 : 1, background:'#111' }}
                      >
                        {/* Photo with brand overlay */}
                        {(post.exported_image_url || post.photo_url) && (
                          <div style={{ position: "relative", width: "100%", aspectRatio: "4/5" }}>
                            {post.exported_image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={post.exported_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px 4px 0 0", display: "block" }} />
                            ) : (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={post.photo_url || ''} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px 4px 0 0", display: "block" }} />
                                {post.texte_visuel && (
                                  <div style={{
                                    position: "absolute", bottom: 6, left: 6, right: 6,
                                    background: workspace?.primary_color ?? "#0038FF",
                                    color: workspace?.secondary_color ?? "#FFFFFF",
                                    fontFamily: workspace?.font_family ? `"${workspace.font_family}", sans-serif` : "Oswald, sans-serif",
                                    fontWeight: "bold", fontSize: "10px",
                                    padding: "4px 6px", borderRadius: "3px",
                                    textTransform: "uppercase",
                                    overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                                  }}>
                                    {post.texte_visuel}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        <div style={{ padding:8, display:'flex', flexDirection:'column', gap:4 }}>
                          {post.texte_visuel && (
                            <p style={{ fontSize:11, fontWeight:700, color:'#F0EFE9', lineHeight:1.3, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', fontFamily:'Cabinet Grotesk,sans-serif' }}>
                              {post.texte_visuel}
                            </p>
                          )}
                          {post.scheduled_at && (
                            <p style={{ fontSize:10, color:'#555' }}>{formatTime(post.scheduled_at)}</p>
                          )}
                          <StatusBadge status={post.status} />
                        </div>
                      </div>
                    ))}

                    {/* Drop hint */}
                    {isDragOver && draggedId && (
                      <div style={{ border:'2px dashed #B8F028', borderRadius:6, height:64, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <p style={{ fontSize:11, color:'#B8F028', fontWeight:700 }}>Déposer ici</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unscheduled posts */}
          {unscheduled.length > 0 && (
            <div style={{ padding:'24px 32px' }}>
              <p style={{ fontSize:11, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12, fontFamily:'Cabinet Grotesk,sans-serif' }}>
                Posts non programmés ({unscheduled.length})
              </p>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {unscheduled.map((post) => (
                  <div
                    key={post.id}
                    draggable
                    onDragStart={() => setDraggedId(post.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverDay(null); }}
                    onClick={() => selectPost(post)}
                    style={{ width:120, borderRadius:8, border: selectedPost?.id === post.id ? '1px solid #B8F028' : '1px solid #2A2A2A', cursor:'pointer', transition:'all 0.15s', userSelect:'none', opacity: draggedId === post.id ? 0.4 : 1, background:'#111' }}
                  >
                    {(post.exported_image_url || post.photo_url) && (
                      <div style={{ position: "relative", width: "100%", aspectRatio: "4/5" }}>
                        {post.exported_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.exported_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px 4px 0 0", display: "block" }} />
                        ) : (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={post.photo_url || ''} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px 4px 0 0", display: "block" }} />
                            {post.texte_visuel && (
                              <div style={{
                                position: "absolute", bottom: 5, left: 5, right: 5,
                                background: workspace?.primary_color ?? "#0038FF",
                                color: workspace?.secondary_color ?? "#FFFFFF",
                                fontFamily: workspace?.font_family ? `"${workspace.font_family}", sans-serif` : "Oswald, sans-serif",
                                fontWeight: "bold", fontSize: "9px",
                                padding: "3px 5px", borderRadius: "3px",
                                textTransform: "uppercase",
                                overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                              }}>
                                {post.texte_visuel}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    <div style={{ padding:8 }}>
                      <StatusBadge status={post.status} />
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:11, color:'#444', marginTop:8 }}>Glisse un post sur une colonne pour le programmer</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-24">
              <svg className="animate-spin w-6 h-6 text-[#CCC]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────────────────── */}
      {selectedPost && (
        <div style={{ width:300, flexShrink:0, borderLeft:'1px solid #1E1E1E', background:'#0A0A0A', display:'flex', flexDirection:'column', overflowY:'auto' }}>
          {/* Panel header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #1E1E1E' }}>
            <p style={{ fontSize:14, fontWeight:700, color:'#F0EFE9', fontFamily:'Cabinet Grotesk,sans-serif' }}>Programmer</p>
            <button onClick={() => setSelectedPost(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#555' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>

          <div style={{ flex:1, padding:'16px 20px', display:'flex', flexDirection:'column', gap:16 }}>
            {/* Photo with brand overlay */}
            {(selectedPost.exported_image_url || selectedPost.photo_url) && (
              <div style={{ position: "relative", width: "100%", aspectRatio: "4/5", borderRadius: "6px", overflow: "hidden" }}>
                {selectedPost.exported_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedPost.exported_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedPost.photo_url || ''} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    {selectedPost.texte_visuel && (
                      <div style={{
                        position: "absolute", bottom: 10, left: 10, right: 10,
                        background: workspace?.primary_color ?? "#0038FF",
                        color: workspace?.secondary_color ?? "#FFFFFF",
                        fontFamily: workspace?.font_family ? `"${workspace.font_family}", sans-serif` : "Oswald, sans-serif",
                        fontWeight: "bold", fontSize: "14px",
                        padding: "6px 12px", borderRadius: "4px",
                        textTransform: "uppercase", maxWidth: "80%",
                      }}>
                        {selectedPost.texte_visuel}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <p style={{ fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:700 }}>Description Instagram</p>
              <textarea
                value={panelDesc}
                onChange={(e) => setPanelDesc(e.target.value)}
                rows={5}
                style={{ width:'100%', borderRadius:8, border:'1px solid #2A2A2A', background:'#161616', padding:'8px 12px', fontSize:12, color:'#888', resize:'none', outline:'none', fontFamily:'Satoshi,sans-serif' }}
              />
            </div>

            {/* Date & time */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div>
                <p style={{ fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:700 }}>Date de publication</p>
                <input
                  type="date"
                  value={panelDate}
                  onChange={(e) => setPanelDate(e.target.value)}
                  style={{ width:'100%', borderRadius:8, border:'1px solid #2A2A2A', background:'#161616', padding:'8px 12px', fontSize:13, color:'#F0EFE9', outline:'none', fontFamily:'Satoshi,sans-serif' }}
                />
              </div>
              <div>
                <p style={{ fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:700 }}>Heure</p>
                <input
                  type="time"
                  value={panelTime}
                  onChange={(e) => setPanelTime(e.target.value)}
                  style={{ width:'100%', borderRadius:8, border:'1px solid #2A2A2A', background:'#161616', padding:'8px 12px', fontSize:13, color:'#F0EFE9', outline:'none', fontFamily:'Satoshi,sans-serif' }}
                />
              </div>
            </div>

            {/* Links */}
            <div style={{ display:'flex', gap:6 }}>
              <Link
                href={`/workspace/${id}/editor/${selectedPost.id}`}
                style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid #1E1E1E', fontSize:12, fontWeight:700, color:'#F0EFE9', textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 8l1-1 4-4 1 1-4 4-1 1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/><path d="M6 2l1 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
                Éditer
              </Link>
              <button
                onClick={() => { setCanvaPostId(selectedPost.id); setShowCanva(true); }}
                style={{ flex:1, padding:'8px', borderRadius:8, background:'#B8F028', color:'#000', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Cabinet Grotesk,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}
              >
                ✦ Canva
              </button>
            </div>
          </div>

          {/* Panel actions */}
          <div style={{ padding:'16px 20px', borderTop:'1px solid #1E1E1E', display:'flex', flexDirection:'column', gap:8 }}>
            <button
              onClick={handleSchedule}
              disabled={scheduling || !panelDate}
              style={{ width:'100%', padding:'13px', borderRadius:8, background:'#B8F028', border:'none', color:'#000', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity: (scheduling || !panelDate) ? 0.5 : 1, fontFamily:'Cabinet Grotesk,sans-serif' }}
            >
              {scheduling ? "Programmation…" : "📅 Programmer ce post"}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              style={{ width:'100%', padding:'10px', borderRadius:8, background:'#1E1E1E', border:'none', color:'#F0EFE9', fontSize:13, fontWeight:600, cursor:'pointer', opacity: publishing ? 0.5 : 1, fontFamily:'Satoshi,sans-serif' }}
            >
              {publishing ? "Publication…" : "Publier maintenant"}
            </button>
          </div>
        </div>
      )}
      {/* ── Canva modal ── */}
      {showCanva && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', background:'#000', borderBottom:'1px solid #1E1E1E' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:900, fontSize:20, color:'#F0EFE9' }}>
                Kl<span style={{ color:'#B8F028' }}>ip</span>
              </span>
              <span style={{ color:'#444', fontSize:14 }}>× Canva Editor</span>
            </div>
            <button
              onClick={() => setShowCanva(false)}
              style={{ background:'transparent', border:'1px solid #1E1E1E', color:'#F0EFE9', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontFamily:'Satoshi,sans-serif' }}
            >
              Fermer
            </button>
          </div>
          <div style={{ background:'#111', borderBottom:'1px solid #1E1E1E', padding:'10px 24px', fontSize:13, color:'#666', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ color:'#B8F028' }}>ℹ</span>
            Créez votre visuel dans Canva, téléchargez-le en PNG, puis uploadez-le dans Klip via le bouton ci-dessous.
            <label style={{ marginLeft:'auto', background:'#B8F028', color:'#000', fontWeight:700, padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:13, fontFamily:'Cabinet Grotesk,sans-serif', whiteSpace:'nowrap' }}>
              Uploader le PNG
              <input type="file" accept="image/png,image/jpeg" style={{ display:'none' }}
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
          </div>
          <iframe
            src="https://www.canva.com/_partnership/embed?action=createDesign&type=InstagramPost&fileType=png&supportDesignButtonErrorPage=false&apiMode=button&embed"
            style={{ flex:1, width:'100%', border:'none' }}
            allow="fullscreen"
            title="Canva Editor"
          />
        </div>
      )}
    </div>
  );
}

// ─── Page wrapper (Suspense for useSearchParams) ──────────────────────────────

export default function PlanningPage() {
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#0A0A0A', overflow:'hidden', fontFamily:'Satoshi,sans-serif' }}>
      <Sidebar />
      <div style={{ marginLeft:240, flex:1, display:'flex', overflow:'hidden' }}>
        <Suspense fallback={
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg className="animate-spin w-6 h-6" style={{ color:'#444' }} viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
            </svg>
          </div>
        }>
          <PlanningContent />
        </Suspense>
      </div>
    </div>
  );
}
