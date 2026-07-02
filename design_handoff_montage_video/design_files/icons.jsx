/* icons.jsx — KLIP Montage vidéo : jeu d'icônes (VIcon), logo, helpers couleur. */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const VIcon = ({ name, size = 18, stroke = 1.7, style, className }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', style, className };
  switch (name) {
    case 'video':    return <svg {...p}><rect x="2.5" y="5.5" width="13" height="13" rx="3"/><path d="M15.5 9.5l6-3v11l-6-3"/></svg>;
    case 'image':    return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/></svg>;
    case 'text':     return <svg {...p}><path d="M5 6.5V5h14v1.5M12 5v14M9 19h6"/></svg>;
    case 'captions': return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M9 10.5a2.2 2.2 0 0 0-3 2 2.2 2.2 0 0 0 3 2M16 10.5a2.2 2.2 0 0 0-3 2 2.2 2.2 0 0 0 3 2"/></svg>;
    case 'music':    return <svg {...p}><path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>;
    case 'mic':      return <svg {...p}><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7"/></svg>;
    case 'transition':return <svg {...p}><rect x="2.5" y="6" width="8" height="12" rx="2"/><rect x="13.5" y="6" width="8" height="12" rx="2"/><path d="M11 12h2M11 9.5l2 2.5-2 2.5"/></svg>;
    case 'filter':   return <svg {...p}><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/></svg>;
    case 'speed':    return <svg {...p}><path d="M5 19a9 9 0 1 1 14 0"/><path d="M12 13l4-3"/><circle cx="12" cy="13" r="1.2" fill="currentColor" stroke="none"/></svg>;
    case 'sticker':  return <svg {...p}><path d="M20 13a7 7 0 1 1-9-9v0a2 2 0 0 0 0 4 2 2 0 0 1 2 2 2 2 0 0 0 4 0 2 2 0 0 1 3-1Z"/></svg>;
    case 'magic':    return <svg {...p}><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4"/><path d="M3 21l9-9"/></svg>;
    case 'scissors': return <svg {...p}><circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M8.2 7.6L20 18M8.2 16.4L20 6"/></svg>;
    case 'crop':     return <svg {...p}><path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/></svg>;
    case 'lasso':    return <svg {...p}><path d="M3 11a9 5 0 1 1 12 4.6"/><path d="M5 16.5a1.8 1.8 0 1 0 2.6 2.3c.6 1 .2 2.2-.6 2.2"/><circle cx="11" cy="11" r="2.4"/></svg>;
    case 'layers':   return <svg {...p}><path d="M12 3l9 5-9 5-9-5 9-5Z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5" opacity=".55"/></svg>;
    case 'play':     return <svg {...p}><path d="M7 5l12 7-12 7V5Z" fill="currentColor" stroke="none"/></svg>;
    case 'pause':    return <svg {...p}><rect x="6" y="5" width="4" height="14" rx="1.3" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.3" fill="currentColor" stroke="none"/></svg>;
    case 'skipB':    return <svg {...p}><path d="M18 6v12L9 12l9-6ZM6 5v14" /></svg>;
    case 'skipF':    return <svg {...p}><path d="M6 6v12l9-6-9-6ZM18 5v14"/></svg>;
    case 'volume':   return <svg {...p}><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4Z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" opacity=".7"/></svg>;
    case 'mute':     return <svg {...p}><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4Z"/><path d="M17 9.5l4 5M21 9.5l-4 5"/></svg>;
    case 'plus':     return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'chevR':    return <svg {...p}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevL':    return <svg {...p}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'chevD':    return <svg {...p}><path d="M6 9l6 6 6-6"/></svg>;
    case 'undo':     return <svg {...p}><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1"/></svg>;
    case 'redo':     return <svg {...p}><path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1"/></svg>;
    case 'eye':      return <svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'upload':   return <svg {...p}><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/></svg>;
    case 'export':   return <svg {...p}><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/></svg>;
    case 'trash':    return <svg {...p}><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>;
    case 'copy':     return <svg {...p}><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>;
    case 'drag':     return <svg {...p}><circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg>;
    case 'dots':     return <svg {...p}><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>;
    case 'check':    return <svg {...p}><path d="M4 12.5l5 5 11-11"/></svg>;
    case 'lock':     return <svg {...p}><rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
    case 'zoomIn':   return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4M11 8v6M8 11h6"/></svg>;
    case 'zoomOut':  return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4M8 11h6"/></svg>;
    case 'split':    return <svg {...p}><path d="M12 3v18M7 8l-3 4 3 4M17 8l3 4-3 4"/></svg>;
    case 'reorder':  return <svg {...p}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
    case 'wave':     return <svg {...p}><path d="M3 12h2l1.5-5 2 10 2-13 2 16 2-10 1.5 2H21"/></svg>;
    case 'clock':    return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>;
    case 'instagram':return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>;
    case 'sparkles': return <svg {...p}><path d="M12 3l1.5 5L19 9.5 13.5 11 12 16l-1.5-5L5 9.5 10.5 8 12 3Z"/><path d="M18 15l.7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z"/></svg>;
    case 'edit':     return <svg {...p}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M13.5 7.5l3 3"/></svg>;
    case 'arrowUR':  return <svg {...p}><path d="M7 17L17 7M8 7h9v9"/></svg>;
    default: return null;
  }
};

const KlipMark = ({ size = 24, light = true }) => (
  <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: size, letterSpacing: '-0.05em',
    color: light ? 'var(--cream)' : 'var(--ink)', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>
    Kl<span style={{ color: 'var(--mint)' }}>ip</span>
    <span style={{ width: size * 0.16, height: size * 0.16, background: 'var(--mint)', borderRadius: '50%', marginLeft: size * 0.05, marginTop: size * 0.32 }} />
  </span>
);

/* color helpers */
function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); const r = A.map((v, i) => Math.round(v + (B[i] - v) * t)); return '#' + r.map(x => x.toString(16).padStart(2, '0')).join(''); }

Object.assign(window, { VIcon, KlipMark, mix });
