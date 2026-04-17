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

### Session — April 17, 2026 (afternoon)

**AI Assist — Email Parsing for Onboarder KPI**
- "AI Assist" button on Add Client form — paste onboarding email, AI extracts all fields
- API route: `src/app/api/onboarder/parse-email/route.ts` — uses centralized `callAI()` with feature key `onboarder_email_parser`
- AI template seeded in `ai_context_templates` table — extracts 30+ fields from form submission emails
- Works with the standard "Auto Contract Submission" email format from the CCS website

**Expanded Intake Form (matches old system)**
- Policyholder: first/last name split, additional policyholder (name, email, phone)
- Loss Info: state, date of loss, cause of loss, split address (street, line2, city, state, zip), loss description
- Parties: contractor company, name, email, phone, referral source (Contractor/Other dropdown with editable text), source email
- Claim & Assignment: assignment type dropdown, insurance company, policy number, status of claim dropdown, claim number, file number, supplement notes
- Assignment: assigned user (auto-filled with logged-in user), assigned PA, onboard type
- `client_name` and `loss_address` auto-computed from split fields on save
- Cancel button always visible, AI Assist always accessible
- 19 new columns on `onboarding_clients` table (migration: `20260417_onboarder_expanded_intake_fields`)

**Auto-Generated File Numbers**
- Format: `TX-00001-2026` (state + admission number + year onboarded)
- `TX` = 2-letter state code of the loss location
- `00001` = admission number — sequential per state, increments with each new client onboarded in that state
- `2026` = the year the client was onboarded (not the year of loss)
- Auto-generates when state field is filled — shows on form immediately as read-only
- Queries DB for highest existing admission number per state+year, increments
- Field labeled "(auto-generated)" with "Fills when state is entered" placeholder

**Contractor → Talent Partner Network Flow**
- After saving a new client with contractor info, system checks TPN by phone number, then email
- If contractor not found and company not found → opens Add Firm modal (pending status), then Add External User modal
- If contractor not found but company exists → opens Add External User modal linked to existing firm
- If contractor found but missing info → silently updates their record (email/phone)
- Shared modal components: `src/components/tpn/AddFirmModal.tsx`, `src/components/tpn/AddExternalUserModal.tsx`
- These are reusable from anywhere in the portal — same forms as TPN admin
- Firms from onboarder flow created as `pending` (admin approval in User Management → Pending Approvals)
- External contacts created as `pending` — same approval flow
- Success toast confirms what happened

### Session — April 17, 2026 (morning)

**Shared Claim Lookup (system-wide)**
- New hook: `src/hooks/useClaimLookup.ts` — cross-table debounced search by claim #, file #, client name, or address
- New component: `src/components/ClaimMatchBanner.tsx` — match picker UI (single or multiple results)
- Integrated into: Onboarder KPI, Estimator KPI, Claim Health, Settlement Tracker Litigation (admin), PA Settlements, Claim Calculator
- Added `claim_number`, `file_number`, `loss_address` columns to `onboarding_clients` table
- Migration: `supabase/migrations/20260417_claim_lookup_fields.sql`

**Claim Calculator — Claim Info section added**
- New fields at top: claim number, file number, client name, loss address
- Wired to shared claim lookup

**Employee ID auto-generation**
- Format: `STATE-SEQUENCE-YEAR` (e.g., `FL-317-26`)
- Auto-generates on profile save when employee_id is blank + location has state code
- `generateEmployeeId()` function in `src/app/dashboard/user-management/page.tsx`
- Fixed 7 incorrect employee IDs in database, highest number is now 316

**University tab improvements**
- Course cards: larger thumbnails with `object-cover`, duration + video count, dual badges (level + category), "Start/Resume/Review Course >" action text
- Seeded all 42 courses from old portal with correct metadata
- Uploaded 42 AI-generated cover slide images to Supabase storage (`training-content/thumbnails/`)
- Added 3 new training categories: Claims Adjuster, Soft Skills, Other
- Video lesson stubs created with correct durations (videos not yet attached)

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
6. **Run Executive Intelligence migration** in Supabase dashboard
7. **Verify claim calculator math** — see note below

---

## CLAIM CALCULATOR MATH CHANGES — SESSION 20 (NEEDS FRANK TO VERIFY)

