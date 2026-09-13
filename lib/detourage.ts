// lib/detourage.ts — retirer le fond uni d'une image, dans le navigateur.
//
// POURQUOI CE FICHIER EXISTE. Mesuré le 2026-09-12 en appelant l'API : les
// trois modèles d'images de Gemini (3.1-flash-lite-image, 3.1-flash-image,
// 3-pro-image) renvoient du `image/jpeg`. Le JPEG n'a pas de canal alpha, et
// l'API n'offre aucun réglage de format : `generationConfig.responseMimeType`
// n'accepte que du texte, et `imageConfig` ne connaît pas `mimeType`. Demander
// « fond transparent » dans l'invite ne peut donc PAS marcher : au mieux le
// modèle rend un fond blanc.
//
// La transparence se fabrique donc ici. On demande au modèle un fond blanc
// parfaitement uni, puis on l'enlève : remplissage par diffusion depuis les
// bords, ce qui ne mange que le fond CONNECTÉ aux bords. Les blancs intérieurs
// du sujet (le reflet d'un caillou, le papier d'une aquarelle) restent opaques,
// alors qu'un simple seuil sur la couleur les aurait troués.
//
// Le modèle de détourage IA (@imgly, bouton « Détourer » de la barre) reste le
// recours quand le fond n'est pas uni : il coûte un téléchargement de plusieurs
// mégaoctets, là où ceci est instantané et sans réseau.
//
// LE LISERÉ. Un seuil de couleur seul laisse toujours un halo : le JPEG étale
// sur deux ou trois pixels un dégradé entre le sujet et le fond, et ces
// pixels-là sont trop colorés pour tomber sous le seuil. Ils se voient dès
// qu'on pose l'élément sur un aplat sombre. D'où les deux passes qui suivent :
// on RONGE la découpe d'un ou deux pixels (carte de distance), puis on
// DÉCONTAMINE ce qui reste de semi-transparent en retirant la part de fond
// mélangée dedans. C'est ce que fait un détourage propre, et ça ne coûte que
// deux balayages de l'image.

export type Detourage = {
  /** L'image détourée, en PNG. */
  uri: string;
  /** Part de pixels devenus transparents, 0 à 1. Sous ~0,05 le fond n'était
   *  pas uni : à l'appelant de garder l'original. */
  part: number;
  largeur: number;
  hauteur: number;
};

export type OptionsDetourage = {
  /** Écart de couleur (somme des trois canaux) en dessous duquel un pixel est
   *  du fond PUR : alpha zéro. */
  tolerance?: number;
  /** Écart au-delà duquel un pixel est pleinement le sujet. Entre les deux,
   *  l'alpha monte progressivement : c'est ce qui fait disparaître une ombre
   *  portée au lieu de la laisser en auréole. */
  plafond?: number;
  /** Pixels rongés sur le bord de la découpe. C'est ce qui mange le liseré. */
  rongeage?: number;
  /** Largeur du dégradé d'alpha, en pixels, juste après le rongeage. */
  adoucissement?: number;
};

/** Bande du pourtour traitée comme du fond quoi qu'il arrive, et point de
 *  départ de la diffusion. */
const BANDE = 2;

/** Couleur dominante du pourtour : la médiane, pour qu'un sujet qui touche un
 *  bord ne déplace pas la mesure.
 *
 *  On mesure À L'INTÉRIEUR, en sautant `BANDE + 1` pixels. Vu le 2026-09-12 :
 *  un JPEG redimensionné porte souvent un liseré d'UN pixel plus sombre tout
 *  autour (228 au lieu de 252). Mesurée sur la ligne extérieure, la couleur du
 *  fond était donc ce liseré, et plus rien ne correspondait : la diffusion
 *  s'arrêtait au premier pixel et 0,5 % de l'image était retiré. */
