// lib/canva.ts : le client de l'API Connect de Canva.
//
// CE QUE CETTE API SAIT FAIRE, ET CE QU'ELLE NE SAIT PAS
// Elle sait lister les designs d'un utilisateur, en donner les métadonnées et
// les vignettes, et les EXPORTER. Elle ne donne AUCUN accès au contenu d'un
// design : ni calques, ni textes, ni positions. Cette lecture-là existe, mais
// dans l'Apps SDK, c'est-à-dire à l'intérieur d'une iframe hébergée par Canva,
// hors d'atteinte d'un serveur. Toute promesse d'import structurel passe donc
// par l'export PDF, que `lib/pdfStructure.ts` relit.
//
// CE QU'ON NE PREND PAS, VOLONTAIREMENT
//  · les Brand Templates : leur API exige que le DÉVELOPPEUR soit membre d'une
//    organisation Canva Enterprise, ET chaque utilisateur aussi. Aucun des
//    clients de KLIP ne l'est. Une intégration qui en dépend ne pourrait pas
//    être livrée ;
//  · les fonctionnalités en avant-première : une intégration publique qui en
//    utilise ne passe pas la revue de Canva.
//
// PRÉ-REQUIS QUI N'EST PAS DU CODE
// Pour qu'un client puisse connecter son Canva, l'intégration doit être PUBLIQUE
// et avoir passé la revue de Canva. Une intégration privée est réservée aux
// membres d'une organisation Enterprise. En attendant la revue, seul le compte
// Canva du développeur peut autoriser l'intégration : de quoi tout mettre au
// point, pas de quoi ouvrir à un client.

import crypto from 'crypto';

const AUTH_URL = 'https://www.canva.com/api/oauth/authorize';
const TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';
const API = 'https://api.canva.com/rest/v1';

/**
 * Les permissions demandées, et rien de plus.
 *
 * Chaque portée doit être justifiée à la revue, et une portée demandée sans
 * code correspondant fait rejeter la soumission. C'est la même règle que côté
 * Meta, où elle a déjà coûté un aller-retour.
 *  · design:meta:read  : lister les designs et lire leurs vignettes ;
 *  · design:content:read : créer un export (c'est cette portée qui l'autorise).
 */
export const CANVA_SCOPES = ['design:meta:read', 'design:content:read'] as const;

export interface CanvaTokens {
  accessToken: string;
  refreshToken: string;
  /** Instant d'expiration, en millisecondes. */
  expiresAt: number;
}

function clientId(): string { return (process.env.CANVA_CLIENT_ID ?? '').trim(); }
function clientSecret(): string { return (process.env.CANVA_CLIENT_SECRET ?? '').trim(); }

/** L'intégration est-elle configurée ? Le dire tôt évite un OAuth qui échoue au retour. */
export function canvaReady(): boolean {
  return !!clientId() && !!clientSecret();
}

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Un verrou de session PKCE : le secret reste chez nous, seul son haché part. */
export function makePkce(): { verifier: string; challenge: string } {
  const verifier = b64url(crypto.randomBytes(48)); // 64 caracteres, dans les bornes 43-128
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function authorizeUrl(o: { challenge: string; state: string; redirectUri: string }): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    response_type: 'code',
    code_challenge: o.challenge,
    // Canva attend cette valeur en minuscules. Un « S256 » majuscule est refusé.
    code_challenge_method: 's256',
    scope: CANVA_SCOPES.join(' '),
    state: o.state,
    redirect_uri: o.redirectUri,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

async function token(body: Record<string, string>): Promise<CanvaTokens> {
  // Canva recommande l'authentification basique plutôt que le secret dans le
  // corps ; et de toute façon un secret ne peut pas partir du navigateur, ces
  // appels sont interdits de CORS.
  const basic = Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.access_token) {
    throw new Error(`Canva ${r.status} : ${j?.error_description ?? j?.error ?? 'jeton refusé'}`);
  }
  return {
    accessToken: String(j.access_token),
    refreshToken: String(j.refresh_token ?? ''),
    // Une minute de marge : un jeton qui expire pendant l'appel qu'il autorise
    // ressort en 401 inexplicable au milieu d'un import.
    expiresAt: Date.now() + (Number(j.expires_in) || 14400) * 1000 - 60_000,
  };
}

export function exchangeCode(o: { code: string; verifier: string; redirectUri: string }): Promise<CanvaTokens> {
  return token({
    grant_type: 'authorization_code',
    code: o.code,
    code_verifier: o.verifier,
    redirect_uri: o.redirectUri,
  });
}

/**
 * Rafraîchit la session.
 *
 * ATTENTION, le point qui casse les intégrations Canva en production : le jeton
 * de rafraîchissement est à USAGE UNIQUE. Canva en rend un nouveau à chaque
 * appel et RÉVOQUE toute la session si un ancien est rejoué. Deux imports
 * lancés en parallèle sur un jeton expiré suffisent donc à déconnecter
 * l'utilisateur, avec le message « Refresh token used twice ». Tout appelant
 * doit réécrire le nouveau jeton immédiatement, et sérialiser ses
 * rafraîchissements.
 */
