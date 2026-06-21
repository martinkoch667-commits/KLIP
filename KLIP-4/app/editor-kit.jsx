/* editor-kit.jsx — Canva-style editor foundation:
   color utils · extended icon set · fonts · swatches · default element model */

/* ── color utils (kept global; used across the editor) ─────────── */
function mix(a, b, pct) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  const r = pa.map((v, i) => Math.round(v + (pb[i] - v) * pct / 100));
  return '#' + r.map(v => v.toString(16).padStart(2, '0')).join('');
}
function shade(hex, amt) { return mix(hex, amt < 0 ? '#000000' : '#ffffff', Math.abs(amt)); }
function tint(hex, amt) { return mix(hex, '#ffffff', amt); }

/* logical canvas (Instagram 4:5) */
const CW = 864, CH = 1080;

/* ── extended icon set for the editor toolbar ──────────────────── */
const EdIcon = ({ name, size = 18, stroke = 1.8, style, className }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', style, className };
  switch (name) {
    case 'bold':      return <svg {...p}><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" strokeWidth="2"/></svg>;
    case 'italic':    return <svg {...p}><path d="M11 5h7M6 19h7M14 5l-4 14" strokeWidth="2"/></svg>;
    case 'underline': return <svg {...p}><path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14" strokeWidth="2"/></svg>;
    case 'strike':    return <svg {...p}><path d="M5 12h14M8 7.5A4 4 0 0 1 16 8M8.5 16a4 4 0 0 0 7-2.4" strokeWidth="2"/></svg>;
    case 'alignL':    return <svg {...p}><path d="M4 6h16M4 12h10M4 18h13"/></svg>;
    case 'alignC':    return <svg {...p}><path d="M4 6h16M7 12h10M5 18h14"/></svg>;
    case 'alignR':    return <svg {...p}><path d="M4 6h16M10 12h10M7 18h13"/></svg>;
    case 'case':      return <svg {...p}><path d="M3 17l3.5-9 3.5 9M4.2 14h4.6M14 11.5a2.8 2.8 0 1 1 0 5.5 2.8 2.8 0 0 1 0-5.5zM19.6 11.6V17"/></svg>;
    case 'lineH':     return <svg {...p}><path d="M4 5l2.2-2L8.4 5M4 19l2.2 2L8.4 19M6.2 4v16M12 6h9M12 12h9M12 18h9"/></svg>;
    case 'spacing':   return <svg {...p}><path d="M4 7V5h16v2M4 17v2h16v-2M9 9l-2.5 6M15 9l2.5 6M10.2 13h3.6"/></svg>;
    case 'transp':    return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h6V3M9 15h6V9M15 21v-6h6" fill="currentColor" stroke="none" opacity=".22"/></svg>;
    case 'effects':   return <svg {...p}><path d="M12 3l1.7 4.8L18 9l-4.3 1.2L12 15l-1.7-4.8L6 9l4.3-1.2zM18.5 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>;
    case 'animate':   return <svg {...p}><path d="M5 12a7 7 0 0 1 7-7M19 12a7 7 0 0 1-7 7"/><path d="M12 5l-2.4 1.4M12 5l2.4 1.4M12 19l-2.4-1.4M12 19l2.4-1.4"/></svg>;
    case 'position':  return <svg {...p}><rect x="3" y="3" width="11" height="11" rx="2"/><path d="M10 10h10v10H10v-2"/></svg>;
    case 'layers':    return <svg {...p}><path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5"/></svg>;
    case 'lock':      return <svg {...p}><rect x="5" y="11" width="14" height="9" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>;
    case 'unlock':    return <svg {...p}><rect x="5" y="11" width="14" height="9" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 7.5-1.9"/></svg>;
    case 'comment':   return <svg {...p}><path d="M21 11.5a7.5 7.5 0 0 1-10.8 6.7L4 20l1.8-5.4A7.5 7.5 0 1 1 21 11.5Z"/><path d="M9 11h6M9 8.5h4"/></svg>;
    case 'magic':     return <svg {...p}><path d="M15 4V2M15 14v-2M8 9h2M20 9h2M17.6 11.6l1.4 1.4M17.6 6.4l1.4-1.4M4 21l10-10"/></svg>;
    case 'copy':      return <svg {...p}><rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>;
    case 'trash':     return <svg {...p}><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>;
    case 'dots':      return <svg {...p}><circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/></svg>;
    case 'undo':      return <svg {...p}><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1"/></svg>;
    case 'redo':      return <svg {...p}><path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1"/></svg>;
    case 'plus':      return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'minus':     return <svg {...p}><path d="M5 12h14"/></svg>;
    case 'fit':       return <svg {...p}><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>;
    case 'flipH':     return <svg {...p}><path d="M12 3v18M7 8l-3 4 3 4V8zM17 8l3 4-3 4V8z" /></svg>;
    case 'replace':   return <svg {...p}><path d="M4 8a7 7 0 0 1 12-3l2 2M20 16a7 7 0 0 1-12 3l-2-2"/><path d="M18 4v3h-3M6 20v-3h3"/></svg>;
    case 'crop':      return <svg {...p}><path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/></svg>;
    case 'image':     return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/></svg>;
    case 'text':      return <svg {...p}><path d="M5 6.5V5h14v1.5M12 5v14M9 19h6"/></svg>;
    case 'square':    return <svg {...p}><rect x="4" y="4" width="16" height="16" rx="2.5"/></svg>;
    case 'circle':    return <svg {...p}><circle cx="12" cy="12" r="8.5"/></svg>;
    case 'pill':      return <svg {...p}><rect x="3" y="7.5" width="18" height="9" rx="4.5"/></svg>;
    case 'triangle':  return <svg {...p}><path d="M12 4l8.5 15h-17z"/></svg>;
    case 'star':      return <svg {...p}><path d="M12 3.5l2.5 5.6 6.1.6-4.6 4 1.4 6-5.4-3.2L6.6 19.7 8 13.7l-4.6-4 6.1-.6z"/></svg>;
    case 'line':      return <svg {...p}><path d="M5 19L19 5"/></svg>;
    case 'grid':      return <svg {...p}><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>;
    case 'upload':    return <svg {...p}><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/></svg>;
    case 'search':    return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>;
    case 'chevD':     return <svg {...p}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chevL':     return <svg {...p}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'check':     return <svg {...p}><path d="M4 12.5l5 5 11-11"/></svg>;
    case 'eye':       return <svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'play':      return <svg {...p}><path d="M7 5l12 7-12 7V5Z" fill="currentColor" stroke="none"/></svg>;
    case 'palette':   return <svg {...p}><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.4-1-1.5-1-3 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-4-4-7.5-9-7.5Z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.1" fill="currentColor" stroke="none"/></svg>;
    case 'template':  return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/></svg>;
    case 'shapes':    return <svg {...p}><rect x="3" y="13" width="8" height="8" rx="1.6"/><circle cx="16.5" cy="16.5" r="4.2"/><path d="M9 3l5 8H4z"/></svg>;
    default: return null;
  }
};

