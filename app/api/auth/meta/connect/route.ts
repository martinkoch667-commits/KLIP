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
  // D'où vient la demande. Instagram ne nous rend que le paramètre `state` :
  // c'est donc le seul endroit où faire voyager cette information, et sans elle
  // le callback ramène toujours sur le planning — y compris quand la connexion
  // a été lancée depuis la création de client, qui n'est pas terminée.
  const from = searchParams.get("from") === "onboarding" ? "onboarding" : "";

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
    state: from ? `${workspaceId}|${from}` : workspaceId,
    response_type: "code",
    // NE PAS ajouter force_reauth ici. L'intention est bonne — sans lui,
    // Instagram réutilise la session ouverte dans le navigateur et connecte le
    // compte de l'agence au lieu de celui du client, sans écran de choix. Mais
    // testé en production le 13/08/2026 : après la saisie des identifiants,
    // Instagram dépose l'utilisateur sur son fil et ne reprend jamais
    // l'autorisation. Le flux ne revient donc plus jamais sur Klip.
    // En attendant mieux, on choisit le compte via une fenêtre de navigation
    // privée (aucune session active = écran de connexion naturel).
  });

  const authUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  console.log("[Connect] auth URL:", authUrl);

  return NextResponse.redirect(authUrl);
}
