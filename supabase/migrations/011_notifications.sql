-- Migration 011 : table des notifications in-app (cloche 🔔)
-- À exécuter dans Supabase → SQL Editor.

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid,
  type         text not null,          -- post_published, post_approved, post_revision_requested, …
  title        text not null,
  message      text,
  post_id      text,
  post_title   text,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- L'utilisateur lit / met à jour SES notifications (les écritures serveur passent par la clé service_role qui bypass RLS).
drop policy if exists "notifications: own select" on public.notifications;
create policy "notifications: own select" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "notifications: own update" on public.notifications;
create policy "notifications: own update" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- (Optionnel) Realtime pour la cloche en temps réel :
-- alter publication supabase_realtime add table public.notifications;
