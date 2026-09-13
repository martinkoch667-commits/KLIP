"use client";

/* Banc d'essai : variantes de la trame de points (piste 3 retenue).
 *
 * Le concept plaît — minimal, génératif, silencieux — mais le premier essai
 * était brut : gros points noirs, rectangle net, rythme mécanique. Les six
 * variantes ci-dessous gardent l'idée et changent le TRAITEMENT : taille des
 * points, couleur, forme du mouvement, ce qui se dessine.
 *
 * Règles communes : points fins, beaucoup d'air, encre à faible opacité,
 * le vert de la charte réservé à l'accent, easing lent.
 */

import React from "react";

const ETAPES = [
  "On lit votre photo",
  "La charte s'applique",
  "Le titre trouve sa place",
  "Les marges se recalent",
  "Les couleurs arrivent",
];

/** Horloge d'animation continue, en millisecondes depuis le montage. */
function useTemps() {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    let brut = 0;
    const debut = performance.now();
    const boucle = () => { setT(performance.now() - debut); brut = requestAnimationFrame(boucle); };
    brut = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(brut);
  }, []);
  return t;
}

function useEtape(periode = 1500) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setI(v => (v + 1) % ETAPES.length), periode);
    return () => clearInterval(id);
  }, [periode]);
  return i;
}

const CADRE: React.CSSProperties = {
  position: "relative", borderRadius: 18, overflow: "hidden",
  aspectRatio: "16/10", background: "var(--paper, #F5F0E8)",
};

function Legende({ texte, clair }: { texte: string; clair?: boolean }) {
  return (
    <p style={{
      position: "absolute", left: 0, right: 0, bottom: 15, margin: 0, textAlign: "center",
      fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
      color: clair ? "rgba(245,240,232,.62)" : "rgba(16,19,11,.45)",
    }}>{texte}</p>
  );
}

/** Grille de points : une seule mécanique, six rendus. */
function Trame({ col, lig, rendu, sombre }: {
  col: number; lig: number; sombre?: boolean;
  /** Pour chaque point : taille, opacité, couleur, arrondi, décalage. */
  rendu: (x: number, y: number, cx: number, cy: number) => { t: number; o: number; c?: string; r?: string; dx?: number; dy?: number };
}) {
  const points = React.useMemo(
    () => Array.from({ length: col * lig }, (_, i) => ({ x: i % col, y: Math.floor(i / col) })),
    [col, lig],
  );
  return (
    <div style={{ position: "absolute", inset: "12px 14px 38px" }}>
      {points.map((p, i) => {
        const cx = ((p.x + 0.5) / col) * 100;
        const cy = ((p.y + 0.5) / lig) * 100;
        const v = rendu(p.x, p.y, cx, cy);
        const t = Math.max(0, v.t);
        return (
          <span key={i} style={{
            position: "absolute", left: `${cx}%`, top: `${cy}%`,
            width: t, height: t, marginLeft: -t / 2 + (v.dx ?? 0), marginTop: -t / 2 + (v.dy ?? 0),
            borderRadius: v.r ?? "50%",
            background: v.c ?? (sombre ? "#F5F0E8" : "#14160F"),
            opacity: v.o,
            transition: "width .5s cubic-bezier(.2,.8,.2,1), height .5s cubic-bezier(.2,.8,.2,1), opacity .5s, background .5s, border-radius .5s, margin .5s cubic-bezier(.2,.8,.2,1)",
          }} />
        );
      })}
    </div>
  );
}

// ─── A. L'onde ───────────────────────────────────────────────────────────────
// Une crête traverse la trame en diagonale, les points enflent sur son passage.
// Rien ne se construit : ça respire. Le plus doux.
function VarianteOnde() {
  const t = useTemps();
  const e = useEtape();
  return (
    <div style={CADRE}>
      <Trame col={30} lig={17} rendu={(x, y) => {
        const phase = (x * 0.5 + y * 0.75) - (t / 260);
        const onde = (Math.sin(phase) + 1) / 2;
        return { t: 2 + onde * 4.2, o: 0.12 + onde * 0.5 };
      }} />
      <Legende texte={ETAPES[e]} />
    </div>
  );
}

