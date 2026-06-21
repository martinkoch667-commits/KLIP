'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

/* ════════════════════════════════════════════════════════════════════════════
   KLIP — Landing v2 (magazine) · réplique fidèle de KLIP-5 / "KLIP Landing v2"
   Accent = vert de la charte actuelle (#2FD79B) au lieu du lime #CBFF3A.
   ════════════════════════════════════════════════════════════════════════════ */

const V2_CSS = `
.v2 {
  /* surfaces */
  --paper:#F2F0E6; --paper-2:#FBFAF2; --paper-3:#E9E6D7; --white:#FFFFFF;
  --forest:#062018; --forest-2:#0B3122; --forest-3:#11432F;
  /* ink */
  --ink:#0A0C07; --ink-2:#4E5247; --ink-3:#888B7C;
  --line:rgba(10,12,7,.14); --line-2:rgba(10,12,7,.08);
  /* on forest */
  --cream:#F0EFE4; --cream-2:rgba(240,239,228,.66); --cream-3:rgba(240,239,228,.34); --line-f:rgba(240,239,228,.16);
  /* accent — vert charte */
  --acid:#2FD79B; --acid-2:#21B381; --acid-ink:#06281C; --mint:#34E0A1;
  /* type */
  --heavy:'Archivo', system-ui, sans-serif;
  --grotesk:'early-sans-variable','Hanken Grotesk', system-ui, sans-serif;
  --sans:'early-sans-variable','Hanken Grotesk', system-ui, sans-serif;
  --mono:'early-sans-variable','Hanken Grotesk', system-ui, sans-serif;
  --maxw:1240px;
  --radius:20px; --radius-s:12px; --radius-l:30px;

  background:var(--paper); color:var(--ink); font-family:var(--sans);
  font-size:17px; line-height:1.6; -webkit-font-smoothing:antialiased; overflow-x:hidden;
}
.v2 *, .v2 *::before, .v2 *::after { box-sizing:border-box; }
.v2 a { color:inherit; text-decoration:none; }
.v2 button { font-family:inherit; cursor:pointer; border:none; background:none; }
.v2 img { display:block; max-width:100%; }
.v2 ::selection { background:var(--acid); color:var(--acid-ink); }

/* type */
.v2 .display { font-family:var(--heavy); font-weight:800; text-transform:uppercase; letter-spacing:-0.03em; line-height:.95; text-wrap:balance; }
.v2 .it-serif { font-family:var(--heavy); font-style:italic; font-weight:800; letter-spacing:-0.02em; }
.v2 .eyebrow { font-family:var(--mono); font-weight:700; font-size:12.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-2); display:inline-flex; align-items:center; gap:10px; }
.v2 .eyebrow::before { content:""; width:9px; height:9px; background:var(--acid); border-radius:var(--radius-s); box-shadow:0 0 0 4px color-mix(in srgb, var(--acid) 26%, transparent); }
.v2 .eyebrow.plain::before { display:none; }
.v2 .on-forest .eyebrow { color:var(--cream-2); }
.v2 .lead { color:var(--ink-2); font-size:19.5px; line-height:1.6; text-wrap:pretty; }
.v2 .on-forest .lead { color:var(--cream-2); }

/* acid-fill (green text accent) */
.v2 .acid-fill { background:linear-gradient(96deg,#18B06A 0%,#0B6E45 82%); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent; }
.v2 .on-forest .acid-fill { background:linear-gradient(96deg,var(--acid),var(--mint) 80%); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent; }
.v2 .accent-lit, .v2 .accent-lit .split-char { color:var(--acid); -webkit-text-fill-color:var(--acid); background:none; }

/* layout */
.v2 .wrap { max-width:var(--maxw); margin:0 auto; padding:0 34px; }
.v2 .section { padding:clamp(80px,11vw,150px) 0; position:relative; }
.v2 .on-forest {
  background:
    radial-gradient(100% 70% at 50% -12%, rgba(52,224,161,.13), transparent 55%),
    radial-gradient(75% 65% at 92% 6%, rgba(47,215,155,.06), transparent 55%),
    radial-gradient(95% 80% at 4% 100%, rgba(31,168,115,.14), transparent 60%),
    var(--forest);
  color:var(--cream);
}
.v2 .sec-no { font-family:var(--mono); font-weight:700; font-size:13px; letter-spacing:.1em; color:var(--ink-3); }

/* buttons */
.v2 .btn { font-family:var(--grotesk); font-weight:800; font-size:16px; letter-spacing:-0.01em; display:inline-flex; align-items:center; gap:10px; padding:16px 28px; border-radius:999px; transition:transform .18s cubic-bezier(.2,.7,.3,1), box-shadow .2s, background .2s, color .2s; white-space:nowrap; }
.v2 .btn .arr { transition:transform .2s; }
.v2 .btn:hover .arr { transform:translate(3px,-3px); }
.v2 .btn-acid { background:var(--acid); color:var(--acid-ink); box-shadow:0 14px 30px -14px color-mix(in srgb, var(--acid) 75%, #000); }
.v2 .btn-acid:hover { transform:translateY(-2px); box-shadow:0 20px 36px -16px color-mix(in srgb, var(--acid) 80%, #000); }
.v2 .btn-ink { background:var(--ink); color:var(--paper); }
.v2 .btn-ink:hover { transform:translateY(-2px); }
.v2 .btn-ghost { background:transparent; color:var(--ink); box-shadow:inset 0 0 0 1.6px var(--line); }
.v2 .btn-ghost:hover { box-shadow:inset 0 0 0 2px var(--ink); }
.v2 .on-forest .btn-ghost { color:var(--cream); box-shadow:inset 0 0 0 1.6px var(--line-f); }
.v2 .on-forest .btn-ghost:hover { box-shadow:inset 0 0 0 2px var(--cream); }
.v2 .btn-cream { background:var(--cream); color:var(--forest); }
.v2 .btn-cream:hover { transform:translateY(-2px); }
.v2 .btn-sm { padding:12px 19px; font-size:14px; }

/* chip / card / frame */
.v2 .chip { font-family:var(--mono); font-weight:700; font-size:12.5px; letter-spacing:.02em; display:inline-flex; align-items:center; gap:8px; padding:8px 14px; border-radius:999px; background:var(--paper-2); box-shadow:inset 0 0 0 1px var(--line); color:var(--ink-2); white-space:nowrap; }
.v2 .on-forest .chip { background:var(--forest-2); color:var(--cream-2); box-shadow:inset 0 0 0 1px var(--line-f); }
.v2 .card { background:var(--paper-2); border-radius:var(--radius); box-shadow:inset 0 0 0 1px var(--line-2), 0 1px 2px rgba(10,12,7,.03); }
.v2 .frame { border-radius:var(--radius); overflow:hidden; background:var(--white); box-shadow:0 0 0 1px rgba(10,12,7,.08), 0 50px 90px -48px rgba(0,0,0,.55); }
.v2 .frame-bar { height:38px; display:flex; align-items:center; gap:7px; padding:0 14px; background:var(--paper-3); border-bottom:1px solid var(--line); }
.v2 .frame-dot { width:11px; height:11px; border-radius:50%; background:var(--ink-3); opacity:.5; }
.v2 .frame-url { margin-left:10px; font-family:var(--mono); font-size:11.5px; color:var(--ink-3); letter-spacing:.02em; }

/* dotted texture */
.v2 .dotgrid::before { content:""; position:absolute; inset:0; z-index:0; background-image:radial-gradient(circle at center, var(--line) 1.3px, transparent 1.5px); background-size:28px 28px; -webkit-mask-image:radial-gradient(ellipse 75% 65% at 50% 38%, #000 0%, transparent 72%); mask-image:radial-gradient(ellipse 75% 65% at 50% 38%, #000 0%, transparent 72%); pointer-events:none; }
.v2 .on-forest .dotgrid::before { background-image:radial-gradient(circle at center, var(--line-f) 1.3px, transparent 1.5px); }

/* split-text hero */
.v2 .split-line { display:block; }
.v2 .split-word { display:inline-block; white-space:nowrap; }
.v2 .split-char { display:inline-block; opacity:0; transform:translateY(.55em); will-change:transform,opacity; }
.v2 .split-char.lit { opacity:1; transform:none; transition:opacity .5s ease, transform .62s cubic-bezier(.2,.85,.25,1); }

/* reveal */
.v2 .reveal { opacity:0; transform:translateY(26px); }
.v2 .reveal.in { opacity:1; transform:none; transition:opacity .8s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.16,1,.3,1); }
.v2 .reveal.d1.in { transition-delay:.08s; } .v2 .reveal.d2.in { transition-delay:.16s; }
.v2 .reveal.d3.in { transition-delay:.24s; } .v2 .reveal.d4.in { transition-delay:.32s; }

/* floats */
@keyframes v2-floatA { 0%,100%{transform:translateY(0) rotate(-5deg);} 50%{transform:translateY(-20px) rotate(4deg);} }
@keyframes v2-floatB { 0%,100%{transform:translateY(0) rotate(6deg);} 50%{transform:translateY(-14px) rotate(-3deg);} }
@keyframes v2-spin { to { transform:rotate(360deg); } }
.v2 .floatA { animation:v2-floatA 7s ease-in-out infinite; }
.v2 .floatB { animation:v2-floatB 6s ease-in-out infinite; }

/* showcase */
.v2 .sho-kicker { font-family:var(--mono); font-weight:700; font-size:12.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--acid); }
.v2 .sho-shot { position:relative; border-radius:var(--radius); overflow:hidden; background:var(--forest-2); border:1px solid var(--line-f); box-shadow:0 50px 90px -48px rgba(0,0,0,.55); }
.v2 .sho-shot img { display:block; width:100%; height:auto; }
.v2 .sho-shot::after { content:""; position:absolute; inset:0; box-shadow:inset 0 0 0 1px var(--line-f); border-radius:inherit; pointer-events:none; }

/* nav */
.v2 .nav-link:hover { color:var(--ink) !important; }

/* mobile menu */
.v2-mob-btn { display:none; align-items:center; justify-content:center; width:42px; height:42px; border-radius:12px; }
.v2-mob-menu { position:fixed; inset:0; background:var(--forest); z-index:1000; display:flex; flex-direction:column; padding:22px 26px 42px; transform:translateX(100%); transition:transform .3s cubic-bezier(.16,1,.3,1); }
.v2-mob-menu.open { transform:translateX(0); }
.v2-mob-link { display:block; font-family:'Archivo',sans-serif; font-weight:800; font-size:30px; text-transform:uppercase; letter-spacing:-0.02em; color:#F0EFE4; padding:13px 0; border-bottom:1px solid rgba(240,239,228,.16); }

/* ── responsive ──────────────────────────────────────────────── */
/* tablette : grilles 2 → 1 col, nav repliée, flottants masqués */
@media (max-width:960px) {
  .v2 .nav-links, .v2 .nav-cta-ghost { display:none !important; }
  .v2-mob-btn { display:inline-flex; }
  .v2 .hero-float { display:none !important; }        /* évite tout débordement latéral */
  .v2 .grid-2, .v2 .grid-3, .v2 .bento, .v2 .testi-grid, .v2 .price-grid, .v2 .feat-hero { grid-template-columns:1fr !important; }
  .v2 .span-2 { grid-column:auto !important; }
  .v2 .testi-grid > div:first-child { grid-row:auto !important; }   /* gros témoignage : plus de span 2 */
  .v2 .price-grid > div { transform:none !important; }              /* carte "populaire" non décalée */
  .v2 .foot-grid { grid-template-columns:1fr 1fr !important; gap:34px !important; }
}
@media (max-width:860px) {
  .v2 .sho-row { grid-template-columns:1fr !important; }
  .v2 .sho-row > div { order:initial !important; }
  .v2 .sho-row .sho-shot { order:-1 !important; }
}
/* mobile */
@media (max-width:760px) {
  .v2 { font-size:16px; }
  .v2 .wrap { padding:0 20px; }
  .v2 .nav-login { display:none !important; }
  .v2 .hero-peek { margin-top:48px !important; }
  .v2 .lead { font-size:17px !important; }
  /* éditeur (Showcase) : rendu à sa largeur confortable, défilable horizontalement */
  .v2 .ed-embed { overflow-x:auto; -webkit-overflow-scrolling:touch; border-radius:14px; }
  .v2 .ed-embed > div { min-width:680px; }
  .v2 .ed-zoomr { display:none !important; }
}
/* pipeline du hero : vertical + flèches vers le bas quand ça ne tient plus en ligne */
@media (max-width:720px) {
  .v2 .hero-flow { flex-direction:column; gap:8px; }
  .v2 .hero-flow-item { flex-direction:column; gap:8px; width:auto; }
  .v2 .hero-flow-arr { transform:rotate(90deg); }
}
/* petits téléphones */
@media (max-width:560px) {
  .v2 .foot-grid { grid-template-columns:1fr !important; gap:30px !important; }
  .v2 .section { padding:64px 0; }
  .v2 .btn { padding:14px 22px; font-size:15px; }
  /* CTAs en pleine largeur, empilés */
  .v2 .hero-cta, .v2 .final-cta { flex-direction:column; align-items:stretch !important; }
  .v2 .hero-cta .btn, .v2 .final-cta .btn { width:100%; justify-content:center; }
  /* stat -11h : empilée */
  .v2 .stat-bar { flex-direction:column; align-items:flex-start !important; gap:14px !important; padding:26px 24px !important; }
  /* tarifs : largeur lisible centrée */
  .v2 .price-grid { max-width:420px; margin-left:auto; margin-right:auto; }
}
@media (prefers-reduced-motion:reduce) {
  .v2 .reveal { opacity:1 !important; transform:none !important; }
  .v2 .split-char { opacity:1 !important; transform:none !important; }
  .v2 .floatA, .v2 .floatB { animation:none !important; }
}
`;

