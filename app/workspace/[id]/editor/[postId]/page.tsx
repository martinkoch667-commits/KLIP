'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Rect,
  Shape as KonvaShape,
  Stage,
  Star as KonvaStar,
  Text,
} from 'react-konva';
import useImage from 'use-image';
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
}

interface BaseEl { id: string; x: number; y: number; rotation: number; opacity: number; }
interface TextEl extends BaseEl {
  type: 'text'; text: string; fontSize: number; fontFamily: string; fontStyle: string;
  textDecoration: string; fill: string; align: string; width: number;
  hasBg: boolean; bgColor: string; bgOpacity: number; cornerRadius: number;
  padding: number; paddingH: number; paddingV: number;
  role?: string;
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
interface RectEl extends BaseEl { type: 'rect'; width: number; height: number; fill: string; stroke: string; strokeWidth: number; cornerRadius: number; }
interface CircleEl extends BaseEl { type: 'circle'; radius: number; fill: string; stroke: string; strokeWidth: number; }
interface StarEl extends BaseEl { type: 'star'; numPoints: number; innerRadius: number; outerRadius: number; fill: string; stroke: string; strokeWidth: number; }
interface AnchorPoint { x: number; y: number; cpIn?: { x: number; y: number }; cpOut?: { x: number; y: number }; }
interface VectorEl extends BaseEl { type: 'vector'; shape: 'rectangle'|'circle'|'triangle'|'star'|'pill'|'arrow'|'diamond'|'hexagon'|'custom'; width: number; height: number; fill: string; fillType?: 'color'|'none'|'image'; stroke: string; strokeWidth: number; points?: AnchorPoint[]; closed?: boolean; imageSrc?: string; imageOffsetX?: number; imageOffsetY?: number; }
interface ImageEl extends BaseEl { type: 'image'; src: string; width: number; height: number; cropX?: number; cropY?: number; naturalW?: number; naturalH?: number; }
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

function newId() { return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function measureTextWidth(text: string, fontSize: number, fontFamily: string, fontStyle = 'bold'): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.6;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * fontSize * 0.6;
  ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

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

function ImgNode({ el, onSelect, onChange, onDragStart, onDragEnd, isCropping }: {
  el: ImageEl; onSelect: (shiftKey: boolean) => void; onChange: (u: Partial<ImageEl>) => void;
  onDragStart?: () => void; onDragEnd?: (x: number, y: number) => void; isCropping?: boolean;
}) {
  const [img] = useImage(el.src, 'anonymous');

  // Store natural dimensions once the image is loaded
  useEffect(() => {
    if (img && img.naturalWidth > 0 && !el.naturalW) {
      onChange({ naturalW: img.naturalWidth, naturalH: img.naturalHeight });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);

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
      draggable={!isCropping}
      onClick={e => onSelect(e.evt.shiftKey)} onTap={() => onSelect(false)}
      onDragStart={!isCropping ? onDragStart : undefined}
      onDragEnd={!isCropping ? (e => onDragEnd?.(e.target.x(), e.target.y())) : undefined}
    >
      <KonvaImage
        image={img}
        x={cropX} y={cropY}
        width={scaledW} height={scaledH}
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

function VectorNode({ el, onSelect, onDblClick, onDragStart, onDragEnd, isMaskCrop, onImageOffset }: {
  el: VectorEl; onSelect: (shiftKey: boolean) => void;
  onDblClick?: () => void;
  onDragStart?: () => void; onDragEnd?: (x: number, y: number) => void;
  isMaskCrop?: boolean; onImageOffset?: (x: number, y: number) => void;
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
        draggable={!isMaskCrop}
        onClick={e => onSelect(e.evt.shiftKey)} onTap={() => onSelect(false)}
        onDblClick={() => onDblClick?.()}
        onDragStart={!isMaskCrop ? onDragStart : undefined}
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
      fill={el.fillType === 'none' ? 'rgba(0,0,0,0)' : el.fill}
      stroke={el.stroke}
      strokeWidth={el.strokeWidth}
      draggable
      sceneFunc={draw}
      hitFunc={draw}
      onClick={e => onSelect(e.evt.shiftKey)}
      onTap={() => onSelect(false)}
      onDblClick={() => onDblClick?.()}
      onDragStart={onDragStart}
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
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 4, overflow: 'hidden', cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {hovered && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={onAdd} style={{ padding: '4px 8px', background: 'var(--cream)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>+ Canvas</button>
          <button onClick={onBg} style={{ padding: '4px 8px', background: 'var(--mint)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'var(--mint-ink)' }}>Fond</button>
        </div>
      )}
    </div>
  );
}

function TextProperties({ el, onChange, customFonts, onFontUpload, brandColors, brandFontNames }: { el: TextEl; onChange: (u: Partial<TextEl>) => void; customFonts: { name: string; url: string }[]; onFontUpload: (file: File) => Promise<string>; brandColors?: string[]; brandFontNames?: string[] }) {
  const isBold = el.fontStyle.includes('bold');
  const isItalic = el.fontStyle.includes('italic');
  const isUnderline = el.textDecoration === 'underline';
  const toggleBold = () => onChange({ fontStyle: isItalic ? (isBold ? 'italic' : 'bold italic') : (isBold ? 'normal' : 'bold') });
  const toggleItalic = () => onChange({ fontStyle: isBold ? (isItalic ? 'bold' : 'bold italic') : (isItalic ? 'normal' : 'italic') });
  return (
    <>
      <PropRow label="Contenu">
        <textarea value={el.text} onChange={e => onChange({ text: e.target.value })} rows={3}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--sans)', outline: 'none', background: 'var(--sunk)', color: 'var(--ink)' }} />
      </PropRow>
      <PropRow label="Police">
        <select value={el.fontFamily} onChange={e => onChange({ fontFamily: e.target.value })}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 13, outline: 'none', background: 'var(--sunk)', color: 'var(--ink)', fontFamily: `"${el.fontFamily}", sans-serif` }}>
          {brandFontNames && brandFontNames.length > 0 && (
            <optgroup label="Charte de marque">
              {brandFontNames.map(f => <option key={f} value={f}>{f}</option>)}
            </optgroup>
          )}
          {customFonts.filter(f => !brandFontNames?.includes(f.name)).length > 0 && (
            <optgroup label="Mes polices">
              {customFonts.filter(f => !brandFontNames?.includes(f.name)).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
            </optgroup>
          )}
          <optgroup label="Google Fonts">
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </optgroup>
        </select>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mono)', fontWeight: 800 }}>
            Uploader une police
          </label>
          <label style={{ display: 'block', marginTop: 8, background: 'var(--sunk)', border: '1.5px dashed var(--line)', color: 'var(--ink-2)', padding: '10px', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 13 }}>
            + Uploader .ttf ou .otf
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
      <PropRow label={`Taille — ${el.fontSize}px`}>
        <input type="range" min={8} max={120} value={el.fontSize} onChange={e => onChange({ fontSize: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
      <PropRow label="Style">
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ label: 'G', title: 'Gras', active: isBold, fn: toggleBold }, { label: 'I', title: 'Italique', active: isItalic, fn: toggleItalic }, { label: 'S', title: 'Souligné', active: isUnderline, fn: () => onChange({ textDecoration: isUnderline ? '' : 'underline' }) }].map(({ label, title, active, fn }) => (
            <button key={label} onClick={fn} title={title}
              style={{ flex: 1, padding: '7px 6px', border: 'none', borderRadius: 'var(--r-s)', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: active ? 'var(--mint)' : 'var(--sunk)', color: active ? 'var(--mint-ink)' : 'var(--ink-2)', boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--line)' }}>
              {label}
            </button>
          ))}
        </div>
      </PropRow>
      <PropRow label="Alignement">
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
      <ColorRow label="Couleur texte" value={el.fill} onChange={v => onChange({ fill: v })} brandColors={brandColors} />
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--mono)', fontWeight: 800 }}>Fond du bloc</span>
          <div onClick={() => onChange({ hasBg: !el.hasBg })}
            style={{ width: 38, height: 22, borderRadius: 11, background: el.hasBg ? 'var(--mint)' : 'var(--line)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 3, left: el.hasBg ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
          </div>
        </div>
        {el.hasBg && (
          <>
            <ColorRow label="Couleur fond" value={el.bgColor} onChange={v => onChange({ bgColor: v })} brandColors={brandColors} />
            <PropRow label={`Opacité — ${el.bgOpacity}%`}>
              <input type="range" min={0} max={100} value={el.bgOpacity} onChange={e => onChange({ bgOpacity: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
            </PropRow>
            <PropRow label={`Arrondi — ${el.cornerRadius}px`}>
              <input type="range" min={0} max={50} value={el.cornerRadius} onChange={e => onChange({ cornerRadius: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
            </PropRow>
            <PropRow label={`Padding H — ${el.paddingH ?? el.padding}px`}>
              <input type="range" min={0} max={40} value={el.paddingH ?? el.padding} onChange={e => onChange({ paddingH: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
            </PropRow>
            <PropRow label={`Padding V — ${el.paddingV ?? el.padding}px`}>
              <input type="range" min={0} max={30} value={el.paddingV ?? el.padding} onChange={e => onChange({ paddingV: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
            </PropRow>
          </>
        )}
      </div>
      <PropRow label={`Opacité — ${el.opacity}%`}>
        <input type="range" min={0} max={100} value={el.opacity} onChange={e => onChange({ opacity: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
      {/* 4D — IA role for structured generation */}
      <PropRow label="Rôle IA">
        <select value={el.role || ''} onChange={e => onChange({ role: e.target.value || undefined })}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 13, outline: 'none', background: 'var(--sunk)', color: 'var(--ink)' }}>
          <option value="">Aucun</option>
          <option value="accroche">Accroche</option>
          <option value="titre">Titre principal</option>
          <option value="sous-titre">Sous-titre</option>
          <option value="corps">Corps de texte</option>
          <option value="cta">Call-to-action</option>
          <option value="prix">Prix / Offre</option>
        </select>
        {el.role && (
          <span style={{ fontSize: 10, color: 'var(--mint-2)', marginTop: 4, display: 'block', fontFamily: 'var(--mono)', fontWeight: 700 }}>
            Ce bloc sera rempli par l'IA lors de la génération
          </span>
        )}
      </PropRow>
    </>
  );
}

function ShapeProperties({ el, onChange, brandColors }: { el: RectEl | CircleEl | StarEl; onChange: (u: Partial<typeof el>) => void; brandColors?: string[] }) {
  return (
    <>
      <ColorRow label="Couleur" value={el.fill} onChange={v => onChange({ fill: v } as any)} brandColors={brandColors} />
      <ColorRow label="Bordure" value={el.stroke || '#000000'} onChange={v => onChange({ stroke: v } as any)} brandColors={brandColors} />
      <PropRow label={`Épaisseur — ${el.strokeWidth}px`}>
        <input type="range" min={0} max={10} value={el.strokeWidth} onChange={e => onChange({ strokeWidth: Number(e.target.value) } as any)} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
      {el.type === 'rect' && (
        <PropRow label={`Arrondi — ${el.cornerRadius}px`}>
          <input type="range" min={0} max={50} value={el.cornerRadius} onChange={e => onChange({ cornerRadius: Number(e.target.value) } as any)} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
        </PropRow>
      )}
      <PropRow label={`Opacité — ${el.opacity}%`}>
        <input type="range" min={0} max={100} value={el.opacity} onChange={e => onChange({ opacity: Number(e.target.value) } as any)} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
    </>
  );
}

function ImageProperties({ el, onChange, onSetBg, onCrop }: { el: ImageEl; onChange: (u: Partial<ImageEl>) => void; onSetBg: () => void; onCrop?: () => void }) {
  return (
    <>
      <PropRow label={`Opacité — ${el.opacity}%`}>
        <input type="range" min={0} max={100} value={el.opacity} onChange={e => onChange({ opacity: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button onClick={onCrop} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
          Recadrer
        </button>
        <button onClick={onSetBg} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
          En fond
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
  onLayerAction: (action: 'front' | 'forward' | 'backward' | 'back') => void;
}

function EditorContextToolbar({ sel, allFonts, brandColors, stageW, stageH, onUpdate, onAlign, onDuplicate, onDelete, onCrop, onSetBg, onMaskPhoto, onLayerAction }: CtxToolbarProps) {
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
      style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, border: 'none', cursor: 'pointer', transition: 'background .1s',
        color: danger ? '#C4452F' : on ? 'var(--mint-2)' : 'var(--ink)',
        background: on ? 'var(--mint-soft)' : 'transparent' }}
      onMouseEnter={e => { if (!on && !danger) (e.currentTarget as HTMLElement).style.background = 'var(--sunk)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = on ? 'var(--mint-soft)' : 'transparent'; }}>
      {icon}
    </button>
  );
  const TextBtn = ({ on, onClick, children }: { on?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick}
      style={{ height: 32, padding: '0 9px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, flexShrink: 0, background: on ? 'var(--sunk)' : 'transparent', color: 'var(--ink)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--sunk)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = on ? 'var(--sunk)' : 'transparent'; }}>
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
        onChange={e => onChange(parseFloat(e.target.value))} className="ed-range" style={{ width: '100%' }} />
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

  const popStyle: React.CSSProperties = { position: 'absolute', top: 'calc(100% + 8px)', left: 0, background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 18px 44px -14px rgba(13,15,10,.28), 0 0 0 1px rgba(13,15,10,.06)', zIndex: 100, minWidth: 220 };

  return (
    <div className="pop-in" style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#fff', borderRadius: 12, padding: '5px 8px', boxShadow: '0 8px 26px -10px rgba(13,15,10,.2), 0 0 0 1px rgba(13,15,10,.06)', overflow: 'visible', position: 'relative' }}>

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
        <IBtn title="Gras" on={textSel.fontStyle?.includes('bold')}
          onClick={() => u({ fontStyle: textSel.fontStyle?.includes('bold') ? (textSel.fontStyle.includes('italic') ? 'italic' : 'normal') : (textSel.fontStyle?.includes('italic') ? 'bold italic' : 'bold') } as Partial<TextEl>)}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/></svg>} />
        {/* Italic */}
        <IBtn title="Italique" on={textSel.fontStyle?.includes('italic')}
          onClick={() => u({ fontStyle: textSel.fontStyle?.includes('italic') ? (textSel.fontStyle.includes('bold') ? 'bold' : 'normal') : (textSel.fontStyle?.includes('bold') ? 'bold italic' : 'italic') } as Partial<TextEl>)}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5h7M6 19h7M14 5l-4 14"/></svg>} />
        {/* Underline */}
        <IBtn title="Souligné" on={textSel.textDecoration?.includes('underline')}
          onClick={() => toggleDecoration('underline')}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14"/></svg>} />
        {/* Strikethrough */}
        <IBtn title="Barré" on={textSel.textDecoration?.includes('line-through')}
          onClick={() => toggleDecoration('line-through')}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M16 4H9a3 3 0 0 0-2.83 4M14 20c-2.8 0-5-1.1-5-4M4 12h16"/></svg>} />
        {/* Case */}
        <IBtn title={textSel.uppercase ? 'Minuscules' : 'Majuscules'} on={!!textSel.uppercase}
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
          <IBtn title="Espacement" on={pop === 'spacing'}
            onClick={() => setPop(p => p === 'spacing' ? null : 'spacing')}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6v.01M3 12v.01M3 18v.01"/></svg>} />
          {pop === 'spacing' && (
            <div style={{ ...popStyle }}>
              <SliderRow label="Interligne" value={textSel.lineHeight ?? 1.2} min={0.8} max={3} step={0.05}
                fmt={v => v.toFixed(2)} onChange={v => u({ lineHeight: v } as any)} />
              <SliderRow label="Interlettrage" value={textSel.letterSpacing ?? 0} min={-5} max={30} step={0.5}
                fmt={v => (v >= 0 ? '+' : '') + v.toFixed(1) + 'px'} onChange={v => u({ letterSpacing: v } as any)} />
            </div>
          )}
        </div>
        {/* Effets (shadow + text stroke) */}
        <div style={{ position: 'relative' }}>
          <TextBtn on={pop === 'effects'} onClick={() => setPop(p => p === 'effects' ? null : 'effects')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
            Effets
          </TextBtn>
          {pop === 'effects' && (
            <div style={{ ...popStyle, minWidth: 230 }}>
              <div className="label" style={{ marginBottom: 8 }}>Ombre portée</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!textSel.shadowEnabled} onChange={e => u({ shadowEnabled: e.target.checked } as any)}
                  style={{ accentColor: 'var(--mint)', width: 14, height: 14 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Activer l'ombre</span>
              </label>
              {textSel.shadowEnabled && (<>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span className="label" style={{ marginBottom: 0 }}>Couleur</span>
                  <ColorPicker value={textSel.shadowColor ?? '#000000'} onChange={c => u({ shadowColor: c } as any)} />
                </div>
                <SliderRow label="Opacité" value={textSel.shadowOpacity ?? 75} min={0} max={100} step={1}
                  fmt={v => v + '%'} onChange={v => u({ shadowOpacity: v } as any)} />
                <SliderRow label="Flou" value={textSel.shadowBlur ?? 5} min={0} max={30} step={1}
                  fmt={v => v + 'px'} onChange={v => u({ shadowBlur: v } as any)} />
                <SliderRow label="Décalage X" value={textSel.shadowOffsetX ?? 2} min={-20} max={20} step={1}
                  fmt={v => (v >= 0 ? '+' : '') + v + 'px'} onChange={v => u({ shadowOffsetX: v } as any)} />
                <SliderRow label="Décalage Y" value={textSel.shadowOffsetY ?? 2} min={-20} max={20} step={1}
                  fmt={v => (v >= 0 ? '+' : '') + v + 'px'} onChange={v => u({ shadowOffsetY: v } as any)} />
              </>)}
              <div className="label" style={{ margin: '10px 0 8px' }}>Contour texte</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <ColorPicker value={textSel.stroke ?? '#000000'} onChange={c => u({ stroke: c } as any)} />
                <input type="number" min={0} max={20} value={textSel.strokeWidth ?? 0} onChange={e => u({ strokeWidth: parseInt(e.target.value) || 0 } as any)}
                  style={{ width: 44, textAlign: 'center', border: '1.5px solid var(--line)', borderRadius: 6, fontSize: 12, padding: '3px 4px', fontWeight: 700, color: 'var(--ink)', outline: 'none' }} />
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>px épaisseur</span>
              </div>
              {/* ── Surbrillance ── */}
              <div style={{ borderTop: '1px solid var(--paper)', margin: '10px 0' }} />
              <div className="label" style={{ marginBottom: 8 }}>Surbrillance</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!textSel.highlightEnabled} onChange={e => u({ highlightEnabled: e.target.checked } as any)}
                  style={{ accentColor: 'var(--mint)', width: 14, height: 14 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Activer la surbrillance</span>
              </label>
              <div style={{ opacity: textSel.highlightEnabled ? 1 : 0.4, pointerEvents: textSel.highlightEnabled ? 'auto' : 'none', transition: 'opacity 150ms' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span className="label" style={{ marginBottom: 0 }}>Couleur</span>
                  <ColorPicker value={textSel.highlightColor ?? '#FFFF00'} onChange={c => u({ highlightColor: c } as any)} />
                </div>
                <SliderRow label="Opacité" value={textSel.highlightOpacity ?? 80} min={0} max={100} step={1}
                  fmt={v => v + '%'} onChange={v => u({ highlightOpacity: v } as any)} />
                <SliderRow label="Arrondi" value={textSel.highlightBorderRadius ?? 4} min={0} max={20} step={1}
                  fmt={v => v + 'px'} onChange={v => u({ highlightBorderRadius: v } as any)} />
                <SliderRow label="Épaisseur" value={textSel.highlightPadding ?? 8} min={0} max={20} step={1}
                  fmt={v => v + 'px'} onChange={v => u({ highlightPadding: v } as any)} />
              </div>
              {/* ── Lueur ── */}
              <div style={{ borderTop: '1px solid var(--paper)', margin: '10px 0' }} />
              <div className="label" style={{ marginBottom: 8 }}>Lueur</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!textSel.glowEnabled} onChange={e => u({ glowEnabled: e.target.checked } as any)}
                  style={{ accentColor: 'var(--mint)', width: 14, height: 14 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Activer la lueur</span>
              </label>
              <div style={{ opacity: textSel.glowEnabled ? 1 : 0.4, pointerEvents: textSel.glowEnabled ? 'auto' : 'none', transition: 'opacity 150ms' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span className="label" style={{ marginBottom: 0 }}>Couleur</span>
                  <ColorPicker value={textSel.glowColor ?? '#00FFFF'} onChange={c => u({ glowColor: c } as any)} />
                </div>
                <SliderRow label="Intensité" value={textSel.glowIntensity ?? 50} min={0} max={100} step={1}
                  fmt={v => v + '%'} onChange={v => u({ glowIntensity: v } as any)} />
                <SliderRow label="Taille" value={textSel.glowSize ?? 10} min={1} max={40} step={1}
                  fmt={v => v + 'px'} onChange={v => u({ glowSize: v } as any)} />
              </div>
              {/* ── Creux ── */}
              <div style={{ borderTop: '1px solid var(--paper)', margin: '10px 0' }} />
              <div className="label" style={{ marginBottom: 8 }}>Creux</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!textSel.hollowEnabled} onChange={e => u({ hollowEnabled: e.target.checked } as any)}
                  style={{ accentColor: 'var(--mint)', width: 14, height: 14 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Activer le creux</span>
              </label>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 5, display: 'block' }}>Utilise les réglages du Contour texte</span>
              {/* ── Élévation ── */}
              <div style={{ borderTop: '1px solid var(--paper)', margin: '10px 0' }} />
              <div className="label" style={{ marginBottom: 8 }}>Élévation</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!textSel.liftEnabled} onChange={e => u({ liftEnabled: e.target.checked } as any)}
                  style={{ accentColor: 'var(--mint)', width: 14, height: 14 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Activer l'élévation</span>
              </label>
              <div style={{ opacity: textSel.liftEnabled ? 1 : 0.4, pointerEvents: textSel.liftEnabled ? 'auto' : 'none', transition: 'opacity 150ms' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span className="label" style={{ marginBottom: 0 }}>Couleur</span>
                  <ColorPicker value={textSel.liftColor ?? '#333333'} onChange={c => u({ liftColor: c } as any)} />
                </div>
                <SliderRow label="Profondeur" value={textSel.liftDepth ?? 6} min={1} max={20} step={1}
                  fmt={v => v + 'px'} onChange={v => u({ liftDepth: v } as any)} />
                <div className="label" style={{ marginBottom: 6 }}>Direction</div>
                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
                  {([['tl','t','tr'],['l','·','r'],['bl','b','br']] as const).map((row, ri) => (
                    <div key={ri} style={{ display: 'flex', gap: 4 }}>
                      {row.map(d => {
                        const arrows: Record<string,string> = { tl:'↖',t:'↑',tr:'↗',l:'←','·':'·',r:'→',bl:'↙',b:'↓',br:'↘' };
                        const active = (textSel.liftDirection ?? 'br') === d;
                        return (
                          <button key={d} onClick={() => d !== '·' && u({ liftDirection: d } as any)}
                            style={{ width: 28, height: 28, borderRadius: 6, border: '1.5px solid var(--line)', background: active ? 'var(--ink)' : 'var(--sunk)', color: active ? '#fff' : 'var(--ink-2)', cursor: d !== '·' ? 'pointer' : 'default', fontSize: 13, fontWeight: 700, display: 'grid', placeItems: 'center' }}>
                            {arrows[d]}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              {/* ── Écho ── */}
              <div style={{ borderTop: '1px solid var(--paper)', margin: '10px 0' }} />
              <div className="label" style={{ marginBottom: 8 }}>Écho</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!textSel.echoEnabled} onChange={e => u({ echoEnabled: e.target.checked } as any)}
                  style={{ accentColor: 'var(--mint)', width: 14, height: 14 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Activer l'écho</span>
              </label>
              <div style={{ opacity: textSel.echoEnabled ? 1 : 0.4, pointerEvents: textSel.echoEnabled ? 'auto' : 'none', transition: 'opacity 150ms' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span className="label" style={{ marginBottom: 0 }}>Couleur</span>
                  <ColorPicker value={textSel.echoColor ?? '#FF69B4'} onChange={c => u({ echoColor: c } as any)} />
                </div>
                <SliderRow label="Nombre" value={textSel.echoCount ?? 3} min={1} max={5} step={1}
                  fmt={v => String(v)} onChange={v => u({ echoCount: v } as any)} />
                <SliderRow label="Décalage" value={textSel.echoOffset ?? 8} min={1} max={30} step={1}
                  fmt={v => v + 'px'} onChange={v => u({ echoOffset: v } as any)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={textSel.echoFade !== false} onChange={e => u({ echoFade: e.target.checked } as any)}
                    style={{ accentColor: 'var(--mint)', width: 14, height: 14 }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Opacité dégressive</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </>}

      {/* COLOR — text fill or shape fill */}
      {(isText || isShape) && (
        <ColorPicker value={colorVal} onChange={(c: string) => setFill(c)} brandColors={brandColors} />
      )}

      {/* TEXT background */}
      {textSel && <>
        <IBtn title={textSel.hasBg ? 'Masquer fond' : 'Fond coloré'} on={textSel.hasBg}
          onClick={() => u({ hasBg: !textSel.hasBg } as Partial<TextEl>)}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/></svg>} />
        {textSel.hasBg && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setPop(p => p === 'bg' ? null : 'bg')} title="Options du fond"
              style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', background: pop === 'bg' ? 'var(--sunk)' : 'transparent', border: 'none', cursor: 'pointer' }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, background: textSel.bgColor, boxShadow: 'inset 0 0 0 1.5px rgba(13,15,10,.2)' }} />
            </button>
            {pop === 'bg' && (
              <div style={{ ...popStyle, left: 'auto', right: 0 }}>
                <div className="label" style={{ marginBottom: 8 }}>Fond du texte</div>
                <ColorPicker value={textSel.bgColor} onChange={(c: string) => u({ bgColor: c } as Partial<TextEl>)} brandColors={brandColors} />
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span className="label" style={{ marginBottom: 0 }}>Opacité fond</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{textSel.bgOpacity}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={1} value={textSel.bgOpacity} onChange={e => u({ bgOpacity: parseInt(e.target.value) } as Partial<TextEl>)} className="ed-range" style={{ width: '100%' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, marginBottom: 5 }}>
                    <span className="label" style={{ marginBottom: 0 }}>Arrondi</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{textSel.cornerRadius}px</span>
                  </div>
                  <input type="range" min={0} max={50} step={1} value={textSel.cornerRadius} onChange={e => u({ cornerRadius: parseInt(e.target.value) } as Partial<TextEl>)} className="ed-range" style={{ width: '100%' }} />
                </div>
              </div>
            )}
          </div>
        )}
      </>}

      {/* VECTOR — stroke controls */}
      {vecSel && (
        <div style={{ position: 'relative' }}>
          <IBtn title="Contour" on={pop === 'vstroke'}
            onClick={() => setPop(p => p === 'vstroke' ? null : 'vstroke')}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>} />
          {pop === 'vstroke' && (
            <div style={{ ...popStyle, minWidth: 220 }}>
              <div className="label" style={{ marginBottom: 8 }}>Contour</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <ColorPicker value={vecSel.stroke || '#000000'} onChange={c => u({ stroke: c } as Partial<VectorEl>)} />
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>couleur</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span className="label" style={{ marginBottom: 0 }}>Épaisseur</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{vecSel.strokeWidth}px</span>
              </div>
              <input type="range" min={0} max={20} step={1} value={vecSel.strokeWidth} onChange={e => u({ strokeWidth: parseInt(e.target.value) } as Partial<VectorEl>)} className="ed-range" style={{ width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, marginBottom: 5 }}>
                <span className="label" style={{ marginBottom: 0 }}>Remplissage</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['color','none','image'] as const).map(ft => (
                  <button key={ft}
                    onClick={() => ft === 'image' ? (onMaskPhoto?.(), setPop(null)) : u({ fillType: ft } as Partial<VectorEl>)}
                    style={{ flex: 1, padding: '5px 4px', borderRadius: 7, border: vecSel.fillType === ft ? '2px solid var(--mint-2)' : '1.5px solid var(--line)', cursor: 'pointer', background: vecSel.fillType === ft ? 'var(--mint-soft)' : 'var(--sunk)', fontSize: 10.5, fontWeight: 700, color: vecSel.fillType === ft ? 'var(--mint-2)' : 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    {ft === 'color' ? 'Couleur' : ft === 'none' ? 'Aucun' : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Photo</>}
                  </button>
                ))}
              </div>
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
          <IBtn title="Arrondi" on={pop === 'radius'}
            onClick={() => setPop(p => p === 'radius' ? null : 'radius')}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>} />
          {pop === 'radius' && (
            <div style={{ ...popStyle }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="label" style={{ marginBottom: 0 }}>Arrondi</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{rectSel.cornerRadius}px</span>
              </div>
              <input type="range" min={0} max={50} step={1} value={rectSel.cornerRadius} onChange={e => u({ cornerRadius: parseInt(e.target.value) } as Partial<RectEl>)} className="ed-range" style={{ width: '100%' }} />
            </div>
          )}
        </div>
      )}

      {/* IMAGE controls */}
      {isImage && <>
        {onSetBg && <button onClick={onSetBg} className="btn btn-ghost btn-sm" style={{ height: 30, flexShrink: 0 }}>En fond</button>}
        {onCrop && <button onClick={onCrop} className="btn btn-ghost btn-sm" style={{ height: 30, flexShrink: 0 }}>Recadrer</button>}
      </>}

      <Div />

      {/* OPACITY */}
      <div style={{ position: 'relative' }}>
        <IBtn title={`Opacité ${sel.opacity}%`} on={pop === 'opacity'}
          onClick={() => setPop(p => p === 'opacity' ? null : 'opacity')}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h6V3M9 15h6V9M15 21v-6h6" fill="currentColor" stroke="none" opacity=".25"/></svg>} />
        {pop === 'opacity' && (
          <div style={{ ...popStyle, left: 'auto', right: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="label" style={{ marginBottom: 0 }}>Opacité</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-2)' }}>{sel.opacity}%</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={sel.opacity} onChange={e => u({ opacity: parseInt(e.target.value) } as Partial<CanvasEl>)} className="ed-range" style={{ width: '100%' }} />
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
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>Bientôt disponible</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>Les animations par élément arrivent très bientôt.</div>
          </div>
        )}
      </div>

      {/* Position (layer order + canvas alignment) */}
      <div style={{ position: 'relative' }}>
        <TextBtn on={pop === 'pos'} onClick={() => setPop(p => p === 'pos' ? null : 'pos')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Position
        </TextBtn>
        {pop === 'pos' && (
          <div style={{ ...popStyle, right: 0, left: 'auto', minWidth: 210 }}>
            <div className="label" style={{ marginBottom: 6 }}>Calque</div>
            {([['front','Premier plan'],['forward','Avancer'],['backward','Reculer'],['back','Arrière-plan']] as const).map(([id, label]) => (
              <button key={id} onClick={() => { onLayerAction(id); setPop(null); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--ink)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {label}
              </button>
            ))}
            <div className="label" style={{ margin: '10px 0 8px' }}>Aligner sur la page</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {[
                { id: 'left',     title: 'Gauche',                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 5l-7 7 7 7M4 12h16"/></svg> },
                { id: 'center-h', title: 'Centrer horiz.',          icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 4v16M5 9l7-7 7 7M5 15l7 7 7-7"/></svg> },
                { id: 'right',    title: 'Droite',                   icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 5l7 7-7 7M20 12H4"/></svg> },
                { id: 'top',      title: 'Haut',                     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 11l7-7 7 7M12 4v16"/></svg> },
                { id: 'center-v', title: 'Centrer vert.',            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12h16M9 5l-7 7 7 7M15 5l7 7-7 7"/></svg> },
                { id: 'bottom',   title: 'Bas',                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 13l7 7 7-7M12 20V4"/></svg> },
              ].map(({ id, title, icon }) => (
                <button key={id} title={title} onClick={() => { onAlign(id); setPop(null); }}
                  style={{ height: 34, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'var(--sunk)', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--line)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--sunk)')}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Div />

      {/* 6 ALIGNMENT BUTTONS — inline (vs canvas when 1 element, vs group when multi) */}
      {[
        { id: 'left',     title: 'Aligner à gauche',           icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4v16"/><rect x="6" y="7" width="10" height="4" rx="1"/><rect x="6" y="13" width="7" height="4" rx="1"/></svg> },
        { id: 'center-h', title: 'Centrer horizontalement',    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 4v16"/><rect x="5" y="7" width="14" height="4" rx="1"/><rect x="7" y="13" width="10" height="4" rx="1"/></svg> },
        { id: 'right',    title: 'Aligner à droite',           icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 4v16"/><rect x="8" y="7" width="10" height="4" rx="1"/><rect x="11" y="13" width="7" height="4" rx="1"/></svg> },
        { id: 'top',      title: 'Aligner en haut',            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16"/><rect x="7" y="6" width="4" height="10" rx="1"/><rect x="13" y="6" width="4" height="7" rx="1"/></svg> },
        { id: 'center-v', title: 'Centrer verticalement',      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 12h16"/><rect x="7" y="5" width="4" height="14" rx="1"/><rect x="13" y="7" width="4" height="10" rx="1"/></svg> },
        { id: 'bottom',   title: 'Aligner en bas',             icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20h16"/><rect x="7" y="8" width="4" height="10" rx="1"/><rect x="13" y="11" width="4" height="7" rx="1"/></svg> },
      ].map(({ id, title, icon }) => (
        <IBtn key={id} title={title} onClick={() => onAlign(id)} icon={icon} />
      ))}

      <Div />

      {/* DUPLICATE */}
      <IBtn title="Dupliquer" onClick={onDuplicate}
        icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>} />
      {/* DELETE */}
      <IBtn title="Supprimer" danger onClick={onDelete}
        icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>} />
    </div>
  );
}

// ─── SelectionPill (floats above selected element in canvas space) ─────────────

interface PillProps {
  elX: number; elY: number; elW: number;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SelectionPill({ elX, elY, elW, onDuplicate, onDelete }: PillProps) {
  const pillW = 260;
  return (
    <div style={{
      position: 'absolute',
      left: elX + elW / 2 - pillW / 2,
      top: elY - 58,
      width: pillW,
      zIndex: 55,
      pointerEvents: 'auto',
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
        <button onClick={e => { e.stopPropagation(); onDuplicate(); }} title="Dupliquer"
          style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: '#3a3d33', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F1F0E8')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>
        </button>
        {/* Delete */}
        <button onClick={e => { e.stopPropagation(); onDelete(); }} title="Supprimer"
          style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: '#C4452F', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F1F0E8')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Panel head (title + optional sub + close button) ─────────────────────────

function PanelHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16 }}>
      <div style={{ minWidth: 0 }}>
        <h3 className="h-title" style={{ fontSize: 17 }}>{title}</h3>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={onClose} title="Fermer"
        style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--sunk)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditorPage({ params }: { params: { id: string; postId: string } }) {
  const workspaceId = params.id;
  const postId = params.postId;

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
  const activeFormat = FORMATS.find(f => f.id === formatId) ?? FORMATS[0];
  const stageW = activeFormat.w;
  const stageH = activeFormat.h;
  const [elements, setElements] = useState<CanvasEl[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
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
    const thumbnail = stageRef.current?.toDataURL({ pixelRatio: 0.3 }) ?? undefined;
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
  const [bgLocked, setBgLocked] = useState(true);
  const [bgImageSelected, setBgImageSelected] = useState(false);
  const [bgOpacity, setBgOpacity] = useState(100);
  const [workspaceName, setWorkspaceName] = useState('');
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
        const [{ data: p, error: postError }, { data: w }] = await Promise.all([
          supabase.from('posts').select('*').eq('id', postId).maybeSingle(),
          supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
        ]);
        if (postError) throw postError;
        if (p?.template_id) setPostTemplateId(p.template_id);
        // Set canvas format from post_type (template will override below if applicable)
        const PT_FORMAT: Record<string, string> = { post: 'ig-portrait', reel: 'ig-story', story: 'ig-story', carrousel: 'ig-square' };
        if (p?.post_type && PT_FORMAT[p.post_type]) { setFormatId(PT_FORMAT[p.post_type]); setPostType(p.post_type as 'post' | 'reel' | 'story' | 'carrousel'); }
        if (p?.photo_url) { setPostPhotoUrl(p.photo_url); }
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
        if (p?.editor_json) {
          // Saved state always wins — never re-apply template
          try {
            const parsed = JSON.parse(p.editor_json);
            if (parsed && parsed.version === 2 && Array.isArray(parsed.slides)) {
              initSlides = parsed.slides;
              // Restore bgStyle if embedded in the first slide (set by Composer pre-gen)
              if (parsed.slides[0]?.bgStyle) setBgStyle(parsed.slides[0].bgStyle as BgStyle);
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
  }, [postId, workspaceId]);

  // 5s timeout
  useEffect(() => {
    if (!dataLoading) return;
    const t = setTimeout(() => { setLoadError('Chargement trop long. Réessayez.'); setDataLoading(false); }, 5000);
    return () => clearTimeout(t);
  }, [dataLoading]);

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

  // ── Alignment (single vs canvas; multi vs group bounding box) ────────────

  const getElBox = (e: CanvasEl) => {
    if (e.type === 'circle') { const r = (e as CircleEl).radius; return { l: e.x - r, t: e.y - r, r: e.x + r, b: e.y + r, w: r*2, h: r*2, cx: e.x, cy: e.y }; }
    if (e.type === 'star') { const r = (e as StarEl).outerRadius; return { l: e.x - r, t: e.y - r, r: e.x + r, b: e.y + r, w: r*2, h: r*2, cx: e.x, cy: e.y }; }
    const w = 'width' in e ? (e as any).width : 100;
    const h = e.type === 'text' ? (e as TextEl).fontSize + 2 * Number((e as TextEl).paddingV ?? (e as TextEl).padding ?? 10) : ('height' in e ? (e as any).height : 100);
    return { l: e.x, t: e.y, r: e.x + w, b: e.y + h, w, h, cx: e.x + w/2, cy: e.y + h/2 };
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
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [deleteEl, undo, redo, duplicateEl]);

  // ── Add elements ──────────────────────────────────────────────────────────

  const addText = () => {
    const el: TextEl = { id: newId(), type: 'text', x: 50, y: 100, rotation: 0, opacity: 100, text: 'Nouveau texte', fontSize: 32, fontFamily: 'Oswald', fontStyle: 'bold', textDecoration: '', fill: '#FFFFFF', align: 'left', width: 300, hasBg: false, bgColor: '#000000', bgOpacity: 80, cornerRadius: 4, padding: 16, paddingH: 16, paddingV: 10 };
    applyElements([...elements, el]);
    setSelectedId(el.id);
  };

  const addRect = () => {
    const el: RectEl = { id: newId(), type: 'rect', x: 100, y: 100, rotation: 0, opacity: 100, width: 200, height: 100, fill: '#B8F028', stroke: '', strokeWidth: 0, cornerRadius: 0 };
    applyElements([...elements, el]);
    setSelectedId(el.id);
  };

  const addCircle = () => {
    const el: CircleEl = { id: newId(), type: 'circle', x: 250, y: 200, rotation: 0, opacity: 100, radius: 80, fill: '#B8F028', stroke: '', strokeWidth: 0 };
    applyElements([...elements, el]);
    setSelectedId(el.id);
  };

  const addStar = () => {
    const el: StarEl = { id: newId(), type: 'star', x: 250, y: 200, rotation: 0, opacity: 100, numPoints: 5, innerRadius: 40, outerRadius: 80, fill: '#FFD700', stroke: '', strokeWidth: 0 };
    applyElements([...elements, el]);
    setSelectedId(el.id);
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

  const handleFileDrop = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (postType === 'reel') {
      showEditorToast('Les Reels Instagram nécessitent une vidéo. Importez un fichier .mp4 ou .mov.');
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
    const z = Math.min((ws.clientWidth - 120) / stageW, (ws.clientHeight - 80) / stageH);
    setZoom(Math.max(0.15, Math.min(1.5, +z.toFixed(3))));
  }, [stageW, stageH]);

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

  const deletePost = async () => {
    if (!confirm("Supprimer ce post ? Cette action est irréversible.")) return;
    await supabase.from('posts').delete().eq('id', postId);
    window.location.href = `/workspace/${workspaceId}`;
  };

  const handleSave = async () => {
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
      const fn = `${workspaceId}/${postId}-slide${idx}-${Date.now()}.png`;
      await supabase.storage.from('exports').upload(fn, blob, { contentType: 'image/png', upsert: true });
      const { data: ud } = supabase.storage.from('exports').getPublicUrl(fn);
      return ud?.publicUrl || '';
    };

    if (isCarousel && totalSlides > 1) {
      const origIdx = activeSlideIdx;
      for (let i = 0; i < totalSlides; i++) {
        if (i !== activeSlideIdx) {
          const s = slidesRef.current[i];
          setElements(s.elements);
          elementsRef.current = s.elements;
          setProxyUrl(s.proxyUrl);
          proxyUrlRef.current = s.proxyUrl;
          setBgOffsetX(s.bgOffsetX ?? 0);
          bgOffsetXRef.current = s.bgOffsetX ?? 0;
          setBgOffsetY(s.bgOffsetY ?? 0);
          bgOffsetYRef.current = s.bgOffsetY ?? 0;
          await new Promise(resolve => setTimeout(resolve, 400));
        }
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

    // Export cover (active slide) for calendar / feed previews
    const coverDataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
    const coverBlob = await fetch(coverDataURL).then(r => r.blob());
    const coverFn = `${workspaceId}/${postId}-${Date.now()}.png`;
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
    // Constrain element positions within new canvas bounds
    const clamped = elementsRef.current.map(el => ({
      ...el,
      x: Math.min(el.x, newFmt.w - 20),
      y: Math.min(el.y, newFmt.h - 20),
    }));
    setElements(clamped);
    elementsRef.current = clamped;
    await supabase.from('posts').update({ post_type: newType }).eq('id', postId);
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
  const LAYOUT_TEMPLATES: { label: string; emoji: string; blocks: Partial<TextEl>[] }[] = [
    {
      label: 'Promotion',
      emoji: '%',
      blocks: [
        { text: 'OFFRE SPÉCIALE', role: 'accroche', fontSize: 14, y: 50, x: 20, fill: workspaceData?.accent_color || '#C8F135', hasBg: true, bgColor: workspaceData?.primary_color || '#0038FF', bgOpacity: 100, cornerRadius: 4, width: 180, fontStyle: 'bold', paddingH: 12, paddingV: 6 },
        { text: 'TITRE DE L\'OFFRE', role: 'titre', fontSize: 36, y: 100, x: 20, fill: '#FFFFFF', hasBg: false, fontStyle: 'bold', width: stageW - 40 },
        { text: '-30% ce weekend', role: 'sous-titre', fontSize: 20, y: 160, x: 20, fill: '#FFFFFF', hasBg: false, fontStyle: 'normal', width: stageW - 40 },
        { text: 'EN PROFITER', role: 'cta', fontSize: 14, y: stageH - 80, x: 20, fill: workspaceData?.primary_color || '#000', hasBg: true, bgColor: workspaceData?.accent_color || '#C8F135', bgOpacity: 100, cornerRadius: 4, width: 200, fontStyle: 'bold', paddingH: 14, paddingV: 8 },
      ],
    },
    {
      label: 'Événement',
      emoji: 'E',
      blocks: [
        { text: 'C\'EST CE SAMEDI', role: 'accroche', fontSize: 13, y: 50, x: 20, fill: workspaceData?.accent_color || '#C8F135', hasBg: false, fontStyle: 'bold', width: stageW - 40 },
        { text: 'NOM DE L\'ÉVÉNEMENT', role: 'titre', fontSize: 34, y: 90, x: 20, fill: '#FFFFFF', hasBg: false, fontStyle: 'bold', width: stageW - 40 },
        { text: 'Date · Lieu · Infos', role: 'corps', fontSize: 15, y: 160, x: 20, fill: 'rgba(255,255,255,0.75)', hasBg: false, fontStyle: 'normal', width: stageW - 40 },
        { text: 'RÉSERVER', role: 'cta', fontSize: 14, y: stageH - 80, x: 20, fill: workspaceData?.primary_color || '#000', hasBg: true, bgColor: '#FFFFFF', bgOpacity: 95, cornerRadius: 4, width: 160, fontStyle: 'bold', paddingH: 14, paddingV: 8 },
      ],
    },
    {
      label: 'Produit',
      emoji: '↗',
      blocks: [
        { text: 'NOUVEAUTÉ', role: 'accroche', fontSize: 13, y: 50, x: 20, fill: '#FFFFFF', hasBg: true, bgColor: workspaceData?.primary_color || '#0038FF', bgOpacity: 100, cornerRadius: 4, width: 140, fontStyle: 'bold', paddingH: 12, paddingV: 6 },
        { text: 'NOM DU PRODUIT', role: 'titre', fontSize: 34, y: 100, x: 20, fill: '#FFFFFF', hasBg: false, fontStyle: 'bold', width: stageW - 40 },
        { text: 'Description courte', role: 'sous-titre', fontSize: 16, y: 160, x: 20, fill: 'rgba(255,255,255,0.8)', hasBg: false, fontStyle: 'normal', width: stageW - 40 },
        { text: '49,90 €', role: 'prix', fontSize: 28, y: stageH - 90, x: 20, fill: '#FFFFFF', hasBg: false, fontStyle: 'bold', width: 200 },
      ],
    },
  ];

  const applyLayoutTemplate = (tpl: typeof LAYOUT_TEMPLATES[0]) => {
    const base: Partial<TextEl> = {
      type: 'text', rotation: 0, opacity: 100, fontFamily: workspaceData?.font_family || 'Oswald',
      textDecoration: '', align: 'left', padding: 12, paddingH: 12, paddingV: 8,
      hasBg: false, bgColor: '#000', bgOpacity: 80, cornerRadius: 4, fill: '#fff',
      fontSize: 28, width: stageW - 40,
    };
    const newEls: TextEl[] = tpl.blocks.map(b => ({ ...base, ...b, id: newId() } as TextEl));
    const firstId = newEls[0]?.id;
    applyElements([...elements, ...newEls]);
    if (firstId) setSelectedId(firstId);
  };

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
      <span style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--sans)' }}>Chargement de l&apos;éditeur…</span>
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
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Changer de format ?</h3>
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 22 }}>
              Passer en format Story (9:16) va adapter le cadre de votre visuel. Des éléments peuvent dépasser le cadre et nécessiter des ajustements.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowStoryWarn(false); setPendingStoryType(null); }} className="btn btn-ghost" style={{ flex: 1 }}>Annuler</button>
              <button onClick={async () => {
                setShowStoryWarn(false);
                if (pendingStoryType) {
                  const TYPE_FORMAT: Record<string, string> = { post: 'ig-portrait', reel: 'ig-story', story: 'ig-story', carrousel: 'ig-square' };
                  const newFormatId = TYPE_FORMAT[pendingStoryType];
                  const newFmt = FORMATS.find(f => f.id === newFormatId) ?? FORMATS[0];
                  setPostType(pendingStoryType);
                  setFormatId(newFormatId);
                  const clamped = elementsRef.current.map(el => ({ ...el, x: Math.min(el.x, newFmt.w - 20), y: Math.min(el.y, newFmt.h - 20) }));
                  setElements(clamped);
                  elementsRef.current = clamped;
                  await supabase.from('posts').update({ post_type: pendingStoryType }).eq('id', postId);
                }
                setPendingStoryType(null);
              }} className="btn btn-primary" style={{ flex: 1 }}>Continuer</button>
            </div>
          </div>
        </div>
      )}

    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'var(--sans)', background: 'radial-gradient(120% 80% at 50% -10%, #FBFAF4, #ECEBE1 70%)', overflow: 'hidden', marginLeft: sidebarOpen ? 'var(--sb-w)' : 0, transition: 'margin-left 0.2s' }}>

      {/* ── TOPBAR ── */}
      <div data-stop-deselect className="ed-topbar" style={{
        minHeight: 60, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px',
        borderBottom: '1px solid var(--line)',
        background: 'color-mix(in srgb, var(--canvas) 80%, transparent)',
        backdropFilter: 'blur(8px)',
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
          <a href={`/workspace/${workspaceId}`} className="btn btn-sm btn-ghost"
            style={{ gap: 5, textDecoration: 'none', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
            <span className="ed-hide-sm">Retour</span>
          </a>
          <span className="ed-hide-sm" style={{ width: 1, height: 24, background: 'var(--line)', flexShrink: 0 }} />
          <div className="ed-hide-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--mint)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 10, color: '#06281C', letterSpacing: '-0.02em' }}>
                {workspaceName ? workspaceName.slice(0,2).toUpperCase() : 'KL'}
              </span>
            </div>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{workspaceName || 'Éditeur'}</span>
            <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: 10.5 }}>
              {activeFormat.label}{slides.length > 1 ? ` · ${slides.length} slides` : ''}
            </span>
          </div>
          <span style={{ width: 1, height: 24, background: 'var(--line)', flexShrink: 0 }} />
          <button onClick={undo} disabled={!canUndo} title="Annuler Ctrl+Z" className="ed-hbtn"
            style={{ opacity: canUndo ? 1 : 0.3 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1"/></svg>
          </button>
          <button onClick={redo} disabled={!canRedo} title="Rétablir" className="ed-hbtn"
            style={{ opacity: canRedo ? 1 : 0.3 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1"/></svg>
          </button>
        </div>

        {/* Center: ContextToolbar (when selected) or hint */}
        <div className="ed-topbar-center" style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          {selectedEl ? (
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
              onLayerAction={layerAction}
            />
          ) : (
            <span className="ed-hint-desktop" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              Sélectionnez un calque pour le modifier
            </span>
          )}
        </div>

        {/* Right: Type selector + Aperçu + Partager */}
        <div className="ed-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
          <button onClick={exportPNG} className="btn btn-sm btn-ghost" style={{ height: 36 }}>Aperçu</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-sm btn-primary"
            style={{ height: 36, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Sauvegarde…' : 'Publier'}
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
            onLayerAction={layerAction}
          />
        </div>
      )}

      {/* ── BODY: rail + flyout + canvas workspace ── */}
      <div className="ed-body" style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── TOOL RAIL (68px) ── */}
        <div data-stop-deselect className="ed-rail" style={{ width: 68, background: 'var(--white)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 4, flexShrink: 0 }}>
          {([
            { id: 'design',   label: 'Modèles',  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg> },
            { id: 'elements', label: 'Éléments', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.5"/><circle cx="17" cy="7" r="4"/><polygon points="12 22 3 15.5 21 15.5 12 22"/></svg> },
            { id: 'text',     label: 'Texte',    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> },
            { id: 'photos',   label: 'Photos',   icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
            { id: 'brand',    label: 'Charte',   icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="4" r="1.5"/><circle cx="19.5" cy="16" r="1.5"/><circle cx="4.5" cy="16" r="1.5"/></svg> },
            { id: 'upload',   label: 'Importer', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
            { id: 'calques',  label: 'Calques',  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
          ] as const).map(({ id, label, icon }) => (
            <button key={id} onClick={() => { setTool(tool === id ? null : id); if (isPenMode) cancelPenMode(); }} title={label}
              style={{ width: 50, height: 50, borderRadius: 13, border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', transition: 'all .14s',
                background: tool === id ? 'var(--mint-soft)' : 'transparent',
                color: tool === id ? 'var(--mint-2)' : 'var(--ink-3)' }}>
              {icon}
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 7.5, letterSpacing: '.06em', textTransform: 'uppercase', lineHeight: 1 }}>{label}</span>
            </button>
          ))}
          <div style={{ width: 36, height: 1, background: 'var(--line)', margin: '2px 0' }} />
          <button onClick={() => { setIsPenMode(p => !p); setTool(null); }} title="Outil Plume — dessiner un tracé libre"
            style={{ width: 50, height: 50, borderRadius: 13, border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: isPenMode ? 'crosshair' : 'pointer', transition: 'all .14s',
              background: isPenMode ? 'var(--mint-soft)' : 'transparent',
              color: isPenMode ? 'var(--mint-2)' : 'var(--ink-3)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 7.5, letterSpacing: '.06em', textTransform: 'uppercase', lineHeight: 1 }}>Plume</span>
          </button>
        </div>

        {/* ── TOOL PANEL FLYOUT (312px, conditional) ── */}
        {tool && (
          <div data-stop-deselect className="pop-in ed-panel" style={{ width: 312, background: 'var(--white)', borderRight: '1px solid var(--line)', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

            {/* DESIGN — Modèles */}
            {tool === 'design' && (
              <div style={{ padding: '18px' }}>
                <PanelHead title="Modèles" sub={`Mises en page · ${workspaceName}`} onClose={() => setTool(null)} />
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ink-3)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                  <input className="input" placeholder="Rechercher un modèle…" style={{ paddingLeft: 36, height: 40, background: 'var(--sunk)', border: 'none' }} />
                </div>
                <p className="label" style={{ marginBottom: 9 }}>Arrière-plans</p>
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
                <PanelHead title="Éléments" sub="Formes & blocs de couleur" onClose={() => setTool(null)} />
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ink-3)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                  <input className="input" placeholder="Rechercher un élément…" style={{ paddingLeft: 36, height: 40, background: 'var(--sunk)', border: 'none' }} />
                </div>
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px' }}>Formes</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 16 }}>
                  {[
                    { label: 'Carré',    fn: addRect,   preview: <rect x="6" y="6" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5"/> },
                    { label: 'Cercle',   fn: addCircle, preview: <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/> },
                    { label: 'Pilule',   fn: addRect,   preview: <rect x="4" y="8" width="16" height="8" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5"/> },
                    { label: 'Triangle', fn: addStar,   preview: <polygon points="12,5 20,19 4,19" fill="none" stroke="currentColor" strokeWidth="1.5"/> },
                    { label: 'Ligne',    fn: () => addRect(), preview: <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/> },
                    { label: 'Étoile',   fn: addStar,   preview: <polygon points="12,3 14.5,9 21,9.5 16,14 17.5,21 12,17.5 6.5,21 8,14 3,9.5 9.5,9" fill="none" stroke="currentColor" strokeWidth="1.3"/> },
                  ].map(({ label, fn, preview }) => (
                    <button key={label} onClick={fn} className="well"
                      style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer', borderRadius: 10 }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" style={{ color: 'var(--ink-2)' }}>{preview}</svg>
                      <span style={{ fontSize: 9.5, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px 0', marginTop: 16 }}>Formes vectorielles</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7, marginBottom: 16 }}>
                  {([
                    { shape: 'rectangle' as const, label: 'Rect', icon: <rect x="4" y="6" width="16" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6"/> },
                    { shape: 'circle' as const,    label: 'Rond', icon: <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.6"/> },
                    { shape: 'triangle' as const,  label: 'Triangle', icon: <polygon points="12,4 21,20 3,20" fill="none" stroke="currentColor" strokeWidth="1.5"/> },
                    { shape: 'star' as const,      label: 'Étoile', icon: <polygon points="12,3 14.5,9 21,9.5 16,14 17.5,21 12,17.5 6.5,21 8,14 3,9.5 9.5,9" fill="none" stroke="currentColor" strokeWidth="1.3"/> },
                    { shape: 'pill' as const,      label: 'Pilule', icon: <rect x="3" y="8" width="18" height="8" rx="4" fill="none" stroke="currentColor" strokeWidth="1.6"/> },
                    { shape: 'arrow' as const,     label: 'Flèche', icon: <><path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" d="M3 10h12V6l6 6-6 6v-4H3z"/></> },
                    { shape: 'diamond' as const,   label: 'Losange', icon: <polygon points="12,3 21,12 12,21 3,12" fill="none" stroke="currentColor" strokeWidth="1.5"/> },
                    { shape: 'hexagon' as const,   label: 'Hexa', icon: <polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" fill="none" stroke="currentColor" strokeWidth="1.5"/> },
                  ]).map(({ shape, label, icon }) => (
                    <button key={shape} onClick={() => addVector(shape)} className="well"
                      style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', borderRadius: 10 }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" style={{ color: 'var(--ink-2)' }}>{icon}</svg>
                      <span style={{ fontSize: 8.5, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px' }}>Badges</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['NOUVEAU', '-20%', 'RÉSA EN BIO'].map(badge => (
                    <button key={badge} onClick={() => { const el: TextEl = { id: newId(), type: 'text', x: 60, y: 60, rotation: 0, opacity: 100, text: badge, fontSize: 32, fontFamily: 'Archivo', fontStyle: 'bold', textDecoration: '', fill: '#fff', align: 'center', width: 220, hasBg: true, bgColor: workspaceData?.primary_color || '#0038FF', bgOpacity: 100, cornerRadius: 8, padding: 16, paddingH: 20, paddingV: 12 }; applyElements([...elements, el]); setSelectedId(el.id); }}
                      style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px dashed var(--line)', cursor: 'pointer', fontSize: 13, fontFamily: 'Archivo', fontWeight: 800, letterSpacing: '.05em', color: 'var(--ink-2)', background: 'var(--sunk)', textAlign: 'left' }}>
                      {badge}
                    </button>
                  ))}
                </div>

                {/* ── Icônes SVG (Iconify) ── */}
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '20px 0 8px' }}>Icônes & stickers</p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                    <input value={iconQuery} onChange={e => setIconQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchIcons(iconQuery); } }}
                      enterKeyHint="search" inputMode="search" autoCapitalize="none" autoCorrect="off"
                      placeholder="Rechercher une icône…"
                      style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 12.5, outline: 'none', fontFamily: 'var(--sans)', background: 'var(--sunk)', color: 'var(--ink)', boxSizing: 'border-box' }} />
                  </div>
                  <button type="button" onClick={() => fetchIcons(iconQuery)} aria-label="Rechercher"
                    style={{ flexShrink: 0, width: 40, borderRadius: 8, border: 'none', background: 'var(--mint, #2FD79B)', color: '#06281C', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                  </button>
                </div>
                {/* couleur d'icône */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>Couleur :</span>
                  {[['#14160F', 'Noir'], ['#FFFFFF', 'Blanc'], [workspaceData?.primary_color || '#2FD79B', 'Marque']].map(([c]) => (
                    <button key={c} onClick={() => setIconColor(c)} title={c}
                      style={{ width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer', border: iconColor === c ? '2px solid var(--mint, #2FD79B)' : '1.5px solid var(--line)', padding: 0 }} />
                  ))}
                </div>
                {iconLoading ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0' }}>Chargement…</p>
                ) : iconResults.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0' }}>Aucune icône — essayez un autre mot-clé.</p>
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
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '16px 0 8px' }}>Motifs</p>
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
                <PanelHead title="Texte" onClose={() => setTool(null)} />
                <button onClick={addText} className="btn btn-dark" style={{ width: '100%', justifyContent: 'center', marginBottom: 16, gap: 8, height: 44 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Ajouter une zone de texte
                </button>
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px' }}>Styles</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={() => applyTemplate({ fontSize: 88, fontFamily: 'Archivo', fontStyle: 'italic bold', fill: workspaceData?.primary_color || '#111' } as Partial<TextEl>)}
                    style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line)', cursor: 'pointer', background: 'var(--sunk)', textAlign: 'left' }}>
                    <span style={{ fontFamily: 'Archivo', fontStyle: 'italic', fontWeight: 900, fontSize: 26, color: 'var(--ink)', display: 'block', lineHeight: 1 }}>Titre</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>Archivo Italic · 88px</span>
                  </button>
                  <button onClick={() => applyTemplate({ fontSize: 46, fontFamily: 'Cabinet Grotesk', fontStyle: 'bold', fill: workspaceData?.primary_color || '#111' } as Partial<TextEl>)}
                    style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line)', cursor: 'pointer', background: 'var(--sunk)', textAlign: 'left' }}>
                    <span style={{ fontFamily: 'Cabinet Grotesk', fontWeight: 700, fontSize: 20, color: 'var(--ink)', display: 'block', lineHeight: 1 }}>Sous-titre</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>Cabinet Grotesk · 46px</span>
                  </button>
                  <button onClick={() => applyTemplate({ fontSize: 28, fontFamily: 'Satoshi', fontStyle: 'normal', fill: '#333' } as Partial<TextEl>)}
                    style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line)', cursor: 'pointer', background: 'var(--sunk)', textAlign: 'left' }}>
                    <span style={{ fontFamily: 'Satoshi', fontWeight: 400, fontSize: 15, color: 'var(--ink-2)', display: 'block', lineHeight: 1.4 }}>Corps de texte</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>Satoshi · 28px</span>
                  </button>
                </div>
                <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '16px 0 8px' }}>Layouts IA</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {LAYOUT_TEMPLATES.map(tpl => (
                    <button key={tpl.label} onClick={() => applyLayoutTemplate(tpl)} className="well"
                      style={{ width: '100%', padding: '9px 12px', cursor: 'pointer', fontSize: 12, textAlign: 'left', color: 'var(--ink-2)', fontFamily: 'var(--sans)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>{tpl.emoji}</span>
                      <span>{tpl.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--mint-2)', fontFamily: 'var(--mono)', fontWeight: 700, background: 'var(--mint-soft)', padding: '2px 5px', borderRadius: 4 }}>{tpl.blocks.length} blocs</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PHOTOS */}
            {tool === 'photos' && (
              <div style={{ padding: '18px' }}>
                <PanelHead title="Photos" sub="Pexels · 3M+ photos" onClose={() => setTool(null)} />
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
                      placeholder="Rechercher des photos..."
                      style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 12.5, outline: 'none', fontFamily: 'var(--sans)', background: 'var(--sunk)', color: 'var(--ink)', boxSizing: 'border-box' }} />
                  </div>
                  <button type="button" onClick={() => fetchPexels(pexelsQuery || 'nature', 1)} aria-label="Rechercher"
                    style={{ flexShrink: 0, width: 40, borderRadius: 8, border: 'none', background: 'var(--mint, #2FD79B)', color: '#06281C', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                  </button>
                </div>

                {/* Quick searches */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                  {['Nature', 'Ville', 'Nourriture', 'Mode', 'Architecture'].map(q => (
                    <button key={q} onClick={() => { setPexelsQuery(q); fetchPexels(q, 1); }}
                      style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid var(--line)', background: pexelsQuery === q ? 'var(--ink)' : 'var(--sunk)', color: pexelsQuery === q ? '#fff' : 'var(--ink-2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                      {q}
                    </button>
                  ))}
                </div>

                {/* Results grid */}
                {pexelsLoading && pexelsPhotos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
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
                <PanelHead title="Charte de marque" sub={workspaceName} onClose={() => setTool(null)} />
                <SectionLabel>Couleurs</SectionLabel>
                <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
                  {[workspaceData?.primary_color || '#0038FF', workspaceData?.secondary_color || '#FFFFFF', workspaceData?.accent_color].filter(Boolean).map((col, i) => (
                    <div key={i} style={{ flex: 1, cursor: 'pointer' }} title={`Copier ${col}`} onClick={() => { try { navigator.clipboard.writeText(col!); } catch {} }}>
                      <div style={{ height: 36, borderRadius: 6, background: col!, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} />
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-3)', marginTop: 3, textAlign: 'center', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</div>
                    </div>
                  ))}
                </div>
                {brandFontNames.length > 0 && <>
                  <SectionLabel>Typographie</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {brandFontNames.map((font, i) => (
                      <div key={font} title="Ajouter un texte avec cette police"
                        onClick={() => { const el: TextEl = { id: newId(), type: 'text', x: 30, y: 60 + i * 60, rotation: 0, opacity: 100, text: font, fontSize: 26, fontFamily: font, fontStyle: 'bold', textDecoration: '', fill: workspaceData?.primary_color || '#000', align: 'left', width: 260, hasBg: false, bgColor: '#000', bgOpacity: 80, cornerRadius: 4, padding: 12, paddingH: 12, paddingV: 8 }; applyElements([...elements, el]); setSelectedId(el.id); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: 'var(--sunk)', cursor: 'pointer', border: '1px solid var(--line)' }}>
                        <span style={{ fontFamily: `"${font}", sans-serif`, fontSize: 22, color: 'var(--ink)', lineHeight: 1 }}>Aa</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 600 }}>{font}</span>
                      </div>
                    ))}
                  </div>
                </>}
                {(workspaceData?.logo_url || workspaceData?.logo_dark_url) && <>
                  <SectionLabel>Logo</SectionLabel>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {workspaceData?.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={workspaceData.logo_url} alt="Logo" title="Ajouter au canvas" style={{ height: 38, maxWidth: 90, objectFit: 'contain', cursor: 'pointer', borderRadius: 5, background: 'var(--white)', padding: 4, border: '1px solid var(--line)' }} onClick={() => addLogoEl(workspaceData.logo_url!)} />
                    )}
                    {workspaceData?.logo_dark_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={workspaceData.logo_dark_url} alt="Logo variante" title="Ajouter au canvas (variante sombre)" style={{ height: 38, maxWidth: 90, objectFit: 'contain', cursor: 'pointer', borderRadius: 5, background: '#1A1A1A', padding: 4, border: '1px solid var(--line)' }} onClick={() => addLogoEl(workspaceData.logo_dark_url!)} />
                    )}
                  </div>
                </>}
                {workspaceData?.brand_assets && workspaceData.brand_assets.length > 0 && <>
                  <SectionLabel>Assets de marque</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                    {workspaceData.brand_assets.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="" title="Ajouter au canvas" style={{ aspectRatio: '1', objectFit: 'contain', borderRadius: 6, background: 'var(--sunk)', padding: 4, border: '1px solid var(--line)', cursor: 'pointer', width: '100%', display: 'block' }} onClick={() => addImageEl(url)} />
                    ))}
                  </div>
                </>}
              </div>
            )}

            {/* UPLOAD — Importer */}
            {tool === 'upload' && (
              <div style={{ padding: '18px' }}>
                <PanelHead title="Importer" onClose={() => setTool(null)} />
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
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Glissez vos fichiers ici</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>PNG, JPG, SVG, WEBP</span>
                </div>
              </div>
            )}

            {/* CALQUES — Layers panel */}
            {tool === 'calques' && (
              <div style={{ padding: '18px' }}>
                <PanelHead title="Calques" sub="Ordre et verrouillage" onClose={() => setTool(null)} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Elements in reverse z-order (top layer first) */}
                  {[...elements].reverse().map((el, i) => {
                    const label = layerName(el);
                    const icon = el.type === 'text'
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                      : el.type === 'image'
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      : el.type === 'circle'
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/></svg>
                      : el.type === 'vector'
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12,3 21,12 12,21 3,12"/></svg>
                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
                    const isSelected = el.id === selectedId;
                    return (
                      <button key={el.id} onClick={() => { setSelectedId(el.id); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', background: isSelected ? 'var(--mint-soft)' : 'transparent', color: isSelected ? 'var(--mint-2)' : 'var(--ink-2)' }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--sunk)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isSelected ? 'var(--mint-soft)' : 'transparent'; }}>
                        <span style={{ flexShrink: 0, opacity: .7 }}>{icon}</span>
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isSelected ? 'var(--mint-2)' : 'var(--ink)' }}>{label}</span>
                        <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontWeight: 700, flexShrink: 0 }}>{elements.length - i}</span>
                      </button>
                    );
                  })}
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
              </div>
            )}

          </div>
        )}

        {/* ── CANVAS WORKSPACE ── */}
        <div className="ed-canvas-area" style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'radial-gradient(120% 80% at 50% -10%, #FBFAF4, #ECEBE1 70%)', position: 'relative' }}>
          <div ref={canvasAreaRef}
          onMouseDown={() => { setSelectedId(null); setSelectedIds([]); setEditingId(null); setBgCropMode(false); setBgImageSelected(false); }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: '40px 28px', gap: 40 }}>
            {slides.map((slide, idx) => {
              const isActive = idx === activeSlideIdx;
              return (
                <div key={slide.id}
                  ref={el => { slideContainerRefs.current[idx] = el; }}
                  style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '.04em' }}>{idx + 1}</div>
                  <div style={{ width: stageW * zoom, height: stageH * zoom, position: 'relative', borderRadius: Math.round(18 * zoom), boxShadow: isActive ? '0 22px 50px -24px rgba(13,15,10,.45)' : '0 8px 22px -10px rgba(13,15,10,.22)', outline: isActive ? '2.5px solid var(--mint)' : '2px solid transparent', flexShrink: 0 }}>
                  {isActive ? (
                    <>
                    <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, width: stageW, height: stageH, transform: `scale(${zoom})`, transformOrigin: 'top left', borderRadius: 18 }}>
            {/* Inner div clips only the Stage canvas to preserve border-radius */}
            <div style={{ borderRadius: 18, overflow: 'hidden' }}>
            <Stage
              ref={stageRef}
              width={stageW} height={stageH}
              onMouseDown={e => { if (e.target === e.target.getStage()) { if (cropId) { setCropId(null); } else { setSelectedId(null); if (!bgLocked && proxyUrl) setBgCropMode(true); else setBgCropMode(false); } } }}
              style={{ display: 'block' }}
            >
              <Layer>
                <Rect x={0} y={0} width={stageW} height={stageH} fill="white" listening={false} />
                {/* Template gradient/solid background — rendered below BgImage */}
                {bgStyle && <BgStyleLayer bgStyle={bgStyle} w={stageW} h={stageH} />}
                {proxyUrl && (
                  <BgImage
                    src={proxyUrl} w={stageW} h={stageH}
                    offsetX={bgOffsetX} offsetY={bgOffsetY}
                    draggable={bgCropMode}
                    onDragEnd={(x, y) => { setBgOffsetX(x); setBgOffsetY(y); }}
                    opacity={bgOpacity / 100}
                    onSelect={!bgLocked && !bgCropMode ? () => { setBgImageSelected(true); setSelectedId(null); } : undefined}
                  />
                )}

                {elements.map(el => {
                  if (hiddenIds.has(el.id)) return null;
                  if (el.type === 'image') return (
                    <ImgNode key={el.id} el={el} onSelect={sk => handleElClick(el.id, sk)} onChange={u => updateEl(el.id, u)}
                      onDragStart={() => handleElDragStart(el.id)}
                      onDragEnd={(x, y) => handleElDragEnd(el.id, x, y)}
                      isCropping={cropId === el.id} />
                  );
                  if (el.type === 'rect') return (
                    <Rect key={el.id} id={el.id} x={el.x} y={el.y} width={el.width} height={el.height}
                      fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth}
                      cornerRadius={el.cornerRadius} rotation={el.rotation} opacity={el.opacity / 100} draggable
                      onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                      onDragStart={() => handleElDragStart(el.id)}
                      onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())} />
                  );
                  if (el.type === 'circle') return (
                    <Circle key={el.id} id={el.id} x={el.x} y={el.y} radius={el.radius}
                      fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth}
                      rotation={el.rotation} opacity={el.opacity / 100} draggable
                      onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                      onDragStart={() => handleElDragStart(el.id)}
                      onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())} />
                  );
                  if (el.type === 'star') return (
                    <KonvaStar key={el.id} id={el.id} x={el.x} y={el.y} numPoints={el.numPoints}
                      innerRadius={el.innerRadius} outerRadius={el.outerRadius}
                      fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth}
                      rotation={el.rotation} opacity={el.opacity / 100} draggable
                      onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                      onDragStart={() => handleElDragStart(el.id)}
                      onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())} />
                  );
                  if (el.type === 'vector') return (
                    <VectorNode key={el.id} el={el as VectorEl}
                      onSelect={sk => handleElClick(el.id, sk)}
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
                      onDragEnd={(x, y) => handleElDragEnd(el.id, x, y)}
                      isMaskCrop={maskCropId === el.id}
                      onImageOffset={(x, y) => updateEl(el.id, { imageOffsetX: x, imageOffsetY: y } as Partial<VectorEl>)} />
                  );
                  if (el.type === 'text') {
                    const pH = el.paddingH ?? el.padding;
                    const pV = el.paddingV ?? el.padding;
                    const measuredW = measureTextWidth(el.text, el.fontSize, el.fontFamily, el.fontStyle);
                    const rawW = el.width ?? (measuredW + pH * 2);
                    const blockW = Math.min(Math.max(rawW, 80), stageW - 40);
                    const textAreaW = Math.max(1, blockW - pH * 2);
                    // Dynamic blockH: account for text wrapping and manual line breaks
                    const allLines = (el.uppercase ? el.text.toUpperCase() : el.text).split('\n');
                    const lineCount = allLines.reduce((acc: number, line: string) => {
                      const lw = measureTextWidth(line || ' ', el.fontSize, el.fontFamily, el.fontStyle);
                      return acc + Math.max(1, Math.ceil(lw / Math.max(1, textAreaW)));
                    }, 0);
                    const blockH = Math.max(1, lineCount) * el.fontSize * (el.lineHeight ?? 1.2) + pV * 2;
                    return (
                      <Group key={el.id} id={el.id} x={el.x} y={el.y} rotation={el.rotation} opacity={el.opacity / 100}
                        draggable
                        onClick={e => handleElClick(el.id, e.evt.shiftKey)} onTap={() => handleElClick(el.id, false)}
                        onDblClick={() => { setSelectedId(el.id); setEditingId(el.id); }}
                        onDragStart={() => handleElDragStart(el.id)}
                        onDragEnd={e => handleElDragEnd(el.id, e.target.x(), e.target.y())}>
                        {/* Bug 5 fix: always render Rect for hit detection; transparent when hasBg=false */}
                        <Rect x={0} y={0} width={blockW} height={blockH}
                          fill={el.hasBg ? el.bgColor : 'rgba(0,0,0,0.01)'}
                          opacity={el.hasBg ? el.bgOpacity / 100 : 1}
                          cornerRadius={el.hasBg ? el.cornerRadius : 0}
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
                          fill={el.hollowEnabled ? 'transparent' : el.fill}
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
                <span><b style={{ color: '#eeeee0' }}>Clic</b> — ancre &middot; <b style={{ color: '#eeeee0' }}>Clic+glisser</b> — courbe &middot; <b style={{ color: '#eeeee0' }}>Dbl-clic</b> — terminer &middot; <b style={{ color: '#eeeee0' }}>Échap</b> — annuler{penPoints.length >= 3 && <> &middot; <b style={{ color: '#2FD79B' }}>1er point</b> — fermer</>}</span>
              </div>
            )}

            {/* BG image selected — selection border + opacity pill */}
            {bgImageSelected && (
              <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', inset: 0, borderRadius: 18, border: '2px solid #8B5CF6', pointerEvents: 'none', zIndex: 10 }} />
            )}
            {bgImageSelected && (
              <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: '#fff', borderRadius: 11, padding: '6px 12px', boxShadow: '0 8px 24px -8px rgba(13,15,10,.3), 0 0 0 1px rgba(13,15,10,.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>Opacité fond</span>
                <input type="range" min={10} max={100} value={bgOpacity} onChange={e => setBgOpacity(Number(e.target.value))} style={{ width: 80, accentColor: '#8B5CF6' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', minWidth: 28, fontVariantNumeric: 'tabular-nums' }}>{bgOpacity}%</span>
                <button onClick={() => { setProxyUrl(''); setBgImageSelected(false); }} style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', display: 'grid', placeItems: 'center', borderRadius: 5 }}
                  title="Supprimer le fond">
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
              const blockW = Math.min(Math.max(tel.width ?? 200, 80), stageW - 40);
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
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: Math.round(18 * zoom), overflow: 'hidden', cursor: 'pointer', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            background: 'var(--white)', borderTop: '1px solid var(--line)',
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
                className="ed-range" style={{ width: 132 }} />
              <button onClick={() => setZoom(z => Math.min(1.5, +(z + 0.1).toFixed(2)))} style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-2)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12, width: 42, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={fit} title="Ajuster" className="btn btn-sm btn-ghost btn-icon" style={{ height: 34, width: 34 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              </button>
            </div>
          </div>

          {/* ── SLIDE STRIP ── */}
          <div style={{
            height: 80, flexShrink: 0,
            background: 'var(--canvas)', borderTop: '1px solid var(--line)',
            display: 'flex', alignItems: 'center',
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
