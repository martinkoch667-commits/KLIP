// Garde-fou anti-emballement sur les routes IA.
//
// Ce n'est PAS un quota commercial : les seuils sont assez hauts pour qu'aucun
// usage humain ne les touche, y compris une création en lot. Ce qu'ils arrêtent,
// c'est une boucle partie en vrille dans le front ou un script — le scénario où
// l'on découvre la facture Gemini trois jours plus tard.
//
// Compteur en mémoire, volontairement : appelé depuis le middleware (runtime
// edge), sans base ni service tiers, et sans ajouter d'aller-retour à chaque
// requête. La contrepartie est qu'il est propre à chaque instance — un client
// réparti sur plusieurs instances obtient donc un peu plus que la limite
// affichée. Sans importance ici : une boucle tape des centaines d'appels par
// minute et reste bloquée quoi qu'il arrive, tandis qu'un humain n'approche
// jamais du seuil. Le plafond journalier global (lib/ai-budget) est, lui,
// partagé entre toutes les instances et sert de vraie ceinture.

/** Routes de génération d'images — les seules réellement coûteuses. */
const IMAGE_ROUTES = ["/api/generate-image"];

/** Autres routes IA : texte, mise en page, montage. Coût par appel négligeable. */
const TEXT_ROUTES = [
  "/api/generate-description",
  "/api/compose-layout",
  "/api/compose-carousel",
  "/api/montage-ai",
  "/api/montage-chat",
  "/api/montage-director",
  "/api/visual-qa",
  "/api/instagram/analyze-style",
];

const WINDOW_MS = 60_000;
/** Assez large pour une création en lot ; très en-dessous d'une boucle. */
const IMAGE_MAX = Number(process.env.AI_RATE_IMAGES_PER_MIN ?? 30);
const TEXT_MAX = Number(process.env.AI_RATE_TEXT_PER_MIN ?? 60);

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Quel plafond s'applique à ce chemin ? `null` = route non concernée. */
export function aiLimitFor(pathname: string): { kind: "image" | "text"; max: number } | null {
  if (IMAGE_ROUTES.some(r => pathname.startsWith(r))) return { kind: "image", max: IMAGE_MAX };
  if (TEXT_ROUTES.some(r => pathname.startsWith(r))) return { kind: "text", max: TEXT_MAX };
  return null;
}

/** Consomme un jeton. `ok: false` → la requête doit être refusée en 429. */
export function consume(userId: string, kind: string, max: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const key = `${kind}:${userId}`;
  const b = buckets.get(key);

  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 5_000) sweep(now); // borne la mémoire sur une instance chaude
    return { ok: true, retryAfterSec: 0 };
  }

  b.count += 1;
  if (b.count > max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}

function sweep(now: number): void {
  // forEach plutôt qu'un for..of : la cible TypeScript du projet n'autorise pas
  // l'itération directe d'une Map.
  const perimes: string[] = [];
  buckets.forEach((v, k) => { if (now >= v.resetAt) perimes.push(k); });
  perimes.forEach(k => buckets.delete(k));
}
