"use client";

/* Banc d'essai : six écrans de chargement pour la composition IA.
 *
 * L'écran actuel (maquette miniature + curseur « Klip » + pastilles) ne plaît
 * pas : trop illustratif, trop chargé, pas la direction artistique de la
 * landing. On propose donc six pistes VIVANTES, animées, côte à côte, plutôt
 * qu'une description. Martin en choisit une, on l'approfondit.
 *
 * Toutes utilisent les jetons de la charte : papier, forêt, leaf, violet,
 * Archivo pour les titres, early-sans pour le texte.
 */

import React from "react";

const ETAPES = [
  "On lit votre photo",
  "La charte s'applique",
  "Le titre trouve sa place",
  "Les marges se recalent",
  "Les couleurs de la marque arrivent",
];

/** Horloge commune : toutes les pistes avancent au même rythme. */
function useEtape(periode = 1400) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setI(v => (v + 1) % ETAPES.length), periode);
    return () => clearInterval(id);
  }, [periode]);
  return i;
}

const CADRE: React.CSSProperties = {
  position: "relative", borderRadius: 18, overflow: "hidden",
  aspectRatio: "16/10", display: "grid", placeItems: "center",
  // Le libellé vit dans les 38 px du bas : le contenu ne descend pas dessous.
  paddingBottom: 38,
};

