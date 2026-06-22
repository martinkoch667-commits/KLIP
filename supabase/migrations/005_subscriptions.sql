-- Migration 005 : table subscriptions (Stripe)
-- À exécuter dans Supabase → SQL Editor.
-- NB : on NE touche PAS à auth.users. Le stripe_customer_id est déjà stocké
-- dans user_settings.stripe_customer_id (migration 003) et est réutilisé ici.

create table if not exists public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  plan                    text,            -- 'studio' | 'agence'
  billing_period          text,            -- 'monthly' | 'yearly'
  status                  text,            -- trialing | active | past_due | canceled | unpaid
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

-- L'utilisateur ne peut que LIRE son propre abonnement.
-- Les écritures se font côté serveur via la clé service_role (bypass RLS) dans le webhook.
drop policy if exists "Users see own subscription" on public.subscriptions;
create policy "Users see own subscription" on public.subscriptions
  for select using (user_id = auth.uid());
