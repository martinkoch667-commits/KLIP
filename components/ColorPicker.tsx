"use client";
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

const RECENT_KEY = 'klip-recent-colors';
const RECENT_MAX = 8;

function getRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

function pushRecent(color: string) {
  const list = getRecent().filter(c => c.toLowerCase() !== color.toLowerCase());
  list.unshift(color);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
}

// ── Color math ────────────────────────────────────────────────────────────────

function hexToHsb(hex: string): [number, number, number] {
  const c = (hex.replace('#', '') + '000000').slice(0, 6);
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return [h, max ? (d / max) * 100 : 0, max * 100];
}

function hsbToHex(h: number, s: number, b: number): string {
  s /= 100; b /= 100;
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  const x = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${x(f(5))}${x(f(3))}${x(f(1))}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESETS = [
  '#14160F', '#5A5E50', '#8B8E7F', '#FFFFFF',
  '#F4F3EC', '#ECEBE1', '#0C2A1D', '#2FD79B',
  '#BDF2A0', '#C8732B', '#0038FF', '#FF6B6B',
];

// ── Drag helper ───────────────────────────────────────────────────────────────

function makeDragger(
  ref: React.RefObject<HTMLDivElement | null>,
  onDrag: (x: number, y: number) => void
) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    const update = (ev: { clientX: number; clientY: number }) => {
      const r = ref.current!.getBoundingClientRect();
      onDrag(
        Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)),
        Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))
      );
    };
    update(e.nativeEvent);
    const mv = (ev: MouseEvent) => update(ev);
    const up = () => {
      document.removeEventListener('mousemove', mv);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  brandColors?: string[];
  opacity?: number;
  onOpacityChange?: (v: number) => void;
}

