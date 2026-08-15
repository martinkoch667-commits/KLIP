// Garde anti-SSRF partagé par toutes les routes qui vont chercher une URL
// fournie par l'utilisateur (proxy d'image, analyse d'un site de marque…).
// Sans lui, ces routes deviennent une passerelle vers le réseau interne :
// métadonnées cloud, services en localhost, plages privées.

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '0.0.0.0' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '169.254.169.254') return true;            // métadonnées cloud
  if (/^127\./.test(h)) return true;                    // loopback
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;               // link-local
  if (h === '::1' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true;
  return false;
}

/**
 * Normalise une saisie utilisateur en URL http(s) sûre.
 * Accepte « exemple.fr » aussi bien que « https://exemple.fr/a-propos ».
 * Renvoie null si le schéma n'est pas http(s) ou si l'hôte est interne.
 */
export function toSafeHttpUrl(raw: string): URL | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname || !url.hostname.includes('.')) return null;
  if (isBlockedHost(url.hostname)) return null;
  return url;
}

/** fetch borné en temps ET en taille : une page hostile ne doit pas nous tenir. */
export async function fetchTextCapped(
  url: string,
  { timeoutMs = 8000, maxBytes = 1_500_000, accept = 'text/html,*/*;q=0.8' } = {},
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: accept,
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
    });
    if (!res.ok || !res.body) return '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let out = '';
    let seen = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      seen += value.byteLength;
      out += decoder.decode(value, { stream: true });
      if (seen >= maxBytes) { await reader.cancel().catch(() => {}); break; }
    }
    return out;
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}
