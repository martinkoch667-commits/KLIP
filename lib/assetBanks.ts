// Banques d'éléments graphiques de l'éditeur.
//
// POURQUOI CE MODULE EXISTE À PART DE LA ROUTE. Le contenu de ces banques change
// sans prévenir et chacune a sa forme de réponse ; on veut pouvoir l'éprouver
// hors de Next, avec un simple `node`, plutôt que de découvrir en production
// qu'un champ a été renommé. La route `/api/assets` n'est qu'une enveloppe.
//
// CE QUI A DÉCIDÉ DU CHOIX DES BANQUES, et ce n'est pas le catalogue :
// la licence doit permettre qu'un CLIENT de KLIP pose l'élément dans son visuel
// puis le publie. Ça élimine la plupart des banques connues. Vérifié le
// 2026-09-03 : la licence « Tools » d'Envato l'interdit noir sur blanc, et
// Rawpixel, souvent cité, n'a tout simplement PAS d'API — les outils qui
// circulent scrapent son site. On va donc chercher le même domaine public à sa
// source : le Met et le Smithsonian, qui le publient en CC0 avec une vraie API.

export type AssetItem = {
  id: string;
  /** Vignette pour la grille du panneau. */
  thumb: string;
  /** Image à poser sur le canevas. */
  full: string;
  alt: string;
  /** Banque d'origine, affichée sous la vignette : l'utilisateur doit savoir
   *  d'où vient ce qu'il pose dans un visuel qu'il va publier. */
  source: string;
  /** Mention à afficher quand la licence l'exige (jamais pour du CC0). */
  credit?: string;
};

export type AssetSource = 'musee' | 'iconscout';

/** Ce qu'IconScout sait servir. C'est CE choix qui fait la différence entre
 *  « encore des icônes » et une vraie bibliothèque : les illustrations et les
 *  3D sont le gros du catalogue, les icônes n'en sont qu'une porte d'entrée. */
export type AssetKind = 'illustration' | '3d' | 'icon' | 'lottie';
export const KINDS: { id: AssetKind; label: string }[] = [
  { id: 'illustration', label: 'Illustrations' },
  { id: '3d', label: '3D' },
  { id: 'icon', label: 'Icônes' },
  { id: 'lottie', label: 'Animations' },
];

/** Styles proposés dans le panneau. Relevés sur la doc IconScout ; on n'en
 *  garde que ceux qui parlent au social — `sticker` et `doodle` sont exactement
 *  ce que cherchent les comptes qui ne veulent pas avoir l'air fabriqués. */
export const STYLES: { id: string; label: string }[] = [
  { id: '', label: 'Tous' },
  { id: 'sticker', label: 'Stickers' },
  { id: 'doodle', label: 'Doodle' },
  { id: 'flat', label: 'Plat' },
  { id: 'gradient', label: 'Dégradé' },
  { id: 'isometric', label: 'Isométrique' },
  { id: 'line', label: 'Trait' },
];

const vide = (): AssetItem[] => [];

// ── Domaine public : The Met ────────────────────────────────────────────────
//
// Aucune clé, 406 000 images en CC0. Le piège : la recherche ne rend que des
// IDENTIFIANTS, il faut une requête par objet. On borne donc à `limite` objets
// et on les demande en parallèle, sinon un panneau met dix secondes à s'ouvrir.
async function chercherMet(q: string, limite: number): Promise<AssetItem[]> {
  const base = 'https://collectionapi.metmuseum.org/public/collection/v1';
  const r = await fetch(`${base}/search?q=${encodeURIComponent(q)}&hasImages=true`);
  if (!r.ok) throw new Error(`Met ${r.status}`);
  const { objectIDs } = (await r.json()) as { objectIDs: number[] | null };
  const ids = (objectIDs ?? []).slice(0, limite);

  const objets = await Promise.all(ids.map(async (id) => {
    try {
      const o = await fetch(`${base}/objects/${id}`);
      if (!o.ok) return null;
      return (await o.json()) as {
        objectID: number; isPublicDomain: boolean; title?: string;
        artistDisplayName?: string; primaryImage?: string; primaryImageSmall?: string;
      };
    } catch { return null; }
  }));

  return objets.flatMap((o) => {
    // `isPublicDomain` est la seule garantie que l'image est réutilisable : le
    // Met sert aussi des œuvres sous droits, avec image, dans la même API.
    if (!o || !o.isPublicDomain || !o.primaryImageSmall) return [];
    return [{
      id: `met-${o.objectID}`,
      thumb: o.primaryImageSmall,
      full: o.primaryImage || o.primaryImageSmall,
      alt: [o.title, o.artistDisplayName].filter(Boolean).join(' · ') || q,
      source: 'The Met · domaine public',
    }];
  });
}

