import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId manquant" }, { status: 400 });
  }

  const redirectUri = process.env.META_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`;

  const authUrl =
    `https://www.instagram.com/oauth/authorize` +
    `?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights` +
    `&state=${workspaceId}` +
    `&response_type=code`;

  console.log("[Meta] Instagram OAuth URL:", authUrl);

  return NextResponse.redirect(authUrl);
}
