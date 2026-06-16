-- Migration 003: user_preferences table
-- Stores per-user notification and appearance preferences
-- Run in Supabase SQL editor or via supabase db push

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Notifications email
  notif_email_publish_success    BOOLEAN DEFAULT TRUE,
  notif_email_publish_error      BOOLEAN DEFAULT TRUE,
  notif_email_validation_request BOOLEAN DEFAULT TRUE,
  notif_email_validation_result  BOOLEAN DEFAULT TRUE,
  notif_email_reminder           BOOLEAN DEFAULT TRUE,
  notif_email_weekly_summary     BOOLEAN DEFAULT FALSE,

  -- Notifications in-app
  notif_inapp                    BOOLEAN DEFAULT TRUE,

  -- Appearance
  timezone    TEXT DEFAULT 'Europe/Paris',
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  time_format TEXT DEFAULT '24h',

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_prefs" ON public.user_preferences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
