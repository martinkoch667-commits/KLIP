import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, emails } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Envoie l'email d'ouverture à la liste d'attente. Protégé par CRON_SECRET.
//   ?secret=XXX                          -> aperçu (compte les inscrits, n'envoie rien)
//   ?secret=XXX&test=ton@email.com       -> envoi de TEST à cette adresse uniquement
//   ?secret=XXX&confirm=oui              -> ENVOI RÉEL à TOUS les inscrits
async function handle(request: NextRequest) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') || request.headers.get('x-launch-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé — secret manquant ou incorrect.' }, { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 500 });
  }

  const tpl = emails.launch();

  // 1) Envoi de test à une seule adresse
  const testTo = url.searchParams.get('test');
  if (testTo) {
    const ok = await sendEmail(testTo, tpl.subject, tpl.html);
    return NextResponse.json({ mode: 'test', to: testTo, sent: ok });
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await db.from('waitlist').select('email');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const emailsList = Array.from(new Set((data ?? []).map(r => (r.email as string)).filter(Boolean)));

  // 2) Aperçu (sécurité anti-envoi accidentel) : il faut &confirm=oui pour envoyer à tous
  if (url.searchParams.get('confirm') !== 'oui') {
    return NextResponse.json({
      mode: 'aperçu',
      inscrits: emailsList.length,
      message: `Prêt à envoyer à ${emailsList.length} inscrit(s). Ajoute &confirm=oui à l'URL pour lancer l'envoi RÉEL. (Ou &test=ton@email.com pour un test.)`,
    });
  }

  // 3) Envoi réel à toute la liste
  let sent = 0, failed = 0;
  for (const to of emailsList) {
    const ok = await sendEmail(to, tpl.subject, tpl.html);
    if (ok) sent++; else failed++;
    await new Promise(r => setTimeout(r, 550)); // respecte la limite de débit Resend
  }
  return NextResponse.json({ mode: 'envoi', total: emailsList.length, sent, failed });
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
