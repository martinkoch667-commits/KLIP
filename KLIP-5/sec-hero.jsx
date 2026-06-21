/* sec-hero.jsx — Nav, Hero (animated split title), Ticker */

function Nav({ dir }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
      transition: 'background .3s, box-shadow .3s, border-color .3s',
      background: solid ? 'color-mix(in srgb, var(--paper) 86%, transparent)' : 'transparent',
      backdropFilter: solid ? 'saturate(1.3) blur(14px)' : 'none',
      WebkitBackdropFilter: solid ? 'saturate(1.3) blur(14px)' : 'none',
      borderBottom: solid ? dir === 'brut' ? '2.5px solid var(--ink)' : '1px solid var(--line)' : '1px solid transparent'
    }}>
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 76 }}>
        <a href="#top" style={{ display: 'flex', alignItems: 'center' }}><KlipLogo size={28} light={!solid} /></a>
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          {[['Le problème', '#probleme'], ['Comment ça marche', '#how'], ['Le produit', '#apercu'], ['Tarifs', '#tarifs'], ['FAQ', '#faq']].map(([t, h]) =>
          <a key={h} href={h} style={{ fontFamily: 'var(--mono)', fontSize: 13.5, fontWeight: 700, letterSpacing: '.01em', color: solid ? 'var(--ink-2)' : 'var(--cream-2)' }}>{t}</a>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="#" className="nav-cta-ghost" style={{ fontFamily: 'var(--mono)', fontSize: 13.5, fontWeight: 700, color: solid ? 'var(--ink)' : 'var(--cream)' }}>Connexion</a>
          <a href="#tarifs" className="btn btn-acid btn-sm">Essai gratuit</a>
        </div>
      </div>
    </nav>);

}

