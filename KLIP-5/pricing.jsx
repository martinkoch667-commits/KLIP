/* pricing.jsx — Tarifs, FAQ, CTA final, Footer */

function Pricing() {
  const [annual, setAnnual] = useState(true);
  const plans = [
  { name: 'Solo', m: 29, y: 24, tag: 'Pour démarrer', accent: false,
    feats: ['Jusqu’à 3 clients', 'Éditeur visuel complet', 'Descriptions IA illimitées', 'Calendrier éditorial', 'Publication Instagram'] },
  { name: 'Agence', m: 79, y: 65, tag: 'Le plus choisi', accent: true,
    feats: ['Clients illimités', 'Tout le plan Solo', 'Voix de marque par client', 'Rôles & validations équipe', 'Support prioritaire'] }];

  return (
    <section id="tarifs" className="section">
      <div className="wrap">
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
          <span className="eyebrow reveal" style={{ justifyContent: 'center' }}>Tarifs</span>
          <h2 className="display reveal d1" style={{ fontSize: 'clamp(38px, 4.8vw, 64px)', marginTop: 18 }}>
            Simple. <span className="it acid-text">Sans surprise.</span>
          </h2>
          <p className="lead reveal d2" style={{ margin: '16px auto 0' }}>Deux formules, tout inclus. Changez ou arrêtez quand vous voulez.</p>
          <div className="reveal d2" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 28, padding: 5, borderRadius: 999, background: 'var(--paper-2)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
            {[['Mensuel', false], ['Annuel', true]].map(([l, v]) =>
            <button key={l} onClick={() => setAnnual(v)} style={{
              padding: '9px 18px', borderRadius: 999, fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 14,
              background: annual === v ? 'var(--ink)' : 'transparent', color: annual === v ? 'var(--paper)' : 'var(--ink-2)',
              display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all .2s'
            }}>{l}{v && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, background: 'var(--acid)', color: 'var(--acid-ink)' }}>−2 mois</span>}</button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 760, margin: '46px auto 0' }} className="price-grid">
          {plans.map((p, i) =>
          <div key={p.name} className={`reveal d${i + 1}`} style={{
            borderRadius: 22, padding: 34, position: 'relative', overflow: 'hidden',
            background: p.accent ? 'var(--forest)' : 'var(--paper-2)', color: p.accent ? 'var(--cream)' : 'var(--ink)',
            boxShadow: p.accent ? '0 30px 60px -40px rgba(12,42,29,.9)' : 'inset 0 0 0 1px var(--line)'
          }}>
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--grotesk)', fontWeight: 900, fontSize: 16, letterSpacing: '.02em' }}>{p.name}</span>
                  <span style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap',
                  background: p.accent ? 'var(--acid)' : 'var(--ink)', color: p.accent ? 'var(--acid-ink)' : 'var(--paper)' }}>{p.tag}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, margin: '22px 0 6px' }}>
                  <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 64, lineHeight: .9, letterSpacing: '-0.03em' }}>{annual ? p.y : p.m}€</span>
                  <span style={{ fontSize: 15, color: p.accent ? 'var(--cream-2)' : 'var(--ink-3)', marginBottom: 10, fontFamily: 'var(--grotesk)', fontWeight: 700, whiteSpace: 'nowrap' }}>/ mois</span>
                </div>
                <p style={{ fontSize: 13, color: p.accent ? 'var(--cream-2)' : 'var(--ink-3)', fontFamily: 'var(--grotesk)', fontWeight: 600, minHeight: 18 }}>
                  {annual ? `Facturé ${p.y * 12}€ par an` : 'Facturé chaque mois'}
                </p>
                <div style={{ height: 1, background: p.accent ? 'var(--cream-3)' : 'var(--line)', margin: '22px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  {p.feats.map((f) =>
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 11, fontSize: 14.5 }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--acid)', color: 'var(--acid-ink)' }}><Icon name="check" size={13} /></span>
                      {f}
                    </div>
                )}
                </div>
                <a href="#" className={`btn ${p.accent ? 'btn-acid' : 'btn-ink'}`} style={{ width: '100%', justifyContent: 'center' }}>Commencer <Icon name="arrowUR" size={17} /></a>
              </div>
            </div>
          )}
        </div>
        <p className="reveal" style={{ textAlign: 'center', marginTop: 24, color: 'var(--ink-3)', fontFamily: 'var(--grotesk)', fontWeight: 700, fontSize: 13.5 }}>14 jours offerts · sans carte bancaire · résiliable en un clic</p>
      </div>
    </section>);

}

