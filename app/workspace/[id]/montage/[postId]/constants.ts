// constants.ts — types + données de référence du module Montage vidéo
// Tokens repris à l'identique de design_handoff_montage_video/design_files/data.jsx

export type ClipKind = "video" | "photo";

export interface MontageClip {
  id: string;
  kind: ClipKind;
  name: string;
  src: string;
  srcDur: number;      // durée source réelle (vidéo) — pour la photo, plafond éditable
  trimStart: number;   // borne de début (s), dans le référentiel de la source
  trimEnd: number;     // borne de fin (s), dans le référentiel de la source
  speed: number;        // 1 = normal (SPEEDS)
  filterId: string;     // FILTERS[].id
  lum: number;           // -50..50
  con: number;           // -50..50
  sat: number;           // -50..50
  transitionIn: string;  // TRANSITIONS[].id — transition d'entrée sur ce plan
  transitionDur: number; // durée de la transition (s)
  gapBefore?: number;    // écran noir (s) inséré AVANT ce plan sur la timeline — défaut 0. Permet de laisser du vide en tête de montage ou entre deux plans.
  vol?: number;          // volume du son embarqué du plan vidéo (0-1, défaut 1)
  audioFadeIn?: number;  // fondu d'entrée du son embarqué (s), défaut 0
  audioFadeOut?: number; // fondu de sortie du son embarqué (s), défaut 0
  kenBurns?: KenBurnsDir; // zoom auto sur les plans photo (kind === "photo" uniquement)
  focusX?: number; // point de recadrage "cover" (0-1), défaut 0.5 = centré — posé par le recadrage IA du sujet
  focusY?: number; // idem, axe vertical
}

// Zoom automatique (façon CapCut) sur un plan photo statique.
export type KenBurnsDir = "in" | "out";
const KEN_BURNS_AMOUNT = 0.12; // amplitude du zoom (12%)

// p: progression 0→1 dans la durée du plan. Retourne l'échelle à appliquer au centre du cadre.
export function kenBurnsScale(dir: KenBurnsDir | undefined, p: number): number {
  if (!dir) return 1;
  const e = Math.max(0, Math.min(1, p));
  return dir === "in" ? 1 + KEN_BURNS_AMOUNT * e : 1 + KEN_BURNS_AMOUNT * (1 - e);
}

// Durée effective d'un clip sur la timeline (après rognage + vitesse)
export function clipTimelineDur(c: MontageClip): number {
  const raw = Math.max(0, c.trimEnd - c.trimStart);
  return c.kind === "video" ? raw / c.speed : raw;
}

// Gain du son embarqué d'un plan à un instant local (0..durée timeline), fondus inclus.
export function clipAudioGainAt(c: MontageClip, localT: number): number {
  const base = c.vol ?? 1;
  const dur = clipTimelineDur(c);
  // Le son suit la transition vidéo (comme CapCut) : si aucun fondu audio n'est
  // réglé à la main, une transition d'entrée entraîne un fondu audio de même durée.
  const autoFade = c.transitionIn && c.transitionIn !== "cut" ? Math.max(0, c.transitionDur || 0) : 0;
  const fi = c.audioFadeIn ?? autoFade, fo = c.audioFadeOut ?? 0;
  let m = 1;
  if (fi > 0) m = Math.min(m, localT / fi);
  if (fo > 0) m = Math.min(m, (dur - localT) / fo);
  return base * Math.max(0, Math.min(1, m));
}

// Plan d'incrustation (PIP) — 2e piste vidéo/photo superposée à la piste principale.
// Positionné librement dans le temps (offset) et dans l'image (x/y/échelle/rotation/opacité).
export interface OverlayClip {
  id: string;
  kind: ClipKind;
  name: string;
  src: string;
  srcDur: number;      // durée source réelle (vidéo) — pour la photo, plafond éditable
  trimStart: number;
  trimEnd: number;
  offset: number;      // début sur la timeline (s)
  track?: number;      // piste vidéo d'empilement (0 = juste au-dessus du plan principal ; plus haut = au-dessus). Défaut 0.
  x: number;           // centre en % (0-100)
  y: number;           // centre en %
  scale: number;       // 1 = ~50% de la largeur du cadre
  rotation: number;    // degrés
  opacity: number;     // 0-1
  filterId: string;
  lum: number;
  con: number;
  sat: number;
  vol?: number;        // volume du son embarqué (0-1)
  audioFadeIn?: number;  // fondu d'entrée du son (s)
  audioFadeOut?: number; // fondu de sortie du son (s)

  /* ── Effets de l'objet incrusté ────────────────────────────────────────────
     Ombre portée, contour et coins arrondis. Toutes les distances sont en
     POURCENTAGE DE LA LARGEUR de l'incrustation, jamais en pixels : l'effet
     suit alors l'objet quand on le redimensionne, et la même valeur donne le
     même résultat quel que soit le format d'export (720 de large en 9:16, 1280
     en 16:9). Tous les champs sont facultatifs et valent « aucun effet » quand
     ils manquent, donc les montages existants ne changent pas d'un pixel.

     TOUT champ ajouté ici doit être honoré aux DEUX endroits : l'aperçu du
     monteur (DOM, via overlayEffectCss) et l'export (canvas 2D, via
     drawOverlayFrame). C'est la même géométrie des deux côtés : `drop-shadow`
     en CSS et `ctx.shadow*` sur le canvas suivent l'un comme l'autre la
     transparence de l'image, et définissent le flou de la même façon (écart
     type = rayon / 2). Une découpe PNG projette donc bien l'ombre de sa forme,
     pas celle de son cadre. */
  shadow?: boolean;       // ombre portée active
  shadowColor?: string;   // couleur de l'ombre (#rrggbb), défaut noir
  shadowBlur?: number;    // flou, en % de la largeur de l'incrustation
  shadowX?: number;       // décalage horizontal, en % de la largeur
  shadowY?: number;       // décalage vertical, en % de la largeur
  shadowOpacity?: number; // 0-1
  outlineW?: number;      // épaisseur du contour, en % de la largeur (0 = aucun)
  outlineColor?: string;  // couleur du contour
  radius?: number;        // rayon des coins, en % de la largeur (0 = angles vifs)
}

/** Valeurs d'effet résolues, en % de la largeur de l'incrustation. */
export interface OverlayEffects {
  shadow: boolean;
  shadowRgba: string;
  blur: number; dx: number; dy: number;
  outlineW: number; outlineColor: string;
  radius: number;
  aucun: boolean; // rien à dessiner : on garde le chemin de rendu simple
}

export function overlayEffects(o: OverlayClip): OverlayEffects {
  const shadow = !!o.shadow;
  const outlineW = Math.max(0, o.outlineW ?? 0);
  const radius = Math.max(0, o.radius ?? 0);
  return {
    shadow,
    shadowRgba: withAlpha(o.shadowColor || "#000000", o.shadowOpacity ?? 0.45),
    blur: Math.max(0, o.shadowBlur ?? 8),
    dx: o.shadowX ?? 1.5,
    dy: o.shadowY ?? 2.5,
    outlineW,
    outlineColor: o.outlineColor || "#FFFFFF",
    radius,
    aucun: !shadow && outlineW <= 0 && radius <= 0,
  };
}

/* Nombre de passes du contour.

   Un contour qui suit la découpe d'une image ne se trace pas : on épaissit la
   silhouette. La manière de le faire doit être RIGOUREUSEMENT la même dans
   l'aperçu et à l'export, sans quoi le contour n'a pas la même épaisseur des
   deux côtés. C'était le cas d'une première version : côté canvas je posais
   huit copies de la silhouette à distance fixe, côté CSS j'enchaînais huit
   `drop-shadow`. Or les filtres CSS s'appliquent EN CASCADE : le deuxième prend
   pour source l'image plus l'ombre du premier, si bien que l'épaississement
   s'accumule au lieu de rester à la distance demandée. Le contour de l'aperçu
   sortait plus épais que celui du fichier.

   On fait donc faire la même chose aux deux : trois halos successifs, chacun
   calculé sur le résultat du précédent. En CSS c'est trois `drop-shadow(0 0 W)`
   à la suite ; sur le canvas, trois passes d'ombre sans décalage entre deux
   surfaces. Le flou se définit pareil des deux côtés (écart type = rayon / 2),
   donc les deux images se superposent. */
export const OUTLINE_PASSES = 3;

/**
 * Effets d'une incrustation en filtres CSS, pour l'aperçu du monteur.
 * `largeurPx` : largeur RÉELLE de l'incrustation à l'écran, en pixels CSS.
 * Les pourcentages s'y rapportent, exactement comme à l'export.
 * L'ordre compte : le contour d'abord, l'ombre ensuite, pour que l'ombre soit
 * projetée par la silhouette contour compris (même ordre qu'au rendu canvas).
 */
export function overlayEffectCss(o: OverlayClip, largeurPx: number): string {
  const e = overlayEffects(o);
  if (e.aucun || !(largeurPx > 0)) return "";
  const u = largeurPx / 100; // 1 % de la largeur, en pixels
  const parts: string[] = [];
  if (e.outlineW > 0) {
    const w = (e.outlineW * u).toFixed(2);
    for (let i = 0; i < OUTLINE_PASSES; i++) parts.push(`drop-shadow(0 0 ${w}px ${e.outlineColor})`);
  }
  if (e.shadow) {
    parts.push(`drop-shadow(${(e.dx * u).toFixed(2)}px ${(e.dy * u).toFixed(2)}px ${(e.blur * u).toFixed(2)}px ${e.shadowRgba})`);
  }
  return parts.join(" ");
}

