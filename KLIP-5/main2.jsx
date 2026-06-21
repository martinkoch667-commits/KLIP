/* main2.jsx — compose sections + Tweaks (direction switch + accents) */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "direction": "magazine",
  "accent": ["#CBFF3A", "#B0EC12", "#16240A"]
} /*EDITMODE-END*/;

const ACCENTS = [
  ["#CBFF3A", "#B0EC12", "#16240A"], // lime vif
  ["#E9FF52", "#CBE81F", "#23280A"], // citron électrique
  ["#7BE53C", "#3FBE18", "#0b2a10"], // vert pomme
  ["#34E0A1", "#16C384", "#04241a"], // menthe
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  useReveal();

  const dir = t.direction;
  const rootStyle = {
    '--acid': t.accent[0],
    '--acid-2': t.accent[1],
    '--acid-ink': t.accent[2],
  };

  return (
    <div style={rootStyle} className={dir === 'brut' ? 'dir-brut' : 'dir-magazine'}>
      <Nav dir={dir} />
      <Hero dir={dir} />
      <Probleme dir={dir} />
      <Steps dir={dir} />
      <Showcase dir={dir} />
      <Features dir={dir} />
      <Testimonials dir={dir} />
      <Pricing dir={dir} />
      <FAQ dir={dir} />
      <FinalCTA dir={dir} />
      <Footer dir={dir} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Direction" />
        <TweakRadio label="Style" value={t.direction} options={['magazine', 'brut']} onChange={(v) => setTweak('direction', v)} />
        <TweakSection label="Couleur d’accent" />
        <TweakColor label="Vert" value={t.accent} options={ACCENTS} onChange={(v) => setTweak('accent', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
