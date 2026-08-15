// beatSync.ts — caler les coupes du montage sur le rythme de la musique.
//
// Le prémontage décide OÙ couper (sur la parole, sur la qualité d'image). Il ne
// décide pas QUAND : les coupes tombent où elles tombent, et sur une vidéo posée
// sur une musique ça s'entend — c'est la différence la plus audible entre un
// montage amateur et un montage monté.
//
// Deux temps, séparés exprès :
//   • `detectBeats` écoute la musique et rend une grille de temps ;
//   • `snapClipsToBeats` déplace les coupes vers cette grille.
// La détection est coûteuse et ne dépend que du fichier ; le calage est instantané
// et se rejoue à chaque retouche du montage. Les mélanger obligerait à réanalyser
// la musique chaque fois que l'utilisateur bouge un plan.
//
// Aucun accès réseau, aucune clé d'API : tout se fait en Web Audio dans l'onglet.

import { clipTimelineDur, type MontageClip, type AudioTrack } from "./constants";

// ─── Analyse spectrale ──────────────────────────────────────────────────────

/** FFT itérative radix-2, en place. `re`/`im` ont une longueur en puissance de 2. */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  // Permutation par inversion de bits.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

const FFT_SIZE = 1024;
const HOP = 256; // à 22 050 Hz → ~86 trames/s, assez fin pour placer un temps au 1/100 s

/**
 * Enveloppe d'attaques par FLUX SPECTRAL : somme des hausses d'énergie par bande,
 * d'une trame à l'autre. On ne garde que les hausses — une note qui s'éteint n'est
 * pas une attaque, et la compter brouillait la grille sur les morceaux tenus.
 *
 * L'énergie large bande seule (plus simple) suffisait sur une grosse caisse franche
 * mais ratait tout ce qui est percussif dans les aigus, typiquement les charleys qui
 * portent le tempo sur la musique de réseaux sociaux.
 */
function onsetEnvelope(pcm: Float32Array, sampleRate: number): { env: Float32Array; fps: number } {
  const frames = Math.max(1, Math.floor((pcm.length - FFT_SIZE) / HOP));
  const env = new Float32Array(Math.max(0, frames));
  const prev = new Float32Array(FFT_SIZE / 2);
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);
  // Fenêtre de Hann : sans elle, les bords de chaque trame créent de fausses
  // attaques régulières, et l'autocorrélation se cale dessus au lieu du tempo.
  const win = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));

  for (let f = 0; f < frames; f++) {
    const off = f * HOP;
    for (let i = 0; i < FFT_SIZE; i++) { re[i] = pcm[off + i] * win[i]; im[i] = 0; }
    fft(re, im);
    let flux = 0;
    for (let k = 0; k < FFT_SIZE / 2; k++) {
      // Échelle logarithmique : à volume élevé, l'écart brut entre deux trames
      // écrase les attaques des passages calmes.
      const mag = Math.log1p(Math.hypot(re[k], im[k]));
      const d = mag - prev[k];
      if (d > 0) flux += d;
      prev[k] = mag;
    }
    env[f] = flux;
  }

  // Normalisation par la médiane glissante : un refrain plus fort que le couplet
  // ne doit pas monopoliser la détection.
  const fps = sampleRate / HOP;
  const w = Math.round(fps); // ~1 s
  const out = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) {
    const a = Math.max(0, i - w), b = Math.min(env.length, i + w + 1);
    let sum = 0;
    for (let j = a; j < b; j++) sum += env[j];
    const mean = sum / (b - a);
    out[i] = Math.max(0, env[i] - mean);
  }
  return { env: out, fps };
}

// Bornes de tempo. En dessous de 60 on confond le tempo avec la structure ; au-dessus
// de 190 on cale sur les doubles-croches et les coupes deviennent hachées.
const MIN_BPM = 60;
const MAX_BPM = 190;

/** Tempo le plus probable a priori. Les tempi perçus se concentrent autour de
 *  120 BPM ; sans ce biais l'autocorrélation choisit volontiers la moitié du vrai
 *  tempo, qui corrèle presque aussi bien (un temps sur deux tombe juste). */