// ── Domaine public : Smithsonian ────────────────────────────────────────────
//
// 2,8 M images, CC0 pour les objets marqués tels quels. Demande une clé
// gratuite (api.data.gov). Sans clé on ne casse rien : on rend une liste vide
// et le Met porte le panneau tout seul.
async function chercherSmithsonian(q: string, limite: number, cle?: string): Promise<AssetItem[]> {
  if (!cle) return vide();
  const url = `https://api.si.edu/openaccess/api/v1.0/search`
    + `?q=${encodeURIComponent(`${q} AND online_media_type:"Images"`)}`
    + `&rows=${limite}&api_key=${encodeURIComponent(cle)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Smithsonian ${r.status}`);
  const data = await r.json() as {
    response?: { rows?: Array<{ id: string; title?: string; content?: { descriptiveNonRepeating?: {
      online_media?: { media?: Array<{ content?: string; thumbnail?: string; usage?: { access?: string } }> } } } }> }
  };

  return (data.response?.rows ?? []).flatMap((row) => {
    const media = row.content?.descriptiveNonRepeating?.online_media?.media?.[0];
    // « CC0 » est la seule valeur d'usage qui autorise le commercial sans
    // attribution ; tout le reste du fonds reste sous conditions.
    if (!media?.thumbnail || media.usage?.access !== 'CC0') return [];
    return [{
      id: `si-${row.id}`,
      thumb: media.thumbnail,
      full: media.content || media.thumbnail,
      alt: row.title || q,
      source: 'Smithsonian · CC0',
    }];
  });
}

