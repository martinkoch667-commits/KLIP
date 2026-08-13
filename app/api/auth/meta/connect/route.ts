import { NextRequest, NextResponse } from "next/server";

// ID d'app Instagram dédié (distinct de l'ID principal de l'app Meta,
// 1998010880798347, qui lui sert au flux Facebook Login). Le endpoint
// instagram.com/oauth/authorize exige spécifiquement cet ID Instagram —
// lui passer l'ID principal renvoie "Invalid platform app".
const APP_ID = "991302360155193";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getklip.fr";
const REDIRECT_URI = `${APP_URL}/api/auth/meta/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId manquant" }, { status: 400 });
  }

  console.log('[Connect] client_id:', APP_ID);
  console.log('[Connect] redirect_uri:', REDIRECT_URI);

  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    // On ne demande QUE les permissions réellement utilisées par le code :
    // basic (profil + médias) et content_publish (création/publication). Meta
    // exige une démo vidéo par permission à l'App Review — demander messages,
    // comments ou insights sans code correspondant fait rejeter la soumission.
    scope: "instagram_business_basic,instagram_business_content_publish",
    state: workspaceId,
    response_type: "code",
    // Sans ça, Instagram réutilise silencieusement la session ouverte dans le
    // navigateur : une agence qui connecte le compte d'un client se retrouve à
    // brancher le sien, sans jamais voir d'écran de choix. force_reauth impose
    // la saisie des identifiants du compte qu'on veut réellement connecter.
    force_reauth: "true",
  });

  const authUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  console.log("[Connect] auth URL:", authUrl);

  return NextResponse.redirect(authUrl);
}
