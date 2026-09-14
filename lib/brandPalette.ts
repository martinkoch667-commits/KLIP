/* Couleurs d'une marque, telles que les lit le navigateur.
 *
 * Sorti de l'écran « Nouveau client » (app/workspace/new) pour que le parcours
 * d'essai de la landing lise les couleurs EXACTEMENT de la même façon : le 14/09
 * la charte de Pepe Chicken montrait le violet et l'orange par défaut du thème
 * de son site, parce que le parcours ne prenait que les couleurs du CSS.
 *
 * La règle, héritée de « Nouveau client » : les couleurs du LOGO passent devant
 * celles du CSS (le logo EST l'identité ; chez Burger King le rouge n'existe que
 * dans le logo), puis le CSS, puis l'image de partage du site, dédoublonnées par
 * TEINTE à 15° (le rouge et l'orange d'une même marque ne sont séparés que d'une
 * quinzaine de degrés).
 */

/** Adresse chargeable dans un canvas : le proxy évite l'origine croisée. Un SVG
 *  en ligne arrive déjà en data URL, le proxy ne saurait pas quoi en faire. */
export const imgSrc = (url: string) => url.startsWith("data:") ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`;

function teinte(r: number, g: number, b: number) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return -1;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function teinteHex(hex: string) {
  return teinte(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
}

const proches = (a: number, b: number) => { let d = Math.abs(a - b); if (d > 180) d = 360 - d; return d < 15; };

/** Les couleurs dominantes d'une image (ni blanc, ni noir, ni gris). */
export async function dominantColorsFromImage(url: string, max = 4): Promise<string[]> {
  try {
    const img = await new Promise<HTMLImageElement | null>((res) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = imgSrc(url);
    });
    if (!img) return [];
    const S = 48;
    const cv = document.createElement("canvas");
    cv.width = S; cv.height = S;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, S, S);
    const data = ctx.getImageData(0, 0, S, S).data;

    // Regroupement par paquets grossiers : sans ça, l'antialiasing produit des
    // centaines de nuances uniques et rien ne ressort.
    const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;               // un logo transparent : on ignore le vide
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (sat < 0.22 || luma > 0.9 || luma < 0.1) continue;
      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      buckets.set(key, { n: cur.n + 1, r: cur.r + r, g: cur.g + g, b: cur.b + b });
    }
    const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0").toUpperCase();
    const out: { hex: string; h: number }[] = [];
    for (const c of Array.from(buckets.values()).sort((a, b) => b.n - a.n)) {
      const r = c.r / c.n, g = c.g / c.n, b = c.b / c.n;
      const h = teinte(r, g, b);
      if (out.some(o => proches(o.h, h))) continue;
      out.push({ hex: `#${hex(r)}${hex(g)}${hex(b)}`, h });
      if (out.length >= max) break;
    }
    return out.map(o => o.hex);
  } catch {
    return [];
  }
}

/** La palette d'une marque : logo(s), puis CSS, puis image de partage, puis
 *  Instagram en complément, dédoublonnée par teinte. */
export async function paletteDeMarque(opts: {
  logoCandidates?: string[];
  logoUrl?: string | null;
  cssColors?: string[];
  heroImage?: string | null;
  igColors?: string[];
  max?: number;
}): Promise<string[]> {
  const max = opts.max ?? 5;
  const cands = opts.logoCandidates?.length ? opts.logoCandidates.slice(0, 3) : (opts.logoUrl ? [opts.logoUrl] : []);
  const fromLogo: string[] = [];
  for (const c of cands) fromLogo.push(...await dominantColorsFromImage(c, 3));
  const fromHero = opts.heroImage ? await dominantColorsFromImage(opts.heroImage, 4) : [];
  const merged: string[] = [];
  const hues: number[] = [];
  for (const c of [...fromLogo, ...(opts.cssColors ?? []), ...fromHero, ...(opts.igColors ?? [])]) {
    if (typeof c !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(c) || merged.includes(c.toUpperCase())) continue;
    const h = teinteHex(c);
    if (h >= 0 && hues.some(o => proches(o, h))) continue;
    merged.push(c.toUpperCase()); hues.push(h);
    if (merged.length >= max) break;
  }
  return merged;
}
