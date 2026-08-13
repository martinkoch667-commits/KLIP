import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { expiryFromNow } from "@/lib/instagram-token";

export async function GET(request: NextRequest) {
  // Unique ID per invocation — detects double-invocation
  const inv = Math.random().toString(36).slice(2, 8);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const workspaceId = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://getklip.fr";
  const redirectUri = `${appUrl}/api/auth/meta/callback`;
  // Voir commentaire dans meta/connect/route.ts : ID Instagram dédié,
  // distinct de l'ID principal de l'app (1998010880798347).
  const clientId = "991302360155193";

  // ── Diagnostic block ──────────────────────────────────────────────────────
  console.log('[CB] full URL:', request.url);
  console.log('[CB] code:', code?.substring(0, 20));
  console.log('[CB] state:', workspaceId);
  console.log(`[CB:${inv}] error param:`, error);
  console.log(`[CB:${inv}] META_APP_SECRET set:`, !!process.env.META_APP_SECRET);
  // ─────────────────────────────────────────────────────────────────────────

  if (error || !code || !workspaceId) {
    return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=cancelled`);
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Requested diagnostic logs
    console.log('[CB] client_id first4:', process.env.NEXT_PUBLIC_META_APP_ID?.substring(0, 4));
    console.log('[CB] secret first4:', process.env.META_APP_SECRET?.substring(0, 4));
    console.log('[CB] redirect_uri:', redirectUri);
    console.log('[CB] code length:', code?.length);

    // Use application/x-www-form-urlencoded — required by https://api.instagram.com/oauth/access_token
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: process.env.META_APP_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });

    console.log(`[CB:${inv}] POST https://api.instagram.com/oauth/access_token`);

    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const tokenText = await tokenRes.text();
    console.log(`[CB:${inv}] token status:`, tokenRes.status);
    console.log(`[CB:${inv}] token raw response:`, tokenText);

    let tokenData: Record<string, unknown>;
    try { tokenData = JSON.parse(tokenText); } catch { tokenData = { parse_error: tokenText }; }

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=token`);
    }

    const shortToken = (tokenData.access_token as string).trim();
    const igUserId = tokenData.user_id;

    console.log('[CB] short token first 20:', shortToken?.substring(0, 20));
    console.log('[CB] igUserId:', igUserId);

    const longTokenRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.META_APP_SECRET}&access_token=${shortToken}`
    );
    const longTokenData = await longTokenRes.json();
    const accessToken = ((longTokenData.access_token ?? shortToken) as string).trim();
    // Échéance du token (60 jours) : sans elle, /api/cron/refresh-tokens ne peut
    // pas savoir quels comptes renouveler avant la coupure.
    const tokenExpiresAt = expiryFromNow(longTokenData.expires_in);

    console.log('[CB] long token first 20:', accessToken?.substring(0, 20));

    const igDetailsRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
    );
    const igDetails = await igDetailsRes.json();
    console.log('[CB] igDetails response:', JSON.stringify(igDetails));

    console.log('[CB] Saving token - first20:', accessToken?.substring(0, 20));
    console.log('[CB] Saving igUserId:', igUserId);
    console.log('[CB] Token type:', typeof accessToken);
    console.log('[CB] Token length:', accessToken?.length);

    const { data: updated, error: updateError } = await supabase.from("workspaces").update({
      instagram_account_id: String(igUserId),
      instagram_access_token: accessToken.trim(),
      instagram_username: igDetails.username ?? igDetails.name ?? String(igUserId),
      instagram_connected_at: new Date().toISOString(),
      instagram_token_expires_at: tokenExpiresAt,
      instagram_token_refreshed_at: new Date().toISOString(),
    }).eq("id", workspaceId).select("id");

    // RLS exige auth.uid() = user_id : si la session n'était pas présente/valide
    // au moment du callback (ex. redirection OAuth arrivée sur un autre domaine
    // que celui où l'utilisateur est connecté), l'update ne touche 0 ligne sans
    // lever d'erreur — il faut le détecter explicitement, sinon on affiche un
    // faux "connecté" alors que rien n'a été enregistré.
    if (updateError || !updated || updated.length === 0) {
      console.error(`[CB:${inv}] update failed — error:`, updateError, "rows:", updated?.length ?? 0);
      return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=save_failed`);
    }

    console.log(`[CB:${inv}] SUCCESS — connected @${igDetails.username}`);
    return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/planning?connected=true`);
  } catch (err) {
    console.error(`[CB:${inv}] Callback error:`, err);
    return NextResponse.redirect(`${appUrl}/workspace/${workspaceId}/parametres?error=unknown`);
  }
}
