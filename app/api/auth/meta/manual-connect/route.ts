import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, accessToken, igUserId } = await request.json();

    if (!workspaceId || !accessToken || !igUserId) {
      return NextResponse.json({ error: "workspaceId, accessToken et igUserId requis" }, { status: 400 });
    }

    const igDetailsRes = await fetch(
      `https://graph.instagram.com/v18.0/${igUserId}?fields=username,name&access_token=${accessToken}`
    );
    const igDetails = await igDetailsRes.json();

    console.log('[ManualConnect] igDetails:', igDetails);

    const supabase = createRouteHandlerClient({ cookies });

    await supabase.from("workspaces").update({
      instagram_account_id: String(igUserId),
      instagram_access_token: accessToken,
      instagram_username: igDetails.username ?? igDetails.name ?? String(igUserId),
      instagram_connected_at: new Date().toISOString(),
    }).eq("id", workspaceId);

    return NextResponse.json({ success: true, username: igDetails.username ?? igDetails.name });
  } catch (err) {
    console.error("[ManualConnect] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
