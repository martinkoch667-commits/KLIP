import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId manquant" }, { status: 400 });
  }

  console.log("APP_ID:", process.env.NEXT_PUBLIC_META_APP_ID);
  console.log("REDIRECT_URI:", process.env.META_REDIRECT_URI);

  const authUrl = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=${encodeURIComponent("http://localhost:3001/api/auth/meta/callback")}&scope=pages_show_list,public_profile&state=${workspaceId}&response_type=code`;

  console.log("OAuth URL:", authUrl);

  return NextResponse.redirect(authUrl);
}
