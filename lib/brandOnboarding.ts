// La chaîne complète « compte Instagram connecté → modèles de la marque ».
//
// POURQUOI ELLE EST ICI ET PAS DANS UN ÉCRAN. Cette suite d'appels n'existait
// que dans `/banc-adn`, recopiée à la main dans une page de test. Le produit ne
// l'exécutait nulle part : un client fraîchement créé n'avait donc aucun modèle,
// et le compositeur tirait au sort dans le catalogue général au lieu de partir
// de ce que la marque publie déjà. La mettre en module la rend appelable depuis
// l'onboarding, depuis le tableau de bord, et depuis le banc, sans divergence.
//
// ELLE TOURNE DANS LE NAVIGATEUR, et ce n'est pas un choix d'implémentation :
// `measureFeed` lit les pixels des publications dans un canvas. Côté serveur il
// n'y a pas de canvas, et faire transiter seize images par une fonction
// serverless coûterait bien plus cher que de les lire là où elles s'affichent
// déjà.

import { measureFeed, buildContactSheet, type BrandDNA, type FeedMetrics } from './brandDNA';

export type ModelePropose = {
  recipeId: string;
  name: string;
  intention: string;
  family: string;
  fields: Record<string, string>;
  format_id: string;
  elements: unknown[];
};

export type CharteAppliquee = {
  titre: string; texte: string; serif: string; condense: string; manuscrit: string;
  identiteTypo: string; identiteNom: string; titreDeLaCharte: boolean;
  couleurs: { marque: string; accent: string; papier: string; encre: string };
  source: { marque: string; accent: string; police: string };
};

export type PoliceImportee = { family: string; url: string; weight?: number };

export type LectureMarque = {
  dna: BrandDNA;
  applique: CharteAppliquee | null;
  /** Polices déposées par le client : hors catalogue, donc chargeables
   *  uniquement par leur adresse. */
  polices: PoliceImportee[];
  metrics: FeedMetrics;
  /** Les visuels lus, pour pouvoir les montrer à côté des propositions. */
  images: string[];
  modeles: ModelePropose[];
};

export type Etape =
  | 'compte' | 'pixels' | 'planche' | 'style' | 'modeles' | 'fini';

const ETIQUETTES: Record<Etape, string> = {
  compte: 'Lecture du compte',
  pixels: 'Mesure des visuels',
  planche: 'Planche contact',
  style: 'Lecture du style',
  modeles: 'Compositions de départ',
  fini: 'Terminé',
};
export const libelleEtape = (e: Etape) => ETIQUETTES[e];

async function json<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error ?? `${url} a refusé`);
  return j as T;
}

/**
 * Lit le compte Instagram d'un workspace et en tire des modèles.
 *
 * Ne jette que sur ce qui empêche vraiment de continuer : compte non connecté,
 * ou trop peu de visuels lisibles. Le reste remonte tel quel à l'appelant, qui
 * décide de l'afficher.
 */
