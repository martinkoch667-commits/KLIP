/* dir-b.jsx — DIRECTION B « Séquence »
   Transcript éditable (gauche) · preview (centre) · inspecteur de scène (droite) ·
   ruban de scènes (bas). On monte en éditant le contenu — modèle guidé/éditorial. */

const B_TOOLS = [
  ['media', 'video', 'Média'],
  ['text', 'text', 'Texte'],
  ['captions', 'captions', 'Sous-titres'],
  ['audio', 'music', 'Audio'],
  ['transitions', 'transition', 'Transitions'],
  ['filter', 'filter', 'Filtres'],
  ['speed', 'speed', 'Vitesse'],
  ['sticker', 'sticker', 'Stickers'],
];
const B_TITLES = { media: 'Média', cut: 'Le plan', text: 'Texte & titres', captions: 'Sous-titres', audio: 'Audio', transitions: 'Transitions', filter: 'Filtres', speed: 'Vitesse', sticker: 'Stickers', ai: 'Assistant IA' };

/* calques affichés pour une scène, → outil ouvert dans l'inspecteur */
const SCENE_LAYERS = [
  ['cut', 'video', 'Plan vidéo', c => c.name],
  ['captions', 'captions', 'Sous-titres', () => 'Karaoké · style de marque'],
  ['text', 'text', 'Texte', c => (c.id === 'c1' ? '« La saison change »' : 'Aucun titre')],
  ['filter', 'filter', 'Filtre', c => c.filter],
  ['speed', 'speed', 'Vitesse', c => c.speed + '×'],
  ['audio', 'music', 'Audio', () => 'Golden Hour · voix off'],
];

