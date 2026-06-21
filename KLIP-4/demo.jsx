/* demo.jsx — Process (3 steps) + interactive clickable product demo */

function Process() {
  const steps = [
  { ic: 'upload', n: '01', t: 'Importez vos photos', d: 'Vous rentrez du shooting. Glissez vos visuels dans l’espace du client. C’est tout.' },
  { ic: 'wand', n: '02', t: 'L’IA met en forme', d: 'Texte sur le visuel, légende, hashtags — calibrés sur la voix de chaque marque.' },
  { ic: 'calendar', n: '03', t: 'Planifiez & publiez', d: 'Choisissez les créneaux. Klip publie sur Instagram tout seul, au bon moment.' }];

  return (
    <section id="process" className="section">
      <div className="wrap">
        <div style={{ maxWidth: 720 }}>
          <span className="eyebrow reveal">Comment ça marche</span>
          <h2 className="display reveal d1" style={{ fontSize: 'clamp(38px, 4.8vw, 66px)', marginTop: 20 }}>
            Du shooting au post publié,<br /><span className="it acid-text">en trois respirations.</span>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginTop: 56 }} className="proc-grid">
          {steps.map((s, i) =>
          <div key={i} className={`card reveal d${i + 1}`} style={{ padding: 30, position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
                <span style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--acid)', color: 'var(--acid-ink)', display: 'grid', placeItems: 'center' }}>
                  <Icon name={s.ic} size={24} />
                </span>
                <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 56, lineHeight: 1, color: 'var(--line)' }}>{s.n}</span>
              </div>
              <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', marginBottom: 10 }}>{s.t}</h3>
              <p style={{ color: 'var(--ink-2)', fontSize: 15.5, lineHeight: 1.62 }}>{s.d}</p>
            </div>
          )}
        </div>
      </div>
    </section>);

}

/* ── Interactive demo ──────────────────────────────────────────── */
const PHOTOS = [
{ g: 'linear-gradient(150deg,#2b8d57,#0c2a1d)', n: 'terrasse-01.jpg' },
{ g: 'linear-gradient(150deg,#caa14a,#6e4d1c)', n: 'dessert-04.jpg' },
{ g: 'linear-gradient(150deg,#4a6a8d,#1a2535)', n: 'salle-02.jpg' },
{ g: 'linear-gradient(150deg,#b85c4a,#5a1f17)', n: 'chef-07.jpg' }];

