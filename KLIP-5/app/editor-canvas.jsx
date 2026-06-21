/* editor-canvas.jsx — the post canvas: element rendering, selection overlay,
   drag / resize / rotate. Selection chrome lives in a non-scaled overlay so
   handles stay a constant size at any zoom. */

/* measured height for auto-height (text / brand) elements */
function elHeight(el, heights) {
  if (el.type === 'text' || el.type === 'brand') return heights[el.id] || el.size * 1.2;
  return el.h;
}

/* ── one element on the page ───────────────────────────────────── */
function ElementView({ el, selected, editing, accent, dimmed, playing, onPointerDown, onDblClick, onMeasure, onCommitText }) {
  const ref = useRef(null);
  React.useLayoutEffect(() => {
    if ((el.type === 'text' || el.type === 'brand') && ref.current) onMeasure(el.id, ref.current.offsetHeight);
  });

  const base = {
    position: 'absolute', left: el.x, top: el.y,
    transform: `rotate(${el.rot || 0}deg)`, transformOrigin: 'center',
    opacity: (el.opacity ?? 100) / 100,
    cursor: el.locked ? 'default' : 'move',
    touchAction: 'none',
  };
  const animClass = playing && el.anim && el.anim !== 'none' ? `canim-${el.anim}` : '';

  if (el.type === 'text') {
    const eff = effectStyle(el.effect, el.color, accent);
    const deco = [el.underline && 'underline', el.strike && 'line-through'].filter(Boolean).join(' ') || 'none';
    return (
      <div style={{ ...base, width: el.w }} className={animClass} onPointerDown={(e) => onPointerDown(e, el)} onDoubleClick={(e) => onDblClick(e, el)}>
        <div ref={ref} contentEditable={editing} suppressContentEditableWarning data-edit-id={el.id}
          onBlur={(e) => onCommitText(el.id, e.currentTarget.innerText)}
          onPointerDown={(e) => { if (editing) e.stopPropagation(); }}
          spellCheck={false}
          style={{
            fontFamily: fontCss(el.font), fontSize: el.size, fontWeight: el.weight, fontStyle: el.italic ? 'italic' : 'normal',
            textDecoration: deco, color: el.color, textAlign: el.align, lineHeight: el.lineH, letterSpacing: `${el.letter}em`,
            textTransform: el.uppercase ? 'uppercase' : 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            outline: 'none', cursor: editing ? 'text' : 'inherit', userSelect: editing ? 'text' : 'none', ...eff,
          }}>
          {el.text}
        </div>
      </div>
    );
  }

  if (el.type === 'brand') {
    return (
      <div style={{ ...base, width: el.w }} className={animClass} onPointerDown={(e) => onPointerDown(e, el)} onDoubleClick={(e) => onDblClick(e, el)}>
        <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: el.size * 0.5 }}>
          <span style={{ width: el.size * 1.18, height: el.size * 1.18, borderRadius: '50%', background: el.color, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
            <span style={{ width: el.size * 0.42, height: el.size * 0.42, borderRadius: '50%', background: 'rgba(20,22,15,.28)' }} />
          </span>
          <span contentEditable={editing} suppressContentEditableWarning spellCheck={false} data-edit-id={el.id}
            onPointerDown={(e) => { if (editing) e.stopPropagation(); }}
            onBlur={(e) => onCommitText(el.id, e.currentTarget.innerText)}
            style={{ fontFamily: fontCss('cabinet'), fontWeight: 800, fontSize: el.size, letterSpacing: '0.12em', color: el.color, outline: 'none', whiteSpace: 'nowrap', userSelect: editing ? 'text' : 'none' }}>
            {el.text}
          </span>
        </div>
      </div>
    );
  }

  if (el.type === 'shape') {
    const clip = {
      triangle: 'polygon(50% 0,100% 100%,0 100%)',
      star: 'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
    }[el.shape];
    const radius = el.shape === 'circle' ? '50%' : el.shape === 'pill' || el.shape === 'line' ? el.h / 2 : el.radius;
    return (
      <div style={{ ...base, width: el.w, height: el.h }} className={animClass} onPointerDown={(e) => onPointerDown(e, el)}>
        <div style={{ width: '100%', height: '100%', background: el.fill, borderRadius: clip ? 0 : radius, clipPath: clip, display: 'grid', placeItems: 'center' }}>
          {el.text && <span style={{ fontFamily: fontCss('cabinet'), fontWeight: 800, fontSize: Math.min(el.h * 0.34, 22), letterSpacing: '0.1em', color: el.textColor || '#14160F', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{el.text}</span>}
        </div>
      </div>
    );
  }

  if (el.type === 'image') {
    return (
      <div style={{ ...base, width: el.w, height: el.h }} className={animClass} onPointerDown={(e) => onPointerDown(e, el)}>
        <div style={{ width: '100%', height: '100%', borderRadius: el.radius, overflow: 'hidden', background: el.src ? 'none' : 'rgba(238,237,227,.10)',
          border: el.src ? 'none' : '1.5px dashed rgba(238,237,227,.5)', display: 'grid', placeItems: 'center', position: 'relative' }}>
          {el.src
            ? <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: el.fit, transform: el.flip ? 'scaleX(-1)' : 'none' }} draggable={false} />
            : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, color: 'rgba(238,237,227,.75)', pointerEvents: 'none', lineHeight: 1.25 }}>
                <EdIcon name="image" size={34} stroke={1.5} />
                <span style={{ fontFamily: fontCss('cabinet'), fontWeight: 800, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase' }}>{el.label || 'Photo'}</span>
                <span style={{ fontFamily: "'Satoshi',sans-serif", fontSize: 12.5, opacity: .8, marginTop: -2 }}>Double-clic pour importer</span>
              </div>}
        </div>
      </div>
    );
  }
  return null;
}

