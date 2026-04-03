# Norkendol Employee Portal — Handoff

Last updated: April 2, 2026 — Session 1

---

## Current State

The portal frame is built and running. Dark mode Supabase-style layout with:
- Login page at `/login` (no auth — just navigates to dashboard)
- Dashboard at `/dashboard` with dual sidebar + top bar
- Icon sidebar (always visible, tooltips on hover, click to switch sections)
- Text sidebar (always visible, collapsible via arrow button)
- Top bar (date/time + hardcoded user info)

**Port:** 3002
**Start:** `npm run dev`
**Branch:** main
**Last commit:** `6909af0`

## File Map

```
src/
  app/
    layout.tsx          — Root layout, dark mode, fonts
    page.tsx            — Redirects to /login
    globals.css         — Dark theme CSS variables, scrollbar
    login/page.tsx      — Login card (no auth)
    dashboard/page.tsx  — Dashboard wrapped in PortalShell
  components/
    PortalShell.tsx     — Main layout orchestrator
    IconSidebar.tsx     — Left icon strip (50px)
    TextSidebar.tsx     — Collapsible text menu (220px)
    TopBar.tsx          — Date/time + user display
```

## What Needs to Happen Next

1. **Supabase auth** — Wire up real login/signup with the Supabase project (`mmccqhxomkohjydukxnn`)
2. **Database schema** — Core tables: orgs, users, roles, permissions, apps
3. **Sidebar navigation** — Make menu items actually route to pages
4. **Role hierarchy** — Implement the 6-tier system (System Admin through External Partner User)
5. **App suite toggle** — Two-layer permission model (tenant-level + user-level)

## Key Rules

- **BINGO** required before writing any code
- White-label — NO company branding anywhere
- Supabase only — no MongoDB
- Tenant-first design — every table gets `org_id`
- Keep it simple — no code that doesn't earn its spot