The calculator was working before these changes. An automated audit compared our portal build against the latest source repo and made 5 corrections. If the math seems wrong during testing, these are the 5 changes to review/revert. All in `src/app/dashboard/claim-calculator/page.tsx`, commit `268c7db`.

**Change 1 — Final Balance now subtracts owed prior PA fees**
- BEFORE: `finalBalance = balanceBeforePAFees - currentPAFees`
- AFTER: `finalBalance = balanceBeforePAFees - currentPAFees - priorPAFeesOwed`
- IMPACT: If there are prior payments with PA fees marked as NOT paid, the final balance will be lower than before. If no one uses the "Paid" checkbox on prior payments, this changes nothing.

**Change 2 — Roof checkbox key renamed**
- BEFORE: `checkedItems.roofRepairs` (state key) and `key: "roofRepairs"` (UI)
- AFTER: `checkedItems.roof` (state key) and `key: "roof"` (UI)
- IMPACT: Was internally consistent before — both used `roofRepairs`. Changed to match source repo naming. Functionally identical, just renamed.

**Change 3 — Total Possible Recovered uses actual PA fees instead of 0.9 multiplier**
- BEFORE: `totalPossibleRecovered = (balanceBeforePAFees * 0.9) + priorPayments - priorPAFees + deductible + deductions`
- AFTER: `totalPossibleRecovered = (balanceBeforePAFees - currentPAFees) + priorPayments - priorPAFeesPaid + deductible + deductions`
- IMPACT: When all fee percentages are 10%, the 0.9 shortcut gives the same answer as the new formula. Only differs when coverage fee percentages are set to something other than 10%.

**Change 4 — Withheld amount for traffic light uses full deductions**
- BEFORE: `withheldAmount = totalDeductions - nonRecoverableDepreciation`
- AFTER: `withheldAmount = totalDeductions`
- IMPACT: The traffic light color (green/yellow/red) may show yellow instead of red when non-recoverable depreciation is present. This changes the threshold for "Additional Cost to Insured" vs "You Can Possibly Recover".

**Change 5 — Added remainingPAFeesDue calculation**
- BEFORE: Did not exist
- AFTER: `remainingPAFeesDue = Math.max(0, totalPAFees - priorPAFeesPaid)`
- IMPACT: New calculation only — doesn't change any existing display. Available for future use.

**TO REVERT:** If any of these cause problems, tell Claude to revert commit `268c7db` changes in the claim calculator. The commit only touched math formulas, nothing else.

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

---

## Architecture: Shared Claim Lookup — MANDATORY

This portal is **one integrated claims management system**, not a collection of standalone tools. Every section (onboarding, estimating, settlement tracker, claim health, claim calculator, and anything built in the future) is a different view of the same underlying claim. The shared claim lookup is the connective tissue that ties it all together.

### The Rule

**Any new feature that involves claim or client data MUST use the shared claim lookup.** If a user can type a claim number, file number, client name, or property address, it must search across the system and offer to prefill from existing data. No exceptions.

### How It Works

- **Hook:** `src/hooks/useClaimLookup.ts` — debounced cross-table search
- **Component:** `src/components/ClaimMatchBanner.tsx` — match picker UI (single or multiple results)
- Searches across: `onboarding_clients`, `estimates`, `litigation_files`, `claim_health_records`
- Shows a prompt ("Found existing data — use it?") — never auto-fills silently
- When multiple matches exist (same client, different claims), shows a list to pick from

### Currently Wired Into

1. **Onboarder KPI** — claim #, file #, address, client name
2. **Estimator KPI** — file #, claim # (alongside existing revision-link prefill)
3. **Claim Health** — claim ID, client name
4. **Settlement Tracker Litigation** — file #, client name (admin create modal)
5. **PA Settlements** — referral source (create modal)
6. **Claim Calculator** — claim #, file #, client name, address

Appraisal and Mediation tracks don't need it — they link to existing litigation files via dropdown.

### The Identifiers

**File Number (internal, master key)**
- Assigned by Coastal Claims at onboarding — this is YOUR ID
- Format: `{STATE}-{SEQUENCE}-{YEAR}` — e.g., `FL-00001-2026`, `AZ-00352-2026`
- `{STATE}` = 2-letter state code of the loss location
- `{SEQUENCE}` = 5-digit zero-padded admission number — increments per state with each new client onboarded, resets to 00001 each new year (the year suffix prevents duplicates)
- `{YEAR}` = 4-digit year the client was onboarded (NOT the year of loss)
- Future: auto-generated by the system at onboarding. For now, manually entered.

