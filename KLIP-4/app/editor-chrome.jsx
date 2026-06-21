/* editor-chrome.jsx — tool rail + flyout panels, floating contextual toolbar,
   bottom zoom bar. Pure presentation wired to the Editor `api`. */

/* ───────────────────────── shared bits ───────────────────────── */
function useOutside(ref, onClose, active) {
  useEffect(() => {
    if (!active) return;
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [active]);
}

/* anchored popover under a toolbar control */
function Pop({ open, onClose, children, width = 260, align = 'left' }) {
  const ref = useRef(null);
  useOutside(ref, onClose, open);
  if (!open) return null;
  return (
    <div ref={ref} className="pop-in" style={{ position: 'absolute', top: 'calc(100% + 9px)', [align]: 0, width, zIndex: 80,
      background: '#fff', borderRadius: 14, padding: 12, boxShadow: '0 18px 44px -14px rgba(13,15,10,.34), 0 0 0 1px rgba(13,15,10,.06)' }}>
      {children}
    </div>
  );
}

const SwatchRow = ({ colors, value, onPick }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
    {colors.map((c, i) => (
      <button key={i} onClick={() => onPick(c)} title={c}
        style={{ width: 30, height: 30, borderRadius: 8, background: c, cursor: 'pointer',
          boxShadow: value === c ? '0 0 0 2.5px var(--mint-2)' : 'inset 0 0 0 1px rgba(13,15,10,.12)' }} />
    ))}
  </div>
);

const PLabel = ({ children }) => <div className="label" style={{ marginBottom: 9 }}>{children}</div>;

/* ───────────────────── left tool rail ─────────────────────────── */
const RAIL = [
  ['design', 'Modèles', 'template'],
  ['elements', 'Éléments', 'shapes'],
  ['text', 'Texte', 'text'],
  ['photos', 'Photos', 'image'],
  ['brand', 'Charte', 'palette'],
  ['upload', 'Importer', 'upload'],
];

function ToolRail({ tool, setTool, showLabels }) {
  return (
    <div style={{ width: showLabels ? 88 : 68, background: 'var(--white)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 4, flexShrink: 0, transition: 'width .18s' }}>
      {RAIL.map(([id, label, ic]) => {
        const on = tool === id;
        return (
          <button key={id} onClick={() => setTool(on ? null : id)} title={label}
            style={{ width: showLabels ? 76 : 50, height: showLabels ? 60 : 50, borderRadius: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: on ? 'var(--mint-soft)' : 'transparent', color: on ? 'var(--mint-2)' : 'var(--ink-2)', transition: 'all .14s' }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--sunk)'; }}
            onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
            <EdIcon name={ic} size={21} stroke={1.7} />
            {showLabels && <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 9.5, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────── flyout panel ───────────────────────────── */
function ToolPanel({ tool, client, api, sel, onClose }) {
  if (!tool) return null;
  const brand = brandPalette(client);
  const fileRef = useRef(null);

  const Head = ({ title, sub }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16 }}>
      <div>
        <h3 className="h-title" style={{ fontSize: 17 }}>{title}</h3>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={onClose} title="Fermer" style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sunk)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <EdIcon name="chevL" size={18} />
      </button>
    </div>
  );

  const SearchBar = ({ ph }) => (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <EdIcon name="search" size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--ink-3)' }} />
      <input className="input" placeholder={ph} style={{ paddingLeft: 36, height: 40, background: 'var(--sunk)', border: 'none' }} />
    </div>
  );

  let body = null;

  if (tool === 'design') {
    const bgs = [
      `linear-gradient(155deg, ${client.color}, ${shade(client.color, -58)})`,
      `linear-gradient(155deg, ${tint(client.color, 36)}, ${client.color})`,
      'linear-gradient(160deg,#14160F,#2b8d57)',
      'linear-gradient(160deg,#EEEDE3,#cfd3b0)',
      'linear-gradient(160deg,#C8F135,#7bbf12)',
      `linear-gradient(160deg, ${shade(client.color, -25)}, #14160F)`,
      'radial-gradient(120% 90% at 20% 10%, #2FD79B, #0B3B2A)',
      '#14160F',
      '#EEEDE3',
    ];
    body = <>
      <Head title="Modèles" sub={`Mises en page · ${client.name}`} />
      <SearchBar ph="Rechercher un modèle…" />
      <PLabel>Arrière-plans</PLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
        {bgs.map((g, i) => (
          <button key={i} onClick={() => api.setBackground(g)}
            style={{ aspectRatio: '4/5', borderRadius: 11, background: g, border: 'none', cursor: 'pointer', boxShadow: 'inset 0 0 0 1px rgba(13,15,10,.10)', transition: 'transform .12s' }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'} />
        ))}
      </div>
    </>;
  }

  if (tool === 'elements') {
    const shapes = [['square', 'Carré'], ['circle', 'Cercle'], ['pill', 'Pilule'], ['triangle', 'Triangle'], ['line', 'Ligne'], ['star', 'Étoile']];
    body = <>
      <Head title="Éléments" sub="Formes & blocs de couleur" />
      <SearchBar ph="Rechercher un élément…" />
      <PLabel>Formes</PLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9, marginBottom: 18 }}>
        {shapes.map(([s, label]) => (
          <button key={s} title={label} onClick={() => api.addShape(s)} className="well"
            style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)', transition: 'background .12s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--mint-soft)'} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--sunk)'}>
            <EdIcon name={s} size={30} stroke={1.6} />
          </button>
        ))}
      </div>
      <PLabel>Badges</PLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[['NOUVEAU', '#C8F135'], ['-20%', '#2FD79B'], ['RÉSA EN BIO', client.color]].map(([t, c], i) => (
          <button key={i} onClick={() => api.addBadge(t, c)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, background: 'var(--sunk)', cursor: 'pointer' }}>
            <span style={{ padding: '4px 11px', borderRadius: 99, background: c, color: '#14160F', fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, letterSpacing: '.08em' }}>{t}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}><EdIcon name="plus" size={16} /></span>
          </button>
        ))}
      </div>
    </>;
  }

  if (tool === 'text') {
    const combos = [
      ['Titre', { font: 'archivo', size: 88, weight: 800, italic: true }],
      ['Sous-titre', { font: 'instrument', size: 46, weight: 400, italic: false }],
      ['Corps de texte', { font: 'satoshi', size: 28, weight: 500, italic: false }],
    ];
    body = <>
      <Head title="Texte" />
      <button className="btn btn-dark" style={{ width: '100%', height: 44, marginBottom: 16 }} onClick={() => api.addText('title')}>
        <EdIcon name="plus" size={17} /> Ajouter une zone de texte
      </button>
      <PLabel>Styles rapides</PLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {combos.map(([label, props], i) => (
          <button key={i} onClick={() => api.addText(label === 'Titre' ? 'title' : label === 'Sous-titre' ? 'subtitle' : 'body')}
            style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 12, background: 'var(--sunk)', cursor: 'pointer', transition: 'background .12s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--mint-soft)'} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--sunk)'}>
            <span style={{ fontFamily: fontCss(props.font), fontWeight: props.weight, fontStyle: props.italic ? 'italic' : 'normal', fontSize: Math.min(props.size / 2.4, 30), color: 'var(--ink)', letterSpacing: '-0.02em' }}>{label}</span>
          </button>
        ))}
      </div>
    </>;
  }

  if (tool === 'photos') {
    const frames = [['Paysage', 752, 470], ['Portrait', 520, 660], ['Carré', 560, 560], ['Bandeau', 752, 240]];
    body = <>
      <Head title="Photos" sub="Cadres & import" />
      <button className="btn btn-primary" style={{ width: '100%', height: 44, marginBottom: 16 }} onClick={() => fileRef.current && fileRef.current.click()}>
        <EdIcon name="upload" size={17} /> Importer une photo
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) api.importImage(f); e.target.value = ''; }} />
      <PLabel>Ajouter un cadre</PLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 9 }}>
        {frames.map(([label, w, h], i) => (
          <button key={i} onClick={() => api.addImageSlot(w, h, label)} className="well"
            style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
            <span style={{ width: '100%', aspectRatio: `${w}/${h}`, maxHeight: 78, borderRadius: 8, background: 'rgba(13,15,10,.07)', border: '1.5px dashed var(--line)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
              <EdIcon name="image" size={20} stroke={1.5} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{label}</span>
          </button>
        ))}
      </div>
    </>;
  }

  if (tool === 'brand') {
    body = <>
      <Head title="Charte de marque" sub={client.name} />
      <PLabel>Couleurs</PLabel>
      <div style={{ marginBottom: 18 }}>
        <SwatchRow colors={brand} value={null} onPick={(c) => api.applyColor(c)} />
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8 }}>Applique au calque sélectionné, sinon à l’arrière-plan.</div>
      </div>
      <PLabel>Polices</PLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {[['archivo', 'Titres'], ['satoshi', 'Corps'], ['cabinet', 'Libellés']].map(([f, role]) => (
          <button key={f} onClick={() => api.applyFont(f)} className="well" style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '12px 14px', cursor: 'pointer' }}>
            <span style={{ fontFamily: fontCss(f), fontWeight: 800, fontSize: 20 }}>{fontLabel(f)}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 'auto' }}>{role}</span>
          </button>
        ))}
      </div>
      <PLabel>Logo</PLabel>
      <button onClick={() => api.addBrand()} className="well" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', width: '100%', cursor: 'pointer' }}>
        <Avatar initials={client.initials} color={client.color} size={34} radius={9} />
        <span style={{ fontWeight: 700 }}>{client.handle}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}><EdIcon name="plus" size={17} /></span>
      </button>
    </>;
  }

  if (tool === 'upload') {
    body = <>
      <Head title="Importer" />
      <button className="btn btn-primary" style={{ width: '100%', height: 44, marginBottom: 14 }} onClick={() => fileRef.current && fileRef.current.click()}>
        <EdIcon name="upload" size={17} /> Importer un fichier
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) api.importImage(f); e.target.value = ''; }} />
      <div onClick={() => fileRef.current && fileRef.current.click()}
        style={{ border: '1.5px dashed var(--line)', borderRadius: 14, padding: '34px 18px', textAlign: 'center', color: 'var(--ink-3)', cursor: 'pointer', background: 'var(--sunk)' }}>
        <EdIcon name="upload" size={26} stroke={1.5} style={{ marginBottom: 8 }} />
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-2)' }}>Glissez une image ici</div>
        <div style={{ fontSize: 12, marginTop: 3 }}>JPG, PNG · jusqu’à 20 Mo</div>
      </div>
    </>;
  }

  return (
    <div className="pop-in" style={{ width: 312, background: 'var(--white)', borderRight: '1px solid var(--line)', padding: 18, overflowY: 'auto', flexShrink: 0 }}>
      {body}
    </div>
  );
}