/** Réglages d'effet prêts à l'emploi. Le premier remet tout à plat. */
export const OVERLAY_EFFECT_PRESETS: { id: string; patch: Partial<OverlayClip> }[] = [
  { id: "none",    patch: { shadow: false, outlineW: 0, radius: 0 } },
  { id: "soft",    patch: { shadow: true, shadowColor: "#000000", shadowBlur: 9,   shadowX: 1.2, shadowY: 2.2, shadowOpacity: 0.35, outlineW: 0 } },
  { id: "strong",  patch: { shadow: true, shadowColor: "#000000", shadowBlur: 4.5, shadowX: 3,   shadowY: 4,   shadowOpacity: 0.6,  outlineW: 0 } },
  { id: "glow",    patch: { shadow: true, shadowColor: "#FFFFFF", shadowBlur: 13,  shadowX: 0,   shadowY: 0,   shadowOpacity: 0.85, outlineW: 0 } },
  { id: "sticker", patch: { shadow: true, shadowColor: "#000000", shadowBlur: 5,   shadowX: 0.8, shadowY: 1.6, shadowOpacity: 0.4,  outlineW: 2.2, outlineColor: "#FFFFFF" } },
  { id: "card",    patch: { shadow: true, shadowColor: "#000000", shadowBlur: 8,   shadowX: 0,   shadowY: 2.5, shadowOpacity: 0.45, outlineW: 0, radius: 6 } },
];

// Durée effective d'un overlay sur la timeline (rognage, sans vitesse variable)
export function overlayTimelineDur(o: OverlayClip): number {
  return Math.max(0, o.trimEnd - o.trimStart);
}

// Gain du son d'une incrustation à un instant local (fondus inclus).
export function overlayAudioGainAt(o: OverlayClip, localT: number): number {
  const base = o.vol ?? 1;
  const dur = overlayTimelineDur(o);
  const fi = o.audioFadeIn ?? 0, fo = o.audioFadeOut ?? 0;
  let m = 1;
  if (fi > 0) m = Math.min(m, localT / fi);
  if (fo > 0) m = Math.min(m, (dur - localT) / fo);
  return base * Math.max(0, Math.min(1, m));
}

export function newOverlayDefaults(): Pick<OverlayClip, "x" | "y" | "scale" | "rotation" | "opacity" | "filterId" | "lum" | "con" | "sat" | "vol"> {
  return { x: 50, y: 40, scale: 1, rotation: 0, opacity: 1, filterId: "none", lum: 0, con: 0, sat: 0, vol: 1 };
}

export interface Caption {
  id: string;
  start: number;
  end: number;
  text: string;
  // Surcharges individuelles (utilisées quand les sous-titres sont « déliés ») :
  styleId?: string;                 // style propre à ce sous-titre
  custom?: SubCustom;               // couleurs/typo propres à ce sous-titre
  x?: number;                       // position X propre (%)
  y?: number;                       // position Y propre (%)
}

export interface TitleEl {
  id: string;
  start: number;
  end: number;
  text: string;
  font: "archivo" | "instrument" | "satoshi";
  color: string;
  anim: "rise" | "type" | "pop";
  x: number; // % (0-100)
  y: number; // % (0-100)
  scale?: number; // facteur de taille (défaut 1)
  rotation?: number; // degrés (défaut 0)
  /** Piste de texte d'empilement (0 = la première). Comme pour les incrustations
   *  et les pistes audio, on peut empiler plusieurs rangées de texte : deux
   *  titres au même instant sur la même rangée n'auraient aucun sens. */
  track?: number;
  /** Largeur maximale de la boîte, en % de la largeur du cadre. C'est elle qui
   *  décide où le texte revient à la ligne. Défaut 80, réglable de 20 à 100 :
   *  un titre était bloqué à 80 % et ne pouvait pas s'étendre vers les bords. */
  maxWidth?: number;
}

/** Corps de référence d'un titre, à l'échelle 1. Partagé par l'aperçu et l'export. */
export const TITLE_BASE_FONT = 40;
/** Interligne des titres. Posé explicitement des deux côtés : laissé à la valeur
 *  héritée du navigateur, l'aperçu et l'export ne tombaient pas au même endroit. */
export const TITLE_LINE_HEIGHT = 1.15;
export const TITLE_DEFAULT_MAX_WIDTH = 80;

/** Police d'un titre en syntaxe canvas. SOURCE UNIQUE : l'export dessine avec,
 *  et le découpage en lignes mesure avec. L'export utilisait jusqu'ici une
 *  police en dur (system-ui, Georgia) sans rapport avec celle de l'aperçu. */
export function titleCanvasFont(font: TitleEl["font"], fontSize: number): string {
  const f = FONT_CHOICES.find((c) => c.id === font) || FONT_CHOICES[0];
  return `${f.italic ? "italic " : ""}${f.weight} ${fontSize}px ${f.canvas}`;
}

/** Découpe le texte d'un titre en lignes, à la géométrie du cadre d'export.
 *  Les retours à la ligne tapés à la main sont respectés ; le reste est replié
 *  à `maxWidth`. L'aperçu pose ces lignes telles quelles au lieu de laisser le
 *  navigateur replier à sa façon, donc les deux tombent pareil. */
export function titleLines(tt: TitleEl, frameW: number): string[] {
  const texte = tt.text ?? "";
  const paragraphes = texte.split("\n");
  if (typeof document === "undefined") return paragraphes;
  if (!titleMeasureCtx) titleMeasureCtx = document.createElement("canvas").getContext("2d");
  const ctx = titleMeasureCtx;
  if (!ctx) return paragraphes;
  // Mesure à l'échelle 1 : la taille du titre est appliquée ensuite par une
  // transformation, elle ne change donc pas où le texte revient à la ligne.
  ctx.font = titleCanvasFont(tt.font, TITLE_BASE_FONT);
  const maxW = ((tt.maxWidth ?? TITLE_DEFAULT_MAX_WIDTH) / 100) * frameW / Math.max(0.05, tt.scale ?? 1);
  const measure = (str: string) => ctx.measureText(str).width;
  const out: string[] = [];
  for (const para of paragraphes) {
    const mots = para.split(/\s+/).filter(Boolean);
    if (!mots.length) { out.push(""); continue; }
    for (const ln of packLines(mots, measure, maxW)) out.push(ln.join(" "));
  }
  return out.length ? out : [""];
}
let titleMeasureCtx: CanvasRenderingContext2D | null = null;

export interface StickerEl {
  id: string;
  glyph: string;
  isImage?: boolean; // glyph = URL d'image (logo)
  start: number;
  end: number;
  x: number; // %
  y: number; // %
  scale: number;
  rotation?: number; // degrés (défaut 0)
}

export interface AudioTrack {
  id: string;
  kind: "music" | "voiceover";
  name: string;
  src: string;
  dur: number;
  vol: number; // 0-1
  offset: number; // décalage de départ sur la timeline (s)
  track?: number; // piste audio d'empilement (0, 1, 2…) — pour organiser des pistes qui se superposent. Défaut 0.
  srcOffset?: number; // décalage de départ DANS la source (s) — utilisé par l'audio détaché d'un plan rogné. Défaut 0.
  /** Durée TOTALE du fichier source (s). Sert de borne au rognage : sans elle on
   *  ne sait pas jusqu'où on peut rallonger une piste raccourcie. Absente sur les
   *  projets antérieurs, on retombe alors sur srcOffset + dur. */
  srcDur?: number;
  fadeIn?: number;  // durée du fondu d'entrée (s), défaut 0
  fadeOut?: number; // durée du fondu de sortie (s), défaut 0
  volKeys?: { t: number; v: number }[]; // points-clés de volume (automation) : t = temps local dans la piste (s), v = volume (0-2). Remplace `vol` quand présent.
  waveform?: number[]; // pics d'amplitude normalisés (0-1), échantillonnés à l'import — pour l'affichage visuel dans la timeline
}

/* Placement sans chevauchement sur une piste.

   Deux éléments d'une même piste ne peuvent pas occuper le même instant : sur la
   piste vidéo c'est évident, ça l'est tout autant pour un texte, un sous-titre ou
   une musique. Or dupliquer un texte posait la copie PAR-DESSUS l'original, et
   plus rien ne distinguait les deux.

   La règle retenue est celle d'un monteur : on ne détruit pas le voisin, on cale
   contre lui. L'élément déplacé glisse vers la droite jusqu'au premier créneau
   libre, si bien qu'une copie commence exactement là où finit l'original.

   `occupes` liste les intervalles déjà pris SUR CETTE PISTE, l'élément déplacé
   exclu. */
export function creneauLibre(debut: number, duree: number, occupes: { a: number; b: number }[]): number {
  if (duree <= 0) return Math.max(0, debut);
  const tries = occupes.slice().sort((x, y) => x.a - y.a);
  const EPS = 1e-3;
  let d = Math.max(0, debut);
  // Chaque décalage peut en provoquer un autre : on repasse jusqu'à ce que plus
  // rien ne bouge. La garde évite toute boucle sans fin sur des données abîmées.
  for (let garde = 0; garde < 200; garde++) {
    let bouge = false;
    for (const o of tries) {
      if (d < o.b - EPS && d + duree > o.a + EPS) { d = o.b; bouge = true; }
    }
    if (!bouge) break;
  }
  return d;
}

/** Durée totale de la source d'une piste, bornes du rognage comprises. */
export function audioSrcDur(a: AudioTrack): number {
  return Math.max(a.srcDur ?? 0, (a.srcOffset ?? 0) + a.dur);
}

