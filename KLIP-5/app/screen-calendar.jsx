/* screen-calendar.jsx — editorial calendar
   · month + week views
   · "best time to post" hourly engagement heatmap (% across the day)
   · week view: compact, drag a post onto a recommended base-hour slot
   · published posts shown as live, distinct from planned */

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

/* engagement score → colour ramp (sunk → mint → acid peak) */
const heatBg = (s) => s >= 92 ? 'var(--acid)' : s >= 78 ? 'var(--mint)' : s >= 60 ? 'rgba(47,215,155,.55)' : s >= 42 ? 'rgba(47,215,155,.30)' : 'rgba(13,15,10,.09)';
const heatInk = (s) => s >= 78 ? 'var(--mint-ink)' : 'var(--ink-2)';

function Calendar({ active, openPost, setActive, compose, toast }) {
  const weeks = useMemo(buildWeeks, []);
  const today = 8;
  const todayWeek = weeks.findIndex(w => w.includes(today));
  const [view, setView] = useState('week');
  const [weekIdx, setWeekIdx] = useState(todayWeek);
  const [posts, setPosts] = useState(() => POSTS.map(p => ({ ...p })));

  const scope = active === 'all' ? posts : posts.filter(p => p.client === active);
  const postsOn = (d) => scope.filter(p => p.day === d).sort((a, b) => a.time.localeCompare(b.time));

  const reschedule = (id, day, time) => {
    setPosts(ps => ps.map(p => {
      if (p.id !== id) return p;
      const next = { ...p, day };
      if (time) next.time = time;
      if (p.status === 'draft') next.status = 'scheduled';
      return next;
    }));
    const p = posts.find(x => x.id === id);
    if (p && toast) toast(`« ${p.title} » replanifié · ${dowOf(day)} ${day} sept${time ? ' à ' + time : ''}`);
  };

  const goPrev = () => setWeekIdx(i => Math.max(0, i - 1));
  const goNext = () => setWeekIdx(i => Math.min(weeks.length - 1, i + 1));
  const goToday = () => { setWeekIdx(todayWeek); };

  const wk = weeks[weekIdx] || weeks[todayWeek];
  const wkDays = wk.filter(Boolean);
  const headerLabel = view === 'week'
    ? `${wkDays[0]}–${wkDays[wkDays.length - 1]} septembre`
    : MONTH;

  // strip reflects today's pattern when this week contains it, else the week's first day
  const stripDay = wk.includes(today) ? today : wkDays[0];

  return (
    <div className="page screen-in" style={{ maxWidth: 1440, paddingBottom: 26, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h1 className="h-display" style={{ fontSize: 25, whiteSpace: 'nowrap' }}>{headerLabel}</h1>
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

      <BestTimeStrip dayNum={stripDay} active={active} />

      <div style={{ display: 'flex', gap: 16, minWidth: 0, alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {view === 'month'
            ? <MonthGrid weeks={weeks} postsOn={postsOn} today={today} openPost={openPost} compose={compose} reschedule={reschedule} />
            : <WeekView wk={wk} postsOn={postsOn} today={today} openPost={openPost} compose={compose} reschedule={reschedule} />}
        </div>
        <CalendarRail scope={scope} wkDays={wkDays} active={active} openPost={openPost} compose={compose} />
      </div>

      <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(STATUS).map(([k, s]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            <span className="dot" style={{ background: k === 'published' ? 'var(--mint-2)' : s.fg }} /> {s.label}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
          <AIcon name="drag" size={14} /> Glissez un post vers un créneau conseillé pour le replanifier
        </div>
      </div>
      <style>{`
        .cal-cell:hover .cal-add { opacity: 1 !important; }
        .wk-col:hover .wk-add { opacity: 1 !important; }
        [draggable="true"] { -webkit-user-drag: element; }
        .drop-on { background: var(--mint-soft) !important; box-shadow: inset 0 0 0 2px var(--mint-2) !important; }
      `}</style>
    </div>
  );
}

/* ── best time to post: hourly engagement heatmap ─────────────────── */
function BestTimeStrip({ dayNum, active }) {
  const curve = engageCurve(dayNum);
  const peaks = peakHours(dayNum, 3);
  const ctxLabel = active === 'all' ? 'audience agrégée' : clientById(active).name;
  return (
    <div className="card" style={{ padding: '13px 18px 11px', marginBottom: 14, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--mint-soft)', color: 'var(--mint-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><AIcon name="bolt" size={15} /></span>
        <span className="h-title" style={{ fontSize: 14 }}>Meilleur moment pour publier</span>
        <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: 10.5 }}>{dowOf(dayNum)} · {ctxLabel}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>
          <span>Engagement</span>
          <span style={{ width: 78, height: 7, borderRadius: 99, background: 'linear-gradient(90deg, rgba(13,15,10,.09), rgba(47,215,155,.5), var(--mint), var(--acid))' }} />
          <span className="tnum">100%</span>
        </div>
      </div>
      {/* bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 52 }}>
        {curve.map(({ h, s }) => {
          const isPeak = peaks.includes(h);
          return (
            <div key={h} title={`${h}h — ${s}% d’engagement`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 3, cursor: 'default' }}>
              {isPeak && <span className="tnum" style={{ fontSize: 10, fontWeight: 800, color: 'var(--mint-2)', lineHeight: 1 }}>{s}%</span>}
              <div style={{ width: '100%', height: `${10 + (s / 100) * 30}px`, background: heatBg(s), borderRadius: '4px 4px 2px 2px', boxShadow: isPeak ? '0 0 0 1.5px var(--mint-2)' : 'none', transition: 'height .2s' }} />
            </div>
          );
        })}
      </div>
      {/* hour ticks */}
      <div style={{ display: 'flex', marginTop: 5 }}>
        {curve.map(({ h }, i) => (
          <span key={h} className="tnum" style={{ flex: 1, textAlign: 'center', fontSize: 9.5, fontWeight: 700, color: 'var(--ink-3)', visibility: (h % 3 === 0) ? 'visible' : 'hidden' }}>{h}h</span>
        ))}
      </div>
    </div>
  );
}

/* ── shared status helpers ────────────────────────────────────────── */
function StatusDot({ status }) {
  const s = STATUS[status];
  return <span className="dot" style={{ background: status === 'published' ? 'var(--mint-2)' : s.fg }} />;
}

/* ── MONTH ────────────────────────────────────────────────────────── */
function MonthChip({ p, openPost, onDragStart, onDragEnd, dragging }) {
  const c = clientById(p.client);
  const pub = p.status === 'published';
  return (
    <button
      draggable onDragStart={e => onDragStart(e, p)} onDragEnd={onDragEnd}
      onClick={() => openPost(p)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 5px', borderRadius: 7,
        background: pub ? 'var(--mint-soft)' : 'var(--white)',
        boxShadow: pub ? 'inset 0 0 0 1px rgba(47,215,155,.4)' : 'inset 0 0 0 1px var(--line)',
        textAlign: 'left', cursor: 'grab', width: '100%', opacity: dragging ? .4 : 1,
        borderLeft: `3px solid ${c.color}`, transition: 'transform .12s'
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateX(2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
      <span style={{ position: 'relative', width: 18, height: 18, borderRadius: 4, background: p.grad, flexShrink: 0 }}>
        {pub && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(11,59,42,.55)', borderRadius: 4, color: 'var(--acid)' }}><AIcon name="check" size={11} stroke={2.4} /></span>}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 11, lineHeight: 1.2 }} className="trunc">{p.title}</span>
        <span className="tnum" style={{ fontSize: 9.5, color: 'var(--ink-3)', fontWeight: 700 }}>{pub ? 'En ligne · ' : ''}{p.time}</span>
      </span>
      <StatusDot status={p.status} />
    </button>
  );
}

function MonthGrid({ weeks, postsOn, today, openPost, compose, reschedule }) {
  const cells = weeks.flat();
  const [dragId, setDragId] = useState(null);
  const [overCell, setOverCell] = useState(null);
  const onDragStart = (e, p) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setDragId(p.id); };
  const onDragEnd = () => { setDragId(null); setOverCell(null); };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', borderBottom: '1px solid var(--line)' }}>
        {DOW.map(d => <div key={d} className="label" style={{ padding: '10px 14px' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))' }}>
        {cells.map((d, i) => {
          const posts = d ? postsOn(d) : [];
          const isToday = d === today;
          const isOver = overCell === d && d;
          const shown = posts.slice(0, 3);
          return (
            <div key={i}
              onDragOver={d ? (e => { e.preventDefault(); setOverCell(d); }) : undefined}
              onDrop={d ? (e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); reschedule(id, d, null); setOverCell(null); setDragId(null); }) : undefined}
              className="cal-cell"
              style={{ minHeight: 116, borderRight: (i % 7 !== 6) ? '1px solid var(--line)' : 'none', borderBottom: '1px solid var(--line)', padding: 7, background: isOver ? 'var(--mint-soft)' : (d ? 'transparent' : 'var(--sunk)'), boxShadow: isOver ? 'inset 0 0 0 2px var(--mint-2)' : 'none', position: 'relative', transition: 'background .1s' }}>
              {d && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span className="num" style={{ fontSize: 13, width: 23, height: 23, display: 'grid', placeItems: 'center', borderRadius: '50%', background: isToday ? 'var(--mint)' : 'transparent', color: isToday ? 'var(--mint-ink)' : 'var(--ink-3)' }}>{d}</span>
                    <button className="cal-add" onClick={compose} title="Composer" style={{ opacity: 0, width: 20, height: 20, borderRadius: 6, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', transition: 'opacity .14s' }}><AIcon name="plus" size={14} /></button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {shown.map(p => <MonthChip key={p.id} p={p} openPost={openPost} onDragStart={onDragStart} onDragEnd={onDragEnd} dragging={dragId === p.id} />)}
                    {posts.length > 3 && <button onClick={compose} style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: '.02em', textAlign: 'left', padding: '2px 5px' }}>+{posts.length - 3} de plus</button>}
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

/* ── WEEK ─────────────────────────────────────────────────────────── */
function WeekView({ wk, postsOn, today, openPost, compose, reschedule }) {
  const [dragId, setDragId] = useState(null);
  const [hover, setHover] = useState(null);  // `${day}` or `${day}@${time}`
  const onDragStart = (e, p) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setDragId(p.id); };
  const onDragEnd = () => { setDragId(null); setHover(null); };

  return (
    <div className="card" style={{ overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', height: 'calc(100vh - 340px)', minHeight: 396 }}>
      {wk.map((d, i) => {
        const posts = d ? postsOn(d) : [];
        const isToday = d === today;
        const slots = d ? bestSlots(d) : [];
        const dayOver = hover === `${d}`;
        return (
          <div key={i} className="wk-col"
            onDragOver={d ? (e => { e.preventDefault(); if (!String(hover).includes('@')) setHover(`${d}`); }) : undefined}
            onDrop={d ? (e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); reschedule(id, d, null); onDragEnd(); }) : undefined}
            style={{ borderRight: (i < 6) ? '1px solid var(--line)' : 'none', background: d ? 'transparent' : 'var(--sunk)', display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>

            {/* header */}
            <div style={{ padding: '10px 11px 8px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span className="label" style={{ fontSize: 9.5 }}>{DOW[i]}</span>
              <span className="num" style={{ fontSize: 15, width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: '50%', background: isToday ? 'var(--mint)' : 'transparent', color: isToday ? 'var(--mint-ink)' : 'var(--ink)' }}>{d || ''}</span>
              {d && <button className="wk-add" onClick={compose} title="Composer" style={{ opacity: 0, marginLeft: 'auto', width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', transition: 'opacity .14s' }}><AIcon name="plus" size={15} /></button>}
            </div>

            {/* recommended base-hour slots (compact, drop targets) */}
            {d && (
              <div style={{ padding: '0 7px 8px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, borderBottom: '1px solid var(--line)' }}>
                {slots.map((sl, si) => {
                  const top = si === slots.length - 1 || sl.s === Math.max(...slots.map(x => x.s));
                  const over = hover === `${d}@${sl.t}`;
                  return (
                    <div key={sl.t}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setHover(`${d}@${sl.t}`); }}
                      onDragLeave={() => setHover(h => h === `${d}@${sl.t}` ? null : h)}
                      onDrop={e => { e.preventDefault(); e.stopPropagation(); const id = e.dataTransfer.getData('text/plain'); reschedule(id, d, sl.t); onDragEnd(); }}
                      title={`${sl.s}% d’engagement attendu`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 7px', borderRadius: 7,
                        border: `1.5px dashed ${over ? 'var(--mint-2)' : top ? 'rgba(47,215,155,.5)' : 'var(--line)'}`,
                        background: over ? 'var(--mint-soft)' : top ? 'rgba(47,215,155,.07)' : 'transparent',
                        transition: 'all .12s', cursor: 'default'
                      }}>
                      <AIcon name="clock" size={11} style={{ color: top ? 'var(--mint-2)' : 'var(--ink-3)', flexShrink: 0 }} />
                      <span className="tnum" style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink)' }}>{sl.t}</span>
                      <span className="tnum" style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 99, background: heatBg(sl.s), color: heatInk(sl.s) }}>{sl.s}%</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* scheduled posts (compact, draggable) */}
            <div className="wk-scroll" style={{ padding: 7, display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto', background: dayOver ? 'var(--mint-soft)' : 'transparent', transition: 'background .1s' }}>
              {d && posts.length === 0 && (
                <button onClick={compose} style={{ marginTop: 2, padding: '11px 0', borderRadius: 9, border: '1.5px dashed var(--line)', color: 'var(--ink-3)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', flexShrink: 0, transition: 'all .14s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.color = 'var(--mint-2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-3)'; }}>
                  <AIcon name="plus" size={13} /> Planifier
                </button>
              )}
              {posts.map(p => <WeekPostCard key={p.id} p={p} openPost={openPost} onDragStart={onDragStart} onDragEnd={onDragEnd} dragging={dragId === p.id} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekPostCard({ p, openPost, onDragStart, onDragEnd, dragging }) {
  const c = clientById(p.client);
  const s = STATUS[p.status];
  const pub = p.status === 'published';
  return (
    <div draggable onDragStart={e => onDragStart(e, p)} onDragEnd={onDragEnd} onClick={() => openPost(p)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: 7, borderRadius: 10,
        background: pub ? 'var(--mint-soft)' : 'var(--white)',
        boxShadow: pub ? 'inset 0 0 0 1px rgba(47,215,155,.4)' : 'inset 0 0 0 1px var(--line)',
        borderLeft: `3px solid ${c.color}`, cursor: 'grab', opacity: dragging ? .4 : 1,
        transition: 'transform .12s, box-shadow .12s', flexShrink: 0
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = pub ? 'inset 0 0 0 1px rgba(47,215,155,.5), var(--shadow-card)' : 'inset 0 0 0 1px var(--ink-3), var(--shadow-card)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = pub ? 'inset 0 0 0 1px rgba(47,215,155,.4)' : 'inset 0 0 0 1px var(--line)'; }}>
      <span style={{ position: 'relative', width: 34, height: 40, borderRadius: 7, background: p.grad, flexShrink: 0, overflow: 'hidden' }}>
        {pub && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(11,59,42,.5)', color: 'var(--acid)' }}><AIcon name="instagram" size={14} /></span>}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.2, marginBottom: 3 }} className="trunc">{p.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Avatar initials={c.initials} color={c.color} size={14} radius={4} />
          <span className="tnum" style={{ fontSize: 10.5, fontWeight: 700, color: pub ? 'var(--mint-2)' : 'var(--ink-2)' }}>{pub ? 'En ligne' : p.time}</span>
          <StatusDot status={p.status} />
        </div>
      </div>
      <AIcon name="drag" size={13} style={{ color: 'var(--ink-3)', flexShrink: 0, opacity: .6 }} />
    </div>
  );
}

/* ── insights rail (fills the calendar's right side) ──────────────── */
function CalendarRail({ scope, wkDays, active, openPost, compose }) {
  const weekPosts = scope.filter(p => wkDays.includes(p.day));
  const by = (s) => weekPosts.filter(p => p.status === s).length;
  const stats = [
    { k: 'scheduled', label: 'Planifiés', n: by('scheduled'), tone: 'mint' },
    { k: 'pending',   label: 'À valider',  n: by('pending'),  tone: 'warn' },
    { k: 'draft',     label: 'Brouillons', n: by('draft'),    tone: 'ink' },
    { k: 'published', label: 'Publiés',    n: by('published'),tone: 'mint' },
  ];
  const drafts = scope.filter(p => p.status === 'draft' || p.status === 'pending').slice(0, 4);
  const perClient = CLIENTS.map(c => ({ c, n: weekPosts.filter(p => p.client === c.id).length })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  const maxC = Math.max(1, ...perClient.map(x => x.n));

  return (
    <aside className="cal-rail sb-full" style={{ width: 312, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
      {/* week overview */}
      <div className="card" style={{ padding: 16 }}>
        <div className="label" style={{ marginBottom: 12 }}>Cette semaine</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {stats.map(s => (
            <div key={s.k} className="well" style={{ padding: '11px 13px' }}>
              <div className="num" style={{ fontSize: 24, lineHeight: 1, color: s.tone === 'warn' ? 'var(--warn)' : s.tone === 'mint' ? 'var(--mint-2)' : 'var(--ink)' }}>{s.n}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600 }}>
                <span className="dot" style={{ background: STATUS[s.k].fg }} /> {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* drafts to finish */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 className="h-title" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>À finaliser</h3>
          <span className="chip" style={{ background: 'var(--warn-soft)', color: 'var(--warn)', fontSize: 10.5 }}>{scope.filter(p => p.status === 'draft' || p.status === 'pending').length}</span>
        </div>
        {drafts.length === 0
          ? <div style={{ fontSize: 12.5, color: 'var(--ink-3)', padding: '6px 0' }}>Tout est planifié. ✦</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {drafts.map(p => {
                const c = clientById(p.client);
                return (
                  <button key={p.id} onClick={() => openPost(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 7, borderRadius: 10, textAlign: 'left', boxShadow: 'inset 0 0 0 1px var(--line)', transition: 'background .14s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--sunk)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ width: 30, height: 38, borderRadius: 7, background: p.grad, flexShrink: 0 }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: 12.5 }} className="trunc">{p.title}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                        <Avatar initials={c.initials} color={c.color} size={13} radius={4} />
                        <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{STATUS[p.status].label}</span>
                      </span>
                    </span>
                    <AIcon name="chevR" size={15} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>}
      </div>

      {/* per-client load this week */}
      {active === 'all' && perClient.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <h3 className="h-title" style={{ fontSize: 14, marginBottom: 14 }}>Volume par client</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {perClient.map(({ c, n }) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar initials={c.initials} color={c.color} size={22} radius={6} />
                <span style={{ fontSize: 12.5, fontWeight: 600, width: 78, flexShrink: 0 }} className="trunc">{c.name}</span>
                <div style={{ flex: 1, height: 7, borderRadius: 99, background: 'var(--sunk)', overflow: 'hidden' }}>
                  <div style={{ width: `${(n / maxC) * 100}%`, height: '100%', borderRadius: 99, background: c.color }} />
                </div>
                <span className="num" style={{ fontSize: 13, width: 14, textAlign: 'right' }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-dark" onClick={compose} style={{ width: '100%', padding: '11px' }}><AIcon name="spark" size={16} /> Composer avec l’IA</button>
    </aside>
  );
}

Object.assign(window, { Calendar });
