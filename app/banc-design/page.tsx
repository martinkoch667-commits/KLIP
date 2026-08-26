"use client";

/* Banc d'essai du système de design : réservé au développement.
 *
 * Il rend LES CINQUANTE compositions avec la même machinerie que la production
 * (buildDesignElements → renderTemplateVisual), sur une charte bidon. C'est le
 * seul moyen de juger une bibliothèque de compositions : en la regardant en
 * planche contact, comme un feed. Les textes d'exemple sont volontairement
 * réalistes en longueur — un dessin qui ne tient qu'avec « Lorem » ne tient pas.
 */

import React, { useEffect, useState } from "react";
import { DESIGN_RECIPES, buildDesignElements, resolveFonts, slotCapacity, effectiveMax, recipeZone, type DesignRecipe } from "@/lib/designSystem";
import { renderTemplateVisual } from "@/lib/composeRender";
import { pickColorway } from "@/lib/colorway";

// Les chartes du banc portaient toutes `display: "Archivo"` : la typographie
// était donc la même sur les quatre colonnes, et le banc ne pouvait rien dire de
// l'identité typographique. Trois d'entre elles n'en déclarent plus — c'est le
// cas le plus fréquent en vrai — et toutes portent un secteur et un ton, qui
// sont ce qui choisit l'identité.
const CHARTES = [
  { nom: "Trattoria", primary: "#1B2FE8", secondary: "#F1EDE4", accent: "#F1EDE4", body: null, display: null, name: "AMICII", handle: "@amicii.ristorante", sector: "Restaurant", tone: "chaleureux, familial, authentique" },
  { nom: "Studio", primary: "#111111", secondary: "#F5F3EF", accent: "#F2542D", body: null, display: null, name: "ASTERISK", handle: "@asterisk.create", sector: "Autre", tone: "épuré, éditorial, pointu" },
  { nom: "Boisson", primary: "#7FE04A", secondary: "#FFE500", accent: "#FF3EA5", body: null, display: null, name: "UPGAS", handle: "@upgas", sector: "Retail", tone: "fun, décalé, énergique" },
  // Charte réelle de Pepe Chicken, relevée dans le produit : rouge, jaune, blanc,
  // Oswald 800 en titre et Satoshi en texte. L'accent déclaré est BLANC, donc
  // inutilisable comme repère — c'est le cas qui a fait disparaître les pastilles,
  // et c'est aussi le client sur lequel les visuels rejetés ont été produits.
  { nom: "Poulet", primary: "#FF4438", secondary: "#FFC600", accent: "#FFFFFF", display: "Oswald", body: "Satoshi", name: "PEPE CHICKEN", handle: "@pepechicken", sector: "Restaurant", tone: "direct, cash, percutant" },
];

// LES VRAIES PHOTOS DU CLIENT.
//
// Le banc jugeait les compositions sur une capture d'écran du site KLIP. Sur une
// image pareille tout paraît chargé, rien ne paraît calme, et on corrige des
// dessins qui n'avaient rien. Trois tours de corrections sont partis de là.
//
// Ces six-là viennent de Pepe Chicken et couvrent des cas OPPOSÉS, ce qui est
// tout l'intérêt : un dessin qui tient sur le plan produit et se casse sur la
// photo de téléphone n'est pas un bon dessin, c'est un dessin chanceux.
// (Locales et gitignorées : `public/banc-photos/`.)
const PHOTOS = [
  { id: "produit-sombre-1", label: "Produit / fond sombre", zone: "calme en haut, badge en haut à droite" },
  { id: "produit-sombre-2", label: "Produit / fond sombre 2", zone: "calme en haut, badge en haut à droite" },
  { id: "produit-carre", label: "Produit / carré", zone: "calme en haut et sur les côtés" },
  { id: "studio-box", label: "Box studio", zone: "calme en haut et en bas" },
  { id: "ugc-mains", label: "UGC / mains", zone: "chargé partout, clair" },
  { id: "ugc-visage", label: "UGC / visage", zone: "chargé partout, visage au centre" },
] as const;

const MOTS: Record<string, string[]> = {
  court: ["Ouvert", "Nouveau", "Ce soir", "Enfin", "Sans filtre", "Midi"],
  moyen: ["On ouvre le dimanche", "La carte change chaque semaine", "Trois places restantes"],
  long: ["On a arrêté de suivre les tendances, et c'est là que tout a changé pour nous.", "Chaque semaine, une nouvelle recette, cuisinée le matin même avec ce qu'on trouve au marché."],
};

