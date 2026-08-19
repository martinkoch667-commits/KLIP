"use client";

/* Banc d'essai de l'export vidéo : page temporaire, hors du produit.

   Ne pas corriger l'export à l'aveugle : la méthode qui a marché est de mesurer.
   Cette page construit un montage de test sur une vidéo publique servie avec
   CORS, appelle le VRAI renderExport, puis inspecte le fichier produit :

     - durée annoncée par le conteneur contre durée de la timeline
     - nombre d'images DISTINCTES, prélevées par déplacement (currentTime +
       seeked) : play() ne peint rien sur un élément détaché du document
     - plus longue suite d'images identiques (un gel se voit là et nulle part ailleurs)
     - poids du fichier et type MIME réellement produit

   Le dossier ne commence pas par « _ » : Next ignorerait la route. */

import { useCallback, useEffect, useRef, useState } from "react";
import { renderExport, renderExportTempsReel } from "../workspace/[id]/montage/[postId]/export";
import { exportOfflineDisponible } from "../workspace/[id]/montage/[postId]/export-offline";
import { MontageClip, OverlayClip, AudioTrack, Caption, TitleEl } from "../workspace/[id]/montage/[postId]/constants";

// Vidéo publique servie avec CORS. Durée réelle mesurée : 5,055 s, 960x540.
// Les rognages ci-dessous restent DANS ces bornes : une source qu'on dépasse
// rend une image figée pour de bonnes raisons, et le banc mesurerait alors son
// propre défaut de fixture plutôt que celui de l'export.
const SRC_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const SRC_DUR = 5.05;
const SRC_AUDIO = "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";

function clip(over: Partial<MontageClip> & { id: string }): MontageClip {
  return {
    kind: "video", name: over.id, src: SRC_VIDEO, srcDur: SRC_DUR,
    trimStart: 0, trimEnd: 1.6, speed: 1, filterId: "none", lum: 0, con: 0, sat: 0,
    transitionIn: "cut", transitionDur: 0, vol: 1, ...over,
  } as MontageClip;
}

// Montages de test. Chacun vise une chose que l'export ratait.
function montages() {
  return {
    "court, 3 plans, coupe franche": {
      clips: [
        clip({ id: "a", trimStart: 0, trimEnd: 1.6 }),
        clip({ id: "b", trimStart: 1.6, trimEnd: 3.2 }),
        clip({ id: "c", trimStart: 3.2, trimEnd: 4.8 }),
      ],
      captions: [] as Caption[], titles: [] as TitleEl[], audioTracks: [] as AudioTrack[],
    },
    "fondu enchaîné + vitesse": {
      clips: [
        clip({ id: "a", trimStart: 0, trimEnd: 2 }),
        clip({ id: "b", trimStart: 1.5, trimEnd: 3.5, transitionIn: "fade", transitionDur: 0.6 }),
        clip({ id: "c", trimStart: 2, trimEnd: 5, speed: 2 }),
      ],
      captions: [] as Caption[], titles: [] as TitleEl[], audioTracks: [] as AudioTrack[],
    },
    "sous-titres, titre, écran noir, piste audio": {
      clips: [
        clip({ id: "a", trimStart: 0, trimEnd: 2 }),
        clip({ id: "b", trimStart: 2, trimEnd: 5, gapBefore: 1 }),  // 2 + 1 + 3 = 6 s
      ],
      captions: [
        { id: "s1", start: 0.2, end: 1.9, text: "un banc qui mesure vraiment" },
        { id: "s2", start: 3.2, end: 5.5, text: "et pas seulement qui rassure" },
      ] as unknown as Caption[],
      // Titre volontairement long : l'export l'écrivait sur une seule ligne, hors
      // du cadre. Il doit maintenant se replier à la largeur demandée.
      titles: [{ id: "t1", text: "UN TITRE ASSEZ LONG POUR REVENIR A LA LIGNE", start: 0, end: 6, x: 50, y: 22, color: "#fff", font: "archivo", anim: "rise", scale: 1, rotation: 0, maxWidth: 80 }] as unknown as TitleEl[],
      audioTracks: [{ id: "m1", kind: "music", name: "test", src: SRC_AUDIO, dur: 6, vol: 0.6, offset: 0, fadeIn: 0.5, fadeOut: 0.5 }] as AudioTrack[],
    },
    "incrustation (PIP) + barre": {
      clips: [
        clip({ id: "a", trimStart: 0, trimEnd: 2.5 }),
        clip({ id: "b", trimStart: 2.5, trimEnd: 5 }),
      ],
      overlays: [{
        id: "o1", kind: "video", name: "pip", src: SRC_VIDEO, srcDur: SRC_DUR,
        trimStart: 1, trimEnd: 4, offset: 1, track: 0,
        x: 70, y: 30, scale: 0.6, rotation: 8, opacity: 0.9,
        filterId: "none", lum: 0, con: 0, sat: 0, vol: 0.5,
        // Effets activés : l'incrustation passe par le chemin de composition
        // (aplatissement, coins arrondis, contour), pas par le chemin direct.
        shadow: true, shadowColor: "#000000", shadowBlur: 7, shadowX: 2, shadowY: 3,
        shadowOpacity: 0.5, outlineW: 2, outlineColor: "#FFFFFF", radius: 6,
      }] as OverlayClip[],
      captions: [] as Caption[], titles: [] as TitleEl[], audioTracks: [] as AudioTrack[],
    },
    "montage long (60 s)": {
      clips: Array.from({ length: 30 }, (_, i) =>
        clip({ id: `l${i}`, trimStart: (i % 3) * 1.5, trimEnd: (i % 3) * 1.5 + 2 })),
      captions: [] as Caption[], titles: [] as TitleEl[], audioTracks: [] as AudioTrack[],
    },
  };
}

