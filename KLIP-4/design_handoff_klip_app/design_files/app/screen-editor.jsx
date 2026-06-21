/* screen-editor.jsx — visual post composer + AI captions + schedule */

const BG_PRESETS = (c) => [
  `linear-gradient(150deg, ${c.color}, ${shade(c.color, -55)})`,
  `linear-gradient(150deg, ${tint(c.color, 40)}, ${c.color})`,
  'linear-gradient(150deg,#2b8d57,#0c2a1d)',
  'linear-gradient(150deg,#C8F135,#7bbf12)',
  `linear-gradient(150deg, ${shade(c.color, -20)}, #14160F)`,
  'linear-gradient(150deg,#EEEDE3,#cfd3b0)',
];
function shade(hex, amt) { return mix(hex, amt < 0 ? '#000000' : '#ffffff', Math.abs(amt)); }
function tint(hex, amt) { return mix(hex, '#ffffff', amt); }
function mix(a, b, pct) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  const r = pa.map((v, i) => Math.round(v + (pb[i] - v) * pct / 100));
  return '#' + r.map(v => v.toString(16).padStart(2, '0')).join('');
}

const ED_TONES = {
  Chic:    'La lumière de fin d’été sur nos tables. Nouvelle carte, réservations ouvertes pour septembre. ✦\n\n#{tag} #artdevivre #septembre',
  Punchy:  'Septembre, on remet le couvert 🔥 Nouvelle carte, résa en bio — ça part vite.\n\n#{tag} #foodie #septembre',
  Minimal: 'Septembre. Nouvelle carte. Réservez.\n\n#{tag}',
  Doux:    'On a hâte de vous retrouver autour de la nouvelle carte 🌿 Réservations ouvertes pour tout septembre.\n\n#{tag} #septembre',
};
const ED_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function Editor({ post, active, setRoute, toast, embedded, onBack, onSave }) {
  const src = post || null;
  const cid = src && src.client ? src.client : (active !== 'all' ? active : 'lou');
  const client = clientById(cid);
  const presets = useMemo(() => BG_PRESETS(client), [client.id]);

  const [tool, setTool] = useState('media');
  const [bg, setBg] = useState(src ? src.grad : presets[0]);
  const [headline, setHeadline] = useState(src ? src.title : 'Votre accroche ici');
  const [textColor, setTextColor] = useState('#ffffff');
  const [align, setAlign] = useState('flex-end');
  const [tone, setTone] = useState(src ? (ED_TONES[src.tone] ? src.tone : 'Chic') : 'Chic');
  const [caption, setCaption] = useState(src ? src.caption : '');
  const [typing, setTyping] = useState(false);
  const [day, setDay] = useState(src && src.day != null ? src.day - 8 : null);
  const [time, setTime] = useState(src ? src.time : '18:30');
  const timer = useRef(null);

  const saveBack = () => {
    if (onSave) onSave({ title: headline, caption, grad: bg, tone, day: day != null ? day + 8 : null, time });
    if (onBack) onBack();
  };

  const generate = useCallback((t) => {
    const full = (ED_TONES[t] || ED_TONES.Chic).replace('{tag}', client.handle.replace('@', ''));
    setTyping(true); setCaption('');
    clearInterval(timer.current);
    let i = 0;
    timer.current = setInterval(() => {
      i += 2; setCaption(full.slice(0, i));
      if (i >= full.length) { clearInterval(timer.current); setTyping(false); }
    }, 12);
  }, [client]);
  useEffect(() => () => clearInterval(timer.current), []);

  const palette = [client.color, tint(client.color, 45), shade(client.color, -45), '#ffffff', '#14160F', '#EEEDE3'];
  const tools = [['media', 'Média', 'image'], ['text', 'Texte', 'type'], ['brand', 'Charte', 'palette'], ['sticker', 'Stickers', 'sticker']];

  return (
    <div className="screen-in" style={{ display: 'grid', gridTemplateColumns: '64px 1fr 340px', height: '100%', overflow: 'hidden' }}>
      {/* tool rail */}
      <div style={{ background: 'var(--white)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 6 }}>
        {tools.map(([id, label, ic]) => (
          <button key={id} onClick={() => setTool(id)} title={label} style={{ width: 46, height: 46, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            background: tool === id ? 'var(--mint-soft)' : 'transparent', color: tool === id ? 'var(--mint-2)' : 'var(--ink-3)', transition: 'all .14s' }}>
            <AIcon name={ic} size={20} />
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 8.5, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</span>
          </button>
        ))}
      </div>

      {/* canvas stage */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--canvas)' }}>
        {/* stage toolbar */}
        <div style={{ height: 52, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', flexShrink: 0 }}>
          {embedded && <button className="btn btn-sm btn-ghost" onClick={saveBack}><AIcon name="chevL" size={15} /> Retour au lot</button>}
          <Avatar initials={client.initials} color={client.color} size={26} radius={7} />
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{client.name}</span>
          <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)' }}><AIcon name="instagram" size={13} /> Post · 4:5</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => toast && toast('Aperçu — visuel prêt à publier')}><AIcon name="eye" size={15} /> Aperçu</button>
            <button className="btn btn-sm btn-ghost" onClick={() => toast && toast('Visuel dupliqué')}><AIcon name="copy" size={15} /> Dupliquer</button>
          </div>
        </div>

        {/* canvas */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', placeItems: 'center', padding: 28 }}>
          <div style={{ width: 360, flexShrink: 0 }}>
            <div style={{ position: 'relative', aspectRatio: '4/5', background: bg, borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-float)', display: 'flex', flexDirection: 'column', justifyContent: align, padding: 24, transition: 'background .25s' }}>
              <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 8, opacity: .9 }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,.85)' }} />
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: '#fff', letterSpacing: '.06em' }}>{client.handle.replace('@', '').toUpperCase()}</span>
              </div>
              <div contentEditable suppressContentEditableWarning onBlur={e => setHeadline(e.target.textContent)}
                style={{ fontFamily: 'var(--display)', fontWeight: 800, fontStyle: 'italic', fontSize: 38, lineHeight: .98, letterSpacing: '-0.025em', color: textColor, textShadow: '0 2px 20px rgba(0,0,0,.28)', outline: 'none', cursor: 'text', textTransform: 'none' }}>
                {headline}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, justifyContent: 'center', color: 'var(--ink-3)', fontSize: 12, fontWeight: 600 }}>
              <AIcon name="drag" size={14} /> Clique le texte pour l’éditer · glisse pour repositionner
            </div>
          </div>
        </div>
      </div>

      {/* right inspector */}
      <div style={{ background: 'var(--white)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* contextual tool panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {tool === 'media' && <Panel title="Arrière-plan">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
              {presets.map((g, i) => (
                <button key={i} onClick={() => setBg(g)} style={{ aspectRatio: '4/5', borderRadius: 10, background: g, border: 'none', cursor: 'pointer', boxShadow: bg === g ? '0 0 0 2.5px var(--mint-2)' : 'inset 0 0 0 1px var(--line)', transition: 'all .12s' }} />
              ))}
            </div>
            <div style={{ marginTop: 12, border: '1.5px dashed var(--line)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-3)', cursor: 'pointer' }}>
              <AIcon name="upload" size={18} /><span style={{ fontWeight: 600, fontSize: 13 }}>Importer une photo</span>
            </div>
          </Panel>}

          {tool === 'text' && <Panel title="Texte">
            <label className="label" style={{ display: 'block', marginBottom: 8 }}>Couleur</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
              {palette.map((col, i) => (
                <button key={i} onClick={() => setTextColor(col)} style={{ width: 32, height: 32, borderRadius: 9, background: col, border: 'none', cursor: 'pointer', boxShadow: textColor === col ? '0 0 0 2.5px var(--mint-2)' : 'inset 0 0 0 1px var(--line)' }} />
              ))}
            </div>
            <label className="label" style={{ display: 'block', marginBottom: 8 }}>Position</label>
            <div className="seg" style={{ width: '100%' }}>
              {[['flex-start', 'Haut'], ['center', 'Centre'], ['flex-end', 'Bas']].map(([v, l]) => (
                <button key={v} className={align === v ? 'on' : ''} style={{ flex: 1 }} onClick={() => setAlign(v)}>{l}</button>
              ))}
            </div>
          </Panel>}

          {tool === 'brand' && <Panel title={`Charte · ${client.name}`}>
            <label className="label" style={{ display: 'block', marginBottom: 8 }}>Couleurs de marque</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {[client.color, tint(client.color, 45), shade(client.color, -45)].map((col, i) => (
                <div key={i} style={{ flex: 1 }}>
                  <div style={{ height: 44, borderRadius: 9, background: col, boxShadow: 'inset 0 0 0 1px var(--line)' }} />
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)', marginTop: 4, textAlign: 'center', textTransform: 'uppercase' }}>{col}</div>
                </div>
              ))}
            </div>
            <label className="label" style={{ display: 'block', marginBottom: 8 }}>Typo</label>
            <div className="well" style={{ padding: 14 }}>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22 }}>Archivo</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Titres · accroches</div>
            </div>
            <div className="well" style={{ padding: 14, marginTop: 8 }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 18 }}>Satoshi</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Légendes · corps</div>
            </div>
          </Panel>}

          {tool === 'sticker' && <Panel title="Stickers">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
              {['↗', '✦', '★', '●', '→', 'NEW', '%', '♥', '✓'].map((s, i) => (
                <button key={i} className="well" style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 20, cursor: 'pointer' }}>{s}</button>
              ))}
            </div>
          </Panel>}
        </div>

        {/* AI caption + schedule (always visible bottom) */}
        <div style={{ borderTop: '1px solid var(--line)', padding: 18, background: 'var(--canvas)', maxHeight: '56%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--mint)', color: 'var(--mint-ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><AIcon name="wand" size={15} /></span>
            <span className="h-title" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>Description IA</span>
            <span className="chip trunc" style={{ marginLeft: 'auto', background: 'var(--mint-soft)', color: 'var(--mint-2)', maxWidth: 110, display: 'inline-block', textAlign: 'center' }}>{client.name}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {Object.keys(ED_TONES).map(t => (
              <button key={t} onClick={() => { setTone(t); if (caption) generate(t); }} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, fontWeight: 700, fontSize: 12, transition: 'all .14s',
                background: tone === t ? 'var(--ink)' : 'var(--white)', color: tone === t ? 'var(--paper)' : 'var(--ink-2)', boxShadow: tone === t ? 'none' : 'inset 0 0 0 1px var(--line)' }}>{t}</button>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={() => generate(tone)}>
            <AIcon name="spark" size={16} /> {caption ? 'Régénérer' : 'Générer la description'}
          </button>
          <div className="input" style={{ minHeight: 84, marginBottom: 16, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line', color: caption ? 'var(--ink)' : 'var(--ink-3)' }}>
            {caption ? <>{caption}<span style={{ opacity: typing ? 1 : 0, color: 'var(--mint-2)' }}>▍</span></> : 'La description générée apparaîtra ici, calée sur la voix de la marque.'}
          </div>

          <div className="label" style={{ marginBottom: 8 }}>Planifier</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 10 }}>
            {ED_DAYS.map((d, i) => {
              const sel = day === i, best = i === 2 || i === 4;
              return (
                <button key={d} onClick={() => setDay(i)} style={{ padding: '7px 2px', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative',
                  background: sel ? 'var(--mint)' : 'var(--white)', color: sel ? 'var(--mint-ink)' : 'var(--ink)', boxShadow: sel ? 'none' : 'inset 0 0 0 1px var(--line)', transition: 'all .12s' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 9.5 }}>{d}</span>
                  <span className="num" style={{ fontSize: 14 }}>{8 + i}</span>
                  {best && !sel && <span className="dot" style={{ position: 'absolute', top: 4, right: 4, background: 'var(--mint-2)', width: 5, height: 5 }} />}
                </button>
              );
            })}
          </div>
          {day !== null && <div style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><AIcon name="clock" size={13} style={{ color: 'var(--mint-2)' }} /> {ED_DAYS[day]} {8 + day} sept · {time} — fort engagement</div>}

          {embedded
            ? <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveBack}>
                <AIcon name="check" size={16} /> Enregistrer ce visuel
              </button>
            : <button className="btn btn-dark" style={{ width: '100%', opacity: day === null ? .5 : 1 }}
                onClick={() => { if (day !== null) { toast(`Post planifié · ${ED_DAYS[day]} ${8 + day} sept à ${time}`); setRoute('queue'); } }}>
                <AIcon name="instagram" size={16} /> Programmer la publication
              </button>}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div>
      <h3 className="h-title" style={{ fontSize: 14, marginBottom: 14 }}>{title}</h3>
      {children}
    </div>
  );
}

Object.assign(window, { Editor });
