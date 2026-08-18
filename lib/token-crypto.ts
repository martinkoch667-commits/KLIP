// Chiffrement au repos des jetons d'accès Instagram.
//
// Ces jetons permettent de publier sur le compte Instagram d'un client : une
// fuite de la base, ou de la clé de service Supabase, ne doit pas suffire à en
// faire usage. Le RLS protège déjà un utilisateur d'un autre ; ceci protège
// contre la lecture brute de la table.
//
// La clé vient de TOKEN_ENCRYPTION_KEY, à défaut de BYOK_ENCRYPTION_KEY (32
// octets en hexadécimal : `openssl rand -hex 32`). Module distinct de
// lib/crypto.ts à dessein : le BYOK garde sa clé et son format, et rien de ce
// qui suit ne peut le casser.
//
// COMPATIBILITÉ : les jetons déjà enregistrés en clair restent lisibles —
// `openToken` les reconnaît et les renvoie tels quels. Sans clé configurée,
// `sealToken` écrit en clair comme avant plutôt que de faire échouer une
// connexion Instagram ; l'avertissement dans les logs dit quoi faire.
import crypto from "crypto";

const ALGO = "aes-256-gcm";
/** Marque un jeton chiffré. Un jeton Meta n'a jamais cette forme. */
const PREFIX = "encv1:";

let warned = false;

function key(): Buffer | null {
  const raw = (process.env.TOKEN_ENCRYPTION_KEY ?? process.env.BYOK_ENCRYPTION_KEY)?.trim();
  if (!raw) return null;
  const k = Buffer.from(raw, "hex");
  if (k.length !== 32) {
    console.error("[token-crypto] clé invalide : 32 octets hex attendus (openssl rand -hex 32).");
    return null;
  }
  return k;
}

/** Le chiffrement est-il opérationnel ? (utilisé par le diagnostic) */
export function tokenCryptoReady(): boolean {
  return key() !== null;
}

/** Ce jeton stocké est-il chiffré ? */
export function isSealed(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}

/** Jeton en clair → forme à stocker. Sans clé : renvoyé tel quel. */
export function sealToken(plain: string): string;
export function sealToken(plain: string | null | undefined): string | null;
export function sealToken(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === "") return null;
  if (isSealed(plain)) return plain; // déjà chiffré, ne pas superposer
  const k = key();
  if (!k) {
    if (!warned) {
      warned = true;
      console.warn("[token-crypto] TOKEN_ENCRYPTION_KEY absente : les jetons Instagram sont stockés EN CLAIR.");
    }
    return plain;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, k, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + [iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** Forme stockée → jeton en clair. Le legacy non chiffré passe tel quel. */
export function openToken(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined || stored === "") return null;
  if (!isSealed(stored)) return stored; // jeton d'avant le chiffrement
  const k = key();
  if (!k) {
    // Refuser franchement : renvoyer la charge chiffrée à l'API Meta ne
    // produirait qu'une erreur d'authentification incompréhensible.
    throw new Error("[token-crypto] jeton chiffré mais TOKEN_ENCRYPTION_KEY absente — restaure la clé.");
  }
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  const decipher = crypto.createDecipheriv(ALGO, k, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
