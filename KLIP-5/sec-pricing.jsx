/* sec-pricing.jsx — Tarifs, FAQ, CTA final, Footer */

function Pricing({ dir }) {
  const tiers = [
    { name: 'Solo', price: '24', tag: 'Le freelance qui démarre', clients: 'Jusqu’à 3 clients',
      feats: ['Éditeur visuel complet', 'Descriptions IA', 'Calendrier éditorial', '1 compte Instagram'], cta: 'Commencer', pop: false },
    { name: 'Studio', price: '59', tag: 'Le bon rythme de croisière', clients: 'Jusqu’à 10 clients',
      feats: ['Tout Solo, plus :', 'Voix de marque par client', 'Validation client intégrée', 'Création en lot', 'Comptes Instagram illimités'], cta: 'Essai 14 jours', pop: true },
    { name: 'Agence', price: '129', tag: 'Quand l’équipe s’agrandit', clients: 'Clients illimités',
      feats: ['Tout Studio, plus :', 'Membres d’équipe illimités', 'Rôles & permissions', 'Support prioritaire'], cta: 'Nous contacter', pop: false },
  ];
  return (
    <section id="tarifs" className="section dotgrid" style={{ overflow: 'hidden' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
          <h2 className="display reveal d1" style={{ fontSize: 'clamp(38px, 5.6vw, 78px)', marginTop: 22 }}>
            Un prix qui grandit <span className="it-serif acid-fill">avec vous.</span>
          </h2>
          <p className="lead reveal d2" style={{ marginTop: 22 }}>Sans engagement. Le plafond de verre, vous le brisez quand vous voulez.</p>
        </div>

        <div className="price-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 56, alignItems: 'start' }}>
          {tiers.map((t, i) => (
            <div key={i} className={`reveal d${i + 1}`} style={{
              position: 'relative',
              background: t.pop ? 'var(--forest)' : 'var(--paper-2)',
              color: t.pop ? 'var(--cream)' : 'var(--ink)',
              borderRadius: 'var(--radius)', padding: '34px 32px',
              border: dir === 'brut' ? `2.5px solid ${t.pop ? 'var(--ink)' : 'var(--ink)'}` : (t.pop ? 'none' : '1px solid var(--line)'),
              boxShadow: dir === 'brut' ? (t.pop ? '8px 8px 0 var(--acid)' : '6px 6px 0 var(--ink)') : (t.pop ? '0 40px 80px -40px rgba(6,32,24,.6)' : 'none'),
              transform: t.pop && dir === 'magazine' ? 'translateY(-14px)' : 'none'
            }}>
              {t.pop && (
                <span style={{
                  position: 'absolute', top: dir === 'brut' ? -14 : -13, right: 26,
                  background: 'var(--acid)', color: 'var(--acid-ink)', fontFamily: 'var(--mono)', fontWeight: 700,
                  fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 12px',
                  borderRadius: dir === 'brut' ? 0 : 999, border: dir === 'brut' ? '2.5px solid var(--ink)' : 'none'
                }}>Le plus choisi</span>
              )}
              <div style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 22, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>{t.name}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: t.pop ? 'var(--cream-3)' : 'var(--ink-3)', marginTop: 4 }}>{t.tag}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '22px 0 4px' }}>
                <span style={{ fontFamily: 'var(--heavy)', fontWeight: 900, fontSize: 58, letterSpacing: '-0.04em', lineHeight: 1 }}>{t.price}€</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: t.pop ? 'var(--cream-2)' : 'var(--ink-3)' }}>/mois</span>
              </div>
              <div className="chip" style={{ marginBottom: 24, background: t.pop ? 'var(--forest-2)' : 'var(--paper-3)', color: t.pop ? 'var(--cream-2)' : 'var(--ink-2)', boxShadow: dir === 'brut' ? `inset 0 0 0 2px ${t.pop ? 'var(--cream)' : 'var(--ink)'}` : 'inset 0 0 0 1px var(--line)' }}>{t.clients}</div>
              <a href="#" className={`btn ${t.pop ? 'btn-acid' : 'btn-ghost'}`} style={{ width: '100%', justifyContent: 'center', marginBottom: 26 }}>{t.cta}</a>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {t.feats.map((f, j) => (
                  <li key={j} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 15, color: t.pop ? 'var(--cream-2)' : 'var(--ink-2)', fontWeight: j === 0 && f.endsWith(':') ? 700 : 400 }}>
                    {!(j === 0 && f.endsWith(':')) && <Icon name="check" size={17} style={{ flex: 'none', marginTop: 2, color: t.pop ? 'var(--acid)' : 'var(--acid-2)' }} />}
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ({ dir }) {
  const items = [
    { q: 'Faut-il déjà avoir un compte Instagram pro ?', a: 'Oui. KLIP se connecte à un compte Instagram professionnel ou créateur via l’API officielle. La connexion prend deux minutes, par client.' },
    { q: 'L’IA respecte-t-elle vraiment la voix de chaque marque ?', a: 'Vous définissez le ton, le style et les mots interdits de chaque client une fois. Chaque génération s’appuie sur cette voix — vous gardez la main et peaufinez d’un clic.' },
    { q: 'Mes clients peuvent-ils valider sans compte KLIP ?', a: 'Oui. Vous envoyez un lien de validation : le client approuve ou commente directement, sans rien installer. Fini les allers-retours par mail.' },
    { q: 'Mes données clients sont-elles cloisonnées ?', a: 'Chaque client a son espace : charte, historique, comptes connectés. Rien n’est mélangé entre deux marques, jamais.' },
    { q: 'Puis-je changer d’offre en cours de route ?', a: 'À tout moment, sans engagement. Vous montez d’un palier quand vous prenez plus de clients, et redescendez si besoin.' },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="section">
      <div className="wrap">
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: 56, alignItems: 'start' }}>
          <div>
            <h2 className="display reveal d1" style={{ fontSize: 'clamp(36px, 4.8vw, 64px)', marginTop: 22 }}>
              Les questions <span className="it-serif acid-fill">qu’on nous pose.</span>
            </h2>
            <p className="lead reveal d2" style={{ marginTop: 22 }}>Une autre en tête ? <a href="#" style={{ color: 'var(--ink)', textDecoration: 'underline', textDecorationColor: 'var(--acid-2)', textUnderlineOffset: 3 }}>Écrivez-nous.</a></p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((it, i) => {
              const isOpen = open === i;
              return (
                <div key={i} className="reveal" style={{ borderTop: dir === 'brut' ? '2.5px solid var(--ink)' : '1px solid var(--line)', borderBottom: i === items.length - 1 ? (dir === 'brut' ? '2.5px solid var(--ink)' : '1px solid var(--line)') : 'none' }}>
                  <button onClick={() => setOpen(isOpen ? -1 : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '24px 2px', textAlign: 'left' }}>
                    <span style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 19.5, letterSpacing: '-0.015em', textTransform: dir === 'brut' ? 'uppercase' : 'none' }}>{it.q}</span>
                    <span style={{ flex: 'none', width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: dir === 'brut' ? 0 : '50%', background: isOpen ? 'var(--acid)' : 'var(--paper-3)', color: 'var(--ink)', transition: 'transform .3s, background .2s', transform: isOpen ? 'rotate(45deg)' : 'none', border: dir === 'brut' ? '2px solid var(--ink)' : 'none' }}>
                      <Icon name="plus" size={18} />
                    </span>
                  </button>
                  <div style={{ maxHeight: isOpen ? 240 : 0, overflow: 'hidden', transition: 'max-height .4s cubic-bezier(.16,1,.3,1)' }}>
                    <p style={{ padding: '0 50px 26px 2px', color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.6 }}>{it.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ dir }) {
  return (
    <section className="section on-forest dotgrid x" style={{ overflow: 'hidden', textAlign: 'center' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <h2 className="display reveal d1" style={{ fontSize: 'clamp(46px, 8vw, 116px)', maxWidth: 1000, margin: '0 auto' }}>
          Créez plus, <span className="it-serif acid-fill">jonglez moins.</span>
        </h2>
        <p className="lead reveal d2" style={{ maxWidth: 560, margin: '26px auto 0', fontSize: 20 }}>
          Un seul outil pour tous vos clients. Essayez KLIP gratuitement pendant 14 jours — sans carte bancaire.
        </p>
        <div className="reveal d3" style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 40, flexWrap: 'wrap' }}>
          <a href="#" className="btn btn-acid">Démarrer gratuitement <span className="arr"><Icon name="arrowUR" size={18} /></span></a>
          <a href="#apercu" className="btn btn-ghost">Revoir le produit</a>
        </div>
      </div>
    </section>
  );
}

function Footer({ dir }) {
  const cols = [
    ['Produit', ['Éditeur visuel', 'Descriptions IA', 'Calendrier', 'Publication']],
    ['Ressources', ['Tarifs', 'FAQ', 'Guide de démarrage', 'Statut']],
    ['Agence', ['À propos', 'Blog', 'Contact', 'Mentions légales']],
  ];
  return (
    <footer className="on-forest x" style={{ paddingTop: 72, paddingBottom: 40, borderTop: dir === 'brut' ? '2.5px solid var(--acid)' : '1px solid var(--line-f)' }}>
      <div className="wrap">
        <div className="foot-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 40 }}>
          <div>
            <KlipLogo size={30} light />
            <p style={{ color: 'var(--cream-2)', fontSize: 15, lineHeight: 1.6, marginTop: 18, maxWidth: 280 }}>
              Le studio social des agences. Toutes vos marques, un seul espace.
            </p>
          </div>
          {cols.map(([h, links], i) => (
            <div key={i}>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cream-3)', marginBottom: 16 }}>{h}</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
                {links.map((l, j) => <li key={j}><a href="#" style={{ color: 'var(--cream-2)', fontSize: 15 }}>{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 56, paddingTop: 26, borderTop: '1px solid var(--line-f)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--cream-3)' }}>
          <span>© 2026 KLIP — Tous droits réservés.</span>
          <span>Conçu pour les agences qui veulent grandir.</span>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Pricing, FAQ, FinalCTA, Footer });
