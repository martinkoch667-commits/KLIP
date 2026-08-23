// lib/composeRender.ts — rendu hors écran d'un visuel composé.
//
// POURQUOI
// L'aperçu du Composer ne montrait que la photo brute, parce que le visuel fini
// n'existait pas encore : la composition (compose-layout) et sa matérialisation
// (materializeLayout) vivent dans l'ÉDITEUR, où il y a un canvas. Tant qu'on
// n'avait pas ouvert l'éditeur, il n'y avait rien d'autre à afficher.
//
// Ce module refait le chemin sans éditeur : un canvas hors écran, la photo, la
// mise en page choisie par l'IA, et les MÊMES règles de contraste que l'éditeur —
// dont l'échantillonnage de la luminance réelle de la photo à l'endroit exact où
// chaque texte tombe. C'est ce qui permet de promettre un aperçu fidèle et pas
// une approximation.
//
// Le module ne connaît ni React ni Supabase : il prend une photo et une mise en
// page, il rend une image.

export interface RenderBlock {
  text: string;
  role?: string;
  xPct?: number;
  yPct?: number;
  widthPct?: number;
  fontPct?: number;
  align?: string;
  /** Rôle de couleur de la charte, résolu par l'appelant. */
  color?: string;
  uppercase?: boolean;
  /** Aplat de couleur derrière le texte (cartouche / bandeau / pastille). */
  box?: 'none' | 'brand' | 'accent' | 'white' | 'black';
  /** Arrondi de l'aplat, en % de la hauteur du texte (50 = pastille). */
  radiusPct?: number;
}

/** Filet fin posé par la recette (soulignement, barre de kicker). */
export interface RenderAccent {
  type?: string;
  xPct?: number;
  yPct?: number;
  widthPct?: number;
  heightPct?: number;
  color?: string;
}

export interface RenderBrand {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  display?: string | null;
  body?: string | null;
}

export interface RenderInput {
  photoUrl: string | null;
  blocks: RenderBlock[];
  accents?: RenderAccent[] | null;
  scrim?: { position?: string; opacity?: number } | null;
  brand: RenderBrand;
  w: number;
  h: number;
}

const hexLum = (hex: string): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

