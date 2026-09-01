"use client";

/* Banc d'essai de l'import Canva : réservé au développement.
 *
 * CE QU'ON VIENT VÉRIFIER ICI
 * L'API Connect de Canva n'expose pas le contenu d'un design. Le seul chemin
 * vers la structure est l'export PDF, qui n'est pas aplati. Toute la question
 * est donc : est-ce qu'un export Canva réel se relit assez bien pour en faire
 * un modèle KLIP, ou est-ce qu'on ne récupère que des pixels ?
 *
 * COMMENT S'EN SERVIR, ET C'EST TOUT L'INTÉRÊT DE CETTE PAGE
 * Ouvrir un vrai design dans Canva, Partager > Télécharger > PDF standard (SANS
 * cocher « aplatir le PDF »), et déposer le fichier ici. La colonne de gauche
 * montre ce que le fichier contenait, celle de droite le modèle reconstruit,
 * rendu par le MÊME moteur que l'éditeur. Aucun compte, aucune intégration,
 * aucune autorisation Canva n'est nécessaire pour trancher la question.
 */

import React, { useCallback, useRef, useState } from "react";
import { renderTemplateVisual } from "@/lib/composeRender";

const PHOTO_TEMOIN = "/banc-photos/produit-sombre-1.jpg";

const FORMATS: Record<string, { w: number; h: number }> = {
  "ig-portrait": { w: 420, h: 560 },
  "ig-square": { w: 560, h: 560 },
  "ig-story": { w: 315, h: 560 },
  facebook: { w: 560, h: 294 },
};

interface Rapport {
  runs: number; blocs: number; aplats: number; zonesPhoto: number;
  polices: string[]; couleurs: string[]; pertes: string[]; confiance: number;
}
interface Modele {
  format_id: string;
  background_style: { type: "solid"; color: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pages: { elements: any[] }[];
  rapport: Rapport;
}

const mono: React.CSSProperties = { fontFamily: "var(--mono, ui-monospace, monospace)" };
const card: React.CSSProperties = {
  border: "1px solid var(--line, #ddd)", borderRadius: 10, padding: 16,
  background: "var(--surface, #fff)",
};

function Pastille({ hex }: { hex: string }) {
  return <span title={hex} style={{ display: "inline-block", width: 18, height: 18, borderRadius: 3, background: hex, border: "1px solid rgba(0,0,0,.15)", verticalAlign: "middle" }} />;
}

function Rendu({ modele, page, avecPhoto }: { modele: Modele; page: number; avecPhoto: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const fmt = FORMATS[modele.format_id] ?? FORMATS["ig-portrait"];
  const W = 300, H = Math.round((W * fmt.h) / fmt.w);
  const els = modele.pages[page]?.elements ?? [];

  React.useEffect(() => {
    let vivant = true;
    (async () => {
      const out = await renderTemplateVisual({
        elements: els, sourceFormat: fmt,
        photoUrl: avecPhoto ? PHOTO_TEMOIN : null,
        w: W * 2, h: H * 2,
      });
      if (vivant) setUrl(out);
    })();
    return () => { vivant = false; };
  }, [els, fmt, avecPhoto, H]);

  return (
    <div style={{ width: W, height: H, background: modele.background_style.color, border: "1px solid var(--line,#ddd)", borderRadius: 8, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="modèle reconstruit" style={{ width: "100%", height: "100%" }} /> : null}
    </div>
  );
}

export default function BancImport() {
  const [modele, setModele] = useState<Modele | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [source, setSource] = useState<any[] | null>(null);
  const [page, setPage] = useState(0);
  const [avecPhoto, setAvecPhoto] = useState(true);
  const [etat, setEtat] = useState("");
  const [err, setErr] = useState("");
  const [nomFichier, setNomFichier] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const envoyer = useCallback(async (f: File) => {
    setErr(""); setModele(null); setSource(null); setPage(0);
    setNomFichier(f.name);
    setEtat("lecture du PDF…");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/canva/import-pdf", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "import refusé");
      setModele(j.template); setSource(j.source);
      setEtat("");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e)); setEtat("");
    }
  }, []);

  const rapport = modele?.rapport;
  const conf = rapport?.confiance ?? 0;
  const couleurConf = conf >= 0.8 ? "#1a7f37" : conf >= 0.5 ? "#bf8700" : "#cf222e";

