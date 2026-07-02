/* dir-a.jsx — DIRECTION A « Plan de travail »
   Rail d'outils forêt · panneau de propriétés · preview 9:16 · timeline
   multi-pistes (vidéo / audio / sous-titres / texte). Mental model power-user. */

const A_TOOLS = [
  ['media', 'video', 'Média'],
  ['cut', 'scissors', 'Découper'],
  ['text', 'text', 'Texte'],
  ['captions', 'captions', 'Sous-titres'],
  ['audio', 'music', 'Audio'],
  ['transitions', 'transition', 'Transit.'],
  ['filter', 'filter', 'Filtres'],
  ['speed', 'speed', 'Vitesse'],
  ['sticker', 'sticker', 'Stickers'],
];
const A_TITLES = { media: 'Média', cut: 'Découper', text: 'Texte & titres', captions: 'Sous-titres', audio: 'Audio', transitions: 'Transitions', filter: 'Filtres', speed: 'Vitesse', sticker: 'Stickers', ai: 'Assistant IA' };

function EditorA({ subStyle, setSubStyle, accent, runAI, aiLoading, toast }) {
  const pb = usePlayback();
  const [tool, setTool] = useState('captions');
  const [sel, setSel] = useState('c1');
  const [music, setMusic] = useState('m1');
  const [filter, setFilter] = useState('chaud');
  const [speed, setSpeed] = useState(1);
  const [voice, setVoice] = useState('Doux');
  const [pps, setPps] = useState(40);
  const tlRef = useRef(null);
  const selClip = CLIP_TL.find(c => c.id === sel) || CLIP_TL[0];

  const trackW = TOTAL * pps;
  const ticks = [];
  for (let s = 0; s <= TOTAL; s += 2) ticks.push(s);

  return (
    <div className="a-root">
      {/* topbar */}
      < EditorTopbar accent={accent} toast={toast} />

      <div className="a-main">
        {/* rail */}
        <div className="a-rail">
          <div className="a-mark"><KlipMark size={16} /></div>
          <div className="a-rdiv" />
          {A_TOOLS.map(([k, ic, lbl]) => (
            <button key={k} className={'a-railbtn' + (tool === k ? ' on' : '')} onClick={() => setTool(k)}>
              <VIcon name={ic} size={20} /><span className="a-railcap">{lbl}</span>
            </button>
          ))}
          <button className={'a-railbtn ai' + (tool === 'ai' ? ' on' : '')} onClick={() => setTool('ai')} style={{ marginTop: 'auto' }}>
            <VIcon name="sparkles" size={20} style={{ color: tool === 'ai' ? 'var(--acid)' : 'var(--mint)' }} /><span className="a-railcap">IA</span>
          </button>
        </div>

        {/* property panel */}
        <div className="a-panel" key={tool}>
          <div className="a-panel-head"><span className="a-panel-title">{A_TITLES[tool]}</span></div>
          <div className="a-panel-scroll">
            <PanelBody tool={tool} {...{ subStyle, setSubStyle, music, setMusic, filter, setFilter, speed, setSpeed, voice, setVoice, selClip, runAI, toast }} />
          </div>
        </div>

        {/* canvas: preview + playbar */}
        <div className="a-canvas">
          <div className="mz-stage">
            <div className="halo-blob" style={{ width: 380, height: 380, left: -80, top: -60, background: 'var(--mint)', opacity: .1, filter: 'blur(64px)' }} />
            <div className="halo-blob" style={{ width: 300, height: 300, right: -60, bottom: -50, background: 'var(--acid)', opacity: .08, filter: 'blur(60px)' }} />
            <MZPreview time={pb.time} subStyle={subStyle} />
            {aiLoading && <AIOverlay voice={voice} />}
          </div>
          <MZPlaybar {...pb} />
        </div>
      </div>

      {/* timeline dock */}
      <div className="a-timeline">
        <div className="a-tl-bar">
          <button className="a-tl-tool accent" onClick={() => toast('Lame de coupe au curseur')}><VIcon name="scissors" size={15} /> Découper</button>
          <button className="a-tl-tool" onClick={() => toast('Clip dupliqué')}><VIcon name="copy" size={15} /> Dupliquer</button>
          <button className="a-tl-tool" onClick={() => toast('Clip supprimé')}><VIcon name="trash" size={15} /> Supprimer</button>
          <div style={{ flex: 1 }} />
          <span className="mz-sec-label" style={{ marginRight: 4 }}>{CLIPS.length} clips · {fmtShort(TOTAL)}</span>
          <div className="a-zoom">
            <button className="mz-hbtn" style={{ width: 30, height: 30 }} onClick={() => setPps(p => Math.max(20, p - 8))}><VIcon name="zoomOut" size={16} /></button>
            <button className="mz-hbtn" style={{ width: 30, height: 30 }} onClick={() => setPps(p => Math.min(80, p + 8))}><VIcon name="zoomIn" size={16} /></button>
          </div>
        </div>

        <div className="a-tl-scroll" ref={tlRef}>
          <div className="a-tl-inner" style={{ width: 92 + trackW + 30 }}>
            {/* ruler */}
            <div className="a-ruler" style={{ marginLeft: 92, width: trackW }}>
              {ticks.map(s => (
                <div key={s} className="a-tick" style={{ left: s * pps }}><span>{fmtShort(s)}</span></div>
              ))}
            </div>

            {/* video lane */}
            <div className="a-lane">
              <div className="a-lane-label"><VIcon name="video" size={13} /> Vidéo</div>
              <div className="a-lane-track">
                {CLIP_TL.map((c, i) => (
                  <React.Fragment key={c.id}>
                    <div className={'a-clip' + (sel === c.id ? ' on' : '')} style={{ width: c.dur * pps, background: c.grad }} onClick={() => { setSel(c.id); if (c.kind === 'photo' && tool === 'media') {} }}>
                      <span className="a-clip-badge"><VIcon name={c.kind === 'photo' ? 'image' : 'video'} size={10} /></span>
                      <span className="a-clip-dur">{c.dur.toFixed(1)}s</span>
                      <span className="a-clip-lbl">{c.label}</span>
                    </div>
                    {i < CLIP_TL.length - 1 && <div className="a-trans" title="Transition" onClick={() => { setTool('transitions'); toast('Transition entre clips'); }}>◐</div>}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* audio lane */}
            <div className="a-lane" style={{ height: 46 }}>
              <div className="a-lane-label"><VIcon name="music" size={13} /> Audio</div>
              <div className="a-lane-track">
                <div className="a-audio" style={{ width: trackW }} onClick={() => setTool('audio')}>
                  <VIcon name="music" size={14} style={{ color: 'var(--mint)' }} />
                  <span className="a-audio-lbl">{(MUSIC_LIB.find(m => m.id === music) || MUSIC_LIB[0]).name}</span>
                  <svg className="a-wave" viewBox="0 0 600 24" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d={wavePath(600, 24)} />
                  </svg>
                </div>
              </div>
            </div>

            {/* subtitle lane */}
            <div className="a-lane" style={{ height: 36 }}>
              <div className="a-lane-label"><VIcon name="captions" size={13} /> S-titres</div>
              <div className="a-lane-track">
                {SUBS.map(s => (
                  <div key={s.id} className="a-sub" style={{ left: s.start * pps, width: (s.end - s.start) * pps - 3 }} onClick={() => setTool('captions')}>
                    <span className="a-sub-t">{s.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* text lane */}
            <div className="a-lane" style={{ height: 36 }}>
              <div className="a-lane-label"><VIcon name="text" size={13} /> Texte</div>
              <div className="a-lane-track">
                {TITLES.map(t => (
                  <div key={t.id} className="a-txt" style={{ left: t.start * pps, width: (t.end - t.start) * pps - 3 }} onClick={() => setTool('text')}>{t.text}</div>
                ))}
                {STICKERS.map(s => (
                  <div key={s.id} className="a-txt" style={{ left: s.at * pps, width: 30, background: 'var(--acid)', color: 'var(--mint-ink)', justifyContent: 'center', fontStyle: 'normal' }} onClick={() => setTool('sticker')}>{s.glyph}</div>
                ))}
              </div>
            </div>

            {/* playhead */}
            <div className="a-playhead" style={{ left: 92 + pb.time * pps }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* sinusoïde de waveform pseudo-aléatoire */
function wavePath(w, h) {
  let d = `M0 ${h / 2}`; const mid = h / 2;
  for (let x = 0; x <= w; x += 5) {
    const a = (Math.sin(x * 0.13) * 0.5 + Math.sin(x * 0.31) * 0.3 + Math.sin(x * 0.07) * 0.2);
    d += ` L${x} ${mid - a * (mid - 2)}`;
  }
  return d;
}

Object.assign(window, { EditorA });