function echantillon(cle: string, max: number, i: number): string {
  const pool = max <= 18 ? MOTS.court : max <= 60 ? MOTS.moyen : MOTS.long;
  if (/^p\d|prix/.test(cle)) return ["12€", "8,50€", "19€"][i % 3];
  if (cle === "chiffre") return ["+248%", "12", "4,9"][i % 3];
  if (cle === "date") return "12 OCT";
  if (cle === "heure") return "19H00";
  if (/^h\d/.test(cle)) return ["9h — 18h", "12h — 23h", "Fermé"][i % 3];
  if (/^j\d/.test(cle)) return ["Lundi au jeudi", "Vendredi", "Dimanche"][i % 3];
  // Même coupe que la production (`sanitizeFields`) : sur un mot, jamais dedans.
  const t = pool[i % pool.length];
  if (t.length <= max) return t;
  const coupe = t.slice(0, max + 1);
  const espace = coupe.lastIndexOf(" ");
  return (espace > max * 0.5 ? coupe.slice(0, espace) : t.slice(0, max)).replace(/[\s,;:.!?…-]+$/, "");
}

const COULEUR_ZONE: Record<string, string> = {
  haut: "#1a7f37", bas: "#0969da", centre: "#bf8700", partout: "#cf222e", "hors-photo": "#8250df",
};

function ZoneTag({ recipe }: { recipe: DesignRecipe }) {
  const z = recipeZone(recipe);
  return <span style={{ color: COULEUR_ZONE[z] ?? "#888", fontWeight: 700 }}> · {z}</span>;
}

function Vignette({ recipe, charte, w, h, photo }: { recipe: DesignRecipe; charte: typeof CHARTES[number]; w: number; h: number; photo: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const fields: Record<string, string> = {};
        // La longueur d'échantillon doit être celle que la PRODUCTION appliquera
        // (`sanitizeFields` coupe à `effectiveMax`), sinon le banc montre des
        // débordements que le vrai rendu n'a pas, et on corrige des dessins qui
        // n'ont rien.
        recipe.slots.forEach((s, i) => { fields[s.key] = echantillon(s.key, effectiveMax(recipe, s), i); });
        const elements = buildDesignElements(recipe, { fields, brand: charte, w, h, hasPhoto: recipe.photo !== "none" });
        const out = await renderTemplateVisual({ elements, sourceFormat: { w, h }, photoUrl: photo, w, h });
        if (vivant) setUrl(out);
      } catch (e) { if (vivant) setErr(String(e)); }
    })();
    return () => { vivant = false; };
  }, [recipe, charte, w, h, photo]);
  return (
    <figure style={{ margin: 0 }}>
      {url ? <img src={url} alt={recipe.name} style={{ width: "100%", display: "block", borderRadius: 6, background: "#eee" }} />
        : <div style={{ width: "100%", aspectRatio: `${w}/${h}`, background: "#eee", borderRadius: 6 }} />}
      <figcaption style={{ font: "500 11px/1.4 system-ui", color: "#555", marginTop: 6 }}>
        {recipe.name} <span style={{ color: "#aaa" }}>· {recipe.id}</span>
        {/* La zone est le premier filtre du compositeur : on la voit ici sous
            chaque vignette, sinon on ne peut pas juger si une composition est
            fausse pour LA photo affichée ou fausse en général. */}
        <ZoneTag recipe={recipe} />
        {err ? <span style={{ color: "#c00" }}> · {err}</span> : null}
      </figcaption>
    </figure>
  );
}

