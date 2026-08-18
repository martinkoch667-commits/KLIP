import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  // Validate next to prevent open redirects (must be a relative path)
  const rawNext = requestUrl.searchParams.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  // Supabase renvoie ses refus dans l'URL plutôt qu'en code HTTP : lien périmé,
  // déjà utilisé, ou signature invalide. Sans ce test, l'utilisateur atterrit
  // sur /login sans savoir ce qui a échoué.
  if (requestUrl.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/login?verif=expire", requestUrl.origin));
  }

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    // L'adresse EST confirmée à ce stade : Supabase la valide côté serveur avant
    // de rediriger ici. Ce qui échoue, c'est l'ouverture de session, parce que le
    // vérificateur PKCE vit dans le navigateur qui a lancé l'inscription. Cliquer
    // le lien depuis son téléphone alors qu'on s'est inscrit sur l'ordinateur
    // tombe exactement là. On l'envoie donc se connecter, en le lui disant.
    if (error) {
      return NextResponse.redirect(new URL("/login?verif=ok", requestUrl.origin));
    }

    // Check if new user (no account_type set) → onboarding
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("account_type")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!settings?.account_type) {
        return NextResponse.redirect(new URL("/onboarding/plan", requestUrl.origin));
      }
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
