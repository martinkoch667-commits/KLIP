"use client";
import { useRef, useState } from "react";

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
  width: 13, height: 13,
  background: '#FFFFFF',
  border: '1.5px solid #8B5CF6',
  borderRadius: '50%',
  boxShadow: '0 1px 3px rgba(13,15,10,.22)',
  pointerEvents: 'auto',
  transition: 'opacity .15s',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  el: AnyEl;
  stageRef: React.RefObject<any>;
  onChange: (u: Record<string, any>) => void;
  onDragEnd?: () => void;
  zoom?: number;
}

export default function SelectionOverlay({ el, stageRef, onChange, onDragEnd, zoom }: Props) {
  const [liveAngle, setLiveAngle] = useState<number | null>(null);
  // Keep latest callbacks in refs so closures never go stale
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const zoomRef = useRef(zoom ?? 1);
  zoomRef.current = zoom ?? 1;

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

    // Capture everything needed at mousedown — immune to stale closures
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startW      = bounds!.w;
    const startH      = bounds!.h;
    const startElX    = el.x;
    const startElY    = el.y;
    const startRot    = bounds!.rotation;
    const snapRadius  = el.radius ?? 50;
    const snapOuter   = el.outerRadius ?? 50;
    const snapInner   = el.innerRadius ?? 25;
    const elType      = el.type;

    const rad = startRot * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);

    // Move origin in local space → stage space
    const shiftOrigin = (lx: number, ly: number) => ({
      x: startElX + cos * lx - sin * ly,
      y: startElY + sin * lx + cos * ly,
    });

    const onMove = (ev: MouseEvent) => {
      try {
        const z = zoomRef.current;
        const vdx = (ev.clientX - startMouseX) / z;
        const vdy = (ev.clientY - startMouseY) / z;
        const [ldx, ldy] = toLocal(vdx, vdy, startRot);

        // ── Circles ───────────────────────────────────────────────────────────
        if (elType === 'circle') {
          const grow = ['br', 'mr', 'bc', 'tr'].includes(handleId);
          const delta = (grow ? 1 : -1) * Math.sqrt(ldx * ldx + ldy * ldy) * 0.7;
          onChangeRef.current({ radius: Math.max(10, snapRadius + delta) });
          return;
        }

        // ── Stars ─────────────────────────────────────────────────────────────
        if (elType === 'star') {
          const grow = ['br', 'mr', 'bc', 'tr'].includes(handleId);
          const delta = (grow ? 1 : -1) * Math.sqrt(ldx * ldx + ldy * ldy) * 0.7;
          const r = Math.max(10, snapOuter + delta);
          const starRatio = snapInner / snapOuter;
          onChangeRef.current({ outerRadius: r, innerRadius: Math.max(5, r * starRatio) });
          return;
        }

        // ── Text (width only) ─────────────────────────────────────────────────
        if (elType === 'text') {
          let nw = startW;
          let origin = { x: startElX, y: startElY };
          if (['mr', 'br', 'tr'].includes(handleId)) {
            nw = startW + ldx;
          } else if (['ml', 'bl', 'tl'].includes(handleId)) {
            nw = startW - ldx;
            origin = shiftOrigin(ldx, 0);
          }
          onChangeRef.current({ x: origin.x, y: origin.y, width: Math.max(20, nw) });
          return;
        }

        // ── Rect / Image — proportional corners, single-axis midpoints ────────
        let nw = startW, nh = startH;
        let origin = { x: startElX, y: startElY };

        const isCorner = ['tl', 'tr', 'bl', 'br'].includes(handleId);

        if (isCorner) {
          // Free resize: width and height independent per corner
          switch (handleId) {
            case 'br':
              nw = startW + ldx;
              nh = startH + ldy;
              break;
            case 'tr':
              nw = startW + ldx;
              nh = startH - ldy;
              origin = shiftOrigin(0, startH - Math.max(20, nh));
              break;
            case 'bl':
              nw = startW - ldx;
              nh = startH + ldy;
              origin = shiftOrigin(startW - Math.max(20, nw), 0);
              break;
            case 'tl':
              nw = startW - ldx;
              nh = startH - ldy;
              origin = shiftOrigin(startW - Math.max(20, nw), startH - Math.max(20, nh));
              break;
          }
          nw = Math.max(20, nw);
          nh = Math.max(20, nh);
        } else {
          switch (handleId) {
            case 'mr': nw = startW + ldx; break;
            case 'ml': nw = startW - ldx; origin = shiftOrigin(ldx, 0); break;
            case 'bc': nh = startH + ldy; break;
            case 'tc': nh = startH - ldy; origin = shiftOrigin(0, ldy); break;
          }
          nw = Math.max(20, nw);
          nh = Math.max(20, nh);
        }

        onChangeRef.current({ x: origin.x, y: origin.y, width: nw, height: nh });
      } catch (err) {
        console.error('[SelectionOverlay] resize error:', err);
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onDragEndRef.current?.();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Rotate ──────────────────────────────────────────────────────────────────

  const startRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      // Get stage container's viewport rect for coordinate conversion
      // bounds.cx/cy are in stage (canvas) coordinates; multiply by zoom to get viewport offset
      const cRect = stageRef.current?.container?.()?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
      const z = zoomRef.current;
      const vcxV = cRect.left + bounds!.cx * z;
      const vcyV = cRect.top  + bounds!.cy * z;
      const snapBounds = { ...bounds! };

      const onMove = (ev: MouseEvent) => {
        try {
          const raw = Math.atan2(ev.clientY - vcyV, ev.clientX - vcxV) * 180 / Math.PI - 90;
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
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        onDragEndRef.current?.();
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
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
      {/* Selection border */}
      <div style={{
        position: 'absolute', inset: 0,
        border: '2px solid #8B5CF6',
        borderRadius: 3,
        boxShadow: '0 0 0 1px rgba(255,255,255,.5)',
        background: 'transparent',
        pointerEvents: 'none',
      }} />

      {/* Rotation connector line — below element */}
      <div style={{
        position: 'absolute',
        left: '50%', bottom: -26,
        width: 2, height: 26,
        background: '#8B5CF6',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
      }} />

      {/* Rotation circle handle — below element, clear of SelectionPill */}
      <div
        onMouseDown={startRotate}
        title="Pivoter"
        style={{
          position: 'absolute',
          left: '50%', bottom: -52,
          width: 26, height: 26,
          transform: 'translate(-50%, 0)',
          borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 2px 7px rgba(13,15,10,.28)',
          cursor: 'grab',
          pointerEvents: 'auto',
          display: 'grid', placeItems: 'center',
          color: '#5A5E50',
          transition: 'opacity .15s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4"/></svg>
      </div>

      {/* 8 resize handles */}
      {visibleHandles.map(hnd => (
        <div
          key={hnd.id}
          onMouseDown={startResize(hnd.id)}
          style={{ ...HANDLE_BASE, cursor: hnd.cursor, ...hnd.style }}
        />
      ))}

      {/* Live angle badge during rotation — next to the handle below */}
      {liveAngle !== null && (
        <div style={{
          position: 'absolute',
          bottom: -52, left: '50%',
          transform: 'translateX(20px)',
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
