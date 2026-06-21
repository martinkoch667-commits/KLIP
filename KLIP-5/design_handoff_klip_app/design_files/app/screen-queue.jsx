/* screen-queue.jsx — publishing queue + Instagram connection + approvals */

function Queue({ active, openPost, toast }) {
  const scope = active === 'all' ? POSTS : POSTS.filter(p => p.client === active);
  const [tab, setTab] = useState('all');
  const [approved, setApproved] = useState({});

  const filtered = scope.filter(p => p.status !== 'published').filter(p => tab === 'all' ? true : tab === 'pending' ? p.status === 'pending' : p.status === 'scheduled');
  const grouped = {};
  filtered.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)).forEach(p => { (grouped[p.day] ||= []).push(p); });

  const counts = { all: scope.filter(p => p.status !== 'published').length, pending: scope.filter(p => p.status === 'pending').length, scheduled: scope.filter(p => p.status === 'scheduled').length };

  return (
    <div className="page screen-in" style={{ maxWidth: 980 }}>
      <h1 className="h-display" style={{ fontSize: 28, marginBottom: 18 }}>File de publication</h1>

      {/* IG connection banner */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, background: 'var(--forest)', color: 'var(--cream)', border: 'none' }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)', display: 'grid', placeItems: 'center', color: '#fff' }}><AIcon name="instagram" size={22} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 8 }}>
            {active === 'all' ? `${CLIENTS.length} comptes Instagram connectés` : `${clientById(active).handle} connecté`}
            <span className="badge" style={{ background: 'var(--mint)', color: 'var(--mint-ink)' }}><AIcon name="check" size={11} /> Actif</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--cream-2)', marginTop: 2 }}>Klip publie automatiquement au créneau planifié. Aucune action requise.</div>
        </div>
        <button className="btn btn-sm" style={{ background: 'var(--cream-4)', color: 'var(--cream)' }} onClick={() => toast && toast('Réglages de connexion Instagram — bientôt')}><AIcon name="settings" size={14} /> Gérer</button>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div className="seg">
          {[['all', 'Tout'], ['pending', 'À valider'], ['scheduled', 'Planifiés']].map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l} <span style={{ opacity: .55 }}>{counts[k]}</span></button>
          ))}
        </div>
      </div>

      {/* grouped list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {Object.keys(grouped).length === 0 && <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Rien dans cette file. ✦</div>}
        {Object.entries(grouped).map(([d, posts]) => (
          <div key={d}>
            <div className="label" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AIcon name="calendar" size={13} /> {DOW[(parseInt(d) + 1 - 1) % 7]} {d} septembre
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {posts.map(p => {
                const c = clientById(p.client);
                const isApproved = approved[p.id];
                return (
                  <div key={p.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button onClick={() => openPost(p)} style={{ width: 52, height: 65, borderRadius: 10, background: p.grad, flexShrink: 0, cursor: 'pointer', border: 'none' }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, lineHeight: 1, height: 18 }}>
                        <Avatar initials={c.initials} color={c.color} size={18} radius={5} />
                        <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.name}</span>
                        <span className="tnum" style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>· {p.time}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }} className="trunc">{p.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.3 }} className="trunc">{p.caption}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {p.status === 'pending' && !isApproved
                        ? <>
                            <button className="btn btn-sm btn-ghost" onClick={() => openPost(p)}>Voir</button>
                            <button className="btn btn-sm btn-primary" onClick={() => { setApproved(a => ({ ...a, [p.id]: true })); toast(`“${p.title}” validé et planifié`); }}><AIcon name="check" size={14} /> Valider</button>
                          </>
                        : <StatusBadge status={isApproved ? 'scheduled' : p.status} />}
                      <button className="btn btn-ghost btn-icon" onClick={() => openPost(p)} title="Éditer"><AIcon name="dots" size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Queue });
