/* helpers.jsx — shared primitives: reveal hook, icons, logo, post placeholders */
const { useState, useEffect, useRef, useCallback } = React;

/* Scroll reveal — observes every .reveal once mounted */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal:not(.in)'));
    if (!('IntersectionObserver' in window) || els.length === 0) {
      els.forEach(e => e.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  });
}

/* ── Icons ─────────────────────────────────────────────────────── */
const Icon = ({ name, size = 22, stroke = 1.7, style }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', style };
  switch (name) {
    case 'spark':    return <svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>;
    case 'wand':     return <svg {...p}><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4"/><path d="M3 21l9-9"/><path d="M12.5 6.5l1 1"/></svg>;
    case 'calendar': return <svg {...p}><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/><circle cx="8.5" cy="13.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="13.5" r="1.1" fill="currentColor" stroke="none"/></svg>;
    case 'image':    return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/></svg>;
    case 'layers':   return <svg {...p}><path d="M12 3l9 5-9 5-9-5 9-5Z"/><path d="M3 13l9 5 9-5"/></svg>;
    case 'bolt':     return <svg {...p}><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z"/></svg>;
    case 'voice':    return <svg {...p}><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5"/></svg>;
    case 'check':    return <svg {...p}><path d="M4 12.5l5 5 11-11"/></svg>;
    case 'plus':     return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'arrow':    return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrowUR':  return <svg {...p}><path d="M7 17L17 7M8 7h9v9"/></svg>;
    case 'instagram':return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>;
    case 'play':     return <svg {...p}><path d="M7 5l12 7-12 7V5Z" fill="currentColor" stroke="none"/></svg>;
    case 'upload':   return <svg {...p}><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/></svg>;
    case 'clock':    return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>;
    case 'heart':    return <svg {...p}><path d="M12 20s-7-4.3-9.2-8.4C1.3 8.7 2.7 5.5 6 5.5c2 0 3.2 1.3 4 2.4.8-1.1 2-2.4 4-2.4 3.3 0 4.7 3.2 3.2 6.1C19 15.7 12 20 12 20Z"/></svg>;
    case 'send':     return <svg {...p}><path d="M22 3L11 14M22 3l-7 19-4-8-8-4 19-7Z"/></svg>;
    case 'chat':     return <svg {...p}><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12Z"/></svg>;
    default: return null;
  }
};

/* ── Wordmark ──────────────────────────────────────────────────── */
const KlipLogo = ({ size = 26, light = false }) => (
  <span style={{
    fontFamily: 'var(--grotesk)', fontWeight: 900, fontSize: size,
    letterSpacing: '-0.045em', lineHeight: 1,
    color: light ? 'var(--cream)' : 'var(--ink)', display: 'inline-flex', alignItems: 'center'
  }}>
    Kl<span style={{ color: 'var(--acid-2)' }}>ip</span>
    <span style={{
      width: size * 0.17, height: size * 0.17, background: 'var(--acid)',
      borderRadius: '50%', marginLeft: size * 0.06, marginTop: size * 0.34
    }} />
  </span>
);

/* ── Instagram post placeholder ────────────────────────────────── */
const POST_GRADS = [
  'linear-gradient(150deg,#1b5e3a,#0c2a1d)',
  'linear-gradient(150deg,#C8F135,#7bbf12)',
  'linear-gradient(150deg,#0c2a1d,#1f7a4d)',
  'linear-gradient(150deg,#e9e7da,#cfd3b0)',
  'linear-gradient(150deg,#103725,#2b8d57)',
  'linear-gradient(150deg,#d7f25a,#9bd11f)',
];

