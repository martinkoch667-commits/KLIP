create table workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  logo_url text,
  primary_color text default '#0038FF',
  secondary_color text default '#FFFFFF',
  font_family text default 'Oswald',
  created_at timestamptz default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade,
  photo_url text,
  brief text,
  description text,
  status text default 'draft',
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

alter table workspaces enable row level security;
alter table posts enable row level security;

create policy "Users see own workspaces" on workspaces
  for all using (auth.uid() = user_id);

create policy "Users see own posts" on posts
  for all using (
    workspace_id in (
      select id from workspaces where user_id = auth.uid()
    )
  );
