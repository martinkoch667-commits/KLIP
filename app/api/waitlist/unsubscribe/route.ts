import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { unsubToken } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const page = (title: string, body: string) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>${title} — Klip</title></head>
<body style="margin:0;background:#F3F4F7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:460px;margin:14vh auto;padding:34px 30px;background:#fff;border-radius:18px;box-shadow:0 30px 60px -40px rgba(0,0,0,.35);">
    <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-.02em;color:#14160F;">${title}</h1>
    <div style="font-size:15px;line-height:1.65;color:#5A5E50;">${body}</div>
    <a href="https://getklip.fr" style="display:inline-block;margin-top:22px;font-size:14px;color:#14160F;">Retour sur getklip.fr</a>
  </div>
</body></html>`;

const html = (body: string, status = 200) =>
  new NextResponse(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

// Désinscription en un clic depuis le pied de page des emails (obligation RGPD).
// Le jeton est un HMAC de l'email : impossible de désinscrire quelqu'un d'autre.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('e') || '').trim().toLowerCase();
  const token = url.searchParams.get('t') || '';

  const expected = email ? unsubToken(email) : '';
  const valid =
    !!email &&
    token.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));

  if (!valid) {
    return html(page('Lien invalide', "Ce lien de désinscription n'est pas valide ou a expiré. Répondez simplement à l'email et je vous retire de la liste à la main."), 400);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return html(page('Service indisponible', 'Réessayez dans un instant.'), 500);
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await db
    .from('waitlist')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('email', email);

  if (error) {
    console.error('[unsubscribe]', error.message);
    return html(page('Oups', "La désinscription n'a pas pu être enregistrée. Répondez à l'email et je m'en occupe."), 500);
  }

  return html(page(
    'C\'est fait',
    `<strong>${email}</strong> ne recevra plus d'emails de Klip. Aucune action supplémentaire de votre part.<br/><br/>Merci d'avoir donné sa chance au projet — et bonne continuation.`,
  ));
}
