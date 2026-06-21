/* screen-settings.jsx — "Réglages" : agency settings workspace.
   Left section nav + rich content panels: compte, équipe, comptes
   connectés, notifications, publication, facturation. */

const SET_SECTIONS = [
  { id: 'compte',   label: 'Compte',            icon: 'clients' },
  { id: 'equipe',   label: 'Agence & équipe',   icon: 'grid' },
  { id: 'comptes',  label: 'Comptes connectés', icon: 'instagram' },
  { id: 'notifs',   label: 'Notifications',     icon: 'bell' },
  { id: 'publi',    label: 'Publication',       icon: 'send' },
  { id: 'factu',    label: 'Facturation',       icon: 'bolt' },
];

const TEAM = [
  { name: 'Camille Roche',  email: 'camille@studioklein.fr', role: 'Admin',    color: '#7B5CF5', initials: 'CR', you: true },
  { name: 'Yanis Mernou',   email: 'yanis@studioklein.fr',   role: 'Éditeur',  color: '#2B5FE0', initials: 'YM' },
  { name: 'Léa Tavernier',  email: 'lea@studioklein.fr',     role: 'Éditeur',  color: '#C4452F', initials: 'LT' },
  { name: 'Sacha Bonnet',   email: 'sacha@studioklein.fr',   role: 'Lecture',  color: '#1F7A4D', initials: 'SB' },
];

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: 42, height: 24, borderRadius: 99, background: on ? 'var(--mint)' : 'var(--sunk)', position: 'relative', flexShrink: 0, transition: 'background .16s', boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--line)' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(13,15,10,.3)', transition: 'left .16s' }} />
    </button>
  );
}

function SetRow({ label, sub, children, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function SetCard({ title, desc, children, action }) {
  return (
    <div className="card" style={{ padding: 22, marginBottom: 16 }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 6 }}>
          <div>
            <h3 className="h-title" style={{ fontSize: 16 }}>{title}</h3>
            {desc && <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{desc}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── sections ───────────────────────────────────────────────────── */
function CompteSection({ toast }) {
  const [lang, setLang] = useState('FR');
  const [tfa, setTfa] = useState(true);
  return (
    <>
      <SetCard title="Profil" desc="Vos informations personnelles.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
          <Avatar initials="CR" color="#7B5CF5" size={58} radius={16} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Camille Roche</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Admin · Studio Klein</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => toast && toast('Changer la photo — bientôt')}><AIcon name="image" size={14} /> Changer</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <label><div className="label" style={{ marginBottom: 7 }}>Nom complet</div><input className="input" defaultValue="Camille Roche" /></label>
          <label><div className="label" style={{ marginBottom: 7 }}>E-mail</div><input className="input" defaultValue="camille@studioklein.fr" /></label>
        </div>
      </SetCard>

      <SetCard title="Préférences">
        <SetRow label="Langue de l’interface" sub="Appliquée à toute l’agence.">
          <div className="seg">{['FR', 'EN'].map(l => <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l}</button>)}</div>
        </SetRow>
        <SetRow label="Double authentification" sub="Sécurise l’accès à votre compte." last>
          <Toggle on={tfa} onChange={setTfa} />
        </SetRow>
      </SetCard>

      <SetCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--warn)' }}>Se déconnecter de tous les appareils</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>Termine toutes les sessions actives.</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => toast && toast('Déconnexion de tous les appareils')}><AIcon name="logout" size={14} /> Déconnexion</button>
        </div>
      </SetCard>
    </>
  );
}

function EquipeSection({ toast }) {
  return (
    <>
      <SetCard title="Agence" desc="Identité de votre espace de travail.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
          <span style={{ width: 56, height: 56, borderRadius: 15, background: 'var(--forest)', color: 'var(--mint)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><KlipMark size={20} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Studio Klein</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>6 clients · 4 membres</div>
          </div>
          <span className="chip" style={{ background: 'var(--mint-soft)', color: 'var(--mint-2)' }}><AIcon name="bolt" size={12} /> Plan Agence</span>
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="label" style={{ marginBottom: 7 }}>Nom de l’agence</div>
          <input className="input" defaultValue="Studio Klein" style={{ maxWidth: 360 }} />
        </div>
      </SetCard>

      <SetCard title="Membres" desc="Gérez les accès de votre équipe." action={<button className="btn btn-primary btn-sm" onClick={() => toast && toast('Invitation envoyée — bientôt')}><AIcon name="plus" size={14} /> Inviter</button>}>
        <div style={{ marginTop: 6 }}>
          {TEAM.map((m, i) => (
            <div key={m.email} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i === TEAM.length - 1 ? 'none' : '1px solid var(--line)' }}>
              <Avatar initials={m.initials} color={m.color} size={36} radius={10} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 7 }}>{m.name} {m.you && <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: 9.5 }}>Vous</span>}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }} className="trunc">{m.email}</div>
              </div>
              <span className="chip" style={{ background: m.role === 'Admin' ? 'var(--mint-soft)' : 'var(--sunk)', color: m.role === 'Admin' ? 'var(--mint-2)' : 'var(--ink-2)' }}>{m.role}</span>
              <button className="btn btn-ghost btn-icon" onClick={() => toast && toast(`Gérer ${m.name}`)}><AIcon name="dots" size={16} /></button>
            </div>
          ))}
        </div>
      </SetCard>
    </>
  );
}

