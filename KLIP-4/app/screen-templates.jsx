/* screen-templates.jsx — "Modèles" : brand kits & templates PER CLIENT.
   Overview = one card per client (palette + their templates).
   Focused = a client's charte (palette, typo) + their template library,
   with create / edit actions. */

/* ── per-client brand kits ──────────────────────────────────────── */
const CLIENT_KITS = {
  lou:    { palette: ['#1F7A4D', '#2FD79B', '#C8F135', '#0C2A1D', '#EEEDE3'], display: 'Archivo',  body: 'Satoshi',  acc: '#C8F135', ink: '#F1F0E8' },
  oreste: { palette: ['#C8732B', '#E0A05A', '#FDE9C8', '#3A2410', '#FDF7EC'], display: 'Archivo',  body: 'Satoshi',  acc: '#3A2410', ink: '#FDF7EC' },
  vel:    { palette: ['#2B5FE0', '#5A86E8', '#C8F135', '#13245A', '#EEF2FF'], display: 'Archivo',  body: 'Satoshi',  acc: '#C8F135', ink: '#EEF2FF' },
  brut:   { palette: ['#222019', '#4A463B', '#C8F135', '#0F0E0A', '#EEEDE3'], display: 'Archivo',  body: 'Satoshi',  acc: '#C8F135', ink: '#EEEDE3' },
  fab:    { palette: ['#C4452F', '#D96A4A', '#F2C94C', '#5A1F17', '#FDF0EC'], display: 'Archivo',  body: 'Satoshi',  acc: '#F2C94C', ink: '#FDF0EC' },
  onde:   { palette: ['#5E8769', '#88B394', '#C8F135', '#2F4D38', '#F1F0E8'], display: 'Archivo',  body: 'Satoshi',  acc: '#C8F135', ink: '#F1F0E8' },
};

/* template specs — sample content, recoloured to each client */
const TPL_SPECS = [
  { key: 'promo',  cat: 'Promotion', format: 'post',  layout: 'price',  kicker: 'Offre limitée',  title: '-20%',            meta: 'Ce week-end' },
  { key: 'event',  cat: 'Événement', format: 'post',  layout: 'bottom', kicker: 'Save the date',  title: 'Soir de\nfête',    meta: '18h → minuit' },
  { key: 'new',    cat: 'Nouveauté', format: 'post',  layout: 'center', kicker: 'Édition saison',  title: 'Nouvelle\ncarte',  meta: 'Dès jeudi' },
  { key: 'quote',  cat: 'Citation',  format: 'post',  layout: 'quote',  kicker: '',               title: 'Le goût du moment présent.', metaFromName: true },
  { key: 'story',  cat: 'Story',     format: 'story', layout: 'split',  kicker: '24h seulement',   title: 'Flash\nsale',      meta: 'Swipe up' },
  { key: 'menu',   cat: 'Menu',      format: 'carrousel', layout: 'split', kicker: 'Carte · 1/5',  title: 'Les\nentrées',     meta: 'Glissez →' },
];

function clientTemplates(c) {
  const k = CLIENT_KITS[c.id];
  return TPL_SPECS.map((s, i) => ({
    id: `${c.id}-${s.key}`,
    name: `${s.cat} · ${c.name}`,
    cat: s.cat, format: s.format, layout: s.layout,
    kicker: s.kicker, title: s.title,
    meta: s.metaFromName ? `— ${c.name}` : s.meta,
    bg: c.grad, ink: k.ink, acc: k.acc,
    uses: [248, 176, 412, 93, 322, 142][i] || 60,
    fav: i === 0,
  }));
}

