// export.ts — moteur d'export réel du module Montage.
// Rendu 100% client (canvas 2D + Web Audio + MediaRecorder), sans dépendance
// serveur/infra (Vercel serverless ne permet pas ffmpeg). Lit la timeline
// (plans rognés/vitesse/filtres, sous-titres, titres, stickers, audio) et
// produit un fichier .webm téléchargé/uploadé en Storage.
//
// Transitions : pour "fade" spécifiquement, un vrai fondu enchaîné multi-flux —
// le plan sortant continue de jouer/s'animer (au lieu d'être figé sur son dernier
// frame) pendant que le plan entrant démarre, les deux décodés en parallèle
// (2 <video> alternées par index de plan + <img> déjà indépendantes pour les
// photos). Les autres transitions (zoom/glissé/balayage/flou) gardent le
// comportement précédent : le plan sortant reste figé, le plan entrant s'anime
// par-dessus — un vrai équivalent pour celles-ci nécessiterait un transform de
// sortie dédié par type, hors périmètre de ce lot.

import { MontageClip, OverlayClip, Caption, TitleEl, StickerEl, AudioTrack, SubCustom, effectiveSubStyle, applySubCase, withAlpha, DEFAULT_SUB_POS, clipFilterCss, overlayFilterCss, clipTimelineDur, clipAudioGainAt, overlayTimelineDur, overlayAudioGainAt, audioVolumeAt, kenBurnsScale, videoFormatById, exportQualityById } from "./constants";

export interface ExportProject {
  clips: MontageClip[];
  overlays?: OverlayClip[];
  captions: Caption[];
  subStyleId: string;
  subCustom?: SubCustom;
  subPos?: { x: number; y: number };
  linkedSubs?: boolean;
  titles: TitleEl[];
  stickers: StickerEl[];
  audioTracks: AudioTrack[];
  showProgressBar: boolean;
  formatId?: string;
  customW?: number;
  customH?: number;
  exportQuality?: string;
}

export interface ExportResult {
  blob: Blob;
  thumbnailBlob: Blob | null;
}

interface ClipTimed extends MontageClip {
  start: number;
  end: number;
  dur: number;
}

function withStarts(clips: MontageClip[]): ClipTimed[] {
  let acc = 0;
  return clips.map((c) => {
    acc += Math.max(0, c.gapBefore ?? 0); // écran noir inséré avant ce plan
    const dur = clipTimelineDur(c);
    const start = acc;
    acc += dur;
    return { ...c, start, end: acc, dur };
  });
}

// Dimensions du canvas d'export — fixées au début de renderExport() selon le
// format choisi (project.formatId). `let` plutôt que des paramètres enfilés
// dans chaque fonction de dessin ci-dessous, qui les referment toutes en closure ;
// un seul export tourne à la fois dans l'onglet, donc pas de risque de concurrence.
let CANVAS_W = 720;
let CANVAS_H = 1280;
const FPS = 30;

function drawCover(ctx: CanvasRenderingContext2D, media: CanvasImageSource, mw: number, mh: number, focusX = 0.5, focusY = 0.5) {
  if (!mw || !mh) return;
  const scale = Math.max(CANVAS_W / mw, CANVAS_H / mh);
  const w = mw * scale, h = mh * scale;
  const minX = CANVAS_W - w, minY = CANVAS_H - h; // bornes "cover" (<= 0)
  const x = Math.min(0, Math.max(minX, CANVAS_W / 2 - focusX * w));
  const y = Math.min(0, Math.max(minY, CANVAS_H / 2 - focusY * h));
  ctx.drawImage(media, x, y, w, h);
}

