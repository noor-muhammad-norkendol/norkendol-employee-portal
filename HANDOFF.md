# Norkendol Employee Portal — Handoff

Last updated: April 3, 2026 — Session 4 (final)

---

## Current State

Portal has dual sidebars, auth middleware, role-gated accordion navigation with SVG icons and drag-and-drop reordering. Dashboard is fully functional with 5 live sections. Four admin pages wired up with full CRUD. **User Management rebuilt as table layout with 70 real employees seeded. Employee Directory built with grid/list views. Public apply page + pending user approval flow live.**

### What Works
- Login page at `/login` with Supabase auth
- Auth middleware redirects unauthenticated users to `/login`
- Dashboard at `/dashboard` with dual sidebar + top bar
- **IconSidebar (left):** Accordion sections grouped by role tier (User, Admin, Super Admin, System Admin). Each section collapsible. All items have gray stroke-based SVG icons. Drag-and-drop reordering within sections via @dnd-kit — order saves to Supabase per user. Collapsible to icon-only with round chevron button.
- **TextSidebar (right):** Permanent panel with contextual sub-items per page. Collapsible with matching chevron. Directory section now includes "Add New User" sub-item.
- **`/apply`** — Public signup page (name, phone, email, password + Google OAuth button). Creates user as `status=pending`. Shows confirmation. Shareable link for LinkedIn/email/etc.
- **`/pending`** — Holding page for unapproved users. Middleware redirects pending/rejected/inactive users here when they try to access `/dashboard`.
- 23 pages under `/dashboard/*` — 7 are now fully built, rest are placeholders
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
| `training_categories` | Admin-customizable course categories |
| `training_courses` | Course catalog (title, category, level, passing score) |
| `training_lessons` | Ordered lessons within courses (video/document/quiz) |
| `training_quiz_questions` | Multiple choice questions for quiz lessons |
| `training_assignments` | Who needs to complete what course, with due dates |
| `training_progress` | Per-user per-course progress, quiz scores, completion |

All tables have `org_id` FK → `public.orgs`, RLS enabled, appropriate policies.

**Supabase Storage:** `training-content` bucket (public) for uploaded videos and documents.

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
      dashboard-admin/page.tsx     — Dashboard Admin (4 tabs: Updates, Actions, Notifications, Leaderboard)
      user-management/page.tsx    — Table layout, 3 tabs (Internal, External, Pending Approvals)
      directory/page.tsx          — Employee directory, grid/list views
      settlement-tracker/page.tsx — User view (Active + Historical only)
      settlement-tracker-admin/page.tsx — Admin view (full CRUD + analytics)
      claim-calculator/page.tsx  — Claim Breakdown Calculator (adjusters, 1A)
      claim-calculator-settings/page.tsx — Release type template admin (Super Admin, 3)
      executive-intelligence/page.tsx — Org hierarchy + AI interviews + alert routing (Super Admin, 3)
      company-updates/page.tsx    — ORPHANED (now in Dashboard Admin)
      notifications/page.tsx      — ORPHANED (now in Dashboard Admin)
      action-items/page.tsx       — ORPHANED (now in Dashboard Admin)
      leaderboard/page.tsx        — ORPHANED (now in Dashboard Admin)
      pending-users/page.tsx      — ORPHANED (now in User Management)
      [16 placeholder pages]      — See HISTORY.md for full tier mapping
    api/
      executive/hierarchy/route.ts       — Org hierarchy CRUD
      executive/hierarchy/[id]/route.ts  — Hierarchy node update/delete
      executive/feature-assignments/route.ts — Feature assignment CRUD
      executive/onboarding-interview/route.ts — AI interview generation via callAI()
      executive/alert-routing/route.ts   — Alert routing rules CRUD
      ai-templates/route.ts              — AI context template management
    apply/page.tsx                — Public signup form
    pending/page.tsx              — Holding page for unapproved users
  components/
    PortalShell.tsx     — Layout orchestrator (both sidebars + top bar)
    IconSidebar.tsx     — Accordion nav, SVG icons, dnd-kit reorder, role gating
    TextSidebar.tsx     — Right contextual panel, collapsible
    TopBar.tsx          — Date/time + user display
    PendingApprovalsPanel.tsx — Pending user/contact/firm approvals (used in User Management)
    dashboard-admin/
      CompanyUpdatesPanel.tsx   — Company updates CRUD
      ActionItemsPanel.tsx      — Action items CRUD
      NotificationsPanel.tsx    — Notifications CRUD
      LeaderboardPanel.tsx      — Leaderboard CRUD
    settlement-tracker/
      MediationTrack.tsx        — Mediation/Arbitration track
      AppraisalTrack.tsx        — Appraisal track
      PASettlementsTrack.tsx    — PA Settlements track
  lib/
    supabase.ts         — Browser Supabase client
    supabase-server.ts  — Server-side Supabase client
    ai.ts               — Central AI utility (callAI, encryption, provider-agnostic)
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

