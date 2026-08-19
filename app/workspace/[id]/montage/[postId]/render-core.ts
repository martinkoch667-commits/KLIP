// render-core.ts — le DESSIN d'une image du montage, et rien d'autre.
//
// Ce fichier ne connaît ni le temps qui passe, ni l'encodeur : on lui donne un
// contexte 2D, un instant de la timeline et les médias déjà positionnés, il
// peint. C'est exactement ce qu'il faut pour que les deux chemins d'export
// partagent le même rendu à la lettre :
//   - export-offline.ts : image par image, hors temps réel (chemin normal)
//   - export.ts         : captation d'écran en temps réel (repli)
// Ces fonctions viennent telles quelles de export.ts, où elles étaient
// enfermées avec la boucle de captation.

import { MontageClip, OverlayClip, Caption, TitleEl, StickerEl, AudioTrack, SubCustom, effectiveSubStyle, resolveCapStyle, resolveCapPos, SUB_BASE_FONT, wrapWords, captionPartAt, subCanvasFont, subBgBox, curveLayout, applySubCase, withAlpha, transitionStateAt, DEFAULT_SUB_POS, clipFilterCss, overlayFilterCss, clipTimelineDur, clipAudioGainAt, overlayTimelineDur, overlayAudioGainAt, audioVolumeAt, kenBurnsScale, videoFormatById, exportQualityById } from "./constants";
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
  /** Type MIME réellement produit par MediaRecorder — tous les navigateurs ne
   *  donnent pas le même conteneur, et l'appelant doit savoir s'il lui reste un
   *  transcodage à faire. */
  mimeType: string;
}

export interface ClipTimed extends MontageClip {
  start: number;
  end: number;
  dur: number;
}

export function withStarts(clips: MontageClip[]): ClipTimed[] {
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
export const FPS = 30;

/** Fixe les dimensions du cadre pour tout le fichier. À appeler AVANT le
 *  premier dessin : les fonctions ci-dessous ferment sur ces deux variables. */
export function setCanvasSize(w: number, h: number) { CANVAS_W = w; CANVAS_H = h; }

export function drawCover(ctx: CanvasRenderingContext2D, media: CanvasImageSource, mw: number, mh: number, focusX = 0.5, focusY = 0.5) {
  if (!mw || !mh) return;
  const scale = Math.max(CANVAS_W / mw, CANVAS_H / mh);
  const w = mw * scale, h = mh * scale;
  const minX = CANVAS_W - w, minY = CANVAS_H - h; // bornes "cover" (<= 0)
  const x = Math.min(0, Math.max(minX, CANVAS_W / 2 - focusX * w));
  const y = Math.min(0, Math.max(minY, CANVAS_H / 2 - focusY * h));
  ctx.drawImage(media, x, y, w, h);
}

// entrée transition : délègue à la SOURCE UNIQUE (constants.ts) puis convertit
// les fractions en pixels du canvas. L'aperçu utilise exactement le même calcul.
function transitionState(clip: ClipTimed, tIntoClip: number, isFirst: boolean) {
  const s = transitionStateAt(clip.transitionIn, clip.transitionDur, tIntoClip, isFirst);
  const diag = Math.hypot(CANVAS_W, CANVAS_H);
  return {
    alpha: s.alpha,
    dx: s.dx * CANVAS_W,
    dy: s.dy * CANVAS_H,
    scale: s.scale,
    rotate: s.rotate,
    flash: s.flash,
    dark: s.dark,
    extraFilter: s.extraFilter,
    clipRect: s.clipRect
      ? ([s.clipRect[0] * CANVAS_W, s.clipRect[1] * CANVAS_H, s.clipRect[2] * CANVAS_W, s.clipRect[3] * CANVAS_H] as [number, number, number, number])
      : null,
    clipCircle: s.clipCircle
      ? ([s.clipCircle[0] * CANVAS_W, s.clipCircle[1] * CANVAS_H, s.clipCircle[2] * diag] as [number, number, number])
      : null,
  };
}

export function drawMediaFrame(ctx: CanvasRenderingContext2D, media: HTMLVideoElement | HTMLImageElement, clip: ClipTimed, tIntoClip: number, isFirst: boolean) {
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
  // Iris : le plan entrant n'apparaît qu'à l'intérieur d'un disque grandissant.
  if (tr.clipCircle) {
    ctx.beginPath();
    ctx.arc(tr.clipCircle[0], tr.clipCircle[1], Math.max(0, tr.clipCircle[2]), 0, Math.PI * 2);
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
  // Voile noir (transition "fondu au noir").
  if (tr.dark > 0) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, tr.dark));
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();
  }
}

