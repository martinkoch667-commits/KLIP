/* screen-queue.jsx — publishing queue
   Two-column workspace: connection + summary, day-grouped post list,
   and a right rail (next publish, auto-status, per-client load, week chart). */

/* engagement estimate for a post's planned hour */
function postScore(p) {
  const h = parseInt(p.time.slice(0, 2), 10);
  const tbl = isWeekendDay(p.day) ? ENGAGE.weekend : ENGAGE.weekday;
  // nearest known hour
  const keys = Object.keys(tbl).map(Number);
  const near = keys.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a, keys[0]);
  return tbl[near];
}
const scoreTone = (s) => s >= 85 ? { fg: 'var(--mint-2)', bg: 'var(--mint-soft)', label: 'Créneau idéal' }
  : s >= 65 ? { fg: 'var(--ink-2)', bg: 'var(--sunk)', label: 'Bon créneau' }
  : { fg: 'var(--warn)', bg: 'var(--warn-soft)', label: 'Créneau faible' };

function QStatTile({ value, label, icon, tone }) {
  return (
    <div className="card tile-accent" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0,
        background: tone === 'mint' ? 'var(--mint-soft)' : tone === 'warn' ? 'var(--warn-soft)' : 'var(--sunk)',
        color: tone === 'mint' ? 'var(--mint-2)' : tone === 'warn' ? 'var(--warn)' : 'var(--ink-2)' }}>
        <AIcon name={icon} size={18} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="num" style={{ fontSize: 23, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, marginTop: 2 }} className="trunc">{label}</div>
      </div>
    </div>
  );
}

function QueueCard({ p, openPost, approved, onApprove }) {
  const c = clientById(p.client);
  const isApproved = approved[p.id];
  const s = postScore(p);
  const st = scoreTone(s);
  const status = isApproved ? 'scheduled' : p.status;
  return (
    <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
      <button onClick={() => openPost(p)} style={{ position: 'relative', width: 56, height: 70, borderRadius: 10, background: p.grad, flexShrink: 0, cursor: 'pointer', border: 'none', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', top: 5, left: 5, color: '#fff', opacity: .92 }}><AIcon name="instagram" size={13} /></span>
      </button>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, lineHeight: 1, height: 18 }}>
          <Avatar initials={c.initials} color={c.color} size={18} radius={5} />
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.name}</span>
          <span className="tnum" style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>· {p.time}</span>
          <span className="chip" style={{ background: st.bg, color: st.fg, fontSize: 10, padding: '3px 8px' }}><AIcon name="bolt" size={10} /> {s}% · {st.label}</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }} className="trunc">{p.title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.3 }} className="trunc">{p.caption}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {p.status === 'pending' && !isApproved
          ? <>
              <button className="btn btn-sm btn-ghost" onClick={() => openPost(p)}>Voir</button>
              <button className="btn btn-sm btn-primary" onClick={() => onApprove(p)}><AIcon name="check" size={14} /> Valider</button>
            </>
          : <StatusBadge status={status} />}
        <button className="btn btn-ghost btn-icon" onClick={() => openPost(p)} title="Éditer"><AIcon name="dots" size={16} /></button>
      </div>
    </div>
  );
}

