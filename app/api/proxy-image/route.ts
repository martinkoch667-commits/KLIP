import { NextRequest, NextResponse } from "next/server";

// Anti-SSRF : refuse les adresses internes/privées pour ne pas transformer
// le proxy en passerelle vers le réseau interne (metadata cloud, localhost…).
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "169.254.169.254") return true; // metadata cloud
  // IPv4 privées / loopback
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  // IPv6 loopback / link-local / unique-local
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return new NextResponse("url manquant", { status: 400 });
  }

  // Validation stricte de l'URL : schéma http(s) uniquement + hôte non-interne.
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return new NextResponse("url invalide", { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return new NextResponse("schéma non autorisé", { status: 400 });
  }
  if (isBlockedHost(target.hostname)) {
    return new NextResponse("hôte non autorisé", { status: 403 });
  }

  try {
    const res = await fetch(target.toString(), {
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
    // N'autorise que des images : empêche d'utiliser le proxy pour relayer du contenu arbitraire.
    if (!contentType.startsWith("image/")) {
      return new NextResponse("Contenu non autorisé", { status: 415 });
    }
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