const TEMPO_CENTER = 120;
const TEMPO_SIGMA = 0.7; // en octaves
const tempoPrior = (bpm: number) => Math.exp(-0.5 * ((Math.log2(bpm / TEMPO_CENTER) / TEMPO_SIGMA) ** 2));

/**
 * Saillance minimale du pic d'autocorrélation, rapportée à la moyenne de la courbe.
 *
 * Calé sur mesure : sur des signaux de synthèse, une pulsation franche donne 15 à 32,
 * là où une nappe, un pad avec vibrato et de la voix seule plafonnent entre 2,2 et 3,2.
 * Le seuil est posé au milieu de ce creux — assez haut pour refuser ce qui n'a pas de
 * rythme, assez bas pour ne pas exiger une grosse caisse à chaque temps.
 *
 * NB : ces repères viennent de signaux synthétiques, plus nets que de la vraie musique.
 * Si des morceaux à groove souple se faisaient refuser, c'est ce nombre qu'il faut
 * baisser — `confidence` est exposé sur la grille pour pouvoir le juger sur pièces.
 */
const MIN_PROMINENCE = 6;

/** À quel point la moitié de la période doit corréler pour qu'on la préfère.
 *  Corrige l'erreur d'octave dans l'autre sens : quand le vrai tempo est le double
 *  de ce que le pic principal indique, la demi-période corrèle presque autant. */
const OCTAVE_TOL = 0.82;

/** Tempo par autocorrélation de l'enveloppe d'attaques. */
function estimateTempo(env: Float32Array, fps: number): { bpm: number; period: number; prominence: number } | null {
  const minLag = Math.floor((60 / MAX_BPM) * fps);
  const maxLag = Math.ceil((60 / MIN_BPM) * fps);
  if (env.length < maxLag * 2) return null;

  const scores = new Float64Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < env.length; i++) sum += env[i] * env[i + lag];
    scores[lag] = sum / (env.length - lag);
  }

  let bestLag = 0, bestWeighted = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const w = scores[lag] * tempoPrior((60 * fps) / lag);
    if (w > bestWeighted) { bestWeighted = w; bestLag = lag; }
  }
  if (!bestLag || scores[bestLag] <= 0) return null;

  // Y a-t-il seulement un rythme ? On mesure le pic par rapport au niveau moyen
  // de la courbe : sans ce garde-fou, une nappe continue produisait une grille
  // tirée du bruit numérique de l'analyse.
  let mean = 0;
  for (let lag = minLag; lag <= maxLag; lag++) mean += scores[lag];
  mean /= maxLag - minLag + 1;
  if (!(mean > 0)) return null;
  const prominence = scores[bestLag] / mean;
  if (prominence < MIN_PROMINENCE) return null;

  // Erreur d'octave : si la demi-période corrèle presque aussi bien, c'est elle
  // le vrai temps — on entendait un temps sur deux.
  const half = Math.round(bestLag / 2);
  if (half >= minLag && scores[half] >= scores[bestLag] * OCTAVE_TOL) bestLag = half;

  // Affinage de la période EN PEIGNE. Une période en nombre entier de trames se
  // trompe de quelques dixièmes de pour cent : inaudible sur un temps, mais l'erreur
  // s'accumule et la grille dérivait de 50 ms au bout de 20 s — les premières coupes
  // tombaient juste et les dernières à côté, ce qui est précisément le défaut qu'on
  // cherche à corriger.
  //
  // Plutôt que d'interpoler le pic d'autocorrélation (trop grossier aux tempi rapides,
  // où une période ne fait qu'une trentaine de trames), on essaie des périodes autour
  // de l'estimation et on garde celle dont la grille capte le plus d'énergie d'attaque.
  // C'est exactement le critère qui nous intéresse, mesuré directement.
  const period = refinePeriod(env, bestLag);

  return { bpm: (60 * fps) / period, period, prominence };
}

/** Énergie d'attaque captée par une grille de période et phase données. */
function combEnergy(env: Float32Array, period: number, phase: number): number {
  let sum = 0;
  for (let f = phase; f < env.length; f += period) {
    // Le maximum local sur ±1 trame : sans cette tolérance, la mesure récompense
    // l'alignement exact sur la trame plutôt que sur l'attaque, et le pas de
    // recherche fin n'apporte plus rien.
    const i = Math.round(f);
    let best = env[i] ?? 0;
    if (i > 0 && env[i - 1] > best) best = env[i - 1];
    if (i + 1 < env.length && env[i + 1] > best) best = env[i + 1];
    sum += best;
  }
  return sum;
}

