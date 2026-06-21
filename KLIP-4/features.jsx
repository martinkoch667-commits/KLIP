/* features.jsx — Fonctionnalités (bento), Logos agences, Témoignages */

/* mini visuals for the two wide tiles */
function MiniEditor() {
  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', aspectRatio: '16/9', background: 'linear-gradient(150deg,#1f7a4d,#0c2a1d)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
      <div style={{ position: 'absolute', left: 16, bottom: 16, fontFamily: 'var(--display)', fontWeight: 700, fontStyle: 'italic', fontSize: 26, color: '#fff', textShadow: '0 2px 14px rgba(0,0,0,.4)' }}>Nouvelle carte ↗</div>
      <div style={{ position: 'absolute', left: 16, bottom: 16, width: 152, height: 36, border: '1.5px dashed var(--acid)', borderRadius: 6 }} />
      <div style={{ position: 'absolute', left: 8, bottom: 8, width: 9, height: 9, borderRadius: '50%', background: 'var(--acid)' }} />
      <div style={{ position: 'absolute', right: 14, top: 14, display: 'flex', gap: 6 }}>
        {['#C8F135', '#0c2a1d', '#EFEEE4'].map(c => <span key={c} style={{ width: 18, height: 18, borderRadius: '50%', background: c, boxShadow: '0 0 0 1.5px rgba(255,255,255,.6)' }} />)}
      </div>
      <span style={{ position: 'absolute', right: 14, bottom: 14, fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 10, letterSpacing: '.1em', color: 'rgba(255,255,255,.65)' }}>ÉDITEUR · GLISSER-DÉPOSER</span>
    </div>
  );
}
function MiniCalendar() {
  const dots = [[1, 'var(--acid)'], [2, 'var(--forest)'], [4, 'var(--acid)'], [4, 'var(--forest)'], [6, 'var(--forest)']];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginTop: 4 }}>
      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
        <div key={i} style={{ aspectRatio: '1', borderRadius: 8, background: 'var(--white)', boxShadow: 'inset 0 0 0 1px var(--line)', position: 'relative', display: 'grid', placeItems: 'start', padding: 6 }}>
          <span style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 10, color: 'var(--ink-3)' }}>{d}</span>
          <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 3 }}>
            {dots.filter(x => x[0] === i).map((x, j) => <span key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: x[1] }} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Features() {
  const F = ({ ic, t, d, span, tone, children }) => (
    <div className={`card reveal ${span ? 'feat-wide' : ''}`} style={{
      gridColumn: span ? 'span 2' : 'span 1', padding: 28, display: 'flex', flexDirection: 'column', gap: 14,
      background: tone === 'acid' ? 'var(--acid)' : tone === 'forest' ? 'var(--forest)' : 'var(--paper-2)',
      color: tone === 'forest' ? 'var(--cream)' : 'var(--ink)',
      boxShadow: tone ? 'none' : 'inset 0 0 0 1px var(--line-2), 0 1px 2px rgba(13,15,10,.03)'
    }}>
      <span style={{ width: 46, height: 46, borderRadius: 12, display: 'grid', placeItems: 'center',
        background: tone === 'acid' ? 'var(--acid-ink)' : tone === 'forest' ? 'var(--acid)' : 'var(--ink)',
        color: tone === 'acid' ? 'var(--acid)' : tone === 'forest' ? 'var(--acid-ink)' : 'var(--paper)' }}>
        <Icon name={ic} size={22} />
      </span>
      <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em' }}>{t}</h3>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: tone === 'acid' ? 'var(--acid-ink)' : tone === 'forest' ? 'var(--cream-2)' : 'var(--ink-2)', opacity: tone === 'acid' ? .82 : 1 }}>{d}</p>
      {children}
    </div>
  );
  return (
    <section id="features" className="section">
      <div className="wrap">
        <div style={{ maxWidth: 720 }}>
          <span className="eyebrow reveal">Tout au même endroit</span>
          <h2 className="display reveal d1" style={{ fontSize: 'clamp(38px, 4.8vw, 66px)', marginTop: 20 }}>
            Ce qu’il fallait dix outils pour faire,<br /><span className="it acid-text">Klip le fait d’un trait.</span>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 52 }} className="feat-grid">
          <F ic="image" t="Éditeur visuel" d="Appliquez la charte de chaque client — couleurs, typo, logo. Glissez le texte, c’est calé au pixel." span>
            <div style={{ marginTop: 'auto' }}><MiniEditor /></div>
          </F>
          <F ic="voice" t="Voix de marque" d="Ton, style, mots interdits. Chaque génération respecte l’ADN du client." tone="acid" />
          <F ic="wand" t="Descriptions IA" d="Légendes et hashtags générés depuis la photo et le contexte de la marque." />
          <F ic="calendar" t="Calendrier éditorial" d="Tous les posts, tous les clients, sur une grille. Glissez pour replanifier." span>
            <div style={{ marginTop: 'auto' }}><MiniCalendar /></div>
          </F>
          <F ic="layers" t="Un espace par client" d="Charte, historique, comptes connectés — cloisonnés, jamais mélangés." />
          <F ic="instagram" t="Publication directe" d="Connexion Instagram pro. Programmez ou publiez sans quitter Klip." tone="forest" span />
        </div>
      </div>
    </section>
  );
}