// ─── B. Le champ ─────────────────────────────────────────────────────────────
// Deux foyers se déplacent lentement ; les points proches grossissent. Une
// forme organique apparaît puis se défait. Aucune géométrie, que de la matière.
function VarianteChamp() {
  const t = useTemps();
  const e = useEtape();
  const f1 = { x: 50 + Math.cos(t / 1700) * 26, y: 50 + Math.sin(t / 1300) * 18 };
  const f2 = { x: 50 + Math.cos(t / 900 + 2) * 30, y: 50 + Math.sin(t / 1500 + 1) * 20 };
  return (
    <div style={CADRE}>
      <Trame col={28} lig={16} rendu={(x, y, cx, cy) => {
        const d1 = Math.hypot(cx - f1.x, (cy - f1.y) * 0.7);
        const d2 = Math.hypot(cx - f2.x, (cy - f2.y) * 0.7);
        const force = Math.max(0, 1 - d1 / 34) + Math.max(0, 1 - d2 / 28) * 0.8;
        const f = Math.min(1, force);
        return { t: 2.2 + f * 5, o: 0.1 + f * 0.62, c: f > 0.72 ? "var(--leaf-ink, #1E3317)" : "#14160F" };
      }} />
      <Legende texte={ETAPES[e]} />
    </div>
  );
}

// ─── C. Les points deviennent des lignes ─────────────────────────────────────
// Chaque rangée s'étire en petits traits, comme des lignes de texte qui se
// posent. La plus proche du métier : on voit une mise en page se composer.
function VarianteLignes() {
  const e = useEtape(1200);
  return (
    <div style={CADRE}>
      <Trame col={26} lig={14} rendu={(x, y) => {
        const rangeeActive = 3 + e * 2;
        const pose = y <= rangeeActive;
        const largeur = y % 3 === 0 ? 20 : y % 3 === 1 ? 15 : 9;
        const dansLigne = x > 3 && x < 3 + largeur;
        if (pose && dansLigne) return { t: 4.4, o: y % 3 === 0 ? 0.9 : 0.45, r: "2px", c: "#14160F" };
        return { t: 2.4, o: 0.13 };
      }} />
      <Legende texte={ETAPES[e]} />
    </div>
  );
}

// ─── D. Le négatif ───────────────────────────────────────────────────────────
// La trame est pleine, et elle S'EFFACE pour laisser apparaître le visuel en
// creux. L'image naît du vide, pas de la matière.
function VarianteNegatif() {
  const e = useEtape(1250);
  return (
    <div style={{ ...CADRE, background: "var(--forest, #0C2A1D)" }}>
      <Trame col={30} lig={17} sombre rendu={(x, y) => {
        const dansPage = x > 8 && x < 21 && y > 1 && y < 15;
        const revele = dansPage && y <= 1 + (e + 1) * 3;
        return { t: revele ? 1.6 : 3.4, o: revele ? 0.1 : 0.5, c: "#F5F0E8" };
      }} />
      <Legende texte={ETAPES[e]} clair />
    </div>
  );
}

// ─── E. L'orbe ───────────────────────────────────────────────────────────────
// Les points quittent la grille pour un anneau qui tourne et respire. Pas de
// page, pas de maquette : un signal d'attente, net et abstrait.
function VarianteOrbe() {
  const t = useTemps();
  const e = useEtape();
  const N = 54;
  return (
    <div style={CADRE}>
      <div style={{ position: "absolute", inset: "12px 14px 38px" }}>
        {Array.from({ length: N }, (_, i) => {
          const a = (i / N) * Math.PI * 2;
          const pulse = (Math.sin(a * 3 - t / 320) + 1) / 2;
          const r = 27 + pulse * 3.5;
          const taille = 2.4 + pulse * 4;
          const avance = (i / N) <= (e + 1) / ETAPES.length;
          return (
            <span key={i} style={{
              position: "absolute",
              left: `${50 + Math.cos(a) * r * 0.62}%`, top: `${50 + Math.sin(a) * r}%`,
              width: taille, height: taille, marginLeft: -taille / 2, marginTop: -taille / 2,
              borderRadius: "50%",
              background: avance ? "var(--leaf-ink, #1E3317)" : "#14160F",
              opacity: avance ? 0.2 + pulse * 0.7 : 0.12,
              transition: "background .5s, opacity .5s",
            }} />
          );
        })}
      </div>
      <Legende texte={ETAPES[e]} />
    </div>
  );
}

