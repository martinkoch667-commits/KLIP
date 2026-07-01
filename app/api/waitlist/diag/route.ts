import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/waitlist/diag
//   -> état de la config (booléens, pas de secrets)
// GET /api/waitlist/diag?test=ton@email.com
//   -> tente un vrai envoi et renvoie la réponse EXACTE de Resend (pour voir l'erreur)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const test = url.searchParams.get('test');

  const resendKeySet = !!process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM ?? '(non défini → défaut onboarding@resend.dev)';
  const cronSecretSet = !!process.env.CRON_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '(non défini)';

  // Table waitlist accessible ?
  let waitlistCount: number | string = 'inconnu';
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { count, error } = await db.from('waitlist').select('*', { count: 'exact', head: true });
      waitlistCount = error ? `ERREUR: ${error.message}` : (count ?? 0);
    }
  } catch (e) { waitlistCount = `ERREUR: ${e instanceof Error ? e.message : e}`; }

  const buildMarker = "DEPLOY-CHECK-7A3F";
  const base = { buildMarker, resendKeySet, emailFrom, cronSecretSet, appUrl, waitlistCount };

  if (!test) {
    return NextResponse.json({
      ...base,
      astuce: "Ajoute ?test=ton@email.com pour tenter un vrai envoi et voir l'erreur exacte de Resend.",
    });
  }

  // Test d'envoi réel — protégé par le secret (évite tout abus/spam).
  const secret = url.searchParams.get('secret') || request.headers.get('x-launch-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ...base, testSend: 'PROTÉGÉ — ajoute &secret=TON_CRON_SECRET pour lancer un test.' }, { status: 401 });
  }
  if (!resendKeySet) {
    return NextResponse.json({ ...base, testSend: 'IMPOSSIBLE — RESEND_API_KEY manquante dans Vercel.' });
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'KLIP <onboarding@resend.dev>',
        to: test,
        subject: 'Test Klip — diagnostic email',
        html: '<p>Ceci est un email de test envoyé depuis le diagnostic Klip. Si vous le recevez, l\'envoi fonctionne 🎉</p>',
      }),
    });
    const bodyText = await res.text();
    return NextResponse.json({
      ...base,
      testSend: { httpStatus: res.status, ok: res.ok, resendResponse: bodyText.slice(0, 500) },
    });
  } catch (e) {
    return NextResponse.json({ ...base, testSend: `ERREUR fetch: ${e instanceof Error ? e.message : e}` });
  }
}
