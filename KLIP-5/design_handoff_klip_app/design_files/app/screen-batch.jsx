/* screen-batch.jsx — bulk post creation: import many → AI generates all → edit each */

const BATCH_PHOTOS = [
  { grad: 'linear-gradient(150deg,#2b8d57,#0c2a1d)', name: 'terrasse-soir.jpg' },
  { grad: 'linear-gradient(150deg,#caa14a,#6e4d1c)', name: 'dessert-citron.jpg' },
  { grad: 'linear-gradient(150deg,#4a6a8d,#1a2535)', name: 'salle-matin.jpg' },
  { grad: 'linear-gradient(150deg,#b85c4a,#5a1f17)', name: 'plat-signature.jpg' },
  { grad: 'linear-gradient(150deg,#3a6b48,#16261b)', name: 'cave-vins.jpg' },
  { grad: 'linear-gradient(150deg,#d97a4a,#7a2417)', name: 'equipe-cuisine.jpg' },
  { grad: 'linear-gradient(150deg,#5a86e8,#1a2f6b)', name: 'detail-table.jpg' },
  { grad: 'linear-gradient(150deg,#88b394,#2f4d38)', name: 'cafe-latte.jpg' },
];

const GEN_HEADLINES = ['L’été se réserve maintenant', 'Nouvelle carte ↗', 'Le rendez-vous du soir', 'Fait maison, chaque jour', 'On vous garde une table', 'Édition de saison', 'Le goût du moment', 'À partager'];
const GEN_CAPTIONS = (handle) => [
  `La lumière de fin d’été sur nos tables. Réservations ouvertes pour septembre. ✦\n\n#${handle} #septembre`,
  `Nouvelle sélection à découvrir cette semaine. On vous attend.\n\n#${handle} #nouveaute`,
  `Le rituel du soir commence ici. Ambiance et petites assiettes.\n\n#${handle} #soir`,
  `Préparé le matin même, avec ce qu’on trouve de meilleur.\n\n#${handle} #faitmaison`,
  `Une table vous attend ce week-end. Lien en bio.\n\n#${handle} #weekend`,
  `Disponible pour quelques jours seulement.\n\n#${handle} #edition`,
];

function BatchComposer({ active, setRoute, toast }) {
  const [clientId, setClientId] = useState(active !== 'all' ? active : 'lou');
  const client = clientById(clientId);
  const [step, setStep] = useState('import');   // import | generating | review
  const [staged, setStaged] = useState([]);      // photos chosen
  const [tone, setTone] = useState('Chic');
  const [items, setItems] = useState([]);        // generated drafts
  const [editing, setEditing] = useState(null);  // index
  const [genIdx, setGenIdx] = useState(0);

  const handle = client.handle.replace('@', '');

  const addPhotos = (n) => {
    setStaged(prev => {
      const next = [...prev];
      for (let i = 0; i < n && next.length < 8; i++) {
        const p = BATCH_PHOTOS[next.length % BATCH_PHOTOS.length];
        next.push({ id: 'st' + Date.now() + '_' + next.length, ...p });
      }
      return next;
    });
  };

  const startGenerate = () => {
    const drafts = staged.map((s, i) => ({
      id: 'b' + i, grad: s.grad, name: s.name,
      title: '', caption: '', tone,
      day: 8 + (i % 6) + 1, time: ['08:00', '12:30', '18:30'][i % 3],
      done: false,
    }));
    setItems(drafts);
    setStep('generating');
    setGenIdx(0);
  };

  // staggered "generation" animation
  useEffect(() => {
    if (step !== 'generating') return;
    if (genIdx >= items.length) { const t = setTimeout(() => setStep('review'), 450); return () => clearTimeout(t); }
    const t = setTimeout(() => {
      setItems(prev => prev.map((it, i) => i === genIdx ? {
        ...it,
        title: GEN_HEADLINES[i % GEN_HEADLINES.length],
        caption: GEN_CAPTIONS(handle)[i % GEN_CAPTIONS(handle).length],
        done: true,
      } : it));
      setGenIdx(g => g + 1);
    }, 520);
    return () => clearTimeout(t);
  }, [step, genIdx, items.length, handle]);

  const updateItem = (i, patch) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeStaged = (id) => setStaged(prev => prev.filter(s => s.id !== id));

  /* ---- embedded editor for one draft ---- */
  if (editing !== null && items[editing]) {
    const it = items[editing];
    return <Editor embedded post={{ ...it, client: clientId }} active={clientId}
      onBack={() => setEditing(null)}
      onSave={(patch) => updateItem(editing, patch)} />;
  }

  return (
    <div className="scroll">
      <div className="page screen-in" style={{ maxWidth: 1180 }}>
        {/* creative header */}
        <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', padding: '28px 30px', marginBottom: 26,
          background: 'var(--forest)', color: 'var(--cream)' }}>
          <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', right: -60, top: -120, background: 'radial-gradient(circle, var(--mint), transparent 70%)', opacity: .5, filter: 'blur(20px)' }} />
          <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', right: 160, bottom: -140, background: 'radial-gradient(circle, var(--acid), transparent 70%)', opacity: .35, filter: 'blur(20px)' }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div className="label" style={{ color: 'var(--mint)', marginBottom: 10 }}>Création en lot</div>
            <h1 className="h-display" style={{ fontSize: 38, color: 'var(--cream)', maxWidth: 600 }}>
              Toutes vos photos. <span className="it" style={{ color: 'var(--mint)' }}>Une fournée de posts.</span>
            </h1>
            <p style={{ color: 'var(--cream-2)', marginTop: 10, maxWidth: 520, fontSize: 15 }}>
              Déposez le shooting entier, l’IA rédige chaque description et chaque accroche d’un coup. Vous peaufinez ensuite, visuel par visuel.
            </p>
          </div>
        </div>

        <BatchSteps step={step} />

        {step === 'import' && (
          <ImportStep client={client} clientId={clientId} setClientId={setClientId} staged={staged}
            addPhotos={addPhotos} removeStaged={removeStaged} tone={tone} setTone={setTone} onNext={startGenerate} />
        )}

        {(step === 'generating' || step === 'review') && (
          <ReviewStep step={step} items={items} client={client} genIdx={genIdx}
            onEdit={(i) => setEditing(i)} updateItem={updateItem}
            onScheduleAll={() => { toast(`${items.length} posts planifiés pour ${client.name}`); setRoute('queue'); }}
            onBack={() => { setStep('import'); }} />
        )}
      </div>
    </div>
  );
}