/** Charge une image en passant par le proxy — les photos vivent sur Storage, et
 *  un canvas qui lit une image d'une autre origine devient inexportable. */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // Une image déjà locale (data:, blob:, ou servie par l'app elle-même) n'a
    // rien à faire dans le proxy — et y passer la rendait simplement introuvable.
    img.src = /^(data:|blob:|\/)/.test(url) ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`;
  });
}

/** Moyenne et écart-type de luminance sur une zone, en % du cadre. Mêmes valeurs
 *  que le `buildLumaSampler` de l'éditeur : c'est ce qui décide si le texte doit
 *  passer en blanc avec un voile. */
function makeSampler(img: HTMLImageElement) {
  const S = 64; // une vignette suffit : on cherche une tendance, pas un détail
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, S, S);
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, S, S).data; } catch { return null; }

  return (xp: number, yp: number, wp: number, hp: number) => {
    const x0 = Math.max(0, Math.floor((xp / 100) * S));
    const y0 = Math.max(0, Math.floor((yp / 100) * S));
    const x1 = Math.min(S, Math.ceil(((xp + wp) / 100) * S));
    const y1 = Math.min(S, Math.ceil(((yp + hp) / 100) * S));
    let sum = 0, sum2 = 0, n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * S + x) * 4;
        const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        sum += l; sum2 += l * l; n++;
      }
    }
    if (!n) return { mean: 0.5, std: 0 };
    const mean = sum / n;
    return { mean, std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)) };
  };
}

/** Découpe un texte en lignes qui tiennent dans `maxW`. */
function wrap(ctx: CanvasRenderingContext2D, txt: string, maxW: number): string[] {
  const words = txt.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Rend le visuel composé et renvoie une data URL PNG, ou null si la photo n'a pas
 * pu être chargée (on préfère alors laisser l'appelant afficher la photo brute
 * plutôt qu'un cadre vide).
 */
export async function renderComposedVisual(input: RenderInput): Promise<string | null> {
  const { photoUrl, blocks, brand, w, h } = input;
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // ── Fond : la photo en « cover », sinon un aplat de la charte ──
  let sampler: ReturnType<typeof makeSampler> = null;
  const img = photoUrl ? await loadImage(photoUrl) : null;
  if (img) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    sampler = makeSampler(img);
  } else {
    ctx.fillStyle = brand.primary || '#14160F';
    ctx.fillRect(0, 0, w, h);
  }

  const resolve = (c?: string) =>
    c === 'primary' ? (brand.primary || '#FFFFFF')
    : c === 'secondary' ? (brand.secondary || '#FFFFFF')
    : c === 'accent' ? (brand.accent || '#BDF2A0')
    : c === 'black' ? '#14160F'
    : '#FFFFFF';

  // ── Décision de contraste, bloc par bloc ──
  // Reprise à l'identique des règles de l'éditeur : c'est ce qui fait que
  // l'aperçu ressemble au résultat et non à une jolie approximation.
  let forceScrim = false;
  const resolved = blocks.filter((b) => b?.text).map((b) => {
    let fill = resolve(b.color);
    let shadow = false;
    // Aplat de marque : la lisibilité ne dépend plus de la photo, mais du fond posé.
    const boxFill = b.box === 'brand' ? resolve('primary')
      : b.box === 'accent' ? resolve('accent')
      : b.box === 'white' ? '#FFFFFF'
      : b.box === 'black' ? '#14160F'
      : null;
    if (boxFill) {
      return { b, fill: hexLum(boxFill) > 0.55 ? '#14160F' : '#FFFFFF', shadow: false, boxFill };
    }
    if (sampler) {
      const { mean, std } = sampler(b.xPct ?? 8, b.yPct ?? 70, b.widthPct ?? 80, Math.min(45, (b.fontPct ?? 7) * 2.6));
      const busy = std > 0.17;
      const contrastOK = !busy && Math.abs(mean - hexLum(fill)) > 0.45;
      if (busy) {
        // Fond chargé : on pose la matière de la marque derrière le texte plutôt
        // que de le blanchir sur un voile — même règle que l'éditeur, sinon
        // l'aperçu montrerait autre chose que le visuel final.
        const brandBg = brand.primary || brand.accent;
        if (brandBg) {
          return { b, fill: hexLum(brandBg) > 0.55 ? '#14160F' : '#FFFFFF', shadow: false, boxFill: brandBg };
        }
        fill = '#FFFFFF'; shadow = true; forceScrim = true;
      }
      else if (!contrastOK) {
        fill = mean > 0.5 ? '#14160F' : '#FFFFFF';
        shadow = fill === '#FFFFFF' && mean > 0.5;
      }
    }
    return { b, fill, shadow, boxFill: null as string | null };
  });

  // ── Voile de lisibilité ──
  const pos = input.scrim?.position;
  if (pos === 'bottom' || pos === 'top' || forceScrim) {
    const p = pos === 'top' ? 'top' : 'bottom';
    const op = Math.max(22, Math.min(input.scrim?.opacity ?? 50, 65)) / 100;
    const g = p === 'bottom'
      ? ctx.createLinearGradient(0, h, 0, h * 0.35)
      : ctx.createLinearGradient(0, 0, 0, h * 0.65);
    g.addColorStop(0, `rgba(0,0,0,${op})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // ── Filets d'accent (soulignements, barres de kicker) ──
  // Posés AVANT les textes : ce sont des repères de composition, jamais des
  // éléments qui passent devant.
  for (const a of (input.accents ?? [])) {
    if (!a?.type) continue;
    const aw = Math.max(4, Math.round((Math.min(Math.max(a.widthPct ?? 20, 2), 60) / 100) * w));
    const ah = Math.max(2, Math.round((Math.min(a.heightPct ?? 0.7, 1.2) / 100) * h));
    ctx.fillStyle = resolve(a.color);
    ctx.fillRect(Math.round(((a.xPct ?? 8) / 100) * w), Math.round(((a.yPct ?? 60) / 100) * h), aw, ah);
  }

  // ── Textes ──
  const display = brand.display || 'Archivo';
  const body = brand.body || display;
  for (const { b, fill, shadow, boxFill } of resolved) {
    const fontSize = Math.max(12, Math.round(((b.fontPct ?? 7) / 100) * h));
    const family = b.role === 'sous-titre' ? body : display;
    const weight = b.role === 'sous-titre' ? '400' : '700';
    ctx.font = `${weight} ${fontSize}px "${family}", system-ui, sans-serif`;
    ctx.textBaseline = 'top';

    const width = Math.round((Math.min(Math.max(b.widthPct ?? 80, 10), 100) / 100) * w);
    const txt = b.uppercase ? String(b.text).toUpperCase() : String(b.text);
    const y = Math.max(0, Math.round(((b.yPct ?? 70) / 100) * h));

    // RÉTRÉCIR POUR TENIR — ce que fait l'éditeur via minFontSize, et qui manquait
    // ici : un titre un peu long sortait par le bas du cadre, purement et
    // simplement coupé. On réduit la taille jusqu'à ce que le bloc tienne dans la
    // hauteur restante, sans descendre sous 55 % de la taille voulue (en dessous,
    // la hiérarchie typographique ne veut plus rien dire).
    const room = Math.max(fontSize, h - y - Math.round(0.03 * h));
    let size = fontSize;
    let lines = wrap(ctx, txt, width);
    while (lines.length * size * 1.15 > room && size > fontSize * 0.55) {
      size -= Math.max(1, Math.round(fontSize * 0.05));
      ctx.font = `${weight} ${size}px "${family}", system-ui, sans-serif`;
      lines = wrap(ctx, txt, width);
    }

    // Même règle que l'éditeur : l'alignement vient de la mise en page choisie.
    // Un aperçu qui centrerait tout alors que le rendu final aligne à gauche ne
    // serait plus un aperçu.
    const align = ['left', 'center', 'right'].includes(b.align ?? '') ? b.align : 'center';
    const x = align === 'center'
      ? Math.round((w - width) / 2)
      : align === 'right'
        ? Math.max(0, Math.round(w - width - ((b.xPct ?? 8) / 100) * w))
        : Math.max(0, Math.round(((b.xPct ?? 8) / 100) * w));
    const lh = size * 1.15;

    // Aplat derrière le texte : une boîte par LIGNE, comme dans l'éditeur, pour
    // que la cartouche épouse le texte au lieu d'encadrer un pavé vide.
    if (boxFill) {
      const padH = Math.round(size * 0.42);
      const padV = Math.round(size * 0.24);
      const radius = Math.min(Math.round(((b.radiusPct ?? 8) / 100) * size), Math.round((size * 1.15 + padV * 2) / 2));
      ctx.fillStyle = boxFill;
      lines.forEach((ln, i) => {
        const lw = ctx.measureText(ln).width;
        const lx = align === 'center' ? x + (width - lw) / 2 : align === 'right' ? x + width - lw : x;
        const bx = lx - padH, by = y + i * lh - padV;
        const bw = lw + padH * 2, bh = size * 1.15 + padV * 2;
        const r = Math.min(radius, bw / 2, bh / 2);
        ctx.beginPath();
        if (r > 0) {
          ctx.moveTo(bx + r, by);
          ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
          ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
          ctx.arcTo(bx, by + bh, bx, by, r);
          ctx.arcTo(bx, by, bx + bw, by, r);
        } else ctx.rect(bx, by, bw, bh);
        ctx.fill();
      });
    }

    if (shadow) {
      // Halo doux de lisibilité, jamais une ombre portée lourde.
      ctx.shadowColor = 'rgba(0,0,0,0.38)';
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = fill;
    lines.forEach((ln, i) => {
      const lw = ctx.measureText(ln).width;
      // Chaque ligne se place selon l'alignement du bloc — centrer les lignes
      // d'un bloc aligné à gauche donnait un pavé en drapeau des deux côtés.
      const lx = align === 'center' ? x + (width - lw) / 2
        : align === 'right' ? x + width - lw
        : x;
      ctx.fillText(ln, lx, y + i * lh);
    });
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  try { return canvas.toDataURL('image/jpeg', 0.86); } catch { return null; }
}

/**
 * Rend une liste de calques bruts (ceux de `lib/carouselDesigns.ts`) — rectangles,
 * cercles, textes. Sert à l'aperçu de la COUVERTURE d'un carrousel, qui n'a pas de
 * photo à habiller mais un décor dessiné.
 *
 * Volontairement limité aux trois types que le système de design produit : ce n'est
 * pas un moteur de rendu général, c'est l'aperçu d'une slide.
 */
export function renderElementSpecs(els: Record<string, unknown>[], w: number, h: number): string | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const n = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const s = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

  for (const e of els) {
    ctx.globalAlpha = n(e.opacity, 100) / 100;
    const type = s(e.type);

    if (type === 'rect') {
      const x = n(e.x), y = n(e.y), rw = n(e.width), rh = n(e.height);
      let fill: string | CanvasGradient = s(e.fill, '#000000');
      if (s(e.fillType) === 'gradient') {
        const g = ctx.createLinearGradient(x, y, x + rw, y + rh);
        g.addColorStop(0, s(e.fill, '#000000'));
        g.addColorStop(1, s(e.fillTo, s(e.fill, '#000000')));
        fill = g;
      }
      ctx.fillStyle = fill;
      const r = Math.min(n(e.cornerRadius), rw / 2, rh / 2);
      ctx.beginPath();
      if (r > 0) {
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + rw, y, x + rw, y + rh, r);
        ctx.arcTo(x + rw, y + rh, x, y + rh, r);
        ctx.arcTo(x, y + rh, x, y, r);
        ctx.arcTo(x, y, x + rw, y, r);
      } else ctx.rect(x, y, rw, rh);
      ctx.fill();

    } else if (type === 'circle') {
      ctx.fillStyle = s(e.fill, '#000000');
      ctx.beginPath();
      ctx.arc(n(e.x), n(e.y), n(e.radius, 1), 0, Math.PI * 2);
      ctx.fill();

    } else if (type === 'text') {
      const size = Math.max(11, n(e.fontSize, 20));
      const weight = s(e.fontStyle) === 'bold' ? '700' : '400';
      ctx.font = `${weight} ${size}px "${s(e.fontFamily, 'Archivo')}", system-ui, sans-serif`;
      ctx.fillStyle = s(e.fill, '#FFFFFF');
      ctx.textBaseline = 'top';
      const width = n(e.width, w);
      let txt = s(e.text);
      if (e.uppercase) txt = txt.toUpperCase();
      const lines = wrap(ctx, txt, width).slice(0, Math.max(1, n(e.maxLines, 4)));
      const lh = size * n(e.lineHeight, 1.1);
      const align = s(e.align, 'left');
      lines.forEach((ln, i) => {
        const lw = ctx.measureText(ln).width;
        const x = align === 'center' ? n(e.x) + (width - lw) / 2
          : align === 'right' ? n(e.x) + width - lw
          : n(e.x);
        ctx.fillText(ln, x, n(e.y) + i * lh);
      });
    }
    ctx.globalAlpha = 1;
  }

  try { return canvas.toDataURL('image/jpeg', 0.86); } catch { return null; }
}

