/* sec-features.jsx — Fonctionnalités (bento), Témoignages */

function EditorMock({ dir }) {
  const r = dir === 'brut' ? 0 : 12;
  const rs = dir === 'brut' ? 0 : '50%';
  const corners = [{ top: -5, left: -5 }, { top: -5, right: -5 }, { bottom: -5, left: -5 }, { bottom: -5, right: -5 }];
  return (
    <div style={{
      background: 'var(--paper-2)', borderRadius: r, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 350, margin: '0 auto',
      boxShadow: dir === 'brut' ? '6px 6px 0 var(--ink)' : '0 34px 64px -30px rgba(0,0,0,.55)',
      border: dir === 'brut' ? '2.5px solid var(--ink)' : '1px solid var(--line-2)'
    }}>
      {/* brand-kit toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 30, height: 30, borderRadius: dir === 'brut' ? 0 : 8, background: 'linear-gradient(140deg,#1f7a4d,#0c2a1d)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11 }}>ML</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#0c2a1d', 'var(--acid)', '#EFEEE4'].map((c, i) => <span key={i} style={{ width: 18, height: 18, borderRadius: rs, background: c, boxShadow: 'inset 0 0 0 1px var(--line)' }} />)}
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, color: 'var(--ink-2)', padding: '5px 9px', borderRadius: dir === 'brut' ? 0 : 7, boxShadow: 'inset 0 0 0 1px var(--line)' }}>Aa Archivo</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, color: 'var(--ink-3)' }}>● calé au pixel</span>
      </div>
      {/* canvas */}
      <div style={{
        position: 'relative', borderRadius: r, overflow: 'hidden', aspectRatio: '3 / 4',
        background: 'radial-gradient(130% 130% at 18% 0%, #20a368, #0a2419 72%)',
        padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10, letterSpacing: '.14em', color: 'rgba(255,255,255,.82)' }}>MAISON LOU</span>
        <div style={{ position: 'relative', alignSelf: 'flex-start', maxWidth: '82%' }}>
          <div style={{ fontFamily: 'var(--heavy)', fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(20px,2.3vw,30px)', lineHeight: 1, color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>L’été se réserve maintenant</div>
          <div style={{ position: 'absolute', inset: '-11px -13px', border: '1.6px dashed var(--acid)', borderRadius: dir === 'brut' ? 0 : 4, pointerEvents: 'none' }}>
            {corners.map((c, i) => <span key={i} style={{ position: 'absolute', ...c, width: 9, height: 9, background: 'var(--acid)', border: '1.5px solid #fff', borderRadius: dir === 'brut' ? 0 : 2 }} />)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#terrasse', '#nouvellecarte', '#septembre'].map((h, i) => (
            <span key={i} style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10.5, color: 'rgba(255,255,255,.9)', padding: '4px 9px', borderRadius: dir === 'brut' ? 0 : 999, background: 'rgba(255,255,255,.12)' }}>{h}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Features({ dir }) {
  const F = ({ ic, t, d, tone }) => {
    const isAcid = tone === 'acid', isForest = tone === 'forest';
    return (
      <div className="card reveal" style={{
        padding: 28, display: 'flex', flexDirection: 'column', gap: 13,
        background: isAcid ? 'var(--acid)' : isForest ? 'var(--forest)' : 'var(--paper-2)',
        color: isForest ? 'var(--cream)' : 'var(--ink)'
      }}>
        <span style={{
          width: 46, height: 46, borderRadius: dir === 'brut' ? 0 : 12, display: 'grid', placeItems: 'center',
          border: dir === 'brut' ? '2.5px solid currentColor' : 'none',
          background: dir === 'brut' ? 'transparent' : (isAcid ? 'var(--acid-ink)' : isForest ? 'var(--acid)' : 'var(--ink)'),
          color: dir === 'brut' ? (isAcid ? 'var(--acid-ink)' : isForest ? 'var(--acid)' : 'var(--ink)') : (isAcid ? 'var(--acid)' : isForest ? 'var(--acid-ink)' : 'var(--paper)')
        }}>
          <Icon name={ic} size={22} />
        </span>
        <h3 style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 21, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>{t}</h3>
        <p style={{ fontSize: 15, lineHeight: 1.58, color: isForest ? 'var(--cream-2)' : isAcid ? 'var(--acid-ink)' : 'var(--ink-2)', opacity: isAcid ? .82 : 1 }}>{d}</p>
      </div>
    );
  };
  const tags = ['Charte par client', 'Glisser-déposer', 'Calé au pixel'];
  return (
    <section id="features" className="section">
      <div className="wrap">
        <div style={{ maxWidth: 820 }}>
          <h2 className="display reveal" style={{ fontSize: 'clamp(38px, 5.6vw, 78px)' }}>
            Ce qu’il fallait dix outils pour faire,<br /><span className="it-serif acid-fill">KLIP le fait d’un trait.</span>
          </h2>
        </div>

        {/* Featured asset — Éditeur visuel */}
        <div className="reveal feat-hero" style={{
          display: 'grid', gridTemplateColumns: '1fr 1.12fr', gap: 0, marginTop: 52,
          background: 'var(--forest)', color: 'var(--cream)', borderRadius: 'var(--radius)', overflow: 'hidden',
          border: dir === 'brut' ? '2.5px solid var(--ink)' : 'none',
          boxShadow: dir === 'brut' ? '8px 8px 0 var(--acid)' : '0 50px 100px -55px rgba(6,32,24,.8)'
        }}>
          <div style={{ padding: 'clamp(32px, 3.6vw, 52px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
            <span style={{
              alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--acid)', color: 'var(--acid-ink)', fontFamily: 'var(--mono)', fontWeight: 700,
              fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', padding: '8px 13px',
              borderRadius: dir === 'brut' ? 0 : 999, border: dir === 'brut' ? '2.5px solid var(--ink)' : 'none'
            }}>
              <Icon name="spark" size={14} /> Atout phare
            </span>
            <h3 className="display" style={{ fontSize: 'clamp(36px, 4.4vw, 62px)' }}>Éditeur visuel</h3>
            <p style={{ color: 'var(--cream-2)', fontSize: 17.5, lineHeight: 1.6, maxWidth: 440 }}>
              La charte de chaque client — couleurs, typo, logo — appliquée d’un clic. Vous glissez le texte, c’est calé au pixel. Plus aucun logiciel de design à ouvrir.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              {tags.map((t, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5, color: 'var(--cream)', padding: '8px 13px', borderRadius: dir === 'brut' ? 0 : 999, background: 'var(--forest-2)', border: dir === 'brut' ? '2px solid var(--cream)' : '1px solid var(--line-f)' }}>
                  <Icon name="check" size={14} style={{ color: 'var(--acid)' }} /> {t}
                </span>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--forest-2)', padding: 'clamp(26px, 3vw, 44px)', display: 'grid', placeItems: 'center' }}>
            <EditorMock dir={dir} />
          </div>
        </div>

        <div className="bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(238px, 1fr))', gap: 16, marginTop: 16 }}>
          <F ic="voice" t="Voix de marque" d="Ton, style, mots interdits. Chaque génération respecte l’ADN du client." tone="acid" />
          <F ic="wand" t="Descriptions IA" d="Légendes et hashtags générés depuis la photo et le contexte de la marque." />
          <F ic="layers" t="Un espace par client" d="Charte, historique, comptes connectés — cloisonnés, jamais mélangés." />
          <F ic="instagram" t="Publication directe" d="Connexion compte pro. Programmez, validez, KLIP publie au créneau." tone="forest" />
        </div>
      </div>
    </section>
  );
}

function Testimonials({ dir }) {
  const big = { q: 'On est passé de quatre outils à un seul. Le lundi matin n’a plus rien à voir — et on a pris trois clients de plus sans embaucher.', a: 'Camille R.', r: 'Directrice de création · Studio Klein' };
  const small = [
    { q: 'La voix de marque par client, c’est ce qui change tout. L’IA ne déborde jamais du cadre.', a: 'Yanis B.', r: 'Social media manager' },
    { q: 'Je gère six comptes sans jongler entre dix onglets. Mes clients valident plus vite.', a: 'Léa M.', r: 'Freelance · contenu de marque' },
  ];
  return (
    <section className="section on-forest x" style={{ overflow: 'hidden' }}>
      <div className="wrap">
        <div style={{ maxWidth: 700 }}>
          <h2 className="display reveal d1" style={{ fontSize: 'clamp(38px, 5.6vw, 78px)', marginTop: 22 }}>
            Le calme, <span className="it-serif acid-fill">retrouvé.</span>
          </h2>
        </div>
        <div className="testi-grid" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 16, marginTop: 52 }}>
          <div className="reveal" style={{
            gridRow: 'span 2', background: 'var(--acid)', color: 'var(--acid-ink)',
            borderRadius: 'var(--radius)', padding: '42px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            border: dir === 'brut' ? '2.5px solid var(--cream)' : 'none'
          }}>
            <Icon name="spark" size={30} />
            <p style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 'clamp(26px, 2.7vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.025em', margin: '26px 0' }}>“{big.q}”</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <span style={{ width: 44, height: 44, borderRadius: dir === 'brut' ? 0 : '50%', background: 'var(--forest)', border: dir === 'brut' ? '2px solid var(--acid-ink)' : 'none' }} />
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15 }}>{big.a}</div>
                <div style={{ fontSize: 13.5, opacity: .72 }}>{big.r}</div>
              </div>
            </div>
          </div>
          {small.map((x, i) => (
            <div key={i} className={`reveal d${i + 1}`} style={{
              background: 'var(--forest-2)', borderRadius: 'var(--radius)', padding: 32,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              border: dir === 'brut' ? '2.5px solid var(--cream)' : '1px solid var(--line-f)',
              boxShadow: dir === 'brut' ? '6px 6px 0 var(--acid)' : 'none'
            }}>
              <p style={{ fontSize: 19, lineHeight: 1.5, fontWeight: 500, color: 'var(--cream)' }}>“{x.q}”</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 26 }}>
                <span style={{ width: 40, height: 40, borderRadius: dir === 'brut' ? 0 : '50%', background: 'linear-gradient(140deg, var(--acid), var(--mint))' }} />
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: 'var(--cream)' }}>{x.a}</div>
                  <div style={{ fontSize: 13, color: 'var(--cream-3)' }}>{x.r}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Features, Testimonials, EditorMock });
