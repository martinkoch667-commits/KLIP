import { NextRequest, NextResponse } from "next/server";

// Flux « Instagram API with Facebook Login » (Option A) : un seul consentement
// Facebook qui récupère la Page Facebook + le compte Instagram Business lié.
// Distinct du flux Instagram Login (/api/auth/meta/connect) qui, lui, ne connecte
// que l'Instagram sans Page Facebook — on ne le touche pas.

const APP_ID = "1998010880798347";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getklip.fr";
const REDIRECT_URI = `${APP_URL}/api/auth/facebook/callback`;
const GRAPH_VERSION = "v21.0";

// "Facebook Login for Business" exige un config_id (Configuration créée dans
// Meta for Developers → Facebook Login for Business → Configurations, avec
// les permissions pages_show_list/pages_manage_posts/pages_read_engagement/
// business_management) au lieu d'un scope= brut — sinon le dialogue OAuth
// renvoie un 500 générique côté Facebook.
const CONFIG_ID = "1687148909161883";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  // Même mécanique que le flux Instagram : `state` est le seul paramètre que
  // Facebook nous rend, donc le seul endroit où faire voyager la provenance.
  const from = searchParams.get("from") === "onboarding" ? "onboarding" : "";

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId manquant" }, { status: 400 });
  }

  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    config_id: CONFIG_ID,
    state: from ? `${workspaceId}|${from}` : workspaceId,
    response_type: "code",
  });

  const authUrl = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  console.log("[FB Connect] auth URL:", authUrl);

  return NextResponse.redirect(authUrl);
}
