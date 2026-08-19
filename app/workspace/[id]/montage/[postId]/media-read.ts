// media-read.ts : lire un média SANS élément <video>.
//
// POURQUOI CE FICHIER EXISTE
// Le monteur lisait tout à travers des éléments <video> et <audio> : deux pour
// l'aperçu, un par incrustation, un par piste sonore, et un jetable à chaque
// extraction de vignettes. Or Chrome refuse de créer un lecteur média au delà
// d'une cinquantaine par onglet, et le dit sans ménagement :
//
//   Blocked attempt to create a WebMediaPlayer as there are too many
//   WebMediaPlayers already. See crbug.com/1131196.
//
// Passé ce seuil, des sources cessent simplement de charger. C'est la cause de
// fond de l'instabilité du monteur sur un gros montage : elle ne se voit pas
// venir, elle ne produit aucune erreur visible, et elle dépend du nombre de
// plans, donc elle empire à mesure que le projet avance.
//
// Les éditeurs vidéo du navigateur ne travaillent pas comme ça : ils décodent
// avec WebCodecs et peignent sur un canvas, sans jamais instancier de lecteur
// média. On fait pareil, avec Mediabunny, écrite par l'auteur de mp4-muxer que
// l'export utilise déjà.
//
// Deux bénéfices en plus du plafond levé :
//   - `UrlSource` lit par PLAGES D'OCTETS. Extraire trois vignettes d'un rush de
//     200 Mo ne télécharge plus les 200 Mo, seulement les morceaux utiles.
//   - le décodage est matériel et se réutilise d'une image à l'autre.
//
// Repli : si le navigateur n'a pas WebCodecs, `lectureRapideDisponible()` rend
// faux et l'appelant garde son ancien chemin.

import { Input, UrlSource, ALL_FORMATS, CanvasSink, AudioBufferSink, type InputVideoTrack, type InputAudioTrack } from "mediabunny";

export function lectureRapideDisponible(): boolean {
  return typeof window !== "undefined"
    && typeof VideoDecoder !== "undefined"
    && typeof AudioDecoder !== "undefined";
}

/* Un `Input` par fichier source, gardé au chaud.

   Découper un rush en dix plans donne dix plans qui pointent le MÊME fichier.
   Ouvrir dix fois la source, ce serait dix fois l'analyse du conteneur et dix
   caches d'octets distincts. On garde donc une entrée par URL, avec un plafond :
   chaque entrée retient jusqu'à 64 Mo d'octets lus, on ne peut pas en empiler
   sans fin. */
const MAX_SOURCES = 8;
const sources = new Map<string, Input>();

function entree(src: string): Input {
  const existante = sources.get(src);
  if (existante) {
    // Remis en tête : la moins récemment servie sortira la première.
    sources.delete(src);
    sources.set(src, existante);
    return existante;
  }
  const input = new Input({ source: new UrlSource(src), formats: ALL_FORMATS });
  sources.set(src, input);
  while (sources.size > MAX_SOURCES) {
    const plusAncienne = sources.keys().next().value as string | undefined;
    if (plusAncienne === undefined) break;
    const vieille = sources.get(plusAncienne);
    sources.delete(plusAncienne);
    try { vieille?.dispose(); } catch { /* déjà libérée */ }
  }
  return input;
}

/** Referme toutes les sources ouvertes. À appeler en quittant le monteur. */
export function fermerSources() {
  for (const input of Array.from(sources.values())) { try { input.dispose(); } catch { /* déjà libérée */ } }
  sources.clear();
}

async function pisteVideo(src: string): Promise<InputVideoTrack | null> {
  const input = entree(src);
  return await input.getPrimaryVideoTrack();
}

async function pisteAudio(src: string): Promise<InputAudioTrack | null> {
  const input = entree(src);
  return await input.getPrimaryAudioTrack();
}

/** Durée et ratio d'une source vidéo, sans la charger dans un lecteur. */
export async function infosVideo(src: string): Promise<{ dur: number; aspect: number } | null> {
  try {
    const piste = await pisteVideo(src);
    if (!piste) return null;
    const dur = await entree(src).computeDuration();
    const w = piste.displayWidth || 16, h = piste.displayHeight || 9;
    return { dur, aspect: w / h };
  } catch { return null; }
}

/**
 * Images brutes d'une source, une par instant demandé, rendues sous forme de
 * canvas prêts à être lus ou redessinés. C'est la brique de tout le reste :
 * vignettes de la timeline, analyse d'image du prémontage, capture envoyée à
 * l'IA. Aucune ne crée d'élément <video>.
 *
 * `canvasesAtTimestamps` décode chaque paquet AU PLUS UNE FOIS quand les
 * instants sont croissants, là où l'ancien chemin repositionnait un <video> et
 * attendait un événement `seeked` à chaque image.
 */
