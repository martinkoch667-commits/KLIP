import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return new NextResponse("url manquant", { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        // Instagram requires a realistic User-Agent + Referer, otherwise 403/redirect loop
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://www.instagram.com/",
        "Accept": "image/*,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.error(`[proxy-image] fetch failed: ${res.status} for ${url.slice(0, 80)}`);
      return new NextResponse("Image introuvable", { status: res.status });
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        // Instagram media_url expire after a few hours — don't cache longer than 1h
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[proxy-image] error:", err);
    return new NextResponse("Erreur proxy", { status: 500 });
  }
}
