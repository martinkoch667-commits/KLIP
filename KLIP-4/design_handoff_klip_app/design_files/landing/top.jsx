/* top.jsx — Nav, Hero, Marquee, Problème */

function Nav({ onDemo }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const f = () => setSolid(window.scrollY > 24);
    f();window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  const links = [['Le problème', '#probleme'], ['Comment ça marche', '#process'], ['Démo', '#demo'], ['Tarifs', '#tarifs']];
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      transition: 'all .3s', padding: solid ? '12px 0' : '20px 0',
      background: solid ? 'color-mix(in srgb, var(--paper) 82%, transparent)' : 'transparent',
      backdropFilter: solid ? 'blur(14px) saturate(1.4)' : 'none',
      borderBottom: solid ? '1px solid var(--line)' : '1px solid transparent'
    }}>
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <a href="#top" aria-label="Klip"><KlipLogo size={27} /></a>
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          {links.map(([l, h]) =>
          <a key={h} href={h} style={{ fontFamily: 'var(--grotesk)', fontWeight: 700, fontSize: 15, color: 'var(--ink-2)', transition: 'color .15s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ink)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ink-2)'}>{l}</a>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="#" className="nav-login" style={{ fontFamily: 'var(--grotesk)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Se connecter</a>
          <a href="#tarifs" className="btn btn-acid btn-sm">Essayer gratuitement</a>
        </div>
      </div>
    </nav>);

}

/* floating pipeline chip */
const FChip = ({ icon, label, style, accent }) =>
<div style={{
  position: 'absolute', display: 'inline-flex', alignItems: 'center', gap: 8,
  fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 13.5,
  padding: '9px 15px', borderRadius: 999, whiteSpace: 'nowrap',
  background: accent ? 'var(--acid)' : 'var(--white)',
  color: accent ? 'var(--acid-ink)' : 'var(--ink)',
  boxShadow: '0 1px 0 1px rgba(13,15,10,.05), 0 16px 30px -18px rgba(13,15,10,.45)',
  ...style
}}>
    <Icon name={icon} size={16} /> {label}
  </div>;


function HeroCollage() {
  const cards = [
    { i: 0, brand: 'Maison Lou',  tag: 'L\u2019été se\nréserve\nmaintenant', rot: -5, y: 18 },
    { i: 1, brand: 'Café Oreste', tag: 'Nouvelle\ncarte ↗',                 rot: 3,  y: -22 },
    { i: 5, brand: 'Brut & Co',   tag: 'Édition\nlimitée',                  rot: -3, y: -10 },
    { i: 2, brand: 'Studio Vél',  tag: 'On recrute.',                       rot: 5,  y: 24 },
  ];
  return (
    <div className="hero-collage" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        {cards.map((c, k) => (
          <div key={k} style={{ width: 168, flexShrink: 0, transform: `rotate(${c.rot}deg) translateY(${c.y}px)` }}>
            <PostThumb i={c.i} brand={c.brand} tag={c.tag} />
          </div>
        ))}
      </div>
      <FChip icon="image"     label="Visuel"         accent style={{ top: '8%',  left: '13%' }} />
      <FChip icon="wand"      label="Description IA"        style={{ top: '2%',  right: '15%' }} />
      <FChip icon="instagram" label="Publié"               style={{ bottom: '6%', left: '20%' }} />
      <FChip icon="calendar"  label="Planifié"             style={{ bottom: '2%', right: '17%' }} />
    </div>);

}

function Hero({ variant = 'split', onDemo }) {
  const headline =
  <h1 className="display upper" style={{ fontSize: 'clamp(36px, 4vw, 66px)', margin: 0 }}>
      Le social de<br />tous vos clients,<br />
      <span className="it acid-text">d’un même geste.</span>
    </h1>;

  const sub =
  <p className="lead" style={{ maxWidth: 500, marginTop: 28 }}>
      Klip réunit l’éditeur visuel, les descriptions générées par IA, le calendrier
      et la publication Instagram. Un espace par client. Zéro onglet de trop.
    </p>;

  const ctas =
  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 34, alignItems: 'center' }}>
      <a href="#tarifs" className="btn btn-acid">Commencer gratuitement <Icon name="arrowUR" size={18} className="arr" /></a>
      <button className="btn btn-ghost" onClick={onDemo}><Icon name="play" size={16} /> Voir la démo</button>
    </div>;

  const trust =
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 26, color: 'var(--ink-3)', fontFamily: 'var(--grotesk)', fontWeight: 700, fontSize: 13.5 }}>
      <Icon name="check" size={15} style={{ color: 'var(--acid-2)' }} /> Sans carte bancaire
      <span style={{ opacity: .4 }}>·</span> 14 jours offerts
      <span style={{ opacity: .4 }}>·</span> Conçu pour les agences
    </div>;


  if (variant === 'centered') {
    return (
      <header id="top" className="section hero-grid" style={{ paddingTop: 168, paddingBottom: 40, textAlign: 'center', overflow: 'hidden' }}>
        <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
          <div className="reveal in" style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}><span className="eyebrow">Le studio social des agences</span></div>
          <div className="reveal in d1" style={{ display: 'inline-block' }}>
            <h1 className="display upper" style={{ fontSize: 'clamp(44px, 7vw, 100px)' }}>
              Postez pour dix clients<br /><span className="it acid-text">comme pour un seul.</span>
            </h1>
          </div>
          <div className="reveal in d2" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>{sub}{ctas}{trust}</div>
          <div className="reveal in d3" style={{ marginTop: 56, height: 380 }}><HeroCollage /></div>
        </div>
      </header>);

  }

  return (
    <header id="top" className="section" style={{ paddingTop: 176, paddingBottom: 64, overflow: 'hidden' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 40, alignItems: 'center' }}>
        <div className="hero-copy">
          <div className="reveal in" style={{ marginBottom: 22 }}><span className="eyebrow">Le studio social des agences</span></div>
          <div className="reveal in d1">{headline}</div>
          <div className="reveal in d2">{sub}</div>
          <div className="reveal in d2">{ctas}</div>
          <div className="reveal in d3">{trust}</div>
        </div>
        <div className="hero-art reveal in d2" style={{ height: 480 }}><HeroCollage /></div>
      </div>
    </header>);

}

