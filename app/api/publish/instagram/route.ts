import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createNotification } from "@/lib/notifications";

// ─── Helper: detect video by URL extension ────────────────────────────────────
function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|mov|avi|webm)(\?|$)/i.test(url);
}

// ─── Helper: poll Reels container status ──────────────────────────────────────
async function waitForReelsReady(
  containerId: string,
  igToken: string,
  maxAttempts = 12,
  intervalMs = 5000
): Promise<{ ready: boolean; status: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetch(
      `https://graph.instagram.com/v21.0/${containerId}?fields=status_code&access_token=${igToken}`
    );
    const data = await res.json();
    const status: string = data.status_code ?? "IN_PROGRESS";
    console.log(`[Publish Reels] attempt ${i + 1}/${maxAttempts} — status: ${status}`);
    if (status === "FINISHED") return { ready: true, status };
    if (status === "ERROR" || status === "EXPIRED") return { ready: false, status };
  }
  return { ready: false, status: "TIMEOUT" };
}

export async function POST(request: NextRequest) {
  try {
    const { postId, workspaceId } = await request.json();

    if (!postId || !workspaceId) {
      return NextResponse.json({ error: "postId et workspaceId requis" }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;

    // Load post and workspace
    const [{ data: post }, { data: workspace }] = await Promise.all([
      supabase.from("posts").select("*").eq("id", postId).single(),
      supabase.from("workspaces").select("*").eq("id", workspaceId).single(),
    ]);

    if (!post) {
      return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
    }

    if (!workspace?.instagram_account_id || !workspace?.instagram_access_token) {
      return NextResponse.json({ error: "Compte Instagram non connecté" }, { status: 400 });
    }

    const igId    = workspace.instagram_account_id;
    const igToken = (workspace.instagram_access_token as string).trim();

    console.log("[Publish] account_id:", igId);
    console.log("[Publish] token length:", igToken?.length);

    // ── Determine media type ───────────────────────────────────────────────────
    const mediaUrl   = post.exported_image_url || post.photo_url;
    const isVideo    = isVideoUrl(mediaUrl);
    const postType: string = post.post_type ?? 'post';
    const isStory    = postType === 'story' && !isVideo;
    const isCarousel = postType === 'carrousel' && !isVideo;

    // Parse carousel URLs from editor_json
    let carouselUrls: string[] = [];
    if (isCarousel && post.editor_json) {
      try {
        const editorData = JSON.parse(post.editor_json);
        carouselUrls = editorData.carousel_urls ?? [];
      } catch { /* ignore parse errors */ }
    }

    console.log(`[Publish] post_type: ${postType}, media_type: ${isVideo ? "REELS (video)" : isStory ? "STORIES" : isCarousel ? `CAROUSEL (${carouselUrls.length} slides)` : "IMAGE"}`, mediaUrl?.slice(0, 80));

    // ═══════════════════════════════════════════════════════════════════════════
    // REELS flow (video)
    // ═══════════════════════════════════════════════════════════════════════════
    if (isVideo) {
      // Step 1: Create Reels container
      const containerRes = await fetch("https://graph.instagram.com/v21.0/me/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type:    "REELS",
          video_url:     mediaUrl,
          caption:       post.description ?? "",
          share_to_feed: true,
          access_token:  igToken,
        }),
      });
      const containerData = await containerRes.json();
      console.log("[Publish Reels] container response:", JSON.stringify(containerData));

      if (!containerData.id) {
        return NextResponse.json(
          { error: containerData.error?.message ?? "Échec création du container Reels" },
          { status: 500 }
        );
      }

      // Step 2: Poll until FINISHED (max 60s)
      const { ready, status } = await waitForReelsReady(containerData.id, igToken);
      if (!ready) {
        return NextResponse.json(
          { error: `La vidéo n'a pas pu être traitée par Instagram (status: ${status})` },
          { status: 500 }
        );
      }

      // Step 3: Publish
      const publishRes = await fetch("https://graph.instagram.com/v21.0/me/media_publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id:  containerData.id,
          access_token: igToken,
        }),
      });
      const publishData = await publishRes.json();
      console.log("[Publish Reels] publish response:", JSON.stringify(publishData));

      if (!publishData.id) {
        return NextResponse.json(
          { error: publishData.error?.message ?? "Échec publication Reels" },
          { status: 500 }
        );
      }

      await supabase.from("posts").update({
        status: "published",
        instagram_post_id: publishData.id,
      }).eq("id", postId);

      if (userId) await createNotification({
        userId, workspaceId,
        type: 'post_published',
        title: 'Post publié',
        message: `« ${post.title ?? post.description?.slice(0, 40) ?? 'Sans titre'} » a été publié sur @${workspace.instagram_username ?? 'votre compte'}`,
        postId, postTitle: post.title ?? undefined,
      });

      return NextResponse.json({ success: true, instagramPostId: publishData.id, type: "reels" });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CAROUSEL flow
    // ═══════════════════════════════════════════════════════════════════════════
    if (isCarousel && carouselUrls.length >= 2) {
      // Step 1: Create a container for each carousel item
      const itemIds: string[] = [];
      for (const imgUrl of carouselUrls) {
        const itemRes = await fetch("https://graph.instagram.com/v21.0/me/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url:        imgUrl,
            is_carousel_item: true,
            access_token:     igToken,
          }),
        });
        const itemData = await itemRes.json();
        console.log("[Publish Carousel] item response:", JSON.stringify(itemData));
        if (!itemData.id) {
          return NextResponse.json(
            { error: itemData.error?.message ?? `Échec container carousel slide` },
            { status: 500 }
          );
        }
        itemIds.push(itemData.id);
      }

      // Step 2: Create the carousel container
      const carouselRes = await fetch("https://graph.instagram.com/v21.0/me/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type:   "CAROUSEL",
          children:     itemIds.join(","),
          caption:      post.description ?? "",
          access_token: igToken,
        }),
      });
      const carouselData = await carouselRes.json();
      console.log("[Publish Carousel] carousel container:", JSON.stringify(carouselData));

      if (!carouselData.id) {
        return NextResponse.json(
          { error: carouselData.error?.message ?? "Échec container carousel" },
          { status: 500 }
        );
      }

      // Step 3: Wait 5 seconds then publish
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const publishRes = await fetch("https://graph.instagram.com/v21.0/me/media_publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id:  carouselData.id,
          access_token: igToken,
        }),
      });
      const publishData = await publishRes.json();
      console.log("[Publish Carousel] publish response:", JSON.stringify(publishData));

      if (!publishData.id) {
        return NextResponse.json(
          { error: publishData.error?.message ?? "Échec publication carousel" },
          { status: 500 }
        );
      }

      await supabase.from("posts").update({
        status: "published",
        instagram_post_id: publishData.id,
      }).eq("id", postId);

      if (userId) await createNotification({
        userId, workspaceId,
        type: 'post_published',
        title: 'Post publié',
        message: `Carousel de ${carouselUrls.length} slides publié sur @${workspace.instagram_username ?? 'votre compte'}`,
        postId, postTitle: post.title ?? undefined,
      });

      return NextResponse.json({ success: true, instagramPostId: publishData.id, type: "carousel" });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IMAGE flow (unchanged)
    // ═══════════════════════════════════════════════════════════════════════════

    // Step 1: Create media container
    const containerBody: Record<string, unknown> = {
      image_url:    mediaUrl,
      access_token: igToken,
    };
    if (isStory) {
      containerBody.media_type = "STORIES";
    } else {
      containerBody.caption = post.description ?? "";
    }
    const containerRes = await fetch("https://graph.instagram.com/v21.0/me/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerBody),
    });
    const containerData = await containerRes.json();
    console.log("[Publish Image] container response:", JSON.stringify(containerData));

    if (!containerData.id) {
      console.error("[Instagram] Container creation failed:", containerData);
      return NextResponse.json(
        { error: containerData.error?.message ?? "Échec création du container média" },
        { status: 500 }
      );
    }

    // Step 2: Wait 5 seconds (Instagram requirement)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 3: Publish the container
    const publishRes = await fetch("https://graph.instagram.com/v21.0/me/media_publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id:  containerData.id,
        access_token: igToken,
      }),
    });
    const publishData = await publishRes.json();
    console.log("[Publish Image] publish response:", JSON.stringify(publishData));

    if (!publishData.id) {
      console.error("[Instagram] Publish failed:", publishData);
      return NextResponse.json(
        { error: publishData.error?.message ?? "Échec publication Instagram" },
        { status: 500 }
      );
    }

    // Step 4: Mark as published
    await supabase.from("posts").update({
      status: "published",
      instagram_post_id: publishData.id,
    }).eq("id", postId);

    if (userId) await createNotification({
      userId, workspaceId,
      type: 'post_published',
      title: 'Post publié',
      message: `« ${post.title ?? post.description?.slice(0, 40) ?? 'Sans titre'} » a été publié sur @${workspace.instagram_username ?? 'votre compte'}`,
      postId, postTitle: post.title ?? undefined,
    });

    return NextResponse.json({ success: true, instagramPostId: publishData.id, type: isStory ? "story" : "image" });

  } catch (err: unknown) {
    console.error("[Instagram] Publish error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