function BatchSteps({ step }) {
  const steps = [['import', 'Importer'], ['generating', 'Générer'], ['review', 'Peaufiner']];
  const idx = step === 'import' ? 0 : step === 'generating' ? 1 : 2;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
      {steps.map(([id, label], i) => (
        <React.Fragment key={id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12,
              background: i < idx ? 'var(--mint)' : i === idx ? 'var(--ink)' : 'var(--sunk)', color: i <= idx ? (i < idx ? 'var(--mint-ink)' : 'var(--paper)') : 'var(--ink-3)' }}>
              {i < idx ? <AIcon name="check" size={14} /> : i + 1}
            </span>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: i <= idx ? 'var(--ink)' : 'var(--ink-3)' }}>{label}</span>
          </div>
          {i < 2 && <div style={{ flex: 1, height: 2, borderRadius: 2, background: i < idx ? 'var(--mint)' : 'var(--line)', maxWidth: 80 }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function ImportStep({ client, clientId, setClientId, staged, addPhotos, removeStaged, tone, setTone, onNext }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, alignItems: 'start' }} className="batch-import">
      {/* dropzone + staged grid */}
      <div className="card" style={{ padding: 22 }}>
        <button onClick={() => addPhotos(4)} style={{ width: '100%', border: '1.5px dashed var(--line)', borderRadius: 16, padding: '34px 20px', background: 'var(--canvas)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.background = 'var(--mint-soft)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--canvas)'; }}>
          <span style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center' }}><AIcon name="upload" size={24} /></span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Déposez vos photos ici</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>ou cliquez pour ajouter le shooting · JPG, PNG</div>
          </div>
        </button>

        {staged.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 12px' }}>
              <span className="label">{staged.length} photo{staged.length > 1 ? 's' : ''} prête{staged.length > 1 ? 's' : ''}</span>
              <button className="btn btn-sm btn-ghost" onClick={() => addPhotos(2)} disabled={staged.length >= 8}><AIcon name="plus" size={14} /> Ajouter</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }} className="staged-grid">
              {staged.map((s) => (
                <div key={s.id} className="pop-in" style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '4/5', background: s.grad, boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                  <button onClick={() => removeStaged(s.id)} style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,.5)', color: '#fff', display: 'grid', placeItems: 'center', backdropFilter: 'blur(4px)' }}><AIcon name="trash" size={12} /></button>
                  <span style={{ position: 'absolute', left: 6, bottom: 6, fontSize: 9.5, color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,.5)' }} className="trunc">{s.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* settings panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 0 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="label" style={{ marginBottom: 10 }}>Client</div>
          <BatchClientPicker clientId={clientId} setClientId={setClientId} />
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="label" style={{ marginBottom: 10 }}>Voix de marque</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {Object.keys(ED_TONES).map(t => (
              <button key={t} onClick={() => setTone(t)} style={{ padding: '9px', borderRadius: 9, fontWeight: 700, fontSize: 13, transition: 'all .14s',
                background: tone === t ? 'var(--ink)' : 'var(--white)', color: tone === t ? 'var(--paper)' : 'var(--ink-2)', boxShadow: tone === t ? 'none' : 'inset 0 0 0 1px var(--line)' }}>{t}</button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 12, lineHeight: 1.45 }}>L’IA appliquera ce ton à toutes les descriptions générées.</p>
        </div>
        <button className="btn btn-primary" style={{ width: '100%', padding: '13px', fontSize: 14.5, opacity: staged.length === 0 ? .45 : 1, pointerEvents: staged.length === 0 ? 'none' : 'auto' }} onClick={onNext}>
          <AIcon name="spark" size={17} /> Générer {staged.length || ''} description{staged.length > 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

function BatchClientPicker({ clientId, setClientId }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {CLIENTS.map(c => (
        <button key={c.id} onClick={() => setClientId(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 9, textAlign: 'left',
          background: clientId === c.id ? 'var(--mint-soft)' : 'transparent', transition: 'background .14s' }}>
          <Avatar initials={c.initials} color={c.color} size={28} radius={8} />
          <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1 }} className="trunc">{c.name}</span>
          {clientId === c.id && <AIcon name="check" size={16} style={{ color: 'var(--mint-2)' }} />}
        </button>
      ))}
    </div>
  );
}

function ReviewStep({ step, items, client, genIdx, onEdit, updateItem, onScheduleAll, onBack }) {
  const generating = step === 'generating';
  const allDone = items.every(it => it.done);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {generating
            ? <><span className="spin" style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid var(--mint-soft)', borderTopColor: 'var(--mint-2)' }} />
                <span style={{ fontWeight: 700 }}>L’IA rédige vos posts… {Math.min(genIdx, items.length)}/{items.length}</span></>
            : <><span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--mint)', color: 'var(--mint-ink)', display: 'grid', placeItems: 'center' }}><AIcon name="check" size={15} /></span>
                <span style={{ fontWeight: 700 }}>{items.length} posts prêts pour {client.name}</span></>}
        </div>
        {!generating && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onBack}><AIcon name="chevL" size={15} /> Importer plus</button>
            <button className="btn btn-primary" onClick={onScheduleAll}><AIcon name="calendar" size={16} /> Tout planifier</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }} className="review-grid">
        {items.map((it, i) => (
          <BatchItemCard key={it.id} it={it} client={client} onEdit={() => onEdit(i)} updateItem={(p) => updateItem(i, p)} />
        ))}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin .7s linear infinite}`}</style>
    </div>
  );
}

function BatchItemCard({ it, client, onEdit, updateItem }) {
  return (
    <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: it.done ? 1 : .96 }}>
      <div style={{ padding: 8 }}>
        <div style={{ position: 'relative', aspectRatio: '4/5', background: it.grad, borderRadius: 11, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
          <div style={{ position: 'absolute', top: 10, left: 10, fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 9, color: 'rgba(255,255,255,.85)', letterSpacing: '.06em' }}>{client.handle.replace('@', '').toUpperCase()}</div>
          {it.done
            ? <div className="pop-in" style={{ fontFamily: 'var(--display)', fontWeight: 800, fontStyle: 'italic', fontSize: 22, lineHeight: 1, letterSpacing: '-0.02em', color: '#fff', textShadow: '0 2px 14px rgba(0,0,0,.4)' }}>{it.title}</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '70%' }}>
                <span className="shim" style={{ height: 14, borderRadius: 4, width: '90%' }} />
                <span className="shim" style={{ height: 14, borderRadius: 4, width: '60%' }} />
              </div>}
        </div>
      </div>
      <div style={{ padding: '4px 13px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {it.done ? (
          <>
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45, whiteSpace: 'pre-line', minHeight: 52,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.caption}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <span className="chip" style={{ background: 'var(--mint-soft)', color: 'var(--mint-2)' }}>{it.tone}</span>
              <span className="tnum" style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 }}>{it.day} sept · {it.time}</span>
            </div>
            <div style={{ display: 'flex', gap: 7, marginTop: 'auto' }}>
              <button className="btn btn-sm btn-dark" style={{ flex: 1 }} onClick={onEdit}><AIcon name="edit" size={14} /> Éditer le visuel</button>
              <button className="btn btn-sm btn-ghost btn-icon" title="Régénérer" onClick={() => updateItem({ caption: GEN_CAPTIONS(client.handle.replace('@', ''))[Math.floor(Math.random() * 6)] })}><AIcon name="spark" size={15} /></button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '4px 0' }}>
            <span className="shim" style={{ height: 10, borderRadius: 3, width: '100%' }} />
            <span className="shim" style={{ height: 10, borderRadius: 3, width: '85%' }} />
            <span className="shim" style={{ height: 10, borderRadius: 3, width: '60%' }} />
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { BatchComposer });
