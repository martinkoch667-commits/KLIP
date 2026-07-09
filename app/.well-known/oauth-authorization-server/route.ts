import { NextRequest, NextResponse } from 'next/server';

// Métadonnées du serveur d'autorisation (RFC 8414) — permet à Claude de
// découvrir automatiquement les endpoints OAuth de KLIP au moment d'ajouter
// le connecteur MCP personnalisé.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/api/mcp/oauth/authorize`,
    token_endpoint: `${origin}/api/mcp/oauth/token`,
    registration_endpoint: `${origin}/api/mcp/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  });
}