  return (
    <main style={{ padding: 24, maxWidth: 1180, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Banc de l&apos;import Canva</h1>
      <p style={{ margin: "0 0 6px", opacity: 0.75, fontSize: 14, maxWidth: 780 }}>
        L&apos;API de Canva ne donne pas le contenu d&apos;un design. Le seul chemin vers la structure
        est l&apos;export PDF, qui garde le texte comme texte. Cette page mesure ce qu&apos;on en récupère
        vraiment, sans qu&apos;aucune intégration Canva n&apos;ait besoin d&apos;exister.
      </p>
      <p style={{ margin: "0 0 20px", fontSize: 13.5, opacity: 0.9 }}>
        Dans Canva : <strong>Partager &gt; Télécharger &gt; PDF standard</strong>, sans cocher
        « aplatir le PDF ». Puis déposer le fichier ici.
      </p>

      <section
        style={{ ...card, marginBottom: 20, borderStyle: "dashed", textAlign: "center", padding: 28, cursor: "pointer" }}
        onClick={() => input.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) envoyer(f); }}
      >
        <input ref={input} type="file" accept="application/pdf,.pdf" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) envoyer(f); }} />
        <p style={{ margin: 0, fontSize: 15 }}>
          {etat ? etat : nomFichier ? `${nomFichier} · cliquer pour en essayer un autre` : "Déposer un PDF, ou cliquer pour en choisir un"}
        </p>
        {err && <p style={{ margin: "8px 0 0", color: "#cf222e", fontSize: 13 }}>{err}</p>}
      </section>

      {modele && rapport && (
        <>
          <section style={{ ...card, marginBottom: 20, display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ minWidth: 200 }}>
              <p style={{ ...mono, fontSize: 11, opacity: 0.6, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: ".08em" }}>Confiance</p>
              <p style={{ margin: 0, fontSize: 34, fontWeight: 800, color: couleurConf }}>{Math.round(conf * 100)} %</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.7 }}>
                {conf >= 0.8 ? "Exploitable comme modèle."
                  : conf >= 0.5 ? "Utilisable, à relire bloc par bloc."
                    : "À garder en simple référence, pas en modèle."}
              </p>
            </div>
            <div style={{ ...mono, fontSize: 12.5, lineHeight: 1.8 }}>
              <div>format retenu : <strong>{modele.format_id}</strong> · {modele.pages.length} page(s)</div>
              <div>{rapport.runs} morceaux de texte regroupés en <strong>{rapport.blocs} blocs</strong></div>
              <div>{rapport.aplats} aplat(s) · {rapport.zonesPhoto} zone(s) photo</div>
              <div>polices : {rapport.polices.join(", ") || "aucune identifiée"}</div>
              <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 2 }}>
                couleurs : {rapport.couleurs.map(c => <Pastille key={c} hex={c} />)}
              </div>
            </div>
          </section>

          {rapport.pertes.length > 0 && (
            <section style={{ ...card, marginBottom: 20, borderColor: "#e0b000" }}>
              <p style={{ ...mono, fontSize: 11, opacity: 0.6, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".08em" }}>Ce qui n&apos;a pas suivi</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
                {rapport.pertes.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </section>
          )}

          <section style={{ ...card, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 14, margin: 0 }}>Modèle reconstruit</h2>
              <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 5 }}>
                <input type="checkbox" checked={avecPhoto} onChange={e => setAvecPhoto(e.target.checked)} />
                remplir les zones photo
              </label>
              {modele.pages.length > 1 && (
                <div style={{ display: "flex", gap: 5 }}>
                  {modele.pages.map((_, i) => (
                    <button key={i} onClick={() => setPage(i)}
                      style={{ padding: "3px 9px", fontSize: 12, cursor: "pointer", borderRadius: 4, border: "1px solid var(--line,#ddd)", background: page === i ? "var(--leaf,#111)" : "transparent", color: page === i ? "var(--mint-ink,#fff)" : "inherit" }}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <Rendu modele={modele} page={page} avecPhoto={avecPhoto} />
                <p style={{ ...mono, fontSize: 10.5, opacity: 0.55, margin: "6px 0 0" }}>
                  rendu par renderTemplateVisual, comme dans l&apos;éditeur
                </p>
              </div>
              <div style={{ flex: 1, minWidth: 380 }}>
                <p style={{ ...mono, fontSize: 11, opacity: 0.6, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".08em" }}>Calques produits</p>
                <table style={{ ...mono, fontSize: 11.5, borderCollapse: "collapse", width: "100%" }}>
                  <tbody>
                    {(modele.pages[page]?.elements ?? []).map((e, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--line,#eee)" }}>
                        <td style={{ padding: "4px 8px 4px 0", opacity: 0.6 }}>{e.type}</td>
                        <td style={{ padding: "4px 8px 4px 0" }}>
                          {e.type === "text" ? <span>{JSON.stringify(String(e.text).slice(0, 42))}</span>
                            : e.type === "rect" ? <Pastille hex={e.fill} />
                              : <span style={{ opacity: 0.6 }}>zone photo</span>}
                        </td>
                        <td style={{ padding: "4px 8px 4px 0", opacity: 0.7 }}>{e.x},{e.y}</td>
                        <td style={{ padding: "4px 8px 4px 0", opacity: 0.7 }}>
                          {e.type === "text" ? `${e.fontSize}px` : `${e.width}x${e.height}`}
                        </td>
                        <td style={{ padding: "4px 0", fontWeight: 700, color: e.role ? "#1a7f37" : undefined }}>
                          {e.role ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: 11.5, opacity: 0.6, marginTop: 10 }}>
                  Le rôle en vert est ce qui rend le modèle utile : c&apos;est lui que le
                  compositeur remplira. Un modèle importé sans rôle serait un dessin figé.
                </p>
              </div>
            </div>
          </section>

          {source && (
            <section style={card}>
              <p style={{ ...mono, fontSize: 11, opacity: 0.6, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".08em" }}>Ce que le fichier contenait</p>
              <table style={{ ...mono, fontSize: 12, borderCollapse: "collapse" }}>
                <tbody>
                  {source.map((p, i) => (
                    <tr key={i}>
                      <td style={{ padding: "2px 14px 2px 0", opacity: 0.6 }}>page {i + 1}</td>
                      <td style={{ padding: "2px 14px 2px 0" }}>{Math.round(p.width)} x {Math.round(p.height)} pt</td>
                      <td style={{ padding: "2px 14px 2px 0" }}>{p.textes} morceaux de texte</td>
                      <td style={{ padding: "2px 14px 2px 0" }}>{p.aplats} aplats</td>
                      <td style={{ padding: "2px 0" }}>{p.images} images</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </main>
  );
}
