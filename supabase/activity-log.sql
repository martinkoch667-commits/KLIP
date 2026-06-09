-- Activity log table
-- Run in Supabase SQL Editor

create table if not exists activity_log (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        references workspaces(id) on delete cascade,
  user_id      uuid        references auth.users(id) on delete set null,
  action_type  text        not null,
  -- values: 'post_created' | 'post_validated' | 'post_published' | 'post_deleted' | 'workspace_created'
  post_id      uuid        references posts(id) on delete set null,
  post_title   text,
  created_at   timestamptz default now()
);

-- Indexes
create index if not exists activity_log_workspace_created on activity_log (workspace_id, created_at desc);
create index if not exists activity_log_created on activity_log (created_at desc);

-- RLS
alter table activity_log enable row level security;

create policy "Users see their workspaces activity"
  on activity_log for select
  using (
    workspace_id in (
      select id from workspaces where user_id = auth.uid()
    )
  );

create policy "Users insert their workspaces activity"
  on activity_log for insert
  with check (
    workspace_id in (
      select id from workspaces where user_id = auth.uid()
    )
  );
