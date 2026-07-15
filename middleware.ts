import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAccessBlocked } from "@/lib/plans";

const PROTECTED_ROUTES = ["/dashboard", "/workspace", "/calendar", "/composer", "/feed", "/templates", "/settings"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;
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
    "/dashboard/:path*",
    "/workspace/:path*",
    "/calendar/:path*",
    "/composer/:path*",
    "/feed/:path*",
    "/templates/:path*",
    "/settings/:path*",
  ],
};
