"use client";
import { useRef, useState } from "react";
import { measureBlock } from "@/lib/richText";

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
      // Même moteur de mesure que le rendu Konva : le cadre de sélection colle
      // ainsi au bloc réellement dessiné, y compris quand le texte passe sur
      // plusieurs lignes, qu'il est en capitales ou stylé par morceaux.
      x = el.x; y = el.y;
      const m = measureBlock({
        text: el.text ?? '',
        runs: el.runs,
        fontSize: el.fontSize ?? 32,
        fontFamily: el.fontFamily ?? 'Archivo',
        fontStyle: el.fontStyle ?? 'bold',
        fill: el.fill,
        textDecoration: el.textDecoration,
        letterSpacing: el.letterSpacing,
        lineHeight: el.lineHeight,
        align: el.align,
        uppercase: el.uppercase,
        width: el.width ?? 200,
        padding: el.padding,
        paddingH: el.paddingH,
        paddingV: el.paddingV,
      });
      w = m.blockW;
      h = Math.max(1, m.blockH);
      originX = 0; originY = 0;

    } else if (el.type === 'vector') {
      if (el.shape === 'custom' && el.points && Array.isArray(el.points) && el.points.length >= 2) {
        const pts = el.points as Array<{x:number;y:number;cpIn?:{x:number;y:number};cpOut?:{x:number;y:number}}>;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
          minX = Math.min(minX, p.x, p.cpIn?.x ?? p.x, p.cpOut?.x ?? p.x);
          minY = Math.min(minY, p.y, p.cpIn?.y ?? p.y, p.cpOut?.y ?? p.y);
          maxX = Math.max(maxX, p.x, p.cpIn?.x ?? p.x, p.cpOut?.x ?? p.x);
          maxY = Math.max(maxY, p.y, p.cpIn?.y ?? p.y, p.cpOut?.y ?? p.y);
        }
        x = el.x + minX; y = el.y + minY;
        w = Math.max(20, maxX - minX);
        h = Math.max(20, maxY - minY);
        originX = 0; originY = 0;
      } else {
        x = el.x; y = el.y;
        w = Math.max(20, el.width ?? 100);
        h = Math.max(20, el.height ?? 100);
        originX = 0; originY = 0;
      }
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

