// export-offline.ts : l'export, rendu image par image, hors temps réel.
//
// POURQUOI CE FICHIER EXISTE
// L'export historique (export.ts) filme le canvas pendant qu'il se peint :
// canvas.captureStream() + MediaRecorder. Le fichier produit est donc
// l'enregistrement du TEMPS QU'A PRIS LA MACHINE, pas celui du montage. Si le
// décodage prend du retard, l'image reste figée et l'enregistreur écrit quand
// même des secondes de film ; si le disque ou le réseau tousse, la durée dérive.
// Aucun correctif ponctuel ne peut rattraper cela, parce que la cadence n'est
// pas dans le fichier : elle est dans l'horloge de la machine.
//
// Ici, l'horloge disparaît. Pour chaque index d'image k, on calcule t = k / FPS,
// on positionne chaque source EXACTEMENT à cet instant (currentTime + seeked),
// on compose, et on donne l'image à l'encodeur avec l'horodatage k / FPS. Une
// image lente à décoder ralentit l'export, elle ne le déforme pas. Le fichier
// fait la durée de la timeline, à l'image près, sur toute machine.
//
// L'audio suit la même logique : tout est mixé dans un OfflineAudioContext
// (donc plus vite que le temps réel, et sans dépendre de la lecture), puis
// encodé en AAC.
//
// Chemin de repli : si le navigateur n'a pas WebCodecs (VideoEncoder /
// AudioEncoder), renderExport bascule sur l'ancien chemin temps réel.

import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import {
  MontageClip, OverlayClip, AudioTrack,
  clipAudioGainAt, overlayTimelineDur, overlayAudioGainAt, audioVolumeAt,
  kenBurnsScale, clipFilterCss, videoFormatById, exportQualityById,
  transitionPairAt, estTransitionGl, type TransitionState,
} from "./constants";
import {
  ExportProject, ExportResult, ClipTimed, withStarts, FPS, setCanvasSize,
  drawCover, drawMediaFrame, drawMediaWithState, drawTransitionVeils, drawGlTransitionFrame, drawCaptions, drawTitles, drawStickers,
  drawOverlayFrame, drawProgressBar, loadImage,
} from "./render-core";

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const MAX_BYTES = 45 * 1024 * 1024; // Instagram refuse au delà de 50 à 60 Mo
const AUDIO_BITRATE = 128_000;
const GOP_SECONDS = 2;              // une image clé toutes les 2 s

/** Le navigateur sait-il encoder hors temps réel ? Toutes les briques doivent
 *  être là : sans l'une d'elles on ne produit pas un MP4 valide, et mieux vaut
 *  le repli temps réel qu'un fichier illisible. */
export function exportOfflineDisponible(): boolean {
  return typeof window !== "undefined"
    && typeof VideoEncoder !== "undefined"
    && typeof VideoFrame !== "undefined"
    && typeof AudioEncoder !== "undefined"
    && typeof AudioData !== "undefined"
    && typeof OfflineAudioContext !== "undefined";
}

// H.264 : on essaie du plus capable au plus compatible. Le premier profil que
// le navigateur accepte pour CE format d'image gagne. Inutile de deviner, il
// sait répondre.
const CANDIDATS_H264 = ["avc1.640034", "avc1.640028", "avc1.4d0034", "avc1.4d0028", "avc1.42e01f"];

async function choisirCodecVideo(width: number, height: number, bitrate: number): Promise<string | null> {
  for (const codec of CANDIDATS_H264) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({
        codec, width, height, bitrate, framerate: FPS, avc: { format: "avc" },
      });
      if (supported) return codec;
    } catch { /* profil inconnu de ce navigateur, on essaie le suivant */ }
  }
  return null;
}

async function aacDisponible(): Promise<boolean> {
  try {
    const { supported } = await AudioEncoder.isConfigSupported({
      codec: "mp4a.40.2", sampleRate: SAMPLE_RATE, numberOfChannels: CHANNELS, bitrate: AUDIO_BITRATE,
    });
    return !!supported;
  } catch { return false; }
}