// ─── 1. Le calque se pose ────────────────────────────────────────────────────
// Le geste du produit, dépouillé : une page, des blocs qui se posent, une
// règle de progression. Aucun curseur, aucune pastille.
function PisteCalques() {
  const e = useEtape();
  const blocs = [
    { l: 12, t: 12, r: 12, b: 12, radius: 10, bg: "linear-gradient(160deg,#1B3B2A,#0C2A1D)" },
    { l: 12, r: 12, b: 12, h: 74, radius: 10, bg: "linear-gradient(180deg,rgba(12,42,29,0),rgba(12,42,29,.9))" },
    { l: 22, b: 52, w: 104, h: 16, radius: 3, bg: "#F5F0E8" },
    { l: 22, b: 34, w: 64, h: 7, radius: 3, bg: "rgba(245,240,232,.55)" },
    { l: 22, b: 14, w: 52, h: 14, radius: 999, bg: "#BDF2A0" },
  ];
  return (
    <div style={{ ...CADRE, background: "var(--paper, #F5F0E8)" }}>
      <div style={{ position: "relative", width: 170, aspectRatio: "4/5", borderRadius: 14, background: "#fff", boxShadow: "0 1px 2px rgba(16,19,11,.10), 0 26px 50px -28px rgba(16,19,11,.5)", overflow: "hidden" }}>
        {blocs.map((b, i) => (
          <span key={i} style={{
            position: "absolute", left: b.l, top: b.t, right: b.r, bottom: b.b, width: b.w, height: b.h,
            borderRadius: b.radius, background: b.bg,
            opacity: i <= e ? 1 : 0, transform: i <= e ? "translateY(0)" : "translateY(7px)",
            transition: "opacity .45s cubic-bezier(.2,.8,.2,1), transform .45s cubic-bezier(.2,.8,.2,1)",
          }} />
        ))}
      </div>
      <div style={{ position: "absolute", left: 22, right: 22, bottom: 13 }}>
        <div style={{ height: 2, background: "rgba(16,19,11,.10)", borderRadius: 2, overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${((e + 1) / ETAPES.length) * 100}%`, background: "var(--leaf, #BDF2A0)", transition: "width .45s cubic-bezier(.2,.8,.2,1)" }} />
        </div>
        <p style={{ margin: "9px 0 0", fontSize: 12, fontWeight: 600, color: "var(--ink-2, #3C4034)" }}>{ETAPES[e]}</p>
      </div>
    </div>
  );
}

// ─── 2. Bandeau typographique ────────────────────────────────────────────────
// Éditorial : l'étape en cours est écrite en très gros et défile. On lit le
// travail au lieu de regarder une animation.
function PisteBandeau() {
  const e = useEtape(1600);
  return (
    <div style={{ ...CADRE, background: "var(--forest, #0C2A1D)" }}>
      <style>{`@keyframes klipDefile{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <div style={{ position: "absolute", inset: "0 0 38px", display: "grid", alignContent: "center", gap: 4, overflow: "hidden" }}>
        {[0, 1, 2].map(rangee => (
          <div key={rangee} style={{ display: "flex", gap: 26, whiteSpace: "nowrap", animation: `klipDefile ${16 + rangee * 5}s linear infinite`, animationDirection: rangee === 1 ? "reverse" : "normal", opacity: rangee === 1 ? 1 : 0.16 }}>
            {[0, 1].map(copie => (
              <span key={copie} style={{ display: "flex", gap: 26 }}>
                {ETAPES.map((t, i) => (
                  <span key={i} style={{
                    fontFamily: "var(--display, Archivo), system-ui", fontWeight: 800, fontSize: rangee === 1 ? 38 : 30,
                    letterSpacing: "-0.03em", textTransform: "uppercase",
                    color: rangee === 1 && i === e ? "var(--leaf, #BDF2A0)" : "#F5F0E8",
                    transition: "color .4s",
                  }}>{t}</span>
                ))}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 16, textAlign: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(245,240,232,.6)", letterSpacing: ".14em", textTransform: "uppercase" }}>Klip compose</span>
      </div>
    </div>
  );
}

// ─── 3. La trame se range ────────────────────────────────────────────────────
// La trame de points de la landing : les points migrent pour dessiner la mise
// en page. Générative, silencieuse, très reconnaissable.
function PisteTrame() {
  const e = useEtape();
  const COL = 22, LIG = 13;
  const cases = React.useMemo(() => Array.from({ length: COL * LIG }, (_, i) => ({ x: i % COL, y: Math.floor(i / COL) })), []);
  const dansBloc = (x: number, y: number, etape: number) => {
    if (etape >= 0 && x > 2 && x < COL - 3 && y > 1 && y < LIG - 2) return true;
    return false;
  };
  return (
    <div style={{ ...CADRE, background: "var(--paper, #F5F0E8)" }}>
      <div style={{ position: "absolute", inset: "0 0 38px", }}>
        {cases.map((c, i) => {
          const dedans = dansBloc(c.x, c.y, e);
          const actif = dedans && (c.y - 2) <= (e + 1) * 2;
          return (
            <span key={i} style={{
              position: "absolute",
              left: `${(c.x + 0.5) * (100 / COL)}%`, top: `${(c.y + 0.5) * (100 / LIG)}%`,
              width: actif ? 7 : 3, height: actif ? 7 : 3, marginLeft: actif ? -3.5 : -1.5, marginTop: actif ? -3.5 : -1.5,
              borderRadius: actif ? 2 : "50%",
              background: actif ? "var(--forest, #0C2A1D)" : "rgba(16,19,11,.16)",
              transition: `all .5s cubic-bezier(.2,.8,.2,1) ${(c.x + c.y) * 8}ms`,
            }} />
          );
        })}
      </div>
      <p style={{ position: "absolute", bottom: 16, margin: 0, fontSize: 12, fontWeight: 700, color: "var(--ink-2, #3C4034)" }}>{ETAPES[e]}</p>
    </div>
  );
}

// ─── 4. Les cartes se distribuent ────────────────────────────────────────────
// Les pistes de composition arrivent comme un jeu de cartes qu'on étale : on
// comprend que l'IA essaie plusieurs mises en page avant de choisir.
function PisteCartes() {
  const e = useEtape(1300);
  const teintes = ["#0C2A1D", "#BDF2A0", "#F5F0E8", "#6656D9", "#FF5A3C"];
  return (
    <div style={{ ...CADRE, background: "var(--cream, #EFEBE0)" }}>
      <div style={{ position: "relative", width: 150, aspectRatio: "4/5" }}>
        {teintes.map((c, i) => {
          const rang = (i - e + teintes.length) % teintes.length;
          return (
            <span key={i} style={{
              position: "absolute", inset: 0, borderRadius: 13, background: c,
              boxShadow: "0 1px 2px rgba(16,19,11,.12), 0 24px 44px -26px rgba(16,19,11,.5)",
              transform: `translate(${rang * 9}px, ${rang * -7}px) rotate(${rang * 3.4 - 4}deg) scale(${1 - rang * 0.035})`,
              zIndex: teintes.length - rang,
              transition: "transform .6s cubic-bezier(.2,.8,.2,1)",
            }} />
          );
        })}
      </div>
      <p style={{ position: "absolute", bottom: 16, margin: 0, fontSize: 12, fontWeight: 700, color: "var(--ink-2, #3C4034)" }}>{ETAPES[e]}</p>
    </div>
  );
}

// ─── 5. Le grand compte ──────────────────────────────────────────────────────
// Plein cadre, un chiffre énorme, une ligne. Rien d'autre. C'est la piste la
// plus sûre et la plus « marque » : elle vieillit bien.
function PisteCompte() {
  const e = useEtape(1200);
  const pct = Math.round(((e + 1) / ETAPES.length) * 100);
  return (
    <div style={{ ...CADRE, background: "var(--forest, #0C2A1D)", placeItems: "stretch", paddingBottom: 0 }}>
      <div style={{ position: "relative", padding: "22px 24px", display: "grid", alignContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(245,240,232,.55)" }}>Klip compose</span>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: "var(--display, Archivo), system-ui", fontWeight: 800, fontSize: 92, lineHeight: .82, letterSpacing: "-0.05em", color: "#F5F0E8", fontVariantNumeric: "tabular-nums" }}>{pct}</span>
            <span style={{ fontFamily: "var(--display, Archivo), system-ui", fontWeight: 800, fontSize: 26, color: "var(--leaf, #BDF2A0)" }}>%</span>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 600, color: "rgba(245,240,232,.8)" }}>{ETAPES[e]}</p>
        </div>
        <div style={{ height: 2, background: "rgba(245,240,232,.16)", borderRadius: 2, overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${pct}%`, background: "var(--leaf, #BDF2A0)", transition: "width .5s cubic-bezier(.2,.8,.2,1)" }} />
        </div>
      </div>
    </div>
  );
}

// ─── 6. Le voile se lève ─────────────────────────────────────────────────────
// Le visuel existe déjà derrière un voile qui se retire par bandes. On ne
// montre pas une machine qui travaille, on montre l'image qui arrive.
function PisteVoile() {
  const e = useEtape(1100);
  const bandes = 6;
  return (
    <div style={{ ...CADRE, background: "var(--paper, #F5F0E8)" }}>
      <div style={{ position: "relative", width: 170, aspectRatio: "4/5", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 2px rgba(16,19,11,.10), 0 26px 50px -28px rgba(16,19,11,.5)" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(158deg,#2C5E43,#0C2A1D 62%)" }} />
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 16, display: "grid", gap: 7 }}>
          <span style={{ height: 15, width: "78%", borderRadius: 3, background: "#F5F0E8" }} />
          <span style={{ height: 7, width: "52%", borderRadius: 3, background: "rgba(245,240,232,.5)" }} />
          <span style={{ height: 15, width: "40%", borderRadius: 999, background: "var(--leaf, #BDF2A0)" }} />
        </div>
        {Array.from({ length: bandes }, (_, i) => (
          <span key={i} style={{
            position: "absolute", left: 0, right: 0, top: `${(i / bandes) * 100}%`, height: `${100 / bandes + 0.4}%`,
            background: "var(--paper, #F5F0E8)",
            transform: i <= (e + 1) * 1.4 ? "translateX(-101%)" : "translateX(0)",
            transition: `transform .7s cubic-bezier(.7,0,.2,1) ${i * 70}ms`,
          }} />
        ))}
      </div>
      <p style={{ position: "absolute", bottom: 16, margin: 0, fontSize: 12, fontWeight: 700, color: "var(--ink-2, #3C4034)" }}>{ETAPES[e]}</p>
    </div>
  );
}

const PISTES = [
  { id: 1, nom: "Le calque se pose", desc: "Le geste du produit, dépouillé. Une page, des blocs qui se posent, un filet de progression. Aucun curseur, aucune pastille.", C: PisteCalques },
  { id: 2, nom: "Bandeau typographique", desc: "Éditorial et bavard : l'étape en cours s'écrit en très gros et défile. On LIT le travail au lieu de regarder une animation.", C: PisteBandeau },
  { id: 3, nom: "La trame se range", desc: "La trame de points de la landing : les points grossissent et s'alignent pour dessiner la mise en page. Générative, silencieuse.", C: PisteTrame },
  { id: 4, nom: "Les cartes se distribuent", desc: "Les pistes de composition défilent comme un jeu de cartes qu'on étale. On comprend que l'IA en essaie plusieurs.", C: PisteCartes },
  { id: 5, nom: "Le grand compte", desc: "Plein cadre forêt, un chiffre énorme, une ligne, un filet. La plus sobre, la plus « marque », celle qui vieillit le mieux.", C: PisteCompte },
  { id: 6, nom: "Le voile se lève", desc: "Le visuel est déjà là, un voile se retire par bandes. On ne montre pas une machine qui travaille, on montre l'image qui arrive.", C: PisteVoile },
];

export default function BancChargement() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return (
    <main style={{ minHeight: "100vh", background: "var(--paper, #F5F0E8)", padding: "34px 30px 60px" }}>
      <h1 style={{ fontFamily: "var(--display, Archivo), system-ui", fontWeight: 800, fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 6px", color: "var(--ink, #14160F)" }}>
        Écran de chargement : six pistes
      </h1>
      <p style={{ fontSize: 13.5, color: "var(--ink-2, #3C4034)", margin: "0 0 28px", maxWidth: 640, lineHeight: 1.5 }}>
        Toutes tournent en vrai, au même rythme, avec les couleurs et les typos de la charte.
        Dites-moi le numéro qui vous parle, on l&apos;approfondit (rythme, textes, variantes plein écran).
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 24 }}>
        {PISTES.map(p => (
          <section key={p.id}>
            <p.C />
            <h2 style={{ fontFamily: "var(--display, Archivo), system-ui", fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em", margin: "12px 0 4px", color: "var(--ink, #14160F)" }}>
              {p.id}. {p.nom}
            </h2>
            <p style={{ fontSize: 12.5, color: "var(--ink-3, #6B6F63)", margin: 0, lineHeight: 1.5 }}>{p.desc}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