/* ── selection overlay (screen-space, constant-size handles) ────── */
function SelectionOverlay({ el, box, zoom, accent, locked, actions, onResizeStart, onRotateStart }) {
  const HS = 13;                       // handle hit size (screen px)
  const corners = ['nw', 'ne', 'se', 'sw'];
  const edges = el.type === 'image' || el.type === 'shape' ? ['n', 'e', 's', 'w'] : (el.type === 'text' ? ['e', 'w'] : []);
  const showHandles = !locked;

  const handlePos = (h) => {
    const map = {
      nw: [0, 0], n: [.5, 0], ne: [1, 0], e: [1, .5], se: [1, 1], s: [.5, 1], sw: [0, 1], w: [0, .5],
    };
    const [fx, fy] = map[h];
    return { left: box.w * fx, top: box.h * fy };
  };
  const cursorFor = (h) => ({ nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }[h]);

  return (
    <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h,
      transform: `rotate(${el.rot || 0}deg)`, transformOrigin: 'center', pointerEvents: 'none', zIndex: 40 }}>
      {/* bounding border */}
      <div style={{ position: 'absolute', inset: 0, border: `2px solid ${accent}`, borderRadius: 3, boxShadow: '0 0 0 1px rgba(255,255,255,.5)' }} />

      {locked && (
        <div style={{ position: 'absolute', top: -11, left: -11, width: 24, height: 24, borderRadius: '50%', background: accent, color: '#fff', display: 'grid', placeItems: 'center', pointerEvents: 'none', boxShadow: '0 2px 6px rgba(0,0,0,.25)' }}>
          <EdIcon name="lock" size={13} />
        </div>
      )}

      {showHandles && <>
        {/* rotate handle */}
        <div onPointerDown={onRotateStart} title="Pivoter"
          style={{ position: 'absolute', left: '50%', top: -34, width: 26, height: 26, marginLeft: -13, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 7px rgba(13,15,10,.28)', display: 'grid', placeItems: 'center', cursor: 'grab', pointerEvents: 'auto', color: '#5A5E50' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4"/></svg>
        </div>
        <div style={{ position: 'absolute', left: '50%', top: -8, width: 2, height: 8, marginLeft: -1, background: accent }} />

        {/* edge handles (bars) */}
        {edges.map(h => {
          const pos = handlePos(h);
          const vert = h === 'e' || h === 'w';
          return <div key={h} onPointerDown={(e) => onResizeStart(e, h)} style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%,-50%)',
            width: vert ? 8 : 26, height: vert ? 26 : 8, borderRadius: 6, background: '#fff', border: `1.5px solid ${accent}`, cursor: cursorFor(h), pointerEvents: 'auto', boxShadow: '0 1px 3px rgba(13,15,10,.22)' }} />;
        })}
        {/* corner handles (dots) */}
        {corners.map(h => {
          const pos = handlePos(h);
          return <div key={h} onPointerDown={(e) => onResizeStart(e, h)} style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%,-50%)',
            width: HS, height: HS, borderRadius: '50%', background: '#fff', border: `1.5px solid ${accent}`, cursor: cursorFor(h), pointerEvents: 'auto', boxShadow: '0 1px 3px rgba(13,15,10,.22)' }} />;
        })}
      </>}
    </div>
  );
}