function ComptesSection({ toast }) {
  return (
    <SetCard title="Comptes Instagram" desc="Un compte connecté par client. Klip publie en leur nom." action={<button className="btn btn-ghost btn-sm" onClick={() => toast && toast('Connecter un compte — bientôt')}><AIcon name="plus" size={14} /> Connecter</button>}>
      <div style={{ marginTop: 6 }}>
        {CLIENTS.map((c, i) => {
          const stale = c.id === 'brut';
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i === CLIENTS.length - 1 ? 'none' : '1px solid var(--line)' }}>
              <span style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar initials={c.initials} color={c.color} size={38} radius={11} />
                <span style={{ position: 'absolute', bottom: -3, right: -3, width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)', display: 'grid', placeItems: 'center', color: '#fff', boxShadow: '0 0 0 2px var(--white)' }}><AIcon name="instagram" size={11} /></span>
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }} className="trunc">{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }} className="trunc">{c.handle} · {stale ? 'reconnexion requise' : 'synchronisé il y a 2 h'}</div>
              </div>
              {stale
                ? <button className="btn btn-sm" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }} onClick={() => toast && toast(`Reconnexion de ${c.handle}`)}><AIcon name="link" size={13} /> Reconnecter</button>
                : <span className="badge" style={{ background: 'var(--mint-soft)', color: 'var(--mint-2)' }}><span className="dot" style={{ background: 'var(--mint-2)' }} /> Connecté</span>}
              <button className="btn btn-ghost btn-icon" onClick={() => toast && toast(`Gérer ${c.handle}`)}><AIcon name="dots" size={16} /></button>
            </div>
          );
        })}
      </div>
    </SetCard>
  );
}

