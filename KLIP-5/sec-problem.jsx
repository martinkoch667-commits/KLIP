/* sec-problem.jsx — Problème (forest), Comment ça marche (steps), Aperçus (showcase) */

function Probleme({ dir }) {
  const pains = [
    { ic: 'layers', t: 'Quatre outils ouverts', d: 'Canva, Notes, le tableur de planning, l’app Instagram. Vous copiez-collez toute la journée.' },
    { ic: 'clock', t: 'Des soirées à rattraper', d: 'Le contenu déborde sur vos week-ends. Plus vous prenez de clients, plus vous coulez.' },
    { ic: 'voice', t: 'Une voix par client, à la main', d: 'Vous gardez le ton de chaque marque en tête. Une erreur, et c’est le client qui le voit.' },
    { ic: 'chat', t: 'La validation par mail', d: 'Allers-retours interminables, captures d’écran, versions perdues. Le post sort en retard.' },
  ];
  return (
    <section id="probleme" className="section on-forest dotgrid x" style={{ overflow: 'hidden', borderTop: '1px solid var(--line-f)' }}>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 880 }}>
          <h2 className="display reveal d1" style={{ fontSize: 'clamp(40px, 6.4vw, 90px)', marginTop: 22 }}>
            Vous avez touché le <span className="it-serif acid-fill">plafond&nbsp;de&nbsp;verre.</span>
          </h2>
          <p className="lead reveal d2" style={{ marginTop: 26, maxWidth: 620 }}>
            Votre agence ne grandit plus au rythme de votre talent, mais au rythme de votre logistique. Chaque nouveau client ajoute des heures de manipulation, pas de création.
          </p>
        </div>

        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 56 }}>
          {pains.map((p, i) => (
            <div key={i} className={`reveal d${(i % 2) + 1}`} style={{
              background: 'var(--forest-2)', border: dir === 'brut' ? '2.5px solid var(--cream)' : '1px solid var(--line-f)',
              borderRadius: 'var(--radius)', padding: '28px 30px', display: 'flex', gap: 20, alignItems: 'flex-start',
              boxShadow: dir === 'brut' ? '6px 6px 0 var(--acid)' : 'none'
            }}>
              <span style={{
                flex: 'none', width: 48, height: 48, display: 'grid', placeItems: 'center',
                borderRadius: dir === 'brut' ? 0 : 12, background: 'var(--forest-3)', color: 'var(--acid)',
                border: dir === 'brut' ? '2px solid var(--cream)' : 'none', position: 'relative'
              }}>
                <Icon name={p.ic} size={23} />
              </span>
              <div>
                <h3 style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 21, letterSpacing: '-0.02em', marginBottom: 7, textTransform: 'uppercase' }}>{p.t}</h3>
                <p style={{ color: 'var(--cream-2)', fontSize: 15.5, lineHeight: 1.55 }}>{p.d}</p>
              </div>
            </div>
          ))}
        </div>

        {/* big stat line */}
        <div className="reveal d2" style={{
          marginTop: 28, padding: '34px 38px', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
          background: 'var(--acid)', color: 'var(--acid-ink)', borderRadius: 'var(--radius)',
          border: dir === 'brut' ? '2.5px solid var(--cream)' : 'none'
        }}>
          <span style={{ fontFamily: 'var(--heavy)', fontWeight: 900, fontSize: 'clamp(46px, 6vw, 76px)', letterSpacing: '-0.04em', lineHeight: 1 }}>−11h</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, maxWidth: 420, lineHeight: 1.5 }}>
            par semaine et par gestionnaire, englouties à jongler entre les outils plutôt qu’à créer. C’est un client de plus que vous ne prenez pas.
          </span>
        </div>
      </div>
    </section>
  );
}