function PostThumb({ i = 0, tag, brand, captionDark, style }) {
  const grad = POST_GRADS[i % POST_GRADS.length];
  const lime = i % 6 === 1 || i % 6 === 3 || i % 6 === 5;
  const fg = lime ? '#16321a' : '#EFEEE4';
  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden', background: 'var(--white)',
      boxShadow: '0 1px 0 1px rgba(13,15,10,.05), 0 20px 40px -24px rgba(13,15,10,.4)',
      ...style
    }}>
      <div style={{ position: 'relative', aspectRatio: '4/5', background: grad, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: fg, opacity: .8 }}>{brand}</span>
          <span style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${fg}`, opacity: .55 }} />
        </div>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontStyle: 'italic', fontSize: 22, lineHeight: .98, letterSpacing: '-0.02em', color: fg, whiteSpace: 'pre-line' }}>{tag}</div>
        <div style={{ display: 'flex', gap: 12, color: fg, opacity: .8 }}>
          <Icon name="heart" size={16} /><Icon name="chat" size={16} /><Icon name="send" size={16} />
        </div>
      </div>
      <div style={{ padding: '9px 12px 11px', display: 'flex', flexDirection: 'column', gap: 5, background: 'var(--white)' }}>
        <span style={{ height: 6, width: '78%', borderRadius: 3, background: captionDark ? 'rgba(13,15,10,.16)' : 'rgba(13,15,10,.12)' }} />
        <span style={{ height: 6, width: '52%', borderRadius: 3, background: 'rgba(13,15,10,.08)' }} />
      </div>
    </div>
  );
}

/* ── 3D glossy puffy emblem ────────────────────────────────────── */
const EMBLEM_TONES = {
  lime:   { hi: '#F2FFB0', mid: '#C8F135', lo: '#83A912', edge: '#5b7a08' },
  teal:   { hi: '#CFF6FF', mid: '#41C8E8', lo: '#1577A0', edge: '#0c526d' },
  forest: { hi: '#86E9AE', mid: '#26A968', lo: '#0F5836', edge: '#073d23' },
  ink:    { hi: '#5a5e50', mid: '#1b1d16', lo: '#0c0e09', edge: '#000000' },
};
const EMBLEM_PATHS = {
  spark: 'M100 6 C110 62 138 90 194 100 C138 110 110 138 100 194 C90 138 62 110 6 100 C62 90 90 62 100 6 Z',
  hex:   'M100 8 C108 8 112 10 118 13 L168 42 C176 47 180 53 180 62 L180 138 C180 147 176 153 168 158 L118 187 C112 190 108 192 100 192 C92 192 88 190 82 187 L32 158 C24 153 20 147 20 138 L20 62 C20 53 24 47 32 42 L82 13 C88 10 92 8 100 8 Z',
  blob:  'M100 10 C140 6 196 36 190 96 C186 140 156 196 100 190 C44 196 12 142 10 96 C8 44 60 14 100 10 Z',
  drop:  'M100 10 C150 74 178 112 178 142 A78 78 0 0 1 22 142 C22 112 50 74 100 10 Z',
};
let _emblemN = 0;
function Emblem3D({ shape = 'spark', tone = 'teal', size = 120, float = false, style }) {
  const T = EMBLEM_TONES[tone] || EMBLEM_TONES.teal;
  const d = EMBLEM_PATHS[shape] || EMBLEM_PATHS.spark;
  const u = useRef('em' + (++_emblemN)).current;
  return (
    <div style={{
      width: size, height: size, lineHeight: 0,
      filter: `drop-shadow(0 ${size * 0.13}px ${size * 0.18}px ${T.edge}88)`,
      animation: float ? `emblemFloat ${5 + (size % 4)}s ease-in-out infinite` : 'none',
      ...style
    }}>
      <svg viewBox="0 0 200 200" width={size} height={size}>
        <defs>
          <radialGradient id={u + 'b'} cx="36%" cy="30%" r="82%">
            <stop offset="0%" stopColor={T.hi} />
            <stop offset="42%" stopColor={T.mid} />
            <stop offset="100%" stopColor={T.lo} />
          </radialGradient>
          <radialGradient id={u + 's'} cx="34%" cy="26%" r="34%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <clipPath id={u + 'c'}><path d={d} /></clipPath>
        </defs>
        <path d={d} fill={`url(#${u}b)`} stroke={T.edge} strokeWidth="1" strokeOpacity="0.5" />
        <g clipPath={`url(#${u}c)`}>
          <ellipse cx="118" cy="150" rx="92" ry="60" fill={T.lo} opacity="0.55" />
          <ellipse cx="68" cy="54" rx="50" ry="38" fill={`url(#${u}s)`} />
          <circle cx="60" cy="48" r="9" fill="#fff" opacity="0.85" />
        </g>
      </svg>
    </div>
  );
}

Object.assign(window, { useReveal, Icon, KlipLogo, PostThumb, POST_GRADS, Emblem3D });
