import { NextRequest, NextResponse } from 'next/server';

// Métadonnées de la ressource protégée (RFC 9728) — indique que le serveur
// MCP KLIP (/api/mcp) est protégé par le serveur d'autorisation défini dans
// /.well-known/oauth-authorization-server.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  return NextResponse.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
  });
}
