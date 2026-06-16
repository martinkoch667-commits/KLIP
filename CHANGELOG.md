# Klip — Changelog

## [Unreleased]

### Features
- **Early Sans Variable** — Replaced Satoshi + Cabinet Grotesk with Early Sans Variable (Adobe Fonts `pgn2gxc`) for all UI typography. Tokens `--sans` and `--mono` now both use `early-sans-variable`. Archivo kept for `--display`.
- **Global navigation pages** — New top-level routes aggregating data across all workspaces:
  - `/calendar` — global calendar (week + month view) with workspace-colored post pills
  - `/composer` — all drafts (`idle`, `generating`, `generated`) in a card grid
  - `/feed` — all validated/scheduled/published posts in a list view
  - `/templates` — all templates from `post_templates` in a card grid
- **Sidebar refonte** — Removed "Clients" nav item; all nav links now point to global routes. Added `data-tour` attributes on all nav items for onboarding tour targeting.
- **Onboarding tour** (`components/OnboardingTour.tsx`) — 7-step spotlight tutorial using SVG mask cutout overlay. Persists state via localStorage (fast-path) + Supabase `user_settings` table. Shown automatically to new users on the dashboard.
- **Agency accounts Phase 1** — New `/onboarding/plan` page (Solo vs Agence card picker). Saves `account_type` to `user_settings`. SQL migrations for `agencies`, `agency_members`, `client_assignments` tables with RLS.
- **Post type system** — `post` | `reel` | `story` selector in editor toolbar. Canvas format auto-adapts on type change (`post → ig-square`, `reel/story → ig-story`). Type saved to Supabase on change. All post inserts/updates include `post_type`.
- **TypePickerModal redesign** — No emojis; SVG icons for Post/Reel/Story; Klip design tokens. Chevron on type badge.
- **Instagram Stories** — API sends `media_type: "STORIES"` for story-type image posts.
- **Aide & Tutoriel section** in workspace Paramètres — "Revoir le tutoriel" button resets onboarding state and redirects to dashboard.

### Bug Fixes
- Canvas resize handle drag and rotation handle position fixed.
- `post_type` now persists when changing type from editor toolbar.
- Canvas format recalculates correctly when switching between post types.

### Polish
- Removed all emojis from the codebase; replaced with SVG icons or plain text.
- Alignment buttons `⬅↔➡` → SVG align icons in editor, template editor, and workspace templates page.
- Toasts no longer contain checkmark emoji characters.
- Step indicator in workspace creation uses SVG check icon.

### Database Migrations
- `supabase/migrations/001_user_settings_onboarding.sql` — `user_settings` table with `onboarding_completed`, `onboarding_completed_at`, RLS policies.
- `supabase/migrations/002_agency_structure.sql` — `account_type` column on `user_settings`; `agencies`, `agency_members`, `client_assignments` tables with RLS policies.

---

## Actions manuelles requises — Auth

### FIX 2 — Activer Google OAuth dans Supabase

1. Aller sur https://supabase.com/dashboard → ton projet → **Authentication → Providers**
2. Activer **Google**
3. Créer les credentials OAuth sur https://console.cloud.google.com :
   - APIs & Services → Credentials → **Create Credentials → OAuth 2.0 Client ID**
   - Application type : **Web application**
   - Authorized redirect URI : `https://[TON-PROJECT-REF].supabase.co/auth/v1/callback`
     (remplacer `[TON-PROJECT-REF]` par la ref visible dans l'URL du dashboard Supabase)
4. Copier **Client ID** et **Client Secret** dans le champ Google Provider sur Supabase
5. Sauvegarder

Le code est déjà en place dans `/app/login/page.tsx` et `/app/register/page.tsx` (`signInWithOAuth({ provider: 'google' })`).

---

### FIX 3 — Email de confirmation Klip

Aller sur https://supabase.com/dashboard → **Authentication → Email Templates → Confirm signup**

Remplacer le contenu par :

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Confirmez votre compte Klip</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F3EC;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;">

          <!-- Header vert -->
          <tr>
            <td style="background:#0C2A1D;padding:32px;text-align:center;">
              <img src="https://klip-swart.vercel.app/logo-klip-mint.png" alt="Klip" height="36">
            </td>
          </tr>

          <!-- Contenu -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;
                         color:#0C2A1D;text-transform:uppercase;
                         letter-spacing:-0.5px;">
                BIENVENUE SUR KLIP.
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#14160F;
                        line-height:1.6;opacity:0.7;">
                Votre compte est presque prêt. Cliquez sur le bouton
                ci-dessous pour confirmer votre adresse email et
                accéder à Klip.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#2FD79B;">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:block;padding:14px 32px;
                              color:#0C2A1D;font-weight:700;
                              font-size:14px;text-decoration:none;
                              text-transform:uppercase;
                              letter-spacing:0.5px;">
                      CONFIRMER MON COMPTE →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;
                        color:#14160F;opacity:0.4;line-height:1.5;">
                Ce lien expire dans 24 heures. Si vous n'avez pas
                créé de compte Klip, ignorez cet email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #F4F3EC;">
              <p style="margin:0;font-size:12px;color:#14160F;
                        opacity:0.3;text-align:center;">
                © 2025 Klip — Tous droits réservés
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```
