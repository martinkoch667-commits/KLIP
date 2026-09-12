"use client";

/* Banc du CATALOGUE : le taux de « montrable sans retouche ».
 *
 * CE QU'IL MESURE, ET EN QUOI IL DIFFÈRE DU BANC DU JUGE.
 * `/banc-juge` mesure LE JUGE : sait-il dire « c'est bon » et « c'est mauvais » ?
 * Il prend pour ça les 8 premières recettes du fichier et des défauts plantés.
 * C'est un contrôle d'instrument, pas une mesure du produit.
 *
 * Celui-ci mesure LE CATALOGUE, avec l'instrument validé par l'autre. Il tire
 * le VRAI vivier (`pickDesignCandidates`, celui que `compose-layout` utilise),
 * sur une VRAIE charte, le rend comme la production le rend, et demande au juge
 * si c'est montrable. Le chiffre qui sort est celui qui manquait pour dire si
 * une étape du chantier fait progresser quoi que ce soit.
 *
 * LA GRAINE EST FIXE, et c'est ce qui en fait un banc. Un tirage au sort donne
 * un chiffre différent à chaque tour et ne permet de comparer aucune version à
 * aucune autre. Changer la graine change l'échantillon, pas la méthode.
 *
 * CE QU'IL NE MESURE PAS, et il faut le dire : le CHOIX de l'IA. Il juge tout le
 * vivier, pas les trois compositions que le modèle aurait retenues. C'est
 * volontaire — on veut savoir ce que vaut le rayon, pas ce que vaut le vendeur.
 * Un vivier à 80 % montrable et un modèle qui choisit bien ne donnent pas le
 * même produit qu'un vivier à 40 % où le modèle sauve les meubles.
 */

import React, { useCallback, useState } from "react";
import {
  pickDesignCandidates, buildDesignElements, effectiveMax, recipeZone, type DesignRecipe,
} from "@/lib/designSystem";
import { renderTemplateVisual } from "@/lib/composeRender";
import { remplirSlots } from "@/lib/bancTextes";

// Charte réelle de Pepe Chicken : le client sur lequel les visuels rejetés ont
// été produits, donc le seul juge utile. Même charte que `/banc-juge`, pour que
// les deux bancs parlent de la même marque.
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
const ADN = {
  register: "grotesque condensée, capitales lourdes",
  textOnPhoto: "souvent",
  vibes: ["audacieux", "chaleureux"],
  motifs: ["pastille de prix", "badge de marque en haut à droite"],
};

const GRAINE = 20260910;
const W = 1080, H = 1350;

const PHOTOS = [
  { id: "produit-sombre-1", label: "Produit / fond sombre" },
  { id: "produit-carre", label: "Produit / carré" },
  { id: "ugc-visage", label: "UGC / visage" },
];


type Cas = {
  recette: DesignRecipe;
  photo: string;
  image: string | null;
  verdict: "garder" | "rejeter" | null;
  defauts: string[];
  erreur: string | null;
};

