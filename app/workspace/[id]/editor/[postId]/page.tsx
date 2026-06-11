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
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ColorPicker from '@/components/ColorPicker';
import SelectionOverlay from '@/components/SelectionOverlay';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Slide {
  id: string;
  elements: CanvasEl[];
  proxyUrl: string;
  thumbnail?: string;
}

interface BaseEl { id: string; x: number; y: number; rotation: number; opacity: number; }
interface TextEl extends BaseEl {
  type: 'text'; text: string; fontSize: number; fontFamily: string; fontStyle: string;
  textDecoration: string; fill: string; align: string; width: number;
  hasBg: boolean; bgColor: string; bgOpacity: number; cornerRadius: number;
  padding: number; paddingH: number; paddingV: number;
}
interface RectEl extends BaseEl { type: 'rect'; width: number; height: number; fill: string; stroke: string; strokeWidth: number; cornerRadius: number; }
interface CircleEl extends BaseEl { type: 'circle'; radius: number; fill: string; stroke: string; strokeWidth: number; }
interface StarEl extends BaseEl { type: 'star'; numPoints: number; innerRadius: number; outerRadius: number; fill: string; stroke: string; strokeWidth: number; }
interface ImageEl extends BaseEl { type: 'image'; src: string; width: number; height: number; cropX?: number; cropY?: number; naturalW?: number; naturalH?: number; }
type CanvasEl = TextEl | RectEl | CircleEl | StarEl | ImageEl;

// ─── Constants ────────────────────────────────────────────────────────────────

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

function BgImage({ src, w, h }: { src: string; w: number; h: number }) {
  const [img] = useImage(src, 'anonymous');
  return img ? <KonvaImage image={img} x={0} y={0} width={w} height={h} listening={false} /> : null;
}

