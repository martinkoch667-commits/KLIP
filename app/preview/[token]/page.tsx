'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';

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

function KlipLogo({ size = 26 }: { size?: number }) {
  return <Image src="/logo-klip-mint.png" alt="Klip" width={1096} height={408} priority style={{ height: size, width: 'auto' }} />;
}

// ─── Styles (page client) ───────────────────────────────────────────────────
const CW_CSS = `
.cw-root { min-height:100vh; background:var(--canvas,#F4F3EC); display:flex; flex-direction:column; font-family:var(--sans,system-ui,sans-serif); color:#0D0F0A; }
.cw-header { position:sticky; top:0; z-index:20; height:60px; background:#0C2A1D; display:flex; align-items:center; gap:14px; padding:0 20px; }
.cw-header-title { flex:1; text-align:center; font-size:14px; font-weight:600; color:rgba(255,255,255,.92); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cw-badge { flex-shrink:0; padding:5px 11px; border-radius:99px; background:rgba(52,224,161,.16); color:#34E0A1; font-size:11.5px; font-weight:700; }
.cw-period { background:#082016; color:rgba(255,255,255,.82); text-align:center; padding:9px 16px; font-size:12.5px; font-weight:600; }
.cw-main { flex:1; width:100%; max-width:920px; margin:0 auto; padding:24px 18px 56px; box-sizing:border-box; }
.cw-intro { display:flex; align-items:center; justify-content:space-between; gap:16px; background:#fff; border:1px solid rgba(13,15,10,.07); border-radius:16px; padding:18px 20px; margin-bottom:22px; box-shadow:0 1px 2px rgba(13,15,10,.04); }
.cw-intro-title { font-family:var(--display,sans-serif); font-size:19px; font-weight:800; letter-spacing:-.02em; margin:0 0 4px; }
.cw-intro-sub { font-size:13px; color:#6b7280; margin:0; line-height:1.45; }
.cw-progress { flex-shrink:0; text-align:center; background:var(--canvas,#F4F3EC); border-radius:12px; padding:8px 18px; }
.cw-progress-num { display:block; font-family:var(--display,sans-serif); font-size:22px; font-weight:800; color:#0C2A1D; line-height:1; }
.cw-progress-num small { color:#9ca3af; font-weight:700; }
.cw-progress-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#9ca3af; }
.cw-nav { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
.cw-nav-btn { width:38px; height:38px; border-radius:10px; border:1px solid rgba(13,15,10,.1); background:#fff; cursor:pointer; display:grid; place-items:center; color:#0D0F0A; transition:.15s; }
.cw-nav-btn:hover { border-color:rgba(13,15,10,.24); }
.cw-month { font-family:var(--display,sans-serif); font-weight:800; font-size:19px; letter-spacing:-.02em; min-width:158px; text-align:center; }
.cw-today-btn { margin-left:4px; padding:8px 14px; border-radius:10px; border:1px solid rgba(13,15,10,.1); background:#fff; cursor:pointer; font-size:12.5px; font-weight:600; color:#374151; }
.cw-count { margin-left:auto; font-size:12.5px; color:#9ca3af; font-weight:600; }
.cw-dows { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; margin-bottom:6px; }
.cw-dow { text-align:center; font-size:10.5px; font-weight:800; color:#9ca3af; text-transform:uppercase; letter-spacing:.08em; }
.cw-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; }
.cw-cell { min-height:104px; background:#fff; border-radius:12px; border:1px solid rgba(13,15,10,.07); padding:7px 6px 6px; display:flex; flex-direction:column; gap:4px; }
.cw-cell--pad { background:transparent; border:none; min-height:0; }
.cw-cell--today { border-color:#2FD79B; box-shadow:0 0 0 1px #2FD79B inset; }
.cw-daynum { font-size:11.5px; font-weight:700; color:#9ca3af; padding:0 2px; }
.cw-daynum--today { color:#16A36F; }
.cw-chip { position:relative; height:54px; border-radius:9px; border:none; padding:0; cursor:pointer; overflow:hidden; background:#E8E7DD; display:block; width:100%; transition:transform .12s, box-shadow .12s; }
.cw-chip:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(13,15,10,.18); }
.cw-chip-img { position:absolute; inset:0; background-size:cover; background-position:center; }
.cw-chip-ph { position:absolute; inset:0; display:grid; place-items:center; color:#b5b3a4; }
.cw-chip-bar { position:absolute; left:0; right:0; bottom:0; display:flex; align-items:center; gap:4px; padding:4px 6px; background:linear-gradient(transparent, rgba(0,0,0,.72)); }
.cw-chip-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.cw-chip-time { font-size:10px; font-weight:800; color:#fff; letter-spacing:.02em; }
.cw-flag { position:absolute; top:4px; right:4px; width:17px; height:17px; border-radius:50%; font-size:10px; font-weight:900; display:grid; place-items:center; box-shadow:0 1px 3px rgba(0,0,0,.3); }
.cw-legend { display:flex; gap:18px; margin-top:22px; flex-wrap:wrap; }
.cw-legend-item { display:flex; align-items:center; gap:6px; font-size:12px; color:#6b7280; }
.cw-legend-dot { width:10px; height:10px; border-radius:3px; }
.cw-footer { text-align:center; padding:18px 0 28px; font-size:12px; color:#9ca3af; }
.cw-overlay { position:fixed; inset:0; background:rgba(8,32,22,.55); backdrop-filter:blur(5px); z-index:500; display:flex; align-items:center; justify-content:center; padding:16px; animation:cwFade .15s ease; }
.cw-modal { background:#fff; border-radius:22px; box-shadow:0 30px 70px rgba(0,0,0,.3); max-width:430px; width:100%; max-height:92vh; overflow-y:auto; animation:cwPop .2s cubic-bezier(.16,1,.3,1); }
.cw-acct { display:flex; align-items:center; gap:10px; padding:13px 15px; }
.cw-avatar { width:36px; height:36px; border-radius:50%; background:#0C2A1D; color:#34E0A1; font-weight:800; font-size:13px; display:grid; place-items:center; overflow:hidden; flex-shrink:0; background-size:cover; background-position:center; }
.cw-acct-name { font-weight:700; font-size:13.5px; color:#0D0F0A; line-height:1.2; }
.cw-acct-sub { font-size:11.5px; color:#9ca3af; }
.cw-modal-close { margin-left:auto; width:30px; height:30px; border-radius:50%; border:1px solid rgba(13,15,10,.1); background:#f7f6f3; cursor:pointer; display:grid; place-items:center; color:#6b7280; flex-shrink:0; }
.cw-modal-img { width:100%; aspect-ratio:4/5; object-fit:cover; background:#0D0F0A; display:block; }
.cw-modal-body { padding:16px 18px 20px; }
.cw-modal-cap { font-size:13.5px; color:#1f2937; line-height:1.6; margin:0 0 14px; white-space:pre-wrap; }
.cw-meta-row { display:flex; align-items:center; gap:7px; padding:9px 12px; border-radius:10px; background:var(--canvas,#F4F3EC); margin-bottom:14px; }
.cw-meta-txt { font-size:12.5px; color:#4b5563; font-weight:600; }
.cw-btn { flex:1; padding:13px; border-radius:12px; border:none; font-weight:700; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px; transition:.12s; }
.cw-btn-approve { background:#2FD79B; color:#06281C; }
.cw-btn-approve:hover { background:#28c78d; }
.cw-btn-modify { background:#fff; color:#0D0F0A; border:1.5px solid rgba(13,15,10,.16); }
.cw-btn-modify:hover { border-color:rgba(13,15,10,.3); }
.cw-textarea { width:100%; padding:11px 12px; border-radius:10px; border:1.5px solid rgba(13,15,10,.15); font-size:13.5px; color:#0D0F0A; outline:none; resize:none; line-height:1.5; font-family:inherit; box-sizing:border-box; }
.cw-textarea:focus { border-color:#2FD79B; }
@keyframes cwFade { from { opacity:0 } to { opacity:1 } }
@keyframes cwPop { from { opacity:0; transform:translateY(12px) scale(.98) } to { opacity:1; transform:none } }
@media (max-width:640px) {
  .cw-main { padding:16px 10px 40px; }
  .cw-intro { flex-direction:column; align-items:flex-start; padding:14px 16px; }
  .cw-grid, .cw-dows { gap:4px; }
  .cw-cell { min-height:80px; border-radius:9px; padding:5px 4px 4px; }
  .cw-chip { height:42px; }
  .cw-month { font-size:16px; min-width:120px; }
  .cw-count { display:none; }
}
`;

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PreviewPage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [workspace, setWorkspace]   = useState<Workspace | null>(null);
  const [posts, setPosts]           = useState<Post[]>([]);
  const [tokenMeta, setTokenMeta]   = useState<{ label: string; created_at: string; date_from?: string | null; date_to?: string | null } | null>(null);

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
        // Ouvrir le calendrier sur le mois de début de la période partagée
        if (d.tokenMeta?.date_from) {
          const df = new Date(d.tokenMeta.date_from);
          setYear(df.getFullYear());
          setMonth(df.getMonth());
        }
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
    <div className="cw-root">
      <style>{CW_CSS}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="cw-header">
        <KlipLogo />
        <span className="cw-header-title">{workspace?.name ?? 'Programmation'}</span>
        <span className="cw-badge">Vue client</span>
      </header>

      {(tokenMeta?.date_from || tokenMeta?.date_to) && (
        <div className="cw-period">
          Période à valider · {tokenMeta?.date_from ? new Date(tokenMeta.date_from).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '…'}
          {' → '}{tokenMeta?.date_to ? new Date(tokenMeta.date_to).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '…'}
        </div>
      )}

      {/* ── Calendar ──────────────────────────────────────────────────────── */}
      <main className="cw-main">

        {/* Intro + progression */}
        <div className="cw-intro">
          <div>
            <h1 className="cw-intro-title">Validez vos prochaines publications</h1>
            <p className="cw-intro-sub">Cliquez sur une publication pour l’approuver ou demander une modification.</p>
          </div>
          {posts.length > 0 && (
            <div className="cw-progress">
              <span className="cw-progress-num">{posts.filter(p => p.approved_by_client || p.client_comment).length}<small>/{posts.length}</small></span>
              <span className="cw-progress-label">traitées</span>
            </div>
          )}
        </div>

        {/* Month nav */}
        <div className="cw-nav">
          <button className="cw-nav-btn" onClick={prevMonth} aria-label="Mois précédent">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
          </button>
          <span className="cw-month">{MONTH_FR[month]} {year}</span>
          <button className="cw-nav-btn" onClick={nextMonth} aria-label="Mois suivant">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
          </button>
          <button className="cw-today-btn" onClick={goToday}>Aujourd’hui</button>
          <span className="cw-count">{posts.length} publication{posts.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Day headers */}
        <div className="cw-dows">
          {DAY_FR.map(d => <div key={d} className="cw-dow">{d}</div>)}
        </div>

        {/* Calendar grid */}
        <div className="cw-grid">
          {cells.map((day, i) => {
            if (day === null) return <div key={`pad-${i}`} className="cw-cell cw-cell--pad" />;
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const key = `${year}-${month}-${day}`;
            const dayPosts = postsByDay[key] ?? [];
            return (
              <div key={key} className={`cw-cell${isToday ? ' cw-cell--today' : ''}`}>
                <span className={`cw-daynum${isToday ? ' cw-daynum--today' : ''}`}>{day}</span>
                {dayPosts.map(p => {
                  const img  = p.exported_image_url || p.photo_url;
                  const time = p.scheduled_at ? new Date(p.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <button key={p.id} className="cw-chip"
                      onClick={() => { setSelected(p); setCommenting(false); setComment(''); setActionDone(null); }}>
                      {img
                        ? <span className="cw-chip-img" style={{ backgroundImage: `url(${img})` }} />
                        : <span className="cw-chip-ph"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 20"/></svg></span>}
                      <span className="cw-chip-bar">
                        <span className="cw-chip-dot" style={{ background: postColor(p) }} />
                        <span className="cw-chip-time">{time}</span>
                      </span>
                      {p.approved_by_client && <span className="cw-flag" style={{ background: '#2FD79B', color: '#06281C' }}>✓</span>}
                      {!p.approved_by_client && p.client_comment && <span className="cw-flag" style={{ background: '#F59E0B', color: '#fff' }}>!</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="cw-legend">
          {[
            { color: '#4F8EF7', label: 'Planifié' },
            { color: '#2FD79B', label: 'Approuvé' },
            { color: '#D97706', label: 'Modification demandée' },
            { color: '#16A34A', label: 'Publié' },
          ].map(item => (
            <div key={item.label} className="cw-legend-item">
              <span className="cw-legend-dot" style={{ background: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="cw-footer">
        Propulsé par <strong style={{ color: '#6b7280' }}>Klip</strong>
        {tokenMeta && (
          <span> · Lien généré le {new Date(tokenMeta.created_at).toLocaleDateString('fr-FR')}</span>
        )}
      </footer>

      {/* ── Fiche post (façon publication Instagram) ───────────────────────── */}
      {selected && (() => {
        const img = selected.exported_image_url || selected.photo_url;
        const handle = workspace?.instagram_username ? `@${workspace.instagram_username}` : 'Publication proposée';
        const avatarInitials = (workspace?.name ?? 'C').trim().slice(0, 2).toUpperCase();
        const canAct = !selected.approved_by_client && !actionDone && (selected.status === 'scheduled' || selected.status === 'draft' || selected.status === 'idle');
        return (
          <div className="cw-overlay" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
            <div className="cw-modal">

              {/* Account row */}
              <div className="cw-acct">
                <span className="cw-avatar" style={workspace?.logo_url ? { backgroundImage: `url(${workspace.logo_url})` } : undefined}>
                  {!workspace?.logo_url && avatarInitials}
                </span>
                <div>
                  <div className="cw-acct-name">{workspace?.name}</div>
                  <div className="cw-acct-sub">{handle}</div>
                </div>
                <button className="cw-modal-close" onClick={() => setSelected(null)} aria-label="Fermer">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {/* Image */}
              {img && (
                <div style={{ position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="cw-modal-img" />
                  {selected.texte_visuel && (
                    <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, background: 'rgba(0,0,0,.55)', borderRadius: 10, padding: '8px 12px', backdropFilter: 'blur(4px)' }}>
                      <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>{selected.texte_visuel}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Body */}
              <div className="cw-modal-body">
                {/* Status chip */}
                <div style={{ marginBottom: 12 }}>
                  {(() => { const s = statusChip(selected); return <span style={{ padding: '5px 11px', borderRadius: 99, background: s.bg, color: s.color, fontSize: 12, fontWeight: 700 }}>{s.label}</span>; })()}
                </div>

                {selected.title && <h3 style={{ fontFamily: 'var(--display, sans-serif)', fontWeight: 800, fontSize: 17, color: '#0D0F0A', margin: '0 0 8px', lineHeight: 1.3 }}>{selected.title}</h3>}

                {selected.description && <p className="cw-modal-cap">{selected.description}</p>}

                {selected.scheduled_at && (
                  <div className="cw-meta-row">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16A36F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                    <span className="cw-meta-txt">Publication prévue le {fmtDate(selected.scheduled_at)}</span>
                  </div>
                )}

                {/* Existing comment */}
                {selected.client_comment && (
                  <div style={{ padding: '11px 13px', borderRadius: 12, background: '#FEF3C7', border: '1px solid #FCD34D', marginBottom: 14 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 800, color: '#B45309', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Votre demande de modification</p>
                    <p style={{ fontSize: 13, color: '#92400E', margin: 0, lineHeight: 1.5 }}>{selected.client_comment}</p>
                  </div>
                )}

                {/* Done feedback */}
                {(actionDone === 'approved' || selected.approved_by_client) && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 12, background: 'rgba(47,215,155,.14)', border: '1px solid #2FD79B' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0C7A52" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0C7A52' }}>Publication approuvée — merci !</span>
                  </div>
                )}
                {actionDone === 'commented' && (
                  <div style={{ textAlign: 'center', padding: '13px', borderRadius: 12, background: '#FEF3C7', border: '1px solid #FCD34D' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#B45309' }}>Demande envoyée à l’agence ✓</span>
                  </div>
                )}

                {/* Actions */}
                {canAct && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {!commenting ? (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button className="cw-btn cw-btn-approve" onClick={handleApprove} disabled={actionLoading} style={{ opacity: actionLoading ? 0.7 : 1 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                          Approuver
                        </button>
                        <button className="cw-btn cw-btn-modify" onClick={() => setCommenting(true)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          Demander une modif.
                        </button>
                      </div>
                    ) : (
                      <>
                        <textarea className="cw-textarea" value={comment} onChange={e => setComment(e.target.value)} placeholder="Décrivez la modification souhaitée (texte, visuel, date…)" rows={3} autoFocus />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setCommenting(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(13,15,10,.12)', background: '#f7f6f3', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#6b7280' }}>Annuler</button>
                          <button onClick={handleComment} disabled={!comment.trim() || actionLoading} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: '#0C2A1D', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: (!comment.trim() || actionLoading) ? 'not-allowed' : 'pointer', opacity: (!comment.trim() || actionLoading) ? 0.6 : 1 }}>
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
        );
      })()}
    </div>
  );
}