/* ─── Icon ───────────────────────────────────────────────────────────────── */
type IconProps = { name: string; size?: number; stroke?: number; style?: React.CSSProperties; className?: string };
function Icon({ name, size = 22, stroke = 1.7, style, className }: IconProps) {
  const p = { width: size, height: size, viewBox: '0 0 24 24' as const, fill: 'none' as const, stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style, className };
  switch (name) {
    case 'spark':     return <svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>;
    case 'wand':      return <svg {...p}><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4"/><path d="M3 21l9-9"/><path d="M12.5 6.5l1 1"/></svg>;
    case 'calendar':  return <svg {...p}><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/><circle cx="8.5" cy="13.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="13.5" r="1.1" fill="currentColor" stroke="none"/></svg>;
    case 'image':     return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/></svg>;
    case 'layers':    return <svg {...p}><path d="M12 3l9 5-9 5-9-5 9-5Z"/><path d="M3 13l9 5 9-5"/></svg>;
    case 'voice':     return <svg {...p}><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5"/></svg>;
    case 'check':     return <svg {...p}><path d="M4 12.5l5 5 11-11"/></svg>;
    case 'plus':      return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'arrow':     return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrowUR':   return <svg {...p}><path d="M7 17L17 7M8 7h9v9"/></svg>;
    case 'instagram': return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>;
    case 'play':      return <svg {...p}><path d="M7 5l12 7-12 7V5Z" fill="currentColor" stroke="none"/></svg>;
    case 'upload':    return <svg {...p}><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/></svg>;
    case 'clock':     return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>;
    case 'heart':     return <svg {...p}><path d="M12 20s-7-4.3-9.2-8.4C1.3 8.7 2.7 5.5 6 5.5c2 0 3.2 1.3 4 2.4.8-1.1 2-2.4 4-2.4 3.3 0 4.7 3.2 3.2 6.1C19 15.7 12 20 12 20Z"/></svg>;
    case 'send':      return <svg {...p}><path d="M22 3L11 14M22 3l-7 19-4-8-8-4 19-7Z"/></svg>;
    case 'chat':      return <svg {...p}><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12Z"/></svg>;
    default: return null;
  }
}

