-- ─── activity_log table ───────────────────────────────────────────────────────
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS activity_log (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES auth.users(id),
  action_type  TEXT        NOT NULL,
  post_id      UUID,
  post_title   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_workspace_id_idx ON activity_log (workspace_id);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx   ON activity_log (created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own activity"
ON activity_log FOR SELECT
USING (
  workspace_id IN (
    SELECT id FROM workspaces WHERE user_id = auth.uid()
  )
);

CREATE POLICY IF NOT EXISTS "Users can insert own activity"
ON activity_log FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT id FROM workspaces WHERE user_id = auth.uid()
  )
);