/* ───────────────── floating contextual toolbar ────────────────── */
function ContextToolbar({ sel, client, api }) {
  const [pop, setPop] = useState(null);
  const tgl = (id) => setPop(p => p === id ? null : id);
  const brand = brandPalette(client);
  const palette = [...brand, '#5A5E50', 'rgba(238,237,227,.82)'];

  if (!sel) return null;
  const u = (patch) => api.update(sel.id, patch);
  const isText = sel.type === 'text';
  const isBrand = sel.type === 'brand';
  const isShape = sel.type === 'shape';
  const isImage = sel.type === 'image';

  const Group = ({ children }) => <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>{children}</div>;
  const Div = () => <span style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 6px' }} />;
  const IBtn = ({ name, on, label, onClick, danger }) => (
    <button title={label} onClick={onClick}
      style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', color: danger ? '#C4452F' : on ? 'var(--mint-2)' : 'var(--ink)', background: on ? 'var(--mint-soft)' : 'transparent', transition: 'background .12s' }}
      onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--sunk)'; }}
      onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = on ? 'var(--mint-soft)' : 'transparent'; }}>
      <EdIcon name={name} size={18} />
    </button>
  );
  const TextBtn = ({ children, on, onClick }) => (
    <button onClick={onClick} style={{ height: 34, padding: '0 12px', borderRadius: 9, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, color: on ? 'var(--mint-2)' : 'var(--ink)', background: on ? 'var(--mint-soft)' : 'transparent', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
      onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--sunk)'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = on ? 'var(--mint-soft)' : 'transparent'; }}>
      {children}
    </button>
  );

  const colorVal = isShape ? sel.fill : sel.color;
  const setColor = (c) => isShape ? u({ fill: c }) : u({ color: c });

  return (
    <div className="pop-in" style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, background: '#fff', borderRadius: 13, padding: '6px 8px', boxShadow: '0 8px 26px -10px rgba(13,15,10,.28), 0 0 0 1px rgba(13,15,10,.05)', overflow: 'visible' }}>
      {(isText || isBrand) && <>
        {/* font family */}
        <Group>
          <button onClick={() => tgl('font')} style={{ height: 34, padding: '0 11px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--sunk)', minWidth: 134, maxWidth: 178, flexShrink: 0 }}>
            <span className="trunc" style={{ fontFamily: fontCss(sel.font), fontWeight: 600, fontSize: 13.5, flex: 1 }}>{fontLabel(sel.font)}</span>
            <EdIcon name="chevD" size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
          </button>
          <Pop open={pop === 'font'} onClose={() => setPop(null)} width={230}>
            <PLabel>Police</PLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {EFONTS.map(f => (
                <button key={f.id} onClick={() => { u({ font: f.id }); setPop(null); }}
                  style={{ display: 'flex', alignItems: 'center', padding: '9px 11px', borderRadius: 9, textAlign: 'left', background: sel.font === f.id ? 'var(--mint-soft)' : 'transparent' }}
                  onMouseEnter={(e) => { if (sel.font !== f.id) e.currentTarget.style.background = 'var(--sunk)'; }} onMouseLeave={(e) => { if (sel.font !== f.id) e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontFamily: f.css, fontSize: 17, fontWeight: 700 }}>{f.label}</span>
                  {sel.font === f.id && <EdIcon name="check" size={16} style={{ marginLeft: 'auto', color: 'var(--mint-2)' }} />}
                </button>
              ))}
            </div>
          </Pop>
        </Group>
        {/* size stepper */}
        <Group>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--sunk)', borderRadius: 9, marginLeft: 4, height: 34 }}>
            <button onClick={() => u({ size: Math.max(8, sel.size - 2) })} style={{ width: 30, height: 34, display: 'grid', placeItems: 'center', color: 'var(--ink)' }}><EdIcon name="minus" size={15} /></button>
            <input value={sel.size} onChange={(e) => { const v = parseInt(e.target.value) || 0; u({ size: Math.min(400, Math.max(0, v)) }); }}
              style={{ width: 38, textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 700, fontSize: 13.5, fontVariantNumeric: 'tabular-nums', outline: 'none' }} />
            <button onClick={() => u({ size: Math.min(400, sel.size + 2) })} style={{ width: 30, height: 34, display: 'grid', placeItems: 'center', color: 'var(--ink)' }}><EdIcon name="plus" size={15} /></button>
          </div>
        </Group>
        <Div />
      </>}

      {/* color */}
      <Group>
        <button onClick={() => tgl('color')} title="Couleur" style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: pop === 'color' ? 'var(--sunk)' : 'transparent' }}>
          <span style={{ width: 19, height: 19, borderRadius: 6, background: colorVal, boxShadow: 'inset 0 0 0 1.5px rgba(13,15,10,.18)' }} />
        </button>
        <Pop open={pop === 'color'} onClose={() => setPop(null)} width={232}>
          <PLabel>{isShape ? 'Remplissage' : 'Couleur du texte'}</PLabel>
          <SwatchRow colors={palette} value={colorVal} onPick={(c) => setColor(c)} />
        </Pop>
      </Group>

      {isText && <>
        <IBtn name="bold" label="Gras" on={sel.weight >= 700} onClick={() => u({ weight: sel.weight >= 700 ? 500 : 800 })} />
        <IBtn name="italic" label="Italique" on={sel.italic} onClick={() => u({ italic: !sel.italic })} />
        <IBtn name="underline" label="Souligné" on={sel.underline} onClick={() => u({ underline: !sel.underline })} />
        <IBtn name="strike" label="Barré" on={sel.strike} onClick={() => u({ strike: !sel.strike })} />
        <IBtn name="case" label="Majuscules" on={sel.uppercase} onClick={() => u({ uppercase: !sel.uppercase })} />
        <Div />
        {/* align */}
        <Group>
          <IBtn name={sel.align === 'center' ? 'alignC' : sel.align === 'right' ? 'alignR' : 'alignL'} label="Alignement" on={pop === 'align'} onClick={() => tgl('align')} />
          <Pop open={pop === 'align'} onClose={() => setPop(null)} width={150}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['left', 'alignL'], ['center', 'alignC'], ['right', 'alignR']].map(([v, ic]) => (
                <button key={v} onClick={() => { u({ align: v }); setPop(null); }} style={{ flex: 1, height: 38, borderRadius: 9, display: 'grid', placeItems: 'center', color: sel.align === v ? 'var(--mint-2)' : 'var(--ink)', background: sel.align === v ? 'var(--mint-soft)' : 'var(--sunk)' }}>
                  <EdIcon name={ic} size={18} />
                </button>
              ))}
            </div>
          </Pop>
        </Group>
        {/* spacing */}
        <Group>
          <IBtn name="lineH" label="Espacement" on={pop === 'spacing'} onClick={() => tgl('spacing')} />
          <Pop open={pop === 'spacing'} onClose={() => setPop(null)} width={250}>
            <Slider label="Interligne" value={sel.lineH} min={0.8} max={2} step={0.02} fmt={(v) => v.toFixed(2)} onChange={(v) => u({ lineH: v })} />
            <Slider label="Interlettrage" value={sel.letter} min={-0.08} max={0.4} step={0.005} fmt={(v) => v.toFixed(3) + 'em'} onChange={(v) => u({ letter: v })} />
          </Pop>
        </Group>
        {/* effects */}
        <Group>
          <TextBtn on={pop === 'effects'} onClick={() => tgl('effects')}><EdIcon name="effects" size={17} /> Effets</TextBtn>
          <Pop open={pop === 'effects'} onClose={() => setPop(null)} width={250}>
            <PLabel>Effet de texte</PLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {EFFECTS.map(ef => (
                <button key={ef} onClick={() => u({ effect: ef })} style={{ borderRadius: 10, padding: '12px 4px 8px', background: sel.effect === ef ? 'var(--mint-soft)' : 'var(--sunk)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, boxShadow: sel.effect === ef ? '0 0 0 2px var(--mint-2)' : 'none' }}>
                  <span style={{ fontFamily: fontCss('archivo'), fontWeight: 800, fontSize: 22, color: ef === 'highlight' ? '#14160F' : '#14160F', ...(ef === 'highlight' ? { background: 'var(--acid)', padding: '0 4px', borderRadius: 4 } : effectStyle(ef, '#14160F', 'var(--acid)')) }}>Ag</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)' }}>{EFFECT_LABEL[ef]}</span>
                </button>
              ))}
            </div>
          </Pop>
        </Group>
      </>}

      {isShape && sel.shape !== 'circle' && sel.shape !== 'pill' && <>
        <Group>
          <IBtn name="square" label="Arrondi" on={pop === 'radius'} onClick={() => tgl('radius')} />
          <Pop open={pop === 'radius'} onClose={() => setPop(null)} width={240}>
            <Slider label="Arrondi des coins" value={sel.radius} min={0} max={Math.min(sel.w, sel.h) / 2} step={1} fmt={(v) => Math.round(v) + 'px'} onChange={(v) => u({ radius: v })} />
          </Pop>
        </Group>
      </>}

      {isImage && <>
        <TextBtn onClick={() => api.replaceImage(sel.id)}><EdIcon name="replace" size={17} /> Remplacer</TextBtn>
        <IBtn name="flipH" label="Miroir" on={sel.flip} onClick={() => u({ flip: !sel.flip })} />
        <IBtn name="crop" label="Rogner" onClick={() => api.toast && api.toast('Recadrage — glissez les bords du cadre')} />
      </>}

      <Div />
      {/* transparency (all) */}
      <Group>
        <IBtn name="transp" label="Transparence" on={pop === 'opacity'} onClick={() => tgl('opacity')} />
        <Pop open={pop === 'opacity'} onClose={() => setPop(null)} width={240}>
          <Slider label="Transparence" value={sel.opacity ?? 100} min={0} max={100} step={1} fmt={(v) => Math.round(v) + '%'} onChange={(v) => u({ opacity: v })} />
        </Pop>
      </Group>
      {/* animate */}
      <Group>
        <TextBtn on={pop === 'anim'} onClick={() => tgl('anim')}><EdIcon name="animate" size={17} /> Animer</TextBtn>
        <Pop open={pop === 'anim'} onClose={() => setPop(null)} width={210} align="right">
          <PLabel>Animation</PLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ANIMS.map(a => (
              <button key={a} onClick={() => { u({ anim: a }); api.play && api.play(); setPop(null); }} style={{ display: 'flex', alignItems: 'center', padding: '9px 11px', borderRadius: 9, background: (sel.anim || 'none') === a ? 'var(--mint-soft)' : 'transparent', fontWeight: 600, fontSize: 13.5 }}
                onMouseEnter={(e) => { if ((sel.anim || 'none') !== a) e.currentTarget.style.background = 'var(--sunk)'; }} onMouseLeave={(e) => { if ((sel.anim || 'none') !== a) e.currentTarget.style.background = 'transparent'; }}>
                {ANIM_LABEL[a]}
                {(sel.anim || 'none') === a && <EdIcon name="check" size={15} style={{ marginLeft: 'auto', color: 'var(--mint-2)' }} />}
              </button>
            ))}
          </div>
        </Pop>
      </Group>
      {/* position */}
      <Group>
        <TextBtn on={pop === 'pos'} onClick={() => tgl('pos')}><EdIcon name="position" size={16} /> Position</TextBtn>
        <Pop open={pop === 'pos'} onClose={() => setPop(null)} width={216} align="right">
          <PLabel>Calque</PLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
            {[['front', 'Premier plan', 'layers'], ['forward', 'Avancer', 'chevD'], ['backward', 'Reculer', 'chevD'], ['back', 'Arrière-plan', 'layers']].map(([id, label]) => (
              <button key={id} onClick={() => { api.layer(sel.id, id); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 9, fontWeight: 600, fontSize: 13.5 }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sunk)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>{label}</button>
            ))}
          </div>
          <PLabel>Aligner sur la page</PLabel>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['hl', 'alignL'], ['hc', 'alignC'], ['hr', 'alignR']].map(([id, ic]) => (
              <button key={id} onClick={() => api.alignPage(sel.id, id)} style={{ flex: 1, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--sunk)' }}><EdIcon name={ic} size={17} /></button>
            ))}
          </div>
        </Pop>
      </Group>
    </div>
  );
}

