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
    // Une image déjà locale (data:/blob:) n'a rien à faire dans le proxy — et y
    // passer la rendait simplement introuvable.
    img.src = /^(data:|blob:)/.test(url) ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`;
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
    if (sampler) {
      const { mean, std } = sampler(b.xPct ?? 8, b.yPct ?? 70, b.widthPct ?? 80, Math.min(45, (b.fontPct ?? 7) * 2.6));
      const busy = std > 0.17;
      const contrastOK = !busy && Math.abs(mean - hexLum(fill)) > 0.45;
      if (busy) { fill = '#FFFFFF'; shadow = true; forceScrim = true; }
      else if (!contrastOK) {
        fill = mean > 0.5 ? '#14160F' : '#FFFFFF';
        shadow = fill === '#FFFFFF' && mean > 0.5;
      }
    }
    return { b, fill, shadow };
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

  // ── Textes ──
  const display = brand.display || 'Archivo';
  const body = brand.body || display;
  for (const { b, fill, shadow } of resolved) {
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