function ImgNode({ el, onSelect, onChange, onDragStart, onDragEnd, isCropping }: {
  el: ImageEl; onSelect: () => void; onChange: (u: Partial<ImageEl>) => void;
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
      onClick={onSelect} onTap={onSelect}
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
              {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
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

function layerName(el: CanvasEl): string {
  if (el.type === 'text') return el.text.slice(0, 18) || 'Texte';
  if (el.type === 'image') return 'Image';
  if (el.type === 'rect') return 'Rectangle';
  if (el.type === 'circle') return 'Cercle';
  if (el.type === 'star') return 'Étoile';
  return 'Élément';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditorPage({ params }: { params: { id: string; postId: string } }) {
  const workspaceId = params.id;
  const postId = params.postId;

  const supabase = createClientComponentClient();
  const stageRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isKonvaDragging, setIsKonvaDragging] = useState(false);
  const [cropId, setCropId] = useState<string | null>(null);

  const [proxyUrl, setProxyUrl] = useState<string>('');
  const [bgImage] = useImage(proxyUrl, 'anonymous');
  const [formatId, setFormatId] = useState('ig-portrait');
  const activeFormat = FORMATS.find(f => f.id === formatId) ?? FORMATS[0];
  const stageW = activeFormat.w;
  const stageH = activeFormat.h;
  const [elements, setElements] = useState<CanvasEl[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const elementsRef = useRef<CanvasEl[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // ── Carousel slides ───────────────────────────────────────────────────────
  const [slides, setSlides] = useState<Slide[]>([{ id: 'slide-1', elements: [], proxyUrl: '' }]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const slidesRef = useRef<Slide[]>(slides);
  const proxyUrlRef = useRef<string>('');
  useEffect(() => { slidesRef.current = slides; }, [slides]);
  useEffect(() => { proxyUrlRef.current = proxyUrl; }, [proxyUrl]);

  // ── Carousel: save current slide state into slidesRef ────────────────────
  const saveCurrentSlide = () => {
    const updated = slidesRef.current.map((s, i) =>
      i === activeSlideIdx ? { ...s, elements: elementsRef.current, proxyUrl: proxyUrlRef.current } : s
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
    setActiveSlideIdx(idx);
    setSelectedId(null);
    setCropId(null);
    historyRef.current = [next.elements];
    histIdxRef.current = 0;
    setHistTick(t => t + 1);
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
  const [customFonts, setCustomFonts] = useState<{ name: string; url: string }[]>([]);
  const [brandFontNames, setBrandFontNames] = useState<string[]>([]);

  // ── UI tool + workspace ───────────────────────────────────────────────────
  const [tool, setTool] = useState<'media'|'text'|'brand'|'stickers'|'shapes'>('media');
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
        const bgUrl = p?.photo_url ? `/api/proxy-image?url=${encodeURIComponent(p.photo_url)}` : '';
        let initSlides: Slide[];
        if (p?.editor_json) {
          try {
            const parsed = JSON.parse(p.editor_json);
            if (parsed && parsed.version === 2 && Array.isArray(parsed.slides)) {
              initSlides = parsed.slides;
            } else {
              // v1: flat elements array
              const els = Array.isArray(parsed) ? parsed : [defaultEl];
              initSlides = [{ id: 'slide-1', elements: els, proxyUrl: bgUrl }];
            }
          } catch { initSlides = [{ id: 'slide-1', elements: [defaultEl], proxyUrl: bgUrl }]; }
        } else {
          initSlides = [{ id: 'slide-1', elements: [defaultEl], proxyUrl: bgUrl }];
        }
        setSlides(initSlides);
        slidesRef.current = initSlides;
        const first = initSlides[0];
        setElements(first.elements);
        setProxyUrl(first.proxyUrl);
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

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addImageEl(URL.createObjectURL(file));
    e.target.value = '';
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
    await new Promise(resolve => setTimeout(resolve, 200));
    const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
    const blob = await fetch(dataURL).then(r => r.blob());
    const fileName = `${workspaceId}/${postId}-${Date.now()}.png`;
    await supabase.storage.from('exports').upload(fileName, blob, { contentType: 'image/png', upsert: true });
    const { data: urlData } = supabase.storage.from('exports').getPublicUrl(fileName);
    const textEl = elements.find(e => e.type === 'text') as TextEl | undefined;
    // Build v2 JSON: save current slide state into all slides
    const allSlides = slidesRef.current.map((s, i) =>
      i === activeSlideIdx ? { ...s, elements: elementsRef.current, proxyUrl: proxyUrlRef.current } : s
    );
    await supabase.from('posts').update({
      status: 'validated',
      exported_image_url: urlData?.publicUrl || '',
      editor_json: JSON.stringify({ version: 2, slides: allSlides }),
      texte_visuel: textEl?.text || '',
    }).eq('id', postId);
    window.location.href = `/workspace/${workspaceId}/planning`;
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

  // ── AI generation ─────────────────────────────────────────────────────────

  const generateAI = async (tone: string) => {
    if (aiTimerRef.current) clearInterval(aiTimerRef.current);
    setAiTyping(true); setAiCaption('');
    try {
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
        }),
      });
      const data = await res.json();
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'var(--sans)', background: 'var(--canvas)' }}>

      {/* ── TOPBAR ── */}
      <div style={{ height: 52, background: 'var(--forest)', borderBottom: '1px solid rgba(238,237,227,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0, zIndex: 10 }}>
        {/* Left: back + client + format */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <a href={`/workspace/${workspaceId}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, boxShadow: 'inset 0 0 0 1px rgba(238,237,227,.2)', color: 'var(--cream-2)', textDecoration: 'none', fontSize: 14, flexShrink: 0 }}>←</a>
          <button onClick={deletePost} title="Supprimer ce post"
            style={{ width: 30, height: 30, borderRadius: 7, boxShadow: 'inset 0 0 0 1px rgba(255,80,80,.25)', background: 'transparent', color: 'rgba(255,120,120,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>
          </button>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--mint)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 11, color: '#06281C', letterSpacing: '-0.02em' }}>
              {workspaceName ? workspaceName.slice(0,2).toUpperCase() : 'KL'}
            </span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--cream)', fontFamily: 'var(--sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{workspaceName || 'Éditeur'}</span>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--cream-2)', background: 'rgba(238,237,227,.1)', padding: '3px 8px', borderRadius: 5, flexShrink: 0 }}>
            Post · {activeFormat.label}{slides.length > 1 ? ` · ${slides.length} slides` : ''}
          </span>
        </div>

        {/* Center: aperçu + dupliquer */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(238,237,227,.22)', color: 'var(--cream-2)' }}>
            Aperçu
          </button>
          <button className="btn btn-sm" style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(238,237,227,.22)', color: 'var(--cream-2)' }}>
            Dupliquer
          </button>
        </div>

        {/* Right: undo/redo + export + save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={undo} disabled={!canUndo} title="Annuler Ctrl+Z"
            style={{ width: 30, height: 30, background: 'transparent', border: 'none', borderRadius: 6, cursor: canUndo ? 'pointer' : 'default', fontSize: 15, color: 'rgba(238,237,227,.45)', opacity: canUndo ? 1 : 0.3, display: 'grid', placeItems: 'center' }}>↩</button>
          <button onClick={redo} disabled={!canRedo} title="Rétablir"
            style={{ width: 30, height: 30, background: 'transparent', border: 'none', borderRadius: 6, cursor: canRedo ? 'pointer' : 'default', fontSize: 15, color: 'rgba(238,237,227,.45)', opacity: canRedo ? 1 : 0.3, display: 'grid', placeItems: 'center' }}>↪</button>
          <div style={{ width: 1, height: 20, background: 'rgba(238,237,227,.1)', margin: '0 4px' }} />
          <button onClick={exportPNG} className="btn btn-sm"
            style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(238,237,227,.22)', color: 'var(--cream-2)' }}>
            Exporter PNG
          </button>
          <button onClick={handleSave} disabled={saving} className="btn btn-sm btn-primary"
            style={{ opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder →'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT SIDEBAR — tool rail ── */}
        <div style={{ width: 68, background: 'var(--canvas)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, gap: 2, flexShrink: 0 }}>
          {([
            { id: 'media',    label: 'Média',    icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            )},
            { id: 'text',     label: 'Texte',    icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
            )},
            { id: 'brand',    label: 'Charte',   icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="17" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M13.5 9L6.5 14.5M13.5 9L19 14.5"/></svg>
            )},
            { id: 'stickers', label: 'Stickers', icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            )},
            { id: 'shapes',   label: 'Formes',   icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><circle cx="17" cy="7" r="4"/><polygon points="12 21 3 15 21 15 12 21"/></svg>
            )},
          ] as { id: 'media'|'text'|'brand'|'stickers'|'shapes'; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
            <button key={id} onClick={() => setTool(id)} title={label}
              style={{ width: 50, padding: '9px 4px', borderRadius: 12, border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', transition: 'all .14s',
                background: tool === id ? 'var(--mint-soft)' : 'transparent',
                color: tool === id ? 'var(--mint-2)' : 'var(--ink-3)' }}>
              {icon}
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 8, letterSpacing: '.06em', textTransform: 'uppercase', lineHeight: 1 }}>{label}</span>
            </button>
          ))}

          {/* Format selector at bottom */}
          <div style={{ marginTop: 'auto', paddingBottom: 12, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-3)', marginBottom: 2 }}>Format</span>
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

        {/* ── CANVAS ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden', background: 'var(--sunk)' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 28 }}>
            <div style={{ borderRadius: 18, overflow: 'hidden', boxShadow: '0 22px 50px -24px rgba(13,15,10,.45)', flexShrink: 0, position: 'relative' }}>
            <Stage
              ref={stageRef}
              width={stageW} height={stageH}
              onMouseDown={e => { if (e.target === e.target.getStage()) { if (cropId) { setCropId(null); } else { setSelectedId(null); } } }}
              style={{ display: 'block' }}
            >
              <Layer>
                <Rect x={0} y={0} width={stageW} height={stageH} fill="white" listening={false} />
                {proxyUrl && <BgImage src={proxyUrl} w={stageW} h={stageH} />}

                {elements.map(el => {
                  if (hiddenIds.has(el.id)) return null;
                  if (el.type === 'image') return (
                    <ImgNode key={el.id} el={el} onSelect={() => setSelectedId(el.id)} onChange={u => updateEl(el.id, u)}
                      onDragStart={() => setIsKonvaDragging(true)}
                      onDragEnd={(x, y) => { setIsKonvaDragging(false); updateEl(el.id, { x, y }); }}
                      isCropping={cropId === el.id} />
                  );
                  if (el.type === 'rect') return (
                    <Rect key={el.id} id={el.id} x={el.x} y={el.y} width={el.width} height={el.height}
                      fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth}
                      cornerRadius={el.cornerRadius} rotation={el.rotation} opacity={el.opacity / 100} draggable
                      onClick={() => setSelectedId(el.id)} onTap={() => setSelectedId(el.id)}
                      onDragStart={() => setIsKonvaDragging(true)}
                      onDragEnd={e => { setIsKonvaDragging(false); updateEl(el.id, { x: e.target.x(), y: e.target.y() }); }} />
                  );
                  if (el.type === 'circle') return (
                    <Circle key={el.id} id={el.id} x={el.x} y={el.y} radius={el.radius}
                      fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth}
                      rotation={el.rotation} opacity={el.opacity / 100} draggable
                      onClick={() => setSelectedId(el.id)} onTap={() => setSelectedId(el.id)}
                      onDragStart={() => setIsKonvaDragging(true)}
                      onDragEnd={e => { setIsKonvaDragging(false); updateEl(el.id, { x: e.target.x(), y: e.target.y() }); }} />
                  );
                  if (el.type === 'star') return (
                    <KonvaStar key={el.id} id={el.id} x={el.x} y={el.y} numPoints={el.numPoints}
                      innerRadius={el.innerRadius} outerRadius={el.outerRadius}
                      fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth}
                      rotation={el.rotation} opacity={el.opacity / 100} draggable
                      onClick={() => setSelectedId(el.id)} onTap={() => setSelectedId(el.id)}
                      onDragStart={() => setIsKonvaDragging(true)}
                      onDragEnd={e => { setIsKonvaDragging(false); updateEl(el.id, { x: e.target.x(), y: e.target.y() }); }} />
                  );
                  if (el.type === 'text') {
                    const pH = el.paddingH ?? el.padding;
                    const pV = el.paddingV ?? el.padding;
                    const measuredW = measureTextWidth(el.text, el.fontSize, el.fontFamily, el.fontStyle);
                    const blockW = Math.min(Math.max(measuredW + pH * 2, 80), stageW - 40);
                    const blockH = el.fontSize + pV * 2;
                    return (
                      <Group key={el.id} id={el.id} x={el.x} y={el.y} rotation={el.rotation} opacity={el.opacity / 100}
                        draggable
                        onClick={() => setSelectedId(el.id)} onTap={() => setSelectedId(el.id)}
                        onDragStart={() => setIsKonvaDragging(true)}
                        onDragEnd={e => { setIsKonvaDragging(false); updateEl(el.id, { x: e.target.x(), y: e.target.y() }); }}>
                        {el.hasBg && <Rect x={0} y={0} width={blockW} height={blockH} fill={el.bgColor} opacity={el.bgOpacity / 100} cornerRadius={el.cornerRadius} />}
                        <Text x={pH} y={pV} width={measuredW} text={el.text}
                          fontSize={el.fontSize} fontFamily={el.fontFamily}
                          fontStyle={el.fontStyle} textDecoration={el.textDecoration}
                          fill={el.fill} align={el.align} listening={false} />
                      </Group>
                    );
                  }
                  return null;
                })}

              </Layer>
            </Stage>
            {selectedEl && !hiddenIds.has(selectedEl.id) && !isKonvaDragging && cropId !== selectedEl.id && (
              <SelectionOverlay
                el={selectedEl}
                stageRef={stageRef}
                onChange={u => updateEl(selectedEl.id, u)}
              />
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
          </div>

          {/* ── SLIDE STRIP ── */}
          <div style={{
            height: 88, flexShrink: 0,
            background: 'var(--canvas)', borderTop: '1px solid var(--line)',
            display: 'flex', alignItems: 'center',
            padding: '0 20px', gap: 8,
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
                    }}
                  >
                    <span style={{
                      fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12,
                      color: isActive ? 'var(--mint-2)' : 'var(--ink-3)',
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

        {/* ── RIGHT PANEL (always visible) ── */}
        <div style={{ width: 300, background: 'var(--white)', borderLeft: '1px solid var(--line)', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

          {/* ── LAYERS PANEL ── */}
          <div style={{ borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
            <div style={{ padding: '8px 12px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800 }}>Calques</span>
              <span style={{ fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{elements.length + (proxyUrl ? 1 : 0)}</span>
            </div>
            {[...elements].reverse().map((el, reversedIdx) => {
              const actualIdx = elements.length - 1 - reversedIdx;
              const isSelected = el.id === selectedId;
              const isHidden = hiddenIds.has(el.id);
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
                    opacity: isHidden ? 0.45 : 1,
                    borderLeft: isSelected ? '2px solid var(--mint-2)' : '2px solid transparent',
                    transition: 'background 0.1s',
                    userSelect: 'none' as const,
                  }}
                >
                  <span style={{ color: 'var(--ink-3)', fontSize: 13, cursor: 'grab', flexShrink: 0, lineHeight: 1 }}>⠿</span>
                  <span style={{ width: 16, height: 16, flexShrink: 0, color: isSelected ? 'var(--mint-2)' : 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {el.type === 'text' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>}
                    {el.type === 'image' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
                    {el.type === 'rect' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>}
                    {el.type === 'circle' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/></svg>}
                    {el.type === 'star' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
                  </span>
                  <span style={{ flex: 1, fontSize: 11.5, color: isSelected ? 'var(--ink)' : 'var(--ink-2)', fontFamily: 'var(--sans)', fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {layerName(el)}
                  </span>
                  <button onClick={e => { e.stopPropagation(); moveUp(actualIdx); }}
                    disabled={actualIdx >= elements.length - 1}
                    style={{ width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: actualIdx >= elements.length - 1 ? 0.2 : 0.6 }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button onClick={e => { e.stopPropagation(); moveDown(actualIdx); }}
                    disabled={actualIdx <= 0}
                    style={{ width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: actualIdx <= 0 ? 0.2 : 0.6 }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  <button onClick={e => { e.stopPropagation(); toggleHidden(el.id); }}
                    title={isHidden ? 'Afficher' : 'Masquer'}
                    style={{ width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: isHidden ? 0.4 : 0.6 }}>
                    {isHidden
                      ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              );
            })}
            {proxyUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 8px', opacity: 0.4, borderLeft: '2px solid transparent' }}>
                <span style={{ color: 'var(--ink-3)', fontSize: 13, flexShrink: 0, lineHeight: 1 }}>⠿</span>
                <span style={{ width: 16, height: 16, flexShrink: 0, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </span>
                <span style={{ flex: 1, fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Fond</span>
              </div>
            )}
          </div>

          {/* ── Element properties (when selected) ── */}
          {selectedEl && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800 }}>
                  {selectedEl.type === 'text' ? 'Texte' : selectedEl.type === 'image' ? 'Image' : 'Forme'}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={bringForward} title="Avancer" style={smallBtnStyle}>↑</button>
                  <button onClick={sendBackward} title="Reculer" style={smallBtnStyle}>↓</button>
                </div>
              </div>
              {selectedEl.type === 'text' && <TextProperties el={selectedEl} onChange={u => updateEl(selectedEl.id, u)} customFonts={customFonts} onFontUpload={handleFontUpload} brandFontNames={brandFontNames} brandColors={[workspaceData?.primary_color, workspaceData?.secondary_color, workspaceData?.accent_color].filter(Boolean) as string[]} />}
              {(selectedEl.type === 'rect' || selectedEl.type === 'circle' || selectedEl.type === 'star') && (
                <ShapeProperties el={selectedEl} onChange={u => updateEl(selectedEl.id, u)} brandColors={[workspaceData?.primary_color, workspaceData?.secondary_color, workspaceData?.accent_color].filter(Boolean) as string[]} />
              )}
              {selectedEl.type === 'image' && (
                <ImageProperties el={selectedEl} onChange={u => updateEl(selectedEl.id, u)} onSetBg={() => setProxyUrl(selectedEl.src)} onCrop={() => setCropId(selectedEl.id)} />
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                <button onClick={() => duplicateEl()} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>Dupliquer</button>
                <button onClick={() => deleteEl(selectedId)} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center', color: 'var(--warn)', borderColor: 'rgba(200,115,43,.3)' }}>Supprimer</button>
              </div>
            </div>
          )}

          {/* ── Tool panel content ── */}
          {tool === 'media' && !selectedEl && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, marginBottom: 10 }}>Arrière-plan</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9, marginBottom: 12 }}>
                {['linear-gradient(150deg,#2b8d57,#0c2a1d)','linear-gradient(150deg,#2FD79B,#06281C)','linear-gradient(150deg,#F5F0E8,#c9c4b2)','linear-gradient(150deg,#111111,#333)','linear-gradient(150deg,#0038FF,#001a80)','linear-gradient(150deg,#FF6B6B,#c0392b)'].map((g, i) => (
                  <button key={i} onClick={() => setProxyUrl('')}
                    style={{ aspectRatio: '4/5', borderRadius: 'var(--r)', background: g, border: 'none', cursor: 'pointer', transition: 'all .12s', boxShadow: proxyUrl === '' ? '0 0 0 2.5px var(--mint-2)' : 'inset 0 0 0 1px var(--line)' }} />
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1.5px dashed var(--line)', borderRadius: 'var(--r)', padding: '12px 14px', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13, fontWeight: 600 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Importer une photo
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
              </label>
              {/* Unsplash */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input value={unsplashQuery} onChange={e => setUnsplashQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchUnsplash(unsplashQuery)}
                    placeholder="Chercher une photo…"
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 12, outline: 'none', fontFamily: 'var(--sans)', background: 'var(--sunk)', color: 'var(--ink)' }} />
                  <button onClick={() => fetchUnsplash(unsplashQuery)}
                    style={{ padding: '7px 10px', background: 'var(--mint)', color: 'var(--mint-ink)', border: 'none', borderRadius: 'var(--r-s)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>→</button>
                </div>
                {unsplashLoading ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '8px 0' }}>Chargement…</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 8 }}>
                    {unsplashPhotos.slice(0, 9).map((src, i) => (
                      <UnsplashThumb key={i} src={src}
                        onAdd={() => addImageEl(`/api/proxy-image?url=${encodeURIComponent(src)}`)}
                        onBg={() => { setProxyUrl(`/api/proxy-image?url=${encodeURIComponent(src)}`); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tool === 'text' && !selectedEl && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, marginBottom: 10 }}>Ajouter</p>
              <button onClick={addText} className="btn btn-ghost btn-sm"
                style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start', marginBottom: 8 }}>
                T  Nouveau texte
              </button>
              <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '12px 0 8px' }}>Templates</p>
              {TEMPLATES.map(t => (
                <button key={t.label} onClick={() => applyTemplate(t.overrides as Partial<TextEl>)} className="well"
                  style={{ width: '100%', padding: '9px 12px', cursor: 'pointer', fontSize: 12, textAlign: 'left', color: 'var(--ink-2)', fontFamily: 'var(--sans)', marginBottom: 6, display: 'block' }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {tool === 'shapes' && !selectedEl && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, marginBottom: 10 }}>Formes</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[{ label: '▭  Rectangle', fn: addRect },{ label: '⬭  Cercle', fn: addCircle },{ label: '⭐  Étoile', fn: addStar }].map(({ label, fn }) => (
                  <button key={label} onClick={fn} className="well"
                    style={{ padding: '10px 6px', cursor: 'pointer', fontSize: 12, textAlign: 'center', color: 'var(--ink-2)', fontFamily: 'var(--sans)' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool === 'stickers' && !selectedEl && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, marginBottom: 10 }}>Stickers</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                {['↗','✦','★','●','→','NEW','%','♥','✓','🔥','⚡','♻'].map((s, i) => (
                  <button key={i} className="well"
                    style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 18, fontFamily: 'var(--display)', fontWeight: 800 }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool === 'brand' && !selectedEl && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', overflowY: 'auto' }}>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, marginBottom: 14 }}>
                Charte · {workspaceName}
              </p>

              {/* ── Couleurs ── */}
              <SectionLabel>Couleurs</SectionLabel>
              <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
                {[workspaceData?.primary_color || '#0038FF', workspaceData?.secondary_color || '#FFFFFF', workspaceData?.accent_color].filter(Boolean).map((col, i) => (
                  <div key={i} style={{ flex: 1, cursor: 'pointer' }} title={`Copier ${col}`}
                    onClick={() => { try { navigator.clipboard.writeText(col!); } catch {} }}>
                    <div style={{ height: 36, borderRadius: 6, background: col!, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} />
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-3)', marginTop: 3, textAlign: 'center', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</div>
                  </div>
                ))}
              </div>

              {/* ── Typographie ── */}
              {brandFontNames.length > 0 && (
                <>
                  <SectionLabel>Typographie</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {brandFontNames.map((font, i) => (
                      <div key={font} title="Ajouter un texte avec cette police"
                        onClick={() => {
                          const el: TextEl = {
                            id: newId(), type: 'text', x: 30, y: 60 + i * 60, rotation: 0, opacity: 100,
                            text: font, fontSize: 26, fontFamily: font, fontStyle: 'bold', textDecoration: '',
                            fill: workspaceData?.primary_color || '#000000', align: 'left', width: 260,
                            hasBg: false, bgColor: '#000000', bgOpacity: 80, cornerRadius: 4, padding: 12, paddingH: 12, paddingV: 8,
                          };
                          applyElements([...elements, el]);
                          setSelectedId(el.id);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: 'var(--sunk)', cursor: 'pointer', border: '1px solid var(--line)', transition: 'border-color .12s' }}>
                        <span style={{ fontFamily: `"${font}", sans-serif`, fontSize: 22, color: 'var(--ink)', lineHeight: 1, minWidth: 28, textAlign: 'center' }}>Aa</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{font}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── Logo ── */}
              {(workspaceData?.logo_url || workspaceData?.logo_dark_url) && (
                <>
                  <SectionLabel>Logo</SectionLabel>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {workspaceData?.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={workspaceData.logo_url} alt="Logo" title="Ajouter au canvas"
                        style={{ height: 38, maxWidth: 90, objectFit: 'contain', cursor: 'pointer', borderRadius: 5, background: 'var(--white)', padding: 4, border: '1px solid var(--line)' }}
                        onClick={() => addLogoEl(workspaceData.logo_url!)} />
                    )}
                    {workspaceData?.logo_dark_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={workspaceData.logo_dark_url} alt="Logo variante" title="Ajouter au canvas (variante sombre)"
                        style={{ height: 38, maxWidth: 90, objectFit: 'contain', cursor: 'pointer', borderRadius: 5, background: '#1A1A1A', padding: 4, border: '1px solid var(--line)' }}
                        onClick={() => addLogoEl(workspaceData.logo_dark_url!)} />
                    )}
                  </div>
                </>
              )}

              {/* ── Assets de marque ── */}
              {workspaceData?.brand_assets && workspaceData.brand_assets.length > 0 && (
                <>
                  <SectionLabel>Assets de marque</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                    {workspaceData.brand_assets.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="" title="Ajouter au canvas"
                        style={{ aspectRatio: '1', objectFit: 'contain', borderRadius: 6, background: 'var(--sunk)', padding: 4, border: '1px solid var(--line)', cursor: 'pointer', width: '100%', display: 'block' }}
                        onClick={() => addImageEl(url)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Scrollable bottom: AI + Planifier ── */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* DESCRIPTION IA */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', background: 'var(--canvas)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--mint)', color: 'var(--mint-ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                </span>
                <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'var(--sans)' }}>Description IA</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--mint-2)', fontFamily: 'var(--mono)', background: 'var(--mint-soft)', padding: '2px 8px', borderRadius: 5, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workspaceName || '—'}</span>
              </div>
              <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
                {(['Chic','Punchy','Minimal','Doux'] as const).map(t => (
                  <button key={t} onClick={() => setAiTone(t)}
                    style={{ padding: '6px 10px', borderRadius: 99, fontWeight: 700, fontSize: 11.5, fontFamily: 'var(--sans)', cursor: 'pointer', transition: 'all .14s',
                      background: aiTone === t ? 'var(--ink)' : 'var(--white)',
                      color: aiTone === t ? 'var(--paper)' : 'var(--ink-2)',
                      boxShadow: aiTone === t ? 'none' : 'inset 0 0 0 1px var(--line)' }}>
                    {t}
                  </button>
                ))}
              </div>
              <button onClick={() => generateAI(aiTone)} className="btn btn-primary"
                style={{ width: '100%', marginBottom: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                {aiCaption ? 'Régénérer' : 'Générer la description'}
              </button>
              <div className="input" style={{ minHeight: 72, fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-line', color: aiCaption ? 'var(--ink)' : 'var(--ink-3)' }}>
                {aiCaption
                  ? <>{aiCaption}<span style={{ opacity: aiTyping ? 1 : 0, color: 'var(--mint-2)' }}>▍</span></>
                  : 'La description générée apparaîtra ici, calée sur la voix de la marque.'}
              </div>
            </div>

            {/* PLANIFIER */}
            <div style={{ padding: '14px 16px', background: 'var(--canvas)' }}>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, marginBottom: 10 }}>Planifier</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
                {SCHED_DAYS.map((d, i) => {
                  const sel = schedDay === i;
                  const best = i === 2 || i === 4;
                  return (
                    <button key={d} onClick={() => setSchedDay(sel ? null : i)}
                      style={{ padding: '6px 2px', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative', cursor: 'pointer', transition: 'all .12s',
                        background: sel ? 'var(--mint)' : 'var(--white)',
                        color: sel ? 'var(--mint-ink)' : 'var(--ink)',
                        boxShadow: sel ? 'none' : 'inset 0 0 0 1px var(--line)' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 8.5 }}>{d}</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{9 + i}</span>
                      {best && !sel && <span style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: '50%', background: 'var(--mint-2)' }} />}
                    </button>
                  );
                })}
              </div>
              {schedDay !== null && (
                <p style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 600, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--mint-2)' }}>●</span> {SCHED_DAYS[schedDay]} {9 + schedDay} · 18:30 — fort engagement
                </p>
              )}
            </div>

          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
    </div>
  );
}