function NotifsSection() {
  const [n, setN] = useState({ valid: true, success: true, fail: true, weekly: true, comments: false, mention: true });
  const set = (k) => (v) => setN(s => ({ ...s, [k]: v }));
  const [chan, setChan] = useState('email');
  return (
    <>
      <SetCard title="Canal" desc="Où recevoir vos alertes Klip.">
        <SetRow label="Méthode de notification" last>
          <div className="seg">{[['email', 'E-mail'], ['push', 'Push'], ['both', 'Les deux']].map(([k, l]) => <button key={k} className={chan === k ? 'on' : ''} onClick={() => setChan(k)}>{l}</button>)}</div>
        </SetRow>
      </SetCard>
      <SetCard title="Alertes">
        <SetRow label="Demandes de validation" sub="Un post attend votre relecture."><Toggle on={n.valid} onChange={set('valid')} /></SetRow>
        <SetRow label="Publication réussie" sub="Confirmation à chaque post mis en ligne."><Toggle on={n.success} onChange={set('success')} /></SetRow>
        <SetRow label="Échec de publication" sub="Si un post ne part pas, on vous prévient."><Toggle on={n.fail} onChange={set('fail')} /></SetRow>
        <SetRow label="Mentions de l’équipe" sub="Quand un collègue vous mentionne."><Toggle on={n.mention} onChange={set('mention')} /></SetRow>
        <SetRow label="Résumé hebdomadaire" sub="Chaque lundi, la semaine à venir." last><Toggle on={n.weekly} onChange={set('weekly')} /></SetRow>
      </SetCard>
    </>
  );
}

function PubliSection() {
  const [auto, setAuto] = useState(true);
  const [approval, setApproval] = useState(true);
  const [slots, setSlots] = useState(['08:00', '12:30', '19:00']);
  const [tz, setTz] = useState('Europe/Paris');
  const removeSlot = (s) => setSlots(p => p.filter(x => x !== s));
  return (
    <>
      <SetCard title="Automatisation">
        <SetRow label="Publication automatique" sub="Klip publie seul au créneau planifié."><Toggle on={auto} onChange={setAuto} /></SetRow>
        <SetRow label="Validation obligatoire" sub="Un post doit être validé avant d’être planifié." last><Toggle on={approval} onChange={setApproval} /></SetRow>
      </SetCard>
      <SetCard title="Créneaux par défaut" desc="Suggérés à la composition selon l’engagement.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {slots.map(s => (
            <span key={s} className="chip" style={{ background: 'var(--mint-soft)', color: 'var(--mint-2)', fontSize: 12.5, padding: '7px 12px' }}>
              <AIcon name="clock" size={13} /> {s}
              <button onClick={() => removeSlot(s)} style={{ marginLeft: 2, color: 'var(--mint-2)', display: 'grid', placeItems: 'center' }}><AIcon name="plus" size={13} style={{ transform: 'rotate(45deg)' }} /></button>
            </span>
          ))}
          <button className="chip" style={{ background: 'var(--white)', color: 'var(--ink-2)', boxShadow: 'inset 0 0 0 1px var(--line)', fontSize: 12.5, padding: '7px 12px', cursor: 'pointer' }}><AIcon name="plus" size={13} /> Ajouter</button>
        </div>
      </SetCard>
      <SetCard title="Fuseau horaire">
        <SetRow label="Fuseau de référence" sub="Tous les horaires sont calés dessus." last>
          <div className="seg">{['Europe/Paris', 'Europe/London'].map(t => <button key={t} className={tz === t ? 'on' : ''} onClick={() => setTz(t)}>{t.split('/')[1]}</button>)}</div>
        </SetRow>
      </SetCard>
    </>
  );
}

