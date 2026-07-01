'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: 'post_published' | 'post_failed' | 'post_pending_review' | 'post_approved' | 'post_rejected' | 'post_revision_requested';
  title: string;
  message: string;
  post_id: string | null;
  post_title: string | null;
  workspace_id: string;
  read: boolean;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'il y a quelques secondes';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

// ─── Type icon ────────────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: Notification['type'] }) {
  const styles: Record<string, { bg: string; color: string }> = {
    post_published:         { bg: '#DCFCE7', color: '#16A34A' },
    post_failed:            { bg: '#FEE2E2', color: '#DC2626' },
    post_pending_review:    { bg: '#FEF3C7', color: '#D97706' },
    post_approved:          { bg: 'rgba(47,215,155,.15)', color: '#2FD79B' },
    post_rejected:          { bg: '#FEF3C7', color: '#D97706' },
    post_revision_requested:{ bg: '#FEF3C7', color: '#D97706' },
  };
  const s = styles[type] ?? styles.post_published;
  const isOk = type === 'post_published' || type === 'post_approved';
  const isKo = type === 'post_failed' || type === 'post_rejected';
  const isPending = type === 'post_pending_review' || type === 'post_revision_requested';
  return (
    <span style={{ width: 30, height: 30, borderRadius: '50%', background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {isOk && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
      {isKo && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>}
      {isPending && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
    </span>
  );
}

// ─── Bell icon ────────────────────────────────────────────────────────────────

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const supabase = createClientComponentClient();
  const router   = useRouter();

  const [open, setOpen]                = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]  = useState(0);
  const [userId, setUserId]            = useState<string | null>(null);
  const [loading, setLoading]          = useState(true);
  const [errorMsg, setErrorMsg]        = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, [supabase]);

  // ── Fetch notifications ───────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) {
        let detail = '';
        try { const j = await res.json(); detail = j?.error ? ` — ${j.error}` : ''; } catch { /* ignore */ }
        setErrorMsg(`Erreur ${res.status}${detail}`);
        setNotifications([]);
        return;
      }
      const { notifications: data } = await res.json();
      const list: Notification[] = Array.isArray(data) ? data : [];
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.read).length);
      setErrorMsg(null);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setLoading(false); // ne reste JAMAIS bloqué sur "Chargement…"
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase]);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Mark one as read ──────────────────────────────────────────────────────
  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  }, []);

  // ── Mark all as read ──────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
  }, []);

  // ── Click notification ────────────────────────────────────────────────────
  const handleNotifClick = useCallback(async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    setOpen(false);
    if (n.post_id && n.workspace_id) {
      router.push(`/workspace/${n.workspace_id}/editor/${n.post_id}`);
    }
  }, [markRead, router]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="btn btn-ghost btn-icon"
        title="Notifications"
        style={{ position: 'relative' }}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            minWidth: 18, height: 18, borderRadius: 99,
            background: '#EF4444', color: '#fff',
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--display)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', lineHeight: 1,
            boxShadow: '0 0 0 2px var(--canvas)',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 380, maxWidth: 'calc(100vw - 24px)',
          background: 'var(--white)',
          borderRadius: 'var(--r-l)',
          boxShadow: 'var(--shadow-pop)',
          border: '1px solid var(--line)',
          zIndex: 500,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 13, color: 'var(--mint-2)', padding: 0 }}
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', maxHeight: 480 }}>
            {loading ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
            ) : errorMsg ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--warn)', fontSize: 12.5, lineHeight: 1.5 }}>Impossible de charger les notifications.<br /><span style={{ color: 'var(--ink-3)' }}>{errorMsg}</span></div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--ink-3)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .45 }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Aucune notification pour l&apos;instant</span>
              </div>
            ) : notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotifClick(n)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--line)',
                  background: n.read ? 'transparent' : 'rgba(47,215,155,.04)',
                  cursor: n.post_id ? 'pointer' : 'default',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
                onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(47,215,155,.04)')}
              >
                {/* Unread dot */}
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? 'transparent' : '#2FD79B', flexShrink: 0, marginTop: 11 }} />

                {/* Type icon */}
                <NotifIcon type={n.type} />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', lineHeight: 1.35, marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontFamily: 'var(--sans)', fontWeight: 400, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45, marginBottom: 5 }}>{n.message}</div>
                  <div style={{ fontFamily: 'var(--sans)', fontWeight: 400, fontSize: 12, color: 'var(--ink-3)' }}>{relativeTime(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