/* ─── EdIcon — editor mock icon set ──────────────────────────────────────── */
function EdIcon({ name, size = 18, stroke = 1.8, style }: { name: string; size?: number; stroke?: number; style?: React.CSSProperties }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24' as const, fill: 'none' as const, stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style };
  switch (name) {
    case 'bold':      return <svg {...p}><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" strokeWidth={2}/></svg>;
    case 'italic':    return <svg {...p}><path d="M11 5h7M6 19h7M14 5l-4 14" strokeWidth={2}/></svg>;
    case 'underline': return <svg {...p}><path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14" strokeWidth={2}/></svg>;
    case 'strike':    return <svg {...p}><path d="M5 12h14M8 7.5A4 4 0 0 1 16 8M8.5 16a4 4 0 0 0 7-2.4" strokeWidth={2}/></svg>;
    case 'alignL':    return <svg {...p}><path d="M4 6h16M4 12h10M4 18h13"/></svg>;
    case 'case':      return <svg {...p}><path d="M3 17l3.5-9 3.5 9M4.2 14h4.6M14 11.5a2.8 2.8 0 1 1 0 5.5 2.8 2.8 0 0 1 0-5.5zM19.6 11.6V17"/></svg>;
    case 'lineH':     return <svg {...p}><path d="M4 5l2.2-2L8.4 5M4 19l2.2 2L8.4 19M6.2 4v16M12 6h9M12 12h9M12 18h9"/></svg>;
    case 'transp':    return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h6V3M9 15h6V9M15 21v-6h6" fill="currentColor" stroke="none" opacity=".22"/></svg>;
    case 'effects':   return <svg {...p}><path d="M12 3l1.7 4.8L18 9l-4.3 1.2L12 15l-1.7-4.8L6 9l4.3-1.2zM18.5 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>;
    case 'animate':   return <svg {...p}><path d="M5 12a7 7 0 0 1 7-7M19 12a7 7 0 0 1-7 7"/><path d="M12 5l-2.4 1.4M12 5l2.4 1.4M12 19l-2.4-1.4M12 19l2.4-1.4"/></svg>;
    case 'position':  return <svg {...p}><rect x="3" y="3" width="11" height="11" rx="2"/><path d="M10 10h10v10H10v-2"/></svg>;
    case 'undo':      return <svg {...p}><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1"/></svg>;
    case 'redo':      return <svg {...p}><path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1"/></svg>;
    case 'plus':      return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'minus':     return <svg {...p}><path d="M5 12h14"/></svg>;
    case 'fit':       return <svg {...p}><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>;
    case 'image':     return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/></svg>;
    case 'text':      return <svg {...p}><path d="M5 6.5V5h14v1.5M12 5v14M9 19h6"/></svg>;
    case 'upload':    return <svg {...p}><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/></svg>;
    case 'chevD':     return <svg {...p}><path d="M6 9l6 6 6-6"/></svg>;
    case 'eye':       return <svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'play':      return <svg {...p}><path d="M7 5l12 7-12 7V5Z" fill="currentColor" stroke="none"/></svg>;
    case 'palette':   return <svg {...p}><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.4-1-1.5-1-3 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-4-4-7.5-9-7.5Z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.1" fill="currentColor" stroke="none"/></svg>;
    case 'template':  return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/></svg>;
    case 'shapes':    return <svg {...p}><rect x="3" y="13" width="8" height="8" rx="1.6"/><circle cx="16.5" cy="16.5" r="4.2"/><path d="M9 3l5 8H4z"/></svg>;
    default: return null;
  }
}

/* ─── KlipLogo ───────────────────────────────────────────────────────────── */
function KlipLogo({ size = 28, light = false }: { size?: number; light?: boolean }) {
  return <img src={light ? '/logo-klip-mint.png' : '/logo-klip-dark.png'} alt="Klip" style={{ height: size, width: 'auto' }} />;
}