export default function BancDesign() {
  const [idx, setIdx] = useState(0);
  const [format, setFormat] = useState<[number, number]>([1080, 1350]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const photo = `/banc-photos/${PHOTOS[photoIdx].id}.jpg`;
  const charte = CHARTES[idx];
  return (
    <main style={{ padding: 24, background: "#fff", minHeight: "100vh" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, font: "600 13px system-ui", flexWrap: "wrap" }}>
        {CHARTES.map((c, i) => (
          <button key={c.nom} onClick={() => setIdx(i)} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #ddd", background: i === idx ? c.primary : "#fff", color: i === idx ? "#fff" : "#111", cursor: "pointer" }}>{c.nom}</button>
        ))}
        {([["4:5", [1080, 1350]], ["1:1", [1080, 1080]], ["9:16", [1080, 1920]]] as [string, [number, number]][]).map(([lbl, f]) => (
          <button key={lbl} onClick={() => setFormat(f)} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #ddd", background: format[1] === f[1] ? "#111" : "#fff", color: format[1] === f[1] ? "#fff" : "#111", cursor: "pointer" }}>{lbl}</button>
        ))}
        <span style={{ alignSelf: "center", color: "#888", fontWeight: 400 }}>
          {DESIGN_RECIPES.length} compositions ·{" "}
          {(["haut", "bas", "centre", "partout", "hors-photo"] as const)
            .map(z => `${DESIGN_RECIPES.filter(r => recipeZone(r) === z).length} ${z}`)
            .join(" · ")}
        </span>
      </div>
      {/* Le choix de la photo est le premier réglage du banc, avant la charte :
          c'est lui qui décide si une composition tient ou non. */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, font: "600 12.5px system-ui", flexWrap: "wrap", alignItems: "center" }}>
        {PHOTOS.map((ph, i) => (
          <button key={ph.id} onClick={() => setPhotoIdx(i)} title={ph.zone} style={{ padding: "5px 11px", borderRadius: 999, border: "1px solid #ddd", background: i === photoIdx ? "#111" : "#fff", color: i === photoIdx ? "#fff" : "#444", cursor: "pointer" }}>{ph.label}</button>
        ))}
        <span style={{ color: "#999", fontWeight: 400 }}>{PHOTOS[photoIdx].zone}</span>
      </div>
      {/* L'identité typographique retenue pour cette charte. Sans cette ligne, le
          banc montre bien que la typo change d'une colonne à l'autre, mais on ne
          peut pas dire LAQUELLE a été choisie ni pourquoi — donc on ne peut pas
          corriger un mauvais appariement. */}
      {/* AUDIT DE CAPACITÉ.
          Chaque slot annonce une longueur maximale, et l'IA écrit jusqu'à cette
          longueur. Mais le DESSIN, lui, a une capacité : sa colonne, son calibre
          et son nombre de lignes décident combien de caractères tiennent. Les
          deux ont été écrits séparément, donc ils divergent — un slot « max 24 »
          dans un titre d'affiche qui n'en tient que 16, et le texte sort rogné
          ou réduit au plancher. C'est la cause mécanique du « ça ne rend rien ».
          Le banc les compare : tant que cette liste n'est pas vide, des
          compositions rendront mal quoi qu'on fasse par ailleurs. */}
      {(() => {
        const ecarts: string[] = [];
        for (const r of DESIGN_RECIPES) {
          for (const sl of r.slots) {
            const cap = slotCapacity(r, sl.key);
            if (cap !== null && sl.max > cap * 1.08) ecarts.push(`${r.id}.${sl.key} : annoncé ${sl.max}, le dessin en tient ${cap}`);
          }
        }
        return ecarts.length === 0 ? null : (
          <details style={{ margin: "0 0 14px", font: "400 12px ui-monospace, monospace", color: "#777" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>{ecarts.length} slots que le dessin raccourcit</summary>
            <div style={{ marginTop: 6, lineHeight: 1.5 }}>
              <p style={{ color: "#555", maxWidth: 640 }}>
                Ces longueurs ne cassent plus rien : `effectiveMax` les ramène à la
                capacité du dessin avant de les annoncer à l’IA. La liste sert à
                repérer les recettes dont le `max` écrit à la main est trompeur.
              </p>
              {ecarts.map(e => <div key={e}>{e}</div>)}
            </div>
          </details>
        );
      })()}
      {(() => {
        const f = resolveFonts(charte);
        const t = pickColorway(charte);
        return (
          <>
            <p style={{ margin: "0 0 4px", font: "400 12.5px system-ui", color: "#555" }}>
              <b style={{ color: "#111" }}>{f.ident.name}</b> — {f.ident.note}
              <span style={{ color: "#999" }}>
                {"  ·  titre "}{f.display}{" · texte "}{f.body}{" · condensé "}{f.condensed}{" · serif "}{f.serif}{" · manuscrit "}{f.script}
              </span>
            </p>
            <p style={{ margin: "0 0 16px", font: "400 12.5px system-ui", color: "#555", display: "flex", alignItems: "center", gap: 6 }}>
              <b style={{ color: "#111" }}>{t.name}</b> — {t.note}
              {[t.paper, t.surface, t.ink, t.deep, t.accent].map(c => (
                <span key={c} title={c} style={{ width: 16, height: 16, borderRadius: 4, background: c, border: "1px solid #0002", display: "inline-block" }} />
              ))}
            </p>
          </>
        );
      })()}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 18 }}>
        {DESIGN_RECIPES.map(r => <Vignette key={`${r.id}-${idx}-${format[1]}-${photoIdx}`} recipe={r} charte={charte} w={format[0]} h={format[1]} photo={photo} />)}
      </div>
    </main>
  );
}
