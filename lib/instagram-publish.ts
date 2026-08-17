// Publication Instagram — logique partagée entre la publication manuelle
// (/api/publish/instagram) et le cron de publication programmée (/api/cron/publish).
//
// Historiquement les deux routes avaient leur propre implémentation : le cron ne
// savait publier que des images, si bien qu'un reel ou un carrousel programmé
// échouait silencieusement alors que le même post publié à la main passait.
// Tout passe désormais par ce module — un seul chemin, un seul comportement.
//
// Flux « Instagram API with Instagram Login » : les appels se font sur
// graph.instagram.com/me/media avec le token du compte, sans ID de Page.

const GRAPH = "https://graph.instagram.com/v21.0";

export type PublishedMediaType = "image" | "reels" | "carousel" | "story";

export interface PublishablePost {
  id: string;
  title?: string | null;
  description?: string | null;
  post_type?: string | null;
  photo_url?: string | null;
  exported_image_url?: string | null;
  editor_json?: string | null;
}

export type PublishResult =
  | { ok: true; instagramPostId: string; type: PublishedMediaType }
  | { ok: false; error: string };

/** Détecte une vidéo à l'extension de l'URL. */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|mov|avi|webm)(\?|$)/i.test(url);
}

/** URL du média à publier : l'export de l'éditeur prime sur la photo d'origine. */
export function mediaUrlOf(post: PublishablePost): string | null {
  return post.exported_image_url || post.photo_url || null;
}

