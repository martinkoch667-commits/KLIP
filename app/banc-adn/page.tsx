"use client";

/* Banc d'essai de l'ADN visuel : réservé au développement.
 *
 * Il fait tourner la chaîne complète, exactement celle de la production :
 *   images  ->  measureFeed (mesure déterministe, aucun modèle)
 *           ->  buildContactSheet (la planche que le modèle regarde)
 *           ->  /api/brand-dna (la lecture)
 *           ->  /api/brand-dna/templates (les modèles de départ)
 *           ->  renderTemplateVisual (le rendu, celui de l'éditeur)
 *
 * Trois sources d'images, pour pouvoir juger sans dépendre d'un compte connecté :
 *  · un workspace réel, dont on lit le fil Instagram ;
 *  · des adresses collées à la main (le fil public de n'importe quelle marque) ;
 *  · les six photos locales du banc, qui servent de témoin.
 *
 * Ce qu'on vient vérifier ici, et c'est la seule question qui compte : est-ce
 * que la mesure retrouve la charte de la marque, ou est-ce qu'elle rend les
 * couleurs de ses photos ?
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { measureFeed, buildContactSheet, type BrandDNA, type FeedMetrics } from "@/lib/brandDNA";
import { renderTemplateVisual } from "@/lib/composeRender";

const PHOTOS_TEMOIN = [
  "/banc-photos/produit-sombre-1.jpg",
  "/banc-photos/produit-sombre-2.jpg",
  "/banc-photos/produit-carre.jpg",
  "/banc-photos/studio-box.jpg",
  "/banc-photos/ugc-mains.jpg",
  "/banc-photos/ugc-visage.jpg",
];

interface Proposition {
  recipeId: string; name: string; intention: string; family: string;
  format_id: string; sourceFormat: { w: number; h: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements: any[];
}

const mono: React.CSSProperties = { fontFamily: "var(--mono, ui-monospace, monospace)" };
const card: React.CSSProperties = { border: "1px solid var(--line, #ddd)", borderRadius: 10, padding: 16, background: "var(--surface, #fff)" };

function Pastille({ hex, size = 22 }: { hex: string; size?: number }) {
  return <span title={hex} style={{ display: "inline-block", width: size, height: size, borderRadius: 4, background: hex, border: "1px solid rgba(0,0,0,.15)", verticalAlign: "middle" }} />;
}

function TablePalette({ m }: { m: FeedMetrics }) {
  return (
    <table style={{ ...mono, fontSize: 12, borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr style={{ textAlign: "left", opacity: 0.6 }}>
          <th style={{ padding: "3px 8px 3px 0" }}></th>
          <th style={{ padding: "3px 8px 3px 0" }}>hex</th>
          <th style={{ padding: "3px 8px 3px 0" }}>part</th>
          <th style={{ padding: "3px 8px 3px 0" }}>posts</th>
          <th style={{ padding: "3px 8px 3px 0" }}>sat</th>
          <th style={{ padding: "3px 8px 3px 0" }}>plat</th>
        </tr>
      </thead>
      <tbody>
        {m.colors.map((c) => {
          const signe = m.signature.some((s) => s.hex === c.hex);
          return (
            <tr key={c.hex} style={{ opacity: signe ? 1 : 0.55 }}>
              <td style={{ padding: "3px 8px 3px 0" }}><Pastille hex={c.hex} /></td>
              <td style={{ padding: "3px 8px 3px 0", fontWeight: signe ? 700 : 400 }}>{c.hex}</td>
              <td style={{ padding: "3px 8px 3px 0" }}>{(c.share * 100).toFixed(1)} %</td>
              <td style={{ padding: "3px 8px 3px 0" }}>{c.posts}/{m.read}</td>
              <td style={{ padding: "3px 8px 3px 0" }}>{c.sat.toFixed(2)}</td>
              <td style={{ padding: "3px 8px 3px 0", color: c.flat >= 0.3 ? "#1a7f37" : undefined }}>{c.flat.toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Vignette({ p, w = 240 }: { p: Proposition; w?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const h = Math.round((w * p.sourceFormat.h) / p.sourceFormat.w);
  useEffect(() => {
    let vivant = true;
    (async () => {
      const out = await renderTemplateVisual({
        elements: p.elements, sourceFormat: p.sourceFormat,
        photoUrl: PHOTOS_TEMOIN[0], w: w * 2, h: h * 2,
      });
      if (vivant) setUrl(out);
    })();
    return () => { vivant = false; };
  }, [p, w, h]);
  return (
    <div style={{ width: w }}>
      <div style={{ width: w, height: h, background: "#eee", borderRadius: 8, overflow: "hidden", border: "1px solid var(--line,#ddd)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 700 }}>{p.name}</p>
      <p style={{ margin: "1px 0 0", fontSize: 11.5, opacity: 0.7 }}>{p.intention}</p>
      <p style={{ ...mono, margin: "2px 0 0", fontSize: 10.5, opacity: 0.5 }}>{p.recipeId} · {p.family}</p>
    </div>
  );
}

export default function BancADN() {
  const [source, setSource] = useState<"temoin" | "urls" | "workspace">("temoin");
  const [urls, setUrls] = useState<string>("");
  const [wsId, setWsId] = useState<string>("");
  const [nom, setNom] = useState<string>("PEPE CHICKEN");
  const [secteur, setSecteur] = useState<string>("Restaurant");

  const [images, setImages] = useState<string[]>(PHOTOS_TEMOIN);
  const [sheet, setSheet] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<FeedMetrics | null>(null);
  const [dna, setDna] = useState<BrandDNA | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [colorway, setColorway] = useState<any>(null);
  const [props_, setProps] = useState<Proposition[] | null>(null);
  const [etape, setEtape] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const listeUrls = useMemo(() => {
    if (source === "temoin") return PHOTOS_TEMOIN;
    if (source === "urls") return urls.split(/\s+/).map(s => s.trim()).filter(Boolean);
    return images;
  }, [source, urls, images]);

  const chargerWorkspace = useCallback(async () => {
    setErr(""); setEtape("lecture du compte Instagram…");
    try {
      const r = await fetch(`/api/instagram/profile?workspaceId=${encodeURIComponent(wsId)}`);
      const j = await r.json();
      if (!j.connected) throw new Error("compte non connecté sur ce workspace");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = (j.media ?? []).map((m: any) => m.display_url).filter(Boolean);
      if (!list.length) throw new Error("aucun média lisible");
      setImages(list);
      if (j.name) setNom(j.name);
      setEtape("");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e)); setEtape("");
    }
  }, [wsId]);

  const lancer = useCallback(async () => {
    setErr(""); setDna(null); setProps(null); setMetrics(null); setSheet(null);
    const list = listeUrls;
    if (list.length < 3) { setErr("au moins 3 images"); return; }
    try {
      setEtape("mesure des pixels…");
      const m = await measureFeed(list);
      setMetrics(m);
      if (m.read < 3) { setErr(`seulement ${m.read} image(s) lisible(s) : le proxy a-t-il refusé ?`); setEtape(""); return; }

      setEtape("planche contact…");
      const s = await buildContactSheet(list, { cols: 4, cell: 320, max: 16 });
      setSheet(s);

      setEtape("lecture du style…");
      const r1 = await fetch("/api/brand-dna", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics: m, sheet: s, workspaceId: wsId || undefined, name: nom, sector: secteur }),
      });
      const j1 = await r1.json();
      if (!r1.ok) throw new Error(j1.error ?? "analyse refusée");
      setDna(j1.dna); setColorway(j1.colorway);

      setEtape("compositions de départ…");
      const r2 = await fetch("/api/brand-dna/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dna: j1.dna, workspaceId: wsId || undefined, name: nom, sector: secteur, count: 6 }),
      });
      const j2 = await r2.json();
      if (!r2.ok) throw new Error(j2.error ?? "proposition refusée");
      setProps(j2.templates);
      setEtape("");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e)); setEtape("");
    }
  }, [listeUrls, wsId, nom, secteur]);

  return (
    <main style={{ padding: 24, maxWidth: 1180, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Banc de l&apos;ADN visuel</h1>
      <p style={{ margin: "0 0 20px", opacity: 0.7, fontSize: 14 }}>
        La mesure remplace le tirage au sort. Aujourd&apos;hui le terrain de couleur et la typo d&apos;un
        client sont choisis par une empreinte de son NOM ; ici ils sont choisis par ce qu&apos;il publie.
      </p>

      <section style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {([["temoin", "6 photos témoin"], ["urls", "adresses collées"], ["workspace", "workspace réel"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setSource(v)}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--line,#ddd)", cursor: "pointer",
                background: source === v ? "var(--leaf, #111)" : "transparent", color: source === v ? "var(--mint-ink, #fff)" : "inherit", fontSize: 13 }}>
              {l}
            </button>
          ))}
        </div>

        {source === "urls" && (
          <textarea value={urls} onChange={e => setUrls(e.target.value)} rows={4}
            placeholder="Une adresse d'image par ligne (elles passent par /api/proxy-image)"
            style={{ width: "100%", padding: 10, fontSize: 12, ...mono, boxSizing: "border-box" }} />
        )}
        {source === "workspace" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={wsId} onChange={e => setWsId(e.target.value)} placeholder="id du workspace"
              style={{ flex: 1, padding: 8, fontSize: 12, ...mono }} />
            <button onClick={chargerWorkspace} style={{ padding: "8px 14px", cursor: "pointer" }}>charger le fil</button>
            <span style={{ fontSize: 12, opacity: 0.6 }}>{images.length} image(s)</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder="nom de la marque" style={{ padding: 8, fontSize: 13, width: 220 }} />
          <input value={secteur} onChange={e => setSecteur(e.target.value)} placeholder="secteur" style={{ padding: 8, fontSize: 13, width: 160 }} />
          <button onClick={lancer} disabled={!!etape}
            style={{ padding: "9px 18px", fontWeight: 700, cursor: etape ? "wait" : "pointer", borderRadius: 6, border: "none", background: "var(--leaf,#111)", color: "var(--mint-ink,#fff)" }}>
            analyser
          </button>
          {etape && <span style={{ fontSize: 13, opacity: 0.7 }}>{etape}</span>}
          {err && <span style={{ fontSize: 13, color: "#cf222e" }}>{err}</span>}
        </div>
      </section>

      {metrics && (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 14, margin: "0 0 10px" }}>Mesure ({metrics.read}/{metrics.postCount} lues)</h2>
            <p style={{ ...mono, fontSize: 12, margin: "0 0 10px", opacity: 0.75 }}>
              clarté {metrics.lightness.toFixed(3)} · contraste {metrics.contrast.toFixed(3)} · saturation {metrics.saturation.toFixed(3)}
            </p>
            <TablePalette m={metrics} />
            <p style={{ fontSize: 11.5, opacity: 0.6, marginTop: 10 }}>
              En clair : les couleurs de signature. Une couleur « plate » est un aplat de marque,
              une couleur étalée est un dégradé de photo.
            </p>
          </div>
          <div style={card}>
            <h2 style={{ fontSize: 14, margin: "0 0 10px" }}>Planche contact</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {sheet ? <img src={sheet} alt="planche" style={{ width: "100%", borderRadius: 6 }} /> : <p style={{ fontSize: 13, opacity: 0.6 }}>non construite</p>}
          </div>
        </section>
      )}

      {dna && (
        <section style={{ ...card, marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, margin: "0 0 10px" }}>Ce que KLIP a lu</h2>
          <p style={{ fontSize: 14, margin: "0 0 12px" }}>{dna.summary}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14, fontSize: 13 }}>
            <div>
              <strong>Charte proposée</strong>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {dna.brandColors.map(h => <span key={h} style={{ ...mono, fontSize: 11 }}><Pastille hex={h} /> {h}</span>)}
              </div>
            </div>
            <div>
              <strong>Terrain</strong>
              <p style={{ margin: "6px 0 0" }}>
                {colorway ? <>{colorway.name} <Pastille hex={colorway.paper} size={16} /> <Pastille hex={colorway.ink} size={16} /> <Pastille hex={colorway.accent} size={16} /></> : "aucun"}
              </p>
              <p style={{ ...mono, fontSize: 10.5, opacity: 0.55, margin: "4px 0 0" }}>{dna.colorwayWhy}</p>
            </div>
            <div>
              <strong>Typographie</strong>
              <p style={{ margin: "6px 0 0" }}>{dna.typeIdentityId} <span style={{ opacity: 0.6 }}>(registre lu : {dna.register})</span></p>
            </div>
            <div>
              <strong>Personnalité</strong>
              <p style={{ margin: "6px 0 0" }}>{dna.vibes.join(", ")}</p>
            </div>
            <div>
              <strong>Où elle écrit</strong>
              <p style={{ margin: "6px 0 0" }}>texte sur photo : {dna.textOnPhoto}{dna.zones.length ? ` · zones ${dna.zones.join(", ")}` : ""}</p>
              <p style={{ margin: "2px 0 0", opacity: 0.7 }}>familles : {dna.families.join(", ") || "aucune"}</p>
            </div>
          </div>
          {dna.motifs.length > 0 && (
            <p style={{ fontSize: 13, marginTop: 14 }}><strong>Gestes qui reviennent :</strong> {dna.motifs.join(" · ")}</p>
          )}
          {dna.gaps.length > 0 && (
            <p style={{ fontSize: 13, marginTop: 4 }}><strong>Ce qui manque :</strong> {dna.gaps.join(" · ")}</p>
          )}
        </section>
      )}

      {props_ && (
        <section style={card}>
          <h2 style={{ fontSize: 14, margin: "0 0 14px" }}>Modèles de départ proposés ({props_.length})</h2>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {props_.map(p => <Vignette key={p.recipeId} p={p} />)}
          </div>
        </section>
      )}
    </main>
  );
}