// ─── Aperçu d'une composition DESSINÉE ───────────────────────────────────────
//
// `renderComposedVisual` ne sait habiller qu'une photo avec des blocs de texte.
// Les compositions du système de design ne sont pas ça : ce sont des calques
// complets (aplats, cartes, pastilles, flèches, photo recadrée, typographies qui
// se répondent), les mêmes que ceux que l'éditeur matérialise. Sans ce rendu,
// le Composer retombait sur la photo brute et l'utilisateur ne voyait le vrai
// visuel qu'en ouvrant l'éditeur — donc il ne le voyait presque jamais.

/** Demande les feuilles de style Google manquantes, puis attend les polices. */
export async function ensureFonts(families: string[], limiteMs = 2500): Promise<void> {
  if (typeof document === 'undefined') return;
  const uniques = Array.from(new Set(families.filter(Boolean)));
  for (const f of uniques) {
    const cle = `gf-${f.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    if (document.getElementById(cle)) continue;
    const lnk = document.createElement('link');
    lnk.id = cle; lnk.rel = 'stylesheet';
    lnk.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
    document.head.appendChild(lnk);
  }
  if (!document.fonts) return;
  const jobs = uniques.flatMap(f => [
    document.fonts.load(`400 32px "${f}"`).catch(() => {}),
    document.fonts.load(`700 32px "${f}"`).catch(() => {}),
  ]);
  await Promise.race([Promise.all(jobs).then(() => {}), new Promise<void>(r => setTimeout(r, limiteMs))]);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (rad <= 0) { ctx.rect(x, y, w, h); return; }
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** Chemin d'une forme vectorielle, dans un repère local 0,0 → w,h. Même
 *  géométrie que `drawVectorShape` de l'éditeur : l'aperçu doit montrer la
 *  MÊME forme, pas une approximation. */
function vectorPath(ctx: CanvasRenderingContext2D, shape: string, w: number, h: number, radius: number) {
  ctx.beginPath();
  switch (shape) {
    case 'circle': ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); break;
    case 'triangle': ctx.moveTo(w / 2, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); break;
    case 'diamond': ctx.moveTo(w / 2, 0); ctx.lineTo(w, h / 2); ctx.lineTo(w / 2, h); ctx.lineTo(0, h / 2); ctx.closePath(); break;
    case 'pill': {
      const r = h / 2;
      ctx.moveTo(r, 0); ctx.lineTo(w - r, 0);
      ctx.arc(w - r, h / 2, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(r, h);
      ctx.arc(r, h / 2, r, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      break;
    }
    case 'arrow': {
      const aw = w * 0.38, ah = h * 0.30;
      ctx.moveTo(0, h / 2 - ah / 2); ctx.lineTo(w - aw, h / 2 - ah / 2);
      ctx.lineTo(w - aw, 0); ctx.lineTo(w, h / 2);
      ctx.lineTo(w - aw, h); ctx.lineTo(w - aw, h / 2 + ah / 2);
      ctx.lineTo(0, h / 2 + ah / 2); ctx.closePath();
      break;
    }
    case 'star': {
      const cx = w / 2, cy = h / 2, r1 = Math.min(w, h) / 2, r2 = r1 * 0.42;
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? r1 : r2;
        const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'hexagon': {
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 6;
        const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    default: roundRect(ctx, 0, 0, w, h, radius);
  }
}

export interface TemplateRenderInput {
  /** Calques au format éditeur, tels que renvoyés par /api/compose-layout. */
  elements: Record<string, unknown>[];
  sourceFormat?: { w: number; h: number } | null;
  /** Photo du post : remplace le marqueur `__PHOTO_PLACEHOLDER__`. */
  photoUrl?: string | null;
  w: number;
  h: number;
}

/**
 * Rend une composition dessinée hors écran. Fidèle par construction : mêmes
 * calques, mêmes formes, mêmes polices que ce que l'éditeur affichera.
 */
export async function renderTemplateVisual(input: TemplateRenderInput): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const { w, h } = input;
  const els = Array.isArray(input.elements) ? input.elements : [];
  if (!els.length) return null;

  const src = input.sourceFormat && input.sourceFormat.w > 0 && input.sourceFormat.h > 0 ? input.sourceFormat : { w, h };
  const sx = w / src.w, sy = h / src.h, sf = Math.min(sx, sy);

  const n = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const st = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

  await ensureFonts(els.filter(e => st(e.type) === 'text').map(e => st(e.fontFamily)).filter(Boolean));

  // Un template maison peut porter SES propres images (un logo, un décor) en
  // plus de la zone photo. Charger la photo du post pour tous les calques image
  // les écraserait : chaque source est chargée pour elle-même, seul le marqueur
  // reçoit la photo du post.
  const PLACEHOLDER = '__PHOTO_PLACEHOLDER__';
  const srcs = Array.from(new Set(
    els.filter(e => st(e.type) === 'image').map(e => st(e.src)).filter(Boolean),
  ));
  const images = new Map<string, HTMLImageElement | null>();
  await Promise.all(srcs.map(async (u) => {
    const real = u === PLACEHOLDER ? (input.photoUrl ?? '') : u;
    images.set(u, real ? await loadImage(real) : null);
  }));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  for (const e of els) {
    const type = st(e.type);
    const x = n(e.x) * sx, y = n(e.y) * sy;
    const ew = n(e.width, 0) * sx, eh = n(e.height, 0) * sy;
    const rot = (n(e.rotation) * Math.PI) / 180;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(n(e.opacity, 100), 100)) / 100;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);

    if (type === 'image') {
      const photo = images.get(st(e.src)) ?? null;
      if (photo) {
        const r = n(e.cornerRadius) * sf;
        ctx.save();
        roundRect(ctx, 0, 0, ew, eh, r);
        ctx.clip();
        // Cadrage « cover », comme le calque image de l'éditeur.
        const scale = Math.max(ew / photo.width, eh / photo.height);
        const dw = photo.width * scale, dh = photo.height * scale;
        ctx.drawImage(photo, (ew - dw) / 2, (eh - dh) / 2, dw, dh);
        ctx.restore();
      } else {
        ctx.fillStyle = '#DDD8D0';
        roundRect(ctx, 0, 0, ew, eh, n(e.cornerRadius) * sf);
        ctx.fill();
      }

    } else if (type === 'rect') {
      const scrim = st(e.scrim);
      if (scrim === 'bottom' || scrim === 'top') {
        const op = ctx.globalAlpha;
        ctx.globalAlpha = 1;
        const g = scrim === 'bottom'
          ? ctx.createLinearGradient(0, eh, 0, eh * 0.25)
          : ctx.createLinearGradient(0, 0, 0, eh * 0.75);
        g.addColorStop(0, `rgba(0,0,0,${op})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, ew, eh);
      } else {
        ctx.fillStyle = st(e.fill, '#000000');
        roundRect(ctx, 0, 0, ew, eh, n(e.cornerRadius) * sf);
        ctx.fill();
        const swid = n(e.strokeWidth) * sf;
        if (swid > 0 && st(e.stroke)) { ctx.strokeStyle = st(e.stroke); ctx.lineWidth = swid; ctx.stroke(); }
      }

    } else if (type === 'vector') {
      vectorPath(ctx, st(e.shape, 'rectangle'), ew, eh, n(e.cornerRadius) * sf);
      if (st(e.fillType) !== 'none') { ctx.fillStyle = st(e.fill, '#000000'); ctx.fill(); }
      const swid = n(e.strokeWidth) * sf;
      if (swid > 0 && st(e.stroke)) { ctx.strokeStyle = st(e.stroke); ctx.lineWidth = swid; ctx.stroke(); }

    } else if (type === 'circle') {
      const r = n(e.radius) * sf;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = st(e.fill, '#000000'); ctx.fill();

    } else if (type === 'text') {
      const size = Math.max(9, n(e.fontSize, 24) * sf);
      const style = st(e.fontStyle, 'normal');
      const weight = style.includes('bold') ? '700' : '400';
      const italic = style.includes('italic') ? 'italic ' : '';
      const family = st(e.fontFamily, 'Archivo');
      const track = n(e.letterSpacing) * sf;
      // `letterSpacing` du contexte : disponible partout où l'app tourne, et
      // sans lui un titre très espacé s'affichait serré dans l'aperçu seul.
      try { (ctx as unknown as { letterSpacing: string }).letterSpacing = `${track}px`; } catch { /* moteur sans support */ }
      ctx.font = `${italic}${weight} ${size}px "${family}", system-ui, sans-serif`;
      ctx.textBaseline = 'top';

      const width = Math.max(1, n(e.width, src.w) * sx);
      let txt = st(e.text);
      if (e.uppercase) txt = txt.toUpperCase();
      const maxLines = Math.max(1, n(e.maxLines, 6));
      // RÉTRÉCIR POUR TENIR — l'éditeur le fait (autoFitFontSize) ; sans la même
      // règle ici, l'aperçu montrait un chiffre qui déborde du cadre alors que le
      // visuel final, lui, tenait. Un aperçu qui ment ne sert à rien.
      const plancher = Math.max(9, n(e.minFontSize, Math.round(n(e.fontSize, 24) * 0.62)) * sf);
      let taille = size;
      let lines = txt.split('\n').flatMap(part => wrap(ctx, part, width));
      const deborde = () => lines.length > maxLines || lines.some(l => ctx.measureText(l).width > width + 1);
      while (taille > plancher && deborde()) {
        taille = Math.max(plancher, taille - Math.max(1, Math.round(size * 0.04)));
        try { (ctx as unknown as { letterSpacing: string }).letterSpacing = `${(n(e.letterSpacing) * sf * taille) / size}px`; } catch { /* noop */ }
        ctx.font = `${italic}${weight} ${taille}px "${family}", system-ui, sans-serif`;
        lines = txt.split('\n').flatMap(part => wrap(ctx, part, width));
      }
      lines = lines.slice(0, maxLines);
      const lh = taille * n(e.lineHeight, 1.15);
      // Konva centre chaque ligne dans sa hauteur d'interligne : sans ce demi-
      // interligne, l'aperçu remonte d'un cheveu par rapport au rendu final.
      const half = Math.max(0, (lh - taille) / 2);
      const align = st(e.align, 'left');
      const posOf = (lw: number) => (align === 'center' ? (width - lw) / 2 : align === 'right' ? width - lw : 0);

      if (e.highlightEnabled) {
        const padH = n(e.highlightPadding, 8) * sf;
        const padV = padH * 0.55;
        const rad = n(e.highlightBorderRadius, 4) * sf;
        ctx.fillStyle = st(e.highlightColor, '#000000');
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * (Math.max(0, Math.min(n(e.highlightOpacity, 100), 100)) / 100);
        lines.forEach((ln, i) => {
          const lw = ctx.measureText(ln).width;
          roundRect(ctx, posOf(lw) - padH, i * lh + half - padV, lw + padH * 2, taille + padV * 2, rad);
          ctx.fill();
        });
        ctx.globalAlpha = prev;
      }

      if (e.shadowEnabled) {
        ctx.shadowColor = `rgba(0,0,0,${Math.max(0, Math.min(n(e.shadowOpacity, 40), 100)) / 100})`;
        ctx.shadowBlur = n(e.shadowBlur, 12) * sf;
      }
      const strokeW = n(e.strokeWidth) * sf;
      ctx.fillStyle = st(e.fill, '#FFFFFF');
      if (strokeW > 0 && st(e.stroke)) { ctx.strokeStyle = st(e.stroke); ctx.lineWidth = strokeW; }
      lines.forEach((ln, i) => {
        const lw = ctx.measureText(ln).width;
        const lx = posOf(lw), ly = i * lh + half;
        // Lettres évidées : le contour SEUL, jamais contour + plein.
        if (e.hollowEnabled) { if (strokeW > 0 && st(e.stroke)) ctx.strokeText(ln, lx, ly); else { ctx.strokeStyle = st(e.fill, '#FFFFFF'); ctx.lineWidth = Math.max(1, taille * 0.03); ctx.strokeText(ln, lx, ly); } }
        else {
          ctx.fillText(ln, lx, ly);
          if (strokeW > 0 && st(e.stroke)) ctx.strokeText(ln, lx, ly);
        }
        if (st(e.textDecoration).includes('line-through')) {
          ctx.save();
          ctx.strokeStyle = st(e.fill, '#FFFFFF');
          ctx.lineWidth = Math.max(1, taille * 0.07);
          ctx.beginPath();
          ctx.moveTo(lx, ly + taille * 0.55); ctx.lineTo(lx + lw, ly + taille * 0.55);
          ctx.stroke();
          ctx.restore();
        }
      });
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      try { (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px'; } catch { /* noop */ }
    }

    ctx.restore();
  }

  try { return canvas.toDataURL('image/jpeg', 0.86); } catch { return null; }
}
