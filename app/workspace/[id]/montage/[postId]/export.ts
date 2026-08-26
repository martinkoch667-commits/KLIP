// export.ts : REPLI, captation d'écran en temps réel.
//
// Le chemin normal est export-offline.ts : rendu image par image, hors temps
// réel, horodatage calculé. Ce fichier reste pour les navigateurs sans
// WebCodecs, où l'on ne sait rien faire d'autre que filmer un canvas pendant
// qu'il se peint. Sa limite est structurelle et connue : la longueur et la
// fluidité du fichier dépendent de la vitesse de la machine, parce que
// MediaRecorder enregistre le temps qui passe et non la timeline. Les cinq
// correctifs successifs (silence continu, préchargement, minuteur worker,
// échéance de fin) atténuent les symptômes sans changer cela.
//
// Le DESSIN, lui, est partagé avec le chemin hors temps réel : il vit dans
// render-core.ts et les deux chemins l'appellent à l'identique.
//
// Transitions : TOUTES se jouent à deux flux. Le plan sortant continue de
// jouer/s'animer (au lieu d'être figé sur son dernier frame) pendant que le plan
// entrant démarre, les deux décodés en parallèle (2 <video> alternées par index de
// plan + <img> déjà indépendantes pour les photos). C'était réservé au fondu ; les
// autres s'animaient par-dessus une image morte, ce qui se voyait : un glissé était
// une photo immobile avec une image qui passe dessus, un balayage balayait le vide.

import { OverlayClip, transitionPairAt, type TransitionState, clipAudioGainAt, overlayTimelineDur, overlayAudioGainAt, audioVolumeAt, kenBurnsScale, clipFilterCss, videoFormatById, exportQualityById } from "./constants";
import {
  ExportProject, ExportResult, ClipTimed, withStarts, FPS, setCanvasSize,
  drawCover, drawMediaFrame, drawMediaWithState, drawTransitionVeils, drawCaptions, drawTitles, drawStickers,
  drawOverlayFrame, drawProgressBar, loadImage,
} from "./render-core";
import { renderExportOffline, exportOfflineDisponible } from "./export-offline";

export type { ExportProject, ExportResult } from "./render-core";

// Conteneurs acceptés par MediaRecorder, du plus souhaitable au moins.
// Le MP4/H.264 vient en tête : Safari sait l'enregistrer nativement, ce qui
// évite complètement le transcodage ffmpeg.wasm — une étape qui, sur une vidéo
// d'une quinzaine de secondes, prenait des minutes en mono-thread.
const RECORDER_TYPES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function pickRecorderType(): string {
  const supported = RECORDER_TYPES.find(
    (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)
  );
  // Aucun type reconnu : on laisse MediaRecorder choisir son défaut plutôt que
  // de lui imposer un conteneur qu'il refuserait (le constructeur lèverait).
  return supported ?? "";
}


/* Minuteur non bridé, exécuté dans un worker.

   Le rendu de l'export était cadencé par `setInterval` dans la page. Or dès que
   l'onglet passe en arrière-plan, et un export dure assez longtemps pour qu'on
   aille faire autre chose, le navigateur ramène ces minuteurs à UNE fois par
   seconde, tandis que MediaRecorder continue d'enregistrer en temps réel. Le
   canvas n'est alors redessiné qu'une fois par seconde : le film exporté reste
   figé pendant des secondes entières.

   Mesuré dans Chromium, onglet caché, sur trois secondes à 33 ms d'intervalle :
     setInterval dans la page   →   3 déclenchements
     setInterval dans un worker → 120 déclenchements

   Le commentaire d'origine notait justement que requestAnimationFrame est
   suspendu en arrière-plan, mais concluait que setInterval « continue de tourner
   de façon fiable ». C'est faux : il est bridé lui aussi. Seul un worker y
   échappe. */
function createTicker() {
  const src = "let iv;onmessage=e=>{clearInterval(iv);if(e.data.ms)iv=setInterval(()=>postMessage(0),e.data.ms)}";
  const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  let worker: Worker | null = null;
  try { worker = new Worker(url); } catch { worker = null; }

  /** Rappelle `cb` toutes les `ms`. Rend la fonction d'arrêt. */
  function every(ms: number, cb: () => void): () => void {
    if (!worker) {
      const iv = setInterval(cb, ms); // repli : navigateur sans worker
      return () => clearInterval(iv);
    }
    const w = worker;
    w.onmessage = cb;
    w.postMessage({ ms });
    return () => { w.postMessage({ ms: 0 }); w.onmessage = null; };
  }

  function dispose() { worker?.terminate(); URL.revokeObjectURL(url); }
  return { every, dispose };
}

