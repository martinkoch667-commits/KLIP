'use client';
import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { ConnectClaudePill } from '@/components/ConnectClaudeModal';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { SplitText } from 'gsap/SplitText';

/* ════════════════════════════════════════════════════════════════════════════
   KLIP — Landing v3.1 « atelier de création »
   L'UI d'un logiciel de création (Canva / Figma) comme langage visuel :
   sélection violette, poignées, calques, stickers die-cut draggables.
   Fond BLANC pur (pas de grille). Un seul vert accent : le pastel --leaf.
   Titres = Archivo brut + accent surligné pastel en Oaks (règle globale).
   Creative coding : GSAP (ScrollTrigger, Draggable+Inertia, curseur suiveur,
   boutons magnétiques, marquee sensible à la vélocité, deck empilé au scroll).
   ════════════════════════════════════════════════════════════════════════════ */

const V3_CSS = `
.v3 {
  /* surfaces */
  --paper:#FFFFFF; --paper-2:#FAF9F4; --paper-3:#F1F0E9; --card:#FFFFFF;
  --forest:#072117; --forest-2:#0C3123; --forest-3:#124732;
  /* ink */
  --ink:#10130B; --ink-2:#50544A; --ink-3:#8A8D7D;
  --line:rgba(16,19,11,.14); --line-2:rgba(16,19,11,.08);
  /* on forest */
  --cream:#F1F0E5; --cream-2:rgba(241,240,229,.66); --cream-3:rgba(241,240,229,.36); --line-f:rgba(241,240,229,.16);
  /* accents — UN vert : le pastel */
  --leaf:#BDF2A0; --leaf-soft:#D9F8C7; --leaf-ink:#1E3317;
  --mint:#2FD79B; --mint-2:#1FA878;
  --vio:#6656D9; --vio-soft:#EFEBFF;
  /* type */
  --oaks:'oaks', Georgia, serif;
  --oaks-c:'oaks-condensed', Georgia, serif;
  --oaks-x:'oaks-expanded', Georgia, serif;
  --heavy:'Archivo', system-ui, sans-serif;
  --sans:'early-sans-variable','Hanken Grotesk', system-ui, sans-serif;
  --maxw:1240px;
  --r-s:12px; --r:18px; --r-l:26px;

  background:var(--paper); color:var(--ink); font-family:var(--sans);
  font-size:17px; line-height:1.6; -webkit-font-smoothing:antialiased; overflow-x:clip;
}
.v3 *, .v3 *::before, .v3 *::after { box-sizing:border-box; }
.v3 a { color:inherit; text-decoration:none; }
.v3 button { font-family:inherit; cursor:pointer; border:none; background:none; }
.v3 img { display:block; max-width:100%; }
.v3 ::selection { background:var(--vio); color:#fff; }

/* ── typographie ─────────────────────────────────────────────── */
.v3 .t-arch  { font-family:var(--heavy); font-weight:800; text-transform:uppercase; letter-spacing:-.03em; line-height:.98; text-wrap:balance; }
.v3 .t-oaks  { font-family:var(--oaks); font-weight:700; letter-spacing:-.012em; line-height:1.04; text-wrap:balance; }
.v3 .t-oaksc { font-family:var(--oaks-c); font-weight:700; text-transform:uppercase; line-height:.92; letter-spacing:.005em; }
.v3 .t-oaksx { font-family:var(--oaks-x); font-weight:700; text-transform:uppercase; letter-spacing:.015em; line-height:.95; }
.v3 .lead { color:var(--ink-2); font-size:19px; line-height:1.62; text-wrap:pretty; }
.v3 .on-forest .lead { color:var(--cream-2); }
.v3 .eyebrow { font-family:var(--sans); font-weight:800; font-size:12.5px; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-3); }
.v3 .on-forest .eyebrow { color:var(--cream-3); }

/* lignes de paragraphe révélées au scroll (SplitText + ScrollTrigger, voir GSAP §7) */
.v3 .split-lines, .v3 .split-lines * { will-change:transform; }

/* règle typo globale : accent surligné pastel en Oaks dans un titre Archivo */
.v3 .acc-hl { font-family:var(--oaks); font-weight:700; text-transform:none; letter-spacing:-.01em; background:var(--leaf); color:var(--leaf-ink); border-radius:14px; padding:.02em .18em .09em; box-decoration-break:clone; -webkit-box-decoration-break:clone; }

/* ── layout ──────────────────────────────────────────────────── */
.v3 .wrap { max-width:var(--maxw); margin:0 auto; padding:0 34px; }
.v3 .section { padding:clamp(76px,10vw,140px) 0; position:relative; }
.v3 .on-forest {
  background:
    radial-gradient(100% 70% at 50% -12%, rgba(189,242,160,.08), transparent 55%),
    radial-gradient(90% 80% at 4% 100%, rgba(31,168,120,.10), transparent 60%),
    var(--forest);
  color:var(--cream);
}

/* ── boutons ─────────────────────────────────────────────────── */
.v3 .btn { position:relative; font-family:var(--sans); font-weight:800; font-size:16px; letter-spacing:-.01em; display:inline-flex; align-items:center; gap:10px; padding:16px 27px; border-radius:999px; transition:box-shadow .2s, background .2s, color .2s; white-space:nowrap; will-change:transform; }
.v3 .btn .arr { display:inline-flex; transition:transform .22s; }
.v3 .btn:hover .arr { transform:translate(3px,-3px); }
.v3 .btn-ink { background:var(--ink); color:var(--paper); box-shadow:0 18px 34px -18px rgba(16,19,11,.6); }
.v3 .btn-ink .arr { color:var(--leaf); }
.v3 .btn-leaf { background:var(--leaf); color:var(--leaf-ink); box-shadow:0 16px 32px -16px rgba(120,190,90,.55); }
.v3 .btn-leaf:hover { background:#C9F5B2; }
.v3 .btn-ghost { background:transparent; color:var(--ink); box-shadow:inset 0 0 0 1.6px var(--line); }
.v3 .btn-ghost:hover { box-shadow:inset 0 0 0 2px var(--ink); }
.v3 .on-forest .btn-ghost { color:var(--cream); box-shadow:inset 0 0 0 1.6px var(--line-f); }
.v3 .on-forest .btn-ghost:hover { box-shadow:inset 0 0 0 2px var(--cream); }
.v3 .btn-sm { padding:11px 18px; font-size:14px; }

/* ── chips / cartes ──────────────────────────────────────────── */
.v3 .chip { font-family:var(--sans); font-weight:700; font-size:12.5px; letter-spacing:.02em; display:inline-flex; align-items:center; gap:8px; padding:8px 14px; border-radius:999px; background:var(--card); box-shadow:inset 0 0 0 1px var(--line); color:var(--ink-2); white-space:nowrap; }
.v3 .on-forest .chip { background:var(--forest-2); color:var(--cream-2); box-shadow:inset 0 0 0 1px var(--line-f); }
.v3 .card { background:var(--card); border-radius:var(--r); box-shadow:inset 0 0 0 1px var(--line-2), 0 2px 6px rgba(16,19,11,.04); }

/* fenêtre d'app */
.v3 .win { border-radius:var(--r); overflow:hidden; background:var(--card); box-shadow:0 0 0 1px rgba(16,19,11,.09), 0 46px 90px -44px rgba(0,0,0,.45); }
.v3 .win-bar { height:40px; display:flex; align-items:center; gap:7px; padding:0 14px; background:var(--paper-3); border-bottom:1px solid var(--line); }
.v3 .win-dot { width:11px; height:11px; border-radius:50%; background:var(--ink-3); opacity:.45; }
.v3 .win-tab { margin-left:10px; display:inline-flex; align-items:center; gap:7px; font-family:var(--sans); font-weight:700; font-size:11.5px; color:var(--ink-2); letter-spacing:.02em; background:var(--card); border-radius:8px 8px 0 0; padding:6px 12px 7px; margin-bottom:-1px; border:1px solid var(--line); border-bottom-color:var(--card); }
.v3 .win-zoom { margin-left:auto; font-family:var(--sans); font-weight:700; font-size:11px; color:var(--ink-3); }

/* ── sélection façon logiciel ────────────────────────────────── */
.v3 .sel { position:relative; display:inline-block; }
.v3 .sel-frame { position:absolute; inset:-10px; border:2px solid var(--vio); border-radius:4px; pointer-events:none; }
.v3 .sel-h { position:absolute; width:13px; height:13px; background:#fff; border:2px solid var(--vio); border-radius:50%; box-shadow:0 2px 6px rgba(16,19,11,.18); }
.v3 .sel-p { position:absolute; background:#fff; border:2px solid var(--vio); border-radius:999px; box-shadow:0 2px 6px rgba(16,19,11,.18); }
.v3 .sel-rot { position:absolute; left:50%; bottom:-46px; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; pointer-events:none; }
.v3 .sel-rot::before { content:""; width:2px; height:18px; background:var(--vio); }
.v3 .sel-rot span { width:26px; height:26px; border-radius:50%; background:#fff; border:2px solid var(--vio); display:grid; place-items:center; color:var(--ink); box-shadow:0 3px 8px rgba(16,19,11,.2); }
.v3 .sel .sel-frame, .v3 .sel .sel-rot { opacity:0; transition:opacity .3s .25s; }
.v3 .sel .sel-h, .v3 .sel .sel-p { opacity:0; transform:scale(0); transition:opacity .2s, transform .3s cubic-bezier(.2,1.8,.4,1); }
.v3 .in .sel .sel-frame, .v3 .in .sel .sel-rot, .v3 .sel.in .sel-frame, .v3 .sel.in .sel-rot { opacity:1; }
.v3 .in .sel .sel-h, .v3 .in .sel .sel-p, .v3 .sel.in .sel-h, .v3 .sel.in .sel-p { opacity:1; transform:scale(1); }

/* marching ants */
.v3 .ants { position:absolute; inset:0; pointer-events:none; width:100%; height:100%; overflow:visible; }
.v3 .ants rect { x:1px; y:1px; width:calc(100% - 2px); height:calc(100% - 2px); fill:none; stroke:var(--vio); stroke-width:2; stroke-dasharray:8 7; animation:v3-ants 1.2s linear infinite; }
@keyframes v3-ants { to { stroke-dashoffset:-15; } }

/* ── stickers ────────────────────────────────────────────────── */
.v3 .stk { filter:drop-shadow(0 10px 18px rgba(16,19,11,.2)); }
.v3 .stk-card { display:inline-flex; align-items:center; gap:9px; background:var(--card); border-radius:14px; padding:12px 16px; box-shadow:0 0 0 1px var(--line-2), 0 18px 36px -18px rgba(16,19,11,.35); font-family:var(--sans); font-weight:800; font-size:13.5px; }
.v3 .stk-leaf { background:var(--leaf); color:var(--leaf-ink); box-shadow:0 18px 36px -16px rgba(120,190,90,.5); }
.v3 .stk-forest { background:var(--forest); color:var(--cream); box-shadow:0 18px 36px -16px rgba(0,0,0,.5); }

/* éléments draggables (GSAP Draggable) */
.v3 .drag { cursor:grab; touch-action:none; display:inline-block; }
.v3 .drag:active { cursor:grabbing; }

.v3 .eyes-pupils { transform-origin:center; animation:v3-blink 4.6s ease-in-out infinite; }
@keyframes v3-blink { 0%,91%,100% { transform:scaleY(1); } 94.5%,96.5% { transform:scaleY(.08); } }

/* curseurs collaboratifs */
.v3 .cur { position:absolute; z-index:8; display:flex; flex-direction:column; align-items:flex-start; gap:2px; pointer-events:none; filter:drop-shadow(0 6px 14px rgba(16,19,11,.25)); }
.v3 .cur-tag { font-family:var(--sans); font-weight:800; font-size:11.5px; color:#fff; padding:4px 10px; border-radius:999px 999px 999px 4px; margin-left:14px; white-space:nowrap; }
.v3 .cur-drift2 { animation:v3-drift2 8.5s ease-in-out infinite; }
@keyframes v3-drift2 { 0%,100% { transform:translate(0,0); } 40% { transform:translate(14px,-8px); } 72% { transform:translate(-10px,12px); } }

@keyframes v3-floatA { 0%,100% { transform:translateY(0) rotate(var(--r,0deg)); } 50% { transform:translateY(-16px) rotate(calc(var(--r,0deg) + 3deg)); } }
@keyframes v3-floatB { 0%,100% { transform:translateY(0) rotate(var(--r,0deg)); } 50% { transform:translateY(-11px) rotate(calc(var(--r,0deg) - 3deg)); } }
.v3 .floatA { animation:v3-floatA 7s ease-in-out infinite; }
.v3 .floatB { animation:v3-floatB 6s ease-in-out infinite; }
@keyframes v3-spin { to { transform:rotate(360deg); } }
.v3 .spin { animation:v3-spin 14s linear infinite; transform-origin:center; }

@keyframes v3-wig { 0%,100% { rotate:-3deg; } 50% { rotate:-1deg; } }
.v3 .h-outil-rot.in { animation:v3-wig 5.5s ease-in-out 1.4s infinite; }

/* ── reveals (IntersectionObserver) ──────────────────────────── */
.v3 .rv { opacity:0; transform:translateY(30px); }
.v3 .rv.in { opacity:1; transform:none; transition:opacity .85s cubic-bezier(.16,1,.3,1), transform .85s cubic-bezier(.16,1,.3,1); }
.v3 .rv-slap { opacity:0; transform:scale(1.6) rotate(calc(var(--r,0deg) - 9deg)); }
.v3 .rv-slap.in { opacity:1; transform:scale(1) rotate(var(--r,0deg)); transition:transform .5s cubic-bezier(.2,1.4,.35,1), opacity .22s; }
.v3 .rv-pop { opacity:0; transform:scale(.5) rotate(calc(var(--r,0deg) + 6deg)); }
.v3 .rv-pop.in { opacity:1; transform:scale(1) rotate(var(--r,0deg)); transition:transform .55s cubic-bezier(.2,1.7,.4,1), opacity .3s; }
.v3 .d1.in { transition-delay:.08s; } .v3 .d2.in { transition-delay:.17s; }
.v3 .d3.in { transition-delay:.26s; } .v3 .d4.in { transition-delay:.35s; }

/* ── marquee ─────────────────────────────────────────────────── */
.v3 .mq { overflow:hidden; white-space:nowrap; display:flex; }
.v3 .mq-in { display:inline-flex; align-items:center; gap:26px; padding-right:26px; flex:none; }
.v3 .mqband { background:var(--leaf); color:var(--leaf-ink); transform:rotate(-1.4deg); margin:-22px -20px; box-shadow:0 24px 48px -30px rgba(120,190,90,.55); position:relative; z-index:5; }
.v3 .mqband .mq { padding:15px 0; }
.v3 .mqband span.w { font-family:var(--heavy); font-weight:800; font-size:20px; letter-spacing:.02em; text-transform:uppercase; }
.v3 .mqband span.w em { font-family:var(--oaks); font-style:normal; font-weight:700; text-transform:none; }

/* ── hero ────────────────────────────────────────────────────── */
.v3 .hero-h1 { font-size:clamp(46px, 7.6vw, 104px); color:var(--leaf-ink); font-family:var(--oaks); font-weight:700; letter-spacing:-.012em; line-height:1.06; }
.v3 .h-line { display:block; }
.v3 .hl { position:relative; z-index:1; background:var(--leaf); border-radius:.28em; padding:.03em .18em .1em; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
.v3 .h-outil { display:inline-flex; align-items:center; background:var(--card); border-radius:.18em; padding:.06em .22em .1em; box-shadow:0 24px 50px -22px rgba(16,19,11,.42); font-family:var(--oaks-c); font-weight:700; text-transform:uppercase; letter-spacing:.01em; line-height:1; color:var(--ink); }
.v3 .h-outil-rot { display:inline-block; rotate:-3deg; position:relative; z-index:6; }
.v3 .hero-flow { display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap; }
.v3 .hero-flow-item { display:inline-flex; align-items:center; gap:10px; justify-content:center; }
.v3 .hero-flow-chip { display:inline-flex; align-items:center; gap:9px; font-family:var(--sans); font-weight:700; font-size:13.5px; color:var(--cream-2); padding:10px 16px; border-radius:14px; background:transparent; box-shadow:inset 0 0 0 1.4px var(--line-f); }
.v3 .hero-flow-chip .ic { color:var(--cream-3); display:inline-flex; }
.v3 .claude-tie { display:inline-flex; align-items:center; gap:9px; padding:7px 8px 7px 7px; border:0; background:transparent; cursor:pointer; font-family:var(--sans); font-size:13.5px; font-weight:600; color:var(--cream-2); border-radius:999px; transition:color .16s; }
.v3 .claude-tie:hover { color:var(--cream); }
.v3 .claude-tie-glyph.lp-logo { width:26px; height:26px; border-radius:8px; box-shadow:0 4px 10px -5px rgba(16,19,11,.5); }
.v3 .claude-tie-txt strong { font-weight:800; color:var(--cream); text-decoration:underline; text-decoration-color:rgba(224,135,101,.6); text-underline-offset:3px; text-decoration-thickness:1.6px; }
.v3 .claude-tie-arr { font-size:12px; opacity:.55; transition:transform .16s, opacity .16s; }
.v3 .claude-tie:hover .claude-tie-arr { transform:translateX(3px); opacity:1; }

/* ── nav ─────────────────────────────────────────────────────── */
.v3 .nav-link { font-family:var(--sans); font-size:13.5px; font-weight:700; letter-spacing:.01em; color:var(--ink-2); transition:color .15s, background .15s; padding:8px 12px; border-radius:999px; }
.v3 .nav-link:hover { color:var(--ink); background:var(--paper-3); }
.v3 .v3-mob-btn { display:none; align-items:center; justify-content:center; width:42px; height:42px; border-radius:12px; background:rgba(16,19,11,.07); color:var(--ink); }
.v3 .v3-mob-menu { position:fixed; inset:0; background:var(--forest); z-index:1000; display:flex; flex-direction:column; padding:22px 26px 42px; transform:translateX(100%); transition:transform .3s cubic-bezier(.16,1,.3,1); }
.v3 .v3-mob-menu.open { transform:translateX(0); }
.v3 .v3-mob-link { display:block; font-family:'Archivo',sans-serif; font-weight:800; font-size:30px; text-transform:uppercase; letter-spacing:-.02em; color:#F1F0E5 !important; padding:13px 0; border-bottom:1px solid rgba(241,240,229,.16); }

/* ── panneau calques (comparatif) ────────────────────────────── */
.v3 .lp { background:var(--card); border-radius:16px; box-shadow:0 0 0 1px var(--line-2), 0 40px 80px -40px rgba(16,19,11,.3); overflow:hidden; }
.v3 .lp-head { display:flex; align-items:center; justify-content:space-between; padding:13px 18px; border-bottom:1px solid var(--line-2); font-family:var(--sans); font-weight:800; font-size:13px; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-2); }
.v3 .lp-row { display:flex; align-items:center; gap:14px; padding:13px 18px; border-bottom:1px solid var(--line-2); transition:opacity .5s, background .3s; }
.v3 .lp-row:last-child { border-bottom:none; }
.v3 .lp-eye { color:var(--ink-2); display:inline-flex; flex:none; }
.v3 .lp-row.off { opacity:.42; }
.v3 .lp-name { font-family:var(--sans); font-weight:800; font-size:15.5px; position:relative; display:inline-block; }
.v3 .lp-use { font-size:12.5px; color:var(--ink-3); }
.v3 .lp-cost { margin-left:auto; font-family:var(--sans); font-weight:800; font-size:14px; color:var(--ink-2); font-variant-numeric:tabular-nums; position:relative; }
.v3 .lp-strike::after { content:""; position:absolute; left:-3px; right:-3px; top:52%; height:2.5px; border-radius:2px; background:var(--vio); transform:rotate(-3deg) scaleX(0); transform-origin:left center; transition:transform .35s cubic-bezier(.3,1,.4,1) .1s; }
.v3 .off .lp-strike::after { transform:rotate(-3deg) scaleX(1); }
.v3 .lp-row.klip { background:linear-gradient(90deg, rgba(189,242,160,.5), rgba(189,242,160,.14)); }
/* icônes d'app façon "liquid glass" — logo pleine surface, sans bordure */
.v3 .lp-logo { position:relative; width:44px; height:44px; border-radius:13px; display:grid; place-items:center; flex:none; overflow:hidden; box-shadow:0 6px 14px -6px rgba(16,19,11,.35); }
.v3 .lp-logo::after { content:""; position:absolute; inset:0; border-radius:inherit; background:linear-gradient(155deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,.14) 40%, rgba(255,255,255,0) 58%, rgba(255,255,255,.14) 100%); pointer-events:none; }
.v3 .lp-logo > img { position:absolute; inset:0; width:100% !important; height:100% !important; object-fit:cover; }
.v3 .lp-logo > span { position:relative; z-index:1; }
/* logo KLIP = wordmark large, pas un favicon carré : on ne l'étire pas plein cadre */
.v3 .lp-logo-brand > img { position:static !important; width:auto !important; height:18px !important; object-fit:contain; }

/* ── deck produit (cartes empilées au scroll) ────────────────── */
/* chaque carte est dans son propre "slot" bloc (pas un enfant flex direct) : un enfant
   position:sticky d'un parent display:flex ne reste "collé" que très brièvement dans Chrome
   (bug de containing-block flex+sticky). Le slot lui donne la place de rester "collé" via
   min-height (PAS padding-bottom : le padding n'est pas pris en compte dans le calcul de la
   zone de collage sticky par Chrome, vérifié empiriquement — seule une vraie hauteur marche). */
.v3 .deck { position:relative; }
/* espace de fin en CONTENU (::after) — ni padding ni marge : le bloc conteneur du
   sticky est la content box du parent, donc seul du contenu réel l'étend. Sans lui,
   les 3 premières cartes se décollent avant que la dernière n'arrive sur la pile. */
.v3 .deck::after { content:""; display:block; height:110vh; }
/* empilement : toutes les cartes partagent .deck comme bloc conteneur → chacune reste
   "collée" à son top pendant que les suivantes montent par-dessus (vrai effet de pile).
   La marge basse crée la distance de scroll entre l'arrivée de deux cartes. */
.v3 .deck-card { position:sticky; margin-bottom:58vh; background:var(--card); color:var(--ink); border-radius:var(--r-l); box-shadow:0 -8px 28px rgba(0,0,0,.14), 0 0 0 1px var(--line-2); overflow:visible; will-change:transform; transform-origin:top center; }
.v3 .deck-card:last-child { margin-bottom:0; }
.v3 .deck-card .deck-grid { border-radius:inherit; overflow:hidden; }
.v3 .deck-grid { display:grid; grid-template-columns:0.82fr 1.3fr; align-items:stretch; min-height:56vh; }
.v3 .deck-copy { padding:clamp(26px,3vw,46px); display:flex; flex-direction:column; justify-content:center; gap:16px; }
.v3 .deck-visual { background:var(--paper-3); display:flex; align-items:center; justify-content:flex-start; overflow:hidden; padding:clamp(18px,2.2vw,34px) 0 0 clamp(18px,2.2vw,34px); }
.v3 .deck-visual > * { border-radius:14px 0 0 0; overflow:hidden; box-shadow:0 0 0 1px var(--line-2), 0 24px 48px -24px rgba(16,19,11,.35); width:100%; }
.v3 .deck-num { font-family:var(--oaks-x); font-weight:700; font-size:15px; color:var(--mint-2); letter-spacing:.04em; }

/* ── responsive ──────────────────────────────────────────────── */
@media (max-width:960px) {
  .v3 .nav-links, .v3 .nav-cta-ghost { display:none !important; }
  .v3 .v3-mob-btn { display:inline-flex; }
  /* pictos produit : conservés sur mobile — rangée statique de stickers sous le mockup */
  .v3 .hero-float { position:static !important; display:inline-block !important; transform:none !important; margin:14px 10px 0 0; }
  .v3 .hero-float .stk-card { font-size:12px; padding:9px 12px; gap:7px; }
  .v3 .hero-float .stk-card > span:first-child { font-size:16px !important; }
  .v3 #apercu-hero .wrap > div { text-align:center; }
  .v3 .grid-2, .v3 .grid-3, .v3 .bento, .v3 .testi-grid, .v3 .price-grid, .v3 .feat-hero, .v3 .cmp-grid { grid-template-columns:1fr !important; }
  /* en 1 colonne, aucun enfant ne doit imposer son min-content à la piste (sinon la
     carte déborde et le texte est rogné — vu sur feat-hero à 375px) */
  .v3 .feat-hero > div, .v3 .cmp-grid > div, .v3 .grid-2 > div, .v3 .deck-grid > div { min-width:0; }
  .v3 .span-2 { grid-column:auto !important; }
  .v3 .price-grid > div { transform:none !important; }
  .v3 .foot-grid { grid-template-columns:1fr 1fr !important; gap:34px !important; }
  .v3 .hero-curs { display:none !important; }
}
@media (max-width:860px) {
  /* la pile sticky est CONSERVÉE sur mobile (retour Martin) : cartes en 1 colonne,
     visuel en tête, marges de scroll réduites. Padding symétrique : l'image ne doit
     plus être collée au bord droit (retour Martin). */
  .v3 .deck-card { margin-bottom:42vh; }
  .v3 .deck-card:last-child { margin-bottom:0; }
  .v3 .deck::after { height:70vh; }
  .v3 .deck-grid { grid-template-columns:1fr; min-height:0; }
  .v3 .deck-visual { order:-1; padding:16px 16px 0; justify-content:center; }
  .v3 .deck-visual > * { border-radius:12px 12px 0 0; }
  .v3 .deck-copy { padding:20px 20px 26px; }
}
@media (max-width:760px) {
  .v3 { font-size:16px; }
  .v3 .wrap { padding:0 20px; }
  .v3 .nav-login { display:none !important; }
  .v3 .lead { font-size:17px !important; }
  .v3 .hero-eyes { width:54px !important; }
  .v3 .sel-frame { inset:-7px; }
  .v3 .sel-rot { bottom:-40px; }
}
@media (max-width:720px) {
  /* flow compact en ligne (plus de colonne) : les CTA doivent rester au-dessus
     de la ligne de flottaison sur mobile */
  .v3 .hero-flow { gap:6px; }
  .v3 .hero-flow-item { gap:6px; }
  .v3 .hero-flow-arr { display:none !important; } /* !important : display inline-flex posé en style inline */
  .v3 .hero-flow-chip { font-size:12px; padding:7px 11px; gap:6px; border-radius:10px; }
}
@media (max-width:680px) {
  .v3 #top { padding-top:92px !important; padding-bottom:44px !important; }
  .v3 .hero-h1 { font-size:clamp(32px, 9.6vw, 54px) !important; }
  .v3 .hero-h1 .h-line .t-arch { font-size:clamp(21px, 7.2vw, 40px) !important; } /* "TOUS VOS CLIENTS." tient jusqu'à ~300px */
  .v3 #top .lead { font-size:15.5px !important; margin-top:14px !important; }
  /* hero compact : les CTA (+ le début du lien Claude) doivent tenir au-dessus
     de la ligne de flottaison */
  .v3 #top .hero-flow { margin-top:16px !important; }
  .v3 #top .hero-proof { margin-top:16px !important; }
  .v3 #top .hero-cta { margin-top:18px !important; gap:10px !important; }
  /* la poignée de rotation du sticker OUTIL chevauchait le lead */
  .v3 #top .sel-rot { display:none; }
  /* stickers décoratifs : conservés sur mobile (retour Martin), plus petits et recalés
     pour ne plus chevaucher les titres */
  .v3 .hero-stk svg, .v3 .cta-stk svg { width:42px !important; height:auto !important; }
  .v3 .hero-eyes svg { width:58px !important; }
  .v3 span.hero-stk:nth-of-type(1) { top:-36px !important; left:2% !important; }
  .v3 span.hero-eyes { top:auto !important; bottom:6% !important; right:-2px !important; } /* à droite du sticker OUTIL, jamais sur la nav ni le titre */
  .v3 span.hero-stk:nth-of-type(3) { display:none !important; } /* le cœur tombe sur le lead */
  .v3 .cta-stk svg { width:34px !important; }
  .v3 span.cta-stk:nth-of-type(1) { top:-34px !important; left:-4px !important; }
  .v3 span.cta-stk:nth-of-type(2) { bottom:-26px !important; right:-6px !important; }
  .v3 span.cta-stk:nth-of-type(3) { bottom:-28px !important; left:-6px !important; }
  .v3 .fcta-t { font-size:clamp(34px, 9.6vw, 44px) !important; }
  .v3 #apercu-hero { padding-top:40px !important; padding-bottom:64px !important; border-radius:20px 20px 0 0 !important; }
}
@media (max-width:560px) {
  .v3 .foot-grid { grid-template-columns:1fr !important; gap:30px !important; }
  .v3 .section { padding:64px 0; }
  .v3 .btn { padding:14px 22px; font-size:15px; }
  .v3 .hero-cta, .v3 .final-cta { flex-direction:column; align-items:stretch !important; }
  .v3 .hero-cta .btn, .v3 .final-cta .btn { width:100%; justify-content:center; }
  .v3 .stat-bar { flex-direction:column; align-items:flex-start !important; gap:14px !important; padding:26px 24px !important; }
  .v3 .price-grid { max-width:420px; margin-left:auto; margin-right:auto; }
  .v3 .mqband span.w { font-size:16px; }
}
/* globals.css (app) pose html,body{height:100%} + overflow-x:hidden ≤767px, ce qui fait
   de <body> le conteneur défilant sur mobile (window.scrollY figé à 0 → Nav, ScrollTrigger
   et scrollTo cassés sur la landing). On rétablit le défilement fenêtre ici, scope landing
   via la classe posée sur <html> par le composant. clip (pas hidden) : pas de scroller. */
@media (max-width:767px) {
  html.v3-page, html.v3-page body { height:auto; overflow-x:clip; }
}
@media (prefers-reduced-motion:reduce) {
  .v3 .rv, .v3 .rv-slap, .v3 .rv-pop { opacity:1 !important; transform:scale(1) rotate(var(--r,0deg)) !important; }
  .v3 .sel .sel-frame, .v3 .sel .sel-rot { opacity:1 !important; }
  .v3 .sel .sel-h, .v3 .sel .sel-p { opacity:1 !important; transform:scale(1) !important; }
  .v3 .floatA, .v3 .floatB, .v3 .spin, .v3 .cur-drift2, .v3 .eyes-pupils, .v3 .h-outil-rot.in { animation:none !important; }
  .v3 .ants rect { animation:none !important; }
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
    case 'upload':    return <svg {...p}><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/></svg>;
    case 'clock':     return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>;
    case 'send':      return <svg {...p}><path d="M22 3L11 14M22 3l-7 19-4-8-8-4 19-7Z"/></svg>;
    case 'chat':      return <svg {...p}><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12Z"/></svg>;
    case 'eye':       return <svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'eyeOff':    return <svg {...p}><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.5 17.5 0 0 1-2.4 3.3M6.4 6.5A16.9 16.9 0 0 0 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3.5 3.5l17 17"/></svg>;
    case 'rotate':    return <svg {...p}><path d="M20 12a8 8 0 1 1-2.9-6.2M20 3v4h-4"/></svg>;
    case 'play':      return <svg {...p}><path d="M7 5l12 7-12 7V5Z" fill="currentColor" stroke="none"/></svg>;
    case 'scissors':  return <svg {...p}><circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M8.2 7.6L20 19M8.2 16.4L20 5"/></svg>;
    default: return null;
  }
}

/* ─── EdIcon — icônes du mock éditeur ────────────────────────────────────── */
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
  return <Image src={light ? '/logo-klip-mint.png' : '/logo-klip-dark.png'} alt="Klip" width={1096} height={408} style={{ height: size, width: 'auto' }} />;
}

/* ─── Stickers SVG (die-cut) ─────────────────────────────────────────────── */
function Stk({ name, size = 64, style, className }: { name: string; size?: number; style?: React.CSSProperties; className?: string }) {
  const cls = `stk ${className || ''}`;
  const outline = { stroke: '#fff', strokeWidth: 14, strokeLinejoin: 'round' as const, paintOrder: 'stroke' as const };
  /* contour à pointes nettes (étoiles) : joint miter, pas d'arrondi */
  const sharp = { stroke: '#fff', strokeWidth: 11, strokeLinejoin: 'miter' as const, strokeMiterlimit: 14, paintOrder: 'stroke' as const };
  switch (name) {
    case 'sparkle':
      return <svg className={cls} style={style} width={size} height={size} viewBox="-8 -8 116 116" overflow="visible"><path d="M50 0 C56 32 68 44 100 50 C68 56 56 68 50 100 C44 68 32 56 0 50 C32 44 44 32 50 0 Z" fill="#BDF2A0" {...sharp}/></svg>;
    case 'eyes':
      return (
        <svg className={cls} style={style} width={size} height={size * 0.72} viewBox="0 0 140 100">
          <g transform="rotate(-10 70 50)">
            <ellipse cx="45" cy="50" rx="27" ry="36" fill="#6656D9" {...outline}/>
            <ellipse cx="95" cy="50" rx="27" ry="36" fill="#6656D9" {...outline}/>
            <g className="eyes-pupils">
              <ellipse cx="41" cy="44" rx="11" ry="14" fill="#fff"/>
              <ellipse cx="91" cy="44" rx="11" ry="14" fill="#fff"/>
            </g>
          </g>
        </svg>
      );
    case 'smiley':
      return (
        <svg className={cls} style={style} width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="#BDF2A0" {...outline}/>
          <circle cx="37" cy="42" r="5.5" fill="#1E3317"/><circle cx="63" cy="42" r="5.5" fill="#1E3317"/>
          <path d="M32 58 Q50 76 68 58" fill="none" stroke="#1E3317" strokeWidth="6" strokeLinecap="round"/>
        </svg>
      );
    case 'flower':
      return (
        <svg className={cls} style={style} width={size} height={size} viewBox="0 0 100 100">
          <g {...{ stroke: '#fff', strokeWidth: 12, strokeLinejoin: 'round' as const, paintOrder: 'stroke' as const }}>
            {[0, 60, 120, 180, 240, 300].map(a => <ellipse key={a} cx="50" cy="26" rx="13" ry="22" fill="#2FD79B" transform={`rotate(${a} 50 50)`}/>)}
          </g>
          <circle cx="50" cy="50" r="11" fill="#072117"/>
        </svg>
      );
    case 'bolt':
      return <svg className={cls} style={style} width={size} height={size} viewBox="0 0 100 100"><path d="M58 6 L22 56 h20 L40 94 L78 42 H56 Z" fill="#6656D9" {...outline}/></svg>;
    case 'heart':
      return <svg className={cls} style={style} width={size} height={size} viewBox="0 0 100 100"><path d="M50 88 C20 66 8 48 12 32 C15 18 32 12 43 22 L50 30 L57 22 C68 12 85 18 88 32 C92 48 80 66 50 88 Z" fill="#FF7BAC" {...outline}/></svg>;
    case 'star':
      return <svg className={cls} style={style} width={size} height={size} viewBox="-8 -8 116 116" overflow="visible"><path d="M50 6 L61 38 L95 38 L67 58 L78 92 L50 71 L22 92 L33 58 L5 38 L39 38 Z" fill="#BDF2A0" {...sharp}/></svg>;
    case 'at':
      return (
        <svg className={cls} style={style} width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="41" fill="#2FD79B" {...outline}/>
          <text x="50" y="66" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="800" fontSize="52" fill="#072117">@</text>
        </svg>
      );
    default: return null;
  }
}

/* ─── Tape — bout de scotch pastel ───────────────────────────────────────── */
function Tape({ r = -4, w = 92 }: { r?: number; w?: number }) {
  return <span aria-hidden="true" style={{ position: 'absolute', top: -14, left: '50%', transform: `translateX(-50%) rotate(${r}deg)`, width: w, height: 26, background: 'rgba(189,242,160,.8)', boxShadow: '0 2px 6px rgba(16,19,11,.12)', borderRadius: 2, zIndex: 4 }} />;
}

/* ─── Sel — cadre de sélection ───────────────────────────────────────────── */
function Sel({ children, rot = 0, showRot = true, style, className }: { children: React.ReactNode; rot?: number; showRot?: boolean; style?: React.CSSProperties; className?: string }) {
  return (
    <span className={`sel ${className || ''}`} style={{ rotate: `${rot}deg`, ...style }}>
      {children}
      <span className="sel-frame" aria-hidden="true">
        <span className="sel-h" style={{ top: -7, left: -7 }} />
        <span className="sel-h" style={{ top: -7, right: -7 }} />
        <span className="sel-h" style={{ bottom: -7, left: -7 }} />
        <span className="sel-h" style={{ bottom: -7, right: -7 }} />
        <span className="sel-p" style={{ top: -5, left: '50%', transform: 'translateX(-50%)', width: 22, height: 9 }} />
        <span className="sel-p" style={{ bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 22, height: 9 }} />
        <span className="sel-p" style={{ left: -5, top: '50%', transform: 'translateY(-50%)', width: 9, height: 22 }} />
        <span className="sel-p" style={{ right: -5, top: '50%', transform: 'translateY(-50%)', width: 9, height: 22 }} />
      </span>
      {showRot && <span className="sel-rot" aria-hidden="true"><span><Icon name="rotate" size={13} stroke={2.2} /></span></span>}
    </span>
  );
}

/* ─── Ants ───────────────────────────────────────────────────────────────── */
function Ants({ inset = 0, radius = 18 }: { inset?: number; radius?: number }) {
  return (
    <svg className="ants" style={{ inset: -inset, width: `calc(100% + ${inset * 2}px)`, height: `calc(100% + ${inset * 2}px)` }} aria-hidden="true">
      <rect rx={radius} />
    </svg>
  );
}

/* ─── Cur — curseur collaboratif ─────────────────────────────────────────── */
function Cur({ label, color = '#6656D9', style, drift = false, id }: { label: string; color?: string; style?: React.CSSProperties; drift?: boolean; id?: string }) {
  return (
    <div id={id} className={`cur hero-curs ${drift ? 'cur-drift2' : ''}`} style={style} aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24"><path d="M3.5 2.2 L11 20.5 L13.6 12.6 L21.5 10 Z" fill={color} stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/></svg>
      <span className="cur-tag" style={{ background: color }}>{label}</span>
    </div>
  );
}

/* ─── useParallax ────────────────────────────────────────────────────────── */
function useParallax(speed = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf: number | null = null;
    const disabled = () => reduce || window.innerWidth <= 860;
    const update = () => {
      raf = null;
      if (disabled()) { el.style.transform = ''; return; }
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

/* ─── ScaleToFit ─────────────────────────────────────────────────────────── */
function ScaleToFit({ designWidth, children }: { designWidth: number; children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const compute = () => {
      const wrap = wrapRef.current, inner = innerRef.current;
      if (!wrap || !inner) return;
      const avail = wrap.clientWidth;
      if (avail >= designWidth) {
        inner.style.transform = ''; inner.style.width = ''; wrap.style.height = '';
      } else {
        const scale = avail / designWidth;
        inner.style.transformOrigin = 'top left';
        inner.style.width = `${designWidth}px`;
        inner.style.transform = `scale(${scale})`;
        wrap.style.height = `${inner.offsetHeight * scale}px`;
      }
    };
    compute();
    window.addEventListener('resize', compute);
    const ro = new ResizeObserver(compute);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => { window.removeEventListener('resize', compute); ro.disconnect(); };
  }, [designWidth]);
  return <div ref={wrapRef} style={{ overflow: 'hidden' }}><div ref={innerRef}>{children}</div></div>;
}

/* ─── Marquee (piloté par GSAP — vitesse liée au scroll) ─────────────────── */
function MarqueeBand() {
  const words = ['Créer', 'Rédiger', 'Planifier', 'Valider', 'Publier'];
  const seq = (k: string) => (
    <div className="mq-in" key={k} aria-hidden={k !== 'a'}>
      {[0, 1].map(r => words.map((w, i) => (
        <span key={`${r}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 26 }}>
          <span className="w">{i % 2 === 0 ? w : <em>{w}</em>}</span>
          <svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4 C56 32 68 44 96 50 C68 56 56 68 50 96 C44 68 32 56 4 50 C32 44 44 32 50 4 Z" fill="currentColor"/></svg>
        </span>
      )))}
    </div>
  );
  return (
    <div className="mqband" role="presentation">
      <div className="mq">{seq('a')}{seq('b')}</div>
    </div>
  );
}

