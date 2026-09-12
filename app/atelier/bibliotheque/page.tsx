"use client";

/* LA BIBLIOTHÈQUE — ce qui est réellement servi aux clients.
 *
 * POURQUOI CET ÉCRAN EXISTE. L'atelier montre ce qu'on VIENT de produire ;
 * personne ne voyait ce qui était DÉJÀ en base. Au bout de trois séances, le
 * vivier d'un client contient des compositions dont on ne sait plus lesquelles
 * on a gardées, ni pourquoi — et la seule façon d'en retirer une était d'écrire
 * du SQL à la main.
 *
 * DEUX GESTES, ET ILS NE SE VALENT PAS. « Retirer du vivier » désactive sans
 * effacer : la composition cesse d'être proposée, et on peut la rappeler. C'est
 * le geste courant. « Supprimer » est définitif, et réservé à ce qu'on ne veut
 * jamais revoir.
 *
 * L'APERÇU EST RENDU ICI, dans le navigateur, avec la charte du client et sa
 * photo : c'est la seule façon de juger une composition sur pièce plutôt que sur
 * son nom. Une bibliothèque qui n'affiche que des identifiants ne se relit pas.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { buildDesignElements, effectiveMax, type DesignRecipe } from "@/lib/designSystem";
import { renderTemplateVisual } from "@/lib/composeRender";
import { remplirSlots } from "@/lib/bancTextes";

const W = 1080, H = 1350;

type Ligne = {
  recipe_id: string; name: string; family: string; photo: string;
  description: string | null; nodes: unknown; slots: unknown;
  source: string; geste: string | null; parent_id: string | null;
  active: boolean; workspace_id: string | null; created_at: string;
};

type Ws = {
  id: string; name: string | null;
  primary_color: string | null; secondary_color: string | null; accent_color: string | null;
  font_family: string | null; font_secondary: string | null;
  sector: string | null; tone: string | null;
};

const PHOTOS = [
  { v: "/banc-photos/produit-sombre-1.jpg", n: "Burger" },
  { v: "/banc-photos/produit-carre.jpg", n: "Produit" },
  { v: "/banc-photos/ugc-visage.jpg", n: "Visage" },
  { v: "/banc-photos/studio-box.jpg", n: "Studio" },
];

export default function Bibliotheque() {
  const sb = useMemo(() => createClientComponentClient(), []);
  const [clients, setClients] = useState<Ws[]>([]);
  const [ws, setWs] = useState("");
  const [charteApercu, setCharteApercu] = useState("");
  const [photo, setPhoto] = useState(PHOTOS[0].v);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [apercus, setApercus] = useState<Record<string, string>>({});
  const [etat, setEtat] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [filtre, setFiltre] = useState<"toutes" | "actives" | "retirees">("toutes");

  useEffect(() => {
    void (async () => {
      const { data } = await sb.from("workspaces")
        .select("id, name, primary_color, secondary_color, accent_color, font_family, font_secondary, sector, tone")
        .order("created_at");
      setClients((data ?? []) as Ws[]);
      if (data?.length && !ws) setWs(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const brand = useMemo(() => {
    const c = clients.find(x => x.id === (charteApercu || ws));
    return {
      name: c?.name ?? "", primary: c?.primary_color ?? null, secondary: c?.secondary_color ?? null,
      accent: c?.accent_color ?? null, display: c?.font_family ?? null, body: c?.font_secondary ?? null,
      sector: c?.sector ?? null, tone: c?.tone ?? null,
    };
  }, [clients, ws, charteApercu]);

  const rendre = useCallback(async (ls: Ligne[]) => {
    for (const l of ls) {
      try {
        const rec = {
          id: l.recipe_id, name: l.name, family: l.family, vibe: [], intents: [],
          photo: l.photo as DesignRecipe["photo"], desc: l.description ?? l.name,
          slots: (Array.isArray(l.slots) ? l.slots : []) as DesignRecipe["slots"],
          nodes: (Array.isArray(l.nodes) ? l.nodes : []) as DesignRecipe["nodes"],
        } as DesignRecipe;
        if (!rec.nodes.length) continue;
        const secours = remplirSlots(rec.slots, s => effectiveMax(rec, s));
        const fields: Record<string, string> = {};
        for (const sl of rec.slots) fields[sl.key] = sl.exemple?.trim() || secours[sl.key];
        const els = buildDesignElements(rec, {
          fields, brand: brand as never, w: W, h: H,
          hasPhoto: rec.nodes.some(n => n.k === "photo"),
        }) as Record<string, unknown>[];
        const url = await renderTemplateVisual({
          elements: els, sourceFormat: { w: W, h: H }, photoUrl: photo, w: W, h: H,
        });
        if (url) setApercus(p => ({ ...p, [l.recipe_id]: url }));
      } catch { /* un aperçu manquant n'arrête pas la liste */ }
    }
  }, [brand, photo]);

  const charger = useCallback(async () => {
    if (!ws) return;
    setOccupe(true); setEtat("Lecture du vivier…"); setApercus({});
    const { data, error } = await sb.from("design_recipes")
      .select("recipe_id, name, family, photo, description, nodes, slots, source, geste, parent_id, active, workspace_id, created_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    if (error) { setEtat(error.message); setOccupe(false); return; }
    const ls = (data ?? []) as Ligne[];
    setLignes(ls);
    setEtat(`${ls.length} composition(s) · ${ls.filter(x => x.active).length} active(s). Rendu des aperçus…`);
    await rendre(ls);
    setEtat(`${ls.length} composition(s) · ${ls.filter(x => x.active).length} active(s) dans le vivier.`);
    setOccupe(false);
  }, [ws, sb, rendre]);

  useEffect(() => { if (ws) void charger(); /* eslint-disable-next-line */ }, [ws]);
  useEffect(() => { if (lignes.length) void rendre(lignes); /* eslint-disable-next-line */ }, [charteApercu, photo]);

  const basculer = async (l: Ligne) => {
    const actif = !l.active;
    setLignes(p => p.map(x => (x.recipe_id === l.recipe_id ? { ...x, active: actif } : x)));
    const res = await fetch("/api/atelier/composition", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId: l.recipe_id, active: actif }),
    });
    if (!res.ok) {
      // On REVIENT EN ARRIÈRE si le serveur refuse : afficher un état que la base
      // ne partage pas est pire que ne rien afficher.
      setLignes(p => p.map(x => (x.recipe_id === l.recipe_id ? { ...x, active: !actif } : x)));
      setEtat("Le changement n'a pas été enregistré.");
    }
  };

  const supprimer = async (l: Ligne) => {
    if (!window.confirm(`Supprimer définitivement « ${l.name} » ? Elle ne pourra pas être rappelée.`)) return;
    const res = await fetch("/api/atelier/composition", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId: l.recipe_id }),
    });
    if (res.ok) setLignes(p => p.filter(x => x.recipe_id !== l.recipe_id));
    else setEtat("La suppression a échoué.");
  };

  const vues = lignes.filter(l =>
    filtre === "toutes" ? true : filtre === "actives" ? l.active : !l.active);
  const actives = lignes.filter(l => l.active).length;

  return (
    <main style={{ font: "400 14px/1.55 system-ui", padding: 24, maxWidth: 1300, margin: "0 auto" }}>
      <h1 style={{ font: "800 22px/1.2 system-ui", margin: "0 0 6px" }}>Bibliothèque de compositions</h1>
      <p style={{ color: "#555", margin: "0 0 16px", maxWidth: 780 }}>
        Ce qui est réellement servi à ce client. <strong>Retirer du vivier</strong> désactive sans effacer :
        la composition cesse d’être proposée et tu peux la rappeler.
        <strong> Supprimer</strong> est définitif.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <label>Client{" "}
          <select value={ws} onChange={e => { setWs(e.target.value); setCharteApercu(""); }} disabled={occupe}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name ?? c.id.slice(0, 8)}</option>)}
          </select>
        </label>
        <label>Aperçu sous la charte de{" "}
          <select value={charteApercu || ws} onChange={e => setCharteApercu(e.target.value)}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name ?? c.id.slice(0, 8)}</option>)}
          </select>
        </label>
        <label>sur{" "}
          <select value={photo} onChange={e => setPhoto(e.target.value)}>
            {PHOTOS.map(p => <option key={p.v} value={p.v}>{p.n}</option>)}
          </select>
        </label>
        <select value={filtre} onChange={e => setFiltre(e.target.value as typeof filtre)}>
          <option value="toutes">toutes ({lignes.length})</option>
          <option value="actives">actives ({actives})</option>
          <option value="retirees">retirées ({lignes.length - actives})</option>
        </select>
        <button onClick={() => void charger()} disabled={occupe} style={{
          padding: "7px 14px", borderRadius: 8, border: "1px solid #d5d5d0",
          background: "#fff", cursor: "pointer", fontWeight: 700,
        }}>Recharger</button>
      </div>

      {etat && <p style={{ background: "#F4F6F5", borderRadius: 8, padding: "9px 12px" }}>{etat}</p>}

      {!occupe && lignes.length === 0 && (
        <p style={{ color: "#8a8a85" }}>
          Aucune composition enregistrée pour ce client. Passe par l’atelier pour en produire.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
        {vues.map(l => (
          <figure key={l.recipe_id} style={{
            margin: 0, padding: 10, borderRadius: 10,
            border: `1px solid ${l.active ? "#0C2A1D" : "#e3e3e0"}`,
            background: l.active ? "#fff" : "#FAFAF8", opacity: l.active ? 1 : 0.5,
          }}>
            <div style={{
              font: "700 10px system-ui", textTransform: "uppercase", letterSpacing: ".08em",
              marginBottom: 6, color: l.source === "atelier" ? "#0C2A1D" : "#7a6a3a",
            }}>
              {l.source === "atelier" ? "ton modèle" : (l.geste ?? "déclinaison")}
            </div>
            {apercus[l.recipe_id]
              ? <img src={apercus[l.recipe_id]} alt={l.name} style={{ width: "100%", borderRadius: 6, display: "block" }} />
              : <div style={{ aspectRatio: "4/5", background: "#F2F2EF", borderRadius: 6 }} />}
            <figcaption style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{l.name}</div>
              <div style={{ color: "#8a8a85", fontSize: 11 }}>
                {(Array.isArray(l.slots) ? l.slots.length : 0)} champ(s) · {l.family}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={() => void basculer(l)} style={{
                  flex: 1, padding: "6px 8px", borderRadius: 7, cursor: "pointer", fontSize: 12,
                  border: "1px solid #d5d5d0", background: l.active ? "#EEF4F0" : "#fff", fontWeight: 700,
                }}>{l.active ? "Retirer du vivier" : "Remettre"}</button>
                <button onClick={() => void supprimer(l)} title="Supprimer définitivement" style={{
                  padding: "6px 10px", borderRadius: 7, cursor: "pointer", fontSize: 12,
                  border: "1px solid #F5C2BE", background: "#fff", color: "#cf222e", fontWeight: 700,
                }}>✕</button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
