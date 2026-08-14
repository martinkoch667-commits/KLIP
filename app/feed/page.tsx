"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { useAccountType } from "@/hooks/useAccountType";
import MediaThumb, { pickThumbSource } from "@/components/MediaThumb";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Workspace {
  id: string;
  name: string;
  instagram_account_id: string | null;
  instagram_username: string | null;
}

interface Post {
  id: string;
  workspace_id: string;
  exported_image_url: string | null;
  photo_url: string | null;
  thumbnail_url?: string | null;
  description: string | null;
  status: string;
  post_type: string | null;
  scheduled_at: string | null;
  created_at: string;
}

const WS_COLORS = ["#7B5CF5","#2FD79B","#C8732B","#5A86E8","#DD2A7B","#88B394","#E8A03A","#4A8DD4"];

// Noms de jours localisés dérivés de la locale active (via Intl).
function localizedDayNamesShort(locale: string): string[] {
  const f = new Intl.DateTimeFormat(locale, { weekday: "short" });
  return Array.from({ length: 7 }, (_, i) => { const s = f.format(new Date(2024, 0, 1 + i)); return s.charAt(0).toUpperCase() + s.slice(1); });
}

// ─── Icon component ───────────────────────────────────────────────────────────

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "send":     return <svg {...p}><path d="M22 3L11 14M22 3l-7 19-4-8-8-4 19-7Z"/></svg>;
    case "clock":    return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>;
    case "calendar": return <svg {...p}><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>;
    case "edit":     return <svg {...p}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M13.5 7.5l3 3"/></svg>;
    case "check":    return <svg {...p}><path d="M4 12.5l5 5 11-11"/></svg>;
    case "dots":     return <svg {...p} strokeWidth={0}><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>;
    case "bolt":     return <svg {...p}><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z"/></svg>;
    case "instagram":return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>;
    case "settings": return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.5M12 19v2.5M4.2 7l2.1 1.2M17.7 15.8l2.1 1.2M4.2 17l2.1-1.2M17.7 8.2l2.1-1.2"/></svg>;
    case "chevR":    return <svg {...p}><path d="M9 6l6 6-6 6"/></svg>;
    case "compose":  return <svg {...p}><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/></svg>;
    default: return null;
  }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ initials, color, size = 32 }: { initials: string; color: string; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: color, display: "grid", placeItems: "center",
      fontSize: size * 0.36, fontWeight: 800, color: "#fff",
      fontFamily: "var(--display)", letterSpacing: ".02em", flexShrink: 0,
    }}>{initials}</span>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function QStatTile({ value, label, icon, tone }: { value: number; label: string; icon: string; tone?: "mint" | "warn" | "default" }) {
  return (
    <div className="card tile-accent" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{
        width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0,
        background: tone === "mint" ? "var(--mint-soft)" : tone === "warn" ? "var(--warn-soft)" : "var(--sunk)",
        color: tone === "mint" ? "var(--mint-2)" : tone === "warn" ? "var(--warn)" : "var(--ink-2)",
      }}>
        <Icon name={icon} size={18} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="num" style={{ fontSize: 23, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-2)", fontWeight: 600, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Score for a post ─────────────────────────────────────────────────────────

const BEST_HOURS: Record<number, number> = { 8: 72, 9: 81, 10: 85, 11: 80, 12: 88, 13: 82, 14: 75, 15: 70, 16: 74, 17: 80, 18: 86, 19: 92, 20: 88, 21: 78 };
function engageScore(iso: string | null): number {
  if (!iso) return 60;
  const h = new Date(iso).getHours();
  return BEST_HOURS[h] ?? 60;
}
function scoreTone(s: number, t: (k: string) => string) {
  return s >= 85
    ? { fg: "var(--mint-2)", bg: "var(--mint-soft)", label: t('scoreIdeal') }
    : s >= 65
    ? { fg: "var(--ink-2)", bg: "var(--sunk)", label: t('scoreGood') }
    : { fg: "var(--warn)", bg: "var(--warn-soft)", label: t('scoreWeak') };
}

// ─── Queue card ───────────────────────────────────────────────────────────────

function QueueCard({
  post, ws, onApprove, onEdit, approved,
}: {
  post: Post;
  ws: { name: string; color: string; initials: string; instagram_username?: string | null };
  onApprove: () => void;
  onEdit: () => void;
  approved: boolean;
}) {
  const t = useTranslations('feed');
  const locale = useLocale();
  const rawImg = post.exported_image_url || post.thumbnail_url || post.photo_url;
  const thumb = rawImg ? `/api/proxy-image?url=${encodeURIComponent(rawImg)}` : null;
  const effectiveStatus = approved ? "scheduled" : post.status;
  const isPending = (post.status === "generated" || post.status === "validated") && !approved;
  const score = engageScore(post.scheduled_at);
  const st = scoreTone(score, t);

  const statusColors: Record<string, { bg: string; fg: string; label: string }> = {
    generated:  { bg: "var(--warn-soft)", fg: "var(--warn)",   label: t('statusToValidate') },
    validated:  { bg: "var(--warn-soft)", fg: "var(--warn)",   label: t('statusToValidate') },
    scheduled:  { bg: "var(--mint-soft)", fg: "var(--mint-2)", label: t('statusScheduled') },
    published:  { bg: "var(--mint)",      fg: "var(--mint-ink)", label: t('statusPublished') },
  };
  const sc = statusColors[effectiveStatus] ?? statusColors.generated;

  const timeLabel = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="card feed-post-row" style={{ padding: 12, display: "flex", alignItems: "center", gap: 14 }}>
      <button onClick={onEdit} style={{
        position: "relative", width: 56, height: 70, borderRadius: 10,
        background: "var(--sunk)", flexShrink: 0, cursor: "pointer", border: "none", overflow: "hidden",
      }}>
        {thumb
          ? <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--ink-3)" }}><Icon name="edit" size={16} /></span>
        }
        <span style={{ position: "absolute", top: 5, left: 5, color: "#fff", opacity: 0.9, display: "flex" }}>
          <Icon name="instagram" size={13} />
        </span>
      </button>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, lineHeight: 1 }}>
          <Avatar initials={ws.initials} color={ws.color} size={18} />
          <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600, whiteSpace: "nowrap" }}>{ws.name}</span>
          <span className="tnum" style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600, whiteSpace: "nowrap" }}>· {timeLabel}</span>
          {post.scheduled_at && (
            <span className="chip" style={{ background: st.bg, color: st.fg, fontSize: 10, padding: "3px 8px", display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="bolt" size={10} /> {score}% · {st.label}
            </span>
          )}
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25, marginBottom: 2 }} className="trunc">
          {post.description?.slice(0, 60) || t('noDescription')}
        </div>
        {post.description && post.description.length > 60 && (
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.3 }} className="trunc">
            {post.description.slice(60, 120)}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {isPending ? (
          <>
            <button className="btn btn-sm btn-ghost" onClick={onEdit}>{t('view')}</button>
            <button className="btn btn-sm btn-primary" onClick={onApprove} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="check" size={14} /> {t('validate')}
            </button>
          </>
        ) : (
          <span className="badge" style={{ background: sc.bg, color: sc.fg, display: "flex", alignItems: "center", gap: 5 }}>
            <span className="dot" style={{ background: sc.fg, opacity: 0.8 }} /> {sc.label}
          </span>
        )}
        <button className="btn btn-ghost btn-icon" onClick={onEdit} title={t('edit')} style={{ display: "grid", placeItems: "center" }}>
          <Icon name="dots" size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const t = useTranslations('feed');
  const locale = useLocale();
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filterWsId, setFilterWsId] = useState("all");
  const [tab, setTab] = useState<"all" | "pending" | "scheduled">("all");
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const { isAgency } = useAccountType();

  const DOW = localizedDayNamesShort(locale);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const [{ data: ws }, { data: ps }] = await Promise.all([
        supabase.from("workspaces").select("id,name,instagram_account_id,instagram_username").order("created_at"),
        supabase.from("posts")
          .select("id,workspace_id,exported_image_url,photo_url,thumbnail_url,description,status,post_type,scheduled_at,created_at")
          .in("status", ["generated","validated","scheduled","published"])
          .order("scheduled_at", { ascending: true, nullsFirst: false }),
      ]);
      setWorkspaces(ws ?? []);
      setPosts(ps ?? []);
      setLoading(false);
    })();
  }, [supabase, router]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const wsMap = useMemo(() =>
    Object.fromEntries(workspaces.map((w, i) => [w.id, {
      name: w.name,
      color: WS_COLORS[i % WS_COLORS.length],
      initials: w.name.slice(0, 2).toUpperCase(),
      instagram_username: w.instagram_username,
    }])),
  [workspaces]);

  const connectedCount = workspaces.filter(w => w.instagram_account_id).length;
  const scope = filterWsId === "all" ? posts : posts.filter(p => p.workspace_id === filterWsId);

  const isPending = (p: Post) => (p.status === "generated" || p.status === "validated") && !approved[p.id];
  const inQueue = scope.filter(p => p.status !== "published");

  const counts = {
    all: inQueue.length,
    pending: scope.filter(p => isPending(p)).length,
    scheduled: scope.filter(p => p.status === "scheduled" || approved[p.id]).length,
    published: scope.filter(p => p.status === "published").length,
    drafts: 0,
  };

  const filtered = inQueue.filter(p =>
    tab === "all" ? true :
    tab === "pending" ? isPending(p) :
    (p.status === "scheduled" || approved[p.id])
  );

  // Group by date
  const grouped = useMemo(() => {
    const g: Record<string, Post[]> = {};
    [...filtered]
      .sort((a, b) => {
        const da = a.scheduled_at ?? a.created_at;
        const db = b.scheduled_at ?? b.created_at;
        return da.localeCompare(db);
      })
      .forEach(p => {
        const day = p.scheduled_at
          ? new Date(p.scheduled_at).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })
          : t('unplanned');
        (g[day] ||= []).push(p);
      });
    return g;
  }, [filtered, locale, t]);

  // Next scheduled post
  const next = scope.find(p => p.status === "scheduled" || approved[p.id]);

  // Per-client breakdown
  const byClient = useMemo(() =>
    workspaces.map(w => ({
      w,
      n: inQueue.filter(p => p.workspace_id === w.id).length,
      pend: scope.filter(p => p.workspace_id === w.id && isPending(p)).length,
    })).filter(x => x.n > 0).sort((a, b) => b.n - a.n),
  [workspaces, inQueue, scope]);

  // Week load chart
  const load = useMemo(() =>
    DOW.map((_, i) => inQueue.filter(p => {
      if (!p.scheduled_at) return false;
      const d = new Date(p.scheduled_at).getDay();
      const mapped = d === 0 ? 6 : d - 1;
      return mapped === i;
    }).length),
  [inQueue, DOW]);
  const maxLoad = Math.max(1, ...load);

  async function handleApprove(post: Post) {
    await supabase.from("posts").update({ status: "scheduled" }).eq("id", post.id);
    setApproved(a => ({ ...a, [post.id]: true }));
    showToast(t('postValidatedToast'));
  }

  function handleEdit(post: Post) {
    router.push(`/workspace/${post.workspace_id}/editor/${post.id}`);
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="work">
        <div className="topbar" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <h1 className="feed-tb-title" style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{t('title')}</h1>
            {filterWsId !== "all" && (
              <button onClick={() => setFilterWsId("all")} style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                {t('allClientsClear')}
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select value={filterWsId} onChange={e => setFilterWsId(e.target.value)}
              style={{ fontSize: 12, fontWeight: 600, border: "1px solid var(--line)", borderRadius: "var(--r-s)", padding: "5px 10px", background: "var(--sunk)", color: "var(--ink)", outline: "none" }}>
              <option value="all">{t('allClients')}</option>
              {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <Link href="/composer" className="btn btn-primary btn-sm" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="compose" size={15} /> {t('compose')}
            </Link>
          </div>
        </div>

        <div className="scroll" style={{ padding: "28px 32px 60px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-3)" }}>{t('loading')}</div>
          ) : (
            <>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
                <div>
                  <div className="label" style={{ marginBottom: 8 }}>{t('autoPublishActive')}</div>
                  <h1 className="h-display" style={{ fontSize: 30, margin: 0 }}>{t('title')}</h1>
                </div>
              </div>

              {/* Stat tiles */}
              <div className="feed-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                <QStatTile value={counts.all} label={t('statInQueue')} icon="send" />
                <QStatTile value={counts.pending} label={t('statPending')} icon="clock" tone="warn" />
                <QStatTile value={counts.scheduled} label={t('statScheduled')} icon="calendar" tone="mint" />
                <QStatTile value={counts.published} label={t('statPublished')} icon="check" />
              </div>

              <div className="feed-rail-layout" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
                {/* Main column */}
                <div style={{ minWidth: 0 }}>
                  {/* IG connection banner */}
                  <div className="card feed-ig-banner" style={{
                    padding: "14px 18px", display: "flex", alignItems: "center", gap: 14,
                    marginBottom: 16, background: "var(--forest)", color: "var(--cream)", border: "none",
                  }}>
                    <span style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)", display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}>
                      <Icon name="instagram" size={21} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                        {connectedCount > 0
                          ? t('igConnectedCount', { count: connectedCount })
                          : t('igNoneConnected')}
                        {connectedCount > 0 && (
                          <span className="badge" style={{ background: "var(--leaf)", color: "var(--mint-ink)", display: "flex", alignItems: "center", gap: 4 }}>
                            <Icon name="check" size={11} /> {t('active')}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--cream-2)", marginTop: 2 }}>
                        {connectedCount > 0
                          ? t('igAutoPublishHint')
                          : t('igConnectHint')}
                      </div>
                    </div>
                    <Link href="/settings" className="btn btn-sm" style={{ background: "var(--cream-4)", color: "var(--cream)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, boxShadow: "inset 0 0 0 1px var(--cream-3)" }}>
                      <Icon name="settings" size={14} /> {t('manage')}
                    </Link>
                  </div>

                  {/* Tabs */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div className="seg">
                      {([["all", t('tabAll')], ["pending", t('tabPending')], ["scheduled", t('tabScheduled')]] as const).map(([k, l]) => (
                        <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k as "all" | "pending" | "scheduled")}>
                          {l} <span style={{ opacity: 0.55 }}>{k === "all" ? counts.all : k === "pending" ? counts.pending : counts.scheduled}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grouped list */}
                  {Object.keys(grouped).length === 0 ? (
                    <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 14 }}>
                      {t('emptyQueue')}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      {Object.entries(grouped).map(([day, dayPosts]) => (
                        <div key={day}>
                          <div className="label" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                            <Icon name="calendar" size={13} />
                            <span style={{ textTransform: "capitalize" }}>{day}</span>
                            <span style={{ color: "var(--ink-3)", fontWeight: 700 }}>· {t('postsCount', { count: dayPosts.length })}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {dayPosts.map(p => (
                              <QueueCard
                                key={p.id}
                                post={p}
                                ws={wsMap[p.workspace_id] ?? { name: t('clientFallback'), color: "#888", initials: "CL" }}
                                approved={!!approved[p.id]}
                                onApprove={() => handleApprove(p)}
                                onEdit={() => handleEdit(p)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right rail */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 24 }}>
                  {/* Next publish */}
                  {next && wsMap[next.workspace_id] && (
                    <div className="card" style={{ overflow: "hidden" }}>
                      <div className="label" style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", gap: 7 }}>
                        <span className="dot" style={{ background: "var(--mint-2)" }} /> {t('nextPublish')}
                      </div>
                      <div style={{ display: "flex", gap: 12, padding: "12px 16px 16px" }}>
                        <button onClick={() => handleEdit(next)} style={{ width: 58, height: 72, borderRadius: 10, background: "var(--sunk)", flexShrink: 0, cursor: "pointer", border: "none", overflow: "hidden", position: "relative" }}>
                          {(next.exported_image_url || next.thumbnail_url || next.photo_url) && (
                            <MediaThumb raw={pickThumbSource(next.exported_image_url, next.thumbnail_url, next.photo_url)} width={128} />
                          )}
                        </button>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25, marginBottom: 4 }} className="trunc">
                            {next.description?.slice(0, 50) || t('postFallback')}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <Avatar initials={wsMap[next.workspace_id].initials} color={wsMap[next.workspace_id].color} size={16} />
                            <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }} className="trunc">{wsMap[next.workspace_id].name}</span>
                          </div>
                          {next.scheduled_at && (
                            <div className="chip" style={{ marginTop: 8, background: "var(--mint-soft)", color: "var(--mint-2)", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Icon name="clock" size={11} /> {new Date(next.scheduled_at).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })} · {new Date(next.scheduled_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Auto-publish status */}
                  <div className="card" style={{ padding: 16 }}>
                    <h3 className="h-title" style={{ fontSize: 14, marginBottom: 12 }}>{t('autoPublishTitle')}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                      {[
                        [t('connectedAccounts'), `${connectedCount}`, "instagram"],
                        [t('scheduledPosts'), `${counts.scheduled}`, "bolt"],
                        [t('publishFailures'), "0", "check"],
                      ].map(([l, v, ic]) => (
                        <div key={l} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--sunk)", color: "var(--ink-2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                            <Icon name={ic} size={14} />
                          </span>
                          <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600, flex: 1 }}>{l}</span>
                          <span className="num" style={{ fontSize: 15 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Per-client breakdown */}
                  {byClient.length > 0 && (
                    <div className="card" style={{ padding: 16 }}>
                      <h3 className="h-title" style={{ fontSize: 14, marginBottom: 12 }}>{t('byClient')}</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {byClient.map(({ w, n, pend }) => (
                          <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                            <Avatar initials={wsMap[w.id]?.initials ?? "??"} color={wsMap[w.id]?.color ?? "#888"} size={26} />
                            <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }} className="trunc">{w.name}</span>
                            {pend > 0 && (
                              <span className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)", fontSize: 10.5, display: "flex", alignItems: "center", gap: 4 }}>
                                <span className="dot" style={{ background: "var(--warn)" }} />{pend}
                              </span>
                            )}
                            <span className="num" style={{ fontSize: 14, minWidth: 16, textAlign: "right" }}>{n}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Week load chart */}
                  <div className="card" style={{ padding: 16 }}>
                    <h3 className="h-title" style={{ fontSize: 14, marginBottom: 14 }}>{t('weekLoad')}</h3>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
                      {DOW.map((d, i) => (
                        <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <span className="tnum" style={{ fontSize: 10, fontWeight: 800, color: load[i] ? "var(--ink-2)" : "var(--ink-3)" }}>{load[i] || ""}</span>
                          <div style={{
                            width: "100%",
                            height: `${10 + (load[i] / maxLoad) * 40}px`,
                            borderRadius: "5px 5px 3px 3px",
                            background: load[i] >= maxLoad && maxLoad > 1 ? "var(--leaf)" : load[i] ? "rgba(47,215,155,.4)" : "var(--sunk)",
                          }} />
                          <span className="label" style={{ fontSize: 9 }}>{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "var(--ink)", color: "var(--paper)", padding: "12px 20px",
          borderRadius: "var(--r)", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 10, zIndex: 9999,
          boxShadow: "0 8px 24px rgba(13,15,10,.3)", animation: "screenIn .2s ease",
        }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--leaf)", color: "var(--mint-ink)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name="check" size={12} />
          </span>
          {toast}
        </div>
      )}

      <style>{`
        @media (max-width: 1080px) {
          .feed-rail-layout { grid-template-columns: 1fr !important; }
          .feed-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 767px) {
          .feed-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .feed-rail-layout { grid-template-columns: 1fr !important; }
          /* topbar : titre redondant masqué (le grand titre est plus bas) */
          .feed-tb-title { display: none !important; }
          /* bannière Instagram : "Gérer" passe en pleine largeur sous le texte */
          .feed-ig-banner { flex-wrap: wrap !important; row-gap: 12px; }
          .feed-ig-banner > a { flex-basis: 100%; justify-content: center; }
          /* lignes de post : les actions passent sur une 2e ligne alignées à droite */
          .feed-post-row { flex-wrap: wrap !important; row-gap: 10px; }
          .feed-post-row > :nth-child(3) { flex-basis: 100%; display: flex; justify-content: flex-end; }
        }
      `}</style>
    </div>
  );
}
