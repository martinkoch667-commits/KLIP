import { NextRequest, NextResponse } from 'next/server';
import { mcpDb } from '@/lib/mcp-oauth';

// Enregistrement dynamique de client OAuth (RFC 7591) — Claude s'auto-enregistre
// ici au premier "Add custom connector", public (pas d'auth requise, comme
// app/api/waitlist/route.ts). Client public (PKCE), pas de secret émis.
export async function POST(request: NextRequest) {
  let body: { redirect_uris?: string[]; client_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_client_metadata' }, { status: 400 });
  }

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter(u => typeof u === 'string') : [];
  if (redirectUris.length === 0) {
    return NextResponse.json({ error: 'invalid_client_metadata', error_description: 'redirect_uris requis' }, { status: 400 });
  }

  const db = mcpDb();
  const { data, error } = await db
    .from('mcp_oauth_clients')
    .insert({ redirect_uris: redirectUris, client_name: body.client_name || 'Claude' })
    .select('client_id, client_name, redirect_uris, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  return NextResponse.json({
    client_id: data.client_id,
    client_name: data.client_name,
    redirect_uris: data.redirect_uris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    client_id_issued_at: Math.floor(new Date(data.created_at).getTime() / 1000),
  });
}
