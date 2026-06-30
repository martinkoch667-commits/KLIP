import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, emails } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/waitlist/launch?secret=XXX  (ou header x-launch-secret)
// Envoie l'email d'ouverture à TOUTE la liste d'attente. Protégé par CRON_SECRET.
// ?test=ton@email.com -> envoie uniquement à cette adresse (pour prévisualiser).
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') || request.headers.get('x-launch-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 500 });
  }

  const tpl = emails.launch();
  const testTo = url.searchParams.get('test');
  if (testTo) {
    const ok = await sendEmail(testTo, tpl.subject, tpl.html);
    return NextResponse.json({ test: true, to: testTo, sent: ok });
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await db.from('waitlist').select('email');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const emailsList = Array.from(new Set((data ?? []).map(r => (r.email as string)).filter(Boolean)));
  let sent = 0, failed = 0;
  for (const to of emailsList) {
    const ok = await sendEmail(to, tpl.subject, tpl.html);
    if (ok) sent++; else failed++;
    await new Promise(r => setTimeout(r, 550)); // respecte la limite de débit Resend
  }
  return NextResponse.json({ ok: true, total: emailsList.length, sent, failed });
}
