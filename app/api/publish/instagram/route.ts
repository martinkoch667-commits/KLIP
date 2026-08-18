import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createNotification } from "@/lib/notifications";
import { publishPostToInstagram, resolveMediaType } from "@/lib/instagram-publish";
import { openToken } from "@/lib/token-crypto";

export const runtime = "nodejs";
// Publier un reel implique d'attendre l'encodage Instagram (jusqu'à ~150 s).
// Sans ce réglage, la fonction serverless est coupée bien avant et la
// publication échoue alors même qu'Instagram a fini son travail.
export const maxDuration = 300;

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

    if (!post) {
      return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
    }

    if (!workspace?.instagram_account_id || !workspace?.instagram_access_token) {
      return NextResponse.json({ error: "Compte Instagram non connecté" }, { status: 400 });
    }

    const result = await publishPostToInstagram(post, openToken(workspace.instagram_access_token as string) as string);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    await supabase.from("posts").update({
      status: "published",
      instagram_post_id: result.instagramPostId,
    }).eq("id", postId);

    if (userId) {
      const handle = workspace.instagram_username ?? "votre compte";
      const label = post.title ?? post.description?.slice(0, 40) ?? "Sans titre";
      await createNotification({
        userId,
        workspaceId,
        type: "post_published",
        title: "Post publié",
        message: resolveMediaType(post) === "carousel"
          ? `Carrousel publié sur @${handle}`
          : `« ${label} » a été publié sur @${handle}`,
        postId,
        postTitle: post.title ?? undefined,
      });
    }

    return NextResponse.json({
      success: true,
      instagramPostId: result.instagramPostId,
      type: result.type,
    });
  } catch (err: unknown) {
    console.error("[Instagram] Publish error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