function Slider({ label, value, min, max, step, fmt, onChange }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <span className="label" style={{ marginBottom: 0 }}>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11.5, color: 'var(--ink-2)' }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
        className="ed-range" style={{ width: '100%' }} />
    </div>
  );
}

/* ───────────────── bottom zoom bar ────────────────────────────── */
function ZoomBar({ zoom, setZoom, fit, playing, onPlay, client }) {
  return (
    <div style={{ height: 50, flexShrink: 0, borderTop: '1px solid var(--line)', background: 'var(--white)', display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px' }}>
      <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)' }}><EdIcon name="image" size={13} /> Page 1 · Post 4:5</span>
      <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>{client.name}</span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onPlay} className="btn btn-sm btn-ghost" style={{ height: 34 }}><EdIcon name={playing ? 'eye' : 'play'} size={15} /> {playing ? 'Aperçu' : 'Animer'}</button>
        <span style={{ width: 1, height: 22, background: 'var(--line)' }} />
        <button onClick={() => setZoom(z => Math.max(0.15, +(z - 0.1).toFixed(2)))} style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}><EdIcon name="minus" size={16} /></button>
        <input type="range" min={0.15} max={1.5} step={0.01} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="ed-range" style={{ width: 132 }} />
        <button onClick={() => setZoom(z => Math.min(1.5, +(z + 0.1).toFixed(2)))} style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}><EdIcon name="plus" size={16} /></button>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12, width: 42, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={fit} title="Ajuster" className="btn btn-sm btn-ghost btn-icon" style={{ height: 34, width: 34 }}><EdIcon name="fit" size={16} /></button>
      </div>
    </div>
  );
}

Object.assign(window, { ToolRail, ToolPanel, ContextToolbar, ZoomBar, Pop, SwatchRow, Slider });