/* ─── Nav ────────────────────────────────────────────────────────────────── */
function Nav() {
  const t = useTranslations('landing.nav');
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40); on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const links: [string, string][] = [[t('problem'), '#probleme'], [t('how'), '#how'], [t('product'), '#apercu'], [t('pricing'), '#tarifs'], [t('faq'), '#faq']];
  return (
    <>
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60, transition: 'background .3s, box-shadow .3s, border-color .3s', background: solid ? 'rgba(255,255,255,.9)' : 'transparent', backdropFilter: solid ? 'saturate(1.3) blur(14px)' : 'none', WebkitBackdropFilter: solid ? 'saturate(1.3) blur(14px)' : 'none', borderBottom: solid ? '1px solid var(--line-2)' : '1px solid transparent' }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 74 }}>
          <a href="#top" style={{ display: 'flex', alignItems: 'center' }}><KlipLogo size={27} light={!solid} /></a>
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {links.map(([label, h]) => <a key={h} href={h} className="nav-link" style={{ color: solid ? undefined : 'var(--cream-2)' }}>{label}</a>)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/login" className="nav-login" style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 800, color: solid ? 'var(--ink)' : 'var(--cream)' }}>{t('login')}</Link>
            <Link href="/register" className="btn btn-leaf btn-sm">{t('tryFree')} <span className="arr"><Icon name="arrowUR" size={15} /></span></Link>
            <button className="v3-mob-btn" onClick={() => setOpen(true)} aria-label="Menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
          </div>
        </div>
      </nav>

      <div className={`v3-mob-menu${open ? ' open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 38 }}>
          <KlipLogo size={28} light />
          <button onClick={() => setOpen(false)} aria-label="Fermer" style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(241,240,229,.12)', display: 'grid', placeItems: 'center', color: '#F1F0E5' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          {links.map(([label, h]) => <a key={h} href={h} className="v3-mob-link" onClick={() => setOpen(false)}>{label}</a>)}
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link href="/register" className="btn btn-leaf" style={{ justifyContent: 'center' }} onClick={() => setOpen(false)}>{t('tryFree')}</Link>
          <Link href="/login" className="btn btn-ghost" style={{ justifyContent: 'center', color: '#F1F0E5', boxShadow: 'inset 0 0 0 1.6px rgba(241,240,229,.3)' }} onClick={() => setOpen(false)}>{t('login')}</Link>
        </div>
      </div>
    </>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────────────── */
function Hero() {
  const t = useTranslations('landing.hero');
  const accent = t('title2accent').replace(/\s*[.。]\s*$/, '');
  const flow = [{ ic: 'upload', t: t('flowImport') }, { ic: 'image', t: t('flowCompose') }, { ic: 'send', t: t('flowSchedule') }];
  return (
    <header id="top" className="section on-forest" data-hero style={{ paddingTop: 104, paddingBottom: 90, position: 'relative', overflow: 'hidden' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>

        {/* H1 — asset vivant : blobs pastel + sticker OUTIL sélectionné (jamais clippé) */}
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <span className="drag hero-stk" data-stk style={{ position: 'absolute', top: -44, left: '6%', zIndex: 3 }}><Stk name="sparkle" size={58} className="spin" /></span>
          <span className="drag hero-eyes hero-stk" data-stk style={{ position: 'absolute', top: '28%', right: '4%', zIndex: 7 }}><Stk name="eyes" size={92} className="floatB" style={{ ['--r' as string]: '0deg' }} /></span>
          <span className="drag hero-stk" data-stk style={{ position: 'absolute', bottom: '-8%', left: '10%', zIndex: 3 }}><Stk name="heart" size={64} className="floatA" style={{ ['--r' as string]: '-9deg' }} /></span>
          <h1 className="hero-h1" style={{ margin: '0 auto', maxWidth: 1100, position: 'relative' }}>
            <span className="h-line"><span className="t-arch" style={{ color: 'var(--cream)', display: 'inline-block', whiteSpace: 'nowrap', fontSize: 'clamp(30px, 5.4vw, 76px)' }}>{t('title1')}</span></span>
            <span className="h-line" style={{ marginTop: '.12em' }}>
              <span className="hl">{t('title2pre').trim()}</span>{' '}
              <span className="drag" style={{ display: 'inline-block', margin: '0 .1em' }}>
                <Sel rot={-3} className="h-outil-rot">
                  <span className="h-outil">{accent}</span>
                </Sel>
              </span>
            </span>
          </h1>
          <Cur id="hero-cursor" label="Vous" color="#6656D9" style={{ top: '58%', right: '16%', opacity: 0 }} />
        </div>

        <p className="lead h-intro split-lines" data-reveal-load style={{ textAlign: 'center', maxWidth: 660, margin: '34px auto 0', fontSize: 20 }}>
          {t('leadPre')}<strong style={{ color: 'var(--cream)', fontWeight: 800 }}>{t('leadStrong')}</strong>{t('leadPost')}
        </p>

        <div className="h-intro hero-flow" style={{ marginTop: 30 }}>
          {flow.map((s, i) => (
            <span key={i} className="hero-flow-item">
              <span className="hero-flow-chip" style={{ rotate: `${(i - 1) * 1.2}deg` }}>
                <span className="ic"><Icon name={s.ic} size={16} /></span>{s.t}
              </span>
              {i < flow.length - 1 && <span className="hero-flow-arr" style={{ color: 'var(--cream-3)', display: 'inline-flex' }}><Icon name="arrow" size={18} /></span>}
            </span>
          ))}
        </div>

        <div className="h-intro hero-proof" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11, marginTop: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap', justifyContent: 'center', textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14.5, color: 'var(--cream)' }}>{t('socialProof')}</span>
            <span style={{ width: 1, height: 18, background: 'var(--line-f)' }} />
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 14, color: 'var(--cream-3)' }}>{t('trial7')}</span>
          </div>
        </div>

        <div className="h-intro hero-cta" style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 34, flexWrap: 'wrap' }}>
          <Link href="/register" className="btn btn-leaf">{t('ctaTry')} <span className="arr"><Icon name="arrowUR" size={18} /></span></Link>
          <a href="#apercu" className="btn btn-ghost">{t('ctaSee')}</a>
        </div>
        <div className="h-intro" style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <ConnectClaudePill />
        </div>
      </div>
    </header>
  );
}

/* ─── Aperçu produit — mockup + stickers draggables (section propre, après Comparison) ─── */
function HeroPreview() {
  const t = useTranslations('landing.hero');
  const peek = useParallax(0.055);
  const f1 = useParallax(-0.13), f2 = useParallax(0.16), f3 = useParallax(0.09), f4 = useParallax(-0.11);
  return (
    <section id="apercu-hero" className="section on-forest" style={{ paddingTop: 'clamp(64px,8vw,104px)', paddingBottom: 100, position: 'relative', overflow: 'hidden', borderRadius: '28px 28px 0 0' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ position: 'relative', maxWidth: 1080, margin: '0 auto' }}>
          <div ref={peek} className="rv d2" style={{ position: 'relative' }}>
            <div className="win">
              <div className="win-bar">
                <span className="win-dot" /><span className="win-dot" /><span className="win-dot" />
                <span className="win-tab"><Icon name="layers" size={13} style={{ color: 'var(--mint-2)' }} /> app.getklip.fr — tableau-de-bord</span>
                <span className="win-zoom">100% · 1:1</span>
              </div>
              <Image src="/klip-media/dashboard.png" alt="Tableau de bord Klip — gérer le contenu Instagram de tous ses clients au même endroit" width={2200} height={1114} priority sizes="(max-width: 1080px) 100vw, 1080px" style={{ display: 'block', width: '100%', height: 'auto' }} />
            </div>
            <Ants inset={12} radius={22} />
          </div>
          <Cur label="Léa · Cliente" color="#2FD79B" style={{ bottom: '18%', left: '30%', zIndex: 6 }} drift />
          <div ref={f1} className="hero-float rv-slap in" style={{ position: 'absolute', left: -46, top: '30%', zIndex: 5, ['--r' as string]: '-4deg' }}>
            <span className="drag" data-stk><span className="stk-card stk-leaf floatA" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, maxWidth: 170, lineHeight: 1.35, ['--r' as string]: '0deg' }}>
              <span style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 24 }}>{t('floatClients')}</span>{t('floatOneScreen')}
            </span></span>
          </div>
          <div ref={f2} className="hero-float rv-slap in" style={{ position: 'absolute', right: -40, top: '10%', zIndex: 5, ['--r' as string]: '3deg' }}>
            <span className="drag" data-stk><span className="stk-card stk-forest floatB" style={{ ['--r' as string]: '0deg' }}>
              <Icon name="spark" size={19} style={{ color: 'var(--leaf)' }} /><span>{t('floatAiCaption')}</span>
            </span></span>
          </div>
          <div ref={f3} className="hero-float rv-slap in" style={{ position: 'absolute', left: -40, bottom: '12%', zIndex: 5, ['--r' as string]: '2.5deg' }}>
            <span className="drag" data-stk><span className="stk-card floatB" style={{ ['--r' as string]: '0deg' }}>
              <span style={{ width: 30, height: 30, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: 8, background: 'var(--forest)', color: 'var(--leaf)' }}><Icon name="image" size={16} /></span>
              <span style={{ lineHeight: 1.3, color: 'var(--ink)' }}>{t('floatVisualEditor')}<br /><span style={{ color: 'var(--ink-3)', fontWeight: 700 }}>{t('floatCanvaAdobe')}</span></span>
            </span></span>
          </div>
          <div ref={f4} className="hero-float rv-slap in" style={{ position: 'absolute', right: -34, bottom: '24%', zIndex: 5, ['--r' as string]: '-3deg' }}>
            <span className="drag" data-stk><span className="stk-card stk-leaf floatA" style={{ ['--r' as string]: '0deg' }}>
              <Icon name="calendar" size={18} /><span style={{ lineHeight: 1.3 }}>{t('floatScheduled')}<br />{t('floatScheduledTime')}</span>
            </span></span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Comparison — la stack devient un panneau Calques ───────────────────── */
const KLIP_PRICE = 35;
const STACK_TOOLS = [
  { name: 'Canva', cost: 12, domain: 'canva.com', color: '00C4CC' },
  { name: 'CapCut', cost: 15, domain: 'capcut.com', color: '000000' },
  { name: 'ChatGPT', cost: 23, domain: 'chatgpt.com', color: '10A37F' },
  { name: 'Metricool', cost: 25, domain: 'metricool.com', color: '7C5CFF' },
  { name: 'Notion', cost: 10, domain: 'notion.so', color: '111111' },
  { name: 'WeTransfer', cost: 10, domain: 'wetransfer.com', color: '409FFF' },
];
const STACK_TOTAL = STACK_TOOLS.reduce((s, t) => s + t.cost, 0);

function ToolLogo({ domain, color, name, size = 24 }: { domain: string; color: string; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) return <span style={{ color: `#${color}`, fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: size * 0.66 }}>{name.charAt(0)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://www.google.com/s2/favicons?sz=128&domain=${domain}`} alt={name} width={size} height={size} loading="lazy" onError={() => setErr(true)} style={{ width: size, height: size, objectFit: 'contain' }} />;
}

function Comparison() {
  const t = useTranslations('landing.comparison');
  const useLabels: Record<string, string> = { Canva: t('useCanva'), CapCut: t('useCapcut'), ChatGPT: t('useChatgpt'), Metricool: t('useMetricool'), Notion: t('useNotion'), WeTransfer: t('useWetransfer') };
  const panelRef = useRef<HTMLDivElement>(null);
  const [offCount, setOffCount] = useState(0);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setOffCount(STACK_TOOLS.length); return; }
    const io = new IntersectionObserver((ents) => {
      ents.forEach(en => {
        if (!en.isIntersecting) return;
        io.disconnect();
        STACK_TOOLS.forEach((_, i) => setTimeout(() => setOffCount(c => Math.max(c, i + 1)), 700 + i * 420));
      });
    }, { threshold: 0.45 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="comparatif" className="section" style={{ overflow: 'hidden', paddingBottom: 'clamp(48px,6vw,72px)' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div className="cmp-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 'clamp(38px,5vw,72px)', alignItems: 'center' }}>

          <div>
            <h2 className="t-arch rv d1 split-lines" style={{ fontSize: 'clamp(36px, 4.8vw, 66px)' }}>
              {t('title1')}<span className="acc-hl">{t('titleAccent')}</span>
            </h2>
            <p className="lead rv d2 split-lines" style={{ marginTop: 22, maxWidth: 520 }}>{t('lead')}</p>
            <p className="rv d2" style={{ marginTop: 18, fontSize: 15, color: 'var(--ink-2)' }}>{t('today', { total: STACK_TOTAL })}</p>
            <div className="rv d3" style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 26, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="t-oaksx" style={{ fontSize: 'clamp(52px, 6vw, 84px)', color: 'var(--ink)' }}>{KLIP_PRICE}€</span>
                <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, color: 'var(--ink-3)' }}>{t('perMonth')}</span>
              </div>
              <span className="stk-card stk-leaf rv-slap in" style={{ ['--r' as string]: '-3deg', rotate: '-3deg', fontSize: 12.5 }}>{t('withKlip')} — {t('allInOne')}</span>
            </div>
            <p className="rv d3" style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 8 }}>{t('insteadOf', { total: STACK_TOTAL })}</p>
            <div className="rv d4" style={{ marginTop: 24 }}>
              <Link href="/register" className="btn btn-leaf">{t('ctaTry')} <span className="arr"><Icon name="arrowUR" size={18} /></span></Link>
            </div>
            <p className="rv d4" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 16 }}>{t('note')}</p>
          </div>

          {/* panneau calques */}
          <div ref={panelRef} className="rv d2" style={{ position: 'relative' }}>
            <span className="drag" data-stk style={{ position: 'absolute', top: -34, right: -18, zIndex: 6 }}><Stk name="heart" size={64} className="floatB" style={{ ['--r' as string]: '8deg' }} /></span>
            <div className="lp" style={{ maxWidth: 470, margin: '0 auto' }}>
              <div className="lp-head">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="layers" size={15} /> Calques</span>
                <span style={{ fontSize: 11, letterSpacing: '.02em', textTransform: 'none', color: 'var(--ink-3)' }}>votre-stack.klip</span>
              </div>
              <div className="lp-row klip">
                <span className="lp-eye"><Icon name="eye" size={17} /></span>
                <span className="lp-logo lp-logo-brand" style={{ background: 'linear-gradient(150deg, #12503A, var(--forest))' }}><KlipLogo size={18} light /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="lp-name">KLIP</div>
                  <div className="lp-use">{t('allInOne')} {KLIP_PRICE}€{t('perMonth')}</div>
                </div>
                <span className="lp-cost" style={{ color: 'var(--mint-2)' }}>{KLIP_PRICE}€</span>
              </div>
              {STACK_TOOLS.map((tool, i) => (
                <div key={tool.name} className={`lp-row${i < offCount ? ' off' : ''}`}>
                  <span className="lp-eye"><Icon name={i < offCount ? 'eyeOff' : 'eye'} size={17} /></span>
                  <span className="lp-logo" style={{ background: `linear-gradient(150deg, #ffffff 0%, #${tool.color}33 55%, #${tool.color}66 100%)` }}><ToolLogo domain={tool.domain} color={tool.color} name={tool.name} size={26} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="lp-name lp-strike">{tool.name}</div>
                    <div className="lp-use">{useLabels[tool.name]}</div>
                  </div>
                  <span className="lp-cost lp-strike">~{tool.cost}€</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'var(--paper-2)', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 13 }}>
                <span style={{ color: 'var(--ink-3)' }}>{t('yourStack')}</span>
                <span className={`lp-strike${offCount >= STACK_TOOLS.length ? ' off' : ''}`} style={{ position: 'relative', transition: 'color .3s', color: offCount >= STACK_TOOLS.length ? 'var(--ink-3)' : 'var(--ink)' }}>~{STACK_TOTAL}€{t('perMonth')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Problème ───────────────────────────────────────────────────────────── */
function Probleme() {
  const t = useTranslations('landing.problem');
  const pains = [
    { ic: 'layers', t: t('pain1t'), d: t('pain1d') },
    { ic: 'clock', t: t('pain2t'), d: t('pain2d') },
    { ic: 'voice', t: t('pain3t'), d: t('pain3d') },
    { ic: 'chat', t: t('pain4t'), d: t('pain4d') },
  ];
  return (
    <section id="probleme" className="section on-forest" style={{ overflow: 'hidden' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 920 }}>
          <h2 className="rv d1 t-arch split-lines" style={{ fontSize: 'clamp(38px, 5.6vw, 80px)', color: 'var(--cream)' }}>
            {t('title1')}<span className="acc-hl">{t('titleAccent')}</span>
          </h2>
          <p className="lead rv d2 split-lines" style={{ marginTop: 26, maxWidth: 620 }}>{t('lead')}</p>
        </div>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 56 }}>
          {pains.map((p, i) => (
            <div key={i} className={`rv d${(i % 2) + 1}`} style={{ background: 'var(--forest-2)', border: '1px solid var(--line-f)', borderRadius: 'var(--r)', padding: '28px 30px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ flex: 'none', width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 12, background: 'var(--leaf)', color: 'var(--leaf-ink)', fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 16 }}>{i + 1}</span>
              <div>
                <h3 style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 20, letterSpacing: '-.02em', marginBottom: 7, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--leaf)', display: 'inline-flex' }}><Icon name={p.ic} size={18} /></span>{p.t}
                </h3>
                <p className="split-lines" style={{ color: 'var(--cream-2)', fontSize: 15.5, lineHeight: 1.55 }}>{p.d}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rv d2 stat-bar" style={{ marginTop: 24, padding: '34px 38px', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', background: 'var(--leaf)', color: 'var(--leaf-ink)', borderRadius: 'var(--r)', boxShadow: '0 30px 60px -30px rgba(120,190,90,.4)' }}>
          <span className="t-oaksx" style={{ fontSize: 'clamp(46px, 6vw, 80px)', lineHeight: 1 }}>{t('statNum')}</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 16, maxWidth: 460, lineHeight: 1.5 }}>{t('statText')}</span>
          <span className="drag" data-stk style={{ marginLeft: 'auto' }}><Stk name="sparkle" size={54} className="spin" /></span>
        </div>
      </div>
    </section>
  );
}

/* ─── Steps ──────────────────────────────────────────────────────────────── */
function Steps() {
  const t = useTranslations('landing.steps');
  const peek = useParallax(0.06);
  const steps = [
    { n: '01', ic: 'upload', t: t('s1t'), d: t('s1d') },
    { n: '02', ic: 'image', t: t('s2t'), d: t('s2d') },
    { n: '03', ic: 'wand', t: t('s3t'), d: t('s3d') },
    { n: '04', ic: 'send', t: t('s4t'), d: t('s4d') },
  ];
  return (
    <section id="how" className="section">
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 900 }}>
          <h2 className="rv d1 t-arch split-lines" style={{ fontSize: 'clamp(34px, 4.6vw, 62px)' }}>
            {t('title1')}<br /><span className="acc-hl">{t('titleAccent')}</span>
          </h2>
          <p className="lead rv d2 split-lines" style={{ marginTop: 24, maxWidth: 660 }}>{t('lead')}</p>
        </div>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.04fr', gap: 56, marginTop: 54, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: 21, top: 30, bottom: 30, width: 0, borderLeft: '2px dashed var(--line)' }} />
            {steps.map((s, i) => (
              <div key={i} className="rv" style={{ display: 'flex', gap: 20, padding: '20px 4px', position: 'relative' }}>
                <span style={{ flex: 'none', width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 13, background: i === 3 ? 'var(--leaf)' : 'var(--card)', color: i === 3 ? 'var(--leaf-ink)' : 'var(--ink)', boxShadow: '0 0 0 1px var(--line-2), 0 8px 18px -8px rgba(16,19,11,.2)', zIndex: 1 }}>
                  <Icon name={s.ic} size={19} />
                </span>
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 21, letterSpacing: '-.02em', marginBottom: 6, textTransform: 'uppercase' }}>
                    <span className="t-oaksx" style={{ fontSize: 15, color: 'var(--mint-2)' }}>{s.n}</span>{s.t}
                  </h3>
                  <p className="split-lines" style={{ color: 'var(--ink-2)', fontSize: 15.5, lineHeight: 1.55 }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
          <div ref={peek} className="rv d2" style={{ position: 'relative' }}>
            <div className="win">
              <div className="win-bar">
                <span className="win-dot" /><span className="win-dot" /><span className="win-dot" />
                <span className="win-tab"><Icon name="image" size={13} style={{ color: 'var(--mint-2)' }} /> app.getklip.fr — composer</span>
                <span className="win-zoom">86% · 4:5</span>
              </div>
              <Image src="/klip-media/composer.png" alt="Éditeur visuel Klip pour composer un post Instagram aux couleurs du client" width={1440} height={900} sizes="(max-width: 960px) 100vw, 600px" style={{ display: 'block', width: '100%', height: 'auto' }} />
            </div>
            <span className="drag" data-stk style={{ position: 'absolute', top: -26, right: -20, zIndex: 5 }}><Stk name="smiley" size={62} className="floatA" style={{ ['--r' as string]: '10deg' }} /></span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── EditorUI — mock plein écran de l'éditeur ───────────────────────────── */
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
    <div style={{ width: '100%', overflow: 'hidden', color: E.ink, background: 'radial-gradient(120% 80% at 50% -10%, #FBFAF4, #ECEBE1 70%)' }}>
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
          <span style={{ height: 34, padding: '0 13px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, color: E.ink2, boxShadow: `inset 0 0 0 1px ${E.line}` }}><EdIcon name="eye" size={15} /> Aperçu</span>
          <span style={{ height: 34, padding: '0 13px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, color: '#fff', background: E.mint }}><EdIcon name="upload" size={15} /> Partager</span>
        </div>
      </div>
      <div style={{ display: 'flex', minHeight: 420 }}>
        <div style={{ width: 70, flexShrink: 0, background: '#fff', borderRight: `1px solid ${E.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 0' }}>
          {rail.map(([ic, label], i) => {
            const on = i === 2;
            return (
              <span key={i} style={{ width: 54, height: 56, borderRadius: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, color: on ? E.mint : E.ink2, background: on ? E.mintSoft : 'transparent' }}>
                <EdIcon name={ic} size={20} stroke={1.7} />
                <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 9, letterSpacing: '.02em', textTransform: 'uppercase' }}>{label}</span>
              </span>
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', placeItems: 'center', padding: 26 }}>
          <div style={{ position: 'relative', height: 408, aspectRatio: '4 / 5', borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 70px -30px rgba(13,15,10,.55)', background: 'linear-gradient(155deg,#1f7a4d,#0c2a1d)' }}>
            <span style={{ position: 'absolute', top: 18, left: 18, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11, letterSpacing: '.14em', color: E.cream }}>MAISON LOU</span>
            <div style={{ position: 'absolute', top: 44, left: 18, right: 18, height: 150, borderRadius: 12, border: '1.5px dashed rgba(238,237,227,.5)', background: 'rgba(255,255,255,.06)', display: 'grid', placeItems: 'center', color: 'rgba(238,237,227,.6)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}><EdIcon name="image" size={22} stroke={1.5} /><span style={{ fontFamily: 'var(--sans)', fontSize: 9.5, fontWeight: 700 }}>PHOTO DU PLAT</span></div>
            </div>
            <span style={{ position: 'absolute', top: 208, left: 18, background: 'var(--leaf)', color: '#1E3317', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11, letterSpacing: '.08em', padding: '7px 14px', borderRadius: 999 }}>SEPTEMBRE</span>
            <div style={{ position: 'absolute', top: 248, left: 18, width: 226 }}>
              <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 800, fontStyle: 'italic', fontSize: 32, lineHeight: 0.96, letterSpacing: '-.03em', color: E.cream, textShadow: '0 3px 16px rgba(0,0,0,.45)' }}>Nouvelle carte d&apos;automne</div>
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
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11, color: E.ink2, background: E.sunk, padding: '6px 11px', borderRadius: 999 }}><EdIcon name="image" size={13} /> Page 1 · Post 4:5</span>
        <span style={{ fontSize: 12, color: E.ink3, fontWeight: 600 }}>Maison Lou</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9, color: E.ink2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11.5, padding: '6px 10px', borderRadius: 999, boxShadow: `inset 0 0 0 1px ${E.line}` }}><EdIcon name="play" size={13} /> Animer</span>
          <span style={{ width: 1, height: 20, background: E.line }} />
          <EdIcon name="minus" size={15} />
          <span style={{ width: 92, height: 4, borderRadius: 2, background: E.sunk, position: 'relative' }}><span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '42%', background: E.mint, borderRadius: 2 }} /><span style={{ position: 'absolute', left: '42%', top: '50%', transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} /></span>
          <EdIcon name="plus" size={15} />
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11.5, width: 38, textAlign: 'center' }}>50%</span>
          <EdIcon name="fit" size={15} />
        </div>
      </div>
    </div>
  );
}

/* ─── Deck — le produit en cartes empilées au scroll ─────────────────────── */
function DeckShowcase() {
  const t = useTranslations('landing.showcase');
  const cards = [
    { key: 'editor', num: '01', title: t('editorTitle'), desc: t('editorText'), tags: [] as string[], tab: 'éditeur', visual: 'editor' as const, rot: -1.1, tapeR: -6, stk: 'smiley', stkPos: { top: -26, right: -20 } as React.CSSProperties },
    { key: 'cal', num: '02', title: t('calTitle'), desc: t('calDesc'), tags: [t('calTag1'), t('calTag2'), t('calTag3')], tab: 'calendrier', visual: '/klip-media/planning.png', w: 3018, h: 1514, rot: 0.9, tapeR: 5, stk: 'star', stkPos: { bottom: -24, left: -22 } as React.CSSProperties },
    { key: 'queue', num: '03', title: t('queueTitle'), desc: t('queueDesc'), tags: [t('queueTag1'), t('queueTag2'), t('queueTag3')], tab: 'publication', visual: '/klip-media/queue.png', w: 1440, h: 900, rot: -0.8, tapeR: -4, stk: 'at', stkPos: { top: -24, right: 60 } as React.CSSProperties },
    { key: 'mont', num: '04', title: t('montTitle'), desc: t('montDesc'), tags: [t('montTag1'), t('montTag2'), t('montTag3')], tab: 'montage', visual: '/klip-media/montage.png', w: 2994, h: 1516, rot: 1.2, tapeR: 6, stk: 'bolt', stkPos: { bottom: -22, right: -18 } as React.CSSProperties },
  ];
  return (
    <section id="apercu" className="section on-forest" style={{ overflow: 'visible' }}>
      <div className="wrap">
        <div style={{ maxWidth: 860, marginBottom: 60 }}>
          <h2 className="rv d1 t-arch split-lines" style={{ fontSize: 'clamp(38px, 5.6vw, 78px)', color: 'var(--cream)' }}>
            {t('title1')}<span className="acc-hl">{t('titleAccent')}</span>
          </h2>
          <p className="lead rv d2 split-lines" style={{ marginTop: 24, maxWidth: 580 }}>{t('lead')}</p>
        </div>

        <div className="deck" data-deck>
          {cards.map((c, i) => (
            <article key={c.key} className="deck-card" data-deck-card style={{ top: 100 + i * 22, zIndex: i + 1, rotate: `${c.rot}deg` }}>
              <Tape r={c.tapeR} w={104} />
              <span className="drag" data-stk style={{ position: 'absolute', zIndex: 5, ...c.stkPos }}><Stk name={c.stk} size={56} className={i % 2 === 0 ? 'floatA' : 'floatB'} style={{ ['--r' as string]: `${c.rot * 6}deg` }} /></span>
              <div className="deck-grid">
                <div className="deck-copy">
                  <span className="deck-num">{c.num} — app.getklip.fr / {c.tab}</span>
                  <h3 className="t-arch" style={{ fontSize: 'clamp(24px,2.6vw,38px)' }}>{c.title}</h3>
                  <p className="split-lines" style={{ color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.6 }}>{c.desc}</p>
                  {c.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {c.tags.map((tag, j) => <span key={j} className="chip">{tag}</span>)}
                    </div>
                  )}
                </div>
                <div className="deck-visual">
                  {c.visual === 'editor'
                    ? <div><ScaleToFit designWidth={920}><EditorUI /></ScaleToFit></div>
                    : <div><Image src={c.visual} alt={`${c.title} — KLIP`} width={c.w} height={c.h} sizes="(max-width: 860px) 100vw, 760px" style={{ display: 'block', width: '100%', height: 'auto' }} /></div>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── EditorMock — mini éditeur (Features) ───────────────────────────────── */
function EditorMock() {
  const corners = [{ top: -5, left: -5 }, { top: -5, right: -5 }, { bottom: -5, left: -5 }, { bottom: -5, right: -5 }] as React.CSSProperties[];
  return (
    <div style={{ background: 'var(--paper-2)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 'min(350px, 100%)', margin: '0 auto', boxShadow: '0 34px 64px -30px rgba(0,0,0,.55)', border: '1px solid var(--line-2)' }}>
      {/* flexWrap : sans lui, la rangée impose son min-content à la colonne de grille
         (feat-hero) et fait déborder toute la carte sur mobile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(140deg,#1f7a4d,#0c2a1d)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11 }}>ML</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#0c2a1d', 'var(--leaf)', '#EFEEE4'].map((cc, i) => <span key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: cc, boxShadow: 'inset 0 0 0 1px var(--line)' }} />)}
        </div>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11, color: 'var(--ink-2)', padding: '5px 9px', borderRadius: 7, boxShadow: 'inset 0 0 0 1px var(--line)' }}>Aa Archivo</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11, color: 'var(--ink-3)' }}>● calé au pixel</span>
      </div>
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '3 / 4', background: 'radial-gradient(130% 130% at 18% 0%, #20a368, #0a2419 72%)', padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 10, letterSpacing: '.14em', color: 'rgba(255,255,255,.82)' }}>MAISON LOU</span>
        <div style={{ position: 'relative', alignSelf: 'flex-start', maxWidth: '82%' }}>
          <div style={{ fontFamily: 'var(--heavy)', fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(20px,2.3vw,30px)', lineHeight: 1, color: '#fff', textTransform: 'uppercase', letterSpacing: '-.02em' }}>L&apos;été se réserve maintenant</div>
          <div style={{ position: 'absolute', inset: '-11px -13px', border: '1.6px dashed var(--leaf)', borderRadius: 4, pointerEvents: 'none' }}>
            {corners.map((cs, i) => <span key={i} style={{ position: 'absolute', ...cs, width: 9, height: 9, background: 'var(--leaf)', border: '1.5px solid #fff', borderRadius: 2 }} />)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['#terrasse', '#nouvellecarte', '#septembre'].map((h, i) => (
            <span key={i} style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 10.5, color: 'rgba(255,255,255,.9)', padding: '4px 9px', borderRadius: 999, background: 'rgba(255,255,255,.12)' }}>{h}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Features ───────────────────────────────────────────────────────────── */
function Features() {
  const t = useTranslations('landing.features');
  const tags = [t('tag1'), t('tag2'), t('tag3')];
  const F = ({ ic, t: title, d, tone }: { ic: string; t: string; d: string; tone?: 'leaf' | 'forest' }) => {
    const isLeaf = tone === 'leaf', isForest = tone === 'forest';
    return (
      <div className="card rv" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 13, background: isLeaf ? 'var(--leaf)' : isForest ? 'var(--forest)' : 'var(--card)', color: isForest ? 'var(--cream)' : isLeaf ? 'var(--leaf-ink)' : 'var(--ink)' }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, display: 'grid', placeItems: 'center', background: isLeaf ? 'var(--leaf-ink)' : isForest ? 'var(--leaf)' : 'var(--forest)', color: isLeaf ? 'var(--leaf)' : isForest ? 'var(--leaf-ink)' : 'var(--leaf)', boxShadow: '0 10px 20px -10px rgba(16,19,11,.35)' }}>
          <Icon name={ic} size={21} />
        </span>
        <h3 style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 18.5, letterSpacing: '-.02em', textTransform: 'uppercase' }}>{title}</h3>
        <p className="split-lines" style={{ fontSize: 14.5, lineHeight: 1.56, color: isForest ? 'var(--cream-2)' : isLeaf ? 'var(--leaf-ink)' : 'var(--ink-2)', opacity: isLeaf ? .85 : 1 }}>{d}</p>
      </div>
    );
  };
  return (
    <section id="features" className="section">
      <div className="wrap">
        <div style={{ maxWidth: 940 }}>
          <h2 className="rv d1 t-arch split-lines" style={{ fontSize: 'clamp(34px, 4.6vw, 62px)' }}>
            {t('title1')}<br /><span className="acc-hl">{t('titleAccent')}</span>
          </h2>
        </div>
        <div className="rv feat-hero" style={{ display: 'grid', gridTemplateColumns: '1fr 1.12fr', gap: 0, marginTop: 52, background: 'var(--forest)', color: 'var(--cream)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: '0 50px 100px -55px rgba(7,33,23,.8)', position: 'relative' }}>
          <div style={{ padding: 'clamp(32px, 3.6vw, 52px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
            <span className="stk-card stk-leaf" style={{ alignSelf: 'flex-start', rotate: '-2deg', fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', gap: 7 }}>
              <Icon name="spark" size={14} /> {t('badge')}
            </span>
            <h3 className="t-arch" style={{ fontSize: 'clamp(36px, 4.4vw, 60px)' }}>{t('mainTitle')}</h3>
            <p className="split-lines" style={{ color: 'var(--cream-2)', fontSize: 17.5, lineHeight: 1.6, maxWidth: 440 }}>{t('mainText')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              {tags.map((tag, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12.5, color: 'var(--cream)', padding: '8px 13px', borderRadius: 999, background: 'var(--forest-2)', border: '1px solid var(--line-f)' }}>
                  <Icon name="check" size={14} style={{ color: 'var(--leaf)' }} /> {tag}
                </span>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--forest-2)', padding: 'clamp(26px, 3vw, 44px)', display: 'grid', placeItems: 'center' }}>
            <EditorMock />
          </div>
        </div>
        <div className="bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(216px, 1fr))', gap: 14, marginTop: 16 }}>
          <F ic="voice" t={t('f1t')} d={t('f1d')} tone="leaf" />
          <F ic="wand" t={t('f2t')} d={t('f2d')} />
          <F ic="layers" t={t('f3t')} d={t('f3d')} />
          <F ic="scissors" t={t('f5t')} d={t('f5d')} tone="leaf" />
          <F ic="instagram" t={t('f4t')} d={t('f4d')} tone="forest" />
        </div>
      </div>
    </section>
  );
}

/* ─── Testimonials ───────────────────────────────────────────────────────── */
function Testimonials() {
  const t = useTranslations('landing.testimonials');
  const small = [
    { q: t('s1q'), a: t('s1a'), r: t('s1r'), rot: 0.8 },
    { q: t('s2q'), a: t('s2a'), r: t('s2r'), rot: -0.7 },
  ];
  return (
    <section className="section" style={{ overflow: 'hidden' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 700 }}>
          <h2 className="rv d1 t-arch split-lines" style={{ fontSize: 'clamp(38px, 5.6vw, 78px)' }}>
            {t('title1')}<span className="acc-hl">{t('titleAccent')}</span>
          </h2>
        </div>
        <div className="testi-grid" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 22, marginTop: 60 }}>
          <div className="rv-slap" style={{ gridRow: 'span 2', position: 'relative', background: 'var(--leaf)', color: 'var(--leaf-ink)', borderRadius: 'var(--r)', padding: '42px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', ['--r' as string]: '-1deg', boxShadow: '0 34px 70px -34px rgba(120,190,90,.55)' }}>
            <Tape r={-5} />
            <Icon name="spark" size={30} />
            <p className="split-lines" style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 'clamp(24px, 2.6vw, 38px)', lineHeight: 1.12, letterSpacing: '-.025em', margin: '26px 0' }}>&ldquo;{t('bigQ')}&rdquo;</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--forest)', flex: 'none' }} />
              <div>
                <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15 }}>{t('bigA')}</div>
                <div style={{ fontSize: 13.5, opacity: .72 }}>{t('bigR')}</div>
              </div>
            </div>
          </div>
          {small.map((x, i) => (
            <div key={i} className={`rv-slap d${i + 1}`} style={{ position: 'relative', background: 'var(--card)', borderRadius: 'var(--r)', padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 0 0 1px var(--line-2), 0 26px 54px -30px rgba(16,19,11,.3)', ['--r' as string]: `${x.rot}deg` }}>
            <Tape r={i === 0 ? 4 : -4} />
              <p className="split-lines" style={{ fontSize: 18.5, lineHeight: 1.5, fontWeight: 500, color: 'var(--ink)' }}>&ldquo;{x.q}&rdquo;</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 26 }}>
                <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(140deg, var(--leaf), var(--leaf-soft))', flex: 'none' }} />
                <div>
                  <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14 }}>{x.a}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{x.r}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Checkout helper ────────────────────────────────────────────────────── */
async function startCheckout(plan: 'studio' | 'agence', period: 'monthly' | 'yearly') {
  try {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, period }),
    });
    if (res.status === 401) {
      try { localStorage.setItem('klip_pending_checkout', JSON.stringify({ plan, period })); } catch {}
      window.location.href = `/register?plan=${plan}`;
      return;
    }
    const json = await res.json();
    if (res.ok && json.url) { window.location.href = json.url; return; }
    if (json.code === 'STRIPE_OFF') { alert('Le paiement en ligne arrive très bientôt.'); return; }
    alert(json.error || 'Une erreur est survenue. Réessayez.');
  } catch {
    alert('Une erreur est survenue. Réessayez.');
  }
}

/* ─── Pricing ────────────────────────────────────────────────────────────── */
function Pricing() {
  const tp = useTranslations('landing.pricing');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [busy, setBusy] = useState<string | null>(null);
  const tiers = [
    { name: 'Studio', plan: 'studio' as const, monthly: 35, yearly: 29, tag: tp('studioTag'), clients: tp('studioClients'), feats: [tp('studioF1'), tp('studioF2'), tp('studioF3'), tp('studioF4'), tp('studioF5')], pop: false },
    { name: 'Agence', plan: 'agence' as const, monthly: 96, yearly: 80, tag: tp('agencyTag'), clients: tp('agencyClients'), feats: [tp('agencyF1'), tp('agencyF2'), tp('agencyF3'), tp('agencyF4'), tp('agencyF5')], pop: true },
  ];
  async function onChoose(plan: 'studio' | 'agence') { setBusy(plan); await startCheckout(plan, period); setBusy(null); }

  return (
    <section id="tarifs" className="section" style={{ overflow: 'hidden' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
          <h2 className="rv d1 t-arch split-lines" style={{ fontSize: 'clamp(38px, 5.6vw, 78px)' }}>
            {tp('title1')}<span className="acc-hl">{tp('titleAccent')}</span>
          </h2>
          <p className="lead rv d2 split-lines" style={{ marginTop: 22 }}>{tp('lead')}</p>
          <div className="rv d2" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 26, padding: 5, borderRadius: 999, background: 'var(--card)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
            {([['monthly', tp('monthly')], ['yearly', tp('yearly')]] as const).map(([p, label]) => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ padding: '9px 18px', borderRadius: 999, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'background .2s, color .2s',
                  background: period === p ? 'var(--ink)' : 'transparent', color: period === p ? 'var(--paper)' : 'var(--ink-2)' }}>
                {label}{p === 'yearly' && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, background: 'var(--leaf)', color: 'var(--leaf-ink)' }}>{tp('save2mo')}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="price-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 26, marginTop: 56, alignItems: 'start', maxWidth: 820, marginLeft: 'auto', marginRight: 'auto' }}>
          {tiers.map((t, i) => {
            const shown = period === 'yearly' ? t.yearly : t.monthly;
            const inner = (
              <div style={{ position: 'relative', background: t.pop ? 'var(--forest)' : 'var(--card)', color: t.pop ? 'var(--cream)' : 'var(--ink)', borderRadius: 'var(--r)', padding: '34px 32px', border: t.pop ? 'none' : '1px solid var(--line)', boxShadow: t.pop ? '0 40px 80px -40px rgba(7,33,23,.7)' : '0 20px 44px -30px rgba(16,19,11,.2)' }}>
                {t.pop && <span className="stk-card stk-leaf" style={{ position: 'absolute', top: -16, right: 22, rotate: '3deg', fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', padding: '8px 13px', zIndex: 3 }}>{tp('popular')}</span>}
                <h3 className="t-oaksx" style={{ fontSize: 24, margin: 0 }}>{t.name}</h3>
                <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13, color: t.pop ? 'var(--cream-3)' : 'var(--ink-3)', marginTop: 6 }}>{t.tag}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '22px 0 2px' }}>
                  <span style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 58, letterSpacing: '-.04em', lineHeight: 1 }}>{shown}€</span>
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: t.pop ? 'var(--cream-2)' : 'var(--ink-3)' }}>{tp('perMonth')}</span>
                </div>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: t.pop ? 'var(--cream-3)' : 'var(--ink-3)', marginBottom: 18, minHeight: 16 }}>
                  {period === 'yearly' ? tp('billedYear', { total: t.yearly * 12 }) : tp('billedMonth')}
                </div>
                <div className="chip" style={{ marginBottom: 24, background: t.pop ? 'var(--forest-2)' : 'var(--paper-3)', color: t.pop ? 'var(--cream-2)' : 'var(--ink-2)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>{t.clients}</div>
                <button onClick={() => onChoose(t.plan)} disabled={busy !== null} className={`btn ${t.pop ? 'btn-leaf' : 'btn-ghost'}`} style={{ width: '100%', justifyContent: 'center', marginBottom: 26 }}>
                  {busy === t.plan ? tp('redirecting') : tp('ctaTrial')}
                </button>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, padding: 0, margin: 0 }}>
                  {t.feats.map((f, j) => {
                    const head = j === 0 && f.endsWith(':');
                    return (
                      <li key={j} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 15, color: t.pop ? 'var(--cream-2)' : 'var(--ink-2)', fontWeight: head ? 700 : 400 }}>
                        {!head && <Icon name="check" size={17} style={{ flex: 'none', marginTop: 2, color: t.pop ? 'var(--leaf)' : 'var(--mint-2)' }} />}
                        <span>{f}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
            return t.pop ? (
              <div key={i} className="rv d2" style={{ transform: 'translateY(-14px)' }}>
                <Sel rot={0.8} showRot={false} className="in" style={{ display: 'block' }}>{inner}</Sel>
              </div>
            ) : (
              <div key={i} className="rv d1">{inner}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ────────────────────────────────────────────────────────────────── */
function FAQ() {
  const t = useTranslations('landing.faq');
  const items = [
    { q: t('q1'), a: t('a1') },
    { q: t('q2'), a: t('a2') },
    { q: t('q3'), a: t('a3') },
    { q: t('q4'), a: t('a4') },
    { q: t('q5'), a: t('a5') },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="section">
      <div className="wrap">
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: 56, alignItems: 'start' }}>
          <div>
            <h2 className="rv d1 t-arch split-lines" style={{ fontSize: 'clamp(36px, 4.8vw, 64px)' }}>
              {t('title1')}<span className="acc-hl">{t('titleAccent')}</span>
            </h2>
            <p className="lead rv d2 split-lines" style={{ marginTop: 22 }}>{t('another')} <a href="mailto:getklipsaas@gmail.com" style={{ color: 'var(--ink)', textDecoration: 'underline', textDecorationColor: 'var(--mint-2)', textUnderlineOffset: 3 }}>{t('writeUs')}</a></p>
            <span className="drag" data-stk style={{ marginTop: 32 }}><Stk name="heart" size={64} className="floatB" style={{ ['--r' as string]: '-7deg' }} /></span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((it, i) => {
              const isOpen = open === i;
              return (
                <div key={i} className="rv" style={{ borderTop: '1px solid var(--line)', borderBottom: i === items.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <button onClick={() => setOpen(isOpen ? -1 : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '24px 2px', textAlign: 'left' }}>
                    <span style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 19, letterSpacing: '-.015em' }}>{it.q}</span>
                    <span style={{ flex: 'none', width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: '50%', background: isOpen ? 'var(--leaf)' : 'var(--paper-3)', color: isOpen ? 'var(--leaf-ink)' : 'var(--ink)', transition: 'transform .3s, background .2s', transform: isOpen ? 'rotate(45deg)' : 'none' }}>
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

/* ─── AskAI ──────────────────────────────────────────────────────────────── */
const ASK_AI_PROMPT =
  "Explique-moi ce qu'est Klip (getklip.fr), l'outil pour les agences et community managers qui gèrent plusieurs comptes Instagram clients, et pourquoi ça peut remplacer Canva + ChatGPT + Metricool + Notion pour la production de contenu.";

const ASK_AI_PROVIDERS = [
  { name: 'ChatGPT', domain: 'chatgpt.com', color: '10A37F', href: `https://chatgpt.com/?q=${encodeURIComponent(ASK_AI_PROMPT)}` },
  { name: 'Claude', domain: 'claude.ai', color: 'D97757', href: `https://claude.ai/new?q=${encodeURIComponent(ASK_AI_PROMPT)}` },
  { name: 'Perplexity', domain: 'perplexity.ai', color: '20808D', href: `https://www.perplexity.ai/search?q=${encodeURIComponent(ASK_AI_PROMPT)}` },
];

function AskAI() {
  const t = useTranslations('landing.askAI');
  return (
    <section id="ask-ai" className="section" style={{ overflow: 'hidden', paddingTop: 0 }}>
      <div className="wrap" style={{ maxWidth: 680, textAlign: 'center', marginLeft: 'auto', marginRight: 'auto', position: 'relative', zIndex: 2 }}>
        <h2 className="rv d1 t-arch split-lines" style={{ fontSize: 'clamp(32px, 4.6vw, 56px)' }}>
          {t('title1')}<span className="acc-hl">{t('titleAccent')}</span>{t('title2')}
        </h2>
        <p className="lead rv d2 split-lines" style={{ marginTop: 18 }}>{t('lead')}</p>
        <div className="rv d3 ask-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 34 }}>
          {ASK_AI_PROVIDERS.map((p, i) => (
            <a key={p.name} href={p.href} target="_blank" rel="noopener noreferrer" className="stk-card" style={{ justifyContent: 'center', padding: '15px 16px', rotate: `${(i - 1) * 1.2}deg`, transition: 'transform .2s, box-shadow .2s', fontSize: 14 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px) rotate(0deg)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}>
              <span className="lp-logo" style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(150deg, #ffffff 0%, #${p.color}33 55%, #${p.color}66 100%)` }}>
                <ToolLogo domain={p.domain} color={p.color} name={p.name} size={24} />
              </span>
              <span>{t('ask', { name: p.name })}</span>
            </a>
          ))}
        </div>
      </div>
      <style>{`@media (max-width:620px){ .v3 .ask-grid { grid-template-columns:1fr !important; max-width:340px; margin-left:auto; margin-right:auto; } }`}</style>
    </section>
  );
}

/* ─── FinalCTA ───────────────────────────────────────────────────────────── */
function FinalCTA() {
  const t = useTranslations('landing.finalCta');
  return (
    <section className="section on-forest" style={{ overflow: 'hidden', textAlign: 'center' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div className="rv" style={{ position: 'relative', display: 'inline-block', maxWidth: 1000 }}>
          <span className="drag cta-stk" data-stk style={{ position: 'absolute', top: -40, left: -30, zIndex: 3 }}><Stk name="sparkle" size={54} className="spin" /></span>
          <span className="drag cta-stk" data-stk style={{ position: 'absolute', bottom: -20, right: -52, zIndex: 3 }}><Stk name="eyes" size={84} className="floatB" style={{ ['--r' as string]: '0deg' }} /></span>
          <span className="drag cta-stk" data-stk style={{ position: 'absolute', bottom: -34, left: -46, zIndex: 3 }}><Stk name="heart" size={60} className="floatA" style={{ ['--r' as string]: '8deg' }} /></span>
          <h2 style={{ margin: '0 auto' }}>
            <span className="t-arch fcta-t" style={{ fontSize: 'clamp(44px, 7vw, 100px)', color: 'var(--cream)', display: 'block' }}>{t('title1').replace(/,\s*$/, ',')}</span>
            <span className="acc-hl fcta-t" style={{ fontSize: 'clamp(44px, 7vw, 100px)', display: 'inline-block', marginTop: '.08em', lineHeight: 1.02 }}>{t('titleAccent')}</span>
          </h2>
        </div>
        <p className="lead rv d2 split-lines" style={{ maxWidth: 560, margin: '26px auto 0', fontSize: 20 }}>{t('lead')}</p>
        <div className="rv d3 final-cta" style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 40, flexWrap: 'wrap' }}>
          <Link href="/register" className="btn btn-leaf">{t('ctaStart')} <span className="arr"><Icon name="arrowUR" size={18} /></span></Link>
          <a href="#apercu" className="btn btn-ghost">{t('ctaSee')}</a>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */
function Footer() {
  const t = useTranslations('landing.footer');
  const cols: [string, [string, string][]][] = [
    [t('product'), [[t('visualEditor'), '#features'], [t('calendar'), '#apercu'], [t('pricing'), '#tarifs'], [t('faq'), '#faq']]],
    [t('resources'), [[t('blog'), '/blog'], [t('how'), '#how'], [t('problem'), '#probleme'], [t('login'), '/login'], [t('register'), '/register']]],
    [t('legal'), [[t('legalNotice'), '/mentions-legales'], [t('terms'), '/conditions'], [t('privacy'), '/privacy'], [t('cookies'), '/cookies']]],
  ];
  return (
    <footer className="on-forest" style={{ paddingTop: 72, paddingBottom: 40, borderTop: '1px solid var(--line-f)' }}>
      <div className="wrap">
        <div className="foot-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 40 }}>
          <div>
            <KlipLogo size={30} light />
            <p className="split-lines" style={{ color: 'var(--cream-2)', fontSize: 15, lineHeight: 1.6, marginTop: 18, maxWidth: 280 }}>{t('tagline')}</p>
          </div>
          {cols.map(([h, links], i) => (
            <div key={i}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cream-3)', marginBottom: 16 }}>{h}</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11, padding: 0, margin: 0 }}>
                {links.map(([label, href], j) => <li key={j}><a href={href} style={{ color: 'var(--cream-2)', fontSize: 15 }}>{label}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 56, paddingTop: 26, borderTop: '1px solid var(--line-f)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13, color: 'var(--cream-3)' }}>
          <span>{t('copyright')}</span>
          <span>{t('madeFor')}</span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function LandingV3() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) router.push('/dashboard'); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* marqueur landing sur <html> : permet de neutraliser les règles html/body de
     globals.css (height:100% + overflow-x:hidden mobile) sans toucher à l'app */
  useEffect(() => {
    document.documentElement.classList.add('v3-page');
    return () => document.documentElement.classList.remove('v3-page');
  }, []);

  /* reveals IO (fallback simple, hors GSAP) */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.v3 .rv:not(.in), .v3 .rv-slap:not(.in), .v3 .rv-pop:not(.in)'));
    if (!('IntersectionObserver' in window) || els.length === 0) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  });

  /* GSAP — creative coding : l'utilisateur agit sur la page
     (inspiré des patterns de demos.gsap.com/explore) */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.v3 .sel').forEach(s => s.classList.add('in'));
      return;
    }
    gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin, SplitText);
    let splitInstances: SplitText[] = [];
    let splitCancelled = false;
    const ctx = gsap.context(() => {

      /* 1 — intro hero : lignes du titre + sticker OUTIL qui se pose.
         Ne joue que quand l'onglet est visible, sinon le ticker rAF est gelé
         et le hero resterait bloqué à opacity 0. */
      const playIntro = () => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from('.v3 .hero-h1 .h-line', { y: 64, opacity: 0, rotate: 1.5, stagger: 0.14, duration: 0.9 })
          .from('.v3 .h-outil-rot', { scale: 1.7, opacity: 0, ease: 'back.out(1.8)', duration: 0.55 }, '-=0.45')
          .from('.v3 .h-intro', { y: 26, opacity: 0, stagger: 0.09, duration: 0.7 }, '-=0.25')
          .call(() => { document.querySelectorAll('.v3 .sel').forEach(s => s.classList.add('in')); });
      };
      if (document.visibilityState === 'visible') playIntro();
      else {
        const onVis = () => { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', onVis); playIntro(); } };
        document.addEventListener('visibilitychange', onVis);
      }

      /* 2 — curseur "Vous" : suit la vraie souris dans le hero */
      const hero = document.querySelector<HTMLElement>('.v3 [data-hero]');
      const curEl = document.getElementById('hero-cursor');
      if (hero && curEl && window.matchMedia('(pointer: fine)').matches) {
        gsap.set(curEl, { top: 0, left: 0, right: 'auto' });
        const xTo = gsap.quickTo(curEl, 'x', { duration: 0.55, ease: 'power3' });
        const yTo = gsap.quickTo(curEl, 'y', { duration: 0.55, ease: 'power3' });
        const move = (e: MouseEvent) => {
          const parent = (curEl.offsetParent as HTMLElement) || hero;
          const r = parent.getBoundingClientRect();
          xTo(e.clientX - r.left + 22); yTo(e.clientY - r.top + 26);
        };
        hero.addEventListener('mousemove', move);
        hero.addEventListener('mouseenter', () => gsap.to(curEl, { opacity: 1, duration: 0.25 }));
        hero.addEventListener('mouseleave', () => gsap.to(curEl, { opacity: 0, duration: 0.25 }));
      }

      /* 3 — stickers draggables (avec inertie) : la page est un plan de travail */
      document.querySelectorAll<HTMLElement>('.v3 .drag').forEach(el => {
        Draggable.create(el, {
          type: 'x,y', inertia: true, edgeResistance: 0.75,
          bounds: el.closest('section, footer') || undefined,
          zIndexBoost: false,
          onPress() { gsap.to(el, { scale: 1.07, duration: 0.18 }); },
          onRelease() { gsap.to(el, { scale: 1, duration: 0.3, ease: 'back.out(2)' }); },
        });
      });

      /* 4 — marquee : défile seul, accélère avec la vitesse de scroll */
      const mqTween = gsap.to('.v3 .mqband .mq-in', { xPercent: -100, repeat: -1, duration: 26, ease: 'none' });
      ScrollTrigger.create({
        onUpdate(self) {
          const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 700, 3.5);
          gsap.to(mqTween, { timeScale: self.direction * boost, duration: 0.2, overwrite: true });
          gsap.to(mqTween, { timeScale: 1, duration: 1.1, delay: 0.25, overwrite: false });
        },
      });

      /* 5b — deck produit : chaque carte rétrécit et s'assombrit un peu quand la
         SUIVANTE monte par-dessus, pour donner de la profondeur à la pile. Les cartes
         partagent .deck comme bloc conteneur (sticky) donc elles restent empilées ;
         ce scrub ne fait qu'ajouter le recul visuel de la carte du dessous. */
      /* actif sur toutes les largeurs : la pile sticky est aussi conservée sur mobile */
      {
        const deckCards = gsap.utils.toArray<HTMLElement>('.v3 [data-deck-card]');
        deckCards.forEach((card, i) => {
          const next = deckCards[i + 1];
          if (!next) return;
          gsap.to(card, {
            scale: 0.95,
            ease: 'none',
            scrollTrigger: {
              trigger: next,
              start: 'top 92%',
              end: 'top 34%',
              scrub: true,
            },
          });
        });
      }

      /* 5 — boutons magnétiques */
      if (window.matchMedia('(pointer: fine)').matches) {
        document.querySelectorAll<HTMLElement>('.v3 .btn').forEach(btn => {
          const xTo = gsap.quickTo(btn, 'x', { duration: 0.35, ease: 'power3' });
          const yTo = gsap.quickTo(btn, 'y', { duration: 0.35, ease: 'power3' });
          btn.addEventListener('mousemove', (e) => {
            const r = btn.getBoundingClientRect();
            xTo(gsap.utils.clamp(-8, 8, (e.clientX - (r.left + r.width / 2)) * 0.22));
            yTo(gsap.utils.clamp(-6, 6, (e.clientY - (r.top + r.height / 2)) * 0.3));
          });
          btn.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
        });
      }

      /* 6 — paragraphes & petits textes : lignes qui se révèlent au scroll
         (SplitText + ScrollTrigger scrub, cf. demos.gsap.com/demo/responsive-line-splits-on-scroll).
         On attend document.fonts.ready avant de splitter : sinon les lignes sont mesurées sur la
         police de repli, puis le swap de police (Oaks/Archivo via Typekit) décale le layout SANS
         que ScrollTrigger ne recalcule ses positions de scroll (pas un resize de window).
         DÉSACTIVÉ ≤780px : sous le breakpoint 760 (font-size/!important sur .lead), le cycle
         autoSplit ↔ refresh de ScrollTrigger entre en récursion infinie (refresh → revert du
         split → resplit → nouveau trigger → refresh…) et GÈLE totalement le main thread —
         vérifié au débogueur CDP. Sur mobile, les textes restent simplement visibles. */
      document.fonts.ready.then(() => {
        if (splitCancelled) return;
        if (!window.matchMedia('(min-width: 781px)').matches) return;
        gsap.utils.toArray<HTMLElement>('.v3 .split-lines').forEach(el => {
          const revealOnLoad = el.hasAttribute('data-reveal-load');
          const st = SplitText.create(el, {
            type: 'lines',
            mask: 'lines',
            linesClass: 'sl-line',
            autoSplit: true,
            onSplit(self) {
              // Contenu déjà visible au chargement (hero) : un scroll-trigger n'a rien à scruter
              // (start/end se replient tous les deux sur 0 via clamp() et le tween reste bloqué à
              // l'état masqué). On le joue simplement au chargement, comme le reste du hero.
              if (revealOnLoad) {
                return gsap.from(self.lines, { yPercent: 120, stagger: 0.1, ease: 'power3.out', delay: 0.9 });
              }
              return gsap.from(self.lines, {
                yPercent: 120,
                stagger: 0.1,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: el,
                  scrub: true,
                  start: 'clamp(top 90%)',
                  end: 'clamp(top 50%)',
                },
              });
            },
          });
          splitInstances.push(st);
        });
        ScrollTrigger.refresh();
      });
    });
    return () => {
      splitCancelled = true;
      splitInstances.forEach(st => st.revert());
      ctx.revert();
    };
  }, []);

  return (
    <div className="v3">
      <style dangerouslySetInnerHTML={{ __html: V3_CSS }} />
      <Nav />
      <Hero />
      <MarqueeBand />
      <Comparison />
      <HeroPreview />
      <Probleme />
      <Steps />
      <DeckShowcase />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <AskAI />
      <FinalCTA />
      <Footer />
    </div>
  );
}
