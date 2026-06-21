/* screen-calendar.jsx — editorial calendar (month + week views) */

function buildWeeks() {
  // September 2026 starts on a Tuesday → Monday-first offset 1. 30 days.
  const offset = 1, daysInMonth = 30;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function Calendar({ active, openPost, setActive, compose }) {
  const weeks = useMemo(buildWeeks, []);
  const today = 8;
  const todayWeek = weeks.findIndex(w => w.includes(today));
  const [view, setView] = useState('month');
  const [weekIdx, setWeekIdx] = useState(todayWeek);

  const scope = active === 'all' ? POSTS : POSTS.filter(p => p.client === active);
  const postsOn = (d) => scope.filter(p => p.day === d).sort((a, b) => a.time.localeCompare(b.time));

  const goPrev = () => setWeekIdx(i => Math.max(0, i - 1));
  const goNext = () => setWeekIdx(i => Math.min(weeks.length - 1, i + 1));
  const goToday = () => { setView('week'); setWeekIdx(todayWeek); };

  const wk = weeks[weekIdx] || weeks[todayWeek];
  const wkDays = wk.filter(Boolean);
  const headerLabel = view === 'week'
    ? `Semaine du ${wkDays[0]} au ${wkDays[wkDays.length - 1]} sept.`
    : MONTH;

  return (
    <div className="page screen-in" style={{ maxWidth: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 className="h-display" style={{ fontSize: 26, whiteSpace: 'nowrap' }}>{headerLabel}</h1>
          {view === 'week' && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-icon" onClick={goPrev} disabled={weekIdx === 0} style={{ opacity: weekIdx === 0 ? .4 : 1 }}><AIcon name="chevL" size={17} /></button>
              <button className="btn btn-ghost btn-icon" onClick={goNext} disabled={weekIdx === weeks.length - 1} style={{ opacity: weekIdx === weeks.length - 1 ? .4 : 1 }}><AIcon name="chevR" size={17} /></button>
            </div>
          )}
          <button className="btn btn-sm btn-ghost" onClick={goToday}>Aujourd’hui</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {CLIENTS.slice(0, 6).map(c => (
              <button key={c.id} title={c.name} onClick={() => setActive(active === c.id ? 'all' : c.id)} style={{ opacity: active === 'all' || active === c.id ? 1 : .3, transition: 'opacity .15s' }}>
                <Avatar initials={c.initials} color={c.color} size={26} radius={7} />
              </button>
            ))}
          </div>
          <div className="seg">
            {[['month', 'Mois'], ['week', 'Semaine']].map(([v, l]) => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{l}</button>)}
          </div>
        </div>
      </div>

      {view === 'month'
        ? <MonthGrid weeks={weeks} postsOn={postsOn} today={today} openPost={openPost} compose={compose} />
        : <WeekGrid wk={wk} postsOn={postsOn} today={today} openPost={openPost} compose={compose} />}

      <div style={{ display: 'flex', gap: 18, marginTop: 16, flexWrap: 'wrap' }}>
        {Object.entries(STATUS).map(([k, s]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            <span className="dot" style={{ background: k === 'published' ? 'var(--mint-2)' : s.fg }} /> {s.label}
          </div>
        ))}
      </div>
      <style>{`.cal-cell:hover .cal-add { opacity: 1 !important; }`}</style>
    </div>
  );
}

function PostChip({ p, openPost }) {
  const c = clientById(p.client);
  const s = STATUS[p.status];
  return (
    <button onClick={() => openPost(p)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 7, background: 'var(--white)', boxShadow: 'inset 0 0 0 1px var(--line)', textAlign: 'left', cursor: 'pointer', transition: 'transform .12s', borderLeft: `3px solid ${c.color}`, width: '100%' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateX(2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
      <span style={{ width: 18, height: 18, borderRadius: 4, background: p.grad, flexShrink: 0 }} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 11, lineHeight: 1.2 }} className="trunc">{p.title}</span>
        <span style={{ fontSize: 9.5, color: 'var(--ink-3)', fontWeight: 600 }} className="tnum">{p.time}</span>
      </span>
      <span className="dot" style={{ background: p.status === 'published' ? 'var(--mint-2)' : s.fg, width: 6, height: 6 }} />
    </button>
  );
}

function MonthGrid({ weeks, postsOn, today, openPost, compose }) {
  const cells = weeks.flat();
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--line)' }}>
        {DOW.map(d => <div key={d} className="label" style={{ padding: '11px 14px' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
        {cells.map((d, i) => {
          const posts = d ? postsOn(d) : [];
          const isToday = d === today;
          return (
            <div key={i} className="cal-cell" style={{ minHeight: 124, borderRight: (i % 7 !== 6) ? '1px solid var(--line)' : 'none', borderBottom: '1px solid var(--line)', padding: 8, background: d ? 'transparent' : 'var(--sunk)', position: 'relative' }}>
              {d && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="num" style={{ fontSize: 13, width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: '50%', background: isToday ? 'var(--mint)' : 'transparent', color: isToday ? 'var(--mint-ink)' : 'var(--ink-3)' }}>{d}</span>
                    <button className="cal-add" onClick={compose} title="Composer" style={{ opacity: 0, width: 20, height: 20, borderRadius: 6, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', transition: 'opacity .14s' }}><AIcon name="plus" size={14} /></button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {posts.map(p => <PostChip key={p.id} p={p} openPost={openPost} />)}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ wk, postsOn, today, openPost, compose }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
        {wk.map((d, i) => {
          const posts = d ? postsOn(d) : [];
          const isToday = d === today;
          return (
            <div key={i} className="cal-cell" style={{ borderRight: (i < 6) ? '1px solid var(--line)' : 'none', background: d ? 'transparent' : 'var(--sunk)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                <span className="label" style={{ fontSize: 10 }}>{DOW[i]}</span>
                <span className="num" style={{ fontSize: 16, width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: '50%', background: isToday ? 'var(--mint)' : 'transparent', color: isToday ? 'var(--mint-ink)' : 'var(--ink)' }}>{d || ''}</span>
                {d && <button className="cal-add" onClick={compose} title="Composer" style={{ opacity: 0, marginLeft: 'auto', width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', transition: 'opacity .14s' }}><AIcon name="plus" size={15} /></button>}
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 320, flex: 1 }}>
                {d && posts.length === 0 && <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0', fontWeight: 600 }}>—</div>}
                {posts.map(p => <WeekCard key={p.id} p={p} openPost={openPost} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekCard({ p, openPost }) {
  const c = clientById(p.client);
  return (
    <button onClick={() => openPost(p)} className="lift" style={{ borderRadius: 10, overflow: 'hidden', background: 'var(--white)', boxShadow: 'inset 0 0 0 1px var(--line)', textAlign: 'left', cursor: 'pointer', padding: 0, borderTop: `3px solid ${c.color}` }}>
      <div style={{ aspectRatio: '16/10', background: p.grad, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 7, bottom: 7, fontFamily: 'var(--display)', fontWeight: 700, fontStyle: 'italic', fontSize: 12, lineHeight: 1, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,.5)' }} className="trunc">{p.title}</span>
      </div>
      <div style={{ padding: '7px 9px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Avatar initials={c.initials} color={c.color} size={16} radius={4} />
        <span className="tnum" style={{ fontSize: 11, fontWeight: 700 }}>{p.time}</span>
        <span className="dot" style={{ marginLeft: 'auto', background: p.status === 'published' ? 'var(--mint-2)' : STATUS[p.status].fg }} />
      </div>
    </button>
  );
}

Object.assign(window, { Calendar });