function Steps({ dir }) {
  const peek = useParallax(0.06);
  const steps = [
    { n: '01', ic: 'upload', t: 'Importez vos médias', d: 'Déposez les photos et vidéos d’un client — tout votre matériel réuni au même endroit.' },
    { n: '02', ic: 'image', t: 'Composez & retouchez', d: 'Créez vos visuels ou retravaillez vos imports dans l’éditeur intégré, type Canva. La charte du client est déjà appliquée.' },
    { n: '03', ic: 'wand', t: 'Rédigez avec l’IA', d: 'Légendes, descriptions et hashtags générés depuis l’image et la voix de marque du client.' },
    { n: '04', ic: 'send', t: 'Programmez & publiez', d: 'Calez sur le calendrier, faites valider, KLIP publie sur Instagram — pour chacun de vos clients.' },
  ];
  return (
    <section id="how" className="section">
      <div className="wrap">
        <div style={{ maxWidth: 840 }}>
          <h2 className="display reveal" style={{ fontSize: 'clamp(36px, 5.4vw, 76px)' }}>
            De la photo au post publié,<br /><span className="it-serif acid-fill">sans changer d’outil.</span>
          </h2>
          <p className="lead reveal d1" style={{ marginTop: 24, maxWidth: 660 }}>
            KLIP réunit toute la post-production de vos réseaux : importez vos prises de vue, composez vos visuels, laissez l’IA écrire, programmez. Pour chaque client, sans jamais quitter l’outil.
          </p>
        </div>

        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.04fr', gap: 56, marginTop: 54, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {steps.map((s, i) => (
              <div key={i} className="reveal" style={{
                display: 'flex', gap: 20, padding: '22px 4px',
                borderTop: dir === 'brut' ? '2.5px solid var(--ink)' : '1px solid var(--line)',
                borderBottom: i === steps.length - 1 ? (dir === 'brut' ? '2.5px solid var(--ink)' : '1px solid var(--line)') : 'none'
              }}>
                <span style={{ flex: 'none', fontFamily: 'var(--heavy)', fontWeight: 900, fontSize: 26, lineHeight: 1, color: 'var(--acid-2)', minWidth: 46 }}>{s.n}</span>
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', marginBottom: 7, textTransform: 'uppercase' }}>
                    <span style={{ color: 'var(--ink-3)', display: 'inline-flex' }}><Icon name={s.ic} size={18} /></span>{s.t}
                  </h3>
                  <p style={{ color: 'var(--ink-2)', fontSize: 15.5, lineHeight: 1.55 }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div ref={peek} className="frame reveal d2">
            <div className="frame-bar">
              <span className="frame-dot" /><span className="frame-dot" /><span className="frame-dot" />
              <span className="frame-url">app.klip.studio / composer</span>
            </div>
            <img src="media/composer.png" alt="Création en lot dans KLIP" style={{ display: 'block', width: '100%' }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Showcase({ dir }) {
  const a = useParallax(0.06);
  const b = useParallax(0.09);
  const cap = (t, d) => (
    <div style={{ display: 'flex', gap: 22, alignItems: 'baseline', marginTop: 30, padding: '0 4px', rowGap: 6, flexWrap: 'wrap' }}>
      <h3 style={{ fontFamily: 'var(--heavy)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{t}</h3>
      <p style={{ color: 'var(--cream-2)', fontSize: 15.5, lineHeight: 1.55, flex: 1, minWidth: 220 }}>{d}</p>
    </div>
  );
  const shots = [
    { ref: a, img: 'media/calendar.png', t: 'Calendrier éditorial', d: 'Tous les posts de tous vos clients sur une seule grille. Glissez pour replanifier, repérez les trous, gardez le rythme — sans tableur.', tags: ['Glisser-déposer', 'Vue mois / semaine', 'Multi-clients'] },
    { ref: b, img: 'media/queue.png', t: 'File de publication', d: 'Vos comptes Instagram connectés. Vous validez, KLIP publie au créneau prévu — plus besoin de rouvrir l’app ni de poster à la main.', tags: ['Auto-publication', 'Validation client', 'Créneaux'] },
  ];
  return (
    <section id="apercu" className="section on-forest x" style={{ overflow: 'hidden' }}>
      <div className="wrap">
        <div style={{ maxWidth: 820 }}>
          <h2 className="display reveal" style={{ fontSize: 'clamp(38px, 5.6vw, 78px)' }}>
            Une interface qui <span className="it-serif acid-fill">respire.</span>
          </h2>
          <p className="lead reveal d2" style={{ marginTop: 24, maxWidth: 580 }}>
            Pensée pour gérer six marques sans jamais les mélanger. Voilà à quoi ressemble une journée de travail sans friction.
          </p>
        </div>

        {/* éditeur — bloc vedette */}
        <div className="reveal" style={{ marginTop: 64 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 28, flexWrap: 'wrap', marginBottom: 26 }}>
            <div style={{ maxWidth: 560 }}>
              <span className="sho-kicker">01 — L’éditeur visuel</span>
              <h3 className="display" style={{ fontSize: 'clamp(28px,3.4vw,46px)', color: 'var(--cream)', marginTop: 14 }}>Un studio de création, pas un simple cadre</h3>
            </div>
            <p style={{ color: 'var(--cream-2)', fontSize: 16, lineHeight: 1.6, maxWidth: 380 }}>
              Sélectionnez un texte et tout s’ouvre — police, taille, couleurs de la charte, effets, animations. La même puissance que Canva ou la suite Adobe, déjà calée sur votre client.
            </p>
          </div>
          <EditorUI dir={dir} />
        </div>

        {/* écrans — alternés */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(56px,8vw,104px)', marginTop: 'clamp(64px,9vw,120px)' }}>
          {shots.map((s, i) => {
            const flip = i % 2 === 1;
            return (
              <div key={i} className="sho-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(34px,5vw,72px)', alignItems: 'center' }}>
                <div className="reveal" style={{ order: flip ? 2 : 1 }}>
                  <span className="sho-kicker">{`0${i + 2}`} — {s.t}</span>
                  <h3 className="display" style={{ fontSize: 'clamp(28px,3.4vw,46px)', color: 'var(--cream)', marginTop: 14 }}>{s.t}</h3>
                  <p style={{ color: 'var(--cream-2)', fontSize: 17, lineHeight: 1.6, marginTop: 18, maxWidth: 440 }}>{s.d}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 24 }}>
                    {s.tags.map((t, j) => <span key={j} className="chip">{t}</span>)}
                  </div>
                </div>
                <div ref={s.ref} className="reveal d2 sho-shot" style={{ order: flip ? 1 : 2 }}>
                  <img src={s.img} alt={s.t} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Probleme, Steps, Showcase });