// Volume effectif d'une piste audio à un instant donné (dans son propre référentiel,
// localTime = 0 au début de la piste), en appliquant les fondus entrée/sortie.
// Interpole une courbe de points-clés (triés par t) à l'instant localTime (maintien aux bords).
function interpVolKeys(keys: { t: number; v: number }[], localTime: number): number {
  const k = [...keys].sort((a, b) => a.t - b.t);
  if (k.length === 1 || localTime <= k[0].t) return k[0].v;
  const last = k[k.length - 1];
  if (localTime >= last.t) return last.v;
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i], b = k[i + 1];
    if (localTime >= a.t && localTime <= b.t) {
      const p = (localTime - a.t) / Math.max(1e-6, b.t - a.t);
      return a.v + (b.v - a.v) * p;
    }
  }
  return last.v;
}
export function audioVolumeAt(track: AudioTrack, localTime: number): number {
  // Base = courbe de points-clés si définie, sinon le volume fixe de la piste.
  const base = track.volKeys && track.volKeys.length > 0 ? interpVolKeys(track.volKeys, localTime) : track.vol;
  let mult = 1;
  if (track.fadeIn)  mult = Math.min(mult, Math.max(0, localTime / track.fadeIn));
  if (track.fadeOut) mult = Math.min(mult, Math.max(0, (track.dur - localTime) / track.fadeOut));
  return Math.max(0, Math.min(4, base * mult)); // marge jusqu'à 400 % (l'UI limite à 200 %)
}

// Personnalisation manuelle des sous-titres — surcharge n'importe quel champ du style de base.
export type CaseMode = "none" | "upper" | "lower" | "title";
export type SubAlign = "left" | "center" | "right";

// Surcharges de style d'un sous-titre — jeu de paramètres complet (façon CapCut).
// TOUT champ ajouté ici doit être honoré aux 3 endroits : aperçu montage (DOM),
// export vidéo (canvas 2D, export.ts drawCaptions) et aperçu de l'assistant client.
export type SubAnim = "words" | "none";

export interface SubCustom {
  // — Base —
  fg?: string;
  hi?: string;
  bg?: string;
  stroke?: string;
  font?: string;
  weight?: number;
  italic?: boolean;
  uppercase?: boolean;   // hérité — équivaut à caseMode "upper"
  pill?: boolean;
  scale?: number;        // facteur de taille (défaut 1)
  // — Typographie —
  underline?: boolean;
  caseMode?: CaseMode;   // prime sur `uppercase`
  letterSpacing?: number; // en em (défaut 0)
  lineHeight?: number;    // multiplicateur (défaut 1.15)
  align?: SubAlign;       // alignement du texte (défaut "center")
  // — Trait (contour) —
  strokeW?: number;       // épaisseur du contour, en px à taille de base (défaut 2)
  // — Arrière-plan —
  bgOpacity?: number;     // 0-1 (défaut 1)
  radius?: number;        // rayon des coins quand ce n'est pas une pilule (défaut 8)
  padX?: number;          // marge intérieure horizontale (px, défaut selon pill)
  padY?: number;
  bgW?: number;           // élargit le fond au-delà du texte (px, défaut 0)
  bgH?: number;           // le rehausse (px, défaut 0)
  bgX?: number;           // décale le fond seul, sans bouger le texte (px)
  bgY?: number;
  // — Ombre —
  shadowColor?: string;
  shadowBlur?: number;
  shadowX?: number;
  shadowY?: number;
  // — Lueur (glow) —
  glowColor?: string;
  glowBlur?: number;      // intensité (rayon de flou)
  glowSpread?: number;    // intervalle : nombre de passes empilées (défaut 1)
  glowX?: number;         // décalage de la lueur
  glowY?: number;
  // — Courbe —
  curve?: number;         // -100 à 100 : texte cintré vers le haut ou le bas (0 = droit)
  // — Mise en page —
  maxWidth?: number;      // largeur maximale du bloc, en % du cadre (défaut 82)
  maxLines?: number;      // lignes autorisées avant troncature (défaut 2)
  // — Transformer / Mélange —
  rotation?: number;      // degrés (défaut 0)
  opacity?: number;       // 0-1 (défaut 1)
  // — Animation du texte —
  // "words" = révélation mot par mot avec surlignage du mot dit (comportement
  // historique, façon CapCut). "none" = le sous-titre s'affiche d'un bloc, sans
  // animation ni surlignage : du texte simple posé sur l'image.
  anim?: SubAnim;
}

export interface MontageProject {
  clips: MontageClip[];
  overlays?: OverlayClip[];
  captions: Caption[];
  subStyleId: string;
  subMaxWords?: number;                                       // mots max par sous-titre (défaut 4)
  subPos?: { x: number; y: number };                          // position des sous-titres (%), défaut bas-centre
  subCustom?: SubCustom;                                       // surcharges manuelles (couleurs, typo, taille)
  linkedSubs?: boolean;                                        // true = tous les sous-titres partagent le style; false = style par sous-titre
  rawSegments?: { start: number; end: number; text: string }[]; // segments Whisper bruts (pour re-découper)
  rawWords?: { start: number; end: number; word: string }[];    // mots horodatés RECALÉS SUR LA TIMELINE (source de vérité des sous-titres)
  titles: TitleEl[];
  stickers: StickerEl[];
  audioTracks: AudioTrack[];
  showProgressBar: boolean;
  exportUrl?: string | null;
  formatId?: string;    // VIDEO_FORMATS[].id, ou "custom" — défaut "story" (9:16) si absent (anciens projets)
  customW?: number;     // largeur px si formatId === "custom"
  customH?: number;     // hauteur px si formatId === "custom"
  exportQuality?: string; // EXPORT_QUALITIES[].id — défaut "standard" si absent
  /** Horodatage du prémontage IA. Sa PRÉSENCE empêche un relancement automatique :
   *  revenir sur un montage déjà prémonté ne doit pas écraser le travail fait
   *  depuis. On ne le relance qu'à la main, depuis le panneau IA. */
  preEditedAt?: string;
}

export const EXPORT_QUALITIES: { id: string; label: string; bitrate: number }[] = [
  { id: 'low',      label: 'Légère (rapide)', bitrate: 2_500_000 },
  { id: 'standard', label: 'Standard',        bitrate: 4_000_000 },
  { id: 'high',     label: 'Haute qualité',   bitrate: 6_500_000 },
];
export function exportQualityById(id: string | undefined) {
  return EXPORT_QUALITIES.find(q => q.id === id) || EXPORT_QUALITIES[1];
}

// Formats d'export vidéo — même largeur de base (720px) pour un rendu cohérent,
// hauteur variable selon le ratio choisi.
export const VIDEO_FORMATS: { id: string; label: string; sub: string; w: number; h: number }[] = [
  { id: 'story',    label: 'Story / Reel', sub: '9:16', w: 720, h: 1280 },
  { id: 'square',   label: 'Carré',        sub: '1:1',  w: 720, h: 720 },
  { id: 'portrait', label: 'Portrait',     sub: '4:5',  w: 720, h: 900 },
  { id: 'landscape',label: 'Paysage',      sub: '16:9', w: 1280, h: 720 },
];
export function videoFormatById(id: string | undefined): typeof VIDEO_FORMATS[number] {
  return VIDEO_FORMATS.find(f => f.id === id) || VIDEO_FORMATS[0];
}

export const DEFAULT_SUB_POS = { x: 50, y: 84 };

// Fusionne le style de base (bibliothèque) avec les surcharges manuelles de l'utilisateur.
// Style entièrement résolu : base + surcharges, tous les champs remplis.
// C'est CE type que consomment l'aperçu, l'export et les panneaux d'édition.
export type EffectiveSub = SubStyle & {
  scale: number;
  underline: boolean;
  caseMode: CaseMode;
  letterSpacing: number;
  lineHeight: number;
  align: SubAlign;
  strokeW: number;
  bgOpacity: number;
  radius: number;
  padX: number;
  padY: number;
  bgW: number;
  bgH: number;
  bgX: number;
  bgY: number;
  maxWidth: number;
  maxLines: number;
  glowSpread: number;
  glowX: number;
  glowY: number;
  curve: number;
  shadowColor: string;
  shadowBlur: number;
  shadowX: number;
  shadowY: number;
  shadowSet?: boolean;
  glowColor: string;
  glowBlur: number;
  rotation: number;
  opacity: number;
  anim: SubAnim;
};

export function effectiveSubStyle(styleId: string, custom?: SubCustom): EffectiveSub {
  const base = subStyleById(styleId);
  const pill = custom?.pill ?? base.pill;
  const uppercase = custom?.uppercase ?? base.uppercase;
  return {
    ...base,
    fg: custom?.fg ?? base.fg,
    hi: custom?.hi ?? base.hi,
    bg: custom?.bg ?? base.bg,
    stroke: custom?.stroke ?? base.stroke,
    font: custom?.font ?? base.font,
    weight: custom?.weight ?? base.weight,
    italic: custom?.italic ?? base.italic,
    uppercase,
    pill,
    scale: custom?.scale ?? 1,
    // Typographie
    underline: custom?.underline ?? false,
    // `caseMode` prime ; sinon on retombe sur l'ancien booléen `uppercase`.
    caseMode: custom?.caseMode ?? (uppercase ? "upper" : "none"),
    letterSpacing: custom?.letterSpacing ?? 0,
    lineHeight: custom?.lineHeight ?? 1.15,
    align: custom?.align ?? "center",
    // Animation : AUCUNE par défaut. Un sous-titre simple, blanc, posé sur
    // l'image, lisible dans tous les formats — la révélation mot par mot devient
    // un choix, pas l'état de départ.
    anim: custom?.anim ?? "none",
    // Trait
    strokeW: custom?.strokeW ?? 2,
    // Fond
    bgOpacity: custom?.bgOpacity ?? 1,
    radius: custom?.radius ?? 8,
    padX: custom?.padX ?? (pill ? 16 : 12),
    padY: custom?.padY ?? (pill ? 6 : 8),
    bgW: custom?.bgW ?? 0,
    bgH: custom?.bgH ?? 0,
    bgX: custom?.bgX ?? 0,
    bgY: custom?.bgY ?? 0,
    curve: custom?.curve ?? 0,
    glowSpread: custom?.glowSpread ?? 1,
    glowX: custom?.glowX ?? 0,
    glowY: custom?.glowY ?? 0,
    // Mise en page
    maxWidth: custom?.maxWidth ?? 82,
    maxLines: custom?.maxLines ?? 2,
    // Ombre / lueur
    shadowColor: custom?.shadowColor ?? "",
    shadowBlur: custom?.shadowBlur ?? 0,
    shadowX: custom?.shadowX ?? 0,
    shadowY: custom?.shadowY ?? 0,
    // L'utilisateur a-t-il touché au réglage d'ombre ? `undefined` = jamais
    // touché, `""` = explicitement coupée. La distinction est ce qui permet à
    // « couper l'ombre » de vraiment couper l'ombre (voir subTextShadowCss).
    shadowSet: custom?.shadowColor !== undefined,
    glowColor: custom?.glowColor ?? "",
    glowBlur: custom?.glowBlur ?? 0,
    // Transformer / mélange
    rotation: custom?.rotation ?? 0,
    opacity: custom?.opacity ?? 1,
  };
}

