# Norkendol Employee Portal — Handoff

Last updated: April 3, 2026 — Session 2

---

## Current State

Portal has dual sidebars, 23 dashboard pages, auth middleware, and role-gated navigation. **Still in progress — sidebar needs further refinement.**

### What Works
- Login page at `/login` with Supabase auth
- Auth middleware redirects unauthenticated users to `/login`
- Dashboard at `/dashboard` with dual sidebar + top bar
- **IconSidebar (left):** 24 nav items with 6-tier role gating (1A/1B/2A/2B/3/4). Links to `/dashboard/{slug}`. Collapsible to icon-only with chevron. Plain monospace glyphs, no color.
- **TextSidebar (right):** Permanent panel with contextual sub-items per page. Collapsible with chevron. Content changes based on active URL.
- 23 placeholder pages under `/dashboard/*`
- Dashboard layout wraps all sub-pages in PortalShell
- Frank's Supabase role set to `super_admin`

### Role Hierarchy (LOCKED IN)

| Tier | Role | Track |
|------|------|-------|
| 1A | User | Internal employee |
| 1B | External Partner User | External — assigned items only |
| 2A | Admin | Internal team lead |
| 2B | External Partner Admin | External firm boss |
| 3 | Super Admin | Internal — full org control |
| 4 | System Administrator | Norkendol only — god mode |

Internal roles stack: 4 > 3 > 2A > 1A. External is separate track: 2B > 1B.

**Port:** 3002
**Start:** `npm run dev`
**Branch:** main
**Last commit:** `c448519`
**Supabase:** `hkscsovtejeedjebytsv`

## File Map

```
src/
  app/
    layout.tsx                    — Root layout, dark mode, fonts
    page.tsx                      — Redirects to /login
    globals.css                   — Dark theme CSS variables, scrollbar
    login/page.tsx                — Login with Supabase auth
    auth/callback/route.ts        — Auth callback handler
    auth/signout/route.ts         — Sign out handler
    dashboard/
      layout.tsx                  — Wraps all dashboard pages in PortalShell
      page.tsx                    — Dashboard home
      applications/page.tsx       — Tier 1A
      teams-chat/page.tsx         — Tier 1A
      calendar/page.tsx           — Tier 1A
      university/page.tsx         — Tier 1A
      directory/page.tsx          — Tier 1A
      documents/page.tsx          — Tier 1A
      ai/page.tsx                 — Tier 1A
      notifications/page.tsx      — Tier 1A
      compliance/page.tsx         — Tier 1A
      user-management/page.tsx    — Tier 2A
      pending-users/page.tsx      — Tier 2A
      action-items/page.tsx       — Tier 2A
      training/page.tsx           — Tier 2A
      company-updates/page.tsx    — Tier 2A
      departments/page.tsx        — Tier 2A
      crm/page.tsx                — Tier 2A
      ai-agents/page.tsx          — Tier 3
      app-management/page.tsx     — Tier 3
      compliance-settings/page.tsx — Tier 3
      claim-calculator-settings/page.tsx — Tier 3
      system-settings/page.tsx    — Tier 3
      talent-partner-network/page.tsx — Tier 3
      tenant-management/page.tsx  — Tier 4
  components/
    PortalShell.tsx     — Layout orchestrator (both sidebars + top bar)
    IconSidebar.tsx     — Left nav with role gating, collapsible
    TextSidebar.tsx     — Right contextual panel, collapsible
    TopBar.tsx          — Date/time + user display
  lib/
    supabase.ts         — Browser Supabase client
    supabase-server.ts  — Server-side Supabase client
  middleware.ts         — Auth guard for /dashboard routes
```

## What Still Needs Work (THIS SESSION, NOT DONE)

1. **Sidebar refinement** — Frank gave feedback that it's "closer but not perfect." Specifics TBD.
2. **Role gating currently hardcoded** — `userRole` defaults to "4" (SysAdmin) for dev. Needs to read from Supabase auth context.
3. **TextSidebar sub-items are placeholders** — need real contextual tools per page.
4. **Icon glyphs are temporary** — plain characters as stand-ins, need proper minimal icons.

## What's NOT Done Yet

- Role gating reads from auth (currently hardcoded)
- Database schema for orgs, roles, permissions, apps
- App suite 2-layer toggle model
- Light mode
- Responsive/mobile layout
- White-label tenant config (company name from DB, not hardcoded)

## Key Rules

- **BINGO** required before writing any code
- White-label — NO company branding (no CCS, no Coastal)
- Supabase only
- Tenant-first design — every table gets `org_id`
- Keep it simple
