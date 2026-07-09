import { NextRequest, NextResponse } from 'next/server';
import { mcpDb, generateOpaqueToken, hashToken, verifyPkce } from '@/lib/mcp-oauth';

const ACCESS_TTL_S = 60 * 60;          // 1h
const REFRESH_TTL_S = 60 * 60 * 24 * 90; // 90j

async function parseBody(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { return await request.json(); } catch { return {}; }
  }
  const form = await request.formData();
  const out: Record<string, string> = {};
  form.forEach((v, k) => { out[k] = String(v); });
  return out;
}

// Endpoint token OAuth — grants authorization_code (échange initial, PKCE) et
// refresh_token (renouvellement, avec rotation). Appelé directement par Claude,
// aucune session cookie disponible → client service-role.
export async function POST(request: NextRequest) {
  const body = await parseBody(request);
  const db = mcpDb();

  if (body.grant_type === 'authorization_code') {
    const { code, redirect_uri: redirectUri, client_id: clientId, code_verifier: codeVerifier } = body;
    if (!code || !redirectUri || !clientId || !codeVerifier) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    const { data: authCode } = await db
      .from('mcp_oauth_codes')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (!authCode || authCode.used_at || authCode.client_id !== clientId || authCode.redirect_uri !== redirectUri) {
      return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
    }
    if (new Date(authCode.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'invalid_grant', error_description: 'code expiré' }, { status: 400 });
    }
    if (!verifyPkce(codeVerifier, authCode.code_challenge)) {
      return NextResponse.json({ error: 'invalid_grant', error_description: 'PKCE invalide' }, { status: 400 });
    }

    await db.from('mcp_oauth_codes').update({ used_at: new Date().toISOString() }).eq('code', code);

    const accessToken = generateOpaqueToken();
    const refreshToken = generateOpaqueToken();
    const now = Date.now();
    await db.from('mcp_oauth_tokens').insert({
      user_id: authCode.user_id,
      client_id: clientId,
      access_token_hash: hashToken(accessToken),
      refresh_token_hash: hashToken(refreshToken),
      access_expires_at: new Date(now + ACCESS_TTL_S * 1000).toISOString(),
      refresh_expires_at: new Date(now + REFRESH_TTL_S * 1000).toISOString(),
    });

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_S,
      refresh_token: refreshToken,
    });
  }

  if (body.grant_type === 'refresh_token') {
    const { refresh_token: refreshToken, client_id: clientId } = body;
    if (!refreshToken || !clientId) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    const { data: tokenRow } = await db
      .from('mcp_oauth_tokens')
      .select('*')
      .eq('refresh_token_hash', hashToken(refreshToken))
      .maybeSingle();

    if (!tokenRow || tokenRow.revoked_at || tokenRow.client_id !== clientId) {
      return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
    }
    if (new Date(tokenRow.refresh_expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'invalid_grant', error_description: 'refresh token expiré' }, { status: 400 });
    }

    await db.from('mcp_oauth_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', tokenRow.id);

    const newAccessToken = generateOpaqueToken();
    const newRefreshToken = generateOpaqueToken();
    const now = Date.now();
    await db.from('mcp_oauth_tokens').insert({
      user_id: tokenRow.user_id,
      client_id: clientId,
      access_token_hash: hashToken(newAccessToken),
      refresh_token_hash: hashToken(newRefreshToken),
      access_expires_at: new Date(now + ACCESS_TTL_S * 1000).toISOString(),
      refresh_expires_at: new Date(now + REFRESH_TTL_S * 1000).toISOString(),
    });

    return NextResponse.json({
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_S,
      refresh_token: newRefreshToken,
    });
  }

  return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
}
