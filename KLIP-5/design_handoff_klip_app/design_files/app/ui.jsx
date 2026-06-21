/* ui.jsx — shared app primitives: icons, Avatar, StatusBadge, PostCard, etc. */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const AIcon = ({ name, size = 18, stroke = 1.7, style, className }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', style, className };
  switch (name) {
    case 'grid':     return <svg {...p}><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>;
    case 'calendar': return <svg {...p}><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>;
    case 'edit':     return <svg {...p}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M13.5 7.5l3 3"/></svg>;
    case 'clients':  return <svg {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 19a5.5 5.5 0 0 0-2.2-4.4"/></svg>;
    case 'send':     return <svg {...p}><path d="M22 3L11 14M22 3l-7 19-4-8-8-4 19-7Z"/></svg>;
    case 'library':  return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/></svg>;
    case 'settings': return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.5M12 19v2.5M4.2 7l2.1 1.2M17.7 15.8l2.1 1.2M4.2 17l2.1-1.2M17.7 8.2l2.1-1.2"/></svg>;
    case 'search':   return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>;
    case 'bell':     return <svg {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>;
    case 'plus':     return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'spark':    return <svg {...p}><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/></svg>;
    case 'wand':     return <svg {...p}><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4"/><path d="M3 21l9-9"/></svg>;
    case 'check':    return <svg {...p}><path d="M4 12.5l5 5 11-11"/></svg>;
    case 'clock':    return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>;
    case 'chevR':    return <svg {...p}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevD':    return <svg {...p}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chevL':    return <svg {...p}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'arrowUR':  return <svg {...p}><path d="M7 17L17 7M8 7h9v9"/></svg>;
    case 'instagram':return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>;
    case 'heart':    return <svg {...p}><path d="M12 20s-7-4.3-9.2-8.4C1.3 8.7 2.7 5.5 6 5.5c2 0 3.2 1.3 4 2.4.8-1.1 2-2.4 4-2.4 3.3 0 4.7 3.2 3.2 6.1C19 15.7 12 20 12 20Z"/></svg>;
    case 'chat':     return <svg {...p}><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12Z"/></svg>;
    case 'bookmark': return <svg {...p}><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"/></svg>;
    case 'image':    return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/></svg>;
    case 'type':     return <svg {...p}><path d="M5 6.5V5h14v1.5M12 5v14M9 19h6"/></svg>;
    case 'sticker':  return <svg {...p}><path d="M20 13a7 7 0 1 1-9-9v0a2 2 0 0 0 0 4 2 2 0 0 1 2 2 2 2 0 0 0 4 0 2 2 0 0 1 3-1Z"/></svg>;
    case 'upload':   return <svg {...p}><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/></svg>;
    case 'drag':     return <svg {...p}><circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg>;
    case 'dots':     return <svg {...p}><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>;
    case 'filter':   return <svg {...p}><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/></svg>;
    case 'eye':      return <svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'copy':     return <svg {...p}><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>;
    case 'trash':    return <svg {...p}><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>;
    case 'logout':   return <svg {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 12H3m0 0l3.5-3.5M3 12l3.5 3.5"/></svg>;
    case 'globe':    return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9Z"/></svg>;
    case 'link':     return <svg {...p}><path d="M9 15l6-6M10.5 6.5l1-1a4 4 0 0 1 6 6l-1 1M13.5 17.5l-1 1a4 4 0 0 1-6-6l1-1"/></svg>;
    case 'play':     return <svg {...p}><path d="M7 5l12 7-12 7V5Z" fill="currentColor" stroke="none"/></svg>;
    case 'bolt':     return <svg {...p}><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z"/></svg>;
    case 'palette':  return <svg {...p}><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.4-1-1.5-1-3 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-4-4-7.5-9-7.5Z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.1" fill="currentColor" stroke="none"/></svg>;
    default: return null;
  }
};

const Avatar = ({ initials, color, size = 34, radius, style }) => (
  <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.36, borderRadius: radius ?? Math.round(size * 0.28), ...style }}>{initials}</span>
);

const StatusBadge = ({ status }) => {
  const s = STATUS[status];
  const isPub = status === 'published';
  return (
    <span className="badge" style={{ background: s.bg, color: isPub ? 'var(--mint-ink)' : s.fg }}>
      <span className="dot" style={{ background: isPub ? 'var(--mint-ink)' : s.fg, opacity: isPub ? 1 : .8 }} />
      {s.label}
    </span>
  );
};

const KlipMark = ({ size = 24, light = true }) => (
  <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: size, letterSpacing: '-0.05em',
    color: light ? 'var(--cream)' : 'var(--ink)', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>
    Kl<span style={{ color: 'var(--mint)' }}>ip</span>
    <span style={{ width: size * 0.16, height: size * 0.16, background: 'var(--mint)', borderRadius: '50%', marginLeft: size * 0.05, marginTop: size * 0.32 }} />
  </span>
);

/* Instagram-style post media with overlaid title */
const PostMedia = ({ post, radius = 12, showTitle = true, children }) => (
  <div style={{ position: 'relative', aspectRatio: '4/5', background: post.grad, borderRadius: radius, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
    {showTitle && <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontStyle: 'italic', fontSize: 20, lineHeight: .98, letterSpacing: '-0.02em', color: '#fff', textShadow: '0 2px 14px rgba(0,0,0,.4)', whiteSpace: 'pre-line' }}>{post.title}</div>}
    {children}
  </div>
);

/* small post card used in grids/lists */
function PostCard({ post, onClick }) {
  const c = clientById(post.client);
  return (
    <div className="card lift" onClick={onClick} style={{ overflow: 'hidden' }}>
      <div style={{ padding: 8 }}><PostMedia post={post} /></div>
      <div style={{ padding: '4px 12px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          <Avatar initials={c.initials} color={c.color} size={22} />
          <span style={{ fontWeight: 700, fontSize: 12.5 }} className="trunc">{c.name}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, whiteSpace: 'nowrap' }} className="tnum">{post.day} sept · {post.time}</span>
        </div>
        <StatusBadge status={post.status} />
      </div>
    </div>
  );
}

function IGStats() {
  return (
    <div style={{ display: 'flex', gap: 14, color: '#fff' }}>
      <AIcon name="heart" size={19} /><AIcon name="chat" size={19} /><AIcon name="send" size={19} />
      <AIcon name="bookmark" size={19} style={{ marginLeft: 'auto' }} />
    </div>
  );
}

/* Instagram profile preview — feed mock for a selected client */
function fillerGrads(c) {
  return [
    `linear-gradient(150deg, ${c.color}, #14160F)`,
    'linear-gradient(150deg,#EEEDE3,#cfd3b0)',
    c.grad,
    `linear-gradient(150deg, #2b8d57, #0c2a1d)`,
    `linear-gradient(150deg, ${c.color}, #2b8d57)`,
    'linear-gradient(150deg,#d7f25a,#9bd11f)',
    `linear-gradient(150deg, #103725, ${c.color})`,
    'linear-gradient(150deg,#e9e7da,#cfd3b0)',
    `linear-gradient(150deg, ${c.color}, #0c2a1d)`,
  ];
}

function InstagramPreview({ client, onOpenPost }) {
  const clientPosts = POSTS.filter(p => p.client === client.id);
  const fillers = fillerGrads(client);
  // feed = client posts first, then fillers, capped at 9
  const tiles = [];
  clientPosts.forEach(p => tiles.push({ grad: p.grad, post: p, title: p.title }));
  let fi = 0;
  while (tiles.length < 9) { tiles.push({ grad: fillers[fi % fillers.length] }); fi++; }
  const feed = tiles.slice(0, 9);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* phone-ish header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderBottom: '1px solid var(--line)' }}>
        <AIcon name="instagram" size={17} style={{ color: 'var(--ink)' }} />
        <span style={{ fontWeight: 800, fontSize: 13.5 }}>{client.handle}</span>
        <span className="badge" style={{ background: 'var(--mint-soft)', color: 'var(--mint-2)', marginLeft: 'auto' }}><span className="dot" style={{ background: 'var(--mint-2)' }} /> Connecté</span>
      </div>

      {/* profile row */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ padding: 2.5, borderRadius: '50%', background: 'linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)', flexShrink: 0 }}>
            <Avatar initials={client.initials} color={client.color} size={62} radius={999} style={{ boxShadow: '0 0 0 2.5px var(--white)' }} />
          </span>
          <div style={{ display: 'flex', gap: 18, flex: 1, justifyContent: 'space-around' }}>
            {[[client.posts, 'posts'], [client.followers, 'abonnés'], [client.following, 'abonnements']].map(([n, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div className="num" style={{ fontSize: 18, whiteSpace: 'nowrap' }}>{n}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{client.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'pre-line', lineHeight: 1.4, marginTop: 2 }}>{client.bio}</div>
        </div>
      </div>

      {/* feed tabs */}
      <div style={{ display: 'flex', marginTop: 14, borderTop: '1px solid var(--line)' }}>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '9px 0', borderTop: '1.5px solid var(--ink)', marginTop: -1, color: 'var(--ink)' }}><AIcon name="grid" size={16} /></div>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '9px 0', color: 'var(--ink-3)' }}><AIcon name="play" size={16} /></div>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '9px 0', color: 'var(--ink-3)' }}><AIcon name="bookmark" size={16} /></div>
      </div>

      {/* grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2 }}>
        {feed.map((t, i) => (
          <button key={i} onClick={() => t.post && onOpenPost && onOpenPost(t.post)}
            style={{ position: 'relative', aspectRatio: '1', background: t.grad, border: 'none', cursor: t.post ? 'pointer' : 'default', padding: 0, overflow: 'hidden' }}>
            {t.post && (
              <>
                <span style={{ position: 'absolute', top: 6, right: 6, color: '#fff', opacity: .9 }}><AIcon name={t.post.status === 'published' ? 'instagram' : 'clock'} size={13} /></span>
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: 7, fontFamily: 'var(--display)', fontWeight: 700, fontStyle: 'italic', fontSize: 11, lineHeight: 1, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,.5)', textAlign: 'left' }} className="trunc">{t.title}</span>
              </>
            )}
          </button>
        ))}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="dot" style={{ background: 'var(--mint-2)' }} /> Aperçu live · {clientPosts.filter(p => p.status === 'scheduled').length} à venir dans le feed
      </div>
    </div>
  );
}

Object.assign(window, { AIcon, Avatar, StatusBadge, KlipMark, PostMedia, PostCard, IGStats, InstagramPreview });
