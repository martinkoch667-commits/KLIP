"use client";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnyEl {
  id: string; type: string;
  x: number; y: number; rotation: number; opacity: number;
  width?: number; height?: number;
  radius?: number;
  outerRadius?: number; innerRadius?: number;
  fontSize?: number; padding?: number; paddingV?: number; paddingH?: number;
  hasBg?: boolean;
  [k: string]: any;
}

interface Bounds {
  x: number; y: number; w: number; h: number;
  rotation: number;
  originX: number; originY: number;
  cx: number; cy: number;
}

// ─── Bounds from element state (no Konva API needed) ─────────────────────────

function getElementBounds(el: AnyEl): Bounds | null {
  try {
    let x: number, y: number, w: number, h: number;
    let originX = 0, originY = 0;
    const rotation = el.rotation ?? 0;

    if (el.type === 'rect' || el.type === 'image') {
      x = el.x; y = el.y;
      w = Math.max(1, el.width ?? 100);
      h = Math.max(1, el.height ?? 100);
      // Konva Rect/Image: rotation around top-left (origin = 0,0)
      originX = 0; originY = 0;

    } else if (el.type === 'circle') {
      const r = Math.max(1, el.radius ?? 50);
      x = el.x - r; y = el.y - r;
      w = r * 2; h = r * 2;
      // Konva Circle: x,y = center, rotation around center
      originX = r; originY = r;

    } else if (el.type === 'star') {
      const r = Math.max(1, el.outerRadius ?? 50);
      x = el.x - r; y = el.y - r;
      w = r * 2; h = r * 2;
      // Konva Star: x,y = center, rotation around center
      originX = r; originY = r;

    } else if (el.type === 'text') {
      x = el.x; y = el.y;
      w = Math.max(20, el.width ?? 200);
      const pV = Number(el.paddingV ?? el.padding ?? 10);
      // Match blockH from editor: fontSize + pV * 2
      h = Math.max(1, (el.fontSize ?? 32) + pV * 2);
      originX = 0; originY = 0;

    } else {
      return null;
    }

    const rad = rotation * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    // Visual center = rotate the local center offset (dx,dy) around the CSS origin
    const dx = w / 2 - originX, dy = h / 2 - originY;
    const cx = x + originX + dx * cos - dy * sin;
    const cy = y + originY + dx * sin + dy * cos;

    return { x, y, w, h, rotation, originX, originY, cx, cy };
  } catch (err) {
    console.error('[SelectionOverlay] getElementBounds error:', err);
    return null;
  }
}

// viewport delta → element-local delta (undo the CSS rotation)
function toLocal(dx: number, dy: number, rotation: number): [number, number] {
  const rad = rotation * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return [cos * dx + sin * dy, -sin * dx + cos * dy];
}

// ─── Handle definitions ───────────────────────────────────────────────────────

interface HandleDef { id: string; cursor: string; style: React.CSSProperties }

const HANDLES: HandleDef[] = [
  { id: 'tl', cursor: 'nw-resize',  style: { left: -5,    top: -5 } },
  { id: 'tc', cursor: 'n-resize',   style: { left: '50%', top: -5,    transform: 'translateX(-50%)' } },
  { id: 'tr', cursor: 'ne-resize',  style: { right: -5,   top: -5 } },
  { id: 'mr', cursor: 'e-resize',   style: { right: -5,   top: '50%', transform: 'translateY(-50%)' } },
  { id: 'br', cursor: 'se-resize',  style: { right: -5,   bottom: -5 } },
  { id: 'bc', cursor: 's-resize',   style: { left: '50%', bottom: -5,  transform: 'translateX(-50%)' } },
  { id: 'bl', cursor: 'sw-resize',  style: { left: -5,    bottom: -5 } },
  { id: 'ml', cursor: 'w-resize',   style: { left: -5,    top: '50%', transform: 'translateY(-50%)' } },
];

const HANDLE_BASE: React.CSSProperties = {
  position: 'absolute',
  width: 10, height: 10,
  background: '#FFFFFF',
  border: '1.5px solid #2FD79B',
  borderRadius: 2,
  boxShadow: '0 1px 3px rgba(13,15,10,.20)',
  pointerEvents: 'auto',
  transition: 'opacity .15s',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  el: AnyEl;
  stageRef: React.RefObject<any>;
  onChange: (u: Record<string, any>) => void;
}