export default function BancCatalogue() {
  const [combien, setCombien] = useState(12);
  const [cas, setCas] = useState<Cas[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [motif, setMotif] = useState<string | null>(null);
  const [fini, setFini] = useState(false);

  const lancer = useCallback(async () => {
    setEnCours(true); setMotif(null); setFini(false);

    // LE VRAI VIVIER, celui que `compose-layout` sert au client : même fonction,
    // mêmes options. Prendre les N premières du fichier, comme fait l'autre banc,
    // mesurerait l'ordre d'écriture des recettes et rien d'autre.
    const vivier = pickDesignCandidates({
      hasPhoto: true, sector: CHARTE.sector, count: combien, seed: GRAINE,
    });

    const prepares: Cas[] = vivier.map((r, i) => ({
      recette: r, photo: PHOTOS[i % PHOTOS.length].id,
      image: null, verdict: null, defauts: [], erreur: null,
    }));
    setCas(prepares);

    for (const c of prepares) {
      try {
        const fields = remplirSlots(c.recette.slots, s => effectiveMax(c.recette, s));
        const els = buildDesignElements(c.recette, {
          fields, brand: CHARTE, w: W, h: H, hasPhoto: true,
        }) as Record<string, unknown>[];

        const image = await renderTemplateVisual({
          elements: els, sourceFormat: { w: W, h: H },
          photoUrl: `/banc-photos/${c.photo}.jpg`, w: W, h: H,
        });
        setCas(prev => prev.map(p => p.recette.id === c.recette.id ? { ...p, image } : p));
        if (!image) throw new Error("rendu vide");

        const res = await fetch("/api/visual-qa", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "jugement", image, stageW: W, stageH: H,
            charte: CHARTE_JUGE, adn: ADN,
            recette: { id: c.recette.id, name: c.recette.name, family: c.recette.family, zone: recipeZone(c.recette) },
          }),
        });
        if (res.status === 401) {
          setMotif("Session requise : connectez-vous sur ce navigateur, la route de jugement est protégée.");
          setEnCours(false); return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        setCas(prev => prev.map(p => p.recette.id === c.recette.id
          ? { ...p, verdict: data.verdict, defauts: Array.isArray(data.defauts) ? data.defauts : [] } : p));
      } catch (e) {
        setCas(prev => prev.map(p => p.recette.id === c.recette.id ? { ...p, erreur: String(e) } : p));
      }
    }
    setEnCours(false); setFini(true);
  }, [combien]);

  const juges = cas.filter(c => c.verdict);
  const gardes = juges.filter(c => c.verdict === "garder").length;
  const taux = juges.length ? Math.round((gardes / juges.length) * 1000) / 10 : null;

  // Le résultat est DÉPOSÉ, pas seulement affiché : sans ça, le chiffre reste
  // dans le navigateur de celui qui a cliqué et personne d'autre ne peut le lire.
  const [depose, setDepose] = useState(false);
  const deposer = useCallback(async () => {
    await fetch("/api/dev/banc-resultat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        graine: GRAINE, tire: cas.length, juges: juges.length, gardes, taux,
        rejets: juges.filter(c => c.verdict === "rejeter")
          .map(c => ({ id: c.recette.id, famille: c.recette.family, zone: recipeZone(c.recette), defauts: c.defauts })),
        erreurs: cas.filter(c => c.erreur).map(c => ({ id: c.recette.id, erreur: c.erreur })),
      }),
    });
    setDepose(true);
  }, [cas, juges, gardes, taux]);

  return (
    <main style={{ font: "400 14px/1.55 system-ui", padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ font: "800 22px/1.2 system-ui", margin: "0 0 6px" }}>Banc du catalogue</h1>
      <p style={{ color: "#555", margin: "0 0 18px", maxWidth: 760 }}>
        Quelle part du vivier réellement servi à un client est <strong>montrable sans retouche</strong>.
        Tirage identique d’un tour à l’autre (graine {GRAINE}) : deux versions du catalogue
        se comparent sur le même échantillon.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
        <label>Compositions tirées{" "}
          <select value={combien} onChange={e => setCombien(Number(e.target.value))} disabled={enCours}>
            {[6, 12, 22, 40].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button onClick={() => void lancer()} disabled={enCours}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: enCours ? "wait" : "pointer", background: "#0C2A1D", color: "#fff", fontWeight: 700 }}>
          {enCours ? `Jugement… (${juges.length}/${cas.length})` : "Lancer"}
        </button>
        {fini && juges.length > 0 && (
          <button onClick={() => void deposer()} disabled={depose}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #0C2A1D", cursor: "pointer", background: depose ? "#E8F0EA" : "#fff", fontWeight: 700 }}>
            {depose ? "Résultat déposé ✓" : "Déposer le résultat"}
          </button>
        )}
      </div>

      {motif && <p style={{ background: "#FDECEA", border: "1px solid #F5C2BE", borderRadius: 8, padding: "10px 13px", color: "#9B2C1F" }}>{motif}</p>}

      {taux !== null && (
        <div style={{ margin: "0 0 20px", padding: "14px 16px", border: "1px solid #e3e3e0", borderRadius: 10, background: "#FAFAF8" }}>
          <div style={{ font: "800 30px/1 system-ui", color: taux >= 80 ? "#1a7f37" : taux >= 60 ? "#9a6700" : "#cf222e" }}>
            {taux} %
          </div>
          <div style={{ color: "#555", marginTop: 4 }}>
            montrable sans retouche — {gardes} gardée(s) sur {juges.length} jugée(s)
            {cas.length !== juges.length && `, ${cas.length - juges.length} en attente ou en erreur`}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
        {cas.map(c => (
          <figure key={c.recette.id} style={{ margin: 0, border: "1px solid #e3e3e0", borderRadius: 10, padding: 12 }}>
            <div style={{ font: "700 11px system-ui", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8,
              color: c.verdict === "garder" ? "#1a7f37" : c.verdict === "rejeter" ? "#cf222e" : "#8a8a85" }}>
              {c.verdict ?? (c.erreur ? "erreur" : "…")} · {c.recette.family}
            </div>
            {c.image
              ? <img src={c.image} alt={c.recette.name} style={{ width: "100%", borderRadius: 6, display: "block" }} />
              : <div style={{ aspectRatio: "4/5", background: "#F2F2EF", borderRadius: 6 }} />}
            <figcaption style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 700 }}>{c.recette.name}</div>
              <div style={{ color: "#8a8a85", fontSize: 12 }}>{c.recette.id}</div>
              {c.defauts.length > 0 && (
                <ul style={{ margin: "6px 0 0", paddingLeft: 16, color: "#cf222e", fontSize: 12 }}>
                  {c.defauts.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
              {c.erreur && <div style={{ color: "#9B2C1F", fontSize: 12, marginTop: 6 }}>{c.erreur}</div>}
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
