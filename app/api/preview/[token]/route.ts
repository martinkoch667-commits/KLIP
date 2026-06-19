import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createNotification } from '@/lib/notifications';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function resolveToken(token: string) {
  const { data } = await db()
    .from('share_tokens')
    .select('id, workspace_id, label, expires_at, created_at, workspaces(id, name, primary_color, secondary_color, accent_color, logo_url, instagram_username, user_id)')
    .eq('token', token)
    .maybeSingle();
  return data ?? null;
}

// GET /api/preview/[token] — validate token + return workspace & posts
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const row = await resolveToken(params.token);
  if (!row) return NextResponse.json({ error: 'Token invalide' }, { status: 404 });
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Lien expiré' }, { status: 410 });
  }

  const { data: posts } = await db()
    .from('posts')
    .select('id, title, description, texte_visuel, photo_url, exported_image_url, status, scheduled_at, post_type, approved_by_client, client_comment, client_reviewed_at')
    .eq('workspace_id', row.workspace_id)
    .neq('status', 'failed')
    .order('scheduled_at', { ascending: true, nullsFirst: false });

  return NextResponse.json({
    workspace: row.workspaces,
    posts: posts ?? [],
    tokenMeta: { label: row.label, created_at: row.created_at },
  });
}

// PATCH /api/preview/[token] — client approve or request revision
export async function PATCH(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const row = await resolveToken(params.token);
  if (!row) return NextResponse.json({ error: 'Token invalide' }, { status: 404 });
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Lien expiré' }, { status: 410 });
  }

  const { postId, action, comment } = await request.json();
  if (!postId || !action) return NextResponse.json({ error: 'postId et action requis' }, { status: 400 });

  // Verify post belongs to this workspace
  const { data: post } = await db()
    .from('posts')
    .select('id, title, workspace_id')
    .eq('id', postId)
    .eq('workspace_id', row.workspace_id)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: 'Post introuvable' }, { status: 404 });

  const now = new Date().toISOString();
  const postLabel = post.title ?? 'Sans titre';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws = row.workspaces as any;
  const ownerId: string | null = ws?.user_id ?? null;

  if (action === 'approve') {
    await db().from('posts').update({ approved_by_client: true, client_reviewed_at: now }).eq('id', postId);
    if (ownerId) {
      await createNotification({
        userId: ownerId,
        workspaceId: row.workspace_id,
        type: 'post_approved',
        title: 'Post approuvé par le client',
        message: `« ${postLabel} » a été approuvé par votre client`,
        postId,
        postTitle: postLabel,
      });
    }
  } else if (action === 'comment') {
    if (!comment?.trim()) return NextResponse.json({ error: 'Commentaire vide' }, { status: 400 });
    await db().from('posts').update({ client_comment: comment.trim(), client_reviewed_at: now }).eq('id', postId);
    if (ownerId) {
      await createNotification({
        userId: ownerId,
        workspaceId: row.workspace_id,
        type: 'post_revision_requested',
        title: 'Modification demandée par le client',
        message: `Le client demande une modification sur « ${postLabel} »`,
        postId,
        postTitle: postLabel,
      });
    }
  } else {
    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
