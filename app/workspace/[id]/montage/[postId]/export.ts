// export.ts — moteur d'export réel du module Montage.
// Rendu 100% client (canvas 2D + Web Audio + MediaRecorder), sans dépendance
// serveur/infra (Vercel serverless ne permet pas ffmpeg). Lit la timeline
// (plans rognés/vitesse/filtres, sous-titres, titres, stickers, audio) et
// produit un fichier .webm téléchargé/uploadé en Storage.
//
// Limite connue (documentée) : les transitions entre plans sont rendues comme
// une animation d'entrée sur le plan entrant (fondu/zoom/glissé/balayage/flou),
// pas comme un vrai fondu-enchaîné entre deux flux vidéo décodés en parallèle —
// ce dernier nécessiterait de décoder N vidéos simultanément, hors de portée
// raisonnable d'un rendu client pour ce lot.

import { MontageClip, OverlayClip, Caption, TitleEl, StickerEl, AudioTrack, SubCustom, effectiveSubStyle, DEFAULT_SUB_POS, clipFilterCss, overlayFilterCss, clipTimelineDur, overlayTimelineDur, audioVolumeAt, kenBurnsScale } from "./constants";

export interface ExportProject {
  clips: MontageClip[];
  overlays?: OverlayClip[];
  captions: Caption[];
  subStyleId: string;
  subCustom?: SubCustom;
  subPos?: { x: number; y: number };
  titles: TitleEl[];
  stickers: StickerEl[];
  audioTracks: AudioTrack[];
  showProgressBar: boolean;
}

interface ClipTimed extends MontageClip {
  start: number;
  end: number;
  dur: number;
}

function withStarts(clips: MontageClip[]): ClipTimed[] {
  let acc = 0;
  return clips.map((c) => {
    const dur = clipTimelineDur(c);
    const start = acc;
    acc += dur;
    return { ...c, start, end: acc, dur };
  });
}

const CANVAS_W = 720;
const CANVAS_H = 1280;
const FPS = 30;

function drawCover(ctx: CanvasRenderingContext2D, media: CanvasImageSource, mw: number, mh: number) {
  if (!mw || !mh) return;
  const scale = Math.max(CANVAS_W / mw, CANVAS_H / mh);
  const w = mw * scale, h = mh * scale;
  const x = (CANVAS_W - w) / 2, y = (CANVAS_H - h) / 2;
  ctx.drawImage(media, x, y, w, h);
}

// entrée transition : renvoie transform/alpha/filtre à appliquer sur le média du plan entrant
function transitionState(clip: ClipTimed, tIntoClip: number, isFirst: boolean) {
  const st = { alpha: 1, dx: 0, dy: 0, scale: 1, extraFilter: "", clipRect: null as null | [number, number, number, number] };
  if (isFirst || clip.transitionIn === "cut" || clip.transitionDur <= 0 || tIntoClip >= clip.transitionDur) return st;
  const p = Math.max(0, Math.min(1, tIntoClip / clip.transitionDur));
  const ease = 1 - Math.pow(1 - p, 2);
  switch (clip.transitionIn) {
    case "fade": st.alpha = ease; break;
    case "zoom": st.scale = 1.18 - 0.18 * ease; st.alpha = 0.2 + 0.8 * ease; break;
    case "slide": st.dx = (1 - ease) * CANVAS_W * 0.5; st.alpha = 0.3 + 0.7 * ease; break;
    case "wipe": st.clipRect = [0, 0, CANVAS_W * ease, CANVAS_H]; break;
    case "blur": st.extraFilter = `blur(${(1 - ease) * 14}px)`; st.alpha = 0.5 + 0.5 * ease; break;
  }
  return st;
}

