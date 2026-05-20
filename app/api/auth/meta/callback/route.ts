import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const workspaceId = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error || !code || !workspaceId) {
    return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=cancelled`);
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Step 1: Exchange code for short-lived access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${process.env.META_APP_ID}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&redirect_uri=${encodeURIComponent(process.env.META_REDIRECT_URI!)}` +
      `&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("[Meta] Token exchange failed:", tokenData);
      return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=token`);
    }

    // Step 2: Exchange short-lived token for long-lived token (60 days)
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${process.env.META_APP_ID}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&fb_exchange_token=${tokenData.access_token}`
    );
    const longTokenData = await longTokenRes.json();

    // Use long-lived token if available, fall back to short-lived
    const accessToken = longTokenData.access_token ?? tokenData.access_token;

    // Step 3: Get Facebook pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();

    if (!pagesData.data?.length) {
      console.error("[Meta] No pages found:", pagesData);
      return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=no_pages`);
    }

    // Step 4: Find page with Instagram Business account
    let saved = false;
    for (const page of pagesData.data) {
      // Get long-lived page token
      const pageTokenRes = await fetch(
        `https://graph.facebook.com/v18.0/${page.id}?fields=access_token,instagram_business_account&access_token=${accessToken}`
      );
      const pageTokenData = await pageTokenRes.json();
      const pageToken = pageTokenData.access_token ?? page.access_token;

      if (pageTokenData.instagram_business_account?.id) {
        const igAccountId = pageTokenData.instagram_business_account.id;

        // Step 5: Get Instagram username
        const igDetailsRes = await fetch(
          `https://graph.facebook.com/v18.0/${igAccountId}?fields=username,name&access_token=${pageToken}`
        );
        const igDetails = await igDetailsRes.json();

        // Step 6: Save to Supabase
        await supabase.from("workspaces").update({
          instagram_account_id: igAccountId,
          instagram_access_token: pageToken,
          instagram_username: igDetails.username ?? igDetails.name ?? igAccountId,
          facebook_page_id: page.id,
          instagram_connected_at: new Date().toISOString(),
        }).eq("id", workspaceId);

        saved = true;
        break;
      }
    }

    if (!saved) {
      return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=no_instagram`);
    }

    // Redirect to planning with success banner
    return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/planning?connected=true`);
  } catch (err) {
    console.error("[Meta] Callback error:", err);
    return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=unknown`);
  }
}