const VOICES = {
  Chic: 'La lumière de fin d’été sur nos tables. Nouvelle carte, réservations ouvertes pour septembre. ✦\n\n#maisonlou #artdevivre #septembre',
  Punchy: 'Septembre, on remet le couvert 🔥 Nouvelle carte, résa en bio — ça part vite.\n\n#maisonlou #foodie #septembre',
  Minimal: 'Septembre. Nouvelle carte. Réservez.\n\n#maisonlou'
};
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function ProductDemo() {
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState(null);
  const [voice, setVoice] = useState('Chic');
  const [caption, setCaption] = useState('');
  const [typing, setTyping] = useState(false);
  const [day, setDay] = useState(null);
  const [published, setPublished] = useState(false);
  const timer = useRef(null);

  const generate = useCallback((v) => {
    const full = VOICES[v];
    setTyping(true);setCaption('');
    clearInterval(timer.current);
    let i = 0;
    timer.current = setInterval(() => {
      i += 2;setCaption(full.slice(0, i));
      if (i >= full.length) {clearInterval(timer.current);setTyping(false);}
    }, 14);
  }, []);
  useEffect(() => () => clearInterval(timer.current), []);

  const reset = () => {setStep(0);setPhoto(null);setCaption('');setVoice('Chic');setDay(null);setPublished(false);};

  const tabs = ['Importer', 'Générer', 'Planifier'];
  const canNext = step === 0 ? photo !== null : step === 1 ? caption.length > 0 && !typing : day !== null;

  return (
    <div style={{
      background: 'var(--paper-2)', borderRadius: 22, overflow: 'hidden',
      boxShadow: '0 1px 0 1px rgba(13,15,10,.06), 0 50px 90px -50px rgba(0,0,0,.7)',
      maxWidth: 980, margin: '0 auto'
    }}>
      {/* window bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--white)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginLeft: 6, whiteSpace: 'nowrap' }}>
          <span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--acid)', display: 'grid', placeItems: 'center', color: 'var(--acid-ink)', flexShrink: 0 }}><Icon name="layers" size={14} /></span>
          <span style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 14 }}>Maison Lou</span>
          <span className="bar-sub" style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--grotesk)', fontWeight: 700 }}>· espace client</span>
        </div>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Démo live</span>
      </div>

      {/* stepper */}
      <div style={{ display: 'flex', gap: 6, padding: '14px 18px', background: 'var(--paper-2)', borderBottom: '1px solid var(--line)' }}>
        {tabs.map((t, i) => {
          const active = i === step,done = i < step;
          return (
            <button key={t} onClick={() => (i <= step || i === step + 1 && canNext) && setStep(i)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              padding: '10px 12px', borderRadius: 999, fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 14,
              background: active ? 'var(--ink)' : done ? 'color-mix(in srgb, var(--acid) 22%, var(--paper))' : 'transparent',
              color: active ? 'var(--paper)' : 'var(--ink)',
              boxShadow: !active && !done ? 'inset 0 0 0 1px var(--line)' : 'none',
              transition: 'all .2s', cursor: 'pointer'
            }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12,
                background: active ? 'var(--acid)' : done ? 'var(--acid)' : 'var(--line)', color: 'var(--acid-ink)' }}>
                {done ? <Icon name="check" size={12} /> : i + 1}
              </span>
              {t}
            </button>);

        })}
      </div>

      {/* body */}
      <div style={{ padding: 24, minHeight: 380, display: 'grid', gridTemplateColumns: step === 0 ? '1fr' : '1fr 1fr', gap: 24 }} className="demo-body">
        {/* STEP 0 — import */}
        {step === 0 &&
        <div>
            <p style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 14, marginBottom: 14, color: 'var(--ink-2)' }}>Choisissez un visuel du dernier shooting</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }} className="photo-grid">
              {PHOTOS.map((p, i) => {
              const sel = photo === i;
              return (
                <button key={i} onClick={() => setPhoto(i)} style={{
                  position: 'relative', borderRadius: 14, overflow: 'hidden', aspectRatio: '4/5', padding: 0,
                  boxShadow: sel ? '0 0 0 3px var(--acid), 0 14px 28px -16px rgba(0,0,0,.5)' : 'inset 0 0 0 1px var(--line)',
                  transition: 'all .15s', transform: sel ? 'translateY(-3px)' : 'none', cursor: 'pointer'
                }}>
                    <span style={{ position: 'absolute', inset: 0, background: p.g }} />
                    {sel && <span style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: 'var(--acid)', color: 'var(--acid-ink)', display: 'grid', placeItems: 'center' }}><Icon name="check" size={15} /></span>}
                    <span style={{ position: 'absolute', left: 8, bottom: 8, fontFamily: 'var(--grotesk)', fontWeight: 700, fontSize: 10.5, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>{p.n}</span>
                  </button>);

            })}
            </div>
            <div style={{ marginTop: 16, border: '1.5px dashed var(--line)', borderRadius: 14, padding: '18px', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink-3)' }}>
              <Icon name="upload" size={20} /><span style={{ fontFamily: 'var(--grotesk)', fontWeight: 700, fontSize: 14 }}>… ou déposez vos propres fichiers ici</span>
            </div>
          </div>
        }

        {/* preview pane (steps 1 & 2) */}
        {step > 0 &&
        <PostPreview photo={photo} caption={step >= 1 ? caption : ''} scheduled={day} published={published} />
        }

        {/* STEP 1 — generate */}
        {step === 1 &&
        <div>
            <p style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 14, marginBottom: 12, color: 'var(--ink-2)' }}>Voix de la marque</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {Object.keys(VOICES).map((v) =>
            <button key={v} onClick={() => {setVoice(v);if (caption) generate(v);}} style={{
              flex: 1, padding: '10px', borderRadius: 10, fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 13.5,
              background: voice === v ? 'var(--ink)' : 'transparent', color: voice === v ? 'var(--paper)' : 'var(--ink)',
              boxShadow: voice === v ? 'none' : 'inset 0 0 0 1px var(--line)', transition: 'all .15s', cursor: 'pointer'
            }}>{v}</button>
            )}
            </div>
            <button onClick={() => generate(voice)} className="btn btn-acid" style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}>
              <Icon name="spark" size={18} /> {caption ? 'Régénérer la description' : 'Générer la description'}
            </button>
            <div style={{ background: 'var(--white)', borderRadius: 12, padding: 16, minHeight: 150, boxShadow: 'inset 0 0 0 1px var(--line)' }}>
              {caption ?
            <p style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-line', color: 'var(--ink)' }}>{caption}<span style={{ opacity: typing ? 1 : 0, color: 'var(--acid-2)' }}>▍</span></p> :
            <p style={{ fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--grotesk)', fontWeight: 600 }}>La description générée apparaîtra ici, calée sur la voix choisie.</p>}
            </div>
          </div>
        }

        {/* STEP 2 — schedule */}
        {step === 2 &&
        <div>
            <p style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 14, marginBottom: 12, color: 'var(--ink-2)' }}>Choisissez un créneau</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 16 }}>
              {DAYS.map((d, i) => {
              const sel = day === i,best = i === 2 || i === 4;
              return (
                <button key={d} onClick={() => {setDay(i);setPublished(false);}} style={{
                  padding: '12px 4px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  background: sel ? 'var(--acid)' : 'var(--white)', color: sel ? 'var(--acid-ink)' : 'var(--ink)',
                  boxShadow: sel ? 'none' : 'inset 0 0 0 1px var(--line)', cursor: 'pointer', transition: 'all .15s', position: 'relative'
                }}>
                    <span style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 12 }}>{d}</span>
                    <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18 }}>{8 + i}</span>
                    {best && !sel && <span style={{ position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: '50%', background: 'var(--acid-2)' }} />}
                  </button>);

            })}
            </div>
            {day !== null &&
          <div style={{ fontFamily: 'var(--grotesk)', fontWeight: 700, fontSize: 13, color: 'var(--ink-2)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="clock" size={15} style={{ color: 'var(--acid-2)' }} /> Suggéré : {DAYS[day]} {8 + day} sept · 18 h 30 — meilleur taux d’engagement
              </div>
          }
            {published ?
          <div style={{ background: 'var(--forest)', color: 'var(--cream)', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--acid)', color: 'var(--acid-ink)', display: 'grid', placeItems: 'center' }}><Icon name="check" size={20} /></span>
                  <div><div style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 15 }}>Programmé sur Instagram</div><div style={{ fontSize: 13, color: 'var(--cream-2)' }}>Vous pouvez passer au client suivant.</div></div>
                </div> :
          <button onClick={() => day !== null && setPublished(true)} className="btn btn-acid" style={{ width: '100%', justifyContent: 'center', opacity: day === null ? .5 : 1 }}>
                  <Icon name="instagram" size={18} /> Programmer la publication
                </button>}
          </div>
        }
      </div>

      {/* footer nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderTop: '1px solid var(--line)', background: 'var(--white)' }}>
        <button onClick={reset} style={{ fontFamily: 'var(--grotesk)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>↺ Recommencer</button>
        {step < 2 ?
        <button onClick={() => canNext && setStep(step + 1)} className="btn btn-ink btn-sm" style={{ opacity: canNext ? 1 : .4, pointerEvents: canNext ? 'auto' : 'none' }}>Suivant <Icon name="arrow" size={16} /></button> :
        <span style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 13, color: 'var(--ink-3)' }}>{published ? '✦ Et voilà.' : 'Dernière étape'}</span>}
      </div>
    </div>);

}

function PostPreview({ photo, caption, scheduled, published }) {
  const p = PHOTOS[photo ?? 0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--white)', borderRadius: 16, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--line)', maxWidth: 320, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px' }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--acid)' }} />
          <span style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 13 }}>maisonlou</span>
          <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>···</span>
        </div>
        <div style={{ position: 'relative', aspectRatio: '4/5', background: p.g, display: 'flex', alignItems: 'flex-end', padding: 18 }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontStyle: 'italic', fontSize: 30, lineHeight: .98, letterSpacing: '-0.02em', color: '#fff', textShadow: '0 2px 18px rgba(0,0,0,.35)' }}>L’été se réserve maintenant</div>
        </div>
        <div style={{ display: 'flex', gap: 14, padding: '11px 12px 6px', color: 'var(--ink)' }}>
          <Icon name="heart" size={20} /><Icon name="chat" size={20} /><Icon name="send" size={20} />
        </div>
        <div style={{ padding: '0 12px 14px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink)', minHeight: 40, whiteSpace: 'pre-line' }}>
          {caption ? <span><b>maisonlou</b> {caption}</span> : <span style={{ color: 'var(--ink-3)' }}>La légende s’ajoutera ici.</span>}
        </div>
      </div>
    </div>);

}

function DemoSection() {
  return (
    <section id="demo" className="section on-forest" style={{ overflow: 'hidden' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 48px' }}>
          <span className="eyebrow plain reveal" style={{ color: 'var(--acid)' }}>Démo interactive</span>
          <h2 className="display reveal d1" style={{ fontSize: 'clamp(36px, 4.4vw, 60px)', lineHeight: 1.05, marginTop: 18, color: 'var(--cream)' }}>
            Essayez. <span className="it acid-text">Cliquez partout.</span>
          </h2>
          <p className="lead reveal d2" style={{ margin: '24px auto 0', color: 'var(--cream-2)' }}>
            Un vrai aperçu du flow Klip — importez une photo, générez la description, planifiez. Sans inscription.
          </p>
        </div>
        <div className="reveal d2"><ProductDemo /></div>
      </div>
    </section>);

}

Object.assign(window, { Process, DemoSection, ProductDemo });