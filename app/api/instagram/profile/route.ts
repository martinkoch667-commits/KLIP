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
      fetch(`https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,timestamp&limit=9&access_token=${token}`),
    ]);
    const [pData, mData] = await Promise.all([pRes.json(), mRes.json()]);

    // Bug 2 debug logs
    console.log('[instagram/profile] media API status:', mRes.status);
    console.log('[instagram/profile] media error:', mData.error ?? null);
    console.log('[instagram/profile] media count:', mData.data?.length ?? 0);
    if (mData.data) {
      mData.data.forEach((m: { id: string; media_type?: string; media_url?: string; thumbnail_url?: string }, i: number) => {
        console.log(`[instagram/profile] media[${i}]:`, {
          id: m.id,
          type: m.media_type,
          has_media_url: !!m.media_url,
          has_thumbnail_url: !!m.thumbnail_url,
        });
      });
    }

    const media = (mData.data ?? []).map((m: { id: string; media_type?: string; media_url?: string; thumbnail_url?: string; timestamp?: string }) => ({
      id: m.id,
      media_type: m.media_type,
      media_url: m.media_url ?? null,
      thumbnail_url: m.thumbnail_url ?? null,
      // Image à afficher dans une grille. Contrairement à ce que supposait le
      // code précédent, une VIDEO a bien un media_url — mais il pointe sur le
      // .mp4, qu'aucune balise <img> ne sait rendre : la vignette était donc
      // remplacée par une image cassée. Pour une vidéo c'est thumbnail_url
      // qu'il faut, media_url ne servant que si l'on veut lire la vidéo.
      display_url: m.media_type === "VIDEO"
        ? m.thumbnail_url ?? m.media_url ?? null
        : m.media_url ?? m.thumbnail_url ?? null,
      timestamp: m.timestamp,
    }));

    return NextResponse.json({
      connected: true,
      name: ws.name,
      profile: pData.error ? null : pData,
      media: mData.error ? [] : media,
    });
  } catch (err) {
    console.error('[instagram/profile] caught:', err);
    return NextResponse.json({
      connected: true,
      name: ws.name,
      profile: null,
      media: [],
    });
  }
}
