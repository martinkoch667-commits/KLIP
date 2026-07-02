/* data.jsx — KLIP Montage vidéo : données fictives partagées par les 2 directions.
   Un Reel 9:16 pour Maison Lou (carte d'automne). Clips, sous-titres, musique,
   styles, filtres, transitions. */

const PROJECT = {
  client: 'Maison Lou',
  handle: '@maisonlou',
  initials: 'ML',
  color: '#1F7A4D',
  doc: 'Reel · Carte d’automne',
  ratio: '9:16',
  duration: 24.5, // s
};

/* ── clips de la séquence (bout à bout sur la piste vidéo) ───────── */
const CLIPS = [
  { id: 'c1', kind: 'video', name: 'terrasse-soir.mp4',   dur: 6.2,  grad: 'linear-gradient(150deg,#2b8d57,#0c2a1d)', filter: 'Chaud',  speed: 1,   label: 'Terrasse' },
  { id: 'c2', kind: 'video', name: 'courges-cuisine.mp4', dur: 5.4,  grad: 'linear-gradient(150deg,#d99a4a,#5e3a14)', filter: 'Aucun',  speed: 1,   label: 'Cuisine' },
  { id: 'c3', kind: 'photo', name: 'assiette-automne.jpg', dur: 3.0, grad: 'linear-gradient(150deg,#c4683a,#3a1c0e)', filter: 'Doux',   speed: 1,   label: 'Assiette' },
  { id: 'c4', kind: 'video', name: 'service-salle.mp4',   dur: 5.9,  grad: 'linear-gradient(150deg,#3a6b48,#16261b)', filter: 'Aucun',  speed: 0.5, label: 'Salle' },
  { id: 'c5', kind: 'video', name: 'logo-fin.mp4',        dur: 4.0,  grad: 'linear-gradient(150deg,#0E2F20,#0A1812)', filter: 'Aucun',  speed: 1,   label: 'Logo' },
];

/* ── sous-titres auto (transcription IA, éditables) ──────────────── */
const SUBS = [
  { id: 's1', start: 0.4,  end: 3.2,  text: 'On vient d’ouvrir les réservations de septembre.' },
  { id: 's2', start: 3.4,  end: 6.0,  text: 'Et la nouvelle carte d’automne arrive en cuisine.' },
  { id: 's3', start: 6.4,  end: 9.6,  text: 'Les premières courges, le gibier, les poires rôties.' },
  { id: 's4', start: 9.9,  end: 12.6, text: 'Chaque assiette pensée pour la saison qui change.' },
  { id: 's5', start: 13.0, end: 16.2, text: 'On garde une table pour vous, en salle ou en terrasse.' },
  { id: 's6', start: 16.6, end: 20.0, text: 'Réservez en ligne — le lien est dans la bio.' },
  { id: 's7', start: 20.4, end: 24.0, text: 'Maison Lou. La saison se réserve maintenant.' },
];

/* ── pistes texte / titres ───────────────────────────────────────── */
const TITLES = [
  { id: 't1', start: 0.5,  end: 4.5,  text: 'La saison change', style: 'editorial' },
  { id: 't2', start: 16.8, end: 23.5, text: 'Réservez · lien en bio', style: 'pill' },
];

/* ── stickers / éléments ─────────────────────────────────────────── */
const STICKERS = [
  { id: 'st1', at: 17.0, glyph: '↗', label: 'Flèche bio' },
];

/* ── piste audio : musique + voix off ────────────────────────────── */
const AUDIO = {
  music: { name: 'Golden Hour — Lo-fi', bpm: 84, dur: 24.5, vol: 0.4 },
  vo:    { name: 'Voix off — Camille', dur: 24.0, vol: 1.0 },
};

const MUSIC_LIB = [
  { id: 'm1', name: 'Golden Hour', mood: 'Doux · Lo-fi', bpm: 84,  dur: '0:32', on: true },
  { id: 'm2', name: 'Marché du matin', mood: 'Acoustique', bpm: 96,  dur: '0:28' },
  { id: 'm3', name: 'Service du soir', mood: 'Jazz feutré', bpm: 72,  dur: '0:41' },
  { id: 'm4', name: 'Première gorgée', mood: 'Pop chaleureux', bpm: 110, dur: '0:30' },
];

/* ── styles de sous-titres (karaoké / éditorial) ─────────────────── */
const SUB_STYLES = [
  { id: 'karaoke', name: 'Karaoké', sub: 'Mot par mot', bg: '#0C2A1D', fg: '#EEEDE3', hi: '#C8F135', weight: 800, italic: false, pill: true },
  { id: 'editorial', name: 'Éditorial', sub: 'Archivo italique', bg: 'transparent', fg: '#FFFFFF', hi: '#2FD79B', weight: 800, italic: true, pill: false },
  { id: 'clean', name: 'Net', sub: 'Bandeau plein', bg: '#FFFFFF', fg: '#14160F', hi: '#1F7A4D', weight: 700, italic: false, pill: false },
  { id: 'mint', name: 'Menthe', sub: 'Accent KLIP', bg: 'rgba(47,215,155,.92)', fg: '#06281C', hi: '#0C2A1D', weight: 800, italic: false, pill: true },
];

/* ── filtres / étalonnage ────────────────────────────────────────── */
const FILTERS = [
  { id: 'none',   name: 'Aucun',   css: 'none' },
  { id: 'chaud',  name: 'Chaud',   css: 'saturate(1.15) sepia(.12) contrast(1.04)' },
  { id: 'doux',   name: 'Doux',    css: 'saturate(.92) brightness(1.05) contrast(.96)' },
  { id: 'froid',  name: 'Froid',   css: 'saturate(1.05) hue-rotate(-8deg) brightness(1.02)' },
  { id: 'argent', name: 'Argentique', css: 'sepia(.28) saturate(1.1) contrast(1.08)' },
  { id: 'nb',     name: 'N&B',     css: 'grayscale(1) contrast(1.1)' },
];

/* ── transitions ─────────────────────────────────────────────────── */
const TRANSITIONS = [
  { id: 'cut',   name: 'Cut',      glyph: '▮▮' },
  { id: 'fade',  name: 'Fondu',    glyph: '◐' },
  { id: 'slide', name: 'Glissé',   glyph: '⇥' },
  { id: 'zoom',  name: 'Zoom',     glyph: '⊕' },
  { id: 'wipe',  name: 'Balayage', glyph: '◑' },
  { id: 'blur',  name: 'Flou',     glyph: '◌' },
];

/* ── vitesses ────────────────────────────────────────────────────── */
const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

/* helpers temps */
const fmt = (s) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.round((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, '0')}.${cs}`;
};
const fmtShort = (s) => {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};
const totalDur = CLIPS.reduce((a, c) => a + c.dur, 0);

Object.assign(window, {
  PROJECT, CLIPS, SUBS, TITLES, STICKERS, AUDIO, MUSIC_LIB,
  SUB_STYLES, FILTERS, TRANSITIONS, SPEEDS, fmt, fmtShort, totalDur,
});