/* ── template visual renderer (composes sample on the brand bg) ──── */
function TemplateVisual({ t, ratio }) {
  const r = ratio || (t.format === 'story' ? '9 / 16' : t.format === 'carrousel' ? '1 / 1' : '4 / 5');
  const disp = { fontFamily: 'var(--display)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: .94, whiteSpace: 'pre-line' };
  const kick = { fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', opacity: .92 };
  const metaS = { fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 9.5, letterSpacing: '.06em', opacity: .85 };

  let body;
  if (t.layout === 'center') {
    body = (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 14, gap: 8 }}>
        {t.kicker && <span style={{ ...kick, color: t.acc }}>{t.kicker}</span>}
        <span style={{ ...disp, fontSize: 30, color: t.ink }}>{t.title}</span>
        {t.meta && <span style={{ ...metaS, color: t.ink }}>{t.meta}</span>}
      </div>
    );
  } else if (t.layout === 'price') {
    body = (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 14 }}>
        <span style={{ ...kick, color: t.acc, marginBottom: 6 }}>{t.kicker}</span>
        <span style={{ ...disp, fontSize: 58, color: t.ink }}>{t.title}</span>
        <span style={{ ...metaS, color: t.ink, marginTop: 6 }}>{t.meta}</span>
      </div>
    );
  } else if (t.layout === 'quote') {
    body = (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '14px 18px', gap: 10 }}>
        <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontWeight: 700, fontSize: 19, lineHeight: 1.12, letterSpacing: '-0.01em', color: t.ink, textWrap: 'balance' }}>{t.title}</span>
        <span style={{ ...metaS, color: t.acc }}>{t.meta}</span>
      </div>
    );
  } else if (t.layout === 'split') {
    body = (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 16 }}>
        <span style={{ ...kick, color: t.acc, alignSelf: 'flex-start', background: 'rgba(0,0,0,.18)', padding: '4px 8px', borderRadius: 99 }}>{t.kicker}</span>
        <div>
          <div style={{ ...disp, fontSize: 27, color: t.ink, marginBottom: 6 }}>{t.title}</div>
          <span style={{ ...metaS, color: t.ink }}>{t.meta}</span>
        </div>
      </div>
    );
  } else { /* bottom */
    body = (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 16 }}>
        {t.kicker && <span style={{ ...kick, color: t.acc, marginBottom: 7 }}>{t.kicker}</span>}
        <div style={{ ...disp, fontSize: 30, color: t.ink }}>{t.title}</div>
        {t.meta && <span style={{ ...metaS, color: t.ink, marginTop: 7 }}>{t.meta}</span>}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', aspectRatio: r, background: t.bg, overflow: 'hidden', width: '100%' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 80% 0%, rgba(255,255,255,.10), transparent 60%)' }} />
      {body}
    </div>
  );
}

function FormatTag({ format }) {
  const map = { post: 'Post', story: 'Story', carrousel: 'Carrousel' };
  return <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: 10.5 }}>{map[format]}</span>;
}

function Swatches({ palette, size = 22 }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {palette.map((c, i) => <span key={i} title={c} style={{ width: size, height: size, borderRadius: 6, background: c, boxShadow: 'inset 0 0 0 1px rgba(13,15,10,.12)' }} />)}
    </div>
  );
}

/* ── one template card (focused client view) ────────────────────── */
function TemplateCard({ t, onEdit, onUse }) {
  return (
    <div className="card lift" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={() => onEdit(t)}>
      <div style={{ position: 'relative' }}>
        <TemplateVisual t={t} />
        {t.fav && <span className="chip" style={{ position: 'absolute', top: 10, left: 10, background: 'var(--acid)', color: 'var(--mint-ink)', fontSize: 10 }}><AIcon name="bolt" size={11} /> Favori</span>}
        <div className="tpl-hover" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(12,42,29,.74), rgba(12,42,29,.05) 55%)', opacity: 0, transition: 'opacity .16s', display: 'flex', alignItems: 'flex-end', gap: 8, padding: 14 }}>
          <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); onEdit(t); }}><AIcon name="edit" size={14} /> Modifier</button>
          <button className="btn btn-sm btn-icon" style={{ background: 'rgba(255,255,255,.92)', color: 'var(--ink)' }} onClick={(e) => { e.stopPropagation(); onUse(t); }} title="Dupliquer en post"><AIcon name="copy" size={15} /></button>
        </div>
      </div>
      <div style={{ padding: '11px 13px 13px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }} className="trunc">{t.cat}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 1 }} className="tnum">{t.uses} utilisations</div>
        </div>
        <FormatTag format={t.format} />
      </div>
    </div>
  );
}

