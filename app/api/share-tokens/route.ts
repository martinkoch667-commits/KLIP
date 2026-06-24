import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function serviceRole() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET ?workspaceId=xxx — return existing token (or null)
export async function GET(request: NextRequest) {
  const workspaceId = new URL(request.url).searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId requis' }, { status: 400 });

  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { data: token } = await serviceRole()
    .from('share_tokens')
    .select('id, token, label, expires_at, created_at, date_from, date_to')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  return NextResponse.json({ token: token ?? null });
}

// POST { workspaceId, label?, expiresAt? } — create/replace token
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { workspaceId, label, expiresAt, dateFrom, dateTo } = await request.json();
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId requis' }, { status: 400 });

  const db = serviceRole();

  // Delete existing token for this workspace first (one token per workspace)
  await db.from('share_tokens').delete().eq('workspace_id', workspaceId);

  const { data: token, error } = await db
    .from('share_tokens')
    .insert({
      workspace_id: workspaceId,
      label: label ?? 'Lien client',
      expires_at: expiresAt ?? null,
      date_from: dateFrom ?? null,
      date_to: dateTo ?? null,
      created_by: session.user.id,
    })
    .select('id, token, label, expires_at, created_at, date_from, date_to')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token }, { status: 201 });
}

// DELETE { workspaceId } — revoke token
export async function DELETE(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { workspaceId } = await request.json();
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId requis' }, { status: 400 });

  const { error } = await serviceRole()
    .from('share_tokens')
    .delete()
    .eq('workspace_id', workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