/* Positionnement EXACT d'une source vidéo.

   C'est la pièce maîtresse : tant qu'on ne sait pas placer une source à un
   instant précis et attendre que l'image soit vraiment là, on ne peut rien
   rendre de déterministe. On pose currentTime, on attend `seeked`, avec un
   plafond pour ne jamais rester bloqué sur une source capricieuse (dans ce cas
   on garde l'image précédente plutôt que d'abandonner l'export). */
function seekPrecis(v: HTMLVideoElement, t: number): Promise<void> {
  if (Math.abs(v.currentTime - t) < 1 / (FPS * 4)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let fini = false;
    let minuteur = 0;
    const finir = () => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      v.removeEventListener("seeked", finir);
      resolve();
    };
    minuteur = window.setTimeout(finir, 4000);
    v.addEventListener("seeked", finir);
    try { v.currentTime = t; } catch { finir(); }
  });
}

function ouvrirVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.playsInline = true;
    v.muted = true;            // le son ne vient JAMAIS d'ici, il est mixé hors ligne
    v.preload = "auto";
    const minuteur = window.setTimeout(() => reject(new Error(`source vidéo trop lente : ${src}`)), 60_000);
    v.onloadeddata = () => { clearTimeout(minuteur); resolve(v); };
    v.onerror = () => { clearTimeout(minuteur); reject(new Error(`source vidéo illisible : ${src}`)); };
    v.src = src;
  });
}

function libererVideo(v: HTMLVideoElement) {
  try { v.removeAttribute("src"); v.load(); } catch { /* déjà relâchée */ }
}

// ── Mixage audio hors ligne ────────────────────────────────────────────────
// Tout le son du montage est rendu d'un coup dans un OfflineAudioContext : les
// sons embarqués des plans, ceux des incrustations, et les pistes audio. Aucune
// lecture en temps réel, donc aucune dérive possible entre l'image et le son.

type CourbeGain = (localT: number) => number;

/** Applique une courbe de volume à un GainNode en échantillonnant la même
 *  fonction que l'aperçu (fondus, points-clés, transitions). 40 points par
 *  seconde suffisent pour que l'oreille n'entende aucune marche. */
function poserCourbe(gain: GainNode, debut: number, duree: number, f: CourbeGain) {
  const pas = 1 / 40;
  const n = Math.max(2, Math.ceil(duree / pas) + 1);
  const courbe = new Float32Array(n);
  for (let i = 0; i < n; i++) courbe[i] = Math.max(0, f((i / (n - 1)) * duree));
  try { gain.gain.setValueCurveAtTime(courbe, debut, duree); }
  catch { gain.gain.value = courbe[0]; }
}

