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
      {/* hero */}
      <div style={{ position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden', padding: '30px 32px', marginBottom: 16, background: 'linear-gradient(120deg, #0A2418 0%, var(--forest) 48%, #103A28 100%)', color: 'var(--cream)' }}>
        <div className="halo-blob" style={{ width: 300, height: 300, right: -70, top: -150, background: 'var(--mint)', opacity: .42 }} />
        <div className="halo-blob" style={{ width: 220, height: 220, right: 180, bottom: -150, background: 'var(--acid)', opacity: .28 }} />
        <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1fr auto', gap: 28, alignItems: 'center' }} className="dash-hero">
          <div>
            <div className="label" style={{ color: 'var(--mint)', marginBottom: 12 }}>Mardi 8 septembre · Bonjour Camille</div>
            <h1 className="h-display" style={{ fontSize: 38, color: 'var(--cream)', maxWidth: 520 }}>
              {active === 'all' ? <>Voici l’état de <span className="it" style={{ color: 'var(--mint)' }}>vos marques.</span></>
                                : <>Espace de <span className="it" style={{ color: 'var(--mint)' }}>{clientName}.</span></>}
            </h1>
            <p style={{ color: 'var(--cream-2)', marginTop: 10, maxWidth: 460, fontSize: 14.5 }}>
              {pending.length > 0
                ? <><b style={{ color: 'var(--cream)' }}>{pending.length} post{pending.length > 1 ? 's' : ''}</b> attendent votre validation · 3 partent en automatique aujourd’hui.</>
                : <>Tout est sous contrôle · 3 publications partent en automatique aujourd’hui.</>}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn btn-primary" onClick={compose}><AIcon name="spark" size={16} /> Composer avec l’IA</button>
              <button className="btn" style={{ background: 'var(--cream-4)', color: 'var(--cream)', boxShadow: 'inset 0 0 0 1px var(--cream-3)' }} onClick={() => setRoute('calendar')}><AIcon name="calendar" size={16} /> Calendrier</button>
            </div>
          </div>

          {/* today's auto-publish panel */}
          <div className="dash-hero-card" style={{ width: 256, borderRadius: 'var(--r-l)', background: 'rgba(238,237,227,.08)', boxShadow: 'inset 0 0 0 1px var(--cream-4)', backdropFilter: 'blur(6px)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--mint)', color: 'var(--mint-ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><AIcon name="bolt" size={14} /></span>
              <span className="label" style={{ color: 'var(--cream)' }}>À publier aujourd’hui</span>
              <span className="num" style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--acid)' }}>3</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {upcoming.slice(0, 3).map(p => {
                const c = clientById(p.client);
                return (
                  <button key={p.id} onClick={() => openPost(p)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: 6, borderRadius: 9, textAlign: 'left', transition: 'background .14s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(238,237,227,.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ width: 28, height: 34, borderRadius: 6, background: p.grad, flexShrink: 0 }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: 12, color: 'var(--cream)' }} className="trunc">{p.title}</span>
                      <span className="tnum" style={{ fontSize: 10.5, color: 'var(--cream-2)', fontWeight: 600 }}>{c.name} · {p.time}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
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