/* small floating action pill above the selection (screen space) */
function SelectionPill({ box, el, locked, actions, accent }) {
  const Btn = ({ name, label, onClick, danger }) => (
    <button title={label} onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: danger ? '#C4452F' : '#3a3d33', background: 'transparent', transition: 'background .12s' }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#F1F0E8'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <EdIcon name={name} size={16.5} />
    </button>
  );
  return (
    <div style={{ position: 'absolute', left: box.x + box.w / 2, top: box.y - 50, transform: 'translateX(-50%)', zIndex: 55, pointerEvents: 'auto' }}>
      <div className="pop-in" style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#fff', borderRadius: 11, padding: '5px 6px', boxShadow: '0 10px 30px -8px rgba(13,15,10,.35), 0 0 0 1px rgba(13,15,10,.05)' }}>
        <button onClick={(e) => { e.stopPropagation(); actions.magic(el.id); }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px 0 9px', height: 30, borderRadius: 8, color: '#14160F', fontFamily: "'Satoshi',sans-serif", fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', background: 'linear-gradient(120deg,#2FD79B22,#C8F13522)' }}>
          <span style={{ width: 19, height: 19, borderRadius: '50%', background: 'conic-gradient(from 120deg,#2FD79B,#C8F135,#2FD79B)', display: 'grid', placeItems: 'center' }}>
            <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center' }}><EdIcon name="magic" size={9} style={{ color: '#14160F' }} /></span>
          </span>
          Demander à Klip
        </button>
        <span style={{ width: 1, height: 18, background: '#E4E3D7' }} />
        <Btn name="comment" label="Commenter" onClick={() => actions.comment(el.id)} />
        <Btn name={locked ? 'unlock' : 'lock'} label={locked ? 'Déverrouiller' : 'Verrouiller'} onClick={() => actions.toggleLock(el.id)} />
        <Btn name="copy" label="Dupliquer" onClick={() => actions.duplicate(el.id)} />
        <Btn name="trash" label="Supprimer" danger onClick={() => actions.remove(el.id)} />
        <Btn name="dots" label="Plus" onClick={() => actions.more(el.id)} />
      </div>
    </div>
  );
}

