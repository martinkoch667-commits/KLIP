/* lib2.jsx — animated split title + scroll parallax (reuses helpers.jsx) */

/* SplitText — wraps each character in a span and lights them with a stagger
   once the element scrolls into view. Lines are passed as an array; an entry
   can be a string, or {t, cls} to style a run (e.g. serif italic accent). */
function SplitText({ lines, className = '', start = 0, stagger = 28, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const chars = Array.from(root.querySelectorAll('.split-char'));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { chars.forEach(c => c.classList.add('lit')); return; }
    const io = new IntersectionObserver((ents) => {
      ents.forEach(en => {
        if (en.isIntersecting) {
          chars.forEach((c, i) => {
            const d = start + i * stagger;
            c.style.transitionDelay = d + 'ms';
            requestAnimationFrame(() => c.classList.add('lit'));
          });
          io.disconnect();
        }
      });
    }, { threshold: 0.3 });
    io.observe(root);
    return () => io.disconnect();
  }, []);

  // Split a run into word-wrappers (unbreakable) separated by breakable spaces,
  // so a line only ever wraps at a space — never mid-word.
  const renderRun = (text, cls, kBase) => {
    const tokens = text.split(/(\s+)/); // keeps the whitespace tokens
    const out = [];
    tokens.forEach((tok, ti) => {
      if (tok === '') return;
      if (/^\s+$/.test(tok)) { out.push(<span key={`${kBase}-s${ti}`}> </span>); return; }
      out.push(
        <span key={`${kBase}-w${ti}`} className={`split-word ${cls || ''}`}>
          {Array.from(tok).map((ch, ci) => (
            <span key={ci} className="split-char">{ch}</span>
          ))}
        </span>
      );
    });
    return out;
  };

  return (
    <h1 ref={ref} className={`display ${className}`} style={style}>
      {lines.map((line, li) => {
        const runs = Array.isArray(line) ? line : [{ t: line }];
        return (
          <span className="split-line" key={li}>
            {runs.map((run, ri) => (
              <React.Fragment key={ri}>{renderRun(run.t, run.cls, `${li}-${ri}`)}</React.Fragment>
            ))}
          </span>
        );
      })}
    </h1>
  );
}

/* useParallax — translateY based on element's position in viewport.
   speed > 0 moves slower (drifts up as you scroll down). */
function useParallax(speed = 0.12) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    let raf = null;
    const update = () => {
      raf = null;
      const r = el.getBoundingClientRect();
      const center = r.top + r.height / 2;
      const off = (center - window.innerHeight / 2);
      el.style.transform = `translate3d(0, ${(-off * speed).toFixed(1)}px, 0)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [speed]);
  return ref;
}

/* Parallax wrapper element */
function Parallax({ speed = 0.12, className = '', style, children }) {
  const ref = useParallax(speed);
  return <div ref={ref} className={className} style={style}>{children}</div>;
}

Object.assign(window, { SplitText, useParallax, Parallax });