function Queue({ active, openPost, toast, compose }) {
  const scope = active === 'all' ? POSTS : POSTS.filter(p => p.client === active);
  const [tab, setTab] = useState('all');
  const [approved, setApproved] = useState({});

  const inQueue = scope.filter(p => p.status !== 'published');
  const filtered = inQueue.filter(p => tab === 'all' ? true : tab === 'pending' ? p.status === 'pending' : p.status === 'scheduled');
  const grouped = {};
  filtered.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)).forEach(p => { (grouped[p.day] ||= []).push(p); });

  const counts = { all: inQueue.length, pending: scope.filter(p => p.status === 'pending').length, scheduled: scope.filter(p => p.status === 'scheduled').length };
  const drafts = scope.filter(p => p.status === 'draft').length;

  const approve = (p) => { setApproved(a => ({ ...a, [p.id]: true })); toast(`« ${p.title} » validé et planifié`); };

  // next scheduled post in scope
  const next = [...inQueue].filter(p => p.status === 'scheduled').sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))[0]
    || [...inQueue].sort((a, b) => a.day - b.day)[0];
  const nextClient = next && clientById(next.client);

  // per-client breakdown
  const byClient = CLIENTS.map(c => ({ c, n: inQueue.filter(p => p.client === c.id).length, pend: scope.filter(p => p.status === 'pending' && p.client === c.id).length }))
    .filter(x => x.n > 0 || active === 'all').sort((a, b) => b.n - a.n);

  // week load: posts per day-of-week across the queue
  const load = DOW.map((d, i) => inQueue.filter(p => (p.day % 7) === i).length);
  const maxLoad = Math.max(1, ...load);

  return (
    <div className="page screen-in" style={{ maxWidth: 1320 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Mardi 8 septembre · Publication automatique active</div>
          <h1 className="h-display" style={{ fontSize: 32 }}>File de publication</h1>
        </div>
        <button className="btn btn-primary" onClick={() => compose && compose()}><AIcon name="plus" size={16} /> Composer</button>
      </div>

      {/* summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }} className="q-stats">
        <QStatTile value={counts.all} label="Dans la file" icon="send" />
        <QStatTile value={counts.pending} label="À valider" icon="clock" tone="warn" />
        <QStatTile value={counts.scheduled} label="Planifiés" icon="calendar" tone="mint" />
        <QStatTile value={drafts} label="Brouillons" icon="edit" />
      </div>

      <div className="q-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 330px', gap: 18, alignItems: 'start' }}>
        {/* main column */}
        <div style={{ minWidth: 0 }}>
          {/* IG connection banner */}
          <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, background: 'var(--forest)', color: 'var(--cream)', border: 'none' }}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0 }}><AIcon name="instagram" size={21} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                {active === 'all' ? `${CLIENTS.length} comptes Instagram connectés` : `${clientById(active).handle} connecté`}
                <span className="badge" style={{ background: 'var(--mint)', color: 'var(--mint-ink)' }}><AIcon name="check" size={11} /> Actif</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--cream-2)', marginTop: 2 }} className="trunc">Klip publie automatiquement au créneau planifié. Aucune action requise.</div>
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
                <div className="label" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                  <AIcon name="calendar" size={13} /> <span>{dowOf(parseInt(d))} {d} septembre</span>
                  <span style={{ color: 'var(--ink-3)', fontWeight: 700 }}>· {posts.length} post{posts.length > 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {posts.map(p => <QueueCard key={p.id} p={p} openPost={openPost} approved={approved} onApprove={approve} />)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* right rail */}
        <div className="q-rail sb-full" style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 0 }}>
          {/* next publish */}
          {next && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="label" style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 7 }}><span className="dot" style={{ background: 'var(--mint-2)' }} /> Prochaine publication</div>
              <div style={{ display: 'flex', gap: 12, padding: '12px 16px 16px' }}>
                <button onClick={() => openPost(next)} style={{ width: 58, height: 72, borderRadius: 10, background: next.grad, flexShrink: 0, cursor: 'pointer', border: 'none' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }} className="trunc">{next.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                    <Avatar initials={nextClient.initials} color={nextClient.color} size={16} radius={4} />
                    <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }} className="trunc">{nextClient.name}</span>
                  </div>
                  <div className="chip" style={{ marginTop: 8, background: 'var(--mint-soft)', color: 'var(--mint-2)', fontSize: 11 }}><AIcon name="clock" size={11} /> {dowOf(next.day)} {next.day} sept · {next.time}</div>
                </div>
              </div>
            </div>
          )}

          {/* auto-publish status */}
          <div className="card" style={{ padding: 16 }}>
            <h3 className="h-title" style={{ fontSize: 14, marginBottom: 12 }}>Publication automatique</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {[['Comptes connectés', `${active === 'all' ? CLIENTS.length : 1}`, 'instagram'], ['Posts auto cette semaine', `${counts.scheduled}`, 'bolt'], ['Échecs de publication', '0', 'check']].map(([l, v, ic]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--sunk)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><AIcon name={ic} size={14} /></span>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600, flex: 1 }}>{l}</span>
                  <span className="num" style={{ fontSize: 15 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* per-client breakdown */}
          {active === 'all' && (
            <div className="card" style={{ padding: 16 }}>
              <h3 className="h-title" style={{ fontSize: 14, marginBottom: 12 }}>Par client</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {byClient.map(({ c, n, pend }) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                    <Avatar initials={c.initials} color={c.color} size={26} radius={7} />
                    <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }} className="trunc">{c.name}</span>
                    {pend > 0 && <span className="badge" style={{ background: 'var(--warn-soft)', color: 'var(--warn)', fontSize: 10.5, whiteSpace: 'nowrap' }} title={`${pend} à valider`}><span className="dot" style={{ background: 'var(--warn)' }} />{pend}</span>}
                    <span className="num" style={{ fontSize: 14, minWidth: 16, textAlign: 'right' }}>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* week load chart */}
          <div className="card" style={{ padding: 16 }}>
            <h3 className="h-title" style={{ fontSize: 14, marginBottom: 14 }}>Charge de la semaine</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 70 }}>
              {DOW.map((d, i) => (
                <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span className="tnum" style={{ fontSize: 10, fontWeight: 800, color: load[i] ? 'var(--ink-2)' : 'var(--ink-3)' }}>{load[i] || ''}</span>
                  <div style={{ width: '100%', height: `${10 + (load[i] / maxLoad) * 40}px`, borderRadius: '5px 5px 3px 3px', background: load[i] >= maxLoad && maxLoad > 1 ? 'var(--mint)' : load[i] ? 'rgba(47,215,155,.4)' : 'var(--sunk)' }} />
                  <span className="label" style={{ fontSize: 9 }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1080px) {
          .q-layout { grid-template-columns: 1fr !important; }
          .q-stats { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </div>
  );
}

Object.assign(window, { Queue });