// ─── F. L'aimantation ────────────────────────────────────────────────────────
// Les points sont dispersés et se rangent zone par zone. C'est la mise en
// ordre elle-même qui est le sujet.
function VarianteAimant() {
  const e = useEtape(1400);
  const bruit = React.useMemo(() => {
    let s = 7;
    return Array.from({ length: 30 * 17 }, () => {
      s = (s * 9301 + 49297) % 233280;
      const a = s / 233280;
      s = (s * 9301 + 49297) % 233280;
      return { dx: (a - 0.5) * 26, dy: (s / 233280 - 0.5) * 22 };
    });
  }, []);
  return (
    <div style={CADRE}>
      <Trame col={30} lig={17} rendu={(x, y) => {
        const i = y * 30 + x;
        const range = x <= 4 + (e + 1) * 5.5;
        const b = bruit[i] ?? { dx: 0, dy: 0 };
        return {
          t: range ? 3.6 : 3,
          o: range ? 0.62 : 0.16,
          dx: range ? 0 : b.dx, dy: range ? 0 : b.dy,
          c: range && x % 7 === 0 && y % 5 === 0 ? "var(--leaf-ink, #1E3317)" : "#14160F",
        };
      }} />
      <Legende texte={ETAPES[e]} />
    </div>
  );
}

const VARIANTES = [
  { id: "A", nom: "L'onde", desc: "Une crête traverse la trame en diagonale, les points enflent sur son passage. Rien ne se construit : ça respire. La plus douce, celle qui supporte le mieux une attente longue.", C: VarianteOnde },
  { id: "B", nom: "Le champ", desc: "Deux foyers se déplacent, les points proches grossissent. Une forme organique apparaît puis se défait. Aucune géométrie, que de la matière.", C: VarianteChamp },
  { id: "C", nom: "Les lignes se posent", desc: "Les points s'étirent en petits traits, rangée par rangée, comme des lignes de texte qui se calent. La plus proche du métier.", C: VarianteLignes },
  { id: "D", nom: "Le négatif", desc: "Sur fond forêt, la trame est pleine et s'efface pour laisser le visuel apparaître en creux. L'image naît du vide.", C: VarianteNegatif },
  { id: "E", nom: "L'orbe", desc: "Les points quittent la grille pour un anneau qui tourne et respire. Pas de page, pas de maquette : un signal d'attente, net et abstrait.", C: VarianteOrbe },
  { id: "F", nom: "L'aimantation", desc: "Les points sont dispersés et se rangent zone par zone. C'est la mise en ordre elle-même qui devient le sujet.", C: VarianteAimant },
];

export default function BancTrame() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return (
    <main style={{ minHeight: "100vh", background: "#FBFAF6", padding: "34px 30px 60px" }}>
      <h1 style={{ fontFamily: "var(--display, Archivo), system-ui", fontWeight: 800, fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 6px", color: "var(--ink, #14160F)" }}>
        La trame : six traitements
      </h1>
      <p style={{ fontSize: 13.5, color: "var(--ink-2, #3C4034)", margin: "0 0 28px", maxWidth: 680, lineHeight: 1.5 }}>
        Même concept, six styles. Points plus fins, encre à faible opacité, vert de la charte réservé à l&apos;accent,
        mouvements lents. Dites-moi la lettre, on la pousse.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 26 }}>
        {VARIANTES.map(v => (
          <section key={v.id}>
            <v.C />
            <h2 style={{ fontFamily: "var(--display, Archivo), system-ui", fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em", margin: "12px 0 4px", color: "var(--ink, #14160F)" }}>
              {v.id}. {v.nom}
            </h2>
            <p style={{ fontSize: 12.5, color: "var(--ink-3, #6B6F63)", margin: 0, lineHeight: 1.5 }}>{v.desc}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
