import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const str = (v: unknown, max = 600) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

// POST /api/sondage — réponses au sondage des inscrits à la liste d'attente.
export async function POST(request: NextRequest) {
  try {
    const { email, role, clients, pains, tools, wish, budget } = await request.json();

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 500 });
    }
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const row = {
      email: cleanEmail,
      role: str(role, 40),
      clients: str(clients, 20),
      pains: Array.isArray(pains) ? pains.filter(p => typeof p === 'string').slice(0, 10).map(p => p.slice(0, 60)) : null,
      tools: str(tools),
      wish: str(wish, 1200),
      budget: str(budget, 20),
    };

    // Une réponse par email : une nouvelle soumission remplace la précédente.
    const { error } = await db
      .from('waitlist_survey')
      .upsert(row, { onConflict: 'email' });

    if (error) {
      console.error('[sondage] upsert error:', error.message);
      return NextResponse.json({ error: 'Enregistrement impossible, réessayez.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
