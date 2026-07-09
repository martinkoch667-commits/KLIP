-- Migration 015 : BYOK Claude — clé API Anthropic personnelle par utilisateur
-- À exécuter dans Supabase → SQL Editor.
-- La clé est stockée chiffrée (AES-256-GCM, voir lib/crypto.ts) ; last4 en clair pour affichage uniquement.

alter table public.user_settings
  add column if not exists anthropic_api_key_encrypted text,
  add column if not exists anthropic_api_key_last4 text,
  add column if not exists anthropic_api_key_added_at timestamptz;
