# Norkendol Employee Portal — Full History

Everything that's ever been done on this project. Nothing gets deleted from this file.

---

## Session 1 — April 2, 2026

### Context & Decisions

**What is this project?**
A white-label employee portal built by Norkendol (Frank Dalton's dev company). Not branded to any specific company — sold to other businesses as a product. CCS (Coastal Claims Services) will use it but it's not a CCS product.

**Team:**
- Frank Dalton — CEO, product/UX direction
- Noor Mohammed — CTO, head of dev (GitHub: NoorMuhammad1, org: noor-muhammad-norkendol)
- Talha — OUT, no longer involved
- Muhammad-AnasKhan — was a low-end dev Talha hired. Not Noor. Gone with Talha.

**Old portal studied (not copied):**
- Repo: `Coastal-Claims-Services/coastalclaims-employee-portal`
- React + Express + MongoDB + some Supabase + S3
- Built from Lovable with ~1 week coding experience
- 40 Mongoose models, 36 route files, real-time chat, role-based access
- Problems: mixed DBs, duplicate API layers, incomplete CRM backend, hardcoded compliance rules, no email service, security gaps
- Used as reference for user flows and feature set only

**Login logic doc reviewed:**
- Frank's "CCS Portal — Login Logic & Assigned Roles" document
- Defined auth flow, permission checkboxes (3 groups: CRM Features, Portal Apps, Admin Features), internal vs external users, firm-based data filtering
- Adapted for white-label: stripped CCS branding, generalized roles

### Architecture Decisions (LOCKED IN)

**Role Hierarchy — 6 tiers:**

| Tier | Role | Scope |
|------|------|-------|
| 5 | System Administrator | Norkendol — all tenants. Invisible to customers. |
| 4 | Super Admin | Customer's top dog — their whole org. |
| 3 | Admin | Middle layer — team leads, dept heads. |
| 2 | User | Internal employee — sees what they're given. |
| 1b | External Partner Admin | Firm boss — all their firm's data across all cases. |
| 1a | External Partner User | Firm employee — only assigned items. |

- External partners are a mini-tenant within a tenant
- The customer (Super Admin/Admin) doesn't manage the firm's internal users — the EP Admin handles that
- System Administrator is invisible to all customers

**App Suite Model — 2 layers:**
- Layer 1 (Norkendol/System Admin): Controls which apps a tenant has access to (subscription tier)
- Layer 2 (Super Admin/Admin): Toggles those available apps on/off per user within their org
- Build the full system but design so app toggling is just a switch

**Tech Stack:**
- Next.js 16 + TypeScript + Tailwind v4 + Supabase
- Port 3002
- Supabase project: `mmccqhxomkohjydukxnn` (empty, no tables yet)

**UI Direction:**
- Supabase dashboard style — dark mode default
- Thin icon sidebar (far left) with tooltips on hover
- Collapsible text sidebar (second panel) — always visible, arrow button to collapse/expand
- Top bar with date/time + user info (name, role, initials avatar)
- Light on the eyes for long coding sessions

**Codeword:**
- BINGO = green light to write code

### What Was Built

**Repo:** `noor-muhammad-norkendol/norkendol-employee-portal`
**Branch:** main
**Commit:** `6909af0`

Files created:
- `src/app/layout.tsx` — Root layout, dark mode, Geist fonts
- `src/app/page.tsx` — Redirects `/` to `/login`
- `src/app/login/page.tsx` — Dark login page with email/password card, green accent button
- `src/app/dashboard/page.tsx` — Dashboard page wrapped in PortalShell
- `src/app/globals.css` — CSS variables for dark theme, thin scrollbar styling
- `src/components/PortalShell.tsx` — Main layout: icon sidebar + text sidebar + top bar + content
- `src/components/IconSidebar.tsx` — 50px icon strip with N logo, 6 nav icons, tooltips on hover
- `src/components/TextSidebar.tsx` — 220px collapsible menu panel, grouped sections, collapse arrow
- `src/components/TopBar.tsx` — Date/time left, user name/role/avatar right

Sidebar sections defined (placeholder menus):
- Dashboard: Home, Activity, Notifications
- Users: All Users, Departments, Pending Approval, Partner Firms, Invitations
- Apps: App Directory, Installed Apps, App Settings
- Messages: Inbox, Sent, Drafts
- Documents: All Documents, Shared With Me, Upload
- Settings: Profile, Preferences, General, Roles & Permissions, Billing

### Bugs Fixed During Session
- Text sidebar flyout approach was wrong — reverted to permanent panel (Supabase uses permanent, not flyout)
- Icon hover was changing text sidebar content — removed, icons just show tooltips
- Collapse button disappeared when sidebar collapsed — fixed overflow:visible when collapsed
- Tooltip z-index — tooltips were hidden behind text sidebar, added z-50
- Text sidebar collapse to 0px killed the chevron — changed to 16px minimum so chevron stays visible
- Chevron inconsistency — text sidebar used text character, icon sidebar used SVG. Made both identical SVG arrows with matching size, position, z-index, hover behavior

### Iterations on Sidebar Design
Frank provided Supabase dashboard screenshots as reference. Key learnings:
1. Icon sidebar is NOT a flyout — it's permanent. Tooltips on hover, that's it.
2. Text sidebar is also permanent — not a flyout overlay.
3. Both bars need to be independently collapsible/expandable via matching chevrons.
4. When icon sidebar expands, it shows icon + label side by side (160px).
5. When text sidebar collapses, it leaves a thin strip so the re-expand chevron stays visible.
6. Chevrons must be visually identical across both bars — consistency matters.

### Commits
- `6909af0` — Initial scaffold (login, dashboard, dual sidebar, top bar)
- `77977ba` — Added HISTORY.md and HANDOFF.md
- `e7d7919` — Fixed tooltip z-index
- `972ab34` — Both sidebars fully collapsible with matching chevrons

### What's NOT Done Yet
- No auth wired up (login just navigates, no Supabase)
- No database schema
- Sidebar links don't navigate anywhere
- No real user data (hardcoded "Frank Dalton / Super Admin")
- No light mode toggle
- No responsive/mobile layout

---

## Session 2 — April 3, 2026

### Context
Picked up from Session 1. Previous session had built the scaffold with dual sidebars. This session focused on making the left sidebar into real page navigation with role-based access control.

### Role Hierarchy Redesign
Frank provided the definitive 6-tier role system (renumbered from Session 1):

| Tier | Role | Track |
|------|------|-------|
| 1A | User | Internal employee |
| 1B | External Partner User | External — assigned items only |
| 2A | Admin | Internal team lead |
| 2B | External Partner Admin | External firm boss |
| 3 | Super Admin | Internal — full org control |
| 4 | System Administrator | Norkendol only — god mode |

Key insight from Frank: Internal roles stack upward (4>3>2A>1A). External is a completely separate track (2B>1B). Tier 4 is invisible to customers.

### What Was Built

**23 placeholder pages** under `/dashboard/*`:
- Tier 1A (User): dashboard, applications, teams-chat, calendar, university, directory, documents, ai, notifications, compliance
- Tier 2A (Admin): user-management, pending-users, action-items, training, company-updates, departments, crm
- Tier 3 (Super Admin): ai-agents, app-management, compliance-settings, claim-calculator-settings, system-settings, talent-partner-network
- Tier 4 (System Admin): tenant-management

**IconSidebar rewrite:**
- All 24 nav items with `minTier` role gating
- `canAccess()` function handles internal stacking and external separate track
- Each item is a Link to `/dashboard/{slug}`, highlights from URL
- Collapsible to icon-only with chevron toggle
- Plain monospace character icons (no color, no emoji)
- Defaults to Tier 4 for dev (shows everything)

**TextSidebar:**
- Initially converted to floating flyout overlay (position: fixed, slide in/out on hover)
- Frank immediately said no — "put the bar back like we coded"
- Reverted to permanent panel with chevron collapse
- Added contextual sub-items for all 23 pages (placeholder data)

**Other changes:**
- Dashboard layout (`/dashboard/layout.tsx`) wraps all sub-pages in PortalShell
- Dashboard page no longer wraps itself in PortalShell (layout does it)
- PortalShell derives active section from URL
- Auth middleware, login page, Supabase client wired up
- Frank's role set to `super_admin` in Supabase (`hkscsovtejeedjebytsv`)

### Bugs / Issues
- Previous session's Sidebar.tsx (single sidebar replacement) was built and deleted — it had merged both sidebars into one, losing the two-panel architecture
- Flyout overlay attempt was wrong — Frank wants permanent panel, not hover-based
- Context window blew up 5 times in a row in prior attempts — saved checkpoint summaries to prevent repeat

### Commits
- `c448519` — Role-gated sidebar + 23 dashboard pages + flyout reverted to permanent panel

### Session 2 Continued — Sidebar Refinements

**Chevron fix:**
- IconSidebar had `overflow: hidden` which clipped the round chevron button (positioned at `right: -12px`). Changed to `overflow: visible` to match TextSidebar. Both chevrons now visible and matching.

**Accordion sections:**
- Frank: "All nav items in one flat list — that's not what I want. Group by role tier with collapsible section headers."
- Rewrote IconSidebar as accordion — 4 collapsible sections (User, Admin, Super Admin, System Admin)
- Each section header has a rotating chevron, all collapsed by default
- Only sections the user's role can access are visible
- Black and white only — no colors on headers

**SVG icons:**
- Frank: "Put icons next to the names... don't make them color icons, keep them gray, don't make them cartoony"
- Replaced all punctuation character placeholders with proper stroke-based SVG icons
- 24 unique icons drawn in 24x24 viewBox, rendered at 16px
- All gray (`var(--text-muted)`), thin strokes (1.8px), no fill
- Examples: grid (Dashboard), speech bubble (Teams Chat), bell (Notifications), gear (System Settings), building (Tenant Management)

**Drag-and-drop reordering:**
- Installed @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities
- Each accordion section is its own DndContext — items cannot leave their parent section
- Subtle 8-dot grip handle appears on hover (left side of each item)
- 5px activation distance so clicks still work for navigation
- Custom order saved to `nav_order` jsonb column on `public.users` in Supabase
- Loads on mount, saves immediately on reorder — persists across sessions and devices
- New items added after user last sorted appear at the end automatically

**Supabase migration:**
- Added `nav_order jsonb DEFAULT '{}'` column to `public.users`

### Commits (Session 2 — all)
- `c448519` — Role-gated sidebar + 23 dashboard pages + flyout reverted to permanent panel
- `ee4a861` — Update HANDOFF.md and HISTORY.md for session 2
- `020b6eb` — Accordion sidebar with SVG icons and drag-and-drop reordering

### What's NOT Done Yet (End of Session 2)
- Role gating currently hardcoded to Tier 4 — needs to read from Supabase auth
- TextSidebar sub-items are all placeholders
- External partner view defined but not tested
- No database schema for orgs, roles, permissions, apps
- No app suite 2-layer toggle model
- No light mode, no responsive layout
- No white-label tenant config

---

## Session 3 — April 3, 2026

### Context
Picked up from Session 2. Portal had scaffold with dual sidebars, 23 placeholder pages, role-gated navigation. This session built the Dashboard home page and 4 admin pages with full Supabase CRUD.

Frank provided 4 screenshots from the old CCS portal as **visual reference only** (no code copied). Also studied the old portal's data models via GitHub MCP (Coastal-Claims-Services/coastalclaims-employee-portal) — extracted field structures and business logic, wrote everything from scratch.

### Supabase Schema (6 new tables)

All tables created via Supabase MCP migration `dashboard_tables` + `leaderboard_active_flag`:

**`company_updates`** — id, org_id, title, content, type (news/event/announcement), priority (low/medium/high/urgent), is_published, pinned, visible_to_all, author_id, author_name, published_at, expires_at, created_at, updated_at

**`action_items`** — id, org_id, title, description, item_type (task/claim), assigned_to, assigned_by, assigned_to_name, assigned_by_name, status (pending/in_progress/completed/cancelled), priority, due_date, completed_at, created_at, updated_at

**`notifications`** — id, org_id, recipient_id, title, message, type (info/warning/error/success), sender_name, read_at, action_url, action_label, expires_at, created_at

**`user_pinned_apps`** — id, user_id, org_id, name, description, url, icon_url, category, is_custom, sort_order, created_at

**`leaderboard_config`** — id, org_id, metric_name, metric_key, is_active, created_at, updated_at

**`leaderboard_entries`** — id, org_id, config_id, user_id, user_name, value, rank, period, created_at

All have RLS enabled, org_id FK to public.orgs, appropriate select/insert/update/delete policies.

**Seed data inserted:** 3 company updates, 3 action items, 3 notifications, 6 pinned apps, 1 leaderboard config with 5 entries (Frank #1 at $142,500).

### What Was Built

**Dashboard page** (`/dashboard/page.tsx`) — 5 sections:
1. Welcome header — "Welcome back, {firstName}" + formatted date
2. Company Updates — card grid (3 cols on lg), type badge (blue/green/purple) + priority badge (green/yellow/red), expandable content with "Read More", author + date footer
3. Quick Access — horizontal row of pinned apps with letter avatar gradients, "View All" link to /applications
4. Bottom 3-column grid:
   - My Action Items — pending tasks with checkbox, priority badge, due date, "From:" assignee
   - Leaderboard — top 5 from active config, medals for top 3, gold highlight on #1, dollar formatted values
   - Recent Notifications — unread only, color-coded dots by type, time-ago stamps, "View All" link

**Company Updates admin** (`/dashboard/company-updates/page.tsx`):
- Full list showing all updates (published + drafts at 60% opacity)
- Badges: type, priority, Published/Draft status
- Expandable content preview (click title)
- Inline actions: pin/unpin (filled/unfilled icon), publish/unpublish (eye icon), edit (pencil), delete (trash + confirm)
- Create/Edit modal: title, content textarea, type dropdown, priority dropdown, checkboxes (Publish Now, Pin to top, Visible to all), expiration date picker

**Notifications admin** (`/dashboard/notifications/page.tsx`):
- Full list with color-coded dots (info=blue, warning=yellow, error=red, success=green)
- Type badge, read/unread dimming (55% opacity for read)
- Filters: status (all/unread/read) + type (all/info/warning/error/success)
- Unread count badge in header
- Actions: mark read (checkmark), mark unread (dot), mark all read (bulk), delete + confirm
- Action URL/label rendered as link on each notification
- Send Notification modal: title, message textarea, type dropdown, sender name, action URL + label, expiration

**Action Items admin** (`/dashboard/action-items/page.tsx`):
- Full list with checkbox (click to complete/uncomplete), strikethrough on completed
- Badges: type (task=purple, claim=blue), priority, status (pending=yellow, in_progress=blue, completed=green, cancelled=gray)
- Filters: status (5 options) + priority (5 options), colored filter text
- Pending + in progress counts in header
- Status dropdown: change to any status inline
- Overdue detection: due dates in past show red + "(Overdue)" text
- Create/Edit modal: title, description textarea, type dropdown, priority dropdown, assign to (name text), due date

**Leaderboard admin** (`/dashboard/leaderboard/page.tsx`):
- Multiple leaderboard support via tab bar
- Active/Inactive lifecycle: view toggle with counts, Deactivate button (shelves board, keeps data), Reactivate button (brings it back)
- Create leaderboard modal: name + metric key (auto-generated from name if blank)
- Add Entry modal: name + value (number)
- Auto-ranking: re-ranks all entries by value (descending) on every add/edit/delete
- Medals for top 3, gold background highlight on #1
- Edit/delete entries inline, edit/delete/deactivate boards
- "Delete Forever" is separate from deactivate — permanently removes board + all entries
- Dashboard widget only pulls `is_active = true` config

### Sidebar Changes
- **Notifications** moved from User tier (1A) → Admin tier (2A)
- **Leaderboard** added to Admin tier (2A) with trophy SVG icon
- Both sit next to Company Updates and Action Items in the Admin section

### Badge Color System (used consistently across all pages)

**Type badges:**
- news / info: blue (#1e3a5f bg, #60a5fa text)
- event / success: green (#1a3a2a bg, #4ade80 text)
- announcement: purple (#2d1b4e bg, #a78bfa text)
- task: purple (#2d1b4e bg, #a78bfa text)
- claim: blue (#1e3a5f bg, #60a5fa text)

**Priority badges:**
- low: green (#1a3a2a bg, #4ade80 text)
- medium: yellow (#3a3520 bg, #facc15 text)
- high: red (#3a1a1a bg, #f87171 text)
- urgent: dark red (#4a1a1a bg, #ef4444 text)

**Status badges:**
- pending: yellow
- in_progress: blue
- completed: green
- cancelled: gray

### Commits
- `e888d2f` — Dashboard + 4 admin pages wired to Supabase

### What's NOT Done Yet (End of Session 3)
- Role gating currently hardcoded to Tier 4 — needs to read from Supabase auth
- TextSidebar sub-items are all placeholders
- External partner view defined but not tested
- User management page — needed for notification recipient picker and action item assignment by user ID
- Application Vault page — needed for Quick Access add/remove pinned apps
- App suite 2-layer toggle model not built
- No light mode, no responsive layout
- No white-label tenant config

---

## Session 14 — April 4-5, 2026

### Context
Picked up from Session 13. Fixed a bug where external users appeared in the employee directory, then built the full University + Training system.

### Bug Fix: External Users in Employee Directory
- Employee directory, compliance page, and compliance-settings page were all missing `.eq("user_type", "internal")` filter on their user queries
- External/partner users were showing up alongside internal employees
- Fixed all 3 pages with one-line additions
- Commit: `053dbff`

### University + Training LMS — Full Build

**6 new Supabase tables:**
- `training_categories` — admin-customizable course categories (seeded: Onboarding, Technical, Compliance, Leadership, Safety)
- `training_courses` — course catalog with title, description, category, level, passing score, instructor
- `training_lessons` — ordered content within a course (video, document, or quiz type)
- `training_quiz_questions` — multiple choice questions for quiz-type lessons (jsonb options with correct answer flagging)
- `training_assignments` — who needs to complete what, with due dates and status tracking
- `training_progress` — per-user, per-course progress with completed lessons, quiz scores, percentage

**Supabase Storage:**
- `training-content` bucket (public) for video and document uploads
- Migration: `20260405_training_storage_bucket.sql`

**Training Admin** (`/dashboard/training`) — Tier 2A:
- **Courses tab** — create/edit/delete courses, publish/unpublish toggle, lesson builder
- **Lesson Builder** — add/reorder/remove lessons (video, document, quiz types), upload videos and documents to Supabase Storage or paste URLs
- **Quiz Editor** — add multiple choice questions with correct answer flagging, edit/delete questions
- **Categories tab** — CRUD for custom categories, activate/deactivate
- **Assignments tab** — assign courses to individual users, departments, all internal, all external, or everyone. Sets due date + priority. Auto-creates action items on dashboard.
- **Analytics tab** — total courses, published count, total assignments, completion rate, status breakdown bars, courses by category, overdue list

**University** (`/dashboard/university`) — Tier 1A:
- **My Assignments** — cards with progress bars, due dates, status badges, assigned-by name
- **Browse Courses** — grid filtered by category tabs, level badges
- **Completed** — past completions with dates
- **Course Viewer** — full inline viewer with:
  - Video player (YouTube embed detection or direct video)
  - Document viewer (open/download link)
  - Quiz interface (multiple choice, submit, pass/fail with score, retry on fail)
  - Lesson playlist sidebar with completion checkmarks
  - Progress bar and percentage tracking
  - Auto-advance to next lesson on completion
  - Course complete celebration when all lessons done + quizzes passed

**Action Items Integration:**
- Added `training` to action_items `item_type` CHECK constraint (was task/claim only)
- Assigning training auto-creates an action item with type "training" (green badge)
- Completing a course auto-marks both the training_assignment AND the action_item as completed
- Updated action-items page and dashboard to support training type

**TextSidebar updates:**
- University: "My Assignments", "Browse Courses", "Completed"
- Training: "Courses", "Categories", "Assignments", "Analytics"

**Mock course created:**
- "New Adjuster Orientation" — Onboarding category, beginner level, published
- 3 lessons: "Welcome to the Company" (video, empty), "Tools & Software Setup" (video, empty), "Orientation Quiz" (quiz, no questions yet)
- Ready for Frank to drop videos in and add quiz questions

### Additional Changes (same session)
- **Removed video duration field** — duration tracking was unnecessary, removed from lesson builder form and course viewer playlist
- **Video-first course creation wizard** — replaced the old Create Course modal with a 3-step wizard:
  - Step 1: Upload video or paste URL (content first)
  - Step 2: Fill in course details (title auto-fills from filename)
  - Step 3: Optionally add quiz questions inline
  - One save creates course + video lesson + quiz lesson all at once
  - Old modal kept for editing existing courses only
- **AI-powered course generation plan approved** — not built yet, saved for next session:
  - Path A (primary): paste transcript → cheap text model generates title/description/category/quiz
  - Path B (fallback): frame extraction from video → vision model analyzes content
  - Org-level AI settings (white-label, tenant enters their own API key)
  - Frank's org will use Anthropic (Claude) for everything
  - Plan saved at `.claude/plans/jazzy-whistling-rose.md`

### Commits
- `053dbff` — Fix external users in directory/compliance (bug fix)
- `64fc7cf` — University + Training pages with full LMS, quiz system, action item integration
- `d8543bd` — Add file upload for training lessons (Supabase Storage)
- `ede0e2c` — Update HISTORY.md and HANDOFF.md for Session 14
- `8ef7841` — Remove video duration field
- `b427582` — Video-first course creation wizard

### Future Enhancements — Training/University
- ~~**AI-powered course generation**~~ — DONE in Session 15 (Phases A+B). Phase C (video frame analysis) deferred.
- **Drag-and-drop file upload** — add drag-and-drop zone for videos/documents in lesson builder. Low priority.
- Bulk assign from University browse view
- Certificate generation on course completion

---

## Session 15 — April 5, 2026

### Context & Decisions

**Session goal:** Build central AI layer + transcript-to-course generation.

**Architecture decision (Frank + Claude Desktop):** AI is NOT per-feature. One central AI engine for the whole portal. Every feature (training, compliance, state regs, future features) goes through the same pipe. Two-table design:
- `ai_context_templates` — Norkendol manages locked system prompts per feature. Tenants never see these. `feature_key` column for programmatic lookup.
- `org_settings` — one row per org. AI provider, encrypted API key, model, and one `business_context` text field the tenant writes once ("We are a house cleaning company...") that gets prepended to every AI call.

Every AI call = locked system_prompt + business_context + user input. Simple, scalable, white-label.

**Key insight from Frank:** Don't build per-feature tenant customization. One "About My Business" context covers everything. The tenant shouldn't have to configure AI separately for training vs. compliance — the business context is the same everywhere.

**Desktop feedback incorporated:** `ai_context_templates` is a separate table from per-org settings so Norkendol can update a system prompt once and every tenant inherits it. API keys encrypted with AES-256-GCM at application layer (not just DB-level).

### What Was Built

**Central AI Layer:**
- `supabase/migrations/20260405_ai_foundation.sql` — `ai_context_templates` table + `org_settings` table with `ai_interview_completed` and `onboarding_status` placeholders for future Executive Intelligence work
- `src/lib/ai.ts` — shared `callAI<T>()` utility. Reads template by feature_key, reads org settings, decrypts API key, calls Anthropic or OpenAI, parses JSON response. Also exports `encryptApiKey()`/`decryptApiKey()` helpers.
- `src/lib/ai-types.ts` — `GeneratedCourse` interface + `validateGeneratedCourse()` validator
- `@anthropic-ai/sdk` and `openai` packages installed
- `ENCRYPTION_KEY` added to `.env.local`

**System Settings Page (was placeholder):**
- `src/app/dashboard/system-settings/page.tsx` — tabbed page, AI Configuration tab
- Provider dropdown (Anthropic/OpenAI), API key input (password field, shows "encrypted" status), model selector (with model lists per provider), business context textarea
- `src/app/api/settings/ai/route.ts` — GET/PUT, super_admin+ only, encrypts key before storing

**Transcript → Course Generation:**
- `src/app/api/training/generate-from-transcript/route.ts` — POST, admin+ role check, 50K char limit, calls `callAI()`, validates response shape
- Training wizard Step 2: "Generate with AI — Paste a Transcript" button opens modal
- Modal: textarea with character count, configurable quiz question count (2-15, default 5)
- On success: auto-populates title, description, category, level, quiz questions AND renames video lesson to match AI-generated title

**Cover Images:**
- Training wizard Step 2: optional cover image upload (stored in `training-content/covers/`)
- `thumbnail_url` wired into course save
- University page: course cards now show cover image on top (like old CCS portal), with gradient placeholder for courses without covers
- Assignment cards also show cover images

**Quiz Grading System:**
- Standard US letter grades: A+ (97+) through F (below 60)
- Default passing score changed from 80% to 70% (C- or better)
- Quiz results show: big letter grade → percentage → pass/fail message → attempt count
- On retry: questions AND answer options are shuffled so users can't memorize positions
- Failed users CANNOT mark course complete — must retake until they pass
- Grade stored in `training_progress.quiz_scores` per lesson (score, passed, grade, attempts)

### Commits
- `d54ad3d` — Central AI layer, transcript-to-course generation, cover images, quiz grading

### Not Built Yet — Next Sessions (PRIORITIZED)

1. **AI Management page** — Super Admin page to browse `ai_context_templates`, see what each AI agent does, add context/instructions per feature. Table and seed data exist, UI does not.
2. **Rename "Training" sidebar item to "University Admin"** — less confusing since University is the student view
3. **Training Admin → Categories tab logic** — verify CRUD works end-to-end, ability to reassign courses between categories
4. **Training Admin → Assignments tab logic** — verify assign-to-individual and assign-by-department works
5. **Course certification system** — completion certificate per user per course, training coordinator review panel, which-questions-are-failing analytics
6. **Phase C: Video → Course generation** — frame extraction + vision model for videos without transcripts
7. **Drag-and-drop file upload** for lesson builder (low priority)
8. **Add cover image upload to course edit modal** (existing courses can't add covers yet, only new ones)