function Hero({ dir }) {
  const peek = useParallax(0.06);
  const f1 = useParallax(-0.14);
  const f2 = useParallax(0.18);
  const f3 = useParallax(0.1);
  const f4 = useParallax(-0.12);

  // headline runs differ slightly so the serif accent only shows in magazine
  const lines = [
  [{ t: 'Tous vos clients.' }],
  [{ t: 'Un seul ' }, { t: 'outil.', cls: 'it-serif accent-lit' }]];


  const flow = [
  { ic: 'upload', t: 'Importez' },
  { ic: 'image', t: 'Composez & rédigez' },
  { ic: 'send', t: 'Programmez & publiez' }];


  return (
    <header id="top" className="section dotgrid on-forest x" style={{ paddingTop: 150, paddingBottom: 84, position: 'relative', overflow: 'hidden' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <p className="reveal" style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, letterSpacing: '.04em', color: 'var(--cream-2)', marginBottom: 22, textTransform: 'uppercase' }}>
          L’outil de post-production des community managers
        </p>

        <SplitText
          lines={lines}
          className="hero-h1"
          style={{ textAlign: 'center', fontSize: 'clamp(38px, 6.6vw, 80px)', margin: '0 auto', maxWidth: 1080 }}
          stagger={22} />
        

        <p className="lead reveal d1" style={{ textAlign: 'center', maxWidth: 680, margin: '28px auto 0', fontSize: 21 }}>
          Un seul espace pour gérer le contenu Instagram de <strong style={{ color: 'var(--cream)', fontWeight: 700 }}>tous vos clients</strong> — chaque marque avec sa voix. Fini de jongler entre dix outils et d’y perdre vos soirées.
        </p>

        {/* concept en 3 temps */}
        <div className="hero-flow reveal d2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
          {flow.map((s, i) =>
          <React.Fragment key={i}>
              <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13.5,
              color: 'var(--cream)', padding: '10px 16px', borderRadius: dir === 'brut' ? 0 : 999,
              background: 'var(--forest-2)', boxShadow: dir === 'brut' ? 'inset 0 0 0 2px var(--cream)' : 'inset 0 0 0 1px var(--line-f)'
            }}>
                <span style={{ color: 'var(--acid)', display: 'inline-flex' }}><Icon name={s.ic} size={16} /></span>
                {s.t}
              </span>
              {i < flow.length - 1 && <span style={{ color: 'var(--cream-3)', display: 'inline-flex' }}><Icon name="arrow" size={18} /></span>}
            </React.Fragment>
          )}
        </div>

        <div className="reveal d3" style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 34, flexWrap: 'wrap' }}>
          <a href="#tarifs" className="btn btn-acid">Essayer gratuitement <span className="arr"><Icon name="arrowUR" size={18} /></span></a>
          <a href="#apercu" className="btn btn-ghost">Voir KLIP en action</a>
        </div>

        {/* product peek */}
        <div className="hero-peek" style={{ position: 'relative', maxWidth: 1080, margin: '72px auto 0' }}>
          <div ref={peek} className="frame reveal d2">
            <div className="frame-bar">
              <span className="frame-dot" /><span className="frame-dot" /><span className="frame-dot" />
              <span className="frame-url">app.klip.studio / tableau-de-bord</span>
            </div>
            <img src="media/dashboard.png" alt="Tableau de bord KLIP" style={{ display: 'block', width: '100%' }} />
          </div>

          {/* floating accents */}
          <div ref={f1} className="hero-float floatA" style={{ position: 'absolute', left: -42, top: '34%', zIndex: 5 }}>
            <div style={{
              background: 'var(--acid)', color: 'var(--acid-ink)', padding: '14px 18px',
              borderRadius: 'var(--radius-s)', border: dir === 'brut' ? '2.5px solid var(--ink)' : 'none',
              boxShadow: dir === 'brut' ? '5px 5px 0 var(--ink)' : '0 24px 50px -22px rgba(150,200,20,.8)',
              fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, maxWidth: 170, lineHeight: 1.4
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>6 clients</div>
              un seul écran
            </div>
          </div>
          <div ref={f2} className="hero-float floatB" style={{ position: 'absolute', right: -36, top: '12%', zIndex: 5 }}>
            <div style={{
              background: 'var(--forest)', color: 'var(--cream)', padding: '14px 18px',
              borderRadius: 'var(--radius-s)', border: dir === 'brut' ? '2.5px solid var(--ink)' : 'none',
              boxShadow: dir === 'brut' ? '5px 5px 0 var(--acid)' : '0 24px 50px -22px rgba(0,0,0,.6)',
              fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10
            }}>
              <Icon name="spark" size={20} style={{ color: 'var(--acid)' }} />
              <span>Légende IA<br />générée ✓</span>
            </div>
          </div>
          <div ref={f3} className="hero-float floatB" style={{ position: 'absolute', left: -44, bottom: '13%', zIndex: 5 }}>
            <div style={{
              background: 'var(--paper-2)', color: 'var(--ink)', padding: '13px 17px',
              borderRadius: 'var(--radius-s)', border: dir === 'brut' ? '2.5px solid var(--ink)' : 'none',
              boxShadow: dir === 'brut' ? '5px 5px 0 var(--ink)' : '0 24px 50px -24px rgba(0,0,0,.45)',
              fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 11
            }}>
              <span style={{ width: 30, height: 30, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: dir === 'brut' ? 0 : 8, background: 'var(--ink)', color: 'var(--acid)' }}><Icon name="image" size={16} /></span>
              <span>Éditeur visuel<br /><span style={{ color: 'var(--ink-3)' }}>type Canva / Adobe</span></span>
            </div>
          </div>
          <div ref={f4} className="hero-float floatA" style={{ position: 'absolute', right: -30, bottom: '23%', zIndex: 5 }}>
            <div style={{
              background: 'var(--acid)', color: 'var(--acid-ink)', padding: '13px 17px',
              borderRadius: 'var(--radius-s)', border: dir === 'brut' ? '2.5px solid var(--ink)' : 'none',
              boxShadow: dir === 'brut' ? '5px 5px 0 var(--ink)' : '0 24px 50px -22px rgba(150,200,20,.75)',
              fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10
            }}>
              <Icon name="calendar" size={18} />
              <span>Programmé<br />Jeu. 18:30 ✓</span>
            </div>
          </div>
        </div>
      </div>
    </header>);

}

function Ticker() {
  const items = ['Éditeur visuel', 'Légendes IA', 'Voix de marque', 'Calendrier éditorial', 'Un espace par client', 'Publication Instagram', 'Validation client'];
  const row = [...items, ...items];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {row.map((t, i) =>
        <span className="ticker-item" key={i}>{t}<span style={{ fontFamily: 'var(--heavy)' }}>✦</span></span>
        )}
      </div>
    </div>);

}

Object.assign(window, { Nav, Hero, Ticker });