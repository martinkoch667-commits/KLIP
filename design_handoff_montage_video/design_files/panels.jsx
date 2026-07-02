/* panels.jsx — KLIP Montage : topbar partagée, overlay IA, et PanelBody
   (corps des panneaux de propriétés par outil) réutilisé par Dir A & Dir B. */

function EditorTopbar({ accent, toast }) {
  return (
    <div className="ed2-topbar" style={{ height: 58, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderBottom: '1px solid var(--line)', background: 'color-mix(in srgb, var(--canvas) 72%, transparent)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 30 }}>
      <button className="btn btn-sm btn-ghost" onClick={() => toast('Retour au Composer')} style={{ flexShrink: 0 }}><VIcon name="chevL" size={15} /> Composer</button>
      <span className="mz-vrule" />
      <div style={{ display: 'flex', gap: 2 }}>
        <button className="mz-hbtn" title="Annuler"><VIcon name="undo" size={17} /></button>
        <button className="mz-hbtn" title="Rétablir"><VIcon name="redo" size={17} /></button>
      </div>
      <span className="mz-vrule" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: PROJECT.color, display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 10, flexShrink: 0 }}>{PROJECT.initials}</span>
        <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14.5, letterSpacing: '-0.01em' }} className="trunc">{PROJECT.doc}</span>
        <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)', flexShrink: 0 }}>{PROJECT.ratio}</span>
      </div>
      <div style={{ flex: 1 }} />
      <button className="btn btn-sm btn-ghost" onClick={() => toast('Aperçu plein écran')}><VIcon name="eye" size={15} /> Aperçu</button>
      <button className="btn btn-sm btn-primary" onClick={() => toast('Export · Reel prêt à programmer')}><VIcon name="export" size={15} /> Exporter</button>
    </div>
  );
}

function AIOverlay({ voice = 'Doux', label = 'Klip monte votre vidéo' }) {
  return (
    <div className="mz-ai-overlay">
      <div className="mz-orb"><span className="mz-spark"><VIcon name="sparkles" size={30} /></span></div>
      <div style={{ textAlign: 'center' }}>
        <div className="mz-ai-overlay-title">{label}</div>
        <div style={{ fontSize: 13, color: 'var(--cream-2)', marginTop: 4 }}>Coupe au rythme · sous-titres · {voice.toLowerCase()} · {PROJECT.client}</div>
      </div>
      <div className="mz-ai-progress"><span /></div>
    </div>
  );
}

/* petit slider réutilisable */
function Range({ label, value, min, max, step = 1, unit = '', onChange, fmtv }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="mz-rangelbl">
        <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--ink-2)' }}>{label}</span>
        <span className="mz-rangeval">{fmtv ? fmtv(value) : value + unit}</span>
      </div>
      <input className="mz-range" type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

