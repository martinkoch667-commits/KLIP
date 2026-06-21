/* editor-mock.jsx — faithful static reproduction of the KLIP visual editor,
   shown in the "text selected" state (contextual toolbar populated). */

/* extended icon set — lifted from the app editor (editor-kit.jsx) */
const EdIcon = ({ name, size = 18, stroke = 1.8, style }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', style };
  switch (name) {
    case 'bold':      return <svg {...p}><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" strokeWidth="2"/></svg>;
    case 'italic':    return <svg {...p}><path d="M11 5h7M6 19h7M14 5l-4 14" strokeWidth="2"/></svg>;
    case 'underline': return <svg {...p}><path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14" strokeWidth="2"/></svg>;
    case 'strike':    return <svg {...p}><path d="M5 12h14M8 7.5A4 4 0 0 1 16 8M8.5 16a4 4 0 0 0 7-2.4" strokeWidth="2"/></svg>;
    case 'alignL':    return <svg {...p}><path d="M4 6h16M4 12h10M4 18h13"/></svg>;
    case 'case':      return <svg {...p}><path d="M3 17l3.5-9 3.5 9M4.2 14h4.6M14 11.5a2.8 2.8 0 1 1 0 5.5 2.8 2.8 0 0 1 0-5.5zM19.6 11.6V17"/></svg>;
    case 'lineH':     return <svg {...p}><path d="M4 5l2.2-2L8.4 5M4 19l2.2 2L8.4 19M6.2 4v16M12 6h9M12 12h9M12 18h9"/></svg>;
    case 'transp':    return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h6V3M9 15h6V9M15 21v-6h6" fill="currentColor" stroke="none" opacity=".22"/></svg>;
    case 'effects':   return <svg {...p}><path d="M12 3l1.7 4.8L18 9l-4.3 1.2L12 15l-1.7-4.8L6 9l4.3-1.2zM18.5 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>;
    case 'animate':   return <svg {...p}><path d="M5 12a7 7 0 0 1 7-7M19 12a7 7 0 0 1-7 7"/><path d="M12 5l-2.4 1.4M12 5l2.4 1.4M12 19l-2.4-1.4M12 19l2.4-1.4"/></svg>;
    case 'position':  return <svg {...p}><rect x="3" y="3" width="11" height="11" rx="2"/><path d="M10 10h10v10H10v-2"/></svg>;
    case 'undo':      return <svg {...p}><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1"/></svg>;
    case 'redo':      return <svg {...p}><path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1"/></svg>;
    case 'plus':      return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'minus':     return <svg {...p}><path d="M5 12h14"/></svg>;
    case 'fit':       return <svg {...p}><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>;
    case 'image':     return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/></svg>;
    case 'text':      return <svg {...p}><path d="M5 6.5V5h14v1.5M12 5v14M9 19h6"/></svg>;
    case 'upload':    return <svg {...p}><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/></svg>;
    case 'chevD':     return <svg {...p}><path d="M6 9l6 6 6-6"/></svg>;
    case 'check':     return <svg {...p}><path d="M4 12.5l5 5 11-11"/></svg>;
    case 'eye':       return <svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'play':      return <svg {...p}><path d="M7 5l12 7-12 7V5Z" fill="currentColor" stroke="none"/></svg>;
    case 'palette':   return <svg {...p}><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.4-1-1.5-1-3 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-4-4-7.5-9-7.5Z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.1" fill="currentColor" stroke="none"/></svg>;
    case 'template':  return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/></svg>;
    case 'shapes':    return <svg {...p}><rect x="3" y="13" width="8" height="8" rx="1.6"/><circle cx="16.5" cy="16.5" r="4.2"/><path d="M9 3l5 8H4z"/></svg>;
    default: return null;
  }
};

/* palette tokens that mirror the app editor */
const EDU = { sunk: '#ECEBE1', mint: '#1F9D63', mintSoft: '#E2F4EA', line: 'rgba(13,15,10,.12)',
  ink: '#14160F', ink2: '#5A5E50', ink3: '#8A8D7E', cream: '#EEEDE3' };

