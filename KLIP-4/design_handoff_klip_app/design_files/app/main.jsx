/* main.jsx — KLIP app root: routing, client context, toasts */

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="pop-in" style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 200,
      background: 'var(--ink)', color: 'var(--paper)', padding: '13px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 11, boxShadow: 'var(--shadow-float)', fontWeight: 600, fontSize: 13.5 }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--mint)', color: 'var(--mint-ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><AIcon name="check" size={14} /></span>
      {msg}
    </div>
  );
}

function KlipApp() {
  const [route, setRoute] = useState('dashboard');
  const [active, setActive] = useState('all');
  const [editPost, setEditPost] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);

  const toast = useCallback((m) => {
    setToastMsg(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const openPost = useCallback((p) => { setEditPost(p); setRoute('editor'); }, []);
  const compose = useCallback(() => { setRoute('compose'); }, []);
  const selectClient = useCallback((id) => { setActive(id); setRoute('dashboard'); }, []);

  const pendingTotal = POSTS.filter(p => p.status === 'pending' && (active === 'all' || p.client === active)).length;

  // restore last route
  useEffect(() => {
    const r = localStorage.getItem('klip-route');
    if (r) setRoute(r);
  }, []);
  useEffect(() => { localStorage.setItem('klip-route', route); }, [route]);

  return (
    <div className="app">
      <Sidebar route={route} setRoute={setRoute} pendingTotal={pendingTotal} selectClient={selectClient} />
      <div className="work">
        <Topbar active={active} setActive={setActive} route={route} onCompose={compose} toast={toast} />
        <div className={(route === 'editor' || route === 'compose') ? '' : 'scroll'} style={(route === 'editor' || route === 'compose') ? { flex: 1, overflow: 'hidden' } : {}}>
          {route === 'dashboard' && <Dashboard active={active} setActive={setActive} openPost={openPost} setRoute={setRoute} compose={compose} />}
          {route === 'calendar'  && <Calendar active={active} openPost={openPost} setActive={setActive} compose={compose} />}
          {route === 'editor'    && <Editor post={editPost} active={active} setRoute={setRoute} toast={toast} />}
          {route === 'compose'   && <BatchComposer active={active} setRoute={setRoute} toast={toast} />}
          {route === 'queue'     && <Queue active={active} openPost={openPost} toast={toast} />}
          {route === 'clients'   && <Clients openPost={openPost} setActive={setActive} toast={toast} />}
        </div>
      </div>
      <Toast msg={toastMsg} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<KlipApp />);