/* ── FAQ ─────────────────────────────────────────────────────── */
function FAQ() {
  const [open, setOpen] = useState(0);
  const items = [
  { q: 'Klip publie-t-il vraiment tout seul sur Instagram ?', a: 'Oui. Une fois votre compte Instagram professionnel connecté, Klip programme et publie au créneau choisi, sans intervention de votre part.' },
  { q: 'Faut-il un compte Instagram professionnel ?', a: 'Pour la publication automatique, oui — c’est une exigence de Meta. La connexion se fait en quelques clics, on vous guide.' },
  { q: 'Combien de clients puis-je gérer ?', a: 'Jusqu’à 3 avec Solo, et autant que vous voulez avec Agence. Chaque client a son espace : charte, voix de marque, historique et comptes séparés.' },
  { q: 'L’IA respecte-t-elle la charte de chaque marque ?', a: 'Vous définissez le ton, le style et les mots à éviter par client. Chaque génération reste dans ce cadre — vous gardez la main sur le résultat final.' },
  { q: 'Les données de mes clients sont-elles cloisonnées ?', a: 'Chaque espace est isolé. Aucune donnée ne fuit d’un client à l’autre, et vous contrôlez qui accède à quoi.' },
  { q: 'Puis-je annuler à tout moment ?', a: 'Oui, en un clic depuis vos paramètres. Aucun engagement, aucune justification à fournir.' }];

  return (
    <section className="section" style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--line)' }}>
      <div className="wrap" style={{ display: 'grid', gridTemplateColumns: '.8fr 1.2fr', gap: 56 }} className="faq-grid">
        <div>
          <span className="eyebrow reveal">Questions</span>
          <h2 className="display reveal d1" style={{ fontSize: 'clamp(34px, 4vw, 54px)', marginTop: 18 }}>
            Tout ce que<br />vous vous <span className="it acid-text">demandez.</span>
          </h2>
          <p className="lead reveal d2" style={{ marginTop: 18 }}>Une autre question ? <a href="#" style={{ color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Écrivez-nous.</a></p>
        </div>
        <div className="reveal d1">
          {items.map((it, i) => {
            const o = open === i;
            return (
              <div key={i} style={{ borderTop: '1px solid var(--line)', borderBottom: i === items.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <button onClick={() => setOpen(o ? -1 : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '22px 0', textAlign: 'left' }}>
                  <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{it.q}</span>
                  <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: o ? 'var(--acid)' : 'transparent', color: o ? 'var(--acid-ink)' : 'var(--ink)', boxShadow: o ? 'none' : 'inset 0 0 0 1.5px var(--line)', transition: 'all .2s', transform: o ? 'rotate(45deg)' : 'none' }}><Icon name="plus" size={16} /></span>
                </button>
                <div style={{ maxHeight: o ? 200 : 0, overflow: 'hidden', transition: 'max-height .35s cubic-bezier(.16,1,.3,1)' }}>
                  <p style={{ paddingBottom: 24, color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.62, maxWidth: 560 }}>{it.a}</p>
                </div>
              </div>);

          })}
        </div>
      </div>
    </section>);

}

/* ── CTA final ───────────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="reveal" style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(120deg, #DCF55E 0%, var(--acid) 26%, #2FD79B 100%)', borderRadius: 28, padding: 'clamp(48px,7vw,96px) 40px', textAlign: 'center' }}>
          <div style={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', right: '-80px', top: '-140px', background: 'radial-gradient(circle, rgba(12,42,29,.18), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <span className="eyebrow plain" style={{ color: 'var(--acid-ink)', opacity: .7 }}>Prêt ?</span>
            <h2 className="display upper" style={{ fontSize: 'clamp(40px, 6.4vw, 96px)', color: 'var(--acid-ink)', marginTop: 16 }}>
              Rendez à vos clients<br /><span className="it">le temps qu’ils méritent.</span>
            </h2>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 36 }}>
              <a href="#" className="btn btn-ink" style={{ fontSize: 17, padding: '17px 32px' }}>Commencer gratuitement <Icon name="arrowUR" size={18} className="arr" /></a>
              <a href="#demo" className="btn" style={{ fontSize: 17, padding: '17px 32px', background: 'transparent', color: 'var(--acid-ink)', boxShadow: 'inset 0 0 0 1.5px var(--acid-ink)' }}>Revoir la démo</a>
            </div>
            <p style={{ marginTop: 22, fontFamily: 'var(--grotesk)', fontWeight: 700, fontSize: 14, color: 'var(--acid-ink)', opacity: .7 }}>14 jours offerts · sans carte bancaire</p>
          </div>
        </div>
      </div>
    </section>);

}

/* ── Footer ──────────────────────────────────────────────────── */
function Footer() {
  const cols = [
  ['Produit', ['Fonctionnalités', 'Démo', 'Tarifs', 'Nouveautés']],
  ['Ressources', ['Centre d’aide', 'Guide agences', 'Statut', 'Contact']],
  ['Légal', ['Confidentialité', 'Conditions', 'Cookies']]];

  return (
    <footer style={{ background: 'var(--forest)', color: 'var(--cream)', padding: '72px 0 40px', position: 'relative', overflow: 'hidden' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 40 }} className="foot-grid">
          <div>
            <KlipLogo size={30} light />
            <p style={{ marginTop: 18, color: 'var(--cream-2)', fontSize: 15.5, lineHeight: 1.6, maxWidth: 320 }}>
              Le studio social qui pense comme votre agence. Créez, planifiez et publiez le contenu de tous vos clients au même endroit.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              {['instagram', 'send', 'chat'].map((ic) =>
              <span key={ic} style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px var(--cream-3)', color: 'var(--cream)' }}><Icon name={ic} size={18} /></span>
              )}
            </div>
          </div>
          {cols.map(([h, links]) =>
          <div key={h}>
              <div style={{ fontFamily: 'var(--grotesk)', fontWeight: 800, fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--cream-2)', marginBottom: 18 }}>{h}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {links.map((l) => <a key={l} href="#" style={{ color: 'var(--cream)', fontSize: 15, opacity: .85 }}>{l}</a>)}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginTop: 56, paddingTop: 26, borderTop: '1px solid var(--cream-3)', color: 'var(--cream-2)', fontSize: 13.5, fontFamily: 'var(--grotesk)', fontWeight: 600 }}>
          <span>© 2026 Klip — Fait avec soin pour les agences créatives.</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--acid)' }} /> Tous les systèmes opérationnels</span>
        </div>
      </div>
    </footer>);

}

Object.assign(window, { Pricing, FAQ, FinalCTA, Footer });