import { createClient } from '@supabase/supabase-js';

export interface NotificationPayload {
  userId: string;
  workspaceId: string;
  type: 'post_published' | 'post_failed' | 'post_pending_review' | 'post_approved' | 'post_rejected';
  title: string;
  message: string;
  postId?: string;
  postTitle?: string;
}

export async function createNotification(payload: NotificationPayload): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from('notifications').insert({
    user_id:      payload.userId,
    workspace_id: payload.workspaceId,
    type:         payload.type,
    title:        payload.title,
    message:      payload.message,
    post_id:      payload.postId ?? null,
    post_title:   payload.postTitle ?? null,
  });

  if (error) {
    console.error('[Notifications] Insert error:', error.message);
  }
}
