-- Migration 016 : serveur MCP KLIP — "Connecter à Claude" (façon Vibiz)
-- KLIP devient fournisseur OAuth 2.1 pour que Claude (claude.ai / Claude Code)
-- puisse se connecter en tant que connecteur MCP et appeler des outils au nom
-- de l'utilisateur (créer/planifier des posts, générer une légende).
-- Toutes ces tables sont accédées exclusivement via le client service-role
-- (aucune session cookie côté Claude) — RLS présent en filet de sécurité.

-- Clients enregistrés dynamiquement (RFC 7591) — Claude s'auto-enregistre au
-- premier "Add custom connector".
create table if not exists public.mcp_oauth_clients (
  client_id     text primary key default encode(gen_random_bytes(24), 'hex'),
  client_name   text,
  redirect_uris text[] not null,
  created_at    timestamptz not null default now()
);

-- Codes d'autorisation à usage unique (flux authorization_code + PKCE).
create table if not exists public.mcp_oauth_codes (
  code                text primary key default encode(gen_random_bytes(32), 'hex'),
  user_id             uuid not null references auth.users(id) on delete cascade,
  client_id           text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  redirect_uri        text not null,
  code_challenge      text not null,
  code_challenge_method text not null default 'S256',
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '2 minutes'),
  used_at             timestamptz
);

-- Tokens émis — stockés hashés (SHA-256), jamais en clair.
create table if not exists public.mcp_oauth_tokens (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  client_id           text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  access_token_hash   text not null unique,
  refresh_token_hash  text not null unique,
  access_expires_at   timestamptz not null,
  refresh_expires_at  timestamptz not null,
  created_at          timestamptz not null default now(),
  revoked_at          timestamptz
);

create index if not exists mcp_oauth_tokens_access_idx on public.mcp_oauth_tokens (access_token_hash);
create index if not exists mcp_oauth_tokens_refresh_idx on public.mcp_oauth_tokens (refresh_token_hash);
create index if not exists mcp_oauth_tokens_user_idx on public.mcp_oauth_tokens (user_id) where revoked_at is null;

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_codes enable row level security;
alter table public.mcp_oauth_tokens enable row level security;

-- Aucune policy pour les utilisateurs anon/authenticated : ces tables ne sont
-- lues/écrites que par le service-role côté serveur (bypass RLS), jamais
-- exposées directement au client Supabase du navigateur.