export function refreshTokens(refreshToken: string): Promise<CanvaTokens> {
  return token({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

// ── Appels ───────────────────────────────────────────────────────────────────

async function get<T>(accessToken: string, path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Canva ${r.status} sur ${path} : ${t.slice(0, 200)}`);
  }
  return r.json() as Promise<T>;
}

export interface CanvaDesign {
  id: string;
  title?: string;
  page_count?: number;
  created_at?: number;
  updated_at?: number;
  thumbnail?: { url: string; width: number; height: number };
  urls?: { edit_url?: string; view_url?: string };
}

/**
 * Les designs de l'utilisateur, page par page.
 *
 * `limit` plafonne à 100 côté Canva, et l'appel est limité à 100 par minute et
 * par utilisateur : un compte d'agence à deux mille designs se parcourt donc en
 * une vingtaine d'appels, pas en un seul. La pagination est rendue à l'appelant
 * plutôt que déroulée ici, pour que l'écran puisse afficher les premiers
 * résultats sans attendre les derniers.
 */
export async function listDesigns(accessToken: string, o: {
  query?: string;
  continuation?: string;
  limit?: number;
  ownership?: 'any' | 'owned' | 'shared';
  sortBy?: 'relevance' | 'modified_descending' | 'modified_ascending' | 'title_descending' | 'title_ascending';
} = {}): Promise<{ items: CanvaDesign[]; continuation: string | null }> {
  const p = new URLSearchParams();
  if (o.query) p.set('query', o.query.slice(0, 255));
  if (o.continuation) p.set('continuation', o.continuation);
  p.set('limit', String(Math.max(1, Math.min(o.limit ?? 50, 100))));
  p.set('ownership', o.ownership ?? 'owned');
  // Par défaut le plus récemment modifié : c'est ce qu'un community manager
  // cherche, et « relevance » sans recherche ne veut rien dire.
  p.set('sort_by', o.sortBy ?? (o.query ? 'relevance' : 'modified_descending'));
  const j = await get<{ items?: CanvaDesign[]; continuation?: string }>(accessToken, `/designs?${p.toString()}`);
  return { items: j.items ?? [], continuation: j.continuation ?? null };
}

/** Les formats d'export réellement possibles pour CE design. */
export async function exportFormats(accessToken: string, designId: string): Promise<string[]> {
  const j = await get<{ formats?: Record<string, unknown> }>(accessToken, `/designs/${encodeURIComponent(designId)}/export-formats`);
  return Object.keys(j.formats ?? {});
}

export type ExportType = 'pdf' | 'png' | 'jpg';

const dormir = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Exporte un design et rend les adresses de téléchargement.
 *
 * Deux formats, deux usages, et il faut les distinguer :
 *  · PNG : l'image finie. Elle sert de RÉFÉRENCE, ce qui marche à tous les
 *    coups et alimente le compositeur. C'est le chemin qui ne déçoit jamais ;
 *  · PDF : la structure. Elle sert à reconstruire un MODÈLE modifiable. C'est
 *    le chemin qui apporte le plus, et celui qui peut échouer (design aplati,
 *    texte vectorisé). D'où le rapport de confiance côté `canvaImport`.
 *
 * La création d'export est limitée à 10 appels par tranche de 10 secondes :
 * importer une bibliothèque entière se fait en file, jamais en rafale.
 */
export async function exportDesign(accessToken: string, o: {
  designId: string;
  type: ExportType;
  /** PNG seulement. Canva accepte de 40 à 25000. */
  width?: number;
  pages?: number[];
  /** Combien de temps attendre le rendu avant d'abandonner. */
  timeoutMs?: number;
}): Promise<string[]> {
  const format: Record<string, unknown> = { type: o.type };
  if (o.type === 'png' && o.width) format.width = Math.max(40, Math.min(o.width, 25000));
  if (o.pages?.length) format.pages = o.pages.slice(0, 60);

  const r = await fetch(`${API}/exports`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ design_id: o.designId, format }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.job?.id) {
    throw new Error(`Canva export ${r.status} : ${j?.message ?? 'refusé'}`);
  }

  const jobId = String(j.job.id);
  const fin = Date.now() + (o.timeoutMs ?? 60_000);
  // Attente qui s'allonge : un visuel simple sort en une seconde, un carrousel
  // de dix pages en dix. Interroger toutes les 500 ms brûlerait le quota.
  let attente = 900;
  for (;;) {
    await dormir(attente);
    const s = await get<{ job?: { status?: string; urls?: string[]; error?: { message?: string } } }>(
      accessToken, `/exports/${encodeURIComponent(jobId)}`);
    const st = s.job?.status;
    if (st === 'success') return s.job?.urls ?? [];
    if (st === 'failed') throw new Error(`Canva export échoué : ${s.job?.error?.message ?? 'sans détail'}`);
    if (Date.now() > fin) throw new Error("Canva export : délai dépassé, l'export n'était pas prêt.");
    attente = Math.min(attente * 1.5, 5000);
  }
}

/** Télécharge un résultat d'export. Les adresses ne valent que 24 heures. */
export async function fetchExport(url: string, maxOctets = 30 * 1024 * 1024): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Téléchargement de l'export : ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length > maxOctets) throw new Error('Export trop lourd');
  return buf;
}
