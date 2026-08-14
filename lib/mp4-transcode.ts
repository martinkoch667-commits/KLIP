// Transcodage webm -> MP4 (H.264/AAC) côté client via ffmpeg.wasm.
//
// Ce chemin n'est qu'un REPLI : quand le navigateur sait enregistrer du MP4
// directement (Safari), l'export ne passe pas ici du tout — voir
// pickRecorderType() dans montage/export.ts. Il ne sert donc plus qu'aux
// navigateurs qui n'enregistrent qu'en .webm, Chrome en tête.
//
// Build mono-thread (@ffmpeg/core, pas -mt) : pas besoin des en-têtes
// Cross-Origin-Opener-Policy/Cross-Origin-Embedder-Policy sur tout le site pour
// SharedArrayBuffer — plus lent, mais zéro risque pour le reste de l'app.
// Chargé à la demande depuis un CDN, jamais bundlé.
const CORE_VERSION = '0.12.10';

// Chaque étape a son plafond. Sans eux, un CDN injoignable ou un encodage qui
// n'avance plus laissait la promesse en suspens pour toujours : l'écran
// affichait « Conversion MP4… » indéfiniment, sans jamais atteindre le repli
// .webm pourtant prévu par l'appelant.
const LOAD_TIMEOUT_MS = 60_000;   // téléchargement du cœur wasm (~30 Mo)
const ENCODE_TIMEOUT_MS = 300_000; // encodage mono-thread, généreux mais borné

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} : délai dépassé (${Math.round(ms / 1000)} s)`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export async function transcodeToMp4(webmBlob: Blob, onProgress?: (p: number) => void): Promise<Blob> {
  // @ts-expect-error import CDN dynamique sans types
  const { FFmpeg } = await withTimeout(import(/* webpackIgnore: true */ 'https://esm.sh/@ffmpeg/ffmpeg@0.12.10'), LOAD_TIMEOUT_MS, 'chargement de ffmpeg');
  // @ts-expect-error import CDN dynamique sans types
  const { toBlobURL, fetchFile } = await withTimeout(import(/* webpackIgnore: true */ 'https://esm.sh/@ffmpeg/util@0.12.1'), LOAD_TIMEOUT_MS, 'chargement des utilitaires ffmpeg');

  const ffmpeg = new FFmpeg();
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      onProgress(Math.min(1, Math.max(0, progress)));
    });
  }

  const baseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd`;
  await withTimeout((async () => {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  })(), LOAD_TIMEOUT_MS, 'initialisation de ffmpeg');

  try {
    await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));
    await withTimeout(
      ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', 'output.mp4']),
      ENCODE_TIMEOUT_MS,
      'encodage MP4'
    );
    const data = await ffmpeg.readFile('output.mp4');
    return new Blob([data as unknown as BlobPart], { type: 'video/mp4' });
  } finally {
    // terminate() dans un finally : un transcodage interrompu laissait sinon
    // tout le tas WebAssembly de ffmpeg (plusieurs centaines de Mo) en place
    // jusqu'à la fermeture de l'onglet. Coupe aussi l'encodage en cours quand
    // le délai maximum est atteint.
    ffmpeg.terminate();
  }
}
