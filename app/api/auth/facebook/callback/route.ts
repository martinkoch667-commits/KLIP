import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Callback du flux Facebook Login (Option A). Récupère la Page Facebook, son
// jeton de Page (longue durée), et le compte Instagram Business lié s'il existe.

const APP_ID = "1998010880798347";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getklip.fr";
const REDIRECT_URI = `${APP_URL}/api/auth/facebook/callback`;
const GRAPH_VERSION = "v21.0";

// FB_APP_SECRET = secret de l'app principale (1998010880798347), distinct de
// META_APP_SECRET qui est le secret dédié à l'app Instagram (991302360155193,
// utilisée par /api/auth/meta/*). Les mélanger renvoie "Error validating
// client secret" côté Facebook.

export async function GET(request: NextRequest) {
  const inv = Math.random().toString(36).slice(2, 8);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawState = searchParams.get("state") ?? "";
  const [workspaceId, from] = rawState.split("|");
  const fromOnboarding = from === "onboarding";
  const error = searchParams.get("error");

  // On renvoie là d'où l'utilisateur est parti : le ramener dans les paramètres
  // du client au milieu d'une création en cours lui ferait perdre son parcours.
  const back = (q: string) => NextResponse.redirect(
    fromOnboarding
      ? `${APP_URL}/workspace/new?ws=${workspaceId}&${q}`
      : `${APP_URL}/workspace/${workspaceId}/parametres?${q}`,
  );

  if (error || !code || !workspaceId) {
    return back("error=cancelled");
  }

  try {
    // 1) code → jeton utilisateur court
    const tokenParams = new URLSearchParams({
      client_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      client_secret: process.env.FB_APP_SECRET!,
      code,
    });
    const tokenRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${tokenParams.toString()}`
    );
    const tokenData = await tokenRes.json();
    console.log(`[FB CB:${inv}] token status:`, tokenRes.status);
    if (!tokenData.access_token) {
      console.error(`[FB CB:${inv}] token error:`, JSON.stringify(tokenData));
      return back("error=token");
    }

    // 2) jeton utilisateur court → jeton utilisateur longue durée (~60 j)
    const longParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: APP_ID,
      client_secret: process.env.FB_APP_SECRET!,
      fb_exchange_token: tokenData.access_token,
    });
    const longRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${longParams.toString()}`
    );
    const longData = await longRes.json();
    const userToken = (longData.access_token ?? tokenData.access_token) as string;

    // 3) Pages de l'utilisateur (+ IG Business lié). Le jeton de Page dérivé
    //    d'un jeton utilisateur longue durée n'expire pas.
    const pagesRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${userToken}`
    );
    const pagesData = await pagesRes.json();
    console.log(`[FB CB:${inv}] pages:`, JSON.stringify(pagesData).slice(0, 400));

    const pages = pagesData.data ?? [];
    if (!pages.length) {
      return back("error=no_pages");
    }

    // Choix simple : première Page (v1). Une sélection multi-pages viendra plus tard.
    const page = pages[0];
    const igLinked = page.instagram_business_account;

    const supabase = createRouteHandlerClient({ cookies });

    // On ne renseigne QUE les colonnes facebook_* : le flux Instagram Login reste
    // la source des jetons Instagram (publication via graph.instagram.com). Écraser
    // instagram_access_token avec un jeton de Page casserait cette publication.
    // On mémorise l'IG Business lié à la Page dans facebook_ig_business_id pour un
    // futur module « publier sur IG via Facebook », sans impacter l'existant.
    const update: Record<string, unknown> = {
      facebook_page_id: String(page.id),
      facebook_page_name: page.name ?? String(page.id),
      facebook_page_access_token: page.access_token,
      facebook_connected_at: new Date().toISOString(),
      facebook_ig_business_id: igLinked?.id ? String(igLinked.id) : null,
    };

    const { data: updated, error: updateError } = await supabase.from("workspaces").update(update).eq("id", workspaceId).select("id");

    // Voir commentaire équivalent dans /api/auth/meta/callback : sans session
    // valide (auth.uid()) au moment du callback, RLS bloque l'update sans
    // lever d'erreur — il faut vérifier explicitement qu'une ligne a été touchée.
    if (updateError || !updated || updated.length === 0) {
      console.error(`[FB CB:${inv}] update failed — error:`, updateError, "rows:", updated?.length ?? 0);
      return back("error=save_failed");
    }

    console.log(`[FB CB:${inv}] SUCCESS — page « ${page.name} »${igLinked ? ` + IG @${igLinked.username}` : ""}`);
    return back("connected=true");
  } catch (err) {
    console.error(`[FB CB:${inv}] error:`, err);
    return back("error=unknown");
  }
}