**Claim Number (external, carrier-assigned)**
- Comes from the insurance carrier — you don't control it, just enter what they give you
- One file number can potentially map to one or more claim numbers

**Client Name + Property Address (search helpers)**
- One client can have many files (e.g., Clint Djokovic has 200+ files over the years)
- One client can have multiple active claims at different addresses (e.g., Mark Love with 5 hotels)
- Searching by name or address must always show ALL matches and let the user pick — never assume which one

### Why This Matters

Because everything connects through file number / claim number, we can eventually build:
- **Claim Lifecycle KPI** — pull up one claim and see the full story: when onboarded, estimate turnaround, blockers hit, settlement outcome, claim health score
- **Cross-section analytics** — identify pain points per claim, per carrier, per referral source
- **Data integrity** — no conflicting data across sections because it all flows from one source

### For Future Developers

When adding a new section or feature:
1. Does the user enter or reference claim/client data? → Use `useClaimLookup` + `ClaimMatchBanner`
2. Does the feature create new records tied to a claim? → Include `file_number` and/or `claim_number` columns
3. Does the feature's table need to be searchable by the lookup? → Add it to the search queries in `useClaimLookup.ts`
4. Remember: file number is the master key. Claim number is the carrier's reference. Both matter.

---

## Architecture: Employee ID Format

Employee IDs follow the same convention as file numbers. Auto-generated when a user profile is saved without one (requires location with a state code).

### Format: `{STATE}-{SEQUENCE}-{YEAR}`

- `{STATE}` = 2-letter state code of the employee's home state (extracted from `location` field, e.g., "Tampa, FL" → FL)
- `{SEQUENCE}` = next available number across the org (does NOT reset per year — one continuous sequence)
- `{YEAR}` = 2-digit year the employee was onboarded

Examples: `FL-001-18` (Frank Dalton, founder), `FL-266-21` (Bill Prendergast), `CA-310-26` (Alana Love)

### Auto-Generation Logic

- Located in: `src/app/dashboard/user-management/page.tsx` → `generateEmployeeId()`
- Triggers on profile save when `employee_id` is blank and `location` contains a 2-letter state code
- Queries all existing employee IDs, finds the highest number, assigns next
- Field shows "Auto-generated if blank" placeholder
- Admins can still manually enter/override an employee ID

### Special Cases

- `ADMIN001` (Talha Masood), `ADMIN002` (Noor Muhammad) — dev/admin accounts, exempt from format
- External partners (`ep_user` role) — typically don't get employee IDs
- Pending users from `/apply` — get employee ID assigned when admin edits their profile

---

## Architecture: Hub-and-Spoke System — READ THIS FIRST

This portal is NOT a collection of separate apps that happen to share a login page. It is ONE integrated system where every section is a spoke connected to common hubs. When you work on any feature, you must think about what other parts of the system it touches. If you build something in isolation, you built it wrong.

### The Nervous System Analogy

Think of the portal like a body's nervous system. A signal (a new claim, a new contractor, a status change) travels through the system and triggers responses in multiple places. When an onboarder enters a new client, that's not just an onboarding event — it potentially creates a file number used everywhere, adds a contractor to the partner network, and feeds data that estimating, settlement, and claim health will all reference later.

### The Hubs (shared data + shared components)

**1. Claim Data Hub**
- Master key: `file_number` (internal, format: `TX-00001-2026`)
- Secondary key: `claim_number` (external, carrier-assigned)
- Shared lookup: `useClaimLookup` hook + `ClaimMatchBanner` component
- Tables that hold claim data: `onboarding_clients`, `estimates`, `litigation_files`, `claim_health_records`
- Rule: ANY page that touches claim/client data must use the shared claim lookup

**2. People Hub (Talent Partner Network)**
- Internal staff: `users` table (employees, admins)
- External partners: `external_contacts` table (contractors, attorneys, appraisers, engineers)
- Firms: `firms` table (companies that external contacts belong to)
- Shared modals: `src/components/tpn/AddFirmModal.tsx`, `src/components/tpn/AddExternalUserModal.tsx`
- Approval flow: external contacts and firms created outside TPN admin land as `pending` → admin approves in User Management → Pending Approvals
- Rule: When a page encounters a person or company not in the system, it should offer to add them using the shared TPN modals — not build its own mini-form