// entrée transition : renvoie transform/alpha/filtre à appliquer sur le média du plan entrant
function transitionState(clip: ClipTimed, tIntoClip: number, isFirst: boolean) {
  const st = { alpha: 1, dx: 0, dy: 0, scale: 1, rotate: 0, flash: 0, extraFilter: "", clipRect: null as null | [number, number, number, number] };
  if (isFirst || clip.transitionIn === "cut" || clip.transitionDur <= 0 || tIntoClip >= clip.transitionDur) return st;
  const p = Math.max(0, Math.min(1, tIntoClip / clip.transitionDur));
  const ease = 1 - Math.pow(1 - p, 2);
  switch (clip.transitionIn) {
    case "fade": st.alpha = ease; break;
    case "zoom": st.scale = 1.18 - 0.18 * ease; st.alpha = 0.2 + 0.8 * ease; break;
    case "zoomout": st.scale = 0.82 + 0.18 * ease; st.alpha = 0.3 + 0.7 * ease; break;
    case "slide": st.dx = (1 - ease) * CANVAS_W * 0.5; st.alpha = 0.3 + 0.7 * ease; break;
    case "slideup": st.dy = (1 - ease) * CANVAS_H * 0.4; st.alpha = 0.3 + 0.7 * ease; break;
    case "slidedown": st.dy = -(1 - ease) * CANVAS_H * 0.4; st.alpha = 0.3 + 0.7 * ease; break;
    case "spin": st.rotate = (1 - ease) * 22; st.scale = 0.85 + 0.15 * ease; st.alpha = ease; break;
    case "wipe": st.clipRect = [0, 0, CANVAS_W * ease, CANVAS_H]; break;
    case "blur": st.extraFilter = `blur(${(1 - ease) * 14}px)`; st.alpha = 0.5 + 0.5 * ease; break;
    case "whip": st.dx = (1 - ease) * CANVAS_W * 0.6; st.extraFilter = `blur(${(1 - ease) * 12}px)`; st.alpha = 0.4 + 0.6 * ease; break;
    case "flash": st.flash = 1 - ease; st.alpha = Math.min(1, 0.4 + ease); break;
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
  if (scale !== 1 || tr.dx || tr.dy || tr.rotate) {
    ctx.translate(CANVAS_W / 2 + tr.dx, CANVAS_H / 2 + tr.dy);
    if (tr.rotate) ctx.rotate((tr.rotate * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.translate(-CANVAS_W / 2, -CANVAS_H / 2);
  }
  drawCover(ctx, media, mw, mh, clip.focusX, clip.focusY);
  ctx.restore();
  // Flash blanc (transition "flash") par-dessus le plan entrant.
  if (tr.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, tr.flash));
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();
  }
}

function drawCaptions(ctx: CanvasRenderingContext2D, captions: Caption[], subStyleId: string, subCustom: SubCustom | undefined, subPos: { x: number; y: number } | undefined, t: number, linkedSubs: boolean = true) {
  const cap = captions.find((c) => t >= c.start && t <= c.end);
  if (!cap) return;
  // Sous-titres déliés : chaque bloc honore ses propres surcharges de style/position.
  const style = linkedSubs ? effectiveSubStyle(subStyleId, subCustom) : effectiveSubStyle(cap.styleId ?? subStyleId, cap.custom ?? {});
  const rawWords = cap.text.split(/\s+/).filter(Boolean);
  const words = rawWords.map((w) => applySubCase(w, style.caseMode));
  const progress = (t - cap.start) / Math.max(0.1, cap.end - cap.start);
  const activeIdx = Math.min(words.length - 1, Math.floor(progress * words.length));

  const fontSize = 34 * style.scale;
  const fam = style.font
    ? `'${style.font}', system-ui, sans-serif`
    : (style.italic ? "Georgia, serif" : "system-ui, sans-serif");
  ctx.font = `${style.italic ? "italic " : ""}${style.weight} ${fontSize}px ${fam}`;
  ctx.textBaseline = "middle";
  // Interlettrage (Chrome ≥ 99) — ignoré silencieusement ailleurs.
  const ctxLS = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const prevLS = ctxLS.letterSpacing;
  if (style.letterSpacing) ctxLS.letterSpacing = `${style.letterSpacing * fontSize}px`;

  const line = words.join(" ");
  const metrics = ctx.measureText(line);
  const padX = style.padX * style.scale, padY = style.padY * style.scale;
  const boxW = Math.min(CANVAS_W - 60, metrics.width + padX * 2);
  const boxH = fontSize * style.lineHeight + padY * 2;
  const pos = linkedSubs ? (subPos || DEFAULT_SUB_POS) : { x: cap.x ?? (subPos?.x ?? DEFAULT_SUB_POS.x), y: cap.y ?? (subPos?.y ?? DEFAULT_SUB_POS.y) };
  const cxPos = (pos.x / 100) * CANVAS_W;
  const cyPos = (pos.y / 100) * CANVAS_H;
  const boxX = Math.max(20, Math.min(CANVAS_W - 20 - boxW, cxPos - boxW / 2));
  const boxY = Math.max(10, Math.min(CANVAS_H - 10 - boxH, cyPos - boxH / 2));

  ctx.save();
  // Opacité globale + rotation autour du centre de la boîte (« Transformer »).
  ctx.globalAlpha = style.opacity;
  if (style.rotation) {
    ctx.translate(boxX + boxW / 2, boxY + boxH / 2);
    ctx.rotate((style.rotation * Math.PI) / 180);
    ctx.translate(-(boxX + boxW / 2), -(boxY + boxH / 2));
  }

  if (style.bg !== "transparent") {
    ctx.fillStyle = withAlpha(style.bg, style.bgOpacity);
    const r = style.pill ? boxH / 2 : style.radius * style.scale;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, r);
    ctx.fill();
  }

  // Alignement du texte dans la boîte.
  const innerW = boxW - padX * 2;
  let x = style.align === "left" ? boxX + padX
        : style.align === "right" ? boxX + padX + innerW - metrics.width
        : boxX + boxW / 2 - metrics.width / 2;
  const y = boxY + boxH / 2;

  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.lineWidth = style.strokeW * 2 * style.scale; // strokeText déborde de moitié

  // Ombre / lueur : mêmes réglages que subTextShadowCss côté aperçu.
  const applyShadow = () => {
    if (style.glowColor && style.glowBlur > 0) {
      ctx.shadowColor = style.glowColor;
      ctx.shadowBlur = style.glowBlur * style.scale;
      ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    } else if (style.shadowColor && (style.shadowBlur > 0 || style.shadowX || style.shadowY)) {
      ctx.shadowColor = style.shadowColor;
      ctx.shadowBlur = style.shadowBlur * style.scale;
      ctx.shadowOffsetX = style.shadowX * style.scale;
      ctx.shadowOffsetY = style.shadowY * style.scale;
    } else if (style.bg === "transparent" && !style.stroke) {
      ctx.shadowColor = "rgba(0,0,0,.6)";
      ctx.shadowBlur = 8 * style.scale;
      ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    }
  };
  const clearShadow = () => { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; };

  words.forEach((w, i) => {
    const wordProg = Math.max(0, Math.min(1, progress * words.length - i));
    const revealed = i <= activeIdx;
    ctx.globalAlpha = style.opacity * (revealed ? 0.35 + 0.65 * wordProg : 0.28);
    const wWidth = ctx.measureText(w).width;
    applyShadow();
    if (style.stroke && style.strokeW > 0) {
      ctx.strokeStyle = style.stroke;
      ctx.strokeText(w, x, y);
    }
    ctx.fillStyle = i === activeIdx ? style.hi : style.fg;
    ctx.fillText(w, x, y);
    clearShadow();
    // Soulignement (le canvas n'a pas text-decoration).
    if (style.underline) {
      const uy = y + fontSize * 0.42;
      ctx.strokeStyle = i === activeIdx ? style.hi : style.fg;
      ctx.lineWidth = Math.max(1, fontSize * 0.06);
      ctx.beginPath();
      ctx.moveTo(x, uy); ctx.lineTo(x + wWidth, uy); ctx.stroke();
      ctx.lineWidth = style.strokeW * 2 * style.scale;
    }
    x += ctx.measureText(w + " ").width;
  });

  ctx.restore();
  ctx.globalAlpha = 1;
  clearShadow();
  if (style.letterSpacing) ctxLS.letterSpacing = prevLS ?? "0px";
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
    if (tt.rotation) ctx.rotate((tt.rotation * Math.PI) / 180);
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
    if (s.rotation) ctx.rotate((s.rotation * Math.PI) / 180);
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

export async function renderExport(project: ExportProject, onProgress: (p: number) => void): Promise<ExportResult> {
  const fmt = project.formatId === "custom" && project.customW && project.customH
    ? { w: project.customW, h: project.customH }
    : videoFormatById(project.formatId);
  CANVAS_W = fmt.w; CANVAS_H = fmt.h;

  const clips = withStarts(project.clips);
  const total = clips.length ? clips[clips.length - 1].end : 0;
  if (!total) throw new Error("Aucun plan à exporter");

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W; canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d")!;

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const dest = audioCtx.createMediaStreamDestination();

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

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm;codecs=vp8,opus";
  const bitrate = exportQualityById(project.exportQuality).bitrate;
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" })); });

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

  // ── Fondu croisé réel ("fade") : le plan sortant reste "vivant" (élément vidéo
  // encore en lecture / minuteur photo non réinitialisé) et cohabite avec le plan
  // entrant pendant transitionDur, avec un fondu enchaîné dessiné à la main (les
  // deux flux avancent réellement) — cf. commentaire en tête de fichier.
  type PlayingMedia = { kind: "video" | "photo"; el: HTMLVideoElement | HTMLImageElement; clip: ClipTimed; photoStart: number };

  function localTimeOf(m: PlayingMedia): number {
    if (m.kind === "video") return ((m.el as HTMLVideoElement).currentTime - m.clip.trimStart) / m.clip.speed;
    return (performance.now() - m.photoStart) / 1000;
  }
  function drawDissolveFrame(m: PlayingMedia, alpha: number) {
    const media = m.el;
    const mw = media instanceof HTMLVideoElement ? media.videoWidth : (media as HTMLImageElement).naturalWidth;
    const mh = media instanceof HTMLVideoElement ? media.videoHeight : (media as HTMLImageElement).naturalHeight;
    const localT = localTimeOf(m);
    const kbP = m.clip.dur > 0 ? Math.min(1, Math.max(0, localT / m.clip.dur)) : 0;
    const kbScale = m.clip.kind === "photo" ? kenBurnsScale(m.clip.kenBurns, kbP) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = clipFilterCss(m.clip) || "none";
    if (kbScale !== 1) {
      ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
      ctx.scale(kbScale, kbScale);
      ctx.translate(-CANVAS_W / 2, -CANVAS_H / 2);
    }
    drawCover(ctx, media, mw, mh, m.clip.focusX, m.clip.focusY);
    ctx.restore();
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
          const iv = setInterval(() => {
            const elapsed = (performance.now() - t0) / 1000;
            if (elapsed >= gapBefore) { clearInterval(iv); resolve(); return; }
            const globalT = gapStart + elapsed;
            updateAudioAt(globalT);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
            drawOverlays(globalT);
            drawCaptions(ctx, project.captions, project.subStyleId, project.subCustom, project.subPos, globalT, project.linkedSubs ?? true);
            drawTitles(ctx, project.titles, globalT);
            drawStickers(ctx, project.stickers, stickerImages, globalT);
            if (project.showProgressBar) drawProgressBar(ctx, globalT, total);
          }, 1000 / FPS);
        });
      }

      // Un fondu enchaîné n'a pas de sens à travers un trou : on le désactive quand ce
      // plan (entrée) ou le suivant (sortie) est précédé d'un écran noir.
      const crossFadeIn = i > 0 && c.transitionIn === "fade" && c.transitionDur > 0 && !!prevMedia && gapBefore <= 0;
      const nextGap = next ? Math.max(0, next.gapBefore ?? 0) : 0;
      const crossFadeOutDur = next && next.transitionIn === "fade" && next.transitionDur > 0 && nextGap <= 0 ? Math.min(next.transitionDur, c.dur) : 0;

      let media: PlayingMedia;
      if (c.kind === "video") {
        const v = videoSlots[i % 2];
        await new Promise<void>((resolve) => {
          v.onloadedmetadata = () => resolve();
          v.src = c.src;
        });
        v.playbackRate = c.speed;
        videoGains[i % 2].gain.value = c.vol ?? 1;
        await new Promise<void>((resolve) => {
          v.onseeked = () => resolve();
          v.currentTime = c.trimStart;
        });
        await v.play();
        media = { kind: "video", el: v, clip: c, photoStart: 0 };
      } else {
        const img = await loadImage(c.src);
        media = { kind: "photo", el: img, clip: c, photoStart: performance.now() };
      }

      // Fondu enchaîné d'entrée : le plan précédent (toujours en lecture) et celui-ci
      // cohabitent pendant transitionDur.
      if (crossFadeIn) {
        const prevM = prevMedia!;
        const transDur = c.transitionDur;
        const overlapStart = performance.now();
        await new Promise<void>((resolve) => {
          const iv = setInterval(() => {
            const elapsed = (performance.now() - overlapStart) / 1000;
            if (elapsed >= transDur) { clearInterval(iv); resolve(); return; }
            const p = elapsed / transDur;
            const globalT = c.start + elapsed;
            updateAudioAt(globalT);
            ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
            drawDissolveFrame(prevM, 1 - p);
            drawDissolveFrame(media, p);
            drawOverlays(globalT);
            drawCaptions(ctx, project.captions, project.subStyleId, project.subCustom, project.subPos, globalT, project.linkedSubs ?? true);
            drawTitles(ctx, project.titles, globalT);
            drawStickers(ctx, project.stickers, stickerImages, globalT);
            if (project.showProgressBar) drawProgressBar(ctx, globalT, total);
          }, 1000 / FPS);
        });
        if (prevM.kind === "video") (prevM.el as HTMLVideoElement).pause();
      }

      // Corps du plan, hors fenêtre(s) de fondu croisé déjà couvertes ci-dessus/ci-dessous.
      const soloStart = crossFadeIn ? c.transitionDur : 0;
      const soloEnd = Math.max(soloStart, c.dur - crossFadeOutDur);
      if (c.kind === "video") {
        const v = media.el as HTMLVideoElement;
        await new Promise<void>((resolve) => {
          // setInterval (pas requestAnimationFrame) : rAF est suspendu/throttlé par le
          // navigateur quand l'onglet n'a pas le focus (ex. export lancé en tâche de fond),
          // ce qui gèle le rendu — setInterval continue de tourner de façon fiable.
          const iv = setInterval(() => {
            const localT = (v.currentTime - c.trimStart) / c.speed;
            if (v.paused || localT >= soloEnd || v.ended) { clearInterval(iv); resolve(); return; }
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
          }, 1000 / FPS);
        });
        if (crossFadeOutDur <= 0) v.pause();
      } else {
        const img = media.el as HTMLImageElement;
        await new Promise<void>((resolve) => {
          const iv = setInterval(() => {
            const localT = (performance.now() - media.photoStart) / 1000;
            if (localT >= soloEnd) { clearInterval(iv); resolve(); return; }
            const globalT = c.start + localT;
            updateAudioAt(globalT);
            drawMediaFrame(ctx, img, c, localT, i === 0);
            drawOverlays(globalT);
            drawCaptions(ctx, project.captions, project.subStyleId, project.subCustom, project.subPos, globalT, project.linkedSubs ?? true);
            drawTitles(ctx, project.titles, globalT);
            drawStickers(ctx, project.stickers, stickerImages, globalT);
            if (project.showProgressBar) drawProgressBar(ctx, globalT, total);
            maybeCaptureThumbnail(i === 0);
          }, 1000 / FPS);
        });
      }

      prevMedia = media;
    }
    if (prevMedia?.kind === "video") (prevMedia.el as HTMLVideoElement).pause();
  } finally {
    onProgress(1);
    recorder.stop();
    audioEls.forEach(({ el }) => el.pause());
    overlayMedia.forEach((m) => { if (m.video) m.video.pause(); });
  }

  const blob = await stopped;
  await audioCtx.close();
  await thumbnailPromise;
  return { blob, thumbnailBlob };
}
