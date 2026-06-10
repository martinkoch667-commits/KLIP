"use client";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnyEl {
  id: string; type: string;
  x: number; y: number; rotation: number; opacity: number;
  width?: number; height?: number;
  radius?: number;
  outerRadius?: number; innerRadius?: number;
  [k: string]: any;
}

interface Bounds {
  x: number; y: number; w: number; h: number;
  rotation: number;
  originX: number; originY: number;
  cx: number; cy: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNodeBounds(stage: any, id: string): Bounds | null {
  if (!stage) return null;
  const node = stage.findOne('#' + id);
  if (!node) return null;
  const sr = node.getSelfRect();
  const ap = node.getAbsolutePosition();
  const rotation = node.getAbsoluteRotation();
  const rad = rotation * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const x = ap.x + sr.x;
  const y = ap.y + sr.y;
  const w = sr.width;
  const h = sr.height;
  const originX = -sr.x;
  const originY = -sr.y;
  // visual center: rotate the local-center offset around the origin
  const dx = w / 2 - originX, dy = h / 2 - originY;
  const cx = x + originX + dx * cos - dy * sin;
  const cy = y + originY + dx * sin + dy * cos;
  return { x, y, w, h, rotation, originX, originY, cx, cy };
}

// viewport delta → element local delta (undo the CSS rotation)
function toLocal(dx: number, dy: number, rotation: number): [number, number] {
  const rad = rotation * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return [cos * dx + sin * dy, -sin * dx + cos * dy];
}

// ─── Handle definitions ───────────────────────────────────────────────────────

interface HandleDef { id: string; cursor: string; style: React.CSSProperties }

const HANDLES: HandleDef[] = [
  { id: 'tl', cursor: 'nw-resize',  style: { left: -5,   top: -5 } },
  { id: 'tc', cursor: 'n-resize',   style: { left: '50%', top: -5,    transform: 'translateX(-50%)' } },
  { id: 'tr', cursor: 'ne-resize',  style: { right: -5,  top: -5 } },
  { id: 'mr', cursor: 'e-resize',   style: { right: -5,  top: '50%',  transform: 'translateY(-50%)' } },
  { id: 'br', cursor: 'se-resize',  style: { right: -5,  bottom: -5 } },
  { id: 'bc', cursor: 's-resize',   style: { left: '50%', bottom: -5,  transform: 'translateX(-50%)' } },
  { id: 'bl', cursor: 'sw-resize',  style: { left: -5,   bottom: -5 } },
  { id: 'ml', cursor: 'w-resize',   style: { left: -5,   top: '50%',  transform: 'translateY(-50%)' } },
];

const HANDLE_STYLE: React.CSSProperties = {
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

  const bounds = getNodeBounds(stageRef.current, el.id);
  if (!bounds) return null;
  const { x, y, w, h, rotation, originX, originY } = bounds;

  // ── Resize ──────────────────────────────────────────────────────────────────

  const startResize = (handleId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const snapEl = { ...el };
    const snapBounds = { ...bounds };

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      const [ldx, ldy] = toLocal(dx, dy, snapBounds.rotation);

      // ── Circles: change radius from center ────────────────────────────────
      if (el.type === 'circle') {
        const growHandles = ['br', 'mr', 'bc', 'tr', 'bl'];
        const sign = growHandles.includes(handleId) ? 1 : -1;
        const delta = sign * Math.sqrt(ldx * ldx + ldy * ldy) * 0.7;
        onChange({ radius: Math.max(10, (snapEl.radius ?? 50) + delta) });
        return;
      }

      // ── Stars: scale from center ───────────────────────────────────────────
      if (el.type === 'star') {
        const growHandles = ['br', 'mr', 'bc', 'tr', 'bl'];
        const sign = growHandles.includes(handleId) ? 1 : -1;
        const delta = sign * Math.sqrt(ldx * ldx + ldy * ldy) * 0.7;
        const r = Math.max(10, (snapEl.outerRadius ?? 50) + delta);
        const ratio = (snapEl.innerRadius ?? 25) / (snapEl.outerRadius ?? 50);
        onChange({ outerRadius: r, innerRadius: Math.max(5, r * ratio) });
        return;
      }

      // ── Rect / Image / Text: rotation-aware edge resize ───────────────────
      const rad = snapBounds.rotation * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);

      let nx = snapEl.x, ny = snapEl.y;
      let nw = snapBounds.w, nh = snapBounds.h;

      // Move element origin (top-left for rects, center for circles) by local (lx, ly)
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
        // Text: only width (height is auto from content)
        onChange({ x: nx, y: ny, width: nw });
      } else {
        onChange({ x: nx, y: ny, width: nw, height: nh });
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
    const stage = stageRef.current;
    if (!stage) return;
    const cRect = stage.container().getBoundingClientRect();
    // Visual center in viewport coordinates (fixed during the whole drag)
    const vcxV = bounds.cx + cRect.left;
    const vcyV = bounds.cy + cRect.top;
    const snapBounds = { ...bounds };

    const onMove = (ev: MouseEvent) => {
      const raw = Math.atan2(ev.clientY - vcyV, ev.clientX - vcxV) * 180 / Math.PI + 90;
      const newAngle = ((raw % 360) + 360) % 360;
      setLiveAngle(Math.round(newAngle));

      // Circles / stars: x,y IS the center → no position adjustment needed
      if (el.type === 'circle' || el.type === 'star') {
        onChange({ rotation: newAngle });
        return;
      }

      // Rect / image / text: keep the visual center fixed while changing rotation
      const { w: sw, h: sh, originX: ox, originY: oy, cx: vcxS, cy: vcyS } = snapBounds;
      const lcx = sw / 2 - ox; // local-space offset from rotation pivot to center
      const lcy = sh / 2 - oy;
      const newRad = newAngle * Math.PI / 180;
      const nc = Math.cos(newRad), ns = Math.sin(newRad);
      const newX = vcxS - lcx * nc + lcy * ns;
      const newY = vcyS - lcx * ns - lcy * nc;
      onChange({ x: newX, y: newY, rotation: newAngle });
    };

    const onUp = () => {
      setLiveAngle(null);
      document.removeEventListener('mousemove', onMove);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
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
      {/* Dashed selection border */}
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

      {/* Rotation handle circle */}
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
          style={{ ...HANDLE_STYLE, cursor: hnd.cursor, ...hnd.style }}
        />
      ))}

      {/* Live rotation angle badge */}
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
