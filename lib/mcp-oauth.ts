import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Client service-role dédié aux tables mcp_oauth_* — aucune session cookie
// n'existe côté Claude, RLS bypass assumé (comme app/api/preview/[token]).
export function mcpDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// PKCE S256 : code_challenge = base64url(sha256(code_verifier))
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return computed === codeChallenge;
}

export type ResolvedToken = { userId: string; clientId: string };

// Résout un access_token bearer (issu du header Authorization) vers l'utilisateur
// KLIP propriétaire, en vérifiant l'expiration et la révocation.
export async function resolveAccessToken(accessToken: string): Promise<ResolvedToken | null> {
  const db = mcpDb();
  const { data } = await db
    .from('mcp_oauth_tokens')
    .select('user_id, client_id, access_expires_at, revoked_at')
    .eq('access_token_hash', hashToken(accessToken))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  if (new Date(data.access_expires_at).getTime() < Date.now()) return null;
  return { userId: data.user_id, clientId: data.client_id };
}

// Vérifie qu'un workspace appartient bien à l'utilisateur résolu — indispensable
// car le client service-role bypass RLS, donc chaque outil doit filtrer lui-même.
export async function assertWorkspaceOwnership(userId: string, workspaceId: string): Promise<boolean> {
  const db = mcpDb();
  const { data } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}
