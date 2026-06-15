'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

/* ─── Design tokens ──────────────────────────────────────────────────────────
   Landing uses TWO accent colors:
   • mint  #2FD79B — primary CTAs, italic text accents, eyebrow
   • acid  #2FD79B — marquee strip, icon backgrounds, check circles, FinalCTA
   Background: #F1F0E8 (warm paper)   Sections foncées: #0C2A1D (forest)
   ─────────────────────────────────────────────────────────────────────────── */

const LP_CSS = `
  .lp {
    background: #F1F0E8;
    color: #0D0F0A;
    font-family: 'early-sans-variable', system-ui, sans-serif;
    font-size: 17px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
  .lp a { color: inherit; text-decoration: none; }
  .lp button { font-family: inherit; cursor: pointer; border: none; background: none; }
  .lp ::selection { background: #2FD79B; color: #06281C; }

  /* layout */
  .lp-wrap     { max-width: 1180px; margin: 0 auto; padding: 0 32px; }
  .lp-section  { padding: 120px 0; position: relative; }
  .lp-section-sm { padding: 84px 0; position: relative; }

  /* typography */
  .lp-display { font-family: 'Archivo', system-ui, sans-serif; font-weight: 800; line-height: 1.0; letter-spacing: -0.03em; text-wrap: balance; }
  .lp-upper   { text-transform: uppercase; font-weight: 900; letter-spacing: -0.015em; line-height: 0.94; }
  .lp-it      { font-style: italic; }
  .lp-mint    { color: #2FD79B; }

  .lp-eyebrow {
    font-family: 'early-sans-variable', system-ui, sans-serif;
    font-weight: 800; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase;
    color: #8E9183; display: inline-flex; align-items: center; gap: 9px;
  }
  .lp-eyebrow::before {
    content: ""; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    background: #2FD79B; box-shadow: 0 0 0 4px rgba(47,215,155,.25);
  }
  .lp-eyebrow.plain::before { display: none; }
  .lp-lead { color: #565A4E; font-size: 19px; line-height: 1.62; }

  /* forest sections */
  .lp-forest { background: #0C2A1D; color: #EFEEE4; }
  .lp-forest .lp-eyebrow { color: rgba(239,238,228,.62); }
  .lp-forest .lp-lead    { color: rgba(239,238,228,.62); }

  /* ── BUTTONS ── */
  .lp-btn {
    font-family: 'early-sans-variable', system-ui, sans-serif;
    font-weight: 800; font-size: 15.5px; letter-spacing: -0.01em;
    display: inline-flex; align-items: center; gap: 9px;
    padding: 15px 26px; border-radius: 999px; white-space: nowrap;
    transition: transform .18s cubic-bezier(.2,.7,.3,1), box-shadow .2s, background .2s, color .2s;
  }
  .lp-btn:hover { transform: translateY(-2px); }
  .lp-btn .arr { transition: transform .2s; }
  .lp-btn:hover .arr { transform: translate(3px,-3px); }

  /* mint — primary CTA */
  .lp-btn-mint {
    background: #2FD79B; color: #06281C !important;
    box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 10px 24px -12px rgba(47,215,155,.55);
  }
  .lp-btn-mint:hover { background: #26C98E; box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 16px 30px -12px rgba(47,215,155,.6); }

  /* acid — for use on forest/dark bg */
  .lp-btn-acid {
    background: #2FD79B; color: #06281C !important;
    box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 10px 24px -12px rgba(47,215,155,.45);
  }
  .lp-btn-acid:hover { background: #21B381; box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 16px 30px -12px rgba(47,215,155,.55); }

  .lp-btn-ink   { background: #0D0F0A; color: #F1F0E8 !important; }
  .lp-btn-ghost { background: transparent; color: #0D0F0A !important; box-shadow: inset 0 0 0 1.5px rgba(13,15,10,.18); }
  .lp-btn-ghost:hover { box-shadow: inset 0 0 0 1.5px #0D0F0A; }
  .lp-btn-ghost-light { background: transparent; color: #EFEEE4 !important; box-shadow: inset 0 0 0 1.5px rgba(239,238,228,.35); }
  .lp-btn-ghost-light:hover { box-shadow: inset 0 0 0 1.5px rgba(239,238,228,.65); }
  .lp-btn-sm  { padding: 11px 18px !important; font-size: 14px !important; }

  /* card */
  .lp-card {
    background: #FBFAF4; border-radius: 18px;
    box-shadow: inset 0 0 0 1px rgba(13,15,10,.07), 0 1px 2px rgba(13,15,10,.03);
  }

  /* nav scroll-solid */
  .lp-nav-solid {
    background: rgba(241,240,232,.85) !important;
    backdrop-filter: blur(14px) saturate(1.4) !important;
    border-bottom: 1px solid rgba(13,15,10,.12) !important;
    padding: 12px 0 !important;
  }

  /* hero dot-grid background */
  .lp-hero-grid::before {
    content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background-image: radial-gradient(circle at center, rgba(13,15,10,.13) 1.3px, transparent 1.4px);
    background-size: 26px 26px;
    -webkit-mask-image: radial-gradient(ellipse 72% 62% at 50% 36%, #000 0%, transparent 72%);
    mask-image: radial-gradient(ellipse 72% 62% at 50% 36%, #000 0%, transparent 72%);
  }

  /* marquee */
  @keyframes lp-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }

  /* scroll reveal */
  .lp-reveal { opacity: 0; transform: translateY(20px); }
  .lp-reveal.in { opacity: 1; transform: none; transition: opacity .65s cubic-bezier(.16,1,.3,1), transform .65s cubic-bezier(.16,1,.3,1); }
  .lp-reveal.d1.in { transition-delay: .07s; }
  .lp-reveal.d2.in { transition-delay: .14s; }
  .lp-reveal.d3.in { transition-delay: .21s; }
  .lp-reveal.d4.in { transition-delay: .28s; }
  @media (prefers-reduced-motion: reduce) { .lp-reveal { opacity: 1 !important; transform: none !important; } }

  /* nav link hover */
  .lp-nav-link { color: #565A4E; transition: color .15s; font-family: 'early-sans-variable', system-ui, sans-serif; font-weight: 700; font-size: 15px; }
  .lp-nav-link:hover { color: #0D0F0A; }

  /* footer links */
  .lp-foot-link { opacity: .85; transition: opacity .15s; }
  .lp-foot-link:hover { opacity: 1; }

  /* responsive */
  @media (max-width: 980px) {
    .lp-hero-art { display: none !important; }
    .lp-nav-links { display: none !important; }
  }
  @media (max-width: 900px) {
    .lp { font-size: 16px; }
    .lp-section { padding: 84px 0; }
    .lp-section-sm { padding: 60px 0; }
    .lp-wrap { padding: 0 22px; }
    .lp-2col { grid-template-columns: 1fr !important; }
    .lp-3col { grid-template-columns: 1fr !important; }
    .lp-feat-wide { grid-column: span 1 !important; }
    .lp-testi-main { grid-row: auto !important; }
    .lp-nav-login { display: none !important; }
    .lp-foot-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
  }
  @media (max-width: 560px) {
    .lp-photo-grid { grid-template-columns: repeat(2,1fr) !important; }
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

/* ─── KlipLogo ───────────────────────────────────────────────────────────── */
function KlipLogo({ size = 26, light = false }: { size?: number; light?: boolean }) {
  return (
    <img
      src={light ? '/logo-klip-mint.png' : '/logo-klip-dark.png'}
      alt="Klip"
      style={{ height: size, width: 'auto' }}
    />
  );
}

/* ─── PostThumb — Instagram card placeholder ─────────────────────────────── */
const POST_GRADS = [
  'linear-gradient(150deg,#1b5e3a,#0c2a1d)',
  'linear-gradient(150deg,#2FD79B,#21B381)',
  'linear-gradient(150deg,#0c2a1d,#1f7a4d)',
  'linear-gradient(150deg,#e9e7da,#cfd3b0)',
  'linear-gradient(150deg,#103725,#2b8d57)',
  'linear-gradient(150deg,#d7f25a,#9bd11f)',
];
function PostThumb({ i = 0, tag, brand }: { i?: number; tag: string; brand: string }) {
  const grad = POST_GRADS[i % POST_GRADS.length];
  const lime = i % 6 === 1 || i % 6 === 3 || i % 6 === 5;
  const fg = lime ? '#16321a' : '#EFEEE4';
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 0 1px rgba(13,15,10,.05), 0 20px 40px -24px rgba(13,15,10,.4)' }}>
      <div style={{ position: 'relative', aspectRatio: '4/5', background: grad, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: fg, opacity: .8 }}>{brand}</span>
          <span style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${fg}`, opacity: .55 }} />
        </div>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontStyle: 'italic', fontSize: 22, lineHeight: .98, letterSpacing: '-0.02em', color: fg, whiteSpace: 'pre-line' }}>{tag}</div>
        <div style={{ display: 'flex', gap: 12, color: fg, opacity: .8 }}>
          <Icon name="heart" size={16} /><Icon name="chat" size={16} /><Icon name="send" size={16} />
        </div>
      </div>
      <div style={{ padding: '9px 12px 11px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ height: 6, width: '78%', borderRadius: 3, background: 'rgba(13,15,10,.12)' }} />
        <span style={{ height: 6, width: '52%', borderRadius: 3, background: 'rgba(13,15,10,.08)' }} />
      </div>
    </div>
  );
}

