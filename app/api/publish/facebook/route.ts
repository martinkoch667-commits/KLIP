import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createNotification } from "@/lib/notifications";

const GRAPH_VERSION = "v21.0";

function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|mov|avi|webm)(\?|$)/i.test(url);
}

// Publie sur une Page Facebook via le jeton de Page (flux Facebook Login).
// Nécessite l'App Review Meta (pages_manage_posts) pour la production.
export async function POST(request: NextRequest) {
  try {
    const { postId, workspaceId } = await request.json();
    if (!postId || !workspaceId) {
      return NextResponse.json({ error: "postId et workspaceId requis" }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;

    const [{ data: post }, { data: workspace }] = await Promise.all([
      supabase.from("posts").select("*").eq("id", postId).single(),
      supabase.from("workspaces").select("*").eq("id", workspaceId).single(),
    ]);

    if (!post) return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
    if (!workspace?.facebook_page_id || !workspace?.facebook_page_access_token) {
      return NextResponse.json({ error: "Page Facebook non connectée" }, { status: 400 });
    }

    const pageId = workspace.facebook_page_id as string;
    const pageToken = (workspace.facebook_page_access_token as string).trim();
    const mediaUrl = post.exported_image_url || post.photo_url;
    const message: string = post.description ?? "";

    let publishData: { id?: string; post_id?: string; error?: { message?: string } };

    if (!mediaUrl) {
      // Publication texte seul
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, access_token: pageToken }),
      });
      publishData = await res.json();
    } else if (isVideoUrl(mediaUrl)) {
      // Vidéo
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url: mediaUrl, description: message, access_token: pageToken }),
      });
      publishData = await res.json();
    } else {
      // Photo
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: mediaUrl, caption: message, access_token: pageToken }),
      });
      publishData = await res.json();
    }

    console.log("[Publish FB] response:", JSON.stringify(publishData));

    const fbPostId = publishData.post_id ?? publishData.id;
    if (!fbPostId) {
      return NextResponse.json(
        { error: publishData.error?.message ?? "Échec de la publication Facebook" },
        { status: 500 }
      );
    }

    if (userId) await createNotification({
      userId, workspaceId,
      type: "post_published",
      title: "Post publié sur Facebook",
      message: `« ${post.title ?? post.description?.slice(0, 40) ?? "Sans titre"} » a été publié sur la Page ${workspace.facebook_page_name ?? "Facebook"}`,
      postId, postTitle: post.title ?? undefined,
    });

    return NextResponse.json({ success: true, facebookPostId: fbPostId });
  } catch (err) {
    console.error("[Publish FB] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