export default function ColorPicker({
  value,
  onChange,
  brandColors,
  opacity,
  onOpacityChange,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(0);
  const [s, setS] = useState(0);
  const [b, setB] = useState(100);
  const [hexStr, setHexStr] = useState('FFFFFF');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [hasEyedropper] = useState(() => typeof window !== 'undefined' && 'EyeDropper' in window);

  const trigRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const opaRef = useRef<HTMLDivElement>(null);

  // Sync HSB from hex value (only when closed, so dragging doesn't fight itself)
  useEffect(() => {
    if (open) return;
    const [nh, ns, nb] = hexToHsb(value);
    setH(nh); setS(ns); setB(nb);
    setHexStr(value.replace('#', '').toUpperCase());
  }, [value, open]);

  // Load recent colors when popover opens
  useEffect(() => {
    if (open) setRecentColors(getRecent());
  }, [open]);

  // Open popover — compute fixed position (jamais hors écran)
  const handleOpen = () => {
    if (open) { setOpen(false); return; }
    if (trigRef.current) {
      const r = trigRef.current.getBoundingClientRect();
      const popW = 276, popH = onOpacityChange ? 560 : 520;
      const margin = 8;
      const left = Math.max(margin, Math.min(r.left, window.innerWidth - popW - margin));
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      // On ouvre en dessous par défaut ; au-dessus seulement s'il n'y a pas la place
      // en dessous ET qu'il y a plus de place au-dessus.
      let top = (spaceBelow >= popH + margin || spaceBelow >= spaceAbove)
        ? r.bottom + 6
        : r.top - popH - 6;
      // Bornage strict dans la fenêtre : jamais collé au-dessus du haut de l'écran.
      top = Math.max(margin, Math.min(top, window.innerHeight - popH - margin));
      if (top < margin) top = margin; // popup plus haute que la fenêtre → collée en haut, scroll interne
      setPos({ top, left });
    }
    setOpen(true);
  };

  // Recalage sur la taille RÉELLE du panneau (les estimations ci-dessus ne
  // valent que pour le premier placement) et à chaque redimensionnement de la
  // fenêtre : le panneau doit toujours rester entièrement visible.
  const clampToViewport = useCallback(() => {
    const pop = popRef.current, trig = trigRef.current;
    if (!pop || !trig) return;
    const m = 8;
    const pr = pop.getBoundingClientRect();
    const tr = trig.getBoundingClientRect();
    const left = Math.max(m, Math.min(tr.left, window.innerWidth - pr.width - m));
    const below = tr.bottom + 6;
    const top = below + pr.height <= window.innerHeight - m
      ? below
      : Math.max(m, Math.min(tr.top - pr.height - 6, window.innerHeight - pr.height - m));
    setPos(p => (Math.abs(p.left - left) < 0.5 && Math.abs(p.top - top) < 0.5 ? p : { top, left }));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, [open, clampToViewport]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (trigRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  const commit = (nh: number, ns: number, nb: number) => {
    const col = hsbToHex(nh, ns, nb);
    onChange(col);
    setHexStr(col.replace('#', '').toUpperCase());
    pushRecent(col);
    setRecentColors(getRecent());
  };

  const pick = (col: string) => {
    const [nh, ns, nb] = hexToHsb(col);
    setH(nh); setS(ns); setB(nb);
    onChange(col);
    setHexStr(col.replace('#', '').toUpperCase());
    pushRecent(col);
    setRecentColors(getRecent());
  };

  const handleEyedropper = useCallback(async () => {
    try {
      // @ts-ignore EyeDropper is not yet in TS lib
      const dropper = new window.EyeDropper();
      const { sRGBHex } = await dropper.open();
      pick(sRGBHex);
    } catch { /* user cancelled */ }
  }, [h, s, b]);

  // Drag handlers
  const startField = makeDragger(fieldRef, (x, y) => {
    const ns = x * 100, nb = (1 - y) * 100;
    setS(ns); setB(nb); commit(h, ns, nb);
  });

  const startHue = makeDragger(hueRef, (x) => {
    const nh = x * 360;
    setH(nh); commit(nh, s, b);
  });

  const startOpa = makeDragger(opaRef, (x) => {
    if (onOpacityChange) onOpacityChange(Math.round(x * 100));
  });

  const hueColor = `hsl(${h}, 100%, 50%)`;
  const curX = s / 100;
  const curY = 1 - b / 100;
  const safeBrands = (brandColors ?? []).filter(Boolean);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Trigger swatch */}
      <button
        ref={trigRef}
        type="button"
        onClick={handleOpen}
        style={{
          width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
          background: value, border: 'none', padding: 0, flexShrink: 0,
          boxShadow: 'inset 0 0 0 1.5px rgba(13,15,10,.2)',
        }}
      />

      {/* Popover — rendu dans <body>.
          Il est en position:fixed, donc censé se placer par rapport à la
          fenêtre. Mais la barre d'outils flottante porte un
          `transform: translateX(-50%)`, et un ancêtre transformé devient le
          référentiel des descendants fixed : les coordonnées calculées en
          repère fenêtre étaient appliquées depuis le coin de la barre. Le
          panneau partait donc d'autant plus loin à droite que la barre était
          décalée — invisible dès que le panneau latéral gauche était ouvert.
          Le portail sort le panneau de ce référentiel. */}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, width: 276, zIndex: 9999,
            background: 'var(--white)', border: '1px solid var(--line)',
            borderRadius: 'var(--r)', boxShadow: 'var(--shadow-pop)', padding: 14,
            userSelect: 'none' as const,
            maxHeight: 'calc(100vh - 16px)', overflowY: 'auto',
          }}
        >
          {/* Brand colors */}
          {safeBrands.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className="label" style={{ marginBottom: 7 }}>Charte</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {safeBrands.map((col, i) => (
                  <button key={i} type="button" onClick={() => pick(col)}
                    style={{
                      width: 28, height: 28, borderRadius: 6, background: col,
                      border: 'none', cursor: 'pointer',
                      boxShadow: value.toLowerCase() === col.toLowerCase()
                        ? '0 0 0 2.5px var(--mint-2)'
                        : 'inset 0 0 0 1.5px rgba(13,15,10,.18)',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Preset grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 5, marginBottom: 12 }}>
            {PRESETS.map((col, i) => (
              <button key={i} type="button" onClick={() => pick(col)}
                style={{
                  aspectRatio: '1', borderRadius: 5, background: col,
                  border: 'none', cursor: 'pointer',
                  boxShadow: value.toLowerCase() === col.toLowerCase()
                    ? '0 0 0 2.5px var(--mint-2)'
                    : 'inset 0 0 0 1px rgba(13,15,10,.14)',
                }}
              />
            ))}
          </div>

          {/* Recent colors */}
          {recentColors.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className="label" style={{ marginBottom: 7 }}>Récentes</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {recentColors.map((col, i) => (
                  <button key={i} type="button" onClick={() => pick(col)}
                    style={{
                      width: 28, height: 28, borderRadius: 6, background: col,
                      border: 'none', cursor: 'pointer',
                      boxShadow: value.toLowerCase() === col.toLowerCase()
                        ? '0 0 0 2.5px var(--mint-2)'
                        : 'inset 0 0 0 1.5px rgba(13,15,10,.18)',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* HSB gradient field */}
          <div
            ref={fieldRef}
            onMouseDown={startField}
            style={{
              width: '100%', height: 148, borderRadius: 8, marginBottom: 10,
              position: 'relative', cursor: 'crosshair', background: hueColor,
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #fff, transparent)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, #000)' }} />
            {/* Cursor */}
            <div style={{
              position: 'absolute',
              left: `${curX * 100}%`, top: `${curY * 100}%`,
              width: 14, height: 14, borderRadius: '50%',
              border: '2.5px solid #fff',
              boxShadow: '0 0 0 1.5px rgba(0,0,0,.3), 0 2px 6px rgba(0,0,0,.25)',
              transform: 'translate(-50%,-50%)',
              background: value, pointerEvents: 'none',
            }} />
          </div>

          {/* Hue slider */}
          <div
            ref={hueRef}
            onMouseDown={startHue}
            style={{
              width: '100%', height: 12, borderRadius: 99, marginBottom: 8,
              position: 'relative', cursor: 'ew-resize',
              background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
            }}
          >
            <div style={{
              position: 'absolute', left: `${(h / 360) * 100}%`, top: '50%',
              width: 17, height: 17, borderRadius: '50%',
              border: '2.5px solid #fff',
              boxShadow: '0 1px 5px rgba(0,0,0,.3)',
              transform: 'translate(-50%,-50%)',
              background: hueColor, pointerEvents: 'none',
            }} />
          </div>

          {/* Opacity slider (optional) */}
          {onOpacityChange && (
            <div
              ref={opaRef}
              onMouseDown={startOpa}
              style={{
                width: '100%', height: 12, borderRadius: 99, marginBottom: 8,
                position: 'relative', cursor: 'ew-resize',
              }}
            >
              {/* Checkerboard base */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 99,
                backgroundImage: 'repeating-conic-gradient(#bbb 0% 25%, #fff 0% 50%)',
                backgroundSize: '8px 8px',
              }} />
              {/* Color gradient overlay */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 99,
                background: `linear-gradient(to right, transparent, ${value})`,
              }} />
              {/* Thumb */}
              <div style={{
                position: 'absolute', left: `${opacity ?? 100}%`, top: '50%',
                width: 17, height: 17, borderRadius: '50%',
                border: '2.5px solid #fff',
                boxShadow: '0 1px 5px rgba(0,0,0,.3)',
                transform: 'translate(-50%,-50%)',
                background: value, pointerEvents: 'none',
              }} />
            </div>
          )}

          {/* Hex + opacity inputs + eyedropper */}
          <div style={{ display: 'flex', gap: 7, marginTop: 4 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--sunk)', borderRadius: 'var(--r-s)', padding: '7px 10px',
            }}>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>#</span>
              <input
                value={hexStr}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 6);
                  setHexStr(v);
                  if (v.length === 6) {
                    const col = '#' + v;
                    const [nh, ns, nb] = hexToHsb(col);
                    setH(nh); setS(ns); setB(nb); onChange(col);
                  }
                }}
                style={{
                  flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5, color: 'var(--ink)',
                }}
                maxLength={6}
              />
            </div>
            {onOpacityChange && (
              <div style={{
                width: 76, display: 'flex', alignItems: 'center', gap: 3,
                background: 'var(--sunk)', borderRadius: 'var(--r-s)', padding: '7px 10px',
              }}>
                <input
                  type="number" min={0} max={100} value={opacity ?? 100}
                  onChange={e => onOpacityChange(Math.max(0, Math.min(100, Number(e.target.value))))}
                  style={{
                    width: 34, background: 'transparent', border: 'none', outline: 'none',
                    fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5, color: 'var(--ink)',
                    textAlign: 'right',
                  }}
                />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>%</span>
              </div>
            )}
            {hasEyedropper && (
              <button
                type="button"
                onClick={handleEyedropper}
                title="Pipette"
                style={{
                  width: 36, height: 36, borderRadius: 'var(--r-s)', border: '1.5px solid var(--line)',
                  background: 'var(--sunk)', cursor: 'pointer', display: 'grid', placeItems: 'center',
                  color: 'var(--ink-2)', flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a5 5 0 0 1 5 5c0 2-1 3.5-2.5 4.5L19 16l-3 3-4.5-4.5C10.5 15.5 9 14.5 9 12.5V12L3.5 6.5A2 2 0 0 1 6.5 3.5L12 9V7a5 5 0 0 1 0-5z"/>
                  <path d="M3 21l3-3"/>
                </svg>
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