/* ─── FChip — floating workflow label ────────────────────────────────────── */
function FChip({ icon, label, style, accent }: { icon: string; label: string; style?: React.CSSProperties; accent?: boolean }) {
  return (
    <div style={{ position: 'absolute', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 13.5, padding: '9px 15px', borderRadius: 999, whiteSpace: 'nowrap', background: accent ? '#2FD79B' : '#fff', color: accent ? '#06281C' : '#0D0F0A', boxShadow: '0 1px 0 1px rgba(13,15,10,.05), 0 16px 30px -18px rgba(13,15,10,.45)', ...style }}>
      <Icon name={icon} size={16} /> {label}
    </div>
  );
}

/* ─── HeroCollage ────────────────────────────────────────────────────────── */
function HeroCollage() {
  const cards = [
    { i: 0, brand: 'Maison Lou',  tag: "L'été se\nréserve\nmaintenant", rot: -5, y: 18 },
    { i: 1, brand: 'Café Oreste', tag: "Nouvelle\ncarte ↗",             rot: 3,  y: -22 },
    { i: 5, brand: 'Brut & Co',   tag: 'Édition\nlimitée',              rot: -3, y: -10 },
    { i: 2, brand: 'Studio Vél',  tag: 'On recrute.',                   rot: 5,  y: 24 },
  ];
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        {cards.map((c, k) => (
          <div key={k} style={{ width: 156, flexShrink: 0, transform: `rotate(${c.rot}deg) translateY(${c.y}px)` }}>
            <PostThumb i={c.i} brand={c.brand} tag={c.tag} />
          </div>
        ))}
      </div>
      <FChip icon="image"     label="Visuel"         accent style={{ top: '6%',   left: '10%' }} />
      <FChip icon="wand"      label="Description IA"        style={{ top: '1%',   right: '12%' }} />
      <FChip icon="instagram" label="Publié"                style={{ bottom: '5%',left: '18%' }} />
      <FChip icon="calendar"  label="Planifié"              style={{ bottom: '1%',right: '15%' }} />
    </div>
  );
}

/* ─── Nav ────────────────────────────────────────────────────────────────── */
function Nav({ onDemo }: { onDemo: () => void }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const f = () => setSolid(window.scrollY > 24);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  const links: [string, string][] = [
    ['Le problème', '#probleme'],
    ['Comment ça marche', '#process'],
    ['Démo', '#demo'],
    ['Tarifs', '#tarifs'],
  ];
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, transition: 'all .3s', padding: '20px 0', background: 'transparent', borderBottom: '1px solid transparent' }} className={solid ? 'lp-nav-solid' : ''}>
      <div className="lp-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <a href="#top" aria-label="Klip"><KlipLogo size={26} /></a>
        <div className="lp-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          {links.map(([l, h]) => <a key={h} href={h} className="lp-nav-link">{l}</a>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/login" className="lp-nav-login lp-nav-link">Se connecter</Link>
          <Link href="/register" className="lp-btn lp-btn-mint lp-btn-sm">Essayer gratuitement</Link>
        </div>
      </div>
    </nav>
  );
}

/* ─── Hero — centered, Archivo 900 géant, 2 lignes ──────────────────────── */
function Hero({ onDemo }: { onDemo: () => void }) {
  return (
    <header id="top" className="lp-section lp-hero-grid" style={{ paddingTop: 168, paddingBottom: 40, textAlign: 'center', overflow: 'hidden' }}>
      <div className="lp-wrap" style={{ position: 'relative', zIndex: 2 }}>
        {/* eyebrow */}
        <div className="lp-reveal in" style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <span className="lp-eyebrow">Le studio social des agences</span>
        </div>
        {/* big headline — 2 lines */}
        <div className="lp-reveal in d1" style={{ display: 'inline-block' }}>
          <h1 className="lp-display lp-upper" style={{ fontSize: 'clamp(44px, 7vw, 100px)', margin: 0 }}>
            Créer. Planifier. Publier.<br />
            <span className="lp-it lp-mint">Tout. Ici.</span>
          </h1>
        </div>
        {/* sub */}
        <div className="lp-reveal in d2" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p className="lp-lead" style={{ maxWidth: 580, marginTop: 28 }}>
            Un éditeur visuel par-là. Un outil IA pour le texte par-ci.<br />
            Un planificateur ailleurs. Un fil de messagerie pour valider.<br />
            Et au bout : le mauvais fichier envoyé au mauvais client.
          </p>
          <p className="lp-lead" style={{ maxWidth: 580, marginTop: 16 }}>
            Klip réunit tout le processus de post-production de vos contenus
            dans un seul outil — pour les agences et les community managers
            qui veulent arrêter de jongler et recommencer à créer.
          </p>
          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 34, justifyContent: 'center', alignItems: 'center' }}>
            <Link href="/register" className="lp-btn lp-btn-mint">
              Essayer gratuitement <Icon name="arrowUR" size={18} className="arr" />
            </Link>
            <button className="lp-btn lp-btn-ghost" onClick={onDemo}>
              <Icon name="play" size={16} /> Voir la démo
            </button>
          </div>
          {/* trust */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24, color: '#8E9183', fontFamily: "'early-sans-variable', sans-serif", fontWeight: 700, fontSize: 13.5 }}>
            <Icon name="check" size={15} style={{ color: '#2FD79B' }} /> 7 jours gratuits
            <span style={{ opacity: .4 }}>·</span> Sans carte bancaire
            <span style={{ opacity: .4 }}>·</span> Annulable à tout moment
          </div>
        </div>
        {/* collage */}
        <div className="lp-reveal in d3" style={{ marginTop: 56, height: 380 }}>
          <HeroCollage />
        </div>
      </div>
    </header>
  );
}

