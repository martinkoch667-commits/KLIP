/* app.jsx — compose sections + Tweaks */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": ["#5FE6B4", "#1FC98A", "#06281c"],
  "display": "heavy",
  "gradient": 20,
  "hero": "centered"
} /*EDITMODE-END*/;

const ACCENTS = [
["#C8F135", "#B4E01A", "#1A2A05"], // lime classique
["#7BE53C", "#3FBE18", "#0b2a10"], // vert vif
["#E9FF52", "#CBE81F", "#232a05"], // citron électrique
["#5FE6B4", "#1FC98A", "#06281c"] // menthe
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  useReveal();

  const onDemo = () => {window.location.hash = '#demo';};

  const rootStyle = {
    '--acid': t.accent[0],
    '--acid-2': t.accent[1],
    '--acid-ink': t.accent[2],
    '--display': t.display === 'serif' ? 'var(--serif)' : 'var(--heavy)',
    '--grad': (t.gradient / 100).toFixed(2)
  };

  return (
    <div style={rootStyle} className={t.display === 'serif' ? 'serifmode' : ''}>
      <Nav onDemo={onDemo} />
      <Hero variant={t.hero} onDemo={onDemo} />
      <Marquee />
      <Probleme />
      <Process />
      <DemoSection />
      <Features />
      <Logos />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />

      <TweaksPanel>
        <TweakSection label="Couleur d’accent" />
        <TweakColor label="Vert" value={t.accent} options={ACCENTS} onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Typographie" />
        <TweakRadio label="Titres" value={t.display} options={['heavy', 'serif']} onChange={(v) => setTweak('display', v)} />
        <TweakSection label="Composition" />
        <TweakRadio label="Hero" value={t.hero} options={['split', 'centered']} onChange={(v) => setTweak('hero', v)} />
        <TweakSlider label="Dégradés" value={t.gradient} min={0} max={100} step={10} unit="%" onChange={(v) => setTweak('gradient', v)} />
      </TweaksPanel>
    </div>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);