/** Empreinte d'une image : 32x32 en niveaux de gris sur 64 paliers. Assez fine
 *  pour distinguer deux images voisines d'une vidéo, assez grossière pour ne pas
 *  compter le bruit d'encodage comme un changement. */
const EMP = 32;
/* La barre de progression avance à chaque image : incluse dans l'empreinte, elle
   ferait passer une image RIGOUREUSEMENT FIGÉE pour une image nouvelle, et le
   banc validerait précisément le défaut qu'il est censé attraper. On n'empreinte
   donc que les 90 % du haut du cadre. */
const EMP_HAUT = 0.9;
function empreinte(ctx: CanvasRenderingContext2D): string {
  const d = ctx.getImageData(0, 0, EMP, EMP).data;
  let s = "";
  for (let i = 0; i < d.length; i += 4) {
    s += String.fromCharCode(48 + Math.round(((d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255) * 63));
  }
  return s;
}

interface Mesure {
  nom: string;
  timeline: number;
  duree: number;
  poidsMo: number;
  mime: string;
  echantillons: number;
  distinctes: number;
  plusLongGel: number;
  gelAt: number;
  secondes: number;
  cache: number;   // fraction du rendu passée onglet caché
  audioSec: number;
  audioCrete: number;
  erreur?: string;
}

export default function BancExport() {
  // Outil de développement : la route existe en production (Next la construit),
  // mais elle n'y sert à rien et n'a rien à y faire.
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <BancExportDev />;
}

function BancExportDev() {
  const [mesures, setMesures] = useState<Mesure[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [avance, setAvance] = useState(0);
  const [urls, setUrls] = useState<Record<string, string>>({});
  // Calculé après montage : WebCodecs n'existe pas côté serveur, et l'afficher
  // pendant le rendu serveur cassait l'hydratation (donc tous les boutons).
  const [offline, setOffline] = useState<boolean | null>(null);
  // ?repli=1 force l'ancien chemin (captation temps réel). Sans ça on ne saurait
  // pas si le repli marche encore : il ne s'exécute jamais sur cette machine.
  const [repli, setRepli] = useState(false);
  useEffect(() => {
    setOffline(exportOfflineDisponible());
    setRepli(new URLSearchParams(window.location.search).get("repli") === "1");
  }, []);
  const stop = useRef(false);

  const mesurer = useCallback(async (nom: string, m: ReturnType<typeof montages>[keyof ReturnType<typeof montages>]) => {
    setEnCours(nom);
    setAvance(0);
    const t0 = performance.now();
    /* Combien de temps l'onglet a-t-il été caché pendant le rendu ?
       C'est LA mesure qui manquait : le navigateur bride les minuteurs d'un
       onglet en arrière-plan, l'ancien chemin y perdait ses images, et un banc
       qui ne le note pas conclut trop vite. */
    let tCache = 0, dernier = performance.now(), cacheAvant = document.hidden;
    const surVisibilite = () => {
      const now = performance.now();
      if (cacheAvant) tCache += now - dernier;
      dernier = now; cacheAvant = document.hidden;
    };
    document.addEventListener("visibilitychange", surVisibilite);
    try {
      const timeline = m.clips.reduce((a, c) => a + Math.max(0, c.gapBefore ?? 0) + (c.trimEnd - c.trimStart) / (c.kind === "video" ? c.speed : 1), 0);
      const rendu = repli ? renderExportTempsReel : renderExport;
      const { blob, mimeType } = await rendu(
        {
          clips: m.clips, overlays: ("overlays" in m ? m.overlays : []) as OverlayClip[], captions: m.captions, subStyleId: "classic",
          titles: m.titles, stickers: [], audioTracks: m.audioTracks,
          showProgressBar: true, formatId: "story", exportQuality: "standard",
        },
        (p) => setAvance(p),
      );
      surVisibilite();
      const secondes = (performance.now() - t0) / 1000;
      const cache = tCache / Math.max(1, performance.now() - t0);
      const url = URL.createObjectURL(blob);
      setUrls((u) => ({ ...u, [nom]: url }));

      // Lecture du fichier produit.
      const v = document.createElement("video");
      v.src = url; v.muted = true; v.preload = "auto";
      await new Promise<void>((res, rej) => {
        v.onloadedmetadata = () => res();
        v.onerror = () => rej(new Error("le fichier produit est illisible"));
      });
      // Durée « Infinity » : conteneur sans index, on force la lecture au bout.
      let duree = v.duration;
      if (!isFinite(duree)) {
        await new Promise<void>((res) => { v.onseeked = () => res(); v.currentTime = 1e6; });
        duree = v.currentTime;
      }

      // Prélèvement par déplacement, deux images par seconde.
      const cv = document.createElement("canvas");
      cv.width = EMP; cv.height = EMP;
      const cx = cv.getContext("2d", { willReadFrequently: true })!;
      const pas = 0.5;
      const emps: string[] = [];
      for (let t = 0; t < Math.max(0, duree - 0.05); t += pas) {
        await new Promise<void>((res) => {
          let fini = false;
          const fin = () => { if (fini) return; fini = true; v.removeEventListener("seeked", fin); res(); };
          v.addEventListener("seeked", fin);
          v.currentTime = t;
          setTimeout(fin, 3000);
        });
        cx.drawImage(v, 0, 0, v.videoWidth, Math.round(v.videoHeight * EMP_HAUT), 0, 0, EMP, EMP);
        emps.push(empreinte(cx));
      }
      /* La piste audio du fichier produit, vraiment décodée.
         Un export peut être parfait à l'image et muet : c'est arrivé, et ça ne
         se voit sur aucune mesure d'image. On décode donc le son du fichier et
         on regarde deux choses : sa durée (elle doit couvrir la timeline) et son
         niveau crête (zéro = piste présente mais vide). */
      let audioSec = 0, audioCrete = 0;
      try {
        const ac = new OfflineAudioContext(1, 1024, 48000);
        const ab = await ac.decodeAudioData(await blob.arrayBuffer());
        audioSec = ab.duration;
        const ch = ab.getChannelData(0);
        for (let i = 0; i < ch.length; i += 7) audioCrete = Math.max(audioCrete, Math.abs(ch[i]));
      } catch { /* pas de piste audio décodable */ }

      let plusLongGel = 1, courant = 1, gelAt = 0;
      for (let i = 1; i < emps.length; i++) {
        courant = emps[i] === emps[i - 1] ? courant + 1 : 1;
        if (courant > plusLongGel) { plusLongGel = courant; gelAt = (i - courant + 1) * pas; }
      }

      setMesures((r) => [...r, {
        nom, timeline, duree, poidsMo: blob.size / 1048576, mime: mimeType,
        echantillons: emps.length, distinctes: new Set(emps).size,
        plusLongGel: plusLongGel * pas, gelAt, secondes, cache, audioSec, audioCrete,
      }]);
    } catch (e) {
      setMesures((r) => [...r, {
        nom, timeline: 0, duree: 0, poidsMo: 0, mime: "", echantillons: 0,
        distinctes: 0, plusLongGel: 0, gelAt: 0, secondes: (performance.now() - t0) / 1000,
        cache: 0, audioSec: 0, audioCrete: 0, erreur: String(e),
      }]);
    } finally {
      document.removeEventListener("visibilitychange", surVisibilite);
      setEnCours(null);
    }
  }, [repli]);

  async function tout() {
    stop.current = false;
    setMesures([]);
    const all = montages();
    for (const [nom, m] of Object.entries(all)) {
      if (stop.current) break;
      await mesurer(nom, m);
    }
  }

  const M = montages();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 1000, margin: "0 auto", color: "#111" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Banc d&apos;essai de l&apos;export</h1>
      <p style={{ color: "#555" }}>
        Chemin hors temps réel {offline === null ? "…" : offline ? "disponible" : "INDISPONIBLE (repli captation)"}.
        {repli && <b> Forcé sur le repli temps réel (?repli=1).</b>}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <button onClick={tout} disabled={!!enCours} style={btn}>Tout mesurer</button>
        {Object.keys(M).map((nom) => (
          <button key={nom} onClick={() => mesurer(nom, M[nom as keyof typeof M])} disabled={!!enCours} style={btn}>{nom}</button>
        ))}
        <button onClick={() => { stop.current = true; }} style={btn}>Arrêter la série</button>
      </div>
      {enCours && <p>En cours : <b>{enCours}</b>, {(avance * 100).toFixed(0)} %</p>}

      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr>{["montage", "timeline", "durée fichier", "écart", "images distinctes", "plus long gel", "audio", "poids", "type", "temps de rendu", "onglet caché"].map((h) => (
            <th key={h} style={th}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {mesures.map((r, i) => {
            const ecart = r.duree - r.timeline;
            const ok = !r.erreur && Math.abs(ecart) < 0.25 && r.plusLongGel <= 1 && r.poidsMo < 45;
            return (
              <tr key={i} style={{ background: r.erreur ? "#fee" : ok ? "#efe" : "#ffd" }}>
                <td style={td}>{r.nom}{r.erreur && <div style={{ color: "#900" }}>{r.erreur}</div>}</td>
                <td style={td}>{r.timeline.toFixed(2)} s</td>
                <td style={td}>{r.duree.toFixed(2)} s</td>
                <td style={td}>{ecart >= 0 ? "+" : ""}{ecart.toFixed(2)} s</td>
                <td style={td}>{r.distinctes} / {r.echantillons}</td>
                <td style={td}>{r.plusLongGel.toFixed(1)} s {r.plusLongGel > 1 ? `(à ${r.gelAt.toFixed(1)} s)` : ""}</td>
                <td style={td}>{r.audioSec ? `${r.audioSec.toFixed(2)} s, crête ${r.audioCrete.toFixed(2)}` : "aucune"}</td>
                <td style={td}>{r.poidsMo.toFixed(1)} Mo</td>
                <td style={td}>{r.mime}</td>
                <td style={td}>{r.secondes.toFixed(1)} s</td>
                <td style={td}>{(r.cache * 100).toFixed(0)} %</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 24 }}>
        {Object.entries(urls).map(([nom, u]) => (
          <div key={nom}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>{nom}</div>
            <video src={u} controls style={{ width: 200, background: "#000" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = { padding: "6px 12px", border: "1px solid #ccc", borderRadius: 6, background: "#fff", cursor: "pointer" };
const th: React.CSSProperties = { textAlign: "left", borderBottom: "2px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" };
const td: React.CSSProperties = { borderBottom: "1px solid #eee", padding: "6px 8px", verticalAlign: "top" };
