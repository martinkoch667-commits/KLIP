-- Migration 003 : essai gratuit 7 jours + facturation (Stripe)
-- À exécuter dans le SQL editor Supabase (ou supabase db push)

-- ── Colonnes essai / abonnement sur user_settings ───────────────────────────
alter table public.user_settings
  add column if not exists subscription_status   text not null default 'trialing'
    check (subscription_status in ('trialing','active','past_due','expired','canceled')),
  add column if not exists trial_started_at       timestamptz not null default now(),
  add column if not exists trial_ends_at          timestamptz not null default (now() + interval '7 days'),
  add column if not exists stripe_customer_id      text,
  add column if not exists stripe_subscription_id  text,
  add column if not exists current_plan            text
    check (current_plan in ('solo','agency'));

-- ── Backfill des comptes existants ──────────────────────────────────────────
-- On (re)donne 7 jours d'essai à partir de maintenant pour ne bloquer personne
-- immédiatement après le déploiement.
update public.user_settings
set trial_started_at = now(),
    trial_ends_at    = now() + interval '7 days',
    subscription_status = coalesce(subscription_status, 'trialing'),
    current_plan     = coalesce(current_plan, account_type)
where trial_ends_at is null
   or subscription_status is null;

-- Index pour le cron de fin d'essai (bloc 3)
create index if not exists user_settings_trial_ends_idx
  on public.user_settings (trial_ends_at)
  where subscription_status = 'trialing';
