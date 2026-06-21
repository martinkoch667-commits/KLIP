/* screen-editor.jsx — Canva-style post editor for KLIP.
   Orchestrates the document model, selection, history, zoom and the chrome. */

const ED_THEMES = {
  atelier: { name: 'Atelier',  ws: 'radial-gradient(120% 80% at 50% -10%, #FBFAF4, #ECEBE1 70%)', rail: 'var(--white)', frameRadius: 22, frameShadow: '0 30px 70px -30px rgba(13,15,10,.5)', dark: false },
  studio:  { name: 'Studio',   ws: 'radial-gradient(120% 90% at 50% -10%, #16271E, #0A1812 75%)', rail: 'var(--white)', frameRadius: 22, frameShadow: '0 40px 90px -30px rgba(0,0,0,.7)', dark: true },
  lumiere: { name: 'Lumière',  ws: '#F6F5EE', rail: 'var(--white)', frameRadius: 8, frameShadow: '0 18px 44px -22px rgba(13,15,10,.42)', dark: false },
};

function Editor({ post, active, setRoute, toast, embedded, onBack, onSave, theme: themeKey = 'atelier', accent = '#C8F135', showLabels = false }) {
  const cid = post && post.client ? post.client : (active && active !== 'all' ? active : 'lou');
  const client = clientById(cid);
  const theme = ED_THEMES[themeKey] || ED_THEMES.atelier;

  const initial = useMemo(() => defaultDoc(client, post && post.grad), [client.id]);
  const [bg, setBg] = useState(initial.bg);
  const [els, setEls] = useState(initial.els);
  const [selId, setSelId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [tool, setTool] = useState('design');
  const [zoom, setZoom] = useState(0.5);
  const [playing, setPlaying] = useState(false);

  // reset document when the client changes
  useEffect(() => { setBg(initial.bg); setEls(initial.els); setSelId(null); setEditingId(null); }, [client.id]);

  const elsRef = useRef(els); elsRef.current = els;
  const past = useRef([]); const future = useRef([]);
  const snapshot = useCallback(() => { past.current.push(elsRef.current); if (past.current.length > 60) past.current.shift(); future.current = []; }, []);
  const undo = () => { if (!past.current.length) return; future.current.push(elsRef.current); setEls(past.current.pop()); setSelId(null); };
  const redo = () => { if (!future.current.length) return; past.current.push(elsRef.current); setEls(future.current.pop()); setSelId(null); };

  const wsRef = useRef(null);
  const frameRef = useRef(null);
  const replaceRef = useRef(null);
  const pendingReplace = useRef(null);
  const playTimer = useRef(null);

  /* fit-to-viewport zoom */
  const fit = useCallback(() => {
    const ws = wsRef.current; if (!ws) return;
    const z = Math.min((ws.clientWidth - 130) / CW, (ws.clientHeight - 90) / CH);
    setZoom(Math.max(0.18, Math.min(1.2, +z.toFixed(3))));
  }, []);
  useEffect(() => { fit(); const ro = new ResizeObserver(() => fit()); if (wsRef.current) ro.observe(wsRef.current); return () => ro.disconnect(); }, [fit]);

  /* focus inline editor on edit start */
  useEffect(() => {
    if (!editingId) return;
    const t = requestAnimationFrame(() => {
      const node = document.querySelector(`[data-edit-id="${editingId}"]`);
      if (node) { node.focus(); const r = document.createRange(); r.selectNodeContents(node); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
    });
    return () => cancelAnimationFrame(t);
  }, [editingId]);

  /* ── mutations ─────────────────────────────────────────────── */
  const update = useCallback((id, patch) => setEls(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e)), []);
  const select = useCallback((id) => { setSelId(id); if (id !== editingId) setEditingId(null); }, [editingId]);
  const deselect = useCallback((e) => { if (e && e.target.closest('[data-stop-deselect]')) return; setSelId(null); setEditingId(null); }, []);
  const startEdit = useCallback((id) => { setSelId(id); setEditingId(id); }, []);
  const commitText = useCallback((id, text) => { setEls(prev => prev.map(e => e.id === id ? { ...e, text } : e)); setEditingId(cur => cur === id ? null : cur); }, []);

  const center = (w, h) => ({ x: Math.round((CW - w) / 2), y: Math.round((CH - h) / 2) });
  const add = (el) => { snapshot(); const id = eid(); setEls(prev => [...prev, { id, rot: 0, opacity: 100, locked: false, ...el }]); setSelId(id); setEditingId(null); return id; };

  const api = {
    update, toast,
    snapshot,
    play: () => { setPlaying(false); clearTimeout(playTimer.current); requestAnimationFrame(() => { setPlaying(true); playTimer.current = setTimeout(() => setPlaying(false), 2600); }); },
    setBackground: (g) => { snapshot(); setBg(g); },
    addText: (kind) => {
      const presets = {
        title:    { font: 'archivo',    size: 84, weight: 800, italic: true,  text: 'Votre titre', w: 640, lineH: 0.98, color: theme.dark ? '#EEEDE3' : '#14160F' },
        subtitle: { font: 'instrument', size: 46, weight: 400, italic: false, text: 'Votre sous-titre', w: 540, lineH: 1.05, color: theme.dark ? '#EEEDE3' : '#14160F' },
        body:     { font: 'satoshi',    size: 28, weight: 500, italic: false, text: 'Votre texte ici', w: 460, lineH: 1.3, color: theme.dark ? 'rgba(238,237,227,.85)' : '#5A5E50' },
      };
      const pr = presets[kind] || presets.title;
      const c = center(pr.w, pr.size);
      add({ type: 'text', x: c.x, y: c.y, underline: false, strike: false, align: 'left', letter: -0.01, uppercase: false, effect: 'none', anim: 'none', ...pr, color: '#EEEDE3' });
    },
    addShape: (shape) => {
      const dims = { square: [280, 280], circle: [260, 260], pill: [300, 96], triangle: [280, 250], line: [380, 8], star: [240, 240] }[shape] || [260, 260];
      const c = center(dims[0], dims[1]);
      add({ type: 'shape', shape, x: c.x, y: c.y, w: dims[0], h: dims[1], fill: shape === 'line' ? '#EEEDE3' : accent, radius: 20 });
    },
    addBadge: (text, color) => {
      const w = Math.max(120, 56 + text.length * 15);
      const c = center(w, 56);
      add({ type: 'shape', shape: 'pill', x: c.x, y: c.y, w, h: 56, fill: color, radius: 28, text, textColor: '#14160F' });
    },
    addImageSlot: (w, h, label) => { const c = center(w, h); add({ type: 'image', x: c.x, y: c.y, w, h, radius: 18, src: null, fit: 'cover', label }); },
    addBrand: () => add({ type: 'brand', x: 56, y: 54, w: 320, h: 40, color: '#EEEDE3', size: 24, text: client.handle.replace('@', '').toUpperCase() }),
    importImage: (file) => {
      const url = URL.createObjectURL(file);
      const target = elsRef.current.find(e => e.id === selId && e.type === 'image');
      if (target) { snapshot(); update(target.id, { src: url }); }
      else { add({ type: 'image', ...center(620, 480), w: 620, h: 480, radius: 18, src: url, fit: 'cover' }); }
      toast && toast('Image importée');
    },
    replaceImage: (id) => { pendingReplace.current = id; replaceRef.current && replaceRef.current.click(); },
    applyColor: (c) => {
      const sel = elsRef.current.find(e => e.id === selId);
      if (!sel) { snapshot(); setBg(c); return; }
      snapshot();
      if (sel.type === 'text' || sel.type === 'brand') update(sel.id, { color: c });
      else if (sel.type === 'shape') update(sel.id, { fill: c });
    },
    applyFont: (f) => { const sel = elsRef.current.find(e => e.id === selId); if (sel && (sel.type === 'text' || sel.type === 'brand')) { snapshot(); update(sel.id, { font: f }); } else toast && toast('Sélectionnez un texte'); },
    duplicate: (id) => { snapshot(); const el = elsRef.current.find(e => e.id === id); if (!el) return; const nid = eid(); setEls(prev => [...prev, { ...el, id: nid, x: el.x + 28, y: el.y + 28 }]); setSelId(nid); },
    remove: (id) => { snapshot(); setEls(prev => prev.filter(e => e.id !== id)); setSelId(null); setEditingId(null); },
    toggleLock: (id) => { snapshot(); update(id, { locked: !elsRef.current.find(e => e.id === id).locked }); },
    layer: (id, op) => {
      snapshot();
      setEls(prev => {
        const i = prev.findIndex(e => e.id === id); if (i < 0) return prev;
        const arr = [...prev]; const [el] = arr.splice(i, 1);
        if (op === 'front') arr.push(el);
        else if (op === 'back') arr.unshift(el);
        else if (op === 'forward') arr.splice(Math.min(arr.length, i + 1), 0, el);
        else arr.splice(Math.max(0, i - 1), 0, el);
        return arr;
      });
    },
    alignPage: (id, op) => {
      snapshot();
      const el = elsRef.current.find(e => e.id === id); if (!el) return;
      const m = 56;
      if (op === 'hl') update(id, { x: m });
      else if (op === 'hc') update(id, { x: Math.round((CW - el.w) / 2) });
      else if (op === 'hr') update(id, { x: CW - el.w - m });
    },
    magic: () => toast && toast('Klip prépare 3 variantes de ce calque…'),
    comment: () => toast && toast('Commentaire ajouté au calque'),
    more: (id) => setTool('design'),
  };

  const sel = els.find(e => e.id === selId) || null;

  const saveBack = () => { if (onSave) { const t = els.find(e => e.type === 'text'); onSave({ title: t ? t.text : post.title, grad: bg }); } if (onBack) onBack(); };

  /* keyboard: delete / undo / redo / escape */
  useEffect(() => {
    const onKey = (e) => {
      const editing = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('contenteditable') === 'true';
      const inField = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (editing || inField) { if (e.key === 'Escape') document.activeElement.blur(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selId) { e.preventDefault(); api.remove(selId); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selId) { e.preventDefault(); api.duplicate(selId); }
      else if (e.key === 'Escape') setSelId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selId]);

  useEffect(() => () => clearTimeout(playTimer.current), []);

  return (
    <div className="screen-in ed-root" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: theme.ws }}>
      {/* editor header — holds the floating contextual toolbar */}
      <div data-stop-deselect style={{ minHeight: 60, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--line)', background: theme.dark ? 'rgba(11,24,18,.6)' : 'color-mix(in srgb, var(--canvas) 70%, transparent)', backdropFilter: 'blur(8px)', position: 'relative', zIndex: 30 }}>
        {embedded && <button className="btn btn-sm btn-ghost" onClick={saveBack} style={{ flexShrink: 0 }}><EdIcon name="chevL" size={15} /> Lot</button>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button onClick={undo} title="Annuler" className="ed-hbtn" style={{ color: theme.dark ? 'var(--cream-2)' : 'var(--ink-2)' }}><EdIcon name="undo" size={18} /></button>
          <button onClick={redo} title="Rétablir" className="ed-hbtn" style={{ color: theme.dark ? 'var(--cream-2)' : 'var(--ink-2)' }}><EdIcon name="redo" size={18} /></button>
        </div>
        <span style={{ width: 1, height: 24, background: theme.dark ? 'var(--cream-4)' : 'var(--line)', flexShrink: 0 }} />

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          {sel
            ? <ContextToolbar sel={sel} client={client} api={api} />
            : <span style={{ fontSize: 13, fontWeight: 600, color: theme.dark ? 'var(--cream-3)' : 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 8 }}><EdIcon name="text" size={15} /> Sélectionnez un calque pour le modifier</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-sm btn-ghost" style={{ height: 36, background: theme.dark ? 'rgba(238,237,227,.06)' : undefined, color: theme.dark ? 'var(--cream)' : undefined, boxShadow: theme.dark ? 'inset 0 0 0 1px var(--cream-4)' : undefined }} onClick={() => toast && toast('Aperçu — visuel prêt')}><EdIcon name="eye" size={15} /> Aperçu</button>
          {embedded
            ? <button className="btn btn-primary btn-sm" style={{ height: 36 }} onClick={saveBack}><EdIcon name="check" size={15} /> Enregistrer</button>
            : <button className="btn btn-primary btn-sm" style={{ height: 36 }} onClick={() => toast && toast('Visuel exporté · prêt à programmer')}><EdIcon name="upload" size={15} /> Partager</button>}
        </div>
      </div>

      {/* body: rail + panel + workspace */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div data-stop-deselect style={{ display: 'flex', flexShrink: 0 }}>
          <ToolRail tool={tool} setTool={setTool} showLabels={showLabels} />
          <ToolPanel tool={tool} client={client} api={api} sel={sel} onClose={() => setTool(null)} />
        </div>

        <div ref={wsRef} onPointerDown={deselect}
          style={{ flex: 1, minWidth: 0, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, position: 'relative' }}>
          <CanvasStage doc={{ bg }} els={els} selId={selId} editingId={editingId} zoom={zoom} accent="#8B5CF6"
            theme={theme} playing={playing} frameRef={frameRef}
            onSelect={select} onDeselect={deselect} onChange={update} onStartEdit={startEdit} onCommitText={commitText} actions={api} />
        </div>
      </div>

      <ZoomBar zoom={zoom} setZoom={setZoom} fit={fit} playing={playing} onPlay={api.play} client={client} />

      <input ref={replaceRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f && pendingReplace.current) { snapshot(); update(pendingReplace.current, { src: URL.createObjectURL(f) }); pendingReplace.current = null; } e.target.value = ''; }} />
    </div>
  );
}

Object.assign(window, { Editor, ED_THEMES });
