import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, emails } from '@/lib/email';
import { sendLeadEvent } from '@/lib/meta-capi';

export const runtime = 'nodejs';

// POST /api/waitlist — inscription à la liste d'attente / accès anticipé.
export async function POST(request: NextRequest) {
  try {
    const { email, name, instagram, company, source, eventId } = await request.json();

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 500 });
    }
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await db.from('waitlist').insert({
      email: cleanEmail,
      name: (typeof name === 'string' && name.trim()) || null,
      instagram: (typeof instagram === 'string' && instagram.trim().replace(/^@/, '')) || null,
      company: (typeof company === 'string' && company.trim()) || null,
      source: (typeof source === 'string' && source.trim()) || null,
    });

    // Doublon (déjà inscrit) -> on considère ça comme un succès.
    if (error && error.code !== '23505') {
      console.error('[waitlist] insert error:', error.message);
      return NextResponse.json({ error: 'Inscription impossible, réessayez.' }, { status: 500 });
    }

    // Email de confirmation (nouvelle inscription OU ré-inscription d'un email déjà présent).
    const tpl = emails.waitlistConfirm();
    sendEmail(cleanEmail, tpl.subject, tpl.html).catch(() => {});

    // Meta Conversions API — Lead côté serveur (dédupliqué avec le pixel via eventId).
    sendLeadEvent({
      email: cleanEmail,
      eventId: typeof eventId === 'string' ? eventId : undefined,
      eventSourceUrl: request.headers.get('referer') || undefined,
      clientIp: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      fbp: request.cookies.get('_fbp')?.value,
      fbc: request.cookies.get('_fbc')?.value,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
