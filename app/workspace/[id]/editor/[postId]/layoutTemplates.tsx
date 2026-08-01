'use client';
import React from 'react';
import type { BrandKit } from './textTemplates';

// ─── Bibliothèque de MISES EN PAGE complètes (façon Canva) ────────────────────
// Pendant des modèles de typographie (textTemplates.tsx), mais pour des
// compositions entières : zones photo, aplats, titres, listes.
//
// Deux différences assumées avec les modèles de texte :
//  1. La géométrie est exprimée en FRACTIONS du plan de travail (0..1) et non en
//     pixels d'un cadre de référence. Une mise en page doit tenir aussi bien en
//     portrait 4:5 qu'en carré ou en story 9:16 ; des valeurs relatives s'y
//     adaptent sans déformer, là où un simple facteur de largeur écraserait tout.
//  2. Chaque élément porte un rôle de charte (`role`). Le modèle est dessiné avec
//     des couleurs de base, et adaptLayoutToCharter() remappe ces rôles sur la
//     palette du client — exactement le couple « version de base / à ma charte »
//     des modèles de typo.
//
// Les couleurs ici sont des couleurs de CONTENU (canvas), pas d'UI : la règle
// « pas de couleur en dur » ne s'applique pas.

export type LayoutCat = 'Photo' | 'Éditorial' | 'Citation' | 'Liste' | 'Événement' | 'Promo' | 'Collage';

export const LAYOUT_CATS: LayoutCat[] = ['Photo', 'Éditorial', 'Citation', 'Liste', 'Événement', 'Promo', 'Collage'];

// Le STYLE compte autant que l'usage : deux modèles « citation » peuvent n'avoir
// aucun rapport visuel. On range donc chaque modèle sur les deux axes.
export type LayoutStyle = 'Composé' | 'Minimal' | 'Éditorial' | 'Audacieux' | 'Rétro' | 'Élégant' | 'Ludique' | 'Scrapbook' | 'Naturel' | 'Nocturne';
export const LAYOUT_STYLES: LayoutStyle[] = ['Composé', 'Minimal', 'Éditorial', 'Audacieux', 'Rétro', 'Élégant', 'Ludique', 'Scrapbook', 'Naturel', 'Nocturne'];

// Rôle dans la charte — pilote la recoloration « à ma charte ».
export type BrandRole = 'ground' | 'accent' | 'onGround' | 'onAccent' | 'title' | 'body' | 'none';

interface Common { role?: BrandRole; rotation?: number; opacity?: number; }

export interface PhotoSpec extends Common {
  kind: 'photo';
  x: number; y: number; w: number; h: number;
  radius?: number;
  /** 0 = la photo du post ; 1+ = photos secondaires à déposer par l'utilisateur. */
  slot?: number;
  /** Requête banque d'images : le modèle arrive AVEC son visuel, comme chez
   *  Canva, au lieu d'une zone grise à remplir. Résolue à l'application via
   *  /api/pexels (Pexels si clé, sinon Openverse) — pas d'URL en dur, qui
   *  pourrirait le jour où l'image disparaît. Ignorée si le post a déjà sa
   *  photo et que le slot vaut 0. */
  stock?: string;
}
export interface RectSpec extends Common {
  kind: 'rect';
  x: number; y: number; w: number; h: number;
  fill: string; radius?: number; scrim?: 'top' | 'bottom';
  stroke?: string; strokeWidth?: number;
}
export interface TextSpec extends Common {
  kind: 'text';
  x: number; y: number; w: number;
  text: string;
  /** Taille de police en fraction de la LARGEUR du plan de travail. */
  size: number;
  fill: string;
  font?: string; weight?: string; align?: 'left' | 'center' | 'right';
  uppercase?: boolean; lineHeight?: number; letterSpacing?: number;
  bg?: string; bgOpacity?: number; radius?: number; padH?: number; padV?: number;
}
export type LayoutSpec = PhotoSpec | RectSpec | TextSpec;

export interface LayoutTemplate {
  id: string;
  name: string;
  cat: LayoutCat;
  style: LayoutStyle;
  /** Nombre de photos attendues (1 = la photo du post seule). */
  photos: number;
  /** Vignette : fond sombre ou clair, pour le contraste de l'aperçu. */
  dark?: boolean;
  els: LayoutSpec[];
}

// ── Palette des versions de base ─────────────────────────────────────────────
const INK = '#14160F', CREAM = '#F4EDE4', WHITE = '#FFFFFF';
const SAND = '#E8DCC8';
const NAVY = '#1B2A4A', BLUSH = '#F3D9D5';
const NOIR = '#0A0A0A', BONE = '#EFEAE2', PAPER = '#F7F4EE';
const CLAY = '#B4674D', SAGE = '#9CAF88', MOSS = '#3F4A3A', RUST = '#9C4A2F';
const PLUM = '#4A2B4D', SKY = '#A8C8E1', LEMON = '#F2E14C', CORAL = '#FF6B5A';
const LILAC = '#C9B8E8', CHOCO = '#3B2A20', GOLD = '#C9A227', STEEL = '#5A6672';

// ── Adaptation à la charte ───────────────────────────────────────────────────
// Contraste : sur un aplat de marque, on choisit l'encre lisible plutôt que de
// garder la couleur d'origine du modèle, qui pourrait devenir illisible.
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function readableInk(bg: string): string {
  return luminance(bg) > 0.45 ? INK : CREAM;
}

export function adaptLayoutToCharter(tpl: LayoutTemplate, brand: BrandKit): LayoutTemplate {
  const P = brand.primary || undefined;
  const A = brand.accent || brand.secondary || undefined;
  const F = brand.font || undefined;
  if (!P && !A && !F) return tpl;

  const els = tpl.els.map((el): LayoutSpec => {
    const role = el.role ?? 'none';
    if (el.kind === 'rect') {
      if (role === 'ground' && P) return { ...el, fill: P };
      if (role === 'accent' && A) return { ...el, fill: A };
      return el;
    }
    if (el.kind === 'text') {
      const t: TextSpec = { ...el };
      if (F) t.font = F;
      if (role === 'onGround' && P) t.fill = readableInk(P);
      if (role === 'onAccent' && A) t.fill = readableInk(A);
      if (role === 'title' && P) t.fill = P;
      if (role === 'accent' && A) t.fill = A;
      if (t.bg && role === 'body' && A) { t.bg = A; t.fill = readableInk(A); }
      return t;
    }
    return el;
  });
  return { ...tpl, els };
}

// ── Modèles ──────────────────────────────────────────────────────────────────
// Familles tirées des références Canva envoyées par Martin (30/07), déclinées en
// neuf STYLES visuels : c'est le style, plus que l'usage, qui fait qu'un modèle
// « va » ou non à un client. Chaque modèle est donc rangé deux fois — par usage
// (cat) et par style — et l'onglet propose les deux filtres.

// Raccourcis d'écriture : la géométrie est en fractions du plan de travail.
const ph = (x: number, y: number, w: number, h: number, slot = 0, radius = 0, stock?: string): PhotoSpec =>
  ({ kind: 'photo', x, y, w, h, slot, radius, ...(stock ? { stock } : {}) });
const rc = (x: number, y: number, w: number, h: number, fill: string, o: Partial<RectSpec> = {}): RectSpec =>
  ({ kind: 'rect', x, y, w, h, fill, ...o });
const tx = (x: number, y: number, w: number, text: string, size: number, fill: string, o: Partial<TextSpec> = {}): TextSpec =>
  ({ kind: 'text', x, y, w, text, size, fill, ...o });

const G = 'ground' as const, OG = 'onGround' as const, AC = 'accent' as const, BD = 'body' as const, NO = 'none' as const;
const B = { weight: 'bold' } as const;
const C = { align: 'center' } as const;

