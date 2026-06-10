import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { postId, workspaceId } = await request.json();

    if (!postId || !workspaceId) {
      return NextResponse.json({ error: "postId et workspaceId requis" }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

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

    const igId = workspace.instagram_account_id;
    const igToken = (workspace.instagram_access_token as string).trim();

    console.log('[Publish] token first 20 chars:', igToken?.substring(0, 20));
    console.log('[Publish] token length:', igToken?.length);
    console.log('[Publish] instagram_account_id:', igId);

    // Step 1: Create media container
    const containerRes = await fetch(
      `https://graph.facebook.com/v18.0/${igId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: post.photo_url,
          caption: post.description ?? "",
          access_token: igToken,
        }),
      }
    );
    const containerData = await containerRes.json();

    if (!containerData.id) {
      console.error("[Instagram] Container creation failed:", containerData);
      return NextResponse.json(
        { error: containerData.error?.message ?? "Échec création du container média" },
        { status: 500 }
      );
    }

    // Step 2: Wait 5 seconds before publishing (Instagram requirement)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 3: Publish the container
    const publishRes = await fetch(
      `https://graph.facebook.com/v18.0/${igId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: igToken,
        }),
      }
    );
    const publishData = await publishRes.json();

    if (!publishData.id) {
      console.error("[Instagram] Publish failed:", publishData);
      return NextResponse.json(
        { error: publishData.error?.message ?? "Échec publication Instagram" },
        { status: 500 }
      );
    }

    // Step 4: Mark post as published and save Instagram post ID
    await supabase.from("posts").update({
      status: "published",
      instagram_post_id: publishData.id,
    }).eq("id", postId);

    return NextResponse.json({ success: true, instagramPostId: publishData.id });
  } catch (err: unknown) {
    console.error("[Instagram] Publish error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