/* ─── useParallax ────────────────────────────────────────────────────────── */
function useParallax(speed = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf: number | null = null;
    const update = () => {
      raf = null;
      const r = el.getBoundingClientRect();
      const off = (r.top + r.height / 2) - window.innerHeight / 2;
      el.style.transform = `translate3d(0, ${(-off * speed).toFixed(1)}px, 0)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [speed]);
  return ref;
}

/* ─── SplitText — animated per-character headline ────────────────────────── */
type Run = { t: string; cls?: string };
function SplitText({ lines, className = '', stagger = 22, style }: { lines: (Run[] | string)[]; className?: string; stagger?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const chars = Array.from(root.querySelectorAll<HTMLElement>('.split-char'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { chars.forEach(c => c.classList.add('lit')); return; }
    const io = new IntersectionObserver((ents) => {
      ents.forEach(en => {
        if (en.isIntersecting) {
          chars.forEach((c, i) => { c.style.transitionDelay = `${i * stagger}ms`; requestAnimationFrame(() => c.classList.add('lit')); });
          io.disconnect();
        }
      });
    }, { threshold: 0.3 });
    io.observe(root);
    return () => io.disconnect();
  }, [stagger]);

  const renderRun = (text: string, cls: string | undefined, kBase: string) => {
    const tokens = text.split(/(\s+)/);
    const out: React.ReactNode[] = [];
    tokens.forEach((tok, ti) => {
      if (tok === '') return;
      if (/^\s+$/.test(tok)) { out.push(<span key={`${kBase}-s${ti}`}> </span>); return; }
      out.push(
        <span key={`${kBase}-w${ti}`} className={`split-word ${cls || ''}`}>
          {Array.from(tok).map((ch, ci) => <span key={ci} className="split-char">{ch}</span>)}
        </span>
      );
    });
    return out;
  };

  return (
    <h1 ref={ref} className={`display ${className}`} style={style}>
      {lines.map((line, li) => {
        const runs: Run[] = Array.isArray(line) ? line : [{ t: line }];
        return (
          <span className="split-line" key={li}>
            {runs.map((run, ri) => <span key={ri}>{renderRun(run.t, run.cls, `${li}-${ri}`)}</span>)}
          </span>
        );
      })}
    </h1>
  );
}

/* ─── Nav ────────────────────────────────────────────────────────────────── */
function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40); on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const links: [string, string][] = [['Le problème', '#probleme'], ['Comment ça marche', '#how'], ['Le produit', '#apercu'], ['Tarifs', '#tarifs'], ['FAQ', '#faq']];
  return (
    <>
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60, transition: 'background .3s, box-shadow .3s, border-color .3s', background: solid ? 'rgba(242,240,230,.95)' : 'transparent', backdropFilter: solid ? 'saturate(1.3) blur(14px)' : 'none', WebkitBackdropFilter: solid ? 'saturate(1.3) blur(14px)' : 'none', borderBottom: solid ? '1px solid var(--line)' : '1px solid transparent' }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 76 }}>
          <a href="#top" style={{ display: 'flex', alignItems: 'center' }}><KlipLogo size={28} light={!solid} /></a>
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            {links.map(([t, h]) => <a key={h} href={h} className="nav-link" style={{ fontFamily: 'var(--mono)', fontSize: 13.5, fontWeight: 700, letterSpacing: '.01em', color: solid ? 'var(--ink-2)' : 'var(--cream-2)', transition: 'color .15s' }}>{t}</a>)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/login" className="nav-login" style={{ fontFamily: 'var(--mono)', fontSize: 13.5, fontWeight: 700, color: solid ? 'var(--ink)' : 'var(--cream)' }}>Connexion</Link>
            <Link href="/register" className="btn btn-acid btn-sm">Essai gratuit</Link>
            <button className="v2-mob-btn" onClick={() => setOpen(true)} aria-label="Menu" style={{ background: solid ? 'rgba(10,12,7,.08)' : 'rgba(240,239,228,.15)', color: solid ? 'var(--ink)' : 'var(--cream)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
          </div>
        </div>
      </nav>

      <div className={`v2-mob-menu${open ? ' open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 38 }}>
          <KlipLogo size={28} light />
          <button onClick={() => setOpen(false)} aria-label="Fermer" style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(240,239,228,.12)', display: 'grid', placeItems: 'center', color: '#F0EFE4' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          {links.map(([t, h]) => <a key={h} href={h} className="v2-mob-link" onClick={() => setOpen(false)}>{t}</a>)}
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link href="/register" className="btn btn-acid" style={{ justifyContent: 'center' }} onClick={() => setOpen(false)}>Essai gratuit</Link>
          <Link href="/login" className="btn btn-ghost" style={{ justifyContent: 'center', color: '#F0EFE4', boxShadow: 'inset 0 0 0 1.6px rgba(240,239,228,.3)' }} onClick={() => setOpen(false)}>Connexion</Link>
        </div>
      </div>
    </>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────────────── */
function Hero() {
  const peek = useParallax(0.06);
  const f1 = useParallax(-0.14), f2 = useParallax(0.18), f3 = useParallax(0.1), f4 = useParallax(-0.12);
  const lines: (Run[])[] = [[{ t: 'Tous vos clients.' }], [{ t: 'Un seul ' }, { t: 'outil.', cls: 'it-serif accent-lit' }]];
  const flow = [{ ic: 'upload', t: 'Importez' }, { ic: 'image', t: 'Composez & rédigez' }, { ic: 'send', t: 'Programmez & publiez' }];
  return (
    <header id="top" className="section dotgrid on-forest" style={{ paddingTop: 150, paddingBottom: 84, position: 'relative', overflow: 'hidden' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <p className="reveal" style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, letterSpacing: '.04em', color: 'var(--cream-2)', marginBottom: 22, textTransform: 'uppercase' }}>
          L&apos;outil de post-production de vos réseaux sociaux
        </p>
        <SplitText lines={lines} className="hero-h1" style={{ textAlign: 'center', fontSize: 'clamp(38px, 6.6vw, 80px)', margin: '0 auto', maxWidth: 1080 }} stagger={22} />
        <p className="lead reveal d1" style={{ textAlign: 'center', maxWidth: 680, margin: '28px auto 0', fontSize: 21 }}>
          Un seul espace pour gérer le contenu Instagram de <strong style={{ color: 'var(--cream)', fontWeight: 700 }}>tous vos clients</strong> — chaque marque avec sa voix. Fini de jongler entre dix outils et d&apos;y perdre vos soirées.
        </p>
        <div className="reveal d2 hero-flow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
          {flow.map((s, i) => (
            <span key={i} className="hero-flow-item" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13.5, color: 'var(--cream)', padding: '10px 16px', borderRadius: 999, background: 'var(--forest-2)', boxShadow: 'inset 0 0 0 1px var(--line-f)' }}>
                <span style={{ color: 'var(--acid)', display: 'inline-flex' }}><Icon name={s.ic} size={16} /></span>{s.t}
              </span>
              {i < flow.length - 1 && <span className="hero-flow-arr" style={{ color: 'var(--cream-3)', display: 'inline-flex' }}><Icon name="arrow" size={18} /></span>}
            </span>
          ))}
        </div>
        <div className="reveal d3 hero-cta" style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 34, flexWrap: 'wrap' }}>
          <Link href="/register" className="btn btn-acid">Essayer gratuitement <span className="arr"><Icon name="arrowUR" size={18} /></span></Link>
          <a href="#apercu" className="btn btn-ghost">Voir KLIP en action</a>
        </div>

        {/* product peek */}
        <div className="hero-peek" style={{ position: 'relative', maxWidth: 1080, margin: '72px auto 0' }}>
          <div ref={peek} className="frame reveal d2">
            <div className="frame-bar">
              <span className="frame-dot" /><span className="frame-dot" /><span className="frame-dot" />
              <span className="frame-url">app.klip.studio / tableau-de-bord</span>
            </div>
            <img src="/klip-media/dashboard.png" alt="Tableau de bord KLIP" style={{ display: 'block', width: '100%' }} />
          </div>
          <div ref={f1} className="hero-float floatA" style={{ position: 'absolute', left: -42, top: '34%', zIndex: 5 }}>
            <div style={{ background: 'var(--acid)', color: 'var(--acid-ink)', padding: '14px 18px', borderRadius: 'var(--radius-s)', boxShadow: '0 24px 50px -22px rgba(47,215,155,.8)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, maxWidth: 170, lineHeight: 1.4 }}>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>6 clients</div>un seul écran
            </div>
          </div>
          <div ref={f2} className="hero-float floatB" style={{ position: 'absolute', right: -36, top: '12%', zIndex: 5 }}>
            <div style={{ background: 'var(--forest)', color: 'var(--cream)', padding: '14px 18px', borderRadius: 'var(--radius-s)', boxShadow: '0 24px 50px -22px rgba(0,0,0,.6)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="spark" size={20} style={{ color: 'var(--acid)' }} /><span>Légende IA<br />générée ✓</span>
            </div>
          </div>
          <div ref={f3} className="hero-float floatB" style={{ position: 'absolute', left: -44, bottom: '13%', zIndex: 5 }}>
            <div style={{ background: 'var(--paper-2)', color: 'var(--ink)', padding: '13px 17px', borderRadius: 'var(--radius-s)', boxShadow: '0 24px 50px -24px rgba(0,0,0,.45)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 30, height: 30, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: 8, background: 'var(--ink)', color: 'var(--acid)' }}><Icon name="image" size={16} /></span>
              <span>Éditeur visuel<br /><span style={{ color: 'var(--ink-3)' }}>type Canva / Adobe</span></span>
            </div>
          </div>
          <div ref={f4} className="hero-float floatA" style={{ position: 'absolute', right: -30, bottom: '23%', zIndex: 5 }}>
            <div style={{ background: 'var(--acid)', color: 'var(--acid-ink)', padding: '13px 17px', borderRadius: 'var(--radius-s)', boxShadow: '0 24px 50px -22px rgba(47,215,155,.75)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="calendar" size={18} /><span>Programmé<br />Jeu. 18:30 ✓</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ─── Probleme ───────────────────────────────────────────────────────────── */
function Probleme() {
  const pains = [
    { ic: 'layers', t: 'Quatre outils ouverts', d: 'Canva, Notes, le tableur de planning, l’app Instagram. Vous copiez-collez toute la journée.' },
    { ic: 'clock', t: 'Des soirées à rattraper', d: 'Le contenu déborde sur vos week-ends. Plus vous prenez de clients, plus vous coulez.' },
    { ic: 'voice', t: 'Une voix par client, à la main', d: 'Vous gardez le ton de chaque marque en tête. Une erreur, et c’est le client qui le voit.' },
    { ic: 'chat', t: 'La validation par mail', d: 'Allers-retours interminables, captures d’écran, versions perdues. Le post sort en retard.' },
  ];
  return (
    <section id="probleme" className="section on-forest dotgrid" style={{ overflow: 'hidden', borderTop: '1px solid var(--line-f)' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 880 }}>
          <h2 className="display reveal d1" style={{ fontSize: 'clamp(40px, 6.4vw, 90px)', marginTop: 22 }}>
            Plus vous prenez de clients, <span className="it-serif acid-fill">plus vous ralentissez.</span>
          </h2>
          <p className="lead reveal d2" style={{ marginTop: 26, maxWidth: 620 }}>
            Vous ne grandissez plus au rythme de votre talent, mais au rythme de votre logistique. Chaque nouveau client ajoute des heures de manipulation, pas de création.
          </p>
        </div>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 56 }}>
          {pains.map((p, i) => (
            <div key={i} className={`reveal d${(i % 2) + 1}`} style={{ background: 'var(--forest-2)', border: '1px solid var(--line-f)', borderRadius: 'var(--radius)', padding: '28px 30px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <span style={{ flex: 'none', width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 12, background: 'var(--forest-3)', color: 'var(--acid)' }}><Icon name={p.ic} size={23} /></span>
              <div>
                <h3 style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 21, letterSpacing: '-0.02em', marginBottom: 7, textTransform: 'uppercase' }}>{p.t}</h3>
                <p style={{ color: 'var(--cream-2)', fontSize: 15.5, lineHeight: 1.55 }}>{p.d}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="reveal d2 stat-bar" style={{ marginTop: 28, padding: '34px 38px', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', background: 'var(--acid)', color: 'var(--acid-ink)', borderRadius: 'var(--radius)' }}>
          <span style={{ fontFamily: 'var(--heavy)', fontWeight: 900, fontSize: 'clamp(46px, 6vw, 76px)', letterSpacing: '-0.04em', lineHeight: 1 }}>−11h</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, maxWidth: 420, lineHeight: 1.5 }}>
            par semaine et par gestionnaire, englouties à jongler entre les outils plutôt qu&apos;à créer. C&apos;est un client de plus que vous ne prenez pas.
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─── Steps ──────────────────────────────────────────────────────────────── */
function Steps() {
  const peek = useParallax(0.06);
  const steps = [
    { n: '01', ic: 'upload', t: 'Importez vos médias', d: 'Déposez les photos et vidéos d’un client — tout votre matériel réuni au même endroit.' },
    { n: '02', ic: 'image', t: 'Composez & retouchez', d: 'Créez vos visuels ou retravaillez vos imports dans l’éditeur intégré, type Canva. La charte du client est déjà appliquée.' },
    { n: '03', ic: 'wand', t: 'Rédigez avec l’IA', d: 'Légendes, descriptions et hashtags générés depuis l’image et la voix de marque du client.' },
    { n: '04', ic: 'send', t: 'Programmez & publiez', d: 'Calez sur le calendrier, faites valider, KLIP publie sur Instagram — pour chacun de vos clients.' },
  ];
  return (
    <section id="how" className="section">
      <div className="wrap">
        <div style={{ maxWidth: 840 }}>
          <h2 className="display reveal" style={{ fontSize: 'clamp(36px, 5.4vw, 76px)' }}>
            De la photo au post publié,<br /><span className="it-serif acid-fill">sans changer d&apos;outil.</span>
          </h2>
          <p className="lead reveal d1" style={{ marginTop: 24, maxWidth: 660 }}>
            KLIP réunit toute la post-production de vos réseaux : importez vos prises de vue, composez vos visuels, laissez l&apos;IA écrire, programmez. Pour chaque client, sans jamais quitter l&apos;outil.
          </p>
        </div>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.04fr', gap: 56, marginTop: 54, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {steps.map((s, i) => (
              <div key={i} className="reveal" style={{ display: 'flex', gap: 20, padding: '22px 4px', borderTop: '1px solid var(--line)', borderBottom: i === steps.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ flex: 'none', fontFamily: 'var(--heavy)', fontWeight: 900, fontSize: 26, lineHeight: 1, color: 'var(--acid-2)', minWidth: 46 }}>{s.n}</span>
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', marginBottom: 7, textTransform: 'uppercase' }}>
                    <span style={{ color: 'var(--ink-3)', display: 'inline-flex' }}><Icon name={s.ic} size={18} /></span>{s.t}
                  </h3>
                  <p style={{ color: 'var(--ink-2)', fontSize: 15.5, lineHeight: 1.55 }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
          <div ref={peek} className="frame reveal d2">
            <div className="frame-bar">
              <span className="frame-dot" /><span className="frame-dot" /><span className="frame-dot" />
              <span className="frame-url">app.klip.studio / composer</span>
            </div>
            <img src="/klip-media/composer.png" alt="Création dans KLIP" style={{ display: 'block', width: '100%' }} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── EditorUI — éditeur visuel reproduit ────────────────────────────────── */
function EditorUI() {
  const E = { sunk: '#ECEBE1', mint: '#1F9D63', mintSoft: '#E2F4EA', line: 'rgba(13,15,10,.12)', ink: '#14160F', ink2: '#5A5E50', ink3: '#8A8D7E', cream: '#EEEDE3' };
  const Div = () => <span style={{ width: 1, height: 22, background: E.line, margin: '0 5px', flexShrink: 0 }} />;
  const IBtn = ({ name, on }: { name: string; on?: boolean }) => (
    <span style={{ width: 33, height: 33, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0, color: on ? E.mint : E.ink, background: on ? E.mintSoft : 'transparent' }}><EdIcon name={name} size={18} /></span>
  );
  const TxtBtn = ({ name, label }: { name: string; label: string }) => (
    <span style={{ height: 33, padding: '0 11px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: E.ink, flexShrink: 0, whiteSpace: 'nowrap' }}><EdIcon name={name} size={16} /> {label}</span>
  );
  const rail: [string, string][] = [['template', 'Modèles'], ['shapes', 'Éléments'], ['text', 'Texte'], ['image', 'Photos'], ['palette', 'Charte'], ['upload', 'Importer']];
  const handle = [{ t: -5, l: -5 }, { t: -5, r: -5 }, { b: -5, l: -5 }, { b: -5, r: -5 }, { t: -5, l: '50%' }, { b: -5, l: '50%' }, { t: '50%', l: -5 }, { t: '50%', r: -5 }] as { t?: number | string; l?: number | string; r?: number | string; b?: number | string }[];
  return (
    <div style={{ width: '100%', borderRadius: 14, overflow: 'hidden', color: E.ink, background: 'radial-gradient(120% 80% at 50% -10%, #FBFAF4, #ECEBE1 70%)', border: '1px solid rgba(13,15,10,.1)', boxShadow: '0 40px 80px -36px rgba(0,0,0,.6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', minHeight: 58, background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${E.line}` }}>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0, color: E.ink2 }}>
          <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center' }}><EdIcon name="undo" size={18} /></span>
          <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center' }}><EdIcon name="redo" size={18} /></span>
        </div>
        <Div />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#fff', borderRadius: 12, padding: '5px 7px', boxShadow: '0 8px 26px -10px rgba(13,15,10,.26), 0 0 0 1px rgba(13,15,10,.05)' }}>
            <span style={{ height: 33, padding: '0 10px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8, background: E.sunk, flexShrink: 0 }}>
              <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 600, fontSize: 13 }}>Archivo</span><EdIcon name="chevD" size={13} style={{ color: E.ink3 }} />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', background: E.sunk, borderRadius: 9, marginLeft: 4, height: 33, flexShrink: 0 }}>
              <span style={{ width: 28, display: 'grid', placeItems: 'center', color: E.ink }}><EdIcon name="minus" size={15} /></span>
              <span style={{ width: 34, textAlign: 'center', fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>92</span>
              <span style={{ width: 28, display: 'grid', placeItems: 'center', color: E.ink }}><EdIcon name="plus" size={15} /></span>
            </span>
            <Div />
            <span style={{ width: 33, height: 33, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 19, height: 19, borderRadius: 6, background: E.cream, boxShadow: 'inset 0 0 0 1.5px rgba(13,15,10,.18)' }} />
            </span>
            <IBtn name="bold" on /><IBtn name="italic" on /><IBtn name="underline" /><IBtn name="strike" /><IBtn name="case" />
            <Div />
            <IBtn name="alignL" /><IBtn name="lineH" /><TxtBtn name="effects" label="Effets" />
            <Div />
            <IBtn name="transp" /><TxtBtn name="animate" label="Animer" /><TxtBtn name="position" label="Position" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <span style={{ height: 34, padding: '0 13px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: E.ink2, boxShadow: `inset 0 0 0 1px ${E.line}` }}><EdIcon name="eye" size={15} /> Aperçu</span>
          <span style={{ height: 34, padding: '0 13px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: '#fff', background: E.mint }}><EdIcon name="upload" size={15} /> Partager</span>
        </div>
      </div>
      <div style={{ display: 'flex', minHeight: 420 }}>
        <div className="ed-rail" style={{ width: 70, flexShrink: 0, background: '#fff', borderRight: `1px solid ${E.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 0' }}>
          {rail.map(([ic, label], i) => {
            const on = i === 2;
            return (
              <span key={i} style={{ width: 54, height: 56, borderRadius: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, color: on ? E.mint : E.ink2, background: on ? E.mintSoft : 'transparent' }}>
                <EdIcon name={ic} size={20} stroke={1.7} />
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 9, letterSpacing: '.02em', textTransform: 'uppercase' }}>{label}</span>
              </span>
            );
          })}
        </div>
        <div className="ed-work" style={{ flex: 1, minWidth: 0, display: 'grid', placeItems: 'center', padding: 26 }}>
          <div className="ed-canvas" style={{ position: 'relative', height: 408, aspectRatio: '4 / 5', borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 70px -30px rgba(13,15,10,.55)', background: 'linear-gradient(155deg,#1f7a4d,#0c2a1d)' }}>
            <span style={{ position: 'absolute', top: 18, left: 18, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, letterSpacing: '.14em', color: E.cream }}>MAISON LOU</span>
            <div style={{ position: 'absolute', top: 44, left: 18, right: 18, height: 150, borderRadius: 12, border: '1.5px dashed rgba(238,237,227,.5)', background: 'rgba(255,255,255,.06)', display: 'grid', placeItems: 'center', color: 'rgba(238,237,227,.6)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}><EdIcon name="image" size={22} stroke={1.5} /><span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700 }}>PHOTO DU PLAT</span></div>
            </div>
            <span style={{ position: 'absolute', top: 208, left: 18, background: 'var(--acid)', color: '#14160F', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, letterSpacing: '.08em', padding: '7px 14px', borderRadius: 999 }}>SEPTEMBRE</span>
            <div style={{ position: 'absolute', top: 248, left: 18, width: 226 }}>
              <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 800, fontStyle: 'italic', fontSize: 32, lineHeight: 0.96, letterSpacing: '-0.03em', color: E.cream, textShadow: '0 3px 16px rgba(0,0,0,.45)' }}>Nouvelle carte d&apos;automne</div>
              <div style={{ position: 'absolute', inset: '-9px -11px', border: `1.5px solid ${E.mint}`, borderRadius: 3 }}>
                {handle.map((h, i) => (
                  <span key={i} style={{ position: 'absolute', top: h.t, left: h.l, right: h.r, bottom: h.b, width: 8, height: 8, transform: (h.l === '50%' || h.t === '50%') ? 'translate(-50%,-50%)' : 'none', background: '#fff', border: `1.5px solid ${E.mint}`, borderRadius: 2 }} />
                ))}
                <span style={{ position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)', width: 1, height: 18, background: E.mint }} />
                <span style={{ position: 'absolute', top: -34, left: '50%', transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', border: `1.5px solid ${E.mint}` }} />
              </div>
            </div>
            <div style={{ position: 'absolute', top: 352, left: 18, width: 200, fontFamily: "'Satoshi',sans-serif", fontWeight: 500, fontSize: 13, lineHeight: 1.25, color: 'rgba(238,237,227,.82)' }}>Réservations ouvertes tout le mois</div>
          </div>
        </div>
      </div>
      <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderTop: `1px solid ${E.line}`, background: '#fff' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, color: E.ink2, background: E.sunk, padding: '6px 11px', borderRadius: 999 }}><EdIcon name="image" size={13} /> Page 1 · Post 4:5</span>
        <span style={{ fontSize: 12, color: E.ink3, fontWeight: 600 }}>Maison Lou</span>
        <div className="ed-zoomr" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9, color: E.ink2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11.5, padding: '6px 10px', borderRadius: 999, boxShadow: `inset 0 0 0 1px ${E.line}` }}><EdIcon name="play" size={13} /> Animer</span>
          <span style={{ width: 1, height: 20, background: E.line }} />
          <EdIcon name="minus" size={15} />
          <span style={{ width: 92, height: 4, borderRadius: 2, background: E.sunk, position: 'relative' }}><span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '42%', background: E.mint, borderRadius: 2 }} /><span style={{ position: 'absolute', left: '42%', top: '50%', transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} /></span>
          <EdIcon name="plus" size={15} />
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11.5, width: 38, textAlign: 'center' }}>50%</span>
          <EdIcon name="fit" size={15} />
        </div>
      </div>
    </div>
  );
}

/* ─── Showcase ───────────────────────────────────────────────────────────── */
function Showcase() {
  const a = useParallax(0.06), b = useParallax(0.09);
  const shots = [
    { ref: a, img: '/klip-media/calendar.png', t: 'Calendrier éditorial', d: 'Tous les posts de tous vos clients sur une seule grille. Glissez pour replanifier, repérez les trous, gardez le rythme — sans tableur.', tags: ['Glisser-déposer', 'Vue mois / semaine', 'Multi-clients'] },
    { ref: b, img: '/klip-media/queue.png', t: 'File de publication', d: 'Vos comptes Instagram connectés. Vous validez, KLIP publie au créneau prévu — plus besoin de rouvrir l’app ni de poster à la main.', tags: ['Auto-publication', 'Validation client', 'Créneaux'] },
  ];
  return (
    <section id="apercu" className="section on-forest" style={{ overflow: 'hidden' }}>
      <div className="wrap">
        <div style={{ maxWidth: 820 }}>
          <h2 className="display reveal" style={{ fontSize: 'clamp(38px, 5.6vw, 78px)' }}>
            Une interface qui <span className="it-serif acid-fill">respire.</span>
          </h2>
          <p className="lead reveal d2" style={{ marginTop: 24, maxWidth: 580 }}>
            Pensée pour gérer six marques sans jamais les mélanger. Voilà à quoi ressemble une journée de travail sans friction.
          </p>
        </div>
        <div className="reveal" style={{ marginTop: 64 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 28, flexWrap: 'wrap', marginBottom: 26 }}>
            <div style={{ maxWidth: 560 }}>
              <span className="sho-kicker">01 — L&apos;éditeur visuel</span>
              <h3 className="display" style={{ fontSize: 'clamp(28px,3.4vw,46px)', color: 'var(--cream)', marginTop: 14 }}>Un studio de création, pas un simple cadre</h3>
            </div>
            <p style={{ color: 'var(--cream-2)', fontSize: 16, lineHeight: 1.6, maxWidth: 380 }}>
              Sélectionnez un texte et tout s&apos;ouvre — police, taille, couleurs de la charte, effets, animations. La même puissance que Canva ou la suite Adobe, déjà calée sur votre client.
            </p>
          </div>
          <div className="ed-embed"><EditorUI /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(56px,8vw,104px)', marginTop: 'clamp(64px,9vw,120px)' }}>
          {shots.map((s, i) => {
            const flip = i % 2 === 1;
            return (
              <div key={i} className="sho-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(34px,5vw,72px)', alignItems: 'center' }}>
                <div className="reveal" style={{ order: flip ? 2 : 1 }}>
                  <span className="sho-kicker">{`0${i + 2}`} — {s.t}</span>
                  <h3 className="display" style={{ fontSize: 'clamp(28px,3.4vw,46px)', color: 'var(--cream)', marginTop: 14 }}>{s.t}</h3>
                  <p style={{ color: 'var(--cream-2)', fontSize: 17, lineHeight: 1.6, marginTop: 18, maxWidth: 440 }}>{s.d}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 24 }}>
                    {s.tags.map((t, j) => <span key={j} className="chip">{t}</span>)}
                  </div>
                </div>
                <div ref={s.ref} className="reveal d2 sho-shot" style={{ order: flip ? 1 : 2 }}>
                  <img src={s.img} alt={s.t} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── EditorMock — mini éditeur (Features) ───────────────────────────────── */
function EditorMock() {
  const corners = [{ top: -5, left: -5 }, { top: -5, right: -5 }, { bottom: -5, left: -5 }, { bottom: -5, right: -5 }] as React.CSSProperties[];
  return (
    <div style={{ background: 'var(--paper-2)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 350, margin: '0 auto', boxShadow: '0 34px 64px -30px rgba(0,0,0,.55)', border: '1px solid var(--line-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(140deg,#1f7a4d,#0c2a1d)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11 }}>ML</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#0c2a1d', 'var(--acid)', '#EFEEE4'].map((c, i) => <span key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: c, boxShadow: 'inset 0 0 0 1px var(--line)' }} />)}
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, color: 'var(--ink-2)', padding: '5px 9px', borderRadius: 7, boxShadow: 'inset 0 0 0 1px var(--line)' }}>Aa Archivo</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, color: 'var(--ink-3)' }}>● calé au pixel</span>
      </div>
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '3 / 4', background: 'radial-gradient(130% 130% at 18% 0%, #20a368, #0a2419 72%)', padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10, letterSpacing: '.14em', color: 'rgba(255,255,255,.82)' }}>MAISON LOU</span>
        <div style={{ position: 'relative', alignSelf: 'flex-start', maxWidth: '82%' }}>
          <div style={{ fontFamily: 'var(--heavy)', fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(20px,2.3vw,30px)', lineHeight: 1, color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>L&apos;été se réserve maintenant</div>
          <div style={{ position: 'absolute', inset: '-11px -13px', border: '1.6px dashed var(--acid)', borderRadius: 4, pointerEvents: 'none' }}>
            {corners.map((c, i) => <span key={i} style={{ position: 'absolute', ...c, width: 9, height: 9, background: 'var(--acid)', border: '1.5px solid #fff', borderRadius: 2 }} />)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#terrasse', '#nouvellecarte', '#septembre'].map((h, i) => (
            <span key={i} style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10.5, color: 'rgba(255,255,255,.9)', padding: '4px 9px', borderRadius: 999, background: 'rgba(255,255,255,.12)' }}>{h}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Features ───────────────────────────────────────────────────────────── */
function Features() {
  const tags = ['Charte par client', 'Glisser-déposer', 'Calé au pixel'];
  const F = ({ ic, t, d, tone }: { ic: string; t: string; d: string; tone?: 'acid' | 'forest' }) => {
    const isAcid = tone === 'acid', isForest = tone === 'forest';
    return (
      <div className="card reveal" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 13, background: isAcid ? 'var(--acid)' : isForest ? 'var(--forest)' : 'var(--paper-2)', color: isForest ? 'var(--cream)' : 'var(--ink)' }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, display: 'grid', placeItems: 'center', background: isAcid ? 'var(--acid-ink)' : isForest ? 'var(--acid)' : 'var(--ink)', color: isAcid ? 'var(--acid)' : isForest ? 'var(--acid-ink)' : 'var(--paper)' }}>
          <Icon name={ic} size={22} />
        </span>
        <h3 style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 21, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>{t}</h3>
        <p style={{ fontSize: 15, lineHeight: 1.58, color: isForest ? 'var(--cream-2)' : isAcid ? 'var(--acid-ink)' : 'var(--ink-2)', opacity: isAcid ? .82 : 1 }}>{d}</p>
      </div>
    );
  };
  return (
    <section id="features" className="section">
      <div className="wrap">
        <div style={{ maxWidth: 820 }}>
          <h2 className="display reveal" style={{ fontSize: 'clamp(38px, 5.6vw, 78px)' }}>
            Ce qu&apos;il fallait dix outils pour faire,<br /><span className="it-serif acid-fill">KLIP le fait d&apos;un trait.</span>
          </h2>
        </div>
        <div className="reveal feat-hero" style={{ display: 'grid', gridTemplateColumns: '1fr 1.12fr', gap: 0, marginTop: 52, background: 'var(--forest)', color: 'var(--cream)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: '0 50px 100px -55px rgba(6,32,24,.8)' }}>
          <div style={{ padding: 'clamp(32px, 3.6vw, 52px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
            <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--acid)', color: 'var(--acid-ink)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', padding: '8px 13px', borderRadius: 999 }}>
              <Icon name="spark" size={14} /> Atout phare
            </span>
            <h3 className="display" style={{ fontSize: 'clamp(36px, 4.4vw, 62px)' }}>Éditeur visuel</h3>
            <p style={{ color: 'var(--cream-2)', fontSize: 17.5, lineHeight: 1.6, maxWidth: 440 }}>
              La charte de chaque client — couleurs, typo, logo — appliquée d&apos;un clic. Vous glissez le texte, c&apos;est calé au pixel. Plus aucun logiciel de design à ouvrir.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              {tags.map((t, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5, color: 'var(--cream)', padding: '8px 13px', borderRadius: 999, background: 'var(--forest-2)', border: '1px solid var(--line-f)' }}>
                  <Icon name="check" size={14} style={{ color: 'var(--acid)' }} /> {t}
                </span>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--forest-2)', padding: 'clamp(26px, 3vw, 44px)', display: 'grid', placeItems: 'center' }}>
            <EditorMock />
          </div>
        </div>
        <div className="bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(238px, 1fr))', gap: 16, marginTop: 16 }}>
          <F ic="voice" t="Voix de marque" d="Ton, style, mots interdits. Chaque génération respecte l&rsquo;ADN du client." tone="acid" />
          <F ic="wand" t="Descriptions IA" d="Légendes et hashtags générés depuis la photo et le contexte de la marque." />
          <F ic="layers" t="Un espace par client" d="Charte, historique, comptes connectés — cloisonnés, jamais mélangés." />
          <F ic="instagram" t="Publication directe" d="Connexion compte pro. Programmez, validez, KLIP publie au créneau." tone="forest" />
        </div>
      </div>
    </section>
  );
}

/* ─── Testimonials ───────────────────────────────────────────────────────── */
function Testimonials() {
  const big = { q: 'On est passé de quatre outils à un seul. Le lundi matin n’a plus rien à voir — et on a pris trois clients de plus sans embaucher.', a: 'Camille R.', r: 'Directrice de création · Studio Klein' };
  const small = [
    { q: 'La voix de marque par client, c’est ce qui change tout. L’IA ne déborde jamais du cadre.', a: 'Yanis B.', r: 'Social media manager' },
    { q: 'Je gère six comptes sans jongler entre dix onglets. Mes clients valident plus vite.', a: 'Léa M.', r: 'Freelance · contenu de marque' },
  ];
  return (
    <section className="section on-forest" style={{ overflow: 'hidden' }}>
      <div className="wrap">
        <div style={{ maxWidth: 700 }}>
          <h2 className="display reveal d1" style={{ fontSize: 'clamp(38px, 5.6vw, 78px)', marginTop: 22 }}>
            Le calme, <span className="it-serif acid-fill">retrouvé.</span>
          </h2>
        </div>
        <div className="testi-grid" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 16, marginTop: 52 }}>
          <div className="reveal" style={{ gridRow: 'span 2', background: 'var(--acid)', color: 'var(--acid-ink)', borderRadius: 'var(--radius)', padding: '42px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Icon name="spark" size={30} />
            <p style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 'clamp(26px, 2.7vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.025em', margin: '26px 0' }}>&ldquo;{big.q}&rdquo;</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--forest)' }} />
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15 }}>{big.a}</div>
                <div style={{ fontSize: 13.5, opacity: .72 }}>{big.r}</div>
              </div>
            </div>
          </div>
          {small.map((x, i) => (
            <div key={i} className={`reveal d${i + 1}`} style={{ background: 'var(--forest-2)', borderRadius: 'var(--radius)', padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--line-f)' }}>
              <p style={{ fontSize: 19, lineHeight: 1.5, fontWeight: 500, color: 'var(--cream)' }}>&ldquo;{x.q}&rdquo;</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 26 }}>
                <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(140deg, var(--acid), var(--mint))' }} />
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: 'var(--cream)' }}>{x.a}</div>
                  <div style={{ fontSize: 13, color: 'var(--cream-3)' }}>{x.r}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ────────────────────────────────────────────────────────────── */
function Pricing() {
  const tiers = [
    { name: 'Solo', price: '24', tag: 'Le freelance qui démarre', clients: 'Jusqu’à 3 clients', feats: ['Éditeur visuel complet', 'Descriptions IA', 'Calendrier éditorial', '1 compte Instagram'], cta: 'Commencer', pop: false },
    { name: 'Studio', price: '59', tag: 'Le bon rythme de croisière', clients: 'Jusqu’à 10 clients', feats: ['Tout Solo, plus :', 'Voix de marque par client', 'Validation client intégrée', 'Création en lot', 'Comptes Instagram illimités'], cta: 'Essai 14 jours', pop: true },
    { name: 'Agence', price: '129', tag: 'Quand l’équipe s’agrandit', clients: 'Clients illimités', feats: ['Tout Studio, plus :', 'Membres d’équipe illimités', 'Rôles & permissions', 'Support prioritaire'], cta: 'Nous contacter', pop: false },
  ];
  return (
    <section id="tarifs" className="section dotgrid" style={{ overflow: 'hidden' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
          <h2 className="display reveal d1" style={{ fontSize: 'clamp(38px, 5.6vw, 78px)', marginTop: 22 }}>
            Un prix qui grandit <span className="it-serif acid-fill">avec vous.</span>
          </h2>
          <p className="lead reveal d2" style={{ marginTop: 22 }}>Sans engagement. Vous changez d&apos;offre quand vous voulez.</p>
        </div>
        <div className="price-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 56, alignItems: 'start' }}>
          {tiers.map((t, i) => (
            <div key={i} className={`reveal d${i + 1}`} style={{ position: 'relative', background: t.pop ? 'var(--forest)' : 'var(--paper-2)', color: t.pop ? 'var(--cream)' : 'var(--ink)', borderRadius: 'var(--radius)', padding: '34px 32px', border: t.pop ? 'none' : '1px solid var(--line)', boxShadow: t.pop ? '0 40px 80px -40px rgba(6,32,24,.6)' : 'none', transform: t.pop ? 'translateY(-14px)' : 'none' }}>
              {t.pop && <span style={{ position: 'absolute', top: -13, right: 26, background: 'var(--acid)', color: 'var(--acid-ink)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: 999 }}>Le plus choisi</span>}
              <div style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 22, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>{t.name}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: t.pop ? 'var(--cream-3)' : 'var(--ink-3)', marginTop: 4 }}>{t.tag}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '22px 0 4px' }}>
                <span style={{ fontFamily: 'var(--heavy)', fontWeight: 900, fontSize: 58, letterSpacing: '-0.04em', lineHeight: 1 }}>{t.price}€</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: t.pop ? 'var(--cream-2)' : 'var(--ink-3)' }}>/mois</span>
              </div>
              <div className="chip" style={{ marginBottom: 24, background: t.pop ? 'var(--forest-2)' : 'var(--paper-3)', color: t.pop ? 'var(--cream-2)' : 'var(--ink-2)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>{t.clients}</div>
              <Link href={t.pop ? '/register' : i === 2 ? 'mailto:contact@klip.fr' : '/register'} className={`btn ${t.pop ? 'btn-acid' : 'btn-ghost'}`} style={{ width: '100%', justifyContent: 'center', marginBottom: 26 }}>{t.cta}</Link>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {t.feats.map((f, j) => {
                  const head = j === 0 && f.endsWith(':');
                  return (
                    <li key={j} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 15, color: t.pop ? 'var(--cream-2)' : 'var(--ink-2)', fontWeight: head ? 700 : 400 }}>
                      {!head && <Icon name="check" size={17} style={{ flex: 'none', marginTop: 2, color: t.pop ? 'var(--acid)' : 'var(--acid-2)' }} />}
                      <span>{f}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ────────────────────────────────────────────────────────────────── */
function FAQ() {
  const items = [
    { q: 'Faut-il déjà avoir un compte Instagram pro ?', a: 'Oui. KLIP se connecte à un compte Instagram professionnel ou créateur via l’API officielle. La connexion prend deux minutes, par client.' },
    { q: 'L’IA respecte-t-elle vraiment la voix de chaque marque ?', a: 'Vous définissez le ton, le style et les mots interdits de chaque client une fois. Chaque génération s’appuie sur cette voix — vous gardez la main et peaufinez d’un clic.' },
    { q: 'Mes clients peuvent-ils valider sans compte KLIP ?', a: 'Oui. Vous envoyez un lien de validation : le client approuve ou commente directement, sans rien installer. Fini les allers-retours par mail.' },
    { q: 'Mes données clients sont-elles cloisonnées ?', a: 'Chaque client a son espace : charte, historique, comptes connectés. Rien n’est mélangé entre deux marques, jamais.' },
    { q: 'Puis-je changer d’offre en cours de route ?', a: 'À tout moment, sans engagement. Vous montez d’un palier quand vous prenez plus de clients, et redescendez si besoin.' },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="section">
      <div className="wrap">
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: 56, alignItems: 'start' }}>
          <div>
            <h2 className="display reveal d1" style={{ fontSize: 'clamp(36px, 4.8vw, 64px)', marginTop: 22 }}>
              Les questions <span className="it-serif acid-fill">qu&apos;on nous pose.</span>
            </h2>
            <p className="lead reveal d2" style={{ marginTop: 22 }}>Une autre en tête ? <a href="mailto:hello@klip.app" style={{ color: 'var(--ink)', textDecoration: 'underline', textDecorationColor: 'var(--acid-2)', textUnderlineOffset: 3 }}>Écrivez-nous.</a></p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((it, i) => {
              const isOpen = open === i;
              return (
                <div key={i} className="reveal" style={{ borderTop: '1px solid var(--line)', borderBottom: i === items.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <button onClick={() => setOpen(isOpen ? -1 : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '24px 2px', textAlign: 'left' }}>
                    <span style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 19.5, letterSpacing: '-0.015em' }}>{it.q}</span>
                    <span style={{ flex: 'none', width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: '50%', background: isOpen ? 'var(--acid)' : 'var(--paper-3)', color: isOpen ? 'var(--acid-ink)' : 'var(--ink)', transition: 'transform .3s, background .2s', transform: isOpen ? 'rotate(45deg)' : 'none' }}>
                      <Icon name="plus" size={18} />
                    </span>
                  </button>
                  <div style={{ maxHeight: isOpen ? 240 : 0, overflow: 'hidden', transition: 'max-height .4s cubic-bezier(.16,1,.3,1)' }}>
                    <p style={{ padding: '0 50px 26px 2px', color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.6 }}>{it.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── FinalCTA ───────────────────────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="section on-forest dotgrid" style={{ overflow: 'hidden', textAlign: 'center' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <h2 className="display reveal d1" style={{ fontSize: 'clamp(46px, 8vw, 116px)', maxWidth: 1000, margin: '0 auto' }}>
          Créez plus, <span className="it-serif acid-fill">jonglez moins.</span>
        </h2>
        <p className="lead reveal d2" style={{ maxWidth: 560, margin: '26px auto 0', fontSize: 20 }}>
          Un seul outil pour tous vos clients. Essayez KLIP gratuitement pendant 14 jours — sans carte bancaire.
        </p>
        <div className="reveal d3 final-cta" style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 40, flexWrap: 'wrap' }}>
          <Link href="/register" className="btn btn-acid">Démarrer gratuitement <span className="arr"><Icon name="arrowUR" size={18} /></span></Link>
          <a href="#apercu" className="btn btn-ghost">Revoir le produit</a>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */
function Footer() {
  const cols: [string, string[]][] = [
    ['Produit', ['Éditeur visuel', 'Descriptions IA', 'Calendrier', 'Publication']],
    ['Ressources', ['Tarifs', 'FAQ', 'Guide de démarrage', 'Statut']],
    ['Entreprise', ['À propos', 'Blog', 'Contact', 'Mentions légales']],
  ];
  return (
    <footer className="on-forest" style={{ paddingTop: 72, paddingBottom: 40, borderTop: '1px solid var(--line-f)' }}>
      <div className="wrap">
        <div className="foot-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 40 }}>
          <div>
            <KlipLogo size={30} light />
            <p style={{ color: 'var(--cream-2)', fontSize: 15, lineHeight: 1.6, marginTop: 18, maxWidth: 280 }}>
              Le studio social de tous vos clients. Toutes vos marques, un seul espace.
            </p>
          </div>
          {cols.map(([h, links], i) => (
            <div key={i}>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cream-3)', marginBottom: 16 }}>{h}</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
                {links.map((l, j) => <li key={j}><a href="#" style={{ color: 'var(--cream-2)', fontSize: 15 }}>{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 56, paddingTop: 26, borderTop: '1px solid var(--line-f)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--cream-3)' }}>
          <span>© 2026 KLIP — Tous droits réservés.</span>
          <span>Conçu pour tous ceux qui gèrent plusieurs marques.</span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) router.push('/dashboard'); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.v2 .reveal:not(.in)'));
    if (!('IntersectionObserver' in window) || els.length === 0) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  });

  return (
    <div className="v2">
      <style dangerouslySetInnerHTML={{ __html: V2_CSS }} />
      <Nav />
      <Hero />
      <Probleme />
      <Steps />
      <Showcase />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
