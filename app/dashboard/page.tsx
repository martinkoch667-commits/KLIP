'use client';

import { useEffect, useState, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

// ─── Types ─────────────────────────────────────────────────────────────────

interface WorkspaceRow {
  id: string;
  name: string;
  instagram_account_id?: string | null;
  instagram_username?: string | null;
}

interface PostRow {
  id: string;
  workspace_id: string;
  status: string;
  photo_url: string | null;
  exported_image_url: string | null;
  texte_visuel: string | null;
  scheduled_at: string | null;
  created_at: string;
}

interface ActivityRow {
  id: string;
  workspace_id: string;
  action_type: string;
  post_title: string | null;
  created_at: string;
}

const WS_COLORS = ['#7B5CF5', '#2FD79B', '#C8732B', '#5A86E8', '#DD2A7B', '#88B394', '#E8A03A', '#4A8DD4'];

function wsColor(index: number) { return WS_COLORS[index % WS_COLORS.length]; }
function wsInitials(name: string) { return name.slice(0, 2).toUpperCase(); }

// ─── Icons ─────────────────────────────────────────────────────────────────

function IconBolt() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8Z"/></svg>;
}
function IconClock() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>;
}
function IconCalendar() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>;
}
function IconInstagram() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>;
}
function IconPlus() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>;
}
function IconSpark() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/></svg>;
}
function IconChevD() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>;
}
function IconGrid() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>;
}
function IconCheck() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
}
function IconBell() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
}
function IconChevR() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>;
}

// ─── StatTile ───────────────────────────────────────────────────────────────

interface StatTileProps {
  value: number;
  label: string;
  icon: React.ReactNode;
  tone?: 'mint' | 'warn' | 'default';
  sub?: string;
}

function StatTile({ value, label, icon, tone = 'default', sub }: StatTileProps) {
  const iconBg = tone === 'mint' ? 'var(--mint-soft)' : tone === 'warn' ? 'var(--warn-soft)' : 'var(--sunk)';
  const iconColor = tone === 'mint' ? 'var(--mint-2)' : tone === 'warn' ? 'var(--warn)' : 'var(--ink-2)';
  return (
    <div className="card tile-accent" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', background: iconBg, color: iconColor }}>
          {icon}
        </span>
        {sub && <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)' }}>{sub}</span>}
      </div>
      <div>
        <div className="num" style={{ fontSize: 34, lineHeight: 1 }}>{value}</div>
        <div style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 3, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── PostCard ───────────────────────────────────────────────────────────────

function PostCard({ post, workspaceId, onClick }: { post: PostRow; workspaceId: string; onClick: () => void }) {
  const imgUrl = post.exported_image_url || post.photo_url;
  const statusLabel = post.status === 'generated' ? 'À valider' : post.status === 'validated' ? 'Prêt' : 'Brouillon';
  const statusBg = post.status === 'generated' ? 'var(--warn-soft)' : post.status === 'validated' ? 'var(--mint-soft)' : 'var(--sunk)';
  const statusColor = post.status === 'generated' ? 'var(--warn)' : post.status === 'validated' ? 'var(--mint-2)' : 'var(--ink-3)';
  return (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', borderRadius: 10, overflow: 'hidden' }}
    >
      <div style={{ aspectRatio: '4/5', borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'var(--sunk)' }}>
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
            <IconInstagram />
          </div>
        )}
        <span className="chip" style={{ position: 'absolute', top: 7, left: 7, background: statusBg, color: statusColor, fontSize: 10 }}>
          {statusLabel}
        </span>
      </div>
      {post.texte_visuel && (
        <p style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 6, fontWeight: 600, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {post.texte_visuel}
        </p>
      )}
    </button>
  );
}

// ─── InstagramProfile ────────────────────────────────────────────────────────

function IconTabGrid() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}
function IconTabReels() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
}
function IconTabSaved() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
}

interface IGProfile { username: string; media_count?: number; biography?: string; followers_count?: number; follows_count?: number; }
interface IGMedia { id: string; media_url?: string; thumbnail_url?: string; }

