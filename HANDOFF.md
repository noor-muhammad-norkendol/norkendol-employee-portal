# Norkendol Employee Portal — Handoff

Last updated: April 3, 2026 — Session 3 (final)

---

## Current State

Portal has dual sidebars, auth middleware, role-gated accordion navigation with SVG icons and drag-and-drop reordering. **Dashboard is now fully functional** with 5 live sections pulling from Supabase. Four admin pages are wired up with full CRUD.

### What Works
- Login page at `/login` with Supabase auth
- Auth middleware redirects unauthenticated users to `/login`
- Dashboard at `/dashboard` with dual sidebar + top bar
- **IconSidebar (left):** Accordion sections grouped by role tier (User, Admin, Super Admin, System Admin). Each section collapsible. All items have gray stroke-based SVG icons. Drag-and-drop reordering within sections via @dnd-kit — order saves to Supabase per user. Collapsible to icon-only with round chevron button.
- **TextSidebar (right):** Permanent panel with contextual sub-items per page. Collapsible with matching chevron.
- 23 pages under `/dashboard/*` — 4 are now fully built, rest are placeholders
- Dashboard layout wraps all sub-pages in PortalShell
- Frank's Supabase role set to `super_admin`
- `nav_order` jsonb column on `public.users` for drag-and-drop persistence

### Dashboard (5 live sections)
1. **Welcome header** — greeting with user's first name + today's date
2. **Company Updates** — card grid (up to 6), type/priority badges, expandable content, author + date
3. **Quick Access** — pinned apps with letter avatars, "View All" links to Application Vault
4. **Bottom 3-column row:**
   - **My Action Items** — pending tasks with checkbox, priority badge, due date, overdue flag
   - **Leaderboard** — top 5 from active leaderboard, medals for top 3, configurable metric
   - **Recent Notifications** — unread, color-coded by type, time-ago stamps

### Admin Pages (fully wired to Supabase)

**Company Updates** (`/dashboard/company-updates`)
- List all updates (published + drafts), drafts dimmed
- Create/Edit modal: title, content, type (news/event/announcement), priority (low-urgent), publish toggle, pin, visibility, expiration date
- Inline actions: pin/unpin, publish/unpublish, edit, delete with confirm
- Published updates feed the dashboard cards

**Notifications** (`/dashboard/notifications`)
- List with color-coded dots (info=blue, warning=yellow, error=red, success=green)
- Filters: status (all/unread/read) + type (all/info/warning/error/success)
- Mark read/unread, mark all read, delete with confirm
- Send Notification modal: title, message, type, sender name, action URL/label, expiration
- Currently sends to self (recipient picker comes with user management)

**Action Items** (`/dashboard/action-items`)
- List with checkbox (quick complete), type/priority/status badges
- Filters: status (all/pending/in_progress/completed/cancelled) + priority (all/urgent-low)
- Status dropdown: change to any status inline
- Overdue items flagged in red
- Create/Edit modal: title, description, type (task/claim), priority, assign to (name), due date
- Completed/cancelled items dimmed with strikethrough

**Leaderboard** (`/dashboard/leaderboard`)
- Multiple leaderboards with tab bar switching
- Active/Inactive lifecycle: deactivate to shelve (keeps data), reactivate to bring back
- Create leaderboard: name + metric key
- Add entries: name + value, auto-ranked by value (highest first)
- Medals for top 3, gold highlight on #1
- Edit/delete entries + edit/delete/deactivate boards
- Dashboard widget only shows active leaderboard

### Sidebar Changes (Session 3)
- **Notifications** moved from User tier → Admin tier
- **Leaderboard** added to Admin tier (trophy icon)

### Supabase Tables (Session 3 — 6 new)

| Table | Purpose |
|-------|---------|
| `company_updates` | News/announcements with publish, pin, type, priority, expiration |
| `action_items` | Tasks assigned to users with status workflow |
| `notifications` | Per-user notifications with read tracking |
| `user_pinned_apps` | Quick access app shortcuts per user |
| `leaderboard_config` | Named leaderboard definitions with active/inactive flag |
| `leaderboard_entries` | Ranked entries per leaderboard config |

All tables have `org_id` FK → `public.orgs`, RLS enabled, appropriate policies.

Pre-existing tables: `orgs` (1 row), `firms`, `users`, `invitations`

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
**Last commit:** `e888d2f`
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
      page.tsx                    — Dashboard home (5 live sections)
      company-updates/page.tsx    — Admin CRUD for company updates
      notifications/page.tsx      — Admin CRUD for notifications
      action-items/page.tsx       — Admin CRUD for action items
      leaderboard/page.tsx        — Admin CRUD for leaderboards
      [19 placeholder pages]      — See HISTORY.md for full tier mapping
  components/
    PortalShell.tsx     — Layout orchestrator (both sidebars + top bar)
    IconSidebar.tsx     — Accordion nav, SVG icons, dnd-kit reorder, role gating
    TextSidebar.tsx     — Right contextual panel, collapsible
    TopBar.tsx          — Date/time + user display
  lib/
    supabase.ts         — Browser Supabase client
    supabase-server.ts  — Server-side Supabase client
  middleware.ts         — Auth guard for /dashboard routes
```

## What Still Needs Work

1. **Role gating currently hardcoded** — `userRole` defaults to "4" (SysAdmin) for dev. Needs to read from Supabase auth context.
2. **TextSidebar sub-items are placeholders** — need real contextual tools per page.
3. **External partner view** — defined in code but not tested yet.
4. **User management** — needed for notification recipient picker and action item assignment by user ID.
5. **Application Vault page** — needed for Quick Access to work (add/remove pinned apps).
6. **App suite 2-layer toggle model** not built.
7. **No light mode, no responsive/mobile layout.**
8. **White-label tenant config** — company name from DB, not hardcoded.

## Key Rules

- **BINGO** required before writing any code
- White-label — NO company branding (no CCS, no Coastal)
- Supabase only
- Tenant-first design — every table gets `org_id`
- Keep it simple