/* ─── Marquee — fond acid #2FD79B ────────────────────────────────────────── */
function Marquee() {
  const words = ['Créer', 'Planifier', 'Publier', 'Recommencer', 'Gagner du temps', 'Un espace par client', 'Descriptions IA', 'Calendrier'];
  const row = [...words, ...words];
  return (
    <div style={{ background: '#2FD79B', borderTop: '2px solid #0D0F0A', borderBottom: '2px solid #0D0F0A', overflow: 'hidden', padding: '16px 0' }}>
      <div style={{ display: 'flex', width: 'max-content', animation: 'lp-ticker 32s linear infinite' }}>
        {row.map((w, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 24, paddingRight: 24 }}>
            <span className="lp-display lp-it" style={{ fontWeight: 900, fontSize: 27, letterSpacing: '-0.02em', textTransform: 'uppercase', color: '#06281C' }}>{w}</span>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#06281C', opacity: .55 }} />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Problème — fond forêt ──────────────────────────────────────────────── */
function Probleme() {
  const tools = [
    { n: 'Le mauvais fichier.', t: "Vous finissez le visuel sur votre éditeur, vous l'exportez, vous l'envoyez sur votre fil de messagerie au client, il vous dit « c'était pas cette photo ». Vous recommencez." },
    { n: '6 clients, 6 dossiers.', t: "Vous gérez 6 clients. Chacun a sa charte, ses tons, ses formats. Vous avez 6 projets dans votre éditeur visuel, 6 dossiers partagés, 6 fils de conversation. Vous perdez 20 minutes à retrouver le bon logo." },
    { n: 'La publication bloquée.', t: "Votre publication du jeudi est prête. Mais le visuel est dans votre éditeur. La légende est dans un doc de suivi. La validation client dort dans vos mails depuis mardi." },
  ];
  return (
    <section id="probleme" className="lp-section lp-forest" style={{ overflow: 'hidden' }}>
      <div className="lp-wrap">
        <div className="lp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <span className="lp-eyebrow lp-reveal" style={{ color: '#2FD79B' }}>Le problème</span>
            <h2 className="lp-display lp-upper lp-reveal d1" style={{ fontSize: 'clamp(34px, 4.2vw, 58px)', marginTop: 20, color: '#EFEEE4' }}>
              On sait exactement<br /><span className="lp-it lp-mint">ce que vous vivez.</span>
            </h2>
            <p className="lp-lead lp-reveal d2" style={{ marginTop: 24, maxWidth: 460 }}>
              Canva pour les visuels. ChatGPT pour les textes. Un tableur pour le planning.
              Meta Business pour publier. Et vous, au milieu, à tout recoller à la main —
              pour chaque client, chaque semaine.
            </p>
            <div className="lp-reveal d3" style={{ marginTop: 30, display: 'inline-flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 14, background: '#2FD79B', color: '#06281C' }}>
              <Icon name="clock" size={20} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 14.5, lineHeight: 1.2 }}>2H PAR JOUR. En moyenne, perdues à coller des outils ensemble.</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tools.map((x, i) => (
              <div key={i} className={`lp-reveal d${i + 1}`} style={{ padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 18, transform: `rotate(${i % 2 ? .5 : -.6}deg)`, background: '#103725', borderRadius: 18, boxShadow: 'inset 0 0 0 1px rgba(239,238,228,.22)' }}>
                <span style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 900, fontSize: 13, color: 'rgba(239,238,228,.28)', width: 22, flexShrink: 0, paddingTop: 4 }}>{String(i + 1).padStart(2, '0')}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: '#EFEEE4', marginBottom: 6 }}>{x.n}</div>
                  <div style={{ color: 'rgba(239,238,228,.55)', fontSize: 14, lineHeight: 1.55 }}>{x.t}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Process ────────────────────────────────────────────────────────────── */
function Process() {
  const steps = [
    { ic: 'upload',    n: '01', t: 'Importer',  d: "Importez vos photos et vidéos directement dans Klip. Jusqu'à 7 fichiers en une seule fois." },
    { ic: 'image',     n: '02', t: 'Créer',     d: "Éditeur visuel intégré. Charte du client sauvegardée. Formats Story, Reel et Post en un clic. Sans exporter, sans copier-coller." },
    { ic: 'wand',      n: '03', t: 'Rédiger',   d: "L'IA génère la légende dans le ton exact du client en 10 secondes. Vous relisez, vous ajustez." },
    { ic: 'instagram', n: '04', t: 'Publier',   d: "Programmation automatique sur Instagram et Facebook. Sélectionnez le type de post, choisissez l'heure. Klip fait le reste." },
  ];
  return (
    <section id="process" className="lp-section">
      <div className="lp-wrap">
        <div style={{ maxWidth: 720 }}>
          <span className="lp-eyebrow lp-reveal">Comment ça marche</span>
          <h2 className="lp-display lp-upper lp-reveal d1" style={{ fontSize: 'clamp(38px, 4.8vw, 66px)', marginTop: 20 }}>
            Un seul endroit.<br /><span className="lp-it lp-mint">Toute la post-production.</span>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginTop: 56 }}>
          {steps.map((s, i) => (
            <div key={i} className={`lp-card lp-reveal d${i + 1}`} style={{ padding: 28, position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <span style={{ width: 48, height: 48, borderRadius: 13, background: '#2FD79B', color: '#06281C', display: 'grid', placeItems: 'center' }}>
                  <Icon name={s.ic} size={22} />
                </span>
                <span className="lp-display" style={{ fontWeight: 700, fontSize: 48, lineHeight: 1, color: 'rgba(13,15,10,.1)' }}>{s.n}</span>
              </div>
              <h3 className="lp-display lp-upper" style={{ fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', marginBottom: 10 }}>{s.t}</h3>
              <p style={{ color: '#565A4E', fontSize: 14.5, lineHeight: 1.62 }}>{s.d}</p>
            </div>
          ))}
        </div>
        <p className="lp-reveal" style={{ marginTop: 28, textAlign: 'center', color: '#8E9183', fontFamily: "'early-sans-variable', sans-serif", fontWeight: 700, fontSize: 14 }}>
          Plus besoin de jongler entre votre éditeur visuel, votre outil IA, votre planificateur et vos fils de validation.
        </p>
      </div>
    </section>
  );
}

/* ─── Interactive Demo ───────────────────────────────────────────────────── */
const DEMO_PHOTOS = [
  { g: 'linear-gradient(150deg,#2b8d57,#0c2a1d)', n: 'terrasse-01.jpg' },
  { g: 'linear-gradient(150deg,#caa14a,#6e4d1c)', n: 'dessert-04.jpg' },
  { g: 'linear-gradient(150deg,#4a6a8d,#1a2535)', n: 'salle-02.jpg' },
  { g: 'linear-gradient(150deg,#b85c4a,#5a1f17)', n: 'chef-07.jpg' },
];
const DEMO_VOICES: Record<string, string> = {
  Chic:    "La lumière de fin d\u2019été sur nos tables. Nouvelle carte, réservations ouvertes pour septembre.\n\n#maisonlou #artdevivre #septembre",
  Punchy:  "Septembre, on remet le couvert. Nouvelle carte, résa en bio — ça part vite.\n\n#maisonlou #foodie #septembre",
  Minimal: "Septembre. Nouvelle carte. Réservez.\n\n#maisonlou",
};
const DEMO_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function ProductDemo() {
  const [step, setStep]           = useState(0);
  const [photo, setPhoto]         = useState<number | null>(null);
  const [voice, setVoice]         = useState('Chic');
  const [caption, setCaption]     = useState('');
  const [typing, setTyping]       = useState(false);
  const [day, setDay]             = useState<number | null>(null);
  const [published, setPublished] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const generate = useCallback((v: string) => {
    const full = DEMO_VOICES[v];
    setTyping(true); setCaption('');
    if (timer.current) clearInterval(timer.current);
    let i = 0;
    timer.current = setInterval(() => {
      i += 2; setCaption(full.slice(0, i));
      if (i >= full.length) { if (timer.current) clearInterval(timer.current); setTyping(false); }
    }, 14);
  }, []);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const reset  = () => { setStep(0); setPhoto(null); setCaption(''); setVoice('Chic'); setDay(null); setPublished(false); };
  const canNext = step === 0 ? photo !== null : step === 1 ? caption.length > 0 && !typing : day !== null;
  const ph = DEMO_PHOTOS[photo ?? 0];

  return (
    <div style={{ background: '#FBFAF4', borderRadius: 22, overflow: 'hidden', boxShadow: '0 1px 0 1px rgba(13,15,10,.07), 0 50px 90px -50px rgba(0,0,0,.75)', maxWidth: 980, margin: '0 auto' }}>
      {/* window bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: '#fff', borderBottom: '1px solid rgba(13,15,10,.1)' }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map(c => <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginLeft: 6 }}>
          <span style={{ width: 24, height: 24, borderRadius: 7, background: '#2FD79B', display: 'grid', placeItems: 'center', color: '#06281C', flexShrink: 0 }}><Icon name="layers" size={14} /></span>
          <span style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 14 }}>Maison Lou</span>
          <span style={{ fontSize: 12, color: '#8E9183', fontFamily: "'early-sans-variable', sans-serif", fontWeight: 700 }}>· espace client</span>
        </div>
        <span style={{ marginLeft: 'auto', fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8E9183' }}>Démo live</span>
      </div>

      {/* stepper */}
      <div style={{ display: 'flex', gap: 6, padding: '14px 18px', background: '#FBFAF4', borderBottom: '1px solid rgba(13,15,10,.1)' }}>
        {['Importer', 'Générer', 'Planifier'].map((t, i) => {
          const active = i === step, done = i < step;
          return (
            <button key={t} onClick={() => (i <= step || (i === step + 1 && canNext)) && setStep(i)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '10px 12px', borderRadius: 999, fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 14, background: active ? '#0D0F0A' : done ? 'rgba(47,215,155,.18)' : 'transparent', color: active ? '#F1F0E8' : '#0D0F0A', boxShadow: !active && !done ? 'inset 0 0 0 1px rgba(13,15,10,.12)' : 'none', transition: 'all .2s' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, background: active || done ? '#2FD79B' : 'rgba(13,15,10,.1)', color: '#06281C' }}>
                {done ? <Icon name="check" size={12} /> : i + 1}
              </span>
              {t}
            </button>
          );
        })}
      </div>

      {/* body */}
      <div style={{ padding: 24, minHeight: 360, display: 'grid', gridTemplateColumns: step === 0 ? '1fr' : '1fr 1fr', gap: 24 }}>
        {/* step 0 */}
        {step === 0 && (
          <div>
            <p style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 14, marginBottom: 14, color: '#565A4E' }}>Choisissez un visuel du dernier shooting</p>
            <div className="lp-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {DEMO_PHOTOS.map((p, i) => {
                const sel = photo === i;
                return (
                  <button key={i} onClick={() => setPhoto(i)} style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', aspectRatio: '4/5', padding: 0, boxShadow: sel ? '0 0 0 3px #2FD79B, 0 14px 28px -16px rgba(0,0,0,.5)' : 'inset 0 0 0 1px rgba(13,15,10,.12)', transition: 'all .15s', transform: sel ? 'translateY(-3px)' : 'none' }}>
                    <span style={{ position: 'absolute', inset: 0, background: p.g }} />
                    {sel && <span style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: '#2FD79B', color: '#06281C', display: 'grid', placeItems: 'center' }}><Icon name="check" size={15} /></span>}
                    <span style={{ position: 'absolute', left: 8, bottom: 8, fontFamily: "'early-sans-variable', sans-serif", fontWeight: 700, fontSize: 10.5, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>{p.n}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 16, border: '1.5px dashed rgba(13,15,10,.15)', borderRadius: 14, padding: 18, display: 'flex', alignItems: 'center', gap: 12, color: '#8E9183' }}>
              <Icon name="upload" size={20} />
              <span style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 700, fontSize: 14 }}>… ou déposez vos propres fichiers ici</span>
            </div>
          </div>
        )}

        {/* preview (steps 1 & 2) */}
        {step > 0 && (
          <div>
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(13,15,10,.1)', maxWidth: 310, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#2FD79B' }} />
                <span style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 13 }}>maisonlou</span>
                <span style={{ marginLeft: 'auto', color: '#8E9183' }}>···</span>
              </div>
              <div style={{ position: 'relative', aspectRatio: '4/5', background: ph.g, display: 'flex', alignItems: 'flex-end', padding: 18 }}>
                <div className="lp-display lp-it" style={{ fontWeight: 700, fontSize: 30, lineHeight: .98, color: '#fff', textShadow: '0 2px 18px rgba(0,0,0,.35)' }}>L&apos;été se réserve maintenant</div>
              </div>
              <div style={{ display: 'flex', gap: 14, padding: '11px 12px 6px', color: '#0D0F0A' }}>
                <Icon name="heart" size={20} /><Icon name="chat" size={20} /><Icon name="send" size={20} />
              </div>
              <div style={{ padding: '0 12px 14px', fontSize: 12.5, lineHeight: 1.5, color: '#0D0F0A', minHeight: 40, whiteSpace: 'pre-line' }}>
                {caption ? <span><b>maisonlou</b> {caption}</span> : <span style={{ color: '#8E9183' }}>La légende s&apos;ajoutera ici.</span>}
              </div>
            </div>
          </div>
        )}

        {/* step 1 — generate */}
        {step === 1 && (
          <div>
            <p style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 14, marginBottom: 12, color: '#565A4E' }}>Voix de la marque</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {Object.keys(DEMO_VOICES).map(v => (
                <button key={v} onClick={() => { setVoice(v); if (caption) generate(v); }} style={{ flex: 1, padding: 10, borderRadius: 10, fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 13.5, background: voice === v ? '#0D0F0A' : 'transparent', color: voice === v ? '#F1F0E8' : '#0D0F0A', boxShadow: voice === v ? 'none' : 'inset 0 0 0 1px rgba(13,15,10,.12)', transition: 'all .15s' }}>{v}</button>
              ))}
            </div>
            <button onClick={() => generate(voice)} className="lp-btn lp-btn-mint" style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}>
              <Icon name="spark" size={18} /> {caption ? 'Régénérer' : 'Générer la description'}
            </button>
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, minHeight: 140, boxShadow: 'inset 0 0 0 1px rgba(13,15,10,.1)' }}>
              {caption
                ? <p style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{caption}<span style={{ opacity: typing ? 1 : 0, color: '#2FD79B' }}>▍</span></p>
                : <p style={{ fontSize: 14, color: '#8E9183', fontFamily: "'early-sans-variable', sans-serif", fontWeight: 600 }}>La description générée apparaîtra ici.</p>}
            </div>
          </div>
        )}

        {/* step 2 — schedule */}
        {step === 2 && (
          <div>
            <p style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 14, marginBottom: 12, color: '#565A4E' }}>Choisissez un créneau</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 16 }}>
              {DEMO_DAYS.map((d, i) => {
                const sel = day === i, best = i === 2 || i === 4;
                return (
                  <button key={d} onClick={() => { setDay(i); setPublished(false); }} style={{ padding: '12px 4px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: sel ? '#2FD79B' : '#fff', color: sel ? '#06281C' : '#0D0F0A', boxShadow: sel ? 'none' : 'inset 0 0 0 1px rgba(13,15,10,.12)', transition: 'all .15s', position: 'relative' }}>
                    <span style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 12 }}>{d}</span>
                    <span className="lp-display" style={{ fontWeight: 700, fontSize: 18 }}>{8 + i}</span>
                    {best && !sel && <span style={{ position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: '50%', background: '#2FD79B' }} />}
                  </button>
                );
              })}
            </div>
            {day !== null && (
              <div style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 700, fontSize: 13, color: '#565A4E', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="clock" size={15} style={{ color: '#2FD79B' }} /> Suggéré : {DEMO_DAYS[day]} {8 + day} sept · 18 h 30
              </div>
            )}
            {published
              ? <div style={{ background: '#0C2A1D', color: '#EFEEE4', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#2FD79B', color: '#06281C', display: 'grid', placeItems: 'center' }}><Icon name="check" size={20} /></span>
                  <div><div style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 15 }}>Programmé sur Instagram</div><div style={{ fontSize: 13, color: 'rgba(239,238,228,.6)' }}>Vous pouvez passer au client suivant.</div></div>
                </div>
              : <button onClick={() => day !== null && setPublished(true)} className="lp-btn lp-btn-mint" style={{ width: '100%', justifyContent: 'center', opacity: day === null ? .5 : 1 }}>
                  <Icon name="instagram" size={18} /> Programmer la publication
                </button>}
          </div>
        )}
      </div>

      {/* footer nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderTop: '1px solid rgba(13,15,10,.1)', background: '#fff' }}>
        <button onClick={reset} style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 700, fontSize: 13.5, color: '#8E9183', display: 'inline-flex', alignItems: 'center', gap: 7 }}>↺ Recommencer</button>
        {step < 2
          ? <button onClick={() => canNext && setStep(step + 1)} className="lp-btn lp-btn-ink lp-btn-sm" style={{ opacity: canNext ? 1 : .4, pointerEvents: canNext ? 'auto' : 'none' }}>Suivant <Icon name="arrow" size={16} /></button>
          : <span style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 13, color: '#8E9183' }}>{published ? 'Et voilà.' : 'Dernière étape'}</span>}
      </div>
    </div>
  );
}

function DemoSection() {
  return (
    <section id="demo" className="lp-section lp-forest">
      <div className="lp-wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 48px' }}>
          <span className="lp-eyebrow plain lp-reveal" style={{ color: '#2FD79B', justifyContent: 'center' }}>Démo interactive</span>
          <h2 className="lp-display lp-reveal d1" style={{ fontSize: 'clamp(36px, 4.4vw, 60px)', lineHeight: 1.05, marginTop: 18, color: '#EFEEE4' }}>
            Essayez. <span className="lp-it lp-mint">Cliquez partout.</span>
          </h2>
          <p className="lp-lead lp-reveal d2" style={{ margin: '24px auto 0', color: 'rgba(239,238,228,.62)' }}>
            Un vrai aperçu du flow Klip — importez une photo, générez la description, planifiez. Sans inscription.
          </p>
        </div>
        <div className="lp-reveal d2"><ProductDemo /></div>
      </div>
    </section>
  );
}

/* ─── Features bento ─────────────────────────────────────────────────────── */
function MiniEditor() {
  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', aspectRatio: '16/9', background: 'linear-gradient(150deg,#1f7a4d,#0c2a1d)' }}>
      <div className="lp-display lp-it" style={{ position: 'absolute', left: 16, bottom: 22, fontWeight: 700, fontSize: 26, color: '#fff', textShadow: '0 2px 14px rgba(0,0,0,.4)' }}>Nouvelle carte ↗</div>
      <div style={{ position: 'absolute', left: 16, bottom: 22, width: 152, height: 36, border: '1.5px dashed #2FD79B', borderRadius: 6 }} />
      <div style={{ position: 'absolute', right: 14, top: 14, display: 'flex', gap: 6 }}>
        {['#2FD79B', '#0c2a1d', '#EFEEE4'].map(c => <span key={c} style={{ width: 18, height: 18, borderRadius: '50%', background: c, boxShadow: '0 0 0 1.5px rgba(255,255,255,.5)' }} />)}
      </div>
      <span style={{ position: 'absolute', right: 14, bottom: 14, fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 10, letterSpacing: '.1em', color: 'rgba(255,255,255,.6)' }}>ÉDITEUR · GLISSER-DÉPOSER</span>
    </div>
  );
}
function MiniCalendar() {
  const dots: [number, string][] = [[1, '#2FD79B'], [2, '#0C2A1D'], [4, '#2FD79B'], [4, '#0C2A1D'], [6, '#0C2A1D']];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginTop: 4 }}>
      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
        <div key={i} style={{ aspectRatio: '1', borderRadius: 8, background: '#fff', boxShadow: 'inset 0 0 0 1px rgba(13,15,10,.1)', position: 'relative', display: 'grid', placeItems: 'start', padding: 6 }}>
          <span style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 10, color: '#8E9183' }}>{d}</span>
          <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 3 }}>
            {dots.filter(x => x[0] === i).map((x, j) => <span key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: x[1] }} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

