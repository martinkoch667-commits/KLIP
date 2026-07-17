'use client';
import React from 'react';

// ─── Bibliothèque de combinaisons de texte (façon Canva) ──────────────────────
// Chaque template est AUTHORÉ pour un plan de travail de référence de 1080 px de
// large. À l'insertion (applyTextTemplate dans page.tsx), toutes les valeurs
// numériques sont multipliées par (stageW / TT_REF_W) pour s'adapter au format
// réel du document (portrait 864, carré 1080, story 608…). Les couleurs sont
// libres (dans et hors DA KLIP) — ce sont des couleurs de CONTENU (canvas), pas
// d'UI, donc la règle "pas de couleurs en dur" ne s'applique pas ici.

export const TT_REF_W = 1080;

// Sous-ensemble (optionnel) des champs stylistiques de TextEl, structurellement
// compatible avec Partial<TextEl> côté page.tsx.
export interface TTPatch {
  fontFamily?: string; fontStyle?: string; fontSize?: number; fill?: string;
  fillType?: 'color' | 'gradient'; fillTo?: string; fillAngle?: number;
  uppercase?: boolean; lineHeight?: number; letterSpacing?: number; align?: string; width?: number;
  hasBg?: boolean; bgColor?: string; bgOpacity?: number; cornerRadius?: number; paddingH?: number; paddingV?: number;
  stroke?: string; strokeWidth?: number; rotation?: number;
  highlightEnabled?: boolean; highlightColor?: string; highlightOpacity?: number; highlightBorderRadius?: number; highlightPadding?: number;
  glowEnabled?: boolean; glowColor?: string; glowIntensity?: number; glowSize?: number;
  liftEnabled?: boolean; liftColor?: string; liftDepth?: number; liftDirection?: string;
  echoEnabled?: boolean; echoColor?: string; echoCount?: number; echoOffset?: number; echoFade?: boolean;
  shadowEnabled?: boolean; shadowColor?: string; shadowOffsetX?: number; shadowOffsetY?: number; shadowBlur?: number; shadowOpacity?: number;
}
export interface TTPart { text: string; patch?: TTPatch; dx?: number; dy: number; }
export interface TextTemplate { id: string; cat: string; dark?: boolean; parts: TTPart[]; }

export const TT_CATS = ['Promo', 'Événement', 'Titre', 'Citation', 'Fun', 'Rétro', 'Élégant', 'Néon', 'Minimal', 'Gras'] as const;

// ── Adaptation d'un template à la charte du client ───────────────────────────
// Recolore chaque partie sur la palette de marque (texte → primaire, emphase/
// surlignage/fond → accent) et applique la police de marque, sans toucher à la
// structure/mise en page du template. Les champs absents dans la charte sont
// laissés tels quels. Utilisé par le bouton « À ma charte » du panneau Texte.
export interface BrandKit { primary?: string | null; secondary?: string | null; accent?: string | null; font?: string | null; }
export function adaptTemplateToCharter(tpl: TextTemplate, brand: BrandKit): TextTemplate {
  const P = brand.primary || undefined;
  const A = brand.accent || undefined;
  const F = brand.font || undefined;
  const recolor = (patch?: TTPatch): TTPatch | undefined => {
    if (!patch) return F ? { fontFamily: F } : patch;
    const q: TTPatch = { ...patch };
    if (F) q.fontFamily = F;
    if (P && q.fill && q.fill !== 'transparent') q.fill = P;
    if (q.fillType === 'gradient') { if (P) q.fill = P; if (A) q.fillTo = A; }
    if (A && q.highlightEnabled && q.highlightColor) q.highlightColor = A;
    if (A && q.hasBg && q.bgColor) q.bgColor = A;
    if (P && q.stroke) q.stroke = P;
    if (A && q.glowColor) q.glowColor = A;
    if (A && q.echoColor) q.echoColor = A;
    if (P && q.liftColor) q.liftColor = P;
    return q;
  };
  return { ...tpl, parts: tpl.parts.map(pt => ({ ...pt, patch: recolor(pt.patch) })) };
}

// ── Style CSS approximatif d'un patch pour l'aperçu (miniature) ──────────────
export function ttPreviewStyle(p: TTPatch = {}, k: number): React.CSSProperties {
  const st = (p.fontStyle || '');
  const s: React.CSSProperties = {
    fontFamily: p.fontFamily || 'Archivo Black',
    fontSize: Math.max(5, (p.fontSize ?? 44) * k),
    lineHeight: p.lineHeight ?? 1,
    letterSpacing: (p.letterSpacing ?? 0) * k,
    color: p.fill || '#14160F',
    fontStyle: st.includes('italic') ? 'italic' : 'normal',
    fontWeight: st.includes('bold') ? 800 : 400,
    textTransform: p.uppercase ? 'uppercase' : 'none',
    whiteSpace: 'pre-line',
    display: 'inline-block',
    textAlign: 'center',
    maxWidth: '100%',
  };
  if (p.fillType === 'gradient' && p.fill && p.fillTo) {
    s.backgroundImage = `linear-gradient(${p.fillAngle ?? 90}deg, ${p.fill}, ${p.fillTo})`;
    (s as Record<string, unknown>).WebkitBackgroundClip = 'text';
    s.backgroundClip = 'text';
    s.color = 'transparent';
  }
  if (p.hasBg && p.bgColor) {
    s.background = p.bgColor;
    s.padding = `${(p.paddingV ?? 14) * k}px ${(p.paddingH ?? 22) * k}px`;
    s.borderRadius = (p.cornerRadius ?? 8) * k;
  }
  if (p.highlightEnabled && p.highlightColor) {
    s.background = p.highlightColor;
    s.padding = `${(p.highlightPadding ?? 8) * 0.55 * k}px ${(p.highlightPadding ?? 8) * k}px`;
    s.borderRadius = (p.highlightBorderRadius ?? 4) * k;
  }
  if (p.stroke && ((p.strokeWidth ?? 0) > 0 || p.fill === 'transparent')) {
    (s as Record<string, unknown>).WebkitTextStroke = `${Math.max(0.5, (p.strokeWidth ?? 2) * k)}px ${p.stroke}`;
    if (p.fill === 'transparent') s.color = 'transparent';
  }
  if (p.rotation) s.transform = `rotate(${p.rotation}deg)`;
  // Ombres (glow / lift / echo / shadow) — ignorées si texte en dégradé (clip).
  if (p.fillType !== 'gradient') {
    const sh: string[] = [];
    if (p.glowEnabled && p.glowColor) sh.push(`0 0 ${(p.glowSize ?? 12) * k}px ${p.glowColor}`);
    if (p.liftEnabled) { const d = (p.liftDepth ?? 6) * k; sh.push(`${d}px ${d}px 0 ${p.liftColor || '#0C2A1D'}`); }
    if (p.echoEnabled) { const o = (p.echoOffset ?? 8) * k, c = p.echoColor || '#0C2A1D'; for (let i = 1; i <= (p.echoCount ?? 3); i++) sh.push(`${o * i}px ${o * i}px 0 ${c}`); }
    if (p.shadowEnabled) sh.push(`${(p.shadowOffsetX ?? 4) * k}px ${(p.shadowOffsetY ?? 4) * k}px ${(p.shadowBlur ?? 0) * k}px ${p.shadowColor || 'rgba(0,0,0,.4)'}`);
    if (sh.length) s.textShadow = sh.join(', ');
  }
  return s;
}

