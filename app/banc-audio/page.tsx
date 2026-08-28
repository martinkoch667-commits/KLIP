"use client";

/* Banc d'essai de la CHAÎNE AUDIO DE L'EXPORT : page temporaire, hors du produit.
 *
 * Le mélange contient du son — mesuré, crête à 0,83 — et le fichier produit n'en
 * a pas. Le son se perd donc entre le mélange et le fichier : dans l'encodeur, ou
 * dans le muxeur. On ne peut pas le savoir en regardant le fichier, parce qu'un
 * encodeur à débit fixe produit exactement le même poids sur du silence.
 *
 * Ce banc rejoue EXACTEMENT la même chaîne — mêmes réglages, même muxeur, même
 * façon de remplir les blocs — sur un son fabriqué ici dont on connaît la crête.
 * Puis il relit le fichier obtenu et mesure ce qu'il contient réellement.
 *
 * Si le son entre et ne ressort pas, le défaut est dans ces trente lignes, et il
 * se voit ici en deux secondes au lieu d'un aller-retour par export.
 */

import React, { useState } from "react";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const AUDIO_BITRATE = 128_000;

export default function BancAudio() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <BancAudioDev />;
}

function BancAudioDev() {
  const [journal, setJournal] = useState<string[]>([]);
  const [enCours, setEnCours] = useState(false);
  const dire = (l: string) => setJournal((j) => [...j, l]);

  async function lancer() {
    setJournal([]); setEnCours(true);
    try {
      await mesurer("encodeur vidéo FERMÉ avant le son (le banc)", true);
      await mesurer("encodeur vidéo ENCORE OUVERT (l'export réel)", false);
    } finally { setEnCours(false); }
  }

  /* La seule différence entre mon banc, qui marche, et l'export réel, qui rend
     du silence : l'export garde son encodeur VIDÉO ouvert pendant qu'il encode
     le son. Il ne le ferme qu'à la toute fin, dans son `finally`. On teste donc
     les deux ordres, sur le même son, dans la même page. */
  async function mesurer(titre: string, fermerVideoAvant: boolean) {
    dire("── " + titre);
    try {
      // ── 1. un son dont on connaît la crête ──────────────────────────────
      const DUREE = 3;
      const oac = new OfflineAudioContext(CHANNELS, DUREE * SAMPLE_RATE, SAMPLE_RATE);
      const osc = oac.createOscillator();
      osc.frequency.value = 440;
      const g = oac.createGain(); g.gain.value = 0.6;
      osc.connect(g).connect(oac.destination);
      osc.start(0); osc.stop(DUREE);
      const mix = await oac.startRendering();
      let creteEntree = 0;
      const d0 = mix.getChannelData(0);
      for (let i = 0; i < d0.length; i += 13) creteEntree = Math.max(creteEntree, Math.abs(d0[i]));
      dire(`son fabriqué : ${DUREE}s, crête ${creteEntree.toFixed(3)}`);

      // ── 2. la MÊME chaîne que l'export ──────────────────────────────────
      const W = 64, H = 64, FPS = 30;
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: "avc", width: W, height: H, frameRate: FPS },
        audio: { codec: "aac", numberOfChannels: CHANNELS, sampleRate: SAMPLE_RATE },
        fastStart: "in-memory",
      });
      let erreur: unknown = null;
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d")!;
      const ve = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { erreur = e; } });
      ve.configure({ codec: "avc1.42001f", width: W, height: H, bitrate: 300_000, framerate: FPS });
      for (let k = 0; k < DUREE * FPS; k++) {
        ctx.fillStyle = k % 2 ? "#333" : "#666"; ctx.fillRect(0, 0, W, H);
        const f = new VideoFrame(cv, { timestamp: Math.round((k / FPS) * 1e6) });
        ve.encode(f, { keyFrame: k % 30 === 0 });
        f.close();
      }
      await ve.flush();
      if (fermerVideoAvant) ve.close();
      dire("images encodées");

      let chunksAudio = 0, octetsAudio = 0, configRecue = false;
      const ae = new AudioEncoder({
        output: (chunk, meta) => {
          chunksAudio++; octetsAudio += chunk.byteLength;
          if (meta?.decoderConfig) configRecue = true;
          muxer.addAudioChunk(chunk, meta);
        },
        error: (e) => { erreur = e; },
      });
      ae.configure({ codec: "mp4a.40.2", sampleRate: SAMPLE_RATE, numberOfChannels: CHANNELS, bitrate: AUDIO_BITRATE });

      const gauche = mix.getChannelData(0);
      const droite = mix.numberOfChannels > 1 ? mix.getChannelData(1) : gauche;
      const BLOC = 1024;
      for (let off = 0; off < mix.length; off += BLOC) {
        const n = Math.min(BLOC, mix.length - off);
        const data = new Float32Array(n * CHANNELS);
        data.set(gauche.subarray(off, off + n), 0);
        data.set(droite.subarray(off, off + n), n);
        const ad = new AudioData({
          format: "f32-planar", sampleRate: SAMPLE_RATE, numberOfFrames: n,
          numberOfChannels: CHANNELS, timestamp: Math.round((off / SAMPLE_RATE) * 1e6), data,
        });
        ae.encode(ad); ad.close();
        if (ae.encodeQueueSize > 32) await new Promise((r) => setTimeout(r, 2));
      }
      await ae.flush(); ae.close();
      dire(`son encodé : ${chunksAudio} morceaux, ${octetsAudio} octets, configuration transmise au muxeur : ${configRecue ? "OUI" : "NON"}`);
      if (erreur) dire("ERREUR d'encodeur : " + String(erreur));

      muxer.finalize();
      const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
      dire(`fichier produit : ${(blob.size / 1024).toFixed(0)} Ko`);

      // ── 3. on relit le fichier et on mesure ce qu'il contient ───────────
      const url = URL.createObjectURL(blob);
      const v = document.createElement("video");
      v.src = url; v.playsInline = true; v.preload = "auto";
      document.body.appendChild(v);
      await new Promise((res) => { v.onloadeddata = res; setTimeout(res, 3000); });
      const ac = new AudioContext();
      await ac.resume().catch(() => {});
      const src = ac.createMediaElementSource(v);
      const an = ac.createAnalyser(); an.fftSize = 1024;
      src.connect(an);                                  // pas connecté à la sortie
      const tampon = new Float32Array(an.fftSize);
      await v.play().catch(() => dire("lecture refusée"));
      let creteSortie = 0;
      for (let k = 0; k < 25; k++) {
        await new Promise((r) => setTimeout(r, 40));
        an.getFloatTimeDomainData(tampon);
        for (let i = 0; i < tampon.length; i++) creteSortie = Math.max(creteSortie, Math.abs(tampon[i]));
      }
      v.pause(); v.remove(); URL.revokeObjectURL(url); await ac.close();
      dire(`crête RELUE dans le fichier : ${creteSortie.toFixed(4)}`);
      dire(creteSortie < 0.001
        ? "VERDICT : le son entre et ne ressort pas — le défaut est dans cette chaîne."
        : "VERDICT : la chaîne est saine, le son traverse.");
      if (!fermerVideoAvant) { try { ve.close(); } catch { /* déjà fermé */ } }
    } catch (e) {
      dire("EXCEPTION : " + String(e));
    }
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 24, background: "#14141A", color: "#EDEDF2", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Chaîne audio de l&apos;export</h1>
      <p style={{ fontSize: 13, color: "#9A9AA8", marginBottom: 16 }}>
        Un son de crête connue entre, on mesure ce qui ressort du fichier.
      </p>
      <button onClick={lancer} disabled={enCours}
        style={{ padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer",
          background: "#B9F5A0", color: "#14141A", fontWeight: 800 }}>
        {enCours ? "Mesure en cours…" : "Lancer la mesure"}
      </button>
      <pre id="banc-audio-journal" style={{ marginTop: 18, fontFamily: "ui-monospace", fontSize: 12.5, lineHeight: 1.7 }}>
        {journal.join("\n")}
      </pre>
    </div>
  );
}