type FeatTone = 'acid' | 'forest' | undefined;
function FeatCard({ ic, t, d, cols = 1, tone, children }: { ic: string; t: string; d: string; cols?: 1 | 2 | 3; tone?: FeatTone; children?: React.ReactNode }) {
  return (
    <div className={`lp-reveal${cols > 1 ? ' lp-feat-wide' : ''}`} style={{ gridColumn: `span ${cols}`, padding: 28, borderRadius: 18, display: 'flex', flexDirection: 'column', gap: 14, background: tone === 'acid' ? '#2FD79B' : tone === 'forest' ? '#0C2A1D' : '#FBFAF4', color: tone === 'forest' ? '#EFEEE4' : '#0D0F0A', boxShadow: tone ? 'none' : 'inset 0 0 0 1px rgba(13,15,10,.07), 0 1px 2px rgba(13,15,10,.03)' }}>
      <span style={{ width: 46, height: 46, borderRadius: 12, display: 'grid', placeItems: 'center', background: tone === 'acid' ? '#06281C' : tone === 'forest' ? '#2FD79B' : '#0D0F0A', color: tone === 'acid' ? '#2FD79B' : tone === 'forest' ? '#06281C' : '#F1F0E8' }}>
        <Icon name={ic} size={22} />
      </span>
      <h3 className="lp-display" style={{ fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em' }}>{t}</h3>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: tone === 'acid' ? 'rgba(6,40,28,.82)' : tone === 'forest' ? 'rgba(239,238,228,.62)' : '#565A4E' }}>{d}</p>
      {children}
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="lp-section">
      <div className="lp-wrap">
        <div style={{ maxWidth: 720 }}>
          <span className="lp-eyebrow lp-reveal">Pourquoi Klip</span>
          <h2 className="lp-display lp-upper lp-reveal d1" style={{ fontSize: 'clamp(38px, 4.8vw, 66px)', marginTop: 20 }}>
            Tout ce qu&apos;il faut.<br /><span className="lp-it lp-mint">Rien de superflu.</span>
          </h2>
        </div>
        <div className="lp-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 52 }}>
          <FeatCard ic="image" t="Éditeur visuel intégré" d="Créez vos visuels directement dans Klip. Charte du client sauvegardée, templates prêts à l'emploi, formats Story, Reel et Post en un clic. C'est la fin des exports et des mauvais fichiers." cols={2}>
            <div style={{ marginTop: 'auto' }}><MiniEditor /></div>
          </FeatCard>
          <FeatCard ic="wand" t="Légendes générées par IA" d="Décrivez le post, l'IA rédige dans le ton exact du client. Vous relisez, vous publiez. 10 secondes au lieu de 20 minutes." tone="acid" />
          <FeatCard ic="calendar" t="Calendrier global multi-clients" d="Tous vos clients, tous vos posts, une seule vue. Glissez, déposez, reprogrammez. Rien ne passe entre les mailles." cols={2}>
            <div style={{ marginTop: 'auto' }}><MiniCalendar /></div>
          </FeatCard>
          <FeatCard ic="instagram" t="Publication automatique" d="Instagram, Facebook, Story, Reel, Post — Klip publie à l'heure exacte que vous avez choisie. Vous dormez, vos clients restent actifs." />
          <FeatCard ic="layers" t="Workflow de validation — Agence" d="Votre équipe prépare, vous validez, le client reçoit. Sans un seul mail. Sans fil de messagerie. Sans le mauvais fichier." tone="forest" cols={3} />
        </div>
      </div>
    </section>
  );
}

/* ─── Logos ──────────────────────────────────────────────────────────────── */
function Logos() {
  const names = ['Atelier Nord', 'STUDIO VÉL', 'Maison Pixel', 'Brut & Co', 'La Fabrique', 'Onde·', 'Calibre', 'Studio Aria'];
  return (
    <section className="lp-section-sm" style={{ borderTop: '1px solid rgba(13,15,10,.1)', borderBottom: '1px solid rgba(13,15,10,.1)' }}>
      <div className="lp-wrap">
        <p className="lp-reveal" style={{ textAlign: 'center', fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8E9183', marginBottom: 32 }}>
          Pensé pour des studios comme le vôtre
        </p>
        <div className="lp-reveal d1" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '22px 48px' }}>
          {names.map((n, i) => (
            <span key={i} className="lp-display" style={{ fontWeight: 700, fontSize: 23, letterSpacing: '-0.02em', color: '#0D0F0A', opacity: .38, fontStyle: i % 3 === 0 ? 'italic' : 'normal' }}>{n}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Témoignages ────────────────────────────────────────────────────────── */
function Testimonials() {
  const quotes = [
    { q: "On est passé de quatre outils à un seul. Le lundi matin n\u2019a plus rien à voir.", a: 'Camille R.', r: 'Directrice de création · studio indépendant' },
    { q: "La voix de marque par client, c\u2019est ce qui change tout. L\u2019IA ne déborde jamais du cadre.", a: 'Yanis B.', r: 'Social media manager' },
    { q: "Je gère six comptes sans jongler entre dix onglets. Mes clients valident plus vite.", a: 'Léa M.', r: 'Freelance · contenu de marque' },
  ];
  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <div style={{ maxWidth: 680 }}>
          <span className="lp-eyebrow lp-reveal">Sur le terrain</span>
          <h2 className="lp-display lp-reveal d1" style={{ fontSize: 'clamp(36px, 4.4vw, 58px)', marginTop: 20 }}>
            Le calme, <span className="lp-it lp-mint">retrouvé.</span>
          </h2>
        </div>
        <div className="lp-2col" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, marginTop: 48 }}>
          <div className="lp-reveal lp-testi-main" style={{ background: '#0C2A1D', color: '#EFEEE4', borderRadius: 20, padding: '40px 38px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gridRow: 'span 2' }}>
            <Icon name="spark" size={28} style={{ color: '#2FD79B' }} />
            <p className="lp-display" style={{ fontWeight: 700, fontSize: 'clamp(26px,2.6vw,38px)', lineHeight: 1.12, letterSpacing: '-0.02em', margin: '24px 0' }}>&ldquo;{quotes[0].q}&rdquo;</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#2FD79B', flexShrink: 0 }} />
              <div><div style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 15 }}>{quotes[0].a}</div><div style={{ fontSize: 13, color: 'rgba(239,238,228,.6)' }}>{quotes[0].r}</div></div>
            </div>
          </div>
          {quotes.slice(1).map((x, i) => (
            <div key={i} className={`lp-card lp-reveal d${i + 1}`} style={{ padding: 30, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 18.5, lineHeight: 1.5, fontWeight: 500 }}>&ldquo;{x.q}&rdquo;</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
                <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(140deg,#2FD79B,#1f7a4d)', flexShrink: 0 }} />
                <div><div style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 14.5 }}>{x.a}</div><div style={{ fontSize: 12.5, color: '#8E9183' }}>{x.r}</div></div>
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
  const [annual, setAnnual] = useState(true);
  const plans = [
    {
      name: 'Studio', m: 29, y: 25, tag: '7 jours gratuits', accent: false,
      sub: 'Freelances & community managers',
      feats: ['3 comptes clients', '1 profil utilisateur', 'Posts illimités', 'Éditeur visuel intégré', 'Génération IA illimitée', 'Publication automatique Instagram & Facebook'],
    },
    {
      name: 'Agence', m: 96, y: 89, tag: 'Le plus populaire', accent: true,
      sub: 'Agences & studios de communication',
      feats: ['10 comptes clients inclus', '+15€ / client supplémentaire / mois', '5 profils membres inclus', '+10€ / membre supplémentaire / mois', 'Posts illimités', 'Éditeur visuel intégré', 'Génération IA illimitée', 'Publication automatique Instagram & Facebook', 'Workflow de validation intégré', 'Rôles Manager & Créa'],
    },
  ];
  return (
    <section id="tarifs" className="lp-section">
      <div className="lp-wrap">
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
          <span className="lp-eyebrow lp-reveal" style={{ justifyContent: 'center' }}>Tarifs</span>
          <h2 className="lp-display lp-upper lp-reveal d1" style={{ fontSize: 'clamp(38px, 4.8vw, 64px)', marginTop: 18 }}>
            Simple. <span className="lp-it lp-mint">Prévisible.</span>
          </h2>
          <p className="lp-lead lp-reveal d2" style={{ margin: '16px auto 0' }}>7 jours gratuits sur tous les plans. Sans carte bancaire.</p>
          {/* toggle */}
          <div className="lp-reveal d2" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 28, padding: 5, borderRadius: 999, background: '#FBFAF4', boxShadow: 'inset 0 0 0 1px rgba(13,15,10,.1)' }}>
            {([['Mensuel', false], ['Annuel', true]] as [string, boolean][]).map(([l, v]) => (
              <button key={l} onClick={() => setAnnual(v)} style={{ padding: '9px 18px', borderRadius: 999, fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 14, background: annual === v ? '#0D0F0A' : 'transparent', color: annual === v ? '#F1F0E8' : '#565A4E', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all .2s' }}>
                {l}{v && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, background: '#2FD79B', color: '#06281C' }}>économisez jusqu&apos;à 15%</span>}
              </button>
            ))}
          </div>
        </div>
        {/* cards */}
        <div className="lp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 760, margin: '46px auto 0' }}>
          {plans.map((p, i) => (
            <div key={p.name} className={`lp-reveal d${i + 1}`} style={{ borderRadius: 22, padding: 34, position: 'relative', overflow: 'hidden', background: p.accent ? '#0C2A1D' : '#FBFAF4', color: p.accent ? '#EFEEE4' : '#0D0F0A', boxShadow: p.accent ? '0 30px 60px -40px rgba(12,42,29,.9)' : 'inset 0 0 0 1px rgba(13,15,10,.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 900, fontSize: 16 }}>{p.name}</span>
                <span style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', padding: '5px 11px', borderRadius: 999, background: p.accent ? '#2FD79B' : '#0D0F0A', color: p.accent ? '#06281C' : '#F1F0E8' }}>{p.tag}</span>
              </div>
              <p style={{ marginTop: 10, fontSize: 12.5, color: p.accent ? 'rgba(239,238,228,.5)' : '#8E9183', fontFamily: "'early-sans-variable', sans-serif", fontWeight: 600 }}>{p.sub}</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, margin: '18px 0 6px' }}>
                <span className="lp-display" style={{ fontWeight: 700, fontSize: 64, lineHeight: .9, letterSpacing: '-0.03em' }}>{annual ? p.y : p.m}€</span>
                <span style={{ fontSize: 15, color: p.accent ? 'rgba(239,238,228,.6)' : '#8E9183', marginBottom: 10, fontFamily: "'early-sans-variable', sans-serif", fontWeight: 700, whiteSpace: 'nowrap' }}>/ mois</span>
              </div>
              <p style={{ fontSize: 13, color: p.accent ? 'rgba(239,238,228,.6)' : '#8E9183', fontFamily: "'early-sans-variable', sans-serif", fontWeight: 600, minHeight: 18 }}>
                {annual ? `Facturé ${p.y * 12}\u20ac par an` : 'Facturé chaque mois'}
              </p>
              <div style={{ height: 1, background: p.accent ? 'rgba(239,238,228,.22)' : 'rgba(13,15,10,.1)', margin: '22px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {p.feats.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 11, fontSize: 14.5 }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: '#2FD79B', color: '#06281C' }}><Icon name="check" size={13} /></span>
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/register" className={`lp-btn ${p.accent ? 'lp-btn-acid' : 'lp-btn-mint'}`} style={{ width: '100%', justifyContent: 'center' }}>
                Commencer l&apos;essai gratuit <Icon name="arrowUR" size={17} />
              </Link>
            </div>
          ))}
        </div>
        <p className="lp-reveal" style={{ textAlign: 'center', marginTop: 24, color: '#8E9183', fontFamily: "'early-sans-variable', sans-serif", fontWeight: 700, fontSize: 13.5 }}>
          7 jours gratuits · sans carte bancaire · résiliable en un clic
        </p>
        <p className="lp-reveal" style={{ textAlign: 'center', marginTop: 10, color: '#8E9183', fontFamily: "'early-sans-variable', sans-serif", fontWeight: 700, fontSize: 13.5 }}>
          Vous avez plus de 20 clients ou une grande équipe ? Parlons-en. →{' '}
          <a href="mailto:contact@klip.fr" style={{ color: '#2FD79B', textDecoration: 'underline', textUnderlineOffset: 2 }}>contact@klip.fr</a>
        </p>
      </div>
    </section>
  );
}

/* ─── FAQ ────────────────────────────────────────────────────────────────── */
function FAQ() {
  const [open, setOpen] = useState<number>(0);
  const items = [
    { q: 'Klip publie-t-il vraiment tout seul sur Instagram ?',  a: "Oui. Une fois votre compte Instagram professionnel connecté, Klip programme et publie au créneau choisi, sans intervention de votre part." },
    { q: "Faut-il un compte Instagram professionnel ?",           a: "Pour la publication automatique, oui — c\u2019est une exigence de Meta. La connexion se fait en quelques clics, on vous guide." },
    { q: 'Combien de clients puis-je gérer ?',                    a: "Jusqu\u2019à 3 avec Solo, et autant que vous voulez avec Agence. Chaque client a son espace : charte, voix de marque, historique et comptes séparés." },
    { q: "L\u2019IA respecte-t-elle la charte de chaque marque ?", a: "Vous définissez le ton, le style et les mots à éviter par client. Chaque génération reste dans ce cadre — vous gardez la main sur le résultat final." },
    { q: "Les données de mes clients sont-elles cloisonnées ?",   a: "Chaque espace est isolé. Aucune donnée ne fuit d\u2019un client à l\u2019autre, et vous contrôlez qui accède à quoi." },
    { q: "Puis-je annuler à tout moment ?",                       a: "Oui, en un clic depuis vos paramètres. Aucun engagement, aucune justification à fournir." },
  ];
  return (
    <section className="lp-section" style={{ background: '#FBFAF4', borderTop: '1px solid rgba(13,15,10,.1)' }}>
      <div className="lp-wrap">
        <div className="lp-2col" style={{ display: 'grid', gridTemplateColumns: '.8fr 1.2fr', gap: 56 }}>
          <div>
            <span className="lp-eyebrow lp-reveal">Questions</span>
            <h2 className="lp-display lp-reveal d1" style={{ fontSize: 'clamp(34px, 4vw, 54px)', marginTop: 18 }}>
              Tout ce que vous vous <span className="lp-it lp-mint">demandez.</span>
            </h2>
            <p className="lp-lead lp-reveal d2" style={{ marginTop: 18 }}>Une autre question ? <a href="mailto:hello@klip.app" style={{ color: '#0D0F0A', textDecoration: 'underline', textUnderlineOffset: 3 }}>Écrivez-nous.</a></p>
          </div>
          <div className="lp-reveal d1">
            {items.map((it, i) => {
              const o = open === i;
              return (
                <div key={i} style={{ borderTop: '1px solid rgba(13,15,10,.1)', borderBottom: i === items.length - 1 ? '1px solid rgba(13,15,10,.1)' : 'none' }}>
                  <button onClick={() => setOpen(o ? -1 : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '22px 0', textAlign: 'left' }}>
                    <span className="lp-display" style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0D0F0A' }}>{it.q}</span>
                    <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: o ? '#2FD79B' : 'transparent', color: o ? '#06281C' : '#0D0F0A', boxShadow: o ? 'none' : 'inset 0 0 0 1.5px rgba(13,15,10,.14)', transition: 'all .2s', transform: o ? 'rotate(45deg)' : 'none' }}><Icon name="plus" size={16} /></span>
                  </button>
                  <div style={{ maxHeight: o ? 200 : 0, overflow: 'hidden', transition: 'max-height .35s cubic-bezier(.16,1,.3,1)' }}>
                    <p style={{ paddingBottom: 24, color: '#565A4E', fontSize: 16, lineHeight: 1.62, maxWidth: 560 }}>{it.a}</p>
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

/* ─── FinalCTA — fond acid #2FD79B ──────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <div className="lp-reveal" style={{ position: 'relative', overflow: 'hidden', background: '#2FD79B', borderRadius: 28, padding: 'clamp(48px,7vw,96px) 40px', textAlign: 'center' }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <span className="lp-eyebrow plain" style={{ color: '#06281C', opacity: .65, justifyContent: 'center' }}>C&apos;est le moment.</span>
            <h2 className="lp-display lp-upper" style={{ fontSize: 'clamp(40px, 6.4vw, 96px)', color: '#06281C', marginTop: 16 }}>
              Arrêtez de gérer des logiciels.<br /><span className="lp-it">Commencez à créer.</span>
            </h2>
            <p style={{ marginTop: 20, fontFamily: "'early-sans-variable', sans-serif", fontWeight: 700, fontSize: 16, color: '#06281C', opacity: .75 }}>
              Rejoignez les premières agences qui ont repris le contrôle de leur temps.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 36 }}>
              <Link href="/register" className="lp-btn lp-btn-ink" style={{ fontSize: 17, padding: '17px 32px' }}>
                Démarrer gratuitement — accès immédiat <Icon name="arrowUR" size={18} className="arr" />
              </Link>
              <a href="#demo" className="lp-btn" style={{ fontSize: 17, padding: '17px 32px', background: 'transparent', color: '#06281C', boxShadow: 'inset 0 0 0 1.5px rgba(6,40,28,.3)' }}>Revoir la démo</a>
            </div>
            <p style={{ marginTop: 22, fontFamily: "'early-sans-variable', sans-serif", fontWeight: 700, fontSize: 14, color: '#06281C', opacity: .65 }}>7 jours gratuits · sans carte bancaire</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer — fond forêt ────────────────────────────────────────────────── */
function Footer() {
  const cols: [string, string[]][] = [
    ['Produit',    ['Fonctionnalités', 'Démo', 'Tarifs', 'Nouveautés']],
    ['Ressources', ["Centre d\u2019aide", 'Guide agences', 'Statut', 'Contact']],
    ['Légal',      ['Confidentialité', 'Conditions', 'Cookies']],
  ];
  return (
    <footer style={{ background: '#0C2A1D', color: '#EFEEE4', padding: '72px 0 40px' }}>
      <div className="lp-wrap">
        <div className="lp-foot-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 40 }}>
          <div>
            <KlipLogo size={30} light />
            <p style={{ marginTop: 18, color: 'rgba(239,238,228,.6)', fontSize: 15.5, lineHeight: 1.6, maxWidth: 320 }}>
              Le studio social qui pense comme votre agence. Créez, planifiez et publiez le contenu de tous vos clients au même endroit.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              {(['instagram', 'send', 'chat'] as const).map(ic => (
                <span key={ic} style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px rgba(239,238,228,.22)', color: '#EFEEE4' }}>
                  <Icon name={ic} size={18} />
                </span>
              ))}
            </div>
          </div>
          {cols.map(([h, links]) => (
            <div key={h}>
              <div style={{ fontFamily: "'early-sans-variable', sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(239,238,228,.5)', marginBottom: 18 }}>{h}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {links.map(l => <a key={l} href="#" className="lp-foot-link" style={{ color: '#EFEEE4', fontSize: 15 }}>{l}</a>)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginTop: 56, paddingTop: 26, borderTop: '1px solid rgba(239,238,228,.22)', color: 'rgba(239,238,228,.5)', fontSize: 13.5, fontFamily: "'early-sans-variable', sans-serif", fontWeight: 600 }}>
          <span>© 2026 Klip — Fait avec soin pour les agences créatives.</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2FD79B' }} /> Tous les systèmes opérationnels
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const supabase = createClientComponentClient();
  const router   = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // scroll reveal via IntersectionObserver
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.lp-reveal:not(.in)'));
    if (!('IntersectionObserver' in window) || els.length === 0) {
      els.forEach(e => e.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  });

  const scrollToDemo = () => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="lp">
      <style dangerouslySetInnerHTML={{ __html: LP_CSS }} />
      <Nav onDemo={scrollToDemo} />
      <Hero onDemo={scrollToDemo} />
      <Marquee />
      <Probleme />
      <Process />
      <DemoSection />
      <Features />
      <Logos />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
