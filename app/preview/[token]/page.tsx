'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Workspace {
  id: string; name: string;
  primary_color: string | null; secondary_color: string | null; accent_color: string | null;
  logo_url: string | null; instagram_username: string | null;
}

interface Post {
  id: string; title: string | null; description: string | null; texte_visuel: string | null;
  photo_url: string | null; exported_image_url: string | null;
  status: string; scheduled_at: string | null; post_type: string | null;
  approved_by_client: boolean; client_comment: string | null; client_reviewed_at: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAY_FR   = ['Lu','Ma','Me','Je','Ve','Sa','Di'];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' à ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function calendarDays(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay();
  const pad   = (first + 6) % 7; // Monday-based
  const last  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(pad).fill(null);
  for (let d = 1; d <= last; d++) cells.push(d);
  return cells;
}

function statusChip(post: Post) {
  if (post.approved_by_client)    return { label: 'Approuvé',      bg: 'rgba(47,215,155,.15)', color: '#2FD79B' };
  if (post.client_comment)        return { label: 'Modif. demandée',  bg: '#FEF3C7',              color: '#D97706' };
  if (post.status === 'published') return { label: 'Publié',           bg: '#DCFCE7',              color: '#16A34A' };
  if (post.status === 'scheduled') return { label: 'Planifié',         bg: 'rgba(79,142,247,.12)', color: '#4F8EF7' };
  return { label: 'Brouillon', bg: 'var(--sunk)', color: 'var(--ink-3)' };
}

function postColor(post: Post): string {
  if (post.approved_by_client)    return '#2FD79B';
  if (post.client_comment)        return '#D97706';
  if (post.status === 'published') return '#16A34A';
  if (post.status === 'scheduled') return '#4F8EF7';
  return '#aaa';
}

// ─── Logo Klip (blanc) ────────────────────────────────────────────────────────

