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
  vol?: number;          // volume du son embarqué du plan vidéo (0-1, défaut 1)
}

// Durée effective d'un clip sur la timeline (après rognage + vitesse)
export function clipTimelineDur(c: MontageClip): number {
  const raw = Math.max(0, c.trimEnd - c.trimStart);
  return c.kind === "video" ? raw / c.speed : raw;
}

export interface Caption {
  id: string;
  start: number;
  end: number;
  text: string;
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
}

export interface AudioTrack {
  id: string;
  kind: "music" | "voiceover";
  name: string;
  src: string;
  dur: number;
  vol: number; // 0-1
  offset: number; // décalage de départ sur la timeline (s)
}

export interface MontageProject {
  clips: MontageClip[];
  captions: Caption[];
  subStyleId: string;
  titles: TitleEl[];
  stickers: StickerEl[];
  audioTracks: AudioTrack[];
  showProgressBar: boolean;
  exportUrl?: string | null;
}

export const FILTERS: { id: string; name: string; css: string }[] = [
  { id: "none", name: "Aucun", css: "none" },
  { id: "chaud", name: "Chaud", css: "saturate(1.15) sepia(.12) contrast(1.04)" },
  { id: "doux", name: "Doux", css: "saturate(.92) brightness(1.05) contrast(.96)" },
  { id: "froid", name: "Froid", css: "saturate(1.05) hue-rotate(-8deg) brightness(1.02)" },
  { id: "argent", name: "Argentique", css: "sepia(.28) saturate(1.1) contrast(1.08)" },
  { id: "nb", name: "N&B", css: "grayscale(1) contrast(1.1)" },
];

export const TRANSITIONS: { id: string; name: string; glyph: string }[] = [
  { id: "cut", name: "Cut", glyph: "▮▮" },
  { id: "fade", name: "Fondu", glyph: "◐" },
  { id: "slide", name: "Glissé", glyph: "⇥" },
  { id: "zoom", name: "Zoom", glyph: "⊕" },
  { id: "wipe", name: "Balayage", glyph: "◑" },
  { id: "blur", name: "Flou", glyph: "◌" },
];

export const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

export const SUB_STYLES: {
  id: string; name: string; sub: string; bg: string; fg: string; hi: string; weight: number; italic: boolean; pill: boolean;
}[] = [
  { id: "karaoke", name: "Karaoké", sub: "Mot par mot", bg: "#0C2A1D", fg: "#EEEDE3", hi: "#C8F135", weight: 800, italic: false, pill: true },
  { id: "editorial", name: "Éditorial", sub: "Archivo italique", bg: "transparent", fg: "#FFFFFF", hi: "#2FD79B", weight: 800, italic: true, pill: false },
  { id: "clean", name: "Net", sub: "Bandeau plein", bg: "#FFFFFF", fg: "#14160F", hi: "#1F7A4D", weight: 700, italic: false, pill: false },
  { id: "mint", name: "Menthe", sub: "Accent KLIP", bg: "rgba(47,215,155,.92)", fg: "#06281C", hi: "#0C2A1D", weight: 800, italic: false, pill: true },
];

export const STICKER_GLYPHS = ["✦", "↗", "🌿", "☕", "◆", "✿", "→", "★", "✷", "∴", "❋", "●"];

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

// Redécoupe des segments Whisper en sous-titres courts (max 3-4 mots) façon CapCut :
// le temps de chaque segment est réparti proportionnellement au nombre de mots, ce
// qui donne des sous-titres qui s'enchaînent au rythme de la parole.
const MAX_WORDS_PER_CAPTION = 4;
export function segmentCaptions(
  segments: { start: number; end: number; text: string }[],
): { id: string; start: number; end: number; text: string }[] {
  const out: { id: string; start: number; end: number; text: string }[] = [];
  for (const seg of segments) {
    const words = (seg.text || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const segDur = Math.max(0.001, seg.end - seg.start);
    const perWord = segDur / words.length;
    for (let i = 0; i < words.length; i += MAX_WORDS_PER_CAPTION) {
      const chunk = words.slice(i, i + MAX_WORDS_PER_CAPTION);
      const start = seg.start + i * perWord;
      const end = seg.start + Math.min(words.length, i + chunk.length) * perWord;
      out.push({ id: crypto.randomUUID(), start, end, text: chunk.join(" ") });
    }
  }
  return out;
}

export function clipFilterCss(c: MontageClip): string {
  const preset = FILTERS.find((f) => f.id === c.filterId)?.css ?? "none";
  const adjust = `brightness(${1 + c.lum / 100}) contrast(${1 + c.con / 100}) saturate(${1 + c.sat / 100})`;
  return preset === "none" ? adjust : `${preset} ${adjust}`;
}
