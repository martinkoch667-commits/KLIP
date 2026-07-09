import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { decrypt } from './crypto';

// Retourne la clé Anthropic à utiliser pour cet utilisateur : sa propre clé
// (BYOK) si elle est configurée, sinon la clé plateforme partagée.
export async function getAnthropicApiKeyForUser(userId: string): Promise<string | null> {
  const supabase = createRouteHandlerClient({ cookies });
  const { data } = await supabase
    .from('user_settings')
    .select('anthropic_api_key_encrypted')
    .eq('user_id', userId)
    .maybeSingle();

  if (data?.anthropic_api_key_encrypted) {
    try {
      return decrypt(data.anthropic_api_key_encrypted);
    } catch (err) {
      console.error('[anthropic-key] Échec du déchiffrement de la clé BYOK, fallback clé plateforme', err);
    }
  }

  return process.env.ANTHROPIC_API_KEY ?? null;
}
