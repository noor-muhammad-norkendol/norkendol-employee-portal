# TPN Rebuild Plan — Norkendol Employee Portal

## Context
The old TPN was a standalone Lovable/Vite app (shadcn, MongoDB, Axios, react-simple-maps) that got copy-pasted into the CCS portal and never fully integrated. We're rebuilding it as a native section of the Norkendol portal — same auth, same Supabase, same styling, same role system. This is furniture that goes in the house, not a separate house.

Two reference repos:
- `Coastal-Claims-Services/talent-partner-network` (standalone app, cleaner structure)
- `Coastal-Claims-Services/coastalclaims-employee-portal` (embedded version in old portal)

### The Problem We're Solving
The old TPN was a standalone Vite app (Lovable) with its own dependencies (shadcn, MongoDB, Axios, react-simple-maps). It got copy-pasted into the CCS portal and never fully integrated. We're rebuilding it as a native section of the Norkendol portal — same auth, same Supabase, same styling, same role system.

### What We Extract From the Old Repos
**From `Coastal-Claims-Services/talent-partner-network` (standalone) and the portal's embedded version:**
- The UI layout patterns (4-view hub, card grids, filter bar, metric cards)
- The data shapes (what fields matter for team members, firms, licenses)
- The business logic (multi-state filtering, license expiration math, deployment tracking)
- The registration wizard flow and field definitions
- The admin approval workflow
- The analytics dashboard structure
- The `External_Partner_Onboarding_Flow.md` — the pipeline doc

**What we DO NOT bring:**
- No shadcn components (Dialog, Tabs, Select, Card, Badge, Button, etc.)
- No Lucide icons (we use inline SVG paths like the rest of the portal)
- No MongoDB models or Mongoose schemas
- No Axios/Express API layer
- No react-simple-maps dependency
- No Lovable project references
- No CCS-specific terminology

### How It Fits Into the Portal

The TPN is NOT a standalone feature. It depends on and feeds into other portal systems:

**TPN consumes from:**
- `users` table — team members are just users with `talent_network = true`
- `user_permissions` — controls who sees TPN, who's in the network
- `licenses` table — already exists, already tied to users
- `firms` table — already exists, external partner companies
- `firm_services` — just created, tracks what firms do
- Auth/roles — `ep_user`, `ep_admin`, `admin`, `super_admin` all have different views

**TPN feeds into:**
- **Compliance tab** — state coverage data from TPN shows who's licensed where
- **User Management** — clicking a team member goes to their user record
- **CRM** (future) — firms in TPN are the same firms that get assigned work
- **Directory** — team members in TPN are a filtered subset of the directory

**This means:** No new auth, no new user model, no new API layer. TPN is a set of pages that read/write the same Supabase tables everything else uses.

## Build Phases

### Phase 1: Save reference material to disk
- Clone `Coastal-Claims-Services/talent-partner-network` to `myProjects/` as read-only reference
- Save `External_Partner_Onboarding_Flow.md` to the Norkendol project's `.planning/` folder
- Write this plan to `.planning/TPN-REBUILD-PLAN.md`

### Phase 2: Schema completion (migration)
- ALTER `firms`: add `website`, `entity_type`, `year_established`, `city`, `state`, `rating`
- ALTER `users`: add `availability` (available/busy/unavailable)
- CREATE `firm_documents` (id, firm_id, org_id, file_name, file_url, uploaded_by, uploaded_at)
- RLS policies for all new columns/tables

### Phase 3: Main hub page — replace current placeholder
- 4 view tabs: Overview, Team Members, Firms, Analytics
- Persistent filter bar (search, state filter, status filter, service filter)
- 6 metric cards at top (team count, firm count, states covered, available, pending, license alerts)
- All styled with CSS vars + inline styles matching existing portal pages
- **File:** `src/app/dashboard/talent-partner-network/page.tsx`

### Phase 4: Team Members view
- Rich cards: name, position, department, location, availability badge, license summary, specializations
- Multi-state filter (must be licensed in ALL selected states)
- Click -> `/dashboard/user-management?user=[id]`
- Data: `users` + `user_permissions` (talent_network=true) + `licenses`

### Phase 5: Firms view + firm detail
- Firm cards: name, status badge, contact, services tags, state badges, rating
- Click into firm -> detail view (slide panel or sub-route) showing:
  - Overview (contact, location, insurance)
  - Services (checkbox grid)
  - Coverage (50-state grid)
  - Documents (upload + list from `firm_documents`)
  - People (users where `firm_id` = this firm)
- Admin CRUD: add/edit/deactivate firms
- Promote ep_user -> ep_admin toggle

### Phase 6: Partner registration
- Simple "Add Partner" form (not 8 steps):
  - Name, email, phone, pick/create firm, what they do, city/state
  - Lands as `ep_user` with `firm_id` set
- Admin can also add firms directly with more detail (company info, services, coverage)

### Phase 7: Admin approval queue (lives at `/dashboard/tpn-admin`)
- List of pending firms with detail modal
- Approve/reject with reason
- Status transitions

### Phase 8: Analytics tab
- License status overview (active/expiring/expired counts from real data)
- Geographic coverage (state grid showing team + firm coverage)
- Utilization (available/busy breakdown)
- Upcoming expirations list
- All computed from live Supabase data, not mock numbers

## Session Strategy (context window management)
- Each session tackles ONE phase
- Read old repo files one at a time as needed, not all 6 at once
- Reference the plan file at session start instead of re-deriving everything

## Dependencies to Note
- Phase 5 firm detail will eventually need Supabase Storage for document uploads
- The user detail route (`/dashboard/user-management/[userId]`) is a separate task after TPN
- Analytics (Phase 8) is last because it needs real data flowing through Phases 4-7 first

## Key Files
- **Current TPN page:** `src/app/dashboard/talent-partner-network/page.tsx`
- **TPN Admin placeholder:** `src/app/dashboard/tpn-admin/page.tsx`
- **Sidebar nav:** `src/components/IconSidebar.tsx` (TPN already in Tier 1A)
- **Text sidebar:** `src/components/TextSidebar.tsx`
- **Supabase client:** `src/lib/supabase.ts`
- **Pattern reference (action items):** `src/app/dashboard/action-items/page.tsx`
- **Pattern reference (compliance):** `src/app/dashboard/compliance/page.tsx`

## Existing Schema (already done this session)
- `firms` table: added `status`, `updated_at`, dropped `services` text[]
- `firm_services` table: created with RLS
- RLS policies on both tables (org-scoped read, admin write)
- Migration committed: `talent_partner_network_schema`

## Verification
After each phase:
1. `npx next build` — must pass clean
2. Visual check at `http://localhost:3002/dashboard/talent-partner-network`
3. Git commit with descriptive message
4. Push to staging branch

## Action Items for End of This Session
- Save this plan to `.planning/TPN-REBUILD-PLAN.md` in the Norkendol project
- Clean git commit with message `planning: TPN rebuild plan saved`
- End the session — do not start building Phase 1 yet
- Next session picks this up fresh
