"use client";

/* Banc d'essai de la bibliothèque de formes : page de développement.
 *
 * La vignette du panneau est un SVG rendu par le navigateur ; le calque posé
 * sur le plan de travail, lui, est un tracé rejoué SUR UN CANEVAS par
 * `tracerForme`. Ce sont deux moteurs différents : une forme peut être juste
 * dans le panneau et fausse dans le visuel. Ce banc dessine donc chaque forme
 * des deux façons, côte à côte, avec un fond, un dégradé et des pointillés —
 * c'est le seul endroit où l'on voit l'écart s'il existe.
 */

import React, { useEffect, useRef } from "react";
import { FORMES, FAMILLES, boite, tracerForme, type Forme } from "@/lib/formes";
import { CONTEXTES_IA, TuilesCategories, BibliothequeFormes, BlocIA, VueTextures, VueIllustrations, VueIcones, VueStickers, VueOrnements, VueCadres, VueBadges, VueMotifs } from "@/components/PanneauElements";
import { detourerFondUni } from "@/lib/detourage";
import type { FamilleForme } from "@/lib/formes";

const CASE = 104;
const MARGE = 10;

export default function BancFormes() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <BancFormesDev />;
}

function Planche({ liste, degrade }: { liste: Forme[]; degrade: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colonnes = 6;
  const lignes = Math.ceil(liste.length / colonnes);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = colonnes * CASE * dpr;
    cv.height = lignes * CASE * dpr;
    cv.style.width = `${colonnes * CASE}px`;
    cv.style.height = `${lignes * CASE}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cv.width, cv.height);

    liste.forEach((f, i) => {
      const [vbW, vbH] = boite(f);
      const dispo = CASE - MARGE * 2;
      const ech = Math.min(dispo / vbW, dispo / vbH);
      const w = vbW * ech, h = vbH * ech;
      const cx = (i % colonnes) * CASE + (CASE - w) / 2;
      const cy = Math.floor(i / colonnes) * CASE + (CASE - h) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      tracerForme(ctx, f.d, [vbW, vbH], w, h);
      if (f.trait) {
        ctx.strokeStyle = "#0C2A1D";
        ctx.lineWidth = Math.max(1, f.trait * (h / vbH));
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (f.dash) ctx.setLineDash(f.dash.map(v => Math.max(0.01, v * (h / vbH))));
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (degrade) {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, "#2FD79B");
        g.addColorStop(1, "#0038FF");
        ctx.fillStyle = g;
        ctx.fill();
      } else {
        ctx.fillStyle = "#0C2A1D";
        ctx.fill();
      }
      ctx.restore();
    });
  }, [liste, colonnes, lignes, degrade]);

  return <canvas ref={ref} style={{ display: "block" }} />;
}

/* Détourage : on le juge sur une VRAIE sortie du modèle (un JPEG à fond
 * blanc), pas sur un aplat de synthèse, parce que c'est le bruit de
 * compression autour du sujet qui fait ou défait le résultat. Et on le regarde
 * SUR FOND SOMBRE : un liseré blanc ne se voit pas sur du blanc. */
function Detourage() {
  const [avant, setAvant] = React.useState<string | null>(null);
  const [apres, setApres] = React.useState<string | null>(null);
  const [part, setPart] = React.useState<number | null>(null);
  const [ms, setMs] = React.useState<number | null>(null);
  const traiter = React.useCallback(async (src: string) => {
    setAvant(src); setApres(null); setPart(null);
    const t0 = performance.now();
    const r = await detourerFondUni(src);
    if (r) { setApres(r.uri); setPart(r.part); setMs(Math.round(performance.now() - t0)); }
  }, []);
  React.useEffect(() => { void traiter("/banc-detourage2.jpg"); }, [traiter]);
  // Comparaison avec le modèle de segmentation (celui du bouton « Détourer »).
  const [ia, setIa] = React.useState<string | null>(null);
  const [iaMs, setIaMs] = React.useState<number | null>(null);
  const parIA = React.useCallback(async (src: string) => {
    setIa(null);
    const t0 = performance.now();
    const blob = await (await fetch(src)).blob();
    // @ts-expect-error import CDN dynamique sans types
    const mod = await import(/* webpackIgnore: true */ 'https://esm.sh/@imgly/background-removal@1.7.0');
    const removeBackground = mod.removeBackground || mod.default?.removeBackground || mod.default;
    const out: Blob = await removeBackground(blob);
    setIa(URL.createObjectURL(out));
    setIaMs(Math.round(performance.now() - t0));
  }, []);
  const damier = "repeating-conic-gradient(#e9e9e6 0% 25%, #ffffff 0% 50%) 50% / 16px 16px";
  return (
    <div style={{ width: 330, background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,.06)" }}>
      <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".1em", color: "#666", margin: "0 0 10px" }}>Détourage du fond</p>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {["/banc-detourage.jpg", "/banc-detourage2.jpg"].map((u, i) => (
          <button key={u} onClick={() => void traiter(u)} style={{ fontSize: 11, padding: "4px 9px", borderRadius: 20, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>
            Témoin {i + 1}
          </button>
        ))}
        <input type="file" accept="image/*" onChange={e => {
          const f = e.target.files?.[0]; if (!f) return;
          const fr = new FileReader(); fr.onload = () => void traiter(String(fr.result)); fr.readAsDataURL(f);
        }} style={{ fontSize: 10, width: 120 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {avant && <img src={avant} alt="avant" style={{ width: "100%", borderRadius: 8, display: "block" }} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {apres && <img src={apres} alt="sur damier" style={{ width: "100%", borderRadius: 8, display: "block", background: damier }} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {apres && <img src={apres} alt="sur sombre" style={{ width: "100%", borderRadius: 8, display: "block", background: "#0C2A1D" }} />}
      </div>
      <p style={{ fontSize: 11, color: "#666", margin: "8px 0 0" }}>
        {part === null ? "…" : `${(part * 100).toFixed(1)} % retirés · ${ms} ms`}
      </p>
      <button onClick={() => avant && void parIA(avant)} style={{ marginTop: 8, fontSize: 11, padding: "5px 10px", borderRadius: 20, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>
        Comparer au modèle IA
      </button>
      {ia && <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ia} alt="modèle IA" style={{ width: "100%", borderRadius: 8, marginTop: 8, background: "#0C2A1D" }} />
        <p style={{ fontSize: 11, color: "#666", margin: "6px 0 0" }}>modèle IA · {iaMs} ms</p>
      </>}
    </div>
  );
}

function BancFormesDev() {
  const [degrade, setDegrade] = React.useState(false);
  // Le panneau tel qu'il apparaît dans l'éditeur, monté seul : c'est le seul
  // moyen de le regarder sans ouvrir un projet.
  const [couleur, setCouleur] = React.useState("#14160F");
  const [query, setQuery] = React.useState("");
  const [tout, setTout] = React.useState<FamilleForme | null>(null);
  const [pose, setPose] = React.useState<string[]>([]);
  const [ornCat, setOrnCat] = React.useState<"fleches" | "traits" | "eclats" | "rubans" | "bulles" | "formes">("fleches");
  const [iconQ, setIconQ] = React.useState("");
  const [illuQ, setIlluQ] = React.useState("");
  const [banqueQ, setBanqueQ] = React.useState("");
  const [iaDetourer, setIaDetourer] = React.useState(true);
  const [matQ, setMatQ] = React.useState("paper texture");
  const [matLoad, setMatLoad] = React.useState(false);
  const [matItems, setMatItems] = React.useState<{ id: string; thumb: string; full: string; alt: string }[]>([]);
  const chercherMat = React.useCallback(async (q: string) => {
    setMatLoad(true);
    try {
      const d = await (await fetch(`/api/pexels?query=${encodeURIComponent(q || "texture")}`)).json();
      type Photo = { id: number | string; alt?: string; src: { medium: string; large: string } };
      setMatItems(((d?.photos ?? []) as Photo[]).map(p => ({ id: String(p.id), thumb: p.src.medium, full: p.src.large, alt: p.alt ?? "" })));
    } finally { setMatLoad(false); }
  }, []);
  React.useEffect(() => { void chercherMat("paper texture"); }, [chercherMat]);
  // Le banc n'a pas de session, donc pas d'appel au modèle : on rejoue la
  // chaîne avec les deux témoins, ce qui suffit à juger l'attente, la grille
  // de propositions et le rendu détouré.
  const [iaEncours, setIaEncours] = React.useState(false);
  const [iaEtape, setIaEtape] = React.useState<string | null>(null);
  const [iaVariantes, setIaVariantes] = React.useState<{ uri: string; detoure: boolean }[]>([]);
  const simulerIA = React.useCallback(async () => {
    setIaEncours(true); setIaVariantes([]); setIaEtape("Quatre propositions en cours…");
    await new Promise(r => setTimeout(r, 1200));
    setIaEtape("Détourage du fond…");
    const sources = ["/banc-detourage.jpg", "/banc-detourage2.jpg", "/banc-detourage.jpg", "/banc-detourage2.jpg"];
    const out = await Promise.all(sources.map(async src => {
      if (!iaDetourer) return { uri: src, detoure: false };
      const r = await detourerFondUni(src);
      return { uri: r && r.part >= 0.05 ? r.uri : src, detoure: !!r && r.part >= 0.05 };
    }));
    setIaVariantes(out); setIaEncours(false); setIaEtape(null);
  }, [iaDetourer]);
  return (
    <main style={{ fontFamily: "system-ui", padding: 22, background: "#F5F0E8", minHeight: "100vh" }}>
      <section style={{ display: "flex", gap: 24, alignItems: "flex-start", marginBottom: 30, flexWrap: "wrap" }}>
        <Detourage />
        <div style={{ width: 330, background: "var(--paper, #fff)", borderRadius: 14, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,.06)" }}>
          <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".1em", color: "#666", margin: "0 0 12px" }}>Accueil du panneau</p>
          <TuilesCategories onChoisir={id => setPose(p => [...p, `catégorie : ${id}`])} />
        </div>
        <div style={{ width: 330, maxHeight: 760, overflow: "auto", background: "var(--paper, #fff)", borderRadius: 14, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,.06)" }}>
          <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".1em", color: "#666", margin: "0 0 12px" }}>Catégorie « Formes »</p>
          <BibliothequeFormes couleur={couleur} setCouleur={setCouleur} query={query} setQuery={setQuery}
            tout={tout} setTout={setTout} charte={["#2FD79B", "#0C2A1D", "#FFC600"]}
            onPoser={f => setPose(p => [...p, f.nom])} />
        </div>
        <div style={{ width: 330, maxHeight: 760, overflow: "auto", background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,.06)" }}>
          <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".1em", color: "#666", margin: "0 0 12px" }}>Les autres familles</p>
          <VueCadres onGrille={g => setPose(p => [...p, `grille ${g.nom}`])} format={0.8} />
          <div style={{ height: 18 }} />
          <VueTextures surSelection={false} onPoser={t => setPose(p => [...p, t.nom])}
            banque={{ query: matQ, setQuery: setMatQ, chercher: q => void chercherMat(q), chargement: matLoad, items: matItems, onPoser: u => setPose(p => [...p, u.slice(0, 30)]) }} />
          <div style={{ height: 18 }} />
          <VueBadges couleur="#0038FF" onPoser={t => setPose(p => [...p, t])} />
          <div style={{ height: 18 }} />
          <VueMotifs couleur={couleur} setCouleur={setCouleur} charte={["#2FD79B", "#0C2A1D"]} onPoser={() => setPose(p => [...p, "motif"])} />
          <div style={{ height: 18 }} />
          <VueStickers couleur={couleur} setCouleur={setCouleur} charte={["#2FD79B", "#0C2A1D"]}
            onPoser={s => setPose(p => [...p, s.name])} onVoirTout={() => setPose(p => [...p, "toute la bibliothèque"])} />
          <div style={{ height: 18 }} />
          <VueOrnements cat={ornCat} setCat={setOrnCat} couleur={couleur} setCouleur={setCouleur} charte={["#2FD79B"]}
            urlOrnement={(id, c) => `/api/ornement?id=${id}&color=${encodeURIComponent(c)}`}
            onPoser={id => setPose(p => [...p, id])} />
          <div style={{ height: 18 }} />
          <VueIcones query={iconQ} setQuery={setIconQ} chercher={() => { /* le banc n'appelle pas l'API */ }}
            chargement={false} resultats={[]} couleur={couleur} setCouleur={setCouleur} charte={["#2FD79B"]}
            urlIcone={(n, c, h) => `https://api.iconify.design/${n.replace(":", "/")}.svg?height=${h}&color=${encodeURIComponent(c)}`}
            onPoser={n => setPose(p => [...p, n])} />
          <div style={{ height: 18 }} />
          <BlocIA ia={{ contexte: CONTEXTES_IA.illustrations, prompt: illuQ, setPrompt: setIlluQ, detourer: iaDetourer, setDetourer: setIaDetourer,
            lancer: () => void simulerIA(), encours: iaEncours, etape: iaEtape, erreur: null,
            variantes: iaVariantes, poser: (u: string) => setPose(p => [...p, "posé " + u.slice(0, 24)]) }} />
          <div style={{ height: 18 }} />
          <VueIllustrations
            banque={{ kind: "illustration", setKind: () => {}, tout: false, setTout: () => {},
              query: banqueQ, setQuery: setBanqueQ, chercher: () => {}, encore: false, suite: () => {},
              items: [], chargement: false, note: null, onPoser: () => {} }} />
        </div>
        <div style={{ fontSize: 12, color: "#666", maxWidth: 220 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 700 }}>Derniers clics</p>
          {pose.slice(-12).reverse().map((n, i) => <div key={i}>{n}</div>)}
        </div>
      </section>
      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Banc des formes : {FORMES.length} tracés</h1>
      <p style={{ fontSize: 12.5, color: "#666", margin: "0 0 14px" }}>
        À gauche la vignette du panneau (SVG), à droite le tracé rejoué sur canevas comme dans l&apos;éditeur.
        Les deux doivent être identiques.
      </p>
      <label style={{ fontSize: 12.5, display: "inline-flex", gap: 6, alignItems: "center", marginBottom: 16 }}>
        <input type="checkbox" checked={degrade} onChange={e => setDegrade(e.target.checked)} />
        Remplir en dégradé
      </label>
      {FAMILLES.map(fam => {
        const liste = FORMES.filter(f => f.famille === fam.id);
        if (!liste.length) return null;
        return (
          <section key={fam.id} style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".1em", color: "#666", margin: "0 0 8px" }}>
              {fam.label} ({liste.length})
            </h2>
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(6, ${CASE}px)`, background: "#fff", borderRadius: 10 }}>
                {liste.map(f => {
                  const [w, h] = boite(f);
                  const m = f.trait ?? 0;
                  return (
                    <div key={f.id} style={{ width: CASE, height: CASE, display: "grid", placeItems: "center", padding: MARGE, boxSizing: "border-box" }} title={f.nom}>
                      <svg viewBox={`${-m} ${-m} ${w + m * 2} ${h + m * 2}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
                        {f.trait
                          ? <path d={f.d} fill="none" stroke="#0C2A1D" strokeWidth={f.trait} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={f.dash ? f.dash.join(" ") : undefined} />
                          : <path d={f.d} fill="#0C2A1D" />}
                      </svg>
                    </div>
                  );
                })}
              </div>
              <div style={{ background: "#fff", borderRadius: 10 }}>
                <Planche liste={liste} degrade={degrade} />
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
