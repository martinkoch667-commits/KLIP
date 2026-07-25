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
  const fi = c.audioFadeIn ?? 0, fo = c.audioFadeOut ?? 0;
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
}

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
}

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
  fadeIn?: number;  // durée du fondu d'entrée (s), défaut 0
  fadeOut?: number; // durée du fondu de sortie (s), défaut 0
  volKeys?: { t: number; v: number }[]; // points-clés de volume (automation) : t = temps local dans la piste (s), v = volume (0-2). Remplace `vol` quand présent.
  waveform?: number[]; // pics d'amplitude normalisés (0-1), échantillonnés à l'import — pour l'affichage visuel dans la timeline
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
export interface SubCustom {
  fg?: string;
  hi?: string;
  bg?: string;
  stroke?: string;
  font?: string;
  weight?: number;
  italic?: boolean;
  uppercase?: boolean;
  pill?: boolean;
  scale?: number; // facteur de taille (défaut 1)
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
  titles: TitleEl[];
  stickers: StickerEl[];
  audioTracks: AudioTrack[];
  showProgressBar: boolean;
  exportUrl?: string | null;
  formatId?: string;    // VIDEO_FORMATS[].id, ou "custom" — défaut "story" (9:16) si absent (anciens projets)
  customW?: number;     // largeur px si formatId === "custom"
  customH?: number;     // hauteur px si formatId === "custom"
  exportQuality?: string; // EXPORT_QUALITIES[].id — défaut "standard" si absent
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
export function effectiveSubStyle(styleId: string, custom?: SubCustom): SubStyle & { scale: number } {
  const base = subStyleById(styleId);
  return {
    ...base,
    fg: custom?.fg ?? base.fg,
    hi: custom?.hi ?? base.hi,
    bg: custom?.bg ?? base.bg,
    stroke: custom?.stroke ?? base.stroke,
    font: custom?.font ?? base.font,
    weight: custom?.weight ?? base.weight,
    italic: custom?.italic ?? base.italic,
    uppercase: custom?.uppercase ?? base.uppercase,
    pill: custom?.pill ?? base.pill,
    scale: custom?.scale ?? 1,
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
  { id: "fade", name: "Fondu", glyph: "◐" },
  { id: "slide", name: "Glissé", glyph: "⇥" },
  { id: "slideup", name: "Glissé haut", glyph: "⇧" },
  { id: "slidedown", name: "Glissé bas", glyph: "⇩" },
  { id: "zoom", name: "Zoom avant", glyph: "⊕" },
  { id: "zoomout", name: "Zoom arrière", glyph: "⊖" },
  { id: "spin", name: "Rotation", glyph: "↻" },
  { id: "wipe", name: "Balayage", glyph: "◑" },
  { id: "blur", name: "Flou", glyph: "◌" },
  { id: "whip", name: "Whip", glyph: "⤳" },
  { id: "flash", name: "Flash", glyph: "✦" },
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

export const FONT_CHOICES: { id: TitleEl["font"]; name: string; sub: string; css: string; weight: number; italic: boolean }[] = [
  { id: "archivo", name: "Archivo", sub: "Display", css: "var(--display)", weight: 800, italic: true },
  { id: "instrument", name: "Instrument", sub: "Serif", css: "'Instrument Serif', serif", weight: 400, italic: true },
  { id: "satoshi", name: "Satoshi", sub: "Sans", css: "var(--sans)", weight: 700, italic: false },
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
