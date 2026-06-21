/* shell.jsx — sidebar, topbar, client switcher, routing */

const NAV = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'grid' },
  { id: 'calendar',  label: 'Calendrier',      icon: 'calendar' },
  { id: 'compose',   label: 'Composer',        icon: 'edit' },
  { id: 'templates', label: 'Modèles',         icon: 'library' },
  { id: 'queue',     label: 'File de publication', icon: 'send', badgeKey: 'pending' },
  { id: 'clients',   label: 'Clients',         icon: 'clients' },
];

function Sidebar({ route, setRoute, pendingTotal, selectClient }) {
  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px 16px' }}>
        <KlipMark size={23} />
        <span className="sb-full chip" style={{ marginLeft: 'auto', background: 'var(--cream-4)', color: 'var(--cream-2)', fontSize: 10 }}>Agence</span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV.map(n => (
          <button key={n.id} className={`nav-item ${route === n.id || (n.id === 'compose' && route === 'editor') ? 'active' : ''}`} onClick={() => setRoute(n.id)}>
            <span className="nav-ic"><AIcon name={n.icon} size={19} /></span>
            <span className="nav-label">{n.label}</span>
            {n.badgeKey === 'pending' && pendingTotal > 0 && <span className="nav-badge">{pendingTotal}</span>}
          </button>
        ))}
      </nav>

      <div className="divider sb-full" style={{ background: 'var(--cream-4)', margin: '14px 4px' }} />

      <div className="sb-full label" style={{ color: 'var(--cream-3)', padding: '0 12px 8px' }}>Vos clients</div>
      <div className="sb-full" style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1, margin: '0 -4px', padding: '0 4px' }}>
        {CLIENTS.map(c => (
          <button key={c.id} className="nav-item" style={{ padding: '7px 10px' }} onClick={() => selectClient(c.id)}>
            <Avatar initials={c.initials} color={c.color} size={26} radius={7} />
            <span className="nav-label trunc" style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
            {c.pending > 0 && <span className="dot" style={{ background: 'var(--warn)', marginLeft: 'auto' }} />}
          </button>
        ))}
      </div>

      <div className="divider sb-full" style={{ background: 'var(--cream-4)', margin: '10px 4px' }} />
      <button className={`nav-item ${route === 'settings' ? 'active' : ''}`} onClick={() => setRoute('settings')}><span className="nav-ic"><AIcon name="settings" size={19} /></span><span className="nav-label">Réglages</span></button>
      <button className="nav-item" style={{ padding: '7px 10px' }}>
        <Avatar initials="CR" color="#7B5CF5" size={26} radius={7} />
        <span className="nav-label sb-full" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Camille R.</span>
          <span style={{ fontSize: 11, color: 'var(--cream-3)' }}>Studio Klein</span>
        </span>
        <AIcon name="logout" size={16} className="nav-label" style={{ marginLeft: 'auto', color: 'var(--cream-3)' }} />
      </button>
    </aside>
  );
}

function ClientSwitcher({ active, setActive }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, []);
  const cur = active === 'all' ? null : clientById(active);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn-ghost" style={{ paddingLeft: 8, height: 40 }} onClick={() => setOpen(o => !o)}>
        {cur ? <Avatar initials={cur.initials} color={cur.color} size={24} radius={6} />
             : <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center' }}><AIcon name="grid" size={14} /></span>}
        <span style={{ fontWeight: 700 }}>{cur ? cur.name : 'Tous les clients'}</span>
        <AIcon name="chevD" size={15} style={{ color: 'var(--ink-3)' }} />
      </button>
      {open && (
        <div className="card pop-in" style={{ position: 'absolute', top: 48, left: 0, width: 246, padding: 6, zIndex: 60, boxShadow: 'var(--shadow-pop)' }}>
          <button className="cs-row" onClick={() => { setActive('all'); setOpen(false); }} style={csRow(active === 'all')}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center' }}><AIcon name="grid" size={15} /></span>
            <span style={{ fontWeight: 700 }}>Tous les clients</span>
            {active === 'all' && <AIcon name="check" size={16} style={{ marginLeft: 'auto', color: 'var(--mint-2)' }} />}
          </button>
          <div className="divider" style={{ margin: '5px 8px' }} />
          {CLIENTS.map(c => (
            <button key={c.id} className="cs-row" onClick={() => { setActive(c.id); setOpen(false); }} style={csRow(active === c.id)}>
              <Avatar initials={c.initials} color={c.color} size={26} radius={7} />
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
                <span style={{ fontWeight: 700 }} className="trunc">{c.name}</span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{c.handle}</span>
              </span>
              {c.pending > 0 && <span className="badge" style={{ marginLeft: 'auto', background: 'var(--warn-soft)', color: 'var(--warn)' }}>{c.pending}</span>}
              {active === c.id && <AIcon name="check" size={16} style={{ marginLeft: c.pending ? 6 : 'auto', color: 'var(--mint-2)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
const csRow = (on) => ({ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 9, textAlign: 'left', background: on ? 'var(--mint-soft)' : 'transparent' });

function Topbar({ active, setActive, route, onCompose, toast }) {
  const titles = { dashboard: 'Tableau de bord', calendar: 'Calendrier éditorial', compose: 'Composer', templates: 'Bibliothèque de modèles', editor: 'Composer un post', queue: 'File de publication', clients: 'Vos clients', settings: 'Réglages' };
  return (
    <header className="topbar">
      <ClientSwitcher active={active} setActive={setActive} />
      <div style={{ width: 1, height: 24, background: 'var(--line)' }} />
      <span className="h-title" style={{ fontSize: 16, whiteSpace: 'nowrap' }}>{titles[route]}</span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="sb-full" style={{ position: 'relative', width: 220 }}>
          <AIcon name="search" size={16} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--ink-3)' }} />
          <input className="input" placeholder="Rechercher un post, un client…" style={{ paddingLeft: 34, height: 38 }} />
        </div>
        <button className="btn btn-ghost btn-icon" style={{ position: 'relative' }} onClick={() => toast && toast('3 posts en attente de validation')}>
          <AIcon name="bell" size={18} />
          <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--warn)', boxShadow: '0 0 0 2px var(--canvas)' }} />
        </button>
        <button className="btn btn-primary" onClick={onCompose}><AIcon name="plus" size={17} /> Nouveau post</button>
      </div>
    </header>
  );
}

Object.assign(window, { Sidebar, Topbar, ClientSwitcher });