/* ── PanelBody : corps des panneaux par outil ────────────────────── */
function PanelBody({ tool, subStyle, setSubStyle, music, setMusic, filter, setFilter, speed, setSpeed, voice, setVoice, selClip, runAI, toast, autoCrop, setAutoCrop }) {
  const [lum, setLum] = useState(8), [con, setCon] = useState(4), [sat, setSat] = useState(12);
  const [musicVol, setMusicVol] = useState(40), [voVol, setVoVol] = useState(100);
  const [trans, setTrans] = useState('fade'), [transDur, setTransDur] = useState(0.4);
  const [font, setFont] = useState('archivo'), [anim, setAnim] = useState('rise'), [crop, setCrop] = useState(autoCrop);

  if (tool === 'media') return (
    <>
      <div className="a-section b-section">
        <button className="mz-import" onClick={() => toast('Importer vidéos & photos')}>
          <VIcon name="upload" size={22} />
          <span className="mz-import-t">Importer vidéos & photos</span>
          <span className="mz-import-s">Glissez vos rushes · MP4, MOV, JPG</span>
        </button>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Plans du projet · {CLIPS.length}</span>
        <div className="mz-grid3">
          {CLIP_TL.map(c => (
            <div key={c.id} className={'mz-thumb' + (selClip && selClip.id === c.id ? ' on' : '')} style={{ background: c.grad }} onClick={() => toast(c.name)}>
              <span style={{ position: 'absolute', top: 5, left: 5, width: 16, height: 16, borderRadius: 5, background: 'rgba(0,0,0,.4)', display: 'grid', placeItems: 'center', color: '#fff' }}><VIcon name={c.kind === 'photo' ? 'image' : 'video'} size={10} /></span>
              <span style={{ position: 'absolute', bottom: 5, right: 5, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 8.5, color: '#fff', background: 'rgba(0,0,0,.4)', padding: '1px 4px', borderRadius: 4 }}>{c.dur.toFixed(0)}s</span>
            </div>
          ))}
        </div>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Incrustation photo</span>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.45, marginBottom: 8 }}>Les photos s'insèrent comme des plans fixes — durée réglable, transitions et filtres identiques aux vidéos.</p>
        <Toggle label="Recadrage auto du sujet (IA)" on={crop} onChange={v => { setCrop(v); setAutoCrop && setAutoCrop(v); }} />
      </div>
    </>
  );

  if (tool === 'cut') return (
    <>
      <div className="a-section b-section">
        <span className="mz-sec-label">Plan sélectionné</span>
        <div className="mz-music" style={{ cursor: 'default' }}>
          <span className="mz-music-play" style={{ background: selClip ? selClip.grad : 'var(--forest)' }}><VIcon name={selClip && selClip.kind === 'photo' ? 'image' : 'video'} size={15} style={{ color: '#fff' }} /></span>
          <div style={{ minWidth: 0 }}><div className="mz-music-name trunc">{selClip ? selClip.label : 'Terrasse'}</div><div className="mz-music-meta">{selClip ? selClip.name : ''}</div></div>
          <span className="mz-music-dur">{selClip ? selClip.dur.toFixed(1) + 's' : ''}</span>
        </div>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Actions</span>
        <div className="mz-ai-list">
          <button className="btn btn-dark mz-btn-block" onClick={() => toast('Plan divisé au curseur')}><VIcon name="split" size={15} /> Diviser au curseur</button>
          <button className="btn btn-ghost mz-btn-block" onClick={() => toast('Rognage activé')}><VIcon name="crop" size={15} /> Rogner les bords</button>
          <button className="btn btn-ghost mz-btn-block" onClick={() => toast('Plan dupliqué')}><VIcon name="copy" size={15} /> Dupliquer</button>
        </div>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Bornes</span>
        <Range label="Début" value={0} min={0} max={5} step={0.1} unit="s" onChange={() => {}} />
        <Range label="Fin" value={selClip ? selClip.dur : 6} min={1} max={8} step={0.1} unit="s" onChange={() => {}} />
      </div>
    </>
  );

  if (tool === 'text') return (
    <>
      <div className="a-section b-section">
        <button className="btn btn-primary mz-btn-block" onClick={() => toast('Titre ajouté au plan')}><VIcon name="plus" size={15} /> Ajouter un titre</button>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Police</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[['archivo', 'Archivo', 'Display', "'Archivo',sans-serif", 800, true], ['instrument', 'Instrument', 'Serif', "'Instrument Serif',serif", 400, true], ['satoshi', 'Satoshi', 'Sans', "'Satoshi',sans-serif", 700, false]].map(([k, n, s, css, w, it]) => (
            <button key={k} className={'font-pick' + (font === k ? ' on' : '')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', borderRadius: 9, background: font === k ? 'var(--mint-soft)' : 'var(--white)', boxShadow: font === k ? 'inset 0 0 0 1.5px var(--mint-2)' : 'inset 0 0 0 1px var(--line)' }} onClick={() => setFont(k)}>
              <span style={{ fontFamily: css, fontWeight: w, fontStyle: it ? 'italic' : 'normal', fontSize: 19 }}>{n}</span>
              <span className="mz-sec-label">{s}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Animation d'entrée</span>
        <div className="mz-seg">
          {[['rise', 'Apparition'], ['type', 'Machine'], ['pop', 'Pop']].map(([k, l]) => (
            <button key={k} className={anim === k ? 'on' : ''} onClick={() => setAnim(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Couleur</span>
        <div className="mz-swrow">
          {['#FFFFFF', '#0C2A1D', '#2FD79B', '#C8F135', PROJECT.color, '#14160F'].map((c, i) => (
            <button key={i} className={'mz-sw' + (i === 0 ? ' on' : '')} style={{ background: c }} />
          ))}
        </div>
      </div>
    </>
  );

  if (tool === 'captions') return (
    <>
      <div className="a-section b-section">
        <div className="mz-ai-card">
          <div className="halo-blob" style={{ width: 140, height: 140, right: -40, top: -50, background: 'radial-gradient(circle, var(--mint), transparent 70%)', opacity: .5 }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div className="mz-sec-label" style={{ color: 'var(--mint)', marginBottom: 8 }}>Transcription IA</div>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontStyle: 'italic', fontSize: 18, letterSpacing: '-0.02em', marginBottom: 4 }}>Sous-titres automatiques</div>
            <p style={{ fontSize: 12, color: 'var(--cream-2)', marginBottom: 12, lineHeight: 1.45 }}>Klip transcrit la voix, cale les mots et applique le style de marque.</p>
            <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
              <span className="chip" style={{ background: 'rgba(238,237,227,.1)', color: 'var(--cream)', boxShadow: 'inset 0 0 0 1px var(--cream-4)' }}>🇫🇷 Français</span>
              <span className="chip" style={{ background: 'rgba(238,237,227,.1)', color: 'var(--cream-2)', boxShadow: 'inset 0 0 0 1px var(--cream-4)' }}>Auto-détecté</span>
            </div>
            <button className="mz-ai-btn" onClick={() => runAI('Sous-titres générés', 'Klip transcrit la voix')}><VIcon name="sparkles" size={16} /> Générer les sous-titres</button>
          </div>
        </div>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Style animé</span>
        <div className="mz-substyle">
          {SUB_STYLES.map(s => (
            <button key={s.id} className={'mz-substyle-card' + (subStyle === s.id ? ' on' : '')} onClick={() => setSubStyle(s.id)}>
              <div className="mz-substyle-prev">
                <span style={{ display: 'inline-block', padding: s.pill ? '4px 10px' : '4px 8px', borderRadius: s.pill ? 99 : 6, background: s.bg, color: s.fg, fontFamily: s.italic ? 'var(--display)' : 'var(--sans)', fontStyle: s.italic ? 'italic' : 'normal', fontWeight: s.weight, fontSize: 13, textShadow: s.bg === 'transparent' ? '0 1px 6px rgba(0,0,0,.6)' : 'none' }}>
                  Auto<span style={{ color: s.hi }}>mne</span>
                </span>
              </div>
              <div className="mz-substyle-meta"><div className="mz-substyle-name">{s.name}</div><div className="mz-substyle-sub">{s.sub}</div></div>
            </button>
          ))}
        </div>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Texte transcrit</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SUBS.slice(0, 3).map(s => (
            <div key={s.id} style={{ display: 'flex', gap: 9, padding: '9px 11px', borderRadius: 9, background: 'var(--sunk)' }}>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 10, color: 'var(--ink-3)', flexShrink: 0, paddingTop: 2 }}>{fmtShort(s.start)}</span>
              <span contentEditable suppressContentEditableWarning style={{ fontSize: 12.5, lineHeight: 1.4, outline: 'none' }} onBlur={() => toast('Sous-titre modifié')}>{s.text}</span>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => toast('Tout le transcript')}>Voir les {SUBS.length} segments</button>
        </div>
      </div>
    </>
  );

  if (tool === 'audio') return (
    <>
      <div className="a-section b-section">
        <button className="btn btn-dark mz-btn-block" onClick={() => toast('Enregistrement voix off…')}><VIcon name="mic" size={15} /> Enregistrer une voix off</button>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Musique de marque</span>
        {MUSIC_LIB.map(m => (
          <div key={m.id} className={'mz-music' + (music === m.id ? ' on' : '')} onClick={() => setMusic(m.id)}>
            <span className="mz-music-play"><VIcon name={music === m.id ? 'pause' : 'play'} size={14} /></span>
            <div style={{ minWidth: 0 }}><div className="mz-music-name trunc">{m.name}</div><div className="mz-music-meta">{m.mood} · {m.bpm} BPM</div></div>
            <span className="mz-music-dur">{m.dur}</span>
          </div>
        ))}
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Niveaux</span>
        <Range label="Musique" value={musicVol} min={0} max={100} unit="%" onChange={setMusicVol} />
        <Range label="Voix off" value={voVol} min={0} max={100} unit="%" onChange={setVoVol} />
        <Toggle label="Caler les coupes sur le rythme" on={true} onChange={() => toast('Coupe calée sur le BPM')} />
      </div>
    </>
  );

  if (tool === 'transitions') return (
    <>
      <div className="a-section b-section">
        <span className="mz-sec-label">Transition entre plans</span>
        <div className="mz-grid3">
          {TRANSITIONS.map(t => (
            <button key={t.id} className={'mz-thumb' + (trans === t.id ? ' on' : '')} style={{ aspectRatio: '1', background: 'var(--sunk)', display: 'grid', placeItems: 'center', boxShadow: trans === t.id ? '0 0 0 2px var(--mint-2)' : 'inset 0 0 0 1px var(--line)' }} onClick={() => setTrans(t.id)}>
              <span style={{ fontSize: 22, color: 'var(--ink-2)' }}>{t.glyph}</span>
              <span style={{ position: 'absolute', bottom: 5, fontWeight: 700, fontSize: 10, color: 'var(--ink-2)' }}>{t.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="a-section b-section">
        <Range label="Durée" value={transDur} min={0.1} max={1.5} step={0.1} onChange={setTransDur} fmtv={v => v.toFixed(1) + 's'} />
        <button className="btn btn-ghost mz-btn-block" onClick={() => toast('Transition appliquée partout')}>Appliquer à tous les plans</button>
      </div>
    </>
  );

  if (tool === 'filter') return (
    <>
      <div className="a-section b-section">
        <span className="mz-sec-label">Filtres</span>
        <div className="mz-grid3">
          {FILTERS.map(f => (
            <button key={f.id} className={'mz-thumb' + (filter === f.id ? ' on' : '')} style={{ background: selClip ? selClip.grad : 'var(--forest)', filter: f.css }} onClick={() => setFilter(f.id)}>
              <span style={{ position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 9, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.7)' }}>{f.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Étalonnage</span>
        <Range label="Lumière" value={lum} min={-50} max={50} onChange={setLum} />
        <Range label="Contraste" value={con} min={-50} max={50} onChange={setCon} />
        <Range label="Saturation" value={sat} min={-50} max={50} onChange={setSat} />
      </div>
    </>
  );

  if (tool === 'speed') return (
    <>
      <div className="a-section b-section">
        <span className="mz-sec-label">Vitesse de lecture</span>
        <div className="mz-seg">
          {SPEEDS.map(s => (
            <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>{s}×</button>
          ))}
        </div>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Options</span>
        <Toggle label="Lisser le ralenti (interpolation)" on={speed < 1} onChange={() => toast('Interpolation des images')} />
        <Toggle label="Lecture inversée" on={false} onChange={() => toast('Plan inversé')} />
      </div>
    </>
  );

  if (tool === 'sticker') return (
    <>
      <div className="a-section b-section">
        <span className="mz-sec-label">Éléments de marque</span>
        <div className="mz-grid4">
          {['✦', '↗', '🌿', '☕', '◆', '✿', '→', '★', '✷', '∴', '❋', '●'].map((g, i) => (
            <button key={i} style={{ aspectRatio: 1, borderRadius: 11, display: 'grid', placeItems: 'center', fontSize: 22, background: 'var(--sunk)', cursor: 'pointer' }} onClick={() => toast('Sticker ' + g + ' ajouté')}>{g}</button>
          ))}
        </div>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Habillage</span>
        <div className="mz-ai-list">
          <button className="btn btn-ghost mz-btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => toast('Logo ajouté')}><VIcon name="image" size={15} /> Logo {PROJECT.client}</button>
          <button className="btn btn-ghost mz-btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => toast('Barre de progression ajoutée')}><VIcon name="reorder" size={15} /> Barre de progression</button>
        </div>
      </div>
    </>
  );

  if (tool === 'ai') return (
    <>
      <div className="a-section b-section">
        <div className="mz-ai-card">
          <div className="halo-blob" style={{ width: 150, height: 150, right: -40, top: -50, background: 'radial-gradient(circle, var(--mint), transparent 70%)', opacity: .5 }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div className="mz-sec-label" style={{ color: 'var(--mint)', marginBottom: 8 }}>Assistant Klip</div>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontStyle: 'italic', fontSize: 19, letterSpacing: '-0.02em', marginBottom: 4 }}>Montez à partir des rushes.</div>
            <p style={{ fontSize: 12.5, color: 'var(--cream-2)', marginBottom: 14, lineHeight: 1.45 }}>Klip choisit les meilleurs plans, coupe au rythme et pose un premier jet.</p>
            <div className="mz-chips" style={{ marginBottom: 12 }}>
              {['Chic', 'Punchy', 'Minimal', 'Doux'].map(v => (
                <button key={v} className={'voice-chip' + (voice === v ? ' on' : '')} style={{ padding: '6px 11px', borderRadius: 99, fontWeight: 700, fontSize: 12, color: voice === v ? 'var(--mint-ink)' : 'var(--cream-2)', background: voice === v ? 'var(--mint)' : 'rgba(238,237,227,.08)', boxShadow: voice === v ? 'none' : 'inset 0 0 0 1px var(--cream-4)' }} onClick={() => setVoice(v)}>{v}</button>
              ))}
            </div>
            <button className="mz-ai-btn" onClick={() => runAI('Premier montage prêt', 'Klip monte votre vidéo')}><VIcon name="sparkles" size={17} /> Monter automatiquement</button>
          </div>
        </div>
      </div>
      <div className="a-section b-section">
        <span className="mz-sec-label">Coups de pouce</span>
        <div className="mz-ai-list">
          <button className="btn btn-ghost mz-btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => runAI('Sous-titres générés', 'Klip transcrit la voix')}><VIcon name="captions" size={15} /> Sous-titres automatiques</button>
          <button className="btn btn-ghost mz-btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => runAI('Musique suggérée', 'Klip cherche le bon tempo')}><VIcon name="music" size={15} /> Suggérer une musique</button>
          <button className="btn btn-ghost mz-btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => runAI('Sujet recadré', 'Klip suit le sujet')}><VIcon name="lasso" size={15} /> Recadrer le sujet</button>
        </div>
      </div>
    </>
  );

  return null;
}

/* toggle réutilisable */
function Toggle({ label, on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '4px 0', marginBottom: 6 }}>
      <span style={{ width: 38, height: 22, borderRadius: 99, background: on ? 'var(--mint)' : 'var(--sunk)', boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--line)', position: 'relative', flexShrink: 0, transition: 'background .18s' }}>
        <span style={{ position: 'absolute', top: 2, left: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(13,15,10,.3)', transform: on ? 'translateX(16px)' : 'none', transition: 'transform .2s var(--ease)' }} />
      </span>
      <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink-2)', textAlign: 'left' }}>{label}</span>
    </button>
  );
}

Object.assign(window, { EditorTopbar, AIOverlay, PanelBody, Range, Toggle });
