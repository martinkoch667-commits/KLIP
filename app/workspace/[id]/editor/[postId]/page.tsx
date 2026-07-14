'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Shape as KonvaShape,
  Stage,
  Star as KonvaStar,
  Text,
} from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ColorPicker from '@/components/ColorPicker';
import SelectionOverlay from '@/components/SelectionOverlay';
import Sidebar from '@/components/Sidebar';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Slide {
  id: string;
  elements: CanvasEl[];
  proxyUrl: string;
  bgOffsetX?: number; // pixel offset of scaled bg image (cover behavior)
  bgOffsetY?: number;
  thumbnail?: string;
  spanGroupId?: string; // regroupe les slides d'un même visuel "étendu" (panorama continu)
  spanIndex?: number;   // position (0 = ancre) dans le groupe, pour recalcul futur éventuel
}

interface BaseEl { id: string; x: number; y: number; rotation: number; opacity: number; }
interface TextEl extends BaseEl {
  type: 'text'; text: string; fontSize: number; fontFamily: string; fontStyle: string;
  textDecoration: string; fill: string; align: string; width: number;
  fillType?: 'color' | 'gradient'; fillTo?: string; fillAngle?: number;
  hasBg: boolean; bgColor: string; bgOpacity: number; cornerRadius: number;
  padding: number; paddingH: number; paddingV: number;
  role?: string;
  maxLines?: number;
  minFontSize?: number;
  maxFontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowOpacity?: number; // 0-100, default 75
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  stroke?: string;
  strokeWidth?: number;
  // Highlight
  highlightEnabled?: boolean;
  highlightColor?: string;
  highlightOpacity?: number; // 0-100, default 80
  highlightBorderRadius?: number; // default 4
  highlightPadding?: number; // default 8
  // Glow
  glowEnabled?: boolean;
  glowColor?: string;
  glowIntensity?: number; // 0-100, default 50
  glowSize?: number; // default 10
  // Hollow
  hollowEnabled?: boolean;
  // Lift
  liftEnabled?: boolean;
  liftColor?: string;
  liftDepth?: number; // default 6
  liftDirection?: string; // 'tl'|'t'|'tr'|'l'|'r'|'bl'|'b'|'br', default 'br'
  // Echo
  echoEnabled?: boolean;
  echoColor?: string;
  echoCount?: number; // 1-5, default 3
  echoOffset?: number; // default 8
  echoFade?: boolean; // default true
}
interface RectEl extends BaseEl { type: 'rect'; width: number; height: number; fill: string; fillType?: 'color' | 'gradient'; fillTo?: string; fillAngle?: number; stroke: string; strokeWidth: number; cornerRadius: number; scrim?: 'bottom' | 'top'; }
interface CircleEl extends BaseEl { type: 'circle'; radius: number; fill: string; fillType?: 'color' | 'gradient'; fillTo?: string; fillAngle?: number; stroke: string; strokeWidth: number; }
interface StarEl extends BaseEl { type: 'star'; numPoints: number; innerRadius: number; outerRadius: number; fill: string; fillType?: 'color' | 'gradient'; fillTo?: string; fillAngle?: number; stroke: string; strokeWidth: number; }
interface AnchorPoint { x: number; y: number; cpIn?: { x: number; y: number }; cpOut?: { x: number; y: number }; }
interface VectorEl extends BaseEl { type: 'vector'; shape: 'rectangle'|'circle'|'triangle'|'star'|'pill'|'arrow'|'diamond'|'hexagon'|'custom'; width: number; height: number; fill: string; fillType?: 'color'|'none'|'image'|'gradient'; fillTo?: string; fillAngle?: number; stroke: string; strokeWidth: number; points?: AnchorPoint[]; closed?: boolean; imageSrc?: string; imageOffsetX?: number; imageOffsetY?: number; }
interface ImageEl extends BaseEl { type: 'image'; src: string; width: number; height: number; cropX?: number; cropY?: number; naturalW?: number; naturalH?: number;
  // Ajustements colorimétriques (chacun -100..100, 0 = neutre ; flou 0..100)
  adjBrightness?: number; adjContrast?: number; adjSaturation?: number; adjWarmth?: number; adjTint?: number; adjBlur?: number; }
type CanvasEl = TextEl | RectEl | CircleEl | StarEl | VectorEl | ImageEl;

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Template background ──────────────────────────────────────────────────────

interface BgStyle {
  type: 'gradient' | 'solid';
  color?: string;
  angle?: number;
  colorFrom?: string;
  colorTo?: string;
}

const PHOTO_PLACEHOLDER_SRC = '__PHOTO_PLACEHOLDER__';

// Props de dégradé linéaire Konva génériques, réutilisables sur n'importe quelle
// forme (Rect/Circle/Star/Text/KonvaShape) — même géométrie angle->points que
// BgStyleLayer, appliquée à la boîte englobante locale de l'élément (w×h).
function gradientFillProps(w: number, h: number, angle: number, colorFrom: string, colorTo: string) {
  const angleRad = (angle * Math.PI) / 180;
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  return {
    fillLinearGradientStartPoint: { x: w * Math.max(0, -dx), y: h * Math.max(0, -dy) },
    fillLinearGradientEndPoint: { x: w * Math.max(0, dx), y: h * Math.max(0, dy) },
    fillLinearGradientColorStops: [0, colorFrom, 1, colorTo],
  };
}
// Variante pour formes centrées sur leur origine locale (Circle/Star dans Konva).
function gradientFillPropsCentered(r: number, angle: number, colorFrom: string, colorTo: string) {
  const angleRad = (angle * Math.PI) / 180;
  const dx = Math.cos(angleRad) * r;
  const dy = Math.sin(angleRad) * r;
  return {
    fillLinearGradientStartPoint: { x: -dx, y: -dy },
    fillLinearGradientEndPoint: { x: dx, y: dy },
    fillLinearGradientColorStops: [0, colorFrom, 1, colorTo],
  };
}

function BgStyleLayer({ bgStyle, w, h }: { bgStyle: BgStyle; w: number; h: number }) {
  if (bgStyle.type === 'solid') {
    return <Rect x={0} y={0} width={w} height={h} fill={bgStyle.color ?? '#ffffff'} listening={false} />;
  }
  const angleDeg = bgStyle.angle ?? 135;
  const angleRad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  const startX = w * Math.max(0, -dx);
  const startY = h * Math.max(0, -dy);
  const endX   = w * Math.max(0,  dx);
  const endY   = h * Math.max(0,  dy);
  return (
    <Rect
      x={0} y={0} width={w} height={h} listening={false}
      fillLinearGradientStartPoint={{ x: startX, y: startY }}
      fillLinearGradientEndPoint={{ x: endX, y: endY }}
      fillLinearGradientColorStops={[0, bgStyle.colorFrom ?? '#0038FF', 1, bgStyle.colorTo ?? '#ffffff']}
    />
  );
}

const FONTS = [
  'Anton', 'Oswald', 'Bebas Neue', 'Montserrat', 'Syne', 'Inter', 'Poppins',
  'Barlow Condensed', 'Raleway', 'Roboto Condensed', 'Playfair Display', 'Lato',
  'Nunito', 'Work Sans', 'DM Sans', 'Space Grotesk', 'Archivo Black',
  'Fjalla One', 'Exo 2', 'Ubuntu',
];

const FORMATS = [
  { id: 'ig-portrait', label: 'Portrait 4:5',  sub: '1080×1350', w: 448, h: 560 },
  { id: 'ig-square',   label: 'Carré',          sub: '1080×1080', w: 560, h: 560 },
  { id: 'ig-story',    label: 'Story',           sub: '1080×1920', w: 315, h: 560 },
  { id: 'facebook',    label: 'Facebook Post',   sub: '1200×630',  w: 560, h: 294 },
];

// Filtres photo prédéfinis — mêmes 6 presets que le module Montage vidéo (constants.ts
// FILTERS), réexprimés en réglages adj* (l'éditeur n'a pas de pipeline CSS filter/sepia/
// hue-rotate natif côté Konva, seulement luminosité/contraste/saturation/chaleur/teinte).
const PHOTO_FILTER_PRESETS: { id: string; name: string; values: Partial<Record<'adjBrightness' | 'adjContrast' | 'adjSaturation' | 'adjWarmth' | 'adjTint', number>> }[] = [
  { id: 'none',   name: 'Aucun',      values: {} },
  { id: 'chaud',  name: 'Chaud',      values: { adjWarmth: 30, adjSaturation: 15, adjContrast: 4 } },
  { id: 'doux',   name: 'Doux',       values: { adjBrightness: 5, adjContrast: -4, adjSaturation: -8 } },
  { id: 'froid',  name: 'Froid',      values: { adjWarmth: -25, adjSaturation: 5, adjBrightness: 2 } },
  { id: 'argent', name: 'Argentique', values: { adjWarmth: 20, adjSaturation: -15, adjContrast: 8 } },
  { id: 'nb',     name: 'N&B',        values: { adjSaturation: -100, adjContrast: 10 } },
];

function newId() { return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function measureTextWidth(text: string, fontSize: number, fontFamily: string, fontStyle = 'bold'): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.6;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * fontSize * 0.6;
  ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

// ─── Auto-fit (Phase 2) ──────────────────────────────────────────────────────
// Nombre de lignes autorisé par défaut selon le rôle du slot.
function roleMaxLines(role?: string): number {
  switch (role) {
    case 'titre':       return 2;
    case 'sous-titre':  return 2;
    case 'accroche':    return 2;
    case 'cta':         return 1;
    case 'tag':         return 1;
    case 'prix':        return 1;
    case 'corps':       return 6;
    default:            return 3;
  }
}
// Compte de lignes en SIMULANT le retour à la ligne par mots de Konva (wrap="word").
// L'ancienne estimation ceil(largeurTotale/areaW) était un MINORANT : Konva coupe aux
// mots, donc peut produire PLUS de lignes (ex. "NOUVELLE COCCINELLE" -> 2 lignes) et le
// bloc/hitbox se retrouvait trop court -> lignes basses non cliquables. On reproduit ici
// l'algorithme glouton de Konva pour obtenir la hauteur réelle.
function countLines(text: string, fontSize: number, font: string, fontStyle: string, areaW: number): number {
  const w = Math.max(1, areaW);
  const spaceW = measureTextWidth(' ', fontSize, font, fontStyle);
  let lines = 0;
  for (const para of text.split('\n')) {
    const words = para.split(' ');
    let lineW = 0;
    let paraLines = 1;
    for (const word of words) {
      const wordW = measureTextWidth(word, fontSize, font, fontStyle);
      if (wordW > w) {
        // Mot plus large que la zone : Konva le coupe par caractères.
        if (lineW > 0) { paraLines++; lineW = 0; }
        paraLines += Math.ceil(wordW / w) - 1;
        lineW = wordW % w;
        continue;
      }
      const add = lineW === 0 ? wordW : lineW + spaceW + wordW;
      if (add > w && lineW > 0) { paraLines++; lineW = wordW; }
      else { lineW = add; }
    }
    lines += paraLines;
  }
  return Math.max(1, lines);
}
// Calcule la taille de police qui fait tenir le texte dans sa largeur + maxLines.
// Ne change QUE la taille (jamais police ni couleur). Ne fait que réduire (max = taille du design).
function autoFitFontSize(el: TextEl): number {
  if (!el.text || !el.width || !el.role) return el.fontSize;
  const maxFs = el.maxFontSize ?? el.fontSize;
  const minFs = el.minFontSize ?? Math.max(12, Math.round(el.fontSize * 0.5));
  const maxLines = el.maxLines ?? roleMaxLines(el.role);
  const pH = el.paddingH ?? el.padding ?? 0;
  const areaW = Math.max(1, el.width - pH * 2);
  const txt = el.uppercase ? el.text.toUpperCase() : el.text;
  const fits = (fs: number) => countLines(txt, fs, el.fontFamily, el.fontStyle, areaW) <= maxLines;
  if (fits(maxFs)) return maxFs;           // tient déjà à la taille du design
  let lo = minFs, hi = maxFs, best = minFs;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return best;
}
// Applique l'auto-fit à tous les calques texte (slots) d'une liste d'éléments.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAutoFit(elements: any[]): any[] {
  if (!Array.isArray(elements)) return elements;
  return elements.map(el => {
    if (el?.type !== 'text' || !el.role) return el;
    const fs = autoFitFontSize(el as TextEl);
    return fs !== el.fontSize ? { ...el, fontSize: fs } : el;
  });
}

// Re-layout complet des slots texte pour un format donné :
// 1) clamp largeur dans le cadre  2) auto-fit taille  3) anti-chevauchement vertical
// 4) remontée du bloc s'il dépasse le bas. Tourne au chargement ET au changement de format.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function relayoutText(elements: any[], stageW: number, stageH: number): any[] {
  if (!Array.isArray(elements)) return elements;
  const margin = 26, gap = 10;
  // 1 + 2 : clamp largeur + auto-fit (slots uniquement)
  const els = elements.map(el => {
    if (el?.type !== 'text' || !el.role) return el;
    const x = Math.max(0, Math.min(el.x ?? 0, stageW - 60));
    const maxW = Math.max(60, stageW - x - margin);
    const width = Math.min(el.width ?? maxW, maxW);
    const withW = { ...el, x, width };
    return { ...withW, fontSize: autoFitFontSize(withW as TextEl) };
  });
  // 3 : anti-chevauchement (slots, par ordre vertical)
  const order = els
    .map((e, i) => ({ e, i }))
    .filter(o => o.e?.type === 'text' && o.e.role)
    .sort((a, b) => (a.e.y ?? 0) - (b.e.y ?? 0));
  const heightOf = (e: TextEl) => {
    const pH = e.paddingH ?? e.padding ?? 0;
    const pV = e.paddingV ?? e.padding ?? 0;
    const areaW = Math.max(1, (e.width ?? stageW) - pH * 2);
    const txt = e.uppercase ? (e.text || '').toUpperCase() : (e.text || '');
    const lines = countLines(txt, e.fontSize, e.fontFamily, e.fontStyle, areaW);
    return lines * e.fontSize * (e.lineHeight ?? 1.2) + pV * 2;
  };
  let prevBottom = -Infinity;
  for (const { e, i } of order) {
    const h = heightOf(e as TextEl);
    let y = e.y ?? 0;
    if (y < prevBottom + gap) { y = Math.round(prevBottom + gap); els[i] = { ...els[i], y }; }
    prevBottom = y + h;
  }
  // 4 : si la pile dépasse le bas, on la remonte (sans sortir par le haut)
  const bottomLimit = stageH - margin;
  if (prevBottom > bottomLimit && order.length) {
    const topY = els[order[0].i].y ?? 0;
    const shift = Math.min(prevBottom - bottomLimit, Math.max(0, topY - margin));
    if (shift > 0) for (const { i } of order) els[i] = { ...els[i], y: Math.round((els[i].y ?? 0) - shift) };
  }
  return els;
}

const PT_FORMAT_MAP: Record<string, string> = { post: 'ig-portrait', reel: 'ig-story', story: 'ig-story', carrousel: 'ig-square' };

// Magic Resize — reprojette les éléments d'un format vers un autre. Position (x/y)
// mise à l'échelle indépendamment par axe pour rester proportionnelle au nouveau
// canevas ; tailles/rayons/police mis à l'échelle uniforme (facteur min des deux
// axes) pour éviter les distorsions (cercle qui s'ovalise, texte étiré) — les
// largeurs de texte suivent l'axe X pour occuper une proportion similaire du
// nouveau canevas, relayoutText() corrige ensuite tout débordement.
function remapElementsToFormat(elements: CanvasEl[], oldW: number, oldH: number, newW: number, newH: number): CanvasEl[] {
  const sx = newW / oldW, sy = newH / oldH;
  const s = Math.min(sx, sy);
  return elements.map(el => {
    const x = el.x * sx, y = el.y * sy;
    if (el.type === 'text') {
      return { ...el, x, y, width: el.width * sx, fontSize: Math.max(8, Math.round(el.fontSize * s)) };
    }
    if (el.type === 'rect' || el.type === 'vector' || el.type === 'image') {
      return { ...el, x, y, width: el.width * sx, height: el.height * sy };
    }
    if (el.type === 'circle') {
      return { ...el, x, y, radius: el.radius * s };
    }
    if (el.type === 'star') {
      return { ...el, x, y, innerRadius: el.innerRadius * s, outerRadius: el.outerRadius * s };
    }
    return el;
  });
}

// Formats cibles pour Magic Resize — uniquement les 3 couples post_type/format_id
// avec un mapping retour propre via PT_FORMAT_MAP (le format 'facebook' n'a pas de
// post_type associé : un post créé dans ce format se rechargerait à tort en
// 'ig-portrait', donc on l'exclut volontairement des cibles auto-resize).
const MAGIC_RESIZE_TARGETS: { postType: 'post' | 'carrousel' | 'reel'; formatId: string }[] = [
  { postType: 'post', formatId: 'ig-portrait' },
  { postType: 'carrousel', formatId: 'ig-square' },
  { postType: 'reel', formatId: 'ig-story' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

// Bug 3 fix: object-fit cover behavior + drag-to-reposition
function BgImage({ src, w, h, offsetX = 0, offsetY = 0, draggable = false, onDragEnd, opacity = 1, onSelect }:
  { src: string; w: number; h: number; offsetX?: number; offsetY?: number; draggable?: boolean; onDragEnd?: (x: number, y: number) => void; opacity?: number; onSelect?: () => void }
) {
  const [img] = useImage(src, 'anonymous');
  if (!img) return null;

  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;

  // Fallback to stretch if natural dimensions unknown (prevents broken display)
  if (!natW || !natH) {
    return <KonvaImage image={img} x={0} y={0} width={w} height={h} listening={false} />;
  }

  // object-fit: cover — scale so image fills entire stage
  const scale = Math.max(w / natW, h / natH);
  const scaledW = natW * scale;
  const scaledH = natH * scale;

  // Clamp offset so image always covers the stage (no black bars)
  const clampedX = Math.min(0, Math.max(w - scaledW, offsetX));
  const clampedY = Math.min(0, Math.max(h - scaledH, offsetY));

  return (
    <KonvaImage
      image={img}
      x={clampedX} y={clampedY}
      width={scaledW} height={scaledH}
      listening={draggable || !!onSelect}
      draggable={draggable}
      opacity={opacity}
      onClick={onSelect}
      onTap={onSelect}
      onDragMove={draggable ? (e => {
        const nx = Math.min(0, Math.max(w - scaledW, e.target.x()));
        const ny = Math.min(0, Math.max(h - scaledH, e.target.y()));
        e.target.x(nx); e.target.y(ny);
      }) : undefined}
      onDragEnd={draggable ? (e => {
        onDragEnd?.(e.target.x(), e.target.y());
      }) : undefined}
    />
  );
}

// Filtre colorimétrique personnalisé (un seul passage : luminosité, contraste, chaleur, teinte, saturation)
// Lit les réglages depuis les attributs du nœud Konva (adjBrightness, adjContrast, …).
function AdjustFilter(this: Konva.Node, imageData: ImageData) {
  const d = imageData.data;
  const bright = (Number(this.getAttr('adjBrightness')) || 0) / 100;   // -1..1
  const contrastV = Number(this.getAttr('adjContrast')) || 0;          // -100..100
  const sat = 1 + (Number(this.getAttr('adjSaturation')) || 0) / 100;  // 0..2
  const warmth = (Number(this.getAttr('adjWarmth')) || 0) / 100;       // -1..1
  const tint = (Number(this.getAttr('adjTint')) || 0) / 100;           // -1..1
  const cf = (259 * (contrastV + 255)) / (255 * (259 - contrastV));    // facteur de contraste
  const brightAdd = bright * 255;
  const warmR = warmth * 42, warmB = -warmth * 42, tintG = tint * 42;
  const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    r += brightAdd; g += brightAdd; b += brightAdd;
    r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; b = cf * (b - 128) + 128;
    r += warmR; b += warmB; g += tintG;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + sat * (r - gray); g = gray + sat * (g - gray); b = gray + sat * (b - gray);
    d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
  }
}
const ADJ_FILTERS = [AdjustFilter, Konva.Filters.Blur];

function imageHasAdjustments(el: ImageEl): boolean {
  return !!(el.adjBrightness || el.adjContrast || el.adjSaturation || el.adjWarmth || el.adjTint || el.adjBlur);
}

function ImgNode({ el, onSelect, onChange, onDragStart, onDragMove, onDragEnd, isCropping, locked }: {
  el: ImageEl; onSelect: (shiftKey: boolean) => void; onChange: (u: Partial<ImageEl>) => void;
  onDragStart?: () => void; onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void; onDragEnd?: (x: number, y: number) => void; isCropping?: boolean; locked?: boolean;
}) {
  const [img] = useImage(el.src, 'anonymous');
  const imgRef = useRef<Konva.Image>(null);
  const hasAdj = imageHasAdjustments(el);

  // Store natural dimensions once the image is loaded
  useEffect(() => {
    if (img && img.naturalWidth > 0 && !el.naturalW) {
      onChange({ naturalW: img.naturalWidth, naturalH: img.naturalHeight });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);

  // (Re)met en cache le nœud pour appliquer/rafraîchir les filtres colorimétriques
  useEffect(() => {
    const node = imgRef.current;
    if (!node) return;
    if (hasAdj && img) {
      try { node.cache(); node.getLayer()?.batchDraw(); }
      catch { /* image cross-origin non autorisée : on ignore le filtre */ }
    } else {
      node.clearCache();
      node.getLayer()?.batchDraw();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, hasAdj, el.adjBrightness, el.adjContrast, el.adjSaturation, el.adjWarmth, el.adjTint, el.adjBlur, el.width, el.height]);

  const natW = el.naturalW ?? (img?.naturalWidth || el.width);
  const natH = el.naturalH ?? (img?.naturalHeight || el.height);
  const frameW = el.width;
  const frameH = el.height;
  const scale = Math.max(frameW / natW, frameH / natH);
  const scaledW = natW * scale;
  const scaledH = natH * scale;
  const cropX = el.cropX ?? (frameW - scaledW) / 2;
  const cropY = el.cropY ?? (frameH - scaledH) / 2;

  return (
    <Group
      id={el.id}
      x={el.x} y={el.y}
      rotation={el.rotation}
      opacity={el.opacity / 100}
      clipX={0} clipY={0} clipWidth={frameW} clipHeight={frameH}
      draggable={!isCropping && !locked}
      onClick={e => onSelect(e.evt.shiftKey)} onTap={() => onSelect(false)}
      onDragStart={!isCropping ? onDragStart : undefined}
      onDragMove={!isCropping ? onDragMove : undefined}
      onDragEnd={!isCropping ? (e => onDragEnd?.(e.target.x(), e.target.y())) : undefined}
    >
      <KonvaImage
        ref={imgRef}
        image={img}
        x={cropX} y={cropY}
        width={scaledW} height={scaledH}
        filters={hasAdj ? ADJ_FILTERS : undefined}
        adjBrightness={el.adjBrightness || 0}
        adjContrast={el.adjContrast || 0}
        adjSaturation={el.adjSaturation || 0}
        adjWarmth={el.adjWarmth || 0}
        adjTint={el.adjTint || 0}
        blurRadius={el.adjBlur || 0}
        draggable={isCropping}
        onDragMove={isCropping ? (e => {
          const nx = Math.min(0, Math.max(frameW - scaledW, e.target.x()));
          const ny = Math.min(0, Math.max(frameH - scaledH, e.target.y()));
          e.target.x(nx); e.target.y(ny);
        }) : undefined}
        onDragEnd={isCropping ? (e => {
          onChange({ cropX: e.target.x(), cropY: e.target.y() });
        }) : undefined}
        onMouseEnter={isCropping ? (e => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'grab'; }) : undefined}
        onMouseLeave={isCropping ? (e => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }) : undefined}
      />
    </Group>
  );
}

// ─── Vector draw helpers ──────────────────────────────────────────────────────

function buildSvgPath(points: AnchorPoint[], closed: boolean): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cp1 = prev.cpOut ?? { x: prev.x, y: prev.y };
    const cp2 = curr.cpIn ?? { x: curr.x, y: curr.y };
    d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${curr.x} ${curr.y}`;
  }
  if (closed && points.length > 2) {
    const last = points[points.length - 1];
    const first = points[0];
    const cp1 = last.cpOut ?? { x: last.x, y: last.y };
    const cp2 = first.cpIn ?? { x: first.x, y: first.y };
    d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${first.x} ${first.y} Z`;
  }
  return d;
}

function drawCustomPath(ctx: CanvasRenderingContext2D, points: AnchorPoint[], closed: boolean) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cp1 = prev.cpOut ?? { x: prev.x, y: prev.y };
    const cp2 = curr.cpIn ?? { x: curr.x, y: curr.y };
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, curr.x, curr.y);
  }
  if (closed) {
    const last = points[points.length - 1];
    const first = points[0];
    const cp1 = last.cpOut ?? { x: last.x, y: last.y };
    const cp2 = first.cpIn ?? { x: first.x, y: first.y };
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, first.x, first.y);
    ctx.closePath();
  }
}

