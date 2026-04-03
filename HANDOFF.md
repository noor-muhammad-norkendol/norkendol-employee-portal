# Norkendol Employee Portal — Handoff

Last updated: April 3, 2026 — Session 4

---

## Current State

Portal has dual sidebars, auth middleware, role-gated accordion navigation with SVG icons and drag-and-drop reordering. Dashboard is fully functional with 5 live sections. Four admin pages wired up with full CRUD. **User Management rebuilt as table layout with 70 real employees seeded. Employee Directory built with grid/list views.**

### What Works
- Login page at `/login` with Supabase auth
- Auth middleware redirects unauthenticated users to `/login`
- Dashboard at `/dashboard` with dual sidebar + top bar
- **IconSidebar (left):** Accordion sections grouped by role tier (User, Admin, Super Admin, System Admin). Each section collapsible. All items have gray stroke-based SVG icons. Drag-and-drop reordering within sections via @dnd-kit — order saves to Supabase per user. Collapsible to icon-only with round chevron button.
- **TextSidebar (right):** Permanent panel with contextual sub-items per page. Collapsible with matching chevron. Directory section now includes "Add New User" sub-item.
- 23 pages under `/dashboard/*` — 6 are now fully built, rest are placeholders
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

### User Management (`/dashboard/user-management`) — Session 4, REBUILT
- **Table layout** (not cards) with columns: Avatar, Name, Email (mailto link), Role (readable labels), Department, Status badge, Edit icon, Delete icon
- **Two tabs:** Internal Users / External Partners — filters on `user_type` column
- **Filters:** Search by name/email/position, status filter buttons (All/Pending/Active/Inactive/Rejected), role dropdown
- **Role labels:** user → User, admin → Admin, super_admin → Super Admin, etc.
- **Status toggle:** Click status badge to deactivate/activate inline (saves immediately)
- **Pending rows:** striped background highlight
- **Delete:** double-click confirmation (click trash, 3-second window to confirm)
- **+ Add Staff Member** button (placeholder, wired for future)
- **Edit modal:** 4 tabs — Profile, Permissions, Licenses, Bonds
  - Profile: full name, email, role, status, position, department, location, employee ID, hire date, phones, bio, onboarding status
  - Permissions: Feature Toggles (Talent Network, CRM Assignable, CRM Office Staff) + User/Manager/Admin sidebar toggles
  - Licenses: list with approve/reject/delete, add form
  - Bonds: list with approve/reject/delete, add form

### Employee Directory (`/dashboard/directory`) — Session 4, NEW
- **Two view modes:** Grid (cards) and List (rows), toggle in header
- **Search** across name, email, position, department, location, employee ID, phone
- **Filter by Department** — auto-populated from actual user data
- **Filter by Location** — auto-populated from actual user data
- **Sort by** Name, Department, Position, or Hire Date
- **Employee cards show:** avatar/initials, name, position, employee ID, department, location, clickable email (mailto), clickable phone (tel), hire date
- **Only active users displayed** — queries `status = 'active'`
- **Clear filters** button when any filter is active

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

### Sidebar Changes (Session 4)
- **TextSidebar** directory section updated: "All Staff", "By Department", "Search", "Add New User"

### Supabase Changes (Session 4)

**Schema changes:**
- `users.user_type` column added — `text NOT NULL DEFAULT 'internal'` (values: `internal`, `external`)
- `get_user_org_id()` function added — `SECURITY DEFINER` function to bypass RLS recursion
- RLS policy on `users` updated — uses `get_user_org_id()` instead of self-referencing subquery
- RLS update policy broadened — admins can update any user in their org (was self-only)
- Additional permissive SELECT policy for authenticated users added

**Data seeded:**
- 70 real employees loaded from CCS directory (Aaron Tuck through Zane Alexander Wood + Frank Dalton)
- All set to `status = 'active'`, `user_type = 'internal'`, `role = 'user'`
- Frank Dalton's existing record preserved with `super_admin` role
- Each employee has: full_name, first/last name, email, position, department, employee_id, location, primary_phone, hire_date
- Nick Yaksich: employee_id and hire_date set to NULL (invalid in source)
- Test account (t@t.com) excluded

### Supabase Tables

| Table | Purpose |
|-------|---------|
| `company_updates` | News/announcements with publish, pin, type, priority, expiration |
| `action_items` | Tasks assigned to users with status workflow |
| `notifications` | Per-user notifications with read tracking |
| `user_pinned_apps` | Quick access app shortcuts per user |
| `leaderboard_config` | Named leaderboard definitions with active/inactive flag |
| `leaderboard_entries` | Ranked entries per leaderboard config |
| `users` | Employee profiles with user_type (internal/external) |
| `user_permissions` | Per-user sidebar and feature toggle permissions |
| `licenses` | State licenses per user with approval workflow |
| `bonds` | Surety bonds per user with approval workflow |

All tables have `org_id` FK → `public.orgs`, RLS enabled, appropriate policies.

Pre-existing tables: `orgs` (1 row), `firms`, `invitations`

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
**Branch:** staging (ALL work goes to staging unless Frank explicitly says otherwise)
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
      user-management/page.tsx    — Table layout, tabs, filters, edit modal (Session 4)
      directory/page.tsx          — Employee directory, grid/list views (Session 4)
      [17 placeholder pages]      — See HISTORY.md for full tier mapping
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
2. **TextSidebar sub-items are placeholders** — need real contextual tools per page (directory updated, others still placeholder).
3. **External partner view** — defined in code but not tested yet. No external partners seeded.
4. **Add Staff Member modal** — button exists, needs full create user flow.
5. **Application Vault page** — needed for Quick Access to work (add/remove pinned apps).
6. **App suite 2-layer toggle model** not built.
7. **No light mode, no responsive/mobile layout.**
8. **White-label tenant config** — company name from DB, not hardcoded.
9. **Employee roles need updating** — all seeded users are `role = 'user'`, executives/admins need proper roles assigned.
10. **Notification recipient picker** — can now use real user list from user management.

## Key Rules

- **BINGO** required before writing any code
- White-label — NO company branding (no CCS, no Coastal)
- Supabase only
- Tenant-first design — every table gets `org_id`
- Keep it simple
