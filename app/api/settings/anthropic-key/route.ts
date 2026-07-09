import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/crypto';

// GET /api/settings/anthropic-key — statut de la clé BYOK de l'utilisateur (jamais la clé en clair).
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { data } = await supabase
    .from('user_settings')
    .select('anthropic_api_key_encrypted, anthropic_api_key_last4, anthropic_api_key_added_at')
    .eq('user_id', session.user.id)
    .maybeSingle();

  return NextResponse.json({
    configured: !!data?.anthropic_api_key_encrypted,
    last4: data?.anthropic_api_key_last4 ?? null,
    addedAt: data?.anthropic_api_key_added_at ?? null,
  });
}

// POST /api/settings/anthropic-key — valide puis enregistre (chiffrée) la clé Anthropic perso.
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { apiKey } = await request.json();
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    return NextResponse.json({ error: 'Clé API manquante' }, { status: 400 });
  }
  const trimmed = apiKey.trim();
  if (!trimmed.startsWith('sk-ant-')) {
    return NextResponse.json({ error: 'Format de clé invalide (doit commencer par "sk-ant-")' }, { status: 400 });
  }

  const testRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': trimmed, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
  });
  if (!testRes.ok) {
    return NextResponse.json({ error: 'Clé invalide ou refusée par Anthropic' }, { status: 400 });
  }

  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: session.user.id,
      anthropic_api_key_encrypted: encrypt(trimmed),
      anthropic_api_key_last4: trimmed.slice(-4),
      anthropic_api_key_added_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    console.error('[anthropic-key][POST] Supabase error', error);
    return NextResponse.json({ error: 'Échec de l\'enregistrement' }, { status: 500 });
  }

  return NextResponse.json({ configured: true, last4: trimmed.slice(-4) });
}

// DELETE /api/settings/anthropic-key — retire la clé perso, retour à la clé plateforme.
export async function DELETE() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { error } = await supabase
    .from('user_settings')
    .update({ anthropic_api_key_encrypted: null, anthropic_api_key_last4: null, anthropic_api_key_added_at: null })
    .eq('user_id', session.user.id);
  if (error) {
    console.error('[anthropic-key][DELETE] Supabase error', error);
    return NextResponse.json({ error: 'Échec de la suppression' }, { status: 500 });
  }

  return NextResponse.json({ configured: false });
}
