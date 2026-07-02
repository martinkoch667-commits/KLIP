/* shared.jsx — KLIP Montage : preview 9:16, lecture, sous-titres, partagés par
   les deux directions. */

/* clips → temps de début cumulés */
function clipStarts() {
  let acc = 0; const out = [];
  CLIPS.forEach(c => { out.push({ ...c, start: acc, end: acc + c.dur }); acc += c.dur; });
  return out;
}
const CLIP_TL = clipStarts();
const TOTAL = CLIP_TL[CLIP_TL.length - 1].end;

const clipAt = (t) => CLIP_TL.find(c => t >= c.start && t < c.end) || CLIP_TL[CLIP_TL.length - 1];
const subAt = (t) => SUBS.find(s => t >= s.start && t <= s.end);
const titleAt = (t) => TITLES.find(x => t >= x.start && t <= x.end);
const stickerAt = (t) => STICKERS.find(x => Math.abs(t - x.at) < 3);

/* lecture animée */
function usePlayback(total = TOTAL) {
  const [time, setTime] = useState(2.6);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(null); const last = useRef(0);
  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const tick = (now) => {
      const dt = (now - last.current) / 1000; last.current = now;
      setTime(t => { const n = t + dt; if (n >= total) { setPlaying(false); return 0; } return n; });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, total]);
  return {
    time, playing, setTime,
    toggle: () => setPlaying(p => !p),
    seek: (t) => setTime(Math.max(0, Math.min(total, t))),
  };
}

const FILTER_CSS = (id) => (FILTERS.find(f => f.id === id) || FILTERS[0]).css;

/* sous-titre rendu (style piloté par SUB_STYLES) avec surlignage karaoké */
function SubtitleOverlay({ time, styleId, bottom = 96 }) {
  const sub = subAt(time);
  const st = SUB_STYLES.find(s => s.id === styleId) || SUB_STYLES[0];
  if (!sub) return null;
  const words = sub.text.split(' ');
  const prog = (time - sub.start) / Math.max(0.1, sub.end - sub.start);
  const spoken = Math.round(prog * words.length);
  const innerStyle = {
    background: st.bg, color: st.fg, fontFamily: st.italic ? 'var(--display)' : 'var(--sans)',
    fontStyle: st.italic ? 'italic' : 'normal', fontWeight: st.weight,
    borderRadius: st.pill ? 99 : 10, padding: st.pill ? '7px 16px' : '7px 14px',
    boxShadow: st.bg === 'transparent' ? 'none' : '0 6px 18px -8px rgba(0,0,0,.5)',
    textShadow: st.bg === 'transparent' ? '0 2px 12px rgba(0,0,0,.6)' : 'none',
    letterSpacing: st.italic ? '-0.01em' : 0, lineHeight: 1.2,
  };
  return (
    <div className="mz-sub" style={{ bottom }}>
      <span className="mz-sub-inner" style={innerStyle}>
        {words.map((w, i) => (
          <span key={i} className="mz-sub-word" style={{ color: i < spoken ? st.hi : st.fg, wordSpacing: 2 }}>{w + ' '}</span>
        ))}
      </span>
    </div>
  );
}

/* preview téléphone 9:16 */
function MZPreview({ time, subStyle = 'karaoke', showSubs = true, showTitle = true }) {
  const clip = clipAt(time);
  const title = showTitle ? titleAt(time) : null;
  const stick = stickerAt(time);
  return (
    <div className="mz-phone">
      <div className="mz-video" style={{ background: clip.grad, filter: FILTER_CSS(clip.filter === 'Chaud' ? 'chaud' : clip.filter === 'Doux' ? 'doux' : 'none') }} />
      <div className="mz-vbrand">
        <span className="mz-vdot" style={{ background: PROJECT.color }}>{PROJECT.initials}</span>
        {PROJECT.handle}
      </div>
      {title && (
        <div className={'mz-vtitle ' + (title.style === 'editorial' ? 'editorial' : '')}>
          {title.style === 'pill'
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 99, background: 'var(--mint)', color: 'var(--mint-ink)', fontWeight: 800, fontSize: 17 }}>{title.text} <VIcon name="arrowUR" size={15} /></span>
            : title.text}
        </div>
      )}
      {stick && <div className="mz-vsticker" style={{ right: 40, bottom: 150 }}>{stick.glyph}</div>}
      {showSubs && <SubtitleOverlay time={time} styleId={subStyle} />}
      <div className="mz-vchrome">
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 10, letterSpacing: '.08em', color: 'rgba(255,255,255,.85)' }}>{clip.label.toUpperCase()}</span>
        <span className="mz-vc-cta">Réserver</span>
      </div>
    </div>
  );
}

/* barre de lecture */
function MZPlaybar({ time, playing, toggle, seek, total = TOTAL }) {
  const barRef = useRef(null);
  const onScrub = (e) => {
    const r = barRef.current.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * total);
  };
  const pct = (time / total) * 100;
  return (
    <div className="mz-playbar">
      <button className="mz-play" onClick={toggle}><VIcon name={playing ? 'pause' : 'play'} size={19} /></button>
      <span className="mz-time">{fmt(time)}</span>
      <div className="mz-scrub" ref={barRef} onClick={onScrub}>
        <div className="mz-scrub-fill" style={{ width: pct + '%' }} />
        <div className="mz-scrub-knob" style={{ left: pct + '%' }} />
      </div>
      <span className="mz-time" style={{ color: 'var(--ink-3)' }}>{fmt(total)}</span>
    </div>
  );
}

/* arrowUR icon used in preview pill — register a tiny extra */
const _arrowUR = true;

Object.assign(window, { CLIP_TL, TOTAL, clipAt, subAt, titleAt, stickerAt, usePlayback, FILTER_CSS, SubtitleOverlay, MZPreview, MZPlaybar });