export default function SelectionOverlay({ el, stageRef, onChange }: Props) {
  const [liveAngle, setLiveAngle] = useState<number | null>(null);

  // Compute bounds from element state — no Konva API calls
  let bounds: Bounds | null = null;
  try {
    bounds = getElementBounds(el);
  } catch (err) {
    console.error('[SelectionOverlay] render error:', err);
    return null;
  }
  if (!bounds) return null;

  const { x, y, w, h, rotation, originX, originY } = bounds;

  // ── Resize ──────────────────────────────────────────────────────────────────

  const startResize = (handleId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const snapEl = { ...el };
    const snapBounds = { ...bounds! };

    const onMove = (ev: MouseEvent) => {
      try {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        const [ldx, ldy] = toLocal(dx, dy, snapBounds.rotation);

        // ── Circles ───────────────────────────────────────────────────────────
        if (el.type === 'circle') {
          const grow = ['br', 'mr', 'bc', 'tr', 'bl'].includes(handleId);
          const delta = (grow ? 1 : -1) * Math.sqrt(ldx * ldx + ldy * ldy) * 0.7;
          onChange({ radius: Math.max(10, (snapEl.radius ?? 50) + delta) });
          return;
        }

        // ── Stars ─────────────────────────────────────────────────────────────
        if (el.type === 'star') {
          const grow = ['br', 'mr', 'bc', 'tr', 'bl'].includes(handleId);
          const delta = (grow ? 1 : -1) * Math.sqrt(ldx * ldx + ldy * ldy) * 0.7;
          const r = Math.max(10, (snapEl.outerRadius ?? 50) + delta);
          const ratio = (snapEl.innerRadius ?? 25) / (snapEl.outerRadius ?? 50);
          onChange({ outerRadius: r, innerRadius: Math.max(5, r * ratio) });
          return;
        }

        // ── Rect / Image / Text (rotation-aware) ─────────────────────────────
        const rad = snapBounds.rotation * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        let nx = snapEl.x, ny = snapEl.y;
        let nw = snapBounds.w, nh = snapBounds.h;

        const shift = (lx: number, ly: number) => {
          nx = snapEl.x + cos * lx - sin * ly;
          ny = snapEl.y + sin * lx + cos * ly;
        };

        switch (handleId) {
          case 'tl': shift(ldx, ldy); nw -= ldx; nh -= ldy; break;
          case 'tc': shift(0, ldy);              nh -= ldy; break;
          case 'tr': shift(0, ldy);   nw += ldx; nh -= ldy; break;
          case 'mr':                  nw += ldx;             break;
          case 'br':                  nw += ldx; nh += ldy; break;
          case 'bc':                             nh += ldy; break;
          case 'bl': shift(ldx, 0);  nw -= ldx; nh += ldy; break;
          case 'ml': shift(ldx, 0);  nw -= ldx;             break;
        }

        nw = Math.max(20, nw);
        nh = Math.max(20, nh);

        if (el.type === 'text') {
          onChange({ x: nx, y: ny, width: nw });
        } else {
          onChange({ x: nx, y: ny, width: nw, height: nh });
        }
      } catch (err) {
        console.error('[SelectionOverlay] resize error:', err);
      }
    };

    const onUp = () => document.removeEventListener('mousemove', onMove);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  };

  // ── Rotate ──────────────────────────────────────────────────────────────────

  const startRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      // Get stage container's viewport rect for coordinate conversion
      const cRect = stageRef.current?.container?.()?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
      const vcxV = bounds!.cx + cRect.left;
      const vcyV = bounds!.cy + cRect.top;
      const snapBounds = { ...bounds! };

      const onMove = (ev: MouseEvent) => {
        try {
          const raw = Math.atan2(ev.clientY - vcyV, ev.clientX - vcxV) * 180 / Math.PI + 90;
          const newAngle = ((raw % 360) + 360) % 360;
          setLiveAngle(Math.round(newAngle));

          if (el.type === 'circle' || el.type === 'star') {
            onChange({ rotation: newAngle });
            return;
          }

          // Keep visual center fixed for rect / image / text
          const { w: sw, h: sh, originX: ox, originY: oy, cx: vcxS, cy: vcyS } = snapBounds;
          const lcx = sw / 2 - ox;
          const lcy = sh / 2 - oy;
          const newRad = newAngle * Math.PI / 180;
          const nc = Math.cos(newRad), ns = Math.sin(newRad);
          onChange({
            x: vcxS - lcx * nc + lcy * ns,
            y: vcyS - lcx * ns - lcy * nc,
            rotation: newAngle,
          });
        } catch (err) {
          console.error('[SelectionOverlay] rotate move error:', err);
        }
      };

      const onUp = () => {
        setLiveAngle(null);
        document.removeEventListener('mousemove', onMove);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp, { once: true });
    } catch (err) {
      console.error('[SelectionOverlay] startRotate error:', err);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const visibleHandles = el.type === 'text'
    ? HANDLES.filter(h => !['tc', 'bc'].includes(h.id))
    : HANDLES;

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y, width: w, height: h,
      transform: `rotate(${rotation}deg)`,
      transformOrigin: `${originX}px ${originY}px`,
      pointerEvents: 'none',
      transition: 'none',
      zIndex: 10,
    }}>
      {/* Dashed mint selection border */}
      <div style={{
        position: 'absolute', inset: 0,
        border: '1.5px dashed #2FD79B',
        borderRadius: 4,
        background: 'rgba(47,215,155,.06)',
        pointerEvents: 'none',
      }} />

      {/* Rotation connector line */}
      <div style={{
        position: 'absolute',
        left: '50%', top: -20,
        width: 1, height: 20,
        background: '#2FD79B',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
      }} />

      {/* Rotation circle handle */}
      <div
        onMouseDown={startRotate}
        style={{
          position: 'absolute',
          left: '50%', top: -32,
          width: 12, height: 12,
          transform: 'translate(-50%, 0)',
          borderRadius: '50%',
          background: '#2FD79B',
          border: '1.5px solid #FFFFFF',
          boxShadow: '0 1px 4px rgba(13,15,10,.22)',
          cursor: 'crosshair',
          pointerEvents: 'auto',
          transition: 'opacity .15s',
        }}
      />

      {/* 8 resize handles */}
      {visibleHandles.map(hnd => (
        <div
          key={hnd.id}
          onMouseDown={startResize(hnd.id)}
          style={{ ...HANDLE_BASE, cursor: hnd.cursor, ...hnd.style }}
        />
      ))}

      {/* Live angle badge during rotation */}
      {liveAngle !== null && (
        <div style={{
          position: 'absolute',
          top: -52, left: '50%',
          transform: 'translateX(-50%)',
          background: '#0C2A1D',
          color: '#EEEDE3',
          borderRadius: 6,
          padding: '3px 8px',
          fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 200,
          boxShadow: '0 2px 6px rgba(13,15,10,.28)',
        }}>
          {liveAngle}°
        </div>
      )}
    </div>
  );
}