function KlipLogo() {
  return (
    <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: '-0.04em' }}>
      klip
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PreviewPage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [workspace, setWorkspace]   = useState<Workspace | null>(null);
  const [posts, setPosts]           = useState<Post[]>([]);
  const [tokenMeta, setTokenMeta]   = useState<{ label: string; created_at: string } | null>(null);

  // Calendar nav
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  // Post detail modal
  const [selected, setSelected]   = useState<Post | null>(null);
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment]     = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionDone, setActionDone]       = useState<'approved' | 'commented' | null>(null);

  // Load data
  useEffect(() => {
    fetch(`/api/preview/${token}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setError(d.error ?? 'Erreur'); return; }
        setWorkspace(d.workspace);
        setPosts(d.posts);
        setTokenMeta(d.tokenMeta);
      })
      .catch(() => setError('Impossible de charger la page'))
      .finally(() => setLoading(false));
  }, [token]);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };
  const goToday   = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  // Posts indexed by day (YYYY-MM-DD)
  const postsByDay: Record<string, Post[]> = {};
  for (const p of posts) {
    if (!p.scheduled_at) continue;
    const d = new Date(p.scheduled_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!postsByDay[key]) postsByDay[key] = [];
    postsByDay[key].push(p);
  }

  // Client actions
  const handleApprove = useCallback(async () => {
    if (!selected) return;
    setActionLoading(true);
    const res = await fetch(`/api/preview/${token}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: selected.id, action: 'approve' }) });
    if (res.ok) {
      setPosts(prev => prev.map(p => p.id === selected.id ? { ...p, approved_by_client: true } : p));
      setSelected(p => p ? { ...p, approved_by_client: true } : p);
      setActionDone('approved');
    }
    setActionLoading(false);
  }, [selected, token]);

  const handleComment = useCallback(async () => {
    if (!selected || !comment.trim()) return;
    setActionLoading(true);
    const res = await fetch(`/api/preview/${token}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: selected.id, action: 'comment', comment }) });
    if (res.ok) {
      setPosts(prev => prev.map(p => p.id === selected.id ? { ...p, client_comment: comment.trim() } : p));
      setSelected(p => p ? { ...p, client_comment: comment.trim() } : p);
      setActionDone('commented');
      setCommenting(false);
    }
    setActionLoading(false);
  }, [selected, token, comment]);

  // ── Loading / Error states ─────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F5F4F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#6b7280' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#2FD79B', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        Chargement…
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#F5F4F1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FEE2E2', display: 'grid', placeItems: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontWeight: 700, fontSize: 18, color: '#111', margin: 0 }}>Ce lien n&apos;est plus valide</p>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>{error}</p>
      </div>
      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>Propulsé par <strong>Klip</strong></p>
    </div>
  );

  const cells = calendarDays(year, month);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas, #F5F4F1)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header style={{ height: 56, background: '#0C2A1D', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, flexShrink: 0 }}>
        <KlipLogo />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.7)', fontFamily: 'var(--sans, sans-serif)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Programmation · <strong style={{ color: '#fff' }}>{workspace?.name}</strong>
        </span>
        <span style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 99, background: 'rgba(47,215,155,.15)', color: '#2FD79B', fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--sans, sans-serif)', whiteSpace: 'nowrap' }}>
          Vue client
        </span>
      </header>

      {/* ── Calendar ──────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '20px 16px 40px', maxWidth: 900, margin: '0 auto', width: '100%' }}>

        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid rgba(13,15,10,.12)', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
          </button>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#0D0F0A', minWidth: 180, textAlign: 'center', fontFamily: 'var(--display, sans-serif)' }}>
            {MONTH_FR[month]} {year}
          </span>
          <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid rgba(13,15,10,.12)', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
          </button>
          <button onClick={goToday} style={{ marginLeft: 4, padding: '6px 14px', borderRadius: 9, border: '1px solid rgba(13,15,10,.12)', background: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#444' }}>
            Aujourd&apos;hui
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
            {posts.length} post{posts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
          {DAY_FR.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9ca3af', padding: '6px 0', fontFamily: 'var(--mono, monospace)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={`pad-${i}`} style={{ minHeight: 80, background: 'transparent' }} />;
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const key = `${year}-${month}-${day}`;
            const dayPosts = postsByDay[key] ?? [];
            return (
              <div key={key} style={{ minHeight: 80, background: '#fff', borderRadius: 8, border: `1px solid ${isToday ? '#2FD79B' : 'rgba(13,15,10,.07)'}`, padding: '6px 5px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 11.5, fontWeight: isToday ? 800 : 500, color: isToday ? '#2FD79B' : '#6b7280', display: 'block', marginBottom: 2 }}>{day}</span>
                {dayPosts.map(p => (
                  <button key={p.id} onClick={() => { setSelected(p); setCommenting(false); setComment(''); setActionDone(null); }}
                    style={{ display: 'block', width: '100%', padding: '3px 5px', borderRadius: 5, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 10.5, fontWeight: 600, lineHeight: 1.3, background: postColor(p) + '22', color: postColor(p), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.scheduled_at ? new Date(p.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}{' '}
                    {p.title ?? p.description?.slice(0, 20) ?? 'Post'}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
          {[
            { color: '#4F8EF7', label: 'Planifié' },
            { color: '#2FD79B', label: 'Approuvé' },
            { color: '#D97706', label: 'Modification demandée' },
            { color: '#16A34A', label: 'Publié' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
              {item.label}
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ textAlign: 'center', padding: '16px 0 24px', fontSize: 12, color: '#9ca3af', fontFamily: 'var(--sans, sans-serif)' }}>
        Propulsé par <strong style={{ color: '#6b7280' }}>Klip</strong>
        {tokenMeta && (
          <span> · Lien généré le {new Date(tokenMeta.created_at).toLocaleDateString('fr-FR')}</span>
        )}
      </footer>

      {/* ── Post detail modal ──────────────────────────────────────────────── */}
      {selected && (
        <div onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,15,10,.5)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,.25)', maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Image */}
            {(selected.exported_image_url || selected.photo_url) && (
              <div style={{ width: '100%', aspectRatio: '4/5', overflow: 'hidden', borderRadius: '20px 20px 0 0', position: 'relative', background: '#000' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.exported_image_url ?? selected.photo_url ?? ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {selected.texte_visuel && (
                  <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, background: 'rgba(0,0,0,.6)', borderRadius: 8, padding: '8px 12px', backdropFilter: 'blur(4px)' }}>
                    <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>{selected.texte_visuel}</p>
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div style={{ padding: '20px 22px 24px' }}>
              {/* Status + close */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                {(() => { const s = statusChip(selected); return <span style={{ padding: '4px 10px', borderRadius: 99, background: s.bg, color: s.color, fontSize: 12, fontWeight: 700 }}>{s.label}</span>; })()}
                <button onClick={() => setSelected(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(13,15,10,.1)', background: '#f9f9f8', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#6b7280' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {/* Title */}
              {selected.title && <h3 style={{ fontWeight: 700, fontSize: 17, color: '#0D0F0A', margin: '0 0 8px', lineHeight: 1.3 }}>{selected.title}</h3>}

              {/* Description (caption) */}
              {selected.description && (
                <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6, margin: '0 0 14px', whiteSpace: 'pre-wrap' }}>{selected.description}</p>
              )}

              {/* Date */}
              {selected.scheduled_at && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 10, background: '#f9f9f8', border: '1px solid rgba(13,15,10,.07)', marginBottom: 16 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{fmtDate(selected.scheduled_at)}</span>
                </div>
              )}

              {/* Client comment existing */}
              {selected.client_comment && (
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF3C7', border: '1px solid #FCD34D', marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#D97706', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>Votre commentaire</p>
                  <p style={{ fontSize: 13, color: '#92400E', margin: 0, lineHeight: 1.5 }}>{selected.client_comment}</p>
                </div>
              )}

              {/* Action done feedback */}
              {actionDone === 'approved' && (
                <div style={{ padding: '12px', borderRadius: 12, background: 'rgba(47,215,155,.12)', border: '1px solid #2FD79B', textAlign: 'center', marginBottom: 14 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#2FD79B', margin: 0 }}>Approuvé — merci !</p>
                </div>
              )}
              {actionDone === 'commented' && (
                <div style={{ padding: '12px', borderRadius: 12, background: '#FEF3C7', border: '1px solid #FCD34D', textAlign: 'center', marginBottom: 14 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#D97706', margin: 0 }}>Commentaire envoyé</p>
                </div>
              )}

              {/* Action buttons — only if not yet reviewed */}
              {!selected.approved_by_client && !actionDone && (selected.status === 'scheduled' || selected.status === 'draft' || selected.status === 'idle') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!commenting ? (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={handleApprove} disabled={actionLoading} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#2FD79B', color: '#06281C', fontWeight: 700, fontSize: 14, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        Approuver
                      </button>
                      <button onClick={() => setCommenting(true)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #EF4444', background: 'transparent', color: '#EF4444', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        Modifier
                      </button>
                    </div>
                  ) : (
                    <>
                      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Décrivez la modification souhaitée…" rows={3}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(13,15,10,.15)', fontSize: 13.5, color: '#0D0F0A', outline: 'none', resize: 'none', lineHeight: 1.5, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setCommenting(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(13,15,10,.12)', background: '#f9f9f8', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#6b7280' }}>Annuler</button>
                        <button onClick={handleComment} disabled={!comment.trim() || actionLoading} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: (!comment.trim() || actionLoading) ? 'not-allowed' : 'pointer', opacity: (!comment.trim() || actionLoading) ? 0.6 : 1 }}>
                          Envoyer la demande
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
