"use client";

/* Banc du juge de rendu : réservé au développement.
 *
 * Il pose LA question qui décide si on peut montrer des visuels générés à un
 * inconnu : est-ce que `/api/visual-qa` en mode `jugement` sait dire « c'est
 * bon » ? Mesuré le 2026-09-03, l'ancienne consigne ne le savait pas — un
 * témoin propre récoltait deux défauts inventés, aux deux paliers de qualité,
 * parce que la consigne finissait par « corrige TOUT ce qui peut être amélioré ».
 *
 * Le protocole est donc celui d'un contrôle, pas d'une démonstration :
 *  · des TÉMOINS PROPRES — des compositions rendues telles que la production
 *    les produit. Le juge DOIT répondre « garder », sans défaut ;
 *  · des DÉFAUTS PLANTÉS — la même composition avec un texte collé au bord
 *    (8 px, celui que le palier rapide ne voyait pas) et un texte posé sur un
 *    autre. Le juge DOIT répondre « rejeter », avec la bonne cause.
 *
 * Un juge qui garde tout est aussi inutile qu'un juge qui rejette tout : ce
 * sont les DEUX colonnes qui valident, jamais une seule.
 */

import React, { useCallback, useState } from "react";
import {
  DESIGN_RECIPES, buildDesignElements, effectiveMax, recipeZone, type DesignRecipe,
} from "@/lib/designSystem";
import { renderTemplateVisual } from "@/lib/composeRender";
import { echantillon } from "@/lib/bancTextes";

// Charte réelle de Pepe Chicken : c'est le client sur lequel les visuels
// rejetés ont été produits, donc le seul juge utile.
const CHARTE = {
  primary: "#FF4438", secondary: "#FFC600", accent: "#FFFFFF",
  display: "Oswald", body: "Satoshi",
  name: "PEPE CHICKEN", handle: "@pepechicken",
  sector: "Restaurant", tone: "direct, cash, percutant",
};

const CHARTE_JUGE = {
  name: CHARTE.name, sector: CHARTE.sector, tone: CHARTE.tone,
  colors: [CHARTE.primary, CHARTE.secondary, CHARTE.accent],
  fonts: [CHARTE.display, CHARTE.body],
};

// Mesuré sur ce compte (voir lib/brandDNA.ts et la note du 2026-09-01).
const ADN = {
  register: "grotesque condensée, capitales lourdes",
  textOnPhoto: "souvent",
  vibes: ["audacieux", "chaleureux"],
  motifs: ["pastille de prix", "badge de marque en haut à droite"],
};

const PHOTOS = [
  { id: "produit-sombre-1", label: "Produit / fond sombre" },
  { id: "produit-carre", label: "Produit / carré" },
  { id: "ugc-visage", label: "UGC / visage" },
];


type Verdict = {
  verdict: "garder" | "rejeter";
  charte: { ok: boolean; note: string };
  adn: { ok: boolean; note: string };
  fil: { ok: boolean; note: string };
  tenue: { ok: boolean; note: string };
  defauts: string[];
};

type Cas = {
  cle: string;
  recette: DesignRecipe;
  sabotage: "aucun" | "bord" | "chevauchement";
  image: string | null;
  verdict: Verdict | null;
  erreur: string | null;
  ms: number | null;
};

const W = 1080, H = 1350;

/** Colle le premier texte à 8 px du bord gauche : le défaut que le palier
 *  rapide ne voyait pas. */
function saboteBord(els: Record<string, unknown>[]): Record<string, unknown>[] {
  let fait = false;
  return els.map(e => {
    if (!fait && e.type === "text") { fait = true; return { ...e, x: 8 }; }
    return e;
  });
}

/** Pose le deuxième texte exactement sur le premier : chevauchement ACCIDENTEL,
 *  celui qui doit être vu, par opposition aux deux calques d'un autocollant. */
