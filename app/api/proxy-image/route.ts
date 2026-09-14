import { NextRequest, NextResponse } from "next/server";

// Anti-SSRF : refuse les adresses internes/privées pour ne pas transformer
// le proxy en passerelle vers le réseau interne (metadata cloud, localhost…).
// Le garde vit dans lib/safeUrl : il sert aussi à l'analyse d'un site de marque,
// et deux copies auraient fini par diverger.
import { isBlockedHost } from "@/lib/safeUrl";

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
    // Les logos SVG passent (image/svg+xml contient « xml » et tombait sous le
    // filtre : logo de Pepe Chicken vide, couleurs du logo jamais lues, le
    // 14/09/2026). Ils sont servis avec une CSP qui interdit tout script, au cas
    // où quelqu'un ouvrirait l'adresse du proxy directement ; dans une balise
    // <img> ou un canvas, un SVG n'exécute de toute façon rien.
    const estSvg = /image\/svg\+xml/i.test(contentType);
    // Empêche le proxy de relayer du contenu web (html/json/script) — mais tolère les images
    // servies sans bon content-type (ex. Supabase qui renvoie application/octet-stream).
    if (!estSvg && /text\/|html|json|javascript|xml/i.test(contentType)) {
      return new NextResponse("Contenu non autorisé", { status: 415 });
    }
    const buffer = await res.arrayBuffer();
    // Si le content-type est absent/générique, on force un type image neutre pour l'affichage.
    const safeType = contentType.startsWith("image/") ? contentType : "image/jpeg";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": safeType,
        ...(estSvg ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox", "X-Content-Type-Options": "nosniff" } : {}),
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
