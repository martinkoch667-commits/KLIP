"use client";

/* L'ATELIER — de cinquante modèles dessinés à la main à deux cents compositions.
 *
 * LE PARCOURS, ET IL TIENT EN TROIS GESTES :
 *   1. tu dessines tes modèles dans l'éditeur de modèles, comme d'habitude ;
 *   2. tu viens ici et tu cliques « Décliner » ;
 *   3. tu regardes, tu gardes ce que tu veux, tu enregistres.
 *
 * POURQUOI UNE RELECTURE HUMAINE, alors que tout est vérifié. Le contrôle
 * géométrique garantit qu'une composition TIENT DEBOUT : rien hors cadre, rien
 * qui se marche dessus, aucune valeur en pixels là où on attend une fraction.
 * Il ne dit rien de son GOÛT. Une déclinaison peut être parfaitement solide et
 * parfaitement ratée. C'est la seule chose qu'une machine ne tranchera pas ici,
 * et c'est exactement pour ça que cet écran existe.
 *
 * TOUT EST DÉJÀ GARDÉ AU DÉPART. Décocher ce qu'on ne veut pas est plus rapide
 * que cocher ce qu'on veut quand le rendement est bon, et il l'est : 100 % des
 * déclinaisons passent le contrôle. Si un jour ce n'est plus vrai, il faudra
 * inverser le défaut.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { buildDesignElements, effectiveMax, type DesignRecipe } from "@/lib/designSystem";
import { renderTemplateVisual } from "@/lib/composeRender";
import { remplirSlots } from "@/lib/bancTextes";

type Item = {
  recette: DesignRecipe;
  geste?: string;
  emprunt?: string | null;
  parent?: string;
  fautes?: string[];
  pertes?: string[];
};

type Ws = {
  id: string; name: string | null;
  primary_color: string | null; secondary_color: string | null; accent_color: string | null;
  font_family: string | null; font_secondary: string | null;
  sector: string | null; tone: string | null;
};

const W = 1080, H = 1350;

export default function Atelier() {
  const sb = useMemo(() => createClientComponentClient(), []);
  const [clients, setClients] = useState<Ws[]>([]);
  const [ws, setWs] = useState<string>("");
  const [par, setPar] = useState(4);

  const [bases, setBases] = useState<Item[]>([]);
  const [series, setSeries] = useState<Item[]>([]);
  const [apercus, setApercus] = useState<Record<string, string>>({});
  const [ecartes, setEcartes] = useState<Set<string>>(new Set());
  const [charte, setCharte] = useState<{ renseignee?: boolean } | null>(null);
  const [pertes, setPertes] = useState<{ modele: string; quoi: string[] }[]>([]);
  const [etat, setEtat] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  // L'APERÇU SE JOUE SOUS UNE AUTRE CHARTE QUE CELLE D'ORIGINE, et c'est LE
  // contrôle qui vaut : une composition dessinée pour un restaurant n'a d'intérêt
  // que si elle tient debout chez un caviste. Tant qu'on ne la regarde que chez
  // le client qui l'a dessinée, on ne vérifie rien — les couleurs littérales et
  // les rôles rendent alors exactement pareil.
  const [charteApercu, setCharteApercu] = useState<string>("");
  const [photo, setPhoto] = useState<string>("/banc-photos/produit-sombre-1.jpg");
  const [maPhoto, setMaPhoto] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await sb.from("workspaces").select("id, name, primary_color, secondary_color, accent_color, font_family, font_secondary, sector, tone").order("created_at");
      setClients((data ?? []) as Ws[]);
      if (data?.length && !ws) setWs(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const brand = useMemo(() => {
    const c = clients.find(x => x.id === (charteApercu || ws));
    return {
      name: c?.name ?? "", primary: c?.primary_color ?? null,
      secondary: c?.secondary_color ?? null, accent: c?.accent_color ?? null,
      display: c?.font_family ?? null, body: c?.font_secondary ?? null,
      sector: c?.sector ?? null, tone: c?.tone ?? null,
    };
  }, [clients, ws, charteApercu]);

  /** Le rendu se fait ICI, dans le navigateur : `renderTemplateVisual` a besoin
   *  d'un canvas, et le serveur n'en a pas. C'est la même contrainte que pour le
   *  juge de rendu, et la même réponse. */
  const rendre = useCallback(async (items: Item[]) => {
    for (const it of items) {
      try {
        const fields = remplirSlots(it.recette.slots, s => effectiveMax(it.recette, s));
        const els = buildDesignElements(it.recette, {
          fields, brand: brand as never, w: W, h: H,
          hasPhoto: it.recette.nodes.some(n => n.k === "photo"),
        }) as Record<string, unknown>[];
        const url = await renderTemplateVisual({
          elements: els, sourceFormat: { w: W, h: H },
          photoUrl: maPhoto ?? photo, w: W, h: H,
        });
        if (url) setApercus(p => ({ ...p, [it.recette.id]: url }));
      } catch { /* un aperçu manquant ne doit pas arrêter la série */ }
    }
  }, [brand, photo, maPhoto]);

  const decliner = useCallback(async () => {
    if (!ws) return;
    setOccupe(true); setEtat("Conversion des modèles…");
    setBases([]); setSeries([]); setApercus({}); setEcartes(new Set());
    try {
      const res = await fetch("/api/atelier/decliner", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: ws, parModele: par }),
      });
      const d = await res.json();
      if (!res.ok) { setEtat(d?.error ?? "Déclinaison échouée"); setOccupe(false); return; }
      setCharte(d.charte); setPertes(d.pertes ?? []);
      setBases(d.bases ?? []); setSeries(d.series ?? []);
      setEtat(`${d.modeles} modèle(s) → ${d.variantes} déclinaison(s). Rendu des aperçus…`);
      await rendre([...(d.bases ?? []), ...(d.series ?? [])]);
      setEtat(`${d.total} composition(s) prêtes à relire.`);
    } catch (e) { setEtat(String(e)); }
    setOccupe(false);
  }, [ws, par, rendre]);

  // Changer de charte ou de photo REDESSINE tout ce qui est à l'écran : sans ça
  // le sélecteur mentirait, et c'est exactement la vérification qu'on vient
  // faire ici.
  useEffect(() => {
    const tout = [...bases, ...series];
    if (tout.length) void rendre(tout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charteApercu, photo, maPhoto]);

  const basculer = (id: string) =>
    setEcartes(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const enregistrer = useCallback(async () => {
    const retenues = [...bases, ...series].filter(i => !ecartes.has(i.recette.id));
    if (!retenues.length) { setEtat("Rien de retenu."); return; }
    setOccupe(true); setEtat(`Enregistrement de ${retenues.length} composition(s)…`);
    const res = await fetch("/api/atelier/enregistrer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: ws, recettes: retenues }),
    });
    const d = await res.json();
    setEtat(res.ok
      ? `${d.enregistrees} enregistrée(s)${d.refusees?.length ? `, ${d.refusees.length} refusée(s) par le contrôle` : ""}. Elles entrent dans le vivier dès la prochaine génération.`
      : (d?.error ?? "Enregistrement échoué"));
    setOccupe(false);
  }, [bases, series, ecartes, ws]);

  const tout = [...bases, ...series];
  const retenu = tout.length - ecartes.size;

  const carte = (it: Item, origine: boolean) => {
    const id = it.recette.id;
    const off = ecartes.has(id);
    return (
      <figure key={id} style={{
        margin: 0, border: `1px solid ${off ? "#e3e3e0" : "#0C2A1D"}`, borderRadius: 10, padding: 10,
        opacity: off ? 0.45 : 1, background: off ? "#FAFAF8" : "#fff",
      }}>
        <div style={{ font: "700 10px system-ui", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6, color: origine ? "#0C2A1D" : "#7a6a3a" }}>
          {origine ? "ton modèle" : it.geste}
          {it.emprunt ? ` · d'après « ${it.emprunt} »` : ""}
        </div>
        {apercus[id]
          ? <img src={apercus[id]} alt={it.recette.name} style={{ width: "100%", borderRadius: 6, display: "block" }} />
          : <div style={{ aspectRatio: "4/5", background: "#F2F2EF", borderRadius: 6 }} />}
        <figcaption style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{it.recette.name}</div>
          <div style={{ color: "#8a8a85", fontSize: 11 }}>{it.recette.slots.length} champ(s) · {it.recette.family}</div>
          {!!it.fautes?.length && (
            <div style={{ color: "#cf222e", fontSize: 11, marginTop: 4 }}>⚠ {it.fautes[0]}</div>
          )}
          {!!it.pertes?.length && (
            <div style={{ color: "#9a6700", fontSize: 11, marginTop: 4 }}>{it.pertes[0]}</div>
          )}
          <button onClick={() => basculer(id)} style={{
            marginTop: 8, width: "100%", padding: "6px 10px", borderRadius: 7, cursor: "pointer",
            border: "1px solid #d5d5d0", background: off ? "#fff" : "#EEF4F0", fontWeight: 700, fontSize: 12,
          }}>
            {off ? "Reprendre" : "Écarter"}
          </button>
        </figcaption>
      </figure>
    );
  };

  return (
    <main style={{ font: "400 14px/1.55 system-ui", padding: 24, maxWidth: 1300, margin: "0 auto" }}>
      <h1 style={{ font: "800 22px/1.2 system-ui", margin: "0 0 6px" }}>Atelier de compositions</h1>
      <p style={{ color: "#555", margin: "0 0 18px", maxWidth: 780 }}>
        Tes modèles dessinés à la main deviennent des compositions <strong>en rôles de charte</strong>,
        donc réutilisables chez n’importe quel client, et chacun se décline en plusieurs variantes.
        Tout ce qui s’affiche a déjà passé le contrôle géométrique : ce qui te reste à juger, c’est le goût.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label>Client{" "}
          <select value={ws} onChange={e => setWs(e.target.value)} disabled={occupe}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name ?? c.id.slice(0, 8)}</option>)}
          </select>
        </label>
        <label>Déclinaisons par modèle{" "}
          <select value={par} onChange={e => setPar(Number(e.target.value))} disabled={occupe}>
            {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button onClick={() => void decliner()} disabled={occupe || !ws} style={{
          padding: "8px 16px", borderRadius: 8, border: "none", cursor: occupe ? "wait" : "pointer",
          background: "#0C2A1D", color: "#fff", fontWeight: 700,
        }}>Décliner</button>
      </div>

      {/* LE CONTRÔLE QUI VAUT VRAIMENT : la même composition, une AUTRE marque.
          Tant qu'on la regarde chez le client qui l'a dessinée, on ne vérifie
          rien — les rôles rendent exactement comme les couleurs littérales. */}
      {tout.length > 0 && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
          margin: "0 0 16px", padding: "10px 12px", background: "#F4F6F5", borderRadius: 10 }}>
          <strong style={{ fontSize: 13 }}>Aperçu</strong>
          <label style={{ fontSize: 13 }}>sous la charte de{" "}
            <select value={charteApercu || ws} onChange={e => setCharteApercu(e.target.value)}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name ?? c.id.slice(0, 8)}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>sur{" "}
            <select value={photo} onChange={e => { setMaPhoto(null); setPhoto(e.target.value); }}>
              <option value="/banc-photos/produit-sombre-1.jpg">Burger / fond sombre</option>
              <option value="/banc-photos/produit-carre.jpg">Produit / carré</option>
              <option value="/banc-photos/ugc-visage.jpg">Visage</option>
              <option value="/banc-photos/ugc-mains.jpg">Mains</option>
              <option value="/banc-photos/studio-box.jpg">Studio</option>
            </select>
          </label>
          <label style={{ fontSize: 13, cursor: "pointer" }}>
            ou <u>ta photo</u>
            <input type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => {
                const f = e.target.files?.[0];
                // Lue dans le navigateur, jamais envoyée : c'est un aperçu, pas
                // un import. Rien n'a à quitter la machine pour vérifier un rendu.
                if (f) setMaPhoto(URL.createObjectURL(f));
              }} />
          </label>
          {maPhoto && <button onClick={() => setMaPhoto(null)} style={{ ...petitBtn }}>retirer ma photo</button>}
          {charteApercu && charteApercu !== ws && (
            <span style={{ fontSize: 12, color: "#1a7f37", fontWeight: 700 }}>
              charte d’un AUTRE client : c’est le vrai test
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        {tout.length > 0 && (
          <button onClick={() => void enregistrer()} disabled={occupe} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid #0C2A1D", cursor: "pointer",
            background: "#fff", fontWeight: 700,
          }}>Enregistrer les {retenu} retenues</button>
        )}
      </div>

      {charte && charte.renseignee === false && (
        <p style={{ background: "#FDECEA", border: "1px solid #F5C2BE", borderRadius: 8, padding: "10px 13px", color: "#9B2C1F" }}>
          Ce client n’a <strong>aucune couleur de charte</strong>. La conversion rattache alors toutes les
          couleurs aux valeurs par défaut, et les compositions ne ressembleront à personne.
          Renseigne sa charte avant de décliner.
        </p>
      )}
      {etat && <p style={{ background: "#F4F6F5", borderRadius: 8, padding: "10px 13px" }}>{etat}</p>}
      {pertes.length > 0 && (
        <details style={{ margin: "0 0 16px" }}>
          <summary style={{ cursor: "pointer", color: "#9a6700", fontWeight: 700 }}>
            {pertes.length} modèle(s) ont perdu quelque chose à la conversion
          </summary>
          <ul style={{ color: "#555", fontSize: 13 }}>
            {pertes.map((p, i) => <li key={i}><strong>{p.modele}</strong> : {p.quoi.join(" · ")}</li>)}
          </ul>
        </details>
      )}

      {bases.length > 0 && <h2 style={{ font: "800 16px system-ui", margin: "22px 0 10px" }}>Tes modèles ({bases.length})</h2>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
        {bases.map(b => carte(b, true))}
      </div>

      {series.length > 0 && <h2 style={{ font: "800 16px system-ui", margin: "28px 0 10px" }}>Les déclinaisons ({series.length})</h2>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
        {series.map(v => carte(v, false))}
      </div>
    </main>
  );
}

const petitBtn: React.CSSProperties = { padding: '4px 9px', borderRadius: 6, border: '1px solid #d5d5d0', background: '#fff', cursor: 'pointer', fontSize: 12 };