function couleurDuFond(px: Uint8ClampedArray, l: number, h: number): [number, number, number] {
  const r: number[] = [], g: number[] = [], b: number[] = [];
  const prendre = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= l || y >= h) return;
    const i = (y * l + x) * 4;
    r.push(px[i]); g.push(px[i + 1]); b.push(px[i + 2]);
  };
  const pas = Math.max(1, Math.round(Math.min(l, h) / 64));
  const dedans = BANDE + 1;
  for (let x = dedans; x < l - dedans; x += pas) {
    for (let e = 0; e < 3; e++) { prendre(x, dedans + e); prendre(x, h - 1 - dedans - e); }
  }
  for (let y = dedans; y < h - dedans; y += pas) {
    for (let e = 0; e < 3; e++) { prendre(dedans + e, y); prendre(l - 1 - dedans - e, y); }
  }
  const med = (v: number[]) => { v.sort((a, c) => a - c); return v[Math.floor(v.length / 2)] ?? 255; };
  return [med(r), med(g), med(b)];
}

/** Distance de chaque pixel au fond le plus proche, en pixels. Chanfrein en
 *  deux balayages : assez exact pour un bord, et linéaire en temps. */
function carteDeDistance(fond: Uint8Array, l: number, h: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(l * h);
  for (let i = 0; i < d.length; i++) d[i] = fond[i] ? 0 : INF;
  const D1 = 1, D2 = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const i = y * l + x;
      if (!d[i]) continue;
      let m = d[i];
      if (x > 0) m = Math.min(m, d[i - 1] + D1);
      if (y > 0) m = Math.min(m, d[i - l] + D1);
      if (x > 0 && y > 0) m = Math.min(m, d[i - l - 1] + D2);
      if (x < l - 1 && y > 0) m = Math.min(m, d[i - l + 1] + D2);
      d[i] = m;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = l - 1; x >= 0; x--) {
      const i = y * l + x;
      if (!d[i]) continue;
      let m = d[i];
      if (x < l - 1) m = Math.min(m, d[i + 1] + D1);
      if (y < h - 1) m = Math.min(m, d[i + l] + D1);
      if (x < l - 1 && y < h - 1) m = Math.min(m, d[i + l + 1] + D2);
      if (x > 0 && y < h - 1) m = Math.min(m, d[i + l - 1] + D2);
      d[i] = m;
    }
  }
  return d;
}

/**
 * Enlève le fond uni d'une image et rogne au sujet.
 *
 * @param source  URL ou data URI de l'image.
 */