// ── Miniature d'un template (empile les parties, centré) ─────────────────────
export function TextTemplateThumb({ tpl, w }: { tpl: TextTemplate; w: number }) {
  const k = w / TT_REF_W;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: Math.max(2, 6 * k), width: '100%', overflow: 'hidden', lineHeight: 1 }}>
      {tpl.parts.map((part, i) => (
        <span key={i} style={ttPreviewStyle(part.patch, k)}>{part.text}</span>
      ))}
    </div>
  );
}

// Raccourcis couleurs (contenu canvas — libre, dans & hors DA KLIP)
const INK = '#14160F', FOREST = '#0C2A1D', MINT = '#2FD79B', MINT2 = '#21B381', ACID = '#C8F135', WHITE = '#FFFFFF', CREAM = '#F4EDE4';
const RED = '#FF3B3B', CORAL = '#FF5A3C', ORANGE = '#FF7A00', YELLOW = '#FFD400', LEMON = '#FEE440';
const BLUE = '#0038FF', SKY = '#00BBF9', CYAN = '#12E1D4', PURPLE = '#9B5DE5', PINK = '#F15BB5', GOLD = '#C9A227', BROWN = '#8B5E3C';

export const TEXT_TEMPLATES: TextTemplate[] = [
  // ─────────── PROMO ───────────
  { id: 'promo-70', cat: 'Promo', parts: [
    { text: "JUSQU'À", dy: 0, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 34, fill: '#5A5E50', uppercase: true, letterSpacing: 10, width: 620 } },
    { text: '-70%', dy: 46, patch: { fontFamily: 'Archivo Black', fontSize: 300, fillType: 'gradient', fill: MINT, fillTo: FOREST, fillAngle: 120, letterSpacing: -10, lineHeight: 0.9, width: 980 } },
    { text: 'SUR TOUTE LA BOUTIQUE', dy: 360, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 30, fill: INK, uppercase: true, letterSpacing: 4, width: 820 } },
  ] },
  { id: 'promo-soldes-red', cat: 'Promo', parts: [
    { text: 'SOLDES', dy: 0, patch: { fontFamily: 'Anton', fontSize: 230, fill: RED, uppercase: true, letterSpacing: -4, lineHeight: 0.86, width: 980 } },
    { text: "JUSQU'À -50%", dy: 220, patch: { fontFamily: 'Anton', fontSize: 66, fill: INK, uppercase: true, letterSpacing: 2, width: 820 } },
  ] },
  { id: 'promo-blackfriday', cat: 'Promo', dark: true, parts: [
    { text: 'BLACK', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 200, fill: WHITE, uppercase: true, letterSpacing: -6, lineHeight: 0.82, width: 980 } },
    { text: 'FRIDAY', dy: 176, patch: { fontFamily: 'Archivo Black', fontSize: 200, fill: YELLOW, uppercase: true, letterSpacing: -6, lineHeight: 0.82, width: 980 } },
  ] },
  { id: 'promo-flash', cat: 'Promo', parts: [
    { text: 'VENTE', dy: 0, patch: { fontFamily: 'Bebas Neue', fontSize: 240, fill: INK, uppercase: true, letterSpacing: 2, lineHeight: 0.8, width: 980 } },
    { text: 'FLASH', dy: 176, patch: { fontFamily: 'Bebas Neue', fontSize: 130, fill: INK, uppercase: true, letterSpacing: 2, highlightEnabled: true, highlightColor: LEMON, highlightBorderRadius: 6, highlightPadding: 24, width: 700 } },
  ] },
  { id: 'promo-2for1', cat: 'Promo', parts: [
    { text: '2 POUR 1', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 190, fill: CORAL, uppercase: true, letterSpacing: -4, liftEnabled: true, liftColor: INK, liftDepth: 12, lineHeight: 0.9, width: 980 } },
    { text: 'offre limitée', dy: 210, patch: { fontFamily: 'DM Sans', fontStyle: 'bold', fontSize: 44, fill: INK, width: 700 } },
  ] },
  { id: 'promo-code', cat: 'Promo', parts: [
    { text: 'CODE PROMO', dy: 0, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 34, fill: '#5A5E50', uppercase: true, letterSpacing: 8, width: 620 } },
    { text: 'WELCOME10', dy: 52, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 110, fill: WHITE, hasBg: true, bgColor: BLUE, cornerRadius: 16, paddingH: 40, paddingV: 22, letterSpacing: 2, width: 820 } },
  ] },
  { id: 'promo-new-acid', cat: 'Promo', parts: [
    { text: 'Nouveau', dy: 0, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 130, fill: INK, highlightEnabled: true, highlightColor: ACID, highlightBorderRadius: 8, highlightPadding: 26, width: 760 } },
  ] },
  { id: 'promo-lastchance', cat: 'Promo', dark: true, parts: [
    { text: 'DERNIÈRE', dy: 0, patch: { fontFamily: 'Oswald', fontStyle: 'bold', fontSize: 96, fill: WHITE, uppercase: true, letterSpacing: 4, lineHeight: 0.95, width: 900 } },
    { text: 'CHANCE', dy: 96, patch: { fontFamily: 'Anton', fontSize: 210, fill: RED, uppercase: true, letterSpacing: -2, lineHeight: 0.9, width: 980 } },
  ] },

  // ─────────── ÉVÉNEMENT ───────────
  { id: 'event-open', cat: 'Événement', parts: [
    { text: 'GRANDE', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 150, fill: FOREST, uppercase: true, letterSpacing: -4, lineHeight: 0.86, width: 900 } },
    { text: 'OUVERTURE', dy: 128, dx: 40, patch: { fontFamily: 'Archivo Black', fontSize: 52, fill: FOREST, uppercase: true, letterSpacing: 1, highlightEnabled: true, highlightColor: ACID, highlightBorderRadius: 4, highlightPadding: 16, width: 640 } },
    { text: 'CE SAMEDI', dy: 220, dx: -30, patch: { fontFamily: 'Archivo Black', fontSize: 40, fill: FOREST, uppercase: true, highlightEnabled: true, highlightColor: ACID, highlightBorderRadius: 4, highlightPadding: 14, width: 520 } },
  ] },
  { id: 'event-party', cat: 'Événement', parts: [
    { text: 'PARTY', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 220, fill: PURPLE, uppercase: true, letterSpacing: -6, liftEnabled: true, liftColor: INK, liftDepth: 14, lineHeight: 0.82, width: 980 } },
    { text: 'TIME', dy: 200, patch: { fontFamily: 'Archivo Black', fontSize: 220, fill: PINK, uppercase: true, letterSpacing: -6, liftEnabled: true, liftColor: INK, liftDepth: 14, lineHeight: 0.82, width: 980 } },
  ] },
  { id: 'event-live', cat: 'Événement', dark: true, parts: [
    { text: 'EN DIRECT', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 90, fill: WHITE, uppercase: true, hasBg: true, bgColor: RED, cornerRadius: 14, paddingH: 34, paddingV: 18, letterSpacing: 2, width: 760 } },
    { text: 'ce soir · 20h', dy: 140, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 46, fill: WHITE, width: 700 } },
  ] },
  { id: 'event-savedate', cat: 'Événement', parts: [
    { text: 'SAVE THE DATE', dy: 0, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 96, fill: INK, letterSpacing: 2, width: 900 } },
    { text: '·  12 . 09 . 2026  ·', dy: 120, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 40, fill: GOLD, uppercase: true, letterSpacing: 6, width: 760 } },
  ] },
  { id: 'event-summerfest', cat: 'Événement', parts: [
    { text: 'SUMMER', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 190, fillType: 'gradient', fill: ORANGE, fillTo: PINK, fillAngle: 120, uppercase: true, letterSpacing: -5, lineHeight: 0.84, width: 980 } },
    { text: 'FEST', dy: 170, patch: { fontFamily: 'Archivo Black', fontSize: 190, fillType: 'gradient', fill: PINK, fillTo: PURPLE, fillAngle: 120, uppercase: true, letterSpacing: -5, lineHeight: 0.84, width: 980 } },
  ] },
  { id: 'event-concert-neon', cat: 'Événement', dark: true, parts: [
    { text: 'LIVE', dy: 0, patch: { fontFamily: 'Anton', fontSize: 300, fill: CYAN, uppercase: true, glowEnabled: true, glowColor: CYAN, glowIntensity: 90, glowSize: 40, letterSpacing: 2, lineHeight: 0.9, width: 980 } },
    { text: 'IN CONCERT', dy: 300, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 44, fill: WHITE, uppercase: true, letterSpacing: 10, width: 820 } },
  ] },
  { id: 'event-countdown', cat: 'Événement', parts: [
    { text: 'J-3', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 340, fill: INK, letterSpacing: -8, lineHeight: 0.9, width: 980 } },
    { text: "avant l'ouverture", dy: 300, patch: { fontFamily: 'DM Sans', fontStyle: 'bold', fontSize: 48, fill: MINT2, width: 760 } },
  ] },

  // ─────────── TITRE ───────────
  { id: 'title-hero', cat: 'Titre', parts: [
    { text: 'TITLE', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 260, fill: INK, uppercase: true, letterSpacing: -8, lineHeight: 0.82, width: 980 } },
    { text: 'SUBTITLE', dy: 150, dx: 30, patch: { fontFamily: 'Archivo Black', fontSize: 56, fill: INK, uppercase: true, highlightEnabled: true, highlightColor: ACID, highlightBorderRadius: 4, highlightPadding: 16, width: 640 } },
    { text: 'AND TAGLINE', dy: 250, dx: -20, patch: { fontFamily: 'Archivo Black', fontSize: 44, fill: INK, uppercase: true, highlightEnabled: true, highlightColor: ACID, highlightBorderRadius: 4, highlightPadding: 14, width: 560 } },
  ] },
  { id: 'title-vogue', cat: 'Titre', parts: [
    { text: 'ÉDITORIAL', dy: 0, patch: { fontFamily: 'Playfair Display', fontSize: 150, fill: INK, uppercase: true, letterSpacing: 14, width: 980 } },
    { text: 'THE MODERN ISSUE', dy: 170, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 34, fill: '#5A5E50', uppercase: true, letterSpacing: 10, width: 820 } },
  ] },
  { id: 'title-boldbright', cat: 'Titre', parts: [
    { text: 'BOLD &', dy: 0, patch: { fontFamily: 'Anton', fontSize: 210, fill: INK, uppercase: true, letterSpacing: -2, lineHeight: 0.84, width: 980 } },
    { text: 'BRIGHT', dy: 180, patch: { fontFamily: 'Anton', fontSize: 210, fill: MINT, uppercase: true, letterSpacing: -2, lineHeight: 0.84, width: 980 } },
  ] },
  { id: 'title-memento', cat: 'Titre', parts: [
    { text: 'MEMENTO', dy: 0, patch: { fontFamily: 'Playfair Display', fontSize: 130, fill: INK, uppercase: true, letterSpacing: 16, width: 980 } },
    { text: 'DÉGUSTER · PARTAGER · SAVOURER', dy: 130, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 28, fill: MINT2, uppercase: true, letterSpacing: 5, width: 900 } },
  ] },
  { id: 'title-minimal', cat: 'Titre', parts: [
    { text: 'minimal.', dy: 0, patch: { fontFamily: 'DM Sans', fontStyle: 'bold', fontSize: 170, fill: INK, letterSpacing: -6, width: 900 } },
  ] },

  // ─────────── CITATION ───────────
  { id: 'quote-cafe', cat: 'Citation', parts: [
    { text: '« Le meilleur\ncafé de la ville »', dy: 0, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 82, fill: INK, lineHeight: 1.25, width: 860 } },
  ] },
  { id: 'quote-justdoit', cat: 'Citation', parts: [
    { text: 'Just do it.', dy: 0, patch: { fontFamily: 'Archivo Black', fontStyle: 'italic', fontSize: 150, fill: MINT, glowEnabled: true, glowColor: MINT, glowIntensity: 75, glowSize: 34, letterSpacing: -4, width: 900 } },
  ] },
  { id: 'quote-dreambig', cat: 'Citation', parts: [
    { text: 'Dream', dy: 0, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 150, fill: INK, lineHeight: 0.95, width: 900 } },
    { text: 'big.', dy: 140, dx: 60, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 200, fill: PURPLE, lineHeight: 0.95, width: 700 } },
  ] },
  { id: 'quote-stayhungry', cat: 'Citation', parts: [
    { text: 'STAY', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 200, fill: INK, uppercase: true, letterSpacing: -4, lineHeight: 0.82, width: 980 } },
    { text: 'HUNGRY', dy: 176, patch: { fontFamily: 'Archivo Black', fontSize: 200, fill: 'transparent', stroke: INK, strokeWidth: 5, uppercase: true, letterSpacing: -4, lineHeight: 0.82, width: 980 } },
  ] },
  { id: 'quote-love', cat: 'Citation', parts: [
    { text: 'made with', dy: 0, patch: { fontFamily: 'DM Sans', fontStyle: 'bold', fontSize: 60, fill: INK, width: 760 } },
    { text: 'passion', dy: 70, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 170, fill: PINK, width: 820 } },
  ] },

  // ─────────── FUN ───────────
  { id: 'fun-wow', cat: 'Fun', parts: [
    { text: 'WOW!', dy: 0, patch: { fontFamily: 'Archivo Black', fontStyle: 'italic', fontSize: 260, fillType: 'gradient', fill: YELLOW, fillTo: RED, fillAngle: 100, uppercase: true, letterSpacing: -6, width: 980 } },
  ] },
  { id: 'fun-omg', cat: 'Fun', parts: [
    { text: 'OMG', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 280, fill: PINK, stroke: INK, strokeWidth: 8, uppercase: true, letterSpacing: -4, width: 980 } },
  ] },
  { id: 'fun-fresh', cat: 'Fun', parts: [
    { text: 'Fresh', dy: 0, patch: { fontFamily: 'Archivo Black', fontStyle: 'italic', fontSize: 250, fill: ACID, stroke: FOREST, strokeWidth: 7, letterSpacing: -6, width: 900 } },
  ] },
  { id: 'fun-cool', cat: 'Fun', parts: [
    { text: 'COOL', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 250, fill: SKY, uppercase: true, echoEnabled: true, echoColor: BLUE, echoCount: 3, echoOffset: 16, letterSpacing: -4, width: 980 } },
  ] },
  { id: 'fun-yay', cat: 'Fun', parts: [
    { text: 'YAY!', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 260, fill: ACID, uppercase: true, liftEnabled: true, liftColor: INK, liftDepth: 16, letterSpacing: -4, width: 980 } },
  ] },
  { id: 'fun-hot', cat: 'Fun', dark: true, parts: [
    { text: 'HOT', dy: 0, patch: { fontFamily: 'Anton', fontSize: 300, fillType: 'gradient', fill: YELLOW, fillTo: RED, fillAngle: 90, uppercase: true, letterSpacing: 2, width: 980 } },
    { text: 'NEW DROP', dy: 290, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 44, fill: WHITE, uppercase: true, letterSpacing: 8, width: 820 } },
  ] },

  // ─────────── RÉTRO ───────────
  { id: 'retro-goodvibes', cat: 'Rétro', parts: [
    { text: 'GOOD', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 200, fill: ORANGE, uppercase: true, echoEnabled: true, echoColor: BROWN, echoCount: 2, echoOffset: 14, letterSpacing: -4, lineHeight: 0.86, width: 980 } },
    { text: 'VIBES', dy: 180, patch: { fontFamily: 'Archivo Black', fontSize: 200, fill: YELLOW, uppercase: true, echoEnabled: true, echoColor: BROWN, echoCount: 2, echoOffset: 14, letterSpacing: -4, lineHeight: 0.86, width: 980 } },
  ] },
  { id: 'retro-super', cat: 'Rétro', parts: [
    { text: 'SUPER', dy: 0, patch: { fontFamily: 'Anton', fontSize: 260, fill: CREAM, stroke: CORAL, strokeWidth: 6, uppercase: true, shadowEnabled: true, shadowColor: CORAL, shadowOffsetX: 12, shadowOffsetY: 12, letterSpacing: 2, width: 980 } },
  ] },
  { id: 'retro-bigsale', cat: 'Rétro', parts: [
    { text: 'BIG', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 240, fill: PURPLE, uppercase: true, letterSpacing: -6, lineHeight: 0.86, width: 980 } },
    { text: 'sale', dy: 130, dx: 40, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 170, fill: MINT2, width: 700 } },
  ] },
  { id: 'retro-sunset', cat: 'Rétro', parts: [
    { text: 'SUNSET', dy: 0, patch: { fontFamily: 'Anton', fontSize: 230, fillType: 'gradient', fill: YELLOW, fillTo: CORAL, fillAngle: 90, uppercase: true, letterSpacing: 2, width: 980 } },
    { text: 'CLUB', dy: 210, patch: { fontFamily: 'Anton', fontSize: 120, fill: PURPLE, uppercase: true, letterSpacing: 20, width: 900 } },
  ] },

  // ─────────── ÉLÉGANT ───────────
  { id: 'eleg-luxe', cat: 'Élégant', dark: true, parts: [
    { text: 'LUXE', dy: 0, patch: { fontFamily: 'Playfair Display', fontSize: 200, fill: GOLD, uppercase: true, letterSpacing: 24, width: 980 } },
    { text: 'COLLECTION PRIVÉE', dy: 210, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 30, fill: '#C9C4B2', uppercase: true, letterSpacing: 8, width: 820 } },
  ] },
  { id: 'eleg-studio', cat: 'Élégant', parts: [
    { text: 'STUDIO', dy: 0, patch: { fontFamily: 'Playfair Display', fontSize: 150, fill: INK, uppercase: true, letterSpacing: 8, lineHeight: 0.95, width: 900 } },
    { text: 'atelier créatif', dy: 150, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 66, fill: '#5A5E50', width: 760 } },
  ] },
  { id: 'eleg-noir', cat: 'Élégant', dark: true, parts: [
    { text: 'NOIR', dy: 0, patch: { fontFamily: 'Playfair Display', fontSize: 240, fill: WHITE, uppercase: true, letterSpacing: 10, width: 980 } },
    { text: 'PARFUM · 2026', dy: 240, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 32, fill: GOLD, uppercase: true, letterSpacing: 10, width: 820 } },
  ] },
  { id: 'eleg-menu', cat: 'Élégant', parts: [
    { text: 'MENU', dy: 0, patch: { fontFamily: 'Playfair Display', fontSize: 180, fill: INK, uppercase: true, letterSpacing: 20, width: 900 } },
    { text: 'à la carte', dy: 180, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 70, fill: BROWN, width: 700 } },
  ] },

  // ─────────── NÉON ───────────
  { id: 'neon-open', cat: 'Néon', dark: true, parts: [
    { text: 'OPEN', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 280, fill: CYAN, glowEnabled: true, glowColor: CYAN, glowIntensity: 90, glowSize: 40, uppercase: true, letterSpacing: -2, width: 980 } },
  ] },
  { id: 'neon-247', cat: 'Néon', dark: true, parts: [
    { text: '24/7', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 300, fill: PINK, glowEnabled: true, glowColor: PINK, glowIntensity: 90, glowSize: 42, letterSpacing: -4, width: 980 } },
  ] },
  { id: 'neon-night', cat: 'Néon', dark: true, parts: [
    { text: 'NIGHT', dy: 0, patch: { fontFamily: 'Anton', fontSize: 240, fill: PURPLE, glowEnabled: true, glowColor: PURPLE, glowIntensity: 90, glowSize: 40, uppercase: true, lineHeight: 0.9, width: 980 } },
    { text: 'MODE', dy: 230, patch: { fontFamily: 'Anton', fontSize: 240, fill: SKY, glowEnabled: true, glowColor: SKY, glowIntensity: 90, glowSize: 40, uppercase: true, lineHeight: 0.9, width: 980 } },
  ] },

  // ─────────── MINIMAL ───────────
  { id: 'min-shopnow', cat: 'Minimal', parts: [
    { text: 'shop now', dy: 0, patch: { fontFamily: 'DM Sans', fontStyle: 'bold', fontSize: 120, fill: INK, letterSpacing: -3, width: 900 } },
    { text: '——————', dy: 130, patch: { fontFamily: 'DM Sans', fontSize: 60, fill: MINT2, width: 700 } },
  ] },
  { id: 'min-readmore', cat: 'Minimal', parts: [
    { text: 'READ MORE →', dy: 0, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 80, fill: INK, uppercase: true, letterSpacing: 4, width: 900 } },
  ] },
  { id: 'min-trending', cat: 'Minimal', parts: [
    { text: '#trending', dy: 0, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 120, fill: BLUE, letterSpacing: -2, width: 900 } },
  ] },
  { id: 'min-swipe', cat: 'Minimal', parts: [
    { text: 'swipe', dy: 0, patch: { fontFamily: 'DM Sans', fontStyle: 'bold', fontSize: 130, fill: INK, letterSpacing: -4, lineHeight: 0.95, width: 820 } },
    { text: 'to see more', dy: 130, patch: { fontFamily: 'DM Sans', fontStyle: 'normal', fontSize: 56, fill: '#5A5E50', width: 760 } },
  ] },

  // ─────────── GRAS ───────────
  { id: 'bold-mega', cat: 'Gras', parts: [
    { text: 'MEGA', dy: 0, patch: { fontFamily: 'Anton', fontSize: 320, fill: INK, uppercase: true, letterSpacing: 2, lineHeight: 0.9, width: 980 } },
  ] },
  { id: 'bold-power', cat: 'Gras', parts: [
    { text: 'POWER', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 220, fillType: 'gradient', fill: SKY, fillTo: BLUE, fillAngle: 120, uppercase: true, letterSpacing: -6, lineHeight: 0.86, width: 980 } },
    { text: 'UP', dy: 200, patch: { fontFamily: 'Archivo Black', fontSize: 220, fill: INK, uppercase: true, liftEnabled: true, liftColor: SKY, liftDepth: 14, letterSpacing: -6, lineHeight: 0.86, width: 980 } },
  ] },
  { id: 'bold-impact', cat: 'Gras', parts: [
    { text: 'IMPACT', dy: 0, patch: { fontFamily: 'Anton', fontSize: 220, fill: RED, uppercase: true, echoEnabled: true, echoColor: INK, echoCount: 3, echoOffset: 16, letterSpacing: 2, width: 980 } },
  ] },
  { id: 'bold-mega-sale', cat: 'Gras', parts: [
    { text: 'MEGA', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 200, fill: INK, uppercase: true, lineHeight: 0.82, letterSpacing: -6, width: 980 } },
    { text: 'SALE', dy: 172, patch: { fontFamily: 'Archivo Black', fontSize: 200, fill: WHITE, hasBg: true, bgColor: RED, cornerRadius: 8, paddingH: 30, paddingV: 6, uppercase: true, letterSpacing: -4, width: 760 } },
  ] },

  // ─────────── DIVERS ───────────
  { id: 'x-merci', cat: 'Fun', parts: [
    { text: 'MERCI !', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 200, fill: INK, uppercase: true, highlightEnabled: true, highlightColor: MINT, highlightBorderRadius: 8, highlightPadding: 28, letterSpacing: -2, width: 900 } },
    { text: 'pour votre soutien', dy: 220, patch: { fontFamily: 'DM Sans', fontStyle: 'bold', fontSize: 48, fill: INK, width: 760 } },
  ] },
  { id: 'x-bienvenue', cat: 'Titre', parts: [
    { text: 'BIENVENUE', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 160, fillType: 'gradient', fill: MINT, fillTo: FOREST, fillAngle: 120, uppercase: true, letterSpacing: -4, width: 980 } },
  ] },
  { id: 'x-followus', cat: 'Minimal', dark: true, parts: [
    { text: 'FOLLOW US', dy: 0, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 70, fill: WHITE, uppercase: true, letterSpacing: 6, width: 900 } },
    { text: '@monresto', dy: 90, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 60, fill: INK, hasBg: true, bgColor: MINT, cornerRadius: 12, paddingH: 30, paddingV: 16, width: 760 } },
  ] },
  { id: 'x-newsalert', cat: 'Promo', parts: [
    { text: 'NOUVEAU', dy: 0, dx: -40, patch: { fontFamily: 'Archivo Black', fontSize: 90, fill: FOREST, uppercase: true, rotation: -5, highlightEnabled: true, highlightColor: ACID, highlightBorderRadius: 8, highlightPadding: 22, width: 760 } },
    { text: 'EN STOCK !', dy: 150, dx: 50, patch: { fontFamily: 'Archivo Black', fontSize: 90, fill: WHITE, uppercase: true, rotation: 4, highlightEnabled: true, highlightColor: MINT, highlightBorderRadius: 8, highlightPadding: 22, width: 760 } },
  ] },
  { id: 'x-giveaway', cat: 'Événement', parts: [
    { text: 'CONCOURS', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 170, fillType: 'gradient', fill: PINK, fillTo: PURPLE, fillAngle: 120, uppercase: true, letterSpacing: -4, lineHeight: 0.88, width: 980 } },
    { text: 'À GAGNER', dy: 160, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 50, fill: INK, uppercase: true, letterSpacing: 8, width: 820 } },
  ] },
  { id: 'x-price', cat: 'Promo', parts: [
    { text: '49€', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 320, fill: INK, letterSpacing: -8, lineHeight: 0.9, width: 980 } },
    { text: 'seulement', dy: 290, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 70, fill: MINT2, width: 760 } },
  ] },
  { id: 'x-recipe', cat: 'Titre', parts: [
    { text: 'RECETTE', dy: 0, patch: { fontFamily: 'Playfair Display', fontSize: 150, fill: INK, uppercase: true, letterSpacing: 8, lineHeight: 0.95, width: 980 } },
    { text: 'DU JOUR', dy: 150, patch: { fontFamily: 'Anton', fontSize: 160, fill: CORAL, uppercase: true, letterSpacing: 2, width: 980 } },
  ] },
  { id: 'x-podcast', cat: 'Événement', dark: true, parts: [
    { text: 'NEW', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 130, fill: PURPLE, uppercase: true, lineHeight: 0.86, letterSpacing: -2, width: 900 } },
    { text: 'EPISODE', dy: 120, patch: { fontFamily: 'Archivo Black', fontSize: 200, fill: WHITE, uppercase: true, letterSpacing: -6, lineHeight: 0.86, width: 980 } },
  ] },

  // ─────────── PROMO (suite) ───────────
  { id: 'promo-freeship', cat: 'Promo', parts: [
    { text: 'LIVRAISON', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 120, fill: INK, uppercase: true, letterSpacing: -2, lineHeight: 0.9, width: 980 } },
    { text: 'OFFERTE', dy: 108, patch: { fontFamily: 'Archivo Black', fontSize: 160, fill: WHITE, hasBg: true, bgColor: MINT2, cornerRadius: 10, paddingH: 30, paddingV: 8, uppercase: true, letterSpacing: -2, width: 900 } },
  ] },
  { id: 'promo-deal-day', cat: 'Promo', dark: true, parts: [
    { text: 'DEAL OF', dy: 0, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 60, fill: '#C9C4B2', uppercase: true, letterSpacing: 8, width: 820 } },
    { text: 'THE DAY', dy: 66, patch: { fontFamily: 'Anton', fontSize: 240, fill: ACID, uppercase: true, letterSpacing: 2, lineHeight: 0.9, width: 980 } },
  ] },
  { id: 'promo-mega-neon', cat: 'Promo', dark: true, parts: [
    { text: '-30%', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 320, fill: MINT, glowEnabled: true, glowColor: MINT, glowIntensity: 90, glowSize: 40, letterSpacing: -10, width: 980 } },
  ] },
  { id: 'promo-clearance', cat: 'Promo', parts: [
    { text: 'DÉSTOCKAGE', dy: 0, patch: { fontFamily: 'Anton', fontSize: 130, fill: ORANGE, uppercase: true, letterSpacing: 2, lineHeight: 0.9, width: 980 } },
    { text: 'tout doit partir', dy: 120, patch: { fontFamily: 'DM Sans', fontStyle: 'bold', fontSize: 52, fill: INK, width: 820 } },
  ] },

  // ─────────── ÉVÉNEMENT (suite) ───────────
  { id: 'event-workshop', cat: 'Événement', parts: [
    { text: 'ATELIER', dy: 0, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 140, fill: BROWN, width: 980 } },
    { text: 'PLACES LIMITÉES', dy: 150, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 34, fill: INK, uppercase: true, letterSpacing: 6, width: 820 } },
  ] },
  { id: 'event-webinar', cat: 'Événement', dark: true, parts: [
    { text: 'WEBINAIRE', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 130, fill: SKY, uppercase: true, letterSpacing: -2, lineHeight: 0.9, width: 980 } },
    { text: 'GRATUIT · EN LIGNE', dy: 120, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 38, fill: WHITE, uppercase: true, letterSpacing: 6, width: 820 } },
  ] },
  { id: 'event-anniv', cat: 'Événement', parts: [
    { text: '5 ANS', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 300, fillType: 'gradient', fill: PINK, fillTo: ORANGE, fillAngle: 120, letterSpacing: -8, lineHeight: 0.9, width: 980 } },
    { text: 'ça se fête !', dy: 270, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 72, fill: INK, width: 760 } },
  ] },

  // ─────────── TITRE (suite) ───────────
  { id: 'title-manifesto', cat: 'Titre', parts: [
    { text: 'we make', dy: 0, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 90, fill: '#5A5E50', width: 820 } },
    { text: 'GREAT', dy: 92, patch: { fontFamily: 'Archivo Black', fontSize: 220, fill: INK, uppercase: true, letterSpacing: -6, lineHeight: 0.84, width: 980 } },
    { text: 'THINGS', dy: 268, patch: { fontFamily: 'Archivo Black', fontSize: 220, fill: MINT2, uppercase: true, letterSpacing: -6, lineHeight: 0.84, width: 980 } },
  ] },
  { id: 'title-index', cat: 'Titre', parts: [
    { text: '01', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 280, fill: 'transparent', stroke: INK, strokeWidth: 5, letterSpacing: -6, lineHeight: 0.9, width: 980 } },
    { text: 'INTRODUCTION', dy: 260, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 40, fill: INK, uppercase: true, letterSpacing: 8, width: 900 } },
  ] },
  { id: 'title-nature', cat: 'Titre', parts: [
    { text: 'NATURE', dy: 0, patch: { fontFamily: 'Playfair Display', fontSize: 170, fill: FOREST, uppercase: true, letterSpacing: 12, width: 980 } },
    { text: 'brut & authentique', dy: 180, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 60, fill: MINT2, width: 820 } },
  ] },
  { id: 'title-tech', cat: 'Titre', dark: true, parts: [
    { text: 'FUTURE', dy: 0, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 190, fillType: 'gradient', fill: CYAN, fillTo: BLUE, fillAngle: 120, uppercase: true, letterSpacing: -4, lineHeight: 0.88, width: 980 } },
    { text: 'IS NOW', dy: 176, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 60, fill: WHITE, uppercase: true, letterSpacing: 12, width: 820 } },
  ] },

  // ─────────── CITATION (suite) ───────────
  { id: 'quote-lessismore', cat: 'Citation', parts: [
    { text: 'less', dy: 0, patch: { fontFamily: 'DM Sans', fontStyle: 'bold', fontSize: 170, fill: INK, letterSpacing: -6, lineHeight: 0.92, width: 820 } },
    { text: 'is more', dy: 150, dx: 50, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 150, fill: '#5A5E50', width: 760 } },
  ] },
  { id: 'quote-begin', cat: 'Citation', dark: true, parts: [
    { text: 'the journey', dy: 0, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 84, fill: '#C9C4B2', width: 860 } },
    { text: 'BEGINS', dy: 96, patch: { fontFamily: 'Archivo Black', fontSize: 190, fill: ACID, uppercase: true, letterSpacing: -4, width: 980 } },
  ] },
  { id: 'quote-goodfood', cat: 'Citation', parts: [
    { text: 'good food,', dy: 0, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 100, fill: INK, lineHeight: 1.1, width: 860 } },
    { text: 'good mood', dy: 110, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 100, fill: CORAL, lineHeight: 1.1, width: 860 } },
  ] },

  // ─────────── FUN (suite) ───────────
  { id: 'fun-lol', cat: 'Fun', parts: [
    { text: 'LOL', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 300, fill: LEMON, stroke: INK, strokeWidth: 8, uppercase: true, letterSpacing: -6, width: 980 } },
  ] },
  { id: 'fun-vibes', cat: 'Fun', dark: true, parts: [
    { text: 'GOOD', dy: 0, patch: { fontFamily: 'Archivo Black', fontStyle: 'italic', fontSize: 200, fillType: 'gradient', fill: MINT, fillTo: CYAN, fillAngle: 110, uppercase: true, letterSpacing: -6, lineHeight: 0.86, width: 980 } },
    { text: 'ENERGY', dy: 180, patch: { fontFamily: 'Archivo Black', fontStyle: 'italic', fontSize: 200, fillType: 'gradient', fill: CYAN, fillTo: BLUE, fillAngle: 110, uppercase: true, letterSpacing: -6, lineHeight: 0.86, width: 980 } },
  ] },
  { id: 'fun-boom', cat: 'Fun', parts: [
    { text: 'BOOM', dy: 0, patch: { fontFamily: 'Anton', fontSize: 280, fill: RED, uppercase: true, liftEnabled: true, liftColor: YELLOW, liftDepth: 16, letterSpacing: 2, width: 980 } },
  ] },
  { id: 'fun-sale-tilt', cat: 'Fun', parts: [
    { text: 'SALE', dy: 0, dx: -30, patch: { fontFamily: 'Anton', fontSize: 200, fill: PINK, uppercase: true, rotation: -8, letterSpacing: 2, width: 900 } },
    { text: 'SALE', dy: 160, dx: 40, patch: { fontFamily: 'Anton', fontSize: 200, fill: PURPLE, uppercase: true, rotation: 6, letterSpacing: 2, width: 900 } },
  ] },

  // ─────────── RÉTRO (suite) ───────────
  { id: 'retro-vintage', cat: 'Rétro', parts: [
    { text: 'VINTAGE', dy: 0, patch: { fontFamily: 'Anton', fontSize: 190, fill: BROWN, uppercase: true, echoEnabled: true, echoColor: ORANGE, echoCount: 2, echoOffset: 12, letterSpacing: 2, lineHeight: 0.9, width: 980 } },
    { text: 'EST. 1998', dy: 180, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 40, fill: BROWN, uppercase: true, letterSpacing: 8, width: 760 } },
  ] },
  { id: 'retro-groovy', cat: 'Rétro', parts: [
    { text: 'GROOVY', dy: 0, patch: { fontFamily: 'Archivo Black', fontStyle: 'italic', fontSize: 210, fillType: 'gradient', fill: ORANGE, fillTo: PINK, fillAngle: 100, uppercase: true, letterSpacing: -4, width: 980 } },
  ] },
  { id: 'retro-diner', cat: 'Rétro', dark: true, parts: [
    { text: "DINER", dy: 0, patch: { fontFamily: 'Anton', fontSize: 240, fill: CORAL, stroke: CREAM, strokeWidth: 5, uppercase: true, glowEnabled: true, glowColor: CORAL, glowIntensity: 70, glowSize: 24, letterSpacing: 4, width: 980 } },
    { text: 'OPEN 24H', dy: 230, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 40, fill: CYAN, uppercase: true, letterSpacing: 10, width: 820 } },
  ] },

  // ─────────── ÉLÉGANT (suite) ───────────
  { id: 'eleg-wedding', cat: 'Élégant', parts: [
    { text: 'Sarah & Tom', dy: 0, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 130, fill: INK, width: 980 } },
    { text: '12 SEPTEMBRE 2026', dy: 150, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 32, fill: GOLD, uppercase: true, letterSpacing: 10, width: 820 } },
  ] },
  { id: 'eleg-spa', cat: 'Élégant', parts: [
    { text: 'SPA', dy: 0, patch: { fontFamily: 'Playfair Display', fontSize: 220, fill: MINT2, uppercase: true, letterSpacing: 24, width: 980 } },
    { text: 'détente & bien-être', dy: 220, patch: { fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 60, fill: FOREST, width: 820 } },
  ] },
  { id: 'eleg-gold', cat: 'Élégant', dark: true, parts: [
    { text: 'PREMIUM', dy: 0, patch: { fontFamily: 'Playfair Display', fontSize: 150, fillType: 'gradient', fill: GOLD, fillTo: '#F4E3A1', fillAngle: 120, uppercase: true, letterSpacing: 14, width: 980 } },
    { text: 'QUALITY GUARANTEED', dy: 160, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 28, fill: '#C9C4B2', uppercase: true, letterSpacing: 8, width: 820 } },
  ] },

  // ─────────── NÉON (suite) ───────────
  { id: 'neon-sale', cat: 'Néon', dark: true, parts: [
    { text: 'SALE', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 300, fill: LEMON, glowEnabled: true, glowColor: LEMON, glowIntensity: 90, glowSize: 40, uppercase: true, letterSpacing: -4, width: 980 } },
  ] },
  { id: 'neon-club', cat: 'Néon', dark: true, parts: [
    { text: 'CLUB', dy: 0, patch: { fontFamily: 'Anton', fontSize: 260, fill: PINK, glowEnabled: true, glowColor: PINK, glowIntensity: 90, glowSize: 42, uppercase: true, lineHeight: 0.9, width: 980 } },
    { text: 'NIGHT', dy: 250, patch: { fontFamily: 'Anton', fontSize: 130, fill: CYAN, glowEnabled: true, glowColor: CYAN, glowIntensity: 90, glowSize: 30, uppercase: true, letterSpacing: 16, width: 900 } },
  ] },

  // ─────────── MINIMAL (suite) ───────────
  { id: 'min-newin', cat: 'Minimal', parts: [
    { text: 'NEW IN', dy: 0, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 130, fill: INK, uppercase: true, letterSpacing: 2, width: 900 } },
    { text: '·', dy: 140, patch: { fontFamily: 'DM Sans', fontStyle: 'bold', fontSize: 120, fill: MINT2, width: 400 } },
  ] },
  { id: 'min-coming', cat: 'Minimal', dark: true, parts: [
    { text: 'coming', dy: 0, patch: { fontFamily: 'DM Sans', fontStyle: 'bold', fontSize: 110, fill: '#C9C4B2', letterSpacing: -2, lineHeight: 0.95, width: 900 } },
    { text: 'soon', dy: 110, patch: { fontFamily: 'DM Sans', fontStyle: 'bold', fontSize: 190, fill: WHITE, letterSpacing: -6, width: 900 } },
  ] },
  { id: 'min-menu', cat: 'Minimal', parts: [
    { text: 'du.jour', dy: 0, patch: { fontFamily: 'DM Sans', fontStyle: 'bold', fontSize: 150, fill: INK, letterSpacing: -5, width: 900 } },
  ] },

  // ─────────── GRAS (suite) ───────────
  { id: 'bold-huge', cat: 'Gras', dark: true, parts: [
    { text: 'HUGE', dy: 0, patch: { fontFamily: 'Anton', fontSize: 340, fill: ACID, uppercase: true, letterSpacing: 2, lineHeight: 0.9, width: 980 } },
  ] },
  { id: 'bold-drop', cat: 'Gras', parts: [
    { text: 'THE', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 90, fill: INK, uppercase: true, letterSpacing: 4, width: 820 } },
    { text: 'DROP', dy: 76, patch: { fontFamily: 'Archivo Black', fontSize: 280, fillType: 'gradient', fill: PURPLE, fillTo: PINK, fillAngle: 120, uppercase: true, letterSpacing: -8, width: 980 } },
  ] },
  { id: 'bold-yes', cat: 'Gras', parts: [
    { text: 'YES', dy: 0, patch: { fontFamily: 'Anton', fontSize: 340, fill: MINT2, uppercase: true, liftEnabled: true, liftColor: INK, liftDepth: 18, letterSpacing: 2, width: 980 } },
  ] },
];
