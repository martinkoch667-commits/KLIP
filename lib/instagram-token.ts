// Cycle de vie des tokens Instagram.
//
// Un token « long-lived » Instagram vit 60 jours. Sans rafraîchissement, tous
// les comptes connectés cessent de publier deux mois après leur connexion, en
// silence : le cron marque simplement les posts en échec. On le rafraîchit donc
// périodiquement (cf. /api/cron/refresh-tokens), ce qui remet le compteur à 60
// jours à chaque appel — tant qu'il reste au moins un appel avant l'expiration,
// la connexion ne casse jamais.
//
// Contraintes de l'API Meta : le token doit avoir plus de 24 h et ne pas être
// expiré. Une fois expiré, seule une reconnexion OAuth le rétablit.

/** Durée de vie par défaut si Meta ne renvoie pas expires_in (60 jours). */
const DEFAULT_TTL_SECONDS = 60 * 24 * 60 * 60;

export interface RefreshedToken {
  accessToken: string;
  expiresAt: string; // ISO
}

export type RefreshResult =
  | { ok: true; token: RefreshedToken }
  | { ok: false; error: string; expired: boolean };

/** Date d'expiration ISO à partir d'un expires_in en secondes. */
export function expiryFromNow(expiresInSeconds?: number | null): string {
  const ttl = typeof expiresInSeconds === "number" && expiresInSeconds > 0
    ? expiresInSeconds
    : DEFAULT_TTL_SECONDS;
  return new Date(Date.now() + ttl * 1000).toISOString();
}

/**
 * Échange un token long-lived encore valide contre un nouveau, reparti pour
 * 60 jours.
 */
export async function refreshInstagramToken(accessToken: string): Promise<RefreshResult> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken.trim()}`
    );
    const data = await res.json();

    if (!data.access_token) {
      // Code 190 = token invalide ou expiré : le rafraîchissement ne peut plus
      // rien, il faut que l'utilisateur reconnecte son compte.
      const code = data?.error?.code;
      const expired = code === 190 || res.status === 400;
      return {
        ok: false,
        error: data?.error?.message ?? `Rafraîchissement refusé (HTTP ${res.status})`,
        expired,
      };
    }

    return {
      ok: true,
      token: {
        accessToken: (data.access_token as string).trim(),
        expiresAt: expiryFromNow(data.expires_in),
      },
    };
  } catch (err) {
    // Erreur réseau : on ne conclut pas à une expiration, le prochain passage
    // du cron réessaiera.
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur réseau",
      expired: false,
    };
  }
}
