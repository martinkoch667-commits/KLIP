import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const workspaceId = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = "https://klip-swart.vercel.app";
  const redirectUri = "https://klip-swart.vercel.app/api/auth/meta/callback"; // must be byte-identical to connect route
  const clientId = "991302360155193"; // must match connect route

  console.log('[Callback] code:', code?.substring(0, 30));
  console.log('[Callback] workspaceId:', workspaceId);
  console.log('[Callback] redirectUri:', redirectUri);

  if (error || !code || !workspaceId) {
    return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=cancelled`);
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

    const tokenParams = new URLSearchParams();
    tokenParams.append('client_id', clientId);
    tokenParams.append('client_secret', process.env.META_APP_SECRET!);
    tokenParams.append('grant_type', 'authorization_code');
    tokenParams.append('redirect_uri', redirectUri);
    tokenParams.append('code', code);

    console.log('[Callback] token params:', tokenParams.toString().replace(process.env.META_APP_SECRET!, '***'));

    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams,
    });

    const tokenData = await tokenRes.json();
    console.log('[Callback] tokenData:', tokenData);

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=token`);
    }

    const shortToken = tokenData.access_token;
    const igUserId = tokenData.user_id;

    const longTokenRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.META_APP_SECRET}&access_token=${shortToken}`
    );
    const longTokenData = await longTokenRes.json();
    const accessToken = longTokenData.access_token ?? shortToken;

    const igDetailsRes = await fetch(
      `https://graph.instagram.com/v18.0/${igUserId}?fields=username,name&access_token=${accessToken}`
    );
    const igDetails = await igDetailsRes.json();

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