function EditorB({ subStyle, setSubStyle, accent, runAI, aiLoading, aiLabel, voice, setVoice, toast }) {
  const pb = usePlayback();
  const [sel, setSel] = useState('c1');
  const [inspTool, setInspTool] = useState(null); // null = vue calques de la scène
  const [music, setMusic] = useState('m1');
  const [filter, setFilter] = useState('chaud');
  const [speed, setSpeed] = useState(1);
  const selClip = CLIP_TL.find(c => c.id === sel) || CLIP_TL[0];
  const selIndex = CLIP_TL.findIndex(c => c.id === sel);
  const playingSub = subAt(pb.time);

  const selectScene = (id) => { setSel(id); setInspTool(null); const c = CLIP_TL.find(x => x.id === id); if (c) pb.seek(c.start + 0.1); };
  const onSegClick = (s) => { pb.seek(s.start + 0.05); const c = clipAt(s.start); setSel(c.id); };

  return (
    <div className="b-root">
      <EditorTopbar accent={accent} toast={toast} />

      {/* contextual toolbar */}
      <div className="b-toolbar">
        {B_TOOLS.map(([k, ic, lbl]) => (
          <button key={k} className={'b-tool' + (inspTool === k ? ' on' : '')} onClick={() => setInspTool(k)}>
            <span className="b-tool-ic" style={{ display: 'inline-flex' }}><VIcon name={ic} size={17} /></span>{lbl}
          </button>
        ))}
        <div className="b-tdiv" />
        <button className={'b-tool' + (inspTool === 'ai' ? ' on' : '')} onClick={() => setInspTool('ai')}>
          <span className="b-tool-ic" style={{ display: 'inline-flex', color: 'var(--mint)' }}><VIcon name="sparkles" size={17} /></span>Assistant IA
        </button>
      </div>

      <div className="b-main">
        {/* transcript column */}
        <div className="b-transcript">
          <div className="b-tr-head">
            <div className="b-tr-title">Le script</div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.4 }}>Éditez le texte — la vidéo et les sous-titres suivent.</p>
          </div>
          <div className="b-tr-scroll">
            {SUBS.map(s => {
              const inScene = clipAt(s.start).id === sel;
              const isPlaying = playingSub && playingSub.id === s.id;
              return (
                <div key={s.id} className={'b-seg' + (inScene ? ' on' : '') + (isPlaying ? ' playing' : '')} onClick={() => onSegClick(s)}>
                  <span className="b-seg-time">{fmtShort(s.start)}</span>
                  <span className="b-seg-text" contentEditable suppressContentEditableWarning onClick={e => e.stopPropagation()} onBlur={() => toast('Sous-titre modifié')}>{s.text}</span>
                </div>
              );
            })}
            <button className="btn btn-ghost btn-sm" style={{ margin: '8px 12px' }} onClick={() => runAI('Sous-titres régénérés', 'Klip transcrit la voix')}><VIcon name="sparkles" size={14} /> Re-transcrire</button>
          </div>
        </div>

        {/* center preview */}
        <div className="b-center">
          <div className="mz-stage">
            <div className="halo-blob" style={{ width: 340, height: 340, left: -70, top: -50, background: 'var(--mint)', opacity: .09, filter: 'blur(60px)' }} />
            <div className="halo-blob" style={{ width: 280, height: 280, right: -50, bottom: -40, background: 'var(--acid)', opacity: .07, filter: 'blur(56px)' }} />
            <MZPreview time={pb.time} subStyle={subStyle} />
            {aiLoading && <AIOverlay voice={voice} label={aiLabel} />}
          </div>
          <MZPlaybar {...pb} />
        </div>

        {/* inspector */}
        <div className="b-inspector" key={inspTool || 'scene'}>
          {inspTool ? (
            <>
              <div className="b-insp-head" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="mz-hbtn" style={{ width: 30, height: 30 }} onClick={() => setInspTool(null)}><VIcon name="chevL" size={17} /></button>
                <div><div className="b-insp-eyebrow">Scène {selIndex + 1} · {selClip.label}</div><div className="b-insp-title">{B_TITLES[inspTool]}</div></div>
              </div>
              <div className="b-insp-scroll">
                <PanelBody tool={inspTool} {...{ subStyle, setSubStyle, music, setMusic, filter, setFilter, speed, setSpeed, voice, setVoice, selClip, runAI, toast }} />
              </div>
            </>
          ) : (
            <>
              <div className="b-insp-head">
                <div className="b-insp-eyebrow">Scène {selIndex + 1} / {CLIPS.length}</div>
                <div className="b-insp-title">{selClip.label}</div>
              </div>
              <div className="b-insp-scroll">
                <div className="b-section">
                  <div className="mz-thumb" style={{ background: selClip.grad, aspectRatio: '16/9', borderRadius: 12, marginBottom: 4 }}>
                    <span style={{ position: 'absolute', bottom: 8, left: 10, fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 10, color: '#fff', textShadow: '0 1px 5px rgba(0,0,0,.6)' }}>{selClip.name}</span>
                    <span style={{ position: 'absolute', top: 8, right: 10, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10, color: '#fff', background: 'rgba(0,0,0,.4)', padding: '2px 7px', borderRadius: 99 }}>{selClip.dur.toFixed(1)}s</span>
                  </div>
                </div>
                <div className="b-section">
                  <span className="mz-sec-label">Calques de la scène</span>
                  <div style={{ marginTop: 10 }}>
                    {SCENE_LAYERS.map(([toolKey, ic, name, meta]) => (
                      <div key={toolKey} className="b-layer" onClick={() => setInspTool(toolKey)}>
                        <span className="b-layer-ic"><VIcon name={ic} size={16} /></span>
                        <div style={{ minWidth: 0, flex: 1 }}><div className="b-layer-name">{name}</div><div className="b-layer-meta trunc">{meta(selClip)}</div></div>
                        <VIcon name="chevR" size={16} style={{ color: 'var(--ink-3)' }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="b-section">
                  <span className="mz-sec-label">Durée de la scène</span>
                  <Range label="Affichage" value={selClip.dur} min={1} max={8} step={0.1} onChange={() => toast('Durée ajustée')} fmtv={v => v.toFixed(1) + 's'} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* scene strip = timeline */}
      <div className="b-strip-wrap">
        <div className="b-strip-bar">
          <span className="mz-sec-label"><VIcon name="reorder" size={13} /> La séquence · {CLIPS.length} scènes</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, color: 'var(--ink-3)' }}>{fmtShort(TOTAL)}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Glissez pour réordonner</span>
        </div>
        <div className="b-strip">
          {CLIP_TL.map((c, i) => (
            <React.Fragment key={c.id}>
              <div className={'b-scene' + (sel === c.id ? ' on' : '')} style={{ background: c.grad }} onClick={() => selectScene(c.id)}>
                <div className="b-scene-top">
                  <span className="b-scene-badge"><VIcon name={c.kind === 'photo' ? 'image' : 'video'} size={10} /></span>
                  <span className="b-scene-num">{i + 1}</span>
                </div>
                <div className="b-scene-dots">
                  <i style={{ background: 'var(--acid)' }} title="Sous-titres" />
                  {c.id === 'c1' && <i style={{ background: 'var(--mint)' }} title="Texte" />}
                  <i style={{ background: '#fff', opacity: .8 }} title="Audio" />
                </div>
                <div className="b-scene-foot"><span className="b-scene-name">{c.label}</span><span className="b-scene-dur">{c.dur.toFixed(1)}s</span></div>
              </div>
              {i < CLIP_TL.length - 1 && <div className="b-strans" title="Transition" onClick={() => setInspTool('transitions')}><span>◐</span></div>}
            </React.Fragment>
          ))}
          <button className="b-scene-add" onClick={() => setInspTool('media')}><VIcon name="plus" size={20} /></button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EditorB });
