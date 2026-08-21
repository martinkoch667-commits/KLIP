'use client';

/**
 * Aperçu de la refonte, accessible sans compte.
 *
 * Cette page n'existe que sur la branche de refonte : elle sert à regarder le
 * nouveau chrome (fond forêt, rail, feuille arrondie) et la nouvelle accroche
 * du tableau de bord sans avoir à se connecter. Les chiffres sont fictifs.
 */

import Sidebar from '@/components/Sidebar';

const Ic = {
  post: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>,
  cal: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>,
  grid: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>,
  bolt: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>,
  plus: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  clock: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
};

const CLIENTS = [
  { nom: 'Café Lomi', compte: '@cafelomi', couleur: '#C8732B', planifies: 12, aValider: 1, connecte: true },
  { nom: 'Maison Verte', compte: '@maisonverte', couleur: '#88B394', planifies: 9, aValider: 1, connecte: true },
  { nom: 'Bloom Fleuriste', compte: '@bloomfleuriste', couleur: '#DD2A7B', planifies: 6, aValider: 0, connecte: true },
];

const STATS = [
  { valeur: 3, libelle: 'À publier aujourd’hui', teinte: '#8FD867', sub: 'Auto' },
  { valeur: 3, libelle: 'En attente de validation', teinte: '#3DEBAB' },
  { valeur: 12, libelle: 'Planifiés', teinte: '#1F7A55' },
  { valeur: 10, libelle: 'Clients actifs', teinte: '#12A87A' },
];

const DEPARTS = [
  { titre: 'Nouveau post', fond: 'var(--forest-2)', encre: '#fff', icone: Ic.post },
  { titre: 'Calendrier', fond: 'var(--mint-2)', encre: '#fff', icone: Ic.cal },
  { titre: 'Templates', fond: 'var(--leaf)', encre: 'var(--leaf-ink)', icone: Ic.grid },
  { titre: 'Fil de publication', fond: 'var(--vio)', encre: '#fff', icone: Ic.bolt },
  { titre: 'Nouveau client', fond: 'var(--ink)', encre: '#fff', icone: Ic.plus },
];

export default function ApercuV2() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: 'var(--sb-w)' }}>
        <header className="topbar topbar-voile">
          <span className="h-title" style={{ fontSize: 15, color: 'var(--ink-2)' }}>Aperçu de la refonte</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost btn-sm">Calendrier</button>
            <button className="btn btn-primary btn-sm">Nouveau post</button>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div className="page">

            <div className="dash-wash">
              <div className="label" style={{ textAlign: 'center', marginBottom: 10 }}>
                Vendredi 21 août · 10 clients actifs
              </div>
              <h1 className="h-display dash-title">
                Voici l’état de <span className="acc-hl">vos marques.</span>
              </h1>
              <p className="dash-lead">3 posts attendent votre validation · Publications automatiques activées.</p>
              <div className="dash-ctas">
                <button className="btn btn-primary">Composer avec l’IA</button>
                <button className="btn btn-ghost">Calendrier</button>
              </div>
              <div className="dash-starts">
                {DEPARTS.map(d => (
                  <button key={d.titre} className="dash-start">
                    <span style={{ background: d.fond, color: d.encre }}>{d.icone}</span>
                    {d.titre}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }} className="dash-stats">
              {STATS.map(st => (
                <div key={st.libelle} className="stat-case" style={{ ['--teinte' as string]: st.teinte }}>
                  <div className="stat-case-txt">
                    <div className="num stat-case-num">{st.valeur}</div>
                    <div className="stat-case-lab">{st.libelle}</div>
                    {st.sub && <span className="stat-case-chip">{st.sub}</span>}
                  </div>
                </div>
              ))}
            </div>

            <h2 className="h-title" style={{ fontSize: 17, marginBottom: 12 }}>Vos clients</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }} className="clients-grid">
              {CLIENTS.map(c => (
                <div key={c.nom} className="card card-hover" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ width: 40, height: 40, borderRadius: 13, background: c.couleur, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>
                      {c.nom.slice(0, 2).toUpperCase()}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <b style={{ display: 'block', fontSize: 14 }}>{c.nom}</b>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{c.compte}</span>
                    </span>
                    <span className="badge" style={{ marginLeft: 'auto', background: 'var(--mint-soft)', color: 'var(--mint-2)' }}>Connecté</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 3, borderRadius: 10, overflow: 'hidden' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ aspectRatio: '1', background: `color-mix(in srgb, ${c.couleur} ${18 + i * 12}%, var(--sunk))` }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: 'var(--ink-3)' }}>
                    <b style={{ color: 'var(--ink)' }}>{c.planifies}</b> planifiés ·
                    <b style={{ color: 'var(--ink)' }}>{c.aValider}</b> à valider
                    <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--ink)' }}>Ouvrir ›</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
