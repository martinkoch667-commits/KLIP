"use client";

/* Banc d'essai de la LECTURE des médias : page temporaire, hors du produit.
 *
 * Le monteur lisait tout à travers des éléments <video> et <audio>. Chrome en
 * refuse la création au delà d'une cinquantaine par onglet, et passé ce seuil
 * des sources cessent de charger sans rien dire. C'est la cause de fond de
 * l'instabilité sur un gros montage.
 *
 * On compare ici, sur la même source, l'ancien chemin et le nouveau :
 *   - le temps que prend l'opération
 *   - les OCTETS RÉELLEMENT TÉLÉCHARGÉS (le nouveau chemin lit par plages)
 *   - le nombre de lecteurs média créés (le nouveau n'en crée aucun)
 */

import React, { useCallback, useEffect, useState } from "react";
import { lectureRapideDisponible, infosVideo, dureeAudio, vignettes, picsAudio, fermerSources } from "../workspace/[id]/montage/[postId]/media-read";
import { analyzeClipQuality } from "../workspace/[id]/montage/[postId]/autoCut";

const SRC_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const SRC_AUDIO = "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";

/* Requêtes réseau émises pour cette URL depuis le début de la mesure.

   On voulait compter les OCTETS, pour montrer que la lecture par plages ne
   télécharge pas le fichier entier. Le navigateur ne les expose pas sur une
   ressource d'une autre origine sans en-tête `Timing-Allow-Origin` : la taille
   y est toujours zéro. On compte donc ce qui est visible, le nombre de requêtes,
   qui montre au moins la différence de méthode : une seule requête pour tout
   avaler, plusieurs requêtes de plage pour ne lire que l'utile. */
function requetes(url: string, depuis: number): number {
  if (typeof performance === "undefined") return 0;
  return performance.getEntriesByType("resource")
    .filter((e) => e.name.startsWith(url) && e.startTime >= depuis).length;
}

// ── Ancien chemin : un <video> jetable, repositionné vignette par vignette ────
async function vignettesAncien(src: string, instants: number[], hauteur: number) {
  const v = document.createElement("video");
  try {
    v.crossOrigin = "anonymous"; v.muted = true; v.preload = "auto"; v.src = src;
    await new Promise<void>((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error("load")); });
    const aspect = (v.videoWidth || 16) / (v.videoHeight || 9);
    const cv = document.createElement("canvas");
    cv.width = Math.round(hauteur * aspect); cv.height = hauteur;
    const ctx = cv.getContext("2d")!;
    const frames: string[] = [];
    for (const t of instants) {
      await new Promise<void>((res) => { v.onseeked = () => res(); v.currentTime = Math.min(t, (v.duration || 1) - 0.05); });
      ctx.drawImage(v, 0, 0, cv.width, cv.height);
      frames.push(cv.toDataURL("image/jpeg", 0.72));
    }
    return { frames, aspect };
  } finally {
    try { v.pause(); v.removeAttribute("src"); v.load(); } catch { /* déjà libéré */ }
  }
}

// ── Ancien chemin audio : le fichier ENTIER téléchargé puis décodé d'un bloc ──
async function picsAncien(src: string, parSeconde: number) {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const ab = await (await fetch(src)).arrayBuffer();
  const buf = await ctx.decodeAudioData(ab);
  const data = buf.getChannelData(0);
  const n = Math.max(120, Math.round(buf.duration * parSeconde));
  const bloc = Math.max(1, Math.floor(data.length / n));
  const pics: number[] = [];
  for (let i = 0; i < n; i++) {
    let m = 0; const s = i * bloc;
    for (let j = 0; j < bloc && s + j < data.length; j += 4) m = Math.max(m, Math.abs(data[s + j]));
    pics.push(m);
  }
  ctx.close();
  const max = Math.max(...pics, 0.01);
  return pics.map((p) => Math.round(Math.min(1, p / max) * 100) / 100);
}

interface Ligne { nom: string; chemin: string; ms: number; octets: number; detail: string; erreur?: string }

export default function BancLecture() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <BancLectureDev />;
}

