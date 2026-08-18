import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Suppression de compte à l'initiative de l'utilisateur (RGPD, article 17).

   L'ordre des opérations n'est pas cosmétique :

   1. Stripe D'ABORD. Supprimer le compte en laissant un abonnement vivant, c'est
      continuer à débiter quelqu'un qui n'a plus de compte pour s'en plaindre. Si
      la résiliation échoue, on s'arrête là et on ne supprime rien.
   2. Le stockage ENSUITE. Les fichiers ne sont liés à `auth.users` par aucune
      clé étrangère : une fois la ligne partie, plus rien ne dit à qui ils
      appartenaient, et ils restent facturés indéfiniment.
   3. `workspaces` AVANT `auth.users`. `workspaces.user_id` référence
      `auth.users` SANS `on delete cascade` (voir supabase/schema.sql), donc la
      suppression du compte échouerait tant qu'il reste un workspace.
   4. `auth.users` en dernier. Le reste (user_settings, subscriptions,
      notifications, agency_members, jetons MCP) part en cascade, et
      bug_reports/activity_log passent à null, ce qui conserve l'historique sans
      conserver l'identité. */

const BUCKETS = ["photos", "videos", "audio", "exports", "brand-assets", "brand-fonts"];

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const email = (session.user.email ?? "").trim().toLowerCase();

  // Garde-fou : retaper son adresse. Un compte se supprime une fois, sans
  // deuxième chance, donc un simple clic ne suffit pas.
  const body = await req.json().catch(() => ({}));
  const confirm = typeof body?.confirm === "string" ? body.confirm.trim().toLowerCase() : "";
  if (!email || confirm !== email) {
    return NextResponse.json(
      { error: "Saisissez votre adresse e-mail exacte pour confirmer.", code: "CONFIRM_MISMATCH" },
      { status: 400 },
    );
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json(
      { error: "Suppression indisponible : configuration serveur incomplète.", code: "NO_SERVICE_KEY" },
      { status: 503 },
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 1. Résilier l'abonnement ───────────────────────────────────────────────
  if (stripe) {
    const { data: subs } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id, status")
      .eq("user_id", userId);

    for (const sub of subs ?? []) {
      const id = sub.stripe_subscription_id as string | null;
      if (!id || sub.status === "canceled") continue;
      try {
        await stripe.subscriptions.cancel(id);
      } catch (err: any) {
        // `resource_missing` = l'abonnement n'existe plus chez Stripe, rien à
        // résilier, on continue. Toute autre erreur laisse un doute sur la
        // facturation : on refuse de supprimer plutôt que de débiter un fantôme.
        if (err?.code !== "resource_missing") {
          console.error("[account/delete] résiliation Stripe impossible:", err?.message ?? err);
          return NextResponse.json(
            { error: "Votre abonnement n'a pas pu être résilié. Rien n'a été supprimé, réessayez ou écrivez-nous.", code: "STRIPE_CANCEL_FAILED" },
            { status: 502 },
          );
        }
      }
    }
  }

  // ── 2. Fichiers ────────────────────────────────────────────────────────────
  const { data: workspaces } = await admin.from("workspaces").select("id").eq("user_id", userId);
  const workspaceIds = (workspaces ?? []).map((w: { id: string }) => w.id);

  // Les préfixes varient selon l'écran qui a envoyé le fichier : tantôt l'id du
  // compte, tantôt celui du workspace, et l'avatar a son propre dossier. Aucune
  // convention commune, donc on balaie les trois formes.
  const prefixes = [userId, `avatars/${userId}`, ...workspaceIds.flatMap(id => [id, `photos/${id}`])];
  for (const bucket of BUCKETS) {
    for (const prefix of prefixes) {
      await removePrefix(admin, bucket, prefix);
    }
  }

  // ── 3. Données applicatives ────────────────────────────────────────────────
  // `workspaces` emporte posts, share_tokens et activity_log en cascade.
  if (workspaceIds.length) {
    const { error } = await admin.from("workspaces").delete().eq("user_id", userId);
    if (error) {
      console.error("[account/delete] suppression des workspaces impossible:", error.message);
      return NextResponse.json({ error: "Suppression interrompue. Rien n'a été supprimé de votre compte." }, { status: 500 });
    }
  }
  await admin.from("agencies").delete().eq("owner_id", userId);
  // Compteur d'usage IA : pas de clé étrangère, donc pas de cascade.
  await admin.from("ai_usage_user_daily").delete().eq("user_id", userId);

  // ── 4. Le compte ───────────────────────────────────────────────────────────
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error("[account/delete] suppression du compte impossible:", delErr.message);
    return NextResponse.json({ error: "Le compte n'a pas pu être supprimé. Écrivez-nous, on s'en occupe." }, { status: 500 });
  }

  console.log("[account/delete] compte supprimé:", userId);
  return NextResponse.json({ ok: true });
}

/** Vide un dossier de stockage, sous-dossiers compris. `list` ne descend pas
    tout seul : les entrées sans `id` sont des dossiers, à parcourir à la main. */
async function removePrefix(admin: SupabaseClient, bucket: string, prefix: string): Promise<void> {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data?.length) return;

  const files = data.filter(o => o.id).map(o => `${prefix}/${o.name}`);
  if (files.length) await admin.storage.from(bucket).remove(files);

  for (const folder of data.filter(o => !o.id)) {
    await removePrefix(admin, bucket, `${prefix}/${folder.name}`);
  }
}
