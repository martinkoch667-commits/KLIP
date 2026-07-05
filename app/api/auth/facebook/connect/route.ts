import { NextRequest, NextResponse } from "next/server";

// Flux « Instagram API with Facebook Login » (Option A) : un seul consentement
// Facebook qui récupère la Page Facebook + le compte Instagram Business lié.
// Distinct du flux Instagram Login (/api/auth/meta/connect) qui, lui, ne connecte
// que l'Instagram sans Page Facebook — on ne le touche pas.

const APP_ID = "991302360155193";
const REDIRECT_URI = "https://klip-swart.vercel.app/api/auth/facebook/callback";
const GRAPH_VERSION = "v21.0";

// pages_manage_posts / instagram_content_publish nécessitent l'App Review Meta
// (Advanced Access) pour fonctionner en production hors rôles de l'app.
const SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId manquant" }, { status: 400 });
  }

  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state: workspaceId,
    response_type: "code",
  });

  const authUrl = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  console.log("[FB Connect] auth URL:", authUrl);

  return NextResponse.redirect(authUrl);
}
