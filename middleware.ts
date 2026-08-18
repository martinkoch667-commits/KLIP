import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAccessBlocked } from "@/lib/plans";
import { aiLimitFor, consume } from "@/lib/ai-guard";

const PROTECTED_ROUTES = ["/dashboard", "/workspace", "/calendar", "/composer", "/feed", "/templates", "/settings"];

// Routes /api qui ne dépendent pas d'une session cookie (jeton OAuth, signature
// Stripe, appel serveur à serveur, proxy d'images très sollicité). Inutile de
// leur payer un aller-retour Supabase à chaque requête.
const SESSIONLESS_API = ["/api/proxy-image", "/api/mcp", "/api/stripe/webhook", "/api/cron", "/api/preview", "/api/google-fonts", "/api/iconify"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (SESSIONLESS_API.some((route) => pathname.startsWith(route))) return NextResponse.next();

  const res = NextResponse.next();

  const supabase = createMiddlewareClient({ req, res });

  // Effet de bord VOULU : getSession() rafraîchit le jeton expiré et réécrit le
  // cookie sur `req` et `res`. C'est ce qui permet aux handlers /api de lire une
  // session valide sur un onglet resté ouvert plus d'une heure.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Garde-fou IA : appliqué ici plutôt que route par route, pour qu'une future
  // route de génération soit couverte sans qu'on ait à y penser.
  const aiLimit = aiLimitFor(pathname);
  if (aiLimit && session) {
    const verdict = consume(session.user.id, aiLimit.kind, aiLimit.max);
    if (!verdict.ok) {
      console.warn(`[ai-guard] ${aiLimit.kind} plafonné pour ${session.user.id} sur ${pathname}`);
      return NextResponse.json(
        { error: "Trop de générations d'affilée. Réessayez dans un instant.", code: "AI_RATE_LIMIT" },
        { status: 429, headers: { "Retry-After": String(verdict.retryAfterSec) } }
      );
    }
  }

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtected && !session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Essai expiré sans abonnement actif → écran d'abonnement
  if (isProtected && session) {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("subscription_status, trial_ends_at, is_comped")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (isAccessBlocked(settings)) {
      return NextResponse.redirect(new URL("/abonnement", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    // Les routes /api sont incluses non pour être protégées (elles ne le sont
    // pas ici) mais pour que le jeton Supabase soit RAFRAÎCHI avant que le
    // handler ne lise le cookie : sur un onglet resté ouvert, le jeton d'accès
    // expirait et /api/generate-description répondait « Non autorisé ».
    "/api/:path*",
    "/dashboard/:path*",
    "/workspace/:path*",
    "/calendar/:path*",
    "/composer/:path*",
    "/feed/:path*",
    "/templates/:path*",
    "/settings/:path*",
  ],
};