/* ── overview: one brand-kit card per client ────────────────────── */
function ClientKitCard({ c, onOpen }) {
  const k = CLIENT_KITS[c.id];
  const tpls = clientTemplates(c).slice(0, 3);
  return (
    <div className="card lift" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={() => onOpen(c)}>
      {/* brand band */}
      <div style={{ height: 70, background: c.grad, position: 'relative' }} />
      <div style={{ padding: '0 18px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 14 }}>
          <Avatar initials={c.initials} color={c.color} size={46} radius={13} style={{ boxShadow: '0 0 0 3px var(--white)', marginTop: -22 }} />
          <div style={{ paddingBottom: 2, minWidth: 0 }}>
            <div className="h-title trunc" style={{ fontSize: 16 }} >{c.name}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }} className="trunc">{c.handle}</div>
          </div>
          <span className="chip" style={{ marginLeft: 'auto', background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: 10.5, flexShrink: 0 }}>{clientTemplates(c).length} modèles</span>
        </div>

        {/* palette */}
        <div className="label" style={{ marginBottom: 7, fontSize: 10 }}>Palette</div>
        <Swatches palette={k.palette} size={24} />

        {/* template thumbnails */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 14 }}>
          {tpls.map(t => <div key={t.id} style={{ borderRadius: 9, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--line)' }}><TemplateVisual t={t} ratio="4 / 5" /></div>)}
        </div>

        <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 14 }}>Ouvrir la charte <AIcon name="arrowUR" size={14} /></button>
      </div>
    </div>
  );
}