/* ── fonts available in the type picker ────────────────────────── */
const EFONTS = [
  { id: 'archivo',    label: 'Archivo',             css: "'Archivo', sans-serif" },
  { id: 'bricolage',  label: 'Bricolage Grotesque', css: "'Bricolage Grotesque', sans-serif" },
  { id: 'instrument', label: 'Instrument Serif',    css: "'Instrument Serif', serif" },
  { id: 'satoshi',    label: 'Satoshi',             css: "'Satoshi', sans-serif" },
  { id: 'cabinet',    label: 'Cabinet Grotesk',     css: "'Cabinet Grotesk', sans-serif" },
];
const fontCss = (id) => (EFONTS.find(f => f.id === id) || EFONTS[0]).css;
const fontLabel = (id) => (EFONTS.find(f => f.id === id) || EFONTS[0]).label;

/* text effect presets → returns css fragment applied to the text node */
const EFFECTS = ['none', 'shadow', 'lift', 'outline', 'neon', 'highlight'];
const EFFECT_LABEL = { none: 'Aucun', shadow: 'Ombre', lift: 'Relief', outline: 'Contour', neon: 'Néon', highlight: 'Surligné' };
function effectStyle(effect, color, accent) {
  switch (effect) {
    case 'shadow':    return { textShadow: '0 3px 16px rgba(0,0,0,.45)' };
    case 'lift':      return { textShadow: '0 10px 22px rgba(0,0,0,.30)' };
    case 'outline':   return { WebkitTextStroke: `1.5px ${color}`, color: 'transparent', textShadow: 'none' };
    case 'neon':      return { color, textShadow: `0 0 8px ${color}, 0 0 22px ${color}` };
    case 'highlight': return { background: accent, color: '#14160F', padding: '0 .14em', borderRadius: 6, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' };
    default:          return {};
  }
}

const ANIMS = ['none', 'fade', 'rise', 'pop', 'pan'];
const ANIM_LABEL = { none: 'Aucune', fade: 'Fondu', rise: 'Montée', pop: 'Pop', pan: 'Glissé' };

/* ── document model: build a polished default post for a client ── */
let __eidc = 0;
const eid = () => 'e' + (++__eidc);

function brandPalette(client) {
  return [
    client.color,
    tint(client.color, 42),
    shade(client.color, -45),
    '#EEEDE3', '#FFFFFF', '#14160F',
    '#C8F135', '#2FD79B',
  ];
}

/* a tasteful editorial promo layout using all element families */
function defaultDoc(client, bg) {
  const handle = client.handle.replace('@', '').toUpperCase();
  return {
    bg: bg || `linear-gradient(155deg, ${client.color}, ${shade(client.color, -58)})`,
    els: [
      { id: eid(), type: 'brand', x: 56, y: 54, w: 300, h: 40, size: 24, color: '#EEEDE3', text: handle, locked: false, rot: 0, opacity: 100 },
      { id: eid(), type: 'image', x: 56, y: 150, w: 752, h: 470, radius: 22, src: null, fit: 'cover', label: 'Photo du plat', rot: 0, opacity: 100, locked: false },
      { id: eid(), type: 'shape', shape: 'pill', x: 56, y: 672, w: 232, h: 52, fill: '#C8F135', radius: 26, rot: 0, opacity: 100, locked: false,
        // pill carries a caption rendered centered
        text: 'SEPTEMBRE', textColor: '#14160F' },
      { id: eid(), type: 'text', x: 56, y: 744, w: 700, text: 'Nouvelle carte\nd’automne', font: 'archivo', size: 92, weight: 800, italic: true,
        underline: false, strike: false, color: '#EEEDE3', align: 'left', lineH: 0.96, letter: -0.03, uppercase: false, effect: 'shadow', anim: 'rise', rot: 0, opacity: 100, locked: false },
      { id: eid(), type: 'text', x: 56, y: 952, w: 560, text: 'Réservations ouvertes tout le mois', font: 'satoshi', size: 30, weight: 500, italic: false,
        underline: false, strike: false, color: 'rgba(238,237,227,.82)', align: 'left', lineH: 1.25, letter: 0, uppercase: false, effect: 'none', anim: 'fade', rot: 0, opacity: 100, locked: false },
    ],
  };
}

Object.assign(window, {
  mix, shade, tint, CW, CH, EdIcon, EFONTS, fontCss, fontLabel,
  EFFECTS, EFFECT_LABEL, effectStyle, ANIMS, ANIM_LABEL,
  eid, brandPalette, defaultDoc,
});
