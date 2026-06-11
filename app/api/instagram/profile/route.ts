import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });

  // Verify user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch token server-side — never sent to the client
  const { data: ws } = await supabase
    .from("workspaces")
    .select("name, instagram_access_token, instagram_username")
    .eq("id", workspaceId)
    .single();

  if (!ws?.instagram_access_token) {
    return NextResponse.json({ connected: false, name: ws?.name ?? null });
  }

  const token = ws.instagram_access_token.trim();

  try {
    const [pRes, mRes] = await Promise.all([
      fetch(`https://graph.instagram.com/me?fields=username,media_count,biography,followers_count,follows_count,profile_picture_url&access_token=${token}`),
      fetch(`https://graph.instagram.com/me/media?fields=id,media_url,thumbnail_url,timestamp&limit=9&access_token=${token}`),
    ]);
    const [pData, mData] = await Promise.all([pRes.json(), mRes.json()]);

    return NextResponse.json({
      connected: true,
      name: ws.name,
      profile: pData.error ? null : pData,
      media: mData.error ? [] : (mData.data ?? []),
    });
  } catch {
    return NextResponse.json({
      connected: true,
      name: ws.name,
      profile: null,
      media: [],
    });
  }
}