export async function pourChaqueImage(
  src: string,
  instants: number[],
  taille: { largeur?: number; hauteur?: number },
  recevoir: (canvas: HTMLCanvasElement | OffscreenCanvas, index: number) => void | Promise<void>,
): Promise<{ recues: number; aspect: number } | null> {
  try {
    const piste = await pisteVideo(src);
    if (!piste) return null;
    const aspect = (piste.displayWidth || 16) / (piste.displayHeight || 9);
    const sink = new CanvasSink(piste, {
      ...(taille.hauteur ? { height: Math.round(taille.hauteur) } : {}),
      ...(taille.largeur ? { width: Math.round(taille.largeur) } : {}),
      poolSize: 2, // deux canvas recyclés : la mémoire vidéo ne gonfle pas
    });
    const tries = instants.slice().sort((a, b) => a - b);
    let i = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(tries)) {
      if (!wrapped) { i++; continue; }
      // Le canvas appartient au pool et sera réécrit juste après : l'appelant
      // doit en avoir fini avec lui quand `recevoir` rend la main.
      await recevoir(wrapped.canvas as HTMLCanvasElement | OffscreenCanvas, i);
      i++;
    }
    return i ? { recues: i, aspect } : null;
  } catch { return null; }
}

/**
 * Images brutes d'une source, ramassées dans un tableau.
 *
 * À N'UTILISER QUE POUR QUELQUES IMAGES : chaque image est copiée et conservée.
 * Pour en parcourir beaucoup, passer par `pourChaqueImage`, qui n'en garde
 * aucune — soixante images d'un rush 4K collectées d'un coup, ce serait
 * plusieurs gigaoctets.
 */
export async function imagesAux(
  src: string, instants: number[], taille: { largeur?: number; hauteur?: number },
): Promise<{ canvases: HTMLCanvasElement[]; aspect: number } | null> {
  const canvases: HTMLCanvasElement[] = [];
  const r = await pourChaqueImage(src, instants, taille, (source) => {
    const copie = document.createElement("canvas");
    copie.width = source.width; copie.height = source.height;
    copie.getContext("2d")!.drawImage(source as CanvasImageSource, 0, 0);
    canvases.push(copie);
  });
  if (!r || !canvases.length) return null;
  return { canvases, aspect: r.aspect };
}

/** Durée d'une source sonore, sans créer de lecteur média. */
export async function dureeAudio(src: string): Promise<number | null> {
  try {
    const piste = await pisteAudio(src);
    if (!piste) return null;
    const d = await entree(src).computeDuration();
    return d > 0 && isFinite(d) ? d : null;
  } catch { return null; }
}

/**
 * Vignettes d'un plan : une image par instant demandé, en JPEG encodé.
 * `hauteur` fixe la taille d'extraction ; la largeur suit le ratio de la source.
 *
 * `canvasesAtTimestamps` décode chaque paquet AU PLUS UNE FOIS quand les instants
 * sont croissants, là où l'ancien chemin repositionnait un <video> à chaque
 * vignette et attendait un événement `seeked` à chaque fois.
 */
export async function vignettes(
  src: string, instants: number[], hauteur: number,
): Promise<{ frames: string[]; aspect: number } | null> {
  const frames: string[] = [];
  const r = await pourChaqueImage(src, instants, { hauteur }, async (cv) => {
    frames.push(await enJpeg(cv));
  });
  if (!r || !frames.length) return null;
  return { frames, aspect: r.aspect };
}

export async function enJpeg(cv: HTMLCanvasElement | OffscreenCanvas): Promise<string> {
  if (cv instanceof HTMLCanvasElement) return cv.toDataURL("image/jpeg", 0.72);
  // OffscreenCanvas : pas de toDataURL, on passe par un blob.
  const blob = await cv.convertToBlob({ type: "image/jpeg", quality: 0.72 });
  return await new Promise<string>((res) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.readAsDataURL(blob);
  });
}

/**
 * Pics d'amplitude d'une source sonore, `parSeconde` mesures par seconde.
 *
 * L'ancien chemin téléchargeait le fichier ENTIER puis le décodait d'un bloc
 * avec `decodeAudioData` : sur une musique de plusieurs minutes, cela veut dire
 * tout le fichier en mémoire, plus tous ses échantillons décodés. Ici on
 * parcourt les tampons au fil du décodage et on ne garde que les pics.
 */
export async function picsAudio(
  src: string, parSeconde: number, maxi: number,
): Promise<number[] | null> {
  try {
    const piste = await pisteAudio(src);
    if (!piste) return null;
    const duree = await entree(src).computeDuration();
    const n = Math.max(120, Math.min(maxi, Math.round(duree * parSeconde)));
    const pas = duree / n;
    const pics = new Float32Array(n);
    const sink = new AudioBufferSink(piste);
    for await (const { buffer, timestamp } of sink.buffers()) {
      const data = buffer.getChannelData(0);
      const sr = buffer.sampleRate;
      // Un échantillon sur quatre : sur un tampon de plusieurs milliers de
      // valeurs, les lire toutes ne change rien au pic visible.
      for (let i = 0; i < data.length; i += 4) {
        const t = timestamp + i / sr;
        const k = Math.min(n - 1, Math.max(0, Math.floor(t / pas)));
        const v = Math.abs(data[i]);
        if (v > pics[k]) pics[k] = v;
      }
    }
    let max = 0.01;
    for (let i = 0; i < pics.length; i++) if (pics[i] > max) max = pics[i];
    return Array.from(pics, (p) => Math.round(Math.min(1, p / max) * 100) / 100);
  } catch { return null; }
}
