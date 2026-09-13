// proxy.ts : l'aperçu monte sur une copie légère, l'export garde l'original.
//
// POURQUOI CE FICHIER EXISTE
// Mesure faite dans le monteur, sur un vrai montage, rushes iPhone :
//
//   définition rush      2160×3840
//   coupe → 1re image    5649 ms   (à froid, premier chargement)
//   coupe → 1re image      26 ms   (une fois le fichier en cache)
//
// Deux choses se lisent là dedans. D'abord l'aperçu fait environ 190 px de large
// à l'écran : on décode vingt fois plus de pixels que ce qui est regardé, en
// permanence. Ensuite les 5,6 secondes ne sont pas du décodage, c'est du
// TÉLÉCHARGEMENT : un MOV iPhone 4K pèse des dizaines de méga-octets, et il faut
// l'aller chercher sur Supabase avant de montrer quoi que ce soit.
//
// Tous les logiciels de montage règlent ça de la même façon depuis trente ans :
// on monte sur une copie basse définition, le « proxy », et le fichier d'origine
// ne ressort qu'à l'export. C'est ce que fait ce fichier.
//
// DEUX PRINCIPES, pour que ça ne puisse abîmer aucun projet existant :
//
//   1. Le proxy ne touche JAMAIS aux données du projet. `clip.src` reste le
//      fichier d'origine, l'export continue de lire `clip.src` sans rien savoir
//      d'ici, et un projet dont les proxys n'existent pas se comporte
//      exactement comme avant. La substitution se fait au dernier moment, et
//      seulement pour les lecteurs de l'aperçu.
//
//   2. L'adresse du proxy se DÉDUIT de celle de l'original, elle n'est stockée
//      nulle part. Pas de colonne à ajouter en base, donc rien à migrer, et
//      aucun moyen que la base et le stockage se contredisent. La question
//      « ce plan a-t-il un proxy ? » se répond par un HEAD sur le stockage.

import {
  Input, UrlSource, BlobSource, ALL_FORMATS,
  Output, BufferTarget, Mp4OutputFormat, Conversion,
} from "mediabunny";

/* Hauteur de la copie d'aperçu.

   720 est au dessus de tout ce que l'aperçu affiche réellement, y compris sur un
   écran à forte densité : une vidéo verticale devient 405×720 là où la fenêtre
   d'aperçu en fait 190 de large. On garde cette marge parce que le proxy sert
   aussi au plein écran et au dérushage, où l'image est regardée de plus près. */
export const HAUTEUR_PROXY = 720;

/* Débits volontairement modestes : ces fichiers ne sont jamais livrés à
   personne, ils ne servent qu'à être lus tout de suite. Un plan de dix secondes
   pèse environ 2,5 Mo au lieu de 60. */
const DEBIT_VIDEO = 2_000_000;
const DEBIT_AUDIO = 128_000;

/* Suffixe reconnaissable, et extension .mp4 pour que le stockage serve le bon
   type et que le lecteur du navigateur l'accepte sans discuter. */
const SUFFIXE = ".apercu.mp4";

/** Le navigateur sait-il ENCODER ? Décoder ne suffit pas ici : on fabrique un
 *  fichier. Sans `VideoEncoder`, on ne fabrique rien et l'aperçu garde les
 *  originaux, comme avant. */
export function fabricationDisponible(): boolean {
  return typeof window !== "undefined"
    && typeof VideoEncoder !== "undefined"
    && typeof AudioEncoder !== "undefined";
}

/** Adresse du proxy correspondant à un original, ou `null` si l'adresse donnée
 *  n'est pas exploitable. Purement déductif : aucun accès réseau. */
