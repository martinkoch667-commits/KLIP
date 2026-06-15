'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Rect,
  Stage,
  Star as KonvaStar,
  Text,
} from 'react-konva';
import useImage from 'use-image';
import ColorPicker from '@/components/ColorPicker';
import SelectionOverlay from '@/components/SelectionOverlay';

// ─── Types (same as editor) ───────────────────────────────────────────────────

interface BaseEl { id: string; x: number; y: number; rotation: number; opacity: number; }
interface TextEl extends BaseEl {
  type: 'text'; text: string; fontSize: number; fontFamily: string; fontStyle: string;
  textDecoration: string; fill: string; align: string; width: number;
  hasBg: boolean; bgColor: string; bgOpacity: number; cornerRadius: number;
  padding: number; paddingH: number; paddingV: number;
  role?: string;
}
interface RectEl extends BaseEl { type: 'rect'; width: number; height: number; fill: string; stroke: string; strokeWidth: number; cornerRadius: number; }
interface CircleEl extends BaseEl { type: 'circle'; radius: number; fill: string; stroke: string; strokeWidth: number; }
interface StarEl extends BaseEl { type: 'star'; numPoints: number; innerRadius: number; outerRadius: number; fill: string; stroke: string; strokeWidth: number; }
interface ImageEl extends BaseEl { type: 'image'; src: string; width: number; height: number; cropX?: number; cropY?: number; naturalW?: number; naturalH?: number; }
export type CanvasEl = TextEl | RectEl | CircleEl | StarEl | ImageEl;

const PHOTO_PLACEHOLDER_SRC = '__PHOTO_PLACEHOLDER__';

// ─── Exported types ───────────────────────────────────────────────────────────

export interface BgStyle {
  type: 'gradient' | 'solid';
  color?: string;
  angle?: number;
  colorFrom?: string;
  colorTo?: string;
}