function FactuSection({ toast }) {
  return (
    <>
      <div style={{ position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden', padding: '24px 26px', marginBottom: 16, background: 'linear-gradient(120deg,#0A2418,var(--forest) 55%,#103A28)', color: 'var(--cream)' }}>
        <div className="halo-blob" style={{ width: 240, height: 240, right: -60, top: -130, background: 'var(--mint)', opacity: .4 }} />
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div className="label" style={{ color: 'var(--mint)', marginBottom: 8 }}>Votre abonnement</div>
            <h2 className="h-display" style={{ fontSize: 28, color: 'var(--cream)' }}>Plan Agence</h2>
            <p style={{ color: 'var(--cream-2)', marginTop: 6, fontSize: 13.5 }}>Clients illimités · publication automatique · IA incluse.</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="num" style={{ fontSize: 34, color: 'var(--acid)' }}>89 €<span style={{ fontSize: 15, color: 'var(--cream-2)' }}> / mois</span></div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => toast && toast('Gérer l’abonnement — bientôt')}>Gérer l’abonnement</button>
          </div>
        </div>
      </div>

      <SetCard title="Consommation ce mois-ci">
        {[['Posts publiés', 148, 500], ['Générations IA', 96, 300]].map(([l, v, max]) => (
          <div key={l} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{l}</span>
              <span className="num" style={{ fontSize: 14 }}>{v} <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>/ {max}</span></span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--sunk)', overflow: 'hidden' }}>
              <div style={{ width: `${(v / max) * 100}%`, height: '100%', borderRadius: 99, background: 'var(--mint)' }} />
            </div>
          </div>
        ))}
        <SetRow label="Clients actifs" sub="Inclus dans le plan Agence." last><span className="num" style={{ fontSize: 15 }}>6 <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>/ ∞</span></span></SetRow>
      </SetCard>

      <SetCard title="Moyen de paiement" action={<button className="btn btn-ghost btn-sm" onClick={() => toast && toast('Modifier la carte — bientôt')}>Modifier</button>}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
          <span style={{ width: 44, height: 30, borderRadius: 7, background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 11, letterSpacing: '.05em' }}>VISA</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }} className="tnum">•••• •••• •••• 4242</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Expire 08 / 28</div>
          </div>
        </div>
      </SetCard>

      <SetCard title="Factures">
        <div style={{ marginTop: 6 }}>
          {['Août 2026', 'Juillet 2026', 'Juin 2026'].map((m, i) => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i === 2 ? 'none' : '1px solid var(--line)' }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--sunk)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><AIcon name="bookmark" size={15} /></span>
              <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }}>{m}</span>
              <span className="num" style={{ fontSize: 13.5 }}>89,00 €</span>
              <span className="chip" style={{ background: 'var(--mint-soft)', color: 'var(--mint-2)', fontSize: 10.5 }}>Payée</span>
              <button className="btn btn-ghost btn-icon" title="Télécharger"><AIcon name="arrowUR" size={15} /></button>
            </div>
          ))}
        </div>
      </SetCard>
    </>
  );
}

/* ── root ───────────────────────────────────────────────────────── */
function Settings({ toast }) {
  const [sec, setSec] = useState('compte');
  return (
    <div className="page screen-in" style={{ maxWidth: 1120 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 8 }}>Studio Klein · Espace agence</div>
        <h1 className="h-display" style={{ fontSize: 32 }}>Réglages</h1>
      </div>

      <div className="set-layout" style={{ display: 'grid', gridTemplateColumns: '232px 1fr', gap: 26, alignItems: 'start' }}>
        <nav className="set-nav sb-full" style={{ position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {SET_SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSec(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 'var(--r-s)', textAlign: 'left', fontWeight: 700, fontSize: 13.5, transition: 'all .14s',
              background: sec === s.id ? 'var(--white)' : 'transparent', color: sec === s.id ? 'var(--ink)' : 'var(--ink-2)', boxShadow: sec === s.id ? 'var(--shadow-card)' : 'none' }}>
              <span style={{ color: sec === s.id ? 'var(--mint-2)' : 'var(--ink-3)', display: 'grid', placeItems: 'center' }}><AIcon name={s.icon} size={17} /></span>
              {s.label}
            </button>
          ))}
        </nav>

        <div style={{ minWidth: 0 }}>
          {sec === 'compte'  && <CompteSection toast={toast} />}
          {sec === 'equipe'  && <EquipeSection toast={toast} />}
          {sec === 'comptes' && <ComptesSection toast={toast} />}
          {sec === 'notifs'  && <NotifsSection />}
          {sec === 'publi'   && <PubliSection />}
          {sec === 'factu'   && <FactuSection toast={toast} />}
        </div>
      </div>

      <style>{`
        @media (max-width: 880px) {
          .set-layout { grid-template-columns: 1fr !important; }
          .set-nav { position: static !important; flex-direction: row !important; flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}

Object.assign(window, { Settings });
