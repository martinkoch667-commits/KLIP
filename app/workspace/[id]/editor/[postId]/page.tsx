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
  Transformer,
} from 'react-konva';
import useImage from 'use-image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// ─── Types ───────────────────────────────────────────────────────────────────

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
interface ImageEl extends BaseEl { type: 'image'; src: string; width: number; height: number; }
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

function ImgNode({ el, onSelect, onChange }: { el: ImageEl; onSelect: () => void; onChange: (u: Partial<ImageEl>) => void }) {
  const [img] = useImage(el.src, 'anonymous');
  return (
    <KonvaImage id={el.id} image={img} x={el.x} y={el.y} width={el.width} height={el.height}
      rotation={el.rotation} opacity={el.opacity / 100} draggable
      onClick={onSelect} onTap={onSelect}
      onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={e => {
        const node = e.target;
        onChange({ x: node.x(), y: node.y(), width: Math.max(20, node.width() * node.scaleX()), height: Math.max(20, node.height() * node.scaleY()), rotation: node.rotation() });
        node.scaleX(1); node.scaleY(1);
      }}
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

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <PropRow label={label}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px' }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: 28, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'transparent' }} />
        <span style={{ fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--mono)' }}>{value.toUpperCase()}</span>
      </div>
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

function TextProperties({ el, onChange, customFonts, onFontUpload }: { el: TextEl; onChange: (u: Partial<TextEl>) => void; customFonts: { name: string; url: string }[]; onFontUpload: (file: File) => Promise<string>; }) {
  const isBold = el.fontStyle.includes('bold');
  const isItalic = el.fontStyle.includes('italic');
  const isUnderline = el.textDecoration === 'underline';
  const toggleBold = () => onChange({ fontStyle: isItalic ? (isBold ? 'italic' : 'bold italic') : (isBold ? 'normal' : 'bold') });
  const toggleItalic = () => onChange({ fontStyle: isBold ? (isItalic ? 'bold' : 'bold italic') : (isItalic ? 'normal' : 'italic') });
  return (
    <>
      <PropRow label="Contenu">
        <textarea value={el.text} onChange={e => onChange({ text: e.target.value })} rows={3}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--sans)', outline: 'none', background: 'var(--sunk)', color: 'var(--ink)' }} />
      </PropRow>
      <PropRow label="Police">
        <select value={el.fontFamily} onChange={e => onChange({ fontFamily: e.target.value })}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 13, outline: 'none', background: 'var(--sunk)', color: 'var(--ink)' }}>
          {customFonts.length > 0 && (
            <optgroup label="Mes polices">
              {customFonts.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
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
              style={{ flex: 1, padding: '6px', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13, background: active ? 'var(--mint)' : 'var(--sunk)', color: active ? 'var(--mint-ink)' : 'var(--ink-2)' }}>
              {label}
            </button>
          ))}
        </div>
      </PropRow>
      <PropRow label="Alignement">
        <div style={{ display: 'flex', gap: 6 }}>
          {(['left', 'center', 'right'] as const).map(a => (
            <button key={a} onClick={() => onChange({ align: a })}
              style={{ flex: 1, padding: '6px', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer', fontSize: 13, background: el.align === a ? 'var(--mint)' : 'var(--sunk)', color: el.align === a ? 'var(--mint-ink)' : 'var(--ink-2)' }}>
              {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
            </button>
          ))}
        </div>
      </PropRow>
      <ColorRow label="Couleur texte" value={el.fill} onChange={v => onChange({ fill: v })} />
      <div style={{ borderTop: '1px solid #1E1E1E', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--mono)', fontWeight: 800 }}>Fond du bloc</span>
          <div onClick={() => onChange({ hasBg: !el.hasBg })}
            style={{ width: 38, height: 22, borderRadius: 11, background: el.hasBg ? 'var(--mint)' : 'var(--line)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 3, left: el.hasBg ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
          </div>
        </div>
        {el.hasBg && (
          <>
            <ColorRow label="Couleur fond" value={el.bgColor} onChange={v => onChange({ bgColor: v })} />
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

function ShapeProperties({ el, onChange }: { el: RectEl | CircleEl | StarEl; onChange: (u: Partial<typeof el>) => void }) {
  return (
    <>
      <ColorRow label="Couleur" value={el.fill} onChange={v => onChange({ fill: v } as any)} />
      <ColorRow label="Bordure" value={el.stroke || '#000000'} onChange={v => onChange({ stroke: v } as any)} />
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

function ImageProperties({ el, onChange, onSetBg }: { el: ImageEl; onChange: (u: Partial<ImageEl>) => void; onSetBg: () => void }) {
  return (
    <>
      <PropRow label={`Opacité — ${el.opacity}%`}>
        <input type="range" min={0} max={100} value={el.opacity} onChange={e => onChange({ opacity: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
      </PropRow>
      <button onClick={onSetBg}
        style={{ width: '100%', padding: '10px', background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginBottom: 8, color: 'var(--ink-2)', fontFamily: 'var(--sans)' }}>
        Mettre en fond
      </button>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditorPage({ params }: { params: { id: string; postId: string } }) {
  const workspaceId = params.id;
  const postId = params.postId;

  const supabase = createClientComponentClient();
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [proxyUrl, setProxyUrl] = useState<string>('');
  const [bgImage] = useImage(proxyUrl, 'anonymous');
  const [formatId, setFormatId] = useState('ig-portrait');
  const activeFormat = FORMATS.find(f => f.id === formatId) ?? FORMATS[0];
  const stageW = activeFormat.w;
  const stageH = activeFormat.h;
  const [elements, setElements] = useState<CanvasEl[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customFonts, setCustomFonts] = useState<{ name: string; url: string }[]>([]);

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
        if (p?.photo_url) setProxyUrl(`/api/proxy-image?url=${encodeURIComponent(p.photo_url)}`);
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
        let initEls: CanvasEl[];
        if (p?.editor_json) {
          try { initEls = JSON.parse(p.editor_json); } catch { initEls = [defaultEl]; }
        } else {
          initEls = [defaultEl];
        }
        setElements(initEls);
        historyRef.current = [initEls];
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

  // ── Transformer ───────────────────────────────────────────────────────────

  const selectedEl = elements.find(e => e.id === selectedId);

  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    if (selectedId && selectedEl && selectedEl.type !== 'text') {
      const node = stageRef.current.findOne('#' + selectedId);
      if (node) transformerRef.current.nodes([node]);
      else transformerRef.current.nodes([]);
    } else {
      transformerRef.current.nodes([]);
    }
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedId, selectedEl, elements]);

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
    const el: ImageEl = { id: newId(), type: 'image', x: 50, y: 50, rotation: 0, opacity: 100, src, width: 300, height: 200 };
    applyElements([...elements, el]);
    setSelectedId(el.id);
    setShowUnsplash(false);
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
    await supabase.from('posts').update({
      status: 'validated',
      exported_image_url: urlData?.publicUrl || '',
      editor_json: JSON.stringify(elements),
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
      <div style={{ height: 56, background: 'var(--forest)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href={`/workspace/${workspaceId}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', color: 'var(--cream-2)', textDecoration: 'none', fontSize: 14 }}>←</a>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 20, letterSpacing: '-0.04em', color: 'var(--cream)' }}>
            Kl<span style={{ color: 'var(--mint)' }}>ip</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={undo} disabled={!canUndo} title="Annuler Ctrl+Z"
            style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, cursor: canUndo ? 'pointer' : 'not-allowed', fontSize: 13, color: 'var(--cream-2)', fontFamily: 'var(--sans)', opacity: canUndo ? 1 : 0.35 }}>↩ Annuler</button>
          <button onClick={redo} disabled={!canRedo} title="Rétablir"
            style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, cursor: canRedo ? 'pointer' : 'not-allowed', fontSize: 13, color: 'var(--cream-2)', fontFamily: 'var(--sans)', opacity: canRedo ? 1 : 0.35 }}>↪ Rétablir</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportPNG}
            style={{ background: 'var(--acid)', border: 'none', color: '#000', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'var(--mono)' }}>
            Exporter PNG
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '8px 16px', background: 'var(--mint)', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, color: 'var(--mint-ink)', fontFamily: 'var(--mono)', opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder →'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT SIDEBAR ── */}
        <div style={{ width: 260, background: 'var(--white)', borderRight: '1px solid var(--line)', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '16px' }}>

            <SectionLabel>Ajouter</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 20 }}>
              {[
                { label: 'T  Texte',     fn: addText },
                { label: '▭  Rectangle', fn: addRect },
                { label: '⬭  Cercle',    fn: addCircle },
                { label: '⭐  Étoile',    fn: addStar },
                { label: '📷  Image',     fn: () => fileInputRef.current?.click() },
                { label: '🌄  Galerie',   fn: () => setShowUnsplash(v => !v) },
              ].map(({ label, fn }) => (
                <button key={label} onClick={fn}
                  style={{ padding: '10px 6px', background: showUnsplash && label.includes('Galerie') ? 'var(--mint-soft)' : 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer', fontSize: 12, textAlign: 'center', color: showUnsplash && label.includes('Galerie') ? 'var(--mint-2)' : 'var(--ink-2)', fontFamily: 'var(--sans)', transition: 'all 0.15s' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Unsplash panel */}
            {showUnsplash && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  <input value={unsplashQuery} onChange={e => setUnsplashQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchUnsplash(unsplashQuery)}
                    placeholder="Rechercher des photos…"
                    className="input" style={{ flex: 1, fontSize: 12 }} />
                  <button onClick={() => fetchUnsplash(unsplashQuery)}
                    style={{ padding: '6px 10px', background: 'var(--mint)', color: 'var(--mint-ink)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>→</button>
                </div>
                {unsplashLoading ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '8px 0', fontFamily: 'var(--sans)' }}>Chargement…</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {unsplashPhotos.map((src, i) => (
                      <UnsplashThumb key={i} src={src}
                        onAdd={() => addImageEl(`/api/proxy-image?url=${encodeURIComponent(src)}`)}
                        onBg={() => { setProxyUrl(`/api/proxy-image?url=${encodeURIComponent(src)}`); setShowUnsplash(false); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <SectionLabel>Templates</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {TEMPLATES.map(t => (
                <button key={t.label} onClick={() => applyTemplate(t.overrides as Partial<TextEl>)}
                  style={{ padding: '10px 12px', background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer', fontSize: 12, textAlign: 'left', color: 'var(--ink-2)', fontFamily: 'var(--sans)', transition: 'all 0.15s' }}>
                  {t.label}
                </button>
              ))}
            </div>

            <SectionLabel>Format</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormatId(f.id)}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid', cursor: 'pointer', fontSize: 12, textAlign: 'left', fontFamily: 'var(--sans)', transition: 'all 0.15s', background: formatId === f.id ? 'var(--mint)' : 'var(--sunk)', borderColor: formatId === f.id ? 'var(--mint)' : 'var(--line)', color: formatId === f.id ? 'var(--mint-ink)' : 'var(--ink-2)', fontWeight: formatId === f.id ? 700 : 400 }}>
                  {f.label} <span style={{ opacity: 0.6, fontSize: 11 }}>{f.sub}</span>
                </button>
              ))}
            </div>

          </div>
        </div>

        {/* ── CANVAS ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden', background: 'var(--sunk)' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 32 }}>
            <Stage
              ref={stageRef}
              width={stageW} height={stageH}
              onMouseDown={e => { if (e.target === e.target.getStage()) setSelectedId(null); }}
              style={{ boxShadow: '0 8px 48px rgba(0,0,0,0.5)', borderRadius: 2 }}
            >
              <Layer>
                <Rect x={0} y={0} width={stageW} height={stageH} fill="white" listening={false} />
                {proxyUrl && <BgImage src={proxyUrl} w={stageW} h={stageH} />}

                {elements.map(el => {
                  if (el.type === 'image') return (
                    <ImgNode key={el.id} el={el} onSelect={() => setSelectedId(el.id)} onChange={u => updateEl(el.id, u)} />
                  );
                  if (el.type === 'rect') return (
                    <Rect key={el.id} id={el.id} x={el.x} y={el.y} width={el.width} height={el.height}
                      fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth}
                      cornerRadius={el.cornerRadius} rotation={el.rotation} opacity={el.opacity / 100} draggable
                      onClick={() => setSelectedId(el.id)} onTap={() => setSelectedId(el.id)}
                      onDragEnd={e => updateEl(el.id, { x: e.target.x(), y: e.target.y() })}
                      onTransformEnd={e => {
                        const n = e.target;
                        updateEl(el.id, { x: n.x(), y: n.y(), width: Math.max(5, n.width() * n.scaleX()), height: Math.max(5, n.height() * n.scaleY()), rotation: n.rotation() });
                        n.scaleX(1); n.scaleY(1);
                      }} />
                  );
                  if (el.type === 'circle') return (
                    <Circle key={el.id} id={el.id} x={el.x} y={el.y} radius={el.radius}
                      fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth}
                      rotation={el.rotation} opacity={el.opacity / 100} draggable
                      onClick={() => setSelectedId(el.id)} onTap={() => setSelectedId(el.id)}
                      onDragEnd={e => updateEl(el.id, { x: e.target.x(), y: e.target.y() })}
                      onTransformEnd={e => {
                        const n = e.target;
                        updateEl(el.id, { x: n.x(), y: n.y(), radius: el.radius * n.scaleX(), rotation: n.rotation() });
                        n.scaleX(1); n.scaleY(1);
                      }} />
                  );
                  if (el.type === 'star') return (
                    <KonvaStar key={el.id} id={el.id} x={el.x} y={el.y} numPoints={el.numPoints}
                      innerRadius={el.innerRadius} outerRadius={el.outerRadius}
                      fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth}
                      rotation={el.rotation} opacity={el.opacity / 100} draggable
                      onClick={() => setSelectedId(el.id)} onTap={() => setSelectedId(el.id)}
                      onDragEnd={e => updateEl(el.id, { x: e.target.x(), y: e.target.y() })}
                      onTransformEnd={e => {
                        const n = e.target;
                        updateEl(el.id, { x: n.x(), y: n.y(), outerRadius: el.outerRadius * n.scaleX(), innerRadius: el.innerRadius * n.scaleX(), rotation: n.rotation() });
                        n.scaleX(1); n.scaleY(1);
                      }} />
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
                        onDragEnd={e => updateEl(el.id, { x: e.target.x(), y: e.target.y() })}>
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

                <Transformer ref={transformerRef} boundBoxFunc={(old, nb) => (nb.width < 10 || nb.height < 10 ? old : nb)} />
              </Layer>
            </Stage>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        {selectedEl && (
          <div style={{ width: 260, background: 'var(--white)', borderLeft: '1px solid var(--line)', overflowY: 'auto', flexShrink: 0, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <SectionLabel>{selectedEl.type === 'text' ? 'Texte' : selectedEl.type === 'image' ? 'Image' : 'Forme'}</SectionLabel>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={bringForward} title="Avancer" style={smallBtnStyle}>↑</button>
                <button onClick={sendBackward} title="Reculer" style={smallBtnStyle}>↓</button>
              </div>
            </div>

            {selectedEl.type === 'text' && <TextProperties el={selectedEl} onChange={u => updateEl(selectedEl.id, u)} customFonts={customFonts} onFontUpload={handleFontUpload} />}
            {(selectedEl.type === 'rect' || selectedEl.type === 'circle' || selectedEl.type === 'star') && (
              <ShapeProperties el={selectedEl} onChange={u => updateEl(selectedEl.id, u)} />
            )}
            {selectedEl.type === 'image' && (
              <ImageProperties el={selectedEl} onChange={u => updateEl(selectedEl.id, u)} onSetBg={() => setProxyUrl(selectedEl.src)} />
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
              <button onClick={() => duplicateEl()} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                Dupliquer
              </button>
              <button onClick={() => deleteEl(selectedId)} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center', color: 'var(--warn)', borderColor: 'rgba(200,115,43,.3)' }}>
                Supprimer
              </button>
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
    </div>
  );
}