async function melangerAudio(
  clips: ClipTimed[],
  overlays: OverlayClip[],
  pistes: AudioTrack[],
  total: number,
  onProgress: (p: number) => void,
): Promise<AudioBuffer> {
  const oac = new OfflineAudioContext(CHANNELS, Math.ceil(total * SAMPLE_RATE), SAMPLE_RATE);
  const cache = new Map<string, Promise<AudioBuffer | null>>();

  const decoder = (src: string): Promise<AudioBuffer | null> => {
    let p = cache.get(src);
    if (!p) {
      p = (async () => {
        try {
          const r = await fetch(src, { mode: "cors" });
          if (!r.ok) { console.warn("[export] son introuvable :", r.status, src.slice(0, 90)); return null; }
          return await oac.decodeAudioData(await r.arrayBuffer());
        } catch (e) {
          /* `decodeAudioData` ne sait pas ouvrir tous les conteneurs : un .mov,
             par exemple, est refusé par Chrome alors que le lecteur vidéo le joue
             sans problème. On le DIT, au lieu de rendre un fichier muet sans que
             personne comprenne pourquoi. L'appelant, lui, saura se replier. */
          console.warn("[export] son non décodable, source ignorée :", src.slice(0, 90), e);
          return null;
        }
      })();
      cache.set(src, p);
    }
    return p;
  };

  type Aiguillage = { src: string; quand: number; depart: number; duree: number; vitesse: number; courbe: CourbeGain };
  const aiguillages: Aiguillage[] = [];

  for (const c of clips) {
    if (c.kind !== "video" || (c.vol ?? 1) <= 0 || c.dur <= 0) continue;
    aiguillages.push({
      src: c.src, quand: c.start, depart: c.trimStart,
      duree: Math.max(0, c.trimEnd - c.trimStart), vitesse: c.speed || 1,
      courbe: (lt) => clipAudioGainAt(c, lt),
    });
  }
  for (const o of overlays) {
    if (o.kind !== "video" || (o.vol ?? 1) <= 0) continue;
    const d = overlayTimelineDur(o);
    if (d <= 0) continue;
    aiguillages.push({
      src: o.src, quand: o.offset, depart: o.trimStart, duree: d, vitesse: 1,
      courbe: (lt) => overlayAudioGainAt(o, lt),
    });
  }
  for (const tr of pistes) {
    if (tr.dur <= 0) continue;
    aiguillages.push({
      src: tr.src, quand: tr.offset, depart: tr.srcOffset ?? 0, duree: tr.dur, vitesse: 1,
      courbe: (lt) => audioVolumeAt(tr, lt),
    });
  }

  const buffers = await Promise.all(aiguillages.map((a) => decoder(a.src)));
  onProgress(1);

  /* AUCUNE source décodée alors qu'il y avait du son à mettre : on rend la main
     plutôt qu'un fichier muet.

     C'est exactement ce qui arrive quand le son a été détaché d'un plan : la
     piste audio pointe vers le fichier vidéo d'origine, et si `decodeAudioData`
     ne sait pas ouvrir ce conteneur, TOUT le son de l'export disparaît d'un
     coup, sans un mot. L'appelant se replie alors sur la captation en temps
     réel, qui passe par un lecteur : ce que le navigateur sait JOUER, il saura
     l'enregistrer. */
  if (aiguillages.length > 0 && buffers.every((b) => !b)) {
    throw new Error("aucune piste sonore décodable : repli sur la captation");
  }

  aiguillages.forEach((a, i) => {
    const buf = buffers[i];
    if (!buf) return;
    const quand = Math.max(0, a.quand);
    // Durée sur la timeline : la vitesse raccourcit le son comme elle raccourcit l'image.
    const dureeTimeline = Math.min(a.duree / a.vitesse, Math.max(0, total - quand));
    if (dureeTimeline <= 0) return;
    const source = oac.createBufferSource();
    source.buffer = buf;
    source.playbackRate.value = a.vitesse;
    const gain = oac.createGain();
    gain.gain.value = 0;
    poserCourbe(gain, quand, dureeTimeline, a.courbe);
    source.connect(gain).connect(oac.destination);
    try { source.start(quand, a.depart, dureeTimeline * a.vitesse); }
    catch { /* départ hors des bornes de la source : rien à jouer */ }
  });

  return oac.startRendering();
}

/** Le montage contient-il quelque chose qui devrait s'entendre ? */
function aDuSonAMettre(clips: ClipTimed[], overlays: OverlayClip[], pistes: AudioTrack[]): boolean {
  if (pistes.some((t) => t.dur > 0)) return true;
  if (clips.some((c) => c.kind === "video" && (c.vol ?? 1) > 0 && c.dur > 0)) return true;
  return overlays.some((o) => o.kind === "video" && (o.vol ?? 1) > 0);
}

// ── Rendu ──────────────────────────────────────────────────────────────────

type Media = { video: HTMLVideoElement | null; img: HTMLImageElement | null };