// Encombrement RÉEL à l'écran, rotation comprise : le rectangle englobant des
// quatre coins une fois tournés. Sert à poser les surcouches (pastille de
// sélection) au-dessus de l'objet sans jamais le recouvrir — une boîte non
// tournée sous-estime la hauteur dès que l'objet est incliné.
export function getVisualRect(el: AnyEl): { left: number; top: number; right: number; bottom: number } | null {
  const b = getElementBounds(el);
  if (!b) return null;
  const { x, y, w, h, rotation, originX, originY } = b;
  // Cercle et étoile sont bornés par leur rayon autour de leur centre : les faire
  // tourner ne change pas leur encombrement. Passer par les coins de la boîte
  // donnerait la diagonale et éloignerait inutilement ce qu'on pose au-dessus.
  if (!rotation || el.type === 'circle' || el.type === 'star') {
    return { left: x, top: y, right: x + w, bottom: y + h };
  }
  const rad = rotation * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const ox = x + originX, oy = y + originY;
  const xs: number[] = [], ys: number[] = [];
  for (const [px, py] of [[0, 0], [w, 0], [w, h], [0, h]]) {
    const dx = px - originX, dy = py - originY;
    xs.push(ox + dx * cos - dy * sin);
    ys.push(oy + dx * sin + dy * cos);
  }
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
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
  border: '1.5px solid var(--vio)',
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
  const [liveRadius, setLiveRadius] = useState<number | null>(null);
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
    const startRatio  = startH / Math.max(1, startW);
    const startElX    = el.x;
    const startElY    = el.y;
    const startRot    = bounds!.rotation;
    const snapRadius  = el.radius ?? 50;
    const snapOuter   = el.outerRadius ?? 50;
    const snapInner   = el.innerRadius ?? 25;
    const startFontSize = el.fontSize ?? 32;
    const startPadding  = el.padding;
    const startPaddingH = el.paddingH;
    const startPaddingV = el.paddingV;
    const startLetterSpacing = el.letterSpacing;
    /* Recadrage d'une photo. Tout ce qui décrit la place de l'image DANS son
       cadre est figé au moment où l'on saisit la poignée.

       Sans ça, cropX/cropY restaient indéfinis et l'affichage les recalculait à
       chaque image du glissement pour recentrer la photo dans le nouveau cadre :
       tirer la barre du haut faisait glisser toute la photo au lieu d'en couper
       le haut. C'est le reproche de Martin, capture d'écran à l'appui. Une
       poignée déplace le CADRE ; la photo, elle, ne bouge pas d'un pixel. */
    const isImage    = el.type === 'image';
    const startNatW  = (el.naturalW as number) || Math.max(1, startW);
    const startNatH  = (el.naturalH as number) || Math.max(1, startH);
    const startImgScale = (el.imgScale as number) ?? Math.max(startW / startNatW, startH / startNatH);
    const startCropX = (el.cropX as number) ?? (startW - startNatW * startImgScale) / 2;
    const startCropY = (el.cropY as number) ?? (startH - startNatH * startImgScale) / 2;
    const startRuns   = Array.isArray(el.runs) ? (el.runs as Array<Record<string, unknown>>).map(r => ({ ...r })) : null;
    const elType      = el.type;
    const startCustomPts = elType === 'vector' && el.shape === 'custom' && Array.isArray(el.points)
      ? (el.points as Array<{x:number;y:number;cpIn?:{x:number;y:number};cpOut?:{x:number;y:number}}>).map(p => ({ x:p.x, y:p.y, cpIn: p.cpIn ? {...p.cpIn} : undefined, cpOut: p.cpOut ? {...p.cpOut} : undefined }))
      : null;
    const startPtMinX = startCustomPts ? Math.min(...startCustomPts.map(p => p.x)) : 0;
    const startPtMinY = startCustomPts ? Math.min(...startCustomPts.map(p => p.y)) : 0;

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

        // ── Vector custom path — scale all points proportionally ──────────────
        if (elType === 'vector' && startCustomPts) {
          let nw = startW, nh = startH;
          let origin = { x: startElX, y: startElY };
          const isCorner = ['tl','tr','bl','br'].includes(handleId);
          if (isCorner) {
            switch (handleId) {
              case 'br': nw = startW + ldx; nh = startH + ldy; break;
              case 'tr': nw = startW + ldx; nh = startH - ldy; break;
              case 'bl': nw = startW - ldx; nh = startH + ldy; break;
              case 'tl': nw = startW - ldx; nh = startH - ldy; break;
            }
          } else {
            switch (handleId) {
              case 'mr': nw = startW + ldx; break;
              case 'ml': nw = startW - ldx; origin = shiftOrigin(ldx, 0); break;
              case 'bc': nh = startH + ldy; break;
              case 'tc': nh = startH - ldy; origin = shiftOrigin(0, ldy); break;
            }
          }
          nw = Math.max(20, nw); nh = Math.max(20, nh);
          if (isCorner) {
            switch (handleId) {
              case 'tr': origin = shiftOrigin(0, startH - nh); break;
              case 'bl': origin = shiftOrigin(startW - nw, 0); break;
              case 'tl': origin = shiftOrigin(startW - nw, startH - nh); break;
            }
          }
          const sx = nw / Math.max(1, startW);
          const sy = nh / Math.max(1, startH);
          const newPts = startCustomPts.map(p => ({
            x: startPtMinX + (p.x - startPtMinX) * sx,
            y: startPtMinY + (p.y - startPtMinY) * sy,
            ...(p.cpIn  ? { cpIn:  { x: startPtMinX + (p.cpIn.x  - startPtMinX) * sx, y: startPtMinY + (p.cpIn.y  - startPtMinY) * sy } } : {}),
            ...(p.cpOut ? { cpOut: { x: startPtMinX + (p.cpOut.x - startPtMinX) * sx, y: startPtMinY + (p.cpOut.y - startPtMinY) * sy } } : {}),
          }));
          onChangeRef.current({ x: origin.x, y: origin.y, points: newPts });
          return;
        }

        // ── Text: corner handles scale fontSize proportionally, mid handles width-only ──
        if (elType === 'text') {
          const pullsLeft = ['ml', 'bl', 'tl'].includes(handleId);
          let nw = pullsLeft ? startW - ldx : startW + ldx;
          nw = Math.max(20, nw);
          const isCornerHandle = ['tl', 'tr', 'bl', 'br'].includes(handleId);

          if (isCornerHandle) {
            // Mise à l'échelle homogène : un seul ratio pilote police, largeur,
            // marges internes et interlettrage. On dérive la largeur de la taille
            // de police RETENUE (et non l'inverse) : sinon l'arrondi de fontSize
            // désynchronise les deux et le texte repasse à la ligne en cours de
            // glissement. Les marges suivent le même ratio, ce qui garde la zone
            // de texte (largeur - 2*padding) proportionnelle et donc la coupure
            // de lignes strictement identique.
            const newFontSize = Math.max(8, Math.round(startFontSize * (nw / startW) * 100) / 100);
            const r = newFontSize / startFontSize;
            const lockedW = Math.max(20, startW * r);
            const lockedH = startH * r;
            const origin = shiftOrigin(
              pullsLeft ? startW - lockedW : 0,
              ['tl', 'tr'].includes(handleId) ? startH - lockedH : 0,
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const patch: Record<string, any> = {
              x: origin.x, y: origin.y, width: lockedW, fontSize: newFontSize,
            };
            if (startPadding  != null) patch.padding  = startPadding  * r;
            if (startPaddingH != null) patch.paddingH = startPaddingH * r;
            if (startPaddingV != null) patch.paddingV = startPaddingV * r;
            if (startLetterSpacing) patch.letterSpacing = startLetterSpacing * r;
            // Les morceaux stylés portent des tailles absolues : sans ça, un mot
            // agrandi restait à sa taille pendant qu'on redimensionnait le bloc.
            if (startRuns?.length) patch.runs = startRuns.map(run => ({
              ...run,
              ...(typeof run.fontSize === 'number' ? { fontSize: Math.max(8, run.fontSize * r) } : {}),
              ...(typeof run.letterSpacing === 'number' && run.letterSpacing ? { letterSpacing: run.letterSpacing * r } : {}),
            }));
            onChangeRef.current(patch);
          } else {
            // Poignées latérales : largeur seule, la police ne bouge pas.
            const origin = shiftOrigin(pullsLeft ? startW - nw : 0, 0);
            onChangeRef.current({ x: origin.x, y: origin.y, width: nw });
          }
          return;
        }

        // ── Rect / Image — proportional corners, single-axis midpoints ────────
        let nw = startW, nh = startH;
        let origin = { x: startElX, y: startElY };

        const isCorner = ['tl', 'tr', 'bl', 'br'].includes(handleId);

        if (isCorner) {
          // Step 1: raw resize per corner
          switch (handleId) {
            case 'br': nw = startW + ldx; nh = startH + ldy; break;
            case 'tr': nw = startW + ldx; nh = startH - ldy; break;
            case 'bl': nw = startW - ldx; nh = startH + ldy; break;
            case 'tl': nw = startW - ldx; nh = startH - ldy; break;
          }
          // Step 2: proportions conservées — au Shift/Cmd pour les formes, et
          // TOUJOURS pour une photo : un coin l'agrandit, il ne l'étire pas.
          if ((ev.shiftKey || ev.metaKey || isImage) && startRatio > 0) {
            const relW = Math.abs(nw / startW - 1);
            const relH = Math.abs(nh / startH - 1);
            if (relW >= relH) { nh = nw * startRatio; }
            else { nw = nh / startRatio; }
          }
          // Step 3: clamp
          nw = Math.max(20, nw);
          nh = Math.max(20, nh);
          // Step 4: recalculate origin per corner
          switch (handleId) {
            case 'tr': origin = shiftOrigin(0, startH - nh); break;
            case 'bl': origin = shiftOrigin(startW - nw, 0); break;
            case 'tl': origin = shiftOrigin(startW - nw, startH - nh); break;
          }
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

        if (isImage) {
          /* Deux gestes, comme dans les éditeurs que tout le monde connaît :

             - un COIN agrandit ou réduit la photo. Le cadre et l'image changent
               de taille ensemble, dans les mêmes proportions : le cadrage reste
               exactement le même, il est simplement plus grand. Sans ça, il n'y
               avait plus AUCUN moyen d'agrandir une image — le reproche de
               Martin après le correctif précédent, où les huit poignées
               recadraient.
             - un BORD recadre. Le cadre vient couper dans la photo, qui ne
               bouge pas d'un pixel. */
          if (isCorner) {
            const r = nw / Math.max(1, startW);   // proportions verrouillées : un seul ratio
            onChangeRef.current({
              x: origin.x, y: origin.y, width: nw, height: nh,
              imgScale: startImgScale * r,
              cropX: startCropX * r,
              cropY: startCropY * r,
            });
            return;
          }
          // Le bord tiré déplace l'origine du cadre : on retire ce même
          // déplacement au décalage de l'image, donc elle reste où elle est à
          // l'écran et le cadre vient couper dedans. Les bords opposés (bas,
          // droite) ne déplacent pas l'origine : rien à compenser.
          const pullsLeft = handleId === 'ml';
          const pullsTop  = handleId === 'tc';
          // Le zoom reste celui d'avant la poignée : recadrer n'agrandit pas la
          // photo, il découvre ou masque du cadre.
          let scale = startImgScale;
          let cx = startCropX - (pullsLeft ? startW - nw : 0);
          let cy = startCropY - (pullsTop ? startH - nh : 0);
          /* SAUF quand le cadre sort de la photo. Une fois la photo découverte
             en entier, continuer à tirer le bord ne doit pas faire apparaître
             du vide : la photo grandit juste ce qu'il faut pour couvrir, et
             c'est l'autre axe qui se recadre pour compenser. Le zoom se prend
             autour du centre du cadre, sinon le sujet saute d'un coup. */
          const couverture = Math.max(nw / startNatW, nh / startNatH);
          if (couverture > scale) {
            const r = couverture / scale;
            cx = nw / 2 - (nw / 2 - cx) * r;
            cy = nh / 2 - (nh / 2 - cy) * r;
            scale = couverture;
          }
          // Et le décalage reste dans les bornes : aucun bord ne laisse de vide.
          const vueW = startNatW * scale, vueH = startNatH * scale;
          cx = Math.min(0, Math.max(nw - vueW, cx));
          cy = Math.min(0, Math.max(nh - vueH, cy));
          onChangeRef.current({
            x: origin.x, y: origin.y, width: nw, height: nh,
            imgScale: scale, cropX: cx, cropY: cy,
          });
          return;
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

  // ── Arrondi des coins ───────────────────────────────────────────────────────
  // Quatre points posés dans les coins, comme dans Illustrator : on les tire vers
  // le centre pour arrondir. Le glissement suit la diagonale du coin saisi, et la
  // valeur reste commune aux quatre coins (un seul cornerRadius par objet).

  // Les formes de l'éditeur sont des éléments `vector` : sans elles, les points
  // d'arrondi n'apparaissaient sur aucun rectangle réellement dessinable.
  const canRound = el.type === 'rect' || el.type === 'image'
    || (el.type === 'vector' && el.shape === 'rectangle');
  const maxRadius = Math.max(0, Math.min(w, h) / 2);
  const radius = Math.max(0, Math.min(Number(el.cornerRadius) || 0, maxRadius));
  // Distance du point à son coin : le rayon lui-même, avec un plancher pour rester
  // attrapable quand l'objet a les coins nets.
  const roundInset = Math.min(Math.max(radius, 10), Math.max(10, maxRadius - 2));

  const startRound = (corner: 'tl' | 'tr' | 'bl' | 'br') => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startRadius = radius;
    const rot = rotation;
    const cap = maxRadius;

    const onMove = (ev: MouseEvent) => {
      try {
        const z = zoomRef.current || 1;
        const [ldx, ldy] = toLocal((ev.clientX - startX) / z, (ev.clientY - startY) / z, rot);
        // Projection sur la diagonale qui rentre dans l'objet depuis ce coin.
        const sx = corner === 'tl' || corner === 'bl' ? 1 : -1;
        const sy = corner === 'tl' || corner === 'tr' ? 1 : -1;
        const d = (ldx * sx + ldy * sy) / 2;
        const next = Math.round(Math.max(0, Math.min(startRadius + d, cap)));
        setLiveRadius(next);
        onChangeRef.current({ cornerRadius: next });
      } catch (err) {
        console.error('[SelectionOverlay] round move error:', err);
      }
    };
    const onUp = () => {
      setLiveRadius(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onDragEndRef.current?.();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const ROUND_CORNERS: { id: 'tl' | 'tr' | 'bl' | 'br'; style: React.CSSProperties }[] = [
    { id: 'tl', style: { left: roundInset - 5, top: roundInset - 5 } },
    { id: 'tr', style: { right: roundInset - 5, top: roundInset - 5 } },
    { id: 'br', style: { right: roundInset - 5, bottom: roundInset - 5 } },
    { id: 'bl', style: { left: roundInset - 5, bottom: roundInset - 5 } },
  ];

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
        border: '2px solid var(--vio)',
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
        background: 'var(--vio)',
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

      {/* Points d'arrondi — un par coin, tirés vers le centre pour arrondir */}
      {canRound && maxRadius > 12 && ROUND_CORNERS.map(c => (
        <div
          key={`r-${c.id}`}
          onMouseDown={startRound(c.id)}
          title="Arrondir les coins"
          style={{
            position: 'absolute',
            width: 10, height: 10,
            background: 'var(--mint-2, #2FD79B)',
            border: '1.5px solid #FFFFFF',
            borderRadius: '50%',
            boxShadow: '0 1px 3px rgba(13,15,10,.3)',
            cursor: 'pointer',
            pointerEvents: 'auto',
            ...c.style,
          }}
        />
      ))}

      {/* Valeur d'arrondi pendant le glissement */}
      {liveRadius !== null && (
        <div style={{
          position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
          background: '#0C2A1D', color: '#EEEDE3', borderRadius: 6, padding: '3px 8px',
          fontFamily: "'Cabinet Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 11,
          whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 200,
          boxShadow: '0 2px 6px rgba(13,15,10,.28)',
        }}>
          Arrondi {liveRadius}px
        </div>
      )}

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
