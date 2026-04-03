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

### What's NOT Done Yet
- Role gating currently hardcoded to Tier 4 — needs to read from Supabase auth
- TextSidebar sub-items are all placeholders
- External partner view defined but not tested
- No database schema for orgs, roles, permissions, apps
- No app suite 2-layer toggle model
- No light mode, no responsive layout
- No white-label tenant config
