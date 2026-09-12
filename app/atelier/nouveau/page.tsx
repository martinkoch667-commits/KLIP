"use client";

/* CRÉER UNE COMPOSITION — l'écran fait pour en dessiner cinquante à la suite.
 *
 * EN QUOI IL DIFFÈRE DE L'ÉDITEUR DE MODÈLES. Celui-ci demandait de déclarer, à
 * la main et dans un menu, ce qu'était chaque bloc de texte. C'est une corvée,
 * on l'oublie, et un modèle dont aucun bloc n'est déclaré est joli et
 * parfaitement inutile : l'IA n'a rien à y écrire.
 *
 * Ici on écrit de VRAIS textes — « Ouvert ce soir », « 12 € » — et le rôle se
 * DÉDUIT du dessin. Le badge sous chaque bloc dit ce que le logiciel a compris,
 * en direct : grossis un texte, il devient le titre sous tes yeux. C'est la
 * seule façon de faire confiance à une déduction, et donc de ne pas avoir à la
 * déclarer.
 *
 * LA PHOTO EST LÀ DÈS LE DÉPART, et c'est délibéré : une composition se pense
 * SUR son image. Dessiner sur un fond gris puis découvrir le résultat sur une
 * vraie photo, c'est refaire le travail. Elle n'est pas enregistrée dans la
 * composition — elle sert à composer, le client mettra la sienne.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { deduireRoles } from "@/lib/deduireRoles";

const W = 1080, H = 1350;

const PHOTOS = [
  { id: "produit-sombre-1", label: "Burger / fond sombre" },
  { id: "produit-carre", label: "Produit / carré" },
  { id: "ugc-visage", label: "Visage" },
  { id: "ugc-mains", label: "Mains" },
  { id: "studio-box", label: "Studio" },
];

type Bloc = {
  id: string; type: "text";
  text: string;
  x: number; y: number; width: number;
  fontSize: number; fontFamily: string; fontStyle: string;
  fill: string; align: string; uppercase: boolean; letterSpacing: number;
  hasBg: boolean; bgColor: string; cornerRadius: number;
  padding: number; paddingH: number; paddingV: number; bgOpacity: number;
  rotation: number; opacity: number;
};

type Ws = {
  id: string; name: string | null;
  primary_color: string | null; secondary_color: string | null; accent_color: string | null;
  font_family: string | null; font_secondary: string | null;
};

let compteur = 0;
const neuf = (): string => `b${Date.now().toString(36)}${(compteur++).toString(36)}`;

export default function NouvelleComposition() {
  const sb = useMemo(() => createClientComponentClient(), []);
  const [clients, setClients] = useState<Ws[]>([]);
  const [wsId, setWsId] = useState("");
  const [photo, setPhoto] = useState(PHOTOS[0].id);
  const [nom, setNom] = useState("");
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [etat, setEtat] = useState<string | null>(null);
  const [enregistres, setEnregistres] = useState(0);
  const scene = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await sb.from("workspaces")
        .select("id, name, primary_color, secondary_color, accent_color, font_family, font_secondary")
        .order("created_at");
      setClients((data ?? []) as Ws[]);
      if (data?.length) setWsId(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ws = clients.find(c => c.id === wsId);
  /** La palette proposée est CELLE DU CLIENT, jamais une roue chromatique. Une
   *  couleur hors charte n'a nulle part où se rattacher à la conversion : elle
   *  finirait sur le rôle le plus proche, c'est-à-dire au hasard. */
  const palette = useMemo(() => [
    { v: "#FFFFFF", n: "blanc" },
    { v: "#000000", n: "noir" },
    ...(ws?.primary_color ? [{ v: ws.primary_color, n: "principale" }] : []),
    ...(ws?.secondary_color ? [{ v: ws.secondary_color, n: "secondaire" }] : []),
    ...(ws?.accent_color ? [{ v: ws.accent_color, n: "accent" }] : []),
  ], [ws]);

  const polices = useMemo(() => [
    { v: ws?.font_family || "Oswald", n: "titre" },
    { v: ws?.font_secondary || ws?.font_family || "Inter", n: "texte" },
  ], [ws]);

  // Le rôle déduit, recalculé à chaque geste : c'est le retour immédiat qui
  // permet de se passer d'un menu.
  const roles = useMemo(() => {
    const m = new Map<string, { role: string | null; pourquoi: string }>();
    for (const d of deduireRoles(blocs)) m.set(d.id, { role: d.role, pourquoi: d.pourquoi });
    return m;
  }, [blocs]);

  const maj = (id: string, p: Partial<Bloc>) =>
    setBlocs(bs => bs.map(b => (b.id === id ? { ...b, ...p } : b)));

  const ajouter = (gros: boolean) => {
    const b: Bloc = {
      id: neuf(), type: "text",
      text: gros ? "Ouvert ce soir" : "Trois places restantes",
      x: Math.round(W * 0.08), y: Math.round(H * (gros ? 0.7 : 0.86)),
      width: Math.round(W * 0.84),
      fontSize: Math.round(W * (gros ? 0.105 : 0.03)),
      fontFamily: polices[gros ? 0 : 1].v, fontStyle: gros ? "bold" : "normal",
      fill: "#FFFFFF", align: "left", uppercase: gros, letterSpacing: 0,
      hasBg: false, bgColor: ws?.primary_color ?? "#000000", cornerRadius: 4,
      padding: 0, paddingH: 18, paddingV: 10, bgOpacity: 100,
      rotation: 0, opacity: 100,
    };
    setBlocs(bs => [...bs, b]); setSel(b.id);
  };

  // Déplacement au doigt/à la souris, en coordonnées du CADRE et non de l'écran :
  // la scène est affichée réduite, et travailler en pixels d'écran produirait un
  // dessin juste à l'écran et faux à l'export.
  const saisir = (e: React.PointerEvent, b: Bloc) => {
    e.preventDefault(); setSel(b.id);
    const boite = scene.current?.getBoundingClientRect();
    if (!boite) return;
    const k = W / boite.width;
    const dx = e.clientX, dy = e.clientY, x0 = b.x, y0 = b.y;
    const bouge = (ev: PointerEvent) => maj(b.id, {
      x: Math.round(x0 + (ev.clientX - dx) * k),
      y: Math.round(y0 + (ev.clientY - dy) * k),
    });
    const fin = () => { window.removeEventListener("pointermove", bouge); window.removeEventListener("pointerup", fin); };
    window.addEventListener("pointermove", bouge); window.addEventListener("pointerup", fin);
  };

  const enregistrer = useCallback(async () => {
    if (!wsId) { setEtat("Choisis un client."); return; }
    if (!blocs.length) { setEtat("Ajoute au moins un texte."); return; }
    setEtat("Enregistrement…");
    // La PHOTO n'est pas enregistrée : elle sert à composer. À sa place, un
    // calque image plein cadre qui réserve la zone — c'est lui qui dit à la
    // composition qu'elle attend une image, et le client y mettra la sienne.
    const elements = [
      { id: "fond", type: "image", src: "", x: 0, y: 0, width: W, height: H, rotation: 0, opacity: 100 },
      ...blocs,
    ];
    const res = await fetch("/api/templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: wsId,
        name: nom.trim() || `Composition ${enregistres + 1}`,
        format_id: "ig-portrait",
        text_zones: elements,
      }),
    });
    const d = await res.json();
    if (!res.ok) { setEtat(d?.error ?? "Enregistrement échoué"); return; }
    setEnregistres(n => n + 1);
    setEtat(`Enregistrée. ${enregistres + 1} composition(s) depuis le début.`);
    // On repart d'une page vide, photo et client conservés : c'est le geste
    // qu'on répète cinquante fois, il ne doit rien redemander.
    setBlocs([]); setSel(null); setNom("");
  }, [wsId, blocs, nom, enregistres]);

  const b = blocs.find(x => x.id === sel) ?? null;
  const ech = 420 / W;

  return (
    <main style={{ font: "400 14px/1.5 system-ui", padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ font: "800 20px/1.2 system-ui", margin: "0 0 4px" }}>Créer une composition</h1>
      <p style={{ color: "#555", margin: "0 0 16px", maxWidth: 720 }}>
        Écris de <strong>vrais textes</strong>. Le rôle de chaque bloc se déduit du dessin :
        le badge sous la scène dit ce que le logiciel a compris. Tu n’as rien à déclarer.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <select value={wsId} onChange={e => setWsId(e.target.value)}>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name ?? c.id.slice(0, 8)}</option>)}
        </select>
        <select value={photo} onChange={e => setPhoto(e.target.value)}>
          {PHOTOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom de la composition"
          style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #d5d5d0", minWidth: 200 }} />
        <button onClick={() => ajouter(true)} style={btn}>+ Titre</button>
        <button onClick={() => ajouter(false)} style={btn}>+ Texte</button>
        <button onClick={() => void enregistrer()} style={{ ...btn, background: "#0C2A1D", color: "#fff", border: "none" }}>
          Enregistrer et recommencer
        </button>
        {enregistres > 0 && <span style={{ color: "#1a7f37", fontWeight: 700 }}>{enregistres} enregistrée(s)</span>}
      </div>
      {etat && <p style={{ background: "#F4F6F5", borderRadius: 8, padding: "8px 12px", margin: "0 0 14px" }}>{etat}</p>}

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* LA SCÈNE */}
        <div>
          <div ref={scene} onPointerDown={() => setSel(null)} style={{
            position: "relative", width: 420, height: 420 * (H / W), borderRadius: 10, overflow: "hidden",
            backgroundImage: `url(/banc-photos/${photo}.jpg)`, backgroundSize: "cover", backgroundPosition: "center",
            border: "1px solid #d5d5d0", touchAction: "none", userSelect: "none",
          }}>
            {blocs.map(x => (
              <div key={x.id} onPointerDown={e => { e.stopPropagation(); saisir(e, x); }}
                style={{
                  position: "absolute", left: x.x * ech, top: x.y * ech, width: x.width * ech,
                  fontFamily: `"${x.fontFamily}", system-ui`, fontSize: x.fontSize * ech,
                  fontWeight: x.fontStyle.includes("bold") ? 800 : 400,
                  color: x.fill, textAlign: x.align as React.CSSProperties["textAlign"],
                  textTransform: x.uppercase ? "uppercase" : "none",
                  letterSpacing: x.letterSpacing * ech, lineHeight: 1.05,
                  ...(x.hasBg ? { background: x.bgColor, padding: `${x.paddingV * ech}px ${x.paddingH * ech}px`, borderRadius: x.cornerRadius * ech } : {}),
                  outline: sel === x.id ? "2px solid #2FD79B" : "none",
                  cursor: "move", whiteSpace: "pre-wrap",
                }}>{x.text}</div>
            ))}
          </div>

          {/* CE QUE LE LOGICIEL A COMPRIS */}
          <div style={{ marginTop: 10, width: 420 }}>
            {blocs.length === 0
              ? <p style={{ color: "#8a8a85" }}>Ajoute un titre pour commencer.</p>
              : blocs.map(x => {
                const r = roles.get(x.id);
                return (
                  <div key={x.id} onClick={() => setSel(x.id)} style={{
                    display: "flex", gap: 8, alignItems: "baseline", padding: "5px 8px", borderRadius: 6,
                    background: sel === x.id ? "#EEF4F0" : "transparent", cursor: "pointer", fontSize: 12,
                  }}>
                    <strong style={{ color: r?.role ? "#0C2A1D" : "#8a8a85", minWidth: 76 }}>
                      {r?.role ?? "figé"}
                    </strong>
                    <span style={{ color: "#555", flex: 1 }}>{r?.pourquoi}</span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* LE PANNEAU */}
        {b && (
          <div style={{ flex: 1, minWidth: 260, maxWidth: 340, border: "1px solid #e3e3e0", borderRadius: 10, padding: 14 }}>
            <textarea value={b.text} onChange={e => maj(b.id, { text: e.target.value })} rows={2}
              style={{ width: "100%", padding: 8, borderRadius: 7, border: "1px solid #d5d5d0", font: "inherit", resize: "vertical" }} />

            <label style={lab}>Taille <b>{Math.round((b.fontSize / W) * 1000) / 10} %</b>
              <input type="range" min={12} max={260} value={b.fontSize}
                onChange={e => maj(b.id, { fontSize: Number(e.target.value) })} style={{ width: "100%" }} />
            </label>
            <label style={lab}>Largeur
              <input type="range" min={Math.round(W * 0.2)} max={W} value={b.width}
                onChange={e => maj(b.id, { width: Number(e.target.value) })} style={{ width: "100%" }} />
            </label>
            <label style={lab}>Interlettrage
              <input type="range" min={0} max={40} value={b.letterSpacing}
                onChange={e => maj(b.id, { letterSpacing: Number(e.target.value) })} style={{ width: "100%" }} />
            </label>

            <div style={lab}>Couleur du texte
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                {palette.map(c => (
                  <button key={c.v} title={c.n} onClick={() => maj(b.id, { fill: c.v })} style={{
                    width: 28, height: 28, borderRadius: 6, background: c.v, cursor: "pointer",
                    border: b.fill.toLowerCase() === c.v.toLowerCase() ? "3px solid #0C2A1D" : "1px solid #d5d5d0",
                  }} />
                ))}
              </div>
            </div>

            <div style={lab}>Police
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                {polices.map(p => (
                  <button key={p.n} onClick={() => maj(b.id, { fontFamily: p.v })} style={{
                    ...petit, fontWeight: b.fontFamily === p.v ? 800 : 400,
                  }}>{p.n}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={() => maj(b.id, { fontStyle: b.fontStyle.includes("bold") ? "normal" : "bold" })} style={petit}>Gras</button>
              <button onClick={() => maj(b.id, { uppercase: !b.uppercase })} style={petit}>Capitales</button>
              {(["left", "center", "right"] as const).map(a =>
                <button key={a} onClick={() => maj(b.id, { align: a })} style={petit}>{a === "left" ? "◧" : a === "center" ? "▣" : "◨"}</button>)}
              <button onClick={() => maj(b.id, { hasBg: !b.hasBg })} style={petit}>
                {b.hasBg ? "Sans aplat" : "Aplat derrière"}
              </button>
            </div>

            {b.hasBg && (
              <div style={lab}>Couleur de l’aplat
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  {palette.map(c => (
                    <button key={c.v} onClick={() => maj(b.id, { bgColor: c.v })} style={{
                      width: 28, height: 28, borderRadius: 6, background: c.v, cursor: "pointer",
                      border: b.bgColor.toLowerCase() === c.v.toLowerCase() ? "3px solid #0C2A1D" : "1px solid #d5d5d0",
                    }} />
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => { setBlocs(bs => bs.filter(x => x.id !== b.id)); setSel(null); }}
              style={{ ...petit, marginTop: 14, width: "100%", color: "#cf222e" }}>Supprimer ce bloc</button>
          </div>
        )}
      </div>
    </main>
  );
}

const btn: React.CSSProperties = { padding: "7px 13px", borderRadius: 8, border: "1px solid #d5d5d0", background: "#fff", cursor: "pointer", fontWeight: 700 };
const petit: React.CSSProperties = { padding: "5px 10px", borderRadius: 6, border: "1px solid #d5d5d0", background: "#fff", cursor: "pointer", fontSize: 12 };
const lab: React.CSSProperties = { display: "block", marginTop: 12, fontSize: 12, color: "#555" };
