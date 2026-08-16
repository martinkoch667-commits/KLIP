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
  /** Toutes les pistes de logo trouvées, du plus probable au moins. Le meilleur
   *  candidat n'est qu'un pari : sur un site mal balisé c'est souvent une
   *  bannière. L'appelant les propose, l'utilisateur tranche. */
  logoCandidates: string[];
  iconUrl?: string;
  /** Image de partage (og:image). Elle est écartée comme LOGO — c'est souvent
   *  une photo d'ambiance — mais c'est une excellente source de COULEURS : chez
   *  une marque dont l'identité vit dans ses visuels, l'orange et le rouge n'ont
   *  aucune raison d'apparaître dans la feuille de style. */
  heroImage?: string;
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
// Deux couleurs sont « la même » quand elles se ressemblent À L'ŒIL.
//
// L'ancienne version sommait les écarts RVB avec un seuil de 60 : deux bruns
// distants de 20 par canal passaient pour différents. La palette se remplissait
// donc de VARIANTES d'une seule teinte au lieu des couleurs de la marque.
//
// On compare maintenant la TEINTE d'abord (deux rouges restent un rouge, quelle
// que soit leur clarté), et on ne retient l'écart de clarté/saturation que pour
// les couleurs peu colorées, où la teinte ne veut plus rien dire.
function tooClose(a: string, b: string): boolean {
  const ha = hexHue(a), hb = hexHue(b);
  const sa = hexSaturation(a), sb = hexSaturation(b);
  const la = hexLuma(a), lb = hexLuma(b);
  const bothColored = sa > 0.18 && sb > 0.18;
  if (bothColored) {
    let dh = Math.abs(ha - hb);
    if (dh > 180) dh = 360 - dh;         // la teinte est un cercle
    return dh < 28;
  }
  return Math.abs(la - lb) < 0.18 && Math.abs(sa - sb) < 0.2;
}

