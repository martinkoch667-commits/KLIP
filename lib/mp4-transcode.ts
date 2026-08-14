// Transcodage webm -> MP4 (H.264/AAC) côté client via ffmpeg.wasm, pour la
// compatibilité universelle (l'export brut du module Montage est en .webm,
// limite du MediaRecorder navigateur — beaucoup de lecteurs/plateformes
// attendent du MP4). Build mono-thread (@ffmpeg/core, pas -mt) : pas besoin
// des en-têtes Cross-Origin-Opener-Policy/Cross-Origin-Embedder-Policy sur
// tout le site pour SharedArrayBuffer — plus lent mais zéro risque pour le
// reste de l'app. Chargé à la demande depuis un CDN (comme
// @imgly/background-removal dans l'éditeur), jamais bundlé.
const CORE_VERSION = '0.12.10';

export async function transcodeToMp4(webmBlob: Blob, onProgress?: (p: number) => void): Promise<Blob> {
  // @ts-expect-error import CDN dynamique sans types
  const { FFmpeg } = await import(/* webpackIgnore: true */ 'https://esm.sh/@ffmpeg/ffmpeg@0.12.10');
  // @ts-expect-error import CDN dynamique sans types
  const { toBlobURL, fetchFile } = await import(/* webpackIgnore: true */ 'https://esm.sh/@ffmpeg/util@0.12.1');

  const ffmpeg = new FFmpeg();
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      onProgress(Math.min(1, Math.max(0, progress)));
    });
  }

  const baseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd`;
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  try {
    await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));
    await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', 'output.mp4']);
    const data = await ffmpeg.readFile('output.mp4');
    return new Blob([data as unknown as BlobPart], { type: 'video/mp4' });
  } finally {
    // terminate() dans un finally : un transcodage qui échoue laissait sinon
    // tout le tas WebAssembly de ffmpeg (plusieurs centaines de Mo) en place
    // jusqu'à la fermeture de l'onglet.
    ffmpeg.terminate();
  }
}
