import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  // Unique ID per invocation — detects double-invocation
  const inv = Math.random().toString(36).slice(2, 8);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const workspaceId = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = "https://klip-swart.vercel.app";
  const redirectUri = "https://klip-swart.vercel.app/api/auth/meta/callback";
  const clientId = "991302360155193";

  // ── Diagnostic block ──────────────────────────────────────────────────────
  console.log(`[CB:${inv}] FULL request.url:`, request.url);
  console.log(`[CB:${inv}] code FULL (${code?.length} chars):`, code);
  console.log(`[CB:${inv}] workspaceId:`, workspaceId);
  console.log(`[CB:${inv}] error param:`, error);
  console.log(`[CB:${inv}] redirectUri used:`, redirectUri);
  console.log(`[CB:${inv}] META_APP_SECRET set:`, !!process.env.META_APP_SECRET);
  // ─────────────────────────────────────────────────────────────────────────

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

    const bodyForLog = tokenParams.toString()
      .replace(encodeURIComponent(process.env.META_APP_SECRET ?? ''), '***')
      .replace(process.env.META_APP_SECRET ?? '', '***');

    console.log(`[CB:${inv}] POST https://api.instagram.com/oauth/access_token`);
    console.log(`[CB:${inv}] body:`, bodyForLog);

    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams,
    });

    const tokenText = await tokenRes.text();
    console.log(`[CB:${inv}] token status:`, tokenRes.status);
    console.log(`[CB:${inv}] token raw response:`, tokenText);

    let tokenData: Record<string, unknown>;
    try { tokenData = JSON.parse(tokenText); } catch { tokenData = { parse_error: tokenText }; }

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=token`);
    }

    const shortToken = tokenData.access_token as string;
    const igUserId = tokenData.user_id;

    const longTokenRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.META_APP_SECRET}&access_token=${shortToken}`
    );
    const longTokenData = await longTokenRes.json();
    const accessToken = (longTokenData.access_token ?? shortToken) as string;

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

    console.log(`[CB:${inv}] SUCCESS — connected @${igDetails.username}`);
    return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/planning?connected=true`);
  } catch (err) {
    console.error(`[CB:${inv}] Callback error:`, err);
    return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=unknown`);
  }
}