export async function detourerFondUni(source: string, options: OptionsDetourage = {}): Promise<Detourage | null> {
  if (typeof document === 'undefined') return null;
  const img = await new Promise<HTMLImageElement | null>(resoudre => {
    const el = new window.Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resoudre(el);
    el.onerror = () => resoudre(null);
    el.src = source;
  });
  if (!img) return null;

  const l = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!l || !h) return null;
  const cv = document.createElement('canvas');
  cv.width = l; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);

  let donnees: ImageData;
  try { donnees = ctx.getImageData(0, 0, l, h); } catch { return null; } // image d'une autre origine
  const px = donnees.data;
  const [fr, fg, fb] = couleurDuFond(px, l, h);

  const tolerance = options.tolerance ?? 30;
  // L'AURÉOLE. Le modèle dessine presque toujours une ombre douce sous le
  // sujet, même quand l'invite l'interdit. Un seuil net la coupe en plein
  // milieu et laisse une galette grise autour de l'élément : c'est exactement
  // le « contour dégueulasse » qu'on voit dès qu'on pose l'élément sur un
  // aplat sombre. On monte donc en alpha PROGRESSIVEMENT, du fond pur jusqu'au
  // sujet franc, et on traverse toute la zone douce au lieu de s'y arrêter.
  const plafond = options.plafond ?? 150;
  // L'OMBRE EST GRISE, LE SUJET EST COLORÉ. Un gris clair connecté au fond,
  // c'est une ombre portée ou un reflet de papier : jamais l'élément qu'on a
  // demandé. C'est ce test, et pas le seuil de couleur, qui fait disparaître
  // la galette blanche autour du sujet. (Le modèle de segmentation @imgly,
  // essayé le 2026-09-12, fait des bords parfaits mais supprime des morceaux
  // entiers du sujet : sur une fleur en papier, il garde la corolle et jette
  // les feuilles. Il reste le recours manuel, pas le chemin par défaut.)
  // Le seuil de clarté se mesure PAR RAPPORT au fond : une ombre reste claire,
  // un trait noir ou un aplat foncé du sujet passe largement en dessous.
  const SAT_FOND = 24;
  const LUM_FOND = Math.round(Math.max(fr, fg, fb) * 0.62);
  // Le liseré fait deux à trois pixels sur une image d'un millier de pixels de
  // large : on ronge à cette échelle, pas en valeur absolue, sinon une petite
  // image se fait dévorer et une grande garde son halo.
  const echelle = Math.max(1, Math.min(l, h) / 760);
  const rongeage = (options.rongeage ?? 1.6) * echelle;
  const adoucissement = (options.adoucissement ?? 1.4) * echelle;

  // 1. Diffusion depuis les bords : seul le fond CONNECTÉ au bord tombe, donc
  //    les blancs intérieurs du sujet restent.
  const fond = new Uint8Array(l * h);
  const vu = new Uint8Array(l * h);
  const pile = new Int32Array(l * h);
  let sommet = 0;
  let efface = 0;
  const empiler = (i: number) => { if (!vu[i]) { vu[i] = 1; pile[sommet++] = i; } };
  // La bande extérieure est du fond par décret, sa couleur ne compte pas : sans
  // ça, un liseré de compression d'un pixel bloque toute la diffusion.
  const decreter = (x: number, y: number) => {
    const i = y * l + x;
    if (!fond[i]) { fond[i] = 1; efface++; }
    vu[i] = 1;
    if (x > 0) empiler(i - 1);
    if (x < l - 1) empiler(i + 1);
    if (y > 0) empiler(i - l);
    if (y < h - 1) empiler(i + l);
  };
  for (let e = 0; e < BANDE; e++) {
    for (let x = 0; x < l; x++) { decreter(x, e); decreter(x, h - 1 - e); }
    for (let y = 0; y < h; y++) { decreter(e, y); decreter(l - 1 - e, y); }
  }
  // `douceur` garde l'alpha calculé dans la zone traversée ; 255 ailleurs.
  const douceur = new Uint8Array(l * h).fill(255);
  for (let i = 0; i < l * h; i++) if (fond[i]) douceur[i] = 0;
  while (sommet > 0) {
    const i = pile[--sommet];
    const p = i * 4;
    const d = Math.abs(px[p] - fr) + Math.abs(px[p + 1] - fg) + Math.abs(px[p + 2] - fb);
    const haut = Math.max(px[p], px[p + 1], px[p + 2]);
    const bas = Math.min(px[p], px[p + 1], px[p + 2]);
    const ombre = haut - bas <= SAT_FOND && haut >= LUM_FOND;
    if (d >= plafond && !ombre) continue; // sujet franc : on s'arrête là
    if (d <= tolerance || ombre) {
      fond[i] = 1;
      douceur[i] = 0;
      efface++;
    } else {
      // Zone douce (ombre, flou de compression) : à demi effacée, et on
      // CONTINUE de traverser, sinon l'auréole reste entière.
      const t = (d - tolerance) / (plafond - tolerance);
      douceur[i] = Math.round(255 * Math.pow(t, 1.5));
      efface += 1 - t;
    }
    const x = i % l, y = (i / l) | 0;
    if (x > 0) empiler(i - 1);
    if (x < l - 1) empiler(i + 1);
    if (y > 0) empiler(i - l);
    if (y < h - 1) empiler(i + l);
  }

  // 1 bis. LES POCHES. Le vide entre deux feuilles, l'intérieur d'une anse :
  // ce sont des aplats de fond que la diffusion depuis le bord n'atteint
  // jamais, et ils restaient en pleine page comme des taches blanches. On les
  // ramasse, mais seulement quand ils sont assez grands pour être du fond et
  // pas le blanc d'un œil ou le reflet d'un caillou.
  const estFondPur = (i: number) => {
    const p = i * 4;
    const d = Math.abs(px[p] - fr) + Math.abs(px[p + 1] - fg) + Math.abs(px[p + 2] - fb);
    if (d <= tolerance) return true;
    const haut = Math.max(px[p], px[p + 1], px[p + 2]);
    return haut - Math.min(px[p], px[p + 1], px[p + 2]) <= SAT_FOND && haut >= LUM_FOND;
  };
  const seuilPoche = Math.max(80, Math.round(l * h * 0.0006));
  const poche = new Int32Array(l * h);
  for (let depart = 0; depart < l * h; depart++) {
    if (vu[depart]) continue;
    if (!estFondPur(depart)) { vu[depart] = 1; continue; }
    let n = 0, tete = 0;
    poche[n++] = depart; vu[depart] = 1;
    while (tete < n) {
      const i = poche[tete++];
      const x = i % l, y = (i / l) | 0;
      const voisins = [x > 0 ? i - 1 : -1, x < l - 1 ? i + 1 : -1, y > 0 ? i - l : -1, y < h - 1 ? i + l : -1];
      for (const v of voisins) {
        if (v < 0 || vu[v]) continue;
        if (estFondPur(v)) { vu[v] = 1; poche[n++] = v; } else vu[v] = 1;
      }
    }
    if (n >= seuilPoche) {
      for (let k = 0; k < n; k++) { fond[poche[k]] = 1; douceur[poche[k]] = 0; efface++; }
    }
  }

  const part = efface / (l * h);
  if (part < 0.05) return { uri: source, part, largeur: l, hauteur: h };

  // 2. Rongeage et adoucissement d'après la distance au fond pur.
  const dist = carteDeDistance(fond, l, h);
  for (let i = 0; i < l * h; i++) {
    const p = i * 4;
    const t = (dist[i] - rongeage) / adoucissement;
    const aDist = t <= 0 ? 0 : t >= 1 ? 255 : Math.round(255 * t);
    const a = Math.min(aDist, douceur[i]);
    px[p + 3] = a;
    // 3. Décontamination : un pixel à demi transparent porte encore la couleur
    //    du fond mélangée à celle du sujet. On retire cette part, sinon le
    //    contour reste blanc sur un aplat sombre.
    if (a > 0 && a < 255) {
      const k = a / 255;
      px[p] = Math.max(0, Math.min(255, Math.round((px[p] - (1 - k) * fr) / k)));
      px[p + 1] = Math.max(0, Math.min(255, Math.round((px[p + 1] - (1 - k) * fg) / k)));
      px[p + 2] = Math.max(0, Math.min(255, Math.round((px[p + 2] - (1 - k) * fb) / k)));
    }
  }
  ctx.putImageData(donnees, 0, 0);

  // 4. Rogner au sujet : l'élément arrive à sa taille, pas noyé dans du vide.
  let x0 = l, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      if (px[(y * l + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0 || y1 < y0) return { uri: cv.toDataURL('image/png'), part, largeur: l, hauteur: h };
  const marge = Math.round(Math.min(l, h) * 0.01);
  x0 = Math.max(0, x0 - marge); y0 = Math.max(0, y0 - marge);
  x1 = Math.min(l - 1, x1 + marge); y1 = Math.min(h - 1, y1 + marge);
  const rogne = document.createElement('canvas');
  rogne.width = x1 - x0 + 1; rogne.height = y1 - y0 + 1;
  const rctx = rogne.getContext('2d');
  if (!rctx) return { uri: cv.toDataURL('image/png'), part, largeur: l, hauteur: h };
  rctx.drawImage(cv, x0, y0, rogne.width, rogne.height, 0, 0, rogne.width, rogne.height);
  return { uri: rogne.toDataURL('image/png'), part, largeur: rogne.width, hauteur: rogne.height };
}
