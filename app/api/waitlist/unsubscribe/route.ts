import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyUnsubToken } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

const invalide = () =>
  html(page('Lien invalide', "Ce lien de désinscription n'est pas valide ou a expiré. Répondez simplement à l'email et je vous retire de la liste à la main."), 400);

/* Désinscription en deux temps (obligation RGPD).

   Le GET n'écrit RIEN : il affiche un bouton de confirmation. C'est délibéré et
   ça ne doit pas être « simplifié » en un clic. Les fournisseurs de messagerie
   et les antivirus visitent automatiquement les liens contenus dans les mails
   pour les analyser — un GET qui modifie la base se déclenche donc tout seul,
   et désinscrit des gens qui n'ont jamais rien demandé, en silence. Seul le
   POST du formulaire écrit : un robot d'analyse ne soumet pas un formulaire.

   Le jeton reste un HMAC de l'email : impossible de désinscrire quelqu'un d'autre. */
function identify(email: string, token: string): boolean {
  return verifyUnsubToken(email, token);
}

// GET — page de confirmation, aucune écriture.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('e') || '').trim().toLowerCase();
  const token = url.searchParams.get('t') || '';

  if (!identify(email, token)) return invalide();

  return html(page(
    'Confirmer la désinscription',
    `<p style="margin:0 0 18px;">Vous êtes sur le point de retirer <strong>${esc(email)}</strong> de la liste Klip. Vous ne recevrez plus aucun email de ma part.</p>
     <form method="post" style="margin:0;">
       <input type="hidden" name="e" value="${esc(email)}"/>
       <input type="hidden" name="t" value="${esc(token)}"/>
       <button type="submit" style="display:inline-block;background:#14160F;color:#fff;border:0;border-radius:10px;padding:13px 22px;font-size:15px;font-weight:600;cursor:pointer;">Confirmer ma désinscription</button>
     </form>
     <p style="margin:18px 0 0;font-size:13.5px;color:#8B8E7F;">Vous avez ouvert ce lien par erreur ? Fermez simplement cette page, rien n'a été modifié.</p>`,
  ));
}

// POST — l'écriture réelle, déclenchée par le bouton de la page ci-dessus.
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  let email = (url.searchParams.get('e') || '').trim().toLowerCase();
  let token = url.searchParams.get('t') || '';

  // Le formulaire renvoie les deux champs : ils font foi si la query est absente.
  try {
    const form = await request.formData();
    const fe = form.get('e');
    const ft = form.get('t');
    if (typeof fe === 'string' && fe.trim()) email = fe.trim().toLowerCase();
    if (typeof ft === 'string' && ft.trim()) token = ft.trim();
  } catch {
    /* pas de corps de formulaire : on s'en tient à la query string */
  }

  if (!identify(email, token)) return invalide();

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
    `<strong>${esc(email)}</strong> ne recevra plus d'emails de Klip. Aucune action supplémentaire de votre part.<br/><br/>Merci d'avoir donné sa chance au projet — et bonne continuation.`,
  ));
}
