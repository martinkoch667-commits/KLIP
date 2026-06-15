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