## Next Session: Settlement Tracker — Wiring + Polish

### What's done (Sessions 18-20):
- **Data layer:** 14 DB tables, 7 type files, 11 hook files
- **User/Admin split DONE:** User page (1A) = Active + Historical only, no CRUD. Admin page (2A) = full features, all analytics.
- **All 4 tracks have full UI:**
  - **Litigation:** data grid, create/edit modals, TPN pickers, steps panel, attorney scorecards, referral analysis, liquidity
  - **Mediation/Arbitration:** data grid, create form, updates panel, TPN pickers for attorney, archive/unarchive, liquidity
  - **Appraisal:** data grid, create form, updates panel with status-conditional sections, TPN picker for our appraiser, carrier/umpire free text, liquidity with 7 KPIs
  - **PA Settlements:** 5-section create form (claim/parties/roof/money/settlement), parent/child payments, activity log, carrier adjuster rating, 15 KPI liquidity dashboard
- **Sidebar:** "Settlement Tracker" in 1A, "Settlement Tracker Admin" in 2A

### What to build next:

**Session 21 — Polish + Wiring:**
1. **User viewership filtering** — needs `firm_id` + `external_contact_id` added to users table to link portal users to TPN records. Then filter settlement tracker queries: ep_user sees own files, ep_admin sees firm files, admin+ sees all.
2. **Email notifications on assignment** — blocked on Noor (Resend domain)
3. **Edit form for PA settlements** — currently create-only, needs edit modal
4. **Appraisal update log hooks** — `appraisal_updates` table exists, no CRUD hooks
5. **PA settlement update/payment hooks** — raw supabase calls → proper hooks
6. **Cleanup:** shared styles, delete orphaned standalone pages (pending-users, company-updates, action-items, notifications, leaderboard)
7. **Run Executive Intelligence migration** in Supabase dashboard

**Executive Intelligence (shell — built Session 20):**
- Page: `/dashboard/executive-intelligence` with 3 sub-tabs (Hierarchy, Feature Assignments, Alert Routing)
- API routes: `/api/executive/` (hierarchy, feature-assignments, onboarding-interview, alert-routing)
- DB migration: `20260405_executive_intelligence.sql` — **NOT YET RUN**
- Intent: routing engine for AI-generated insights. Org hierarchy defines who owns what features. AI interviews profile each person's priorities. Alert routing rules determine who gets notified about what. Every portal feature will eventually feed into this.

**Noor tasks (not code):**
- Set up Resend verified sending domain
- Text/SMS provider selection
- Run `20260405_executive_intelligence.sql` in Supabase dashboard

**BINGO required before writing any code.**

---

## Previous: Compliance Tab

**Priority:** Build the `/dashboard/compliance` page.

**Reference:** Study `coastalclaims-employee-portal/src/components/compliance/` and `src/pages/Compliance.tsx` for ideas and structure. The old code has good bones but:
- **NO MongoDB** — the old repo uses MongoDB via API calls. Norkendol is Supabase only.
- **NO Lovable dependencies** — the old repo was built with Lovable and has broken/messy deps. Don't import anything from it.
- **Use as reference only** — understand the UX, the compliance categories, what data it tracks, how it displays. Then build fresh for Supabase.

Key compliance files in old repo to read:
- `src/pages/Compliance.tsx` — main page
- `src/components/compliance/AlertConfigForm.tsx`
- `src/components/compliance/AlertDashboard.tsx`
- `src/components/compliance/AutomationRules.tsx`
- `src/components/compliance/EmployeeComplianceView.tsx`
- `src/components/compliance/ExpiringItemsModal.tsx`
- `src/components/compliance/LicensesModal.tsx`
- `src/components/compliance/BondsModal.tsx`
- `src/components/compliance/ComplianceAutomation.tsx`

**BINGO required before writing any code.**

## Key Rules

- **BINGO** required before writing any code
- White-label — NO company branding (no CCS, no Coastal)
- Supabase only
- Tenant-first design — every table gets `org_id`
- Keep it simple
