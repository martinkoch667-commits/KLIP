import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { decrypt } from './crypto';

export type AiProvider = { provider: 'anthropic'; apiKey: string } | { provider: 'gemini' };

// Décide quel fournisseur IA utiliser pour cet utilisateur : Claude (avec sa
// propre clé BYOK) s'il en a connecté une, sinon Gemini par défaut (clé
// plateforme) — pour ne jamais débiter la clé Anthropic de KLIP sans que
// l'utilisateur ait explicitement connecté la sienne.
export async function resolveAiProvider(userId: string): Promise<AiProvider> {
  const supabase = createRouteHandlerClient({ cookies });
  const { data } = await supabase
    .from('user_settings')
    .select('anthropic_api_key_encrypted')
    .eq('user_id', userId)
    .maybeSingle();

  if (data?.anthropic_api_key_encrypted) {
    try {
      return { provider: 'anthropic', apiKey: decrypt(data.anthropic_api_key_encrypted) };
    } catch (err) {
      console.error('[ai-provider] Échec du déchiffrement de la clé BYOK, fallback Gemini', err);
    }
  }

  return { provider: 'gemini' };
}
