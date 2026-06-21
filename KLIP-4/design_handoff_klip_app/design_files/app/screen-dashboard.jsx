/* screen-dashboard.jsx — agency overview */

function StatTile({ value, label, icon, tone, sub }) {
  return (
    <div className="card tile-accent" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center',
          background: tone === 'mint' ? 'var(--mint-soft)' : tone === 'warn' ? 'var(--warn-soft)' : 'var(--sunk)',
          color: tone === 'mint' ? 'var(--mint-2)' : tone === 'warn' ? 'var(--warn)' : 'var(--ink-2)' }}>
          <AIcon name={icon} size={20} />
        </span>
        {sub && <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)' }}>{sub}</span>}
      </div>
      <div>
        <div className="num" style={{ fontSize: 34, lineHeight: 1 }}>{value}</div>
        <div style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 3, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

function Dashboard({ active, setActive, openPost, setRoute, compose }) {
  const scope = active === 'all' ? POSTS : POSTS.filter(p => p.client === active);
  const pending = scope.filter(p => p.status === 'pending');
  const scheduled = scope.filter(p => p.status === 'scheduled');
  const upcoming = [...scope].filter(p => p.status !== 'published').sort((a, b) => a.day - b.day).slice(0, 4);
  const clientName = active === 'all' ? null : clientById(active).name;

  return (
    <div className="page screen-in">
      {/* greeting */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 26, flexWrap: 'wrap' }}>
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Mardi 8 septembre · Bonjour Camille</div>
          <h1 className="h-display" style={{ fontSize: 36 }}>
            {active === 'all' ? <>Voici l’état de <span className="it" style={{ color: 'var(--mint-2)' }}>vos marques.</span></>
                              : <>Espace de <span className="it" style={{ color: 'var(--mint-2)' }}>{clientName}.</span></>}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setRoute('calendar')}><AIcon name="calendar" size={16} /> Calendrier</button>
          <button className="btn btn-dark" onClick={compose}><AIcon name="spark" size={16} /> Composer avec l’IA</button>
        </div>
      </div>

      {/* stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }} className="dash-stats">
        <StatTile value="3" label="À publier aujourd’hui" icon="bolt" tone="mint" sub="Auto" />
        <StatTile value={pending.length} label="En attente de validation" icon="clock" tone="warn" />
        <StatTile value={scheduled.length} label="Planifiés cette semaine" icon="calendar" />
        <StatTile value={active === 'all' ? CLIENTS.length : 1} label={active === 'all' ? 'Clients actifs' : 'Compte connecté'} icon="instagram" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 14 }} className="dash-grid">
        {/* upcoming posts */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 className="h-title" style={{ fontSize: 17 }}>Prochaines publications</h2>
            <button className="btn btn-sm btn-ghost" onClick={() => setRoute('queue')}>Tout voir <AIcon name="chevR" size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }} className="up-grid">
            {upcoming.map(p => <PostCard key={p.id} post={p} onClick={() => openPost(p)} />)}
          </div>
        </div>

        {/* right column: feed preview / attention + activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {active !== 'all' && <InstagramPreview client={clientById(active)} onOpenPost={openPost} />}

          {active === 'all' && (
            <div className="card" style={{ padding: 20 }}>
              <h2 className="h-title" style={{ fontSize: 16, marginBottom: 14 }}>Demande votre attention</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {CLIENTS.filter(c => c.pending > 0).slice(0, 3).map(c => (
                  <button key={c.id} onClick={() => setActive(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 8px', borderRadius: 10, textAlign: 'left', transition: 'background .14s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--sunk)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <Avatar initials={c.initials} color={c.color} size={32} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }} className="trunc">{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.pending} post{c.pending > 1 ? 's' : ''} à valider</div>
                    </div>
                    <span className="badge" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>{c.pending}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 20, flex: 1 }}>
            <h2 className="h-title" style={{ fontSize: 16, marginBottom: 16 }}>Activité récente</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {ACTIVITY.filter(a => active === 'all' || a.client === active).map((a, i) => {
                const c = clientById(a.client);
                return (
                  <div key={i} style={{ display: 'flex', gap: 11 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {a.auto ? <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--mint)', color: 'var(--mint-ink)', display: 'grid', placeItems: 'center' }}><AIcon name="bolt" size={15} /></span>
                              : <Avatar initials={a.who.slice(0, 1)} color={c.color} size={28} radius={8} />}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--ink-2)' }}>
                      <b style={{ color: 'var(--ink)' }}>{a.who}</b> {a.what} <b style={{ color: 'var(--ink)' }}>{a.target}</b>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{c.name} · {a.when}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard });
