import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications";
import { publishPostToInstagram, mediaUrlOf } from "@/lib/instagram-publish";
import { openToken } from "@/lib/token-crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

// Un reel peut monopoliser jusqu'à ~150 s (encodage Instagram). On arrête donc
// d'entamer un nouveau post passé ce seuil : le reste attend le passage suivant
// plutôt que de se faire couper en plein vol par la fin de la fonction.
const BUDGET_MS = 230_000;

// Le cron tourne toutes les minutes, une publication peut durer plus longtemps :
// plusieurs exécutions se chevauchent donc forcément. Chacune « réserve » les
// posts qu'elle traite pour que les autres les ignorent — sans quoi le même reel
// serait publié deux ou trois fois.
//
// Une réservation plus vieille que ce délai est considérée comme abandonnée
// (fonction tuée en plein vol, redéploiement…) et le post redevient candidat,
// plutôt que de rester bloqué à jamais.
const CLAIM_TTL_MS = 15 * 60 * 1000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const startedAt = Date.now();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*, workspaces!workspace_id(instagram_access_token, instagram_account_id, instagram_username)")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(10);

  if (error) {
    console.error("[Cron] Supabase query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[Cron] Found ${posts?.length ?? 0} posts to publish`);

  let published = 0;
  let failed = 0;
  let deferred = 0;
  let skipped = 0;

  for (const post of posts ?? []) {
    const workspace = post.workspaces as {
      instagram_access_token: string;
      instagram_account_id: string;
      instagram_username?: string;
    } | null;
    const postUserId: string | null = post.user_id ?? null;
    const postWorkspaceId: string = post.workspace_id;
    const postLabel: string = post.title ?? post.description?.slice(0, 40) ?? "Sans titre";
    const igHandle: string = workspace?.instagram_username ?? "votre compte";

    const markFailed = async (reason: string) => {
      console.error(`[Cron] Post ${post.id}: ${reason}`);
      await supabase.from("posts").update({ status: "failed", publishing_started_at: null }).eq("id", post.id);
      if (postUserId) {
        await createNotification({
          userId: postUserId,
          workspaceId: postWorkspaceId,
          type: "post_failed",
          title: "Échec de publication",
          message: `La publication de « ${postLabel} » a échoué (${reason})`,
          postId: post.id,
          postTitle: postLabel,
        });
      }
      failed++;
    };

    if (!workspace?.instagram_access_token || !workspace?.instagram_account_id) {
      await markFailed("Instagram non connecté");
      continue;
    }

    if (!mediaUrlOf(post)) {
      await markFailed("aucun média");
      continue;
    }

    // Budget épuisé : on laisse le post en « scheduled », il repartira au
    // prochain passage du cron plutôt que d'être marqué en échec à tort.
    if (Date.now() - startedAt > BUDGET_MS) {
      console.log(`[Cron] Post ${post.id}: reporté au prochain passage (budget épuisé)`);
      deferred++;
      continue;
    }

    // Réservation atomique : le filtre rejoue les conditions dans la requête
    // d'écriture elle-même. Si une exécution concurrente a déjà réservé ce post,
    // aucune ligne ne correspond et on passe au suivant — c'est ce qui empêche
    // une double publication.
    const staleBefore = new Date(Date.now() - CLAIM_TTL_MS).toISOString();
    const { data: claimed } = await supabase
      .from("posts")
      .update({ publishing_started_at: new Date().toISOString() })
      .eq("id", post.id)
      .eq("status", "scheduled")
      .or(`publishing_started_at.is.null,publishing_started_at.lt.${staleBefore}`)
      .select("id");

    if (!claimed || claimed.length === 0) {
      console.log(`[Cron] Post ${post.id}: déjà pris en charge par une autre exécution`);
      skipped++;
      continue;
    }

    const result = await publishPostToInstagram(post, openToken(workspace.instagram_access_token) as string);

    if (!result.ok) {
      await markFailed(result.error);
      continue;
    }

    await supabase.from("posts").update({
      status: "published",
      instagram_post_id: result.instagramPostId,
      publishing_started_at: null,
    }).eq("id", post.id);

    if (postUserId) {
      await createNotification({
        userId: postUserId,
        workspaceId: postWorkspaceId,
        type: "post_published",
        title: "Post publié",
        message: `« ${postLabel} » a été publié sur @${igHandle}`,
        postId: post.id,
        postTitle: postLabel,
      });
    }

    console.log(`[Cron] Post ${post.id}: published OK (${result.type}, ig: ${result.instagramPostId})`);
    published++;
  }

  return NextResponse.json({ processed: posts?.length ?? 0, published, failed, deferred, skipped });
}
