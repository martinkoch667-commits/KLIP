"use client";

/* LE CATALOGUE — tout ce dans quoi l'IA pioche, en un seul endroit.
 *
 * CE QUE CET ÉCRAN CORRIGE. Le vivier vit à DEUX endroits : 162 compositions
 * écrites en dur dans `designSystem.ts`, et celles que l'atelier enregistre en
 * base. Chacune des deux vues en cachait la moitié. On ne pouvait donc pas
 * répondre à la seule question qui compte quand on ajoute des compositions :
 * qu'est-ce que l'IA a réellement sous la main, et est-ce que ça tient debout
 * ensemble ?
 *
 * TROIS PROVENANCES, et elles n'ont pas le même statut :
 *   · CODE — les 162 d'origine, versionnées, servies à tous. On ne peut pas les
 *     supprimer d'ici (elles sont dans le dépôt) mais on peut les MASQUER, ce
 *     qui les retire du vivier de tout le monde sans déploiement ;
 *   · CATALOGUE — celles qu'on a fait entrer dans le fonds commun. Servies à
 *     tous, repeintes à chaque charte ;
 *   · CLIENT — celles qui ne servent qu'au compte qui les a dessinées. C'est
 *     l'état par défaut de tout ce que l'atelier produit.
 *
 * FAIRE ENTRER UNE COMPOSITION DANS LE CATALOGUE EST UNE DÉCISION DE PLATEFORME,
 * pas une action d'utilisateur : elle vaut pour tous les clients de KLIP. Le
 * bouton n'apparaît qu'aux adresses de `KLIP_ADMIN_EMAILS`.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { buildDesignElements, effectiveMax, type DesignRecipe } from "@/lib/designSystem";
import { renderTemplateVisual } from "@/lib/composeRender";
import { remplirSlots } from "@/lib/bancTextes";

const W = 1080, H = 1350;

type Compo = {
  recipe_id: string; name: string; family: string; photo: string;
  description: string | null; nodes: unknown; slots: unknown;
  origine: "code" | "catalogue" | "client";
  geste: string | null; portee: string; active: boolean;
  workspace_id: string | null;
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

const ETIQUETTE: Record<Compo["origine"], { l: string; c: string }> = {
  code: { l: "catalogue d'origine", c: "#5B6B7A" },
  catalogue: { l: "catalogue maison", c: "#0C2A1D" },
  client: { l: "réservée à un client", c: "#7a6a3a" },
};

export default function Catalogue() {
  const sb = useMemo(() => createClientComponentClient(), []);
  const [clients, setClients] = useState<Ws[]>([]);
  const [charte, setCharte] = useState("");
  const [photo, setPhoto] = useState(PHOTOS[0].v);

  const [compos, setCompos] = useState<Compo[]>([]);
  const [apercus, setApercus] = useState<Record<string, string>>({});
  const [admin, setAdmin] = useState(false);
  const [origine, setOrigine] = useState<"toutes" | Compo["origine"]>("toutes");
  const [etatFiltre, setEtatFiltre] = useState<"toutes" | "actives" | "masquees">("actives");
  const [famille, setFamille] = useState("toutes");
  const [combien, setCombien] = useState(40);
  const [etat, setEtat] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await sb.from("workspaces")
        .select("id, name, primary_color, secondary_color, accent_color, font_family, font_secondary, sector, tone")
        .order("created_at");
      setClients((data ?? []) as Ws[]);
      if (data?.length) setCharte(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const brand = useMemo(() => {
    const c = clients.find(x => x.id === charte);
    return {
      name: c?.name ?? "", primary: c?.primary_color ?? null, secondary: c?.secondary_color ?? null,
      accent: c?.accent_color ?? null, display: c?.font_family ?? null, body: c?.font_secondary ?? null,
      sector: c?.sector ?? null, tone: c?.tone ?? null,
    };
  }, [clients, charte]);

  const charger = useCallback(async () => {
    setOccupe(true); setEtat("Lecture du catalogue…"); setApercus({});
    const r = await fetch("/api/atelier/catalogue");
    const d = await r.json();
    if (!r.ok) { setEtat(d?.error ?? "Lecture impossible"); setOccupe(false); return; }
    setCompos(d.compositions ?? []); setAdmin(!!d.admin);
    setEtat(`${d.total} composition(s) : ${d.code} du catalogue d'origine, ${d.catalogue} maison, ${d.client} réservée(s) à un client.`);
    setOccupe(false);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  const familles = useMemo(
    () => Array.from(new Set(compos.map(c => c.family))).sort(), [compos]);

  const vues = useMemo(() => compos.filter(c =>
    (origine === "toutes" || c.origine === origine)
    && (etatFiltre === "toutes" || (etatFiltre === "actives" ? c.active : !c.active))
    && (famille === "toutes" || c.family === famille)
  ).slice(0, combien), [compos, origine, etatFiltre, famille, combien]);

  /** LE RENDU EST PAGINÉ, et c'est délibéré : dessiner 185 compositions d'un
   *  coup fige le navigateur une minute. On ne rend que ce qui est affiché. */
  useEffect(() => {
    if (!vues.length || !charte) return;
    let vivant = true;
    void (async () => {
      for (const c of vues) {
        if (!vivant) return;
        if (apercus[c.recipe_id]) continue;
        try {
          const rec = {
            id: c.recipe_id, name: c.name, family: c.family, vibe: [], intents: [],
            photo: c.photo as DesignRecipe["photo"], desc: c.description ?? c.name,
            slots: (Array.isArray(c.slots) ? c.slots : []) as DesignRecipe["slots"],
            nodes: (Array.isArray(c.nodes) ? c.nodes : []) as DesignRecipe["nodes"],
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
          if (url && vivant) setApercus(p => ({ ...p, [c.recipe_id]: url }));
        } catch { /* un aperçu manquant n'arrête pas la grille */ }
      }
    })();
    return () => { vivant = false; };
  }, [vues, brand, photo, charte, apercus]);

  // Changer de charte ou de photo invalide TOUS les aperçus : les garder
  // montrerait les anciennes couleurs sous le nouveau nom.
  useEffect(() => { setApercus({}); }, [charte, photo]);

  const basculer = async (c: Compo) => {
    const actif = !c.active;
    const avant = compos;
    setCompos(p => p.map(x => (x.recipe_id === c.recipe_id ? { ...x, active: actif } : x)));
    const res = c.origine === "code"
      ? await fetch("/api/atelier/catalogue", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeId: c.recipe_id, masquer: !actif }),
        })
      : await fetch("/api/atelier/composition", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeId: c.recipe_id, active: actif }),
        });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setCompos(avant);
      setEtat(d?.error ?? "Le changement n'a pas été enregistré.");
    }
  };

  const promouvoir = async (c: Compo) => {
    const vers = c.origine === "catalogue" ? "client" : "catalogue";
    const res = await fetch("/api/atelier/catalogue", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeIds: [c.recipe_id], portee: vers }),
    });
    const d = await res.json().catch(() => null);
    if (res.ok) { setEtat(`« ${c.name} » passe en ${vers}.`); void charger(); }
    else setEtat(d?.error ?? "Déplacement refusé.");
  };

  const supprimer = async (c: Compo) => {
    if (!window.confirm(`Supprimer définitivement « ${c.name} » ?`)) return;
    const res = await fetch("/api/atelier/composition", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId: c.recipe_id }),
    });
    if (res.ok) setCompos(p => p.filter(x => x.recipe_id !== c.recipe_id));
    else setEtat("La suppression a échoué.");
  };

  const nb = (o: Compo["origine"]) => compos.filter(c => c.origine === o).length;

  return (
    <main style={{ font: "400 14px/1.55 system-ui", padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <h1 style={{ font: "800 22px/1.2 system-ui", margin: "0 0 6px" }}>Le catalogue</h1>
      <p style={{ color: "#555", margin: "0 0 14px", maxWidth: 820 }}>
        Tout ce dans quoi l’IA pioche quand quelqu’un demande un visuel.
        Les compositions du <strong>catalogue</strong> servent tous les clients, repeintes à chaque charte ;
        celles marquées <strong>réservée à un client</strong> ne servent qu’au compte qui les a dessinées.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <label>Aperçu avec la charte de{" "}
          <select value={charte} onChange={e => setCharte(e.target.value)}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name ?? c.id.slice(0, 8)}</option>)}
          </select>
        </label>
        <label>sur{" "}
          <select value={photo} onChange={e => setPhoto(e.target.value)}>
            {PHOTOS.map(p => <option key={p.v} value={p.v}>{p.n}</option>)}
          </select>
        </label>
        <select value={origine} onChange={e => setOrigine(e.target.value as typeof origine)}>
          <option value="toutes">toutes provenances ({compos.length})</option>
          <option value="client">réservées à un client ({nb("client")})</option>
          <option value="catalogue">catalogue maison ({nb("catalogue")})</option>
          <option value="code">catalogue d’origine ({nb("code")})</option>
        </select>
        <select value={etatFiltre} onChange={e => setEtatFiltre(e.target.value as typeof etatFiltre)}>
          <option value="actives">actives</option>
          <option value="masquees">masquées</option>
          <option value="toutes">toutes</option>
        </select>
        <select value={famille} onChange={e => setFamille(e.target.value)}>
          <option value="toutes">toutes familles</option>
          {familles.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <button onClick={() => void charger()} disabled={occupe} style={btn}>Recharger</button>
      </div>

      {etat && <p style={{ background: "#F4F6F5", borderRadius: 8, padding: "9px 12px" }}>{etat}</p>}
      {!admin && (
        <p style={{ background: "#FFF8E8", border: "1px solid #E8D9A8", borderRadius: 8, padding: "9px 12px", color: "#7a6a3a" }}>
          Les gestes de <strong>plateforme</strong> (faire entrer une composition dans le catalogue commun,
          masquer une composition d’origine) sont désactivés : ton adresse n’est pas dans
          <code> KLIP_ADMIN_EMAILS</code>. Ils valent pour tous les clients, c’est pourquoi ils ne
          s’ouvrent pas tout seuls.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginTop: 14 }}>
        {vues.map(c => {
          const e = ETIQUETTE[c.origine];
          return (
            <figure key={c.recipe_id} style={{
              margin: 0, padding: 10, borderRadius: 10,
              border: `1px solid ${c.active ? "#e3e3e0" : "#F5C2BE"}`,
              background: c.active ? "#fff" : "#FDF6F5", opacity: c.active ? 1 : 0.6,
            }}>
              <div style={{ font: "700 10px system-ui", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6, color: e.c }}>
                {e.l}{c.geste ? ` · ${c.geste}` : ""}
              </div>
              {apercus[c.recipe_id]
                ? <img src={apercus[c.recipe_id]} alt={c.name} style={{ width: "100%", borderRadius: 6, display: "block" }} />
                : <div style={{ aspectRatio: "4/5", background: "#F2F2EF", borderRadius: 6 }} />}
              <figcaption style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                <div style={{ color: "#8a8a85", fontSize: 11 }}>
                  {(Array.isArray(c.slots) ? c.slots.length : 0)} champ(s) · {c.family}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <button onClick={() => void basculer(c)} disabled={c.origine === "code" && !admin} style={{
                    ...petit, flex: 1, background: c.active ? "#EEF4F0" : "#fff",
                  }}>{c.active ? "Masquer" : "Rétablir"}</button>
                  {admin && c.origine !== "code" && (
                    <button onClick={() => void promouvoir(c)} style={{ ...petit, flex: 1 }}>
                      {c.origine === "catalogue" ? "→ un client" : "→ catalogue"}
                    </button>
                  )}
                  {c.origine !== "code" && (
                    <button onClick={() => void supprimer(c)} title="Supprimer définitivement"
                      style={{ ...petit, color: "#cf222e", borderColor: "#F5C2BE" }}>✕</button>
                  )}
                </div>
              </figcaption>
            </figure>
          );
        })}
      </div>

      {compos.filter(c =>
        (origine === "toutes" || c.origine === origine)
        && (etatFiltre === "toutes" || (etatFiltre === "actives" ? c.active : !c.active))
        && (famille === "toutes" || c.family === famille)).length > combien && (
        <button onClick={() => setCombien(n => n + 40)} style={{ ...btn, margin: "20px auto", display: "block" }}>
          En voir 40 de plus
        </button>
      )}
    </main>
  );
}

const btn: React.CSSProperties = { padding: "7px 14px", borderRadius: 8, border: "1px solid #d5d5d0", background: "#fff", cursor: "pointer", fontWeight: 700 };
const petit: React.CSSProperties = { padding: "6px 9px", borderRadius: 7, border: "1px solid #d5d5d0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 };