export async function renderExportTempsReel(project: ExportProject, onProgress: (p: number) => void): Promise<ExportResult> {
  const fmt = project.formatId === "custom" && project.customW && project.customH
    ? { w: project.customW, h: project.customH }
    : videoFormatById(project.formatId);
  const CANVAS_W = fmt.w, CANVAS_H = fmt.h;
  setCanvasSize(CANVAS_W, CANVAS_H);

  const clips = withStarts(project.clips);
  const total = clips.length ? clips[clips.length - 1].end : 0;
  if (!total) throw new Error("Aucun plan à exporter");

  const ticker = createTicker();

  /* Échéance de l'enregistrement.

     L'export est une captation en temps réel : la longueur du fichier est celle
     du TEMPS PASSÉ à rendre, pas celle du montage. Que le rendu prenne du
     retard (machine chargée, décodage lent, onglet bridé) et le film s'allonge
     d'autant, en gardant la dernière image affichée. Martin a vu un montage
     court rendre un fichier de 43 secondes.

     On pose donc une échéance : au delà de la durée de la timeline plus une
     petite marge, on arrête, quoi qu'il arrive. Le fichier fait alors la durée
     du montage, ce qui est la seule longueur juste : après le dernier plan, il
     n'y a plus rien à montrer. */
  const renderStart = performance.now();
  let deadlineMs = 0;
  /* L'échéance ne démarre qu'à la PREMIÈRE IMAGE PEINTE, pas au lancement de
     l'enregistreur. Entre les deux, il faut aller chercher le premier plan sur
     le réseau, ce qui peut prendre plusieurs secondes : compté dans le budget,
     ce temps mangeait tout le montage et rendait un fichier vide.

     La marge est large, un quart de la durée et au moins trois secondes. Il ne
     s'agit pas de serrer au plus juste mais d'empêcher un fichier de partir en
     vrille : un montage doit s'exporter en entier, c'est la règle. */
  const armerEcheance = () => {
    if (deadlineMs) return;
    deadlineMs = performance.now() + total * 1000 + Math.max(3000, total * 250);
  };
  const tempsEcoule = () => (performance.now() - renderStart) / 1000;
  const echeanceAtteinte = () => deadlineMs > 0 && performance.now() >= deadlineMs;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W; canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d")!;

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  // Un contexte créé hors d'un geste direct démarre suspendu : la piste audio
  // n'émettrait alors rien du tout.
  if (audioCtx.state === "suspended") { try { await audioCtx.resume(); } catch { /* on continue sans */ } }
  const dest = audioCtx.createMediaStreamDestination();

  /* Silence CONTINU branché sur la destination, du début à la fin.

     Sans lui, la piste audio de l'enregistrement ne porte des échantillons
     qu'à partir du moment où un plan sonore commence à jouer — et jamais du
     tout sur un montage muet. MediaRecorder écrit alors un MP4 dont la durée
     annoncée est bien plus courte que le film : le lecteur s'arrête au bout de
     cette durée, ce qui donne une vidéo qui « démarre puis se fige ».

     Mesuré dans Chromium sur un enregistrement de 5 s :
       piste audio sans source      → durée annoncée 3,03 s
       piste audio alimentée        → durée annoncée 4,88 s
     Un ConstantSourceNode à zéro suffit : il n'ajoute aucun son audible, il
     donne juste à l'encodeur une trame à écrire à chaque instant. */
  const silence = audioCtx.createConstantSource();
  silence.offset.value = 0;
  silence.connect(dest);
  silence.start();

  // 2 éléments <video> alternés par index de plan (pair/impair) — indispensable pour
  // qu'un vrai fondu enchaîné ("fade") puisse décoder 2 plans vidéo consécutifs en
  // parallèle (le sortant continue de jouer pendant que l'entrant démarre) sans se
  // marcher dessus (un seul <video> ne peut pas être à 2 endroits de la source à la fois).
  const videoSlots: HTMLVideoElement[] = [];
  const videoGains: GainNode[] = [];
  for (let s = 0; s < 2; s++) {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.playsInline = true;
    v.muted = false;
    const node = audioCtx.createMediaElementSource(v);
    const gain = audioCtx.createGain();
    gain.gain.value = 1;
    node.connect(gain).connect(dest);
    videoSlots.push(v);
    videoGains.push(gain);
  }

  // Note : chaque piste démarre à t=0 de l'export (offset non honoré ici, limite préexistante) —
  // donc el.currentTime correspond directement au temps local de la piste pour le calcul du fondu.
  const audioEls = project.audioTracks.map((t) => {
    const el = document.createElement("audio");
    el.crossOrigin = "anonymous";
    el.src = t.src;
    const node = audioCtx.createMediaElementSource(el);
    const gain = audioCtx.createGain();
    gain.gain.value = t.vol;
    node.connect(gain).connect(dest);
    return { el, gain, track: t };
  });
  // Pilote chaque piste audio selon le temps global de l'export : démarre/seek/pause
  // au bon moment (offset sur la timeline + srcOffset dans la source pour l'audio détaché),
  // et applique le volume + fondus. Corrige la limite précédente où les offsets étaient ignorés.
  function updateAudioAt(globalT: number) {
    for (const { el, gain, track } of audioEls) {
      const start = track.offset;
      const end = track.offset + track.dur;
      const within = globalT >= start && globalT < end;
      if (within) {
        const local = globalT - start;
        const srcT = (track.srcOffset ?? 0) + local;
        if (el.paused) { try { el.currentTime = srcT; } catch {} el.play().catch(() => {}); }
        else if (Math.abs(el.currentTime - srcT) > 0.35) { try { el.currentTime = srcT; } catch {} }
        gain.gain.value = audioVolumeAt(track, local);
      } else {
        if (!el.paused) el.pause();
        gain.gain.value = 0;
      }
    }
  }

  const stickerImages = new Map<string, HTMLImageElement>();
  for (const s of project.stickers) {
    if (s.isImage && !stickerImages.has(s.glyph)) {
      try { stickerImages.set(s.glyph, await loadImage(s.glyph)); } catch { /* logo indisponible, sticker ignoré */ }
    }
  }

  // ── Plans d'incrustation (PIP) : image ou vidéo superposée ────────────────────
  // Triés par piste croissante (stable) → la piste la plus haute est dessinée en
  // dernier, donc au-dessus (z-order cohérent avec l'aperçu).
  const overlays = (project.overlays || []).slice().sort((a, b) => (a.track ?? 0) - (b.track ?? 0));
  const overlayMedia: { o: OverlayClip; video: HTMLVideoElement | null; img: HTMLImageElement | null; active: boolean; gain: GainNode | null }[] = [];
  for (const o of overlays) {
    if (o.kind === "photo") {
      let img: HTMLImageElement | null = null;
      try { img = await loadImage(o.src); } catch { /* image indisponible */ }
      overlayMedia.push({ o, video: null, img, active: false, gain: null });
    } else {
      const ov = document.createElement("video");
      ov.crossOrigin = "anonymous"; ov.playsInline = true; ov.muted = false;
      let gain: GainNode | null = null;
      try {
        const node = audioCtx.createMediaElementSource(ov);
        gain = audioCtx.createGain(); gain.gain.value = o.vol ?? 1;
        node.connect(gain).connect(dest);
      } catch { /* audio overlay ignoré */ }
      await new Promise<void>((res) => { ov.onloadedmetadata = () => res(); ov.onerror = () => res(); ov.src = o.src; });
      overlayMedia.push({ o, video: ov, img: null, active: false, gain });
    }
  }
  // Met à jour (lecture/seek) puis dessine les overlays actifs au temps t.
  function drawOverlays(t: number) {
    for (const m of overlayMedia) {
      const o = m.o;
      const start = o.offset, end = o.offset + overlayTimelineDur(o);
      const isActive = t >= start && t < end;
      if (m.video) {
        if (isActive) {
          const target = o.trimStart + (t - start);
          if (!m.active) { try { m.video.currentTime = target; } catch {} m.video.play().catch(() => {}); m.active = true; }
          else if (Math.abs(m.video.currentTime - target) > 0.4) { try { m.video.currentTime = target; } catch {} }
          if (m.gain) m.gain.gain.value = overlayAudioGainAt(o, t - start); // volume + fondus de l'incrustation
          drawOverlayFrame(ctx, m.video, o);
        } else if (m.active) { m.video.pause(); m.active = false; }
      } else if (m.img && isActive) {
        drawOverlayFrame(ctx, m.img, o);
      }
    }
  }

  const stream = canvas.captureStream(FPS);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

  const mimeType = pickRecorderType();
  /* Débit plafonné pour que le fichier reste publiable.

     Instagram refuse les vidéos trop lourdes, et un montage long à haute
     qualité y arrivait sans prévenir : 6,5 Mb/s pendant deux minutes font déjà
     près de 100 Mo. On vise 45 Mo, sous la limite pratique de 50 à 60 Mo, en
     abaissant le débit plutôt qu'en refusant l'export. Un montage court garde
     la qualité demandée, seuls les longs sont ramenés à la raison. */
  const MAX_BYTES = 45 * 1024 * 1024;
  const asked = exportQualityById(project.exportQuality).bitrate;
  const budget = total > 1 ? Math.floor((MAX_BYTES * 8) / total) : asked;
  const bitrate = Math.max(1_200_000, Math.min(asked, budget));
  if (bitrate < asked) {
    console.warn(`[export] débit ramené à ${(bitrate / 1e6).toFixed(1)} Mb/s pour tenir sous 45 Mo (${total.toFixed(0)} s de montage).`);
  }
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: bitrate } : { videoBitsPerSecond: bitrate });
  // Type réellement retenu — MediaRecorder peut normaliser celui qu'on demande.
  const actualType = (recorder.mimeType || mimeType || "video/webm").split(";")[0];
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: actualType })); });

  recorder.start(200);
  // Les pistes audio sont démarrées/seek/pausées à leur offset par updateAudioAt() dans la boucle.

  // Miniature : capture le tout premier frame composé (image + texte/titres) du plan 1.
  let thumbCaptured = false;
  let thumbnailBlob: Blob | null = null;
  let thumbnailPromise: Promise<void> = Promise.resolve();
  const maybeCaptureThumbnail = (isFirstClip: boolean) => {
    if (thumbCaptured || !isFirstClip) return;
    thumbCaptured = true;
    thumbnailPromise = new Promise<void>((resolve) => {
      canvas.toBlob((b) => { thumbnailBlob = b; resolve(); }, "image/jpeg", 0.85);
    });
  };

  /* Préchargement du plan suivant.

     Charger une source vidéo et s'y positionner prend du temps, et pendant ces
     deux attentes PLUS RIEN N'EST PEINT sur le canvas. Or `captureStream`
     n'émet une image que lorsqu'on dessine : l'enregistrement continuait donc
     de tourner sur une image morte, à chaque jonction de plans, c'est à dire
     précisément là où se jouent les transitions. Le film gardait ces temps
     morts, ce qui donnait une vidéo qui se fige au changement de plan.

     On prépare donc le plan suivant PENDANT que le plan courant joue. Le
     créneau vidéo alterné (pair/impair) est libre à ce moment-là : celui du
     plan précédent a été relâché à la fin du fondu d'entrée. */
  const prepared = new Map<number, Promise<void>>();
  function prepare(idx: number) {
    const cc = clips[idx];
    if (!cc || prepared.has(idx)) return;
    if (cc.kind !== "video") {
      prepared.set(idx, loadImage(cc.src).then(() => undefined).catch(() => undefined));
      return;
    }
    const vv = videoSlots[idx % 2];
    // Le créneau peut encore lire le plan d'avant : on l'arrête avant de lui
    // donner une nouvelle source, sinon son son continuerait sur l'export.
    try { vv.pause(); } catch { /* déjà à l'arrêt */ }
    prepared.set(idx, new Promise<void>((resolve) => {
      vv.onloadedmetadata = () => {
        vv.onseeked = () => resolve();
        try { vv.currentTime = cc.trimStart; } catch { resolve(); }
      };
      vv.onerror = () => resolve();
      vv.src = cc.src;
    }));
  }

  // ── Fondu croisé réel ("fade") : le plan sortant reste "vivant" (élément vidéo
  // encore en lecture / minuteur photo non réinitialisé) et cohabite avec le plan
  // entrant pendant transitionDur, avec un fondu enchaîné dessiné à la main (les
  // deux flux avancent réellement) — cf. commentaire en tête de fichier.
  type PlayingMedia = { kind: "video" | "photo"; el: HTMLVideoElement | HTMLImageElement; clip: ClipTimed; photoStart: number };

  function localTimeOf(m: PlayingMedia): number {
    if (m.kind === "video") return ((m.el as HTMLVideoElement).currentTime - m.clip.trimStart) / m.clip.speed;
    return (performance.now() - m.photoStart) / 1000;
  }
  /** Un des deux plans d'une transition, avec l'état qui lui revient. */
  function drawPairSide(m: PlayingMedia, st: TransitionState) {
    drawMediaWithState(ctx, m.el, m.clip, localTimeOf(m), st);
  }

  let prevMedia: PlayingMedia | null = null;

  try {
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      onProgress(c.start / total);
      const next = clips[i + 1];
      const gapBefore = Math.max(0, c.gapBefore ?? 0);

      // ── Écran noir (trou) avant ce plan ─────────────────────────────────────
      // Rien à décoder : on remplit le canvas de noir et on compose les pistes
      // (overlays, sous-titres, titres, stickers, audio) actives pendant le trou.
      if (gapBefore > 0) {
        const gapStart = c.start - gapBefore;
        const t0 = performance.now();
        await new Promise<void>((resolve) => {
          const stop = ticker.every(1000 / FPS, () => {
            const elapsed = (performance.now() - t0) / 1000;
            armerEcheance();
            if (elapsed >= gapBefore || echeanceAtteinte()) { stop(); resolve(); return; }
            const globalT = gapStart + elapsed;
            updateAudioAt(globalT);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
            drawOverlays(globalT);
            drawCaptions(ctx, project.captions, project.subStyleId, project.subCustom, project.subPos, globalT, project.linkedSubs ?? true);
            drawTitles(ctx, project.titles, globalT);
            drawStickers(ctx, project.stickers, stickerImages, globalT);
            if (project.showProgressBar) drawProgressBar(ctx, globalT, total);
          });
        });
      }

      // Une transition n'a rien à enchaîner à travers un trou : on la désactive quand
      // ce plan (entrée) ou le suivant (sortie) est précédé d'un écran noir.
      const aUneTransition = (cl: ClipTimed | undefined) => !!cl && !!cl.transitionIn && cl.transitionIn !== "cut" && cl.transitionDur > 0;
      const recouvrementIn = i > 0 && aUneTransition(c) && !!prevMedia && gapBefore <= 0;
      const nextGap = next ? Math.max(0, next.gapBefore ?? 0) : 0;
      const recouvrementOutDur = aUneTransition(next) && nextGap <= 0 ? Math.min(next!.transitionDur, c.dur) : 0;

      let media: PlayingMedia;
      if (c.kind === "video") {
        const v = videoSlots[i % 2];
        prepare(i);                 // déjà lancé au plan précédent, sauf pour le premier
        await prepared.get(i);
        prepared.delete(i);
        v.playbackRate = c.speed;
        videoGains[i % 2].gain.value = c.vol ?? 1;
        await v.play();
        media = { kind: "video", el: v, clip: c, photoStart: 0 };
      } else {
        const img = await loadImage(c.src);
        media = { kind: "photo", el: img, clip: c, photoStart: performance.now() };
      }

      // Transition d'entrée : le plan précédent (toujours en lecture) et celui-ci
      // cohabitent pendant transitionDur, chacun avec son propre mouvement.
      if (recouvrementIn) {
        const prevM = prevMedia!;
        const transDur = c.transitionDur;
        const overlapStart = performance.now();
        await new Promise<void>((resolve) => {
          const stop = ticker.every(1000 / FPS, () => {
            const elapsed = (performance.now() - overlapStart) / 1000;
            armerEcheance();
            if (elapsed >= transDur || echeanceAtteinte()) { stop(); resolve(); return; }
            const globalT = c.start + elapsed;
            updateAudioAt(globalT);
            ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
            const paire = transitionPairAt(c.transitionIn, c.transitionDur, elapsed, false);
            drawPairSide(prevM, paire.out);
            drawPairSide(media, paire.in);
            drawTransitionVeils(ctx, paire.in);
            drawOverlays(globalT);
            drawCaptions(ctx, project.captions, project.subStyleId, project.subCustom, project.subPos, globalT, project.linkedSubs ?? true);
            drawTitles(ctx, project.titles, globalT);
            drawStickers(ctx, project.stickers, stickerImages, globalT);
            if (project.showProgressBar) drawProgressBar(ctx, globalT, total);
          });
        });
        if (prevM.kind === "video") (prevM.el as HTMLVideoElement).pause();
      }

      // Le créneau du plan précédent vient d'être relâché : on y charge le suivant
      // pendant que celui-ci joue, sans attendre le résultat.
      prepare(i + 1);

      // Corps du plan, hors fenêtre(s) de fondu croisé déjà couvertes ci-dessus/ci-dessous.
      const soloStart = recouvrementIn ? c.transitionDur : 0;
      const soloEnd = Math.max(soloStart, c.dur - recouvrementOutDur);
      if (c.kind === "video") {
        const v = media.el as HTMLVideoElement;
        await new Promise<void>((resolve) => {
          // Cadencé par le minuteur du worker : rAF est suspendu en arrière-plan,
          // et le setInterval de la page y tombe à une fois par seconde (mesuré).
          const stop = ticker.every(1000 / FPS, () => {
            const localT = (v.currentTime - c.trimStart) / c.speed;
            armerEcheance();
            if (v.paused || localT >= soloEnd || v.ended || echeanceAtteinte()) { stop(); resolve(); return; }
            const globalT = c.start + localT;
            videoGains[i % 2].gain.value = clipAudioGainAt(c, localT); // volume + fondus du son du plan
            updateAudioAt(globalT);
            drawMediaFrame(ctx, v, c, localT, i === 0);
            drawOverlays(globalT);
            drawCaptions(ctx, project.captions, project.subStyleId, project.subCustom, project.subPos, globalT, project.linkedSubs ?? true);
            drawTitles(ctx, project.titles, globalT);
            drawStickers(ctx, project.stickers, stickerImages, globalT);
            if (project.showProgressBar) drawProgressBar(ctx, globalT, total);
            maybeCaptureThumbnail(i === 0);
          });
        });
        if (recouvrementOutDur <= 0) v.pause();
      } else {
        const img = media.el as HTMLImageElement;
        await new Promise<void>((resolve) => {
          const stop = ticker.every(1000 / FPS, () => {
            const localT = (performance.now() - media.photoStart) / 1000;
            armerEcheance();
            if (localT >= soloEnd || echeanceAtteinte()) { stop(); resolve(); return; }
            const globalT = c.start + localT;
            updateAudioAt(globalT);
            drawMediaFrame(ctx, img, c, localT, i === 0);
            drawOverlays(globalT);
            drawCaptions(ctx, project.captions, project.subStyleId, project.subCustom, project.subPos, globalT, project.linkedSubs ?? true);
            drawTitles(ctx, project.titles, globalT);
            drawStickers(ctx, project.stickers, stickerImages, globalT);
            if (project.showProgressBar) drawProgressBar(ctx, globalT, total);
            maybeCaptureThumbnail(i === 0);
          });
        });
      }

      prevMedia = media;
    }
    if (prevMedia?.kind === "video") (prevMedia.el as HTMLVideoElement).pause();
  } finally {
    onProgress(1);
    const derive = tempsEcoule() - total;
    if (derive > 0.5) {
      console.warn(`[export] rendu en retard de ${derive.toFixed(1)} s sur les ${total.toFixed(1)} s de montage : le fichier a été coupé à la longueur de la timeline.`);
    }
    recorder.stop();
    audioEls.forEach(({ el }) => el.pause());
    overlayMedia.forEach((m) => { if (m.video) m.video.pause(); });
  }

  const blob = await stopped;
  ticker.dispose();
  // Un fichier minuscule pour un montage de plusieurs secondes veut dire que
  // presque aucune image n'a été encodée. Mieux vaut le dire que rendre une
  // vidéo vide qu'on découvrira sur Instagram.
  if (blob.size < 20_000 && total > 1) {
    throw new Error("L'enregistrement n'a produit presque aucune image. Réessayez en gardant l'onglet au premier plan.");
  }
  try { silence.stop(); } catch { /* déjà arrêtée */ }
  await audioCtx.close();
  await thumbnailPromise;
  return { blob, thumbnailBlob, mimeType: actualType };
}

/* Point d'entrée unique de l'export.

   Le rendu hors temps réel est la voie normale : c'est le seul chemin où le
   fichier produit est exactement le montage, indépendamment de la machine. Le
   chemin temps réel ne sert plus qu'aux navigateurs sans WebCodecs, et si le
   rendu hors ligne échoue en cours de route on préfère encore un fichier
   imparfait à un export perdu. */
export async function renderExport(project: ExportProject, onProgress: (p: number) => void): Promise<ExportResult> {
  if (exportOfflineDisponible()) {
    try {
      return await renderExportOffline(project, onProgress);
    } catch (e) {
      console.warn("[export] rendu hors temps réel abandonné, repli sur la captation :", e);
      onProgress(0);
    }
  } else {
    console.warn("[export] WebCodecs indisponible : captation en temps réel (durée et fluidité dépendantes de la machine).");
  }
  return renderExportTempsReel(project, onProgress);
}