// Applique la casse choisie (Casse TT / tt / Tt de CapCut).
export function applySubCase(text: string, mode: CaseMode): string {
  if (mode === "upper") return text.toUpperCase();
  if (mode === "lower") return text.toLowerCase();
  if (mode === "title") return text.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return text;
}

// Convertit une couleur #rrggbb + opacité en rgba() ; laisse passer tel quel
// "transparent" ou une couleur déjà en rgba().
export function withAlpha(color: string, alpha: number): string {
  if (!color || color === "transparent") return "transparent";
  if (alpha >= 1) return color;
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, alpha))})`;
}

// Ombre + lueur combinées, en syntaxe CSS text-shadow (aperçus DOM).
// `k` : facteur d'échelle (e.scale * unit). Les distances doivent le suivre,
// sinon l'ombre et la lueur gardent la même taille quand on grossit le texte —
// et l'aperçu cesse de correspondre à l'export, qui lui les multiplie.

/**
 * Mesureur de largeur de texte, adossé à un canvas hors écran.
 * `fontCss` suit la syntaxe de la propriété CSS `font` (ex. « 800 34px Archivo »).
 */
export function makeTextMeasurer(fontCss: string, letterSpacingPx = 0): (t: string) => number {
  if (typeof document === "undefined") {
    // Hors navigateur : approximation grossière, elle ne sert qu'à ne pas planter.
    return (t) => t.length * 8;
  }
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return (t) => t.length * 8;
  ctx.font = fontCss;
  // `letterSpacing` n'est pas pris en compte par measureText : on l'ajoute nous-mêmes.
  return (t) => ctx.measureText(t).width + Math.max(0, t.length - 1) * letterSpacingPx;
}

/** Le texte tient-il dans `maxLines` lignes à cette largeur ? */
export function wrapsWithin(
  text: string, measure: (t: string) => number, maxWidthPx: number, maxLines: number,
): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  let lines = 1, cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (measure(cand) <= maxWidthPx) { cur = cand; continue; }
    lines++;
    if (lines > maxLines) return false;
    cur = w;
  }
  return true;
}

/**
 * Découpe une suite de mots en blocs de sous-titre qui respectent DEUX limites :
 * un nombre de mots, et un nombre de LIGNES à une largeur donnée.
 *
 * Le découpage ne regardait que le nombre de mots. « 4 mots » sur « 1 ligne »
 * produisait donc un bloc trop large, qui passait à la ligne — le réglage de
 * lignes n'était qu'une propriété de style, il ne contraignait rien.
 *
 * Ici la limite de lignes est une VRAIE règle : dès qu'un mot ne rentre plus dans
 * le budget de lignes, il ouvre le bloc suivant au lieu de déborder.
 */
export function fitChunks(
  words: string[],
  maxWords: number,
  measure: (t: string) => number,
  maxWidthPx: number,
  maxLines: number,
): string[][] {
  const cap = Math.max(1, Math.floor(maxWords));
  const lineCap = Math.max(1, Math.floor(maxLines));
  const width = Math.max(1, maxWidthPx);
  const out: string[][] = [];
  let i = 0;

  while (i < words.length) {
    const chunk: string[] = [];
    let lines = 1;
    let cur = "";

    while (i < words.length && chunk.length < cap) {
      const w = words[i];
      const cand = cur ? `${cur} ${w}` : w;
      if (measure(cand) <= width) {
        cur = cand;
      } else if (lines < lineCap) {
        lines++;          // le mot ouvre une nouvelle ligne, dans le budget
        cur = w;
      } else {
        break;            // budget épuisé : ce mot appartient au bloc suivant
      }
      chunk.push(w);
      i++;
    }

    // Un mot seul plus large que la boîte ne rentrera jamais : on l'accepte tel
    // quel, sinon la boucle ne progresserait pas.
    if (!chunk.length) { chunk.push(words[i]); i++; }
    out.push(chunk);
  }

  return out.length ? out : [[]];
}

export function subTextShadowCss(e: EffectiveSub, k = 1): string {
  const parts: string[] = [];
  if (e.glowColor && e.glowBlur > 0) {
    // « Intervalle » = nombre de passes empilées : une lueur serrée (1) ou
    // largement diffusée (3). Le CSS n'a pas d'étalement sur text-shadow, on
    // superpose donc des flous croissants — l'export fait autant de passes.
    const n = Math.max(1, Math.round(e.glowSpread));
    for (let i = 1; i <= n; i++) {
      parts.push(`${e.glowX * k}px ${e.glowY * k}px ${e.glowBlur * i * k}px ${e.glowColor}`);
    }
  }
  if (e.shadowColor && (e.shadowBlur > 0 || e.shadowX || e.shadowY)) {
    parts.push(`${e.shadowX * k}px ${e.shadowY * k}px ${e.shadowBlur * k}px ${e.shadowColor}`);
  }
  // Filet de lisibilité : un texte nu, sans contour ni ombre, reçoit une ombre
  // douce — sinon il devient illisible sur une image claire.
  //
  // Mais il ne s'applique QUE si l'utilisateur n'a jamais touché au réglage.
  // Auparavant il s'appliquait toujours : couper l'ombre ne changeait donc rien
  // à l'écran, et l'activer remplaçait une ombre par une ombre presque
  // identique. Le contrôle avait l'air cassé alors qu'il fonctionnait.
  if (!parts.length && !e.shadowSet && e.bg === "transparent" && !e.stroke) {
    parts.push(`0 ${1 * k}px ${8 * k}px rgba(0,0,0,.6)`);
  }
  return parts.join(", ") || "none";
}

/**
 * Texte cintré. Chaque caractère est posé sur un arc : on rend son angle et son
 * décalage vertical.
 *
 * SOURCE UNIQUE, et c'est ici que ça compte le plus : le CSS ne sait pas mesurer
 * un caractère, le canvas si. Si chaque côté calculait sa courbe à sa façon,
 * l'aperçu et la vidéo rendue ne se superposeraient jamais. On répartit donc les
 * caractères à angle CONSTANT — approximation assumée, mais identique des deux
 * côtés, ce qui est la seule propriété qui compte ici.
 *
 * `curve` : -100 (creux) à 100 (bombé). 0 rend un tableau d'angles nuls.
 */
export function curveLayout(n: number, curve: number, fontSizePx: number): { deg: number; dy: number }[] {
  if (!curve || n <= 1) return Array.from({ length: Math.max(0, n) }, () => ({ deg: 0, dy: 0 }));
  const totalDeg = (curve / 100) * 70;       // ouverture de l'arc
  const step = totalDeg / (n - 1);
  const radius = fontSizePx * 7;             // rayon lié au corps, pour rester proportionné
  const sign = curve < 0 ? -1 : 1;
  return Array.from({ length: n }, (_, i) => {
    const deg = (i - (n - 1) / 2) * step;
    const rad = (deg * Math.PI) / 180;
    // Flèche de l'arc : les extrémités descendent (ou montent) par rapport au centre.
    return { deg, dy: sign * radius * (1 - Math.cos(rad)) };
  });
}

/** Calque de fond en CSS, à poser en premier enfant de la boîte de sous-titre.
 *  Rend `null` quand il n'y a pas de fond — on n'ajoute pas un calque pour rien. */
export function subBgLayerCss(e: EffectiveSub, unit = 1): Record<string, string | number> | null {
  if (!e.bg || e.bg === "transparent") return null;
  const k = e.scale * unit;
  return {
    position: "absolute",
    left: -e.bgW * k + e.bgX * k,
    top: -e.bgH * k + e.bgY * k,
    right: -e.bgW * k - e.bgX * k,
    bottom: -e.bgH * k - e.bgY * k,
    background: withAlpha(e.bg, e.bgOpacity),
    borderRadius: e.pill ? 999 : e.radius * k,
    pointerEvents: "none",
    zIndex: 0,
  };
}

/** Géométrie du FOND, indépendante du texte : on peut l'élargir, le rehausser
 *  et le décaler sans que le texte bouge. Partagée par l'aperçu et l'export. */
export function subBgBox(e: EffectiveSub, boxW: number, boxH: number, k = 1) {
  return {
    x: -e.bgW * k + e.bgX * k,
    y: -e.bgH * k + e.bgY * k,
    w: boxW + e.bgW * 2 * k,
    h: boxH + e.bgH * 2 * k,
    r: e.pill ? (boxH + e.bgH * 2 * k) / 2 : e.radius * k,
  };
}

// SOURCE UNIQUE du rendu de la boîte de sous-titre en DOM (aperçu montage +
// aperçu de l'assistant client). L'export canvas réplique ces mêmes règles.
// `unit` : nombre de pixels écran par unité de dessin. L'export dessine à la
// résolution du canvas (unit = 1, police de base 34) ; l'aperçu, plus petit,
// passe son facteur d'échelle. TOUTE la géométrie — police, marges, arrondi,
// contour — est multipliée par `e.scale * unit`, exactement comme le fait
// l'export. Auparavant l'aperçu grossissait le bloc avec un `transform: scale()` :
// on étirait une image déjà rendue, et la typo se pixellisait comme un zoom
// numérique au lieu d'être redessinée plus grande.
/**
 * Découpe une suite de mots en lignes qui tiennent dans `maxW`, SANS limite de
 * nombre de lignes. `measure` est injecté (ctx.measureText côté canvas) pour que
 * la fonction reste pure et testable.
 */
export function packLines(
  words: string[], measure: (s: string) => number, maxW: number,
): string[][] {
  const lines: string[][] = [];
  let cur: string[] = [];
  for (const w of words) {
    const next = cur.length ? [...cur, w] : [w];
    // Un mot seul plus large que la boîte reste sur sa ligne : on ne peut pas
    // faire mieux, et surtout on ne boucle pas dans le vide.
    if (cur.length && measure(next.join(" ")) > maxW) {
      lines.push(cur);
      cur = [w];
    } else {
      cur = next;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

/**
 * Lignes réellement dessinées pour un sous-titre.
 *
 * L'export ne dessinait qu'UNE ligne (tous les mots concaténés) alors que
 * l'aperçu, lui, renvoyait à la ligne tout seul : un sous-titre un peu long
 * débordait donc du cadre dans la vidéo rendue, sans qu'on le voie à l'écran.
 *
 * Le surplus au-delà de `maxLines` n'est plus tassé sur la dernière ligne : il
 * part dans le sous-titre suivant (cf. fitCaptionParts), qui est appelé en amont
 * par l'aperçu comme par l'export. La coupe ici n'est donc plus qu'un garde-fou.
 */
export function wrapWords(
  words: string[], measure: (s: string) => number, maxW: number, maxLines = 2,
): string[][] {
  const lines = packLines(words, measure, maxW).slice(0, Math.max(1, Math.round(maxLines)));
  return lines.length ? lines : [[]];
}

// Police canvas d'un sous-titre. SOURCE UNIQUE : l'export dessine avec, et le
// découpage en lignes mesure avec — sinon on découperait selon une police et on
// dessinerait avec une autre.
export function subCanvasFont(style: EffectiveSub, fontSize: number): string {
  const fam = style.font
    ? `'${style.font}', system-ui, sans-serif`
    : (style.italic ? "Georgia, serif" : "system-ui, sans-serif");
  return `${style.italic ? "italic " : ""}${style.weight} ${fontSize}px ${fam}`;
}

// Canvas de mesure hors écran, partagé (en créer un par appel coûterait cher :
// on mesure à chaque image de la vidéo).
let measureCtx: CanvasRenderingContext2D | null = null;
/**
 * Mesure de texte à la géométrie d'EXPORT (unité de dessin, police de base 34).
 * `null` côté serveur : l'appelant retombe alors sur « pas de découpage ».
 */
export function subMeasure(style: EffectiveSub): ((s: string) => number) | null {
  if (typeof document === "undefined") return null;
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  const ctx = measureCtx;
  if (!ctx) return null;
  const fontSize = SUB_BASE_FONT * style.scale;
  const font = subCanvasFont(style, fontSize);
  const ls = style.letterSpacing ? `${style.letterSpacing * fontSize}px` : "0px";
  return (s: string) => {
    // Réappliqués à chaque mesure : le contexte est partagé, un autre style a pu
    // passer entre-temps.
    ctx.font = font;
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = ls;
    return ctx.measureText(s).width;
  };
}

/** Un morceau affichable d'un sous-titre : même id, sa part du texte et du temps. */
export interface CaptionPart {
  id: string;
  index: number;   // rang du morceau (0 = le premier)
  count: number;   // nombre total de morceaux
  start: number;
  end: number;
  text: string;
}

const partsCache = new Map<string, CaptionPart[]>();

/**
 * Découpe un sous-titre en autant de morceaux qu'il faut pour qu'AUCUN ne dépasse
 * le nombre de lignes autorisé.
 *
 * Le réglage « 1 / 2 / 3 lignes » ne tenait pas ses promesses : au-delà, les mots
 * en trop étaient entassés sur la dernière ligne (aperçu comme export). Le nombre
 * de lignes est maintenant une vraie limite — le surplus devient le sous-titre
 * SUIVANT, affiché sur la fin de la fenêtre de temps d'origine, répartie au
 * prorata des mots (même règle que segmentCaptions).
 *
 * Le texte source n'est pas touché : le découpage se refait à chaque rendu, donc
 * remonter la limite à 3 lignes recolle les morceaux tout seul.
 */
export function fitCaptionParts(
  cap: { id: string; start: number; end: number; text: string },
  style: EffectiveSub,
  frameW: number,
): CaptionPart[] {
  const whole: CaptionPart[] = [{ id: cap.id, index: 0, count: 1, start: cap.start, end: cap.end, text: cap.text }];
  const words = (cap.text || "").trim().split(/\s+/).filter(Boolean);
  // Texte cintré : le rendu pose les lettres sur un arc, d'un seul tenant — le
  // découpage en lignes n'a pas de sens là.
  if (words.length < 2 || style.curve) return whole;

  const maxLines = Math.max(1, Math.round(style.maxLines || 1));
  const padX = style.padX * style.scale;
  const maxW = (style.maxWidth / 100) * frameW - padX * 2;
  if (!(maxW > 0)) return whole;

  const key = [cap.id, cap.text, cap.start, cap.end, maxLines, Math.round(maxW),
    style.scale, style.font, style.weight, style.italic, style.letterSpacing, style.caseMode].join("|");
  const hit = partsCache.get(key);
  if (hit) return hit;

  const measure = subMeasure(style);
  if (!measure) return whole;
  // On mesure la casse RÉELLEMENT affichée : « TOUT EN MAJUSCULES » est plus large.
  const shown = words.map((w) => applySubCase(w, style.caseMode));
  const lines = packLines(shown, measure, maxW);

  let out = whole;
  if (lines.length > maxLines) {
    // Un morceau = un paquet de `maxLines` lignes.
    const sizes: number[] = [];
    for (let i = 0; i < lines.length; i += maxLines) {
      sizes.push(lines.slice(i, i + maxLines).reduce((n, ln) => n + ln.length, 0));
    }
    const perWord = Math.max(0.001, cap.end - cap.start) / words.length;
    out = [];
    let i = 0;
    sizes.forEach((n, k) => {
      out.push({
        id: cap.id,
        index: k,
        count: sizes.length,
        start: cap.start + i * perWord,
        // Le dernier morceau va jusqu'au bout : pas de trou d'arrondi en fin de bloc.
        end: k === sizes.length - 1 ? cap.end : cap.start + (i + n) * perWord,
        text: words.slice(i, i + n).join(" "),
      });
      i += n;
    });
  }

  if (partsCache.size > 600) partsCache.clear();
  partsCache.set(key, out);
  return out;
}

/**
 * Lignes d'un sous-titre telles que l'export les dessinera — mots déjà mis à la
 * casse d'affichage. L'aperçu DOM les pose telles quelles au lieu de laisser le
 * navigateur replier le texte à sa façon : les retours à la ligne vus à l'écran
 * sont alors exactement ceux de la vidéo, et la limite de lignes tient à l'image
 * près malgré le léger écart de métriques entre police écran et police canvas.
 */
export function subLines(text: string, style: EffectiveSub, frameW: number): string[][] {
  const words = (text || "").trim().split(/\s+/).filter(Boolean).map((w) => applySubCase(w, style.caseMode));
  if (!words.length) return [[]];
  const measure = subMeasure(style);
  const padX = style.padX * style.scale;
  const maxW = (style.maxWidth / 100) * frameW - padX * 2;
  if (!measure || !(maxW > 0) || words.length < 2) return [words];
  return wrapWords(words, measure, maxW, style.maxLines);
}

/** Le morceau à afficher à l'instant `t` (le dernier si `t` sort de la fenêtre). */
export function captionPartAt(
  cap: { id: string; start: number; end: number; text: string },
  style: EffectiveSub,
  frameW: number,
  t: number,
): CaptionPart {
  const parts = fitCaptionParts(cap, style, frameW);
  return parts.find((p) => t >= p.start && t <= p.end) ?? (t < parts[0].start ? parts[0] : parts[parts.length - 1]);
}

/**
 * Style de départ d'un montage : « simple » — blanc net, sans fond ni pilule.
 * Ce n'était pas le cas : on prenait le PREMIER de la liste (« karaoké », pilule
 * sombre à surlignage vert), donc tout nouveau montage démarrait habillé.
 * L'ombre douce vient automatiquement quand il n'y a ni fond ni contour
 * (cf. subTextShadowCss), ce qui garde le texte lisible sur n'importe quelle image.
 */
export const DEFAULT_SUB_STYLE_ID = "simple";

/** Corps de référence des sous-titres, à l'échelle 1. Partagé avec l'export. */
export const SUB_BASE_FONT = 34;

export function subtitleBoxCss(e: EffectiveSub, unit = 1): Record<string, string | number | undefined> {
  const k = e.scale * unit;
  const fontSizePx = SUB_BASE_FONT * k;
  return {
    // Le fond n'est PAS peint ici : il vit sur son propre calque (subBgBox) pour
    // pouvoir être élargi et décalé sans déplacer le texte.
    position: "relative",
    background: "transparent",
    color: e.fg,
    fontFamily: e.font ? `'${e.font}', var(--sans)` : (e.italic ? "var(--display)" : "var(--sans)"),
    fontWeight: e.weight,
    fontStyle: e.italic ? "italic" : "normal",
    fontSize: fontSizePx,
    lineHeight: e.lineHeight,
    letterSpacing: `${e.letterSpacing}em`,
    textAlign: e.align,
    // Même largeur maximale que l'export, sinon le retour à la ligne ne tombe
    // pas au même endroit dans la vidéo rendue.
    maxWidth: `${e.maxWidth}%`,
    textDecorationLine: e.underline ? "underline" : "none",
    textTransform: "none", // la casse est appliquée sur le texte via applySubCase
    padding: `${e.padY * k}px ${e.padX * k}px`,
    borderRadius: e.pill ? 999 : e.radius * k,
    WebkitTextStroke: e.stroke && e.strokeW > 0 ? `${e.strokeW * k}px ${e.stroke}` : undefined,
    paintOrder: "stroke fill",
    textShadow: subTextShadowCss(e, k),
    opacity: e.opacity,
  };
}

// Modèles de sous-titres enregistrés par l'utilisateur (persistés en localStorage, partagés
// entre le monteur et la page Modèles).
export interface SubTemplate {
  id: string;
  name: string;
  styleId: string;
  custom: SubCustom;
  maxWords: number;
  pos: { x: number; y: number };
}
const SUB_TPL_KEY = "klip-sub-templates";
export function loadSubTemplates(): SubTemplate[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SUB_TPL_KEY) || "[]"); } catch { return []; }
}
export function saveSubTemplates(list: SubTemplate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUB_TPL_KEY, JSON.stringify(list));
}

// Présets colorimétriques. `css` = filtre CSS standard, honoré à l'identique dans
// l'aperçu (style.filter) ET à l'export (canvas ctx.filter) — ne PAS utiliser de
// fonctions non supportées par canvas (rester sur brightness/contrast/saturate/
// sepia/hue-rotate/grayscale/invert/blur). Tout ajout ici se propage partout.
export const FILTERS: { id: string; name: string; css: string }[] = [
  { id: "none", name: "Aucun", css: "none" },
  { id: "chaud", name: "Chaud", css: "saturate(1.15) sepia(.12) contrast(1.04)" },
  { id: "doux", name: "Doux", css: "saturate(.92) brightness(1.05) contrast(.96)" },
  { id: "froid", name: "Froid", css: "saturate(1.05) hue-rotate(-8deg) brightness(1.02)" },
  { id: "argent", name: "Argentique", css: "sepia(.28) saturate(1.1) contrast(1.08)" },
  { id: "nb", name: "N&B", css: "grayscale(1) contrast(1.1)" },
  { id: "vif", name: "Vif", css: "saturate(1.35) contrast(1.1)" },
  { id: "cinema", name: "Ciné", css: "contrast(1.12) saturate(1.05) sepia(.08) brightness(.98)" },
  { id: "vintage", name: "Vintage", css: "sepia(.4) saturate(1.2) contrast(1.05) brightness(1.02)" },
  { id: "pastel", name: "Pastel", css: "saturate(.8) brightness(1.08) contrast(.92)" },
  { id: "noir-intense", name: "Noir intense", css: "grayscale(1) contrast(1.35) brightness(.95)" },
  { id: "nuit", name: "Nuit", css: "saturate(1.1) hue-rotate(-14deg) brightness(.92) contrast(1.06)" },
  { id: "dore", name: "Doré", css: "sepia(.28) saturate(1.25) brightness(1.05) hue-rotate(-6deg)" },
];

export const TRANSITIONS: { id: string; name: string; glyph: string }[] = [
  { id: "cut", name: "Cut", glyph: "▮▮" },
  // — Fondus —
  { id: "fade", name: "Fondu", glyph: "◐" },
  { id: "fadeblack", name: "Fondu au noir", glyph: "◼" },
  { id: "flash", name: "Flash", glyph: "✦" },
  // — Glissés —
  { id: "slide", name: "Glissé", glyph: "⇥" },
  { id: "slideright", name: "Glissé droite", glyph: "⇤" },
  { id: "slideup", name: "Glissé haut", glyph: "⇧" },
  { id: "slidedown", name: "Glissé bas", glyph: "⇩" },
  // — Zooms —
  { id: "zoom", name: "Zoom avant", glyph: "⊕" },
  { id: "zoomout", name: "Zoom arrière", glyph: "⊖" },
  { id: "bounce", name: "Rebond", glyph: "◎" },
  // — Balayages —
  { id: "wipe", name: "Balayage", glyph: "◑" },
  { id: "wiperight", name: "Balayage ←", glyph: "◐" },
  { id: "wipeup", name: "Balayage ↑", glyph: "◒" },
  { id: "wipedown", name: "Balayage ↓", glyph: "◓" },
  { id: "iris", name: "Iris", glyph: "◉" },
  // — Dynamiques —
  { id: "spin", name: "Rotation", glyph: "↻" },
  { id: "swirl", name: "Tourbillon", glyph: "✺" },
  { id: "blur", name: "Flou", glyph: "◌" },
  { id: "whip", name: "Whip", glyph: "⤳" },
  { id: "shake", name: "Secousse", glyph: "≋" },
  { id: "glitch", name: "Glitch", glyph: "⌁" },
];

export const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

export interface SubStyle {
  id: string;
  name: string;
  sub: string;
  bg: string;          // fond de la boîte ("transparent" = texte nu)
  fg: string;          // couleur du texte
  hi: string;          // couleur du mot actif (surlignage karaoké)
  weight: number;      // graisse
  italic: boolean;
  pill: boolean;       // coins arrondis pleins (pilule) vs bandeau léger
  uppercase?: boolean; // MAJUSCULES
  stroke?: string;     // couleur du contour (outline autour du texte)
  font?: string;       // fontFamily CSS (défaut : Satoshi / Archivo si italic)
}

// Bibliothèque de styles de sous-titres façon CapCut — large variété (couleur, contour,
// pilule, majuscules, polices). Le rendu (aperçu + export) honore tous ces champs.
export const SUB_STYLES: SubStyle[] = [
  // — Défaut minimaliste (aucun template de marque) : texte blanc net, sans fond,
  //   avec une ombre portée douce → lisible sur n'importe quel fond. —
  { id: "simple",    name: "Simple",     sub: "Texte net",        bg: "transparent",         fg: "#FFFFFF", hi: "#FFFFFF", weight: 700, italic: false, pill: false },
  // — Essentiels —
  { id: "karaoke",   name: "Karaoké",    sub: "Mot par mot",      bg: "#0C2A1D",             fg: "#EEEDE3", hi: "#BDF2A0", weight: 800, italic: false, pill: true },
  { id: "editorial", name: "Éditorial",  sub: "Archivo italique", bg: "transparent",         fg: "#FFFFFF", hi: "#2FD79B", weight: 800, italic: true,  pill: false },
  { id: "clean",     name: "Net",        sub: "Bandeau blanc",    bg: "#FFFFFF",             fg: "#14160F", hi: "#1F7A4D", weight: 700, italic: false, pill: false },
  { id: "mint",      name: "Menthe",     sub: "Accent KLIP",      bg: "rgba(47,215,155,.92)",fg: "#06281C", hi: "#0C2A1D", weight: 800, italic: false, pill: true },
  // — Contour (outline) —
  { id: "bold-white",name: "Punch",      sub: "Contour noir",     bg: "transparent",         fg: "#FFFFFF", hi: "#FFE14D", weight: 900, italic: false, pill: false, uppercase: true, stroke: "#000000" },
  { id: "bold-yellow",name: "TikTok",    sub: "Jaune contour",    bg: "transparent",         fg: "#FFE14D", hi: "#FFFFFF", weight: 900, italic: false, pill: false, uppercase: true, stroke: "#000000" },
  { id: "bold-mint", name: "Néon menthe",sub: "Contour foncé",    bg: "transparent",         fg: "#2FD79B", hi: "#FFFFFF", weight: 900, italic: false, pill: false, uppercase: true, stroke: "#06281C" },
  { id: "bold-pink", name: "Bubblegum",  sub: "Rose contour",     bg: "transparent",         fg: "#FF5DA2", hi: "#FFFFFF", weight: 900, italic: false, pill: false, uppercase: true, stroke: "#2A0A1B" },
  { id: "bold-blue", name: "Électrique", sub: "Bleu contour",     bg: "transparent",         fg: "#4DA2FF", hi: "#FFFFFF", weight: 900, italic: false, pill: false, uppercase: true, stroke: "#08203A" },
  // — Pilules colorées —
  { id: "pill-black",name: "Pilule noire",sub: "Fond sombre",     bg: "rgba(12,14,10,.9)",   fg: "#FFFFFF", hi: "#BDF2A0", weight: 800, italic: false, pill: true },
  { id: "pill-acid", name: "Acide",      sub: "Pilule citron",    bg: "#BDF2A0",             fg: "#14160F", hi: "#0C2A1D", weight: 800, italic: false, pill: true, uppercase: true },
  { id: "pill-coral",name: "Corail",     sub: "Pilule chaude",    bg: "#FF6B4A",             fg: "#2A0A03", hi: "#FFFFFF", weight: 800, italic: false, pill: true },
  { id: "pill-violet",name: "Violet",    sub: "Pilule mauve",     bg: "#7C5CFF",             fg: "#FFFFFF", hi: "#FFE14D", weight: 800, italic: false, pill: true },
  { id: "pill-forest",name: "Forêt",     sub: "Pilule verte",     bg: "#103A28",             fg: "#EEEDE3", hi: "#2FD79B", weight: 800, italic: false, pill: true },
  // — Bandeaux pleins —
  { id: "band-black",name: "Bandeau noir",sub: "Bloc sombre",     bg: "#14160F",             fg: "#FFFFFF", hi: "#BDF2A0", weight: 700, italic: false, pill: false },
  { id: "band-cream",name: "Crème",      sub: "Bloc clair",       bg: "#F1F0E8",             fg: "#14160F", hi: "#21B381", weight: 700, italic: false, pill: false },
  { id: "band-red",  name: "Alerte",     sub: "Bloc rouge",       bg: "#E0332E",             fg: "#FFFFFF", hi: "#FFE14D", weight: 800, italic: false, pill: false, uppercase: true },
  // — Élégants / éditoriaux —
  { id: "serif-white",name: "Magazine",  sub: "Serif italique",   bg: "transparent",         fg: "#FFFFFF", hi: "#BDF2A0", weight: 400, italic: true,  pill: false, font: "'Instrument Serif', serif" },
  { id: "serif-cream",name: "Vintage",   sub: "Serif crème",      bg: "transparent",         fg: "#F1E9D2", hi: "#E8B14C", weight: 400, italic: true,  pill: false, font: "'Instrument Serif', serif", stroke: "#3A2A10" },
  { id: "mono-tech", name: "Terminal",   sub: "Mono tech",        bg: "rgba(6,20,14,.86)",   fg: "#2FD79B", hi: "#BDF2A0", weight: 600, italic: false, pill: false, font: "var(--mono)" },
  // — Fun / gras —
  { id: "sunset",    name: "Sunset",     sub: "Orange contour",   bg: "transparent",         fg: "#FFB347", hi: "#FFFFFF", weight: 900, italic: false, pill: false, uppercase: true, stroke: "#3A1A00" },
  { id: "ocean",     name: "Océan",      sub: "Cyan contour",     bg: "transparent",         fg: "#3FE0E0", hi: "#FFFFFF", weight: 900, italic: false, pill: false, uppercase: true, stroke: "#052A2A" },
  { id: "gold",      name: "Or",         sub: "Doré luxe",        bg: "transparent",         fg: "#E8B14C", hi: "#FFFFFF", weight: 800, italic: false, pill: false, uppercase: true, stroke: "#2A1C00" },
  { id: "candy",     name: "Bonbon",     sub: "Pilule rose",      bg: "#FF5DA2",             fg: "#FFFFFF", hi: "#FFE14D", weight: 800, italic: false, pill: true, uppercase: true },
];

export function subStyleById(id: string): SubStyle {
  return SUB_STYLES.find((s) => s.id === id) || SUB_STYLES[0];
}

// Options de longueur de sous-titre (mots max par bloc) proposées à l'utilisateur.
export const SUB_LENGTHS: { words: number; label: string }[] = [
  { words: 1, label: "1 mot" },
  { words: 2, label: "2 mots" },
  { words: 3, label: "3 mots" },
  { words: 4, label: "4 mots" },
  { words: 6, label: "6 mots" },
  { words: 99, label: "Phrase" },
];

export const STICKER_GLYPHS = [
  "✦", "↗", "🌿", "☕", "◆", "✿", "→", "★", "✷", "∴", "❋", "●",
  "🔥", "💧", "⚡", "✨", "💯", "👀", "👍", "🙌", "❤️", "😮", "😂", "🥳",
  "🎉", "🎬", "📸", "🎵", "🛒", "🏷️", "💸", "⏰", "📍", "✅", "❌", "❓",
  "➡️", "⬆️", "⬇️", "🔗", "💬", "🤯", "😍", "🤔", "👇", "☝️", "🌟", "🚀",
];

/* `css` sert au DOM, `canvas` au rendu de la vidéo. Le canvas ne sait pas lire
   une variable CSS : `var(--display)` y était silencieusement ignoré et l'export
   dessinait les titres dans la police par défaut du système, pas dans celle
   qu'on voyait dans le monteur. */
export const FONT_CHOICES: { id: TitleEl["font"]; name: string; sub: string; css: string; canvas: string; weight: number; italic: boolean }[] = [
  { id: "archivo", name: "Archivo", sub: "Display", css: "var(--display)", canvas: "'Archivo', system-ui, sans-serif", weight: 800, italic: true },
  { id: "instrument", name: "Instrument", sub: "Serif", css: "'Instrument Serif', serif", canvas: "'Instrument Serif', Georgia, serif", weight: 400, italic: true },
  { id: "satoshi", name: "Satoshi", sub: "Sans", css: "var(--sans)", canvas: "'early-sans-variable', system-ui, sans-serif", weight: 700, italic: false },
];

export function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.round((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, "0")}.${cs}`;
}