// Voile standard sous un titre posé sur photo.
const scrimBas = rc(0, 0.5, 1, 0.5, '#000000', { scrim: 'bottom', opacity: 60 });

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [

  // ═══ COMPOSÉ ══════════════════════════════════════════════════════════════
  // Compositions abouties : plusieurs plans superposés, cadres inclinés, typo
  // qui joue sur les tailles et les chevauchements. On livre un visuel FINI que
  // le client retouche, au lieu d'un gabarit à remplir.
  { id: 'co-polaroid3', name: 'Trois polaroids', cat: 'Collage', style: 'Composé', photos: 3, els: [
    rc(0, 0, 1, 1, SAND, { role: G }),
    rc(0.06, 0.12, 0.5, 0.42, WHITE, { rotation: -8, radius: 0.006 }),
    ph(0.09, 0.15, 0.44, 0.33, 0),
    rc(0.42, 0.26, 0.5, 0.42, WHITE, { rotation: 6, radius: 0.006 }),
    ph(0.45, 0.29, 0.44, 0.33, 1),
    rc(0.16, 0.44, 0.5, 0.42, WHITE, { rotation: -3, radius: 0.006 }),
    ph(0.19, 0.47, 0.44, 0.33, 2),
    tx(0.06, 0.87, 0.88, 'notre semaine', 0.075, INK, { ...C, role: OG }),
  ] },
  { id: 'co-magazine', name: 'Titre par-dessus', cat: 'Éditorial', style: 'Composé', photos: 1, els: [
    rc(0, 0, 1, 1, BONE, { role: G }),
    ph(0.12, 0.1, 0.76, 0.56, 0, 0.004),
    rc(0.04, 0.5, 0.6, 0.13, CREAM, { rotation: -2 }),
    tx(0.06, 0.51, 0.56, 'L’ART DE', 0.1, INK, { ...B, uppercase: true, rotation: -2, role: NO }),
    rc(0.3, 0.62, 0.66, 0.13, RUST, { rotation: 1, role: AC }),
    tx(0.32, 0.63, 0.62, 'RALENTIR', 0.1, CREAM, { ...B, uppercase: true, rotation: 1, role: NO }),
    tx(0.12, 0.82, 0.76, 'Dossier · 6 min de lecture', 0.028, INK, { uppercase: true, letterSpacing: 3, role: OG }),
  ] },
  { id: 'co-typostack', name: 'Empilement typo', cat: 'Éditorial', style: 'Composé', photos: 1, els: [
    rc(0, 0, 1, 1, NOIR, { role: G }),
    tx(0.04, 0.08, 0.92, 'ÉTÉ', 0.26, 'rgba(244,237,228,.13)', { ...B, uppercase: true, letterSpacing: -4, role: NO }),
    tx(0.04, 0.26, 0.92, 'ÉTÉ', 0.19, 'rgba(244,237,228,.28)', { ...B, uppercase: true, letterSpacing: -3, role: NO }),
    ph(0.22, 0.36, 0.56, 0.4, 0, 0.02),
    tx(0.04, 0.79, 0.92, 'ÉTÉ', 0.19, CREAM, { ...B, uppercase: true, letterSpacing: -3, role: OG }),
    tx(0.04, 0.93, 0.92, '2026 — la collection', 0.028, GOLD, { letterSpacing: 3, uppercase: true, role: AC }),
  ] },
  { id: 'co-papier', name: 'Papiers superposés', cat: 'Citation', style: 'Composé', photos: 0, els: [
    rc(0, 0, 1, 1, CLAY, { role: G }),
    rc(0.1, 0.16, 0.78, 0.6, 'rgba(0,0,0,.12)', { rotation: 4, radius: 0.01 }),
    rc(0.08, 0.14, 0.78, 0.6, CREAM, { rotation: -2, radius: 0.01 }),
    tx(0.14, 0.2, 0.66, '“', 0.14, CLAY, { rotation: -2, role: AC }),
    tx(0.14, 0.32, 0.66, 'Ce qu’on répète devient ce qu’on est.', 0.055, INK, { rotation: -2, lineHeight: 1.3, role: BD }),
    tx(0.14, 0.62, 0.66, '— Prénom Nom', 0.03, 'rgba(20,22,15,.6)', { rotation: -2, role: BD }),
    tx(0.08, 0.86, 0.84, '@votrecompte', 0.03, CREAM, { ...C, uppercase: true, letterSpacing: 3, role: OG }),
  ] },
  { id: 'co-sticker', name: 'Photo + pastilles', cat: 'Promo', style: 'Composé', photos: 1, els: [
    rc(0, 0, 1, 1, LEMON, { role: G }),
    rc(0.12, 0.16, 0.76, 0.56, WHITE, { rotation: 3, radius: 0.02 }),
    ph(0.15, 0.19, 0.7, 0.5, 0, 0.015),
    tx(0.02, 0.12, 0.34, 'NOUVEAU', 0.04, WHITE, { ...B, ...C, uppercase: true, rotation: -14, bg: CORAL, bgOpacity: 100, radius: 0.06, padH: 0.03, padV: 0.022, role: BD }),
    tx(0.62, 0.63, 0.36, '-30%', 0.06, INK, { ...B, ...C, rotation: 9, bg: WHITE, bgOpacity: 100, radius: 0.3, padH: 0.03, padV: 0.03, role: BD }),
    tx(0.06, 0.8, 0.88, 'La sélection de la semaine', 0.052, INK, { ...B, ...C, role: OG }),
    tx(0.06, 0.9, 0.88, 'en boutique et en ligne', 0.03, 'rgba(20,22,15,.62)', { ...C, role: OG }),
  ] },
  { id: 'co-cadre', name: 'Cadre dans le cadre', cat: 'Photo', style: 'Composé', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1),
    rc(0, 0, 1, 1, '#000000', { opacity: 30 }),
    rc(0.08, 0.07, 0.84, 0.86, 'rgba(0,0,0,0)', { stroke: '#F4EDE4', strokeWidth: 1.5 }),
    rc(0.2, 0.38, 0.6, 0.2, CREAM, { role: G }),
    tx(0.22, 0.41, 0.56, 'ESCAPADE', 0.075, INK, { ...B, ...C, uppercase: true, letterSpacing: 1, role: OG }),
    tx(0.2, 0.61, 0.6, 'du 12 au 19 juin', 0.03, WHITE, { ...C, uppercase: true, letterSpacing: 3, role: NO }),
  ] },
  { id: 'co-bande', name: 'Bande en diagonale', cat: 'Événement', style: 'Composé', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1),
    rc(0, 0, 1, 1, '#000000', { opacity: 22 }),
    rc(-0.08, 0.3, 1.16, 0.1, PLUM, { rotation: -9, role: G }),
    rc(-0.08, 0.42, 1.16, 0.18, LEMON, { rotation: -9, role: AC }),
    tx(0.06, 0.45, 0.88, 'SOIRÉE', 0.11, INK, { ...B, ...C, uppercase: true, rotation: -9, role: NO }),
    tx(0.06, 0.68, 0.88, 'Vendredi · 20 h · au domaine', 0.032, WHITE, { ...C, role: BD }),
  ] },
  { id: 'co-grille-num', name: 'Grille numérotée', cat: 'Liste', style: 'Composé', photos: 3, els: [
    rc(0, 0, 1, 1, MOSS, { role: G }),
    tx(0.06, 0.06, 0.88, '3 adresses', 0.085, CREAM, { ...B, role: OG }),
    ph(0.06, 0.2, 0.42, 0.26, 0, 0.012),
    tx(0.5, 0.22, 0.44, '01', 0.06, SAGE, { ...B, role: AC }),
    tx(0.5, 0.31, 0.44, 'La première, celle qu’on garde secrète.', 0.028, CREAM, { lineHeight: 1.35, role: OG }),
    ph(0.06, 0.49, 0.42, 0.26, 1, 0.012),
    tx(0.5, 0.51, 0.44, '02', 0.06, SAGE, { ...B, role: AC }),
    tx(0.5, 0.6, 0.44, 'La deuxième, pour les dimanches.', 0.028, CREAM, { lineHeight: 1.35, role: OG }),
    ph(0.06, 0.78, 0.42, 0.16, 2, 0.012),
    tx(0.5, 0.8, 0.44, '03', 0.06, SAGE, { ...B, role: AC }),
    tx(0.5, 0.88, 0.44, 'Et la dernière, la meilleure.', 0.028, CREAM, { lineHeight: 1.35, role: OG }),
  ] },
  { id: 'co-timbre', name: 'Timbre et cachet', cat: 'Photo', style: 'Composé', photos: 1, els: [
    rc(0, 0, 1, 1, '#EFEDE3', { role: G }),
    rc(0.14, 0.14, 0.72, 0.54, WHITE, { rotation: -4, radius: 0.008 }),
    ph(0.17, 0.17, 0.66, 0.44, 0),
    rc(0.62, 0.08, 0.24, 0.24, 'rgba(0,0,0,0)', { stroke: CLAY, strokeWidth: 2, radius: 0.12, rotation: 12 }),
    tx(0.62, 0.16, 0.24, 'PAR AVION', 0.022, CLAY, { ...C, uppercase: true, letterSpacing: 1, rotation: 12, role: AC }),
    tx(0.08, 0.74, 0.84, 'Bonjour de', 0.038, 'rgba(20,22,15,.6)', { ...C, role: OG }),
    tx(0.08, 0.79, 0.84, 'Lisbonne', 0.095, INK, { ...C, role: OG }),
    rc(0.4, 0.92, 0.2, 0.003, CLAY, { role: AC }),
  ] },
  { id: 'co-vitrine', name: 'Vitrine produit', cat: 'Promo', style: 'Composé', photos: 2, els: [
    rc(0, 0, 1, 1, BLUSH, { role: G }),
    rc(0.5, 0, 0.5, 1, CREAM),
    ph(0.08, 0.18, 0.46, 0.44, 0, 0.02),
    ph(0.4, 0.44, 0.44, 0.4, 1, 0.02),
    tx(0.06, 0.07, 0.88, 'LA NOUVELLE', 0.036, INK, { uppercase: true, letterSpacing: 4, role: OG }),
    tx(0.06, 0.115, 0.5, 'collection', 0.085, INK, { role: OG }),
    tx(0.06, 0.88, 0.42, 'DÉCOUVRIR', 0.028, CREAM, { ...B, ...C, uppercase: true, letterSpacing: 2, bg: INK, bgOpacity: 100, radius: 0.06, padH: 0.03, padV: 0.025, role: BD }),
  ] },

  // ═══ MINIMAL ══════════════════════════════════════════════════════════════
  { id: 'min-vide', name: 'Grand vide', cat: 'Photo', style: 'Minimal', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1), rc(0, 0, 1, 1, '#000000', { opacity: 12 }),
    tx(0.15, 0.08, 0.7, 'HELLO', 0.03, WHITE, { ...C, uppercase: true, letterSpacing: 6, role: NO }),
    tx(0.15, 0.13, 0.7, 'DÉCEMBRE', 0.055, WHITE, { ...C, uppercase: true, letterSpacing: 3, role: NO }),
  ] },
  { id: 'min-rule', name: 'Filet fin', cat: 'Éditorial', style: 'Minimal', photos: 1, els: [
    rc(0, 0, 1, 1, PAPER, { role: G }),
    tx(0.1, 0.1, 0.8, 'Une idée simple', 0.062, INK, { lineHeight: 1.15, role: OG }),
    rc(0.1, 0.22, 0.8, 0.0025, INK, { role: AC }),
    ph(0.1, 0.28, 0.8, 0.5, 0, 0.005),
    tx(0.1, 0.83, 0.8, 'Légende discrète', 0.026, INK, { uppercase: true, letterSpacing: 2, role: OG }),
  ] },
  { id: 'min-carre', name: 'Carré centré', cat: 'Photo', style: 'Minimal', photos: 1, els: [
    rc(0, 0, 1, 1, BONE, { role: G }),
    ph(0.16, 0.2, 0.68, 0.5),
    tx(0.1, 0.76, 0.8, 'LE MOT JUSTE', 0.042, INK, { ...C, uppercase: true, letterSpacing: 3, role: OG }),
  ] },
  { id: 'min-legende', name: 'Note en bas', cat: 'Citation', style: 'Minimal', photos: 0, els: [
    rc(0, 0, 1, 1, PAPER, { role: G }),
    tx(0.12, 0.36, 0.76, 'Moins, mais mieux.', 0.075, INK, { ...C, lineHeight: 1.2, role: OG }),
    rc(0.44, 0.55, 0.12, 0.002, INK, { role: AC }),
    tx(0.12, 0.6, 0.76, 'votre marque', 0.024, INK, { ...C, uppercase: true, letterSpacing: 3, role: OG }),
  ] },
  { id: 'min-duo', name: 'Duo aligné', cat: 'Collage', style: 'Minimal', photos: 2, els: [
    rc(0, 0, 1, 1, PAPER, { role: G }),
    ph(0.08, 0.1, 0.4, 0.34, 0), ph(0.52, 0.28, 0.4, 0.34, 1),
    tx(0.08, 0.72, 0.84, 'Deux temps, une histoire', 0.05, INK, { lineHeight: 1.2, role: OG }),
  ] },
  { id: 'min-numero', name: 'Numéro géant', cat: 'Liste', style: 'Minimal', photos: 0, els: [
    rc(0, 0, 1, 1, BONE, { role: G }),
    tx(0.1, 0.16, 0.8, '01', 0.3, INK, { ...B, role: OG }),
    tx(0.1, 0.55, 0.8, 'Le premier conseil, en une phrase courte.', 0.05, INK, { lineHeight: 1.3, role: OG }),
  ] },

  // ═══ ÉDITORIAL ════════════════════════════════════════════════════════════
  { id: 'ed-bandeau', name: 'Bandeau éditorial', cat: 'Éditorial', style: 'Éditorial', photos: 1, els: [
    rc(0, 0, 1, 1, CREAM, { role: G }),
    tx(0.07, 0.07, 0.86, 'PLONGEZ', 0.13, INK, { ...B, uppercase: true, lineHeight: 0.95, letterSpacing: -1, role: OG }),
    tx(0.07, 0.2, 0.86, 'RESSENTEZ', 0.13, INK, { ...B, uppercase: true, lineHeight: 0.95, letterSpacing: -1, role: OG }),
    rc(0.07, 0.33, 0.22, 0.006, INK, { role: AC }),
    ph(0.07, 0.4, 0.86, 0.46, 0, 0.02),
    tx(0.07, 0.89, 0.86, 'Le sous-titre ou la date', 0.03, INK, { uppercase: true, letterSpacing: 1.5, role: OG }),
  ] },
  { id: 'ed-magazine', name: 'Une de magazine', cat: 'Éditorial', style: 'Éditorial', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1), rc(0, 0, 1, 1, '#000000', { opacity: 25 }),
    tx(0.06, 0.05, 0.88, 'LE DOSSIER', 0.026, WHITE, { uppercase: true, letterSpacing: 5, role: NO }),
    rc(0.06, 0.1, 0.88, 0.002, WHITE, { role: AC }),
    tx(0.06, 0.6, 0.88, 'CE QU’IL FAUT SAVOIR', 0.105, WHITE, { ...B, uppercase: true, lineHeight: 0.98, letterSpacing: -1, role: NO }),
    tx(0.06, 0.86, 0.88, 'Reportage — 8 min de lecture', 0.028, 'rgba(255,255,255,.8)', { role: BD }),
  ] },
  { id: 'ed-colonne', name: 'Colonne de texte', cat: 'Éditorial', style: 'Éditorial', photos: 1, els: [
    rc(0, 0, 1, 1, CREAM, { role: G }),
    ph(0, 0, 1, 0.44),
    tx(0.08, 0.5, 0.84, 'Le titre de l’article', 0.07, INK, { lineHeight: 1.1, role: OG }),
    tx(0.08, 0.66, 0.84, 'Le chapô qui donne envie de lire la suite, en deux ou trois lignes bien senties.', 0.032, INK, { lineHeight: 1.45, role: OG }),
    tx(0.08, 0.9, 0.84, 'LIRE LA SUITE →', 0.028, INK, { uppercase: true, letterSpacing: 2, role: AC }),
  ] },
  { id: 'ed-split', name: 'Moitié / moitié', cat: 'Éditorial', style: 'Éditorial', photos: 1, els: [
    rc(0, 0, 1, 1, NAVY, { role: G }),
    ph(0, 0.45, 1, 0.55),
    tx(0.08, 0.1, 0.84, 'UN TITRE QUI TRANCHE', 0.085, CREAM, { ...B, uppercase: true, lineHeight: 1.02, role: OG }),
    tx(0.08, 0.34, 0.84, 'sous-titre', 0.028, CREAM, { uppercase: true, letterSpacing: 4, role: OG }),
  ] },
  { id: 'ed-cote', name: 'Titre en marge', cat: 'Éditorial', style: 'Éditorial', photos: 1, els: [
    rc(0, 0, 1, 1, BONE, { role: G }),
    ph(0.32, 0.06, 0.62, 0.88, 0, 0.004),
    tx(0.04, 0.1, 0.26, 'NOUVELLE COLLECTION', 0.038, INK, { ...B, uppercase: true, lineHeight: 1.1, role: OG }),
    tx(0.04, 0.82, 0.26, '2026', 0.05, INK, { ...B, role: AC }),
  ] },
  { id: 'ed-chiffre', name: 'Chiffre clé', cat: 'Éditorial', style: 'Éditorial', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1), rc(0, 0, 1, 1, '#000000', { opacity: 45 }),
    tx(0.1, 0.3, 0.8, '87 %', 0.19, WHITE, { ...B, ...C, letterSpacing: -3, role: NO }),
    tx(0.1, 0.55, 0.8, 'des community managers jonglent entre plus de trois outils.', 0.036, WHITE, { ...C, lineHeight: 1.4, role: BD }),
  ] },

  // ═══ AUDACIEUX ════════════════════════════════════════════════════════════
  { id: 'bo-typo', name: 'Typo pleine page', cat: 'Éditorial', style: 'Audacieux', photos: 0, els: [
    rc(0, 0, 1, 1, LEMON, { role: G }),
    tx(0.06, 0.18, 0.88, 'ÇA', 0.2, INK, { ...B, uppercase: true, lineHeight: 0.9, letterSpacing: -3, role: OG }),
    tx(0.06, 0.37, 0.88, 'CHANGE', 0.15, INK, { ...B, uppercase: true, lineHeight: 0.9, letterSpacing: -3, role: OG }),
    tx(0.06, 0.53, 0.88, 'TOUT', 0.2, INK, { ...B, uppercase: true, lineHeight: 0.9, letterSpacing: -3, role: OG }),
    tx(0.05, 0.88, 0.9, '@votrecompte', 0.028, INK, { uppercase: true, letterSpacing: 2, role: OG }),
  ] },
  { id: 'bo-bloc', name: 'Bloc de couleur', cat: 'Promo', style: 'Audacieux', photos: 1, els: [
    ph(0, 0, 1, 1),
    rc(0, 0.58, 1, 0.42, CORAL, { role: G }),
    tx(0.07, 0.64, 0.86, 'OFFRE', 0.09, WHITE, { ...B, uppercase: true, letterSpacing: -1, role: OG }),
    tx(0.07, 0.75, 0.86, 'DU MOMENT', 0.09, WHITE, { ...B, uppercase: true, letterSpacing: -1, role: OG }),
    tx(0.07, 0.89, 0.86, 'Jusqu’à dimanche', 0.032, WHITE, { role: OG }),
  ] },
  { id: 'bo-repet', name: 'Mot répété', cat: 'Promo', style: 'Audacieux', photos: 1, els: [
    rc(0, 0, 1, 1, RUST, { role: G }),
    tx(0.04, 0.06, 0.92, 'NOUVEAU', 0.16, 'rgba(255,255,255,.2)', { ...B, uppercase: true, letterSpacing: -2, role: NO }),
    tx(0.04, 0.17, 0.92, 'NOUVEAU', 0.16, 'rgba(255,255,255,.13)', { ...B, uppercase: true, letterSpacing: -2, role: NO }),
    ph(0.14, 0.29, 0.72, 0.55),
    tx(0.06, 0.89, 0.88, 'Découvrez la nouveauté', 0.032, WHITE, { ...C, role: OG }),
  ] },
  { id: 'bo-diagonal', name: 'Bandeau oblique', cat: 'Événement', style: 'Audacieux', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1), rc(0, 0, 1, 1, '#000000', { opacity: 30 }),
    rc(-0.05, 0.42, 1.1, 0.16, LEMON, { rotation: -7, role: G }),
    tx(0.06, 0.45, 0.88, 'C’EST CE SOIR', 0.08, INK, { ...B, ...C, uppercase: true, rotation: -7, role: OG }),
    tx(0.06, 0.75, 0.88, '20 h — au Domaine', 0.036, WHITE, { ...C, role: BD }),
  ] },
  { id: 'bo-contour', name: 'Titre contour', cat: 'Photo', style: 'Audacieux', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1), scrimBas,
    tx(0.06, 0.56, 0.88, 'ÉTÉ', 0.24, 'rgba(255,255,255,0)', { ...B, uppercase: true, role: NO }),
    tx(0.06, 0.78, 0.88, 'ON Y EST', 0.09, WHITE, { ...B, uppercase: true, letterSpacing: -1, role: NO }),
  ] },
  { id: 'bo-cta', name: 'Gros bouton', cat: 'Promo', style: 'Audacieux', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1), rc(0, 0, 1, 1, '#000000', { opacity: 40 }),
    tx(0.08, 0.28, 0.84, 'PRÊT ?', 0.14, WHITE, { ...B, ...C, uppercase: true, role: NO }),
    tx(0.18, 0.62, 0.64, 'JE M’INSCRIS', 0.042, INK, { ...B, ...C, uppercase: true, letterSpacing: 1.5, bg: LEMON, bgOpacity: 100, radius: 0.08, padH: 0.04, padV: 0.03, role: BD }),
  ] },

  // ═══ RÉTRO ════════════════════════════════════════════════════════════════
  { id: 're-seventies', name: 'Seventies', cat: 'Photo', style: 'Rétro', photos: 1, els: [
    rc(0, 0, 1, 1, CLAY, { role: G }),
    ph(0.1, 0.22, 0.8, 0.5, 0, 0.4),
    tx(0.08, 0.08, 0.84, 'SUNSET', 0.075, CREAM, { ...B, ...C, uppercase: true, letterSpacing: 4, role: OG }),
    tx(0.08, 0.8, 0.84, 'good vibes only', 0.045, CREAM, { ...C, role: OG }),
  ] },
  { id: 're-cartepostale', name: 'Carte postale', cat: 'Photo', style: 'Rétro', photos: 1, els: [
    rc(0, 0, 1, 1, SAND, { role: G }),
    rc(0.08, 0.14, 0.84, 0.62, CREAM, { rotation: 2, radius: 0.006 }),
    ph(0.11, 0.17, 0.78, 0.5, 0, 0),
    tx(0.08, 0.82, 0.84, 'Souvenirs de juillet', 0.05, INK, { ...C, role: OG }),
    tx(0.08, 0.9, 0.84, 'PAR AVION', 0.024, INK, { ...C, uppercase: true, letterSpacing: 4, role: AC }),
  ] },
  { id: 're-grain', name: 'Grain 90s', cat: 'Photo', style: 'Rétro', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1), rc(0, 0, 1, 1, CHOCO, { opacity: 25 }), scrimBas,
    tx(0.07, 0.72, 0.86, 'ARCHIVES', 0.08, LEMON, { ...B, uppercase: true, letterSpacing: 3, role: AC }),
    tx(0.07, 0.85, 0.86, '1994 — le dossier complet', 0.03, WHITE, { role: BD }),
  ] },
  { id: 're-bandes', name: 'Bandes colorées', cat: 'Promo', style: 'Rétro', photos: 1, els: [
    rc(0, 0, 1, 1, BONE, { role: G }),
    rc(0, 0.06, 1, 0.03, RUST, { role: AC }),
    rc(0, 0.1, 1, 0.03, CLAY), rc(0, 0.14, 1, 0.03, GOLD),
    ph(0.1, 0.24, 0.8, 0.46, 0, 0.01),
    tx(0.08, 0.76, 0.84, 'GRANDE VENTE', 0.075, RUST, { ...B, ...C, uppercase: true, role: AC }),
    tx(0.08, 0.88, 0.84, 'du 10 au 20 juin', 0.032, INK, { ...C, role: OG }),
  ] },
  { id: 're-timbre', name: 'Timbre', cat: 'Photo', style: 'Rétro', photos: 1, els: [
    rc(0, 0, 1, 1, SAGE, { role: G }),
    rc(0.16, 0.18, 0.68, 0.5, CREAM, { radius: 0.01 }),
    ph(0.19, 0.21, 0.62, 0.44),
    tx(0.1, 0.75, 0.8, 'DESTINATION', 0.028, INK, { ...C, uppercase: true, letterSpacing: 4, role: OG }),
    tx(0.1, 0.8, 0.8, 'Belgique', 0.07, INK, { ...C, role: OG }),
  ] },
  { id: 're-vinyle', name: 'Cercle vinyle', cat: 'Éditorial', style: 'Rétro', photos: 1, els: [
    rc(0, 0, 1, 1, CHOCO, { role: G }),
    ph(0.18, 0.22, 0.64, 0.48, 0, 0.5),
    tx(0.08, 0.08, 0.84, 'LA PLAYLIST', 0.05, GOLD, { ...B, ...C, uppercase: true, letterSpacing: 3, role: AC }),
    tx(0.08, 0.78, 0.84, 'Nos morceaux de l’été', 0.038, CREAM, { ...C, role: OG }),
  ] },

  // ═══ ÉLÉGANT ══════════════════════════════════════════════════════════════
  { id: 'el-serif', name: 'Serif classique', cat: 'Citation', style: 'Élégant', photos: 0, els: [
    rc(0, 0, 1, 1, BONE, { role: G }),
    tx(0.14, 0.3, 0.72, '“', 0.16, GOLD, { ...C, role: AC }),
    tx(0.14, 0.42, 0.72, 'L’élégance, c’est savoir ce qu’on retire.', 0.055, INK, { ...C, lineHeight: 1.35, role: OG }),
    rc(0.45, 0.68, 0.1, 0.0015, GOLD, { role: AC }),
    tx(0.14, 0.74, 0.72, 'MAISON', 0.026, INK, { ...C, uppercase: true, letterSpacing: 5, role: OG }),
  ] },
  { id: 'el-cadre', name: 'Cadre fin', cat: 'Photo', style: 'Élégant', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1), rc(0, 0, 1, 1, '#000000', { opacity: 20 }),
    rc(0.06, 0.05, 0.88, 0.9, 'rgba(0,0,0,0)', { stroke: '#FFFFFF', strokeWidth: 1.5 }),
    tx(0.12, 0.44, 0.76, 'Collection', 0.04, WHITE, { ...C, role: NO }),
    tx(0.12, 0.5, 0.76, 'PRINTEMPS', 0.07, WHITE, { ...C, uppercase: true, letterSpacing: 6, role: NO }),
  ] },
  { id: 'el-or', name: 'Filet doré', cat: 'Événement', style: 'Élégant', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1), rc(0, 0, 1, 1, '#000000', { opacity: 50 }),
    rc(0.35, 0.28, 0.3, 0.0015, GOLD, { role: AC }),
    tx(0.1, 0.34, 0.8, 'INVITATION', 0.03, GOLD, { ...C, uppercase: true, letterSpacing: 6, role: AC }),
    tx(0.1, 0.42, 0.8, 'Soirée d’ouverture', 0.062, WHITE, { ...C, role: NO }),
    tx(0.1, 0.56, 0.8, '12 juin — 19 h', 0.032, 'rgba(255,255,255,.85)', { ...C, role: BD }),
    rc(0.35, 0.66, 0.3, 0.0015, GOLD, { role: AC }),
  ] },
  { id: 'el-mono', name: 'Monochrome', cat: 'Photo', style: 'Élégant', photos: 1, els: [
    rc(0, 0, 1, 1, '#EDEAE4', { role: G }),
    ph(0.12, 0.1, 0.76, 0.62),
    tx(0.12, 0.78, 0.76, 'ATELIER', 0.028, INK, { uppercase: true, letterSpacing: 5, role: OG }),
    tx(0.12, 0.83, 0.76, 'Le geste et la matière', 0.052, INK, { lineHeight: 1.2, role: OG }),
  ] },
  { id: 'el-arche', name: 'Arche', cat: 'Photo', style: 'Élégant', photos: 1, els: [
    rc(0, 0, 1, 1, BLUSH, { role: G }),
    ph(0.18, 0.14, 0.64, 0.58, 0, 0.32),
    tx(0.1, 0.78, 0.8, 'NOUVEAUTÉ', 0.026, INK, { ...C, uppercase: true, letterSpacing: 5, role: OG }),
    tx(0.1, 0.83, 0.8, 'à découvrir en boutique', 0.04, INK, { ...C, role: OG }),
  ] },
  { id: 'el-signature', name: 'Signature', cat: 'Citation', style: 'Élégant', photos: 0, els: [
    rc(0, 0, 1, 1, CHOCO, { role: G }),
    tx(0.12, 0.34, 0.76, 'Merci pour votre confiance.', 0.058, CREAM, { ...C, lineHeight: 1.3, role: OG }),
    tx(0.12, 0.62, 0.76, 'L’équipe', 0.032, GOLD, { ...C, role: AC }),
  ] },

  // ═══ LUDIQUE ══════════════════════════════════════════════════════════════
  { id: 'lu-pastilles', name: 'Pastilles', cat: 'Liste', style: 'Ludique', photos: 0, els: [
    rc(0, 0, 1, 1, SKY, { role: G }),
    tx(0.08, 0.1, 0.84, '3 astuces', 0.09, INK, { ...B, role: OG }),
    tx(0.08, 0.28, 0.84, 'La première, toute simple', 0.032, INK, { bg: WHITE, bgOpacity: 100, radius: 0.06, padH: 0.04, padV: 0.03, role: BD }),
    tx(0.08, 0.46, 0.84, 'La deuxième, encore mieux', 0.032, INK, { bg: WHITE, bgOpacity: 100, radius: 0.06, padH: 0.04, padV: 0.03, role: BD }),
    tx(0.08, 0.64, 0.84, 'Et la troisième, la meilleure', 0.032, INK, { bg: WHITE, bgOpacity: 100, radius: 0.06, padH: 0.04, padV: 0.03, role: BD }),
  ] },
  { id: 'lu-question', name: 'Question', cat: 'Citation', style: 'Ludique', photos: 0, els: [
    rc(0, 0, 1, 1, LILAC, { role: G }),
    tx(0.1, 0.26, 0.8, 'ET TOI ?', 0.13, INK, { ...B, ...C, uppercase: true, role: OG }),
    tx(0.1, 0.46, 0.8, 'Raconte-nous en commentaire', 0.036, INK, { ...C, lineHeight: 1.35, role: OG }),
    tx(0.28, 0.66, 0.44, '↓', 0.09, INK, { ...C, role: AC }),
  ] },
  { id: 'lu-sticker', name: 'Photo + étiquette', cat: 'Photo', style: 'Ludique', photos: 1, els: [
    rc(0, 0, 1, 1, LEMON, { role: G }),
    ph(0.08, 0.1, 0.84, 0.62, 0, 0.03),
    tx(0.1, 0.62, 0.5, 'NOUVEAU !', 0.045, WHITE, { ...B, ...C, uppercase: true, rotation: -6, bg: CORAL, bgOpacity: 100, radius: 0.06, padH: 0.035, padV: 0.025, role: BD }),
    tx(0.08, 0.8, 0.84, 'On vous montre tout', 0.05, INK, { ...C, ...B, role: OG }),
  ] },
  { id: 'lu-grille4', name: 'Grille 4 photos', cat: 'Collage', style: 'Ludique', photos: 4, els: [
    rc(0, 0, 1, 1, SKY, { role: G }),
    ph(0.06, 0.08, 0.43, 0.33, 0, 0.02), ph(0.51, 0.08, 0.43, 0.33, 1, 0.02),
    ph(0.06, 0.43, 0.43, 0.33, 2, 0.02), ph(0.51, 0.43, 0.43, 0.33, 3, 0.02),
    tx(0.06, 0.82, 0.88, 'LE RÉCAP DU MOIS', 0.055, INK, { ...B, ...C, uppercase: true, role: OG }),
  ] },
  { id: 'lu-avant-apres', name: 'Avant / après', cat: 'Liste', style: 'Ludique', photos: 2, els: [
    rc(0, 0, 1, 1, BONE, { role: G }),
    tx(0.05, 0.07, 0.42, 'AVANT', 0.04, INK, { ...B, ...C, uppercase: true, role: OG }),
    tx(0.53, 0.07, 0.42, 'APRÈS', 0.04, INK, { ...B, ...C, uppercase: true, role: OG }),
    ph(0.05, 0.14, 0.42, 0.62, 0, 0.02), ph(0.53, 0.14, 0.42, 0.62, 1, 0.02),
    tx(0.05, 0.82, 0.9, 'La transformation en une image', 0.036, INK, { ...C, role: OG }),
  ] },
  { id: 'lu-sondage', name: 'Sondage', cat: 'Liste', style: 'Ludique', photos: 0, els: [
    rc(0, 0, 1, 1, CORAL, { role: G }),
    tx(0.08, 0.14, 0.84, 'Team quoi ?', 0.085, WHITE, { ...B, ...C, role: OG }),
    tx(0.14, 0.38, 0.72, 'Option A', 0.04, INK, { ...C, bg: WHITE, bgOpacity: 100, radius: 0.08, padH: 0.04, padV: 0.035, role: BD }),
    tx(0.14, 0.56, 0.72, 'Option B', 0.04, INK, { ...C, bg: WHITE, bgOpacity: 100, radius: 0.08, padH: 0.04, padV: 0.035, role: BD }),
    tx(0.08, 0.82, 0.84, 'Réponds en story !', 0.032, WHITE, { ...C, role: OG }),
  ] },

  // ═══ SCRAPBOOK ════════════════════════════════════════════════════════════
  { id: 'sc-polaroid', name: 'Polaroid', cat: 'Photo', style: 'Scrapbook', photos: 1, els: [
    rc(0, 0, 1, 1, SAND, { role: G }),
    rc(0.14, 0.16, 0.72, 0.62, WHITE, { rotation: -4, radius: 0.008 }),
    ph(0.18, 0.2, 0.64, 0.48, 0, 0),
    tx(0.1, 0.83, 0.8, 'Un mot manuscrit', 0.055, INK, { ...C, role: OG }),
  ] },
  { id: 'sc-pile', name: 'Pile de photos', cat: 'Collage', style: 'Scrapbook', photos: 3, els: [
    rc(0, 0, 1, 1, BONE, { role: G }),
    rc(0.12, 0.14, 0.6, 0.46, WHITE, { rotation: -7, radius: 0.006 }),
    ph(0.15, 0.17, 0.54, 0.36, 0),
    rc(0.28, 0.3, 0.6, 0.46, WHITE, { rotation: 5, radius: 0.006 }),
    ph(0.31, 0.33, 0.54, 0.36, 1),
    tx(0.08, 0.84, 0.84, 'Le week-end en images', 0.045, INK, { ...C, role: OG }),
  ] },
  { id: 'sc-moodboard', name: 'Moodboard', cat: 'Collage', style: 'Scrapbook', photos: 3, els: [
    rc(0, 0, 1, 1, PAPER, { role: G }),
    tx(0.06, 0.05, 0.88, 'MOODBOARD', 0.04, INK, { uppercase: true, letterSpacing: 4, role: OG }),
    ph(0.06, 0.13, 0.52, 0.36, 0, 0.01),
    ph(0.62, 0.13, 0.32, 0.22, 1, 0.01),
    ph(0.62, 0.38, 0.32, 0.22, 2, 0.01),
    rc(0.06, 0.54, 0.14, 0.06, CLAY, { radius: 0.01, role: AC }),
    rc(0.23, 0.54, 0.14, 0.06, SAGE, { radius: 0.01 }),
    rc(0.4, 0.54, 0.14, 0.06, GOLD, { radius: 0.01 }),
    tx(0.06, 0.68, 0.88, 'L’univers de la saison', 0.052, INK, { lineHeight: 1.2, role: OG }),
  ] },
  { id: 'sc-scotch', name: 'Photo scotchée', cat: 'Photo', style: 'Scrapbook', photos: 1, els: [
    rc(0, 0, 1, 1, SAGE, { role: G }),
    rc(0.42, 0.12, 0.16, 0.04, 'rgba(255,255,255,.65)', { rotation: -8 }),
    ph(0.14, 0.15, 0.72, 0.56, 0, 0.004),
    tx(0.08, 0.78, 0.84, 'Dans les coulisses', 0.05, CREAM, { ...C, role: OG }),
  ] },
  { id: 'sc-notes', name: 'Notes collées', cat: 'Liste', style: 'Scrapbook', photos: 1, els: [
    rc(0, 0, 1, 1, PAPER, { role: G }),
    ph(0, 0, 1, 0.5),
    tx(0.08, 0.55, 0.4, 'Une idée', 0.032, INK, { rotation: -4, bg: LEMON, bgOpacity: 100, padH: 0.03, padV: 0.03, role: BD }),
    tx(0.5, 0.64, 0.42, 'Une autre', 0.032, INK, { rotation: 3, bg: BLUSH, bgOpacity: 100, padH: 0.03, padV: 0.03, role: BD }),
    tx(0.14, 0.78, 0.42, 'Et encore une', 0.032, INK, { rotation: -2, bg: SKY, bgOpacity: 100, padH: 0.03, padV: 0.03, role: BD }),
  ] },
  { id: 'sc-journal', name: 'Page de carnet', cat: 'Citation', style: 'Scrapbook', photos: 0, els: [
    rc(0, 0, 1, 1, '#F5F1E6', { role: G }),
    rc(0.1, 0.24, 0.8, 0.0015, 'rgba(20,22,15,.18)'),
    rc(0.1, 0.32, 0.8, 0.0015, 'rgba(20,22,15,.18)'),
    rc(0.1, 0.4, 0.8, 0.0015, 'rgba(20,22,15,.18)'),
    tx(0.1, 0.14, 0.8, 'Pensée du jour', 0.035, INK, { uppercase: true, letterSpacing: 3, role: OG }),
    tx(0.1, 0.24, 0.8, 'Ce qu’on note à la main reste plus longtemps.', 0.048, INK, { lineHeight: 1.6, role: OG }),
  ] },

  // ═══ NATUREL ══════════════════════════════════════════════════════════════
  { id: 'na-sable', name: 'Terre et sable', cat: 'Photo', style: 'Naturel', photos: 1, els: [
    rc(0, 0, 1, 1, SAND, { role: G }),
    ph(0, 0.3, 1, 0.7),
    tx(0.08, 0.09, 0.84, 'Retour à l’essentiel', 0.058, INK, { lineHeight: 1.2, role: OG }),
    tx(0.08, 0.22, 0.84, 'NOTRE DÉMARCHE', 0.024, INK, { uppercase: true, letterSpacing: 4, role: AC }),
  ] },
  { id: 'na-sauge', name: 'Vert sauge', cat: 'Citation', style: 'Naturel', photos: 0, els: [
    rc(0, 0, 1, 1, SAGE, { role: G }),
    tx(0.12, 0.34, 0.76, 'La nature ne se presse pas, et pourtant tout est accompli.', 0.05, MOSS, { ...C, lineHeight: 1.4, role: OG }),
    tx(0.12, 0.68, 0.76, 'LAO TSEU', 0.024, MOSS, { ...C, uppercase: true, letterSpacing: 4, role: OG }),
  ] },
  { id: 'na-organique', name: 'Cercle organique', cat: 'Photo', style: 'Naturel', photos: 1, els: [
    rc(0, 0, 1, 1, MOSS, { role: G }),
    ph(0.14, 0.16, 0.72, 0.54, 0, 0.36),
    tx(0.08, 0.76, 0.84, 'RÉCOLTE', 0.03, SAGE, { ...C, uppercase: true, letterSpacing: 5, role: AC }),
    tx(0.08, 0.82, 0.84, 'Le goût du vrai', 0.055, CREAM, { ...C, role: OG }),
  ] },
  { id: 'na-herbier', name: 'Herbier', cat: 'Collage', style: 'Naturel', photos: 2, els: [
    rc(0, 0, 1, 1, '#EFEDE3', { role: G }),
    ph(0.08, 0.12, 0.4, 0.44, 0, 0.01), ph(0.52, 0.22, 0.4, 0.44, 1, 0.01),
    tx(0.08, 0.72, 0.84, 'Ce que la saison nous donne', 0.046, MOSS, { lineHeight: 1.25, role: OG }),
    rc(0.08, 0.88, 0.16, 0.003, MOSS, { role: AC }),
  ] },
  { id: 'na-recette', name: 'Recette', cat: 'Liste', style: 'Naturel', photos: 1, els: [
    rc(0, 0, 1, 1, '#F3EFE4', { role: G }),
    ph(0, 0, 1, 0.42),
    tx(0.08, 0.47, 0.84, 'La recette', 0.06, MOSS, { role: OG }),
    tx(0.08, 0.58, 0.84, '· Premier ingrédient', 0.03, INK, { role: OG }),
    tx(0.08, 0.65, 0.84, '· Deuxième ingrédient', 0.03, INK, { role: OG }),
    tx(0.08, 0.72, 0.84, '· Troisième ingrédient', 0.03, INK, { role: OG }),
    tx(0.08, 0.86, 0.84, 'À retrouver en boutique', 0.026, MOSS, { uppercase: true, letterSpacing: 2, role: AC }),
  ] },
  { id: 'na-horizon', name: 'Horizon', cat: 'Photo', style: 'Naturel', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1), rc(0, 0, 1, 0.4, '#000000', { scrim: 'top', opacity: 55 }),
    tx(0.08, 0.08, 0.84, 'PRENDRE L’AIR', 0.07, WHITE, { ...B, uppercase: true, letterSpacing: -0.5, lineHeight: 1.05, role: NO }),
    tx(0.08, 0.24, 0.84, 'Nos itinéraires de l’été', 0.03, 'rgba(255,255,255,.85)', { role: BD }),
  ] },

  // ═══ NOCTURNE ═════════════════════════════════════════════════════════════
  { id: 'no-neon', name: 'Néon', cat: 'Événement', style: 'Nocturne', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1), rc(0, 0, 1, 1, '#0A0A14', { opacity: 62 }),
    tx(0.08, 0.3, 0.84, 'AFTERWORK', 0.1, '#5BE9FF', { ...B, ...C, uppercase: true, letterSpacing: 2, role: AC }),
    tx(0.08, 0.48, 0.84, 'tous les mercredis', 0.04, WHITE, { ...C, role: BD }),
    tx(0.24, 0.68, 0.52, 'DÈS 18 H', 0.032, '#0A0A14', { ...B, ...C, uppercase: true, letterSpacing: 2, bg: '#5BE9FF', bgOpacity: 100, radius: 0.06, padH: 0.035, padV: 0.025, role: BD }),
  ] },
  { id: 'no-minuit', name: 'Minuit', cat: 'Citation', style: 'Nocturne', photos: 0, els: [
    rc(0, 0, 1, 1, NOIR, { role: G }),
    tx(0.12, 0.36, 0.76, 'Les meilleures idées arrivent tard.', 0.058, CREAM, { ...C, lineHeight: 1.35, role: OG }),
    rc(0.45, 0.62, 0.1, 0.0015, GOLD, { role: AC }),
  ] },
  { id: 'no-projecteur', name: 'Projecteur', cat: 'Photo', style: 'Nocturne', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1), rc(0, 0, 1, 1, NOIR, { opacity: 55 }),
    tx(0.08, 0.62, 0.84, 'CE SOIR', 0.028, GOLD, { uppercase: true, letterSpacing: 6, role: AC }),
    tx(0.08, 0.68, 0.84, 'Le rendez-vous à ne pas manquer', 0.062, WHITE, { lineHeight: 1.15, role: NO }),
  ] },
  { id: 'no-degrade', name: 'Dégradé nuit', cat: 'Promo', style: 'Nocturne', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1), rc(0, 0.3, 1, 0.7, PLUM, { scrim: 'bottom', opacity: 78 }),
    tx(0.07, 0.7, 0.86, '-40 %', 0.13, WHITE, { ...B, letterSpacing: -2, role: NO }),
    tx(0.07, 0.86, 0.86, 'Ce week-end seulement', 0.034, 'rgba(255,255,255,.85)', { role: BD }),
  ] },
  { id: 'no-carte', name: 'Carte sombre', cat: 'Éditorial', style: 'Nocturne', photos: 1, els: [
    rc(0, 0, 1, 1, NOIR, { role: G }),
    ph(0.07, 0.07, 0.86, 0.5, 0, 0.015),
    tx(0.07, 0.63, 0.86, 'ÉPISODE 07', 0.026, GOLD, { uppercase: true, letterSpacing: 5, role: AC }),
    tx(0.07, 0.69, 0.86, 'Le titre de l’épisode', 0.065, CREAM, { lineHeight: 1.15, role: OG }),
    tx(0.07, 0.88, 0.86, 'Disponible maintenant', 0.028, 'rgba(244,237,228,.65)', { role: OG }),
  ] },
  // ═══ SÉRIE « PRÊT À POSTER » ═══════════════════════════════════════════════
  // Modèles livrés finis, dans les codes actuels des réseaux : gros serif
  // éditorial, aplats francs, collage scotché, duotone, arches rétro, cartes
  // témoignage. Ceux qui portent `stock` arrivent AVEC leur image (banque
  // libre) ; les autres tiennent en pur aplat + typo, sans dépendance.

  { id: 'pp-serif-num', name: 'Nº éditorial', cat: 'Éditorial', style: 'Élégant', photos: 1, els: [
    rc(0, 0, 1, 1, PAPER, { role: G }),
    tx(0.08, 0.07, 0.84, 'Nº 01', 0.032, CLAY, { font: 'Playfair Display', uppercase: true, letterSpacing: 6, role: AC }),
    rc(0.08, 0.115, 0.84, 0.0015, 'rgba(20,22,15,.25)'),
    tx(0.08, 0.15, 0.84, 'Le goût\ndu détail', 0.13, INK, { font: 'Playfair Display', lineHeight: 1.02, role: OG }),
    ph(0.08, 0.42, 0.84, 0.4, 0, 0.002, 'ceramic studio hands'),
    tx(0.08, 0.86, 0.6, 'Reportage · atelier', 0.026, 'rgba(20,22,15,.6)', { uppercase: true, letterSpacing: 4, role: OG }),
    tx(0.68, 0.86, 0.24, '@votrecompte', 0.026, INK, { align: 'right', uppercase: true, letterSpacing: 2, role: OG }),
  ] },

  { id: 'pp-duotone', name: 'Duotone plein cadre', cat: 'Photo', style: 'Audacieux', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1, 0, 0, 'portrait studio fashion'),
    rc(0, 0, 1, 1, PLUM, { opacity: 72, role: G }),
    tx(0.07, 0.3, 0.86, 'ON\nCHANGE\nDE TON', 0.155, LEMON, { font: 'Archivo Black', uppercase: true, lineHeight: 0.95, letterSpacing: -2, role: AC }),
    rc(0.07, 0.79, 0.2, 0.006, LEMON, { role: AC }),
    tx(0.07, 0.83, 0.86, 'Nouvelle collection · en ligne', 0.028, WHITE, { uppercase: true, letterSpacing: 3, role: NO }),
  ] },

  { id: 'pp-tape', name: 'Photo scotchée', cat: 'Collage', style: 'Scrapbook', photos: 1, els: [
    rc(0, 0, 1, 1, BONE, { role: G }),
    rc(0.14, 0.17, 0.72, 0.56, WHITE, { rotation: -3, radius: 0.004 }),
    ph(0.17, 0.2, 0.66, 0.44, 0, 0.002, 'coffee shop counter'),
    tx(0.17, 0.66, 0.66, 'mardi, 8 h 40', 0.03, 'rgba(20,22,15,.55)', { rotation: -3, font: 'Space Grotesk', role: OG }),
    rc(0.4, 0.135, 0.2, 0.035, 'rgba(201,162,39,.55)', { rotation: -7 }),
    rc(0.12, 0.68, 0.16, 0.03, 'rgba(201,162,39,.55)', { rotation: 5 }),
    tx(0.08, 0.79, 0.84, 'Les matins\nqui comptent', 0.085, INK, { ...C, font: 'Playfair Display', lineHeight: 1.05, role: OG }),
  ] },

  { id: 'pp-arche', name: 'Arche rétro', cat: 'Photo', style: 'Rétro', photos: 1, els: [
    rc(0, 0, 1, 1, RUST, { role: G }),
    rc(0.18, 0.1, 0.64, 0.64, CREAM, { radius: 0.32 }),
    ph(0.21, 0.13, 0.58, 0.58, 0, 0.3, 'desert road vintage'),
    rc(0.18, 0.52, 0.64, 0.22, RUST, { role: G }),
    tx(0.08, 0.56, 0.84, 'ÉVASION', 0.115, CREAM, { ...B, ...C, font: 'Bebas Neue', uppercase: true, letterSpacing: 6, role: NO }),
    tx(0.08, 0.72, 0.84, 'Trois jours, zéro réseau', 0.032, 'rgba(244,237,228,.8)', { ...C, role: NO }),
    rc(0.42, 0.8, 0.16, 0.004, CREAM),
  ] },

  { id: 'pp-swipe', name: 'Couverture carrousel', cat: 'Éditorial', style: 'Audacieux', photos: 0, els: [
    rc(0, 0, 1, 1, NOIR, { role: G }),
    rc(0, 0, 1, 0.34, LEMON, { role: AC }),
    tx(0.07, 0.06, 0.86, '3 ERREURS', 0.135, INK, { font: 'Archivo Black', uppercase: true, lineHeight: 1, letterSpacing: -1, role: NO }),
    tx(0.07, 0.22, 0.86, 'qui plombent vos posts', 0.038, INK, { font: 'Space Grotesk', role: NO }),
    tx(0.07, 0.45, 0.86, '01', 0.09, 'rgba(244,237,228,.22)', { font: 'Archivo Black', role: NO }),
    tx(0.07, 0.56, 0.86, 'Vous parlez\nde vous, pas d’eux', 0.062, CREAM, { font: 'Space Grotesk', lineHeight: 1.15, role: OG }),
    tx(0.07, 0.86, 0.5, 'Faites glisser', 0.03, LEMON, { uppercase: true, letterSpacing: 3, role: AC }),
    tx(0.62, 0.845, 0.31, '→', 0.075, LEMON, { align: 'right', role: AC }),
  ] },

  { id: 'pp-avantapres', name: 'Avant / après', cat: 'Photo', style: 'Minimal', photos: 2, els: [
    rc(0, 0, 1, 1, WHITE, { role: G }),
    ph(0.04, 0.14, 0.44, 0.62, 0, 0.01, 'empty living room'),
    ph(0.52, 0.14, 0.44, 0.62, 1, 0.01, 'styled living room interior'),
    tx(0.04, 0.06, 0.44, 'AVANT', 0.036, 'rgba(20,22,15,.45)', { ...C, uppercase: true, letterSpacing: 4, role: OG }),
    tx(0.52, 0.06, 0.44, 'APRÈS', 0.036, INK, { ...B, ...C, uppercase: true, letterSpacing: 4, role: AC }),
    rc(0.495, 0.14, 0.01, 0.62, WHITE),
    tx(0.04, 0.82, 0.92, 'Le même salon, deux heures plus tard', 0.038, INK, { ...C, font: 'DM Sans', role: OG }),
  ] },

  { id: 'pp-grille4', name: 'Grille + pastille', cat: 'Collage', style: 'Ludique', photos: 4, els: [
    rc(0, 0, 1, 1, SKY, { role: G }),
    ph(0.04, 0.06, 0.45, 0.42, 0, 0.02, 'flat lay stationery'),
    ph(0.51, 0.06, 0.45, 0.42, 1, 0.02, 'plant close up'),
    ph(0.04, 0.5, 0.45, 0.42, 2, 0.02, 'textile texture'),
    ph(0.51, 0.5, 0.45, 0.42, 3, 0.02, 'coffee cup top view'),
    tx(0.29, 0.42, 0.42, 'NOS\nFAVORIS', 0.062, INK, { ...B, ...C, font: 'Archivo Black', uppercase: true, lineHeight: 1.05, bg: LEMON, bgOpacity: 100, radius: 0.5, padH: 0.045, padV: 0.045, role: BD }),
  ] },

  { id: 'pp-temoignage', name: 'Témoignage', cat: 'Citation', style: 'Élégant', photos: 1, els: [
    rc(0, 0, 1, 1, SAGE, { role: G }),
    rc(0.08, 0.16, 0.84, 0.6, WHITE, { radius: 0.03 }),
    tx(0.13, 0.2, 0.2, '“', 0.16, SAGE, { font: 'Playfair Display', role: AC }),
    tx(0.13, 0.34, 0.74, 'On a gagné deux journées par semaine. Sans exagérer.', 0.052, INK, { font: 'Playfair Display', lineHeight: 1.3, role: BD }),
    ph(0.13, 0.6, 0.1, 0.075, 0, 0.5, 'professional portrait smiling'),
    tx(0.26, 0.615, 0.5, 'Camille · Studio Neuf', 0.028, INK, { ...B, font: 'DM Sans', role: BD }),
    tx(0.26, 0.65, 0.5, 'cliente depuis 2024', 0.024, 'rgba(20,22,15,.55)', { font: 'DM Sans', role: BD }),
    tx(0.08, 0.85, 0.84, 'Ils nous font confiance', 0.032, CREAM, { ...C, uppercase: true, letterSpacing: 4, role: OG }),
  ] },

  { id: 'pp-ticket', name: 'Billet', cat: 'Événement', style: 'Ludique', photos: 0, els: [
    rc(0, 0, 1, 1, CHOCO, { role: G }),
    rc(0.09, 0.14, 0.82, 0.64, BONE, { radius: 0.02 }),
    rc(0.09, 0.5, 0.82, 0.002, CHOCO, { opacity: 25 }),
    rc(0.055, 0.47, 0.07, 0.07, CHOCO, { radius: 0.5, role: G }),
    rc(0.875, 0.47, 0.07, 0.07, CHOCO, { radius: 0.5, role: G }),
    tx(0.13, 0.19, 0.74, 'PORTES\nOUVERTES', 0.1, CHOCO, { ...B, font: 'Bebas Neue', uppercase: true, lineHeight: 0.98, letterSpacing: 1, role: AC }),
    tx(0.13, 0.38, 0.74, 'Samedi 14 juin · 10 h → 19 h', 0.032, 'rgba(59,42,32,.75)', { font: 'DM Sans', role: BD }),
    tx(0.13, 0.56, 0.36, 'ENTRÉE', 0.024, 'rgba(59,42,32,.5)', { uppercase: true, letterSpacing: 3, role: BD }),
    tx(0.13, 0.6, 0.36, 'Libre', 0.05, CHOCO, { ...B, font: 'DM Sans', role: BD }),
    tx(0.53, 0.56, 0.34, 'LIEU', 0.024, 'rgba(59,42,32,.5)', { uppercase: true, letterSpacing: 3, role: BD }),
    tx(0.53, 0.6, 0.34, '12 rue Basse', 0.038, CHOCO, { ...B, font: 'DM Sans', role: BD }),
    tx(0.09, 0.84, 0.82, '@votrecompte', 0.028, BONE, { ...C, uppercase: true, letterSpacing: 4, role: OG }),
  ] },

  { id: 'pp-prix', name: 'Prix en gros', cat: 'Promo', style: 'Audacieux', photos: 1, els: [
    rc(0, 0, 1, 1, CORAL, { role: G }),
    ph(0.5, 0, 0.5, 1, 0, 0, 'product bottle studio'),
    rc(0, 0, 0.55, 1, CORAL, { role: G }),
    tx(0.06, 0.12, 0.44, 'OFFRE\nDU MOIS', 0.062, WHITE, { ...B, font: 'Archivo Black', uppercase: true, lineHeight: 1.05, role: NO }),
    tx(0.06, 0.34, 0.44, '24', 0.26, WHITE, { font: 'Archivo Black', lineHeight: 0.9, letterSpacing: -6, role: NO }),
    tx(0.06, 0.58, 0.44, '€90 le litre', 0.032, 'rgba(255,255,255,.8)', { font: 'DM Sans', role: NO }),
    rc(0.06, 0.68, 0.3, 0.004, WHITE),
    tx(0.06, 0.74, 0.44, 'Jusqu’au 30 juin,\nen boutique', 0.034, WHITE, { font: 'DM Sans', lineHeight: 1.35, role: NO }),
  ] },

  { id: 'pp-luxe', name: 'Luxe minimal', cat: 'Photo', style: 'Élégant', photos: 1, els: [
    rc(0, 0, 1, 1, WHITE, { role: G }),
    ph(0.18, 0.08, 0.64, 0.52, 0, 0, 'perfume bottle minimal'),
    tx(0.1, 0.67, 0.8, 'ESSENTIEL', 0.055, INK, { ...C, font: 'Playfair Display', uppercase: true, letterSpacing: 12, role: OG }),
    rc(0.44, 0.75, 0.12, 0.001, 'rgba(20,22,15,.35)'),
    tx(0.1, 0.79, 0.8, 'Une pièce, mille usages.', 0.03, 'rgba(20,22,15,.6)', { ...C, font: 'DM Sans', role: OG }),
  ] },

  { id: 'pp-blocs', name: 'Blocs de couleur', cat: 'Éditorial', style: 'Minimal', photos: 1, els: [
    rc(0, 0, 1, 1, BONE, { role: G }),
    rc(0, 0, 1, 0.46, MOSS, { role: AC }),
    ph(0.1, 0.3, 0.8, 0.42, 0, 0.01, 'workspace desk laptop'),
    tx(0.08, 0.08, 0.84, 'MÉTHODE', 0.028, 'rgba(244,237,228,.7)', { uppercase: true, letterSpacing: 6, role: NO }),
    tx(0.08, 0.13, 0.7, 'Travailler moins,\npublier mieux', 0.075, CREAM, { font: 'Space Grotesk', lineHeight: 1.12, role: NO }),
    tx(0.08, 0.78, 0.84, 'Le carnet · épisode 4', 0.03, MOSS, { ...B, uppercase: true, letterSpacing: 3, role: AC }),
    tx(0.08, 0.83, 0.84, 'Trois habitudes qui changent une semaine de production.', 0.032, 'rgba(20,22,15,.7)', { font: 'DM Sans', lineHeight: 1.4, role: OG }),
  ] },

  { id: 'pp-neon', name: 'Néon nocturne', cat: 'Événement', style: 'Nocturne', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1, 0, 0, 'night city neon lights'),
    rc(0, 0, 1, 1, '#0A0A0A', { opacity: 55 }),
    rc(0.08, 0.28, 0.84, 0.44, 'rgba(0,0,0,0)', { stroke: LILAC, strokeWidth: 2, radius: 0.02 }),
    tx(0.1, 0.34, 0.8, 'AFTER\nWORK', 0.14, LILAC, { ...B, ...C, font: 'Bebas Neue', uppercase: true, lineHeight: 0.95, letterSpacing: 4, role: AC }),
    tx(0.1, 0.62, 0.8, 'jeudi · 19 h · rooftop', 0.03, WHITE, { ...C, uppercase: true, letterSpacing: 5, role: NO }),
    tx(0.08, 0.85, 0.84, 'places limitées', 0.026, 'rgba(255,255,255,.6)', { ...C, uppercase: true, letterSpacing: 3, role: NO }),
  ] },

  { id: 'pp-carte', name: 'Carte du jour', cat: 'Liste', style: 'Naturel', photos: 1, els: [
    rc(0, 0, 1, 1, CREAM, { role: G }),
    ph(0, 0, 1, 0.34, 0, 0, 'restaurant table food'),
    rc(0, 0.3, 1, 0.08, CREAM, { role: G }),
    tx(0.08, 0.36, 0.84, 'À LA CARTE', 0.045, MOSS, { ...B, ...C, font: 'Bebas Neue', uppercase: true, letterSpacing: 8, role: AC }),
    tx(0.08, 0.46, 0.6, 'Velouté de courge', 0.038, INK, { font: 'DM Sans', role: OG }),
    tx(0.7, 0.46, 0.22, '9 €', 0.038, INK, { ...B, align: 'right', font: 'DM Sans', role: OG }),
    rc(0.08, 0.515, 0.84, 0.001, 'rgba(20,22,15,.15)'),
    tx(0.08, 0.54, 0.6, 'Poulet fermier, jus au thym', 0.038, INK, { font: 'DM Sans', role: OG }),
    tx(0.7, 0.54, 0.22, '18 €', 0.038, INK, { ...B, align: 'right', font: 'DM Sans', role: OG }),
    rc(0.08, 0.595, 0.84, 0.001, 'rgba(20,22,15,.15)'),
    tx(0.08, 0.62, 0.6, 'Tarte fine aux pommes', 0.038, INK, { font: 'DM Sans', role: OG }),
    tx(0.7, 0.62, 0.22, '8 €', 0.038, INK, { ...B, align: 'right', font: 'DM Sans', role: OG }),
    rc(0.08, 0.78, 0.84, 0.11, MOSS, { radius: 0.02, role: AC }),
    tx(0.08, 0.805, 0.84, 'Réservez au 03 88 00 00 00', 0.032, CREAM, { ...C, font: 'DM Sans', role: NO }),
  ] },

  { id: 'pp-postit', name: 'Trois conseils', cat: 'Liste', style: 'Ludique', photos: 0, els: [
    rc(0, 0, 1, 1, SKY, { role: G }),
    tx(0.08, 0.07, 0.84, '3 conseils\npour tenir\nle rythme', 0.085, NAVY, { font: 'Space Grotesk', lineHeight: 1.1, role: OG }),
    rc(0.08, 0.36, 0.84, 0.16, LEMON, { rotation: -1.5, radius: 0.01, role: AC }),
    tx(0.12, 0.39, 0.76, '01 · Batcher une fois par semaine', 0.036, INK, { rotation: -1.5, font: 'DM Sans', role: BD }),
    rc(0.08, 0.54, 0.84, 0.16, WHITE, { rotation: 1.5, radius: 0.01 }),
    tx(0.12, 0.57, 0.76, '02 · Écrire la légende avant le visuel', 0.036, INK, { rotation: 1.5, font: 'DM Sans', role: BD }),
    rc(0.08, 0.72, 0.84, 0.16, CORAL, { rotation: -1, radius: 0.01, role: AC }),
    tx(0.12, 0.75, 0.76, '03 · Garder un post d’avance', 0.036, WHITE, { rotation: -1, font: 'DM Sans', role: BD }),
  ] },

  { id: 'pp-badge', name: 'Plein cadre + pastille', cat: 'Promo', style: 'Ludique', photos: 1, dark: true, els: [
    ph(0, 0, 1, 1, 0, 0, 'sneakers product shot'),
    rc(0, 0.55, 1, 0.45, '#000000', { scrim: 'bottom', opacity: 65 }),
    tx(0.62, 0.06, 0.32, 'NOUVEAU', 0.038, INK, { ...B, ...C, uppercase: true, rotation: 12, bg: LEMON, bgOpacity: 100, radius: 0.5, padH: 0.035, padV: 0.035, role: BD }),
    tx(0.07, 0.72, 0.86, 'La paire qui\nfait la saison', 0.085, WHITE, { font: 'Archivo Black', lineHeight: 1.05, role: NO }),
    tx(0.07, 0.9, 0.86, 'en ligne dès vendredi', 0.028, 'rgba(255,255,255,.75)', { uppercase: true, letterSpacing: 3, role: NO }),
  ] },

  { id: 'no-steel', name: 'Acier', cat: 'Éditorial', style: 'Nocturne', photos: 1, els: [
    rc(0, 0, 1, 1, STEEL, { role: G }),
    tx(0.07, 0.08, 0.86, 'RAPPORT', 0.075, CREAM, { ...B, uppercase: true, letterSpacing: 3, role: OG }),
    rc(0.07, 0.2, 0.86, 0.002, CREAM, { role: AC }),
    ph(0.07, 0.26, 0.86, 0.5, 0, 0.008),
    tx(0.07, 0.82, 0.86, 'Les chiffres du trimestre', 0.036, CREAM, { role: OG }),
  ] },
];