export function drawCaptions(ctx: CanvasRenderingContext2D, captions: Caption[], subStyleId: string, subCustom: SubCustom | undefined, subPos: { x: number; y: number } | undefined, t: number, linkedSubs: boolean = true) {
  const cap = captions.find((c) => t >= c.start && t <= c.end);
  if (!cap) return;
  // Sous-titres déliés : chaque bloc honore ses propres surcharges de style/position.
  const style = resolveCapStyle(cap, subStyleId, subCustom, linkedSubs);
  // Le nombre de lignes est une VRAIE limite : ce qui ne rentre pas est passé au
  // sous-titre suivant (même découpage que l'aperçu, cf. fitCaptionParts).
  const part = captionPartAt(cap, style, CANVAS_W, t);
  const rawWords = part.text.split(/\s+/).filter(Boolean);
  const words = rawWords.map((w) => applySubCase(w, style.caseMode));
  const progress = (t - part.start) / Math.max(0.1, part.end - part.start);
  // anim "none" : aucun mot n'est « actif », donc aucun surlignage — le
  // sous-titre s'affiche d'un bloc, comme dans l'aperçu.
  const activeIdx = style.anim === "none"
    ? -1
    : Math.min(words.length - 1, Math.floor(progress * words.length));

  const fontSize = SUB_BASE_FONT * style.scale;
  // Même police que la mesure du découpage (subMeasure), sinon on découperait
  // selon une police et on dessinerait avec une autre.
  ctx.font = subCanvasFont(style, fontSize);
  ctx.textBaseline = "middle";
  // Interlettrage (Chrome ≥ 99) — ignoré silencieusement ailleurs.
  const ctxLS = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const prevLS = ctxLS.letterSpacing;
  if (style.letterSpacing) ctxLS.letterSpacing = `${style.letterSpacing * fontSize}px`;

  const padX = style.padX * style.scale, padY = style.padY * style.scale;
  // Retour à la ligne, comme l'aperçu. Sans ça un sous-titre un peu long était
  // dessiné d'un seul trait et débordait du cadre dans la vidéo rendue.
  const maxBoxW = (style.maxWidth / 100) * CANVAS_W;
  const measure = (str: string) => ctx.measureText(str).width;
  const lines = wrapWords(words, measure, maxBoxW - padX * 2, style.maxLines);
  const lineW = lines.map((ln) => measure(ln.join(" ")));
  const boxW = Math.min(maxBoxW, Math.max(...lineW) + padX * 2);
  const lineStep = fontSize * style.lineHeight;
  const boxH = lineStep * lines.length + padY * 2;
  const pos = resolveCapPos(cap, subPos);
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
    // Même géométrie que l'aperçu : le fond peut être élargi, rehaussé et décalé
    // indépendamment du texte (cf. subBgBox / subBgLayerCss).
    const b = subBgBox(style, boxW, boxH, style.scale);
    ctx.beginPath();
    ctx.roundRect(boxX + b.x, boxY + b.y, b.w, b.h, b.r);
    ctx.fill();
  }

  // Alignement calculé LIGNE PAR LIGNE (une seule origine ne marchait que sur
  // une ligne unique).
  const innerW = boxW - padX * 2;
  const lineX = (w: number) => style.align === "left" ? boxX + padX
        : style.align === "right" ? boxX + padX + innerW - w
        : boxX + boxW / 2 - w / 2;

  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.lineWidth = style.strokeW * 2 * style.scale; // strokeText déborde de moitié

  // Ombre / lueur : mêmes réglages que subTextShadowCss côté aperçu.
  // Nombre de passes de lueur : le canvas n'a pas d'étalement sur shadowBlur, on
  // redessine donc le texte avec des flous croissants — exactement ce que fait
  // subTextShadowCss en empilant des text-shadow.
  const glowPasses = style.glowColor && style.glowBlur > 0 ? Math.max(1, Math.round(style.glowSpread)) : 0;
  const applyGlowPass = (i: number) => {
    ctx.shadowColor = style.glowColor;
    ctx.shadowBlur = style.glowBlur * i * style.scale;
    ctx.shadowOffsetX = style.glowX * style.scale;
    ctx.shadowOffsetY = style.glowY * style.scale;
  };
  const applyShadow = () => {
    if (glowPasses) {
      applyGlowPass(1);
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

  // ── Texte cintré ──────────────────────────────────────────────────────────
  // Même formule que l'aperçu (curveLayout) : caractère par caractère, angle
  // constant. On sort par ce chemin car la courbe rend l'avance mot par mot
  // caduque — chaque lettre a sa propre rotation.
  if (style.curve) {
    const chars = Array.from(words.join(" "));
    const lay = curveLayout(chars.length, style.curve, fontSize);
    const totalW = chars.reduce((acc, ch) => acc + ctx.measureText(ch).width, 0);
    let cx = boxX + boxW / 2 - totalW / 2;
    const cy = boxY + boxH / 2;
    chars.forEach((ch, i) => {
      const w = ctx.measureText(ch).width;
      ctx.save();
      ctx.globalAlpha = style.opacity;
      ctx.translate(cx + w / 2, cy + lay[i].dy);
      ctx.rotate((lay[i].deg * Math.PI) / 180);
      applyShadow();
      if (style.stroke && style.strokeW > 0) { ctx.strokeStyle = style.stroke; ctx.strokeText(ch, -w / 2, 0); }
      ctx.fillStyle = style.fg;
      for (let g = 2; g <= glowPasses; g++) { applyGlowPass(g); ctx.fillText(ch, -w / 2, 0); }
      if (glowPasses) applyGlowPass(1);
      ctx.fillText(ch, -w / 2, 0);
      clearShadow();
      ctx.restore();
      cx += w;
    });
    ctx.restore();
    ctx.globalAlpha = 1;
    clearShadow();
    if (style.letterSpacing) ctxLS.letterSpacing = prevLS ?? "0px";
    return;
  }

  let wordIndex = 0;
  lines.forEach((ln, li) => {
  // Centre vertical de CETTE ligne.
  const y = boxY + padY + lineStep * li + lineStep / 2;
  let x = lineX(lineW[li]);
  ln.forEach((w) => {
    const i = wordIndex++;
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
    // Passes de lueur au-delà de la première (l'intervalle).
    for (let g = 2; g <= glowPasses; g++) { applyGlowPass(g); ctx.fillText(w, x, y); }
    if (glowPasses) applyGlowPass(1);
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
  });

  ctx.restore();
  ctx.globalAlpha = 1;
  clearShadow();
  if (style.letterSpacing) ctxLS.letterSpacing = prevLS ?? "0px";
}

export function drawTitles(ctx: CanvasRenderingContext2D, titles: TitleEl[], t: number) {
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

export function drawStickers(ctx: CanvasRenderingContext2D, stickers: StickerEl[], images: Map<string, HTMLImageElement>, t: number) {
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
export function drawOverlayFrame(ctx: CanvasRenderingContext2D, media: HTMLVideoElement | HTMLImageElement, o: OverlayClip) {
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

export function drawProgressBar(ctx: CanvasRenderingContext2D, t: number, total: number) {
  const trackY = CANVAS_H - 24, trackX = 24, trackW = CANVAS_W - 48;
  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.beginPath(); ctx.roundRect(trackX, trackY, trackW, 5, 3); ctx.fill();
  // Violet : c'est la couleur de la vidéo dans le produit, jusque dans l'export.
  ctx.fillStyle = "#8B7BF0";
  ctx.beginPath(); ctx.roundRect(trackX, trackY, trackW * Math.min(1, t / Math.max(0.01, total)), 5, 3); ctx.fill();
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