function fmtCount(n?: number) {
  if (n == null) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function InstagramProfile({ workspaceId }: { workspaceId: string }) {
  const [wsInfo, setWsInfo] = useState<{ name: string; connected: boolean; instagram_username?: string } | null>(null);
  const [profile, setProfile] = useState<IGProfile | null>(null);
  const [media, setMedia] = useState<IGMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setProfile(null);
    setMedia([]);

    async function load() {
      try {
        const res = await fetch(`/api/instagram/profile?workspaceId=${workspaceId}`);
        const data = await res.json();
        if (cancelled) return;
        setWsInfo({ name: data.name ?? "", connected: !!data.connected });
        if (data.profile) setProfile(data.profile);
        if (data.media) setMedia(data.media);
      } catch { /* network error */ }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="card" style={{ padding: 20, display: 'grid', placeItems: 'center', minHeight: 180 }}>
        <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</span>
      </div>
    );
  }

  if (!wsInfo?.connected) {
    return (
      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
        <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--sunk)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
          <IconInstagram />
        </span>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Instagram non connecté</p>
        <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>Connectez un compte pour voir l'aperçu</p>
        <Link href={`/workspace/${workspaceId}/parametres`} className="btn btn-dark btn-sm" style={{ marginTop: 4 }}>
          Connecter Instagram
        </Link>
      </div>
    );
  }

  const initials = (wsInfo?.name ?? '??').slice(0, 2).toUpperCase();
  const handle = profile?.username ?? wsInfo?.name;

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 12px' }}>
        {/* Handle + badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>@{handle}</span>
          <span className="badge" style={{ background: 'var(--mint-soft)', color: 'var(--mint-2)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mint-2)', flexShrink: 0 }} />
            Connecté
          </span>
        </div>

        {/* Avatar + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Gradient ring avatar */}
          <div style={{ padding: 2.5, borderRadius: '50%', background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)', flexShrink: 0 }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#7B5CF5', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'var(--mono)' }}>
              {initials}
            </div>
          </div>
          {/* 3 stats */}
          <div style={{ display: 'flex', flex: 1 }}>
            {[
              { v: fmtCount(profile?.media_count), l: 'Posts' },
              { v: fmtCount(profile?.followers_count), l: 'Abonnés' },
              { v: fmtCount(profile?.follows_count), l: 'Abonnements' },
            ].map(s => (
              <div key={s.l} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{s.v}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, marginTop: 1 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bio */}
        {profile?.biography && (
          <p style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.5, margin: '10px 0 0' }}>{profile.biography}</p>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--line-2)', borderBottom: '1px solid var(--line-2)' }}>
        {[<IconTabGrid key={0} />, <IconTabReels key={1} />, <IconTabSaved key={2} />].map((ic, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            style={{ flex: 1, padding: '9px 0', display: 'grid', placeItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: tab === i ? 'var(--ink)' : 'var(--ink-3)', borderBottom: tab === i ? '2px solid var(--ink)' : '2px solid transparent', marginBottom: -1 }}
          >
            {ic}
          </button>
        ))}
      </div>

      {/* Grid / placeholder */}
      {tab === 0 ? (
        media.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>Aucun post</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {media.map(m => {
              const src = m.media_url ?? m.thumbnail_url;
              return (
                <div key={m.id} style={{ aspectRatio: '1', overflow: 'hidden', background: 'var(--sunk)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>Bientôt disponible</div>
      )}
    </div>
  );
}

// ─── ActivityFeed ───────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  post_created:   'a créé le post',
  post_validated: 'a validé le post',
  post_published: 'a publié le post',
  post_deleted:   'a supprimé un post',
  workspace_created: 'a créé le workspace',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'à l\'instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

function ActivityFeed({ activities, workspaces }: { activities: ActivityRow[]; workspaces: WorkspaceRow[] }) {
  const wsMap = Object.fromEntries(workspaces.map((w, i) => [w.id, { name: w.name, color: wsColor(i) }]));
  return (
    <div className="card" style={{ padding: 20, flex: 1 }}>
      <h2 className="h-title" style={{ fontSize: 15, marginBottom: 16 }}>Activité récente</h2>
      {activities.length === 0 ? (
        <div style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Aucune activité pour l'instant</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {activities.map(a => {
            const ws = wsMap[a.workspace_id];
            const label = ACTION_LABELS[a.action_type] ?? a.action_type;
            return (
              <div key={a.id} style={{ display: 'flex', gap: 10 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--mint-soft)', color: 'var(--mint-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <IconBolt />
                </span>
                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink-2)', minWidth: 0 }}>
                  <span style={{ color: 'var(--ink)', fontWeight: 700 }}>Klip </span>
                  {label}
                  {a.post_title && <> <b style={{ color: 'var(--ink)' }}>"{a.post_title}"</b></>}
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    {ws?.name ?? 'Client'} · {timeAgo(a.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ClientSwitcher ─────────────────────────────────────────────────────────

function ClientSwitcher({ active, workspaces, onChange }: {
  active: string;
  workspaces: WorkspaceRow[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const cur = workspaces.find(w => w.id === active);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost"
        style={{ paddingLeft: 8, height: 40, gap: 8 }}
        onClick={() => setOpen(o => !o)}
      >
        {cur ? (
          <span style={{ width: 24, height: 24, borderRadius: 6, background: wsColor(workspaces.indexOf(cur)), display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 800, color: '#fff', fontFamily: 'var(--mono)', flexShrink: 0 }}>
            {wsInitials(cur.name)}
          </span>
        ) : (
          <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <IconGrid />
          </span>
        )}
        <span style={{ fontWeight: 700, fontSize: 13 }}>{cur ? cur.name : 'Tous les clients'}</span>
        <IconChevD />
      </button>
      {open && (
        <div className="card pop-in" style={{ position: 'absolute', top: 48, left: 0, width: 260, padding: 6, zIndex: 60, boxShadow: 'var(--shadow-pop)' }}>
          {console.log('[ClientSwitcher] dropdown open, workspaces prop:', workspaces) as unknown as null}
          <button
            onClick={() => { onChange('all'); setOpen(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 9, textAlign: 'left', background: active === 'all' ? 'var(--mint-soft)' : 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <span style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <IconGrid />
            </span>
            <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>Tous les clients</span>
            {active === 'all' && <span style={{ color: 'var(--mint-2)' }}><IconCheck /></span>}
          </button>
          <div style={{ height: 1, background: 'var(--line)', margin: '5px 8px' }} />
          {workspaces.map((w, i) => (
            <button
              key={w.id}
              onClick={() => { onChange(w.id); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 9, textAlign: 'left', background: active === w.id ? 'var(--mint-soft)' : 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <span style={{ width: 26, height: 26, borderRadius: 7, background: wsColor(i), display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 800, color: '#fff', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                {wsInitials(w.name)}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
                {w.instagram_username && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>@{w.instagram_username}</span>}
              </span>
              {active === w.id && <span style={{ color: 'var(--mint-2)' }}><IconCheck /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [active, setActive] = useState<string>('all');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/login'); return; }
        setUserName(session.user.email?.split('@')[0] ?? 'vous');

        // Load workspaces first — critical for ClientSwitcher
        const { data: ws, error: wsErr } = await supabase
          .from('workspaces')
          .select('id, name')
          .order('created_at', { ascending: true });
        console.log('[Dashboard] workspaces query result:', { ws, wsErr });
        setWorkspaces(ws ?? []);
        console.log('[Dashboard] setWorkspaces called with:', ws ?? []);

        // Load posts + activity in parallel (activity_log may not exist yet)
        const [{ data: ps }, { data: acts }] = await Promise.all([
          supabase.from('posts').select('id, workspace_id, status, photo_url, exported_image_url, texte_visuel, scheduled_at, created_at').order('created_at', { ascending: false }),
          supabase.from('activity_log').select('id, workspace_id, action_type, post_title, created_at').order('created_at', { ascending: false }).limit(20),
        ]);
        setPosts(ps ?? []);
        setActivities(acts ?? []);
      } catch (err) {
        console.error('[Dashboard] load error (catch):', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, router]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--canvas)', color: 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: 14 }}>
      Chargement…
    </div>
  );

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayStr = new Date().toISOString().slice(0, 10);

  // Filter by active workspace
  const scopePosts = active === 'all' ? posts : posts.filter(p => p.workspace_id === active);
  const scopeActivities = active === 'all' ? activities : activities.filter(a => a.workspace_id === active);

  // Stats
  const todayPosts = scopePosts.filter(p => p.scheduled_at?.slice(0, 10) === todayStr).length;
  const pendingPosts = scopePosts.filter(p => p.status === 'generated').length;
  const scheduledPosts = scopePosts.filter(p => p.scheduled_at).length;
  const connectedCount = active === 'all'
    ? workspaces.filter(w => w.instagram_account_id).length
    : (workspaces.find(w => w.id === active)?.instagram_account_id ? 1 : 0);

  // Upcoming = not-yet-published, sorted by created_at, first 4
  const upcoming = scopePosts.filter(p => p.status !== 'idle').slice(0, 4);

  // Clients needing attention (have 'generated' posts)
  const attentionClients = workspaces
    .map((w, i) => ({ ...w, color: wsColor(i), pending: posts.filter(p => p.workspace_id === w.id && p.status === 'generated').length }))
    .filter(w => w.pending > 0);

  const curWorkspace = workspaces.find(w => w.id === active);
  const clientName = curWorkspace?.name ?? '';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas)' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: 'var(--sb-w)' }}>

        {/* Topbar */}
        <header className="topbar">
          <ClientSwitcher active={active} workspaces={workspaces} onChange={setActive} />
          <div style={{ width: 1, height: 24, background: 'var(--line)', flexShrink: 0 }} />
          <span className="h-title" style={{ fontSize: 15, whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>Tableau de bord</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-ghost btn-icon" style={{ position: 'relative' }} title="Notifications">
              <IconBell />
              {pendingPosts > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--warn)', boxShadow: '0 0 0 2px var(--canvas)' }} />
              )}
            </button>
            {active !== 'all' ? (
              <Link href={`/workspace/${active}`} className="btn btn-primary">
                <IconPlus /> Nouveau post
              </Link>
            ) : (
              <Link href="/workspace/new" className="btn btn-dark">
                <IconSpark /> Nouveau client
              </Link>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div className="page screen-in">

            {/* Greeting */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 26, flexWrap: 'wrap' }}>
              <div>
                <div className="label" style={{ marginBottom: 8 }}>
                  {today.charAt(0).toUpperCase() + today.slice(1)} · Bonjour {userName}
                </div>
                <h1 className="h-display" style={{ fontSize: 36 }}>
                  {active === 'all'
                    ? <>Voici l'état de <span className="it" style={{ color: 'var(--mint-2)' }}>vos marques.</span></>
                    : <>Espace de <span className="it" style={{ color: 'var(--mint-2)' }}>{clientName}.</span></>
                  }
                </h1>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {active !== 'all' && (
                  <Link href={`/workspace/${active}/planning`} className="btn btn-ghost">
                    <IconCalendar /> Calendrier
                  </Link>
                )}
                {active !== 'all' ? (
                  <Link href={`/workspace/${active}`} className="btn btn-dark">
                    <IconSpark /> Composer avec l'IA
                  </Link>
                ) : (
                  <Link href="/workspace/new" className="btn btn-dark">
                    <IconSpark /> Nouveau client
                  </Link>
                )}
              </div>
            </div>

            {/* Stat tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }} className="dash-stats">
              <StatTile value={todayPosts} label="À publier aujourd'hui" icon={<IconBolt />} tone="mint" sub="Auto" />
              <StatTile value={pendingPosts} label="En attente de validation" icon={<IconClock />} tone="warn" />
              <StatTile value={scheduledPosts} label="Planifiés" icon={<IconCalendar />} />
              <StatTile
                value={active === 'all' ? workspaces.length : 1}
                label={active === 'all' ? 'Clients actifs' : 'Compte connecté'}
                icon={<IconInstagram />}
              />
            </div>

            {/* Main grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 14 }} className="dash-grid">

              {/* Upcoming posts */}
              <div className="card" style={{ padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <h2 className="h-title" style={{ fontSize: 17 }}>Prochaines publications</h2>
                  {active !== 'all' && (
                    <Link href={`/workspace/${active}/planning`} className="btn btn-sm btn-ghost">
                      Tout voir <IconChevR />
                    </Link>
                  )}
                </div>
                {upcoming.length === 0 ? (
                  <div style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                    Aucun post en cours
                    {active !== 'all' && (
                      <div style={{ marginTop: 12 }}>
                        <Link href={`/workspace/${active}`} className="btn btn-primary btn-sm">
                          <IconPlus /> Créer un post
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }} className="up-grid">
                    {upcoming.map(p => (
                      <PostCard
                        key={p.id}
                        post={p}
                        workspaceId={p.workspace_id}
                        onClick={() => router.push(`/workspace/${p.workspace_id}/editor/${p.id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Right column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Single client: Instagram profile preview */}
                {active !== 'all' && (
                  <InstagramProfile workspaceId={active} />
                )}

                {/* All clients: attention needed */}
                {active === 'all' && attentionClients.length > 0 && (
                  <div className="card" style={{ padding: 20 }}>
                    <h2 className="h-title" style={{ fontSize: 15, marginBottom: 14 }}>Demande votre attention</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {attentionClients.slice(0, 4).map(c => (
                        <button
                          key={c.id}
                          onClick={() => setActive(c.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 8px', borderRadius: 10, textAlign: 'left', border: 'none', cursor: 'pointer', background: 'transparent', transition: 'background .14s', width: '100%' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--sunk)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{ width: 32, height: 32, borderRadius: 9, background: c.color, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, color: '#fff', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                            {wsInitials(c.name)}
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{c.pending} post{c.pending > 1 ? 's' : ''} à valider</div>
                          </div>
                          <span className="badge" style={{ background: 'var(--warn-soft)', color: 'var(--warn)', flexShrink: 0 }}>{c.pending}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity feed */}
                <ActivityFeed activities={scopeActivities} workspaces={workspaces} />

              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
