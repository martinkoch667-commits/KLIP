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
  /* Venu du parcours d'essai, la page de connexion garde l'étape où reprendre :
     sinon la personne se connecte et atterrit sur l'ancien écran d'offre, sans
     son site ni sa charte. */
  const versConnexion = (verif: "ok" | "expire") => {
    const url = new URL(`/login?verif=${verif}`, requestUrl.origin);
    if (next.startsWith("/onboarding/")) url.searchParams.set("redirect", next);
    return NextResponse.redirect(url);
  };

  if (requestUrl.searchParams.get("error")) {
    return versConnexion("expire");
  }

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    // L'adresse EST confirmée à ce stade : Supabase la valide côté serveur avant
    // de rediriger ici. Ce qui échoue, c'est l'ouverture de session, parce que le
    // vérificateur PKCE vit dans le navigateur qui a lancé l'inscription. Cliquer
    // le lien depuis son téléphone alors qu'on s'est inscrit sur l'ordinateur
    // tombe exactement là. On l'envoie donc se connecter, en le lui disant.
    // Cas fréquent avec une campagne Instagram : inscrit dans le navigateur de
    // l'appli, le lien du mail s'ouvre dans Safari ou Chrome.
    if (error) {
      return versConnexion("ok");
    }

    // Check if new user (no account_type set) → onboarding
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("account_type")
        .eq("user_id", session.user.id)
        .maybeSingle();

      /* Nouveau compte : il reprend l'étape du parcours d'essai d'où il vient
         (`next`), sinon il commence ce parcours par son premier écran. Tout
         nouveau compte y passe, y compris depuis « Essai gratuit » dans la nav. */
      if (!settings?.account_type) {
        const versEssai = next.startsWith("/onboarding/") ? next : "/onboarding/connexion";
        return NextResponse.redirect(new URL(versEssai, requestUrl.origin));
      }
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