function drawVectorShape(ctx: CanvasRenderingContext2D, shape: Exclude<VectorEl['shape'], 'custom'>, w: number, h: number) {
  ctx.beginPath();
  switch (shape) {
    case 'rectangle':
      ctx.rect(0, 0, w, h);
      break;
    case 'circle': {
      const rx = w / 2, ry = h / 2;
      ctx.ellipse(rx, ry, rx, ry, 0, 0, Math.PI * 2);
      break;
    }
    case 'triangle':
      ctx.moveTo(w / 2, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
      break;
    case 'star': {
      const cx = w / 2, cy = h / 2;
      const r1 = Math.min(w, h) / 2, r2 = r1 * 0.42;
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? r1 : r2;
        i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.closePath();
      break;
    }
    case 'pill': {
      const r = h / 2;
      ctx.moveTo(r, 0); ctx.lineTo(w - r, 0);
      ctx.arc(w - r, h / 2, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(r, h);
      ctx.arc(r, h / 2, r, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      break;
    }
    case 'arrow': {
      const aw = w * 0.38, ah = h * 0.30;
      ctx.moveTo(0, h / 2 - ah / 2); ctx.lineTo(w - aw, h / 2 - ah / 2);
      ctx.lineTo(w - aw, 0); ctx.lineTo(w, h / 2);
      ctx.lineTo(w - aw, h); ctx.lineTo(w - aw, h / 2 + ah / 2);
      ctx.lineTo(0, h / 2 + ah / 2); ctx.closePath();
      break;
    }
    case 'diamond':
      ctx.moveTo(w / 2, 0); ctx.lineTo(w, h / 2); ctx.lineTo(w / 2, h); ctx.lineTo(0, h / 2); ctx.closePath();
      break;
    case 'hexagon': {
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 6;
        i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.closePath();
      break;
    }
  }
}

function VectorNode({ el, onSelect, onDblClick, onDragStart, onDragMove, onDragEnd, isMaskCrop, onImageOffset, locked }: {
  el: VectorEl; onSelect: (shiftKey: boolean) => void;
  onDblClick?: () => void;
  onDragStart?: () => void; onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void; onDragEnd?: (x: number, y: number) => void;
  isMaskCrop?: boolean; onImageOffset?: (x: number, y: number) => void; locked?: boolean;
}) {
  const [maskImg] = useImage(el.fillType === 'image' && el.imageSrc ? el.imageSrc : '', 'anonymous');

  if (el.fillType === 'image' && el.imageSrc) {
    const natW = maskImg ? (maskImg.naturalWidth || maskImg.width || el.width) : el.width;
    const natH = maskImg ? (maskImg.naturalHeight || maskImg.height || el.height) : el.height;
    const scale = Math.max(el.width / natW, el.height / natH);
    const scaledW = natW * scale;
    const scaledH = natH * scale;
    const offX = el.imageOffsetX ?? (el.width - scaledW) / 2;
    const offY = el.imageOffsetY ?? (el.height - scaledH) / 2;
    const clipFn = (ctx: any) => {
      const c = ctx as CanvasRenderingContext2D;
      if (el.shape === 'custom') drawCustomPath(c, el.points ?? [], el.closed ?? false);
      else drawVectorShape(c, el.shape as Exclude<VectorEl['shape'], 'custom'>, el.width, el.height);
    };
    return (
      <Group
        x={el.x} y={el.y} rotation={el.rotation} opacity={el.opacity / 100}
        clipFunc={clipFn}
        draggable={!isMaskCrop && !locked}
        onClick={e => onSelect(e.evt.shiftKey)} onTap={() => onSelect(false)}
        onDblClick={() => onDblClick?.()}
        onDragStart={!isMaskCrop ? onDragStart : undefined}
        onDragMove={!isMaskCrop ? onDragMove : undefined}
        onDragEnd={!isMaskCrop ? (e => onDragEnd?.(e.target.x(), e.target.y())) : undefined}
      >
        <KonvaImage
          image={maskImg} x={offX} y={offY} width={scaledW} height={scaledH}
          draggable={!!isMaskCrop}
          onDragMove={isMaskCrop ? (e => {
            const nx = Math.min(0, Math.max(el.width - scaledW, e.target.x()));
            const ny = Math.min(0, Math.max(el.height - scaledH, e.target.y()));
            e.target.x(nx); e.target.y(ny);
          }) : undefined}
          onDragEnd={isMaskCrop ? (e => onImageOffset?.(e.target.x(), e.target.y())) : undefined}
          onMouseEnter={isMaskCrop ? (e => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'grab'; }) : undefined}
          onMouseLeave={isMaskCrop ? (e => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default'; }) : undefined}
        />
        {el.strokeWidth > 0 && (
          <KonvaShape
            width={el.width} height={el.height}
            stroke={el.stroke} strokeWidth={el.strokeWidth * 2}
            fill="rgba(0,0,0,0)"
            listening={false}
            sceneFunc={(kctx, shape) => {
              const ctx = (kctx as any)._context as CanvasRenderingContext2D;
              if (el.shape === 'custom') drawCustomPath(ctx, el.points ?? [], el.closed ?? false);
              else drawVectorShape(ctx, el.shape as Exclude<VectorEl['shape'], 'custom'>, shape.width(), shape.height());
              kctx.fillStrokeShape(shape);
            }}
          />
        )}
      </Group>
    );
  }

  const draw = (kctx: any, shape: any) => {
    const ctx = (kctx as any)._context as CanvasRenderingContext2D;
    if (el.shape === 'custom') {
      drawCustomPath(ctx, el.points ?? [], el.closed ?? false);
    } else {
      drawVectorShape(ctx, el.shape as Exclude<VectorEl['shape'], 'custom'>, shape.width(), shape.height());
    }
    kctx.fillStrokeShape(shape);
  };
  return (
    <KonvaShape
      x={el.x} y={el.y}
      width={el.width} height={el.height}
      rotation={el.rotation}
      opacity={el.opacity / 100}
      {...(el.fillType === 'none'
        ? { fill: 'rgba(0,0,0,0)' }
        : el.fillType === 'gradient'
        ? gradientFillProps(el.width, el.height, el.fillAngle ?? 90, el.fill, el.fillTo ?? '#ffffff')
        : { fill: el.fill })}
      stroke={el.stroke}
      strokeWidth={el.strokeWidth}
      draggable={!locked}
      sceneFunc={draw}
      hitFunc={draw}
      onClick={e => onSelect(e.evt.shiftKey)}
      onTap={() => onSelect(false)}
      onDblClick={() => onDblClick?.()}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={e => onDragEnd?.(e.target.x(), e.target.y())}
    />
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  padding: '7px 14px', background: 'var(--sunk)', border: '1px solid var(--line)',
  borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--sans)',
};
const smallBtnStyle: React.CSSProperties = {
  padding: '4px 8px', background: 'var(--sunk)', border: '1px solid var(--line)',
  borderRadius: 4, cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px 0', fontFamily: 'var(--mono)', fontWeight: 800 }}>
      {children}
    </p>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6, fontFamily: 'var(--mono)', fontWeight: 800 }}>{label}</label>
      {children}
    </div>
  );
}

function ColorRow({ label, value, onChange, brandColors }: { label: string; value: string; onChange: (v: string) => void; brandColors?: string[] }) {
  return (
    <PropRow label={label}>
      <ColorPicker value={value} onChange={onChange} brandColors={brandColors} />
    </PropRow>
  );
}

function UnsplashThumb({ src, onAdd, onBg }: { src: string; onAdd: () => void; onBg: () => void }) {
  const T = useTranslations('editor');
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 4, overflow: 'hidden', cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {hovered && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={onAdd} style={{ padding: '4px 8px', background: 'var(--cream)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>{T('addCanvas')}</button>
          <button onClick={onBg} style={{ padding: '4px 8px', background: 'var(--mint)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'var(--mint-ink)' }}>{T('background')}</button>
        </div>
      )}
    </div>
  );
}

function TextProperties({ el, onChange, customFonts, onFontUpload, brandColors, brandFontNames }: { el: TextEl; onChange: (u: Partial<TextEl>) => void; customFonts: { name: string; url: string }[]; onFontUpload: (file: File) => Promise<string>; brandColors?: string[]; brandFontNames?: string[] }) {
  const T = useTranslations('editor');
  const isBold = el.fontStyle.includes('bold');
  const isItalic = el.fontStyle.includes('italic');
  const isUnderline = el.textDecoration === 'underline';
  const toggleBold = () => onChange({ fontStyle: isItalic ? (isBold ? 'italic' : 'bold italic') : (isBold ? 'normal' : 'bold') });
  const toggleItalic = () => onChange({ fontStyle: isBold ? (isItalic ? 'bold' : 'bold italic') : (isItalic ? 'normal' : 'italic') });
  return (
    <>
      <PropRow label={T('content')}>
        <textarea value={el.text} onChange={e => onChange({ text: e.target.value })} rows={3}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--sans)', outline: 'none', background: 'var(--white)', color: 'var(--ink)' }} />
      </PropRow>
      <PropRow label={T('font')}>
        <select value={el.fontFamily} onChange={e => onChange({ fontFamily: e.target.value })}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 13, outline: 'none', background: 'var(--white)', color: 'var(--ink)', fontFamily: `"${el.fontFamily}", sans-serif` }}>
          {brandFontNames && brandFontNames.length > 0 && (
            <optgroup label={T('brandKit')}>
              {brandFontNames.map(f => <option key={f} value={f}>{f}</option>)}
            </optgroup>
          )}
          {customFonts.filter(f => !brandFontNames?.includes(f.name)).length > 0 && (
            <optgroup label={T('myFonts')}>
              {customFonts.filter(f => !brandFontNames?.includes(f.name)).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
            </optgroup>
          )}
          <optgroup label={T('googleFonts')}>
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </optgroup>
        </select>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mono)', fontWeight: 800 }}>
            {T('uploadFont')}
          </label>
          <label style={{ display: 'block', marginTop: 8, background: 'var(--sunk)', border: '1.5px dashed var(--line)', color: 'var(--ink-2)', padding: '10px', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 13 }}>
            {T('uploadFontBtn')}
            <input type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fontName = await onFontUpload(file);
                onChange({ fontFamily: fontName });
              }}
            />
          </label>
        </div>
      </PropRow>
      <PropRow label={T('sizeVal', { n: el.fontSize })}>
        <input type="range" min={8} max={120} value={el.fontSize} onChange={e => onChange({ fontSize: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
      <PropRow label={T('styleLabel')}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ label: 'G', title: T('bold'), active: isBold, fn: toggleBold }, { label: 'I', title: T('italic'), active: isItalic, fn: toggleItalic }, { label: 'S', title: T('underline'), active: isUnderline, fn: () => onChange({ textDecoration: isUnderline ? '' : 'underline' }) }].map(({ label, title, active, fn }) => (
            <button key={label} onClick={fn} title={title}
              style={{ flex: 1, padding: '7px 6px', border: 'none', borderRadius: 'var(--r-s)', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: active ? 'var(--mint)' : 'var(--sunk)', color: active ? 'var(--mint-ink)' : 'var(--ink-2)', boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--line)' }}>
              {label}
            </button>
          ))}
        </div>
      </PropRow>
      <PropRow label={T('alignment')}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['left', 'center', 'right'] as const).map(a => (
            <button key={a} onClick={() => onChange({ align: a })}
              style={{ flex: 1, padding: '7px 6px', border: 'none', borderRadius: 'var(--r-s)', cursor: 'pointer', fontSize: 13, background: el.align === a ? 'var(--mint)' : 'var(--sunk)', color: el.align === a ? 'var(--mint-ink)' : 'var(--ink-2)', boxShadow: el.align === a ? 'none' : 'inset 0 0 0 1px var(--line)' }}>
              {a === 'left'
                ? <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor"><rect x="0" y="0" width="13" height="2" rx="1"/><rect x="0" y="4.5" width="8" height="2" rx="1"/><rect x="0" y="9" width="10" height="2" rx="1"/></svg>
                : a === 'center'
                ? <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor"><rect x="0" y="0" width="13" height="2" rx="1"/><rect x="2.5" y="4.5" width="8" height="2" rx="1"/><rect x="1.5" y="9" width="10" height="2" rx="1"/></svg>
                : <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor"><rect x="0" y="0" width="13" height="2" rx="1"/><rect x="5" y="4.5" width="8" height="2" rx="1"/><rect x="3" y="9" width="10" height="2" rx="1"/></svg>}
            </button>
          ))}
        </div>
      </PropRow>
      <ColorRow label={T('textColor')} value={el.fill} onChange={v => onChange({ fill: v })} brandColors={brandColors} />
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--mono)', fontWeight: 800 }}>{T('blockBackground')}</span>
          <div onClick={() => onChange({ hasBg: !el.hasBg })}
            style={{ width: 38, height: 22, borderRadius: 11, background: el.hasBg ? 'var(--mint)' : 'var(--line)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 3, left: el.hasBg ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
          </div>
        </div>
        {el.hasBg && (
          <>
            <ColorRow label={T('bgColorLabel')} value={el.bgColor} onChange={v => onChange({ bgColor: v })} brandColors={brandColors} />
            <PropRow label={T('opacityVal', { n: el.bgOpacity })}>
              <input type="range" min={0} max={100} value={el.bgOpacity} onChange={e => onChange({ bgOpacity: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
            </PropRow>
            <PropRow label={T('roundingVal', { n: el.cornerRadius })}>
              <input type="range" min={0} max={50} value={el.cornerRadius} onChange={e => onChange({ cornerRadius: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
            </PropRow>
            <PropRow label={T('paddingHVal', { n: el.paddingH ?? el.padding })}>
              <input type="range" min={0} max={40} value={el.paddingH ?? el.padding} onChange={e => onChange({ paddingH: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
            </PropRow>
            <PropRow label={T('paddingVVal', { n: el.paddingV ?? el.padding })}>
              <input type="range" min={0} max={30} value={el.paddingV ?? el.padding} onChange={e => onChange({ paddingV: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
            </PropRow>
          </>
        )}
      </div>
      <PropRow label={T('opacityVal', { n: el.opacity })}>
        <input type="range" min={0} max={100} value={el.opacity} onChange={e => onChange({ opacity: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
      {/* 4D — IA role for structured generation */}
      <PropRow label={T('aiRole')}>
        <select value={el.role || ''} onChange={e => onChange({ role: e.target.value || undefined })}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 13, outline: 'none', background: 'var(--white)', color: 'var(--ink)' }}>
          <option value="">{T('none')}</option>
          <option value="accroche">{T('roleHook')}</option>
          <option value="titre">{T('roleTitle')}</option>
          <option value="sous-titre">{T('roleSubtitle')}</option>
          <option value="corps">{T('roleBody')}</option>
          <option value="cta">{T('roleCta')}</option>
          <option value="prix">{T('rolePrice')}</option>
        </select>
        {el.role && (
          <span style={{ fontSize: 10, color: 'var(--mint-2)', marginTop: 4, display: 'block', fontFamily: 'var(--mono)', fontWeight: 700 }}>
            {T('aiRoleFillHint')}
          </span>
        )}
      </PropRow>
    </>
  );
}

function ShapeProperties({ el, onChange, brandColors }: { el: RectEl | CircleEl | StarEl; onChange: (u: Partial<typeof el>) => void; brandColors?: string[] }) {
  const T = useTranslations('editor');
  return (
    <>
      <ColorRow label={T('color')} value={el.fill} onChange={v => onChange({ fill: v } as any)} brandColors={brandColors} />
      <ColorRow label={T('borderLabel')} value={el.stroke || '#000000'} onChange={v => onChange({ stroke: v } as any)} brandColors={brandColors} />
      <PropRow label={T('thicknessVal', { n: el.strokeWidth })}>
        <input type="range" min={0} max={10} value={el.strokeWidth} onChange={e => onChange({ strokeWidth: Number(e.target.value) } as any)} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
      {el.type === 'rect' && (
        <PropRow label={T('roundingVal', { n: el.cornerRadius })}>
          <input type="range" min={0} max={50} value={el.cornerRadius} onChange={e => onChange({ cornerRadius: Number(e.target.value) } as any)} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
        </PropRow>
      )}
      <PropRow label={T('opacityVal', { n: el.opacity })}>
        <input type="range" min={0} max={100} value={el.opacity} onChange={e => onChange({ opacity: Number(e.target.value) } as any)} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
    </>
  );
}

function ImageProperties({ el, onChange, onSetBg, onCrop }: { el: ImageEl; onChange: (u: Partial<ImageEl>) => void; onSetBg: () => void; onCrop?: () => void }) {
  const T = useTranslations('editor');
  return (
    <>
      <PropRow label={T('opacityVal', { n: el.opacity })}>
        <input type="range" min={0} max={100} value={el.opacity} onChange={e => onChange({ opacity: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button onClick={onCrop} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
          {T('crop')}
        </button>
        <button onClick={onSetBg} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
          {T('asBackground')}
        </button>
      </div>
    </>
  );
}

// ─── Layer helpers ────────────────────────────────────────────────────────────

const VECTOR_LABELS: Record<VectorEl['shape'], string> = { rectangle: 'Rectangle', circle: 'Rond', triangle: 'Triangle', star: 'Étoile', pill: 'Pilule', arrow: 'Flèche', diamond: 'Losange', hexagon: 'Hexagone', custom: 'Tracé libre' };

function layerName(el: CanvasEl): string {
  if (el.type === 'text') return (el as TextEl).text.slice(0, 18) || 'Texte';
  if (el.type === 'image') return 'Image';
  if (el.type === 'rect') return 'Rectangle';
  if (el.type === 'circle') return 'Cercle';
  if (el.type === 'star') return 'Étoile';
  if (el.type === 'vector') return VECTOR_LABELS[(el as VectorEl).shape] ?? 'Forme';
  return 'Élément';
}

// ─── Context toolbar (floating in topbar center when element selected) ────────

interface CtxToolbarProps {
  sel: CanvasEl;
  allFonts: string[];
  brandColors: string[];
  stageW: number;
  stageH: number;
  onUpdate: (patch: Partial<CanvasEl>) => void;
  onAlign: (dir: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCrop?: () => void;
  onSetBg?: () => void;
  onMaskPhoto?: () => void;
  onRemoveBg?: () => void;
  bgRemoving?: boolean;
  onLayerAction: (action: 'front' | 'forward' | 'backward' | 'back') => void;
  onOpenFx?: (p: 'effects' | 'position') => void;
  fxPanel?: 'effects' | 'position' | null;
}

function EditorContextToolbar({ sel, allFonts, brandColors, stageW, stageH, onUpdate, onAlign, onDuplicate, onDelete, onCrop, onSetBg, onMaskPhoto, onRemoveBg, bgRemoving, onLayerAction, onOpenFx, fxPanel }: CtxToolbarProps) {
  const T = useTranslations('editor');
  const [pop, setPop] = React.useState<string | null>(null);
  const u = (patch: Partial<CanvasEl>) => onUpdate(patch);
  const isText = sel.type === 'text';
  const isShape = sel.type === 'rect' || sel.type === 'circle' || sel.type === 'star' || sel.type === 'vector';
  const isImage = sel.type === 'image';
  const isVector = sel.type === 'vector';
  const textSel = isText ? sel as TextEl : null;
  const rectSel = sel.type === 'rect' ? sel as RectEl : null;
  const vecSel = isVector ? sel as VectorEl : null;

  const Div = () => <span style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 4px', flexShrink: 0 }} />;
  const IBtn = ({ icon, on, title, onClick, danger }: { icon: React.ReactNode; on?: boolean; title: string; onClick: () => void; danger?: boolean }) => (
    <button title={title} onClick={onClick}
      style={{ width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0, border: 'none', cursor: 'pointer', transition: 'background .1s',
        color: danger ? '#C4452F' : on ? 'var(--mint-2)' : 'var(--ink)',
        background: on ? 'var(--mint-soft)' : 'transparent' }}
      onMouseEnter={e => { if (!on && !danger) (e.currentTarget as HTMLElement).style.background = 'var(--sunk)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = on ? 'var(--mint-soft)' : 'transparent'; }}>
      {icon}
    </button>
  );
  const TextBtn = ({ on, onClick, children }: { on?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick}
      style={{ height: 36, padding: '0 11px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0, background: on ? 'var(--mint-soft)' : 'transparent', color: on ? 'var(--mint-2)' : 'var(--ink)' }}
      onMouseEnter={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'var(--sunk)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = on ? 'var(--mint-soft)' : 'transparent'; }}>
      {children}
    </button>
  );
  const SliderRow = ({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span className="label" style={{ marginBottom: 0 }}>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} className="ed-range" style={{ width: '100%', ...rangeFill(value, min, max) }} />
    </div>
  );
  const toggleDecoration = (flag: 'underline' | 'line-through') => {
    if (!textSel) return;
    const cur = textSel.textDecoration ?? '';
    const parts = (['underline', 'line-through'] as const).filter(f => f === flag ? !cur.includes(f) : cur.includes(f));
    u({ textDecoration: parts.join(' ') } as Partial<TextEl>);
  };
  const colorVal = textSel?.fill ?? (vecSel?.fill ?? (sel.type === 'rect' ? (sel as RectEl).fill : sel.type === 'circle' ? (sel as CircleEl).fill : sel.type === 'star' ? (sel as StarEl).fill : '#000'));
  const setFill = (c: string) => {
    if (textSel) u({ fill: c } as Partial<TextEl>);
    else if (isVector) u({ fill: c } as Partial<VectorEl>);
    else if (isShape) u({ fill: c } as Partial<RectEl>);
  };
  const gradSel = (isText || isShape) ? (sel as TextEl | RectEl | CircleEl | StarEl | VectorEl) : null;
  const setFillType = (ft: 'color' | 'gradient') => {
    if (textSel) u({ fillType: ft } as Partial<TextEl>);
    else if (isVector) u({ fillType: ft } as Partial<VectorEl>);
    else if (isShape) u({ fillType: ft } as Partial<RectEl>);
  };
  const setFillTo = (c: string) => {
    if (textSel) u({ fillTo: c } as Partial<TextEl>);
    else if (isVector) u({ fillTo: c } as Partial<VectorEl>);
    else if (isShape) u({ fillTo: c } as Partial<RectEl>);
  };
  const setFillAngle = (a: number) => {
    if (textSel) u({ fillAngle: a } as Partial<TextEl>);
    else if (isVector) u({ fillAngle: a } as Partial<VectorEl>);
    else if (isShape) u({ fillAngle: a } as Partial<RectEl>);
  };

  const popStyle: React.CSSProperties = { position: 'absolute', top: 'calc(100% + 8px)', left: 0, background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 18px 44px -14px rgba(13,15,10,.28), 0 0 0 1px rgba(13,15,10,.06)', zIndex: 100, minWidth: 220 };

  return (
    <div className="pop-in" style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', borderRadius: 14, padding: '7px 12px', boxShadow: '0 8px 26px -10px rgba(13,15,10,.2), 0 0 0 1px rgba(13,15,10,.06)', overflow: 'visible', position: 'relative' }}>

      {/* TEXT controls */}
      {textSel && <>
        {/* Font family */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setPop(p => p === 'font' ? null : 'font')}
            style={{ height: 32, padding: '0 9px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--sunk)', border: 'none', cursor: 'pointer', minWidth: 100, maxWidth: 140 }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: `"${textSel.fontFamily}", sans-serif`, fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{textSel.fontFamily}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {pop === 'font' && (
            <div style={{ ...popStyle, maxHeight: 240, overflowY: 'auto' }}>
              {allFonts.map(f => (
                <button key={f} onClick={() => { u({ fontFamily: f } as Partial<TextEl>); setPop(null); }}
                  style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', borderRadius: 8, width: '100%', background: textSel.fontFamily === f ? 'var(--mint-soft)' : 'transparent', cursor: 'pointer', border: 'none', textAlign: 'left' }}
                  onMouseEnter={e => { if (textSel.fontFamily !== f) (e.currentTarget as HTMLElement).style.background = 'var(--sunk)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = textSel.fontFamily === f ? 'var(--mint-soft)' : 'transparent'; }}>
                  <span style={{ fontFamily: `"${f}", sans-serif`, fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{f}</span>
                  {textSel.fontFamily === f && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--mint-2)" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 'auto' }}><path d="M4 12.5l5 5 11-11"/></svg>}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Size stepper */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--sunk)', borderRadius: 8, height: 32, marginLeft: 4, flexShrink: 0 }}>
          <button onClick={() => u({ fontSize: Math.max(8, textSel.fontSize - 2) } as Partial<TextEl>)} style={{ width: 26, height: 32, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/></svg>
          </button>
          <input type="number" value={textSel.fontSize} onChange={e => { const v = parseInt(e.target.value) || 8; u({ fontSize: Math.min(400, Math.max(8, v)) } as Partial<TextEl>); }}
            style={{ width: 32, textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 700, fontSize: 12.5, outline: 'none', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }} />
          <button onClick={() => u({ fontSize: Math.min(400, textSel.fontSize + 2) } as Partial<TextEl>)} style={{ width: 26, height: 32, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
        <Div />
        {/* Bold */}
        <IBtn title={T('bold')} on={textSel.fontStyle?.includes('bold')}
          onClick={() => u({ fontStyle: textSel.fontStyle?.includes('bold') ? (textSel.fontStyle.includes('italic') ? 'italic' : 'normal') : (textSel.fontStyle?.includes('italic') ? 'bold italic' : 'bold') } as Partial<TextEl>)}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/></svg>} />
        {/* Italic */}
        <IBtn title={T('italic')} on={textSel.fontStyle?.includes('italic')}
          onClick={() => u({ fontStyle: textSel.fontStyle?.includes('italic') ? (textSel.fontStyle.includes('bold') ? 'bold' : 'normal') : (textSel.fontStyle?.includes('bold') ? 'bold italic' : 'italic') } as Partial<TextEl>)}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5h7M6 19h7M14 5l-4 14"/></svg>} />
        {/* Underline */}
        <IBtn title={T('underline')} on={textSel.textDecoration?.includes('underline')}
          onClick={() => toggleDecoration('underline')}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14"/></svg>} />
        {/* Strikethrough */}
        <IBtn title={T('strikethrough')} on={textSel.textDecoration?.includes('line-through')}
          onClick={() => toggleDecoration('line-through')}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M16 4H9a3 3 0 0 0-2.83 4M14 20c-2.8 0-5-1.1-5-4M4 12h16"/></svg>} />
        {/* Case */}
        <IBtn title={textSel.uppercase ? T('lowercase') : T('uppercaseTitle')} on={!!textSel.uppercase}
          onClick={() => u({ uppercase: !textSel.uppercase } as any)}
          icon={<span style={{ fontWeight: 800, fontSize: 11.5, fontFamily: 'system-ui', lineHeight: 1, letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline', gap: 0 }}>A<span style={{ fontSize: 9 }}>a</span></span>} />
        <Div />
        {/* Align cycle */}
        <IBtn title={`Alignement: ${textSel.align}`} on={false}
          onClick={() => u({ align: textSel.align === 'left' ? 'center' : textSel.align === 'center' ? 'right' : 'left' } as Partial<TextEl>)}
          icon={textSel.align === 'center'
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M5 18h14"/></svg>
            : textSel.align === 'right'
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M10 12h10M7 18h13"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h10M4 18h13"/></svg>
          } />
        {/* Spacing (line-height + letter-spacing) */}
        <div style={{ position: 'relative' }}>
          <IBtn title={T('spacing')} on={pop === 'spacing'}
            onClick={() => setPop(p => p === 'spacing' ? null : 'spacing')}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6v.01M3 12v.01M3 18v.01"/></svg>} />
          {pop === 'spacing' && (
            <div style={{ ...popStyle }}>
              <SliderRow label={T('lineHeight')} value={textSel.lineHeight ?? 1.2} min={0.8} max={3} step={0.05}
                fmt={v => v.toFixed(2)} onChange={v => u({ lineHeight: v } as any)} />
              <SliderRow label={T('letterSpacing')} value={textSel.letterSpacing ?? 0} min={-5} max={30} step={0.5}
                fmt={v => (v >= 0 ? '+' : '') + v.toFixed(1) + 'px'} onChange={v => u({ letterSpacing: v } as any)} />
            </div>
          )}
        </div>
        {/* Effets → ouvre le panneau gauche (aperçus façon Canva) */}
        <TextBtn on={fxPanel === 'effects'} onClick={() => onOpenFx?.('effects')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
          {T('effect')}
        </TextBtn>
      </>}

      {/* COLOR — text fill or shape fill */}
      {(isText || isShape) && (
        <ColorPicker value={colorVal} onChange={(c: string) => setFill(c)} brandColors={brandColors} />
      )}

      {/* GRADIENT — dégradé sur texte ou forme (rect/circle/star ; vector a son propre sélecteur plus bas) */}
      {(isText || isShape) && !isVector && gradSel && (
        <div style={{ position: 'relative' }}>
          <IBtn title={T('gradient')} on={gradSel.fillType === 'gradient'} onClick={() => setPop(p => p === 'grad' ? null : 'grad')}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="ed-grad-icon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity="1" /><stop offset="1" stopColor="currentColor" stopOpacity="0.15" /></linearGradient></defs><rect x="3" y="3" width="18" height="18" rx="4" fill="url(#ed-grad-icon)" /></svg>} />
          {pop === 'grad' && (
            <div style={{ ...popStyle, minWidth: 220 }}>
              <div className="label" style={{ marginBottom: 8 }}>{T('fill')}</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {(['color', 'gradient'] as const).map(ft => (
                  <button key={ft} onClick={() => setFillType(ft)}
                    style={{ flex: 1, padding: '6px 4px', borderRadius: 7, border: (gradSel.fillType ?? 'color') === ft ? '2px solid var(--mint-2)' : '1.5px solid var(--line)', cursor: 'pointer', background: (gradSel.fillType ?? 'color') === ft ? 'var(--mint-soft)' : 'var(--sunk)', fontSize: 11, fontWeight: 700, color: (gradSel.fillType ?? 'color') === ft ? 'var(--mint-2)' : 'var(--ink-3)' }}>
                    {ft === 'color' ? 'Couleur unie' : 'Dégradé'}
                  </button>
                ))}
              </div>
              {gradSel.fillType === 'gradient' && <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 4 }}>{T('start')}</div>
                    <ColorPicker value={colorVal} onChange={(c: string) => setFill(c)} brandColors={brandColors} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 4 }}>{T('end')}</div>
                    <ColorPicker value={gradSel.fillTo ?? '#ffffff'} onChange={(c: string) => setFillTo(c)} brandColors={brandColors} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span className="label" style={{ marginBottom: 0 }}>{T('angle')}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{gradSel.fillAngle ?? 90}°</span>
                </div>
                <input type="range" min={0} max={360} step={5} value={gradSel.fillAngle ?? 90} onChange={e => setFillAngle(parseInt(e.target.value))} className="ed-range" style={{ width: '100%', ...rangeFill(gradSel.fillAngle ?? 90, 0, 360) }} />
              </>}
            </div>
          )}
        </div>
      )}

      {/* TEXT background */}
      {textSel && <>
        <IBtn title={textSel.hasBg ? 'Masquer fond' : 'Fond coloré'} on={textSel.hasBg}
          onClick={() => u({ hasBg: !textSel.hasBg } as Partial<TextEl>)}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/></svg>} />
        {textSel.hasBg && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setPop(p => p === 'bg' ? null : 'bg')} title={T('bgOptions')}
              style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', background: pop === 'bg' ? 'var(--sunk)' : 'transparent', border: 'none', cursor: 'pointer' }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, background: textSel.bgColor, boxShadow: 'inset 0 0 0 1.5px rgba(13,15,10,.2)' }} />
            </button>
            {pop === 'bg' && (
              <div style={{ ...popStyle, left: 'auto', right: 0 }}>
                <div className="label" style={{ marginBottom: 8 }}>{T('textBackground')}</div>
                <ColorPicker value={textSel.bgColor} onChange={(c: string) => u({ bgColor: c } as Partial<TextEl>)} brandColors={brandColors} />
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span className="label" style={{ marginBottom: 0 }}>{T('bgOpacity')}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{textSel.bgOpacity}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={1} value={textSel.bgOpacity} onChange={e => u({ bgOpacity: parseInt(e.target.value) } as Partial<TextEl>)} className="ed-range" style={{ width: '100%', ...rangeFill(textSel.bgOpacity, 0, 100) }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, marginBottom: 5 }}>
                    <span className="label" style={{ marginBottom: 0 }}>{T('rounding')}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{textSel.cornerRadius}px</span>
                  </div>
                  <input type="range" min={0} max={50} step={1} value={textSel.cornerRadius} onChange={e => u({ cornerRadius: parseInt(e.target.value) } as Partial<TextEl>)} className="ed-range" style={{ width: '100%', ...rangeFill(textSel.cornerRadius, 0, 50) }} />
                </div>
              </div>
            )}
          </div>
        )}
      </>}

      {/* VECTOR — stroke controls */}
      {vecSel && (
        <div style={{ position: 'relative' }}>
          <IBtn title={T('outline')} on={pop === 'vstroke'}
            onClick={() => setPop(p => p === 'vstroke' ? null : 'vstroke')}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>} />
          {pop === 'vstroke' && (
            <div style={{ ...popStyle, minWidth: 220 }}>
              <div className="label" style={{ marginBottom: 8 }}>{T('outline')}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <ColorPicker value={vecSel.stroke || '#000000'} onChange={c => u({ stroke: c } as Partial<VectorEl>)} />
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{T('colorLower')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span className="label" style={{ marginBottom: 0 }}>{T('thickness')}</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{vecSel.strokeWidth}px</span>
              </div>
              <input type="range" min={0} max={20} step={1} value={vecSel.strokeWidth} onChange={e => u({ strokeWidth: parseInt(e.target.value) } as Partial<VectorEl>)} className="ed-range" style={{ width: '100%', ...rangeFill(vecSel.strokeWidth, 0, 20) }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, marginBottom: 5 }}>
                <span className="label" style={{ marginBottom: 0 }}>{T('fill')}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['color','gradient','none','image'] as const).map(ft => (
                  <button key={ft}
                    onClick={() => ft === 'image' ? (onMaskPhoto?.(), setPop(null)) : u({ fillType: ft } as Partial<VectorEl>)}
                    style={{ flex: 1, padding: '5px 4px', borderRadius: 7, border: vecSel.fillType === ft ? '2px solid var(--mint-2)' : '1.5px solid var(--line)', cursor: 'pointer', background: vecSel.fillType === ft ? 'var(--mint-soft)' : 'var(--sunk)', fontSize: 10.5, fontWeight: 700, color: vecSel.fillType === ft ? 'var(--mint-2)' : 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    {ft === 'color' ? 'Couleur' : ft === 'gradient' ? 'Dégradé' : ft === 'none' ? 'Aucun' : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>{T('photo')}</>}
                  </button>
                ))}
              </div>
              {vecSel.fillType === 'gradient' && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 4 }}>{T('start')}</div>
                      <ColorPicker value={vecSel.fill} onChange={(c: string) => setFill(c)} brandColors={brandColors} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 4 }}>{T('end')}</div>
                      <ColorPicker value={vecSel.fillTo ?? '#ffffff'} onChange={(c: string) => setFillTo(c)} brandColors={brandColors} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span className="label" style={{ marginBottom: 0 }}>{T('angle')}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{vecSel.fillAngle ?? 90}°</span>
                  </div>
                  <input type="range" min={0} max={360} step={5} value={vecSel.fillAngle ?? 90} onChange={e => setFillAngle(parseInt(e.target.value))} className="ed-range" style={{ width: '100%', ...rangeFill(vecSel.fillAngle ?? 90, 0, 360) }} />
                </div>
              )}
              {vecSel.fillType === 'image' && vecSel.imageSrc && (
                <button onClick={() => { onMaskPhoto?.(); setPop(null); }} style={{ marginTop: 8, width: '100%', padding: '5px', borderRadius: 7, border: '1.5px solid var(--line)', cursor: 'pointer', background: 'var(--sunk)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>
                  Changer la photo
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* SHAPE extra — corner radius for rect */}
      {rectSel && (
        <div style={{ position: 'relative' }}>
          <IBtn title={T('rounding')} on={pop === 'radius'}
            onClick={() => setPop(p => p === 'radius' ? null : 'radius')}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>} />
          {pop === 'radius' && (
            <div style={{ ...popStyle }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="label" style={{ marginBottom: 0 }}>{T('rounding')}</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{rectSel.cornerRadius}px</span>
              </div>
              <input type="range" min={0} max={50} step={1} value={rectSel.cornerRadius} onChange={e => u({ cornerRadius: parseInt(e.target.value) } as Partial<RectEl>)} className="ed-range" style={{ width: '100%', ...rangeFill(rectSel.cornerRadius, 0, 50) }} />
            </div>
          )}
        </div>
      )}

      {/* IMAGE controls */}
      {isImage && (() => {
        const imgSel = sel as ImageEl;
        // Retourne du JSX inline (appel de fonction, pas un composant) pour garder le même
        // nœud DOM entre les rendus → le glissement du slider ne se casse pas.
        const adjRow = (label: string, k: 'adjBrightness' | 'adjContrast' | 'adjSaturation' | 'adjWarmth' | 'adjTint' | 'adjBlur', min: number, max: number, unit = '') => {
          const val = (imgSel[k] as number) || 0;
          return (
            <div key={k} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span className="label" style={{ marginBottom: 0 }}>{label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{val > 0 && min < 0 ? '+' : ''}{val}{unit}</span>
              </div>
              <input type="range" min={min} max={max} step={1} value={val}
                onChange={e => u({ [k]: parseInt(e.target.value) } as Partial<ImageEl>)} className="ed-range" style={{ width: '100%', ...rangeFill(val, min, max) }} />
            </div>
          );
        };
        return <>
          {onSetBg && <button onClick={onSetBg} className="btn btn-ghost btn-sm" style={{ height: 30, flexShrink: 0 }}>{T('asBackground')}</button>}
          {onCrop && <button onClick={onCrop} className="btn btn-ghost btn-sm" style={{ height: 30, flexShrink: 0 }}>{T('crop')}</button>}
          {onRemoveBg && (
            <button onClick={onRemoveBg} disabled={bgRemoving} className="btn btn-ghost btn-sm" style={{ height: 30, flexShrink: 0, opacity: bgRemoving ? 0.6 : 1 }}>
              {bgRemoving ? 'Détourage…' : 'Détourer'}
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <TextBtn on={pop === 'adjust'} onClick={() => setPop(p => p === 'adjust' ? null : 'adjust')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2.4" fill="var(--paper)"/><circle cx="15" cy="12" r="2.4" fill="var(--paper)"/><circle cx="8" cy="18" r="2.4" fill="var(--paper)"/></svg>
              Ajuster
            </TextBtn>
            {pop === 'adjust' && (
              <div style={{ ...popStyle, minWidth: 244 }}>
                <span className="label" style={{ display: 'block', marginBottom: 8 }}>{T('filters')}</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {PHOTO_FILTER_PRESETS.map(p => {
                    const active = PHOTO_FILTER_PRESETS.every(o => o.id !== p.id ? true :
                      (['adjBrightness', 'adjContrast', 'adjSaturation', 'adjWarmth', 'adjTint'] as const)
                        .every(k => ((imgSel[k] as number) || 0) === (p.values[k] ?? 0)));
                    return (
                      <button key={p.id} onClick={() => u({ adjBrightness: 0, adjContrast: 0, adjSaturation: 0, adjWarmth: 0, adjTint: 0, ...p.values } as Partial<ImageEl>)}
                        className="btn btn-ghost btn-sm" style={{ height: 28, padding: '0 10px', fontSize: 11.5, background: active ? 'var(--mint-soft)' : undefined, color: active ? 'var(--mint-2)' : undefined, boxShadow: active ? 'inset 0 0 0 1.5px var(--mint-2)' : undefined }}>
                        {p.name}
                      </button>
                    );
                  })}
                </div>
                <span className="label" style={{ display: 'block', marginBottom: 8 }}>{T('light')}</span>
                {adjRow('Luminosité', 'adjBrightness', -100, 100)}
                {adjRow('Contraste', 'adjContrast', -100, 100)}
                <span className="label" style={{ display: 'block', margin: '12px 0 8px' }}>{T('color')}</span>
                {adjRow('Saturation', 'adjSaturation', -100, 100)}
                {adjRow('Chaleur', 'adjWarmth', -100, 100)}
                {adjRow('Teinte', 'adjTint', -100, 100)}
                <span className="label" style={{ display: 'block', margin: '12px 0 8px' }}>{T('effect')}</span>
                {adjRow('Flou', 'adjBlur', 0, 40, 'px')}
                <button onClick={() => u({ adjBrightness: 0, adjContrast: 0, adjSaturation: 0, adjWarmth: 0, adjTint: 0, adjBlur: 0 } as Partial<ImageEl>)}
                  className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>{T('reset')}</button>
              </div>
            )}
          </div>
        </>;
      })()}

      <Div />

      {/* OPACITY */}
      <div style={{ position: 'relative' }}>
        <IBtn title={`Opacité ${sel.opacity}%`} on={pop === 'opacity'}
          onClick={() => setPop(p => p === 'opacity' ? null : 'opacity')}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h6V3M9 15h6V9M15 21v-6h6" fill="currentColor" stroke="none" opacity=".25"/></svg>} />
        {pop === 'opacity' && (
          <div style={{ ...popStyle, left: 'auto', right: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="label" style={{ marginBottom: 0 }}>{T('opacity')}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{sel.opacity}%</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={sel.opacity} onChange={e => u({ opacity: parseInt(e.target.value) } as Partial<CanvasEl>)} className="ed-range" style={{ width: '100%', ...rangeFill(sel.opacity, 0, 100) }} />
          </div>
        )}
      </div>

      {/* Animer */}
      <div style={{ position: 'relative' }}>
        <TextBtn on={pop === 'anim'} onClick={() => setPop(p => p === 'anim' ? null : 'anim')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 3l14 9-14 9V3z"/></svg>
          Animer
        </TextBtn>
        {pop === 'anim' && (
          <div style={{ ...popStyle, right: 0, left: 'auto', minWidth: 200, textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>{T('comingSoon')}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>{T('animComingSoon')}</div>
          </div>
        )}
      </div>

      {/* Position → ouvre le panneau gauche (organiser + aligner + avancé) */}
      <TextBtn on={fxPanel === 'position'} onClick={() => onOpenFx?.('position')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Position
      </TextBtn>

      <Div />

      {/* DUPLICATE */}
      <IBtn title={T('duplicate')} onClick={onDuplicate}
        icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>} />
      {/* DELETE */}
      <IBtn title={T('delete')} danger onClick={onDelete}
        icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>} />
    </div>
  );
}

// ─── SelectionPill (floats above selected element in canvas space) ─────────────

interface PillProps {
  elX: number; elY: number; elW: number;
  zoom: number;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SelectionPill({ elX, elY, elW, zoom, onDuplicate, onDelete }: PillProps) {
  const T = useTranslations('editor');
  const pillW = 260;
  // La couche d'overlay est mise à l'échelle par `zoom` : on contre-scale la barre
  // pour qu'elle garde une taille constante à l'écran (façon Canva).
  return (
    <div style={{
      position: 'absolute',
      left: elX + elW / 2,
      top: elY - 12 / zoom,
      width: 0,
      height: 0,
      zIndex: 55,
      pointerEvents: 'auto',
    }}>
    <div style={{
      position: 'absolute', left: 0, top: 0, width: pillW,
      transform: `translate(-50%, -100%) scale(${1 / zoom})`,
      transformOrigin: 'center bottom',
    }}>
      <div className="pop-in" style={{
        display: 'flex', alignItems: 'center', gap: 2,
        background: '#fff', borderRadius: 11, padding: '5px 6px',
        boxShadow: '0 10px 30px -8px rgba(13,15,10,.35), 0 0 0 1px rgba(13,15,10,.05)',
      }}>
        {/* Demander à Klip */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px 0 9px', height: 30,
          borderRadius: 8, color: '#14160F', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13,
          whiteSpace: 'nowrap', background: 'linear-gradient(120deg,rgba(47,215,155,.13),rgba(200,241,53,.13))',
          border: 'none', cursor: 'pointer',
        }}>
          <span style={{
            width: 19, height: 19, borderRadius: '50%',
            background: 'conic-gradient(from 120deg,#2FD79B,#C8F135,#2FD79B)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#14160F" strokeWidth="2.2" strokeLinecap="round"><path d="M15 4V2M15 14v-2M8 9h2M20 9h2M17.6 11.6l1.4 1.4M17.6 6.4l1.4-1.4M4 21l10-10"/></svg>
            </span>
          </span>
          Demander à Klip
        </button>
        <span style={{ width: 1, height: 18, background: '#E4E3D7', flexShrink: 0 }} />
        {/* Duplicate */}
        <button onClick={e => { e.stopPropagation(); onDuplicate(); }} title={T('duplicate')}
          style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: '#3a3d33', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F1F0E8')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>
        </button>
        {/* Delete */}
        <button onClick={e => { e.stopPropagation(); onDelete(); }} title={T('delete')}
          style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: '#C4452F', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F1F0E8')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>
        </button>
      </div>
    </div>
    </div>
  );
}

// ─── Panel head (title + optional sub + close button) ─────────────────────────

function PanelHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  const T = useTranslations('editor');
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16 }}>
      <div style={{ minWidth: 0 }}>
        <h3 className="h-title" style={{ fontSize: 17 }}>{title}</h3>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={onClose} title={T('close')}
        style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
      </button>
    </div>
  );
}

// ─── Effets (panneau gauche façon Canva, aperçus visuels) ─────────────────────

// Piste de slider remplie en mint jusqu'au curseur (façon Canva).
function rangeFill(v: number, min: number, max: number): React.CSSProperties {
  const pct = Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  return { background: `linear-gradient(to right, var(--mint-2) ${pct}%, var(--sunk) ${pct}%)` };
}

// Réglage générique (slider + stepper façon Canva) pour les panneaux gauche.
function FxSlider({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const stepBtn: React.CSSProperties = { width: 26, height: 30, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 16, lineHeight: 1, fontWeight: 600 };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))} className="ed-range"
          style={{ flex: 1, minWidth: 0, ...rangeFill(value, min, max) }} />
        <div style={{ display: 'flex', alignItems: 'center', height: 32, borderRadius: 8, border: '1px solid var(--line)', background: '#fff', flexShrink: 0 }}>
          <button type="button" onClick={() => onChange(clamp(value - step))} style={stepBtn}>−</button>
          <span style={{ minWidth: 32, textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5, color: 'var(--ink)' }}>{fmt(value)}</span>
          <button type="button" onClick={() => onChange(clamp(value + step))} style={stepBtn}>+</button>
        </div>
      </div>
    </div>
  );
}

// Les effets sont EXCLUSIFS (comme Canva) : appliquer un effet réinitialise les autres.
const FX_CLEAR = { shadowEnabled: false, glowEnabled: false, hollowEnabled: false, liftEnabled: false, echoEnabled: false, highlightEnabled: false, strokeWidth: 0 } as Partial<TextEl>;

function activeEffectKey(el: TextEl): string {
  if (el.highlightEnabled) return 'background';
  if (el.hollowEnabled) return 'hollow';
  if (el.liftEnabled) return 'lift';
  if (el.echoEnabled) return 'echo';
  if (el.glowEnabled) return (el.strokeWidth ?? 0) > 0 && (el.glowIntensity ?? 0) >= 90 ? 'neon' : 'glow';
  if (el.shadowEnabled) return 'shadow';
  if ((el.strokeWidth ?? 0) > 0) return 'border';
  return 'none';
}

function EffectsPanel({ sel, onUpdate, brandColors, onClose }: { sel: TextEl; onUpdate: (patch: Partial<CanvasEl>) => void; brandColors: string[]; onClose: () => void }) {
  const T = useTranslations('editor');
  const u = (patch: Partial<TextEl>) => onUpdate(patch as Partial<CanvasEl>);
  const active = activeEffectKey(sel);

  // Ordre & libellés calqués sur Canva : O. portée · Brillance · Écho / Bordure · Arrière-plan · Élévation / Creux · Néon
  const presets: { key: string; label: string; patch: Partial<TextEl>; preview: React.CSSProperties }[] = [
    { key: 'shadow',     label: 'O. portée',    patch: { ...FX_CLEAR, shadowEnabled: true, shadowColor: '#000000', shadowOpacity: 55, shadowBlur: 6, shadowOffsetX: 4, shadowOffsetY: 4 }, preview: { textShadow: '3px 3px 2px rgba(0,0,0,.4)' } },
    { key: 'glow',       label: 'Brillance',    patch: { ...FX_CLEAR, glowEnabled: true, glowColor: '#FFD34E', glowIntensity: 70, glowSize: 14 }, preview: { textShadow: '0 0 11px #FFD34E, 0 0 5px #FFD34E' } },
    { key: 'echo',       label: 'Écho',         patch: { ...FX_CLEAR, echoEnabled: true, echoColor: '#B9A3FF', echoCount: 3, echoOffset: 8, echoFade: true }, preview: { textShadow: '6px 6px 0 rgba(185,163,255,.55), 11px 11px 0 rgba(185,163,255,.28)' } },
    { key: 'border',     label: 'Bordure',      patch: { ...FX_CLEAR, stroke: '#14160F', strokeWidth: 3 }, preview: { color: '#fff', WebkitTextStroke: '1.4px #14160F' } as React.CSSProperties },
    { key: 'background', label: 'Arrière-plan', patch: { ...FX_CLEAR, highlightEnabled: true, highlightColor: '#FFE45C', highlightOpacity: 100, highlightBorderRadius: 4, highlightPadding: 8 }, preview: { background: '#FFE45C', padding: '2px 6px', borderRadius: 4, color: '#14160F' } },
    { key: 'lift',       label: 'Élévation',    patch: { ...FX_CLEAR, liftEnabled: true, liftColor: '#000000', liftDepth: 5, liftDirection: 'br' }, preview: { textShadow: '0 6px 6px rgba(0,0,0,.3)' } },
    { key: 'hollow',     label: 'Creux',        patch: { ...FX_CLEAR, hollowEnabled: true, stroke: sel.fill || '#14160F', strokeWidth: 2 }, preview: { color: 'transparent', WebkitTextStroke: '1.4px #14160F' } as React.CSSProperties },
    { key: 'neon',       label: 'Néon',         patch: { ...FX_CLEAR, glowEnabled: true, glowColor: '#2FD79B', glowIntensity: 100, glowSize: 20, stroke: '#2FD79B', strokeWidth: 1 }, preview: { color: '#2FD79B', textShadow: '0 0 8px #2FD79B, 0 0 16px #2FD79B' } },
  ];

  return (
    <div style={{ padding: 18 }}>
      {/* En-tête façon Canva : titre + croix de fermeture */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <h3 className="h-title" style={{ fontSize: 17 }}>{T('effect')}</h3>
        <button onClick={onClose} title={T('close')}
          style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 12px' }}>
        {presets.map(p => {
          const on = active === p.key;
          const dark = p.key === 'neon';
          return (
            <button key={p.key} onClick={() => u(p.patch)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <div style={{ aspectRatio: '1', borderRadius: 10, display: 'grid', placeItems: 'center',
                background: dark ? '#14160F' : (on ? 'var(--mint-soft)' : '#fff'),
                boxShadow: on ? 'inset 0 0 0 2px var(--mint-2)' : 'inset 0 0 0 1px var(--line), 0 1px 3px rgba(20,22,15,.06)',
                transition: 'box-shadow .12s, background .12s' }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--line), 0 3px 10px rgba(20,22,15,.14)'; }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--line), 0 1px 3px rgba(20,22,15,.06)'; }}>
                <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 28, color: dark ? '#fff' : '#14160F', lineHeight: 1, ...p.preview }}>Ag</span>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: on ? 'var(--mint-2)' : 'var(--ink-3)', textAlign: 'center', lineHeight: 1.15 }}>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Réglages fins de l'effet actif */}
      {active !== 'none' && (
        <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 16 }}>

          {active === 'shadow' && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="label" style={{ marginBottom: 0 }}>{T('color')}</span>
              <ColorPicker value={sel.shadowColor ?? '#000000'} onChange={c => u({ shadowColor: c })} brandColors={brandColors} />
            </div>
            <FxSlider label={T('opacity')} value={sel.shadowOpacity ?? 55} min={0} max={100} step={1} fmt={v => v + '%'} onChange={v => u({ shadowOpacity: v })} />
            <FxSlider label={T('blur')} value={sel.shadowBlur ?? 6} min={0} max={30} step={1} fmt={v => v + 'px'} onChange={v => u({ shadowBlur: v })} />
            <FxSlider label={T('offsetX')} value={sel.shadowOffsetX ?? 4} min={-20} max={20} step={1} fmt={v => (v >= 0 ? '+' : '') + v} onChange={v => u({ shadowOffsetX: v })} />
            <FxSlider label={T('offsetY')} value={sel.shadowOffsetY ?? 4} min={-20} max={20} step={1} fmt={v => (v >= 0 ? '+' : '') + v} onChange={v => u({ shadowOffsetY: v })} />
          </>)}

          {active === 'lift' && (
            <FxSlider label={T('depth')} value={sel.liftDepth ?? 5} min={1} max={20} step={1} fmt={v => v + 'px'} onChange={v => u({ liftDepth: v })} />
          )}

          {(active === 'hollow' || active === 'border') && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="label" style={{ marginBottom: 0 }}>{T('color')}</span>
              <ColorPicker value={sel.stroke ?? '#14160F'} onChange={c => u({ stroke: c })} brandColors={brandColors} />
            </div>
            <FxSlider label={T('thickness')} value={sel.strokeWidth ?? 2} min={1} max={20} step={1} fmt={v => v + 'px'} onChange={v => u({ strokeWidth: v })} />
          </>)}

          {active === 'echo' && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="label" style={{ marginBottom: 0 }}>{T('color')}</span>
              <ColorPicker value={sel.echoColor ?? '#B9A3FF'} onChange={c => u({ echoColor: c })} brandColors={brandColors} />
            </div>
            <FxSlider label={T('countLabel')} value={sel.echoCount ?? 3} min={1} max={5} step={1} fmt={v => String(v)} onChange={v => u({ echoCount: v })} />
            <FxSlider label={T('offsetLabel')} value={sel.echoOffset ?? 8} min={1} max={30} step={1} fmt={v => v + 'px'} onChange={v => u({ echoOffset: v })} />
          </>)}

          {(active === 'glow' || active === 'neon') && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="label" style={{ marginBottom: 0 }}>{T('color')}</span>
              <ColorPicker value={sel.glowColor ?? '#FFD34E'} onChange={c => u({ glowColor: c })} brandColors={brandColors} />
            </div>
            <FxSlider label={T('intensity')} value={sel.glowIntensity ?? 70} min={0} max={100} step={1} fmt={v => v + '%'} onChange={v => u({ glowIntensity: v })} />
            <FxSlider label={T('sizeLabel')} value={sel.glowSize ?? 14} min={1} max={40} step={1} fmt={v => v + 'px'} onChange={v => u({ glowSize: v })} />
          </>)}

          {active === 'background' && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="label" style={{ marginBottom: 0 }}>{T('color')}</span>
              <ColorPicker value={sel.highlightColor ?? '#FFE45C'} onChange={c => u({ highlightColor: c })} brandColors={brandColors} />
            </div>
            <FxSlider label={T('opacity')} value={sel.highlightOpacity ?? 100} min={0} max={100} step={1} fmt={v => v + '%'} onChange={v => u({ highlightOpacity: v })} />
            <FxSlider label={T('rounding')} value={sel.highlightBorderRadius ?? 4} min={0} max={20} step={1} fmt={v => v + 'px'} onChange={v => u({ highlightBorderRadius: v })} />
            <FxSlider label={T('thickness')} value={sel.highlightPadding ?? 8} min={0} max={20} step={1} fmt={v => v + 'px'} onChange={v => u({ highlightPadding: v })} />
          </>)}
        </div>
      )}

      {active !== 'none' && (
        <button className="btn btn-dark" onClick={() => u({ ...FX_CLEAR })}
          style={{ width: '100%', marginTop: 18, justifyContent: 'center' }}>
          Retirer l&apos;effet
        </button>
      )}
    </div>
  );
}

// ─── Position (panneau gauche : organiser + aligner + avancé) ──────────────────

// Aperçu miniature d'un calque pour l'onglet « Calques » (façon Canva).
function LayerThumb({ el }: { el: CanvasEl }) {
  if (el.type === 'text') {
    return (
      <span style={{ maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: el.fontFamily, fontWeight: 700, fontSize: 13, color: el.fill || 'var(--ink)', textTransform: el.uppercase ? 'uppercase' : 'none' }}>
        {(el.text || 'Texte').trim() || 'Texte'}
      </span>
    );
  }
  if (el.type === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={el.src} alt="" style={{ height: 34, maxWidth: '90%', objectFit: 'contain', borderRadius: 4 }} />;
  }
  if (el.type === 'vector' && el.imageSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={el.imageSrc} alt="" style={{ height: 34, maxWidth: '90%', objectFit: 'contain', borderRadius: 4 }} />;
  }
  const fill = (el as { fill?: string }).fill || 'var(--ink-3)';
  const round = el.type === 'circle' ? '50%' : el.type === 'vector' && el.shape === 'pill' ? 999 : 6;
  return <span style={{ display: 'block', width: 40, height: 26, background: fill, borderRadius: round }} />;
}

// Liste de calques visuelle (miniatures + drag-to-reorder) façon Canva — partagée
// entre l'onglet Position › Calques et l'onglet Calques de la barre d'outils.
function RailLayerList({ elements, selectedId, hiddenIds, lockedIds, onSelect, onReorder, onToggleHidden, onToggleLocked }: {
  elements: CanvasEl[]; selectedId: string | null; hiddenIds: Set<string>; lockedIds: Set<string>;
  onSelect: (id: string) => void; onReorder: (frontToBackIds: string[]) => void;
  onToggleHidden: (id: string) => void; onToggleLocked: (id: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const order = [...elements].reverse(); // avant → arrière (haut de la liste = premier plan)
  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const ids = order.map(o => o.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    const next = [...ids]; next.splice(from, 1); next.splice(to, 0, dragId);
    onReorder(next);
    setDragId(null); setOverId(null);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {order.map((el) => {
        const isSel = el.id === selectedId;
        const isOver = el.id === overId && dragId !== el.id;
        const isHidden = hiddenIds.has(el.id);
        const isLocked = lockedIds.has(el.id);
        return (
          <div key={el.id} draggable={!isLocked}
            onDragStart={() => setDragId(el.id)}
            onDragOver={e => { e.preventDefault(); if (overId !== el.id) setOverId(el.id); }}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            onDrop={e => { e.preventDefault(); drop(el.id); }}
            onClick={() => { if (!isLocked) onSelect(el.id); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 6px', height: 56, borderRadius: 10, cursor: isLocked ? 'default' : 'pointer', background: isSel ? 'var(--mint-soft)' : 'var(--sunk)', boxShadow: isSel ? 'inset 0 0 0 2px var(--mint-2)' : isOver ? 'inset 0 0 0 2px var(--ink-3)' : 'none', opacity: dragId === el.id ? .4 : isHidden ? .5 : 1, transition: 'box-shadow .12s' }}>
            <span style={{ flexShrink: 0, color: 'var(--ink-3)', cursor: isLocked ? 'default' : 'grab', display: 'grid' }} title="Glisser pour réordonner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
            </span>
            <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
              <LayerThumb el={el} />
            </div>
            <button title={isHidden ? 'Afficher' : 'Masquer'} onClick={e => { e.stopPropagation(); onToggleHidden(el.id); }}
              style={{ width: 26, height: 26, borderRadius: 6, display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer', background: 'transparent', color: isHidden ? 'var(--ink-3)' : 'var(--ink-2)', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--ink) 8%, transparent)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {isHidden
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
            </button>
            <button title={isLocked ? 'Déverrouiller' : 'Verrouiller'} onClick={e => { e.stopPropagation(); onToggleLocked(el.id); }}
              style={{ width: 26, height: 26, borderRadius: 6, display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer', background: 'transparent', color: isLocked ? 'var(--ink-3)' : 'var(--mint-2)', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--ink) 8%, transparent)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {isLocked
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
            </button>
          </div>
        );
      })}
      {order.length === 0 && (
        <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)' }}>Aucun calque pour le moment.</div>
      )}
    </div>
  );
}

function PositionPanel({ sel, stageW, stageH, elements, selectedId, onUpdate, onAlign, onLayerAction, onSelect, onReorderLayers, onClose }: { sel: CanvasEl; stageW: number; stageH: number; elements: CanvasEl[]; selectedId: string | null; onUpdate: (patch: Partial<CanvasEl>) => void; onAlign: (dir: string) => void; onLayerAction: (a: 'front' | 'forward' | 'backward' | 'back') => void; onSelect: (id: string) => void; onReorderLayers: (frontToBackIds: string[]) => void; onClose: () => void }) {
  const T = useTranslations('editor');
  const u = (patch: Partial<CanvasEl>) => onUpdate(patch);
  const [tab, setTab] = useState<'organiser' | 'calques'>('organiser');
  const [lock, setLock] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Dimensions (largeur/hauteur) dérivées selon le type d'élément.
  const w = 'width' in sel ? (sel as { width: number }).width
    : sel.type === 'circle' ? (sel as CircleEl).radius * 2
    : sel.type === 'star' ? (sel as StarEl).outerRadius * 2 : undefined;
  const h = 'height' in sel ? (sel as { height: number }).height
    : sel.type === 'circle' ? (sel as CircleEl).radius * 2
    : sel.type === 'star' ? (sel as StarEl).outerRadius * 2 : undefined;
  const setW = (v: number) => {
    v = Math.max(4, v);
    if (sel.type === 'circle') return u({ radius: v / 2 } as Partial<CanvasEl>);
    if (sel.type === 'star') return u({ outerRadius: v / 2, innerRadius: v / 2 * ((sel as StarEl).innerRadius / (sel as StarEl).outerRadius) } as Partial<CanvasEl>);
    if (lock && w && h) return u({ width: v, height: Math.round(v * h / w) } as Partial<CanvasEl>);
    return u({ width: v } as Partial<CanvasEl>);
  };
  const setH = (v: number) => {
    v = Math.max(4, v);
    if (sel.type === 'circle') return u({ radius: v / 2 } as Partial<CanvasEl>);
    if (sel.type === 'star') return u({ outerRadius: v / 2, innerRadius: v / 2 * ((sel as StarEl).innerRadius / (sel as StarEl).outerRadius) } as Partial<CanvasEl>);
    if (lock && w && h) return u({ height: v, width: Math.round(v * w / h) } as Partial<CanvasEl>);
    return u({ height: v } as Partial<CanvasEl>);
  };

  const Field = ({ label, value, unit, disabled, onChange }: { label: string; value?: number; unit?: string; disabled?: boolean; onChange?: (v: number) => void }) => (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: disabled ? 'var(--sunk)' : 'var(--white)', opacity: disabled ? .6 : 1 }}>
        <input type="number" disabled={disabled} value={value === undefined ? '' : Math.round(value)} onChange={e => onChange?.(parseFloat(e.target.value) || 0)}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--mono)' }} />
        {unit && <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  );

  const order = [...elements].reverse(); // avant → arrière (haut de la liste = premier plan)
  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const ids = order.map(o => o.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    const next = [...ids]; next.splice(from, 1); next.splice(to, 0, dragId);
    onReorderLayers(next);
    setDragId(null); setOverId(null);
  };

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <h3 className="h-title" style={{ fontSize: 18 }}>Position</h3>
        <button onClick={onClose} title={T('close')}
          style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      {/* Onglets Organiser | Calques */}
      <div style={{ display: 'flex', marginBottom: 18, position: 'relative' }}>
        {([['organiser', 'Organiser'], ['calques', 'Calques']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, padding: '9px 0 11px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: tab === id ? 800 : 600, color: tab === id ? 'var(--ink)' : 'var(--ink-3)', borderBottom: tab === id ? '2.5px solid var(--mint-2)' : '2.5px solid var(--line)', transition: 'color .15s' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'organiser' ? (
        <>
          <div className="label" style={{ marginBottom: 8 }}>Organiser</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            {([
              ['forward', 'Avant', <svg key="a" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 4-7 4-7-4 7-4z"/><path d="M5 12l7 4 7-4"/></svg>],
              ['backward', 'Arrière', <svg key="b" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 13l7 4-7 4-7-4 7-4z"/><path d="M5 8l7 4 7-4"/></svg>],
              ['front', 'Avant-plan', <svg key="c" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="9" height="9" rx="1.5" fill="currentColor" fillOpacity=".16"/><path d="M13 16H5a1 1 0 0 1-1-1V8"/></svg>],
              ['back', 'Arrière-plan', <svg key="d" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="9" width="9" height="9" rx="1.5" fill="currentColor" fillOpacity=".16"/><path d="M9 5h8a1 1 0 0 1 1 1v8"/></svg>],
            ] as const).map(([id, label, icon]) => (
              <button key={id} onClick={() => onLayerAction(id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--white)', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}>
                {icon}<span>{label}</span>
              </button>
            ))}
          </div>

          <div className="label" style={{ marginBottom: 8 }}>{T('alignToPage')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            {([
              ['top', 'Haut', <svg key="1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4h16"/><rect x="9" y="8" width="6" height="12" rx="1"/></svg>],
              ['left', 'Gauche', <svg key="2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4v16"/><rect x="8" y="9" width="12" height="6" rx="1"/></svg>],
              ['center-v', 'Centre', <svg key="3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 12h16"/><rect x="9" y="6" width="6" height="12" rx="1"/></svg>],
              ['center-h', 'Centre', <svg key="4" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 4v16"/><rect x="6" y="9" width="12" height="6" rx="1"/></svg>],
              ['bottom', 'Bas', <svg key="5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20h16"/><rect x="9" y="4" width="6" height="12" rx="1"/></svg>],
              ['right', 'Droite', <svg key="6" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 4v16"/><rect x="4" y="9" width="12" height="6" rx="1"/></svg>],
            ] as const).map(([id, label, icon]) => (
              <button key={id} onClick={() => onAlign(id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--white)', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}>
                {icon}<span>{label}</span>
              </button>
            ))}
          </div>

          <div className="label" style={{ marginBottom: 8 }}>Avancé</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            {Field({ label: 'Largeur', value: w, unit: 'px', onChange: setW })}
            {Field({ label: 'Hauteur', value: h, unit: 'px', disabled: sel.type === 'text', onChange: setH })}
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 5 }}>Ratio</div>
              <button onClick={() => setLock(l => !l)} title={lock ? 'Ratio verrouillé' : 'Verrouiller le ratio'}
                style={{ width: '100%', height: 37, display: 'grid', placeItems: 'center', border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer', background: lock ? 'var(--mint-soft)' : 'var(--white)', color: lock ? 'var(--mint-2)' : 'var(--ink-2)' }}>
                {lock
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.9-1"/></svg>}
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {Field({ label: 'X', value: sel.x, unit: 'px', onChange: v => u({ x: v }) })}
            {Field({ label: 'Y', value: sel.y, unit: 'px', onChange: v => u({ y: v }) })}
            {Field({ label: 'Pivoter', value: sel.rotation, unit: '°', onChange: v => u({ rotation: v }) })}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {order.map((el) => {
            const isSel = el.id === selectedId;
            const isOver = el.id === overId && dragId !== el.id;
            return (
              <div key={el.id} draggable
                onDragStart={() => setDragId(el.id)}
                onDragOver={e => { e.preventDefault(); if (overId !== el.id) setOverId(el.id); }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                onDrop={e => { e.preventDefault(); drop(el.id); }}
                onClick={() => onSelect(el.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 6px', height: 56, borderRadius: 10, cursor: 'pointer', background: isSel ? 'var(--mint-soft)' : 'var(--sunk)', boxShadow: isSel ? 'inset 0 0 0 2px var(--mint-2)' : isOver ? 'inset 0 0 0 2px var(--ink-3)' : 'none', opacity: dragId === el.id ? .4 : 1, transition: 'box-shadow .12s' }}>
                <span style={{ flexShrink: 0, color: 'var(--ink-3)', cursor: 'grab', display: 'grid' }} title="Glisser pour réordonner">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
                </span>
                <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                  <LayerThumb el={el} />
                </div>
              </div>
            );
          })}
          {order.length === 0 && (
            <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)' }}>Aucun calque pour le moment.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function VisualEditor({ workspaceId, postId, templateId, mode }: { workspaceId: string; postId?: string; templateId?: string; mode: 'post' | 'template' }) {
  const T = useTranslations('editor');
  const isTemplate = mode === 'template';
  const entityId = postId ?? templateId ?? 'new';

  const supabase = createClientComponentClient();
  const stageRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isKonvaDragging, setIsKonvaDragging] = useState(false);

  // ── Sidebar collapse (persisted in localStorage) ──────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    setSidebarOpen(localStorage.getItem('editorSidebarOpen') !== 'false');
  }, []);
  function toggleSidebar() {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('editorSidebarOpen', String(next));
      return next;
    });
  }
  const [cropId, setCropId] = useState<string | null>(null);
  const [maskCropId, setMaskCropId] = useState<string | null>(null);
  const [bgRemovingId, setBgRemovingId] = useState<string | null>(null);
  const maskPhotoInputRef = useRef<HTMLInputElement>(null);

  const [proxyUrl, setProxyUrl] = useState<string>('');
  const [bgStyle, setBgStyle] = useState<BgStyle | null>(null);
  const [postTemplateId, setPostTemplateId] = useState<string | null>(null);
  const [bgOffsetX, setBgOffsetX] = useState(0);
  const [bgOffsetY, setBgOffsetY] = useState(0);
  const [bgCropMode, setBgCropMode] = useState(false);
  const bgOffsetXRef = useRef(0);
  const bgOffsetYRef = useRef(0);
  useEffect(() => { bgOffsetXRef.current = bgOffsetX; }, [bgOffsetX]);
  useEffect(() => { bgOffsetYRef.current = bgOffsetY; }, [bgOffsetY]);
  const [formatId, setFormatId] = useState('ig-portrait');
  const [postType, setPostType] = useState<'post' | 'reel' | 'story' | 'carrousel'>('post');
  const [editorToast, setEditorToast] = useState<string | null>(null);
  const [showStoryWarn, setShowStoryWarn] = useState(false);
  const [pendingStoryType, setPendingStoryType] = useState<'post' | 'reel' | 'story' | 'carrousel' | null>(null);
  // Carrousel continu (panorama à volets liés) : une seule grande toile éditable de
  // largeur stageW*volets ; les éléments peuvent chevaucher les limites de volets et
  // sont découpés à l'export en slides Instagram séparées.
  const [carouselContinuous, setCarouselContinuous] = useState(false);
  const [contPanels, setContPanels] = useState(2);
  const activeFormat = FORMATS.find(f => f.id === formatId) ?? FORMATS[0];
  const stageW = activeFormat.w;
  const stageH = activeFormat.h;
  const isContinuous = postType === 'carrousel' && carouselContinuous;
  const stageWView = isContinuous ? stageW * contPanels : stageW;
  const [elements, setElements] = useState<CanvasEl[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [guides, setGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });
  const [showGrid, setShowGrid] = useState(false);
  const [extendCount, setExtendCount] = useState(1);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const historyRef = useRef<CanvasEl[][]>([[]]);
  const histIdxRef = useRef(0);
  const [histTick, setHistTick] = useState(0);

  const [showUnsplash, setShowUnsplash] = useState(false);
  const [unsplashQuery, setUnsplashQuery] = useState('');
  const [unsplashPhotos, setUnsplashPhotos] = useState<string[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);

  interface PexelsPhoto { id: number; src: { medium: string; large: string }; photographer: string; alt: string; }
  const [pexelsQuery, setPexelsQuery] = useState('');
  const [pexelsPhotos, setPexelsPhotos] = useState<PexelsPhoto[]>([]);
  const [pexelsPage, setPexelsPage] = useState(1);
  const [pexelsTotalPages, setPexelsTotalPages] = useState(0);
  const [pexelsLoading, setPexelsLoading] = useState(false);

  // Icônes SVG (Iconify) + couleur d'ajout
  const [iconQuery, setIconQuery] = useState('');
  const [iconResults, setIconResults] = useState<string[]>([]);
  const [iconLoading, setIconLoading] = useState(false);
  const [iconColor, setIconColor] = useState('#14160F');

  const elementsRef = useRef<CanvasEl[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const selectedIdsRef = useRef<string[]>([]);
  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { if (selectedId) { setBgCropMode(false); setBgImageSelected(false); setMaskCropId(null); } }, [selectedId]);

  // ── Multi-selection helpers ────────────────────────────────────────────────
  const multiDragStartRef = useRef<Record<string, { x: number; y: number }>>({});

  const handleElClick = (id: string, shiftKey: boolean) => {
    if (lockedIds.has(id)) return;
    if (shiftKey) {
      setSelectedIds(prev => {
        if (prev.includes(id)) {
          const next = prev.filter(x => x !== id);
          setSelectedId(next.at(-1) ?? null);
          return next;
        } else {
          setSelectedId(id);
          return [...prev, id];
        }
      });
    } else {
      setSelectedId(id);
      setSelectedIds([id]);
    }
  };

  const handleElDragStart = (id: string) => {
    setIsKonvaDragging(true);
    const ids = selectedIdsRef.current;
    if (ids.length > 1) {
      const starts: Record<string, { x: number; y: number }> = {};
      for (const sid of ids) {
        const e = elementsRef.current.find(el => el.id === sid);
        if (e) starts[sid] = { x: e.x, y: e.y };
      }
      multiDragStartRef.current = starts;
    }
  };

  const handleElDragEnd = (id: string, x: number, y: number) => {
    setIsKonvaDragging(false);
    setGuides({ v: null, h: null });
    const ids = selectedIdsRef.current;
    if (ids.length > 1 && multiDragStartRef.current[id]) {
      const start = multiDragStartRef.current[id];
      const dx = x - start.x;
      const dy = y - start.y;
      const newEls = elementsRef.current.map(e => {
        if (!ids.includes(e.id)) return e;
        const s = multiDragStartRef.current[e.id];
        return s ? { ...e, x: s.x + dx, y: s.y + dy } : e;
      });
      applyElements(newEls);
    } else {
      updateEl(id, { x, y });
    }
  };

  // ── Carousel slides ───────────────────────────────────────────────────────
  const [slides, setSlides] = useState<Slide[]>([{ id: 'slide-1', elements: [], proxyUrl: '' }]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const slidesRef = useRef<Slide[]>(slides);
  const proxyUrlRef = useRef<string>('');
  useEffect(() => { slidesRef.current = slides; }, [slides]);
  useEffect(() => { proxyUrlRef.current = proxyUrl; }, [proxyUrl]);

  // ── Carousel: save current slide state into slidesRef ────────────────────
  const saveCurrentSlide = () => {
    // Aperçu net des slides inactives (0.3 rendait le plan de travail flou en carrousel).
    const thumbnail = stageRef.current?.toDataURL({ pixelRatio: 1.25 }) ?? undefined;
    const updated = slidesRef.current.map((s, i) =>
      i === activeSlideIdx ? {
        ...s,
        elements: elementsRef.current,
        proxyUrl: proxyUrlRef.current,
        bgOffsetX: bgOffsetXRef.current,
        bgOffsetY: bgOffsetYRef.current,
        thumbnail,
      } : s
    );
    slidesRef.current = updated;
    return updated;
  };

  const switchSlide = (idx: number) => {
    if (idx === activeSlideIdx) return;
    const updated = saveCurrentSlide();
    setSlides(updated);
    const next = updated[idx];
    setElements(next.elements);
    setProxyUrl(next.proxyUrl);
    setBgOffsetX(next.bgOffsetX ?? 0);
    setBgOffsetY(next.bgOffsetY ?? 0);
    setBgCropMode(false);
    setActiveSlideIdx(idx);
    setSelectedId(null);
    setCropId(null);
    historyRef.current = [next.elements];
    histIdxRef.current = 0;
    setHistTick(t => t + 1);
    requestAnimationFrame(() => {
      slideContainerRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const addSlide = () => {
    const updated = saveCurrentSlide();
    const newSlide: Slide = { id: `slide-${Date.now()}`, elements: [], proxyUrl: '' };
    const newSlides = [...updated, newSlide];
    slidesRef.current = newSlides;
    setSlides(newSlides);
    const newIdx = newSlides.length - 1;
    setElements([]);
    setProxyUrl('');
    setBgOffsetX(0);
    setBgOffsetY(0);
    setBgCropMode(false);
    setActiveSlideIdx(newIdx);
    setSelectedId(null);
    setCropId(null);
    historyRef.current = [[]];
    histIdxRef.current = 0;
    setHistTick(t => t + 1);
  };

  // ── Carrousel "lié" façon Canva : étend l'image de fond de la slide active sur
  // les N slides suivantes, avec un décalage horizontal séquentiel — pour un
  // visuel continu (panorama) qui se découpe naturellement au balayage du
  // carrousel Instagram. Génération ponctuelle (pas de resynchronisation live
  // si on redéplace le fond ensuite) ; fonctionne mieux avec une photo large.
  const extendBgAcrossSlides = async (count: number) => {
    if (!proxyUrl) { showEditorToast(T('bgFirstToast')); return; }
    let natW = 0, natH = 0;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('load')); img.src = proxyUrl; });
      natW = img.naturalWidth; natH = img.naturalHeight;
    } catch { showEditorToast(T('imgNotFound')); return; }
    if (!natW || !natH) return;

    const scale = Math.max(stageW / natW, stageH / natH);
    const scaledW = natW * scale;
    const minOffsetX = stageW - scaledW; // borne la plus négative (clamp "cover")
    const clamp = (v: number) => Math.min(0, Math.max(minOffsetX, v));

    const groupId = `span-${Date.now()}`;
    let updated = saveCurrentSlide();
    const anchorOffsetX = clamp(bgOffsetX);
    updated = updated.map((s, i) => i === activeSlideIdx ? { ...s, spanGroupId: groupId, spanIndex: 0, bgOffsetX: anchorOffsetX } : s);

    for (let k = 1; k <= count; k++) {
      const targetIdx = activeSlideIdx + k;
      const wantedOffsetX = clamp(anchorOffsetX - k * stageW);
      if (targetIdx < updated.length) {
        updated[targetIdx] = { ...updated[targetIdx], proxyUrl, bgOffsetX: wantedOffsetX, bgOffsetY, spanGroupId: groupId, spanIndex: k };
      } else {
        updated = [...updated, { id: `slide-${Date.now()}-${k}`, elements: [], proxyUrl, bgOffsetX: wantedOffsetX, bgOffsetY, spanGroupId: groupId, spanIndex: k }];
      }
    }
    slidesRef.current = updated;
    setSlides(updated);
    setBgOffsetX(anchorOffsetX);
    if (scaledW < stageW * (count + 1)) {
      showEditorToast(T('spanNotWide', { count: count + 1 }));
    } else {
      showEditorToast(T('spanDone', { count: count + 1 }));
    }
  };

  const removeSlide = (idx: number) => {
    if (slidesRef.current.length <= 1) return;
    const updated = saveCurrentSlide();
    const newSlides = updated.filter((_, i) => i !== idx);
    slidesRef.current = newSlides;
    setSlides(newSlides);
    const newActive = idx >= newSlides.length ? newSlides.length - 1
      : idx < activeSlideIdx ? activeSlideIdx - 1
      : idx === activeSlideIdx ? Math.min(idx, newSlides.length - 1)
      : activeSlideIdx;
    setActiveSlideIdx(newActive);
    const next = newSlides[newActive];
    setElements(next.elements);
    setProxyUrl(next.proxyUrl);
    setSelectedId(null);
    setCropId(null);
    historyRef.current = [next.elements];
    histIdxRef.current = 0;
    setHistTick(t => t + 1);
  };

  const [saving, setSaving] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [qaBusy, setQaBusy] = useState(false);
  const [qaMsg, setQaMsg]   = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiVariants, setAiVariants] = useState<any[]>([]);
  const [aiVariantIdx, setAiVariantIdx] = useState(0);
  const [aiBuilding, setAiBuilding] = useState(false);          // overlay "l'IA construit le visuel"
  const [autoComposeReady, setAutoComposeReady] = useState(false);
  const autoComposeDoneRef = useRef(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Canvas zoom ───────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const slideContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [customFonts, setCustomFonts] = useState<{ name: string; url: string }[]>([]);
  const [brandFontNames, setBrandFontNames] = useState<string[]>([]);

  // ── UI tool + workspace ───────────────────────────────────────────────────
  const [tool, setTool] = useState<'design'|'elements'|'text'|'photos'|'brand'|'upload'|'calques'|null>(null);
  // Panneau gauche contextuel (Effet / Position) ouvert depuis la barre de modification.
  const [fxPanel, setFxPanel] = useState<'effects'|'position'|null>(null);
  const openFxPanel = (p: 'effects'|'position') => { setFxPanel(cur => cur === p ? null : p); setTool(null); };
  const [bgLocked, setBgLocked] = useState(true);
  const [bgImageSelected, setBgImageSelected] = useState(false);
  const [bgOpacity, setBgOpacity] = useState(100);
  const [workspaceName, setWorkspaceName] = useState('');
  const [templateName, setTemplateName] = useState('Nouveau template');
  const [postPhotoUrl, setPostPhotoUrl] = useState('');
  const [workspaceData, setWorkspaceData] = useState<{
    brand_voice_prompt?: string; company_description?: string;
    description_style?: string; caption_examples?: string;
    primary_color?: string; secondary_color?: string;
    accent_color?: string;
    logo_url?: string | null; logo_dark_url?: string | null;
    brand_assets?: string[] | null;
    font_family?: string; font_primary_url?: string | null;
    font_secondary?: string; font_secondary_url?: string | null;
    words_to_use?: string; words_to_avoid?: string;
    tone?: string; sector?: string;
  } | null>(null);

  // ── AI caption ───────────────────────────────────────────────────────────
  const [aiCaption, setAiCaption] = useState('');
  const [aiTyping, setAiTyping] = useState(false);
  const [aiTone, setAiTone] = useState<'Chic'|'Punchy'|'Minimal'|'Doux'>('Chic');
  const aiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [postContext, setPostContext] = useState('');        // 5B — contexte du post
  const [captionEdited, setCaptionEdited] = useState(false); // 5C — brand memory

  // ── Pen tool (Outil Plume) ────────────────────────────────────────────────
  const [isPenMode, setIsPenMode] = useState(false);
  const [penPoints, setPenPoints] = useState<AnchorPoint[]>([]);
  const [penPreviewPos, setPenPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const penPointsRef = useRef<AnchorPoint[]>([]);
  const penDragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const penIsDraggingRef = useRef(false);
  const isPenModeRef = useRef(false);
  useEffect(() => { isPenModeRef.current = isPenMode; }, [isPenMode]);
  useEffect(() => () => { if (aiTimerRef.current) clearInterval(aiTimerRef.current); }, []);

  // ── Schedule ─────────────────────────────────────────────────────────────
  const [schedDay, setSchedDay] = useState<number | null>(null);
  const SCHED_DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  // ── Load fonts ────────────────────────────────────────────────────────────

  useEffect(() => {
    const fontsToLoad = ['Anton', 'Oswald', 'Bebas+Neue', 'Montserrat', 'Syne', 'Inter', 'Poppins',
      'Barlow+Condensed', 'Raleway', 'Roboto+Condensed', 'Playfair+Display', 'Lato', 'Nunito',
      'Work+Sans', 'DM+Sans', 'Space+Grotesk', 'Archivo+Black', 'Fjalla+One', 'Exo+2', 'Ubuntu'];
    fontsToLoad.forEach(font => {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${font}:wght@400;700;900&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    });
  }, []);

  // ── Trackpad / wheel zoom — must be non-passive to preventDefault ─────────
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      // deltaY is negative when zooming in (pinch-out / scroll-up)
      setZoom(z => Math.min(2, Math.max(0.25, z - e.deltaY * 0.001)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const stageWRef = useRef(FORMATS[0].w);
  const stageHRef = useRef(FORMATS[0].h);
  useEffect(() => { stageWRef.current = stageW; stageHRef.current = stageH; }, [stageW, stageH]);

  // ── Load post & workspace ─────────────────────────────────────────────────

  useEffect(() => {
    setDataLoading(true);
    setLoadError(null);
    const load = async () => {
      try {
        let p: any = null;
        let w: any = null;
        if (isTemplate) {
          // Mode template : on ne charge pas de post, seulement la charte (workspace).
          const wr = await supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle();
          w = wr.data;
        } else {
          let postError: any;
          const [pr, wr] = await Promise.all([
            supabase.from('posts').select('*').eq('id', postId).maybeSingle(),
            supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
          ]);
          p = pr.data; postError = pr.error; w = wr.data;
          // Au refresh, la session peut ne pas être prête : si le post revient vide sans erreur,
          // on réessaie une fois (sinon on afficherait un canvas vide « déconnecté »).
          if (!p && !postError) {
            await new Promise(r => setTimeout(r, 600));
            const retry = await supabase.from('posts').select('*').eq('id', postId).maybeSingle();
            p = retry.data; postError = retry.error;
            if (!w) { const wr2 = await supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(); w = wr2.data; }
          }
          if (postError) throw postError;
          if (p?.template_id) setPostTemplateId(p.template_id);
          // Set canvas format from post_type (template will override below if applicable)
          const PT_FORMAT: Record<string, string> = { post: 'ig-portrait', reel: 'ig-story', story: 'ig-story', carrousel: 'ig-square' };
          if (p?.post_type && PT_FORMAT[p.post_type]) { setFormatId(PT_FORMAT[p.post_type]); setPostType(p.post_type as 'post' | 'reel' | 'story' | 'carrousel'); }
          if (p?.photo_url) { setPostPhotoUrl(p.photo_url); }
          // Post vierge (jamais édité, pas de template) + une photo -> l'IA composera automatiquement à l'ouverture.
          setAutoComposeReady(!p?.editor_json && !p?.template_id && !!p?.photo_url);
        }
        if (w) {
          setWorkspaceName(w.name || '');
          setWorkspaceData(w);
          // ── Load brand fonts ─────────────────────────────────────────────
          const bfNames: string[] = [];
          if (w.font_family) {
            bfNames.push(w.font_family);
            if (w.font_primary_url) {
              try { const ff = new FontFace(w.font_family, `url(${w.font_primary_url})`); await ff.load(); document.fonts.add(ff); } catch {}
            } else {
              const lnk = document.createElement('link'); lnk.rel = 'stylesheet';
              lnk.href = `https://fonts.googleapis.com/css2?family=${w.font_family.replace(/ /g, '+')}&display=swap`;
              document.head.appendChild(lnk);
            }
          }
          if (w.font_secondary) {
            bfNames.push(w.font_secondary);
            if (w.font_secondary_url) {
              try { const ff = new FontFace(w.font_secondary, `url(${w.font_secondary_url})`); await ff.load(); document.fonts.add(ff); } catch {}
            } else {
              const lnk = document.createElement('link'); lnk.rel = 'stylesheet';
              lnk.href = `https://fonts.googleapis.com/css2?family=${w.font_secondary.replace(/ /g, '+')}&display=swap`;
              document.head.appendChild(lnk);
            }
          }
          if (bfNames.length > 0) setBrandFontNames(bfNames);
        }
        const sw = stageWRef.current;
        const sh = stageHRef.current;
        const defaultEl: TextEl = {
          id: 'block-1', type: 'text', x: 20, y: sh - 80, rotation: 0, opacity: 100,
          text: p?.texte_visuel || 'VOTRE TEXTE',
          fontSize: 32, fontFamily: w?.font_family || 'Oswald',
          fontStyle: 'bold', textDecoration: '', fill: w?.secondary_color || '#FFFFFF',
          align: 'left', width: sw - 40,
          hasBg: true, bgColor: w?.primary_color || '#0038FF',
          bgOpacity: 95, cornerRadius: 4, padding: 16, paddingH: 16, paddingV: 10,
        };
        const photoProxyUrl = p?.photo_url ? `/api/proxy-image?url=${encodeURIComponent(p.photo_url)}` : '';
        let initSlides: Slide[];
        if (isTemplate) {
          // Mode template : charge le modèle depuis post_templates (ou vierge si "new").
          let tpl: any = null;
          if (templateId && templateId !== 'new') {
            const { data } = await supabase.from('post_templates').select('*').eq('id', templateId).maybeSingle();
            tpl = data;
          }
          if (tpl) {
            setTemplateName(tpl.name || 'Nouveau template');
            if (tpl.format_id && FORMATS.find(f => f.id === tpl.format_id)) setFormatId(tpl.format_id);
            setBgStyle((tpl.background_style as BgStyle) || { type: 'gradient', colorFrom: '#0038FF', colorTo: '#FFFFFF', angle: 135 });
            const zones: CanvasEl[] = Array.isArray(tpl.text_zones) ? tpl.text_zones : [];
            initSlides = [{ id: 'slide-1', elements: zones, proxyUrl: '' }];
          } else {
            setBgStyle({ type: 'gradient', colorFrom: '#0038FF', colorTo: '#FFFFFF', angle: 135 });
            initSlides = [{ id: 'slide-1', elements: [], proxyUrl: '' }];
          }
        } else if (p?.editor_json) {
          // Saved state always wins — never re-apply template
          try {
            const parsed = JSON.parse(p.editor_json);
            if (parsed && parsed.version === 2 && Array.isArray(parsed.slides)) {
              initSlides = parsed.slides;
              // Restore bgStyle if embedded in the first slide (set by Composer pre-gen)
              if (parsed.slides[0]?.bgStyle) setBgStyle(parsed.slides[0].bgStyle as BgStyle);
              // Restore continuous-carousel mode
              if (parsed.carouselContinuous) { setCarouselContinuous(true); setContPanels(Math.min(6, Math.max(2, parsed.contPanels || 2))); }
            } else {
              const els = Array.isArray(parsed) ? parsed : [defaultEl];
              initSlides = [{ id: 'slide-1', elements: els, proxyUrl: photoProxyUrl }];
            }
          } catch { initSlides = [{ id: 'slide-1', elements: [defaultEl], proxyUrl: photoProxyUrl }]; }
        } else if (p?.template_id) {
          // Apply template for fresh posts
          const { data: tpl } = await supabase
            .from('post_templates')
            .select('*')
            .eq('id', p.template_id)
            .maybeSingle();

          if (tpl) {
            // Set canvas format from template
            const tplFormat = FORMATS.find(f => f.id === tpl.format_id);
            if (tplFormat) setFormatId(tpl.format_id);

            // Apply template background
            if (tpl.background_style) setBgStyle(tpl.background_style as BgStyle);

            const zones: CanvasEl[] = Array.isArray(tpl.text_zones) ? tpl.text_zones : [];
            const hasPhotoZone = zones.some(
              (e: CanvasEl) => e.type === 'image' && (e as ImageEl).src === PHOTO_PLACEHOLDER_SRC
            );

            // Replace photo placeholder with actual photo; assign fresh ids to avoid conflicts
            const initElements: CanvasEl[] = zones.map((el: CanvasEl) => {
              const freshId = el.id.startsWith('tpl-') ? el.id : `tpl-${el.id}`;
              if (el.type === 'image' && (el as ImageEl).src === PHOTO_PLACEHOLDER_SRC) {
                return { ...el, id: freshId, src: photoProxyUrl } as ImageEl;
              }
              return { ...el, id: freshId };
            });

            const bgUrl = hasPhotoZone ? '' : photoProxyUrl;
            initSlides = [{
              id: 'slide-1',
              elements: initElements.length > 0 ? initElements : [defaultEl],
              proxyUrl: bgUrl,
            }];
          } else {
            // Template not found — fallback to default
            initSlides = [{ id: 'slide-1', elements: [defaultEl], proxyUrl: photoProxyUrl }];
          }
        } else {
          initSlides = [{ id: 'slide-1', elements: [defaultEl], proxyUrl: photoProxyUrl }];
        }
        // Re-layout (Phase 2) : auto-fit + anti-chevauchement pour le format du post.
        // En mode template, on préserve la mise en page dessinée à la main (pas de relayout).
        if (!isTemplate) {
          const loadFmt = FORMATS.find(f => f.id === (p?.post_type && PT_FORMAT_MAP[p.post_type] ? PT_FORMAT_MAP[p.post_type] : 'ig-portrait')) ?? FORMATS[0];
          initSlides = initSlides.map(s => ({ ...s, elements: relayoutText(s.elements, loadFmt.w, loadFmt.h) }));
        }
        setSlides(initSlides);
        slidesRef.current = initSlides;
        const first = initSlides[0];
        setElements(first.elements);
        setProxyUrl(first.proxyUrl);
        // Bug 3: restore saved bg crop offsets
        setBgOffsetX(first.bgOffsetX ?? 0);
        setBgOffsetY(first.bgOffsetY ?? 0);
        historyRef.current = [first.elements];
        histIdxRef.current = 0;
        if (w?.custom_fonts) {
          try {
            const fonts: { name: string; url: string }[] = JSON.parse(w.custom_fonts);
            for (const font of fonts) {
              const ff = new FontFace(font.name, `url(${font.url})`);
              await ff.load();
              document.fonts.add(ff);
            }
            setCustomFonts(fonts);
          } catch {}
        }
      } catch (err) {
        setLoadError('Impossible de charger le post. Vérifiez votre connexion.');
        console.error('[Editor] load error:', err);
      } finally {
        setDataLoading(false);
      }
    };
    load();
  }, [postId, templateId, workspaceId, isTemplate]);

  // 5s timeout
  useEffect(() => {
    if (!dataLoading) return;
    const t = setTimeout(() => { setLoadError('Chargement trop long. Réessayez.'); setDataLoading(false); }, 5000);
    return () => clearTimeout(t);
  }, [dataLoading]);

  // ── Auto-save continu (post uniquement — les templates se sauvegardent via
  // "Enregistrer le modèle") : évite de perdre du travail si l'utilisateur
  // quitte sans cliquer "Publier". Sauvegarde légère : juste le JSON, pas de
  // rendu/upload PNG ni de changement de statut (contrairement à handleSave).
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (dataLoading || isTemplate) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const updated = saveCurrentSlide();
      setSlides(updated);
      supabase.from('posts').update({ editor_json: JSON.stringify({ version: 2, slides: updated }) }).eq('id', postId).then(() => {});
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, slides.length, formatId, postType, dataLoading, isTemplate, postId]);

  // ── Crop mode cursor ──────────────────────────────────────────────────────

  useEffect(() => {
    const container = stageRef.current?.container?.();
    if (container) container.style.cursor = cropId ? 'grab' : '';
  }, [cropId]);

  // ── Selected element ──────────────────────────────────────────────────────

  const selectedEl = elements.find(e => e.id === selectedId);

  // ── History ───────────────────────────────────────────────────────────────

  const pushHistory = (newEls: CanvasEl[]) => {
    const slice = historyRef.current.slice(0, histIdxRef.current + 1);
    historyRef.current = [...slice, newEls];
    histIdxRef.current = historyRef.current.length - 1;
    setHistTick(t => t + 1);
  };

  const applyElements = (newEls: CanvasEl[], withHistory = true) => {
    setElements(newEls);
    if (withHistory) pushHistory(newEls);
  };

  const layerAction = (action: 'front' | 'forward' | 'backward' | 'back') => {
    if (!selectedId) return;
    const arr = [...elementsRef.current];
    const idx = arr.findIndex(e => e.id === selectedId);
    if (idx === -1) return;
    const [el] = arr.splice(idx, 1);
    if (action === 'front') arr.push(el);
    else if (action === 'forward') arr.splice(Math.min(arr.length, idx + 1), 0, el);
    else if (action === 'backward') arr.splice(Math.max(0, idx - 1), 0, el);
    else arr.unshift(el);
    applyElements(arr);
  };

  // Réordonne toute la pile depuis la liste des calques (ordre avant→arrière).
  const reorderLayers = (frontToBackIds: string[]) => {
    const map = new Map(elementsRef.current.map(e => [e.id, e]));
    const arr = [...frontToBackIds].reverse().map(id => map.get(id)).filter(Boolean) as CanvasEl[];
    if (arr.length === elementsRef.current.length) applyElements(arr);
  };

  const updateEl = useCallback((id: string, updates: Partial<CanvasEl>) => {
    const newEls = elementsRef.current.map(e => e.id === id ? { ...e, ...updates } as CanvasEl : e);
    applyElements(newEls);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const undo = useCallback(() => {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current--;
    setElements(historyRef.current[histIdxRef.current]);
    setSelectedId(null);
    setHistTick(t => t + 1);
  }, []);

  const redo = useCallback(() => {
    if (histIdxRef.current >= historyRef.current.length - 1) return;
    histIdxRef.current++;
    setElements(historyRef.current[histIdxRef.current]);
    setSelectedId(null);
    setHistTick(t => t + 1);
  }, []);

  const deleteEl = useCallback((id?: string | null) => {
    const target = id ?? selectedIdRef.current;
    if (!target) return;
    const newEls = elementsRef.current.filter(e => e.id !== target);
    applyElements(newEls);
    setSelectedId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const duplicateEl = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id) return;
    const el = elementsRef.current.find(e => e.id === id);
    if (!el) return;
    const dup = { ...el, id: newId(), x: el.x + 20, y: el.y + 20 };
    const newEls = [...elementsRef.current, dup];
    applyElements(newEls);
    setSelectedId(dup.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Copier / Coller + menu contextuel (clic droit, façon Canva) ──────────
  const clipboardRef = useRef<CanvasEl | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const copyEl = useCallback((id?: string | null) => {
    const target = id ?? selectedIdRef.current;
    const el = elementsRef.current.find(e => e.id === target);
    if (el) clipboardRef.current = { ...el };
  }, []);
  const pasteEl = useCallback(() => {
    const el = clipboardRef.current;
    if (!el) return;
    const dup = { ...el, id: newId(), x: el.x + 24, y: el.y + 24 } as CanvasEl;
    applyElements([...elementsRef.current, dup]);
    setSelectedId(dup.id);
  }, []);

  // ── Alignment (single vs canvas; multi vs group bounding box) ────────────

  const getElBox = (e: CanvasEl) => {
    if (e.type === 'circle') { const r = (e as CircleEl).radius; return { l: e.x - r, t: e.y - r, r: e.x + r, b: e.y + r, w: r*2, h: r*2, cx: e.x, cy: e.y }; }
    if (e.type === 'star') { const r = (e as StarEl).outerRadius; return { l: e.x - r, t: e.y - r, r: e.x + r, b: e.y + r, w: r*2, h: r*2, cx: e.x, cy: e.y }; }
    const w = 'width' in e ? (e as any).width : 100;
    let h: number;
    if (e.type === 'text') {
      const t = e as TextEl;
      const pH = Number(t.paddingH ?? t.padding ?? 10);
      const pV = Number(t.paddingV ?? t.padding ?? 10);
      const areaW = Math.max(1, w - pH * 2);
      const lines = countLines(t.uppercase ? t.text.toUpperCase() : t.text, t.fontSize, t.fontFamily, t.fontStyle, areaW);
      h = lines * t.fontSize * (t.lineHeight ?? 1.2) + pV * 2;
    } else {
      h = 'height' in e ? (e as any).height : 100;
    }
    return { l: e.x, t: e.y, r: e.x + w, b: e.y + h, w, h, cx: e.x + w/2, cy: e.y + h/2 };
  };

  // ── Guides magnétiques (smart guides) ─────────────────────────────────────
  // Aligne l'élément en cours de glissement sur les bords/centre du canvas et
  // sur les bords/centre des autres calques, dans un seuil de quelques px.
  const SNAP_THRESHOLD = 6;
  const computeSnap = (el: CanvasEl, candX: number, candY: number) => {
    const others = elementsRef.current.filter(o => o.id !== el.id && !hiddenIds.has(o.id));
    const box = getElBox(el);
    const dx = candX - el.x, dy = candY - el.y;
    const bl = box.l + dx, br = box.r + dx, bcx = box.cx + dx;
    const bt = box.t + dy, bb = box.b + dy, bcy = box.cy + dy;

    const vTargets = [0, stageW / 2, stageW, ...others.flatMap(o => { const b = getElBox(o); return [b.l, b.cx, b.r]; })];
    const hTargets = [0, stageH / 2, stageH, ...others.flatMap(o => { const b = getElBox(o); return [b.t, b.cy, b.b]; })];

    let bestVDelta: number | null = null, vGuide: number | null = null;
    for (const t of vTargets) {
      for (const val of [bl, bcx, br]) {
        const d = t - val;
        if (Math.abs(d) <= SNAP_THRESHOLD && (bestVDelta === null || Math.abs(d) < Math.abs(bestVDelta))) { bestVDelta = d; vGuide = t; }
      }
    }
    let bestHDelta: number | null = null, hGuide: number | null = null;
    for (const t of hTargets) {
      for (const val of [bt, bcy, bb]) {
        const d = t - val;
        if (Math.abs(d) <= SNAP_THRESHOLD && (bestHDelta === null || Math.abs(d) < Math.abs(bestHDelta))) { bestHDelta = d; hGuide = t; }
      }
    }
    return { x: candX + (bestVDelta ?? 0), y: candY + (bestHDelta ?? 0), vGuide, hGuide };
  };

  const handleElDragMove = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    if (selectedIdsRef.current.length > 1) return; // pas de snap individuel pendant un déplacement groupé
    const el = elementsRef.current.find(x => x.id === id);
    if (!el) return;
    const snapped = computeSnap(el, e.target.x(), e.target.y());
    e.target.position({ x: snapped.x, y: snapped.y });
    setGuides({ v: snapped.vGuide, h: snapped.hGuide });
  };

  const alignEl = (dir: string) => {
    const ids = selectedIds.length > 1 ? selectedIds : (selectedId ? [selectedId] : []);
    if (ids.length === 0) return;

    if (ids.length === 1) {
      // Single element: align relative to canvas
      const el = elements.find(e => e.id === ids[0]);
      if (!el) return;
      const box = getElBox(el);
      let patch: Record<string, number> = {};
      if (el.type === 'circle' || el.type === 'star') {
        const r = el.type === 'circle' ? (el as CircleEl).radius : (el as StarEl).outerRadius;
        if (dir === 'left') patch = { x: r }; else if (dir === 'right') patch = { x: stageW - r };
        else if (dir === 'center-h') patch = { x: stageW / 2 }; else if (dir === 'top') patch = { y: r };
        else if (dir === 'bottom') patch = { y: stageH - r }; else if (dir === 'center-v') patch = { y: stageH / 2 };
      } else {
        if (dir === 'left') patch = { x: 0 }; else if (dir === 'right') patch = { x: stageW - box.w };
        else if (dir === 'center-h') patch = { x: (stageW - box.w) / 2 }; else if (dir === 'top') patch = { y: 0 };
        else if (dir === 'bottom') patch = { y: stageH - box.h }; else if (dir === 'center-v') patch = { y: (stageH - box.h) / 2 };
      }
      updateEl(el.id, patch as Partial<CanvasEl>);
    } else {
      // Multi: align elements relative to each other
      const sels = elements.filter(e => ids.includes(e.id));
      const boxes = sels.map(e => ({ id: e.id, type: e.type, box: getElBox(e) }));
      const minL = Math.min(...boxes.map(b => b.box.l));
      const minT = Math.min(...boxes.map(b => b.box.t));
      const maxR = Math.max(...boxes.map(b => b.box.r));
      const maxB = Math.max(...boxes.map(b => b.box.b));
      const avgCx = (minL + maxR) / 2;
      const avgCy = (minT + maxB) / 2;
      const newEls = elements.map(e => {
        if (!ids.includes(e.id)) return e;
        const { box } = boxes.find(b => b.id === e.id)!;
        if (e.type === 'circle' || e.type === 'star') {
          if (dir === 'left') return { ...e, x: minL + box.w / 2 }; if (dir === 'right') return { ...e, x: maxR - box.w / 2 };
          if (dir === 'center-h') return { ...e, x: avgCx }; if (dir === 'top') return { ...e, y: minT + box.h / 2 };
          if (dir === 'bottom') return { ...e, y: maxB - box.h / 2 }; if (dir === 'center-v') return { ...e, y: avgCy };
        } else {
          if (dir === 'left') return { ...e, x: minL }; if (dir === 'right') return { ...e, x: maxR - box.w };
          if (dir === 'center-h') return { ...e, x: avgCx - box.w / 2 }; if (dir === 'top') return { ...e, y: minT };
          if (dir === 'bottom') return { ...e, y: maxB - box.h }; if (dir === 'center-v') return { ...e, y: avgCy - box.h / 2 };
        }
        return e;
      });
      applyElements(newEls);
    }
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        if (isPenModeRef.current) {
          setIsPenMode(false); penPointsRef.current = []; setPenPoints([]); setPenPreviewPos(null);
          penDragOriginRef.current = null; penIsDraggingRef.current = false;
          return;
        }
        setSelectedId(null); setSelectedIds([]); setEditingId(null); return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') deleteEl();
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); duplicateEl(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') { copyEl(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') { e.preventDefault(); pasteEl(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [deleteEl, undo, redo, duplicateEl, copyEl, pasteEl]);

  // ── Add elements ──────────────────────────────────────────────────────────

  const addText = () => {
    const el: TextEl = { id: newId(), type: 'text', x: 50, y: 100, rotation: 0, opacity: 100, text: 'Nouveau texte', fontSize: 32, fontFamily: 'Oswald', fontStyle: 'bold', textDecoration: '', fill: '#FFFFFF', align: 'left', width: 300, hasBg: false, bgColor: '#000000', bgOpacity: 80, cornerRadius: 4, padding: 16, paddingH: 16, paddingV: 10 };
    applyElements([...elements, el]);
    setSelectedId(el.id);
  };

  // Template mode: add a role-tagged text zone (AI-fillable)
  const addTextRole = (role: string) => {
    const preset: Record<string, { text: string; fontSize: number; fontStyle: string }> = {
      accroche: { text: 'ACCROCHE', fontSize: 15, fontStyle: 'bold' },
      titre: { text: 'TITRE PRINCIPAL', fontSize: 40, fontStyle: 'bold' },
      'sous-titre': { text: 'Sous-titre', fontSize: 20, fontStyle: 'normal' },
      corps: { text: 'Corps de texte', fontSize: 15, fontStyle: 'normal' },
      cta: { text: 'CALL TO ACTION', fontSize: 15, fontStyle: 'bold' },
      prix: { text: '00€', fontSize: 36, fontStyle: 'bold' },
    };
    const p = preset[role] ?? preset.titre;
    const el: TextEl = { id: newId(), type: 'text', x: 50, y: 100, rotation: 0, opacity: 100, text: p.text, fontSize: p.fontSize, fontFamily: 'Oswald', fontStyle: p.fontStyle, textDecoration: '', fill: '#FFFFFF', align: 'left', width: stageW - 100, hasBg: false, bgColor: '#000000', bgOpacity: 80, cornerRadius: 4, padding: 16, paddingH: 16, paddingV: 10, role };
    applyElements([...elements, el]);
    setSelectedId(el.id);
  };

  // Insère un texte pré-stylisé (combinaison façon Canva) directement sur le plan de travail.
  const addTextPreset = (patch: Partial<TextEl>, text: string) => {
    const w = Math.round(stageW * 0.82);
    const base: TextEl = { id: newId(), type: 'text', x: Math.round((stageW - w) / 2), y: 180, rotation: 0, opacity: 100, text, fontSize: 44, fontFamily: 'Archivo Black', fontStyle: 'normal', textDecoration: '', fill: '#14160F', align: 'center', width: w, hasBg: false, bgColor: '#000000', bgOpacity: 100, cornerRadius: 8, padding: 16, paddingH: 22, paddingV: 14 };
    const el: TextEl = { ...base, ...patch, id: base.id, type: 'text', text };
    applyElements([...elements, el]);
    setSelectedId(el.id);
    setTool(null);
  };

  // Insère une COMPOSITION de plusieurs zones de texte (jeux de typo façon Canva),
  // centrée horizontalement, chaque partie décalée verticalement (dy) / horizontalement (dx).
  const addTextComposition = (parts: { text: string; patch?: Partial<TextEl>; dx?: number; dy: number }[]) => {
    const cx = Math.round(stageW / 2);
    const baseY = 190;
    const els: TextEl[] = parts.map(part => {
      const merged: TextEl = {
        id: newId(), type: 'text', text: part.text, x: 0, y: 0, rotation: 0, opacity: 100,
        fontSize: 44, fontFamily: 'Archivo Black', fontStyle: 'normal', textDecoration: '',
        fill: '#14160F', align: 'center', width: Math.round(stageW * 0.82),
        hasBg: false, bgColor: '#000000', bgOpacity: 100, cornerRadius: 8,
        padding: 16, paddingH: 22, paddingV: 14, ...part.patch,
      };
      merged.x = Math.round(cx - merged.width / 2 + (part.dx || 0));
      merged.y = baseY + part.dy;
      return merged;
    });
    applyElements([...elements, ...els]);
    setSelectedId(els[0].id);
    setTool(null);
  };

  // Template mode: add a replaceable photo zone (placeholder swapped by AI/user later)
  const addPhotoPlaceholder = () => {
    const w = Math.round(stageW * 0.6), h = Math.round(stageW * 0.6);
    const el: ImageEl = { id: newId(), type: 'image', src: PHOTO_PLACEHOLDER_SRC, x: Math.round((stageW - w) / 2), y: Math.round((stageH - h) / 2), rotation: 0, opacity: 100, width: w, height: h };
    applyElements([...elements, el]);
    setSelectedId(el.id);
    setTool(null);
  };

  const addVector = (shape: VectorEl['shape']) => {
    const defaultFill = workspaceData?.primary_color || '#2FD79B';
    const defaultSize: Record<VectorEl['shape'], [number, number]> = {
      rectangle: [200, 120], circle: [140, 140], triangle: [160, 140],
      star: [140, 140], pill: [220, 80], arrow: [200, 100],
      diamond: [140, 160], hexagon: [150, 150], custom: [160, 160],
    };
    const [w, h] = defaultSize[shape];
    const el: VectorEl = { id: newId(), type: 'vector', shape, x: Math.round((stageW - w) / 2), y: Math.round((stageH - h) / 2), rotation: 0, opacity: 100, width: w, height: h, fill: defaultFill, fillType: 'color', stroke: '', strokeWidth: 0 };
    applyElements([...elements, el]);
    setSelectedId(el.id);
    setTool(null);
  };

  // ── Pen tool handlers ─────────────────────────────────────────────────────

  const cancelPenMode = () => {
    setIsPenMode(false);
    penPointsRef.current = [];
    setPenPoints([]);
    setPenPreviewPos(null);
    penDragOriginRef.current = null;
    penIsDraggingRef.current = false;
  };

  const finishPenPath = (closed: boolean) => {
    const pts = [...penPointsRef.current];
    if (pts.length < 2) { cancelPenMode(); return; }
    const xs = pts.map(p => p.x); const ys = pts.map(p => p.y);
    const minX = Math.min(...xs); const minY = Math.min(...ys);
    const maxX = Math.max(...xs); const maxY = Math.max(...ys);
    const w = Math.max(maxX - minX, 10); const h = Math.max(maxY - minY, 10);
    const relPts: AnchorPoint[] = pts.map(p => ({
      x: p.x - minX, y: p.y - minY,
      ...(p.cpIn  ? { cpIn:  { x: p.cpIn.x  - minX, y: p.cpIn.y  - minY } } : {}),
      ...(p.cpOut ? { cpOut: { x: p.cpOut.x - minX, y: p.cpOut.y - minY } } : {}),
    }));
    const el: VectorEl = {
      id: newId(), type: 'vector', shape: 'custom', x: minX, y: minY, rotation: 0, opacity: 100,
      width: w, height: h, fill: workspaceData?.primary_color || '#2FD79B',
      fillType: 'color', stroke: '', strokeWidth: 0, points: relPts, closed,
    };
    applyElements([...elementsRef.current, el]);
    setSelectedId(el.id);
    cancelPenMode();
  };

  const handlePenMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.detail >= 2) return; // belongs to dblclick — skip
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    // Close shape if clicking near first anchor point (≥3 points required)
    if (penPointsRef.current.length >= 3) {
      const first = penPointsRef.current[0];
      if (Math.hypot(x - first.x, y - first.y) < 14) { finishPenPath(true); return; }
    }
    penDragOriginRef.current = { x, y };
    penIsDraggingRef.current = false;
  };

  const handlePenMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    setPenPreviewPos({ x, y });
    if (penDragOriginRef.current && !penIsDraggingRef.current) {
      const d = penDragOriginRef.current;
      if (Math.hypot(x - d.x, y - d.y) > 5) penIsDraggingRef.current = true;
    }
  };

  const handlePenMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    const origin = penDragOriginRef.current;
    if (!origin) return; // skipped mousedown (part of dblclick)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    let newPoint: AnchorPoint;
    if (penIsDraggingRef.current) {
      const dx = x - origin.x; const dy = y - origin.y;
      newPoint = { x: origin.x, y: origin.y, cpOut: { x: origin.x + dx, y: origin.y + dy }, cpIn: { x: origin.x - dx, y: origin.y - dy } };
    } else {
      newPoint = { x: origin.x, y: origin.y };
    }
    const next = [...penPointsRef.current, newPoint];
    penPointsRef.current = next;
    setPenPoints([...next]);
    penDragOriginRef.current = null;
    penIsDraggingRef.current = false;
  };

  const handlePenDblClick = (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    // Remove last point added by the first click of the dblclick
    if (penPointsRef.current.length > 1) penPointsRef.current = penPointsRef.current.slice(0, -1);
    if (penPointsRef.current.length >= 2) finishPenPath(false);
    else cancelPenMode();
  };

  const addImageEl = (src: string) => {
    const id = newId();
    const el: ImageEl = { id, type: 'image', x: 0, y: 0, rotation: 0, opacity: 100, src, width: stageW, height: stageH };
    applyElements([...elements, el]);
    setSelectedId(id);
    setCropId(id);
    setShowUnsplash(false);
  };

  // Add brand logo/asset as a smaller element (no crop mode)
  const addLogoEl = (src: string) => {
    const id = newId();
    const size = Math.round(stageW * 0.28);
    const el: ImageEl = { id, type: 'image', x: 20, y: 20, rotation: 0, opacity: 100, src, width: size, height: size };
    applyElements([...elements, el]);
    setSelectedId(id);
  };

  const showEditorToast = (msg: string) => {
    setEditorToast(msg);
    setTimeout(() => setEditorToast(null), 4000);
  };

  // Détourage / suppression d'arrière-plan (100% côté client, sans clé API)
  const removeBgFromImage = async (el: ImageEl) => {
    if (bgRemovingId) return;
    setBgRemovingId(el.id);
    showEditorToast(T('cutoutInProgress'));
    try {
      let blob: Blob;
      try {
        const resp = await fetch(el.src);
        if (!resp.ok) throw new Error('fetch');
        blob = await resp.blob();
      } catch {
        const resp = await fetch(`/api/proxy-image?url=${encodeURIComponent(el.src)}`);
        blob = await resp.blob();
      }
      // Chargé depuis un CDN (webpackIgnore) : évite de bundler onnxruntime, dont le backend
      // Node casse le build. Le modèle IA est téléchargé depuis le CDN static d'imgly au 1er usage.
      // @ts-expect-error import CDN dynamique sans types
      const mod = await import(/* webpackIgnore: true */ 'https://esm.sh/@imgly/background-removal@1.7.0');
      const removeBackground = mod.removeBackground || mod.default?.removeBackground || mod.default;
      const outBlob: Blob = await removeBackground(blob);
      const path = `${workspaceId}/${entityId}-cutout-${Date.now()}.png`;
      const { error } = await supabase.storage.from('photos').upload(path, outBlob, { upsert: true, contentType: 'image/png' });
      if (error) { showEditorToast(T('uploadFailed', { msg: error.message })); return; }
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
      updateEl(el.id, { src: urlData.publicUrl, naturalW: undefined, naturalH: undefined, cropX: undefined, cropY: undefined } as Partial<ImageEl>);
      showEditorToast(T('bgRemoved'));
    } catch (e) {
      showEditorToast(T('cutoutFailed', { msg: e instanceof Error ? e.message : T('cutoutError') }));
    } finally {
      setBgRemovingId(null);
    }
  };

  const handleFileDrop = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (postType === 'reel') {
      showEditorToast(T('reelNeedsVideo'));
      return;
    }
    const src = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const natW = img.naturalWidth || stageW;
      const natH = img.naturalHeight || stageH;
      const maxW = Math.round(stageW * 0.5);
      const w = Math.min(natW, maxW);
      const h = Math.round(w * (natH / natW));
      const x = Math.round((stageW - w) / 2);
      const y = Math.round((stageH - h) / 2);
      const id = newId();
      const el: ImageEl = { id, type: 'image', x, y, rotation: 0, opacity: 100, src, width: w, height: h };
      applyElements([...elementsRef.current, el]);
      setSelectedId(id);
    };
    img.src = src;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    handleFileDrop(file);
  };

  const handleMaskPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedIdRef.current) return;
    e.target.value = '';
    const src = URL.createObjectURL(file);
    updateEl(selectedIdRef.current, { fillType: 'image', imageSrc: src, imageOffsetX: undefined, imageOffsetY: undefined } as Partial<VectorEl>);
    setMaskCropId(selectedIdRef.current);
  };

  // ── Unsplash ──────────────────────────────────────────────────────────────

  const fetchUnsplash = async (q: string) => {
    setUnsplashLoading(true);
    try {
      const key = process.env.NEXT_PUBLIC_UNSPLASH_KEY;
      if (key) {
        const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&client_id=${key}`);
        const data = await res.json();
        setUnsplashPhotos(data.results?.map((p: { urls: { small: string } }) => p.urls.small) ?? []);
      } else {
        setUnsplashPhotos(Array.from({ length: 12 }, (_, i) => `https://picsum.photos/seed/${q}${i}/300/300`));
      }
    } catch {
      setUnsplashPhotos(Array.from({ length: 12 }, (_, i) => `https://picsum.photos/seed/${q}${i}/300/300`));
    }
    setUnsplashLoading(false);
  };

  useEffect(() => { fetchUnsplash('lifestyle'); }, []);

  const fetchPexels = async (q: string, page = 1) => {
    setPexelsLoading(true);
    try {
      const res = await fetch(`/api/pexels?query=${encodeURIComponent(q || 'nature')}&page=${page}`);
      const data = await res.json();
      if (page === 1) setPexelsPhotos(data.photos ?? []);
      else setPexelsPhotos(prev => [...prev, ...(data.photos ?? [])]);
      setPexelsTotalPages(Math.ceil((data.total_results ?? 0) / 20));
      setPexelsPage(page);
    } catch { /* silently fail */ }
    setPexelsLoading(false);
  };

  useEffect(() => { fetchPexels('lifestyle'); }, []);

  // ── Icônes SVG (Iconify) ────────────────────────────────────────────────
  const fetchIcons = async (q: string) => {
    setIconLoading(true);
    try {
      const res = await fetch(`/api/iconify?query=${encodeURIComponent(q || 'star')}&limit=48`);
      const data = await res.json();
      setIconResults(data.icons ?? []);
    } catch { setIconResults([]); }
    setIconLoading(false);
  };
  useEffect(() => { fetchIcons('shape'); }, []);

  // URL SVG iconify ("prefix:name" → prefix/name.svg) avec couleur
  const iconSvgUrl = (name: string, color: string, h = 240) =>
    `https://api.iconify.design/${name.replace(':', '/')}.svg?height=${h}&color=${encodeURIComponent(color)}`;

  const addIcon = (name: string) => {
    addLogoEl(`/api/proxy-image?url=${encodeURIComponent(iconSvgUrl(name, iconColor))}`);
  };

  // ── Motifs / patterns (SVG généré, ajouté en pleine page) ────────────────
  const addPattern = (svg: string) => {
    const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    addImageEl(uri);
  };

  // ── Fit zoom ─────────────────────────────────────────────────────────────
  const fit = useCallback(() => {
    const ws = canvasAreaRef.current;
    if (!ws) return;
    const z = Math.min((ws.clientWidth - 120) / stageWView, (ws.clientHeight - 80) / stageH);
    setZoom(Math.max(0.05, Math.min(1.5, +z.toFixed(3))));
  }, [stageWView, stageH]);

  // Auto-fit after data loads and whenever the format (stageW/stageH) changes
  useEffect(() => {
    if (dataLoading) return;
    const id = requestAnimationFrame(() => fit());
    return () => cancelAnimationFrame(id);
  }, [dataLoading, fit]);

  // ── Z-order ───────────────────────────────────────────────────────────────

  const bringForward = () => {
    const idx = elements.findIndex(e => e.id === selectedId);
    if (idx < 0 || idx >= elements.length - 1) return;
    const n = [...elements]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; applyElements(n);
  };

  const sendBackward = () => {
    const idx = elements.findIndex(e => e.id === selectedId);
    if (idx <= 0) return;
    const n = [...elements]; [n[idx], n[idx - 1]] = [n[idx - 1], n[idx]]; applyElements(n);
  };

  const moveUp = (idx: number) => {
    if (idx >= elements.length - 1) return;
    const n = [...elements]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; applyElements(n);
  };

  const moveDown = (idx: number) => {
    if (idx <= 0) return;
    const n = [...elements]; [n[idx], n[idx - 1]] = [n[idx - 1], n[idx]]; applyElements(n);
  };

  const toggleHidden = (id: string) => {
    setHiddenIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleLocked = (id: string) => {
    setLockedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  // ── Export & save ─────────────────────────────────────────────────────────

  const exportPNG = () => {
    if (!stageRef.current) return;
    const prev = selectedId;
    setSelectedId(null);
    setTimeout(() => {
      const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
      const a = document.createElement('a'); a.download = `klip-${Date.now()}.png`; a.href = uri; a.click();
      setSelectedId(prev);
    }, 80);
  };

  // ── Auto-correction visuelle par IA (Option A) ────────────────────────────
  // Capture le rendu → Claude vision repère les défauts → applique des corrections
  // bornées (taille / position / texte raccourci, jamais police ni couleur) → reboucle.
  const runVisualQA = async () => {
    if (!stageRef.current || qaBusy) return;
    setQaBusy(true);
    const prevSel = selectedId;
    setSelectedId(null);
    const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));
    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitizeFix = (el: any, fix: any) => {
      const out: Record<string, unknown> = {};
      // Taille : on n'agrandit jamais au-delà du design.
      if (typeof fix?.fontSize === 'number') out.fontSize = Math.max(10, Math.min(Math.round(fix.fontSize), el.fontSize));
      // Position : clampée dans le cadre.
      if (typeof fix?.x === 'number') out.x = Math.max(0, Math.min(Math.round(fix.x), stageW - 20));
      if (typeof fix?.y === 'number') out.y = Math.max(0, Math.min(Math.round(fix.y), stageH - 20));
      // Étirement de la zone (largeur) — borné au cadre.
      if (typeof fix?.width === 'number') {
        const x = typeof out.x === 'number' ? out.x as number : (el.x ?? 0);
        out.width = Math.max(60, Math.min(Math.round(fix.width), stageW - x - 12));
      }
      if (fix?.align === 'left' || fix?.align === 'center' || fix?.align === 'right') out.align = fix.align;
      if (typeof fix?.text === 'string' && fix.text.trim() && fix.text.length < (el.text?.length ?? 0)) out.text = fix.text.trim();
      // Voile (scrim) de lisibilité : fond NOIR neutre derrière le texte — jamais la couleur du texte.
      if (fix?.scrim === true) {
        out.hasBg = true;
        out.bgColor = '#000000';
        const op = typeof fix?.scrimOpacity === 'number' ? fix.scrimOpacity : 45;
        out.bgOpacity = Math.max(20, Math.min(op, 70));
        out.cornerRadius = el.cornerRadius ?? 6;
        if (!el.paddingH) out.paddingH = 18;
        if (!el.paddingV) out.paddingV = 10;
      }
      // Ombre de lisibilité : ombre sombre douce — seulement sur texte CLAIR (sinon moche).
      const fillNow = (out.fill as string) ?? el.fill ?? '#FFFFFF';
      const isLight = (() => { const m = /^#?([0-9a-f]{6})$/i.exec(fillNow); if (!m) return true; const n = parseInt(m[1], 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.5; })();
      if (fix?.shadow === true && isLight) {
        out.shadowEnabled = true; out.shadowColor = '#000000'; out.shadowOpacity = 38; out.shadowBlur = 12; out.shadowOffsetX = 0; out.shadowOffsetY = 0;
      } else if (fix?.shadow === false || (!isLight && el.shadowEnabled)) {
        // Retire une ombre inutile/moche (notamment sur texte foncé).
        out.shadowEnabled = false;
      }
      return out;
    };
    try {
      let applied = 0;
      for (let pass = 0; pass < 2; pass++) {
        await nextFrame(); await wait(120);
        const image = stageRef.current?.toDataURL({ pixelRatio: 1 });
        if (!image) break;
        const layers = elementsRef.current
          .filter(e => e.type === 'text')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((e: any) => ({ id: e.id, role: e.role, text: e.text, fontSize: e.fontSize, x: Math.round(e.x), y: Math.round(e.y), width: e.width }));
        setQaMsg(pass === 0 ? 'Analyse du rendu…' : 'Nouvelle vérification…');
        const res = await fetch('/api/visual-qa', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, layers, stageW, stageH }),
        });
        const data = await res.json();
        if (!res.ok) { setQaMsg(data?.error ?? 'Analyse échouée'); break; }
        const issues = Array.isArray(data.issues) ? data.issues : [];
        const scrimPos = data?.scrim?.position;
        const wantScrim = scrimPos === 'bottom' || scrimPos === 'top';
        const hasScrimEl = elementsRef.current.some(e => e.id === 'scrim-overlay');
        const scrimChange = wantScrim ? !hasScrimEl : (scrimPos === 'none' && hasScrimEl);
        if ((data.ok || issues.length === 0) && !scrimChange) { setQaMsg(applied ? `Corrigé (${applied}) ✓` : 'Rendu validé ✓'); break; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fixById = new Map<string, any>(issues.filter((i: any) => i?.id && i?.fix).map((i: any) => [i.id, i.fix]));
        let newEls = elementsRef.current.map(e => fixById.has(e.id) ? { ...e, ...sanitizeFix(e, fixById.get(e.id)) } as CanvasEl : e);
        // Dégradé global (scrim) derrière la zone de texte, pour la lisibilité sur fond clair/chargé.
        if (wantScrim) {
          const op = Math.max(20, Math.min(typeof data.scrim?.opacity === 'number' ? data.scrim.opacity : 65, 80));
          const scrimEl = { id: 'scrim-overlay', type: 'rect', x: 0, y: 0, rotation: 0, opacity: op, width: stageW, height: stageH, fill: '#000000', stroke: '', strokeWidth: 0, cornerRadius: 0, scrim: scrimPos } as CanvasEl;
          newEls = newEls.filter(e => e.id !== 'scrim-overlay');
          newEls.unshift(scrimEl); // derrière les autres calques, au-dessus de la photo
        } else if (scrimPos === 'none') {
          newEls = newEls.filter(e => e.id !== 'scrim-overlay');
        }
        applyElements(newEls);
        applied += fixById.size + (scrimChange ? 1 : 0);
        setQaMsg(`Optimisation de la composition…`);
        await wait(250);
      }
    } catch {
      setQaMsg('Erreur pendant l\'analyse');
    } finally {
      setSelectedId(prevSel);
      setQaBusy(false);
      setTimeout(() => setQaMsg(null), 2800);
    }
  };

  // ── Composition IA (directeur artistique) ─────────────────────────────────
  // Luminosité moyenne d'une zone de la photo (0=sombre, 1=clair) — pour la couleur intelligente.
  const buildLumaSampler = (url: string) => new Promise<((xp: number, yp: number, wp: number, hp: number) => { mean: number; std: number }) | null>(resolve => {
    try {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const W = 160, H = Math.max(1, Math.round(W * img.height / Math.max(1, img.width)));
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          const ctx = c.getContext('2d'); if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0, W, H);
          resolve((xp, yp, wp, hp) => {
            try {
              const x = Math.max(0, Math.floor(xp / 100 * W)), y = Math.max(0, Math.floor(yp / 100 * H));
              const w = Math.min(W - x, Math.max(1, Math.floor(wp / 100 * W))), h = Math.min(H - y, Math.max(1, Math.floor(hp / 100 * H)));
              const d = ctx.getImageData(x, y, w, h).data; let s = 0, s2 = 0, n = 0;
              for (let i = 0; i < d.length; i += 4) { const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; s += l; s2 += l * l; n++; }
              if (!n) return { mean: 0.5, std: 0.2 };
              const mean = s / n; return { mean, std: Math.sqrt(Math.max(0, s2 / n - mean * mean)) };
            } catch { return { mean: 0.5, std: 0.2 }; }
          });
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch { resolve(null); }
  });
  const hexLum = (hex: string): number => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 1;
    const n = parseInt(m[1], 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };

  // Matérialise une variante de layout : couleur intelligente (contraste réel), accents, logo, scrim.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const materializeLayout = async (L: any) => {
    const displayFont = workspaceData?.font_family || 'Archivo';
    const bodyFont = workspaceData?.font_secondary || displayFont;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolveColor = (c: any) => c === 'primary' ? (workspaceData?.primary_color || '#FFFFFF') : c === 'secondary' ? (workspaceData?.secondary_color || '#FFFFFF') : c === 'accent' ? (workspaceData?.accent_color || '#C8F135') : c === 'black' ? '#14160F' : '#FFFFFF';
    let sampler: ((xp: number, yp: number, wp: number, hp: number) => { mean: number; std: number }) | null = null;
    if (postPhotoUrl) { try { sampler = await buildLumaSampler(`/api/proxy-image?url=${encodeURIComponent(postPhotoUrl)}`); } catch { /* noop */ } }
    let forceScrim = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newTextEls: CanvasEl[] = (Array.isArray(L?.blocks) ? L.blocks : []).filter((b: any) => b?.text).map((b: any) => {
      let fill = resolveColor(b.color);
      let shadow = false;
      if (sampler) {
        const { mean, std } = sampler(b.xPct ?? 8, b.yPct ?? 70, b.widthPct ?? 80, Math.min(45, (b.fontPct ?? 7) * 2.6));
        const busy = std > 0.17;                 // zone chargée (mélange clair/sombre) = risque d'illisibilité
        const fillLum = hexLum(fill);
        const contrastOK = !busy && Math.abs(mean - fillLum) > 0.45;
        if (busy) {
          // Fond chargé : on ne parie pas sur la couleur du texte -> blanc + voile dégradé + ombre (lisible à coup sûr).
          fill = '#FFFFFF'; shadow = true; forceScrim = true;
        } else if (!contrastOK) {
          fill = mean > 0.5 ? '#14160F' : '#FFFFFF';     // fond uni : noir sur clair, blanc sur sombre
          shadow = fill === '#FFFFFF' && mean > 0.5;
        }
        // sinon : la couleur choisie par l'IA a un bon contraste, on la garde telle quelle.
      } else {
        shadow = hexLum(fill) > 0.5 && !!b.shadow;
      }
      const align = ['left', 'center', 'right'].includes(b.align) ? b.align : 'left';
      const width = Math.round((Math.min(Math.max(b.widthPct ?? 80, 10), 100) / 100) * stageW);
      // Vrai centrage : un bloc centré est réellement centré dans le cadre (sinon ça paraît "de travers").
      const x = align === 'center'
        ? Math.round((stageW - width) / 2)
        : Math.max(0, Math.round(((b.xPct ?? 8) / 100) * stageW));
      return {
        id: newId(), type: 'text', text: String(b.text),
        x, y: Math.max(0, Math.round(((b.yPct ?? 70) / 100) * stageH)),
        width,
        rotation: 0, opacity: 100,
        fontSize: Math.max(12, Math.round(((b.fontPct ?? 7) / 100) * stageH)),
        fontFamily: b.role === 'sous-titre' ? bodyFont : displayFont,
        fontStyle: b.role === 'sous-titre' ? 'normal' : 'bold', textDecoration: '',
        fill, align,
        hasBg: false, bgColor: '#000000', bgOpacity: 80, cornerRadius: 6, padding: 16, paddingH: 16, paddingV: 10,
        role: b.role || 'titre', uppercase: !!b.uppercase,
        // Ombre = halo doux de lisibilité (offset 0, flou large, faible opacité), JAMAIS une ombre portée lourde.
        ...(shadow ? { shadowEnabled: true, shadowColor: '#000000', shadowOpacity: 38, shadowBlur: 12, shadowOffsetX: 0, shadowOffsetY: 0 } : {}),
      } as CanvasEl;
    });
    // Accents de marque (barres / soulignements)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accentEls: CanvasEl[] = (Array.isArray(L?.accents) ? L.accents : []).filter((a: any) => a?.type).map((a: any, i: number) => ({
      id: `ai-accent-${i}`, type: 'rect',
      x: Math.max(0, Math.round(((a.xPct ?? 8) / 100) * stageW)),
      y: Math.max(0, Math.round(((a.yPct ?? 60) / 100) * stageH)),
      width: Math.max(6, Math.round((Math.min(Math.max(a.widthPct ?? 20, 2), 60) / 100) * stageW)),
      // Accents = traits FINS uniquement (jamais un pavé) : hauteur plafonnée à ~1.2% du cadre.
      height: Math.max(2, Math.round((Math.min(a.heightPct ?? (a.type === 'underline' ? 0.6 : 1), 1.2) / 100) * stageH)),
      rotation: 0, opacity: 100, fill: resolveColor(a.color), stroke: '', strokeWidth: 0, cornerRadius: 2,
    } as CanvasEl));
    // Logo (ratio réel préservé)
    const logoEls: CanvasEl[] = [];
    if (L?.logo?.show && workspaceData?.logo_url) {
      const logoSrc = `/api/proxy-image?url=${encodeURIComponent(workspaceData.logo_url)}`;
      const ratio = await new Promise<number>(res => { const i = new Image(); i.onload = () => res(i.naturalWidth / Math.max(1, i.naturalHeight)); i.onerror = () => res(3); i.src = logoSrc; });
      const w = Math.round((Math.min(Math.max(L.logo.widthPct ?? 18, 5), 50) / 100) * stageW);
      logoEls.push({ id: 'ai-logo', type: 'image', src: logoSrc,
        x: Math.max(0, Math.round(((L.logo.xPct ?? 6) / 100) * stageW)), y: Math.max(0, Math.round(((L.logo.yPct ?? 6) / 100) * stageH)),
        width: w, height: Math.max(8, Math.round(w / Math.max(0.2, ratio))), rotation: 0, opacity: 100 } as CanvasEl);
    }
    // Scrim global
    const extras: CanvasEl[] = [];
    const scrimPos = L?.scrim?.position;
    if (scrimPos === 'bottom' || scrimPos === 'top' || forceScrim) {
      const pos = (scrimPos === 'bottom' || scrimPos === 'top') ? scrimPos : 'bottom';
      const op = Math.max(22, Math.min(typeof L?.scrim?.opacity === 'number' ? L.scrim.opacity : 50, 65));
      extras.push({ id: 'scrim-overlay', type: 'rect', x: 0, y: 0, rotation: 0, opacity: op, width: stageW, height: stageH, fill: '#000000', stroke: '', strokeWidth: 0, cornerRadius: 0, scrim: pos } as CanvasEl);
    }
    // On retire les anciens éléments générés par l'IA (texte, scrim, accents, logo), on garde le reste.
    const keptImgs = elementsRef.current.filter(e => e.type !== 'text' && e.id !== 'scrim-overlay' && !e.id.startsWith('ai-accent') && e.id !== 'ai-logo');
    const combined = [...extras, ...keptImgs, ...accentEls, ...logoEls, ...newTextEls];
    applyElements(relayoutText(combined, stageW, stageH));
  };

  // Compose : récupère l'univers du client + posts validés, demande 3 variantes, applique la 1re, puis QA.
  const composeWithAI = async (opts?: { chainQA?: boolean }) => {
    if (qaBusy) return;
    const chainQA = opts?.chainQA !== false;
    setQaBusy(true); setQaMsg('Composition IA…');
    let success = false;
    try {
      const texts = elementsRef.current.filter(e => e.type === 'text').map(e => (e as TextEl).text).filter(t => t && t.trim() && t !== 'VOTRE TEXTE');
      const FMT_DIMS: Record<string, [number, number]> = { 'ig-portrait': [448, 560], 'ig-square': [560, 560], 'ig-story': [315, 560], 'facebook': [560, 294] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const summarizeZones = (zones: any[], fw: number, fh: number) => zones.filter(z => z?.type === 'text' && z.role).map(z => ({
        role: z.role, xPct: Math.round(((z.x ?? 0) / fw) * 100), yPct: Math.round(((z.y ?? 0) / fh) * 100),
        wPct: Math.round(((z.width ?? fw) / fw) * 100), fontPct: Math.round(((z.fontSize ?? 24) / fh) * 100), align: z.align ?? 'left', upper: !!z.uppercase,
      }));
      let styleRef: unknown[] = [];
      let approvedRef: unknown[] = [];
      try {
        const [{ data: tpls }, { data: approved }] = await Promise.all([
          supabase.from('post_templates').select('name, format_id, background_style, text_zones').eq('workspace_id', workspaceId).limit(6),
          supabase.from('posts').select('post_type, editor_json').eq('workspace_id', workspaceId).eq('approved_by_client', true).limit(4),
        ]);
        styleRef = (tpls ?? []).map(t => {
          const [fw, fh] = FMT_DIMS[t.format_id as string] ?? [448, 560];
          return { name: t.name, bg: (t.background_style as { type?: string } | null)?.type ?? 'none', blocks: summarizeZones(Array.isArray(t.text_zones) ? t.text_zones : [], fw, fh) };
        }).filter(s => s.blocks.length > 0).slice(0, 4);
        approvedRef = (approved ?? []).map(p => {
          const [fw, fh] = FMT_DIMS[(p.post_type as string) ? PT_FORMAT_MAP[p.post_type as string] : 'ig-portrait'] ?? [448, 560];
          let blocks: unknown[] = [];
          try { const j = JSON.parse(p.editor_json as string); const els = j?.slides?.[0]?.elements ?? []; blocks = summarizeZones(els, fw, fh); } catch { /* noop */ }
          return { blocks };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).filter((s: any) => s.blocks.length > 0).slice(0, 3);
      } catch { /* compose librement */ }

      const res = await fetch('/api/compose-layout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: postPhotoUrl, format: { w: stageW, h: stageH },
          brand: { primary: workspaceData?.primary_color, secondary: workspaceData?.secondary_color, accent: workspaceData?.accent_color, logo: !!workspaceData?.logo_url },
          blocks: texts, styleRef, approvedRef,
        }),
      });
      const data = await res.json();
      const layouts = Array.isArray(data.layouts) ? data.layouts : [];
      if (!res.ok || layouts.length === 0) { setQaMsg(data?.error ?? 'Composition échouée'); return; }
      setAiVariants(layouts); setAiVariantIdx(0);
      await materializeLayout(layouts[0]);
      setQaMsg(layouts.length > 1 ? `Composé ✓ (1/${layouts.length})` : 'Composé ✓');
      success = true;
    } catch {
      setQaMsg('Erreur composition');
    } finally {
      setQaBusy(false);
      if (success && chainQA) setTimeout(() => { runVisualQA(); }, 450); // one-click : enchaîne l'audit visuel
      else setTimeout(() => setQaMsg(null), 2800);
    }
  };

  // Sélectionne une variante précise (pastilles 1·2·3).
  const selectVariant = async (idx: number) => {
    if (qaBusy || idx < 0 || idx >= aiVariants.length || idx === aiVariantIdx) return;
    setAiVariantIdx(idx);
    setQaBusy(true); setQaMsg(`Variante ${idx + 1}/${aiVariants.length}…`);
    try { await materializeLayout(aiVariants[idx]); setQaMsg(`Variante ${idx + 1} ✓`); }
    catch { setQaMsg('Erreur variante'); }
    finally { setQaBusy(false); setTimeout(() => setQaMsg(null), 2000); }
  };

  // Auto-composition à l'ouverture d'un post vierge, avec overlay de chargement.
  useEffect(() => {
    if (dataLoading || autoComposeDoneRef.current || !autoComposeReady) return;
    autoComposeDoneRef.current = true;
    (async () => {
      setAiBuilding(true);
      try { await composeWithAI({ chainQA: false }); } catch { /* noop */ }
      setAiBuilding(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading, autoComposeReady]);

  const deletePost = async () => {
    if (!confirm("Supprimer ce post ? Cette action est irréversible.")) return;
    await supabase.from('posts').delete().eq('id', postId);
    window.location.href = `/workspace/${workspaceId}`;
  };

  // ── Enregistrement d'un TEMPLATE (mode template) ──────────────────────────
  const handleSaveTemplate = async () => {
    if (!stageRef.current) return;
    setSaving(true);
    setSelectedId(null);
    setSelectedIds([]);
    await new Promise(resolve => setTimeout(resolve, 200));
    saveCurrentSlide();
    const els = elementsRef.current;
    // Miniature du template
    let thumbnailUrl: string | null = null;
    try {
      const dataURL = stageRef.current.toDataURL({ pixelRatio: 1 });
      const blob = await fetch(dataURL).then(r => r.blob());
      const fn = `${workspaceId}/templates/${entityId}-${Date.now()}.png`;
      await supabase.storage.from('photos').upload(fn, blob, { contentType: 'image/png', upsert: true });
      const { data: ud } = supabase.storage.from('photos').getPublicUrl(fn);
      thumbnailUrl = ud?.publicUrl || null;
    } catch {}
    // logo_placement dérivé d'une image non-placeholder (le logo posé sur le canvas)
    const logoEl = els.find(e => e.type === 'image' && (e as ImageEl).src !== PHOTO_PLACEHOLDER_SRC) as ImageEl | undefined;
    const logo_placement = logoEl ? { x: logoEl.x, y: logoEl.y, width: logoEl.width, height: logoEl.height } : null;
    const body = {
      workspace_id: workspaceId,
      name: templateName || 'Nouveau template',
      format_id: formatId,
      background_style: bgStyle ?? { type: 'gradient', colorFrom: '#0038FF', colorTo: '#FFFFFF', angle: 135 },
      text_zones: els,
      logo_placement,
      thumbnail_url: thumbnailUrl,
    };
    const isNew = !templateId || templateId === 'new';
    const res = await fetch(isNew ? '/api/templates' : `/api/templates/${templateId}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      window.location.href = `/workspace/${workspaceId}/templates`;
    } else {
      showEditorToast(T('templateSaveFailed'));
    }
  };

  const handleSave = async () => {
    if (isTemplate) { await handleSaveTemplate(); return; }
    if (!stageRef.current) return;
    setSaving(true);
    setSelectedId(null);
    setSelectedIds([]);
    await new Promise(resolve => setTimeout(resolve, 200));

    // Flush current slide
    saveCurrentSlide();

    const isCarousel = postType === 'carrousel';
    const totalSlides = slidesRef.current.length;
    const carouselUrls: string[] = [];

    const uploadCurrent = async (idx: number): Promise<string> => {
      const dataURL = stageRef.current!.toDataURL({ pixelRatio: 2 });
      const blob = await fetch(dataURL).then(r => r.blob());
      const fn = `${workspaceId}/${entityId}-slide${idx}-${Date.now()}.png`;
      await supabase.storage.from('exports').upload(fn, blob, { contentType: 'image/png', upsert: true });
      const { data: ud } = supabase.storage.from('exports').getPublicUrl(fn);
      return ud?.publicUrl || '';
    };

    if (isCarousel && isContinuous) {
      // Carrousel continu : la toile large est déjà rendue à l'écran. On la
      // découpe en `contPanels` régions de stageW via l'export de zone de Konva
      // (toDataURL {x,y,width,height}) → une slide Instagram par volet.
      for (let i = 0; i < contPanels; i++) {
        const dataURL = stageRef.current!.toDataURL({ x: i * stageW, y: 0, width: stageW, height: stageH, pixelRatio: 2 });
        const blob = await fetch(dataURL).then(r => r.blob());
        const fn = `${workspaceId}/${entityId}-slide${i}-${Date.now()}.png`;
        await supabase.storage.from('exports').upload(fn, blob, { contentType: 'image/png', upsert: true });
        const { data: ud } = supabase.storage.from('exports').getPublicUrl(fn);
        carouselUrls.push(ud?.publicUrl || '');
      }
    } else if (isCarousel && totalSlides > 1) {
      const origIdx = activeSlideIdx;
      // On rend CHAQUE slide avant de la capturer — sans exception. L'ancienne
      // optimisation (« ne pas re-rendre si i === slide active ») était buguée :
      // après la 1re itération le stage n'affiche plus la slide active, donc sa
      // capture reprenait la dernière slide rendue → carrousel avec toutes les
      // slides identiques.
      for (let i = 0; i < totalSlides; i++) {
        const s = slidesRef.current[i];
        setElements(s.elements);
        elementsRef.current = s.elements;
        setProxyUrl(s.proxyUrl);
        proxyUrlRef.current = s.proxyUrl;
        setBgOffsetX(s.bgOffsetX ?? 0);
        bgOffsetXRef.current = s.bgOffsetX ?? 0;
        setBgOffsetY(s.bgOffsetY ?? 0);
        bgOffsetYRef.current = s.bgOffsetY ?? 0;
        await new Promise(resolve => setTimeout(resolve, 450));
        const url = await uploadCurrent(i);
        carouselUrls.push(url);
      }
      // Restore original slide
      const orig = slidesRef.current[origIdx];
      setElements(orig.elements);
      elementsRef.current = orig.elements;
      setProxyUrl(orig.proxyUrl);
      proxyUrlRef.current = orig.proxyUrl;
      setBgOffsetX(orig.bgOffsetX ?? 0);
      bgOffsetXRef.current = orig.bgOffsetX ?? 0;
      setBgOffsetY(orig.bgOffsetY ?? 0);
      bgOffsetYRef.current = orig.bgOffsetY ?? 0;
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Export cover (active slide) for calendar / feed previews.
    // En continu, on ne capture que le 1er volet (sinon on aurait une image large).
    const coverDataURL = stageRef.current.toDataURL(isContinuous ? { x: 0, y: 0, width: stageW, height: stageH, pixelRatio: 2 } : { pixelRatio: 2 });
    const coverBlob = await fetch(coverDataURL).then(r => r.blob());
    const coverFn = `${workspaceId}/${entityId}-${Date.now()}.png`;
    await supabase.storage.from('exports').upload(coverFn, coverBlob, { contentType: 'image/png', upsert: true });
    const { data: coverUrl } = supabase.storage.from('exports').getPublicUrl(coverFn);

    const textEl = elements.find(e => e.type === 'text') as TextEl | undefined;
    const allSlides = slidesRef.current;

    await supabase.from('posts').update({
      status: 'validated',
      exported_image_url: isCarousel && carouselUrls.length > 0 ? carouselUrls[0] : (coverUrl?.publicUrl || ''),
      editor_json: JSON.stringify({
        version: 2,
        slides: allSlides,
        ...(isContinuous ? { carouselContinuous: true, contPanels } : {}),
        ...(isCarousel && carouselUrls.length > 0 ? { carousel_urls: carouselUrls } : {}),
      }),
      texte_visuel: textEl?.text || '',
      ...(aiCaption ? { caption_final: aiCaption, caption_was_edited: captionEdited } : {}),
    }).eq('id', postId);
    window.location.href = `/workspace/${workspaceId}/planning`;
  };

  // ── Post type change — updates format + clamps elements + saves to DB ───────

  const changePostType = async (newType: 'post' | 'reel' | 'story' | 'carrousel') => {
    const TYPE_FORMAT: Record<string, string> = { post: 'ig-portrait', reel: 'ig-story', story: 'ig-story', carrousel: 'ig-square' };
    const newFormatId = TYPE_FORMAT[newType];
    if (newType === 'story' && formatId !== 'ig-story' && elements.length > 0) {
      setPendingStoryType('story');
      setShowStoryWarn(true);
      return;
    }
    const newFmt = FORMATS.find(f => f.id === newFormatId) ?? FORMATS[0];
    setPostType(newType);
    setFormatId(newFormatId);
    // Réadapte le texte au nouveau format : clamp + auto-fit + anti-chevauchement.
    const clamped = elementsRef.current.map(el => ({
      ...el,
      x: Math.min(el.x, newFmt.w - 20),
      y: Math.min(el.y, newFmt.h - 20),
    }));
    const relaid = relayoutText(clamped, newFmt.w, newFmt.h);
    setElements(relaid);
    elementsRef.current = relaid;
    await supabase.from('posts').update({ post_type: newType }).eq('id', postId);
  };

  // ── Magic Resize — génère des posts séparés adaptés aux 2 autres formats ────
  // (mapping restreint à ig-portrait/ig-square/ig-story : le format 'facebook'
  // n'a pas de post_type de retour propre via PT_FORMAT_MAP, cf. remap ci-dessus)

  const magicResize = async () => {
    if (resizing) return;
    const targets = MAGIC_RESIZE_TARGETS.filter(t => t.formatId !== formatId);
    if (!targets.length) { showEditorToast(T('noOtherFormat')); return; }
    const currentElements = elementsRef.current;
    if (!currentElements.length && !proxyUrl) { showEditorToast(T('addContentFirst')); return; }
    setResizing(true);
    try {
      let natW = 0, natH = 0;
      if (proxyUrl) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('load')); img.src = proxyUrl; });
          natW = img.naturalWidth; natH = img.naturalHeight;
        } catch { /* pas de recadrage de fond possible, on garde 0/0 */ }
      }
      const { data: srcPost } = await supabase.from('posts').select('brief, description').eq('id', postId).single();
      let created = 0;
      for (const target of targets) {
        const fmt = FORMATS.find(f => f.id === target.formatId);
        if (!fmt) continue;
        const remapped = remapElementsToFormat(currentElements, stageW, stageH, fmt.w, fmt.h);
        const relaid = relayoutText(remapped, fmt.w, fmt.h);
        let bgOX = 0, bgOY = 0;
        if (proxyUrl && natW && natH) {
          const scale = Math.max(fmt.w / natW, fmt.h / natH);
          bgOX = (fmt.w - natW * scale) / 2;
          bgOY = (fmt.h - natH * scale) / 2;
        }
        const textEl = relaid.find((e: CanvasEl) => e.type === 'text') as TextEl | undefined;
        const editorJson = JSON.stringify({
          version: 2,
          slides: [{ id: 'slide-1', elements: relaid, proxyUrl, bgOffsetX: bgOX, bgOffsetY: bgOY }],
        });
        const { error } = await supabase.from('posts').insert({
          workspace_id: workspaceId,
          photo_url: postPhotoUrl,
          brief: srcPost?.brief ?? '',
          description: srcPost?.description ?? '',
          texte_visuel: textEl?.text || '',
          status: 'validated',
          post_type: target.postType,
          editor_json: editorJson,
        });
        if (!error) created++;
      }
      showEditorToast(created > 0 ? T('formatsGenerated', { count: created }) : T('formatsFailed'));
    } finally {
      setResizing(false);
    }
  };

  // ── Font upload ───────────────────────────────────────────────────────────

  const handleFontUpload = async (file: File): Promise<string> => {
    const fontName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-');
    const arrayBuffer = await file.arrayBuffer();
    const fontFace = new FontFace(fontName, arrayBuffer);
    await fontFace.load();
    document.fonts.add(fontFace);
    const fileName = `fonts/${workspaceId}/${file.name}`;
    await supabase.storage.from('exports').upload(fileName, file, { upsert: true });
    const { data: urlData } = supabase.storage.from('exports').getPublicUrl(fileName);
    const newFont = { name: fontName, url: urlData.publicUrl };
    setCustomFonts(prev => {
      const updated = [...prev, newFont];
      supabase.from('workspaces').update({ custom_fonts: JSON.stringify(updated) }).eq('id', workspaceId);
      return updated;
    });
    return fontName;
  };

  // ── Templates ─────────────────────────────────────────────────────────────

  const applyTemplate = (overrides: Partial<TextEl>) => {
    const el: TextEl = { id: newId(), type: 'text', x: 20, y: 200, rotation: 0, opacity: 100, text: 'VOTRE TEXTE', fontSize: 36, fontFamily: 'Oswald', fontStyle: 'bold', textDecoration: '', fill: '#ffffff', align: 'left', width: 560, hasBg: true, bgColor: '#0038FF', bgOpacity: 95, cornerRadius: 4, padding: 16, paddingH: 16, paddingV: 10, ...overrides };
    applyElements([...elements, el]);
    setSelectedId(el.id);
  };

  const TEMPLATES = [
    { label: 'Bloc couleur', overrides: { hasBg: true, bgColor: '#0038FF', bgOpacity: 100, fill: '#fff', fontStyle: 'bold', fontSize: 40 } },
    { label: 'Texte blanc bold', overrides: { hasBg: false, fill: '#ffffff', fontStyle: 'bold', fontSize: 56, opacity: 100 } },
    { label: 'Semi-transparent', overrides: { hasBg: true, bgColor: '#000000', bgOpacity: 65, fill: '#ffffff', fontSize: 38, cornerRadius: 0 } },
    { label: 'Badge arrondi', overrides: { hasBg: true, bgColor: '#B8F028', bgOpacity: 100, fill: '#000000', cornerRadius: 40, padding: 18, fontSize: 28, width: 300 } },
  ];

  // 4D — Multi-block layout templates (inserts several role-tagged text elements)
  // ── AI generation ─────────────────────────────────────────────────────────

  const generateAI = async (tone: string) => {
    if (aiTimerRef.current) clearInterval(aiTimerRef.current);
    setAiTyping(true); setAiCaption(''); setCaptionEdited(false);
    try {
      // ── 5A: collect template zones (ID-keyed, with size info for char limits) ─
      const templateZones = elementsRef.current
        .filter(el => el.type === 'text' && (el as TextEl).role)
        .map(el => {
          const t = el as TextEl;
          const pH = t.paddingH ?? t.padding ?? 12;
          const pV = t.paddingV ?? t.padding ?? 8;
          return {
            id: t.id,
            role: t.role,
            width: Math.max(t.width ?? 200, 1),
            height: Math.max(t.fontSize + pV * 2, 1),
            fontSize: Math.max(t.fontSize, 1),
          };
        });

      // ── 4D (legacy): role-name map — used only when no template zones ─────────
      const textRoles: Record<string, string> = {};
      if (templateZones.length === 0) {
        elementsRef.current.forEach(el => {
          if (el.type === 'text' && (el as TextEl).role) textRoles[(el as TextEl).role!] = (el as TextEl).text;
        });
      }

      // 5C — fetch last approved captions for this workspace (brand memory)
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('caption_final')
        .eq('workspace_id', workspaceId)
        .eq('caption_was_edited', true)
        .not('caption_final', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(3);
      const approvedCaptions = (recentPosts ?? []).map((p: { caption_final: string | null }) => p.caption_final).filter(Boolean) as string[];

      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: `Post ${tone.toLowerCase()} pour ${workspaceName}`,
          photoUrl: postPhotoUrl,
          workspaceName,
          // Brand identity
          sector: workspaceData?.sector,
          tone,
          brandTone: workspaceData?.tone,
          companyDescription: workspaceData?.company_description,
          // Voice rules
          brandVoicePrompt: workspaceData?.brand_voice_prompt,
          wordsToUse: workspaceData?.words_to_use,
          wordsToAvoid: workspaceData?.words_to_avoid,
          captionExamples: workspaceData?.caption_examples,
          descriptionStyle: workspaceData?.description_style,
          // 5A — template zones with dimensions (replaces role-name map when present)
          templateZones: templateZones.length > 0 ? templateZones : undefined,
          // 4D — legacy role-name map (only sent when no template zones)
          textRoles: Object.keys(textRoles).length > 0 ? textRoles : undefined,
          // 5B — post context
          context: postContext.trim() || undefined,
          // 5C — approved captions for memory
          approvedCaptions: approvedCaptions.length > 0 ? approvedCaptions : undefined,
        }),
      });
      const data = await res.json();

      // ── 5A: apply zone_blocks by element ID (primary — template mode) ─────────
      if (data.zoneBlocks && typeof data.zoneBlocks === 'object') {
        const newEls = elementsRef.current.map(el => {
          if (el.type === 'text') {
            const generated = (data.zoneBlocks as Record<string, string>)[el.id];
            if (generated) return { ...el, text: generated } as TextEl;
          }
          return el;
        });
        applyElements(newEls, false);
      }

      // ── 4D: apply blocks by role name (fallback — no-template mode) ──────────
      if (!data.zoneBlocks && data.blocks && typeof data.blocks === 'object') {
        const newEls = elementsRef.current.map(el => {
          if (el.type === 'text' && (el as TextEl).role) {
            const generated = (data.blocks as Record<string, string>)[(el as TextEl).role!];
            if (generated) return { ...el, text: generated } as TextEl;
          }
          return el;
        });
        applyElements(newEls, false);
      }

      const text: string = data?.description || data?.texte_visuel || '';
      let i = 0;
      aiTimerRef.current = setInterval(() => {
        i += 3; setAiCaption(text.slice(0, i));
        if (i >= text.length) { if (aiTimerRef.current) clearInterval(aiTimerRef.current); setAiTyping(false); }
      }, 14);
    } catch { setAiTyping(false); }
  };

  const canUndo = histIdxRef.current > 0;
  const canRedo = histIdxRef.current < historyRef.current.length - 1;
  void histTick;

  // ── Loading / error states ─────────────────────────────────────────────────

  if (dataLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--canvas)', flexDirection: 'column', gap: 16 }}>
      <svg style={{ width: 24, height: 24, color: 'var(--ink-3)', animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"/>
        <path fill="currentColor" fillOpacity="0.75" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
      </svg>
      <span style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--sans)' }}>{T('loadingEditor')}</span>
    </div>
  );

  if (loadError) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--canvas)', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 14, color: 'var(--warn)', fontFamily: 'var(--sans)' }}>{loadError}</p>
      <button onClick={() => window.location.reload()} className="btn btn-primary">
        Réessayer
      </button>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {sidebarOpen && <Sidebar />}

      {/* ── Menu contextuel (clic droit sur un élément, façon Canva) ── */}
      {ctxMenu && (() => {
        const el = elements.find(e => e.id === ctxMenu.id);
        if (!el) return null;
        const locked = lockedIds.has(el.id);
        const close = () => setCtxMenu(null);
        const item = (label: string, shortcut: string, onClick: () => void, danger?: boolean) => (
          <button key={label} onClick={() => { onClick(); close(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: danger ? '#C4452F' : 'var(--ink)', textAlign: 'left', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ flex: 1 }}>{label}</span>
            {shortcut && <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{shortcut}</span>}
          </button>
        );
        const sep = (k: string) => <div key={k} style={{ height: 1, background: 'var(--line)', margin: '5px 0' }} />;
        const MENU_W = 232;
        const left = Math.min(ctxMenu.x, window.innerWidth - MENU_W - 8);
        const top = Math.min(ctxMenu.y, window.innerHeight - 380);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300 }} onMouseDown={close} onContextMenu={e => { e.preventDefault(); close(); }}>
            <div className="pop-in" onMouseDown={e => e.stopPropagation()}
              style={{ position: 'fixed', left, top: Math.max(8, top), width: MENU_W, background: '#fff', borderRadius: 12, padding: '6px 0', boxShadow: '0 16px 44px -12px rgba(13,15,10,.4), 0 0 0 1px rgba(13,15,10,.06)' }}>
              {item('Copier', 'Ctrl+C', () => copyEl(el.id))}
              {item('Coller', 'Ctrl+V', () => pasteEl())}
              {item('Dupliquer', 'Ctrl+D', () => { setSelectedId(el.id); duplicateEl(); })}
              {item('Supprimer', 'Suppr', () => deleteEl(el.id), true)}
              {sep('s1')}
              {item('Vers l\u2019avant', '', () => { setSelectedId(el.id); layerAction('forward'); })}
              {item('Vers l\u2019arrière', '', () => { setSelectedId(el.id); layerAction('backward'); })}
              {item('Mettre au premier plan', '', () => { setSelectedId(el.id); layerAction('front'); })}
              {item('Mettre à l\u2019arrière-plan', '', () => { setSelectedId(el.id); layerAction('back'); })}
              {sep('s2')}
              {item(locked ? 'Déverrouiller' : 'Verrouiller', '', () => toggleLocked(el.id))}
            </div>
          </div>
        );
      })()}

      {/* ── Editor toast ── */}
      {editorToast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, padding: '11px 22px', borderRadius: 99, fontWeight: 700, fontSize: 13, background: 'var(--warn)', color: '#fff', boxShadow: '0 8px 24px rgba(13,15,10,.3)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {editorToast}
        </div>
      )}

      {/* ── Story format warning modal ── */}
      {showStoryWarn && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,15,10,.45)' }} onClick={() => { setShowStoryWarn(false); setPendingStoryType(null); }}>
          <div className="card" style={{ padding: 28, maxWidth: 380, width: '100%', margin: '0 16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(200,115,43,.12)', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2" strokeLinecap="round"><path d="M10.3 3.4 2.7 17A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-3L13.7 3.4a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>{T('changeFormat')}</h3>
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 22 }}>
              Passer en format Story (9:16) va adapter le cadre de votre visuel. Des éléments peuvent dépasser le cadre et nécessiter des ajustements.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowStoryWarn(false); setPendingStoryType(null); }} className="btn btn-ghost" style={{ flex: 1 }}>{T('cancel')}</button>
              <button onClick={async () => {
                setShowStoryWarn(false);
                if (pendingStoryType) {
                  const TYPE_FORMAT: Record<string, string> = { post: 'ig-portrait', reel: 'ig-story', story: 'ig-story', carrousel: 'ig-square' };
                  const newFormatId = TYPE_FORMAT[pendingStoryType];
                  const newFmt = FORMATS.find(f => f.id === newFormatId) ?? FORMATS[0];
                  setPostType(pendingStoryType);
                  setFormatId(newFormatId);
                  const clamped = elementsRef.current.map(el => ({ ...el, x: Math.min(el.x, newFmt.w - 20), y: Math.min(el.y, newFmt.h - 20) }));
                  const relaid = relayoutText(clamped, newFmt.w, newFmt.h);
                  setElements(relaid);
                  elementsRef.current = relaid;
                  await supabase.from('posts').update({ post_type: pendingStoryType }).eq('id', postId);
                }
                setPendingStoryType(null);
              }} className="btn btn-primary" style={{ flex: 1 }}>{T('continue')}</button>
            </div>
          </div>
        </div>
      )}

    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'var(--sans)', background: 'radial-gradient(120% 80% at 50% -10%, #FBFAF4, #ECEBE1 70%)', overflow: 'hidden', marginLeft: sidebarOpen ? 'var(--sb-w)' : 0, transition: 'margin-left 0.2s' }}>

      {/* ── TOPBAR ── */}
      <div data-stop-deselect className={`ed-topbar${sidebarOpen ? ' ed-narrow' : ''}`} style={{
        minHeight: 60, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px',
        // Bandeau vert dégradé (façon en-tête sombre Canva) — tous les enfants
        // basculent en clair via ces overrides de tokens (scopés à la topbar).
        background: 'linear-gradient(115deg, var(--forest) 0%, var(--forest-2) 55%, var(--forest-3) 100%)',
        ['--ink' as string]: '#F1F0E8',
        ['--ink-2' as string]: 'rgba(241,240,232,.72)',
        ['--ink-3' as string]: 'rgba(241,240,232,.52)',
        ['--line' as string]: 'rgba(255,255,255,.16)',
        ['--sunk' as string]: 'rgba(255,255,255,.10)',
        ['--canvas' as string]: 'rgba(255,255,255,.16)',
        ['--paper' as string]: 'rgba(255,255,255,.10)',
        position: 'relative', zIndex: 30,
      }}>
        {/* Left: burger + back + workspace label + undo/redo */}
        <div className="ed-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button onClick={toggleSidebar} title={sidebarOpen ? 'Masquer la sidebar' : 'Afficher la sidebar'}
            className="btn btn-sm btn-ghost btn-icon" style={{ flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <a href={isTemplate ? `/workspace/${workspaceId}/templates` : `/workspace/${workspaceId}`} className="btn btn-sm btn-ghost"
            style={{ gap: 5, textDecoration: 'none', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
            <span className="ed-hide-sm">{isTemplate ? 'Templates' : 'Retour'}</span>
          </a>
          <span className="ed-hide-sm" style={{ width: 1, height: 24, background: 'var(--line)', flexShrink: 0 }} />
          <div className="ed-hide-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--mint)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 10, color: '#06281C', letterSpacing: '-0.02em' }}>
                {workspaceName ? workspaceName.slice(0,2).toUpperCase() : 'KL'}
              </span>
            </div>
            {isTemplate ? (
              <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder={T('templateName')}
                style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '4px 8px', outline: 'none', fontFamily: 'var(--sans)', background: 'var(--sunk)', maxWidth: 180 }} />
            ) : (
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{workspaceName || 'Éditeur'}</span>
            )}
            <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: 10.5 }}>
              {isTemplate ? `Template · ${activeFormat.label}` : `${activeFormat.label}${slides.length > 1 ? ` · ${slides.length} slides` : ''}`}
            </span>
          </div>
          <span style={{ width: 1, height: 24, background: 'var(--line)', flexShrink: 0 }} />
          <button onClick={undo} disabled={!canUndo} title={T('undo')} className="ed-hbtn"
            style={{ opacity: canUndo ? 1 : 0.3 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1"/></svg>
          </button>
          <button onClick={redo} disabled={!canRedo} title={T('redo')} className="ed-hbtn"
            style={{ opacity: canRedo ? 1 : 0.3 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1"/></svg>
          </button>
        </div>

        {/* Center: hint (barre contextuelle déplacée en flottant au-dessus du plan de travail) */}
        <div className="ed-topbar-center" style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          {!selectedEl && (
            <span className="ed-hint-desktop" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              Sélectionnez un calque pour le modifier
            </span>
          )}
        </div>

        {/* Right: Type selector + Aperçu + Partager */}
        <div className="ed-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isTemplate ? (
            /* Format pills (template mode) */
            <div className="ed-type-pills" style={{ display: 'flex', gap: 2, padding: '3px', background: 'var(--sunk)', borderRadius: 'var(--r-s)', border: '1px solid var(--line)' }}>
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormatId(f.id)}
                  style={{ padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'var(--sans)', transition: 'all .12s',
                    background: formatId === f.id ? 'var(--canvas)' : 'transparent',
                    color: formatId === f.id ? 'var(--ink)' : 'var(--ink-3)',
                    boxShadow: formatId === f.id ? '0 1px 3px rgba(13,15,10,.1)' : 'none',
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* Post type pills */}
              <div className="ed-type-pills" style={{ display: 'flex', gap: 2, padding: '3px', background: 'var(--sunk)', borderRadius: 'var(--r-s)', border: '1px solid var(--line)' }}>
                {(['post', 'reel', 'story', 'carrousel'] as const).map(t => (
                  <button key={t} onClick={() => changePostType(t)}
                    style={{ padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'var(--sans)', transition: 'all .12s',
                      background: postType === t ? 'var(--canvas)' : 'transparent',
                      color: postType === t ? 'var(--ink)' : 'var(--ink-3)',
                      boxShadow: postType === t ? '0 1px 3px rgba(13,15,10,.1)' : 'none',
                    }}>
                    {t === 'post' ? 'Post' : t === 'reel' ? 'Reel' : t === 'story' ? 'Story' : 'Carrousel'}
                  </button>
                ))}
              </div>
              <button onClick={() => composeWithAI()} disabled={qaBusy} className="btn btn-sm ed-ai-btn" title={T('aiComposeTip')}
                style={{ height: 36, opacity: qaBusy ? 0.6 : 1, cursor: qaBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 3l1.6 4.9L16 9.5l-4.9 1.6L9.5 16l-1.6-4.9L3 9.5l4.9-1.6z"/><path d="M18 14l.8 2.5L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.5z"/></svg>
                <span className="ed-hide-md">{aiVariants.length ? 'Recomposer' : 'Composer (IA)'}</span>
              </button>
              {aiVariants.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px', background: 'var(--sunk)', borderRadius: 9, border: '1px solid var(--line)', flexShrink: 0 }} title={T('aiPickVariant')}>
                  {aiVariants.map((_, i) => (
                    <button key={i} onClick={() => selectVariant(i)} disabled={qaBusy}
                      style={{ width: 26, height: 26, borderRadius: 6, border: 'none', cursor: qaBusy ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800, fontFamily: 'var(--sans)',
                        background: i === aiVariantIdx ? 'var(--canvas)' : 'transparent', color: i === aiVariantIdx ? 'var(--ink)' : 'var(--ink-3)',
                        boxShadow: i === aiVariantIdx ? '0 1px 3px rgba(13,15,10,.1)' : 'none' }}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={runVisualQA} disabled={qaBusy} className="btn btn-sm ed-ai-btn" title={T('aiQaTip')}
                style={{ height: 36, opacity: qaBusy ? 0.6 : 1, cursor: qaBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 10l-5.8 1.9L12 18l-1.9-5.8L4 10l5.8-1.2z"/></svg>
                <span className="ed-hide-md">{qaBusy ? 'Analyse…' : 'Vérifier'}</span>
              </button>
              <div style={{ position: 'relative' }}>
                <button onClick={() => generateAI(aiTone)} disabled={aiTyping} className="btn btn-sm ed-ai-btn" title={T('aiCaptionTip')}
                  style={{ height: 36, opacity: aiTyping ? 0.6 : 1, cursor: aiTyping ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
                  <span className="ed-hide-md">{aiTyping ? 'Rédaction…' : 'Régénérer la légende'}</span>
                </button>
                {(aiTyping || aiCaption) && (
                  <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, width: 280, maxHeight: 220, overflowY: 'auto', padding: '12px 14px', borderRadius: 10, background: 'var(--canvas)', border: '1px solid var(--line)', boxShadow: '0 12px 30px rgba(13,15,10,.18)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink-3)', marginBottom: 6 }}>{T('generatedCaption')}</div>
                    <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', margin: 0 }}>{aiCaption || '…'}</p>
                  </div>
                )}
              </div>
            </>
          )}
          <button onClick={exportPNG} className="btn btn-sm btn-ghost" style={{ height: 36 }}>{T('preview')}</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-sm btn-primary"
            style={{ height: 36, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Sauvegarde…' : isTemplate ? 'Enregistrer' : 'Publier'}
          </button>
        </div>
      </div>

      {/* ── Barre contextuelle MOBILE (au-dessus du rail) ── */}
      {selectedEl && (
        <div className="ed-mobile-ctx" data-stop-deselect>
          <EditorContextToolbar
            sel={selectedEl}
            allFonts={[...FONTS, ...brandFontNames, ...customFonts.map(f => f.name)]}
            brandColors={[workspaceData?.primary_color, workspaceData?.secondary_color, workspaceData?.accent_color].filter(Boolean) as string[]}
            stageW={stageW}
            stageH={stageH}
            onUpdate={(patch) => updateEl(selectedEl.id, patch)}
            onAlign={alignEl}
            onDuplicate={duplicateEl}
            onDelete={() => deleteEl(selectedId)}
            onCrop={selectedEl.type === 'image' ? () => setCropId(selectedEl.id) : undefined}
            onSetBg={selectedEl.type === 'image' ? () => setProxyUrl((selectedEl as ImageEl).src) : undefined}
            onMaskPhoto={selectedEl.type === 'vector' ? () => maskPhotoInputRef.current?.click() : undefined}
            onRemoveBg={selectedEl.type === 'image' ? () => removeBgFromImage(selectedEl as ImageEl) : undefined}
            bgRemoving={bgRemovingId === selectedEl.id}
            onLayerAction={layerAction}
            onOpenFx={openFxPanel}
            fxPanel={fxPanel}
          />
        </div>
      )}

      {/* ── BODY: rail + flyout + canvas workspace ── */}
      <div className="ed-body" style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── TOOL RAIL (68px) ── */}
        <div data-stop-deselect className="ed-rail" style={{ width: 76, background: 'var(--white)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 2, flexShrink: 0 }}>
          {([
            { id: 'design',   label: 'Modèles',  icon: <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><line x1="9" y1="4" x2="9" y2="20"/></svg> },
            { id: 'elements', label: 'Éléments', icon: <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="8" r="3.4"/><rect x="12.5" y="4.6" width="7" height="7" rx="1.7"/><path d="M8 14.2l4.2 6.2H3.8l4.2-6.2z"/></svg> },
            { id: 'text',     label: 'Texte',    icon: <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 6.5 5 4 19 4 19 6.5"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="9" y1="20" x2="15" y2="20"/></svg> },
            { id: 'photos',   label: 'Photos',   icon: <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/></svg> },
            { id: 'brand',    label: 'Charte',   icon: <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 0 0 0 18 2.4 2.4 0 0 0 2-3.7 1.4 1.4 0 0 1 1.2-2.2H17a4 4 0 0 0 4-4c0-4.4-4-8.1-9-8.1z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.3" cy="11" r="1.1" fill="currentColor" stroke="none"/></svg> },
            { id: 'upload',   label: 'Importer', icon: <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg> },
            { id: 'calques',  label: 'Calques',  icon: <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
          ] as const).map(({ id, label, icon }) => (
            <button key={id} onClick={() => { setTool(tool === id ? null : id); setFxPanel(null); if (isPenMode) cancelPenMode(); }} title={label}
              style={{ width: 62, height: 62, borderRadius: 14, border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', transition: 'all .14s',
                background: tool === id ? 'var(--mint-soft)' : 'transparent',
                boxShadow: tool === id ? 'inset 0 0 0 1.5px color-mix(in srgb, var(--mint-2) 55%, transparent)' : 'none',
                color: tool === id ? 'var(--mint-2)' : 'color-mix(in srgb, var(--ink) 70%, var(--white))' }}
              onMouseEnter={e => { if (tool !== id) e.currentTarget.style.background = 'color-mix(in srgb, var(--ink) 6%, var(--white))'; }}
              onMouseLeave={e => { if (tool !== id) e.currentTarget.style.background = 'transparent'; }}>
              {icon}
              <span style={{ fontFamily: 'var(--sans)', fontWeight: tool === id ? 700 : 600, fontSize: 11, letterSpacing: 0, lineHeight: 1 }}>{label}</span>
            </button>
          ))}
          <div style={{ width: 32, height: 1, background: 'var(--sunk)', margin: '4px 0' }} />
          <button onClick={() => { setIsPenMode(p => !p); setTool(null); }} title={T('penToolTip')}
            style={{ width: 62, height: 62, borderRadius: 14, border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: isPenMode ? 'crosshair' : 'pointer', transition: 'all .14s',
              background: isPenMode ? 'var(--mint-soft)' : 'transparent',
              boxShadow: isPenMode ? 'inset 0 0 0 1.5px color-mix(in srgb, var(--mint-2) 55%, transparent)' : 'none',
              color: isPenMode ? 'var(--mint-2)' : 'color-mix(in srgb, var(--ink) 70%, var(--white))' }}
            onMouseEnter={e => { if (!isPenMode) e.currentTarget.style.background = 'color-mix(in srgb, var(--ink) 6%, var(--white))'; }}
            onMouseLeave={e => { if (!isPenMode) e.currentTarget.style.background = 'transparent'; }}>
            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: isPenMode ? 700 : 600, fontSize: 11, letterSpacing: 0, lineHeight: 1 }}>{T('penTool')}</span>
          </button>
        </div>

        {/* ── TOOL PANEL FLYOUT (312px, conditional) ── */}
        {tool && (
          <div data-stop-deselect className="pop-in ed-panel" style={{ width: 312, background: 'var(--white)', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

            {/* DESIGN — Modèles */}
            {tool === 'design' && (
              <div style={{ padding: '18px' }}>
                <PanelHead title={T('templates')} sub={`Mises en page · ${workspaceName}`} onClose={() => setTool(null)} />
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ink-3)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                  <input className="input" placeholder={T('searchTemplate')} style={{ paddingLeft: 36, height: 40, background: 'var(--white)', border: '1px solid var(--line)' }} />
                </div>
                <p className="label" style={{ marginBottom: 9 }}>{T('backgrounds')}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
                  {([
                    { from: '#2b8d57', to: '#0c2a1d', angle: 150 },
                    { from: '#2FD79B', to: '#06281C', angle: 150 },
                    { from: '#F5F0E8', to: '#c9c4b2', angle: 150 },
                    { from: '#111111', to: '#333333', angle: 150 },
                    { from: '#0038FF', to: '#001a80', angle: 150 },
                    { from: '#FF6B6B', to: '#c0392b', angle: 150 },
                    { from: '#FFD700', to: '#b8860b', angle: 150 },
                    { from: '#a855f7', to: '#4c1d95', angle: 150 },
                    { from: '#f97316', to: '#7c2d12', angle: 150 },
                  ] as const).map(({ from, to, angle }, i) => (
                    <button key={i} onClick={() => setBgStyle({ type: 'gradient', colorFrom: from, colorTo: to, angle })}
                      style={{ aspectRatio: '4/5', borderRadius: 11, background: `linear-gradient(${angle}deg,${from},${to})`, border: 'none', cursor: 'pointer', transition: 'transform .12s',
                        boxShadow: 'inset 0 0 0 1px rgba(13,15,10,.10)' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }} />
                  ))}
                </div>
              </div>
            )}

            {/* ELEMENTS — Éléments */}
            {tool === 'elements' && (
              <div style={{ padding: '18px' }}>
                <PanelHead title={T('elements')} sub="Formes & blocs de couleur" onClose={() => setTool(null)} />
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ink-3)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                  <input className="input" placeholder={T('searchElement')} value={iconQuery} onChange={e => setIconQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchIcons(iconQuery); } }}
                    style={{ paddingLeft: 36, height: 40, background: 'var(--sunk)', border: 'none' }} />
                </div>

                {/* ── Parcourir par catégorie (tuiles colorées façon Canva) ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 18 }}>
                  {([
                    { label: 'Formes',   q: 'shape',        grad: 'linear-gradient(135deg, var(--mint), var(--mint-2))',      fg: '#06281C', glyph: <><rect x="4" y="4" width="7" height="7" rx="1.6"/><circle cx="17" cy="7.5" r="3.6"/><polygon points="8 22 3 15 13 15"/></> },
                    { label: 'Flèches',  q: 'arrow',        grad: 'linear-gradient(135deg, var(--acid), var(--mint))',        fg: '#06281C', glyph: <path d="M4 12h13M12 6l6 6-6 6"/> },
                    { label: 'Icônes',   q: 'star',         grad: 'linear-gradient(135deg, var(--mint-2), var(--forest-2))',  fg: '#FFFFFF', glyph: <polygon points="12 3 14.6 9 21 9.4 16 13.8 17.6 20 12 16.6 6.4 20 8 13.8 3 9.4 9.4 9"/> },
                    { label: 'Illustrations', q: 'illustration', grad: 'linear-gradient(135deg, var(--forest-3), var(--forest))', fg: '#FFFFFF', glyph: <><rect x="3" y="4" width="18" height="14" rx="2"/><circle cx="8" cy="9" r="1.6"/><path d="M3 16l5-4 4 3 3-2 6 5"/></> },
                    { label: 'Cadres',   q: 'frame',        grad: 'linear-gradient(135deg, var(--forest), var(--forest-3))',  fg: '#FFFFFF', glyph: <><rect x="3" y="3" width="18" height="18" rx="1.5"/><rect x="7" y="7" width="10" height="10" rx="1"/></> },
                    { label: 'Stickers', q: 'sticker',      grad: 'linear-gradient(135deg, var(--acid), var(--mint-2))',      fg: '#06281C', glyph: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8l6-6V5a2 2 0 0 0-2-2z"/><path d="M14 21v-4a2 2 0 0 1 2-2h4"/></> },
                  ]).map(({ label, q, grad, fg, glyph }) => (
                    <button key={label} onClick={() => { setIconQuery(q); fetchIcons(q); }} title={label}
                      style={{ position: 'relative', aspectRatio: '1', borderRadius: 14, border: 'none', cursor: 'pointer', background: grad, color: fg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden', boxShadow: '0 2px 8px color-mix(in srgb, var(--forest) 14%, transparent)', transition: 'transform .12s' }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{glyph}</svg>
                      <span style={{ fontSize: 10.5, fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: 0 }}>{label}</span>
                    </button>
                  ))}
                </div>

                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px' }}>{T('shapes')}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 18 }}>
                  {([
                    { shape: 'rectangle' as const, label: 'Carré',    icon: <rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor"/> },
                    { shape: 'circle' as const,    label: 'Cercle',   icon: <circle cx="12" cy="12" r="7.5" fill="currentColor"/> },
                    { shape: 'pill' as const,      label: 'Pilule',   icon: <rect x="3" y="8" width="18" height="8" rx="4" fill="currentColor"/> },
                    { shape: 'triangle' as const,  label: 'Triangle', icon: <polygon points="12,4 21,20 3,20" fill="currentColor"/> },
                    { shape: 'star' as const,      label: 'Étoile',   icon: <polygon points="12,3 14.5,9 21,9.5 16,14 17.5,21 12,17.5 6.5,21 8,14 3,9.5 9.5,9" fill="currentColor"/> },
                    { shape: 'diamond' as const,   label: 'Losange',  icon: <polygon points="12,3 21,12 12,21 3,12" fill="currentColor"/> },
                    { shape: 'hexagon' as const,   label: 'Hexagone', icon: <polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="currentColor"/> },
                    { shape: 'arrow' as const,     label: 'Flèche',   icon: <path fill="currentColor" strokeLinejoin="round" d="M3 10h11V6l7 6-7 6v-4H3z"/> },
                  ]).map(({ shape, label, icon }) => (
                    <button key={shape} onClick={() => addVector(shape)}
                      style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--white)', transition: 'all .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint)'; e.currentTarget.style.background = 'var(--sunk)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--white)'; }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" style={{ color: 'var(--ink)' }}>{icon}</svg>
                      <span style={{ fontSize: 8.5, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px' }}>{T('badges')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['NOUVEAU', '-20%', 'RÉSA EN BIO'].map(badge => (
                    <button key={badge} onClick={() => { const el: TextEl = { id: newId(), type: 'text', x: 60, y: 60, rotation: 0, opacity: 100, text: badge, fontSize: 32, fontFamily: 'Archivo', fontStyle: 'bold', textDecoration: '', fill: '#fff', align: 'center', width: 220, hasBg: true, bgColor: workspaceData?.primary_color || '#0038FF', bgOpacity: 100, cornerRadius: 8, padding: 16, paddingH: 20, paddingV: 12 }; applyElements([...elements, el]); setSelectedId(el.id); }}
                      style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px dashed var(--line)', cursor: 'pointer', fontSize: 13, fontFamily: 'Archivo', fontWeight: 800, letterSpacing: '.05em', color: 'var(--ink-2)', background: 'var(--sunk)', textAlign: 'left' }}>
                      {badge}
                    </button>
                  ))}
                </div>

                {/* ── Icônes SVG (Iconify) ── */}
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '20px 0 8px' }}>{T('iconsStickers')}</p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                    <input value={iconQuery} onChange={e => setIconQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchIcons(iconQuery); } }}
                      enterKeyHint="search" inputMode="search" autoCapitalize="none" autoCorrect="off"
                      placeholder={T('searchIcon')}
                      style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 12.5, outline: 'none', fontFamily: 'var(--sans)', background: 'var(--white)', color: 'var(--ink)', boxSizing: 'border-box' }} />
                  </div>
                  <button type="button" onClick={() => fetchIcons(iconQuery)} aria-label={T('search')}
                    style={{ flexShrink: 0, width: 40, borderRadius: 8, border: 'none', background: 'var(--mint, #2FD79B)', color: '#06281C', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                  </button>
                </div>
                {/* couleur d'icône */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{T('colorLabel')}</span>
                  {[['#14160F', 'Noir'], ['#FFFFFF', 'Blanc'], [workspaceData?.primary_color || '#2FD79B', 'Marque']].map(([c]) => (
                    <button key={c} onClick={() => setIconColor(c)} title={c}
                      style={{ width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer', border: iconColor === c ? '2px solid var(--mint, #2FD79B)' : '1.5px solid var(--line)', padding: 0 }} />
                  ))}
                </div>
                {iconLoading ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0' }}>{T('loading')}</p>
                ) : iconResults.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0' }}>{T('noIcon')}</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 8 }}>
                    {iconResults.map(name => (
                      <button key={name} onClick={() => addIcon(name)} title={name}
                        style={{ aspectRatio: '1', borderRadius: 8, border: '1px solid var(--line)', background: iconColor === '#FFFFFF' ? '#3a3f36' : 'var(--sunk)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 6 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={iconSvgUrl(name, iconColor, 48)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Motifs ── */}
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '16px 0 8px' }}>{T('patterns')}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
                  {([
                    { label: 'Pois', inner: (c: string) => `<pattern id='a' width='44' height='44' patternUnits='userSpaceOnUse'><circle cx='12' cy='12' r='6' fill='${c}'/></pattern>`, id: 'a' },
                    { label: 'Rayures', inner: (c: string) => `<pattern id='b' width='28' height='28' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><rect width='10' height='28' fill='${c}'/></pattern>`, id: 'b' },
                    { label: 'Grille', inner: (c: string) => `<pattern id='c' width='40' height='40' patternUnits='userSpaceOnUse'><path d='M40 0H0V40' fill='none' stroke='${c}' stroke-width='3'/></pattern>`, id: 'c' },
                    { label: 'Vagues', inner: (c: string) => `<pattern id='d' width='60' height='30' patternUnits='userSpaceOnUse'><path d='M0 15 Q15 0 30 15 T60 15' fill='none' stroke='${c}' stroke-width='4'/></pattern>`, id: 'd' },
                    { label: 'Chevrons', inner: (c: string) => `<pattern id='e' width='40' height='24' patternUnits='userSpaceOnUse'><path d='M0 22 L20 4 L40 22' fill='none' stroke='${c}' stroke-width='4'/></pattern>`, id: 'e' },
                    { label: 'Confettis', inner: (c: string) => `<pattern id='f' width='60' height='60' patternUnits='userSpaceOnUse'><rect x='8' y='10' width='10' height='10' rx='2' fill='${c}' transform='rotate(20 13 15)'/><circle cx='44' cy='20' r='5' fill='${c}'/><rect x='30' y='42' width='9' height='9' rx='2' fill='${c}' transform='rotate(-15 34 46)'/></pattern>`, id: 'f' },
                  ]).map(({ label, inner, id }) => {
                    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><defs>${inner(iconColor)}</defs><rect width='600' height='600' fill='url(#${id})'/></svg>`;
                    const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
                    return (
                      <button key={label} onClick={() => addPattern(svg)} title={label} className="well"
                        style={{ aspectRatio: '1', borderRadius: 10, cursor: 'pointer', overflow: 'hidden', padding: 0, background: iconColor === '#FFFFFF' ? '#3a3f36' : 'var(--sunk)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={uri} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TEXT */}
            {tool === 'text' && (
              <div style={{ padding: '18px' }}>
                <PanelHead title={T('text')} onClose={() => setTool(null)} />
                <button onClick={addText} className="btn btn-dark" style={{ width: '100%', justifyContent: 'center', marginBottom: 16, gap: 8, height: 44 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Ajouter une zone de texte
                </button>

                {/* ── COMBINAISONS DE TEXTE — jeux de typo façon Canva, cliquez pour ajouter ── */}
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px' }}>Combinaisons de texte</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                  {([
                    // — Composition : titre + tagline surlignés (façon éditorial dynamique) —
                    { apply: () => addTextComposition([
                        { text: 'GRANDE', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 118, fill: '#0C2A1D', uppercase: true, letterSpacing: -3, lineHeight: 0.86, width: 760 } },
                        { text: 'OUVERTURE', dy: 96, dx: 40, patch: { fontFamily: 'Archivo Black', fontSize: 40, fill: '#0C2A1D', uppercase: true, letterSpacing: 1, highlightEnabled: true, highlightColor: '#C8F135', highlightOpacity: 100, highlightBorderRadius: 3, highlightPadding: 10, width: 520 } },
                        { text: 'CE SAMEDI', dy: 170, dx: -30, patch: { fontFamily: 'Archivo Black', fontSize: 30, fill: '#0C2A1D', uppercase: true, letterSpacing: 1, highlightEnabled: true, highlightColor: '#C8F135', highlightOpacity: 100, highlightBorderRadius: 3, highlightPadding: 9, width: 420 } },
                      ]),
                      preview: <div style={{ textAlign: 'center', lineHeight: 1 }}>
                        <div style={{ fontFamily: 'Archivo Black', fontSize: 26, color: 'var(--forest)', letterSpacing: -1, lineHeight: 0.85 }}>GRANDE</div>
                        <div style={{ display: 'inline-block', fontFamily: 'Archivo Black', fontSize: 12, color: 'var(--forest)', background: 'var(--acid)', padding: '2px 6px', borderRadius: 3, marginTop: 5, transform: 'translateX(8px)' }}>OUVERTURE</div>
                        <div style={{ display: 'inline-block', fontFamily: 'Archivo Black', fontSize: 10, color: 'var(--forest)', background: 'var(--acid)', padding: '2px 6px', borderRadius: 3, marginTop: 4, transform: 'translateX(-6px)' }}>CE SAMEDI</div>
                      </div> },
                    // — Big number promo (label + chiffre dégradé + sous-ligne) —
                    { apply: () => addTextComposition([
                        { text: "JUSQU'À", dy: 0, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 30, fill: '#5A5E50', uppercase: true, letterSpacing: 8, width: 500 } },
                        { text: '-70%', dy: 40, patch: { fontFamily: 'Archivo Black', fontSize: 200, fillType: 'gradient', fill: '#2FD79B', fillTo: '#0C2A1D', fillAngle: 120, letterSpacing: -6, lineHeight: 0.9, width: 760 } },
                        { text: 'SUR TOUTE LA BOUTIQUE', dy: 240, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 26, fill: '#14160F', uppercase: true, letterSpacing: 3, width: 620 } },
                      ]),
                      preview: <div style={{ textAlign: 'center', lineHeight: 1 }}>
                        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 9, color: 'var(--ink-3)', letterSpacing: 3 }}>JUSQU&apos;À</div>
                        <div style={{ fontFamily: 'Archivo Black', fontSize: 40, letterSpacing: -2, lineHeight: 0.95, background: 'linear-gradient(120deg,#2FD79B,#0C2A1D)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>-70%</div>
                        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 8, color: 'var(--ink)', letterSpacing: 1.5, marginTop: 2 }}>SUR TOUTE LA BOUTIQUE</div>
                      </div> },
                    // — PARTY PEOPLE : relief (lift) menthe —
                    { apply: () => addTextPreset({ fontFamily: 'Archivo Black', fontSize: 132, fill: '#2FD79B', uppercase: true, lineHeight: 0.82, letterSpacing: -3, liftEnabled: true, liftColor: '#0C2A1D', liftDepth: 10, liftDirection: 'br', align: 'center', width: 780 }, 'PARTY\nPEOPLE'),
                      preview: <div style={{ fontFamily: 'Archivo Black', fontSize: 28, color: '#2FD79B', textAlign: 'center', lineHeight: 0.82, letterSpacing: -1, textShadow: '2px 2px 0 #0C2A1D, 3px 3px 0 #0C2A1D' }}>PARTY<br/>PEOPLE</div> },
                    // — SOLDES : dégradé plein —
                    { apply: () => addTextPreset({ fontFamily: 'Archivo Black', fontSize: 150, fillType: 'gradient', fill: '#C8F135', fillTo: '#21B381', fillAngle: 135, uppercase: true, letterSpacing: -4, align: 'center', width: 780 }, 'SOLDES'),
                      preview: <div style={{ fontFamily: 'Archivo Black', fontSize: 40, letterSpacing: -2, background: 'linear-gradient(135deg,#C8F135,#21B381)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>SOLDES</div> },
                    // — -30% : badge menthe —
                    { apply: () => addTextPreset({ fontFamily: 'Archivo Black', fontSize: 96, fill: '#FFFFFF', hasBg: true, bgColor: '#2FD79B', bgOpacity: 100, cornerRadius: 18, paddingH: 34, paddingV: 18, align: 'center', width: 420 }, '-30%'),
                      preview: <span style={{ fontFamily: 'Archivo Black', fontSize: 26, color: '#FFFFFF', background: '#2FD79B', padding: '7px 16px', borderRadius: 10 }}>-30%</span> },
                    // — GREEN LIT : dégradé + relief —
                    { apply: () => addTextComposition([
                        { text: 'GREEN', dy: 0, patch: { fontFamily: 'Archivo Black', fontSize: 118, fillType: 'gradient', fill: '#C8F135', fillTo: '#21B381', fillAngle: 120, uppercase: true, letterSpacing: -3, lineHeight: 0.82, liftEnabled: true, liftColor: '#0C2A1D', liftDepth: 7, width: 700 } },
                        { text: 'LIT', dy: 96, patch: { fontFamily: 'Archivo Black', fontSize: 118, fillType: 'gradient', fill: '#C8F135', fillTo: '#21B381', fillAngle: 120, uppercase: true, letterSpacing: -3, lineHeight: 0.82, liftEnabled: true, liftColor: '#0C2A1D', liftDepth: 7, width: 700 } },
                      ]),
                      preview: <div style={{ fontFamily: 'Archivo Black', fontSize: 30, textAlign: 'center', lineHeight: 0.82, letterSpacing: -1, background: 'linear-gradient(120deg,#C8F135,#21B381)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(2px 2px 0 #0C2A1D)' }}>GREEN<br/>LIT</div> },
                    // — Nouveau : surlignage acide —
                    { apply: () => addTextPreset({ fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 64, fill: '#14160F', highlightEnabled: true, highlightColor: '#C8F135', highlightOpacity: 100, highlightBorderRadius: 5, highlightPadding: 12, align: 'center', width: 520 }, 'Nouveau'),
                      preview: <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 22, color: '#14160F', background: '#C8F135', padding: '3px 9px', borderRadius: 4 }}>Nouveau</span> },
                    // — NEW PRODUCT ALERT : 2 badges inclinés —
                    { apply: () => addTextComposition([
                        { text: 'NOUVEAU', dy: 0, dx: -30, patch: { fontFamily: 'Archivo Black', fontSize: 56, fill: '#0C2A1D', uppercase: true, rotation: -5, highlightEnabled: true, highlightColor: '#C8F135', highlightOpacity: 100, highlightBorderRadius: 6, highlightPadding: 14, width: 460 } },
                        { text: 'EN STOCK !', dy: 90, dx: 40, patch: { fontFamily: 'Archivo Black', fontSize: 56, fill: '#FFFFFF', uppercase: true, rotation: 4, highlightEnabled: true, highlightColor: '#2FD79B', highlightOpacity: 100, highlightBorderRadius: 6, highlightPadding: 14, width: 460 } },
                      ]),
                      preview: <div style={{ textAlign: 'center', lineHeight: 1.5 }}>
                        <div><span style={{ display: 'inline-block', fontFamily: 'Archivo Black', fontSize: 13, color: '#0C2A1D', background: '#C8F135', padding: '3px 8px', borderRadius: 4, transform: 'rotate(-5deg)' }}>NOUVEAU</span></div>
                        <div><span style={{ display: 'inline-block', fontFamily: 'Archivo Black', fontSize: 13, color: '#FFFFFF', background: '#2FD79B', padding: '3px 8px', borderRadius: 4, transform: 'rotate(4deg)', marginTop: 4 }}>EN STOCK !</span></div>
                      </div> },
                    // — ÉDITION LIMITÉE : contour (hollow) —
                    { apply: () => addTextPreset({ fontFamily: 'Archivo Black', fontSize: 84, fill: 'transparent', stroke: '#14160F', strokeWidth: 3, uppercase: true, lineHeight: 0.9, letterSpacing: -1, align: 'center', width: 780 }, 'ÉDITION\nLIMITÉE'),
                      preview: <div style={{ fontFamily: 'Archivo Black', fontSize: 26, color: 'transparent', WebkitTextStroke: '1.2px var(--ink)', lineHeight: 0.9, textAlign: 'center' }}>ÉDITION<br/>LIMITÉE</div> },
                    // — Fresh : italique dégradé contouré —
                    { apply: () => addTextPreset({ fontFamily: 'Archivo Black', fontStyle: 'italic', fontSize: 140, fill: '#C8F135', stroke: '#0C2A1D', strokeWidth: 4, letterSpacing: -3, align: 'center', width: 700 }, 'Fresh'),
                      preview: <span style={{ fontFamily: 'Archivo Black', fontStyle: 'italic', fontSize: 38, color: '#C8F135', WebkitTextStroke: '1.4px #0C2A1D', letterSpacing: -1 }}>Fresh</span> },
                    // — Just do it. : glow menthe —
                    { apply: () => addTextPreset({ fontFamily: 'Archivo Black', fontStyle: 'italic', fontSize: 92, fill: '#2FD79B', glowEnabled: true, glowColor: '#2FD79B', glowIntensity: 75, glowSize: 22, letterSpacing: -2, align: 'center', width: 700 }, 'Just do it.'),
                      preview: <span style={{ fontFamily: 'Archivo Black', fontStyle: 'italic', fontSize: 26, color: '#2FD79B', textShadow: '0 0 14px #2FD79B', letterSpacing: -1 }}>Just do it.</span> },
                    // — SUMMER : écho —
                    { apply: () => addTextPreset({ fontFamily: 'Archivo Black', fontSize: 120, fill: '#2FD79B', uppercase: true, letterSpacing: -3, echoEnabled: true, echoColor: '#0C2A1D', echoCount: 3, echoOffset: 12, align: 'center', width: 780 }, 'SUMMER'),
                      preview: <span style={{ fontFamily: 'Archivo Black', fontSize: 30, color: '#2FD79B', letterSpacing: -1, textShadow: '4px 4px 0 rgba(12,42,29,.5), 8px 8px 0 rgba(12,42,29,.25)' }}>SUMMER</span> },
                    // — MEMENTO : éditorial élégant lettré —
                    { apply: () => addTextComposition([
                        { text: 'MEMENTO', dy: 0, patch: { fontFamily: 'Playfair Display', fontSize: 96, fill: '#14160F', uppercase: true, letterSpacing: 12, width: 780 } },
                        { text: 'DÉGUSTER · PARTAGER · SAVOURER', dy: 92, patch: { fontFamily: 'Space Grotesk', fontStyle: 'bold', fontSize: 22, fill: '#21B381', uppercase: true, letterSpacing: 4, width: 700 } },
                      ]),
                      preview: <div style={{ textAlign: 'center', lineHeight: 1 }}>
                        <div style={{ fontFamily: 'Playfair Display', fontSize: 24, color: 'var(--ink)', letterSpacing: 4 }}>MEMENTO</div>
                        <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 7.5, color: 'var(--mint-2)', letterSpacing: 1.5, marginTop: 5 }}>DÉGUSTER · PARTAGER · SAVOURER</div>
                      </div> },
                    // — Citation élégante —
                    { apply: () => addTextPreset({ fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 52, fill: '#14160F', lineHeight: 1.25, align: 'center', width: 640 }, '« Le meilleur\ncafé de la ville »'),
                      preview: <span style={{ fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 17, color: 'var(--ink-2)', lineHeight: 1.25, textAlign: 'center', display: 'block' }}>« Le meilleur<br/>café de la ville »</span> },
                  ] as { apply: () => void; preview: React.ReactNode }[]).map((c, i) => (
                    <button key={i} onClick={c.apply}
                      style={{ minHeight: 78, padding: '14px', borderRadius: 12, border: '1px solid var(--line)', cursor: 'pointer', background: 'var(--white)', display: 'grid', placeItems: 'center', transition: 'all .14s', overflow: 'hidden' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint)'; e.currentTarget.style.background = 'var(--sunk)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--white)'; }}>
                      {c.preview}
                    </button>
                  ))}
                </div>

                {isTemplate && (
                  <>
                    <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px' }}>{T('aiRoleZones')}</p>
                    <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '0 0 8px', lineHeight: 1.4 }}>{T('aiRoleZonesHint')}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
                      {([['accroche', 'Accroche'], ['titre', 'Titre'], ['sous-titre', 'Sous-titre'], ['corps', 'Corps'], ['cta', 'CTA'], ['prix', 'Prix']] as const).map(([role, label]) => (
                        <button key={role} onClick={() => addTextRole(role)} className="well"
                          style={{ padding: '10px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', fontFamily: 'var(--sans)', textAlign: 'center' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px' }}>{T('styles')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={() => applyTemplate({ fontSize: 96, fontFamily: 'Archivo Black', fontStyle: 'normal', uppercase: true, letterSpacing: -2, lineHeight: 0.92, fill: workspaceData?.primary_color || '#14160F' } as Partial<TextEl>)}
                    style={{ padding: '14px', borderRadius: 10, border: '1px solid var(--line)', cursor: 'pointer', background: 'var(--white)', textAlign: 'left' }}>
                    <span style={{ fontFamily: 'Archivo Black', fontSize: 26, color: 'var(--ink)', display: 'block', lineHeight: 0.92, textTransform: 'uppercase', letterSpacing: -1 }}>{T('styleTitle')}</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>Archivo Black · 96px</span>
                  </button>
                  <button onClick={() => applyTemplate({ fontSize: 44, fontFamily: 'Space Grotesk', fontStyle: 'bold', letterSpacing: -0.5, fill: workspaceData?.primary_color || '#14160F' } as Partial<TextEl>)}
                    style={{ padding: '14px', borderRadius: 10, border: '1px solid var(--line)', cursor: 'pointer', background: 'var(--white)', textAlign: 'left' }}>
                    <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 21, color: 'var(--ink)', display: 'block', lineHeight: 1, letterSpacing: -0.4 }}>{T('styleSubtitle')}</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>Space Grotesk · 44px</span>
                  </button>
                  <button onClick={() => applyTemplate({ fontSize: 26, fontFamily: 'Satoshi', fontStyle: 'normal', lineHeight: 1.5, fill: '#14160F' } as Partial<TextEl>)}
                    style={{ padding: '14px', borderRadius: 10, border: '1px solid var(--line)', cursor: 'pointer', background: 'var(--white)', textAlign: 'left' }}>
                    <span style={{ fontFamily: 'Satoshi', fontWeight: 400, fontSize: 15, color: 'var(--ink-2)', display: 'block', lineHeight: 1.5 }}>{T('styleBody')}</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>Satoshi · 26px</span>
                  </button>
                </div>
              </div>
            )}

            {/* PHOTOS */}
            {tool === 'photos' && (
              <div style={{ padding: '18px' }}>
                <PanelHead title={T('photos')} sub="Pexels · 3M+ photos" onClose={() => setTool(null)} />
                {isTemplate && (
                  <>
                    <button onClick={addPhotoPlaceholder} className="btn btn-dark" style={{ width: '100%', justifyContent: 'center', height: 44, marginBottom: 8, gap: 8, cursor: 'pointer' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      Zone photo remplaçable
                    </button>
                    <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '0 0 14px', lineHeight: 1.4 }}>{T('photoZoneHint')}</p>
                  </>
                )}
                {/* Import local */}
                <label className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 44, marginBottom: 14, cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Importer une photo
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                </label>

                {/* Pexels search */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                    <input value={pexelsQuery} onChange={e => setPexelsQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchPexels(pexelsQuery, 1); } }}
                      enterKeyHint="search" inputMode="search" autoCapitalize="none" autoCorrect="off"
                      placeholder={T('searchPhotos')}
                      style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 12.5, outline: 'none', fontFamily: 'var(--sans)', background: 'var(--white)', color: 'var(--ink)', boxSizing: 'border-box' }} />
                  </div>
                  <button type="button" onClick={() => fetchPexels(pexelsQuery || 'nature', 1)} aria-label={T('search')}
                    style={{ flexShrink: 0, width: 40, borderRadius: 8, border: 'none', background: 'var(--mint, #2FD79B)', color: '#06281C', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                  </button>
                </div>

                {/* Quick searches */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                  {['Nature', 'Ville', 'Nourriture', 'Mode', 'Architecture'].map(q => (
                    <button key={q} onClick={() => { setPexelsQuery(q); fetchPexels(q, 1); }}
                      style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid var(--line)', background: pexelsQuery === q ? 'var(--ink)' : 'var(--white)', color: pexelsQuery === q ? '#fff' : 'var(--ink-2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                      {q}
                    </button>
                  ))}
                </div>

                {/* Results grid */}
                {pexelsLoading && pexelsPhotos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-3)', fontSize: 13 }}>{T('loading')}</div>
                ) : pexelsPhotos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-3)', fontSize: 13 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Aucune photo — essayez un autre mot-clé.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {pexelsPhotos.map(photo => (
                      <UnsplashThumb key={photo.id}
                        src={photo.src.medium}
                        onAdd={() => addImageEl(`/api/proxy-image?url=${encodeURIComponent(photo.src.large)}`)}
                        onBg={() => { setProxyUrl(`/api/proxy-image?url=${encodeURIComponent(photo.src.large)}`); setBgOffsetX(0); setBgOffsetY(0); setBgCropMode(false); }} />
                    ))}
                  </div>
                )}

                {/* Voir plus */}
                {pexelsPhotos.length > 0 && pexelsPage < pexelsTotalPages && (
                  <button onClick={() => fetchPexels(pexelsQuery || 'nature', pexelsPage + 1)}
                    disabled={pexelsLoading}
                    style={{ width: '100%', marginTop: 10, padding: '9px 0', borderRadius: 8, border: '1.5px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: 13, fontWeight: 700, cursor: pexelsLoading ? 'wait' : 'pointer' }}>
                    {pexelsLoading ? 'Chargement…' : 'Voir plus'}
                  </button>
                )}

                {proxyUrl && (
                  <button onClick={() => setBgCropMode(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, width: '100%', marginTop: 12,
                      background: bgCropMode ? 'var(--mint)' : 'var(--sunk)', color: bgCropMode ? 'var(--mint-ink)' : 'var(--ink-2)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                    {bgCropMode ? 'Glissez le fond pour recadrer' : 'Recadrer le fond'}
                  </button>
                )}
              </div>
            )}

            {/* BRAND — Charte */}
            {tool === 'brand' && (
              <div style={{ padding: '18px' }}>
                <PanelHead title={T('brandKit')} sub={workspaceName} onClose={() => setTool(null)} />
                <SectionLabel>{T('colors')}</SectionLabel>
                <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
                  {[workspaceData?.primary_color || '#0038FF', workspaceData?.secondary_color || '#FFFFFF', workspaceData?.accent_color].filter(Boolean).map((col, i) => (
                    <div key={i} style={{ flex: 1, cursor: 'pointer' }} title={`Copier ${col}`} onClick={() => { try { navigator.clipboard.writeText(col!); } catch {} }}>
                      <div style={{ height: 36, borderRadius: 6, background: col!, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} />
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-3)', marginTop: 3, textAlign: 'center', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</div>
                    </div>
                  ))}
                </div>
                {brandFontNames.length > 0 && <>
                  <SectionLabel>{T('typography')}</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {brandFontNames.map((font, i) => (
                      <div key={font} title={T('addTextWithFont')}
                        onClick={() => { const el: TextEl = { id: newId(), type: 'text', x: 30, y: 60 + i * 60, rotation: 0, opacity: 100, text: font, fontSize: 26, fontFamily: font, fontStyle: 'bold', textDecoration: '', fill: workspaceData?.primary_color || '#000', align: 'left', width: 260, hasBg: false, bgColor: '#000', bgOpacity: 80, cornerRadius: 4, padding: 12, paddingH: 12, paddingV: 8 }; applyElements([...elements, el]); setSelectedId(el.id); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: 'var(--white)', cursor: 'pointer', border: '1px solid var(--line)' }}>
                        <span style={{ fontFamily: `"${font}", sans-serif`, fontSize: 22, color: 'var(--ink)', lineHeight: 1 }}>Aa</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 600 }}>{font}</span>
                      </div>
                    ))}
                  </div>
                </>}
                {(workspaceData?.logo_url || workspaceData?.logo_dark_url) && <>
                  <SectionLabel>{T('logo')}</SectionLabel>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {workspaceData?.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={workspaceData.logo_url} alt="Logo" title={T('addToCanvas')} style={{ height: 38, maxWidth: 90, objectFit: 'contain', cursor: 'pointer', borderRadius: 5, background: 'var(--white)', padding: 4, border: '1px solid var(--line)' }} onClick={() => addLogoEl(workspaceData.logo_url!)} />
                    )}
                    {workspaceData?.logo_dark_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={workspaceData.logo_dark_url} alt="Logo variante" title={T('addToCanvasDark')} style={{ height: 38, maxWidth: 90, objectFit: 'contain', cursor: 'pointer', borderRadius: 5, background: '#1A1A1A', padding: 4, border: '1px solid var(--line)' }} onClick={() => addLogoEl(workspaceData.logo_dark_url!)} />
                    )}
                  </div>
                </>}
                {workspaceData?.brand_assets && workspaceData.brand_assets.length > 0 && <>
                  <SectionLabel>{T('brandAssets')}</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                    {workspaceData.brand_assets.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="" title={T('addToCanvas')} style={{ aspectRatio: '1', objectFit: 'contain', borderRadius: 6, background: 'var(--sunk)', padding: 4, border: '1px solid var(--line)', cursor: 'pointer', width: '100%', display: 'block' }} onClick={() => addImageEl(url)} />
                    ))}
                  </div>
                </>}
              </div>
            )}

            {/* UPLOAD — Importer */}
            {tool === 'upload' && (
              <div style={{ padding: '18px' }}>
                <PanelHead title={T('import')} onClose={() => setTool(null)} />
                <label className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 44, marginBottom: 14, cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Choisir un fichier
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                </label>
                <div
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={e => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files?.[0]; if (file) handleFileDrop(file); }}
                  style={{ border: '1.5px dashed var(--line)', borderRadius: 10, padding: '32px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--ink-3)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>{T('dropFilesHere')}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{T('fileFormats')}</span>
                </div>
              </div>
            )}

            {/* CALQUES — Layers panel */}
            {tool === 'calques' && (
              <div style={{ padding: '18px' }}>
                <PanelHead title={T('layers')} sub="Ordre et verrouillage" onClose={() => setTool(null)} />
                <RailLayerList
                  elements={elements}
                  selectedId={selectedId}
                  hiddenIds={hiddenIds}
                  lockedIds={lockedIds}
                  onSelect={id => setSelectedId(id)}
                  onReorder={reorderLayers}
                  onToggleHidden={toggleHidden}
                  onToggleLocked={toggleLocked}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
                  {/* Fond (background) layer — always last */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, borderTop: elements.length > 0 ? '1px solid var(--line)' : 'none', marginTop: elements.length > 0 ? 6 : 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: proxyUrl ? 'var(--ink)' : 'var(--ink-3)' }}>Fond{!proxyUrl && ' (aucun)'}</span>
                    <button title={bgLocked ? 'Déverrouiller le fond' : 'Verrouiller le fond'}
                      onClick={() => { const next = !bgLocked; setBgLocked(next); if (next) setBgCropMode(false); else if (proxyUrl) setBgCropMode(true); }}
                      style={{ width: 28, height: 28, borderRadius: 7, display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer', background: 'transparent', color: bgLocked ? 'var(--ink-3)' : 'var(--mint-2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {bgLocked
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
                    </button>
                  </div>
                </div>
                {!bgLocked && proxyUrl && (
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 9, background: 'color-mix(in srgb, var(--mint) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--mint) 30%, transparent)', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4 }}>
                    Fond déverrouillé — glissez-le sur le canvas pour le repositionner.
                  </div>
                )}
                {postType === 'carrousel' && (
                  <div style={{ marginTop: 12, padding: '12px', borderRadius: 9, background: 'var(--sunk)', border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{T('linkedCarousel')}</div>
                    {/* Bascule Séparé / Continu */}
                    <div style={{ display: 'flex', gap: 4, background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 8, padding: 3, marginBottom: 10 }}>
                      {([['separate', 'Séparé'], ['continuous', 'Continu']] as const).map(([mode, label]) => {
                        const active = (mode === 'continuous') === carouselContinuous;
                        return (
                          <button key={mode} onClick={() => setCarouselContinuous(mode === 'continuous')}
                            style={{ flex: 1, padding: '6px 4px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--sans)', transition: 'all .15s', background: active ? 'var(--mint)' : 'transparent', color: active ? '#06281C' : 'var(--ink-3)' }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {carouselContinuous ? (
                      <>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4, marginBottom: 10 }}>
                          Une seule grande toile : placez librement textes et éléments, ils peuvent chevaucher les volets. Découpée en {contPanels} slides à la publication.
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>Volets</span>
                          <input type="number" min={2} max={6} value={contPanels} onChange={e => setContPanels(Math.min(6, Math.max(2, parseInt(e.target.value) || 2)))}
                            style={{ width: 44, textAlign: 'center', borderRadius: 6, border: '1px solid var(--line)', padding: '4px 2px', fontSize: 12.5, fontWeight: 700 }} />
                        </div>
                      </>
                    ) : proxyUrl ? (
                      <>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4, marginBottom: 10 }}>
                          Étend ce fond sur les slides suivantes pour un visuel continu (panorama) qui se découpe au balayage. Utilisez une photo large pour un meilleur résultat.
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{T('on')}</span>
                          <input type="number" min={1} max={6} value={extendCount} onChange={e => setExtendCount(Math.min(6, Math.max(1, parseInt(e.target.value) || 1)))}
                            style={{ width: 44, textAlign: 'center', borderRadius: 6, border: '1px solid var(--line)', padding: '4px 2px', fontSize: 12.5, fontWeight: 700 }} />
                          <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{T('nextSlides')}</span>
                        </div>
                        <button onClick={() => extendBgAcrossSlides(extendCount)} className="btn btn-sm btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>
                          Étendre l&apos;image
                        </button>
                      </>
                    ) : (
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                        Ajoutez un fond pour étendre un panorama, ou passez en mode <b>Continu</b> pour une seule toile large.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ── PANNEAU GAUCHE CONTEXTUEL (Effet / Position) ── */}
        {selectedEl && (fxPanel === 'position' || (fxPanel === 'effects' && selectedEl.type === 'text')) && (
          <div data-stop-deselect className="pop-in ed-panel" style={{ width: 312, background: 'var(--white)', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            {fxPanel === 'effects' && selectedEl.type === 'text' && (
              <EffectsPanel
                sel={selectedEl as TextEl}
                brandColors={[workspaceData?.primary_color, workspaceData?.secondary_color, workspaceData?.accent_color].filter(Boolean) as string[]}
                onUpdate={(patch) => updateEl(selectedEl.id, patch)}
                onClose={() => setFxPanel(null)}
              />
            )}
            {fxPanel === 'position' && (
              <PositionPanel
                sel={selectedEl}
                stageW={stageW}
                stageH={stageH}
                elements={elements}
                selectedId={selectedId}
                onUpdate={(patch) => updateEl(selectedEl.id, patch)}
                onAlign={alignEl}
                onLayerAction={layerAction}
                onSelect={(id) => setSelectedId(id)}
                onReorderLayers={reorderLayers}
                onClose={() => setFxPanel(null)}
              />
            )}
          </div>
        )}

        {/* ── CANVAS WORKSPACE ── */}
        <div className="ed-canvas-area" style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--white)', position: 'relative' }}>
          {/* ── Barre contextuelle flottante (desktop) — centrée sous la topbar, par-dessus le plan de travail ── */}
          {selectedEl && (
            <div className="ed-ctx-float" data-stop-deselect onMouseDown={e => e.stopPropagation()}
              style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 45, maxWidth: 'calc(100% - 24px)' }}>
              <EditorContextToolbar
                sel={selectedEl}
                allFonts={[...FONTS, ...brandFontNames, ...customFonts.map(f => f.name)]}
                brandColors={[workspaceData?.primary_color, workspaceData?.secondary_color, workspaceData?.accent_color].filter(Boolean) as string[]}
                stageW={stageW}
                stageH={stageH}
                onUpdate={(patch) => updateEl(selectedEl.id, patch)}
                onAlign={alignEl}
                onDuplicate={duplicateEl}
                onDelete={() => deleteEl(selectedId)}
                onCrop={selectedEl.type === 'image' ? () => setCropId(selectedEl.id) : undefined}
                onSetBg={selectedEl.type === 'image' ? () => setProxyUrl((selectedEl as ImageEl).src) : undefined}
                onMaskPhoto={selectedEl.type === 'vector' ? () => maskPhotoInputRef.current?.click() : undefined}
                onRemoveBg={selectedEl.type === 'image' ? () => removeBgFromImage(selectedEl as ImageEl) : undefined}
                bgRemoving={bgRemovingId === selectedEl.id}
                onLayerAction={layerAction}
                onOpenFx={openFxPanel}
                fxPanel={fxPanel}
              />
            </div>
          )}
          {(aiBuilding || qaBusy) && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'radial-gradient(120% 90% at 50% 30%, rgba(8,32,22,.90), rgba(6,18,10,.95))', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, cursor: 'wait' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-klip-mint.png" alt="Klip" style={{ height: 34, width: 'auto', opacity: 0.96, animation: 'klipPulse 1.8s ease-in-out infinite' }} />
              {/* Barres animées (ADN Klip) */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 30 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <span key={i} style={{ width: 5, borderRadius: 3, background: 'linear-gradient(180deg,#34E0A1,#2FD79B)', animation: `klipBar 1s ease-in-out ${i * 0.12}s infinite` }} />
                ))}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--display, sans-serif)', fontWeight: 800, fontSize: 16.5, color: '#F4F3EC', letterSpacing: '-0.01em' }}>{T('aiComposing')}</div>
                <div style={{ fontSize: 12.5, color: 'rgba(244,243,236,.6)', marginTop: 5 }}>{qaMsg || 'Un instant — ne cliquez pas, composition en cours.'}</div>
              </div>
              <style>{`
                @keyframes klipBar { 0%,100%{height:8px;opacity:.55} 50%{height:30px;opacity:1} }
                @keyframes klipPulse { 0%,100%{opacity:.6;transform:scale(.98)} 50%{opacity:1;transform:scale(1)} }
              `}</style>
            </div>
          )}
          <div ref={canvasAreaRef}
          onMouseDown={() => { setSelectedId(null); setSelectedIds([]); setEditingId(null); setBgCropMode(false); setBgImageSelected(false); }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'safe center', overflow: 'auto', padding: '40px 28px', gap: 40 }}>
            {slides.map((slide, idx) => {
              const isActive = idx === activeSlideIdx;
              // Carrousel continu : une seule toile large — on masque les autres slides.
              if (isContinuous && !isActive) return null;
              return (
                <div key={slide.id}
                  ref={el => { slideContainerRefs.current[idx] = el; }}
                  style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: (isActive && isContinuous ? stageWView : stageW) * zoom, marginBottom: 8, fontSize: 12, color: 'var(--ink-2)', fontWeight: 700, fontFamily: 'var(--sans)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(isTemplate ? (templateName || 'Template') : (workspaceName || 'Sans titre'))}{slides.length > 1 ? ` — Page ${idx + 1}` : ''}</div>
                  <div style={{ width: (isActive && isContinuous ? stageWView : stageW) * zoom, height: stageH * zoom, position: 'relative', borderRadius: 0, flexShrink: 0 }}>
                  {isActive ? (
                    <>
                    <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, width: isContinuous ? stageWView : stageW, height: stageH, transform: `scale(${zoom})`, transformOrigin: 'top left', borderRadius: 0 }}>
            {/* Inner div clips only the Stage canvas */}
            <div style={{ borderRadius: 0, overflow: 'hidden' }}>
            <Stage
              ref={stageRef}
              width={stageWView} height={stageH}
              onMouseDown={e => { if (e.target === e.target.getStage()) { if (cropId) { setCropId(null); } else { setSelectedId(null); if (!bgLocked && proxyUrl) setBgCropMode(true); else setBgCropMode(false); } } }}
              onContextMenu={(e: any) => {
                e.evt.preventDefault();
                let node: any = e.target;
                while (node && node.getParent && (!node.id || !node.id())) node = node.getParent();
                const id = node && node.id ? node.id() : '';
                if (id && elementsRef.current.some(el => el.id === id) && !lockedIds.has(id)) {
                  setSelectedId(id);
                  setCtxMenu({ x: e.evt.clientX, y: e.evt.clientY, id });
                } else {
                  setCtxMenu(null);
                }
              }}
              style={{ display: 'block' }}
            >
              <Layer>
                <Rect x={0} y={0} width={stageWView} height={stageH} fill="white" listening={false} />
                {/* Template gradient/solid background — rendered below BgImage */}
                {bgStyle && <BgStyleLayer bgStyle={bgStyle} w={stageWView} h={stageH} />}
                {proxyUrl && (
                  <BgImage
                    src={proxyUrl} w={stageWView} h={stageH}
                    offsetX={bgOffsetX} offsetY={bgOffsetY}
                    draggable={bgCropMode}
                    onDragEnd={(x, y) => { setBgOffsetX(x); setBgOffsetY(y); }}
                    opacity={bgOpacity / 100}
                    onSelect={!bgLocked && !bgCropMode ? () => { setBgImageSelected(true); setSelectedId(null); } : undefined}
                  />
                )}

                {elements.map(el => {
                  if (hiddenIds.has(el.id)) return null;
                  if (el.type === 'image' && (el as ImageEl).src === PHOTO_PLACEHOLDER_SRC) {
                    const ph = el as ImageEl;
                    return (
                      <Group key={el.id} id={el.id} x={ph.x} y={ph.y} rotation={ph.rotation} opacity={ph.opacity / 100} draggable={!lockedIds.has(el.id)}
                        onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                        onDragStart={() => handleElDragStart(el.id)}
                        onDragMove={e => handleElDragMove(el.id, e)}
                        onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())}>
                        <Rect width={ph.width} height={ph.height} fill="rgba(120,120,120,0.12)" stroke="#8B8E7F" strokeWidth={2} dash={[10, 8]} cornerRadius={6} />
                        <Text width={ph.width} height={ph.height} text={'\uD83D\uDCF7\nPHOTO'} align="center" verticalAlign="middle" fontSize={20} fontStyle="bold" fill="#5A5E50" fontFamily="var(--sans), sans-serif" listening={false} />
                      </Group>
                    );
                  }
                  if (el.type === 'image') return (
                    <ImgNode key={el.id} el={el} onSelect={sk => handleElClick(el.id, sk)} onChange={u => updateEl(el.id, u)}
                      onDragStart={() => handleElDragStart(el.id)}
                      onDragMove={e => handleElDragMove(el.id, e)}
                      onDragEnd={(x, y) => handleElDragEnd(el.id, x, y)}
                      isCropping={cropId === el.id} locked={lockedIds.has(el.id)} />
                  );
                  if (el.type === 'rect') {
                    const scrimProps = el.scrim
                      ? {
                          fillLinearGradientStartPoint: { x: 0, y: 0 },
                          fillLinearGradientEndPoint: { x: 0, y: el.height },
                          fillLinearGradientColorStops: el.scrim === 'top'
                            ? [0, '#000000', 0.5, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0)']
                            : [0, 'rgba(0,0,0,0)', 0.5, 'rgba(0,0,0,0)', 1, '#000000'],
                        }
                      : el.fillType === 'gradient'
                      ? gradientFillProps(el.width, el.height, el.fillAngle ?? 90, el.fill, el.fillTo ?? '#ffffff')
                      : { fill: el.fill };
                    return (
                      <Rect key={el.id} id={el.id} x={el.x} y={el.y} width={el.width} height={el.height}
                        {...scrimProps} stroke={el.stroke} strokeWidth={el.strokeWidth}
                        cornerRadius={el.cornerRadius} rotation={el.rotation} opacity={el.opacity / 100} draggable={!lockedIds.has(el.id)}
                        onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                        onDragStart={() => handleElDragStart(el.id)}
                        onDragMove={e => handleElDragMove(el.id, e)}
                        onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())} />
                    );
                  }
                  if (el.type === 'circle') return (
                    <Circle key={el.id} id={el.id} x={el.x} y={el.y} radius={el.radius}
                      {...(el.fillType === 'gradient' ? gradientFillPropsCentered(el.radius, el.fillAngle ?? 90, el.fill, el.fillTo ?? '#ffffff') : { fill: el.fill })}
                      stroke={el.stroke} strokeWidth={el.strokeWidth}
                      rotation={el.rotation} opacity={el.opacity / 100} draggable={!lockedIds.has(el.id)}
                      onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                      onDragStart={() => handleElDragStart(el.id)}
                      onDragMove={e => handleElDragMove(el.id, e)}
                      onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())} />
                  );
                  if (el.type === 'star') return (
                    <KonvaStar key={el.id} id={el.id} x={el.x} y={el.y} numPoints={el.numPoints}
                      innerRadius={el.innerRadius} outerRadius={el.outerRadius}
                      {...(el.fillType === 'gradient' ? gradientFillPropsCentered(el.outerRadius, el.fillAngle ?? 90, el.fill, el.fillTo ?? '#ffffff') : { fill: el.fill })}
                      stroke={el.stroke} strokeWidth={el.strokeWidth}
                      rotation={el.rotation} opacity={el.opacity / 100} draggable={!lockedIds.has(el.id)}
                      onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                      onDragStart={() => handleElDragStart(el.id)}
                      onDragMove={e => handleElDragMove(el.id, e)}
                      onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())} />
                  );
                  if (el.type === 'vector') return (
                    <VectorNode key={el.id} el={el as VectorEl}
                      onSelect={sk => handleElClick(el.id, sk)}
                      locked={lockedIds.has(el.id)}
                      onDblClick={() => {
                        const v = el as VectorEl;
                        if (v.fillType === 'image' && v.imageSrc) { setMaskCropId(el.id); return; }
                        if (v.shape === 'custom' && v.points && v.points.length >= 2) {
                          // Re-enter pen mode on this element — load its absolute points
                          const absPoints: AnchorPoint[] = v.points.map(p => ({
                            x: p.x + v.x, y: p.y + v.y,
                            ...(p.cpIn  ? { cpIn:  { x: p.cpIn.x  + v.x, y: p.cpIn.y  + v.y } } : {}),
                            ...(p.cpOut ? { cpOut: { x: p.cpOut.x + v.x, y: p.cpOut.y + v.y } } : {}),
                          }));
                          penPointsRef.current = absPoints;
                          setPenPoints([...absPoints]);
                          setIsPenMode(true);
                          setSelectedId(null);
                          applyElements(elementsRef.current.filter(e => e.id !== el.id));
                        }
                      }}
                      onDragStart={() => handleElDragStart(el.id)}
                      onDragMove={e => handleElDragMove(el.id, e)}
                      onDragEnd={(x, y) => handleElDragEnd(el.id, x, y)}
                      isMaskCrop={maskCropId === el.id}
                      onImageOffset={(x, y) => updateEl(el.id, { imageOffsetX: x, imageOffsetY: y } as Partial<VectorEl>)} />
                  );
                  if (el.type === 'text') {
                    const pH = el.paddingH ?? el.padding;
                    const pV = el.paddingV ?? el.padding;
                    const measuredW = measureTextWidth(el.text, el.fontSize, el.fontFamily, el.fontStyle);
                    const rawW = el.width ?? (measuredW + pH * 2);
                    const blockW = Math.min(Math.max(rawW, 80), Math.max(80, stageW - (el.x ?? 0) - 20));
                    const textAreaW = Math.max(1, blockW - pH * 2);
                    // Dynamic blockH: word-wrap simulation matching Konva (so hitbox grows with wrapped lines)
                    const lineCount = countLines(
                      el.uppercase ? el.text.toUpperCase() : el.text,
                      el.fontSize, el.fontFamily, el.fontStyle, textAreaW
                    );
                    const blockH = Math.max(1, lineCount) * el.fontSize * (el.lineHeight ?? 1.2) + pV * 2;
                    return (
                      <Group key={el.id} id={el.id} x={el.x} y={el.y} rotation={el.rotation} opacity={el.opacity / 100}
                        draggable={!lockedIds.has(el.id)}
                        onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                        onDblClick={() => { if (!lockedIds.has(el.id)) { setSelectedId(el.id); setEditingId(el.id); } }}
                        onDragStart={() => handleElDragStart(el.id)}
                        onDragMove={e => handleElDragMove(el.id, e)}
                        onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())}>
                        {/* Bug 5 fix: always keep Rect clickable via hitFunc; fully invisible when hasBg=false (no faint opacity box on visuals) */}
                        <Rect x={0} y={0} width={blockW} height={blockH}
                          fill={el.hasBg ? el.bgColor : undefined}
                          opacity={el.hasBg ? el.bgOpacity / 100 : 1}
                          cornerRadius={el.hasBg ? el.cornerRadius : 0}
                          hitFunc={(ctx, shape) => {
                            ctx.beginPath();
                            ctx.rect(0, 0, blockW, blockH);
                            ctx.closePath();
                            ctx.fillStrokeShape(shape);
                          }}
                        />
                        {/* Surbrillance — highlight rect behind text */}
                        {el.highlightEnabled && (() => {
                          const hp = el.highlightPadding ?? 8;
                          return (
                            <Rect
                              x={pH - hp} y={pV - Math.round(hp / 2)}
                              width={textAreaW + hp * 2}
                              height={el.fontSize * (el.lineHeight ?? 1.2) + hp}
                              fill={el.highlightColor ?? '#FFFF00'}
                              opacity={(el.highlightOpacity ?? 80) / 100}
                              cornerRadius={el.highlightBorderRadius ?? 4}
                              listening={false}
                            />
                          );
                        })()}
                        {/* Élévation — lift layers rendered deepest */}
                        {el.liftEnabled && (() => {
                          const depth = el.liftDepth ?? 6;
                          const dirMap: Record<string,[number,number]> = { tl:[-1,-1],t:[0,-1],tr:[1,-1],l:[-1,0],r:[1,0],bl:[-1,1],b:[0,1],br:[1,1] };
                          const [dx,dy] = dirMap[el.liftDirection ?? 'br'] ?? [1,1];
                          const txt = el.uppercase ? el.text.toUpperCase() : el.text;
                          return Array.from({ length: depth }, (_,i) => (
                            <Text key={`lift-${i}`} x={pH + dx*(depth-i)} y={pV + dy*(depth-i)} width={textAreaW} wrap="word"
                              text={txt} fontSize={el.fontSize} fontFamily={el.fontFamily} fontStyle={el.fontStyle}
                              fill={el.liftColor ?? '#333333'} align={el.align} listening={false}
                              lineHeight={el.lineHeight ?? 1.2} letterSpacing={el.letterSpacing ?? 0} />
                          ));
                        })()}
                        {/* Écho — echo layers behind main text */}
                        {el.echoEnabled && (() => {
                          const count = el.echoCount ?? 3;
                          const offset = el.echoOffset ?? 8;
                          const fade = el.echoFade !== false;
                          const txt = el.uppercase ? el.text.toUpperCase() : el.text;
                          return Array.from({ length: count }, (_,i) => (
                            <Text key={`echo-${i}`} x={pH + offset*(count-i)} y={pV + offset*(count-i)} width={textAreaW} wrap="word"
                              text={txt} fontSize={el.fontSize} fontFamily={el.fontFamily} fontStyle={el.fontStyle}
                              fill={el.echoColor ?? '#FF69B4'}
                              opacity={fade ? 1 / Math.pow(2, count-i) : 0.5}
                              align={el.align} listening={false}
                              lineHeight={el.lineHeight ?? 1.2} letterSpacing={el.letterSpacing ?? 0} />
                          ));
                        })()}
                        {/* Lueur — glow Text clone rendered behind main text */}
                        {el.glowEnabled && (
                          <Text x={pH} y={pV} width={textAreaW} wrap="word"
                            text={el.uppercase ? el.text.toUpperCase() : el.text}
                            fontSize={el.fontSize} fontFamily={el.fontFamily}
                            fontStyle={el.fontStyle}
                            fill="transparent"
                            align={el.align} listening={false}
                            lineHeight={el.lineHeight ?? 1.2}
                            letterSpacing={el.letterSpacing ?? 0}
                            shadowEnabled={true}
                            shadowColor={el.glowColor ?? '#00FFFF'}
                            shadowOpacity={(el.glowIntensity ?? 50) / 100}
                            shadowBlur={el.glowSize ?? 10}
                            shadowOffsetX={0}
                            shadowOffsetY={0}
                          />
                        )}
                        {/* text wraps within blockW; handles update el.width which drives blockW */}
                        <Text x={pH} y={pV} width={textAreaW} wrap="word"
                          text={el.uppercase ? el.text.toUpperCase() : el.text}
                          fontSize={el.fontSize} fontFamily={el.fontFamily}
                          fontStyle={el.fontStyle} textDecoration={el.textDecoration}
                          {...(el.hollowEnabled
                            ? { fill: 'transparent' }
                            : el.fillType === 'gradient'
                            ? gradientFillProps(blockW, blockH, el.fillAngle ?? 90, el.fill, el.fillTo ?? '#ffffff')
                            : { fill: el.fill })}
                          align={el.align} listening={false}
                          lineHeight={el.lineHeight ?? 1.2}
                          letterSpacing={el.letterSpacing ?? 0}
                          shadowEnabled={el.shadowEnabled ?? false}
                          shadowColor={el.shadowColor ?? '#000000'}
                          shadowOpacity={(el.shadowOpacity ?? 75) / 100}
                          shadowBlur={el.shadowBlur ?? 5}
                          shadowOffsetX={el.shadowOffsetX ?? 2}
                          shadowOffsetY={el.shadowOffsetY ?? 2}
                          stroke={el.hollowEnabled ? (el.stroke ?? el.fill) : (el.strokeWidth ? (el.stroke ?? '#000000') : '')}
                          strokeWidth={el.hollowEnabled ? Math.max(el.strokeWidth ?? 0, 1) : (el.strokeWidth ?? 0)}
                        />
                      </Group>
                    );
                  }
                  return null;
                })}

                {showGrid && (
                  <>
                    {Array.from({ length: 9 }).map((_, i) => {
                      const gx = (stageW * (i + 1)) / 10;
                      return <Line key={`gv${i}`} points={[gx, 0, gx, stageH]} stroke="rgba(47,215,155,0.16)" strokeWidth={1} listening={false} />;
                    })}
                    {Array.from({ length: 9 }).map((_, i) => {
                      const gy = (stageH * (i + 1)) / 10;
                      return <Line key={`gh${i}`} points={[0, gy, stageW, gy]} stroke="rgba(47,215,155,0.16)" strokeWidth={1} listening={false} />;
                    })}
                  </>
                )}
                {guides.v !== null && (
                  <Line points={[guides.v, 0, guides.v, stageH]} stroke="#FF5DA2" strokeWidth={1} dash={[4, 4]} listening={false} />
                )}
                {guides.h !== null && (
                  <Line points={[0, guides.h, stageW, guides.h]} stroke="#FF5DA2" strokeWidth={1} dash={[4, 4]} listening={false} />
                )}
              </Layer>
            </Stage>
            </div>{/* end inner overflow:hidden */}

            {/* ── Pen tool overlay ── */}
            {isPenMode && (
              <svg
                style={{ position: 'absolute', top: 0, left: 0, width: stageW, height: stageH, cursor: 'crosshair', zIndex: 25, overflow: 'visible' }}
                onMouseDown={handlePenMouseDown}
                onMouseMove={handlePenMouseMove}
                onMouseUp={handlePenMouseUp}
                onDoubleClick={handlePenDblClick}
              >
                {/* transparent hit region for the full canvas */}
                <rect x={0} y={0} width={stageW} height={stageH} fill="transparent" />
                {/* drawn path so far */}
                {penPoints.length >= 2 && (
                  <path d={buildSvgPath(penPoints, false)} fill="rgba(47,215,155,0.10)" stroke="#2FD79B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {/* Live Bézier preview during click+drag (before mouseup) */}
                {penDragOriginRef.current && penIsDraggingRef.current && penPreviewPos && (() => {
                  const origin = penDragOriginRef.current!;
                  const dx = penPreviewPos.x - origin.x;
                  const dy = penPreviewPos.y - origin.y;
                  const cpOut = { x: origin.x + dx, y: origin.y + dy };
                  const cpIn  = { x: origin.x - dx, y: origin.y - dy };
                  const last  = penPoints.length >= 1 ? penPoints[penPoints.length - 1] : null;
                  return (
                    <g>
                      {/* Handle line */}
                      <line x1={cpIn.x} y1={cpIn.y} x2={cpOut.x} y2={cpOut.y} stroke="#2FD79B" strokeWidth="1" opacity="0.6" />
                      <circle cx={cpOut.x} cy={cpOut.y} r={3.5} fill="#2FD79B" />
                      <circle cx={cpIn.x} cy={cpIn.y} r={3.5} fill="#2FD79B" />
                      {/* Provisional anchor */}
                      <circle cx={origin.x} cy={origin.y} r={5} fill="#fff" stroke="#2FD79B" strokeWidth="1.8" />
                      {/* Bezier from last point to provisional anchor using handles */}
                      {last && (
                        <path d={`M ${last.x} ${last.y} C ${(last.cpOut ?? last).x} ${(last.cpOut ?? last).y} ${cpIn.x} ${cpIn.y} ${origin.x} ${origin.y}`}
                          fill="none" stroke="#2FD79B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      )}
                    </g>
                  );
                })()}
                {/* Straight preview line from last anchor to cursor (when not dragging) */}
                {penPreviewPos && penPoints.length >= 1 && !penIsDraggingRef.current && (() => {
                  const last = penPoints[penPoints.length - 1];
                  const cp1 = last.cpOut ?? last;
                  return (
                    <path d={`M ${last.x} ${last.y} C ${cp1.x} ${cp1.y} ${penPreviewPos.x} ${penPreviewPos.y} ${penPreviewPos.x} ${penPreviewPos.y}`}
                      fill="none" stroke="#2FD79B" strokeWidth="1" strokeDasharray="5 4" opacity="0.55" />
                  );
                })()}
                {/* anchor points + Bézier handles */}
                {penPoints.map((p, i) => (
                  <g key={i}>
                    {p.cpOut && (
                      <>
                        <line x1={p.x} y1={p.y} x2={p.cpOut.x} y2={p.cpOut.y} stroke="#2FD79B" strokeWidth="1" opacity="0.5" />
                        <circle cx={p.cpOut.x} cy={p.cpOut.y} r={3.5} fill="#2FD79B" />
                      </>
                    )}
                    {p.cpIn && (
                      <>
                        <line x1={p.x} y1={p.y} x2={p.cpIn.x} y2={p.cpIn.y} stroke="#2FD79B" strokeWidth="1" opacity="0.5" />
                        <circle cx={p.cpIn.x} cy={p.cpIn.y} r={3.5} fill="#2FD79B" />
                      </>
                    )}
                    <circle
                      cx={p.x} cy={p.y}
                      r={i === 0 && penPoints.length >= 3 ? 8 : 5}
                      fill={i === 0 ? 'rgba(47,215,155,0.18)' : '#fff'}
                      stroke="#2FD79B" strokeWidth="1.8"
                      style={{ cursor: i === 0 && penPoints.length >= 3 ? 'pointer' : 'crosshair' }}
                    />
                    {i === 0 && penPoints.length >= 3 && (
                      <circle cx={p.x} cy={p.y} r={3} fill="#2FD79B" />
                    )}
                  </g>
                ))}
              </svg>
            )}

            {/* pen mode hint bar */}
            {isPenMode && (
              <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 26, background: 'rgba(12,42,29,0.82)', backdropFilter: 'blur(6px)', borderRadius: 10, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 18px rgba(13,15,10,.38)', fontSize: 12, color: 'rgba(238,237,227,0.75)', fontFamily: 'var(--sans)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2FD79B" strokeWidth="2.2" strokeLinecap="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
                <span><b style={{ color: '#eeeee0' }}>{T('click')}</b> — ancre &middot; <b style={{ color: '#eeeee0' }}>{T('clickDrag')}</b> — courbe &middot; <b style={{ color: '#eeeee0' }}>{T('dblClick')}</b> — terminer &middot; <b style={{ color: '#eeeee0' }}>{T('escape')}</b> — annuler{penPoints.length >= 3 && <> &middot; <b style={{ color: '#2FD79B' }}>1er point</b> — fermer</>}</span>
              </div>
            )}

            {/* Carrousel continu — repères de découpe entre volets (overlay HTML, jamais exporté) */}
            {isContinuous && Array.from({ length: contPanels }).map((_, i) => (
              <div key={`cut-${i}`} style={{ position: 'absolute', top: 0, left: i * stageW, width: stageW, height: stageH, pointerEvents: 'none', zIndex: 8,
                borderRight: i < contPanels - 1 ? '2px dashed rgba(47,215,155,.85)' : 'none' }}>
                <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(12,42,29,.82)', color: '#eeeee0', fontSize: 22, fontWeight: 800, fontFamily: 'var(--mono)', padding: '4px 12px', borderRadius: 8 }}>{i + 1}</div>
              </div>
            ))}

            {/* BG image selected — selection border + opacity pill */}
            {bgImageSelected && (
              <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', inset: 0, borderRadius: 0, border: '2px solid #8B5CF6', pointerEvents: 'none', zIndex: 10 }} />
            )}
            {bgImageSelected && (
              <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: '#fff', borderRadius: 11, padding: '6px 12px', boxShadow: '0 8px 24px -8px rgba(13,15,10,.3), 0 0 0 1px rgba(13,15,10,.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{T('bgOpacity')}</span>
                <input type="range" min={10} max={100} value={bgOpacity} onChange={e => setBgOpacity(Number(e.target.value))} style={{ width: 80, accentColor: '#8B5CF6' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', minWidth: 28, fontVariantNumeric: 'tabular-nums' }}>{bgOpacity}%</span>
                <button onClick={() => { setProxyUrl(''); setBgImageSelected(false); }} style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', display: 'grid', placeItems: 'center', borderRadius: 5 }}
                  title={T('removeBackground')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}
            {/* Multi-selection bounding box */}
            {selectedIds.length > 1 && !isKonvaDragging && (() => {
              const sels = elements.filter(e => selectedIds.includes(e.id) && !hiddenIds.has(e.id));
              if (sels.length < 2) return null;
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              for (const e of sels) {
                const box = getElBox(e);
                minX = Math.min(minX, box.l); minY = Math.min(minY, box.t);
                maxX = Math.max(maxX, box.r); maxY = Math.max(maxY, box.b);
              }
              return (
                <div style={{
                  position: 'absolute',
                  left: minX - 6, top: minY - 6,
                  width: maxX - minX + 12, height: maxY - minY + 12,
                  border: '2px dashed #8B5CF6',
                  borderRadius: 4,
                  pointerEvents: 'none',
                  zIndex: 9,
                }} />
              );
            })()}
            {selectedEl && !hiddenIds.has(selectedEl.id) && !isKonvaDragging && cropId !== selectedEl.id && maskCropId !== selectedEl.id && (
              <>
                <SelectionOverlay
                  el={selectedEl}
                  stageRef={stageRef}
                  onChange={u => {
                    // Live update — no history push per frame
                    const newEls = elementsRef.current.map(e =>
                      e.id === selectedEl.id ? { ...e, ...u } as CanvasEl : e
                    );
                    setElements(newEls);
                  }}
                  onDragEnd={() => {
                    // Commit a single undo entry when drag ends
                    const slice = historyRef.current.slice(0, histIdxRef.current + 1);
                    historyRef.current = [...slice, elementsRef.current];
                    histIdxRef.current = historyRef.current.length - 1;
                    setHistTick(t => t + 1);
                  }}
                  zoom={zoom}
                />
                <SelectionPill
                  elX={selectedEl.x}
                  elY={selectedEl.y}
                  elW={('width' in selectedEl ? (selectedEl as any).width : ('radius' in selectedEl ? (selectedEl as any).radius * 2 : ('outerRadius' in selectedEl ? (selectedEl as any).outerRadius * 2 : 100))) ?? 100}
                  zoom={zoom}
                  onDuplicate={duplicateEl}
                  onDelete={() => deleteEl(selectedId)}
                />
              </>
            )}
            {editingId && (() => {
              const tel = elements.find(e => e.id === editingId) as TextEl | undefined;
              if (!tel || tel.type !== 'text') return null;
              const pV = Number(tel.paddingV ?? tel.padding ?? 10);
              const pH = Number(tel.paddingH ?? tel.padding ?? 10);
              const blockW = Math.min(Math.max(tel.width ?? 200, 80), Math.max(80, stageW - (tel.x ?? 0) - 20));
              const blockH = tel.fontSize + pV * 2;
              return (
                <textarea
                  key={editingId}
                  autoFocus
                  value={tel.uppercase ? tel.text.toUpperCase() : tel.text}
                  onChange={ev => {
                    const newText = tel.uppercase ? ev.target.value.toLowerCase() : ev.target.value;
                    const newEls = elementsRef.current.map(e =>
                      e.id === editingId ? { ...e, text: newText } as CanvasEl : e
                    );
                    setElements(newEls);
                    elementsRef.current = newEls;
                  }}
                  onBlur={() => {
                    const slice = historyRef.current.slice(0, histIdxRef.current + 1);
                    historyRef.current = [...slice, elementsRef.current];
                    histIdxRef.current = historyRef.current.length - 1;
                    setHistTick(t => t + 1);
                    setEditingId(null);
                  }}
                  onKeyDown={e => { if (e.key === 'Escape') { e.currentTarget.blur(); } }}
                  style={{
                    position: 'absolute',
                    left: tel.x,
                    top: tel.y,
                    width: blockW,
                    minHeight: blockH,
                    padding: `${pV}px ${pH}px`,
                    fontSize: tel.fontSize,
                    fontFamily: tel.fontFamily,
                    fontWeight: tel.fontStyle.includes('bold') ? 'bold' : 'normal',
                    fontStyle: tel.fontStyle.includes('italic') ? 'italic' : 'normal',
                    color: tel.fill,
                    background: tel.hasBg ? tel.bgColor : 'transparent',
                    border: '2px solid var(--mint)',
                    outline: 'none',
                    resize: 'none',
                    zIndex: 100,
                    pointerEvents: 'auto',
                    lineHeight: String(tel.lineHeight ?? 1.2),
                    textAlign: tel.align as React.CSSProperties['textAlign'],
                    letterSpacing: tel.letterSpacing ? `${tel.letterSpacing}px` : 'normal',
                    transform: tel.rotation ? `rotate(${tel.rotation}deg)` : undefined,
                    transformOrigin: '0 0',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                />
              );
            })()}
            {maskCropId && (
              <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 20, pointerEvents: 'auto' }}>
                <div style={{ background: 'rgba(12,42,29,0.82)', backdropFilter: 'blur(6px)', borderRadius: 10, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 18px rgba(13,15,10,.38)', fontSize: 12, color: 'rgba(238,237,227,0.7)', fontFamily: 'var(--sans)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2FD79B" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Glissez la photo dans la forme
                  <button onClick={() => setMaskCropId(null)} style={{ padding: '5px 14px', background: '#2FD79B', color: '#0C2A1D', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--sans)' }}>
                    Appliquer
                  </button>
                </div>
              </div>
            )}
            {cropId && (
              <div style={{
                position: 'absolute', bottom: 14, left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex', gap: 8, zIndex: 20, pointerEvents: 'auto',
              }}>
                <div style={{
                  background: 'rgba(12,42,29,0.82)', backdropFilter: 'blur(6px)',
                  borderRadius: 10, padding: '6px 8px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 4px 18px rgba(13,15,10,.38)',
                  fontSize: 12, color: 'rgba(238,237,227,0.7)', fontFamily: 'var(--sans)',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2FD79B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                  </svg>
                  Glissez pour recadrer
                  <button onClick={() => setCropId(null)} style={{
                    padding: '5px 14px', background: '#2FD79B', color: '#0C2A1D',
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, fontFamily: 'var(--sans)',
                  }}>
                    Appliquer
                  </button>
                </div>
              </div>
            )}
            </div>
                    </>
                  ) : (
                    <div onClick={() => switchSlide(idx)}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 0, overflow: 'hidden', cursor: 'pointer', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {slide.thumbnail ? (
                        <img src={slide.thumbnail} alt={`Slide ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: Math.max(14, Math.round(18 * zoom)), color: 'var(--ink-3)', opacity: 0.4 }}>{idx + 1}</span>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── ZOOM BADGE ── */}
          <div style={{
            position: 'absolute', bottom: 144, right: 14, zIndex: 50,
            background: 'rgba(12,42,29,0.82)', backdropFilter: 'blur(6px)',
            borderRadius: 8, padding: '5px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 2px 8px rgba(13,15,10,.3)',
            fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12,
            color: zoom !== 1 ? 'var(--mint)' : 'rgba(238,237,227,0.55)',
            pointerEvents: 'auto',
          }}>
            {Math.round(zoom * 100)}%
            {zoom !== 1 && (
              <button
                onClick={() => setZoom(1)}
                style={{
                  background: 'rgba(47,215,155,.18)', border: 'none', borderRadius: 4,
                  color: 'var(--mint)', padding: '2px 7px',
                  fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--mono)',
                  letterSpacing: '.04em',
                }}
              >
                Reset
              </button>
            )}
          </div>

          {/* ── ZOOM BAR ── */}
          <div style={{
            height: 50, flexShrink: 0,
            background: 'var(--white)',
            display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px',
          }}>
            <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/></svg>
              Page {activeSlideIdx + 1} · {activeFormat.label}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0 }}>{workspaceName}</span>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn btn-sm btn-ghost" style={{ height: 34 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 12a7 7 0 0 1 7-7M19 12a7 7 0 0 1-7 7"/><path d="M12 5l-2.4 1.4M12 5l2.4 1.4M12 19l-2.4-1.4M12 19l2.4-1.4"/></svg>
                Animer
              </button>
              <span style={{ width: 1, height: 22, background: 'var(--line)', flexShrink: 0 }} />
              <button onClick={() => setZoom(z => Math.max(0.15, +(z - 0.1).toFixed(2)))} style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-2)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14"/></svg>
              </button>
              <input type="range" min={0.15} max={1.5} step={0.01} value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="ed-range" style={{ width: 132, ...rangeFill(zoom, 0.15, 1.5) }} />
              <button onClick={() => setZoom(z => Math.min(1.5, +(z + 0.1).toFixed(2)))} style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-2)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12, width: 42, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={fit} title={T('adjust')} className="btn btn-sm btn-ghost btn-icon" style={{ height: 34, width: 34 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              </button>
              <button onClick={() => setShowGrid(g => !g)} title={showGrid ? 'Masquer la grille' : 'Afficher la grille'} className="btn btn-sm btn-ghost btn-icon"
                style={{ height: 34, width: 34, background: showGrid ? 'var(--mint-soft)' : undefined, color: showGrid ? 'var(--mint-2)' : undefined }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
              </button>
            </div>
          </div>

          {/* ── SLIDE STRIP ── (masqué en carrousel continu : une seule toile) */}
          <div style={{
            height: 80, flexShrink: 0,
            background: 'var(--white)',
            display: isContinuous ? 'none' : 'flex', alignItems: 'center',
            padding: '0 16px', gap: 8,
            overflowX: 'auto',
          }}>
            {slides.map((slide, idx) => {
              const isActive = idx === activeSlideIdx;
              return (
                <div key={slide.id} style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    onClick={() => switchSlide(idx)}
                    style={{
                      width: 46, height: 58, borderRadius: 7,
                      border: `2px solid ${isActive ? 'var(--mint-2)' : 'var(--line)'}`,
                      background: 'var(--white)',
                      cursor: 'pointer', padding: 0, overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'border-color .12s',
                      boxShadow: isActive ? '0 0 0 3px var(--mint-soft)' : 'none',
                      position: 'relative',
                    }}
                  >
                    {slide.thumbnail && !isActive ? (
                      <img src={slide.thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 5 }} />
                    ) : null}
                    <span style={{
                      fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12,
                      color: isActive ? 'var(--mint-2)' : (slide.thumbnail ? 'rgba(255,255,255,.85)' : 'var(--ink-3)'),
                      position: 'relative', zIndex: 1,
                      textShadow: slide.thumbnail && !isActive ? '0 1px 3px rgba(0,0,0,.5)' : 'none',
                    }}>{idx + 1}</span>
                    {slide.spanGroupId && (
                      <span title={T('partOfLinkedCarousel')} style={{ position: 'absolute', bottom: 3, left: 3, zIndex: 1, width: 14, height: 14, borderRadius: 4, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center' }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/></svg>
                      </span>
                    )}
                  </button>
                  {slides.length > 1 && (
                    <button
                      onClick={() => removeSlide(idx)}
                      style={{
                        position: 'absolute', top: -5, right: -5,
                        width: 16, height: 16, borderRadius: '50%',
                        background: 'var(--ink)', color: 'var(--paper)',
                        border: 'none', cursor: 'pointer', padding: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, lineHeight: 1,
                      }}
                    >×</button>
                  )}
                </div>
              );
            })}
            <button
              onClick={addSlide}
              style={{
                width: 46, height: 58, borderRadius: 7, flexShrink: 0,
                border: '1.5px dashed var(--line)',
                background: 'transparent',
                cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ink-3)', fontSize: 20, fontWeight: 300,
              }}
            >+</button>
          </div>
        </div>

      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
      <input ref={maskPhotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleMaskPhotoUpload} />
    </div>
    </>
  );
}

export default function EditorPage({ params }: { params: { id: string; postId: string } }) {
  return <VisualEditor workspaceId={params.id} postId={params.postId} mode="post" />;
}
