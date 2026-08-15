// Extraction d'une charte à partir d'un site web.
//
// Le site est une bien meilleure source qu'un flux de photos : le CSS donne les
// couleurs EXACTES et les VRAIS noms de polices, là où deviner une typo sur une
// image relève de la loterie. On lit donc la page, ses feuilles de style, et on
// classe ce qu'on trouve par fréquence d'apparition.
//
// Tout est « au mieux » : chaque champ peut revenir vide, et l'appelant doit
// traiter le résultat comme une PROPOSITION à valider, jamais comme une vérité.

import { fetchTextCapped, toSafeHttpUrl } from '@/lib/safeUrl';

export interface BrandFromSite {
  url: string;
  name?: string;
  description?: string;
  colors: string[];        // du plus au moins présent, #RRGGBB
  fonts: string[];         // familles CSS, du plus au moins présent
  logoUrl?: string;
  iconUrl?: string;
  sampleText?: string;     // matière brute pour déduire le ton, côté appelant
}

// ─── Couleurs ─────────────────────────────────────────────────────────────────

function normalizeHex(h: string): string | null {
  let s = h.trim().toLowerCase().replace('#', '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  if (s.length === 8) s = s.slice(0, 6);          // #RRGGBBAA → on ignore l'alpha
  if (!/^[0-9a-f]{6}$/.test(s)) return null;
  return `#${s.toUpperCase()}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function hexLuma(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexSaturation(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

// Deux couleurs trop proches ne sont qu'une seule couleur de charte.
function tooClose(a: string, b: string): boolean {
  const v = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return Math.abs(v(a, 0) - v(b, 0)) + Math.abs(v(a, 1) - v(b, 1)) + Math.abs(v(a, 2) - v(b, 2)) < 60;
}

function collectColors(css: string): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (hex: string | null, weight = 1) => {
    if (!hex) return;
    counts.set(hex, (counts.get(hex) ?? 0) + weight);
  };
  // Une variable qui s'APPELLE « primary », « brand » ou « accent » désigne la
  // couleur de marque bien plus sûrement que sa fréquence d'apparition : les
  // cadres modernes embarquent des palettes entières de teintes inutilisées,
  // et le simple comptage remontait souvent une nuance de gris d'interface.
  for (const m of Array.from(css.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/g))) {
    const nameL = m[1].toLowerCase();
    if (/border|shadow|text|bg-|background|surface|muted|neutral|gray|grey|disabled|overlay|scrim/.test(nameL)) continue;
    let w = 0;
    if (/primary|brand|principal/.test(nameL)) w = 60;
    else if (/accent|secondary|secondaire/.test(nameL)) w = 40;
    else if (/^--(color|theme)-?\d*$|main/.test(nameL)) w = 20;
    if (!w) continue;
    const v = m[2];
    if (v.startsWith('#')) bump(normalizeHex(v), w);
    else {
      const p = v.match(/[\d.]+/g);
      if (p && p.length >= 3) bump(rgbToHex(parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2])), w);
    }
  }
  for (const m of Array.from(css.matchAll(/#([0-9a-fA-F]{3,8})\b/g))) bump(normalizeHex(m[1]));
  for (const m of Array.from(css.matchAll(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)/g))) {
    const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (alpha < 0.5) continue;                     // un voile n'est pas une couleur de marque
    bump(rgbToHex(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])));
  }
  return counts;
}

// Palettes livrées par défaut avec les cadres et thèmes courants (WordPress en
// tête). Elles saturent le CSS de sites qui ne s'en servent pas, et sortaient
// devant les vraies couleurs de la marque.
const STOCK_PALETTE = new Set([
  '#FF6900', '#FCB900', '#7BDCB5', '#00D084', '#8ED1FC', '#0693E3', '#ABB8C3',
  '#EB144C', '#F78DA7', '#9900EF', '#CF2E2E', '#CC3366', '#CD2653',
  '#0D6EFD', '#6610F2', '#6F42C1', '#D63384', '#DC3545', '#FD7E14', '#198754',
  '#20C997', '#0DCAF0', '#212529', '#6C757D',
]);

// On veut des couleurs de MARQUE : ni le noir du texte, ni le blanc du fond,
// ni les dix gris de l'ombre portée. On privilégie donc ce qui est saturé, tout
// en gardant les plus fréquentes en secours.
function rankBrandColors(counts: Map<string, number>): string[] {
  const all = Array.from(counts.entries())
    .map(([hex, n]) => ({ hex, n, sat: hexSaturation(hex), luma: hexLuma(hex) }))
    // Une couleur de palette générique n'est retenue que si elle a été
    // explicitement désignée comme couleur de marque (poids élevé).
    .filter(c => c.n >= 2 && (!STOCK_PALETTE.has(c.hex) || c.n >= 20));
  const vivid = all
    .filter(c => c.sat > 0.25 && c.luma > 0.06 && c.luma < 0.96)
    .sort((a, b) => b.n * (0.5 + b.sat) - a.n * (0.5 + a.sat));
  const fallback = all.sort((a, b) => b.n - a.n);
  const out: string[] = [];
  for (const c of [...vivid, ...fallback]) {
    if (out.length >= 4) break;
    if (out.some(h => tooClose(h, c.hex))) continue;
    out.push(c.hex);
  }
  return out;
}

// ─── Polices ──────────────────────────────────────────────────────────────────

const GENERIC_FAMILIES = new Set([
  'inherit', 'initial', 'unset', 'revert', 'serif', 'sans-serif', 'monospace', 'cursive',
  'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded',
  '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica', 'helvetica neue',
  'arial', 'sans', 'emoji', 'math', 'apple color emoji', 'segoe ui emoji', 'noto color emoji',
  // Mots-clés CSS qui traînent dans les valeurs et ne sont pas des familles.
  'normal', 'bold', 'bolder', 'lighter', 'italic', 'oblique', 'none', 'auto', 'currentcolor',
]);

// next/font et consorts génèrent des familles du type « __Inter_e8ce0c » : le
// nom réel est dedans, il suffit de retirer l'échafaudage. Sans ça, les sites
// bâtis avec ces outils ne rendaient aucune police exploitable.
function cleanFontName(raw: string): string | null {
  let n = raw.trim().replace(/^["']|["']$/g, '').trim();
  const generated = n.match(/^__(.+?)_[0-9a-f]{4,}$/i);
  if (generated) n = generated[1].replace(/_/g, ' ').trim();
  if (/fallback/i.test(n)) return null;
  if (/icon|awesome|dashicons|glyph|symbol|elusive|entypo|ionicons|material icons/i.test(n)) return null;
  return n;
}

function collectFonts(html: string, css: string): string[] {
  const counts = new Map<string, number>();
  const bump = (raw: string, weight = 1) => {
    const name = cleanFontName(raw);
    if (!name || name.length > 40) return;
    if (GENERIC_FAMILIES.has(name.toLowerCase())) return;
    if (/^var\(|^\d/.test(name)) return;
    counts.set(name, (counts.get(name) ?? 0) + weight);
  };

  // Signal le plus fiable : la marque a explicitement chargé ces familles.
  for (const m of Array.from(html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>]+)/g))) {
    for (const f of Array.from(m[1].matchAll(/family=([^&:]+)/g))) bump(decodeURIComponent(f[1].replace(/\+/g, ' ')), 12);
  }
  // @font-face : la marque héberge sa police elle-même.
  for (const m of Array.from(css.matchAll(/@font-face[^}]*font-family\s*:\s*([^;}]+)/g))) bump(m[1].split(',')[0], 10);
  // Variables CSS de police : les sites récents déclarent `font-family: var(--font-sans)`
  // et rangent la vraie famille dans la définition de la variable.
  for (const m of Array.from(css.matchAll(/(--[\w-]*font[\w-]*)\s*:\s*([^;}]+)/g))) {
    // Toutes les variables « font » ne portent pas une famille : taille, graisse,
    // et surtout font-feature-settings, dont la valeur (« "lnum" 1 ») se faisait
    // passer pour un nom de police.
    if (/feature|weight|size|style|variant|stretch|spacing|height|smooth/i.test(m[1])) continue;
    const v = m[2].trim();
    if (/^\d/.test(v) || /^["'][a-z0-9]{3,5}["']\s*\d/i.test(v)) continue;
    bump(v.split(',')[0], 6);
  }
  // Déclarations ordinaires : on ne retient que la première famille de la pile.
  for (const m of Array.from(css.matchAll(/font-family\s*:\s*([^;}!]+)/g))) {
    const first = m[1].split(',')[0];
    bump(first, 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0]);
}

// ─── Métadonnées ──────────────────────────────────────────────────────────────

function meta(html: string, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const re = new RegExp(`<meta[^>]+(?:name|property)=["']${k}["'][^>]*content=["']([^"']+)["']`, 'i');
    const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${k}["']`, 'i');
    const m = html.match(re) ?? html.match(alt);
    if (m?.[1]?.trim()) return decodeEntities(m[1].trim());
  }
  return undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function absolutize(href: string | undefined, base: URL): string | undefined {
  if (!href) return undefined;
  try { return new URL(href, base).toString(); } catch { return undefined; }
}

// Le logo, par ordre de fiabilité décroissante. L'ancienne version retombait
// sur og:image faute de mieux : c'est l'image de PARTAGE du site, souvent une
// photo d'ambiance — d'où le « logo » au hasard qui remontait. Mieux vaut ne
// rien renvoyer que renvoyer n'importe quoi.
function findLogo(html: string, base: URL): string | undefined {
  // 1. Données structurées : quand elles existent, la marque a désigné son logo
  //    elle-même. Aucune heuristique ne bat ça.
  for (const m of Array.from(html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi))) {
    try {
      const found = findJsonLdLogo(JSON.parse(m[1].trim()));
      const abs = absolutize(found, base);
      if (abs) return abs;
    } catch { /* JSON-LD malformé : fréquent, on passe */ }
  }

  // 2. Une image qui se présente comme le logo. On note les candidates plutôt
  //    que de prendre la première : « logo » dans le nom de fichier vaut mieux
  //    que « logo » quelque part dans la classe d'un conteneur.
  const candidates: { url: string; score: number }[] = [];
  for (const m of Array.from(html.matchAll(/<img[^>]+>/gi))) {
    const tag = m[0];
    const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1]
             ?? tag.match(/\sdata-src=["']([^"']+)["']/i)?.[1]
             ?? tag.match(/\sdata-lazy-src=["']([^"']+)["']/i)?.[1];
    const abs = absolutize(src, base);
    if (!abs) continue;
    if (/sprite|placeholder|pixel|spacer|1x1|blank\./i.test(abs)) continue;
    const alt = tag.match(/\salt=["']([^"']*)["']/i)?.[1] ?? '';
    const cls = tag.match(/\sclass=["']([^"']*)["']/i)?.[1] ?? '';
    let score = 0;
    if (/logo|brand/i.test(abs.split('/').pop() ?? '')) score += 6;
    if (/^logo$|logo/i.test(alt)) score += 4;
    if (/logo|brand/i.test(cls)) score += 3;
    // Une image tout en haut du document est presque toujours l'en-tête.
    if (m.index !== undefined && m.index < 4000) score += 2;
    if (/icon/i.test(abs)) score += 1;
    if (score >= 3) candidates.push({ url: abs, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length) return candidates[0].url;

  // 3. L'icône d'application : c'est la marque, en carré. Faute de mieux, elle
  //    reste juste — contrairement à l'image de partage.
  const touch = html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/i);
  if (touch) {
    const abs = absolutize(touch[0].match(/href=["']([^"']+)["']/i)?.[1], base);
    if (abs) return abs;
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findJsonLdLogo(node: any, depth = 0): string | undefined {
  if (!node || depth > 6) return undefined;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findJsonLdLogo(n, depth + 1);
      if (r) return r;
    }
    return undefined;
  }
  if (typeof node !== 'object') return undefined;
  const logo = node.logo;
  if (typeof logo === 'string') return logo;
  if (logo && typeof logo === 'object' && typeof logo.url === 'string') return logo.url;
  for (const k of Object.keys(node)) {
    const r = findJsonLdLogo(node[k], depth + 1);
    if (r) return r;
  }
  return undefined;
}

function findIcon(html: string, base: URL): string | undefined {
  const rels = ['apple-touch-icon', 'icon', 'shortcut icon'];
  for (const rel of rels) {
    const m = html.match(new RegExp(`<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]*>`, 'i'));
    if (m) {
      const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
      const abs = absolutize(href, base);
      if (abs) return abs;
    }
  }
  return absolutize('/favicon.ico', base);
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export async function analyzeBrandSite(rawUrl: string): Promise<BrandFromSite | null> {
  const url = toSafeHttpUrl(rawUrl);
  if (!url) return null;

  const html = await fetchTextCapped(url.toString());
  if (!html) return null;

  // Les feuilles externes portent l'essentiel de la charte. On en lit quelques
  // unes seulement : au-delà, on paierait le temps d'attente sans rien gagner.
  const sheetHrefs: string[] = [];
  for (const m of Array.from(html.matchAll(/<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi))) {
    const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
    const abs = absolutize(href, url);
    if (abs && !/fonts\.googleapis|fonts\.gstatic/.test(abs)) sheetHrefs.push(abs);
    if (sheetHrefs.length >= 3) break;
  }
  const sheets = await Promise.all(
    sheetHrefs.map(h => fetchTextCapped(h, { timeoutMs: 6000, maxBytes: 900_000, accept: 'text/css,*/*;q=0.8' })),
  );

  const inlineCss = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map(m => m[1]).join('\n');
  const inlineStyleAttrs = Array.from(html.matchAll(/style=["']([^"']+)["']/gi)).map(m => m[1]).join(';');
  const css = [inlineCss, inlineStyleAttrs, ...sheets].join('\n');

  const colorCounts = collectColors(css);
  // La couleur de thème est déclarée par la marque : elle vaut mieux qu'un comptage.
  const themeColor = normalizeHex(meta(html, 'theme-color') ?? '');
  if (themeColor) colorCounts.set(themeColor, (colorCounts.get(themeColor) ?? 0) + 40);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const name = meta(html, 'og:site_name', 'application-name')
    ?? (title ? decodeEntities(title).split(/[|–—·-]/)[0].trim() : undefined);

  return {
    url: url.toString(),
    name: name && name.length <= 60 ? name : undefined,
    description: meta(html, 'og:description', 'description', 'twitter:description'),
    colors: rankBrandColors(colorCounts),
    fonts: collectFonts(html, css),
    logoUrl: findLogo(html, url),
    iconUrl: findIcon(html, url),
    sampleText: visibleText(html),
  };
}