function saboteChevauchement(els: Record<string, unknown>[]): Record<string, unknown>[] {
  const textes = els.filter(e => e.type === "text");
  if (textes.length < 2) return els;
  const premier = textes[0] as { x?: number; y?: number };
  let n = 0;
  return els.map(e => {
    if (e.type !== "text") return e;
    n += 1;
    return n === 2 ? { ...e, x: premier.x ?? 0, y: (premier.y as number ?? 0) + 6 } : e;
  });
}

export default function BancJuge() {
  const [photo, setPhoto] = useState(PHOTOS[0].id);
  const [combien, setCombien] = useState(4);
  const [cas, setCas] = useState<Cas[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [motif, setMotif] = useState<string | null>(null);

  const lancer = useCallback(async () => {
    setEnCours(true);
    setMotif(null);

    // Toujours les mêmes recettes d'un tour à l'autre : un banc qui tire au sort
    // ne permet pas de comparer deux versions de la consigne.
    const avecPhoto = DESIGN_RECIPES.filter(r => r.photo !== "none");
    const choisies = avecPhoto.slice(0, combien);

    const prepares: Cas[] = [];
    for (const r of choisies) {
      prepares.push({ cle: `${r.id}-propre`, recette: r, sabotage: "aucun", image: null, verdict: null, erreur: null, ms: null });
    }
    // Deux sabotages sur la PREMIÈRE recette : même dessin, donc la seule
    // variable est le défaut.
    if (choisies[0]) {
      prepares.push({ cle: `${choisies[0].id}-bord`, recette: choisies[0], sabotage: "bord", image: null, verdict: null, erreur: null, ms: null });
      prepares.push({ cle: `${choisies[0].id}-chev`, recette: choisies[0], sabotage: "chevauchement", image: null, verdict: null, erreur: null, ms: null });
    }
    setCas(prepares);

    const photoUrl = `/banc-photos/${photo}.jpg`;

    for (let i = 0; i < prepares.length; i++) {
      const c = prepares[i];
      try {
        const fields: Record<string, string> = {};
        c.recette.slots.forEach((s, k) => { fields[s.key] = echantillon(s.key, effectiveMax(c.recette, s), k); });
        let els = buildDesignElements(c.recette, {
          fields, brand: CHARTE, w: W, h: H, hasPhoto: c.recette.photo !== "none",
        }) as Record<string, unknown>[];
        if (c.sabotage === "bord") els = saboteBord(els);
        if (c.sabotage === "chevauchement") els = saboteChevauchement(els);

        const image = await renderTemplateVisual({ elements: els, sourceFormat: { w: W, h: H }, photoUrl, w: W, h: H });
        setCas(prev => prev.map(p => p.cle === c.cle ? { ...p, image } : p));
        if (!image) throw new Error("rendu vide");

        const t0 = performance.now();
        const res = await fetch("/api/visual-qa", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "jugement", image, stageW: W, stageH: H,
            charte: CHARTE_JUGE, adn: ADN,
            recette: { id: c.recette.id, name: c.recette.name, family: c.recette.family, zone: recipeZone(c.recette) },
          }),
        });
        const ms = Math.round(performance.now() - t0);
        if (res.status === 401) { setMotif("Session requise : ouvrez une session sur ce navigateur, la route de jugement est protégée."); setEnCours(false); return; }
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        setCas(prev => prev.map(p => p.cle === c.cle ? { ...p, verdict: data as Verdict, ms } : p));
      } catch (e) {
        setCas(prev => prev.map(p => p.cle === c.cle ? { ...p, erreur: String(e) } : p));
      }
    }
    setEnCours(false);
  }, [photo, combien]);

  const propres = cas.filter(c => c.sabotage === "aucun" && c.verdict);
  const sabotes = cas.filter(c => c.sabotage !== "aucun" && c.verdict);
  const propresGardes = propres.filter(c => c.verdict!.verdict === "garder").length;
  const sabotesRejetes = sabotes.filter(c => c.verdict!.verdict === "rejeter").length;

  return (
    <main style={{ font: "400 14px/1.55 system-ui", padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ font: "800 22px/1.2 system-ui", margin: "0 0 6px" }}>Banc du juge de rendu</h1>
      <p style={{ color: "#555", margin: "0 0 18px", maxWidth: 760 }}>
        Le juge doit GARDER les témoins propres et REJETER les défauts plantés. Les deux
        colonnes valident ensemble : un juge qui garde tout ne sert à rien, un juge qui
        rejette tout non plus.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
        <label>Photo{" "}
          <select value={photo} onChange={e => setPhoto(e.target.value)}>
            {PHOTOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label>Témoins propres{" "}
          <select value={combien} onChange={e => setCombien(Number(e.target.value))}>
            {[2, 4, 6, 8].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button onClick={() => void lancer()} disabled={enCours}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: enCours ? "wait" : "pointer", background: "#0C2A1D", color: "#fff", fontWeight: 700 }}>
          {enCours ? "Jugement en cours…" : "Lancer"}
        </button>
      </div>

      {motif && <p style={{ background: "#FDECEA", border: "1px solid #F5C2BE", borderRadius: 8, padding: "10px 13px", color: "#9B2C1F" }}>{motif}</p>}

      {(propres.length > 0 || sabotes.length > 0) && (
        <div style={{ display: "flex", gap: 20, margin: "0 0 20px", font: "700 14px system-ui" }}>
          <span style={{ color: propresGardes === propres.length ? "#1a7f37" : "#cf222e" }}>
            Témoins propres gardés : {propresGardes} / {propres.length}
          </span>
          <span style={{ color: sabotes.length && sabotesRejetes === sabotes.length ? "#1a7f37" : "#cf222e" }}>
            Défauts plantés rejetés : {sabotesRejetes} / {sabotes.length}
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
        {cas.map(c => (
          <figure key={c.cle} style={{ margin: 0, border: "1px solid #e3e3e0", borderRadius: 10, padding: 12 }}>
            <div style={{ font: "700 11px system-ui", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8,
              color: c.sabotage === "aucun" ? "#1a7f37" : "#cf222e" }}>
              {c.sabotage === "aucun" ? "témoin propre" : c.sabotage === "bord" ? "défaut planté · texte collé au bord" : "défaut planté · textes superposés"}
            </div>
            {c.image
              ? <img src={c.image} alt="" style={{ width: "100%", display: "block", borderRadius: 6, background: "#eee" }} />
              : <div style={{ width: "100%", aspectRatio: `${W}/${H}`, background: "#eee", borderRadius: 6 }} />}
            <figcaption style={{ marginTop: 10 }}>
              <div style={{ font: "600 12px system-ui", color: "#666" }}>
                {c.recette.name} <span style={{ color: "#aaa" }}>· {c.recette.id}</span>
              </div>
              {c.erreur && <p style={{ color: "#cf222e", fontSize: 12 }}>{c.erreur}</p>}
              {c.verdict && (
                <>
                  <div style={{ margin: "8px 0", font: "800 14px system-ui",
                    color: c.verdict.verdict === "garder" ? "#1a7f37" : "#cf222e" }}>
                    {c.verdict.verdict === "garder" ? "GARDER" : "REJETER"}
                    <span style={{ font: "500 11px system-ui", color: "#999" }}> · {c.ms} ms</span>
                  </div>
                  {([["charte", c.verdict.charte], ["adn", c.verdict.adn], ["fil", c.verdict.fil], ["tenue", c.verdict.tenue]] as const).map(([nom, v]) => (
                    <div key={nom} style={{ fontSize: 12, color: "#444", marginBottom: 3 }}>
                      <span style={{ color: v.ok ? "#1a7f37" : "#cf222e", fontWeight: 800 }}>{v.ok ? "✓" : "✗"}</span>{" "}
                      <b>{nom}</b>{v.note ? ` — ${v.note}` : ""}
                    </div>
                  ))}
                  {c.verdict.defauts.length > 0 && (
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: "#cf222e" }}>
                      {c.verdict.defauts.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  )}
                </>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