/** Slides d'un carrousel, stockées par l'éditeur dans editor_json. */
function carouselUrlsOf(post: PublishablePost): string[] {
  if (!post.editor_json) return [];
  try {
    const parsed = JSON.parse(post.editor_json);
    const urls = parsed?.carousel_urls;
    return Array.isArray(urls) ? urls.filter((u: unknown) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

async function graphPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<Record<string, unknown> & { id?: string; error?: { message?: string } }>;
}

/**
 * Attend qu'un container vidéo (reel ou story vidéo) soit traité par Instagram.
 * L'encodage prend couramment 30 à 90 s ; on laisse jusqu'à 150 s, ce qui reste
 * sous le maxDuration de 300 s des routes appelantes.
 */
async function waitForVideoReady(
  containerId: string,
  token: string,
  { maxAttempts = 30, intervalMs = 5000 }: { maxAttempts?: number; intervalMs?: number } = {}
): Promise<{ ready: boolean; status: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${token}`);
    const data = await res.json();
    const status: string = data.status_code ?? "IN_PROGRESS";
    console.log(`[IG Publish] container ${containerId} — ${i + 1}/${maxAttempts} : ${status}`);
    if (status === "FINISHED") return { ready: true, status };
    if (status === "ERROR" || status === "EXPIRED") return { ready: false, status };
  }
  return { ready: false, status: "TIMEOUT" };
}

/**
 * Étape finale commune : publier un container déjà prêt. Le type de média est
 * ajouté par l'appelant, qui seul le connaît.
 */
async function publishContainer(
  creationId: string,
  token: string,
  type: PublishedMediaType
): Promise<PublishResult> {
  const data = await graphPost("me/media_publish", { creation_id: creationId, access_token: token });
  console.log("[IG Publish] media_publish :", JSON.stringify(data));
  if (!data.id) {
    return { ok: false, error: data.error?.message ?? "Échec de la publication Instagram" };
  }
  return { ok: true, instagramPostId: data.id, type };
}

/**
 * Détermine le type de média à publier à partir du post_type et de l'URL.
 * Un post_type « story » avec une vidéo part bien en story vidéo (et non en
 * reel, comme le faisait l'ancienne implémentation qui testait la vidéo avant
 * le type de post).
 */
export function resolveMediaType(post: PublishablePost): PublishedMediaType {
  const isVideo = isVideoUrl(mediaUrlOf(post));
  const postType = post.post_type ?? "post";
  if (postType === "story") return "story";
  if (isVideo) return "reels";
  // Le carrousel n'est plus un type choisi en amont : une publication en devient un
  // dès que l'éditeur a exporté plusieurs pages. Le type « carrousel » des posts
  // créés avant cette fusion passe donc par le même chemin.
  if (postType !== "reel" && carouselUrlsOf(post).length >= 2) return "carousel";
  return "image";
}

/**
 * Publie un post sur Instagram. Ne touche pas la base : l'appelant décide quoi
 * enregistrer et quelle notification envoyer.
 */
export async function publishPostToInstagram(
  post: PublishablePost,
  accessToken: string
): Promise<PublishResult> {
  const token = accessToken.trim();
  const mediaUrl = mediaUrlOf(post);
  const type = resolveMediaType(post);
  const caption = post.description ?? "";

  if (type !== "carousel" && !mediaUrl) {
    return { ok: false, error: "Aucun média à publier pour ce post" };
  }

  console.log(`[IG Publish] post ${post.id} — type ${type} — ${mediaUrl?.slice(0, 80) ?? "(carrousel)"}`);

  try {
    // ── Carrousel ────────────────────────────────────────────────────────────
    if (type === "carousel") {
      const urls = carouselUrlsOf(post);
      const itemIds: string[] = [];
      for (const imageUrl of urls) {
        const item = await graphPost("me/media", {
          image_url: imageUrl,
          is_carousel_item: true,
          access_token: token,
        });
        if (!item.id) {
          return { ok: false, error: item.error?.message ?? "Échec de création d'une slide du carrousel" };
        }
        itemIds.push(item.id);
      }

      const container = await graphPost("me/media", {
        media_type: "CAROUSEL",
        children: itemIds.join(","),
        caption,
        access_token: token,
      });
      if (!container.id) {
        return { ok: false, error: container.error?.message ?? "Échec de création du carrousel" };
      }

      await new Promise((r) => setTimeout(r, 5000));
      return publishContainer(container.id, token, type);
    }

    // ── Story (image ou vidéo) ───────────────────────────────────────────────
    if (type === "story") {
      const isVideo = isVideoUrl(mediaUrl);
      const container = await graphPost("me/media", {
        media_type: "STORIES",
        ...(isVideo ? { video_url: mediaUrl } : { image_url: mediaUrl }),
        access_token: token,
      });
      if (!container.id) {
        return { ok: false, error: container.error?.message ?? "Échec de création de la story" };
      }

      if (isVideo) {
        const { ready, status } = await waitForVideoReady(container.id, token);
        if (!ready) {
          return { ok: false, error: `Instagram n'a pas pu traiter la vidéo (statut : ${status})` };
        }
      } else {
        await new Promise((r) => setTimeout(r, 5000));
      }

      return publishContainer(container.id, token, type);
    }

    // ── Reel ─────────────────────────────────────────────────────────────────
    if (type === "reels") {
      const container = await graphPost("me/media", {
        media_type: "REELS",
        video_url: mediaUrl,
        caption,
        share_to_feed: true,
        access_token: token,
      });
      if (!container.id) {
        return { ok: false, error: container.error?.message ?? "Échec de création du reel" };
      }

      const { ready, status } = await waitForVideoReady(container.id, token);
      if (!ready) {
        return { ok: false, error: `Instagram n'a pas pu traiter la vidéo (statut : ${status})` };
      }

      return publishContainer(container.id, token, type);
    }

    // ── Image simple ─────────────────────────────────────────────────────────
    const container = await graphPost("me/media", {
      image_url: mediaUrl,
      caption,
      access_token: token,
    });
    if (!container.id) {
      return { ok: false, error: container.error?.message ?? "Échec de création du média" };
    }

    await new Promise((r) => setTimeout(r, 5000));
    return publishContainer(container.id, token, type);
  } catch (err) {
    console.error(`[IG Publish] post ${post.id} — erreur inattendue`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
  }
}