**3. AI Hub**
- Centralized: `src/lib/ai.ts` → `callAI()` function
- Templates: `ai_context_templates` table (locked prompts per feature)
- Settings: `org_settings` table (provider, model, API key per org)
- Logging: `ai_usage_log` table (every call tracked)
- Rule: ALL AI features use `callAI()` with a feature key — never call Anthropic/OpenAI directly

**4. Approval Hub**
- `PendingApprovalsPanel` component (`src/components/PendingApprovalsPanel.tsx`)
- Lives in User Management → Pending Approvals tab
- Three sub-sections: Internal Users, External Contacts, Firms
- Any page that creates users, contacts, or firms with `pending` status feeds into this single approval queue

### The Spokes (feature pages)

Each spoke connects to multiple hubs:

| Spoke | Claim Hub | People Hub | AI Hub | Approval Hub |
|-------|-----------|------------|--------|--------------|
| **Onboarder KPI** | Creates claims (file #, claim #), shared lookup | Adds contractors → TPN via shared modals | AI email parsing | New firms/contacts → pending approval |
| **Estimator KPI** | References claims via shared lookup | References adjusters | — | — |
| **Settlement Tracker** | References claims, litigation files | TPN pickers for attorneys, appraisers | — | — |
| **Claim Health** | References claims via shared lookup | — | — | — |
| **Claim Calculator** | References claims via shared lookup | — | — | — |
| **TPN Admin** | — | Full CRUD for contacts, firms, hierarchy | — | Creates pending contacts/firms |
| **User Management** | — | Full CRUD for staff, external partners | — | Approval queue for all pending items |
| **Training University** | — | Assigns courses to staff | AI course generation | — |
| **Executive Intelligence** | — | Org hierarchy, feature assignments | AI interviews | — |

### Cross-Page Data Flow Examples

**Example 1: New claim from onboarding email**
```
Onboarding email pasted into AI Assist
  → AI parses 30+ fields, fills the intake form
  → Onboarder reviews, hits Save
  → File number auto-generated (TX-00001-2026)
  → Contractor detected → system checks TPN by phone/email
  → Not found → Add Firm modal (pending) → Add External User modal (pending)
  → Admin approves in User Management → Pending Approvals
  → Claim now searchable from Estimator KPI, Settlement Tracker, Claim Health, Claim Calculator
  → Contractor now available in TPN pickers throughout the system
```

**Example 2: Existing claim referenced in estimating**
```
Estimator types file number in Estimator KPI
  → Shared claim lookup finds the onboarding record
  → Banner: "Found TX-00001-2026 — Ngoc-Quynh Phan, Hail, Spring TX. Use this data?"
  → Estimator clicks Accept → form pre-fills with all known data
  → No duplicate data entry, no conflicting info across sections
```

### Rules for Future Development

1. **Never build in isolation.** Before writing a feature, ask: "What other parts of the system does this touch?" If the answer is "none," you're probably missing something.

2. **Use shared components.** If a modal, form, or lookup already exists as a shared component, use it. Don't rebuild it inside your page. Current shared components:
   - `src/hooks/useClaimLookup.ts` — claim/client search
   - `src/components/ClaimMatchBanner.tsx` — match picker UI
   - `src/components/tpn/AddFirmModal.tsx` — add firm from anywhere
   - `src/components/tpn/AddExternalUserModal.tsx` — add external contact from anywhere
   - `src/components/PendingApprovalsPanel.tsx` — unified approval queue
   - `src/lib/ai.ts` → `callAI()` — all AI features

3. **Pending status flows to one place.** Any record created as `pending` (users, contacts, firms) should be reviewable in User Management → Pending Approvals. Don't create separate approval UIs per page.

4. **File number is the master key.** Every section that touches claims must store and reference `file_number`. This is what ties everything together.

5. **Phone and email are identity keys.** When checking if a person exists in the system, search by phone number first (digits only, exact match), then email (case-insensitive). Names are unreliable — people use nicknames, abbreviations, different spellings.

6. **Read HANDOFF.md before every coding session.** This document is the single source of truth for how the system works. If something isn't documented here, it should be.

---

## Architecture: Roles, Permissions & Data Filtering

### Role Hierarchy (from `users.role`)

| Role | Label | Track | What They See |
|------|-------|-------|---------------|
| `user` | User | Internal | User sidebar items only, own data |
| `ep_user` | External Partner | External | User sidebar items checked in permissions, firm's data only |
| `ep_admin` | Partner Admin | External | Same as ep_user + can manage their firm's users |
| `admin` | Admin | Internal | User + Manager sidebar items, all org data |
| `super_admin` | Super Admin | Internal | User + Manager + Admin sidebar items, all org data |
| `system_admin` | System Admin | Norkendol | Everything — god mode |

Internal roles stack: `system_admin` > `super_admin` > `admin` > `user`. External is separate track: `ep_admin` > `ep_user`.

### Permission System (`user_permissions` table)

Every user has a permissions record with boolean toggles. Admins set these via User Management → edit user → Permissions tab.

**Feature Toggles** (control system-wide behavior):
- `talent_network` — card shows up in Talent Partner Network listings
- `crm_assignable` — can be assigned to claims in CRM
- `crm_office_staff` — full CRM access (office/admin)

**User Sidebar** (what appears in the User section):
- `dashboard`, `applications`, `teams_chat`, `calendar`, `university`, `directory`, `documents`, `ai`, `talent_partner_network`, `compliance`, `crm`

**Manager Sidebar** (what appears in the Manager section — role must be admin+):
- `staff_management`, `pending_users`, `company_updates_admin`, `action_items_admin`, `notifications_admin`, `training_admin`

**Admin Sidebar** (what appears in the Admin section — role must be super_admin+):
- `departments_admin`, `ai_agents_admin`, `app_management`, `compliance_admin`, `claim_calculator_settings`

### Real-World Role Examples

**Estimator** (e.g., Brandon Leighton) — `role: user`
- Sees: Estimator KPI (own data only, no team dashboard)
- Cannot see other estimators' data, management views, or admin features

**Lead Estimator / Manager** (e.g., Nell Dalton) — `role: admin`
- Sees: Estimator KPI (all estimator data, team dashboard, analysis, scorecards)
- Sees: Manager sidebar items

**Public Adjuster** — `role: user`
- Sees: Claims Health Matrix, Claim Calculator, assigned claims
- Cannot see management or admin features

**External Attorney** (e.g., at ABC Law Firm) — `role: ep_user`, `firm_id: abc-law`
- Sees: ONLY ABC Law Firm's case files in Settlement Tracker / Legal KPIs
- Cannot see any other firm's data or internal CCS data

**External Contractor** (e.g., at Moss Roofing) — `role: ep_user`, `firm_id: moss-roofing`
- Sees: ONLY files associated with Moss Roofing
- Cannot see internal data, other firms, or admin features

**Frank / Superadmin** — `role: super_admin`
- Sees: Everything — all User, Manager, Admin sidebar items, all data across all firms

### Firm-Based Data Filtering Rule — MANDATORY

Every page that displays claim, client, or case data MUST follow this rule:

```
IF user.role is ep_user or ep_admin:
    Query WHERE firm_id = user's firm
    OR WHERE external_contact_id = user's external_contacts record
    Show ONLY their firm's data — nothing else
ELSE (internal user):
    Show ALL org data (within role-appropriate views)
```

**How firm association works:**
- `external_contacts` table has `firm_id` (FK to `firms`) and `user_id` (FK to `users`)
- When an external partner logs in, find their `external_contacts` record via `user_id`
- Use that record's `firm_id` to filter all data queries
- If `firm_id` is null, fall back to filtering by `external_contact_id` directly

### What Every Page Must Do

1. **Read user role from auth context** — the `useOKSupabase()` hook (or equivalent per page) provides `userInfo` with `role`, `userId`, `orgId`
2. **Filter data for external partners** — external users must never see data outside their firm
3. **Respect role visibility within the page** — e.g., an estimator sees their own scorecard, a manager sees all scorecards
4. **Never expose internal data to external partners** — no internal metrics, no employee info, no other firms' data, no admin features
5. **External partners NEVER see Manager or Admin sidebar sections** — enforced by `IconSidebar.tsx` role gating

---

## Key Rules

- **BINGO** required before writing any code
- White-label — NO company branding (no CCS, no Coastal)
- Supabase only
- Tenant-first design — every table gets `org_id`
- Keep it simple