function refinePeriod(env: Float32Array, coarse: number): number {
  let best = coarse, bestE = -Infinity;
  // ±1 trame autour de l'estimation, au centième de trame près (~0,12 ms).
  for (let p = coarse - 1; p <= coarse + 1; p += 0.01) {
    if (p <= 1) continue;
    const e = combEnergy(env, p, bestPhase(env, p));
    if (e > bestE) { bestE = e; best = p; }
  }
  return best;
}

/**
 * Phase de la grille, par MOYENNE CIRCULAIRE : chaque trame est un vecteur dont
 * l'angle est sa position dans le cycle et la longueur son énergie d'attaque ; la
 * direction de leur somme donne la phase. Balayer les décalages entiers (l'approche
 * évidente) plafonnait la précision à une trame, soit 12 ms de décalage constant
 * sur toutes les coupes.
 */
function bestPhase(env: Float32Array, period: number): number {
  let sumRe = 0, sumIm = 0;
  for (let i = 0; i < env.length; i++) {
    if (env[i] <= 0) continue;
    const ang = (2 * Math.PI * (i % period)) / period;
    sumRe += env[i] * Math.cos(ang);
    sumIm += env[i] * Math.sin(ang);
  }
  let phase = (Math.atan2(sumIm, sumRe) / (2 * Math.PI)) * period;
  while (phase < 0) phase += period;
  return phase;
}

export interface BeatMap {
  /** Temps forts, en secondes DANS LA SOURCE audio, croissants. */
  beats: number[];
  bpm: number;
  /** Netteté du pic d'autocorrélation rapportée au niveau moyen de la courbe.
   *  ~1 = aucune pulsation, > 2 = rythme franc. Exposé parce que c'est la seule
   *  mesure qui dit si la grille vaut quelque chose. */
  confidence: number;
}

/**
 * Cœur de l'analyse, sur un signal mono déjà décodé. Séparé du décodage exprès :
 * c'est la seule partie qui contient de la décision, elle n'a besoin d'aucune API
 * de navigateur, et elle se vérifie donc sur un signal de synthèse à tempo connu.
 * (Le jour où le rendu passe côté serveur, elle s'y exécute telle quelle.)
 */
export function beatsFromPcm(pcm: Float32Array, sampleRate: number): BeatMap | null {
  const { env, fps } = onsetEnvelope(pcm, sampleRate);
  if (!env.length) return null;
  const tempo = estimateTempo(env, fps);
  if (!tempo) return null;

  const phase = bestPhase(env, tempo.period);
  // Chaque trame d'analyse couvre FFT_SIZE échantillons : son instant est le CENTRE
  // de sa fenêtre, pas son début. Sans cette correction toute la grille arrivait
  // ~23 ms trop tôt — un décalage constant, donc audible sur toutes les coupes.
  const frameCenter = FFT_SIZE / 2 / sampleRate;
  const beats: number[] = [];
  for (let f = phase; f < env.length; f += tempo.period) beats.push(f / fps + frameCenter);
  // Moins de quatre temps sur tout un morceau : ce n'est pas une pulsation, c'est
  // du bruit qui a passé le seuil.
  if (beats.length < 4) return null;

  return { beats, bpm: tempo.bpm, confidence: tempo.prominence };
}

/**
 * Écoute un fichier audio et en rend la grille de temps.
 * Rend `null` quand le morceau n'a pas de pulsation exploitable (nappe, voix
 * seule, ambiance) — mieux vaut ne rien caler que de caler sur du bruit.
 */
export async function detectBeats(src: string): Promise<BeatMap | null> {
  const rate = 22050; // suffisant pour les attaques ; 4× moins de calcul qu'en 44,1 kHz
  let mono: Float32Array;
  try {
    const ab = await (await fetch(src)).arrayBuffer();
    const AC: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const actx = new AC();
    const decoded = await actx.decodeAudioData(ab.slice(0));
    try { await actx.close(); } catch { /* déjà fermé */ }
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const node = off.createBufferSource();
    node.buffer = decoded;
    node.connect(off.destination);
    node.start();
    mono = (await off.startRendering()).getChannelData(0);
  } catch (e) {
    console.warn("[beatSync] audio illisible :", e);
    return null;
  }

  return beatsFromPcm(mono, rate);
}