/** Teinte en degrés (0-360). */
function hexHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function collectColors(css: string): { counts: Map<string, number>; designated: Set<string> } {
  const counts = new Map<string, number>();
  // Couleurs qu'une variable CSS a explicitement nommées « primary », « brand »,
  // « accent »… Seules celles-là ont le droit d'être neutres : quand une marque
  // déclare que sa couleur est le noir, c'est vrai. Quand le noir sort du simple
  // comptage, c'est la couleur du texte.
  const designated = new Set<string>();
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
    const hex = v.startsWith('#')
      ? normalizeHex(v)
      : (() => { const p = v.match(/[\d.]+/g); return p && p.length >= 3 ? rgbToHex(parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2])) : null; })();
    if (hex) { bump(hex, w); designated.add(hex); }
  }
  for (const m of Array.from(css.matchAll(/#([0-9a-fA-F]{3,8})\b/g))) bump(normalizeHex(m[1]));
  for (const m of Array.from(css.matchAll(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)/g))) {
    const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (alpha < 0.5) continue;                     // un voile n'est pas une couleur de marque
    bump(rgbToHex(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])));
  }
  return { counts, designated };
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
function rankBrandColors(counts: Map<string, number>, designated: Set<string>): string[] {
  const all = Array.from(counts.entries())
    .map(([hex, n]) => ({ hex, n, sat: hexSaturation(hex), luma: hexLuma(hex) }))
    // Une couleur de palette générique n'est retenue que si elle a été
    // explicitement désignée comme couleur de marque (poids élevé).
    .filter(c => c.n >= 2 && (!STOCK_PALETTE.has(c.hex) || c.n >= 20));

  // CE QUI EST ÉCARTÉ, ET SUR QUEL CRITÈRE.
  //
  // J'ai d'abord filtré sur la SATURATION (« garder ce qui est vif »). C'était
  // faux : le crème de Burger King est à 0,10 de saturation et c'est pourtant
  // une de ses couleurs de marque. En montant le seuil à 0,22 pour chasser les
  // gris, j'ai emporté tous les tons rompus — beiges, crèmes, sables, taupes —
  // et la palette est tombée à deux couleurs.
  //
  // Le bon critère n'est pas « est-elle vive » mais « A-T-ELLE UNE TEINTE ».
  // Un gris, un blanc et un noir n'en ont aucune ; un crème en a une. On ne
  // rejette donc que les vrais neutres, et le blanc et le noir francs — sauf
  // quand la marque les a explicitement nommés dans son CSS.
  const isNeutral = (c: { sat: number }) => c.sat < 0.08;
  const isPureWhiteOrBlack = (c: { luma: number }) => c.luma > 0.95 || c.luma < 0.05;

  // Un GRIS MOYEN reste rejeté SANS EXCEPTION, même déclaré dans une variable
  // CSS : c'est du texte ou une bordure, jamais une identité. (vercel.com le
  // déclare et sortait en #666666, #333333, #999999.)
  const isMidGrey = (c: { sat: number; luma: number }) =>
    c.sat < 0.06 && c.luma > 0.12 && c.luma < 0.88;

  const brand = all
    .filter(c => !isMidGrey(c))
    .filter(c => !isNeutral(c) || designated.has(c.hex))
    .filter(c => !isPureWhiteOrBlack(c) || designated.has(c.hex))
    .sort((a, b) => b.n * (0.5 + b.sat) - a.n * (0.5 + a.sat));

  const out: string[] = [];
  for (const c of brand) {
    // Cinq au maximum : au-delà ce ne sont plus des couleurs de marque, c'est
    // un nuancier. Mieux vaut rendre deux vraies couleurs que cinq dont trois
    // sont du décor de page.
    if (out.length >= 5) break;
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
  // Les attributs HTML sont ÉCHAPPÉS : un src contenant plusieurs paramètres
  // s'écrit `?url=x&amp;w=1920`. Sans décodage, l'URL construite gardait le
  // « &amp; » littéral et pointait dans le vide — le candidat s'affichait cassé.
  const decoded = href
    .replace(/&amp;/g, '&').replace(/&#38;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .trim();
  try { return new URL(decoded, base).toString(); } catch { return undefined; }
}

// Le logo, par ordre de fiabilité décroissante. L'ancienne version retombait
// sur og:image faute de mieux : c'est l'image de PARTAGE du site, souvent une
// photo d'ambiance — d'où le « logo » au hasard qui remontait. Mieux vaut ne
// rien renvoyer que renvoyer n'importe quoi.
// Rend une LISTE de candidats, du plus probable au moins. Ne rendre que le
// meilleur revenait à parier : sur un site mal balisé, l'unique proposition était
// souvent une illustration de bannière plutôt que le logo, et l'utilisateur
// n'avait aucun recours. Plusieurs propositions, c'est lui qui tranche.
function findLogoCandidates(html: string, css: string, base: URL): string[] {
  const out: string[] = [];
  const push = (u?: string) => { if (u && !out.includes(u)) out.push(u); };

  // 1. Données structurées : quand elles existent, la marque a désigné son logo
  //    elle-même. Aucune heuristique ne bat ça — elle reste donc en tête.
  for (const m of Array.from(html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi))) {
    try { push(absolutize(findJsonLdLogo(JSON.parse(m[1].trim())), base)); }
    catch { /* JSON-LD malformé : fréquent, on passe */ }
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
    // Le bruit récurrent des sites de marque : badges de téléchargement, icônes
    // de réseaux sociaux, drapeaux de langue, moyens de paiement, flèches. Ils
    // portent souvent « logo » dans leur nom de fichier et remontaient donc en
    // tête — sur burgerking.fr, les propositions étaient des badges App Store.
    if (/apple[-_]?(white|black|dark|light)?[-_]?logo|app-?store|google-?play|play-?store|windows-?store|badge|download|t[ée]l[ée]charger|facebook|instagram|twitter|x-logo|tiktok|youtube|linkedin|snapchat|pinterest|whatsapp|visa|mastercard|paypal|amex|flag|drapeau|arrow|chevron|burger-?menu|hamburger|avatar|star-?rating/i.test(abs)) continue;
    const alt = tag.match(/\salt=["']([^"']*)["']/i)?.[1] ?? '';
    const cls = tag.match(/\sclass=["']([^"']*)["']/i)?.[1] ?? '';
    const file = abs.split('/').pop() ?? '';
    let score = 0;
    if (/logo|brand/i.test(file)) score += 6;
    // Un fichier qui s'appelle exactement « logo.svg » ou « logo-xxx.png » est un
    // logo ; « hero-logo-banner.jpg » l'est beaucoup moins.
    if (/^logo[-_.]/i.test(file)) score += 3;
    if (/^logo$|logo/i.test(alt)) score += 4;
    if (/logo|brand/i.test(cls)) score += 3;
    // Une image tout en haut du document est presque toujours l'en-tête.
    if (m.index !== undefined && m.index < 4000) score += 2;
    // Un SVG est un logo vectoriel : c'est LA bonne version, et elle est
    // transparente. Martin s'est retrouvé avec un aplat noir faute de ce choix.
    if (/\.svg(\?|$)/i.test(abs)) score += 4;
    // Le PNG préserve la transparence, le JPEG jamais : à contenu égal, le PNG
    // est la version utilisable sur un visuel.
    else if (/\.png(\?|$)/i.test(abs)) score += 2;
    else if (/\.jpe?g(\?|$)/i.test(abs)) score -= 2;
    // Une photo d'équipe ou d'ambiance n'est pas un logo, même bien nommée.
    if (/photo|team|equipe|hero|banner|banni[èe]re|cover|slide|carousel/i.test(abs)) score -= 5;
    if (/icon/i.test(abs)) score += 1;
    if (score >= 3) candidates.push({ url: abs, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) push(c.url);

  // 3. SVG EN LIGNE. Beaucoup de sites modernes n'ont aucune balise <img> pour
  //    leur logo : ils écrivent le SVG directement dans la page. Les étapes 1 et
  //    2 ne voyaient donc rien du tout (mesuré : bigfernand.com, paulbocuse.com,
  //    et le logo au burger de Burger King). On sérialise ces SVG en data URL,
  //    ce qui les rend affichables et importables comme n'importe quelle image —
  //    et en prime ils sont vectoriels et transparents, la bonne version.
  for (const svg of inlineSvgLogos(html)) push(svg);

  // 4. FONDS CSS. L'autre cachette classique : `background-image: url(...)` sur
  //    un élément d'en-tête. On ne retient que ce qui se présente comme un logo,
  //    sans quoi on ramasserait toutes les images décoratives du site.
  for (const m of Array.from(css.matchAll(/([^{}]*)\{[^{}]*background(?:-image)?\s*:[^;{}]*url\((['"]?)([^'")]+)\2\)/gi))) {
    const selector = m[1], href = m[3];
    if (!/logo|brand/i.test(selector) && !/logo|brand/i.test(href)) continue;
    if (/sprite|placeholder|pattern|texture/i.test(href)) continue;
    push(absolutize(href, base));
  }

  // 5. L'icône d'application : c'est la marque, en carré. Faute de mieux, elle
  //    reste juste — contrairement à l'image de partage.
  const touch = html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/i);
  if (touch) push(absolutize(touch[0].match(/href=["']([^"']+)["']/i)?.[1], base));

  // Six suffit : au-delà on descend dans le bruit, et une grille de propositions
  // trop longue redevient un travail de tri.
  return out.slice(0, 6);
}


/**
 * SVG écrits DANS la page, sérialisés en data URL.
 *
 * On ne prend pas tous les SVG d'une page — il y en a des dizaines (flèches,
 * chevrons, icônes de menu). On garde ceux qui se présentent comme un logo :
 * par leur classe, leur identifiant, leur <title>, leur aria-label, ou parce
 * qu'ils sont contenus dans le lien de retour à l'accueil, qui est l'endroit
 * où vit le logo sur la quasi-totalité des sites.
 */
function inlineSvgLogos(html: string): string[] {
  const out: string[] = [];
  // Balayage par index et non par expression régulière : `<svg[\s\S]*?</svg>`
  // avec un quantificateur paresseux part en retour arrière catastrophique sur
  // une grosse page — burgerking.fr ne rendait plus rien du tout. Ici, chaque
  // caractère n'est lu qu'une fois.
  let i = 0;
  while (out.length < 3) {
    const a = html.indexOf('<svg', i);
    if (a < 0) break;
    const b = html.indexOf('</svg>', a);
    if (b < 0) break;
    i = b + 6;
    const svg = html.slice(a, i);

    // Un SVG minuscule est une icône d'interface ; un SVG énorme est une
    // illustration. Ni l'un ni l'autre n'est un logo.
    if (svg.length < 120 || svg.length > 60000) continue;

    const head = svg.slice(0, 400);
    const looksLikeLogo = /logo|brand/i.test(head)
      || /<title[^>]*>\s*[^<]*logo/i.test(svg)
      // Un SVG placé tout en haut de la page est presque toujours celui de l'en-tête.
      || (a < 3000 && /viewBox/i.test(head));
    if (!looksLikeLogo) continue;
    // Les icônes d'interface les plus courantes, même bien placées.
    if (/arrow|chevron|caret|close|cross|menu|hamburger|search|cart|panier/i.test(head)) continue;

    // Un SVG sans dimensions ne s'affiche pas dans une balise <img> : on lui
    // donne celles de son viewBox.
    let el = svg;
    if (!/\swidth=/i.test(head)) {
      const vb = head.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i);
      if (vb) el = el.replace(/<svg/i, `<svg width="${vb[1]}" height="${vb[2]}"`);
    }
    if (!/xmlns=/i.test(el.slice(0, 200))) el = el.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');

    out.push(`data:image/svg+xml;utf8,${encodeURIComponent(el)}`);
  }
  return out;
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
  // La couleur de thème est DÉCLARÉE par la marque dans son en-tête : elle vaut
  // mieux qu'un comptage, et elle compte donc comme désignée — même si elle est
  // neutre, c'est un choix assumé de la marque.
  const themeColor = normalizeHex(meta(html, 'theme-color') ?? '');
  if (themeColor) {
    colorCounts.counts.set(themeColor, (colorCounts.counts.get(themeColor) ?? 0) + 40);
    colorCounts.designated.add(themeColor);
  }

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const name = meta(html, 'og:site_name', 'application-name')
    ?? (title ? decodeEntities(title).split(/[|–—·-]/)[0].trim() : undefined);

  const logoCandidates = findLogoCandidates(html, css, url);

  return {
    url: url.toString(),
    name: name && name.length <= 60 ? name : undefined,
    description: meta(html, 'og:description', 'description', 'twitter:description'),
    colors: rankBrandColors(colorCounts.counts, colorCounts.designated),
    fonts: collectFonts(html, css),
    logoUrl: logoCandidates[0],
    /** Toutes les pistes de logo, du plus probable au moins — l'utilisateur choisit. */
    logoCandidates,
    heroImage: absolutize(meta(html, 'og:image', 'twitter:image'), url),
    iconUrl: findIcon(html, url),
    sampleText: visibleText(html),
  };
}