/* ── the workspace canvas ──────────────────────────────────────── */
function CanvasStage({ doc, els, selId, editingId, zoom, accent, theme, playing, frameRef,
  onSelect, onDeselect, onChange, onStartEdit, onCommitText, actions }) {
  const [heights, setHeights] = useState({});
  const wrapRef = useRef(null);
  const dragRef = useRef(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const elsRef = useRef(els);
  elsRef.current = els;

  const onMeasure = useCallback((id, h) => setHeights(prev => (prev[id] === h ? prev : { ...prev, [id]: h })), []);

  const sel = els.find(e => e.id === selId) || null;

  const endDrag = () => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current; if (!d) return;
    const z = zoomRef.current;
    const dx = (e.clientX - d.sx) / z, dy = (e.clientY - d.sy) / z;
    const el = elsRef.current.find(x => x.id === d.id); if (!el) return;

    if (d.mode === 'move') { onChange(d.id, { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) }); return; }

    if (d.mode === 'rotate') {
      const r = wrapRef.current.getBoundingClientRect();
      const cx = r.left + (d.cx) * z, cy = r.top + (d.cy) * z;
      let ang = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90;
      if (e.shiftKey) ang = Math.round(ang / 15) * 15;
      onChange(d.id, { rot: Math.round(ang) }); return;
    }

    if (d.mode === 'resize') {
      const h = d.handle, b = d.box;
      if (el.type === 'text' || el.type === 'brand') {
        const dw = h.includes('w') ? -dx : (h.includes('e') ? dx : (h === 'n' || h === 's' ? 0 : dx));
        if (h === 'e' || h === 'w') {                       // width only
          onChange(d.id, { w: Math.max(60, Math.round(b.w + (h === 'w' ? -dx : dx))) });
        } else {                                            // corner → scale font + width
          const factor = Math.max(0.2, (b.w + dw) / b.w);
          onChange(d.id, { w: Math.round(b.w * factor), size: Math.max(8, Math.round(b.fs * factor)) });
        }
        return;
      }
      let { x, y, w, hh } = { x: b.x, y: b.y, w: b.w, hh: b.h };
      if (h.includes('e')) w = b.w + dx;
      if (h.includes('s')) hh = b.h + dy;
      if (h.includes('w')) { w = b.w - dx; x = b.x + dx; }
      if (h.includes('n')) { hh = b.h - dy; y = b.y + dy; }
      if (w < 30) { w = 30; x = h.includes('w') ? b.x + b.w - 30 : b.x; }
      if (hh < 30) { hh = 30; y = h.includes('n') ? b.y + b.h - 30 : b.y; }
      onChange(d.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) });
    }
  };

  const startMove = (e, el) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (editingId === el.id) return;          // editing text → let caret work
    onSelect(el.id);
    if (el.locked) return;
    dragRef.current = { mode: 'move', id: el.id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
  };
  const startResize = (e, handle) => {
    e.stopPropagation(); e.preventDefault();
    const el = sel; if (!el) return;
    dragRef.current = { mode: 'resize', handle, id: el.id, sx: e.clientX, sy: e.clientY,
      box: { x: el.x, y: el.y, w: el.w, h: elHeight(el, heights), fs: el.size } };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
  };
  const startRotate = (e) => {
    e.stopPropagation(); e.preventDefault();
    const el = sel; if (!el) return;
    const eh = elHeight(el, heights);
    dragRef.current = { mode: 'rotate', id: el.id, sx: e.clientX, sy: e.clientY, cx: el.x + el.w / 2, cy: el.y + eh / 2 };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
  };
  const onDbl = (e, el) => { if (el.locked) return; e.stopPropagation(); onStartEdit(el.id); };

  useEffect(() => () => endDrag(), []);

  const box = sel ? { x: sel.x, y: sel.y, w: sel.w, h: elHeight(sel, heights) } : null;
  const screenBox = box ? { x: box.x * zoom, y: box.y * zoom, w: box.w * zoom, h: box.h * zoom } : null;

  return (
    <div ref={wrapRef} onPointerDown={onDeselect}
      style={{ position: 'relative', width: CW * zoom, height: CH * zoom, flexShrink: 0 }}>
      {/* scaled page */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: CW, height: CH, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
        <div ref={frameRef} style={{ width: CW, height: CH, background: doc.bg, borderRadius: theme.frameRadius, overflow: 'hidden', position: 'relative', boxShadow: theme.frameShadow }}>
          {els.map(el => (
            <ElementView key={el.id} el={el} accent={accent} playing={playing}
              selected={el.id === selId} editing={el.id === editingId}
              onPointerDown={startMove} onDblClick={onDbl} onMeasure={onMeasure} onCommitText={onCommitText} />
          ))}
        </div>
      </div>

      {/* non-scaled chrome overlay */}
      {sel && screenBox && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <SelectionOverlay el={sel} box={screenBox} zoom={zoom} accent={accent} locked={sel.locked}
            actions={actions} onResizeStart={startResize} onRotateStart={startRotate} />
          {editingId !== sel.id && <SelectionPill box={screenBox} el={sel} locked={sel.locked} actions={actions} accent={accent} />}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { CanvasStage, ElementView, SelectionOverlay, SelectionPill, elHeight });
