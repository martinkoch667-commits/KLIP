-- Migration 004 : flag d'envoi du rappel de fin d'essai (évite les doublons)
-- À exécuter dans Supabase SQL editor (ou supabase db push)

alter table public.user_settings
  add column if not exists trial_reminder_sent boolean not null default false;
