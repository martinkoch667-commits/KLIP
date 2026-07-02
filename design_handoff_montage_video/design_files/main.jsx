/* main.jsx — KLIP Montage vidéo : shell, switch de direction (A/B), IA, toast, tweaks. */

const MZ_DEFAULTS = /*EDITMODE-BEGIN*/{
  "direction": "A",
  "subStyle": "karaoke",
  "accent": "mint"
}/*EDITMODE-END*/;

function MontageApp() {
  const [t, setTweak] = useTweaks(MZ_DEFAULTS);
  const [dir, setDir] = useState(t.direction || 'A');
  const [subStyle, setSubStyle] = useState(t.subStyle || 'karaoke');
  const [voice, setVoice] = useState('Doux');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLabel, setAiLabel] = useState('Klip monte votre vidéo');
  const [toastMsg, setToastMsg] = useState(null);
  const aiTimer = useRef(null), toastTimer = useRef(null);

  // sync tweaks → state
  useEffect(() => { if (t.direction) setDir(t.direction); }, [t.direction]);
  useEffect(() => { if (t.subStyle) setSubStyle(t.subStyle); }, [t.subStyle]);
  useEffect(() => () => { clearTimeout(aiTimer.current); clearTimeout(toastTimer.current); }, []);

  const toast = (m) => { setToastMsg(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToastMsg(null), 2800); };
  const runAI = (toastMessage, overlayLabel) => {
    setAiLabel(overlayLabel || 'Klip monte votre vidéo'); setAiLoading(true);
    clearTimeout(aiTimer.current);
    aiTimer.current = setTimeout(() => { setAiLoading(false); toast(toastMessage || 'Terminé'); }, 2600);
  };
  const setDirection = (d) => { setDir(d); setTweak('direction', d); };
  const changeSubStyle = (s) => { setSubStyle(s); setTweak('subStyle', s); };

  return (
    <div className="mz-app" data-accent={t.accent}>
      {/* top nav */}
      <div className="mz-topnav">
        <KlipMark size={20} light={false} />
        <span className="mz-vrule" />
        <div className="mz-tabs">
          <button className="mz-tab" onClick={() => toast('Onglet Composer')}><VIcon name="sparkles" size={15} /> Composer</button>
          <button className="mz-tab" onClick={() => toast('Onglet Éditeur visuel')}><VIcon name="image" size={15} /> Éditeur visuel</button>
          <button className="mz-tab on"><VIcon name="video" size={15} /> Montage vidéo</button>
        </div>
        <div style={{ flex: 1 }} />
        <span className="mz-sec-label" style={{ marginRight: 4 }}>Direction</span>
        <div className="mz-dir">
          <button className={dir === 'A' ? 'on' : ''} onClick={() => setDirection('A')}><span className="mz-dir-k">A</span> Plan de travail</button>
          <button className={dir === 'B' ? 'on' : ''} onClick={() => setDirection('B')}><span className="mz-dir-k">B</span> Séquence</button>
        </div>
      </div>

      {/* editor body */}
      <div className="mz-body">
        {dir === 'A'
          ? <EditorA subStyle={subStyle} setSubStyle={changeSubStyle} accent={t.accent} runAI={runAI} aiLoading={aiLoading} aiLabel={aiLabel} toast={toast} />
          : <EditorB subStyle={subStyle} setSubStyle={changeSubStyle} accent={t.accent} runAI={runAI} aiLoading={aiLoading} aiLabel={aiLabel} voice={voice} setVoice={setVoice} toast={toast} />}
      </div>

      {/* toast */}
      {toastMsg && (
        <div className="mz-toast pop-in">
          <span className="mz-toast-ic"><VIcon name="check" size={14} /></span>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{toastMsg}</span>
        </div>
      )}

      {/* tweaks */}
      <TweaksPanel>
        <TweakSection label="Direction" />
        <TweakRadio label="Système de montage" value={dir} options={['A', 'B']} onChange={setDirection} />
        <p style={{ fontSize: 11.5, color: 'var(--ink-3, #8B8E7F)', margin: '0 2px 4px', lineHeight: 1.4 }}>
          A · Plan de travail (multi-pistes) — B · Séquence (transcript + scènes)
        </p>
        <TweakSection label="Sous-titres" />
        <TweakSelect label="Style animé" value={subStyle} options={['karaoke', 'editorial', 'clean', 'mint']} onChange={changeSubStyle} />
        <TweakSection label="Charte" />
        <TweakRadio label="Accent" value={t.accent} options={['mint', 'acid']} onChange={v => setTweak('accent', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MontageApp />);
