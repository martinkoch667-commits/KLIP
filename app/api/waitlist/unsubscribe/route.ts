import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyUnsubToken } from '@/lib/email';

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

type Outcome =
  | { ok: true; email: string }
  | { ok: false; status: 400 | 500; title: string; detail: string };

// Le jeton est un HMAC de l'email : impossible de désinscrire quelqu'un d'autre.
async function unsubscribe(request: NextRequest): Promise<Outcome> {
  const url = new URL(request.url);
  const email = (url.searchParams.get('e') || '').trim().toLowerCase();
  const token = url.searchParams.get('t') || '';

  if (!verifyUnsubToken(email, token)) {
    return { ok: false, status: 400, title: 'Lien invalide', detail: "Ce lien de désinscription n'est pas valide ou a expiré. Répondez simplement à l'email et je vous retire de la liste à la main." };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, status: 500, title: 'Service indisponible', detail: 'Réessayez dans un instant.' };
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await db
    .from('waitlist')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('email', email);

  if (error) {
    console.error('[unsubscribe]', error.message);
    return { ok: false, status: 500, title: 'Oups', detail: "La désinscription n'a pas pu être enregistrée. Répondez à l'email et je m'en occupe." };
  }

  return { ok: true, email };
}

// Désinscription en un clic depuis le pied de page des emails (obligation RGPD).
export async function GET(request: NextRequest) {
  const out = await unsubscribe(request);
  if (!out.ok) return html(page(out.title, out.detail), out.status);
  return html(page(
    'C\'est fait',
    `<strong>${out.email}</strong> ne recevra plus d'emails de Klip. Aucune action supplémentaire de votre part.<br/><br/>Merci d'avoir donné sa chance au projet — et bonne continuation.`,
  ));
}

/* Désinscription en un clic depuis le client de messagerie (RFC 8058). Quand un
   mail porte `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, Gmail appelle
   cette URL en POST, sans ouvrir de navigateur et sans rien demander à
   l'utilisateur. Il attend un 2xx ; une page HTML ne l'intéresse pas, et un 405
   lui ferait considérer la désinscription comme cassée. */
export async function POST(request: NextRequest) {
  const out = await unsubscribe(request);
  return new NextResponse(out.ok ? 'OK' : out.title, {
    status: out.ok ? 200 : out.status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