function BancLectureDev() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [dispo, setDispo] = useState<boolean | null>(null);
  const [apercu, setApercu] = useState<string[]>([]);
  useEffect(() => { setDispo(lectureRapideDisponible()); return () => fermerSources(); }, []);

  const mesurer = useCallback(async (nom: string, chemin: string, url: string, f: () => Promise<string>) => {
    const t0 = performance.now();
    const depuis = performance.now();
    try {
      const detail = await f();
      setLignes((l) => [...l, { nom, chemin, ms: performance.now() - t0, octets: requetes(url, depuis), detail }]);
    } catch (e) {
      setLignes((l) => [...l, { nom, chemin, ms: performance.now() - t0, octets: 0, detail: "", erreur: String(e) }]);
    }
  }, []);

  async function lancer() {
    setEnCours(true); setLignes([]); setApercu([]);
    const instants = [0.2, 0.8, 1.5, 2.2, 3, 3.7, 4.4, 4.9];

    await mesurer("vignettes (8 images)", "ancien : élément <video>", SRC_VIDEO, async () => {
      const r = await vignettesAncien(SRC_VIDEO, instants, 120);
      return `${r.frames.length} images, ratio ${r.aspect.toFixed(2)}`;
    });
    await mesurer("vignettes (8 images)", "nouveau : décodage direct", SRC_VIDEO, async () => {
      const r = await vignettes(SRC_VIDEO, instants, 120);
      if (!r) throw new Error("lecture impossible");
      setApercu(r.frames);
      return `${r.frames.length} images, ratio ${r.aspect.toFixed(2)}`;
    });

    await mesurer("spectre audio", "ancien : fichier entier décodé", SRC_AUDIO, async () => {
      const p = await picsAncien(SRC_AUDIO, 30);
      return `${p.length} mesures`;
    });
    await mesurer("spectre audio", "nouveau : décodage au fil", SRC_AUDIO, async () => {
      const p = await picsAudio(SRC_AUDIO, 30, 9000);
      if (!p) throw new Error("lecture impossible");
      return `${p.length} mesures`;
    });

    await mesurer("métadonnées vidéo", "nouveau : sans lecteur média", SRC_VIDEO, async () => {
      const i = await infosVideo(SRC_VIDEO);
      if (!i) throw new Error("lecture impossible");
      return `durée ${i.dur.toFixed(2)} s, ratio ${i.aspect.toFixed(2)}`;
    });
    await mesurer("métadonnées audio", "nouveau : sans lecteur média", SRC_AUDIO, async () => {
      const d = await dureeAudio(SRC_AUDIO);
      if (!d) throw new Error("lecture impossible");
      return `durée ${d.toFixed(2)} s`;
    });

    // Le prémontage analyse TOUS les plans : c'est lui qui créait le plus de
    // lecteurs média d'un coup. On vérifie qu'il rend toujours un verdict sensé.
    const resume = (r: Awaited<ReturnType<typeof analyzeClipQuality>>) => {
      const ok = r.samples.filter((x) => x.ok).length;
      const pourquoi: Record<string, number> = {};
      for (const x of r.samples) if (x.why) pourquoi[x.why] = (pourquoi[x.why] ?? 0) + 1;
      const moy = (a: number[]) => a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0;
      return `${r.samples.length} éch., ${ok} ok, ${JSON.stringify(pourquoi)}, `
        + `lum ${moy(r.samples.map((x) => x.lum)).toFixed(3)}, `
        + `netteté ${moy(r.samples.map((x) => x.sharp)).toFixed(4)}, `
        + `mvt ${moy(r.samples.map((x) => x.diff)).toFixed(4)}`;
    };
    await mesurer("analyse de qualité d'image", "ancien : élément <video>", SRC_VIDEO, async () =>
      resume(await analyzeClipQuality(SRC_VIDEO, 0, 5, { step: 0.3, maxSamples: 20, legacy: true })));
    await mesurer("analyse de qualité d'image", "nouveau : décodage direct", SRC_VIDEO, async () => {
      const r = await analyzeClipQuality(SRC_VIDEO, 0, 5, { step: 0.3, maxSamples: 20 });
      // Le détail des verdicts dit d'où vient un rejet : un « noir » partout
      // voudrait dire que les images arrivent vides, donc que la lecture est
      // cassée ; un « flou » partout peut être un jugement sur le contenu. Seule
      // la comparaison avec l'ancien chemin, sur la MÊME source, tranche.
      return resume(r);
    });

    setEnCours(false);
  }

  const th: React.CSSProperties = { textAlign: "left", borderBottom: "2px solid #ddd", padding: "6px 10px", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { borderBottom: "1px solid #eee", padding: "6px 10px" };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, color: "#111" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Banc d&apos;essai : lire un média sans lecteur</h1>
      <p style={{ color: "#555", maxWidth: 780 }}>
        Décodage direct {dispo === null ? "…" : dispo ? "disponible" : "INDISPONIBLE (repli sur l'ancien chemin)"}.
        L&apos;ancien chemin crée un lecteur média et avale la source entière ; le nouveau
        décode sans lecteur et ne lit que les plages utiles du fichier.
      </p>
      <button onClick={lancer} disabled={enCours} style={{ padding: "6px 12px", border: "1px solid #ccc", borderRadius: 6, background: "#fff", cursor: "pointer", margin: "16px 0" }}>
        {enCours ? "mesure en cours…" : "Comparer ancien / nouveau"}
      </button>

      <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr>{["opération", "chemin", "durée", "requêtes réseau", "résultat"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {lignes.map((r, i) => (
            <tr key={i} style={{ background: r.erreur ? "#fee" : r.chemin.startsWith("nouveau") ? "#efe" : undefined }}>
              <td style={td}>{r.nom}</td>
              <td style={td}>{r.chemin}</td>
              <td style={td}>{r.ms.toFixed(0)} ms</td>
              <td style={td}>{r.octets || "—"}</td>
              <td style={td}>{r.erreur ? <span style={{ color: "#900" }}>{r.erreur}</span> : r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {apercu.length > 0 && (
        <>
          <p style={{ marginTop: 20, fontWeight: 700, fontSize: 13 }}>Vignettes produites par le nouveau chemin</p>
          <div style={{ display: "flex", gap: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {apercu.map((u, i) => <img key={i} src={u} alt="" style={{ height: 90, display: "block" }} />)}
          </div>
        </>
      )}
    </div>
  );
}