export async function lireMarqueDepuisInstagram(opts: {
  workspaceId: string;
  name?: string | null;
  sector?: string | null;
  count?: number;
  /** Visuels fournis directement. La lecture du compte ne sert QU'À obtenir
   *  cette liste : en la donnant, on éprouve toute la chaîne sans OAuth, ce qui
   *  est indispensable en local où l'adresse de retour pointe sur la production
   *  et où la boucle d'autorisation ne peut pas se fermer. */
  images?: string[];
  onEtape?: (e: Etape) => void;
}): Promise<LectureMarque> {
  const dire = (e: Etape) => opts.onEtape?.(e);

  let images: string[];
  let prof: { name?: string | null } = {};
  if (opts.images?.length) {
    images = opts.images;
  } else {
    dire('compte');
    const r = await fetch(`/api/instagram/profile?workspaceId=${encodeURIComponent(opts.workspaceId)}`);
    prof = await r.json();
    if (!(prof as { connected?: boolean })?.connected) throw new Error("Ce compte Instagram n'est pas connecté.");
    images = ((prof as { media?: { display_url?: string }[] }).media ?? [])
      .map((m) => m.display_url)
      .filter((u): u is string => !!u);
  }
  // Trois visuels, c'est le plancher sous lequel une « couleur de marque » n'est
  // qu'une couleur de photo : la mesure ne discrimine plus rien.
  if (images.length < 3) throw new Error('Trop peu de publications lisibles pour lire un style.');

  dire('pixels');
  const metrics = await measureFeed(images);
  if (metrics.read < 3) {
    throw new Error(`Seulement ${metrics.read} visuel(s) lisible(s) : les images du compte ont été refusées.`);
  }

  dire('planche');
  const sheet = await buildContactSheet(images, { cols: 4, cell: 320, max: 16 });

  dire('style');
  const { dna } = await json<{ dna: BrandDNA }>('/api/brand-dna', {
    metrics, sheet, workspaceId: opts.workspaceId,
    name: opts.name ?? prof.name ?? null, sector: opts.sector ?? null,
  });

  dire('modeles');
  const { templates, applique, polices } = await json<{ templates: ModelePropose[]; applique: CharteAppliquee | null; polices: PoliceImportee[] }>('/api/brand-dna/templates', {
    dna, workspaceId: opts.workspaceId,
    name: opts.name ?? prof.name ?? null, sector: opts.sector ?? null,
    count: opts.count ?? 6,
  });

  dire('fini');
  return { dna, applique: applique ?? null, polices: polices ?? [], metrics, images, modeles: templates };
}

export type Rendu = { format_id: string; label: string; w: number; h: number; elements: unknown[] };
export type Variante = {
  recipeId: string; name: string; family: string; desc: string;
  fields: Record<string, string>; rendus: Rendu[];
};

export const FORMATS_SORTIE = [
  // Instagram publie aujourd'hui en 3:4 : c'est le defaut, pas le 4:5.
  { id: 'ig-portrait', label: 'Portrait 3:4' },
  { id: 'ig-45', label: 'Portrait 4:5' },
  { id: 'ig-square', label: 'Carré' },
  { id: 'ig-story', label: 'Story' },
] as const;

/**
 * Les variantes d'un modèle : d'autres compositions du même parti pris, rendues
 * dans chaque format demandé. Le choix des compositions est fait côté serveur,
 * et il est déterministe : c'est une question de parenté, pas de goût.
 */
export async function demanderVariantes(opts: {
  workspaceId: string; recipeId: string;
  fields?: Record<string, string>;
  formats?: string[]; count?: number;
}) {
  return json<{ variantes: Variante[]; polices?: PoliceImportee[]; applique?: { titre: string; texte: string; titreDeLaCharte: boolean } }>('/api/brand-dna/variantes', {
    workspaceId: opts.workspaceId, recipeId: opts.recipeId,
    fields: opts.fields ?? {}, formats: opts.formats ?? ['ig-portrait'], count: opts.count ?? 4,
  });
}

/**
 * Enregistre l'ADN mesuré sur le workspace.
 *
 * SANS CET APPEL, LA MESURE ÉTAIT JETÉE. L'ADN servait à proposer les modèles
 * puis disparaissait avec l'onglet : le compositeur, qui sait pourtant lire
 * `visual_dna` pour choisir le terrain et la typographie, repartait ensuite sur
 * une empreinte du NOM du client. On mesurait, et on n'en gardait rien.
 *
 * Ne jette jamais : la colonne peut ne pas exister encore en base (migration
 * 028), et ce n'est pas une raison pour casser un parcours de création.
 */
export async function enregistrerAdn(workspaceId: string, dna: BrandDNA): Promise<boolean> {
  try {
    await json('/api/brand-dna/save', { workspaceId, dna });
    return true;
  } catch (e) {
    console.warn('[adn] non enregistré :', e instanceof Error ? e.message : e);
    return false;
  }
}

/** Écrit les modèles retenus chez le client. Ils s'ajoutent, ils ne remplacent rien. */
export async function adopterModeles(workspaceId: string, modeles: ModelePropose[]) {
  return json<{ enregistres: number }>('/api/brand-dna/adopt', { workspaceId, templates: modeles });
}
