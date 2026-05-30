import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const workspaceId = searchParams.get("state");
  const error = searchParams.get("error");

  console.log('[Callback] searchParams:', Object.fromEntries(searchParams));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = "https://klip-swart.vercel.app/api/auth/meta/callback";

  if (error || !code || !workspaceId) {
    return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=cancelled`);
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Step 1: Exchange code for short-lived token via Instagram API
    const tokenBody = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });

    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: tokenBody,
    });
    const tokenData = await tokenRes.json();
    console.log('[Instagram] Token response:', tokenData);

    if (!tokenData.access_token) {
      console.error("[Instagram] Token exchange failed:", tokenData);
      return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=token`);
    }

    const shortToken = tokenData.access_token;
    const igUserId = tokenData.user_id;

    // Step 2: Exchange for long-lived token (60 days)
    const longTokenRes = await fetch(
      `https://graph.instagram.com/access_token` +
      `?grant_type=ig_exchange_token` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&access_token=${shortToken}`
    );
    const longTokenData = await longTokenRes.json();
    const accessToken = longTokenData.access_token ?? shortToken;

    // Step 3: Get Instagram user details
    const igDetailsRes = await fetch(
      `https://graph.instagram.com/v18.0/${igUserId}?fields=username,name&access_token=${accessToken}`
    );
    const igDetails = await igDetailsRes.json();

    // Step 4: Save to Supabase
    await supabase.from("workspaces").update({
      instagram_account_id: String(igUserId),
      instagram_access_token: accessToken,
      instagram_username: igDetails.username ?? igDetails.name ?? String(igUserId),
      instagram_connected_at: new Date().toISOString(),
    }).eq("id", workspaceId);

    return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/planning?connected=true`);
  } catch (err) {
    console.error("[Instagram] Callback error:", err);
    return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=unknown`);
  }
}
