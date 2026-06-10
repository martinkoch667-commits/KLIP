"use client";
import { useEffect, useRef, useState } from "react";

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
  '#C8F135', '#C8732B', '#0038FF', '#FF6B6B',
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

  // Open popover — compute fixed position
  const handleOpen = () => {
    if (open) { setOpen(false); return; }
    if (trigRef.current) {
      const r = trigRef.current.getBoundingClientRect();
      const popW = 276, popH = onOpacityChange ? 510 : 468;
      const left = Math.min(r.left, window.innerWidth - popW - 8);
      const top = r.bottom + 6 + popH > window.innerHeight
        ? r.top - popH - 6
        : r.bottom + 6;
      setPos({ top, left: Math.max(8, left) });
    }
    setOpen(true);
  };

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

  // Commit a new color from HSB
  const commit = (nh: number, ns: number, nb: number) => {
    const col = hsbToHex(nh, ns, nb);
    onChange(col);
    setHexStr(col.replace('#', '').toUpperCase());
  };

  // Pick a preset or brand color
  const pick = (col: string) => {
    const [nh, ns, nb] = hexToHsb(col);
    setH(nh); setS(ns); setB(nb);
    onChange(col);
    setHexStr(col.replace('#', '').toUpperCase());
  };

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

      {/* Popover */}
      {open && (
        <div
          ref={popRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, width: 276, zIndex: 9999,
            background: 'var(--white)', border: '1px solid var(--line)',
            borderRadius: 'var(--r)', boxShadow: 'var(--shadow-pop)', padding: 14,
            userSelect: 'none' as const,
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

          {/* Hex + opacity inputs */}
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
          </div>
        </div>
      )}
    </div>
  );
}
