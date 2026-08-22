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
    // Le 13/08/2026, l'ajouter avait semblé casser le retour vers Klip — sans
    // lui, on pensait éviter qu'Instagram réutilise la session ouverte et
    // connecte le compte de l'agence au lieu de celui du client. Mais
    // retesté le 21/08/2026, dans l'autre sens : SANS force_reauth, c'est le
    // retour vers Klip qui échoue — Instagram dépose l'utilisateur sur son
    // fil et ne reprend jamais l'autorisation. AVEC, comparé au lien que
    // fournit Meta lui-même dans son propre tableau de bord (qui l'inclut par
    // défaut), le retour fonctionne. La panne du 13/08 avait donc une autre
    // cause, jamais identifiée. On revient à ce que Meta recommande : un
    // écran de connexion à chaque fois, quitte à devoir choisir le bon
    // compte, plutôt qu'un flux qui ne revient parfois jamais.
    force_reauth: "true",
  });

  const authUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  console.log("[Connect] auth URL:", authUrl);

  return NextResponse.redirect(authUrl);
}