function drawMediaFrame(ctx: CanvasRenderingContext2D, media: HTMLVideoElement | HTMLImageElement, clip: ClipTimed, tIntoClip: number, isFirst: boolean) {
  const mw = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const mh = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  const tr = transitionState(clip, tIntoClip, isFirst);
  const kbP = clip.dur > 0 ? Math.min(1, tIntoClip / clip.dur) : 0;
  const kbScale = clip.kind === "photo" ? kenBurnsScale(clip.kenBurns, kbP) : 1;
  const scale = tr.scale * kbScale;
  ctx.save();
  ctx.globalAlpha = tr.alpha;
  ctx.filter = [clipFilterCss(clip), tr.extraFilter].filter(Boolean).join(" ") || "none";
  if (tr.clipRect) {
    ctx.beginPath();
    ctx.rect(...tr.clipRect);
    ctx.clip();
  }
  if (scale !== 1 || tr.dx || tr.dy) {
    ctx.translate(CANVAS_W / 2 + tr.dx, CANVAS_H / 2 + tr.dy);
    ctx.scale(scale, scale);
    ctx.translate(-CANVAS_W / 2, -CANVAS_H / 2);
  }
  drawCover(ctx, media, mw, mh);
  ctx.restore();
}

function drawCaptions(ctx: CanvasRenderingContext2D, captions: Caption[], subStyleId: string, subCustom: SubCustom | undefined, subPos: { x: number; y: number } | undefined, t: number) {
  const cap = captions.find((c) => t >= c.start && t <= c.end);
  if (!cap) return;
  const style = effectiveSubStyle(subStyleId, subCustom);
  const rawWords = cap.text.split(/\s+/).filter(Boolean);
  const words = style.uppercase ? rawWords.map((w) => w.toUpperCase()) : rawWords;
  const progress = (t - cap.start) / Math.max(0.1, cap.end - cap.start);
  const activeIdx = Math.min(words.length - 1, Math.floor(progress * words.length));

  const fontSize = 34 * style.scale;
  const fam = style.font
    ? (/serif/i.test(style.font) ? "Georgia, serif" : /mono/i.test(style.font) ? "ui-monospace, monospace" : "system-ui, sans-serif")
    : (style.italic ? "Georgia, serif" : "system-ui, sans-serif");
  ctx.font = `${style.weight} ${style.italic ? "italic " : ""}${fontSize}px ${fam}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const line = words.join(" ");
  const metrics = ctx.measureText(line);
  const padX = style.pill ? 22 : 16, padY = style.pill ? 12 : 10;
  const boxW = Math.min(CANVAS_W - 60, metrics.width + padX * 2);
  const boxH = fontSize + padY * 2;
  const pos = subPos || DEFAULT_SUB_POS;
  const cxPos = (pos.x / 100) * CANVAS_W;
  const cyPos = (pos.y / 100) * CANVAS_H;
  const boxX = Math.max(20, Math.min(CANVAS_W - 20 - boxW, cxPos - boxW / 2));
  const boxY = Math.max(10, Math.min(CANVAS_H - 10 - boxH, cyPos - boxH / 2));

  if (style.bg !== "transparent") {
    ctx.fillStyle = style.bg;
    const r = style.pill ? boxH / 2 : 8;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, r);
    ctx.fill();
  }

  let x = boxX + boxW / 2 - metrics.width / 2;
  const y = boxY + boxH / 2;
  if (style.bg === "transparent" && !style.stroke) {
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowBlur = 8;
  }
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  words.forEach((w, i) => {
    const wordProg = Math.max(0, Math.min(1, progress * words.length - i));
    const revealed = i <= activeIdx;
    ctx.globalAlpha = revealed ? 0.35 + 0.65 * wordProg : 0.28;
    if (style.stroke) {
      ctx.strokeStyle = style.stroke;
      ctx.strokeText(w, x, y);
    }
    ctx.fillStyle = i === activeIdx ? style.hi : style.fg;
    ctx.fillText(w, x, y);
    x += ctx.measureText(w + " ").width;
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawTitles(ctx: CanvasRenderingContext2D, titles: TitleEl[], t: number) {
  for (const tt of titles) {
    if (t < tt.start || t > tt.end) continue;
    const local = t - tt.start;
    let alpha = 1, scale = 1, text = tt.text;
    if (tt.anim === "rise") { alpha = Math.min(1, local / 0.35); }
    else if (tt.anim === "pop") {
      const p = Math.min(1, local / 0.3);
      scale = p < 1 ? 0.7 + 0.38 * (1 - Math.pow(1 - p, 3)) : 1;
      alpha = Math.min(1, local / 0.15);
    } else if (tt.anim === "type") {
      const charsPerSec = 16;
      const n = Math.max(0, Math.min(text.length, Math.floor(local * charsPerSec)));
      text = text.slice(0, n);
    }
    const fontMap: Record<string, string> = { archivo: "800 italic 40px system-ui, sans-serif", instrument: "40px Georgia, serif", satoshi: "700 40px system-ui, sans-serif" };
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = fontMap[tt.font] || fontMap.archivo;
    ctx.fillStyle = tt.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,.5)";
    ctx.shadowBlur = 10;
    const x = (tt.x / 100) * CANVAS_W, y = (tt.y / 100) * CANVAS_H;
    ctx.translate(x, y);
    ctx.scale(scale * (tt.scale ?? 1), scale * (tt.scale ?? 1));
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}

function drawStickers(ctx: CanvasRenderingContext2D, stickers: StickerEl[], images: Map<string, HTMLImageElement>, t: number) {
  for (const s of stickers) {
    if (t < s.start || t > s.end) continue;
    const x = (s.x / 100) * CANVAS_W, y = (s.y / 100) * CANVAS_H;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s.scale, s.scale);
    if (s.isImage) {
      const img = images.get(s.glyph);
      if (img) ctx.drawImage(img, -32, -32, 64, 64);
    } else {
      ctx.font = "48px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.glyph, 0, 0);
    }
    ctx.restore();
  }
}

// Dessine un plan d'incrustation (PIP) à sa position/échelle/rotation/opacité.
function drawOverlayFrame(ctx: CanvasRenderingContext2D, media: HTMLVideoElement | HTMLImageElement, o: OverlayClip) {
  const mw = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const mh = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  if (!mw || !mh) return;
  const targetW = CANVAS_W * 0.5 * o.scale;
  const targetH = targetW * (mh / mw);
  const cx = (o.x / 100) * CANVAS_W, cy = (o.y / 100) * CANVAS_H;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, o.opacity ?? 1));
  ctx.filter = overlayFilterCss(o) || "none";
  ctx.translate(cx, cy);
  if (o.rotation) ctx.rotate((o.rotation * Math.PI) / 180);
  ctx.drawImage(media, -targetW / 2, -targetH / 2, targetW, targetH);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawProgressBar(ctx: CanvasRenderingContext2D, t: number, total: number) {
  const trackY = CANVAS_H - 24, trackX = 24, trackW = CANVAS_W - 48;
  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.beginPath(); ctx.roundRect(trackX, trackY, trackW, 5, 3); ctx.fill();
  ctx.fillStyle = "#2FD79B";
  ctx.beginPath(); ctx.roundRect(trackX, trackY, trackW * Math.min(1, t / Math.max(0.01, total)), 5, 3); ctx.fill();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function renderExport(project: ExportProject, onProgress: (p: number) => void): Promise<Blob> {
  const clips = withStarts(project.clips);
  const total = clips.length ? clips[clips.length - 1].end : 0;
  if (!total) throw new Error("Aucun plan à exporter");

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W; canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d")!;

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const dest = audioCtx.createMediaStreamDestination();

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.muted = false;
  const videoNode = audioCtx.createMediaElementSource(video);
  const videoGain = audioCtx.createGain();
  videoGain.gain.value = 1;
  videoNode.connect(videoGain).connect(dest);

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
  function updateAudioFades() {
    for (const { el, gain, track } of audioEls) {
      gain.gain.value = audioVolumeAt(track, el.currentTime);
    }
  }

  const stickerImages = new Map<string, HTMLImageElement>();
  for (const s of project.stickers) {
    if (s.isImage && !stickerImages.has(s.glyph)) {
      try { stickerImages.set(s.glyph, await loadImage(s.glyph)); } catch { /* logo indisponible, sticker ignoré */ }
    }
  }

  // ── Plans d'incrustation (PIP) : image ou vidéo superposée ────────────────────
  const overlays = project.overlays || [];
  const overlayMedia: { o: OverlayClip; video: HTMLVideoElement | null; img: HTMLImageElement | null; active: boolean }[] = [];
  for (const o of overlays) {
    if (o.kind === "photo") {
      let img: HTMLImageElement | null = null;
      try { img = await loadImage(o.src); } catch { /* image indisponible */ }
      overlayMedia.push({ o, video: null, img, active: false });
    } else {
      const ov = document.createElement("video");
      ov.crossOrigin = "anonymous"; ov.playsInline = true; ov.muted = false;
      try {
        const node = audioCtx.createMediaElementSource(ov);
        const gain = audioCtx.createGain(); gain.gain.value = o.vol ?? 1;
        node.connect(gain).connect(dest);
      } catch { /* audio overlay ignoré */ }
      await new Promise<void>((res) => { ov.onloadedmetadata = () => res(); ov.onerror = () => res(); ov.src = o.src; });
      overlayMedia.push({ o, video: ov, img: null, active: false });
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
          drawOverlayFrame(ctx, m.video, o);
        } else if (m.active) { m.video.pause(); m.active = false; }
      } else if (m.img && isActive) {
        drawOverlayFrame(ctx, m.img, o);
      }
    }
  }

  const stream = canvas.captureStream(FPS);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm;codecs=vp8,opus";
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" })); });

  recorder.start(200);
  audioEls.forEach(({ el }) => { el.currentTime = 0; el.play().catch(() => {}); });

  try {
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      onProgress(c.start / total);
      if (c.kind === "video") {
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
          video.src = c.src;
        });
        video.playbackRate = c.speed;
        videoGain.gain.value = c.vol ?? 1;
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
          video.currentTime = c.trimStart;
        });
        await video.play();
        await new Promise<void>((resolve) => {
          // setInterval (pas requestAnimationFrame) : rAF est suspendu/throttlé par le
          // navigateur quand l'onglet n'a pas le focus (ex. export lancé en tâche de fond),
          // ce qui gèle le rendu — setInterval continue de tourner de façon fiable.
          const iv = setInterval(() => {
            if (video.paused || video.currentTime >= c.trimEnd || video.ended) { clearInterval(iv); resolve(); return; }
            const localT = (video.currentTime - c.trimStart) / c.speed;
            const globalT = c.start + localT;
            updateAudioFades();
            drawMediaFrame(ctx, video, c, localT, i === 0);
            drawOverlays(globalT);
            drawCaptions(ctx, project.captions, project.subStyleId, project.subCustom, project.subPos, globalT);
            drawTitles(ctx, project.titles, globalT);
            drawStickers(ctx, project.stickers, stickerImages, globalT);
            if (project.showProgressBar) drawProgressBar(ctx, globalT, total);
          }, 1000 / FPS);
        });
        video.pause();
      } else {
        const img = await loadImage(c.src);
        const segStart = performance.now();
        await new Promise<void>((resolve) => {
          const iv = setInterval(() => {
            const localT = (performance.now() - segStart) / 1000;
            if (localT >= c.dur) { clearInterval(iv); resolve(); return; }
            const globalT = c.start + localT;
            updateAudioFades();
            drawMediaFrame(ctx, img, c, localT, i === 0);
            drawOverlays(globalT);
            drawCaptions(ctx, project.captions, project.subStyleId, project.subCustom, project.subPos, globalT);
            drawTitles(ctx, project.titles, globalT);
            drawStickers(ctx, project.stickers, stickerImages, globalT);
            if (project.showProgressBar) drawProgressBar(ctx, globalT, total);
          }, 1000 / FPS);
        });
      }
    }
  } finally {
    onProgress(1);
    recorder.stop();
    audioEls.forEach(({ el }) => el.pause());
    overlayMedia.forEach((m) => { if (m.video) m.video.pause(); });
  }

  const blob = await stopped;
  await audioCtx.close();
  return blob;
}
