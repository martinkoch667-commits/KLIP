import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications";
import { refreshInstagramToken } from "@/lib/instagram-token";
import { openToken, sealToken, tokenCryptoReady, isSealed } from "@/lib/token-crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

// Un token Instagram long-lived vit 60 jours. On le renouvelle dès qu'il entre
// dans ses 15 derniers jours : largement avant la coupure, et assez tard pour
// respecter la règle Meta qui refuse de rafraîchir un token de moins de 24 h.
const REFRESH_WINDOW_DAYS = 15;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const threshold = new Date(Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Les tokens sans échéance connue sont inclus : ce sont d'anciennes connexions
  // dont on ignore la date, et qu'il vaut mieux rafraîchir pour la fixer.
  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("id, user_id, instagram_username, instagram_access_token, instagram_token_expires_at")
    .not("instagram_access_token", "is", null)
    .or(`instagram_token_expires_at.is.null,instagram_token_expires_at.lte.${threshold}`)
    .limit(100);

  if (error) {
    console.error("[Cron tokens] erreur Supabase :", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[Cron tokens] ${workspaces?.length ?? 0} token(s) à examiner`);

  let refreshed = 0;
  let expired = 0;
  let failed = 0;

  for (const workspace of workspaces ?? []) {
    const handle = workspace.instagram_username ?? "votre compte";
    const result = await refreshInstagramToken(openToken(workspace.instagram_access_token as string) as string);

    if (result.ok) {
      await supabase
        .from("workspaces")
        .update({
          instagram_access_token: sealToken(result.token.accessToken),
          instagram_token_expires_at: result.token.expiresAt,
          instagram_token_refreshed_at: new Date().toISOString(),
        })
        .eq("id", workspace.id);

      console.log(`[Cron tokens] ${workspace.id} — renouvelé jusqu'au ${result.token.expiresAt}`);
      refreshed++;
      continue;
    }

    if (result.expired) {
      // Le token ne peut plus être sauvé : on marque l'échéance comme atteinte
      // pour que l'écran Paramètres affiche « reconnexion nécessaire », et on
      // prévient le propriétaire du workspace.
      await supabase
        .from("workspaces")
        .update({ instagram_token_expires_at: new Date().toISOString() })
        .eq("id", workspace.id);

      if (workspace.user_id) {
        await createNotification({
          userId: workspace.user_id,
          workspaceId: workspace.id,
          type: "instagram_token_expired",
          title: "Reconnectez Instagram",
          message: `L'autorisation Instagram de @${handle} a expiré. Reconnectez le compte dans les paramètres du workspace pour que vos publications programmées repartent.`,
        });
      }

      console.warn(`[Cron tokens] ${workspace.id} — token expiré : ${result.error}`);
      expired++;
      continue;
    }

    console.error(`[Cron tokens] ${workspace.id} — échec temporaire : ${result.error}`);
    failed++;
  }

  // ── Reprise des jetons encore en clair ─────────────────────────────────
  // Ceux d'avant le chiffrement ne passent pas par la boucle ci-dessus tant
  // qu'ils n'approchent pas de l'échéance. On les scelle ici sans appeler Meta :
  // même valeur, simplement chiffrée. Par lots, pour ne pas s'éterniser.
  let sealed = 0;
  if (tokenCryptoReady()) {
    // Le tri se fait ici plutôt que dans la requête : le filtre `like` de
    // PostgREST attend `*` et non `%`, et une erreur de motif passerait
    // inaperçue en ne chiffrant jamais rien.
    const { data: candidats } = await supabase
      .from("workspaces")
      .select("id, instagram_access_token")
      .not("instagram_access_token", "is", null)
      .limit(500);

    const clairs = (candidats ?? []).filter(w => !isSealed(w.instagram_access_token as string));

    for (const w of clairs) {
      const { error: sealErr } = await supabase
        .from("workspaces")
        .update({ instagram_access_token: sealToken(w.instagram_access_token as string) })
        .eq("id", w.id);
      if (sealErr) console.error(`[Cron tokens] chiffrement impossible pour ${w.id} :`, sealErr.message);
      else sealed++;
    }
    if (sealed) console.log(`[Cron tokens] ${sealed} jeton(s) chiffré(s) au repos.`);
  }

  return NextResponse.json({
    examined: workspaces?.length ?? 0,
    refreshed,
    expired,
    failed,
    sealed,
  });
}