function EditorUI({ dir }) {
  const E = EDU;
  /* contextual toolbar — a text layer is selected */
  const Div = () => <span style={{ width: 1, height: 22, background: E.line, margin: '0 5px', flexShrink: 0 }} />;
  const IBtn = ({ name, on }) => (
    <span style={{ width: 33, height: 33, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0,
      color: on ? E.mint : E.ink, background: on ? E.mintSoft : 'transparent' }}><EdIcon name={name} size={18} /></span>
  );
  const TxtBtn = ({ name, label }) => (
    <span style={{ height: 33, padding: '0 11px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: E.ink, flexShrink: 0, whiteSpace: 'nowrap' }}>
      <EdIcon name={name} size={16} /> {label}
    </span>
  );

  const rail = [['template', 'Modèles'], ['shapes', 'Éléments'], ['text', 'Texte'], ['image', 'Photos'], ['palette', 'Charte'], ['upload', 'Importer']];
  const handle = [{ t: -5, l: -5 }, { t: -5, r: -5 }, { b: -5, l: -5 }, { b: -5, r: -5 }, { t: -5, l: '50%' }, { b: -5, l: '50%' }, { t: '50%', l: -5 }, { t: '50%', r: -5 }];

  return (
    <div style={{
      width: '100%', borderRadius: dir === 'brut' ? 0 : 14, overflow: 'hidden', color: E.ink,
      background: 'radial-gradient(120% 80% at 50% -10%, #FBFAF4, #ECEBE1 70%)',
      border: dir === 'brut' ? '2.5px solid var(--ink)' : '1px solid rgba(13,15,10,.1)',
      boxShadow: dir === 'brut' ? '8px 8px 0 var(--ink)' : '0 40px 80px -36px rgba(0,0,0,.6)'
    }}>
      {/* ── header: undo/redo · contextual text toolbar · actions ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', minHeight: 58, background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${E.line}` }}>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0, color: E.ink2 }}>
          <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center' }}><EdIcon name="undo" size={18} /></span>
          <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center' }}><EdIcon name="redo" size={18} /></span>
        </div>
        <Div />
        {/* the contextual toolbar (floats, centered) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#fff', borderRadius: 12, padding: '5px 7px', boxShadow: '0 8px 26px -10px rgba(13,15,10,.26), 0 0 0 1px rgba(13,15,10,.05)' }}>
            <span style={{ height: 33, padding: '0 10px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8, background: E.sunk, flexShrink: 0 }}>
              <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 600, fontSize: 13 }}>Archivo</span>
              <EdIcon name="chevD" size={13} style={{ color: E.ink3 }} />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', background: E.sunk, borderRadius: 9, marginLeft: 4, height: 33, flexShrink: 0 }}>
              <span style={{ width: 28, display: 'grid', placeItems: 'center', color: E.ink }}><EdIcon name="minus" size={15} /></span>
              <span style={{ width: 34, textAlign: 'center', fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>92</span>
              <span style={{ width: 28, display: 'grid', placeItems: 'center', color: E.ink }}><EdIcon name="plus" size={15} /></span>
            </span>
            <Div />
            <span style={{ width: 33, height: 33, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 19, height: 19, borderRadius: 6, background: E.cream, boxShadow: 'inset 0 0 0 1.5px rgba(13,15,10,.18)' }} />
            </span>
            <IBtn name="bold" on />
            <IBtn name="italic" on />
            <IBtn name="underline" />
            <IBtn name="strike" />
            <IBtn name="case" />
            <Div />
            <IBtn name="alignL" />
            <IBtn name="lineH" />
            <TxtBtn name="effects" label="Effets" />
            <Div />
            <IBtn name="transp" />
            <TxtBtn name="animate" label="Animer" />
            <TxtBtn name="position" label="Position" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <span style={{ height: 34, padding: '0 13px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: E.ink2, boxShadow: `inset 0 0 0 1px ${E.line}` }}><EdIcon name="eye" size={15} /> Aperçu</span>
          <span style={{ height: 34, padding: '0 13px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: '#fff', background: E.mint }}><EdIcon name="upload" size={15} /> Partager</span>
        </div>
      </div>

      {/* ── body: tool rail · workspace ── */}
      <div style={{ display: 'flex', minHeight: 420 }}>
        <div className="ed-rail" style={{ width: 70, flexShrink: 0, background: '#fff', borderRight: `1px solid ${E.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 0' }}>
          {rail.map(([ic, label], i) => {
            const on = i === 2; // Texte active
            return (
              <span key={i} style={{ width: 54, height: 56, borderRadius: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, color: on ? E.mint : E.ink2, background: on ? E.mintSoft : 'transparent' }}>
                <EdIcon name={ic} size={20} stroke={1.7} />
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 9, letterSpacing: '.02em', textTransform: 'uppercase' }}>{label}</span>
              </span>
            );
          })}
        </div>

        {/* workspace */}
        <div style={{ flex: 1, minWidth: 0, display: 'grid', placeItems: 'center', padding: 26 }}>
          <div style={{ position: 'relative', height: 408, aspectRatio: '4 / 5', borderRadius: dir === 'brut' ? 0 : 16, overflow: 'hidden', boxShadow: '0 30px 70px -30px rgba(13,15,10,.55)', background: 'linear-gradient(155deg,#1f7a4d,#0c2a1d)' }}>
            {/* brand handle */}
            <span style={{ position: 'absolute', top: 18, left: 18, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, letterSpacing: '.14em', color: E.cream }}>MAISON LOU</span>
            {/* image frame */}
            <div style={{ position: 'absolute', top: 44, left: 18, right: 18, height: 150, borderRadius: 12, border: '1.5px dashed rgba(238,237,227,.5)', background: 'rgba(255,255,255,.06)', display: 'grid', placeItems: 'center', color: 'rgba(238,237,227,.6)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}><EdIcon name="image" size={22} stroke={1.5} /><span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700 }}>PHOTO DU PLAT</span></div>
            </div>
            {/* pill */}
            <span style={{ position: 'absolute', top: 208, left: 18, background: 'var(--acid)', color: '#14160F', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, letterSpacing: '.08em', padding: '7px 14px', borderRadius: 999 }}>SEPTEMBRE</span>
            {/* selected title */}
            <div style={{ position: 'absolute', top: 248, left: 18, width: 226 }}>
              <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 800, fontStyle: 'italic', fontSize: 32, lineHeight: 0.96, letterSpacing: '-0.03em', color: E.cream, textShadow: '0 3px 16px rgba(0,0,0,.45)' }}>Nouvelle carte d’automne</div>
              {/* selection overlay */}
              <div style={{ position: 'absolute', inset: '-9px -11px', border: `1.5px solid ${E.mint}`, borderRadius: dir === 'brut' ? 0 : 3 }}>
                {handle.map((h, i) => (
                  <span key={i} style={{ position: 'absolute', top: h.t, left: h.l, right: h.r, bottom: h.b, width: 8, height: 8, transform: (h.l === '50%' || h.t === '50%') ? 'translate(-50%,-50%)' : 'none', background: '#fff', border: `1.5px solid ${E.mint}`, borderRadius: dir === 'brut' ? 0 : 2 }} />
                ))}
                {/* rotate handle */}
                <span style={{ position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)', width: 1, height: 18, background: E.mint }} />
                <span style={{ position: 'absolute', top: -34, left: '50%', transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', border: `1.5px solid ${E.mint}` }} />
              </div>
            </div>
            {/* subtitle */}
            <div style={{ position: 'absolute', top: 352, left: 18, width: 200, fontFamily: "'Satoshi',sans-serif", fontWeight: 500, fontSize: 13, lineHeight: 1.25, color: 'rgba(238,237,227,.82)' }}>Réservations ouvertes tout le mois</div>
          </div>
        </div>
      </div>

      {/* ── bottom zoom bar ── */}
      <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderTop: `1px solid ${E.line}`, background: '#fff' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, color: E.ink2, background: E.sunk, padding: '6px 11px', borderRadius: 999 }}><EdIcon name="image" size={13} /> Page 1 · Post 4:5</span>
        <span style={{ fontSize: 12, color: E.ink3, fontWeight: 600 }}>Maison Lou</span>
        <div className="ed-zoomr" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9, color: E.ink2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11.5, padding: '6px 10px', borderRadius: 999, boxShadow: `inset 0 0 0 1px ${E.line}` }}><EdIcon name="play" size={13} /> Animer</span>
          <span style={{ width: 1, height: 20, background: E.line }} />
          <EdIcon name="minus" size={15} />
          <span style={{ width: 92, height: 4, borderRadius: 2, background: E.sunk, position: 'relative' }}><span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '42%', background: E.mint, borderRadius: 2 }} /><span style={{ position: 'absolute', left: '42%', top: '50%', transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} /></span>
          <EdIcon name="plus" size={15} />
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11.5, width: 38, textAlign: 'center' }}>50%</span>
          <EdIcon name="fit" size={15} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EdIcon, EditorUI });
