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

import { MontageClip, Caption, TitleEl, StickerEl, AudioTrack, SUB_STYLES, clipFilterCss, clipTimelineDur } from "./constants";

export interface ExportProject {
  clips: MontageClip[];
  captions: Caption[];
  subStyleId: string;
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
  ctx.save();
  ctx.globalAlpha = tr.alpha;
  ctx.filter = [clipFilterCss(clip), tr.extraFilter].filter(Boolean).join(" ") || "none";
  if (tr.clipRect) {
    ctx.beginPath();
    ctx.rect(...tr.clipRect);
    ctx.clip();
  }
  if (tr.scale !== 1 || tr.dx || tr.dy) {
    ctx.translate(CANVAS_W / 2 + tr.dx, CANVAS_H / 2 + tr.dy);
    ctx.scale(tr.scale, tr.scale);
    ctx.translate(-CANVAS_W / 2, -CANVAS_H / 2);
  }
  drawCover(ctx, media, mw, mh);
  ctx.restore();
}

function drawCaptions(ctx: CanvasRenderingContext2D, captions: Caption[], subStyleId: string, t: number) {
  const cap = captions.find((c) => t >= c.start && t <= c.end);
  if (!cap) return;
  const style = SUB_STYLES.find((s) => s.id === subStyleId) || SUB_STYLES[0];
  const words = cap.text.split(/\s+/).filter(Boolean);
  const progress = (t - cap.start) / Math.max(0.1, cap.end - cap.start);
  const activeIdx = Math.min(words.length - 1, Math.floor(progress * words.length));

  const fontSize = 34;
  ctx.font = `${style.weight} ${style.italic ? "italic " : ""}${fontSize}px ${style.italic ? "Georgia, serif" : "system-ui, sans-serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const line = words.join(" ");
  const metrics = ctx.measureText(line);
  const padX = style.pill ? 22 : 16, padY = style.pill ? 12 : 10;
  const boxW = Math.min(CANVAS_W - 60, metrics.width + padX * 2);
  const boxH = fontSize + padY * 2;
  const boxX = (CANVAS_W - boxW) / 2;
  const boxY = CANVAS_H - 140 - boxH;

  if (style.bg !== "transparent") {
    ctx.fillStyle = style.bg;
    const r = style.pill ? boxH / 2 : 8;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, r);
    ctx.fill();
  }

  let x = CANVAS_W / 2 - metrics.width / 2;
  const y = boxY + boxH / 2;
  if (style.bg === "transparent") {
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowBlur = 8;
  }
  ctx.textAlign = "left";
  words.forEach((w, i) => {
    const wordProg = Math.max(0, Math.min(1, progress * words.length - i));
    const revealed = i <= activeIdx;
    ctx.globalAlpha = revealed ? 0.35 + 0.65 * wordProg : 0.28;
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

  const audioEls = project.audioTracks.map((t) => {
    const el = document.createElement("audio");
    el.crossOrigin = "anonymous";
    el.src = t.src;
    const node = audioCtx.createMediaElementSource(el);
    const gain = audioCtx.createGain();
    gain.gain.value = t.vol;
    node.connect(gain).connect(dest);
    return { el, track: t };
  });

  const stickerImages = new Map<string, HTMLImageElement>();
  for (const s of project.stickers) {
    if (s.isImage && !stickerImages.has(s.glyph)) {
      try { stickerImages.set(s.glyph, await loadImage(s.glyph)); } catch { /* logo indisponible, sticker ignoré */ }
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
            drawMediaFrame(ctx, video, c, localT, i === 0);
            drawCaptions(ctx, project.captions, project.subStyleId, globalT);
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
            drawMediaFrame(ctx, img, c, localT, i === 0);
            drawCaptions(ctx, project.captions, project.subStyleId, globalT);
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
  }

  const blob = await stopped;
  await audioCtx.close();
  return blob;
}