/* ── Logos ───────────────────────────────────────────────────── */
function Logos() {
  const names = ['Atelier Nord', 'STUDIO VÉL', 'Maison Pixel', 'Brut & Co', 'La Fabrique', 'Onde·', 'Calibre', 'Studio Aria'];
  return (
    <section className="section-sm" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <div className="wrap">
        <p className="reveal" style={{ textAlign: 'center', fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 32 }}>
          Pensé pour des studios comme le vôtre
        </p>
        <div className="reveal d1" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '22px 48px' }}>
          {names.map((n, i) => (
            <span key={i} style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 23, letterSpacing: '-0.02em', color: 'var(--ink)', opacity: .42, fontStyle: i % 3 === 0 ? 'italic' : 'normal' }}>{n}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Témoignages ─────────────────────────────────────────────── */
function Testimonials() {
  const quotes = [
    { q: 'On est passé de quatre outils à un seul. Le lundi matin n’a plus rien à voir.', a: 'Camille R.', r: 'Directrice de création · studio indépendant', big: true },
    { q: 'La voix de marque par client, c’est ce qui change tout. L’IA ne déborde jamais du cadre.', a: 'Yanis B.', r: 'Social media manager' },
    { q: 'Je gère six comptes sans jongler entre dix onglets. Mes clients valident plus vite.', a: 'Léa M.', r: 'Freelance · contenu de marque' },
  ];
  return (
    <section className="section">
      <div className="wrap">
        <div style={{ maxWidth: 680 }}>
          <span className="eyebrow reveal">Sur le terrain</span>
          <h2 className="display reveal d1" style={{ fontSize: 'clamp(36px, 4.4vw, 58px)', marginTop: 20 }}>
            Le calme, <span className="it acid-text">retrouvé.</span>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, marginTop: 48 }} className="testi-grid">
          <div className="reveal" style={{ background: 'var(--forest)', color: 'var(--cream)', borderRadius: 20, padding: '40px 38px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gridRow: 'span 2' }}>
            <Icon name="spark" size={28} style={{ color: 'var(--acid)' }} />
            <p style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 'clamp(26px,2.6vw,38px)', lineHeight: 1.12, letterSpacing: '-0.02em', margin: '24px 0' }}>“{quotes[0].q}”</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--acid)' }} />
              <div><div style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 15 }}>{quotes[0].a}</div><div style={{ fontSize: 13, color: 'var(--cream-2)' }}>{quotes[0].r}</div></div>
            </div>
          </div>
          {quotes.slice(1).map((x, i) => (
            <div key={i} className={`card reveal d${i + 1}`} style={{ padding: 30, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 18.5, lineHeight: 1.5, fontWeight: 500 }}>“{x.q}”</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
                <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(140deg,var(--acid),#1f7a4d)' }} />
                <div><div style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 14.5 }}>{x.a}</div><div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{x.r}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Features, Logos, Testimonials });
