-- share_tokens: one token per workspace for client preview links
create table if not exists public.share_tokens (
  id           uuid primary key default gen_random_uuid(),
  token        uuid not null unique default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete cascade,
  label        text not null default 'Lien client',
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- Only one active token per workspace (enforced by API DELETE+INSERT, but belt-and-suspenders)
create unique index if not exists share_tokens_workspace_id_idx on public.share_tokens(workspace_id);

-- RLS: only the owner (or team member) can manage tokens for their workspace
alter table public.share_tokens enable row level security;

-- Authenticated users can read/write tokens for workspaces they own
create policy "Workspace owners can manage share tokens"
  on public.share_tokens
  for all
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = share_tokens.workspace_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = share_tokens.workspace_id
        and w.user_id = auth.uid()
    )
  );

-- Public read by token value (for the /preview/[token] page — no auth required)
create policy "Public can read token by value"
  on public.share_tokens
  for select
  using (true);