// ── IconScout ───────────────────────────────────────────────────────────────
//
// Illustrations, 3D et Lottie, au-delà des icônes d'Iconify. Palier gratuit
// annoncé à 2000 crédits par mois ; les tarifs au-dessus ne sont pas publics,
// il faut les demander. Sans identifiants, le panneau se rabat en silence.
async function chercherIconScout(q: string, limite: number, kind: AssetKind, style?: string, gratuitSeul = true, page = 1): Promise<AssetItem[]> {
  const id = process.env.ICONSCOUT_CLIENT_ID;
  if (!id) return vide();

  // La RECHERCHE ne demande que le Client-ID, et elle est GRATUITE : « searching
  // and browsing are free, you only spend credits when you download ». Le
  // panneau peut donc se remplir et se feuilleter sans entamer le quota.
  //
  // `query` peut être VIDE : l'API parcourt alors tout le catalogue. C'est ce
  // qui remplit le panneau à l'ouverture au lieu d'attendre qu'on tape un mot.
  const p = new URLSearchParams({ asset: kind, per_page: String(limite), page: String(page), sort: q ? 'relevant' : 'popular' });
  if (q) p.set('query', q);
  if (style) p.append('styles[]', style);
  // LE FILTRE QUI DIVISE LE CATALOGUE PAR DEUX CENTS. Mesuré sur « food » :
  // 3D 256 gratuits contre 53 222 en tout, illustrations 229 contre 45 314,
  // icônes 13 307 contre 798 951. C'est ce filtre, et lui seul, qui donnait
  // l'impression d'une bibliothèque vide.
  //
  // On le garde par DÉFAUT quand même : l'aperçu d'un élément premium n'a
  // aucun filigrane, donc rien n'empêcherait un client de le poser et de
  // publier un visuel non licencié. Un premium doit passer par leur point
  // d'entrée de téléchargement (1 crédit pour une icône, 10 pour une
  // illustration, 15 pour une 3D), ce que le panneau ne fait pas encore.
  if (gratuitSeul) p.set('price', 'free');

  const r = await fetch(`https://api.iconscout.com/v3/search?${p}`, { headers: { 'Client-ID': id } });
  if (!r.ok) throw new Error(`IconScout ${r.status}`);

  // ATTENTION : LEUR DOCUMENT OPENAPI EST FAUX.
  //
  // `cdn.iconscout.com/openapi.json` annonce `{ status: true, data: { items:
  // { data: [...] } } }` et des champs `image`, `is_premium`, `urls.png_512`.
  // La VRAIE réponse, relevée en appelant l'API le 2026-09-03, est
  // `{ status: "success", response: { items: { data: [...] } } }`, et un élément
  // ne porte que `id`, `uuid`, `asset`, `name`, `slug`, `price`, `urls.thumb`.
  // Avoir suivi leur spec avait produit un panneau vide sans la moindre erreur.
  // On lit donc le réel, avec la forme documentée en simple repli.
  const json = await r.json() as Record<string, unknown>;
  type Item = { id?: number; uuid?: string; name?: string; price?: number;
    urls?: { thumb?: string; png_256?: string; png_128?: string; png_64?: string } };
  const conteneur = (json.response ?? json.data) as { items?: { data?: Item[] } } | undefined;
  const liste = conteneur?.items?.data ?? [];

  if (liste.length === 0) {
    console.warn('[assets] IconScout : liste vide. Racine reçue =', Object.keys(json));
    return vide();
  }

  return liste.flatMap((it) => {
    // LES CHAMPS D'URL CHANGENT SELON LE TYPE D'ÉLÉMENT, et rien ne le dit :
    // une illustration ou une 3D portent `thumb` (451 x 450 px), une icône
    // porte `png_64/128/256` et PAS de `thumb`. Ne lire que `thumb` rendait
    // zéro icône, sans la moindre erreur. On prend donc la plus grande
    // disponible, quel que soit le type.
    //
    // Ces tailles suffisent à poser l'élément sur un visuel. Les formats
    // supérieurs passeraient par leur point d'entrée de téléchargement, qui
    // coûte un crédit et exige le Client-Secret. On s'en passe.
    const u = it.urls ?? {};
    const url = u.thumb || u.png_256 || u.png_128 || u.png_64;
    if (!url) return [];
    const gratuit = it.price === 0;
    return [{
      id: `is-${it.uuid ?? it.id}`,
      thumb: url,
      full: url,
      alt: it.name || q || 'élément',
      source: gratuit ? 'IconScout · gratuit' : 'IconScout · premium',
      credit: 'IconScout',
    }];
  });
}

/**
 * Cherche dans une banque. Ne jette jamais : un panneau d'éditeur qui tombe en
 * erreur parce qu'un fournisseur est indisponible est pire qu'un panneau vide.
 * L'appelant reçoit `erreurs` pour pouvoir le dire à l'écran.
 */
export async function chercherAssets(
  source: AssetSource,
  q: string,
  limite = 24,
  kind: AssetKind = 'illustration',
  style?: string,
  gratuitSeul = true,
  page = 1,
): Promise<{ items: AssetItem[]; erreurs: string[] }> {
  const erreurs: string[] = [];
  const sur = async (nom: string, p: Promise<AssetItem[]>) => {
    try { return await p; } catch (e) {
      erreurs.push(`${nom} : ${e instanceof Error ? e.message : String(e)}`);
      return vide();
    }
  };

  if (source === 'iconscout') {
    return { items: await sur('IconScout', chercherIconScout(q, limite, kind, style, gratuitSeul, page)), erreurs };
  }

  // Les deux fonds de domaine public sont interrogés ENSEMBLE et entrelacés :
  // servis l'un après l'autre, la grille montrait vingt gravures du Met avant
  // la première image du Smithsonian, et le second fonds n'existait pas pour
  // qui ne fait pas défiler.
  const moitie = Math.ceil(limite / 2);
  const [met, si] = await Promise.all([
    sur('Met', chercherMet(q, moitie)),
    sur('Smithsonian', chercherSmithsonian(q, moitie, process.env.SMITHSONIAN_API_KEY)),
  ]);
  const items: AssetItem[] = [];
  for (let i = 0; i < Math.max(met.length, si.length); i++) {
    if (met[i]) items.push(met[i]);
    if (si[i]) items.push(si[i]);
  }
  return { items: items.slice(0, limite), erreurs };
}
