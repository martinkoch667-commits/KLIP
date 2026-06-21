/* screen-clients.jsx — client workspaces */

function ClientCard({ c, openPost, setActive }) {
  const posts = POSTS.filter(p => p.client === c.id).slice(0, 3);
  return (
    <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* brand header band */}
      <div style={{ height: 78, background: c.grad, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 5 }}>
          {[c.color, '#EEEDE3', '#14160F'].map((col, i) => <span key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: col, boxShadow: '0 0 0 1.5px rgba(255,255,255,.5)' }} />)}
        </div>
      </div>
      <div style={{ padding: '0 18px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 14 }}>
          <Avatar initials={c.initials} color={c.color} size={48} radius={13} style={{ boxShadow: '0 0 0 3px var(--white)', marginTop: -22 }} />
          <div style={{ paddingBottom: 2 }}>
            <div className="h-title" style={{ fontSize: 17 }}>{c.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>{c.handle} · {c.industry}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {posts.map(p => (
            <button key={p.id} onClick={() => openPost(p)} style={{ flex: 1, aspectRatio: '4/5', borderRadius: 8, background: p.grad, border: 'none', cursor: 'pointer', transition: 'transform .14s', position: 'relative' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'} />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <div><span className="num" style={{ fontSize: 19 }}>{c.scheduled}</span> <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>planifiés</span></div>
          {c.pending > 0 && <div><span className="num" style={{ fontSize: 19, color: 'var(--warn)' }}>{c.pending}</span> <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>à valider</span></div>}
          <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setActive(c.id)}>Ouvrir <AIcon name="arrowUR" size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function Clients({ openPost, setActive, toast }) {
  return (
    <div className="page screen-in">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="h-display" style={{ fontSize: 30 }}>Vos clients</h1>
          <p style={{ color: 'var(--ink-2)', marginTop: 6 }}>{CLIENTS.length} marques · chacune son espace, sa charte, ses comptes.</p>
        </div>
        <button className="btn btn-primary" onClick={() => toast && toast('Nouvel espace client — bientôt disponible')}><AIcon name="plus" size={17} /> Ajouter un client</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }} className="clients-grid">
        {CLIENTS.map(c => <ClientCard key={c.id} c={c} openPost={openPost} setActive={setActive} />)}
        <button className="card" onClick={() => toast && toast('Nouvel espace client — bientôt disponible')} style={{ border: '1.5px dashed var(--line)', background: 'transparent', minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--ink-3)', cursor: 'pointer', transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.color = 'var(--mint-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-3)'; }}>
          <span style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--sunk)', display: 'grid', placeItems: 'center' }}><AIcon name="plus" size={22} /></span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Nouvel espace client</span>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { Clients });