export function urlProxy(src: string): string | null {
  if (!src) return null;
  const base = src.split("?")[0];
  if (!/^https?:\/\//.test(base)) return null;
  if (base.endsWith(SUFFIXE)) return base; // déjà un proxy
  const point = base.lastIndexOf(".");
  const barre = base.lastIndexOf("/");
  const sansExtension = point > barre ? base.slice(0, point) : base;
  return sansExtension + SUFFIXE;
}

/* Ce que l'on sait de chaque original, en mémoire, pour la durée de la page.

   `true`  : le proxy existe, l'aperçu doit le lire.
   `false` : il n'existe pas, ou il est inutile (source déjà légère), ou sa
             fabrication a échoué. Dans les trois cas l'aperçu lit l'original,
             ce qui est le comportement d'avant.

   Une entrée absente veut dire « pas encore regardé ». */
const connus = new Map<string, boolean>();
const enCours = new Set<string>();

/* La dernière raison d'échec, en clair.

   Première version de ce fichier : les `catch` rendaient `null` sans rien dire,
   et le monteur affichait « aucune copie » sans qu'on puisse savoir si c'était
   le décodeur, l'encodeur ou le stockage. C'est précisément ce que le reste du
   monteur s'interdit, et pour de bonnes raisons. On garde donc le motif, et on
   le montre. */
let derniereRaison: string | null = null;

function noter(quoi: string, e?: unknown): void {
  const detail = e instanceof Error ? e.message : e ? String(e) : "";
  derniereRaison = (quoi + (detail ? " : " + detail : "")).slice(0, 90);
  console.warn("[proxy]", derniereRaison, e || "");
}

/** Quelle adresse l'APERÇU doit lire pour ce plan. Synchrone, sans effet de
 *  bord : c'est appelé pendant le rendu et dans les boucles de lecture.
 *  Tant qu'un proxy n'est pas confirmé présent, on rend l'original. */
export function apercu(src: string): string {
  if (!src) return src;
  const p = connus.get(src) ? urlProxy(src) : null;
  return p || src;
}

/** Vrai si ce plan est lu en proxy en ce moment. Sert à l'affichage, pas à la
 *  décision. */
export function enProxy(src: string): boolean {
  return connus.get(src) === true;
}

/* Existence d'un proxy sur le stockage.

   Un HEAD suffit et ne télécharge rien. Supabase répond 400 ou 404 sur un objet
   absent ; toute autre panne (réseau coupé, CORS) est traitée comme une absence,
   ce qui fait retomber l'aperçu sur l'original au lieu de casser la lecture. */
async function existe(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

/* Le projet compile sans `downlevelIteration` : parcourir un Set directement ne
   passe pas. On dédoublonne donc à la main, comme ailleurs dans le monteur. */
function sansDoublons(xs: string[]): string[] {
  const vus: Record<string, true> = {};
  const out: string[] = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    if (!x || vus[x]) continue;
    vus[x] = true;
    out.push(x);
  }
  return out;
}

/** Regarde, pour chaque original, si son proxy est déjà là. Rend la liste de
 *  ceux qui n'en ont pas, donc ceux qu'il reste à fabriquer. */
export async function recenser(srcs: string[]): Promise<string[]> {
  const tous = sansDoublons(srcs).filter((s) => !!urlProxy(s));
  const aRegarder = tous.filter((s) => !connus.has(s));
  const manquants: string[] = [];
  await Promise.all(aRegarder.map(async (src) => {
    const p = urlProxy(src);
    if (!p) return;
    const la = await existe(p);
    connus.set(src, la);
  }));
  // Tout ce qui n'a pas de proxy reste à fabriquer, qu'on vienne de le
  // constater ou qu'on le sache déjà d'un passage précédent.
  for (let i = 0; i < tous.length; i++) {
    if (connus.get(tous[i]) === false) manquants.push(tous[i]);
  }
  return manquants;
}

/* Fabrication proprement dite.

   Mediabunny fait tout le travail : il lit la source par plages d'octets (donc
   sans télécharger le fichier entier d'un coup), redimensionne, ré-encode, et
   multiplexe. `fastStart: "in-memory"` place l'index au DÉBUT du fichier : sans
   ça, un lecteur doit télécharger jusqu'à la fin avant de pouvoir se positionner,
   et on aurait recréé en petit le problème qu'on cherche à supprimer. */
async function convertir(input: Input, onAvance?: (part: number) => void): Promise<Blob | null> {
  const piste = await input.getPrimaryVideoTrack();
  if (!piste) { noter("aucune piste vidéo"); return null; }

  /* Source déjà légère : on ne fabrique rien. Ré-encoder un fichier de 720 de
     haut le dégraderait sans rien faire gagner. */
  if (piste.displayHeight <= HAUTEUR_PROXY) { noter("déjà léger (" + piste.displayHeight + "px)"); return null; }

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  const conversion = await Conversion.init({
    input,
    output,
    video: { height: HAUTEUR_PROXY, bitrate: DEBIT_VIDEO },
    audio: { bitrate: DEBIT_AUDIO },
    showWarnings: false,
  });
  if (!conversion.isValid) {
    // `discardedTracks` dit exactement laquelle des pistes coince et pourquoi :
    // codec d'entrée indécodable, aucun encodeur disponible, format de sortie
    // incompatible. Sans ça on corrigerait au hasard.
    noter("conversion refusée", conversion.discardedTracks.map((d) => d.reason).join(", "));
    return null;
  }
  if (onAvance) conversion.onProgress = (p) => onAvance(p);
  await conversion.execute();

  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) { noter("fichier vide en sortie"); return null; }
  return new Blob([buffer], { type: "video/mp4" });
}

/** Fabrique le proxy d'un fichier qu'on vient de déposer, sans le retélécharger.
 *  Rend `null` quand il n'y a rien à faire (source déjà légère, pas d'encodeur,
 *  fichier illisible) : l'appelant continue alors comme avant. */