// ─── Calage des coupes ──────────────────────────────────────────────────────

/** Grille ramenée au référentiel de la TIMELINE, en tenant compte du placement
 *  de la piste musicale (décalage sur la timeline, et départ dans la source). */
export function beatsOnTimeline(map: BeatMap, track: AudioTrack, totalDur: number): number[] {
  const srcOffset = track.srcOffset ?? 0;
  return map.beats
    .map((b) => track.offset + (b - srcOffset))
    .filter((t) => t >= 0 && t <= totalDur);
}

/** Durée minimale d'un plan après calage : en dessous, la coupe est un clignotement. */
const MIN_CLIP_DUR = 0.4;

export interface SnapResult {
  clips: MontageClip[];
  /** Nombre de coupes effectivement déplacées. */
  moved: number;
}

/**
 * Déplace la FIN de chaque plan vers le temps fort le plus proche.
 *
 * On agit sur `trimEnd` et non sur la position : les plans sont en séquence, donc
 * allonger un plan décale tous les suivants — on recalcule donc la position
 * courante au fur et à mesure, et chaque coupe est calée par rapport à là où le
 * montage en est VRAIMENT, pas à là où il en était avant le calage.
 *
 * `maxShift` borne le déplacement : au-delà, on préfère laisser la coupe où le
 * monteur (ou le prémontage) l'a voulue. Caler à tout prix rallongeait des plans
 * d'une seconde entière pour attraper un temps fort, ce qui cassait le propos —
 * le rythme ne vaut pas qu'on tienne un plan mort.
 */
export function snapClipsToBeats(
  clips: MontageClip[],
  beatsTl: number[],
  maxShift = 0.25,
): SnapResult {
  if (!clips.length || beatsTl.length < 2) return { clips, moved: 0 };

  const sorted = [...beatsTl].sort((a, b) => a - b);
  const nearest = (t: number): number => {
    // Recherche dichotomique : la grille d'un morceau de 3 min compte ~400 temps,
    // et on l'interroge une fois par plan.
    let lo = 0, hi = sorted.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < t) lo = mid + 1; else hi = mid;
    }
    const a = sorted[Math.max(0, lo - 1)], b = sorted[lo];
    return Math.abs(a - t) <= Math.abs(b - t) ? a : b;
  };

  const out: MontageClip[] = [];
  let pos = 0;
  let moved = 0;

  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    pos += Math.max(0, c.gapBefore ?? 0);
    const dur = clipTimelineDur(c);

    // Le dernier plan ne porte pas de coupe : sa fin est la fin de la vidéo, la
    // caler sur un temps fort ne s'entend pas et ne fait que tronquer la chute.
    if (i === clips.length - 1 || dur <= 0) {
      out.push(c);
      pos += dur;
      continue;
    }

    const end = pos + dur;
    const target = nearest(end);
    const shift = target - end;

    if (Math.abs(shift) < 0.02 || Math.abs(shift) > maxShift) {
      out.push(c);
      pos += dur;
      continue;
    }

    // `shift` est en temps TIMELINE ; `trimEnd` vit dans la source, donc à la
    // vitesse du plan près. Un plan en 2× a besoin de deux fois plus de source
    // pour gagner une seconde à l'écran.
    const speed = c.kind === "video" ? c.speed : 1;
    let newTrimEnd = c.trimEnd + shift * speed;
    newTrimEnd = Math.min(newTrimEnd, c.srcDur);
    newTrimEnd = Math.max(newTrimEnd, c.trimStart + MIN_CLIP_DUR * speed);

    const applied = (newTrimEnd - c.trimEnd) / speed;
    if (Math.abs(applied) < 0.02) {
      out.push(c);
      pos += dur;
      continue;
    }

    out.push({ ...c, trimEnd: newTrimEnd });
    pos += dur + applied;
    moved++;
  }

  return { clips: out, moved };
}
