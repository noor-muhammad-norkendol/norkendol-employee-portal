# Norkendol Employee Portal — Handoff

Last updated: April 3, 2026 — Session 4 (final)

---

## Canonical CRM Spoke Standard — READ FIRST IF DOING SCHEMA WORK

**Locked 2026-04-28.** Every CRM spoke table (today's 7 + all future 15-18) must carry both categories below. **This is non-negotiable, applies to current AND all future spokes, and must be enforced at design-time** — when a new spoke is being created, both categories go into the **initial CREATE TABLE migration**, NOT as a follow-up sweep.

### The two categories

```
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│  CATEGORY 1 — IDENTIFIERS           │  │  CATEGORY 2 — CHARACTERISTICS       │
│  (Searchable; cross-spoke lookup)   │  │  (Descriptive; on every Claim Info) │
│  ───────────────────────────────    │  │  ───────────────────────────────    │
│  • file_number      (FL-NNNNN-YYYY) │  │  • peril       (lookup-driven)      │
│  • claim_number     (carrier)       │  │  • peril_other (free text when      │
│  • policy_number                    │  │                 peril = 'Other')    │
│  • client_name      (= "client ID") │  │  • severity    (int 1-5, fixed)     │
│  • loss_address                     │  │  • status      (deferred — TBD)     │
│                                     │  │                                     │
│  Surfaced via useClaimLookup        │  │  Display on every claim form        │
│  (5 fields in the search dropdown)  │  │  consistently. Peril sourced from   │
│                                     │  │  peril_types lookup (admin-edits).  │
│  No CHECK constraints — text only   │  │  Severity is fixed CHECK 1-5.       │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
```

### Field-by-field spec

**Category 1 — Identifiers:**

| Field | Type | Notes |
|---|---|---|
| `file_number` | `text` | Internal CCS-generated ID, format `STATE-NNNNN-YYYY` (e.g., `FL-12345-2026`) |
| `claim_number` | `text` | Carrier-assigned external claim number |
| `policy_number` | `text` | Insurance policy number |
| `client_name` | `text` | The insured / policyholder. Synonym in conversation: "client ID" |
| `loss_address` | `text` | Property where the loss occurred |

**Category 2 — Characteristics:**

| Field | Type | Notes |
|---|---|---|
| `peril` | `text` | Sourced from the `peril_types` lookup table (admin-editable). NO CHECK constraint on the spoke column. UI dropdown queries `peril_types WHERE is_active = true ORDER BY sort_order`. 12 starter perils seeded: Wind/Hail, Wind, Hail, Hurricane, Fire, Lightning, Flood, Smoke, Vandalism, Theft, Water, Other. |
| `peril_other` | `text` | Free-form text. Populated only when user picks `peril = 'Other'` (e.g., "plane crash"). |
| `severity` | `int` | `CHECK (severity IS NULL OR severity BETWEEN 1 AND 5)`. UI displays as integers only. NOT a lookup table. Internal text mapping (for documentation only): 1=Light, 2=Minor, 3=Moderate, 4=Severe, 5=Total Loss. |
| `status` | DEFERRED | Each spoke keeps its own status column for now. Unified-status design is a future decision. |

### Today's 9 spokes (compliance verified 2026-04-28)

`onboarding_clients` · `estimates` · `litigation_files` · `mediations` · `appraisals` · `pa_settlements` · `claim_health_records` · `claim_calculator_runs` · `team_lead_reviews`

**Workflow chain (locked 2026-04-28):**
```
Onboarding → TLS Phase 1 → Scope of Loss → Estimating → TLS Phase 2 → Adjuster
```
Scope of Loss and Adjuster KPI are **placeholder pages only** — backing spokes pending future builds. Calculator (`claim_calculator_runs`) and TLS (`team_lead_reviews`) are full spokes built today.

**Auto-create wiring (app-level, in upstream hook's `onSuccess`):**
- Onboarder `status='completed'` → upserts `team_lead_reviews` Phase 1 row
- Estimator `status='review'` → upserts `team_lead_reviews` Phase 2 row
Idempotent via `(org_id, file_number, phase)` unique constraint. NOT a DB trigger — visible/debuggable.

### Onboarder KPI event publishing (locked 2026-04-28)

The Onboarder publishes 5 metric_keys to `kpi_snapshots` (`source_module='onboarding'`) so KPI questions can be answered without hand-querying. Event helper at `src/hooks/onboarder-kpi/publishKPIEvent.ts` — fire-and-forget (errors logged, never thrown).

| metric_key | when fires | metadata |
|---|---|---|
| `claim_abandoned` | User confirms Mark Abandoned via toast | `{user_id, file_number, from_phase}` |
| `claim_erroneous` | User confirms Mark Erroneous via toast | `{user_id, file_number, from_phase}` |
| `claim_revised` | Save in Revise mode with at least one field changed | `{user_id, file_number, fields_changed: [...]}` |
| `phase_completed` | Status advances to non-archival next phase | `{user_id, file_number, from_phase, to_phase}` |
| `time_in_phase` | An `onboarding_phase_sessions` row gets `ended_at` (any reason) | `{user_id, phase, session_id, ended_reason}` |

**EI Data tab** (`/dashboard/executive-intelligence` → KPI Admin tab → Data sub-tab) is the flat event-log viewer over kpi_snapshots: filter by date range / module / metric / user, sortable columns, CSV export. No EI tables (org_hierarchy etc.) needed — Data tab is independent of the deferred `20260405_executive_intelligence.sql` migration.

**Soft-delete on Onboarder:** clicking Mark Erroneous / Mark Abandoned shows a confirm prompt, sets the status accordingly, publishes the kpi event, and auto-closes the panel. The dashboard query in `useOnboardingClients` excludes `erroneous`/`abandoned`/`revised` from the default view — those rows still exist in `onboarding_clients` (queryable from the EI Data tab) but never appear in the user-facing UI.

### Rule for new spokes

When designing any new table that holds per-claim records (e.g., `claim_files`, `claim_action_items`, `claim_payments`, `claim_notes`, etc.):

1. **All 9 canonical columns MUST be in the initial CREATE TABLE migration.** No "we'll add them later." No "this spoke doesn't need claim_number." No exceptions.
2. **Apply the rule at design time** — the first design check on any new spoke migration is: "Does this CREATE TABLE include all 9 canonical columns?"
3. **The standard scales.** Frank expects 15-18 spokes total. Every new one inherits the standard automatically by following this rule.

### Why this rule exists

Frank's directive (2026-04-28): "everything that's on your onboarding KPI needs to be the same in each of these systems when you add something" + "if I accidentally forget to say these are minimum standards, the MD should speak of this." Drift across spokes (different column names, missing fields, type inconsistencies) compounds into special cases in app code, RLS, and JOINs. Tonight's sweep caught all 7 current spokes; this rule prevents drift from returning.

### Cross-references

- Memory entries (auto-loaded by future Claude sessions): `feedback_canonical_spoke_standard.md`, `feedback_canonical_vocabulary.md`, `feedback_cross_spoke_consistency.md`
- Decision log: `.planning/CRM-PLAN.md` row dated 2026-04-28

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

### Session — April 17, 2026 (evening) — Workboard Enhancement

**Full-Width Workboard + Action Icons**
- Removed maxWidth:1200 constraint — table fills available space
- Per-row action icons (colored): Text (blue), Email (amber), Call (purple), Complete (green), Notes (orange)
- "..." expander button for Move/Edit/Delete (moved out of main row)
- Complete icon one-click advances to next natural stage

**Slide-Out Client Detail Panel (1050px)**
- Click client name or any action icon → panel slides from right
- Sections: Header (name, file#, status, Edit/Delete), Contact Info (with PA email/phone from users table), Stage Action Checklists, Quick Note, Activity History, Saved Notes
- Contact info pulls PA data from employee directory via `usePALookup` hook

**ActionComposer — Email/Text/Call Recipient Picker**
- Click Email/Text icon → panel opens with recipient picker at top
- Each contact (Insured, Contractor, PA) shown with To/CC toggle buttons
- Insured defaults to "To", others off — click to toggle To/CC/Off
- "Open Email" builds mailto with correct To/CC and opens email client
- Call action: pick who you're calling + call result (Answered/Voicemail/No Answer/Busy)

**Stage Action Checklists**
- 3 contact targets per stage: Insured, Contractor, PA
- Each has 3 actions: Text, Email, Call — circle when incomplete, checkmark when done
- Call requires outcome selection
- New DB table: `onboarding_stage_actions` (migration applied)
- New hooks: `useStageActions`, `useCompleteStageAction`

**Urgency Banner**
- Collapsible red banner above table when any clients are overdue
- Shows count + expandable list with time-in-stage per client
- Click a client → opens their detail panel

**PA Lookup (Hub-and-Spoke)**
- `usePALookup` hook: looks up assigned PA by name in `users` table
- Fuzzy matching: tries exact match, then first+last name fallback (handles middle names)
- Pulls email (`work_email` or `email`) and `primary_phone` from employee directory
- PA contact info displayed in panel and available in ActionComposer

**UserAutocomplete — Smart Employee Picker**
- Replaced plain text inputs for Assigned User and Assigned PA
- Searchable dropdown: type 2+ chars → shows matching employees
- **Assigned PA is license-gated**: only shows adjusters with approved, non-expired licenses in the loss state
- Queries `licenses` table joined with `users` — filters by state + status + expiry
- Shows "No licensed adjusters found for X in [STATE]" when no match
- Label shows "(licensed in TX)" so user knows filtering is active

**Component Extraction (page.tsx refactor)**
- Split 1127-line page.tsx into 8 components + styles file
- Components: PipelineHeader, WorkboardTable, AddClientForm, PerformanceView, ClientDetailPanel, StageActionChecklist, ActionComposer, UserAutocomplete
- page.tsx is now a thin orchestrator (~350 lines)

**New Files:**
- `src/app/dashboard/onboarder-kpi/components/` — 10 files (styles, 8 components, mailtoHelpers)
- `src/hooks/onboarder-kpi/useStageActions.ts`
- `src/hooks/onboarder-kpi/usePALookup.ts`
- `supabase/migrations/20260417_onboarding_stage_actions.sql`

**Commit:** `02968d4` — pushed to staging

**KPI Admin Tab + Onboarding Email/Text Templates**
- New "KPI Admin" tab in Executive Intelligence (next to KPI Dashboard)
- Onboarding sub-tab with collapsible stage cards
- 6 stages × 3 contacts = 18 template slots (email subject, email body, text message)
- Placeholder variables: `{client_name}`, `{file_number}`, `{contractor_name}`, `{pa_name}`, `{state}`, `{peril}`, `{assigned_user}`, `{client_email}`, `{client_phone}`, `{loss_address}`
- All 18 templates seeded in DB with real escalating content
- Templates stored in `onboarding_email_templates` table (new, migration applied)
- Sub-tab structure ready for future KPI admin areas (Estimating, Litigation, etc.)
- Fill count badges per stage card (e.g., "3/3 templates")
- Save All Changes button with dirty state tracking
- **Known issue:** Templates not loading in the UI despite being in DB — needs debugging (console logs added, check browser F12)
- **Commits:** `65af3ee`, `055db00` — pushed to staging

**ActionComposer Color Update**
- To button = green, CC button = blue, Open Email button = green
- Much cleaner visual distinction between To and CC

**Playwright MCP Fix (applied but needs restart)**
- Changed from `--headless` to `--user-data-dir` for persistent browser sessions
- Config updated in `.claude.json` (both project scopes)
- After restart: browser opens visibly, login persists across sessions

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
**Supabase:** `hkscsovtejeedjebytsv` (org: **coastal claims services**, project name: **norkendolportal**)

> ### ⚠️ DO NOT TOUCH `.env.local` SUPABASE VALUES
>
> The CORRECT Supabase project is **`hkscsovtejeedjebytsv`** in the **`coastal claims services`** org, project name **`norkendolportal`**. It has the full application schema (`action_items`, `notifications`, `company_updates`, `user_pinned_apps`, `users` with ~83 employees, etc.) and Frank's user account.
>
> **A different, look-alike project exists** at ref `mmccqhxomkohjydukxnn` in **`noor@norkendol.com's Org`**, project name **`norkendol-employee-portal`**. It is NOT the right project — it has Frank's auth user but **no application schema**. Pointing `.env.local` at it makes login work but every dashboard query 404 and the app appears broken.
>
> **If login fails with HTTP 400 ("Invalid login credentials") against `hkscsovtejeedjebytsv`:**
> 1. Do NOT swap `.env.local` to a different project ref. The schema lives only on `hkscsovtejeedjebytsv`.
> 2. First check: caps lock, rate limit (wait 5–15 min), and that `.env.local` URL still says `hkscsovtejeedjebytsv`.
> 3. If still failing, reset Frank's password via the Supabase dashboard for that project (Auth → Users → row → "Send password recovery" or set new password directly). Frank is the project owner.
> 4. Do NOT use the "Authentication → Users" view in any other org's dashboard to conclude "users are missing." Verify the URL bar's project ref matches `.env.local` before drawing any conclusion.
>
> Lesson learned 2026-04-27: a session burned hours pointing `.env.local` at the wrong look-alike project after misreading a dashboard. Don't repeat.

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

## Next Session: CRM Phase 1 Step 5 (claim_id FKs on the seven spokes)

Steps 1, 2, 3, 4 of CRM Phase 1 plus the canonical `file_number` sweep all closed across 2026-04-27 / early 2026-04-28. Next up:

- **Step 5 — Add `claim_id` FK on each of the seven spokes:** `onboarding_clients`, `estimates`, `litigation_files`, `mediations`, `appraisals`, `pa_settlements`, `claim_health_records`. Each gets a nullable `claim_id uuid REFERENCES claims(id) ON DELETE SET NULL`. After the column lands, link existing rows (estimates' 6 rows all → the single `AL-123456` claims row).
- **Pair with backfill:** while we're touching pa_settlements / mediations / appraisals, also UPDATE the new `file_number` column on each of them from `litigation_files.file_number` via the existing `litigation_file_id` FK.
- **`mediations` and `appraisals` heads-up:** these tables exist in the live DB but have NO migration files (created via dashboard). Step 5's `ALTER TABLE` will work either way, but worth capturing their definitions in the migrations folder during a future cleanup pass.

After Step 5: Step 6 reworks `useClaimLookup` to scope queries via the new FK. Step 7 tightens RLS on the seven spokes (replaces remaining `USING (true)` permissive policies with real personnel-mediated predicates). Steps 8–9 wrap the access model rollout.

See `.planning/CRM-PLAN.md` for the full phase plan and Decision Log.

---

## Parallel track: Settlement Tracker — Wiring + Polish (still open)

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

### Session — April 18, 2026 — Portal-Wide Code Review + UI Customization System

**Part 1: Full Codebase Simplify Review (3 passes)**

Ran `/simplify` across the entire portal — 3 review passes with parallel agents.

- **Shared useSupabase hook** — consolidated 4 identical hooks into `src/hooks/useSupabase.ts`. Old names (`useOKSupabase`, `useEKSupabase`, `useCHSupabase`, `useSTSupabase`) re-export as deprecated aliases.
- **Shared formatters** — `formatDate` (13 files), `formatCurrency` (6), `timeAgo` (3), `truncate` (3) → `src/lib/formatters.ts`
- **Shared styles** — `cardStyle`, `inputStyle`, `labelStyle`, `btnPrimary`, etc. (17+ files) → `src/lib/styles.ts`
- **STATUS_COLORS consistency** — standardized on `{ bg, text }` across onboarder-kpi + estimator-kpi (was `{ bg, color }`)
- **KPIAdminTab** — STAGES/CONTACTS now imported from `src/types/onboarder-kpi.ts` (`TEMPLATE_STAGES`, `TEMPLATE_CONTACTS`)
- **checkContractorInTPN** — server-side phone filtering instead of loading all contacts
- **Duplicate file number generation** — useEffect now calls shared `generateFileNumber()`
- **console.log cleanup** — all removed
- **createClient() per-render** — fixed in 20 files (wrapped in `useState(() => createClient())`)
- **3 stale-auth bugs** — module-scope `createClient()` in ai-agents, my-settings, system-settings moved inside components
- **XLSX dynamic import** — 7.2MB library now loaded only when admin clicks Import
- **KPIAdminTab save error** — now shows red error message instead of failing silently
- **Middleware resilience** — active users no longer locked out when Supabase DB query fails

**Net result:** 592 lines of duplicate code removed in pass 1. See `SIMPLIFY-20260418.md` for full details and rollback instructions.

**Safety tag:** `pre-ui-customization` on commit `a56cfe4` — revert point before any UI customization work.

**Commits:** `4367bfa`, `1bc5795`, `fc96051`, `03fd514`, `a56cfe4`

---

**Part 2: Portal UI Customization System**

New feature: lets each tenant customize the portal's look and feel during onboarding. Reduces switching costs when companies move from other systems.

**New tabs in System Settings:**

1. **AI Designer** (`AIDesigner.tsx`)
   - Upload screenshot of old/current system
   - AI (Claude vision) analyzes colors, layout, component styles
   - Shows detected palette + layout badges + summary
   - "Apply Colors & Customize Components" applies detected colors instantly
   - 5-step guided walkthrough with visual previews:
     - Status Indicators (badge / circle / progress bar)
     - Data Visualization (big numbers / bars / donuts)
     - Menu Style (hamburger / kebab / meatball / bento)
     - Form Controls (checkbox / toggle switch)
     - Loading Indicator (spinner / skeleton / progress bar)
   - AI pre-selects based on screenshot, admin overrides
   - **Cancel & Revert** button at every step — snapshots state before changes
   - API route: `src/app/api/design-analyzer/route.ts`

2. **UI Components** (`UIComponentGlossary.tsx`)
   - Visual catalog of 24 portal UI components across 5 categories
   - Navigation, Data Display, Form Controls, Feedback & Status, Layout
   - Each card: name, synonyms, description, live interactive preview
   - Plain English — no developer jargon

3. **Appearance** (`AppearanceTab.tsx`)
   - Dark/light mode toggle with visual preview cards
   - 8 color pickers: Accent, Sidebar, Top Bar, Page Background, Cards, Primary Text, Secondary Text, Borders
   - Colors apply instantly via CSS variables as you pick
   - Live mini-portal preview updates in real time
   - Reset to Defaults button
   - Logo upload (PNG/JPG/SVG/WebP, max 500KB)
   - Company name input
   - Replaces "N" badge and "Portal" text in sidebar
   - Company logo shown in dashboard welcome header

**Profile Photo Upload** (My Settings)
- New section at top of My Settings page
- Upload headshot (JPG/PNG/WebP, max 500KB)
- Replaces initials (e.g., "FD") in TopBar with actual photo
- Stored in localStorage with DB backup attempt

**Technical details:**
- Theme via `data-theme` attribute on `<html>` + CSS variables in `globals.css`
- Custom colors via inline CSS variable overrides on `document.documentElement`
- Inline script in `layout.tsx` loads theme + colors before paint (no flash)
- All customization stored in localStorage (will move to per-org DB later)
- Custom events (`portal-branding-changed`, `portal-photo-changed`) for instant cross-component updates

**New Files:**
- `src/app/dashboard/system-settings/AIDesigner.tsx`
- `src/app/dashboard/system-settings/UIComponentGlossary.tsx`
- `src/app/dashboard/system-settings/AppearanceTab.tsx`
- `src/app/api/design-analyzer/route.ts`
- `src/lib/formatters.ts`
- `src/lib/styles.ts`
- `src/lib/theme.ts` — shared theme utilities (CustomColors type, apply/clear functions)
- `src/lib/api-auth.ts` — shared API route auth helper (authenticateAdmin)
- `src/hooks/useSupabase.ts`
- `SIMPLIFY-20260418.md`

**Commits:** `357c726` through `5a44443` — all pushed to staging

---

### Session — April 27, 2026 (evening) — CRM Phase 1 Step 1 (claims table)

**The keystone migration of the CRM build.** Created the canonical `claims` table — the per-claim record that ties Onboarder KPI, Estimator KPI, Settlement Tracker, Claim Health, etc. together. Hub of the CRM hub-and-spoke architecture per `.planning/CRM-PLAN.md`.

**What landed in the live DB (`hkscsovtejeedjebytsv`):**
- `claims` table with 28 data columns + `id`
- 7 explicit indexes + auto-PK + auto-UNIQUE (9 total)
- 7 constraints: 1 PK, 1 UNIQUE (`org_id, file_number`), 2 CHECK (peril, current_phase), 3 FK (org → CASCADE, both user FKs → SET NULL)
- RLS enabled with 6 policies — admins see all org claims; non-admin internal users see only claims where they're the `assigned_adjuster_id`; external partners get NO access until Step 7

**Migration file:** `supabase/migrations/20260427_crm_phase1_claims_table.sql` captures every statement applied via the dashboard SQL editor today, in run order.

**Smoke-tested:** insert / select / delete a `TEST-00001-2026` row succeeded. Unique-per-org constraint validated as a side bonus when an accidental double-Run hit the constraint cleanly.

**Planning docs:** `.planning/CRM-PLAN.md`, `.planning/CW-LEARNINGS.md`, `.planning/OLD-REPO-AUDIT.md`, `.planning/HANDOFF-NEXT-SESSION.md`. All 8 architecture questions resolved before this migration. CRM-PLAN decision log + Phase 1 outline updated to reflect Step 1 ✅ DONE.

**Heads-up for whoever picks up Step 5 later:** `mediations` and `appraisals` tables exist in the live DB (queried by `useMediations.ts` and `useAppraisals.ts`) but have NO migration files. They were created directly in the dashboard. Step 5 will `ALTER TABLE` them anyway, but worth capturing their definitions in the migrations folder during a future cleanup pass.

---

### Session — April 27, 2026 (later evening) — CRM Phase 1 Step 2 (claim_personnel + roles lookup)

**The people side of the CRM hub-and-spoke.** Built two tables: `claim_personnel_roles` (admin-editable role lookup, 23 starter roles seeded) and `claim_personnel` (m2m linking claims to people, polymorphic over internal users + external TPN contacts).

**What landed in the live DB (`hkscsovtejeedjebytsv`):**
- `claim_personnel_roles` — 9 columns + id, 5 indexes (3 explicit + auto PK + auto unique-per-org-name), 5 RLS policies (admin all + active-internal SELECT + admin INSERT/UPDATE/DELETE), seeded with 23 roles (13 internal, 7 external, 3 either).
- `claim_personnel` — 16 columns + id, 7 indexes (6 explicit + auto PK), 6 RLS policies, polymorphic `claim_personnel_person_xor` CHECK enforcing exactly-one of (`user_id`, `external_contact_id`).
- Cascade on `claim_id → claims` confirmed working (test claim deleted → personnel row auto-removed).

**Migration file:** `supabase/migrations/20260427_crm_phase1_step2_personnel_and_roles.sql` captures every statement applied via the dashboard SQL editor today, in run order.

**Smoke-tested:**
- Valid insert (user_id only) succeeded.
- Invalid insert (both polymorphic columns null) failed with error code `23514` on constraint `claim_personnel_person_xor` — exactly as designed.
- Cleanup via DELETE on parent claim cascaded to personnel row.

**Approach C / lookup table chosen** because hardcoded role lists are why ClaimWizard mislabels Warren Harbin on the Wetzel claim. Roles editable from day 1; admin UI deferred to Phase 13+. Decision and rationale logged in `.planning/CRM-PLAN.md` Decision Log.

**Schedule/Calendar integration and Matterport removed from Phase 13+** — Frank confirmed CCS won't use them.

**For Step 3 / Step 4 (next session):** Phase 1 Step 3 = department-membership decision (per CRM-PLAN.md, Frank locked in "single department per user for v1; multi-department deferred" — likely lands as a no-migration decision). Phase 1 Step 4 = backfill `claims` from the seven spokes with `AL-` prefix on legacy `file_number`. Step 5 adds `claim_id` FKs to all 7 spokes (with the `mediations`/`appraisals` untracked-schema heads-up).

---

### Session — April 27, 2026 (very late evening) — CRM Phase 1 Step 4 (backfill)

**First data migration of the CRM build.** Backfilled `claims` from the seven spokes per Step 4 of the Phase 1 plan. Result: **6 estimates rows → 1 canonical `claims` row** (the other six spokes had zero rows in dev — empty no-ops).

**What landed in the live DB (`hkscsovtejeedjebytsv`):**
- `claims` table now has 1 row (was empty post-Step-1 cleanup) — file_number `AL-123456`, `is_legacy = true`, `current_phase = 'Estimating'` (derived from the latest estimate revision's status).
- Dedup via `DISTINCT ON (file_number) ORDER BY revision_number DESC, created_at DESC` — picks the latest revision per claim. The 5 historical revisions stay in `estimates` and will get linked via `claim_id` FK in Step 5.

**Migration file:** `supabase/migrations/20260427_crm_phase1_step4_backfill_estimates_to_claims.sql` captures the INSERT we ran.

**Decisions logged in CRM-PLAN.md (this session):**
- Option B for `current_phase` derivation: `closed`/`settled` → `'Closed'` (with `closed_at` populated); else `'Estimating'`.
- DISTINCT ON pattern for any spoke with revision/parent linking — latest wins.

**Notes for future:**
- The 2 onboarding_clients rows in dev are NOT eligible for backfill yet (neither is `status = 'completed'`). They'll get `claims` rows naturally via Step 12's "Onboarder KPI completion → claim record creation hook."
- One data quality observation: `loss_state` came across as lowercase (`fl` instead of `FL`). Not a bug, but worth normalizing in app code at some point.
- The `mediations` and `appraisals` untracked-schema heads-up still applies for Step 5.

---

### Session — April 28, 2026 (early hours, continuation of Apr 27) — Canonical file_number sweep

**Frank's directive that drove the sweep:** "everything that's on your onboarding KPI needs to be the same in each of these systems when you add something." Locked the canonical-vocabulary rule across the CRM: `file_number`, `claim_number`, `policy_number`, `client_name`, `loss_address` are the five required identifiers across every spoke. No synonyms in code, no per-table renames.

**What landed in the live DB (`hkscsovtejeedjebytsv`):**
- `claim_health_records.claim_id` (text) renamed to `file_number` — it was always semantically a file_number, just misnamed since the table was created.
- `pa_settlements`, `mediations`, `appraisals` each got a new `file_number text` column added (nullable; backfill from `litigation_files.file_number` via the existing `litigation_file_id` FK is a follow-up that pairs with Step 5).
- After: **all 7 CRM spokes carry `file_number` directly** — `onboarding_clients`, `estimates`, `litigation_files`, `pa_settlements`, `mediations`, `appraisals`, `claim_health_records`.

**Code sweep — 13 references updated across 4 files:**
- `src/types/claim-health.ts` (2 interface fields: `ClaimHealthRecord` + `CreateClaimHealthInput`)
- `src/hooks/useClaimLookup.ts` (`normalizeClaimHealth` reads `row.file_number` and maps to `file_number` in the output, fixing both the column name AND the previously-wrong mapping to `claim_number`; CHR search-field branch now searches `file_number` instead of `claim_id`)
- `src/hooks/settlement-tracker/useLitigationFiles.ts` (auto-CHR-row creation when a litigation file is settled)
- `src/app/dashboard/claim-health/page.tsx` (form state, table column header, edit handler, lookup-field state + handlers, 2 UI labels). Placeholder also updated from `"CL-2026-0001"` → `"FL-12345-2026"` to match the actual file_number format.

**Migration file:** `supabase/migrations/20260428_canonical_file_number_sweep.sql` captures all four DDL changes for repo parity.

**New memory entries (durable feedback for future sessions):**
- `feedback_cross_spoke_consistency.md` — "everything on `onboarding_clients` should be on the others"
- `feedback_canonical_vocabulary.md` — the five locked column names

**Known follow-ups (not tonight, paired with Step 5):**
- Backfill the new `file_number` columns on `pa_settlements` / `mediations` / `appraisals` from `litigation_files.file_number` via `litigation_file_id` JOIN.
- The other 4 canonical columns (`claim_number`, `policy_number`, `client_name`, `loss_address`) have known gaps on `pa_settlements` / `mediations` / `appraisals` (none of them carried) and on `litigation_files` (missing `claim_number`). Separate sweep when time allows.
- Minor: `litigation_files.state` is `character varying` not `text` — non-breaking type drift, worth normalizing eventually.

---

## Key Rules

- **BINGO** required before writing any code
- White-label — NO company branding (no CCS, no Coastal)
- Supabase only
- Tenant-first design — every table gets `org_id`
- Keep it simple