export async function proxyDuFichier(file: Blob, onAvance?: (part: number) => void): Promise<Blob | null> {
  if (!fabricationDisponible()) { noter("ce navigateur n'a pas d'encodeur WebCodecs"); return null; }
  try {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    return await convertir(input, onAvance);
  } catch (e) {
    noter("lecture du fichier déposé", e);
    return null;
  }
}

/** Fabrique le proxy d'un média déjà en ligne. C'est le chemin de rattrapage,
 *  pour tous les montages faits avant l'existence des proxys. */
export async function proxyDeLUrl(src: string, onAvance?: (part: number) => void): Promise<Blob | null> {
  if (!fabricationDisponible()) { noter("ce navigateur n'a pas d'encodeur WebCodecs"); return null; }
  try {
    const input = new Input({ source: new UrlSource(src), formats: ALL_FORMATS });
    return await convertir(input, onAvance);
  } catch (e) {
    noter("lecture de la source en ligne", e);
    return null;
  }
}

/** Décompose une adresse publique Supabase en bucket + chemin, pour pouvoir
 *  déposer le proxy juste à côté de son original. */
export function cheminStockage(url: string): { bucket: string; chemin: string } | null {
  const m = url.split("?")[0].match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { bucket: decodeURIComponent(m[1]), chemin: decodeURIComponent(m[2]) };
}

export type Televerseur = (bucket: string, chemin: string, blob: Blob) => Promise<boolean>;

export interface AvanceProxy {
  /** Index du média en cours, à partir de 1, et combien il y en a en tout. */
  rang: number;
  total: number;
  /** Avancement du média en cours, de 0 à 1. */
  part: number;
}

/* Fabrique et dépose les proxys manquants, UN PAR UN.

   Un par un, et pas en parallèle : encoder de la vidéo occupe le processeur et
   la mémoire vidéo. En lancer cinq d'un coup ferait exactement ce qu'on essaie
   de supprimer, à savoir un monteur qui rame. La fabrication tourne en fond
   pendant que l'utilisateur monte, et chaque proxy prêt est pris en compte
   immédiatement pour le plan suivant qu'il jouera. */
export async function assurerProxys(
  srcs: string[],
  televerser: Televerseur,
  ev?: {
    onAvance?: (a: AvanceProxy) => void;
    onPret?: (src: string) => void;
    annule?: () => boolean;
  },
): Promise<number> {
  if (!fabricationDisponible()) { noter("ce navigateur n'a pas d'encodeur WebCodecs"); return 0; }
  const manquants = (await recenser(srcs)).filter((s) => !enCours.has(s));
  if (!manquants.length) return 0;

  let faits = 0;
  for (let i = 0; i < manquants.length; i++) {
    if (ev?.annule?.()) break;
    const src = manquants[i];
    const cible = urlProxy(src);
    const place = cible ? cheminStockage(cible) : null;
    if (!cible || !place) {
      /* On ne sait pas où déposer la copie. C'est que l'adresse du média n'a pas
         la forme d'une adresse publique Supabase : lien signé, domaine
         personnalisé, ou passage par une route interne. On montre le début de
         l'adresse, c'est la seule façon de savoir laquelle des trois. */
      noter("adresse non reconnue", src.slice(0, 64));
      connus.set(src, false);
      continue;
    }

    enCours.add(src);
    try {
      const blob = await proxyDeLUrl(src, (part) => ev?.onAvance?.({ rang: i + 1, total: manquants.length, part }));
      if (!blob) { connus.set(src, false); continue; } // rien à faire, ou illisible
      const envoye = await televerser(place.bucket, place.chemin, blob);
      if (!envoye) noter("dépôt refusé par le stockage", place.bucket + "/" + place.chemin);
      connus.set(src, envoye);
      if (envoye) { faits++; ev?.onPret?.(src); }
    } catch (e) {
      noter("fabrication", e);
      connus.set(src, false);
    } finally {
      enCours.delete(src);
    }
  }
  return faits;
}

/* Où en sont les copies, en une ligne lisible.

   Posé dans le compteur de performance plutôt que dans un coin à part : c'est
   l'endroit qu'on regarde déjà quand on se demande pourquoi ça rame, et une
   information de diagnostic qu'il faut aller chercher ailleurs ne se consulte
   jamais. */
export function resumeProxys(): string {
  let prets = 0, sans = 0;
  connus.forEach((present) => { if (present) prets++; else sans++; });
  const total = prets + sans;
  if (enCours.size > 0) return prets + "/" + total + " · fabrication";
  if (total === 0) return "pas commencé";
  if (prets === 0) return "aucune · " + (derniereRaison || sans + " sans copie");
  return prets + "/" + total + " prêtes";
}

/** Enregistre un proxy fabriqué à l'import, pour que l'aperçu s'en serve sans
 *  attendre un nouveau recensement. */
export function declarerProxy(src: string, present: boolean): void {
  connus.set(src, present);
}
