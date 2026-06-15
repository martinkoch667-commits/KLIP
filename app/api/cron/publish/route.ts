import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*, workspaces!workspace_id(instagram_access_token, instagram_account_id)")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .limit(10);

  if (error) {
    console.error("[Cron] Supabase query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[Cron] Found ${posts?.length ?? 0} posts to publish`);

  let published = 0;
  let failed = 0;

  for (const post of posts ?? []) {
    const workspace = post.workspaces as { instagram_access_token: string; instagram_account_id: string } | null;

    if (!workspace?.instagram_access_token || !workspace?.instagram_account_id) {
      console.error(`[Cron] Post ${post.id}: workspace missing Instagram credentials`);
      await supabase.from("posts").update({ status: "failed" }).eq("id", post.id);
      failed++;
      continue;
    }

    const igToken = workspace.instagram_access_token.trim();
    const igId = workspace.instagram_account_id;
    const imageUrl = post.exported_image_url || post.photo_url;

    if (!imageUrl) {
      console.error(`[Cron] Post ${post.id}: no image URL`);
      await supabase.from("posts").update({ status: "failed" }).eq("id", post.id);
      failed++;
      continue;
    }

    try {
      // Step 1: Create media container
      const containerRes = await fetch("https://graph.instagram.com/v21.0/me/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: post.description ?? "",
          access_token: igToken,
        }),
      });
      const containerData = await containerRes.json();

      if (!containerData.id) {
        console.error(`[Cron] Post ${post.id}: container failed`, containerData);
        await supabase.from("posts").update({ status: "failed" }).eq("id", post.id);
        failed++;
        continue;
      }

      // Step 2: Wait before publishing
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Step 3: Publish
      const publishRes = await fetch("https://graph.instagram.com/v21.0/me/media_publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: igToken,
        }),
      });
      const publishData = await publishRes.json();

      if (!publishData.id) {
        console.error(`[Cron] Post ${post.id}: publish failed`, publishData);
        await supabase.from("posts").update({ status: "failed" }).eq("id", post.id);
        failed++;
        continue;
      }

      await supabase.from("posts").update({
        status: "published",
        instagram_post_id: publishData.id,
      }).eq("id", post.id);

      console.log(`[Cron] Post ${post.id}: published OK (ig: ${publishData.id})`);
      published++;
    } catch (err) {
      console.error(`[Cron] Post ${post.id}: unexpected error`, err);
      await supabase.from("posts").update({ status: "failed" }).eq("id", post.id);
      failed++;
    }
  }

  return NextResponse.json({ processed: (posts?.length ?? 0), published, failed });
}
