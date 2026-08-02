import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, emailEnabled, sequence, sequenceStep } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Envoie un mail de la séquence pré-ouverture à la liste d'attente.
// Protégé par CRON_SECRET. Les désinscrits sont toujours exclus.
//
//   ?secret=XXX                              -> liste les mails disponibles
//   ?secret=XXX&n=1                          -> aperçu (compte les destinataires, n'envoie rien)
//   ?secret=XXX&n=1&test=moi@exemple.com     -> envoi de TEST à cette adresse uniquement
//   ?secret=XXX&n=1&confirm=oui              -> ENVOI RÉEL à toute la liste
//   ...&skipSent=oui                         -> saute ceux qui ont déjà reçu ce numéro
async function handle(request: NextRequest) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') || request.headers.get('x-launch-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé — secret manquant ou incorrect.' }, { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 500 });
  }

  // Sans &n= : on affiche le sommaire de la séquence.
  const nRaw = url.searchParams.get('n');
  if (!nRaw) {
    return NextResponse.json({
      emailActif: emailEnabled(),
      sequence: sequence.map(s => ({ n: s.n, quand: s.when, objectif: s.goal, objet: s.tpl().subject })),
      usage: "Ajoute &n=1 pour l'aperçu du mail 1, puis &test=ton@email.com, puis &confirm=oui.",
    });
  }

  const step = sequenceStep(Number(nRaw));
  if (!step) {
    return NextResponse.json({ error: `Mail n°${nRaw} inconnu (1 à ${sequence.length}).` }, { status: 400 });
  }
  const tpl = step.tpl();

  if (!emailEnabled()) {
    return NextResponse.json(
      { error: "RESEND_API_KEY absent : aucun email ne peut partir. Ajoute la clé dans .env.local (et sur Vercel), puis relance." },
      { status: 503 },
    );
  }

  // 1) Envoi de test à une seule adresse.
  const testTo = url.searchParams.get('test');
  if (testTo) {
    const ok = await sendEmail(testTo, tpl.subject, tpl.html);
    return NextResponse.json({ mode: 'test', n: step.n, objet: tpl.subject, to: testTo, sent: ok });
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await db
    .from('waitlist')
    .select('email, last_campaign')
    .is('unsubscribed_at', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const skipSent = url.searchParams.get('skipSent') === 'oui';
  const seen = new Set<string>();
  const targets: string[] = [];
  for (const row of data ?? []) {
    const email = (row.email as string | null)?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    if (skipSent && (row.last_campaign as number | null) === step.n) continue;
    targets.push(email);
  }

  // 2) Aperçu — garde-fou anti-envoi accidentel.
  if (url.searchParams.get('confirm') !== 'oui') {
    return NextResponse.json({
      mode: 'aperçu',
      n: step.n,
      quand: step.when,
      objet: tpl.subject,
      destinataires: targets.length,
      message: `Prêt à envoyer le mail n°${step.n} à ${targets.length} inscrit(s). Ajoute &confirm=oui pour l'envoi RÉEL, ou &test=ton@email.com pour un test.`,
    });
  }

  // 3) Envoi réel.
  let sent = 0, failed = 0;
  for (const to of targets) {
    const ok = await sendEmail(to, tpl.subject, tpl.html);
    if (ok) {
      sent++;
      await db.from('waitlist')
        .update({ last_campaign: step.n, last_sent_at: new Date().toISOString() })
        .eq('email', to);
    } else {
      failed++;
    }
    await new Promise(r => setTimeout(r, 550)); // respecte la limite de débit Resend
  }
  return NextResponse.json({ mode: 'envoi', n: step.n, objet: tpl.subject, total: targets.length, sent, failed });
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
