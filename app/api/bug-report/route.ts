import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, emails } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = new Set(['bug', 'idee', 'autre']);

// POST /api/bug-report — signalement envoyé depuis le widget de la phase d'ouverture.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 4000) : '';
    if (message.length < 5) {
      return NextResponse.json({ error: 'Décrivez le problème en quelques mots.' }, { status: 400 });
    }

    const kind = KINDS.has(body?.kind) ? body.kind : 'bug';
    const pageUrl = typeof body?.pageUrl === 'string' ? body.pageUrl.slice(0, 500) : null;

    // L'utilisateur connecté, quand il y en a un : évite de lui demander son email.
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;
    const email = session?.user?.email ?? (typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null);

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 500 });
    }
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await db.from('bug_reports').insert({
      user_id: userId,
      email,
      kind,
      message,
      page_url: pageUrl,
      user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
    });

    if (error) {
      console.error('[bug-report] insert error:', error.message);
      return NextResponse.json({ error: "L'envoi a échoué, réessayez." }, { status: 500 });
    }

    // Notification à l'équipe — ne doit jamais faire échouer le signalement.
    const to = process.env.BUG_REPORT_TO || process.env.EMAIL_REPLY_TO;
    if (to) {
      const tpl = emails.bugReport({ kind, message, email, pageUrl });
      sendEmail(to, tpl.subject, tpl.html).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