export interface TemplateDraft {
  name: string;
  format_id: string;
  background_style: BgStyle;
  text_zones: CanvasEl[];   // full element array — stored as JSONB
  logo_placement: { x: number; y: number; width: number; height: number } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONTS = [
  'Anton', 'Oswald', 'Bebas Neue', 'Montserrat', 'Syne', 'Inter', 'Poppins',
  'Barlow Condensed', 'Raleway', 'Roboto Condensed', 'Playfair Display', 'Lato',
  'Nunito', 'Work Sans', 'DM Sans', 'Space Grotesk', 'Archivo Black',
  'Fjalla One', 'Exo 2', 'Ubuntu',
];

const FORMATS = [
  { id: 'ig-portrait', label: 'Portrait 4:5', sub: '1080×1350', w: 448, h: 560 },
  { id: 'ig-square',   label: 'Carré',         sub: '1080×1080', w: 560, h: 560 },
  { id: 'ig-story',    label: 'Story',          sub: '1080×1920', w: 315, h: 560 },
  { id: 'facebook',    label: 'Facebook Post',  sub: '1200×630',  w: 560, h: 294 },
];

const TEXT_ROLES = [
  { value: '',            label: 'Aucun rôle' },
  { value: 'titre',       label: 'Titre principal' },
  { value: 'sous-titre',  label: 'Sous-titre' },
  { value: 'accroche',    label: 'Accroche / Tag' },
  { value: 'corps',       label: 'Corps de texte' },
  { value: 'cta',         label: 'Call-to-action' },
  { value: 'prix',        label: 'Prix / Offre' },
  { value: 'personnalise', label: 'Personnalisé' },
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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ─── Canvas sub-components ────────────────────────────────────────────────────

function GradientBg({ bg, w, h }: { bg: BgStyle; w: number; h: number }) {
  if (bg.type === 'solid') {
    return <Rect x={0} y={0} width={w} height={h} fill={bg.color ?? '#000'} listening={false} />;
  }
  const angle = ((bg.angle ?? 135) * Math.PI) / 180;
  const len = Math.sqrt(w * w + h * h);
  const cx = w / 2, cy = h / 2;
  const startX = cx - Math.cos(angle) * len / 2;
  const startY = cy - Math.sin(angle) * len / 2;
  const endX   = cx + Math.cos(angle) * len / 2;
  const endY   = cy + Math.sin(angle) * len / 2;
  const [r1, g1, b1] = hexToRgb(bg.colorFrom ?? '#0038FF');
  const [r2, g2, b2] = hexToRgb(bg.colorTo   ?? '#FFFFFF');
  return (
    <Rect x={0} y={0} width={w} height={h} listening={false}
      fillLinearGradientStartPoint={{ x: startX, y: startY }}
      fillLinearGradientEndPoint={{ x: endX, y: endY }}
      fillLinearGradientColorStops={[0, `rgb(${r1},${g1},${b1})`, 1, `rgb(${r2},${g2},${b2})`]}
    />
  );
}

// Photo placeholder — draggable + resizable like any ImageEl
function PhotoPlaceholderNode({ el, onSelect, onDragStart, onDragEnd }: {
  el: ImageEl; onSelect: () => void;
  onDragStart: () => void; onDragEnd: (x: number, y: number) => void;
}) {
  return (
    <Group x={el.x} y={el.y} rotation={el.rotation} opacity={el.opacity / 100}
      draggable
      onClick={onSelect} onTap={onSelect}
      onDragStart={onDragStart}
      onDragEnd={e => onDragEnd(e.target.x(), e.target.y())}>
      <Rect width={el.width} height={el.height}
        fill="rgba(200,200,200,0.12)"
        stroke="rgba(200,200,200,0.45)"
        strokeWidth={1.5}
        dash={[6, 4]}
        cornerRadius={6}
      />
      <Text text="Zone photo" width={el.width} height={el.height}
        align="center" verticalAlign="middle"
        fontSize={14} fontStyle="bold"
        fill="rgba(200,200,200,0.55)"
        fontFamily="Inter, sans-serif"
        listening={false}
      />
    </Group>
  );
}

// Real image element (logo)
function ImgNode({ el, onSelect, onDragStart, onDragEnd }: {
  el: ImageEl; onSelect: () => void;
  onDragStart: () => void; onDragEnd: (x: number, y: number) => void;
}) {
  const [img] = useImage(el.src, 'anonymous');
  return (
    <Group x={el.x} y={el.y} rotation={el.rotation} opacity={el.opacity / 100}
      draggable
      onClick={onSelect} onTap={onSelect}
      clipX={0} clipY={0} clipWidth={el.width} clipHeight={el.height}
      onDragStart={onDragStart}
      onDragEnd={e => onDragEnd(e.target.x(), e.target.y())}>
      {img && <KonvaImage image={img} width={el.width} height={el.height} />}
    </Group>
  );
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 8px', background: 'var(--sunk)', border: '1px solid var(--line)',
  borderRadius: 4, cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: '0 0 8px', fontFamily: 'var(--mono)', fontWeight: 800 }}>
      {children}
    </p>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', display: 'block', marginBottom: 6, fontFamily: 'var(--mono)', fontWeight: 800 }}>{label}</label>
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

// ─── Text properties panel ────────────────────────────────────────────────────

function TextProperties({ el, onChange, brandColors, brandFontNames }: {
  el: TextEl; onChange: (u: Partial<TextEl>) => void;
  brandColors?: string[]; brandFontNames?: string[];
}) {
  const isBold = el.fontStyle.includes('bold');
  const isItalic = el.fontStyle.includes('italic');
  const isUnderline = el.textDecoration === 'underline';
  const toggleBold = () => onChange({ fontStyle: isItalic ? (isBold ? 'italic' : 'bold italic') : (isBold ? 'normal' : 'bold') });
  const toggleItalic = () => onChange({ fontStyle: isBold ? (isItalic ? 'bold' : 'bold italic') : (isItalic ? 'normal' : 'italic') });

  return (
    <>
      {/* Role — shown first, most important for templates */}
      <PropRow label="Rôle dans le template">
        <select value={el.role || ''} onChange={e => onChange({ role: e.target.value || undefined })}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 13, outline: 'none', background: 'var(--sunk)', color: 'var(--ink)' }}>
          {TEXT_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {el.role && (
          <span style={{ fontSize: 10, color: 'var(--mint-2)', marginTop: 4, display: 'block', fontFamily: 'var(--mono)', fontWeight: 700 }}>
            Ce bloc sera rempli par l'IA lors de la génération
          </span>
        )}
      </PropRow>

      <PropRow label="Contenu">
        <textarea value={el.text} onChange={e => onChange({ text: e.target.value })} rows={2}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' as const, fontFamily: 'var(--sans)', outline: 'none', background: 'var(--sunk)', color: 'var(--ink)' }} />
      </PropRow>

      <PropRow label="Police">
        <select value={el.fontFamily} onChange={e => onChange({ fontFamily: e.target.value })}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 13, outline: 'none', background: 'var(--sunk)', color: 'var(--ink)', fontFamily: `"${el.fontFamily}", sans-serif` }}>
          {brandFontNames && brandFontNames.length > 0 && (
            <optgroup label="Charte de marque">
              {brandFontNames.map(f => <option key={f} value={f}>{f}</option>)}
            </optgroup>
          )}
          <optgroup label="Google Fonts">
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </optgroup>
        </select>
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
          <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', fontFamily: 'var(--mono)', fontWeight: 800 }}>Fond du bloc</span>
          <div onClick={() => onChange({ hasBg: !el.hasBg })}
            style={{ width: 38, height: 22, borderRadius: 11, background: el.hasBg ? 'var(--mint)' : 'var(--line)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 3, left: el.hasBg ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
          </div>
        </div>
        {el.hasBg && (
          <>
            <ColorRow label="Couleur fond" value={el.bgColor} onChange={v => onChange({ bgColor: v })} brandColors={brandColors} />
            <PropRow label={`Opacité fond — ${el.bgOpacity}%`}>
              <input type="range" min={0} max={100} value={el.bgOpacity} onChange={e => onChange({ bgOpacity: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
            </PropRow>
            <PropRow label={`Arrondi — ${el.cornerRadius}px`}>
              <input type="range" min={0} max={50} value={el.cornerRadius} onChange={e => onChange({ cornerRadius: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
            </PropRow>
          </>
        )}
      </div>

      <PropRow label={`Opacité — ${el.opacity}%`}>
        <input type="range" min={0} max={100} value={el.opacity} onChange={e => onChange({ opacity: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
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
        <PropRow label={`Arrondi — ${(el as RectEl).cornerRadius}px`}>
          <input type="range" min={0} max={50} value={(el as RectEl).cornerRadius} onChange={e => onChange({ cornerRadius: Number(e.target.value) } as any)} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
        </PropRow>
      )}
      <PropRow label={`Opacité — ${el.opacity}%`}>
        <input type="range" min={0} max={100} value={el.opacity} onChange={e => onChange({ opacity: Number(e.target.value) } as any)} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
    </>
  );
}

function layerName(el: CanvasEl): string {
  if (el.type === 'text') return (el.role ? `[${el.role}] ` : '') + (el.text.slice(0, 16) || 'Texte');
  if (el.type === 'image') return el.src === PHOTO_PLACEHOLDER_SRC ? 'Zone photo' : 'Logo';
  if (el.type === 'rect') return 'Rectangle';
  if (el.type === 'circle') return 'Cercle';
  if (el.type === 'star') return 'Étoile';
  return 'Élément';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TemplateEditorProps {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logoUrl?: string | null;
  logoPreview?: string | null;
  initialDraft?: Partial<TemplateDraft>;
  onSave: (draft: TemplateDraft) => void;
  onCancel: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TemplateEditor({
  primaryColor = '#0038FF',
  secondaryColor = '#FFFFFF',
  fontFamily = 'Oswald',
  logoUrl,
  initialDraft,
  onSave,
  onCancel,
}: TemplateEditorProps) {
  const stageRef = useRef<any>(null);
  const [isKonvaDragging, setIsKonvaDragging] = useState(false);

  // ── Core state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState(initialDraft?.name ?? 'Nouveau template');
  const [formatId, setFormatId] = useState(initialDraft?.format_id ?? 'ig-portrait');
  const [bgStyle, setBgStyle] = useState<BgStyle>(
    initialDraft?.background_style ?? { type: 'gradient', angle: 135, colorFrom: primaryColor, colorTo: secondaryColor }
  );
  const [elements, setElements] = useState<CanvasEl[]>(
    Array.isArray(initialDraft?.text_zones) ? (initialDraft!.text_zones as CanvasEl[]) : []
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<'media' | 'text' | 'brand' | 'shapes'>('text');

  // ── Drag & drop reorder ────────────────────────────────────────────────────
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ── History ────────────────────────────────────────────────────────────────
  const historyRef = useRef<CanvasEl[][]>([[]]);
  const histIdxRef = useRef(0);
  const [histTick, setHistTick] = useState(0);
  void histTick;

  const elementsRef = useRef<CanvasEl[]>(elements);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const fmt = FORMATS.find(f => f.id === formatId) ?? FORMATS[0];
  const stageW = fmt.w;
  const stageH = fmt.h;
  const stageWRef = useRef(stageW);
  const stageHRef = useRef(stageH);
  useEffect(() => { stageWRef.current = stageW; stageHRef.current = stageH; }, [stageW, stageH]);

  // ── Load Google Fonts ──────────────────────────────────────────────────────
  useEffect(() => {
    const fonts = ['Oswald', 'Anton', 'Bebas+Neue', 'Montserrat', 'Syne', 'Inter', 'Poppins', 'Work+Sans', 'DM+Sans', 'Space+Grotesk'];
    fonts.forEach(font => {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${font}:wght@400;700;900&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    });
    if (fontFamily && !fonts.some(f => f.replace('+', ' ') === fontFamily)) {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;700;900&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, [fontFamily]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteEl();
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); duplicateEl(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── History helpers ────────────────────────────────────────────────────────

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
    applyElements(elementsRef.current.filter(e => e.id !== target));
    setSelectedId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const duplicateEl = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id) return;
    const el = elementsRef.current.find(e => e.id === id);
    if (!el) return;
    const dup = { ...el, id: newId(), x: el.x + 20, y: el.y + 20 };
    applyElements([...elementsRef.current, dup]);
    setSelectedId(dup.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Z-order ────────────────────────────────────────────────────────────────

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

  // ── Add elements ───────────────────────────────────────────────────────────

  const addText = (role?: string) => {
    const roleLabel = TEXT_ROLES.find(r => r.value === role)?.label ?? 'Texte';
    const el: TextEl = {
      id: newId(), type: 'text', x: 20, y: 60 + elements.length * 50, rotation: 0, opacity: 100,
      text: role ? roleLabel : 'Nouveau texte',
      fontSize: role === 'titre' ? 42 : role === 'sous-titre' ? 22 : role === 'cta' ? 16 : 28,
      fontFamily: fontFamily || 'Oswald',
      fontStyle: (role === 'titre' || role === 'sous-titre' || role === 'cta') ? 'bold' : 'normal',
      textDecoration: '', fill: '#FFFFFF', align: 'left',
      width: stageWRef.current - 40,
      hasBg: false, bgColor: primaryColor, bgOpacity: 90, cornerRadius: 4, padding: 12, paddingH: 14, paddingV: 8,
      role: role || undefined,
    };
    applyElements([...elements, el]);
    setSelectedId(el.id);
    setTool('text');
  };

  const addPhotoPlaceholder = () => {
    // Only one photo placeholder allowed
    if (elements.some(e => e.type === 'image' && (e as ImageEl).src === PHOTO_PLACEHOLDER_SRC)) return;
    const w = Math.round(stageWRef.current * 0.7);
    const h = Math.round(stageHRef.current * 0.45);
    const el: ImageEl = {
      id: newId(), type: 'image', src: PHOTO_PLACEHOLDER_SRC,
      x: Math.round((stageWRef.current - w) / 2), y: Math.round(stageHRef.current * 0.2),
      width: w, height: h, rotation: 0, opacity: 100,
    };
    applyElements([...elements, el]);
    setSelectedId(el.id);
  };

  const addRect = () => {
    const el: RectEl = { id: newId(), type: 'rect', x: 60, y: 60, rotation: 0, opacity: 100, width: 200, height: 80, fill: primaryColor, stroke: '', strokeWidth: 0, cornerRadius: 0 };
    applyElements([...elements, el]);
    setSelectedId(el.id);
  };

  const addCircle = () => {
    const el: CircleEl = { id: newId(), type: 'circle', x: 200, y: 200, rotation: 0, opacity: 100, radius: 60, fill: primaryColor, stroke: '', strokeWidth: 0 };
    applyElements([...elements, el]);
    setSelectedId(el.id);
  };

  const addLogoEl = () => {
    if (!logoUrl) return;
    const size = Math.round(stageWRef.current * 0.24);
    const el: ImageEl = { id: newId(), type: 'image', src: logoUrl, x: 20, y: 20, rotation: 0, opacity: 100, width: size, height: size };
    applyElements([...elements, el]);
    setSelectedId(el.id);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const logoEl = elements.find(e => e.type === 'image' && (e as ImageEl).src !== PHOTO_PLACEHOLDER_SRC) as ImageEl | undefined;
    const logo_placement = logoEl ? { x: logoEl.x, y: logoEl.y, width: logoEl.width, height: logoEl.height } : null;
    onSave({ name, format_id: formatId, background_style: bgStyle, text_zones: elements, logo_placement });
  };

  const selectedEl = elements.find(e => e.id === selectedId);
  const canUndo = histIdxRef.current > 0;
  const canRedo = histIdxRef.current < historyRef.current.length - 1;
  const brandColors = [primaryColor, secondaryColor].filter(Boolean) as string[];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--sans)', background: 'var(--canvas)',
    }}>

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: 52, background: 'var(--forest)', borderBottom: '1px solid rgba(238,237,227,.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', flexShrink: 0, zIndex: 10,
      }}>
        {/* Left: back + name + format badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button onClick={onCancel}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, boxShadow: 'inset 0 0 0 1px rgba(238,237,227,.2)', color: 'var(--cream-2)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>←</button>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--cream)', fontWeight: 700, fontSize: 14, fontFamily: 'var(--sans)', minWidth: 120, maxWidth: 240 }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--cream-2)', background: 'rgba(238,237,227,.1)', padding: '3px 8px', borderRadius: 5, flexShrink: 0 }}>
            Template · {fmt.label}
          </span>
        </div>

        {/* Center: undo/redo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={undo} disabled={!canUndo} title="Annuler (⌘Z)"
            style={{ width: 30, height: 30, background: 'transparent', border: 'none', borderRadius: 6, cursor: canUndo ? 'pointer' : 'default', fontSize: 15, color: 'rgba(238,237,227,.55)', opacity: canUndo ? 1 : 0.3, display: 'grid', placeItems: 'center' }}>↩</button>
          <button onClick={redo} disabled={!canRedo} title="Rétablir"
            style={{ width: 30, height: 30, background: 'transparent', border: 'none', borderRadius: 6, cursor: canRedo ? 'pointer' : 'default', fontSize: 15, color: 'rgba(238,237,227,.55)', opacity: canRedo ? 1 : 0.3, display: 'grid', placeItems: 'center' }}>↪</button>
        </div>

        {/* Right: cancel + save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onCancel}
            style={{ padding: '7px 16px', background: 'transparent', border: '1px solid rgba(238,237,227,.2)', borderRadius: 8, color: 'var(--cream-3)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Annuler
          </button>
          <button onClick={handleSave}
            style={{ padding: '8px 20px', background: 'var(--mint)', border: 'none', borderRadius: 8, color: 'var(--mint-ink)', fontSize: 13, cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--display)' }}>
            Enregistrer →
          </button>
        </div>
      </div>

      {/* ── BODY ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT TOOL RAIL ─────────────────────────────────────────────── */}
        <div style={{ width: 68, background: 'var(--canvas)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, gap: 2, flexShrink: 0 }}>
          {([
            { id: 'media', label: 'Fond', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
            { id: 'text',  label: 'Texte',  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> },
            { id: 'brand', label: 'Charte', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="17" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M13.5 9L6.5 14.5M13.5 9L19 14.5"/></svg> },
            { id: 'shapes', label: 'Formes', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><circle cx="17" cy="7" r="4"/><polygon points="12 21 3 15 21 15 12 21"/></svg> },
          ] as { id: typeof tool; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
            <button key={id} onClick={() => setTool(id)} title={label}
              style={{ width: 50, padding: '9px 4px', borderRadius: 12, border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', transition: 'all .14s',
                background: tool === id ? 'var(--mint-soft)' : 'transparent',
                color: tool === id ? 'var(--mint-2)' : 'var(--ink-3)' }}>
              {icon}
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 8, letterSpacing: '.06em', textTransform: 'uppercase' as const, lineHeight: 1 }}>{label}</span>
            </button>
          ))}

          {/* Format selector at bottom */}
          <div style={{ marginTop: 'auto', paddingBottom: 12, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: 'var(--ink-3)', marginBottom: 2 }}>Format</span>
            {FORMATS.map(f => (
              <button key={f.id} onClick={() => setFormatId(f.id)} title={f.label}
                style={{ width: 34, height: 34, borderRadius: 7, border: '1.5px solid', cursor: 'pointer', fontSize: 8, fontFamily: 'var(--mono)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all .12s',
                  background: formatId === f.id ? 'var(--mint)' : 'var(--white)',
                  borderColor: formatId === f.id ? 'var(--mint)' : 'var(--line)',
                  color: formatId === f.id ? 'var(--mint-ink)' : 'var(--ink-3)' }}>
                {f.id === 'ig-portrait' ? '4:5' : f.id === 'ig-square' ? '1:1' : f.id === 'ig-story' ? '9:16' : 'FB'}
              </button>
            ))}
          </div>
        </div>

        {/* ── CANVAS AREA ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 28, background: 'var(--sunk)' }}>
          {/* Outer div: no overflow:hidden so handles (-5px) aren't clipped */}
          <div style={{ borderRadius: 18, boxShadow: '0 22px 50px -24px rgba(13,15,10,.55)', flexShrink: 0, position: 'relative' }}>
            {/* Inner div: clips only the Stage for rounded corners */}
            <div style={{ borderRadius: 18, overflow: 'hidden' }}>
              <Stage
                ref={stageRef}
                width={stageW} height={stageH}
                onMouseDown={e => { if (e.target === e.target.getStage()) setSelectedId(null); }}
                style={{ display: 'block' }}
              >
                <Layer>
                  {/* Gradient background */}
                  <GradientBg bg={bgStyle} w={stageW} h={stageH} />

                  {/* Elements */}
                  {elements.map(el => {
                    if (el.type === 'image') {
                      if ((el as ImageEl).src === PHOTO_PLACEHOLDER_SRC) return (
                        <PhotoPlaceholderNode key={el.id} el={el as ImageEl}
                          onSelect={() => setSelectedId(el.id)}
                          onDragStart={() => setIsKonvaDragging(true)}
                          onDragEnd={(x, y) => { setIsKonvaDragging(false); updateEl(el.id, { x, y }); }} />
                      );
                      return (
                        <ImgNode key={el.id} el={el as ImageEl}
                          onSelect={() => setSelectedId(el.id)}
                          onDragStart={() => setIsKonvaDragging(true)}
                          onDragEnd={(x, y) => { setIsKonvaDragging(false); updateEl(el.id, { x, y }); }} />
                      );
                    }
                    if (el.type === 'rect') return (
                      <Rect key={el.id} x={el.x} y={el.y} width={(el as RectEl).width} height={(el as RectEl).height}
                        fill={(el as RectEl).fill} stroke={(el as RectEl).stroke} strokeWidth={(el as RectEl).strokeWidth}
                        cornerRadius={(el as RectEl).cornerRadius} rotation={el.rotation} opacity={el.opacity / 100} draggable
                        onClick={() => setSelectedId(el.id)} onTap={() => setSelectedId(el.id)}
                        onDragStart={() => setIsKonvaDragging(true)}
                        onDragEnd={e => { setIsKonvaDragging(false); updateEl(el.id, { x: e.target.x(), y: e.target.y() }); }} />
                    );
                    if (el.type === 'circle') return (
                      <Circle key={el.id} x={el.x} y={el.y} radius={(el as CircleEl).radius}
                        fill={(el as CircleEl).fill} stroke={(el as CircleEl).stroke} strokeWidth={(el as CircleEl).strokeWidth}
                        rotation={el.rotation} opacity={el.opacity / 100} draggable
                        onClick={() => setSelectedId(el.id)} onTap={() => setSelectedId(el.id)}
                        onDragStart={() => setIsKonvaDragging(true)}
                        onDragEnd={e => { setIsKonvaDragging(false); updateEl(el.id, { x: e.target.x(), y: e.target.y() }); }} />
                    );
                    if (el.type === 'star') return (
                      <KonvaStar key={el.id} x={el.x} y={el.y} numPoints={(el as StarEl).numPoints}
                        innerRadius={(el as StarEl).innerRadius} outerRadius={(el as StarEl).outerRadius}
                        fill={(el as StarEl).fill} stroke={(el as StarEl).stroke} strokeWidth={(el as StarEl).strokeWidth}
                        rotation={el.rotation} opacity={el.opacity / 100} draggable
                        onClick={() => setSelectedId(el.id)} onTap={() => setSelectedId(el.id)}
                        onDragStart={() => setIsKonvaDragging(true)}
                        onDragEnd={e => { setIsKonvaDragging(false); updateEl(el.id, { x: e.target.x(), y: e.target.y() }); }} />
                    );
                    if (el.type === 'text') {
                      const t = el as TextEl;
                      const pH = t.paddingH ?? t.padding;
                      const pV = t.paddingV ?? t.padding;
                      const measuredW = measureTextWidth(t.text, t.fontSize, t.fontFamily, t.fontStyle);
                      const rawW = t.width ?? (measuredW + pH * 2);
                      const blockW = Math.min(Math.max(rawW, 80), stageW - 40);
                      const blockH = t.fontSize + pV * 2;
                      const textAreaW = Math.max(1, blockW - pH * 2);
                      return (
                        <Group key={el.id} x={el.x} y={el.y} rotation={el.rotation} opacity={el.opacity / 100}
                          draggable
                          onClick={() => setSelectedId(el.id)} onTap={() => setSelectedId(el.id)}
                          onDragStart={() => setIsKonvaDragging(true)}
                          onDragEnd={e => { setIsKonvaDragging(false); updateEl(el.id, { x: e.target.x(), y: e.target.y() }); }}>
                          <Rect x={0} y={0} width={blockW} height={blockH}
                            fill={t.hasBg ? t.bgColor : 'rgba(0,0,0,0.01)'}
                            opacity={t.hasBg ? t.bgOpacity / 100 : 1}
                            cornerRadius={t.hasBg ? t.cornerRadius : 0} />
                          <Text x={pH} y={pV} width={textAreaW} wrap="word" text={t.text}
                            fontSize={t.fontSize} fontFamily={t.fontFamily}
                            fontStyle={t.fontStyle} textDecoration={t.textDecoration}
                            fill={t.fill} align={t.align} listening={false} />
                        </Group>
                      );
                    }
                    return null;
                  })}
                </Layer>
              </Stage>
            </div>
            {/* SelectionOverlay — same as editor */}
            {selectedEl && !isKonvaDragging && (
              <SelectionOverlay
                el={selectedEl}
                stageRef={stageRef}
                onChange={u => updateEl(selectedEl.id, u)}
              />
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
        <div style={{ width: 300, background: 'var(--white)', borderLeft: '1px solid var(--line)', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

          {/* Layers */}
          <div style={{ borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
            <div style={{ padding: '8px 12px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800 }}>Calques</span>
              <span style={{ fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{elements.length}</span>
            </div>
            {[...elements].reverse().map((el, reversedIdx) => {
              const actualIdx = elements.length - 1 - reversedIdx;
              const isSelected = el.id === selectedId;
              const isDragOver = el.id === dragOverId;
              return (
                <div key={el.id}
                  draggable
                  onDragStart={() => setDragId(el.id)}
                  onDragOver={e => { e.preventDefault(); setDragOverId(el.id); }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={() => {
                    if (!dragId || dragId === el.id) { setDragId(null); setDragOverId(null); return; }
                    const fromIdx = elements.findIndex(e => e.id === dragId);
                    if (fromIdx < 0) return;
                    const n = [...elements];
                    const [moved] = n.splice(fromIdx, 1);
                    n.splice(actualIdx, 0, moved);
                    applyElements(n);
                    setDragId(null); setDragOverId(null);
                  }}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  onClick={() => setSelectedId(isSelected ? null : el.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px 5px 8px',
                    background: isSelected ? 'var(--mint-soft)' : isDragOver ? 'rgba(47,215,155,0.08)' : 'transparent',
                    cursor: 'pointer',
                    borderLeft: isSelected ? '2px solid var(--mint-2)' : '2px solid transparent',
                    transition: 'background 0.1s',
                    userSelect: 'none' as const,
                  }}>
                  <span style={{ color: 'var(--ink-3)', fontSize: 13, cursor: 'grab', flexShrink: 0, lineHeight: 1 }}>⠿</span>
                  <span style={{ width: 16, height: 16, flexShrink: 0, color: isSelected ? 'var(--mint-2)' : 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {el.type === 'text' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>}
                    {el.type === 'image' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
                    {el.type === 'rect' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>}
                    {el.type === 'circle' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/></svg>}
                  </span>
                  <span style={{ flex: 1, fontSize: 11.5, color: isSelected ? 'var(--ink)' : 'var(--ink-2)', fontFamily: 'var(--sans)', fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                    {layerName(el)}
                  </span>
                  <button onClick={e => { e.stopPropagation(); moveUp(actualIdx); }} disabled={actualIdx >= elements.length - 1}
                    style={{ width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: actualIdx >= elements.length - 1 ? 0.2 : 0.6 }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button onClick={e => { e.stopPropagation(); moveDown(actualIdx); }} disabled={actualIdx <= 0}
                    style={{ width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: actualIdx <= 0 ? 0.2 : 0.6 }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Element properties */}
          {selectedEl && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800 }}>
                  {selectedEl.type === 'text' ? 'Texte' : selectedEl.type === 'image' ? ((selectedEl as ImageEl).src === PHOTO_PLACEHOLDER_SRC ? 'Zone photo' : 'Image') : 'Forme'}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={bringForward} title="Avancer" style={smallBtnStyle}>↑</button>
                  <button onClick={sendBackward} title="Reculer" style={smallBtnStyle}>↓</button>
                </div>
              </div>
              {selectedEl.type === 'text' && (
                <TextProperties el={selectedEl as TextEl} onChange={u => updateEl(selectedEl.id, u)} brandColors={brandColors} />
              )}
              {(selectedEl.type === 'rect' || selectedEl.type === 'circle' || selectedEl.type === 'star') && (
                <ShapeProperties el={selectedEl as RectEl | CircleEl | StarEl} onChange={u => updateEl(selectedEl.id, u)} brandColors={brandColors} />
              )}
              {selectedEl.type === 'image' && (
                <PropRow label={`Opacité — ${selectedEl.opacity}%`}>
                  <input type="range" min={0} max={100} value={selectedEl.opacity} onChange={e => updateEl(selectedEl.id, { opacity: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
                </PropRow>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                <button onClick={() => duplicateEl()} style={{ flex: 1, padding: '7px 6px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', cursor: 'pointer', fontSize: 12, background: 'var(--sunk)', color: 'var(--ink-2)', fontFamily: 'var(--sans)' }}>Dupliquer</button>
                <button onClick={() => deleteEl(selectedId)} style={{ flex: 1, padding: '7px 6px', border: '1px solid rgba(200,115,43,.3)', borderRadius: 'var(--r-s)', cursor: 'pointer', fontSize: 12, background: 'var(--sunk)', color: 'var(--warn)', fontFamily: 'var(--sans)' }}>Supprimer</button>
              </div>
            </div>
          )}

          {/* Tool panel content */}

          {/* FOND */}
          {tool === 'media' && !selectedEl && (
            <div style={{ padding: '14px 16px' }}>
              <SectionLabel>Arrière-plan</SectionLabel>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {(['gradient', 'solid'] as const).map(type => (
                  <button key={type} onClick={() => setBgStyle(b => ({ ...b, type }))}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 'var(--r-s)', border: `1px solid ${bgStyle.type === type ? 'var(--mint)' : 'var(--line)'}`, background: bgStyle.type === type ? 'var(--mint-soft)' : 'var(--sunk)', color: bgStyle.type === type ? 'var(--mint-2)' : 'var(--ink-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {type === 'gradient' ? 'Dégradé' : 'Uni'}
                  </button>
                ))}
              </div>
              {bgStyle.type === 'solid' ? (
                <ColorRow label="Couleur" value={bgStyle.color ?? '#000000'} onChange={v => setBgStyle(b => ({ ...b, color: v }))} brandColors={brandColors} />
              ) : (
                <>
                  <ColorRow label="Couleur départ" value={bgStyle.colorFrom ?? primaryColor} onChange={v => setBgStyle(b => ({ ...b, colorFrom: v }))} brandColors={brandColors} />
                  <ColorRow label="Couleur fin" value={bgStyle.colorTo ?? secondaryColor} onChange={v => setBgStyle(b => ({ ...b, colorTo: v }))} brandColors={brandColors} />
                  <PropRow label={`Angle — ${bgStyle.angle ?? 135}°`}>
                    <input type="range" min={0} max={360} value={bgStyle.angle ?? 135}
                      onChange={e => setBgStyle(b => ({ ...b, angle: Number(e.target.value) }))} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
                  </PropRow>
                </>
              )}
              {/* Photo placeholder */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 4 }}>
                <SectionLabel>Zone photo</SectionLabel>
                <button onClick={addPhotoPlaceholder}
                  disabled={elements.some(e => e.type === 'image' && (e as ImageEl).src === PHOTO_PLACEHOLDER_SRC)}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px dashed var(--line)', borderRadius: 'var(--r)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, opacity: elements.some(e => e.type === 'image' && (e as ImageEl).src === PHOTO_PLACEHOLDER_SRC) ? 0.4 : 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  {elements.some(e => e.type === 'image' && (e as ImageEl).src === PHOTO_PLACEHOLDER_SRC) ? 'Zone photo déjà présente' : '+ Ajouter une zone photo'}
                </button>
              </div>
            </div>
          )}

          {/* TEXTE */}
          {tool === 'text' && !selectedEl && (
            <div style={{ padding: '14px 16px' }}>
              <SectionLabel>Ajouter un bloc de texte</SectionLabel>
              <button onClick={() => addText()} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', background: 'var(--sunk)', cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--sans)', textAlign: 'left' as const, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                Texte libre
              </button>
              <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '0 0 8px' }}>Par rôle IA</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {TEXT_ROLES.filter(r => r.value).map(r => (
                  <button key={r.value} onClick={() => addText(r.value)}
                    style={{ padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', background: 'var(--sunk)', cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--sans)', textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--mint-2)', flexShrink: 0 }} />
                    {r.label}
                    <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--mint-2)', fontFamily: 'var(--mono)', fontWeight: 700, background: 'var(--mint-soft)', padding: '2px 5px', borderRadius: 4 }}>IA</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CHARTE */}
          {tool === 'brand' && !selectedEl && (
            <div style={{ padding: '14px 16px' }}>
              <SectionLabel>Assets de marque</SectionLabel>
              {logoUrl ? (
                <button onClick={addLogoEl}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px dashed var(--line)', borderRadius: 'var(--r)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="logo" style={{ width: 28, height: 28, objectFit: 'contain', background: 'var(--sunk)', borderRadius: 4, padding: 2 }} />
                  + Placer le logo sur le canvas
                </button>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>Aucun logo configuré pour ce client.</p>
              )}
            </div>
          )}

          {/* FORMES */}
          {tool === 'shapes' && !selectedEl && (
            <div style={{ padding: '14px 16px' }}>
              <SectionLabel>Formes</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Rectangle', fn: addRect, icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
                  { label: 'Cercle', fn: addCircle, icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg> },
                ].map(s => (
                  <button key={s.label} onClick={s.fn}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', background: 'var(--sunk)', cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--sans)', textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Mini CSS preview (no canvas, used in grids) ──────────────────────────────

export function MiniTemplatePreview({ bg, name, formatId, zonesCount }: {
  bg: BgStyle; name: string; formatId: string; zonesCount: number;
}) {
  const fmt = FORMATS.find(f => f.id === formatId) ?? FORMATS[0];
  const gradient = bg.type === 'solid'
    ? (bg.color ?? '#000')
    : `linear-gradient(${bg.angle ?? 135}deg, ${bg.colorFrom ?? '#0038FF'}, ${bg.colorTo ?? '#fff'})`;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--cream-4)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ paddingTop: `${(fmt.h / fmt.w) * 100}%`, position: 'relative', background: gradient }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', justifyContent: 'flex-end' }}>
          <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.7)', width: '70%' }} />
          <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.4)', width: '50%' }} />
        </div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: 'var(--cream)', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
        <p style={{ margin: 0, fontSize: 10, color: 'var(--cream-3)' }}>{fmt.label} · {zonesCount} élément{zonesCount !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}