/* ── Marquee ─────────────────────────────────────────────────── */
function Marquee() {
  const words = ['Créer', 'Planifier', 'Publier', 'Recommencer', 'Gagner du temps', 'Un espace par client', 'Descriptions IA', 'Calendrier'];
  const row = [...words, ...words];
  return (
    <div style={{ background: 'var(--acid)', borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)', overflow: 'hidden', padding: '16px 0' }}>
      <div style={{ display: 'flex', width: 'max-content', animation: 'klip-ticker 32s linear infinite' }}>
        {row.map((w, i) =>
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 24, paddingRight: 24 }}>
            <span className="display" style={{ fontStyle: 'italic', fontWeight: 900, fontSize: 27, letterSpacing: '-0.02em', textTransform: 'uppercase', color: 'var(--acid-ink)' }}>{w}</span>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--acid-ink)', opacity: .55 }} />
          </span>
        )}
      </div>
    </div>);

}

/* ── Problème ────────────────────────────────────────────────── */
function Probleme() {
  const tools = [
  { n: 'Canva', t: 'pour les visuels' },
  { n: 'ChatGPT', t: 'pour les légendes' },
  { n: 'Un tableur', t: 'pour le planning' },
  { n: 'Meta Business', t: 'pour publier' }];

  return (
    <section id="probleme" className="section on-forest" style={{ overflow: 'hidden' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="prob-grid">
          <div>
            <span className="eyebrow reveal" style={{ color: 'var(--acid)' }}>Le problème</span>
            <h2 className="display upper reveal d1" style={{ fontSize: 'clamp(34px, 4.2vw, 58px)', marginTop: 20, color: 'var(--cream)' }}>
              Quatre outils.<br />Trop d’allers-retours.<br /><span className="it acid-text">Vos soirées qui filent.</span>
            </h2>
            <p className="lead reveal d2" style={{ marginTop: 24, maxWidth: 460 }}>
              Chaque client, c’est le même rituel : copier-coller d’un outil à l’autre,
              renvoyer une maquette, attendre la validation, reprogrammer. Multiplié par dix.
            </p>
            <div className="reveal d3" style={{ marginTop: 30, display: 'inline-flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 14, background: 'var(--acid)', color: 'var(--acid-ink)' }}>
              <Icon name="clock" size={20} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 14.5, lineHeight: 1.2 }}>≈ 2 h perdues par client, chaque semaine</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tools.map((x, i) =>
            <div key={i} className={`reveal d${i + 1}`} style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 18, transform: `rotate(${i % 2 ? .5 : -.6}deg)`, background: 'var(--forest-2)', borderRadius: 'var(--radius)', boxShadow: 'inset 0 0 0 1px var(--cream-3)' }}>
                <span style={{ fontFamily: 'var(--grotesk)', fontWeight: 900, fontSize: 13, color: 'var(--cream-3)', width: 22 }}>{String(i + 1).padStart(2, '0')}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', color: 'var(--cream)' }}>{x.n}</div>
                  <div style={{ color: 'var(--cream-2)', fontSize: 14.5 }}>{x.t}</div>
                </div>
                <Icon name="arrowUR" size={18} style={{ color: 'var(--cream-3)' }} />
              </div>
            )}
            <div className="reveal d4" style={{ textAlign: 'center', fontFamily: 'var(--grotesk)', fontWeight: 800, color: 'var(--cream-3)', fontSize: 13, marginTop: 6 }}>
              … et vous, au milieu, à tout recoller à la main.
            </div>
          </div>
        </div>
      </div>
    </section>);

}

Object.assign(window, { Nav, Hero, Marquee, Probleme });