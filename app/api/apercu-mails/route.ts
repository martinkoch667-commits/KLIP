import { NextRequest, NextResponse } from 'next/server';
import { sequence, sequenceStep } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Aperçu des mails de la séquence, dans le navigateur.
//   /api/apercu-mails         -> la planche complète (toute la séquence)
//   /api/apercu-mails?n=3     -> le mail 3 seul, tel qu'il sera reçu
// En production il faut &k=CRON_SECRET ; en local c'est ouvert.
const EXAMPLE = 'vous@agence.com';

const resolve = (html: string) =>
  html.replace(/\{\{UNSUB_URL\}\}/g, '#').replace(/\{\{EMAIL_ENC\}\}/g, encodeURIComponent(EXAMPLE));

const html = (body: string, status = 200) =>
  new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' },
  });

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  if (process.env.NODE_ENV === 'production') {
    const k = url.searchParams.get('k');
    if (!process.env.CRON_SECRET || k !== process.env.CRON_SECRET) {
      return html('<p style="font:15px system-ui;padding:40px;">Aperçu protégé — ajoute <code>?k=TON_CRON_SECRET</code> à l\'URL.</p>', 401);
    }
  }
  const key = url.searchParams.get('k');
  const keyQS = key ? `&k=${encodeURIComponent(key)}` : '';

  // Un seul mail, brut : c'est exactement ce que le destinataire recevra.
  const n = url.searchParams.get('n');
  if (n) {
    const step = sequenceStep(Number(n));
    if (!step) return html(`<p style="font:15px system-ui;padding:40px;">Mail n°${n} inconnu.</p>`, 404);
    return html(resolve(step.tpl().html));
  }

  // La planche : chaque mail dans son cadre, avec objet et calendrier.
  const cards = sequence.map(s => {
    const t = s.tpl();
    return `
    <section style="max-width:720px;margin:0 auto 34px;">
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:0 4px 10px;">
        <span style="background:#BDF2A0;color:#1E3317;font-weight:800;font-size:11px;letter-spacing:.08em;padding:4px 9px;border-radius:7px;">MAIL ${s.n}</span>
        <span style="font-size:12.5px;color:#8B8E7F;">${s.when} · ${s.goal}</span>
      </div>
      <div style="font-size:12px;color:#8B8E7F;padding:0 4px 4px;">Objet</div>
      <div style="font-size:17px;font-weight:800;letter-spacing:-.02em;color:#14160F;padding:0 4px 12px;">${t.subject}</div>
      <iframe src="/api/apercu-mails?n=${s.n}${keyQS}" title="Mail ${s.n}" loading="lazy"
        style="width:100%;height:1180px;border:1px solid rgba(13,15,10,.12);border-radius:16px;background:#fff;display:block;"></iframe>
    </section>`;
  }).join('');

  return html(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>Aperçu des mails — Klip</title></head>
<body style="margin:0;background:#F3F4F7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:34px 16px 60px;">
  <header style="max-width:720px;margin:0 auto 28px;">
    <h1 style="margin:0 0 6px;font-size:26px;letter-spacing:-.03em;color:#14160F;">Séquence pré-ouverture</h1>
    <p style="margin:0;font-size:14.5px;line-height:1.6;color:#5A5E50;">
      Les ${sequence.length} mails tels qu'ils partiront. Les liens de désinscription sont neutralisés ici.
      Pour tester un envoi réel&nbsp;: <code style="background:#EDEEF2;padding:2px 6px;border-radius:5px;">/api/waitlist/campaign?secret=…&amp;n=1&amp;test=ton@email.com</code>
    </p>
  </header>
  ${cards}
</body></html>`);
}
