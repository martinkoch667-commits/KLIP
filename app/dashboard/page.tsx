'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import NotificationBell from '@/components/NotificationBell';
import { Sticker } from '@/components/Stickers';
import SelFrame from '@/components/SelFrame';
import MediaThumb, { pickThumbSource, thumbUrl } from '@/components/MediaThumb';

// ─── Types ─────────────────────────────────────────────────────────────────

interface WorkspaceRow {
  id: string;
  name: string;
  instagram_account_id?: string | null;
  instagram_username?: string | null;
  logo_url?: string | null;
}

interface PostRow {
  id: string;
  workspace_id: string;
  status: string;
  photo_url: string | null;
  exported_image_url: string | null;
  thumbnail_url: string | null;
  texte_visuel: string | null;
  scheduled_at: string | null;
  created_at: string;
}

function PostThumb({ post }: { post: PostRow }) {
  return <MediaThumb raw={pickThumbSource(post.exported_image_url, post.thumbnail_url, post.photo_url)} />;
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
  const t = useTranslations('dashboard');
  const hasMedia = !!(post.exported_image_url || post.thumbnail_url || post.photo_url);
  const statusLabel = post.status === 'generated' ? t('statusToValidate') : post.status === 'validated' ? t('statusReady') : t('statusDraft');
  const statusBg = post.status === 'generated' ? 'var(--warn-soft)' : post.status === 'validated' ? 'var(--mint-soft)' : 'var(--sunk)';
  const statusColor = post.status === 'generated' ? 'var(--warn)' : post.status === 'validated' ? 'var(--mint-2)' : 'var(--ink-3)';
  return (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', borderRadius: 10, overflow: 'hidden' }}
    >
      <div style={{ aspectRatio: '3/4', borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'var(--sunk)' }}>
        {hasMedia ? (
          <PostThumb post={post} />
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

interface IGProfile { username: string; media_count?: number; biography?: string; followers_count?: number; follows_count?: number; profile_picture_url?: string; }
interface IGMedia { id: string; media_type?: string; media_url?: string; thumbnail_url?: string; display_url?: string | null; }

function fmtCount(n?: number) {
  if (n == null) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function InstagramProfile({ workspaceId, upcoming = [] }: { workspaceId: string; upcoming?: PostRow[] }) {
  const t = useTranslations('dashboard');
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
        // no-store: Instagram media_url expire in hours — always fetch fresh, never use browser cache
        const res = await fetch(`/api/instagram/profile?workspaceId=${workspaceId}`, { cache: 'no-store' });
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
        <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>{t('loading')}</span>
      </div>
    );
  }

  if (!wsInfo?.connected) {
    return (
      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
        <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--sunk)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
          <IconInstagram />
        </span>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{t('igNotConnected')}</p>
        <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>{t('igConnectHint')}</p>
        <Link href={`/workspace/${workspaceId}/parametres`} className="btn btn-dark btn-sm" style={{ marginTop: 4 }}>
          {t('connectInstagram')}
        </Link>
      </div>
    );
  }

  const initials = (wsInfo?.name ?? '??').slice(0, 2).toUpperCase();
  const handle = profile?.username ?? wsInfo?.name;

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 0' }}>
        <span className="label">{t('feedPreview')}</span>
      </div>
      {/* Header */}
      <div style={{ padding: '14px 16px 12px' }}>
        {/* Handle + badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>@{handle}</span>
          <span className="badge" style={{ background: 'var(--mint-soft)', color: 'var(--mint-2)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mint-2)', flexShrink: 0 }} />
            {t('connected')}
          </span>
        </div>

        {/* Avatar + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Gradient ring avatar — real photo if available */}
          <div style={{ padding: 2.5, borderRadius: '50%', background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)', flexShrink: 0 }}>
            {profile?.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/proxy-image?url=${encodeURIComponent(profile.profile_picture_url)}`}
                alt={profile.username}
                style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#7B5CF5', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'var(--mono)' }}>
                {initials}
              </div>
            )}
          </div>
          {/* 3 stats */}
          <div style={{ display: 'flex', flex: 1 }}>
            {[
              { v: fmtCount(profile?.media_count), l: t('posts') },
              { v: fmtCount(profile?.followers_count), l: t('followers') },
              { v: fmtCount(profile?.follows_count), l: t('following') },
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
        media.length === 0 && upcoming.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>{t('noPost')}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {/* À venir d'abord : sur un profil, le prochain post se posera en
                haut à gauche. Liseré leaf pour ne pas les confondre avec le
                réel déjà publié. */}
            {upcoming.map(p => {
              const when = p.scheduled_at
                ? new Date(p.scheduled_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                : null;
              return (
                <Link key={`up-${p.id}`} href={`/workspace/${workspaceId}/editor/${p.id}`}
                  title={p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : undefined}
                  style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: 'var(--sunk)', display: 'block' }}>
                  <PostThumb post={p} />
                  {/* Un liseré seul ne suffisait pas à distinguer le programmé
                      du déjà publié : la pastille nomme l'état et donne la date. */}
                  <span style={{
                    position: 'absolute', top: 5, left: 5, display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '2px 6px', borderRadius: 999, background: 'var(--leaf)', color: '#0B1F14',
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '.02em', lineHeight: 1.5, pointerEvents: 'none',
                  }}>
                    {t('scheduledBadge')}{when ? ` · ${when}` : ''}
                  </span>
                  <span style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 2px var(--leaf)', pointerEvents: 'none' }} />
                </Link>
              );
            })}
            {media.map(m => {
              // display_url est calculé côté serveur : la vignette pour une
              // vidéo, l'image elle-même sinon (cf. /api/instagram/profile).
              const rawSrc = m.display_url ?? m.thumbnail_url ?? m.media_url;
              // Route via proxy to avoid CORS — Instagram media_url are cross-origin
              const src = rawSrc ? `/api/proxy-image?url=${encodeURIComponent(rawSrc)}` : null;
              const isVideo = m.media_type === 'VIDEO';
              return (
                <div key={m.id} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: 'var(--sunk)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  {isVideo && (
                    <span style={{ position: 'absolute', top: 6, right: 6, color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))', pointerEvents: 'none' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h7A2.5 2.5 0 0 1 16 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 17.5v-11ZM18 9l4-2.5v11L18 15V9Z"/></svg>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>{t('comingSoon')}</div>
      )}
    </div>
  );
}

// ─── ActivityFeed ───────────────────────────────────────────────────────────

const ACTION_KEYS: Record<string, string> = {
  post_created:   'actPostCreated',
  post_validated: 'actPostValidated',
  post_published: 'actPostPublished',
  post_deleted:   'actPostDeleted',
  workspace_created: 'actWorkspaceCreated',
};

function timeAgo(dateStr: string, t: (k: string, v?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('justNow');
  if (m < 60) return t('minAgo', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('hoursAgo', { h });
  const d = Math.floor(h / 24);
  return t('daysAgo', { d });
}

function ActivityFeed({ activities, workspaces }: { activities: ActivityRow[]; workspaces: WorkspaceRow[] }) {
  const t = useTranslations('dashboard');
  const wsMap = Object.fromEntries(workspaces.map((w, i) => [w.id, { name: w.name, color: wsColor(i) }]));
  return (
    <div className="card" style={{ padding: 20, flex: 1 }}>
      <h2 className="h-title" style={{ fontSize: 15, marginBottom: 16 }}>{t('recentActivity')}</h2>
      {activities.length === 0 ? (
        <div style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>{t('noActivity')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {activities.map(a => {
            const ws = wsMap[a.workspace_id];
            const label = ACTION_KEYS[a.action_type] ? t(ACTION_KEYS[a.action_type]) : a.action_type;
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
                    {ws?.name ?? t('clientFallback')} · {timeAgo(a.created_at, t as unknown as (k: string, v?: Record<string, unknown>) => string)}
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
  const t = useTranslations('dashboard');
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
        <span style={{ fontWeight: 700, fontSize: 13 }}>{cur ? cur.name : t('allClients')}</span>
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
            <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{t('allClients')}</span>
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

// ─── WorkspaceCard ──────────────────────────────────────────────────────────

function WorkspaceCard({ workspace, posts, color, index, onOpen }: {
  workspace: WorkspaceRow;
  posts: PostRow[];
  color: string;
  index: number;
  onOpen: () => void;
}) {
  const t = useTranslations('dashboard');
  const wsPosts = posts.filter(p => p.workspace_id === workspace.id);
  const pending = wsPosts.filter(p => p.status === 'generated').length;
  const scheduled = wsPosts.filter(p => p.scheduled_at).length;
  const recentWithImg = wsPosts.filter(p => p.exported_image_url || p.photo_url).slice(0, 3);
  const initials = wsInitials(workspace.name);

  return (
    <div className="card card-hover" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={onOpen}>
      <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Identité : la photo de profil du compte quand on l'a, les initiales
            sinon. Cerclée de leaf comme un avatar Instagram. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            display: 'grid', placeItems: 'center', background: color,
            boxShadow: '0 0 0 2px var(--white), 0 0 0 4px var(--leaf)',
          }}>
            {workspace.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={thumbUrl(workspace.logo_url, 128)} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'var(--mono)' }}>{initials}</span>}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="h-title" style={{ fontSize: 15.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workspace.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
              {/* Le pseudo seul ne prouve rien : il se saisit à la main. */}
              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: workspace.instagram_account_id ? 'var(--mint-2)' : 'var(--line)' }} />
              {workspace.instagram_account_id ? `@${workspace.instagram_username ?? 'Instagram'}` : t('igNotConnected')}
            </div>
          </div>
        </div>

        {/* Derniers visuels — carrés, gouttière serrée : un extrait de feed,
            pas trois vignettes posées là. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, borderRadius: 10, overflow: 'hidden' }}>
          {Array.from({ length: 3 }).map((_, i) => {
            const p = recentWithImg[i];
            const src = p ? (p.exported_image_url || p.photo_url) : null;
            return (
              <div key={p?.id ?? `empty-${i}`} style={{ aspectRatio: '1', background: 'var(--sunk)', overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
            );
          })}
        </div>

        {/* Chiffres + action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
          <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)' }}>
            <b style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--ink)' }}>{scheduled}</b> {t('scheduledShort')}
          </span>
          {pending > 0 && (
            <span className="chip" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
              <b style={{ fontFamily: 'var(--mono)', fontWeight: 800 }}>{pending}</b> {t('toValidateShort')}
            </span>
          )}
          <span className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto', pointerEvents: 'none' }}>
            {t('open')} <IconChevR />
          </span>
        </div>
      </div>
    </div>
  );
}

// useSearchParams doit être isolé dans un enfant sous Suspense (sinon Next.js
// désactive le prérendu statique de toute la page).
function WelcomeParamWatcher({ onWelcome }: { onWelcome: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      onWelcome();
      router.replace('/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  return null;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [active, setActive] = useState<string>('all');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  // Reprise d'un Checkout demandé depuis la landing avant inscription
  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem('klip_pending_checkout'); } catch { raw = null; }
    if (!raw) return;
    try { localStorage.removeItem('klip_pending_checkout'); } catch {}
    try {
      const { plan, period } = JSON.parse(raw);
      fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, period }) })
        .then(r => r.json())
        .then(j => { if (j?.url) window.location.href = j.url; })
        .catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/login'); return; }
        setUserName(session.user.email?.split('@')[0] ?? 'vous');

        // Load workspaces first — critical for ClientSwitcher
        const { data: ws, error: wsErr } = await supabase
          .from('workspaces')
          .select('id, name, instagram_account_id, instagram_username, logo_url')
          .order('created_at', { ascending: true });
        console.log('[Dashboard] workspaces query result:', { ws, wsErr });
        setWorkspaces(ws ?? []);
        console.log('[Dashboard] setWorkspaces called with:', ws ?? []);

        // Load posts + activity in parallel (activity_log may not exist yet)
        const [{ data: ps }, { data: acts }] = await Promise.all([
          supabase.from('posts').select('id, workspace_id, status, photo_url, exported_image_url, thumbnail_url, texte_visuel, scheduled_at, created_at').order('created_at', { ascending: false }),
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

  const today = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
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
        <header className="topbar" data-tour="dashboard">
          <ClientSwitcher active={active} workspaces={workspaces} onChange={setActive} />
          <div style={{ width: 1, height: 24, background: 'var(--line)', flexShrink: 0 }} />
          <span className="h-title" style={{ fontSize: 15, whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>{t('title')}</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationBell />
            {active !== 'all' ? (
              <Link href={`/workspace/${active}`} className="btn btn-primary">
                <IconPlus /> {t('newPost')}
              </Link>
            ) : (
              <Link href="/workspace/new" className="btn btn-dark">
                <IconSpark /> {t('newClient')}
              </Link>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div className="page screen-in">

            {/* Hero */}
            <div style={{ position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden', padding: '30px 32px', marginBottom: 16, background: 'linear-gradient(120deg, #0A2418 0%, var(--forest) 48%, #103A28 100%)', color: 'var(--cream)' }}>
              <div className="halo-blob" style={{ width: 300, height: 300, right: -70, top: -150, background: 'var(--leaf)', opacity: .42 }} />
              <div className="halo-blob" style={{ width: 220, height: 220, right: 180, bottom: -150, background: 'var(--acid)', opacity: .28 }} />
              {/* stickers décoratifs (coins, derrière le contenu z:2) */}
              <Sticker name="sparkle" size={34} float="spin" style={{ position: 'absolute', bottom: 26, right: 330, zIndex: 3 }} />
              <div data-tour="hero" style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1fr auto', gap: 28, alignItems: 'center' }} className="dash-hero">
                <div>
                  <div className="label" style={{ color: 'var(--leaf)', marginBottom: 12 }}>
                    {today.charAt(0).toUpperCase() + today.slice(1)} · {t('greeting', { name: userName })}
                  </div>
                  {/* Sticker accolé au titre — en bas à gauche il passait derrière les boutons. */}
                  <h1 className="h-display" style={{ position: 'relative', fontSize: 38, color: 'var(--cream)', maxWidth: 520 }}>
                    {active === 'all'
                      ? <>{t('heroAllPre')}<span className="acc-hl">{t('heroAllAccent')}</span></>
                      : <>{t('heroClientPre')}<span className="acc-hl">{clientName}.</span></>}
                    <Sticker name="heart" size={34} float="A" style={{ position: 'absolute', top: -14, right: -26, ['--r' as string]: '12deg' }} />
                  </h1>
                  <p style={{ color: 'var(--cream-2)', marginTop: 10, maxWidth: 460, fontSize: 14.5 }}>
                    {pendingPosts > 0
                      ? t('pendingValidation', { count: pendingPosts })
                      : t('allGood')}
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                    {active !== 'all' ? (
                      <Link href={`/workspace/${active}`} className="btn btn-primary"><IconSpark /> {t('composeAI')}</Link>
                    ) : (
                      <Link href="/composer" className="btn btn-primary"><IconSpark /> {t('composeAI')}</Link>
                    )}
                    {active !== 'all' && (
                      <Link href={`/workspace/${active}/planning`} className="btn" style={{ background: 'var(--cream-4)', color: 'var(--cream)', boxShadow: 'inset 0 0 0 1px var(--cream-3)' }}>
                        <IconCalendar /> {t('calendar')}
                      </Link>
                    )}
                  </div>
                </div>

                {/* glass panel: today's posts — « sélectionné » et posé de biais,
                    comme le panneau de session du plan de travail. */}
                <span className="sel dash-hero-card" style={{ rotate: '1.6deg' }}>
                {/* Carton blanc posé sur la bannière : le verre dépoli jurait
                    avec le cadre de sélection (décision Martin). */}
                <div style={{ width: 256, borderRadius: 'var(--r-l)', background: 'var(--white)', boxShadow: '0 18px 40px -22px rgba(0,0,0,.55)', padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--leaf)', color: 'var(--mint-ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <IconBolt />
                    </span>
                    <span className="label">{t('toPublishToday')}</span>
                    <span className="num" style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--ink)' }}>{todayPosts}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {upcoming.slice(0, 3).map(p => {
                      const src = p.exported_image_url || p.photo_url;
                      const ws = workspaces.find(w => w.id === p.workspace_id);
                      return (
                        <button key={p.id}
                          onClick={() => router.push(`/workspace/${p.workspace_id}/editor/${p.id}`)}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: 6, borderRadius: 9, textAlign: 'left', transition: 'background .14s', background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', color: 'var(--ink)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div style={{ width: 28, height: 34, borderRadius: 6, background: 'var(--sunk)', flexShrink: 0, overflow: 'hidden' }}>
                            {src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: 'block', fontWeight: 700, fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.texte_visuel?.slice(0, 28) || t('postFallback')}
                            </span>
                            <span style={{ fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 600 }}>
                              {ws?.name ?? t('clientFallback')}{p.scheduled_at ? ' · ' + new Date(p.scheduled_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                    {upcoming.length === 0 && (
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0' }}>
                        {t('noUpcoming')}
                      </div>
                    )}
                  </div>
                </div>
                  <SelFrame />
                </span>
              </div>
            </div>

            {/* Stat tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }} className="dash-stats">
              <StatTile value={todayPosts} label={t('toPublishToday')} icon={<IconBolt />} tone="mint" sub={t('statAuto')} />
              <StatTile value={pendingPosts} label={t('statPending')} icon={<IconClock />} tone="warn" />
              <StatTile value={scheduledPosts} label={t('statScheduled')} icon={<IconCalendar />} />
              <StatTile
                value={active === 'all' ? workspaces.length : 1}
                label={active === 'all' ? t('statClients') : t('statConnected')}
                icon={<IconInstagram />}
              />
            </div>

            {/* All clients: workspace card grid */}
            {active === 'all' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h2 className="h-title" style={{ fontSize: 17 }}>{t('yourClients')}</h2>
                  <Link href="/workspace/new" className="btn btn-primary">
                    <IconPlus /> {t('addClient')}
                  </Link>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }} className="clients-grid">
                  {workspaces.map((w, i) => (
                    <WorkspaceCard
                      key={w.id}
                      workspace={w}
                      posts={posts}
                      color={wsColor(i)}
                      index={i}
                      onOpen={() => setActive(w.id)}
                    />
                  ))}
                  {/* Add new client card */}
                  <Link href="/workspace/new"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 220, borderRadius: 'var(--r)', border: '1.5px solid var(--line)', color: 'var(--ink-3)', textDecoration: 'none', transition: 'all .15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--mint-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--mint-2)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line)'; (e.currentTarget as HTMLElement).style.color = 'var(--ink-3)'; }}
                  >
                    <span style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--sunk)', display: 'grid', placeItems: 'center' }}><IconPlus /></span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{t('newClientSpace')}</span>
                  </Link>
                </div>

                {/* Activity feed below */}
                <ActivityFeed activities={scopeActivities} workspaces={workspaces} />
              </>
            )}

            {/* Single client: detailed grid */}
            {active !== 'all' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 14 }} className="dash-grid">

                {/* Upcoming posts */}
                <div className="card" style={{ padding: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <h2 className="h-title" style={{ fontSize: 17 }}>{t('upcomingPublications')}</h2>
                    <Link href={`/workspace/${active}/planning`} className="btn btn-sm btn-ghost">
                      {t('viewAll')} <IconChevR />
                    </Link>
                  </div>
                  {upcoming.length === 0 ? (
                    <div style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                      {t('noPostInProgress')}
                      <div style={{ marginTop: 12 }}>
                        <Link href={`/workspace/${active}`} className="btn btn-primary btn-sm">
                          <IconPlus /> {t('createPost')}
                        </Link>
                      </div>
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
                  <InstagramProfile workspaceId={active} upcoming={upcoming} />
                  <ActivityFeed activities={scopeActivities} workspaces={workspaces} />
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      <OnboardingChecklist />
      <Suspense fallback={null}>
        {/* Nettoie ?welcome=true de l'URL. La modale Claude ne s'ouvre plus
            ici : on ne demande pas de brancher un outil tiers à quelqu'un qui
            découvre l'app et n'a pas encore un seul client. Elle reste dans
            Réglages, pour qui la cherche. */}
        <WelcomeParamWatcher onWelcome={() => {}} />
      </Suspense>
    </div>
  );
}
