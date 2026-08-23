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
import { DESIGN_RECIPES, buildDesignElements, type DesignRecipe } from "@/lib/designSystem";
import { renderTemplateVisual } from "@/lib/composeRender";

const CHARTES = [
  { nom: "Trattoria", primary: "#1B2FE8", secondary: "#F1EDE4", accent: "#F1EDE4", display: "Archivo", body: "Archivo", name: "AMICII", handle: "@amicii.ristorante" },
  { nom: "Studio", primary: "#111111", secondary: "#F5F3EF", accent: "#F2542D", display: "Archivo", body: "Archivo", name: "ASTERISK", handle: "@asterisk.create" },
  { nom: "Boisson", primary: "#7FE04A", secondary: "#FFE500", accent: "#FF3EA5", display: "Archivo", body: "Archivo", name: "UPGAS", handle: "@upgas" },
  // Charte réelle d'un client : l'accent déclaré est BLANC, donc inutilisable
  // comme repère. C'est le cas qui a fait disparaître les pastilles.
  { nom: "Poulet", primary: "#FF4438", secondary: "#FFC600", accent: "#FFFFFF", display: "Oswald", body: "Archivo", name: "PEPE CHICKEN", handle: "@pepechicken" },
];

// Photo de démonstration : une image locale suffit, l'objet du banc est le dessin.
const PHOTO = "/klip-media/hero-site.jpg";

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
  const t = pool[i % pool.length];
  return t.length > max ? t.slice(0, max) : t;
}

function Vignette({ recipe, charte, w, h }: { recipe: DesignRecipe; charte: typeof CHARTES[number]; w: number; h: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const fields: Record<string, string> = {};
        recipe.slots.forEach((s, i) => { fields[s.key] = echantillon(s.key, s.max, i); });
        const elements = buildDesignElements(recipe, { fields, brand: charte, w, h, hasPhoto: recipe.photo !== "none" });
        const out = await renderTemplateVisual({ elements, sourceFormat: { w, h }, photoUrl: PHOTO, w, h });
        if (vivant) setUrl(out);
      } catch (e) { if (vivant) setErr(String(e)); }
    })();
    return () => { vivant = false; };
  }, [recipe, charte, w, h]);
  return (
    <figure style={{ margin: 0 }}>
      {url ? <img src={url} alt={recipe.name} style={{ width: "100%", display: "block", borderRadius: 6, background: "#eee" }} />
        : <div style={{ width: "100%", aspectRatio: `${w}/${h}`, background: "#eee", borderRadius: 6 }} />}
      <figcaption style={{ font: "500 11px/1.4 system-ui", color: "#555", marginTop: 6 }}>
        {recipe.name} <span style={{ color: "#aaa" }}>· {recipe.id}</span>
        {err ? <span style={{ color: "#c00" }}> · {err}</span> : null}
      </figcaption>
    </figure>
  );
}

export default function BancDesign() {
  const [idx, setIdx] = useState(0);
  const [format, setFormat] = useState<[number, number]>([1080, 1350]);
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
        <span style={{ alignSelf: "center", color: "#888", fontWeight: 400 }}>{DESIGN_RECIPES.length} compositions</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 18 }}>
        {DESIGN_RECIPES.map(r => <Vignette key={`${r.id}-${idx}-${format[1]}`} recipe={r} charte={charte} w={format[0]} h={format[1]} />)}
      </div>
    </main>
  );
}
