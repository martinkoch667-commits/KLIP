import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { mcpDb } from '@/lib/mcp-oauth';

// Écran d'autorisation OAuth — nécessite une session KLIP valide (redirige vers
// /login sinon), vérifie le client + redirect_uri enregistrés, puis affiche un
// consentement minimal avant de générer le code d'autorisation (PKCE).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const clientId = url.searchParams.get('client_id') || '';
  const redirectUri = url.searchParams.get('redirect_uri') || '';
  const state = url.searchParams.get('state') || '';
  const codeChallenge = url.searchParams.get('code_challenge') || '';
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') || '';
  const responseType = url.searchParams.get('response_type') || '';
  const consent = url.searchParams.get('consent');

  if (responseType !== 'code' || !clientId || !redirectUri || !codeChallenge || codeChallengeMethod !== 'S256') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const db = mcpDb();
  const { data: client } = await db
    .from('mcp_oauth_clients')
    .select('client_id, redirect_uris, client_name')
    .eq('client_id', clientId)
    .maybeSingle();

  if (!client || !client.redirect_uris.includes(redirectUri)) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const next = encodeURIComponent(url.pathname + url.search);
    return NextResponse.redirect(new URL(`/login?next=${next}`, url.origin));
  }

  if (consent === 'refuse') {
    const denyUrl = new URL(redirectUri);
    denyUrl.searchParams.set('error', 'access_denied');
    if (state) denyUrl.searchParams.set('state', state);
    return NextResponse.redirect(denyUrl);
  }

  if (consent === 'accept') {
    const { data: code, error } = await db
      .from('mcp_oauth_codes')
      .insert({
        user_id: session.user.id,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
      })
      .select('code')
      .single();
    if (error || !code) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }
    const successUrl = new URL(redirectUri);
    successUrl.searchParams.set('code', code.code);
    if (state) successUrl.searchParams.set('state', state);
    return NextResponse.redirect(successUrl);
  }

  // Écran de consentement (server-rendered, minimal — pas besoin d'une page React
  // à part entière pour un écran ponctuel d'autorisation).
  const selfUrl = new URL(url.pathname + url.search, url.origin);
  const acceptUrl = new URL(selfUrl); acceptUrl.searchParams.set('consent', 'accept');
  const refuseUrl = new URL(selfUrl); refuseUrl.searchParams.set('consent', 'refuse');

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<title>Connecter Claude à KLIP</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#F4F3EC; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  .card { max-width:420px; width:calc(100% - 48px); background:#fff; border-radius:18px; padding:32px 28px; box-shadow:0 20px 50px -20px rgba(0,0,0,.25); }
  h1 { font-size:19px; margin:0 0 10px; color:#0C2A1D; }
  p { font-size:14px; line-height:1.55; color:rgba(20,22,15,.7); margin:0 0 24px; }
  .row { display:flex; gap:10px; }
  a.btn { flex:1; text-align:center; padding:12px 16px; border-radius:12px; font-weight:700; font-size:13.5px; text-decoration:none; }
  a.accept { background:#2FD79B; color:#06281C; }
  a.refuse { background:transparent; color:#0C2A1D; border:1.5px solid rgba(12,42,29,.18); }
</style></head>
<body>
  <div class="card">
    <h1>Connecter Claude à votre compte KLIP</h1>
    <p><strong>${client.client_name || 'Claude'}</strong> demande à accéder à votre compte KLIP (clients, création et planification de posts, génération de légendes) en votre nom.</p>
    <div class="row">
      <a class="btn refuse" href="${refuseUrl.toString()}">Refuser</a>
      <a class="btn accept" href="${acceptUrl.toString()}">Autoriser</a>
    </div>
  </div>
</body></html>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
