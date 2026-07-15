import { NextRequest, NextResponse } from "next/server";

const APP_ID = "991302360155193";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getklip.fr";
const REDIRECT_URI = `${APP_URL}/api/auth/meta/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId manquant" }, { status: 400 });
  }

  console.log('[Connect] client_id:', APP_ID);
  console.log('[Connect] redirect_uri:', REDIRECT_URI);

  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights",
    state: workspaceId,
    response_type: "code",
  });

  const authUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  console.log("[Connect] auth URL:", authUrl);

  return NextResponse.redirect(authUrl);
}