export async function renderExportOffline(
  project: ExportProject,
  onProgress: (p: number) => void,
): Promise<ExportResult> {
  const fmt = project.formatId === "custom" && project.customW && project.customH
    ? { w: project.customW, h: project.customH }
    : videoFormatById(project.formatId);
  // H.264 veut des dimensions paires.
  const W = Math.max(2, Math.round(fmt.w / 2) * 2);
  const H = Math.max(2, Math.round(fmt.h / 2) * 2);
  setCanvasSize(W, H);

  const clips = withStarts(project.clips);
  const total = clips.length ? clips[clips.length - 1].end : 0;
  if (!total) throw new Error("Aucun plan à exporter");

  /* Débit plafonné pour que le fichier reste publiable : même règle qu'avant,
     mais cette fois le calcul est juste : la durée du fichier EST celle de la
     timeline, donc le budget en octets est exact et non plus une estimation. */
  const asked = exportQualityById(project.exportQuality).bitrate;
  const budget = Math.floor((MAX_BYTES * 8) / total) - AUDIO_BITRATE;
  const bitrate = Math.max(1_200_000, Math.min(asked, budget));

  const codec = await choisirCodecVideo(W, H, bitrate);
  if (!codec) throw new Error("Aucun profil H.264 accepté par ce navigateur");
  if (!(await aacDisponible())) throw new Error("Encodage AAC indisponible");

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: W, height: H, frameRate: FPS },
    audio: { codec: "aac", numberOfChannels: CHANNELS, sampleRate: SAMPLE_RATE },
    fastStart: "in-memory", // métadonnées en tête : la vidéo démarre sans télécharger tout le fichier
  });

  let erreurEncodeur: unknown = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { erreurEncodeur = e; },
  });
  videoEncoder.configure({
    codec, width: W, height: H, bitrate, framerate: FPS,
    avc: { format: "avc" }, latencyMode: "quality",
  });

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false })!;

  // ── Chargement des ressources fixes (stickers image, incrustations) ───────
  const stickerImages = new Map<string, HTMLImageElement>();
  for (const s of project.stickers) {
    if (s.isImage && !stickerImages.has(s.glyph)) {
      try { stickerImages.set(s.glyph, await loadImage(s.glyph)); } catch { /* logo indisponible */ }
    }
  }

  const overlays = (project.overlays || []).slice().sort((a, b) => (a.track ?? 0) - (b.track ?? 0));
  const overlayMedia: { o: OverlayClip; video: HTMLVideoElement | null; img: HTMLImageElement | null }[] = [];
  for (const o of overlays) {
    if (o.kind === "photo") {
      let img: HTMLImageElement | null = null;
      try { img = await loadImage(o.src); } catch { /* incrustation indisponible */ }
      overlayMedia.push({ o, video: null, img });
    } else {
      let v: HTMLVideoElement | null = null;
      try { v = await ouvrirVideo(o.src); } catch { /* incrustation indisponible */ }
      overlayMedia.push({ o, video: v, img: null });
    }
  }

  // ── Réserve de médias de la piste principale ─────────────────────────────
  // Une entrée par plan, ouverte à l'avance (le plan suivant se charge pendant
  // qu'on rend le courant) et relâchée dès qu'on l'a dépassée : un montage de
  // cinquante plans ne garde pas cinquante vidéos décodées en mémoire.
  const reserve = new Map<number, Promise<Media>>();
  function ouvrir(i: number): Promise<Media> | null {
    const c = clips[i];
    if (!c) return null;
    let p = reserve.get(i);
    if (!p) {
      p = c.kind === "video"
        ? ouvrirVideo(c.src).then((video) => ({ video, img: null })).catch(() => ({ video: null, img: null }))
        : loadImage(c.src).then((img) => ({ video: null, img })).catch(() => ({ video: null, img: null }));
      reserve.set(i, p);
    }
    return p;
  }
  async function relacher(i: number) {
    const p = reserve.get(i);
    if (!p) return;
    reserve.delete(i);
    const m = await p;
    if (m.video) libererVideo(m.video);
  }

  // Fondu enchaîné : le plan sortant continue d'avancer sous le plan entrant.
  // Même géométrie que l'aperçu et que le chemin temps réel.
  /** Un des deux plans d'une transition, avec l'état qui lui revient. */
  function dessinerCote(m: Media, c: ClipTimed, localT: number, st: TransitionState) {
    const media = m.video ?? m.img;
    if (!media) return;
    drawMediaWithState(ctx, media, c, localT, st);
  }

  /** Instant à atteindre DANS la source pour un plan vidéo, à `localT` sur la
   *  timeline. On ne dépasse jamais la fin de la source : un seek au delà ne
   *  déclenche pas `seeked` sur tous les navigateurs. */
  function tempsSource(c: MontageClip, localT: number): number {
    const brut = c.trimStart + localT * (c.speed || 1);
    const plafond = Math.max(0, (c.srcDur || c.trimEnd) - 1 / FPS);
    return Math.min(Math.max(0, brut), plafond);
  }

  // Un plan est-il « en fondu enchaîné d'entrée » à cet instant ?
  /** Durée pendant laquelle le plan `i` cohabite avec celui d'avant.
   *  C'était réservé au fondu ; toutes les transitions se jouent maintenant à
   *  deux, un balayage sans le plan qu'il balaie n'ayant aucun sens. */
  function recouvrementEntree(i: number): number {
    const c = clips[i];
    if (i <= 0 || !c.transitionIn || c.transitionIn === "cut" || !(c.transitionDur > 0)) return 0;
    // À travers un écran noir, il n'y a rien à enchaîner.
    if (Math.max(0, c.gapBefore ?? 0) > 0) return 0;
    return Math.min(c.transitionDur, clips[i - 1].dur);
  }

  const totalFrames = Math.max(1, Math.round(total * FPS));
  let thumbnailBlob: Blob | null = null;
  let iCourant = -1;

  try {
    for (let k = 0; k < totalFrames; k++) {
      // L'INSTANT EST CALCULÉ, jamais mesuré. C'est toute la différence.
      const t = k / FPS;

      // Plan actif à cet instant (le dernier dont le début est passé).
      let i = 0;
      for (let j = 0; j < clips.length; j++) if (t >= clips[j].start) i = j;
      const c = clips[i];
      const dansLeTrou = t < c.start; // écran noir avant le premier plan

      if (i !== iCourant) {
        iCourant = i;
        ouvrir(i);            // normalement déjà ouvert par le plan précédent
        ouvrir(i + 1);        // préchargement du suivant pendant qu'on rend celui-ci
        if (i - 2 >= 0) relacher(i - 2);
      }

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      if (!dansLeTrou) {
        const m = await ouvrir(i)!;
        const localT = Math.min(t - c.start, Math.max(0, c.dur - 1e-4));
        if (m.video) await seekPrecis(m.video, tempsSource(c, localT));

        const recouvrement = recouvrementEntree(i);
        if (recouvrement > 0 && t - c.start < recouvrement) {
          // Les deux plans cohabitent : le sortant poursuit sa course au delà de
          // sa propre fin, exactement comme dans l'aperçu.
          const prev = clips[i - 1];
          const mp = await ouvrir(i - 1)!;
          const localPrev = prev.dur + (t - c.start);
          if (mp.video) await seekPrecis(mp.video, tempsSource(prev, localPrev));
          const avancement = (t - c.start) / recouvrement;
          const mediaPrev = mp.video ?? mp.img, mediaCur = m.video ?? m.img;
          // Transition à shader : WebGL compose les deux plans. S'il n'est pas
          // là, on continue en dessous avec le fondu de repli.
          const faitEnGl = estTransitionGl(c.transitionIn) && !!mediaPrev && !!mediaCur
            && drawGlTransitionFrame(ctx, mediaPrev, prev, localPrev, mediaCur, c, localT, c.transitionIn!, avancement);
          if (!faitEnGl) {
            const paire = transitionPairAt(c.transitionIn, c.transitionDur, t - c.start, false);
            dessinerCote(mp, prev, localPrev, paire.out);
            dessinerCote(m, c, localT, paire.in);
            drawTransitionVeils(ctx, paire.in);
          }
        } else if (m.video || m.img) {
          drawMediaFrame(ctx, (m.video ?? m.img)!, c, localT, i === 0);
        }
      }

      // Incrustations : positionnées au même instant calculé.
      for (const om of overlayMedia) {
        const o = om.o;
        const debut = o.offset, fin = o.offset + overlayTimelineDur(o);
        if (t < debut || t >= fin) continue;
        if (om.video) {
          await seekPrecis(om.video, Math.min(o.trimStart + (t - debut), Math.max(0, (o.srcDur || o.trimEnd) - 1 / FPS)));
          drawOverlayFrame(ctx, om.video, o);
        } else if (om.img) {
          drawOverlayFrame(ctx, om.img, o);
        }
      }

      drawCaptions(ctx, project.captions, project.subStyleId, project.subCustom, project.subPos, t, project.linkedSubs ?? true);
      drawTitles(ctx, project.titles, t);
      drawStickers(ctx, project.stickers, stickerImages, t);
      if (project.showProgressBar) drawProgressBar(ctx, t, total);

      if (k === 0) {
        thumbnailBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
      }

      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((k * 1e6) / FPS),
        duration: Math.round(1e6 / FPS),
      });
      videoEncoder.encode(frame, { keyFrame: k % (FPS * GOP_SECONDS) === 0 });
      frame.close();

      // L'encodeur ne doit pas prendre trop d'avance de retard : sans ce frein,
      // un long montage empile des milliers d'images en mémoire.
      while (videoEncoder.encodeQueueSize > 8) {
        await new Promise((r) => setTimeout(r, 4));
        if (erreurEncodeur) throw erreurEncodeur;
      }
      if (erreurEncodeur) throw erreurEncodeur;

      // 0 → 0,80 : les images. Le reste va au son et à la finalisation.
      if (k % 5 === 0) onProgress((k / totalFrames) * 0.8);
    }

    await videoEncoder.flush();
    onProgress(0.82);

    // ── Son ────────────────────────────────────────────────────────────────
    const mix = await melangerAudio(clips, overlays, project.audioTracks, total, () => onProgress(0.86));
    onProgress(0.9);

    /* ON ÉCOUTE CE QU'ON S'APPRÊTE À ENCODER.

       L'encodeur travaille à débit fixe : il remplit ses trames à 128 kbit/s que
       le signal soit une voix ou du silence. Un fichier muet ressemble donc en
       tout point à un fichier sonore — même durée, même poids, même déclaration.
       C'est pour ça que le problème a pu passer plusieurs fois entre les mailles.

       On mesure donc la crête du mélange avant de l'encoder. Si elle est nulle,
       le rendu hors ligne rend la main : l'export se replie sur la captation en
       temps réel, qui passe par des lecteurs — ce que le navigateur sait JOUER,
       il saura l'enregistrer, quel que soit le conteneur. */
    let crete = 0;
    for (let ch = 0; ch < mix.numberOfChannels; ch++) {
      const d = mix.getChannelData(ch);
      // Un échantillon sur 97 : assez pour trouver une crête, sans relire des
      // millions de valeurs pour rien.
      for (let i = 0; i < d.length; i += 97) { const v = Math.abs(d[i]); if (v > crete) crete = v; }
    }
    console.log("[export] crête du mélange audio :", crete.toFixed(4));
    if (aDuSonAMettre(clips, overlays, project.audioTracks) && crete < 0.0005) {
      throw new Error("mélange audio muet : repli sur la captation");
    }

    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => { erreurEncodeur = e; },
    });
    audioEncoder.configure({ codec: "mp4a.40.2", sampleRate: SAMPLE_RATE, numberOfChannels: CHANNELS, bitrate: AUDIO_BITRATE });

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
      audioEncoder.encode(ad);
      ad.close();
      if (audioEncoder.encodeQueueSize > 32) await new Promise((r) => setTimeout(r, 2));
    }
    await audioEncoder.flush();
    audioEncoder.close();
    if (erreurEncodeur) throw erreurEncodeur;

    onProgress(0.97);
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
    onProgress(1);
    return { blob, thumbnailBlob, mimeType: "video/mp4" };
  } finally {
    try { if (videoEncoder.state !== "closed") videoEncoder.close(); } catch { /* déjà fermé */ }
    for (const i of Array.from(reserve.keys())) relacher(i);
    overlayMedia.forEach((m) => { if (m.video) libererVideo(m.video); });
  }
}