// ── Aperçu (miniature) ───────────────────────────────────────────────────────
export function LayoutThumb({ tpl, w, h }: { tpl: LayoutTemplate; w: number; h: number }) {
  return (
    <div style={{ position: 'relative', width: w, height: h, overflow: 'hidden', background: '#FFF' }}>
      {tpl.els.map((el, i) => {
        const common: React.CSSProperties = {
          position: 'absolute',
          left: el.x * w, top: el.y * h,
          opacity: (el.opacity ?? 100) / 100,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        };
        if (el.kind === 'photo') {
          return (
            <div key={i} style={{
              ...common, width: el.w * w, height: el.h * h,
              background: 'repeating-linear-gradient(45deg,#C9CCC2,#C9CCC2 4px,#BDC1B6 4px,#BDC1B6 8px)',
              borderRadius: (el.radius ?? 0) * w,
            }} />
          );
        }
        if (el.kind === 'rect') {
          return (
            <div key={i} style={{
              ...common, width: el.w * w, height: el.h * h,
              background: el.scrim
                ? `linear-gradient(to ${el.scrim === 'bottom' ? 'top' : 'bottom'}, ${el.fill}, transparent)`
                : el.fill,
              borderRadius: (el.radius ?? 0) * w,
            }} />
          );
        }
        return (
          <div key={i} style={{
            ...common, width: el.w * w,
            fontSize: Math.max(4, el.size * w),
            color: el.fill,
            fontWeight: el.weight === 'bold' ? 800 : 500,
            textAlign: el.align ?? 'left',
            textTransform: el.uppercase ? 'uppercase' : undefined,
            lineHeight: el.lineHeight ?? 1.2,
            letterSpacing: el.letterSpacing ? el.letterSpacing * (w / 300) : undefined,
            background: el.bg, borderRadius: (el.radius ?? 0) * w,
            padding: el.bg ? `${(el.padV ?? 0) * h}px ${(el.padH ?? 0) * w}px` : undefined,
            overflow: 'hidden',
          }}>{el.text}</div>
        );
      })}
    </div>
  );
}