export function fmtShort(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function newClipDefaults(): Pick<MontageClip, "speed" | "filterId" | "lum" | "con" | "sat" | "transitionIn" | "transitionDur" | "vol"> {
  return { speed: 1, filterId: "none", lum: 0, con: 0, sat: 0, transitionIn: "cut", transitionDur: 0.4, vol: 1 };
}

// Redécoupe des segments Whisper en sous-titres courts façon CapCut : le temps de chaque
// segment est réparti proportionnellement au nombre de mots, ce qui donne des sous-titres
// qui s'enchaînent au rythme de la parole. `maxWords` = longueur choisie par l'utilisateur.
export const DEFAULT_WORDS_PER_CAPTION = 2;
export function segmentCaptions(
  segments: { start: number; end: number; text: string }[],
  maxWords: number = DEFAULT_WORDS_PER_CAPTION,
): { id: string; start: number; end: number; text: string }[] {
  const step = Math.max(1, Math.floor(maxWords));
  const out: { id: string; start: number; end: number; text: string }[] = [];
  for (const seg of segments) {
    const words = (seg.text || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const segDur = Math.max(0.001, seg.end - seg.start);
    const perWord = segDur / words.length;
    for (let i = 0; i < words.length; i += step) {
      const chunk = words.slice(i, i + step);
      const start = seg.start + i * perWord;
      const end = seg.start + Math.min(words.length, i + chunk.length) * perWord;
      out.push({ id: crypto.randomUUID(), start, end, text: chunk.join(" ") });
    }
  }
  return out;
}

// Repli sans mots horodatés : un segment Whisper à cheval sur une coupe de montage
// ressort une fois par morceau conservé, avec le texte ENTIER à chaque fois. On ne
// garde que l'occurrence la plus longue — sinon la même phrase s'affiche deux fois.
export function dedupeSegments(
  segments: { start: number; end: number; text: string }[],
): { start: number; end: number; text: string }[] {
  const best = new Map<string, { start: number; end: number; text: string }>();
  for (const s of segments) {
    const key = s.text.trim().toLowerCase();
    if (!key) continue;
    const cur = best.get(key);
    if (!cur || s.end - s.start > cur.end - cur.start) best.set(key, s);
  }
  return Array.from(best.values()).sort((a, b) => a.start - b.start);
}

// Découpe des sous-titres à partir des mots HORODATÉS — la voie normale.
// `segmentCaptions` ci-dessus étale le temps d'un segment Whisper proportionnellement
// au nombre de mots : une respiration ou un silence d'effet au milieu d'une phrase
// suffisait à décaler l'affichage de plusieurs secondes. Ici chaque sous-titre prend
// le début du premier mot et la fin du dernier — le texte tombe donc exactement quand
// il est prononcé.
// Les mots reçus sont déjà exprimés en temps de TIMELINE (voir generateCaptionsAI).
export function captionsFromWords(
  words: { start: number; end: number; word: string }[],
  maxWords: number = DEFAULT_WORDS_PER_CAPTION,
  // Un blanc supérieur à ce seuil termine le sous-titre en cours : on ne garde pas
  // un texte à l'écran pendant un silence, et on ne recolle pas deux phrases séparées
  // par une coupe de montage.
  gapBreak = 0.7,
  // Contrainte de PLACE, facultative. Sans elle, le découpage ne connaît que le
  // nombre de mots et un bloc trop large passe à la ligne — le réglage « 1 ligne »
  // ne contraignait alors rien. Avec elle, un mot qui ne rentre plus dans le
  // budget de lignes ouvre le sous-titre suivant.
  fits?: (text: string) => boolean,
): { id: string; start: number; end: number; text: string }[] {
  const step = Math.max(1, Math.floor(maxWords));
  const out: { id: string; start: number; end: number; text: string }[] = [];
  const src = words
    .filter((w) => w && w.word && isFinite(w.start) && isFinite(w.end) && w.end > w.start)
    .sort((a, b) => a.start - b.start);
  let group: { start: number; end: number; word: string }[] = [];
  const flush = () => {
    if (!group.length) return;
    out.push({
      id: crypto.randomUUID(),
      start: group[0].start,
      end: Math.max(group[group.length - 1].end, group[0].start + 0.12), // durée minimale lisible
      text: group.map((w) => w.word).join(" "),
    });
    group = [];
  };
  for (const w of src) {
    const prev = group[group.length - 1];
    if (prev && w.start - prev.end > gapBreak) flush();
    if (fits && group.length) {
      const cand = [...group.map((g) => g.word), w.word].join(" ");
      if (!fits(cand)) flush();
    }
    group.push(w);
    if (group.length >= step) flush();
  }
  flush();
  return out;
}

export function filterCssOf(filterId: string, lum: number, con: number, sat: number): string {
  const preset = FILTERS.find((f) => f.id === filterId)?.css ?? "none";
  const adjust = `brightness(${1 + lum / 100}) contrast(${1 + con / 100}) saturate(${1 + sat / 100})`;
  return preset === "none" ? adjust : `${preset} ${adjust}`;
}
export function clipFilterCss(c: MontageClip): string {
  return filterCssOf(c.filterId, c.lum, c.con, c.sat);
}
export function overlayFilterCss(o: OverlayClip): string {
  return filterCssOf(o.filterId, o.lum, o.con, o.sat);
}

// ─── Templates de sous-titres dérivés de la charte du client ────────────────
// Plutôt que d'imposer la liste générique SUB_STYLES, on propose des styles
// construits À PARTIR des couleurs et de la police déjà choisies pour la marque.
// Utilisé par l'assistant « nouveau client » (étape Templates, une fois les
// couleurs ET la typographie renseignées) et réutilisable ailleurs.

// Luminance relative (WCAG) — sert à poser un texte lisible sur un fond donné.
export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return lum > 0.45 ? "#14160F" : "#FFFFFF";
}

export interface CharterPreset {
  id: string;          // clé i18n courte (charterPresetName.<id>)
  styleId: string;     // style SUB_STYLES servant de base
  custom: SubCustom;   // surcharges issues de la charte
}

export interface CharterBrand {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  font?: string | null;   // famille de police choisie à l'étape Typographie
}

// Renvoie une petite sélection de templates cohérents avec la charte.
export function charterSubPresets(brand: CharterBrand): CharterPreset[] {
  const accent = brand.accent || "#BDF2A0";
  const primary = brand.primary || "#0C2A1D";
  const font = brand.font || undefined;
  const f = font ? { font } : {};
  return [
    // Texte net, mot surligné à la couleur d'accent — le plus polyvalent.
    { id: "charte",   styleId: "simple",     custom: { ...f, fg: "#FFFFFF", hi: accent, bg: "transparent", weight: 800 } },
    // Contour noir façon TikTok/Reels, accent sur le mot actif.
    { id: "contour",  styleId: "bold-white", custom: { ...f, fg: "#FFFFFF", hi: accent, stroke: "#000000", uppercase: true } },
    // Pilule pleine à la couleur d'accent.
    { id: "pilule",   styleId: "pill-black", custom: { ...f, bg: accent, fg: readableOn(accent), hi: primary, pill: true } },
    // Bandeau à la couleur principale de la marque.
    { id: "bandeau",  styleId: "band-black", custom: { ...f, bg: primary, fg: readableOn(primary), hi: accent } },
    // Sobre : blanc pur, sans surlignage coloré.
    { id: "sobre",    styleId: "simple",     custom: { ...f, fg: "#FFFFFF", hi: "#FFFFFF", bg: "transparent", weight: 700 } },
  ];
}

// ─── Style effectif d'UN sous-titre ─────────────────────────────────────────
// SOURCE UNIQUE partagée par l'aperçu et l'export : les deux doivent résoudre
// le style exactement pareil, sinon la vidéo exportée ne montre pas ce qu'on a
// réglé à l'écran.
//
// Règle : une surcharge posée sur un sous-titre l'emporte TOUJOURS, même quand
// les sous-titres sont liés — c'est ce qui permet de régler un lot sélectionné
// sans délier tout le montage. En mode lié, la surcharge se pose par-dessus le
// style commun (on ne change que ce qu'on a réglé) ; en mode délié, chaque
// sous-titre est autonome.
export function capHasOwnStyle(c: Caption): boolean {
  return !!c.styleId || !!(c.custom && Object.keys(c.custom).length);
}

export function resolveCapStyle(
  c: Caption, subStyleId: string, subCustom: SubCustom | undefined, linkedSubs: boolean,
) {
  if (linkedSubs && !capHasOwnStyle(c)) return effectiveSubStyle(subStyleId, subCustom);
  const custom = linkedSubs ? { ...(subCustom ?? {}), ...(c.custom ?? {}) } : (c.custom ?? {});
  return effectiveSubStyle(c.styleId ?? subStyleId, custom);
}

export function resolveCapPos(c: Caption, subPos: { x: number; y: number } | undefined) {
  const base = subPos ?? DEFAULT_SUB_POS;
  // Une position propre prime, quel que soit le mode.
  if (c.x != null || c.y != null) return { x: c.x ?? base.x, y: c.y ?? base.y };
  return base;
}

// ─── État d'une transition d'entrée ─────────────────────────────────────────
// SOURCE UNIQUE partagée par l'aperçu (DOM/CSS) et l'export (canvas 2D).
// Les décalages et découpes sont exprimés en FRACTIONS du cadre (0-1) pour être
// indépendants de la résolution : l'export multiplie par la taille du canvas,
// l'aperçu les convertit en % / clip-path.
export interface TransitionState {
  alpha: number;
  dx: number;        // fraction de la largeur
  dy: number;        // fraction de la hauteur
  scale: number;
  rotate: number;    // degrés
  flash: number;     // voile blanc 0-1
  dark: number;      // voile noir 0-1
  extraFilter: string;
  clipRect: [number, number, number, number] | null; // x,y,w,h en fractions
  clipCircle: [number, number, number] | null;       // cx,cy,r en fractions (r = /diagonale)
}

export function transitionStateAt(
  transitionIn: string | undefined,
  transitionDur: number,
  tIntoClip: number,
  isFirst: boolean,
): TransitionState {
  const st: TransitionState = {
    alpha: 1, dx: 0, dy: 0, scale: 1, rotate: 0, flash: 0, dark: 0,
    extraFilter: "", clipRect: null, clipCircle: null,
  };
  if (isFirst || !transitionIn || transitionIn === "cut" || transitionDur <= 0 || tIntoClip >= transitionDur) return st;
  const p = Math.max(0, Math.min(1, tIntoClip / transitionDur));
  const ease = 1 - Math.pow(1 - p, 2);
  switch (transitionIn) {
    case "fade": st.alpha = ease; break;
    case "fadeblack": st.dark = 1 - ease; st.alpha = Math.min(1, 0.35 + ease); break;
    case "flash": st.flash = 1 - ease; st.alpha = Math.min(1, 0.4 + ease); break;
    case "zoom": st.scale = 1.18 - 0.18 * ease; st.alpha = 0.2 + 0.8 * ease; break;
    case "zoomout": st.scale = 0.82 + 0.18 * ease; st.alpha = 0.3 + 0.7 * ease; break;
    case "bounce": {
      const o = Math.sin(p * Math.PI) * 0.12;
      st.scale = 0.86 + 0.14 * ease + o; st.alpha = Math.min(1, 0.3 + 1.2 * ease);
      break;
    }
    case "slide": st.dx = (1 - ease) * 0.5; st.alpha = 0.3 + 0.7 * ease; break;
    case "slideright": st.dx = -(1 - ease) * 0.5; st.alpha = 0.3 + 0.7 * ease; break;
    case "slideup": st.dy = (1 - ease) * 0.4; st.alpha = 0.3 + 0.7 * ease; break;
    case "slidedown": st.dy = -(1 - ease) * 0.4; st.alpha = 0.3 + 0.7 * ease; break;
    case "spin": st.rotate = (1 - ease) * 22; st.scale = 0.85 + 0.15 * ease; st.alpha = ease; break;
    case "swirl": st.rotate = (1 - ease) * 75; st.scale = 0.7 + 0.3 * ease; st.alpha = ease; break;
    case "wipe": st.clipRect = [0, 0, ease, 1]; break;
    case "wiperight": st.clipRect = [1 - ease, 0, ease, 1]; break;
    case "wipedown": st.clipRect = [0, 0, 1, ease]; break;
    case "wipeup": st.clipRect = [0, 1 - ease, 1, ease]; break;
    case "iris": st.clipCircle = [0.5, 0.5, 0.5 * ease]; break;
    case "blur": st.extraFilter = `blur(${(1 - ease) * 14}px)`; st.alpha = 0.5 + 0.5 * ease; break;
    case "whip": st.dx = (1 - ease) * 0.6; st.extraFilter = `blur(${(1 - ease) * 12}px)`; st.alpha = 0.4 + 0.6 * ease; break;
    case "shake": {
      const amp = (1 - ease) * 0.036;
      st.dx = Math.sin(p * Math.PI * 7) * amp;
      st.dy = Math.cos(p * Math.PI * 5) * amp * 0.5;
      st.alpha = Math.min(1, 0.5 + ease);
      break;
    }
    case "glitch": {
      const amp = (1 - ease) * 0.047;
      // pseudo-aléatoire déterministe : même rendu en aperçu et à l'export
      const r1 = Math.sin(tIntoClip * 977.1) * 43758.5453;
      const r2 = Math.sin(tIntoClip * 311.7) * 24634.6345;
      const rnd = (v: number) => v - Math.floor(v);
      st.dx = (rnd(r1) - 0.5) * amp;
      st.dy = (rnd(r2) - 0.5) * amp * 0.4;
      st.extraFilter = `saturate(${1 + (1 - ease) * 2.2}) hue-rotate(${(1 - ease) * 25}deg)`;
      st.flash = (1 - ease) * (rnd(r1) > 0.65 ? 0.55 : 0);
      st.alpha = Math.min(1, 0.55 + ease);
      break;
    }
  }
  return st;
}

// Traduit un état de transition en styles CSS pour l'aperçu DOM.
export function transitionCss(st: TransitionState): Record<string, string | number | undefined> {
  const parts: string[] = [];
  if (st.dx || st.dy) parts.push(`translate(${st.dx * 100}%, ${st.dy * 100}%)`);
  if (st.rotate) parts.push(`rotate(${st.rotate}deg)`);
  if (st.scale !== 1) parts.push(`scale(${st.scale})`);
  let clipPath: string | undefined;
  if (st.clipRect) {
    const [x, y, w, h] = st.clipRect;
    clipPath = `inset(${y * 100}% ${(1 - x - w) * 100}% ${(1 - y - h) * 100}% ${x * 100}%)`;
  } else if (st.clipCircle) {
    const [cx, cy, r] = st.clipCircle;
    clipPath = `circle(${r * 100}% at ${cx * 100}% ${cy * 100}%)`;
  }
  return {
    opacity: st.alpha,
    transform: parts.length ? parts.join(" ") : undefined,
    clipPath,
  };
}