/* ── focused client : charte + templates ────────────────────────── */
function ClientKit({ c, onBack, compose, toast }) {
  const k = CLIENT_KITS[c.id];
  const [fmt, setFmt] = useState('all');
  const templates = clientTemplates(c);
  const shown = templates.filter(t => fmt === 'all' || t.format === fmt);
  const edit = (t) => { toast && toast(`« ${t.cat} » de ${c.name} ouvert dans l’éditeur`); compose && compose(); };
  const use = (t) => { toast && toast(`Modèle dupliqué en nouveau post pour ${c.name}`); compose && compose(); };

  return (
    <div className="page screen-in" style={{ maxWidth: 1320 }}>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 16 }}><AIcon name="chevL" size={15} /> Tous les clients</button>

      {/* client brand header */}
      <div style={{ position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 22 }}>
        <div style={{ height: 132, background: c.grad }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, padding: '0 24px 20px', marginTop: -34 }}>
          <Avatar initials={c.initials} color={c.color} size={72} radius={18} style={{ boxShadow: '0 0 0 4px var(--canvas)', flexShrink: 0 }} />
          <div style={{ paddingBottom: 4, flex: 1, minWidth: 0 }}>
            <h1 className="h-display" style={{ fontSize: 26 }}>{c.name}</h1>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>{c.handle} · {c.industry}</div>
          </div>
          <button className="btn btn-ghost" onClick={() => toast && toast('Édition de la charte — bientôt')}><AIcon name="palette" size={16} /> Modifier la charte</button>
        </div>
      </div>

      {/* charte (palette + typo) */}
      <div className="kit-charte" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 26 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="label" style={{ marginBottom: 14 }}>Palette de marque</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {k.palette.map((col, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center' }}>
                <span style={{ width: 64, height: 64, borderRadius: 14, background: col, boxShadow: 'inset 0 0 0 1px rgba(13,15,10,.12)' }} />
                <span className="tnum" style={{ fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase' }}>{col}</span>
              </div>
            ))}
            <button onClick={() => toast && toast('Ajouter une couleur — bientôt')} style={{ width: 64, height: 64, borderRadius: 14, border: '1.5px dashed var(--line)', color: 'var(--ink-3)', display: 'grid', placeItems: 'center', alignSelf: 'flex-start' }} title="Ajouter une couleur"><AIcon name="plus" size={20} /></button>
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="label" style={{ marginBottom: 14 }}>Typographies</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1 }}>Titre {k.display}</div>
              <div className="label" style={{ marginTop: 5, fontSize: 9.5 }}>Affichage · {k.display} 800</div>
            </div>
            <div className="divider" />
            <div>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 15 }}>Corps de texte en {k.body}, lisible et net.</div>
              <div className="label" style={{ marginTop: 5, fontSize: 9.5 }}>Texte · {k.body} 400–700</div>
            </div>
          </div>
        </div>
      </div>

      {/* templates */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 className="h-title" style={{ fontSize: 19 }}>Modèles de {c.name}</h2>
          <span style={{ color: 'var(--ink-3)', fontWeight: 700, fontSize: 14 }}>{templates.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="seg sb-full">
            {[['all', 'Tous'], ['post', 'Post'], ['story', 'Story'], ['carrousel', 'Carrousel']].map(([id, l]) => (
              <button key={id} className={fmt === id ? 'on' : ''} onClick={() => setFmt(id)}>{l}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => { toast && toast(`Nouveau modèle pour ${c.name}`); compose && compose(); }}><AIcon name="plus" size={16} /> Nouveau modèle</button>
        </div>
      </div>

      <div className="tpl-grid">
        {/* create tile */}
        <button className="card" onClick={() => { toast && toast(`Nouveau modèle pour ${c.name}`); compose && compose(); }}
          style={{ border: '1.5px dashed var(--line)', background: 'transparent', minHeight: 230, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--ink-3)', transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.color = 'var(--mint-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-3)'; }}>
          <span style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--sunk)', display: 'grid', placeItems: 'center' }}><AIcon name="plus" size={22} /></span>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>Nouveau modèle</span>
        </button>
        {shown.map(t => <TemplateCard key={t.id} t={t} onEdit={edit} onUse={use} />)}
      </div>

      <style>{`
        .tpl-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        @media (max-width: 1180px) { .tpl-grid { grid-template-columns: repeat(3, 1fr); } .kit-charte { grid-template-columns: 1fr; } }
        @media (max-width: 720px)  { .tpl-grid { grid-template-columns: repeat(2, 1fr); } }
        .card.lift:hover .tpl-hover { opacity: 1; }
      `}</style>
    </div>
  );
}

/* ── page root ──────────────────────────────────────────────────── */
function Templates({ active, setActive, compose, toast }) {
  const [sel, setSel] = useState(active && active !== 'all' ? active : null);
  // sync with global client switcher
  useEffect(() => { if (active && active !== 'all') setSel(active); else if (active === 'all') setSel(null); }, [active]);

  const open = (c) => { setSel(c.id); setActive && setActive(c.id); };
  const back = () => { setSel(null); setActive && setActive('all'); };

  if (sel) {
    const c = clientById(sel);
    if (c) return <ClientKit c={c} onBack={back} compose={compose} toast={toast} />;
  }

  return (
    <div className="page screen-in" style={{ maxWidth: 1320 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Chartes & modèles · {CLIENTS.length} clients</div>
          <h1 className="h-display" style={{ fontSize: 33 }}>
            Modèles par <span className="it" style={{ color: 'var(--mint-2)' }}>client.</span>
          </h1>
          <p style={{ color: 'var(--ink-2)', marginTop: 7, maxWidth: 560 }}>
            Chaque client a sa charte et sa bibliothèque de modèles. Ouvrez un compte pour créer ou modifier ses gabarits.
          </p>
        </div>
      </div>

      <div className="kit-grid">
        {CLIENTS.map(c => <ClientKitCard key={c.id} c={c} onOpen={open} />)}
      </div>

      <style>{`
        .kit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 1080px) { .kit-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 680px)  { .kit-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

Object.assign(window, { Templates });
